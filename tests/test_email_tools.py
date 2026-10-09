import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class EmailToolTests(unittest.TestCase):
    def test_node_unit_tests(self):
        completed = subprocess.run(
            ["node", "--test", str(ROOT / "tests" / "email-tools.test.js")],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            completed.returncode,
            0,
            completed.stdout + "\n" + completed.stderr,
        )

    def test_builder_and_checker_do_not_call_the_network(self):
        banned = ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "goatcounter")
        for path in (ROOT / "docs" / "javascripts").glob("email-*.js"):
            text = path.read_text(encoding="utf-8")
            for token in banned:
                self.assertNotIn(token, text, path.name)
        messages = (ROOT / "docs/javascripts/email-check-messages.js").read_text(encoding="utf-8")
        self.assertNotIn("That goes for comments too.", messages)
        self.assertIn("adds to the list each time, and `reset()` clears the recipients, subject and body.", messages)
        self.assertIn("smtp.example.com', 'user', 'secret'", messages)
        self.assertIn("`API.getMailer()` and `API.initSource()`", messages)
        self.assertIn("Extract name `'{name}'`", messages)
        builder = (ROOT / "docs/jedox/email-builder.md").read_text(encoding="utf-8")
        checker = (ROOT / "docs/jedox/email-checker.md").read_text(encoding="utf-8")
        self.assertIn("Account · Budget · Actual · Variance", builder)
        self.assertIn("Everything runs in your browser. Nothing you type or paste is sent anywhere.", builder)
        self.assertIn("Everything runs in your browser. Nothing you type or paste is sent anywhere.", checker)
        self.assertIn("the script will fail or send the wrong thing.", checker)
        self.assertIn("Groovy job", checker)
        self.assertIn("Groovy function", checker)
        css = (ROOT / "docs/stylesheets/email-tool.css").read_text(encoding="utf-8")
        self.assertIn("underline wavy #f87171", css)
        self.assertIn("underline wavy #fbbf24", css)
        self.assertIn("prefers-reduced-motion: reduce", css)
        self.assertNotIn("color: #8b7cf6", css.lower())
        self.assertNotIn("color: var(--dn-violet);", css)
        self.assertNotIn("color: var(--dn-violet) ", css)
