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
            "Test mode: send everything to one address <span class=\"email-var-tag\">job variable</span>",
            "Test address <span class=\"email-var-tag\">job variable</span>",
            "Highlight unfavorable variances <span class=\"email-var-tag\">job variable</span>",
            "Extract name <span class=\"email-var-tag\">job variable</span>",
        ):
            self.assertIn(snippet, html)
        for label in ("Greeting", "Intro", "Note under the table", "Footer"):
            self.assertNotIn(label + " <span class=\"email-var-tag\">", html)
        self.assertIn('aria-hidden="true">i</span>', html)
        self.assertIn('href="../email-checker/"', html)
        self.assertIn(">Preview</button>", html)
        self.assertEqual(html.count("data-goatcounter"), 1)

    def test_checker_page_uses_the_signed_off_text(self):
        html = self.checker.read_text(encoding="utf-8")
        self.assertIn("Check your Jedox email script: Groovy checker", html)
        self.assertIn("Paste your Integrator Groovy script", html)
        self.assertIn("Groovy job", html)
        self.assertIn("Groovy function", html)
        self.assertIn("the script will fail or send the wrong thing.", html)
        self.assertIn("Paste your Groovy job script here. Nothing leaves your browser.", html)
        self.assertIn('href="../email-builder/"', html)
        self.assertIn(">Issues</button>", html)
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
