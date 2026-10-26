"""Power BI and Qlik Sense are separate sections; old /bi/ URLs redirect."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
BASE = "https://balazs998.github.io/finance-data-hub/"


class BiSplitTests(unittest.TestCase):
    def test_nav_has_two_sections(self):
        text = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
        self.assertIn("  - Power BI:\n      - power-bi/index.md\n", text)
        self.assertIn("  - Qlik Sense:\n      - qlik/index.md\n", text)
        self.assertNotIn("bi/index.md\n      - Power", text.replace("power-bi/index.md", ""))
        self.assertIn("stylesheets/rule-studio.css", text)

    def test_section_pages_and_accents(self):
        self.assertTrue((SITE / "power-bi" / "power-bi-snowflake-views" / "index.html").is_file())
        self.assertTrue((SITE / "power-bi" / "star-schema.png").is_file())
        pbi = (SITE / "power-bi" / "index.html").read_text(encoding="utf-8")
        qlik = (SITE / "qlik" / "index.html").read_text(encoding="utf-8")
        self.assertIn("fdh-section--power-bi", pbi)
        self.assertIn("fdh-section--qlik", qlik)
        self.assertIn("coming soon", qlik)
        css = (ROOT / "docs" / "stylesheets" / "section.css").read_text(encoding="utf-8")
        self.assertIn(".fdh-section--power-bi{--tool:#FBBF24", css)
        self.assertIn(".fdh-section--qlik{--tool:#2DD4BF", css)
        self.assertFalse((SITE / "stylesheets" / "rule-studio.css").exists())

    def test_old_urls_redirect(self):
        for old, new in {
            "bi/index.html": "power-bi/",
            "bi/power-bi-snowflake-views/index.html": "power-bi/power-bi-snowflake-views/",
        }.items():
            html = (SITE / old).read_text(encoding="utf-8")
            self.assertIn(f'http-equiv="refresh" content="0; url={BASE}{new}"', html)
            self.assertIn(f'rel="canonical" href="{BASE}{new}"', html)

    def test_dim_csvs_linked(self):
        for post, names in {
            "snowflake/finance-sql-snowflake.md": ["dim_account.csv"],
            "power-bi/power-bi-snowflake-views.md": ["dim_account.csv", "dim_cost_center.csv"],
        }.items():
            text = (ROOT / "docs" / post).read_text(encoding="utf-8")
            for name in names:
                self.assertIn(f"[`{name}`](../files/samples/{name})", text)
                self.assertTrue((ROOT / "docs" / "files" / "samples" / name).is_file())


if __name__ == "__main__":
    unittest.main()
