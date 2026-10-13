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


if __name__ == "__main__":
    unittest.main()
