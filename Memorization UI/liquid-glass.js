/* ===== liquid-glass.js（v3 修复断链补文件） =====
   app.html 原引用的 liquid-glass.js 丢失导致控制台 404 与 glass* 未定义。
   本文件提供零依赖的渐进增强：对传入容器施加 backdrop-filter 玻璃质感，
   不改变布局与交互；如需更华丽的效果可在此扩展。
   暴露：glassWordGame / glassAuthorCards / glassExampleCards /
        glassFlashcard / glassArtAppreciation / glassCards */
(function () {
  'use strict';
  if (window.__liquidGlassLoaded) return;
  window.__liquidGlassLoaded = true;

  try {
    var style = document.createElement('style');
    style.textContent =
      '.lg-enhanced{backdrop-filter:blur(16px) saturate(150%);-webkit-backdrop-filter:blur(16px) saturate(150%);' +
      'border:1px solid rgba(255,255,255,.14);box-shadow:0 8px 32px rgba(0,0,0,.06)}' +
      'body.dark .lg-enhanced{border-color:rgba(255,255,255,.08);box-shadow:0 8px 32px rgba(0,0,0,.25)}';
    document.head.appendChild(style);
  } catch (e) { /* head 不可用则放弃增强 */ }

  function enhance(el) {
    if (!el || el.classList && el.classList.contains('lg-enhanced')) return;
    try { el.classList.add('lg-enhanced'); } catch (e) { }
  }

  window.glassWordGame = function (c) { enhance(c); };
  window.glassAuthorCards = function (c) { enhance(c); };
  window.glassExampleCards = function (c) { enhance(c); };
  window.glassFlashcard = function (c) { enhance(c); };
  window.glassArtAppreciation = function (c) { enhance(c); };
  window.glassCards = function (c) { enhance(c); };
})();
