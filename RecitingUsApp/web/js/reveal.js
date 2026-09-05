// 顶部“切换用户”按钮（HTML 中已放置 #switchUserBtn）
// UWP Reveal（手电筒）：光斑中心始终为指针位置（即使不在按钮上），强度随指针与按钮的距离渐变
(function () {
  var px = -9999, py = -9999, raf = 0;
  var LIGHT_R = 60; // 按钮外多少像素处开始出现光照（小范围，只照亮附近）
  function update() {
    raf = 0;
    var btns = document.querySelectorAll('button:not(.study-tab),.author-card');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) { b.style.setProperty('--rv', '0'); continue; }
      // 指针到按钮矩形的最短距离
      var dx = px < r.left ? r.left - px : (px > r.right ? px - r.right : 0);
      var dy = py < r.top ? r.top - py : (py > r.bottom ? py - r.bottom : 0);
      var dist = Math.sqrt(dx * dx + dy * dy);
      var t = Math.max(0, 1 - dist / LIGHT_R);
      t *= t; // 平方衰减：光照更聚焦在指针附近，不会一大片都亮
      b.style.setProperty('--rv', t.toFixed(3));
      b.style.setProperty('--mx', (px - r.left).toFixed(1) + 'px');
      b.style.setProperty('--my', (py - r.top).toFixed(1) + 'px');
    }
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(update); }
  document.addEventListener('mousemove', function (e) { px = e.clientX; py = e.clientY; schedule(); }, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
})();
