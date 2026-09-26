/* campaign/site/map.js — the Otosan Uchi tab: one of two maps (the illustrated poster, the keyed plan),
   dragged to pan, the wheel or the buttons to zoom. The tab's path picks the map: #map/plan.
   Every listener lives on the viewer's own elements, so a re-rendered tab leaves nothing behind. */
window.BO = window.BO || {};
window.BO.map = function (host, which) {
  'use strict';
  var vp = host.querySelector('.bo-map-vp');
  var img = host.querySelector('.bo-map-img');
  var pick = host.querySelectorAll('[data-map]');
  if (!vp || !img) return;
  var scale = 1, tx = 0, ty = 0, drag = null;

  function apply() { img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
  function fit() {
    if (!img.naturalWidth) return;
    scale = Math.min(vp.clientWidth / img.naturalWidth, vp.clientHeight / img.naturalHeight);
    tx = (vp.clientWidth - img.naturalWidth * scale) / 2;
    ty = (vp.clientHeight - img.naturalHeight * scale) / 2;
    apply();
  }
  function zoomAt(f, cx, cy) {
    var min = Math.min(vp.clientWidth / img.naturalWidth, vp.clientHeight / img.naturalHeight) * 0.9;
    var next = Math.max(min, Math.min(4, scale * f));
    tx = cx - (cx - tx) * (next / scale);
    ty = cy - (cy - ty) * (next / scale);
    scale = next;
    apply();
  }
  function show(key) {
    var btn = host.querySelector('[data-map="' + key + '"]') || pick[0];
    pick.forEach(function (b) { b.classList.toggle('on', b === btn); });
    host.querySelector('.bo-map-note').textContent = btn.getAttribute('data-note') || '';
    img.onload = fit;
    img.src = btn.getAttribute('data-src');
    img.alt = btn.textContent;
    if (img.complete) fit();
  }

  pick.forEach(function (b) {
    b.addEventListener('click', function () { history.replaceState(null, '', '#map/' + b.getAttribute('data-map')); show(b.getAttribute('data-map')); });
  });
  host.querySelector('.bo-zin').addEventListener('click', function () { zoomAt(1.4, vp.clientWidth / 2, vp.clientHeight / 2); });
  host.querySelector('.bo-zout').addEventListener('click', function () { zoomAt(1 / 1.4, vp.clientWidth / 2, vp.clientHeight / 2); });
  host.querySelector('.bo-zfit').addEventListener('click', fit);
  vp.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = vp.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  vp.addEventListener('pointerdown', function (e) { drag = { x: e.clientX - tx, y: e.clientY - ty }; vp.setPointerCapture(e.pointerId); vp.classList.add('grab'); });
  vp.addEventListener('pointermove', function (e) { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
  vp.addEventListener('pointerup', function () { drag = null; vp.classList.remove('grab'); });
  vp.addEventListener('pointercancel', function () { drag = null; vp.classList.remove('grab'); });

  show(which || 'poster');
};
