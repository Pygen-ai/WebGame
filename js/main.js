/* ============================================================
 *  main.js — 入口
 * ============================================================ */
(function () {
  "use strict";
  function boot() {
    window.UI.render();
    // 防止移动端双击缩放
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
    // 页面隐藏时存档
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && window.Game.state.run) window.Game.saveRun();
    });
    window.addEventListener("beforeunload", () => {
      if (window.Game.state.run) window.Game.saveRun();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
