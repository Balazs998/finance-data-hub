import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
PREFIX = "/finance-data-hub"


class EmailPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.builder = SITE / "jedox" / "email-builder" / "index.html"
        cls.checker = SITE / "jedox" / "email-checker" / "index.html"
        if not cls.builder.is_file() or not cls.checker.is_file():
            raise AssertionError("Email pages were not built. Run mkdocs build first.")

    def test_builder_page_uses_the_signed_off_text(self):
        html = self.builder.read_text(encoding="utf-8")
        self.assertIn("Create your own Jedox email: Groovy script builder", html)
        self.assertIn("Fill in the form, watch the email build", html)
        self.assertIn("Everything runs in your browser. Nothing you type or paste is sent anywhere.", html)
        self.assertIn("HTML email with a styled table.", html)
        self.assertIn("Account · Budget · Actual · Variance", html)
        self.assertIn("Download script + template", html)
        self.assertIn("Next: run it in Jedox in test mode first", html)
        self.assertIn('value="{{COST_CENTER}} {{VERSION_ACTUAL}} vs {{VERSION_PLAN}}, {{PERIOD}}"', html)
        self.assertIn("Sample data only.", html)
        self.assertIn(
            "Fields tagged <strong>job variable</strong> are only defaults. "
            "If your Integrator job already sets that variable, the job's value wins, "
            "so change it in the job instead.",
            html,
        )
        self.assertEqual(html.count("email-var-tag"), 8)
        for snippet in (
            "Subject <span class=\"email-var-tag\">job variable</span>",
            "Period <span class=\"email-var-tag\">job variable</span>",
            "Plan version <span class=\"email-var-tag\">job variable</span>",
            "Actual version <span class=\"email-var-tag\">job variable</span>",
            "Test mode: send everything <span class=\"email-switch-tail\">to one address <span class=\"email-var-tag\">job variable</span>",
            "Test address <span class=\"email-var-tag\">job variable</span>",
            "Highlight unfavorable <span class=\"email-switch-tail\">variances <span class=\"email-var-tag\">job variable</span>",
            "Extract name <span class=\"email-var-tag\">job variable</span>",
        ):
            self.assertIn(snippet, html)
        for label in ("Greeting", "Intro", "Note under the table", "Footer"):
            self.assertNotIn(label + " <span class=\"email-var-tag\">", html)
        self.assertIn('aria-hidden="true">i</span>', html)
        self.assertIn('href="../email-checker/"', html)
        self.assertIn(">Preview</button>", html)
        self.assertIn('id="email-status" role="status" aria-live="polite"', html)
        self.assertIn(">Copy script</button>", html)
        self.assertEqual(html.count("data-goatcounter"), 1)

    def test_checker_page_uses_the_signed_off_text(self):
        html = self.checker.read_text(encoding="utf-8")
        self.assertIn("Check your email script", html)
        self.assertIn("Paste or type your Groovy script. It checks as you type, and nothing leaves your browser.", html)
        self.assertEqual(html.lower().count("nothing leaves your browser"), 1)
        self.assertNotIn("runs in your browser", html.lower())
        self.assertNotIn("Everything runs in your browser", html)
        self.assertIn("Groovy job", html)
        self.assertIn("Groovy function", html)
        self.assertIn("the script will fail or send the wrong thing.", html)
        self.assertIn('data-placeholder="Paste or type your Groovy script here."', html)
        self.assertIn(
            "It checks as you type. It also suggests documented Jedox calls, "
            "plus the helper functions and job variables from the Automated value emails script.",
            html,
        )
        self.assertIn("<details", html)
        self.assertIn("How it works", html)
        self.assertIn('id="email-checker-sticky"', html)
        self.assertIn('id="email-expand-btn" aria-expanded="false"', html)
        self.assertIn("Expand editor ↕", html)
        self.assertIn('id="email-status-live"', html)
        self.assertIn('aria-live="polite"', html)
        self.assertIn('href="../email-builder/"', html)
        self.assertIn("codemirror-bundle.js", html)
        self.assertNotIn("jsdelivr", html)
        self.assertNotIn("unpkg.com", html)
        self.assertNotIn(">Check script<", html)
        self.assertEqual(html.count("data-goatcounter"), 1)

    def test_published_scripts_and_styles_are_local(self):
        html = self.builder.read_text(encoding="utf-8") + self.checker.read_text(encoding="utf-8")
        for name in (
            "email-sources.js",
            "email-shared.js",
            "email-check-messages.js",
            "email-generate.js",
            "email-checker-core.js",
            "email-tool.css",
        ):
            self.assertIn(name, html)
        css = (SITE / "stylesheets" / "email-tool.css").read_text(encoding="utf-8")
        self.assertIn("underline wavy #f87171", css)
        self.assertIn("underline wavy #fbbf24", css)
        self.assertIn("prefers-reduced-motion: reduce", css)
        for path in (SITE / "javascripts").glob("email-*.js"):
            text = path.read_text(encoding="utf-8")
            for token in ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "goatcounter"):
                self.assertNotIn(token, text, path.name)
