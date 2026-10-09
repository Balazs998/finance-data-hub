import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from hooks.site import (  # noqa: E402
    PluginError,
    event_name,
    on_config,
    render_shortcodes,
)

DOCS = ROOT / "docs"


class Config:
    def __init__(self, code):
        self.extra = {"goatcounter_code": code}


class DownloadShortcodeTests(unittest.TestCase):
    def test_nested_page_links_to_the_sql_file(self):
        out = render_shortcodes(
            "[[download:sql/gl_actuals_pnl.sql|Download the script]]",
            "snowflake/month-end-actuals.md",
            DOCS,
        )
        self.assertIn('<div class="downloads">', out)
        self.assertIn('href="../files/sql/gl_actuals_pnl.sql"', out)
        self.assertIn('class="md-button download"', out)
        self.assertIn('data-goatcounter-click="download-gl_actuals_pnl.sql"', out)
        self.assertIn('data-goatcounter-title="Download gl_actuals_pnl.sql"', out)
        self.assertIn('data-goatcounter-no-session="1"', out)
        self.assertIn('download="gl_actuals_pnl.sql"', out)
        self.assertNotIn("[[download:", out)

    def test_root_page_uses_a_path_without_dotdot(self):
        out = render_shortcodes(
            "[[download:vba/FPNA_MonthCloseChecks.bas]]",
            "downloads.md",
            DOCS,
        )
        self.assertIn('href="files/vba/FPNA_MonthCloseChecks.bas"', out)
        self.assertIn("Download FPNA_MonthCloseChecks.bas", out)
        self.assertIn('data-goatcounter-click="download-FPNA_MonthCloseChecks.bas"', out)

    def test_fenced_example_is_not_rewritten(self):
        markdown = (
            "```\n"
            "[[download:sql/gl_actuals_pnl.sql]]\n"
            "```\n\n"
            "[[download:sql/gl_actuals_pnl.sql]]\n"
        )
        out = render_shortcodes(markdown, "index.md", DOCS)
        self.assertIn("```\n[[download:sql/gl_actuals_pnl.sql]]\n```", out)
        self.assertIn('href="files/sql/gl_actuals_pnl.sql"', out)

    def test_missing_file_fails_the_build(self):
        with self.assertRaises(PluginError):
            render_shortcodes("[[download:sql/missing.sql]]", "index.md", DOCS)

    def test_path_escape_is_rejected(self):
        with self.assertRaises(PluginError):
            render_shortcodes("[[download:../index.md]]", "index.md", DOCS)

    def test_release_asset_link(self):
        out = render_shortcodes(
            "[[release:close-model.xlsm|Workbook]]",
            "downloads.md",
            DOCS,
        )
        self.assertIn(
            "https://github.com/Balazs998/finance-data-hub/releases/download/files/close-model.xlsm",
            out,
        )
        self.assertIn('<div class="downloads">', out)
        self.assertIn('data-goatcounter-click="download-close-model.xlsm"', out)
        self.assertNotIn("[[release:", out)

    def test_consecutive_downloads_share_one_grid(self):
        markdown = (
            "[[download:samples/fact_budget.csv|Download fact_budget.csv]]\n"
            "\n"
            "[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]\n"
        )
        out = render_shortcodes(markdown, "snowflake/plan-vs-actuals.md", DOCS)
        self.assertEqual(out.count('<div class="downloads">'), 1)
        self.assertEqual(out.count('class="md-button download"'), 2)
        self.assertIn('href="../files/samples/fact_budget.csv"', out)
        self.assertIn('href="../files/samples/fact_actuals.csv"', out)
        self.assertLess(out.find("fact_budget.csv"), out.find("fact_actuals.csv"))
        self.assertNotIn("[[download:", out)

    def test_directory_url_href_is_relative_to_the_built_page(self):
        out = render_shortcodes(
            "[[download:samples/fact_budget.csv|Download fact_budget.csv]]",
            "snowflake/plan-vs-actuals.md",
            DOCS,
            page_url="snowflake/plan-vs-actuals/",
        )
        self.assertIn('href="../../files/samples/fact_budget.csv"', out)

    def test_indented_card_shortcode_stays_an_inline_link(self):
        out = render_shortcodes(
            "    [[download:sql/gl_actuals_pnl.sql|Download .sql]]\n",
            "downloads.md",
            DOCS,
        )
        self.assertNotIn('<div class="downloads">', out)
        self.assertIn("](files/sql/gl_actuals_pnl.sql)", out)
        self.assertTrue(out.startswith("    ["))

    def test_event_names_do_not_start_with_a_slash(self):
        for filename in (
            "gl_actuals_pnl.sql",
            "FPNA_MonthCloseChecks.bas",
            "mgmt_report_export_sample.csv",
        ):
            name = event_name(filename)
            self.assertEqual(name, f"download-{filename}")
            self.assertFalse(name.startswith("/"))

    def test_site_code_is_trimmed_and_a_url_is_rejected(self):
        config = Config(" financedatahub ")
        on_config(config)
        self.assertEqual(config.extra["goatcounter_code"], "financedatahub")
        with self.assertRaises(PluginError):
            on_config(Config("https://financedatahub.goatcounter.com/count"))


if __name__ == "__main__":
    unittest.main()
