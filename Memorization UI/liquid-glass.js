/* ===== liquid-glass.js（真实管线：warp + border + glow + 边缘折射） =====
   历史：原 liquid-glass-react 管线丢失后曾用 32 行贴皮补丁顶替（只加 blur）。
   本文件恢复设计中的三件套：
     lg-warp   —— 背景层：backdrop blur/saturate + SVG 位移滤镜（边缘"液态"折射）
     lg-border —— 1.5px 渐变描边环
     lg-glow   —— 指针追随的柔光（可点击元素）
   文字内容不进滤镜，只处理背景层，保证可读性。
   暴露：LiquidGlass.attach(el, opts) 与 glassXxx 便捷函数。 */
(function () {
  'use strict';
  if (window.__liquidGlassLoaded) return;
  window.__liquidGlassLoaded = true;

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function ensureFilter(fid, scale) {
    if (document.getElementById(fid)) return;
    var svg = document.getElementById('lg-svg-defs');
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'lg-svg');
      svg.setAttribute('id', 'lg-svg-defs');
      (document.body || document.documentElement).appendChild(svg);
    }
    var defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.appendChild(defs);
    }
    var filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', fid);
    filter.setAttribute('x', '-15%');
    filter.setAttribute('y', '-15%');
    filter.setAttribute('width', '130%');
    filter.setAttribute('height', '130%');
    filter.innerHTML =
      '<feTurbulence type="fractalNoise" baseFrequency="0.014 0.014" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G"/>';
    defs.appendChild(filter);
  }

  function enhance(el, opts) {
    if (!el || !el.style || el.dataset.lgApplied) return;
    el.dataset.lgApplied = '1';
    opts = opts || {};
    var scale = opts.displacementScale != null ? opts.displacementScale : 10;
    var blurPx = opts.blurAmount != null ? Math.max(3, Math.round(opts.blurAmount * 100)) : 8;
    var sat = opts.saturation != null ? opts.saturation : 150;
    var radius = opts.cornerRadius != null ? opts.cornerRadius : 0;

    var fid = 'lg-warp-' + Math.round(scale * 10);
    ensureFilter(fid, scale);

    el.classList.add('lg-pos', 'lg-root');
    if (radius) el.style.setProperty('--lg-radius', radius + 'px');
    if (opts.clickable) el.classList.add('lg-clickable');

    var warp = document.createElement('div');
    warp.className = 'lg-warp';
    warp.style.backdropFilter = 'blur(' + blurPx + 'px) saturate(' + sat + '%)';
    warp.style.webkitBackdropFilter = 'blur(' + blurPx + 'px) saturate(' + sat + '%)';
    if (scale > 0) warp.style.filter = 'url(#' + fid + ')';

    var border = document.createElement('div');
    border.className = 'lg-border';

    var glow = document.createElement('div');
    glow.className = 'lg-glow';

    el.insertBefore(warp, el.firstChild);
    el.appendChild(border);
    el.appendChild(glow);

    if (opts.clickable) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    }
  }

  function qsa(root, sel) {
    if (!root || !root.querySelectorAll) return [];
    if (root.nodeType === 1 && root.matches && root.matches(sel)) return [root];
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  /* 大面板：较厚磨砂 + 较强折射；文字内容不在滤镜层内 */
  var LARGE = { displacementScale: 10, blurAmount: 0.12, saturation: 150, cornerRadius: 0 };
  /* 卡片：中等磨砂 + 轻折射 */
  var CARD = { displacementScale: 8, blurAmount: 0.08, saturation: 140, cornerRadius: 10 };
  /* 小浮层：轻磨砂，几乎无折射，保证字边清晰 */
  var SMALL = { displacementScale: 5, blurAmount: 0.05, saturation: 130, cornerRadius: 6 };

  function withOpts(base, extra) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    if (extra) for (k in extra) o[k] = extra[k];
    return o;
  }

  window.LiquidGlass = {
    attach: enhance,
    presets: { LARGE: LARGE, CARD: CARD, SMALL: SMALL }
  };

  function glassPanels(root) {
    qsa(root, '#side, footer.player').forEach(function (el) { enhance(el, LARGE); });
    qsa(root, '.dash-card, .author-card, .example-card, .word-game, .word-card, .flashcard, .study-panel, .art-appreciation').forEach(function (el) {
      enhance(el, withOpts(CARD, { clickable: el.classList.contains('author-card') }));
    });
    qsa(root, '.mode-selector-menu, .toast, .about-card').forEach(function (el) {
      enhance(el, SMALL);
    });
  }

  window.glassCards = function (c) { glassPanels(c); };
  window.glassAuthorCards = function (c) { glassPanels(c); };
  window.glassExampleCards = function (c) { glassPanels(c); };
  window.glassStudyPanel = function (c) { glassPanels(c); };
  window.glassArtAppreciation = function (c) { glassPanels(c); };
  window.glassWordGame = function (c) { glassPanels(c); };
  window.glassFlashcard = function (c) { glassPanels(c); };
  window.liquidGlassRefresh = function () { glassPanels(document); };

  /* 动态节点（toast/下拉）出现时自动上玻璃 */
  function boot() {
    glassPanels(document);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            if (added[j].nodeType === 1) glassPanels(added[j].parentNode || document);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* 环境不支持则退化为静态增强 */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
