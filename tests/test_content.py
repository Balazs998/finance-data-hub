import re
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
        elimination = "coalesce(nullif(trim(l.entity_code), ''), '(none)') not in ('E900')"
        self.assertIn(elimination, sql)
        self.assertIn(elimination, article)
        self.assertIn("order by loaded_at desc, load_id desc", sql)
        self.assertIn("load_id is your own load or batch id.", sql)
        self.assertIn("inner join to `DIM_ACCOUNT`", article)
        self.assertIn("empty string", article)

    def test_value_email_code_blocks_match_the_groovy_download(self):
        article = (ROOT / "docs/jedox/automated-value-emails.md").read_text(encoding="utf-8")
        script = (ROOT / "docs/files/email/send_value_emails.groovy").read_text(encoding="utf-8")
        blocks = re.findall(r"```groovy\n(.*?)```", article, re.S)
        excerpts = [block for block in blocks if block in script]
        self.assertEqual(len(blocks), 5)
        self.assertEqual(len(excerpts), 4)
        for block in excerpts:
            self.assertIn(block, script)
        self.assertNotIn("testMode    =", article)
        self.assertNotIn("testMode    =", script)
        self.assertNotIn("account   :", article)
        self.assertNotIn("account   :", script)


if __name__ == "__main__":
    unittest.main()
