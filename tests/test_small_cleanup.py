import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

TABLE_PANEL = re.compile(
    r'<div class="diagram-frame" markdown="block">\s*'
    r'<div class="diagram-scroll" tabindex="0" '
    r'aria-label="(?P<label>[^"]+)" markdown="block">\s*'
    r"(?P<body>.*?)\s*"
    r"</div>\s*"
    r'<span class="diagram-chevron" aria-hidden="true">›</span>\s*'
    r"</div>",
    re.S,
)


class PlanVsActualsSwipeTests(unittest.TestCase):
    def test_both_result_tables_use_the_swipe_panel(self):
        text = (DOCS / "snowflake" / "plan-vs-actuals.md").read_text(encoding="utf-8")
        panels = list(TABLE_PANEL.finditer(text))
        labels = [panel.group("label") for panel in panels]
        self.assertEqual(
            labels,
            [
                "Match status counts on the sample files, scroll sideways on small screens",
                "March 2026 totals by account type, scroll sideways on small screens",
            ],
        )
        bodies = [panel.group("body") for panel in panels]
        self.assertIn("| match_status | cells | budget | actual |", bodies[0])
        self.assertIn("| account_type | budget | actual | variance |", bodies[1])
        launch = (DOCS / "jedox" / "snowflake-to-jedox.md").read_text(encoding="utf-8")
        self.assertIn('<div class="diagram-frame" markdown="block">', launch)
        self.assertIn('<span class="diagram-chevron" aria-hidden="true">›</span>', launch)


class EmailBuilderClearanceTests(unittest.TestCase):
    def test_builder_clears_the_sticky_preview_bar(self):
        css = (DOCS / "stylesheets" / "email-tool.css").read_text(encoding="utf-8")
        phone = css.split("@media screen and (max-width: 760px)", 1)[1]
        phone = phone.split("@media screen and (max-width: 627px)", 1)[0]
        clearance = "calc(64px + env(safe-area-inset-bottom))"
        scroll = phone.split("html:has(#email-builder)", 1)[1].split("}", 1)[0]
        builder = phone.split("#email-builder {", 1)[1].split("}", 1)[0]
        self.assertIn(f"scroll-padding-bottom: {clearance};", scroll)
        self.assertIn(f"padding-bottom: {clearance};", builder)


class PhoneMenuTapTests(unittest.TestCase):
    def test_phone_menu_links_are_at_least_44px(self):
        css = (DOCS / "stylesheets" / "extra.css").read_text(encoding="utf-8")
        phone = css.split("@media screen and (max-width: 44.9375em)", 1)[1]
        rule = phone.split("}", 1)[0]
        self.assertIn(".md-nav__link", rule)
        self.assertIn("min-height: 44px;", rule)
        self.assertNotIn("min-height: 32px;", rule)


if __name__ == "__main__":
    unittest.main()
