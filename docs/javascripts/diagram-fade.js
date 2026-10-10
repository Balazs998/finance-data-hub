/* Keep a right-edge fade and chevron on every wide diagram until the
   scroller reaches the end. The fade is the wrapper's ::after. Reduced
   motion skips the opacity transition; the class still updates. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function ensureChevron(frame) {
    if (frame.querySelector(".diagram-chevron")) return;
    var mark = document.createElement("span");
    mark.className = "diagram-chevron";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "\u203A";
    frame.appendChild(mark);
  }

  function wrapperFor(scroller) {
    var parent = scroller.parentElement;
    if (parent && parent.classList.contains("diagram-frame")) return parent;
    var frame = document.createElement("div");
    frame.className = "diagram-frame";
    scroller.parentNode.insertBefore(frame, scroller);
    frame.appendChild(scroller);
    return frame;
  }

  function atEnd(scroller) {
    return scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft <= 2;
  }

  function update(frame, scroller) {
    var fits = scroller.scrollWidth <= scroller.clientWidth + 2;
    frame.classList.toggle("diagram-frame--end", fits || atEnd(scroller));
  }

  function bind(scroller) {
    var frame = wrapperFor(scroller);
    ensureChevron(frame);
    var refresh = function () {
      update(frame, scroller);
    };
    scroller.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    if (typeof reduce.addEventListener === "function") {
      reduce.addEventListener("change", refresh);
    }
    refresh();
  }

  function setup() {
    var nodes = document.querySelectorAll(".diagram-scroll");
    Array.prototype.forEach.call(nodes, bind);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
