using Microsoft.Data.Sqlite;

namespace RecitingUs.Core;

/// <summary>
/// SQLite 封装（v3 §6.2）：WAL 模式 + 外键 + 写操作串行化锁 + schema_version 版本化迁移（事务内执行）。
/// 读走 WAL 快照不阻塞，写由 _writeLock 保证事务隔离。
/// </summary>
public sealed class AppDb : IDisposable
{
    private readonly string _connectionString;
    private readonly SemaphoreSlim _writeLock = new(1, 1);

    public const int CurrentSchemaVersion = 1;

    public AppDb(string dbPath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Cache = SqliteCacheMode.Shared,
            Mode = SqliteOpenMode.ReadWriteCreate
        }.ToString();
        Initialize();
    }

    public string ConnectionString => _connectionString;

    private void Initialize()
    {
        using var conn = OpenConnection();
        Pragmas(conn);
        RunMigrations(conn);
        AppLogger.Info($"SQLite 就绪 (schema v{GetSchemaVersion(conn)})");
    }

    private SqliteConnection OpenConnection()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        return conn;
    }

    private static void Pragmas(SqliteConnection conn)
    {
        foreach (var pragma in new[] { "PRAGMA journal_mode=WAL;", "PRAGMA synchronous=NORMAL;", "PRAGMA foreign_keys=ON;" })
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = pragma;
            cmd.ExecuteScalar();
        }
    }

    private static int GetSchemaVersion(SqliteConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_version';";
        if (Convert.ToInt64(cmd.ExecuteScalar()!) == 0) return 0;
        cmd.CommandText = "SELECT COALESCE(MAX(version), 0) FROM schema_version;";
        return Convert.ToInt32(cmd.ExecuteScalar()!);
    }

    private void RunMigrations(SqliteConnection conn)
    {
        var current = GetSchemaVersion(conn);
        foreach (var (version, sql) in Migrations())
        {
            if (version <= current) continue;
            using var tx = conn.BeginTransaction();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = sql;
                cmd.ExecuteNonQuery();
                cmd.Parameters.Clear();
                cmd.CommandText = "INSERT OR REPLACE INTO schema_version(version, applied_at) VALUES (@v, strftime('%s','now'));";
                cmd.Parameters.AddWithValue("@v", version);
                cmd.ExecuteNonQuery();
                tx.Commit();
                AppLogger.Info($"数据库迁移到 v{version}");
            }
            catch
            {
                tx.Rollback();
                throw; // 迁移失败即启动失败：schema_version 未推进，下次启动重试
            }
        }
    }

    private static IEnumerable<(int Version, string Sql)> Migrations()
    {
        yield return (1, SchemaV1);
    }

    private const string SchemaV1 = """
        CREATE TABLE IF NOT EXISTS profile (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);

        CREATE TABLE IF NOT EXISTS progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id TEXT NOT NULL DEFAULT 'default',
          article_id TEXT NOT NULL,
          mode TEXT NOT NULL,
          recited INTEGER NOT NULL DEFAULT 0,
          mastery INTEGER NOT NULL DEFAULT 0,
          due_at INTEGER, last_review INTEGER, review_count INTEGER NOT NULL DEFAULT 0,
          UNIQUE(profile_id, article_id, mode));

        CREATE TABLE IF NOT EXISTS wrong_book (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id TEXT NOT NULL DEFAULT 'default',
          article_id TEXT, type TEXT NOT NULL,
          prompt TEXT NOT NULL, answer TEXT, user_answer TEXT,
          mastered INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_wrong_profile ON wrong_book(profile_id, mastered);

        CREATE TABLE IF NOT EXISTS stats_daily (
          profile_id TEXT NOT NULL DEFAULT 'default',
          day TEXT NOT NULL,
          practice_count INTEGER NOT NULL DEFAULT 0, correct_count INTEGER NOT NULL DEFAULT 0,
          study_seconds INTEGER NOT NULL DEFAULT 0, articles_read INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY(profile_id, day));

        CREATE TABLE IF NOT EXISTS flashcard (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id TEXT NOT NULL DEFAULT 'default', article_id TEXT NOT NULL,
          front TEXT, back TEXT, ease REAL NOT NULL DEFAULT 2.5, interval_days REAL NOT NULL DEFAULT 0,
          due_at INTEGER, last_review INTEGER);

        CREATE TABLE IF NOT EXISTS kv_store (
          profile_id TEXT NOT NULL DEFAULT 'default', key TEXT NOT NULL, value TEXT NOT NULL,
          updated_at INTEGER NOT NULL, PRIMARY KEY(profile_id, key));

        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
        """;

    /// <summary>写操作（带锁）。</summary>
    public async Task<int> ExecuteWriteAsync(string sql, params (string Name, object? Value)[] parameters)
    {
        await _writeLock.WaitAsync().ConfigureAwait(false);
        try
        {
            using var conn = OpenConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            Bind(cmd, parameters);
            return await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
        }
        finally { _writeLock.Release(); }
    }

    /// <summary>读操作（WAL 下不与写互斥）。</summary>
    public async Task<List<T>> ExecuteReadAsync<T>(string sql, Func<SqliteDataReader, T> map, params (string Name, object? Value)[] parameters)
    {
        using var conn = OpenConnection();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        Bind(cmd, parameters);
        using var reader = await cmd.ExecuteReaderAsync().ConfigureAwait(false);
        var results = new List<T>();
        while (await reader.ReadAsync().ConfigureAwait(false)) results.Add(map(reader));
        return results;
    }

    /// <summary>在单个事务中执行一组写操作（原子导入），任一失败整体回滚。</summary>
    public async Task ExecuteInTransactionAsync(Func<SqliteConnection, SqliteTransaction, Task> body)
    {
        await _writeLock.WaitAsync().ConfigureAwait(false);
        try
        {
            using var conn = OpenConnection();
            using var tx = conn.BeginTransaction();
            try
            {
                await body(conn, tx).ConfigureAwait(false);
                tx.Commit();
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }
        finally { _writeLock.Release(); }
    }

    private static void Bind(SqliteCommand cmd, (string Name, object? Value)[] parameters)
    {
        foreach (var (name, value) in parameters)
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
    }

    public void Dispose() => _writeLock.Dispose();
}
