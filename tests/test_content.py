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
        self.assertIn("NULLIF(TRIM(l.entity_code), '')", sql)
        self.assertIn("NULLIF(TRIM(l.cost_center_code), '')", sql)
        elimination = "COALESCE(NULLIF(TRIM(l.entity_code), ''), '(none)') NOT IN ('E900')"
        self.assertIn("COALESCE(NULLIF(TRIM(l.entity_code), ''), '(none)')", sql)
        self.assertIn("NOT IN ('E900')", sql)
        self.assertIn(elimination, article)
        self.assertIn("ORDER BY loaded_at DESC, load_id DESC", sql)
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

    def test_rewritten_posts_keep_labels_and_one_warehouse_note(self):
        plan = (ROOT / "docs/snowflake/plan-vs-actuals.md").read_text(encoding="utf-8")
        load = (ROOT / "docs/jedox/snowflake-to-jedox.md").read_text(encoding="utf-8")
        relational = (ROOT / "docs/jedox/relational-extracts.md").read_text(encoding="utf-8")
        sql = (ROOT / "docs/files/sql/plan_vs_actual.sql").read_text(encoding="utf-8")

        self.assertEqual(plan.count('!!! info "Why SYSADMIN here"'), 1)
        self.assertEqual(
            plan.count(
                "`JEDOX_ETL_WH` is created in the "
                "[From Snowflake to Jedox](../jedox/snowflake-to-jedox.md) post; "
                "use any warehouse you can use."
            ),
            1,
        )
        self.assertNotIn("-- JEDOX_ETL_WH is created", plan)
        self.assertEqual(
            sql.count(
                "-- JEDOX_ETL_WH is created in the Snowflake to Jedox post; "
                "use any warehouse you can use."
            ),
            1,
        )

        self.assertIn(
            'title: "Plan vs. actuals in Snowflake SQL, without losing rows"',
            plan,
        )
        self.assertIn("FULL OUTER JOIN", plan.split("---", 2)[1])
        self.assertIn('social_image: plan-vs-actuals.png', plan)
        self.assertIn('<p class="post-meta">Snowflake</p>', plan)
        self.assertIn('social_image: snowflake-to-jedox.png', load)
        self.assertIn('<p class="post-meta">Snowflake · Jedox</p>', load)
        self.assertIn('social_image: relational-extracts.png', relational)
        self.assertIn('<p class="post-meta">Snowflake · Jedox</p>', relational)
        self.assertIn('src="../02-join-coverage.svg"', plan)
        self.assertIn('src="../01-pipeline-diagram.svg"', load)
        self.assertIn('src="../relational-extract-diagram.svg"', relational)

        for page, labels in {
            plan: (
                "[[download:samples/fact_budget.csv|Download fact_budget.csv]]",
                "[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]",
                "[[download:samples/dim_account.csv|Download dim_account.csv]]",
                "[[download:samples/dim_cost_center.csv|Download dim_cost_center.csv]]",
                "[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]",
                "[[download:sql/plan_vs_actual.sql|Download plan_vs_actual.sql]]",
            ),
            load: (
                "[[download:samples/dim_cost_center.csv|Download dim_cost_center.csv]]",
                "[[download:samples/dim_account.csv|Download dim_account.csv]]",
                "[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]",
                "[[download:samples/fact_budget.csv|Download fact_budget.csv]]",
                "[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]",
            ),
            relational: (
                "[[download:relational/v_fact_actuals.sql|Download v_fact_actuals.sql]]",
                "[[download:relational/v_fact_actuals.sql|Download v_fact_actuals.sql (setup view and grant)]]",
                "[[download:relational/relational_extract_actuals.sql|Download relational_extract_actuals.sql]]",
                "[[download:relational/v_jedox_actuals_by_group.sql|Download v_jedox_actuals_by_group.sql (optional view)]]",
                "[[download:relational/query_history_lookup.sql|Download query_history_lookup.sql]]",
                "[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]",
                "[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]",
            ),
        }.items():
            found = re.findall(r"\[\[download:[^\]]+\]\]", page)
            self.assertEqual(tuple(found), labels)

        for figure in (
            "14,896.50",
            "14,968,531.49",
            "15,431,676.59",
            "2,284,689.40",
            "500000",
            "CC3010",
            "CC6000",
            "701",
            "696",
            "605",
            "91",
        ):
            self.assertIn(figure, plan)
        for figure in ("1,466,143.86", "58", "2026-03"):
            self.assertIn(figure, load)
            self.assertIn(figure, relational)

    def test_month_end_snapshots_stay_distinct_and_ungranted(self):
        page = (ROOT / "docs/snowflake/month-end-snapshots.md").read_text(encoding="utf-8")
        actuals = (ROOT / "docs/snowflake/month-end-actuals.md").read_text(encoding="utf-8")
        self.assertIn('title: "What number did we report? Permanent month-end snapshots vs Time Travel"', page)
        self.assertIn("social_image: month-end-snapshots.png", page)
        self.assertIn('<p class="post-meta">Snowflake</p>', page)
        self.assertIn('class="docs-note"', page)
        self.assertIn("Time Travel defaults to **1 day**", page)
        self.assertIn("makes a **new** object", page)
        self.assertIn("**Business Critical or higher**", page)
        self.assertIn("Backups](https://docs.snowflake.com/en/user-guide/backups)", page)
        self.assertIn("month-end-snapshots-timeline.svg", page)
        self.assertIn("Swipe to see the full diagram", page)
        self.assertIn("[Month-end actuals](month-end-actuals.md)", page)
        self.assertNotIn("gl_actuals_pnl.sql", page)
        self.assertNotIn("FINANCE.GL_JOURNAL_LINE", page)
        self.assertNotIn("status:", page.lower())
        self.assertNotIn("DRAFT", page)
        self.assertNotIn("Flake", page)
        self.assertNotIn("Siemens", page)
        self.assertIn("month-end actuals", actuals.lower())
        labels = (
            "[[download:samples/fact_actuals.csv|Download fact_actuals.csv (610 rows)]]",
            "[[download:samples/load_snowflake.sql|Download load_snowflake.sql]]",
            "[[download:snapshots/01_fact_actuals_snapshot_ddl.sql|Download 01_fact_actuals_snapshot_ddl.sql]]",
            "[[download:snapshots/02_seed_late_posting.sql|Download 02_seed_late_posting.sql]]",
            "[[download:snapshots/03_take_snapshot.sql|Download 03_take_snapshot.sql]]",
            "[[download:snapshots/04_v_snapshot_vs_current.sql|Download 04_v_snapshot_vs_current.sql]]",
            "[[download:snapshots/05_compare_query.sql|Download 05_compare_query.sql]]",
            "[[download:snapshots/README.md|Download README.md]]",
        )
        found = re.findall(r"\[\[download:[^\]]+\]\]", page)
        self.assertEqual(tuple(found), labels)
        pack = ROOT / "docs/files/snapshots"
        for path in pack.rglob("*"):
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("Siemens", text, path.name)
            self.assertNotRegex(text, r"(?im)^[ \t]*GRANT\b", path.name)
            self.assertNotIn("JEDOX_ETL_ROLE TO", text, path.name)
        nav = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
        self.assertLess(
            nav.index("snowflake/plan-vs-actuals.md"),
            nav.index("snowflake/month-end-snapshots.md"),
        )
        self.assertLess(
            nav.index("snowflake/month-end-actuals.md"),
            nav.index("snowflake/month-end-snapshots.md"),
        )

    def test_excel_thin_front_end_keeps_reviewed_numbers_and_proposed_grants(self):
        page = (ROOT / "docs/vba/excel-thin-front-end.md").read_text(encoding="utf-8")
        views = (ROOT / "docs/files/thinfront/01_reporting_views.sql").read_text(encoding="utf-8")
        grants = (ROOT / "docs/files/thinfront/02_excel_read_grants_PROPOSED.sql").read_text(
            encoding="utf-8"
        )
        module = (ROOT / "docs/files/thinfront/FDH_ThinFront.bas").read_text(encoding="utf-8")
        spec = (ROOT / "docs/files/thinfront/BUILD-SPEC.md").read_text(encoding="utf-8")
        readme = (ROOT / "docs/files/thinfront/README.md").read_text(encoding="utf-8")
        index = (ROOT / "docs/vba/index.md").read_text(encoding="utf-8")
        nav = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")

        self.assertIn(
            'title: "Excel as a thin front end: Snowflake views feed a refresh-only workbook"',
            page,
        )
        self.assertIn(
            "Move P&L and variance logic into two FDH_DEMO Snowflake views",
            page,
        )
        self.assertIn("social_image: excel-thin-front-end.png", page)
        self.assertIn('<p class="post-meta">VBA · Intermediate · ~20 min</p>', page)
        self.assertIn('class="docs-note"', page)
        self.assertIn("The demo workbook hasn't been built yet", page)
        self.assertIn("FDH_DEMO", page)
        self.assertNotIn("DRAFT v0.3", page)
        self.assertNotIn("VBA Pro", page)
        self.assertNotIn("keypair-migration", page)
        self.assertIn("Key-pair auth for service users", page)
        self.assertIn("../snowflake/plan-vs-actuals.md", page)
        self.assertIn("02_excel_read_grants_PROPOSED.sql", page)
        self.assertIn("commented out", page)
        self.assertIn("Security Guard approves them before ship", page)

        for figure in (
            "96 (88 with actuals, 8 budget-only for 2026-09)",
            '144 (132 with actuals, 12 "No actuals yet" for 2026-09)',
            "15,446,573.09 / 17,253,220.89",
            "actual 229,693.47, budget 223,769.38, variance +5,924.09 (favourable)",
            "actual 1,236,450.39, budget 1,207,184.99, variance +29,265.40 (unfavourable)",
            "229,693.47 + 1,236,450.39 = 1,466,143.86",
            "fact_actuals.csv",
            "610 rows",
            "696 rows",
        ):
            self.assertIn(figure, page)
        for figure in (
            "expect 96 rows (88 with actuals, 8 budget-only for 2026-09)",
            "expect 144 rows (132 with actuals, 12 'No actuals yet' for 2026-09)",
            "REVENUE 229,693.47 vs 223,769.38 (+5,924.09)",
            "EXPENSE 1,236,450.39 vs 1,207,184.99 (+29,265.40)",
            "expect actual 15,446,573.09, budget 17,253,220.89",
        ):
            self.assertIn(figure, views)
        self.assertIn("USE SCHEMA FDH_DEMO.SAMPLE;", views)
        self.assertIn("CREATE OR REPLACE VIEW V_PNL_MONTHLY AS", views)
        self.assertIn("CREATE OR REPLACE VIEW V_VARIANCE_BY_CC AS", views)
        self.assertNotRegex(views, r"(?im)^[ \t]*(GRANT|REVOKE)\b")

        self.assertTrue(grants.startswith("-- Post 02: PROPOSED grants"))
        self.assertIn("NOT approved yet", grants)
        self.assertIn(
            "Reviewed by Security Guard. Not run by this pack; an admin runs it once.",
            grants,
        )
        self.assertNotIn("Security Guard must approve before ship", grants)
        self.assertIn(
            "Keep the private key file outside the workbook's folder and any synced, shared or Git folder, and encrypt it with a passphrase.",
            page,
        )
        self.assertIn(
            "`WriteLog` (5 cells to the RefreshLog sheet) is in the downloadable module.",
            page,
        )
        self.assertIn("Views only; no table grants.", grants)
        self.assertIn("FDH_DEMO.SAMPLE.V_PNL_MONTHLY", grants)
        self.assertIn("FDH_DEMO.SAMPLE.V_VARIANCE_BY_CC", grants)
        self.assertIn("EXCEL_READ_ROLE", grants)
        for line in grants.splitlines():
            if re.search(r"\b(GRANT|REVOKE|USE ROLE)\b", line):
                self.assertTrue(line.lstrip().startswith("--"), line)
        self.assertNotIn("JEDOX_ETL_ROLE", grants)
        self.assertNotIn("JEDOX_ETL_ROLE", views)

        self.assertIn('Attribute VB_Name = "FDH_ThinFront"', module)
        self.assertIn("fictional FDH_DEMO data", module)
        self.assertIn("Add a sheet named RefreshLog first.", module)
        self.assertIn("Private Function SheetExists", module)
        self.assertIn("no Declare / PtrSafe is needed", module)
        self.assertNotRegex(module, r"(?im)^[ \t]*(Private |Public )?Declare\b")
        self.assertIn("Workbook not built yet.", spec)
        self.assertIn("15,446,573.09", spec)
        self.assertIn("17,253,220.89", spec)
        self.assertIn('expect 12', spec)
        self.assertTrue(readme.startswith("# Post 02 thin front end pack (fictional FDH_DEMO data)"))
        self.assertIn("02_excel_read_grants_PROPOSED.sql", readme)
        self.assertIn("needs Security Guard approval", readme)

        labels = (
            "[[download:thinfront/01_reporting_views.sql|Download 01_reporting_views.sql]]",
            "[[download:thinfront/02_excel_read_grants_PROPOSED.sql|Download 02_excel_read_grants_PROPOSED.sql]]",
            "[[download:thinfront/FDH_ThinFront.bas|Download FDH_ThinFront.bas]]",
            "[[download:thinfront/BUILD-SPEC.md|Download BUILD-SPEC.md]]",
            "[[download:thinfront/README.md|Download README.md]]",
        )
        found = re.findall(r"\[\[download:[^\]]+\]\]", page)
        self.assertEqual(tuple(found), labels)
        self.assertNotIn(".xlsm", " ".join(labels))
        pack = ROOT / "docs/files/thinfront"
        self.assertEqual(
            sorted(path.name for path in pack.iterdir() if path.is_file()),
            [
                "01_reporting_views.sql",
                "02_excel_read_grants_PROPOSED.sql",
                "BUILD-SPEC.md",
                "FDH_ThinFront.bas",
                "README.md",
            ],
        )
        for path in pack.iterdir():
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("Siemens", text, path.name)
            self.assertIn("FDH_DEMO", text, path.name)
        self.assertIn('href="excel-thin-front-end/"', index)
        self.assertIn("02_excel_read_grants_PROPOSED.sql", index)
        self.assertLess(
            nav.index("vba/month-close-checks.md"),
            nav.index("vba/excel-thin-front-end.md"),
        )


if __name__ == "__main__":
    unittest.main()
