/* ===== js/error-boundary.js（v3 §7.2 全局错误捕获） =====
   捕获未处理错误与 Promise 拒绝，上报到 C# 日志（/api/log），失败静默不阻塞。 */
(function () {
  'use strict';

  function report(level, message, extra) {
    try {
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return; // file:// 无服务器
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level, message: String(message).slice(0, 500), extra: extra })
      }).catch(function () { });
    } catch (e) { /* 日志失败不影响业务 */ }
  }

  window.addEventListener('error', function (e) {
    console.error('[全局错误]', e.message, e.filename + ':' + e.lineno);
    report('error', e.message, (e.filename || '') + ':' + e.lineno);
  });

  window.addEventListener('unhandledrejection', function (e) {
    console.error('[未捕获 Promise]', e.reason);
    report('error', 'unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });

  // 模块加载自检（拆分/热更后兜底提示，避免白屏无解）。
  // 只检查"解析期"必须存在的全局量；Store/UserDataAPI/renderArticleNav 等是
  // bootApp() 运行后才暴露的函数局部量，首启未登录时本就不存在，不可在此检查。
  function checkModulesLoaded() {
    var required = ['bootApp', 'startAccountFlow', 'escapeHtml', 'D', 'AUTHORS', 'JUSHI', 'CILEI'];
    var missing = [];
    for (var i = 0; i < required.length; i++) {
      if (typeof window[required[i]] === 'undefined') missing.push(required[i]);
    }
    if (missing.length > 0) {
      report('error', '模块加载失败: ' + missing.join(','));
      document.body.insertAdjacentHTML('beforeend',
        '<div style="position:fixed;bottom:12px;left:12px;z-index:99999;padding:10px 16px;' +
        'background:#b3261e;color:#fff;border-radius:10px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.3)">' +
        '模块加载异常（' + missing.join(', ') + '），请刷新重试</div>');
    }
  }
  window.addEventListener('DOMContentLoaded', function () { setTimeout(checkModulesLoaded, 300); });
})();
