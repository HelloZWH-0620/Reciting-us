// 全局错误显示：任何未捕获的 JS 错误/Promise 拒绝都在屏幕底部显示红条，避免"点了没反应"
(function () {
  function showErr(msg) {
    try {
      var b = document.getElementById('__errBanner');
      if (!b) {
        b = document.createElement('div');
        b.id = '__errBanner';
        b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999999;background:#e5484d;color:#fff;font:12px/1.5 Consolas,monospace;padding:6px 12px;white-space:pre-wrap;word-break:break-all';
        (document.body || document.documentElement).appendChild(b);
      }
      b.textContent = 'JS错误: ' + msg;
    } catch (e) {}
  }
  window.addEventListener('error', function (ev) {
    showErr((ev.message || 'unknown') + ' @ ' + String(ev.filename || '').split('/').pop() + ':' + ev.lineno);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    showErr(r && (r.message || r.toString) ? (r.message || String(r)) : String(r));
  });
})();
