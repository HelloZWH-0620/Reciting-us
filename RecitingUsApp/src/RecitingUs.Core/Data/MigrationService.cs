using System.Text.Json;
using System.Text.Json.Serialization;

namespace RecitingUs.Core;

public sealed record ProgressRecord(string ProfileId, string ArticleId, string Mode,
    bool Recited, int Mastery, long? DueAt, long? LastReview, int ReviewCount);

public sealed record WrongItem(long? Id, string ProfileId, string? ArticleId, string Type,
    string Prompt, string? Answer, string? UserAnswer, bool Mastered, long CreatedAt);

public sealed record FlashcardItem(long? Id, string ProfileId, string ArticleId,
    string? Front, string? Back, double Ease, double IntervalDays, long? DueAt, long? LastReview);

public sealed record KvEntry(string ProfileId, string Key, string Value, long UpdatedAt);

public sealed record StatsPoint(string Day, int Practice, int Correct, int StudySeconds, int ArticlesRead);

/// <summary>导入/导出归档（schemaVersion &gt; 当前版本则拒绝，&lt; 则做版本化升级）。</summary>
public sealed record ExportArchive(
    [property: JsonPropertyName("schemaVersion")] int SchemaVersion,
    [property: JsonPropertyName("progress")] List<ProgressRecord>? Progress,
    [property: JsonPropertyName("wrongBook")] List<WrongItem>? WrongBook,
    [property: JsonPropertyName("flashcards")] List<FlashcardItem>? Flashcards,
    [property: JsonPropertyName("kvStore")] List<KvEntry>? KvStore);

public sealed record MigrationSummary(
    int ProgressImported, int WrongBookImported, int FlashcardsImported, int KvImported)
{
    public bool ok => true;
    public bool success => true;
    public int schemaVersion => AppDb.CurrentSchemaVersion;
}

/// <summary>前端 localStorage 归档 → SQLite 原子导入（v3 §6.5：单事务，失败整体回滚）。</summary>
public sealed class MigrationService(AppDb db)
{
    private static readonly JsonSerializerOptions _caseInsensitive = new() { PropertyNameCaseInsensitive = true };

    public async Task<MigrationSummary> ImportAsync(Stream archiveStream)
    {
        ExportArchive? archive;
        try
        {
            archive = await JsonSerializer.DeserializeAsync<ExportArchive>(archiveStream, _caseInsensitive).ConfigureAwait(false);
        }
        catch (JsonException e)
        {
            throw new InvalidDataException("无效的归档格式", e);
        }
        if (archive is null) throw new InvalidDataException("归档内容为空");
        if (archive.SchemaVersion > AppDb.CurrentSchemaVersion)
            throw new InvalidOperationException($"不支持的 schema 版本: {archive.SchemaVersion}");

        var summary = new MigrationSummary(0, 0, 0, 0);
        await db.ExecuteInTransactionAsync(async (conn, tx) =>
        {
            foreach (var p in archive.Progress ?? new())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = """
                    INSERT INTO progress(profile_id, article_id, mode, recited, mastery, due_at, last_review, review_count)
                    VALUES (@p, @a, @m, @r, @ma, @d, @lr, @rc)
                    ON CONFLICT(profile_id, article_id, mode) DO UPDATE SET
                      recited=excluded.recited, mastery=excluded.mastery, due_at=excluded.due_at,
                      last_review=excluded.last_review, review_count=excluded.review_count;
                    """;
                cmd.Parameters.AddWithValue("@p", p.ProfileId ?? "default");
                cmd.Parameters.AddWithValue("@a", p.ArticleId);
                cmd.Parameters.AddWithValue("@m", p.Mode);
                cmd.Parameters.AddWithValue("@r", p.Recited ? 1 : 0);
                cmd.Parameters.AddWithValue("@ma", p.Mastery);
                cmd.Parameters.AddWithValue("@d", p.DueAt ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@lr", p.LastReview ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@rc", p.ReviewCount);
                await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
                summary = summary with { ProgressImported = summary.ProgressImported + 1 };
            }

            foreach (var w in archive.WrongBook ?? new())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = """
                    INSERT INTO wrong_book(profile_id, article_id, type, prompt, answer, user_answer, mastered, created_at)
                    VALUES (@p, @a, @t, @pr, @an, @ua, @m, @c);
                    """;
                cmd.Parameters.AddWithValue("@p", w.ProfileId ?? "default");
                cmd.Parameters.AddWithValue("@a", w.ArticleId ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@t", w.Type);
                cmd.Parameters.AddWithValue("@pr", w.Prompt);
                cmd.Parameters.AddWithValue("@an", w.Answer ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@ua", w.UserAnswer ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@m", w.Mastered ? 1 : 0);
                cmd.Parameters.AddWithValue("@c", w.CreatedAt);
                await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
                summary = summary with { WrongBookImported = summary.WrongBookImported + 1 };
            }

            foreach (var f in archive.Flashcards ?? new())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = """
                    INSERT INTO flashcard(profile_id, article_id, front, back, ease, interval_days, due_at, last_review)
                    VALUES (@p, @a, @f, @b, @e, @i, @d, @lr);
                    """;
                cmd.Parameters.AddWithValue("@p", f.ProfileId ?? "default");
                cmd.Parameters.AddWithValue("@a", f.ArticleId);
                cmd.Parameters.AddWithValue("@f", f.Front ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@b", f.Back ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@e", f.Ease);
                cmd.Parameters.AddWithValue("@i", f.IntervalDays);
                cmd.Parameters.AddWithValue("@d", f.DueAt ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@lr", f.LastReview ?? (object)DBNull.Value);
                await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
                summary = summary with { FlashcardsImported = summary.FlashcardsImported + 1 };
            }

            foreach (var kv in archive.KvStore ?? new())
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = """
                    INSERT INTO kv_store(profile_id, key, value, updated_at)
                    VALUES (@p, @k, @v, @u)
                    ON CONFLICT(profile_id, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
                    """;
                cmd.Parameters.AddWithValue("@p", kv.ProfileId ?? "default");
                cmd.Parameters.AddWithValue("@k", kv.Key);
                cmd.Parameters.AddWithValue("@v", kv.Value);
                cmd.Parameters.AddWithValue("@u", kv.UpdatedAt);
                await cmd.ExecuteNonQueryAsync().ConfigureAwait(false);
                summary = summary with { KvImported = summary.KvImported + 1 };
            }
        }).ConfigureAwait(false);

        AppLogger.Info($"导入完成: 进度 {summary.ProgressImported} / 错题 {summary.WrongBookImported} / 闪卡 {summary.FlashcardsImported} / KV {summary.KvImported}");
        return summary;
    }

    /// <summary>全量导出（DB 全表 + 汇总）。</summary>
    public Task<ExportArchive> ExportAsync(string profileId = "default") => Task.FromResult(new ExportArchive(
        AppDb.CurrentSchemaVersion,
        db.ExecuteReadAsync("SELECT profile_id, article_id, mode, recited, mastery, due_at, last_review, review_count FROM progress WHERE profile_id=@p",
            r => new ProgressRecord(r.GetString(0), r.GetString(1), r.GetString(2), r.GetInt64(3) != 0, r.GetInt32(4),
                r.IsDBNull(5) ? null : r.GetInt64(5), r.IsDBNull(6) ? null : r.GetInt64(6), r.GetInt32(7)),
            ("@p", profileId)).GetAwaiter().GetResult(),
        db.ExecuteReadAsync("SELECT id, profile_id, article_id, type, prompt, answer, user_answer, mastered, created_at FROM wrong_book WHERE profile_id=@p",
            r => new WrongItem(r.GetInt64(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetString(2), r.GetString(3),
                r.GetString(4), r.IsDBNull(5) ? null : r.GetString(5), r.IsDBNull(6) ? null : r.GetString(6),
                r.GetInt64(7) != 0, r.GetInt64(8)),
            ("@p", profileId)).GetAwaiter().GetResult(),
        db.ExecuteReadAsync("SELECT id, profile_id, article_id, front, back, ease, interval_days, due_at, last_review FROM flashcard WHERE profile_id=@p",
            r => new FlashcardItem(r.GetInt64(0), r.GetString(1), r.GetString(2), r.IsDBNull(3) ? null : r.GetString(3),
                r.IsDBNull(4) ? null : r.GetString(4), r.GetDouble(5), r.GetDouble(6),
                r.IsDBNull(7) ? null : r.GetInt64(7), r.IsDBNull(8) ? null : r.GetInt64(8)),
            ("@p", profileId)).GetAwaiter().GetResult(),
        db.ExecuteReadAsync("SELECT profile_id, key, value, updated_at FROM kv_store WHERE profile_id=@p",
            r => new KvEntry(r.GetString(0), r.GetString(1), r.GetString(2), r.GetInt64(3)),
            ("@p", profileId)).GetAwaiter().GetResult()));
}
