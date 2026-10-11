/* Builder page. Reads the form, draws the preview, and downloads a zip.
   Nothing typed here is sent anywhere. */
(function () {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var root = document.getElementById("email-builder");
    if (!root || !globalThis.EmailGenerate || !globalThis.EmailShared) return;

    var gen = globalThis.EmailGenerate;
    var shared = globalThis.EmailShared;
    var lastGood = null;

    var fields = {
      subject: document.getElementById("field-subject"),
      greeting: document.getElementById("field-greeting"),
      intro: document.getElementById("field-intro"),
      note: document.getElementById("field-note"),
      footer: document.getElementById("field-footer"),
      testAddress: document.getElementById("field-test-address"),
      period: document.getElementById("field-period"),
      versionPlan: document.getElementById("field-version-plan"),
      versionActual: document.getElementById("field-version-actual"),
      extractName: document.getElementById("field-extract")
    };
    var testMode = document.getElementById("test-mode");
    var colorVariance = document.getElementById("color-variance");
    var testHelpOn = document.getElementById("test-mode-help-on");
    var testHelpOff = document.getElementById("test-mode-help-off");
    var dimensionNote = document.getElementById("dimension-note");
    var downloadBtn = document.getElementById("email-download");
    var copyBtn = document.getElementById("email-copy");
    var downloadNote = document.getElementById("email-download-note");
    var status = document.getElementById("email-status");
    var frame = document.getElementById("email-frame");
    var subjectLine = document.getElementById("email-subject-line");
    var scriptView = document.getElementById("email-script-view");
    var templateView = document.getElementById("email-template-view");
    var fallback = document.getElementById("email-fallback");
    var sticky = document.getElementById("email-builder-sticky");
    var form = document.getElementById("email-form");
    var lastEdited = null;
    var phoneQuery = window.matchMedia("(max-width: 760px)");
    var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (form) form.addEventListener("submit", function (event) { event.preventDefault(); });

    function readForm() {
      return {
        dimension: (root.querySelector(".email-chip.is-on") || {}).getAttribute("data-dimension") || "cost_center",
        subject: fields.subject.value,
        greeting: fields.greeting.value,
        intro: fields.intro.value,
        note: fields.note.value,
        footer: fields.footer.value,
        testMode: testMode.getAttribute("aria-checked") === "true",
        testAddress: fields.testAddress.value,
        period: fields.period.value,
        versionPlan: fields.versionPlan.value,
        versionActual: fields.versionActual.value,
        colorVariance: colorVariance.getAttribute("aria-checked") === "true",
        extractName: fields.extractName.value
      };
    }

    function setMessage(field, error, hint) {
      var el = document.getElementById("msg-" + field);
      var input = fields[field];
      if (!el || !input) return;
      el.classList.remove("is-error", "is-hint");
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
      if (error) {
        el.textContent = "";
        el.appendChild(iconSpan("✕"));
        el.appendChild(document.createTextNode(" "));
        var text = document.createElement("span");
        text.innerHTML = shared.inlineCode(error);
        el.appendChild(text);
        el.classList.add("is-error");
        input.classList.add("is-invalid");
        input.setAttribute("aria-invalid", "true");
      } else if (hint) {
        el.innerHTML = shared.inlineCode(hint);
        el.classList.add("is-hint");
      } else {
        el.textContent = "";
      }
    }

    function iconSpan(char) {
      var span = document.createElement("span");
      span.setAttribute("aria-hidden", "true");
      span.textContent = char;
      return span;
    }

    function showPreview(preview, script, template) {
      subjectLine.textContent = "Subject: " + preview.subject;
      frame.srcdoc = preview.html;
      scriptView.innerHTML = script.split("\n").map(function (line) {
        return "<div class=\"email-line\"><span class=\"email-wavy\">" + (shared.highlightGroovy(line) || " ") + "</span></div>";
      }).join("");
      templateView.textContent = template;
      fallback.hidden = true;
      frame.hidden = false;
    }

    function fitFrame() {
      var wrap = frame.parentElement;
      try {
        var doc = frame.contentDocument;
        if (!doc || !doc.documentElement) return;
        frame.style.width = "100%";
        frame.style.maxWidth = "100%";
        frame.style.transform = "none";
        if (wrap) wrap.style.height = "";
        var height = Math.max(doc.documentElement.scrollHeight || 0, doc.body ? doc.body.scrollHeight : 0);
        frame.style.height = Math.max(height, 280) + "px";
      } catch (error) {
        frame.style.width = "100%";
        frame.style.transform = "none";
        frame.style.height = "640px";
        if (wrap) wrap.style.height = "";
      }
    }

    function render() {
      var result = gen.generate(readForm());
      Object.keys(fields).forEach(function (name) {
        var error = result.errors.filter(function (item) { return item.field === name; })[0];
        var hint = result.hints.filter(function (item) { return item.field === name; })[0];
        setMessage(name, error && error.message, hint && hint.message);
      });
      var blocked = !result.ok;
      downloadBtn.disabled = blocked;
      copyBtn.disabled = blocked;
      downloadNote.hidden = !blocked;
      downloadNote.textContent = blocked ? result.downloadNote : "";
      if (result.ok) {
        lastGood = result;
        showPreview(result.preview, result.script, result.template);
      } else if (!lastGood) {
        fallback.hidden = false;
        fallback.textContent = gen.MESSAGES.previewFailed;
        frame.hidden = true;
      }
      var other = root.querySelector(".email-chip.is-on").getAttribute("data-dimension") !== "cost_center";
      dimensionNote.hidden = !other;
    }

    function setSwitch(button, on) {
      button.setAttribute("aria-checked", on ? "true" : "false");
      button.classList.toggle("is-on", on);
    }

    root.querySelectorAll(".email-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var previous = root.querySelector(".email-chip.is-on").getAttribute("data-dimension");
        root.querySelectorAll(".email-chip").forEach(function (item) {
          var on = item === chip;
          item.classList.toggle("is-on", on);
          item.setAttribute("aria-checked", on ? "true" : "false");
        });
        var next = chip.getAttribute("data-dimension");
        var known = Object.keys(gen.DIMENSIONS).some(function (id) {
          return gen.introFor(id) === fields.intro.value.trim();
        });
        if (known || fields.intro.value.trim() === gen.introFor(previous)) {
          fields.intro.value = gen.introFor(next);
        }
        status.textContent = "";
        render();
      });
    });

    [testMode, colorVariance].forEach(function (button) {
      button.addEventListener("click", function () {
        setSwitch(button, button.getAttribute("aria-checked") !== "true");
        if (button === testMode) {
          var on = button.getAttribute("aria-checked") === "true";
          testHelpOn.hidden = !on;
          testHelpOff.hidden = on;
        }
        status.textContent = "";
        render();
      });
    });

    Object.keys(fields).forEach(function (name) {
      fields[name].addEventListener("input", function () {
        lastEdited = fields[name];
        status.textContent = "";
        render();
      });
    });

    var previewTabs = Array.prototype.slice.call(root.querySelectorAll(".email-tab"));

    function selectPreviewTab(tab) {
      previewTabs.forEach(function (item) {
        var on = item === tab;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-selected", on ? "true" : "false");
        item.tabIndex = on ? 0 : -1;
      });
      ["preview", "script", "template"].forEach(function (name) {
        document.getElementById("panel-" + name).hidden = tab.getAttribute("data-tab") !== name;
      });
    }

    previewTabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        selectPreviewTab(tab);
      });
      tab.addEventListener("keydown", function (event) {
        var nextIndex = null;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % previewTabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + previewTabs.length) % previewTabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = previewTabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        selectPreviewTab(previewTabs[nextIndex]);
        previewTabs[nextIndex].focus();
      });
    });

    downloadBtn.addEventListener("click", function () {
      if (!lastGood || downloadBtn.disabled) return;
      var blob = new Blob([lastGood.zip()], { type: "application/zip" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "jedox-value-email.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      status.textContent = gen.MESSAGES.downloaded;
    });

    var copyLabel = copyBtn.textContent;
    var copyTimer = null;
    copyBtn.addEventListener("click", function () {
      if (!lastGood || copyBtn.disabled) return;
      var text = lastGood.script;
      function copied() {
        status.textContent = gen.MESSAGES.copied;
        copyBtn.textContent = gen.MESSAGES.copied;
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(function () {
          copyTimer = null;
          copyBtn.textContent = copyLabel;
        }, 2000);
      }
      function failed() {
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = null;
        copyBtn.textContent = copyLabel;
        status.textContent = gen.MESSAGES.copyFailed;
        root.querySelector('.email-tab[data-tab="script"]').click();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(copied, function () {
          var area = document.createElement("textarea");
          area.value = text;
          document.body.appendChild(area);
          area.select();
          try {
            if (document.execCommand("copy")) copied();
            else failed();
          } catch (error) {
            failed();
          }
          area.remove();
        });
      } else {
        failed();
      }
    });

    document.getElementById("email-reset").addEventListener("click", function () {
      var defaults = gen.DEFAULTS;
      fields.subject.value = defaults.subject;
      fields.greeting.value = defaults.greeting;
      fields.intro.value = defaults.intro;
      fields.note.value = defaults.note;
      fields.footer.value = defaults.footer;
      fields.testAddress.value = defaults.testAddress;
      fields.period.value = defaults.period;
      fields.versionPlan.value = defaults.versionPlan;
      fields.versionActual.value = defaults.versionActual;
      fields.extractName.value = defaults.extractName;
      setSwitch(testMode, true);
      setSwitch(colorVariance, true);
      testHelpOn.hidden = false;
      testHelpOff.hidden = true;
      root.querySelectorAll(".email-chip").forEach(function (item) {
        var on = item.getAttribute("data-dimension") === "cost_center";
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-checked", on ? "true" : "false");
      });
      lastEdited = null;
      status.textContent = "";
      render();
    });

    function headerOffset() {
      var header = document.querySelector(".md-header");
      if (!header) return 0;
      var pos = getComputedStyle(header).position;
      if (pos !== "sticky" && pos !== "fixed") return 0;
      return header.getBoundingClientRect().height;
    }

    function scrollToTarget(el, margin) {
      if (!el) return;
      var details = el.closest && el.closest("details");
      if (details && !details.open) details.open = true;
      if (margin) el.style.scrollMarginTop = margin;
      el.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: shared.scrollBehavior(motionQuery.matches)
      });
    }

    function focusTarget(el) {
      if (!el) return;
      if (el.tabIndex < 0) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }

    function fitSoon() {
      requestAnimationFrame(function () { requestAnimationFrame(fitFrame); });
    }

    if (sticky) {
      sticky.addEventListener("click", function () {
        var open = root.classList.toggle("is-panel-open");
        sticky.textContent = open ? "Back to form" : "Preview";
        sticky.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) fitSoon();
        if (!phoneQuery.matches) return;
        var panel = document.getElementById("email-panel");
        var field = shared.returnField(lastEdited, fields.subject);
        var target = open ? panel : shared.fieldLabel(field);
        var focusEl = open ? document.getElementById("tab-preview") : field;
        var margin = open
          ? shared.previewScrollMargin(headerOffset()) + "px"
          : shared.labelScrollMargin(headerOffset());
        requestAnimationFrame(function () {
          scrollToTarget(target, margin);
          focusTarget(focusEl);
        });
      });
    }

    frame.addEventListener("load", fitSoon);
    window.addEventListener("resize", function () {
      var phone = window.matchMedia("(max-width: 760px)").matches;
      if (phone && !root.classList.contains("is-panel-open")) return;
      fitSoon();
    });
    render();
  });
})();
