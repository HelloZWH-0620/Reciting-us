/* ===== js/migrate.js（v3 §6.5 localStorage → 服务端一次性迁移） =====
   把 bsw_* 关键键打包 POST /api/import（C# 端单事务原子写入 SQLite）。
   仅在收到 200 后写 migrated_v2 标志；失败下次启动自动重试。 */
(function () {
  'use strict';
  var MIGRATED_KEY = 'bsw_migrated_v2';

  function collectKv() {
    var kv = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf('bsw_') !== 0 || key === MIGRATED_KEY) continue;
        kv.push({ profileId: 'default', key: key, value: localStorage.getItem(key) || '', updatedAt: Date.now() });
      }
    } catch (e) { /* localStorage 不可用 */ }
    return kv;
  }

  async function migrate() {
    try {
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return; // file:// 无服务器
      if (localStorage.getItem(MIGRATED_KEY) === '1') return;

      var kv = collectKv();
      if (kv.length === 0) { localStorage.setItem(MIGRATED_KEY, '1'); return; } // 空归档直接标记

      var archive = { schemaVersion: 1, progress: null, wrongBook: null, flashcards: null, kvStore: kv };
      var resp = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archive)
      });
      if (resp.ok) {
        localStorage.setItem(MIGRATED_KEY, '1');
        try { console.info('[迁移完成]', await resp.json()); } catch (e) { }
      } else {
        console.warn('[迁移失败] HTTP', resp.status, '将在下次启动重试');
      }
    } catch (e) {
      console.warn('[迁移异常]', e && e.message, '将在下次启动重试');
    }
  }

  // 避开启动关键路径：页面空闲后再迁移
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(migrate, 1200); });
  } else {
    setTimeout(migrate, 1200);
  }
})();
