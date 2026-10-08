import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ContentTests(unittest.TestCase):
    def test_jedox_account_code_matches_the_sample(self):
        article = (ROOT / "docs/jedox/management-report-export.md").read_text()
        sample = (ROOT / "docs/files/jedox/mgmt_report_export_sample.csv").read_text()
        self.assertNotIn("A_4000", article)
        self.assertIn("4000", article)
        self.assertIn(",4000,", sample)
        self.assertIn("subset filter", article)
        self.assertIn("Base elements only", article)
        self.assertNotIn("run that same subset", article)

    def test_snowflake_blank_codes_and_unmapped_accounts(self):
        article = (ROOT / "docs/snowflake/month-end-actuals.md").read_text()
        sql = (ROOT / "docs/files/sql/gl_actuals_pnl.sql").read_text()
        self.assertIn("nullif(trim(l.entity_code), '')", sql)
        self.assertIn("nullif(trim(l.cost_center_code), '')", sql)
        self.assertIn("coalesce(l.entity_code, '(none)') not in ('E900')", sql)
        self.assertIn("coalesce(l.entity_code, '(none)') not in ('E900')", article)
        self.assertIn("inner join to `DIM_ACCOUNT`", article)
        self.assertIn("empty string", article)


if __name__ == "__main__":
    unittest.main()
