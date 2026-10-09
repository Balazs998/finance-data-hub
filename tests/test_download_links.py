import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from hooks.site import (  # noqa: E402
    PluginError,
    event_name,
    on_config,
    on_page_markdown,
    render_file_index,
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

    def test_file_index_lists_every_file_under_its_note(self):
        nav = [
            {"Home": "index.md"},
            {
                "Snowflake": [
                    "snowflake/index.md",
                    {"Month-end actuals": "snowflake/month-end-actuals.md"},
                    {
                        "Plan vs. actuals in Snowflake SQL, without losing rows": (
                            "snowflake/plan-vs-actuals.md"
                        )
                    },
                ]
            },
            {
                "Jedox": [
                    "jedox/index.md",
                    {"Management report export": "jedox/management-report-export.md"},
                    {"Automated value emails": "jedox/automated-value-emails.md"},
                ]
            },
            {
                "VBA and Excel": [
                    "vba/index.md",
                    {"Month-close checks": "vba/month-close-checks.md"},
                ]
            },
        ]
        index = render_file_index(DOCS, nav)
        files_root = DOCS / "files"
        for path in files_root.rglob("*"):
            if path.is_file():
                relative = path.relative_to(files_root).as_posix()
                self.assertIn(f"[[download:{relative}", index)
        self.assertLess(
            index.index("snowflake/month-end-actuals.md"),
            index.index("snowflake/plan-vs-actuals.md"),
        )
        self.assertLess(
            index.index("snowflake/plan-vs-actuals.md"),
            index.index("jedox/management-report-export.md"),
        )
        self.assertLess(
            index.index("jedox/management-report-export.md"),
            index.index("jedox/automated-value-emails.md"),
        )
        self.assertLess(
            index.index("jedox/automated-value-emails.md"),
            index.index("vba/month-close-checks.md"),
        )
        plan = index.split("](snowflake/plan-vs-actuals.md)", 1)[1].split("## [", 1)[0]
        self.assertIn("sql/plan_vs_actual.sql", plan)
        self.assertIn("samples/fact_budget.csv", plan)
        self.assertIn("samples/fact_actuals.csv", plan)
        self.assertIn("samples/load_snowflake.sql", plan)
        self.assertNotIn("email/send_value_emails.groovy", plan)
        email = index.split("Automated value emails", 1)[1].split("## [", 1)[0]
        self.assertIn("email/send_value_emails.groovy", email)
        self.assertIn("email/recipients.csv", email)
        self.assertIn("email/email-template.html", email)
        self.assertIn("samples/dim_account.csv", email)
        self.assertEqual(index.count("samples/dim_account.csv"), 2)
        self.assertEqual(index.count("samples/dim_cost_center.csv"), 2)

    def test_downloads_page_expands_the_file_index(self):
        class File:
            src_uri = "downloads.md"

        class Page:
            file = File()
            url = "downloads/"

        out = on_page_markdown(
            "Intro\n\n[[file-index]]\n\nOutro\n",
            Page(),
            {"docs_dir": str(DOCS), "nav": None},
            None,
        )
        self.assertNotIn("[[file-index]]", out)
        self.assertIn('<div class="downloads">', out)
        self.assertIn('href="../files/email/email-template.html"', out)
        self.assertIn('href="../files/email/recipients.csv"', out)
        self.assertIn('href="../files/email/send_value_emails.groovy"', out)
        self.assertIn('href="../files/sql/plan_vs_actual.sql"', out)
        self.assertIn("Intro", out)
        self.assertIn("Outro", out)
        for path in (DOCS / "files").rglob("*"):
            if path.is_file():
                relative = path.relative_to(DOCS / "files").as_posix()
                self.assertIn(f"files/{relative}", out)

    def test_unlinked_file_fails_the_index(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            docs = Path(tmp)
            note = docs / "note.md"
            note.write_text("# Note\n\n[[download:data/a.txt|Download a.txt]]\n", encoding="utf-8")
            linked = docs / "files" / "data"
            linked.mkdir(parents=True)
            (linked / "a.txt").write_text("a", encoding="utf-8")
            (linked / "b.txt").write_text("b", encoding="utf-8")
            with self.assertRaises(PluginError) as caught:
                render_file_index(docs, [{"Note": "note.md"}])
        self.assertIn("data/b.txt", str(caught.exception))
        self.assertNotIn("data/a.txt", str(caught.exception))

    def test_site_code_is_trimmed_and_a_url_is_rejected(self):
        config = Config(" financedatahub ")
        on_config(config)
        self.assertEqual(config.extra["goatcounter_code"], "financedatahub")
        with self.assertRaises(PluginError):
            on_config(Config("https://financedatahub.goatcounter.com/count"))


if __name__ == "__main__":
    unittest.main()
