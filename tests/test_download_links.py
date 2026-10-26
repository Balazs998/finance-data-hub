import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from hooks.site import (  # noqa: E402
    SAMPLE_DATA_FILES,
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

    def test_release_shortcode_serves_a_file_on_this_site(self):
        out = render_shortcodes(
            "[[release:vba/FPNA_MonthCloseChecks.bas|Workbook]]",
            "downloads.md",
            DOCS,
        )
        self.assertIn('href="files/vba/FPNA_MonthCloseChecks.bas"', out)
        self.assertIn('<div class="downloads">', out)
        self.assertIn('data-goatcounter-click="download-FPNA_MonthCloseChecks.bas"', out)
        self.assertNotIn("github.com", out)
        self.assertNotIn("Balazs998/", out)
        self.assertNotIn("[[release:", out)

    def test_missing_release_file_fails_the_build(self):
        with self.assertRaises(PluginError):
            render_shortcodes("[[release:close-model.xlsm]]", "index.md", DOCS)

    def test_release_shortcode_is_listed_on_the_downloads_page(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            docs = Path(tmp)
            note = docs / "note.md"
            note.write_text(
                "# Note\n\n[[release:data/a.txt|Download a.txt]]\n",
                encoding="utf-8",
            )
            linked = docs / "files" / "data"
            linked.mkdir(parents=True)
            (linked / "a.txt").write_text("a", encoding="utf-8")
            index = render_file_index(docs, [{"Note": "note.md"}])
        self.assertIn("[[download:data/a.txt|Download a.txt]]", index)
        self.assertNotIn("github.com", index)

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
        self.assertIn(
            '<span class="download-verb">Download </span>'
            '<span class="download-name">fact<wbr>_actuals<wbr>.csv</span></a>',
            out,
        )
        self.assertIn('<p class="download-note">(610 rows)</p>', out)
        self.assertNotIn("(610 rows)</a>", out)

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
                    {"Plan vs actuals": "snowflake/plan-vs-actuals.md"},
                    {"Snapshots vs Time Travel": "snowflake/month-end-snapshots.md"},
                    {"FX rate lock": "snowflake/fx-rate-lock.md"},
                    {"ASOF JOIN": "snowflake/asof-join.md"},
                    {"13-week cash runway": "snowflake/automaker-13-week-cash-runway.md"},
                    {"Cost per vehicle": "snowflake/automaker-cost-per-vehicle.md"},
                    {"Capex project tracking": "snowflake/automaker-capex-project-tracking.md"},
                    {"BOM cost rollup": "snowflake/automaker-bom-cost-rollup.md"},
                    {"ERP control totals": "snowflake/automaker-erp-control-totals.md"},
                    {"Close tracker anomaly flags": "snowflake/automaker-close-tracker-anomaly-flags.md"},
                ]
            },
            {
                "Jedox": [
                    "jedox/index.md",
                    {"Management report export": "jedox/management-report-export.md"},
                    {"Snowflake to Jedox load": "jedox/snowflake-to-jedox.md"},
                    {"Relational extracts": "jedox/relational-extracts.md"},
                    {"Failure-only alerts": "jedox/failure-alerts.md"},
                    {"Automated value emails": "jedox/automated-value-emails.md"},
                ]
            },
            {
                "VBA": [
                    "vba/index.md",
                    {"Email macros after New Outlook": "vba/new-outlook-email.md"},
                    {"VBScript deprecation": "vba/vbscript-deprecation.md"},
                    {"Month-close checks": "vba/month-close-checks.md"},
                    {"Excel as a thin front end": "vba/excel-thin-front-end.md"},
                ]
            },
        ]
        index = render_file_index(DOCS, nav)
        files_root = DOCS / "files"
        for path in files_root.rglob("*"):
            if path.is_file():
                relative = path.relative_to(files_root).as_posix()
                self.assertIn(f"[[download:{relative}", index)
        order = [
            "## Sample data",
            "## [Month-end actuals](snowflake/month-end-actuals.md)",
            "## [Plan vs actuals](snowflake/plan-vs-actuals.md)",
            "## [Snapshots vs Time Travel](snowflake/month-end-snapshots.md)",
            "## [FX rate lock](snowflake/fx-rate-lock.md)",
            "## [13-week cash runway](snowflake/automaker-13-week-cash-runway.md)",
            "## [Cost per vehicle](snowflake/automaker-cost-per-vehicle.md)",
            "## [Capex project tracking](snowflake/automaker-capex-project-tracking.md)",
            "## [BOM cost rollup](snowflake/automaker-bom-cost-rollup.md)",
            "## [ERP control totals](snowflake/automaker-erp-control-totals.md)",
            "## [Close tracker anomaly flags](snowflake/automaker-close-tracker-anomaly-flags.md)",
            "## [Management report export](jedox/management-report-export.md)",
            "## [Relational extracts](jedox/relational-extracts.md)",
            "## [Failure-only alerts](jedox/failure-alerts.md)",
            "## [Automated value emails](jedox/automated-value-emails.md)",
            "## [Email macros after New Outlook](vba/new-outlook-email.md)",
            "## [VBScript deprecation](vba/vbscript-deprecation.md)",
            "## [Month-close checks](vba/month-close-checks.md)",
            "## [Excel as a thin front end](vba/excel-thin-front-end.md)",
        ]
        positions = [index.index(heading) for heading in order]
        self.assertEqual(positions, sorted(positions))
        self.assertTrue(index.startswith("## Sample data\n"))
        sample = index.split("## [", 1)[0]
        for relative in SAMPLE_DATA_FILES:
            self.assertIn(f"[[download:{relative}|", sample)
        self.assertEqual(sample.count("[[download:"), len(SAMPLE_DATA_FILES))
        self.assertIn("](snowflake/plan-vs-actuals.md)", sample)
        self.assertIn("](jedox/snowflake-to-jedox.md)", sample)
        self.assertIn("](jedox/automated-value-emails.md)", sample)
        plan = index.split("## [Plan vs actuals](snowflake/plan-vs-actuals.md)", 1)[1].split("## [", 1)[0]
        self.assertIn("sql/plan_vs_actual.sql", plan)
        self.assertNotIn("samples/", plan)
        self.assertNotIn("email/send_value_emails.groovy", plan)
        snapshots = index.split("## [Snapshots vs Time Travel](snowflake/month-end-snapshots.md)", 1)[1].split("## [", 1)[0]
        self.assertIn("snapshots/01_fact_actuals_snapshot_ddl.sql", snapshots)
        self.assertIn("snapshots/02_seed_late_posting.sql", snapshots)
        self.assertIn("snapshots/03_take_snapshot.sql", snapshots)
        self.assertIn("snapshots/04_v_snapshot_vs_current.sql", snapshots)
        self.assertIn("snapshots/05_compare_query.sql", snapshots)
        self.assertIn("snapshots/README.md", snapshots)
        self.assertNotIn("samples/", snapshots)
        fx = index.split("## [FX rate lock](snowflake/fx-rate-lock.md)", 1)[1].split("## [", 1)[0]
        fx_files = (
            "fx/01_fx_rate_daily_ddl.sql",
            "fx/02_fx_rate_period_ddl.sql",
            "fx/03_seed_fx_rates.sql",
            "fx/04_v_fx_missing_rates.sql",
            "fx/05_asof_join_convert.sql",
            "fx/06_period_lock_and_snapshot.sql",
            "fx/07_restate_after_lock_demo.sql",
            "fx/README.md",
        )
        positions = [fx.index(name) for name in fx_files]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn("samples/", fx)
        cash = index.split("## [13-week cash runway](snowflake/automaker-13-week-cash-runway.md)", 1)[1].split("## [", 1)[0]
        cash_files = (
            "cash13/01_cash_tables_ddl_load.sql",
            "cash13/02_v_cash_flow_week.sql",
            "cash13/03_v_cash_13w.sql",
            "cash13/04_v_cash_runway.sql",
            "cash13/05_v_cash_week1_avf.sql",
            "cash13/06_v_receipt_slip.sql",
            "cash13/07_checks.sql",
            "cash13/README.md",
            "samples/motors/cash_opening.csv",
            "samples/motors/cash_flow.csv",
            "samples/motors/cash_scenario.csv",
            "samples/motors/liquidity_floor.csv",
            "samples/motors/load_motors.sql",
            "samples/motors/README.md",
            "samples/motors/gen_motors.py",
        )
        positions = [cash.index(name) for name in cash_files]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn("samples/fact_actuals.csv", cash)
        self.assertNotIn("fx/", cash)
        self.assertNotIn("pvm/", cash)
        pvm = index.split("## [Cost per vehicle](snowflake/automaker-cost-per-vehicle.md)", 1)[1].split("## [", 1)[0]
        pvm_files = (
            "pvm/01_v_plant_cost.sql",
            "pvm/02_v_cost_per_vehicle.sql",
            "pvm/03_v_unit_economics.sql",
            "pvm/04_v_pvm_variance.sql",
            "pvm/05_jedox_rules.txt",
            "pvm/06_checks.sql",
            "pvm/README.md",
        )
        positions = [pvm.index(name) for name in pvm_files]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(pvm.count("[[download:"), len(pvm_files))
        self.assertNotIn("samples/", pvm)
        self.assertNotIn("cash13/", pvm)
        self.assertNotIn("capex/", pvm)
        capex = index.split("## [Capex project tracking](snowflake/automaker-capex-project-tracking.md)", 1)[1].split("## [", 1)[0]
        capex_files = (
            "capex/01_v_capex_status.sql",
            "capex/02_v_capex_exceptions.sql",
            "capex/03_v_capex_alert.sql",
            "capex/04_checks.sql",
            "capex/README.md",
        )
        positions = [capex.index(name) for name in capex_files]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(capex.count("[[download:"), len(capex_files))
        self.assertNotIn("samples/", capex)
        self.assertNotIn("pvm/", capex)
        self.assertNotIn("bom/", capex)
        bom = index.split("## [BOM cost rollup](snowflake/automaker-bom-cost-rollup.md)", 1)[1].split("## [", 1)[0]
        bom_files = (
            "bom/01_v_bom_exploded.sql",
            "bom/02_v_std_cost_rollup.sql",
            "bom/03_v_ppv.sql",
            "bom/04_v_usage_var.sql",
            "bom/05_checks.sql",
            "bom/README.md",
        )
        positions = [bom.index(name) for name in bom_files]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(bom.count("[[download:"), len(bom_files))
        self.assertNotIn("samples/", bom)
        self.assertNotIn("capex/", bom)
        self.assertNotIn("erpctl/", bom)
        erp = index.split("## [ERP control totals](snowflake/automaker-erp-control-totals.md)", 1)[1].split("## [", 1)[0]
        erp_files = (
            "erpctl/01_erp_gl_landing_ddl.sql",
            "erpctl/02_views.sql",
            "erpctl/03_load_and_log.sql",
            "erpctl/04_v_control_recon.sql",
            "erpctl/05_jedox_hop.sql",
            "erpctl/06_control_evidence.sql",
            "erpctl/07_checks.sql",
            "erpctl/README.md",
        )
        positions = [erp.index(name) for name in erp_files]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(erp.count("[[download:"), len(erp_files))
        self.assertNotIn("samples/", erp)
        self.assertNotIn("bom/", erp)
        self.assertNotIn("anomaly/", erp)
        anomaly = index.split("## [Close tracker anomaly flags](snowflake/automaker-close-tracker-anomaly-flags.md)", 1)[1].split("## [", 1)[0]
        anomaly_files = (
            "anomaly/01_v_close_status.sql",
            "anomaly/02_v_je_zscore.sql",
            "anomaly/03_v_je_iqr.sql",
            "anomaly/04_v_je_rules.sql",
            "anomaly/05_v_je_flags_alert.sql",
            "anomaly/06_checks.sql",
            "anomaly/README.md",
        )
        positions = [anomaly.index(name) for name in anomaly_files]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(anomaly.count("[[download:"), len(anomaly_files))
        self.assertNotIn("samples/", anomaly)
        self.assertNotIn("erpctl/", anomaly)
        email = index.split("## [Automated value emails]", 1)[1].split("## [", 1)[0]
        self.assertIn("email/send_value_emails.groovy", email)
        self.assertIn("email/recipients.csv", email)
        self.assertIn("email/email-template.html", email)
        self.assertNotIn("samples/", email)
        # The load note links only sample files, so it gets no group of its own.
        self.assertNotIn("## [Snowflake to Jedox load]", index)
        relational = index.split("## [Relational extracts](jedox/relational-extracts.md)", 1)[1].split("## [", 1)[0]
        self.assertIn("relational/v_fact_actuals.sql", relational)
        self.assertIn("relational/relational_extract_actuals.sql", relational)
        self.assertIn("relational/v_jedox_actuals_by_group.sql", relational)
        self.assertIn("relational/query_history_lookup.sql", relational)
        self.assertNotIn("relational/v_fact_budget.sql", relational)
        self.assertNotIn("samples/", relational)
        alerts = index.split("## [Failure-only alerts](jedox/failure-alerts.md)", 1)[1].split("## [", 1)[0]
        self.assertIn("alerts/job_runs.csv", alerts)
        self.assertIn("alerts/alert_on_failure.groovy", alerts)
        self.assertIn("alerts/test_alert_logic.groovy", alerts)
        self.assertIn("relational/v_fact_budget.sql", alerts)
        self.assertNotIn("relational/v_fact_actuals.sql", alerts)
        self.assertNotIn("samples/", alerts)
        outlook = index.split("## [Email macros after New Outlook](vba/new-outlook-email.md)", 1)[1].split("## [", 1)[0]
        self.assertIn("email/SendOrSave.bas", outlook)
        self.assertNotIn("email/recipients.csv", outlook)
        vbscript = index.split("## [VBScript deprecation](vba/vbscript-deprecation.md)", 1)[1].split("## [", 1)[0]
        self.assertIn("vba/ScanVBScript.bas", vbscript)
        self.assertIn("vba/modChecks.bas", vbscript)
        self.assertIn("vba/modValidate.bas", vbscript)
        self.assertIn("vba/modCleanup.bas", vbscript)
        thin = index.split("## [Excel as a thin front end](vba/excel-thin-front-end.md)", 1)[1]
        self.assertLess(
            thin.index("thinfront/01_reporting_views.sql"),
            thin.index("thinfront/02_excel_read_grants_PROPOSED.sql"),
        )
        self.assertLess(
            thin.index("thinfront/02_excel_read_grants_PROPOSED.sql"),
            thin.index("thinfront/FDH_ThinFront.bas"),
        )
        self.assertLess(
            thin.index("thinfront/FDH_ThinFront.bas"),
            thin.index("thinfront/BUILD-SPEC.md"),
        )
        self.assertLess(thin.index("thinfront/BUILD-SPEC.md"), thin.index("thinfront/README.md"))
        self.assertNotIn(".xlsm", thin)

    def test_file_index_lists_each_file_exactly_once(self):
        index = render_file_index(DOCS, None)
        files_root = DOCS / "files"
        disk = sorted(
            path.relative_to(files_root).as_posix()
            for path in files_root.rglob("*")
            if path.is_file()
        )
        self.assertEqual(len(disk), 110)
        listed = re.findall(r"\[\[download:([^\]|\s]+)", index)
        self.assertEqual(len(listed), len(disk))
        self.assertEqual(sorted(listed), disk)
        for relative in disk:
            self.assertEqual(listed.count(relative), 1, relative)

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
        self.assertIn(
            '<span class="download-verb">Download </span>'
            '<span class="download-name">fact<wbr>_actuals<wbr>.csv</span></a>',
            out,
        )
        self.assertIn('<p class="download-note">(610 rows)</p>', out)
        self.assertIn('<p class="download-note">(optional view)</p>', out)
        self.assertNotIn(">Download fact_actuals.csv (610 rows)</a>", out)
        self.assertNotIn("(optional view)</a>", out)
        self.assertNotRegex(out, r">[^<]*\([^)]*\)</a>")
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

    def test_download_button_labels_at_phone_and_desktop(self):
        completed = subprocess.run(
            ["node", "--test", str(ROOT / "tests" / "download-button-label.test.js")],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            completed.returncode,
            0,
            completed.stdout + "\n" + completed.stderr,
        )

    def test_site_code_is_trimmed_and_a_url_is_rejected(self):
        config = Config(" financedatahub ")
        on_config(config)
        self.assertEqual(config.extra["goatcounter_code"], "financedatahub")
        with self.assertRaises(PluginError):
            on_config(Config("https://financedatahub.goatcounter.com/count"))


if __name__ == "__main__":
    unittest.main()
