/* =====================================================================
   ACCOUNT 模块：每次打开 app.html 先展示欢迎/账户界面
   - 检查 userdata 下是否存在用户配置文件（profile_*.json）
   - 无则引导创建；有则在账户选择界面登录或新建（参考 Windows 账户）
   - 登录后把该用户的 JSON 配置载入 localStorage，再启动 bootApp()
   - 之后所有用户数据随使用逐步写入该 JSON 文件（见 saveProfile）
   ===================================================================== */
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function ProfileAPI() {
  var BASE = '/api/userdata';
  function req(url, opts) {
    opts = opts || {};
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return { success: false, error: '响应解析失败' }; });
    }).catch(function (e) {
      return { success: false, error: (e && e.message) ? e.message : '网络/服务不可用' };
    });
  }
  return {
    // 列出 userdata 下所有 .json 文件名；ok=false 表示服务器不可达（如未通过 启动.bat 打开）
    list: function () {
      return req(BASE + '/list').then(function (r) {
        if (r && r.success && Array.isArray(r.files)) return { files: r.files, ok: true };
        // 服务器不可用（如 file:// 直接打开）时回退到本地缓存的账户索引
        try {
          var idx = JSON.parse(localStorage.getItem('bsw_accountIndex') || '[]');
          return { files: idx.map(function (a) { return a.file; }), ok: false };
        } catch (e) { return { files: [], ok: false }; }
      });
    },
    read: function (name) {
      return req(BASE + '/file/' + encodeURIComponent(name)).then(function (r) {
        return (r && r.success) ? r.data : null;
      });
    },
    write: function (name, obj) {
      return req(BASE + '/file/' + encodeURIComponent(name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ data: obj })
      });
    },
    // 供 flushProfileSave 构造 sendBeacon 地址
    fileUrl: function (name) { return BASE + '/file/' + encodeURIComponent(name); }
  };
}

function hashPassword(pw) {
  if (!pw) return Promise.resolve('');
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
    try {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw))
        .then(function (buf) {
          var b = new Uint8Array(buf), s = '';
          for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
          return s;
        }).catch(function () { return pw; });
    } catch (e) { return Promise.resolve(pw); }
  }
  return Promise.resolve(pw);
}

// 收集当前 localStorage 中所有 bsw_* 键为 profile payload（仅用户数据）
function collectProfilePayload() {
  var p = window.__ACTIVE_PROFILE__;
  if (!p) return null;
  var data = {};
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf('bsw_') === 0) {
      try { data[k.slice(4)] = JSON.parse(localStorage.getItem(k)); }
      catch (e) { data[k.slice(4)] = localStorage.getItem(k); }
    }
  }
  return { username: p.username, password: p.password, createdAt: p.createdAt, data: data };
}

// 把当前用户数据写入其 JSON 配置文件（逐步持久化，防抖触发）
function saveProfile() {
  var payload = collectProfilePayload();
  if (!payload) return Promise.resolve();
  return ProfileAPI().write(window.__ACTIVE_PROFILE__.file, payload).then(function (r) {
    if (!r || !r.success) console.warn('保存用户配置失败', r);
    return r;
  });
}

var _saveTimer = null;
function scheduleProfileSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () { saveProfile(); }, 700);
}

// 立即落盘（用于页面隐藏/关闭等关键时刻）。优先 sendBeacon，失败再走常规 fetch，
// 确保「更多」里的 AI 配置、错题本等最后改动不丢。
function flushProfileSave() {
  var payload = collectProfilePayload();
  if (!payload) return;
  var file = window.__ACTIVE_PROFILE__.file;
  try {
    if (navigator.sendBeacon) {
      var url = ProfileAPI().fileUrl(file);
      navigator.sendBeacon(url, new Blob([JSON.stringify({ data: payload })], { type: 'application/json' }));
    }
  } catch (e) {}
  // 兜底：页面仍存活时用常规 fetch（可拿到成功/失败回执）
  saveProfile();
}

// 页面隐藏（切后台/最小化）或卸载（关闭/刷新）时立即落盘，
// 避免 700ms 防抖窗口内最后一次写入随页面关闭而丢失。
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushProfileSave();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushProfileSave);
}

// 将某个 profile 的数据灌入 localStorage（在 bootApp 之前调用）
function loadProfileIntoLocalStorage(profile) {
  // 保留账户索引与 OOBE 完成标记，避免切换用户/重置时被误清
  var keep = {};
  ['bsw_oobeCompleted', 'bsw_accountIndex'].forEach(function (k) {
    var v = localStorage.getItem(k); if (v !== null) keep[k] = v;
  });
  // 清空旧用户遗留的 bsw_* 键
  var old = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf('bsw_') === 0) old.push(k);
  }
  old.forEach(function (k) { localStorage.removeItem(k); });
  // 恢复保留键
  Object.keys(keep).forEach(function (k) { localStorage.setItem(k, keep[k]); });
  if (profile && profile.data && typeof profile.data === 'object') {
    Object.keys(profile.data).forEach(function (key) {
      // 不覆盖保留键（它们不属于用户学习数据）
      if (key === 'oobeCompleted' || key === 'accountIndex') return;
      var v = profile.data[key];
      try { localStorage.setItem('bsw_' + key, JSON.stringify(v)); }
      catch (e) { localStorage.setItem('bsw_' + key, String(v)); }
    });
  }
}

// 退出/切换用户：清空活动档案并回到账户选择界面
window.AccountLogout = function () {
  try {
    // 等待保存完成再刷新，避免写入被 reload 中断产生半截 JSON（会导致下次登录读取失败）
    Promise.resolve(saveProfile()).catch(function () {}).then(function () { location.reload(); });
  } catch (e) { location.reload(); }
  setTimeout(function () { try { location.reload(); } catch (e) {} }, 1500); // 兜底
};

