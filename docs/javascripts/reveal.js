/* Fade .reveal sections in once they enter the viewport.
   The hero is not a .reveal element, so it stays at full opacity.
   html.js is added in the page head. Without that class the sections stay visible.
   Sections already on screen are shown synchronously, before the first paint.
   IntersectionObserver reveals the rest on scroll. A bounding-rect check also
   runs on scroll, resize, and a short timer so a missed callback — including
   a full-page capture whose viewport covers the document — cannot leave a
   section invisible. */
(function () {
  function show(el) {
    el.classList.add("is-visible");
  }

  function setup() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, show);
      return;
    }

    function viewportHeight() {
      return window.innerHeight || document.documentElement.clientHeight || 0;
    }

    function pageFitsViewport() {
      var height = viewportHeight();
      var page = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body ? document.body.scrollHeight : 0
      );
      return height > 0 && height + 2 >= page;
    }

    function inView(el) {
      var rect = el.getBoundingClientRect();
      var height = viewportHeight();
      var width = window.innerWidth || document.documentElement.clientWidth || 0;
      if (rect.width <= 0 && rect.height <= 0) return false;
      return rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
    }

    function revealVisible() {
      var fits = pageFitsViewport();
      Array.prototype.forEach.call(nodes, function (node) {
        if (node.classList.contains("is-visible")) return;
        if (fits || inView(node)) show(node);
      });
    }

    var observer;
    try {
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            show(entry.target);
            observer.unobserve(entry.target);
          });
        },
        { root: null, rootMargin: "0px", threshold: 0 }
      );
    } catch (error) {
      Array.prototype.forEach.call(nodes, show);
      return;
    }

    Array.prototype.forEach.call(nodes, function (node) {
      if (pageFitsViewport() || inView(node)) {
        show(node);
        return;
      }
      node.classList.add("reveal-wait");
      observer.observe(node);
    });

    revealVisible();

    window.addEventListener("scroll", revealVisible, { passive: true });
    window.addEventListener("resize", revealVisible);
    window.addEventListener("load", revealVisible);
    document.addEventListener("scroll", revealVisible, true);
    if (window.ResizeObserver) {
      try {
        var resizeObserver = new ResizeObserver(revealVisible);
        resizeObserver.observe(document.documentElement);
      } catch (error) {
        /* ResizeObserver is only a fallback. */
      }
    }

    requestAnimationFrame(function () {
      revealVisible();
      requestAnimationFrame(revealVisible);
    });

    window.setTimeout(revealVisible, 0);
    window.setTimeout(revealVisible, 250);
  }

  if (document.querySelector(".reveal")) {
    setup();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();

/* JetBrains Mono is not used for the first paint. Request it once the
   page has loaded so it does not sit on the critical path. */
(function () {
  function loadCodeFont() {
    var extra = document.querySelector('link[rel="stylesheet"][href*="stylesheets/extra.css"]');
    if (!extra || document.getElementById("code-font")) return;
    var link = document.createElement("link");
    link.id = "code-font";
    link.rel = "stylesheet";
    link.href = extra.href.replace(/extra\.css(\?.*)?$/, "code-font.css$1");
    document.head.appendChild(link);
  }

  if (document.readyState === "complete") loadCodeFont();
  else window.addEventListener("load", loadCodeFont);
})();
