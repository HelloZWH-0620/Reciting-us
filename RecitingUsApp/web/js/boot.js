document.addEventListener('DOMContentLoaded', function () {
  var sb = document.getElementById('switchUserBtn');
  if (sb) sb.onclick = function () { if (window.AccountLogout) window.AccountLogout(); };

  // 全局：页面隐藏/关闭时尽量落盘，确保数据写入用户 JSON 文件
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { try { saveProfile(); } catch (e) {} }
  });
  window.addEventListener('beforeunload', function () { try { saveProfile(); } catch (e) {} });

  // 启动账户流程；登录成功后启动应用
  startAccountFlow(function () {
    bootApp();
    // 启动后再做一次落盘，确保初始数据已写入
    scheduleProfileSave();
  });
});
