import hashlib
import html as html_lib
import re
import unittest
from pathlib import Path

from test_built_site import ROOT, SITE, local_target
from test_home import png_size, webp_size

SECTION_CSS = ROOT / "docs" / "stylesheets" / "section.css"
SECTION_CSS_SHA256 = "aab900abe9b200064f791b4643d4a19673d198290418047ac6e7f02ef02d457b"

LOAD_SUMMARY = "Pull monthly actuals into a planning cube so a rerun leaves no stale numbers."

# title, href, tools, summary, meta, start, tool card
SECTIONS = {
    "snowflake": {
        "modifier": "fdh-section--snowflake",
        "h1": "Snowflake",
        "label": "Posts",
        "few": False,
        "mascot": "snowflake-pointing",
        "alt": "Snowflake mascot in a blue hoodie pointing toward the introduction",
        "size": (154, 260),
        "cards": (
            (
                "Month-end actuals",
                "month-end-actuals/",
                "Snowflake",
                "Turn journal lines into monthly P&L actuals that stay right when a period is reloaded.",
                "7 min read",
                True,
                False,
            ),
            (
                "Plan vs actuals",
                "plan-vs-actuals/",
                "Snowflake",
                "Compare budget and actuals so a month missing on either side still shows up.",
                "7 min read",
                False,
                False,
            ),
            (
                "Snapshots vs Time Travel",
                "month-end-snapshots/",
                "Snowflake",
                "Freeze the month you reported so a late posting does not change the number you sent.",
                "20 min read",
                False,
                False,
            ),
            (
                "FX rate lock",
                "fx-rate-lock/",
                "Snowflake",
                "Lock the FX rate on the pack you sent so a later restatement cannot move the total.",
                "25 min read",
                False,
                False,
            ),
            (
                "ASOF JOIN",
                "asof-join/",
                "Snowflake",
                "Attach the latest prior daily FX rate when the posting date has no exact match.",
                "8 min read",
                False,
                False,
            ),
            (
                "13-week cash runway",
                "automaker-13-week-cash-runway/",
                "Snowflake",
                "Forecast 13 weeks of FDH Motors cash and read how many weeks stay above the liquidity floor.",
                "25 min read",
                False,
                False,
            ),
            (
                "Cost per vehicle",
                "automaker-cost-per-vehicle/",
                "Snowflake · Jedox",
                "Allocate FDH Motors plant cost by units produced, then split the revenue gap into price, volume, mix, new and lost.",
                "30 min read",
                False,
                False,
            ),
            (
                "Capex project tracking",
                "automaker-capex-project-tracking/",
                "Snowflake",
                "Track FDH Motors capex budget, open commitments and actuals, and alert only when a project is over budget or unapproved.",
                "25 min read",
                False,
                False,
            ),
            (
                "BOM cost rollup",
                "automaker-bom-cost-rollup/",
                "Snowflake",
                "Explode the FDH Motors bill of materials, roll standard cost up to the vehicle, and split purchase price and usage variance.",
                "30 min read",
                False,
                False,
            ),
            (
                "ERP control totals",
                "automaker-erp-control-totals/",
                "Snowflake · Jedox",
                "Record FDH Motors control totals at each hop from the ERP file to Snowflake to Jedox, and keep an append-only evidence row per run.",
                "35 min read",
                False,
                False,
            ),
            (
                "Close tracker anomaly flags",
                "automaker-close-tracker-anomaly-flags/",
                "Snowflake",
                "Track FDH Motors month-end close tasks by day, then flag unusual journal lines with a z-score, the interquartile range and three plain rules.",
                "30 min read",
                False,
                False,
            ),
            (
                "Snowflake to Jedox load",
                "../jedox/snowflake-to-jedox/",
                "Snowflake · Jedox",
                LOAD_SUMMARY,
                "10 min read",
                False,
                False,
            ),
        ),
        "downloads": (
            ("../files/sql/gl_actuals_pnl.sql", "gl_actuals_pnl.sql"),
            ("../files/sql/plan_vs_actual.sql", "plan_vs_actual.sql"),
            ("../files/samples/load_snowflake.sql", "load_snowflake.sql"),
            ("../files/samples/fact_actuals.csv", "fact_actuals.csv"),
            ("../files/snapshots/01_fact_actuals_snapshot_ddl.sql", "01_fact_actuals_snapshot_ddl.sql"),
            ("../files/snapshots/03_take_snapshot.sql", "03_take_snapshot.sql"),
            ("../files/snapshots/02_seed_late_posting.sql", "02_seed_late_posting.sql"),
            ("../files/snapshots/04_v_snapshot_vs_current.sql", "04_v_snapshot_vs_current.sql"),
            ("../files/snapshots/05_compare_query.sql", "05_compare_query.sql"),
            ("../files/fx/01_fx_rate_daily_ddl.sql", "01_fx_rate_daily_ddl.sql"),
            ("../files/fx/02_fx_rate_period_ddl.sql", "02_fx_rate_period_ddl.sql"),
            ("../files/fx/03_seed_fx_rates.sql", "03_seed_fx_rates.sql"),
            ("../files/fx/04_v_fx_missing_rates.sql", "04_v_fx_missing_rates.sql"),
            ("../files/fx/05_asof_join_convert.sql", "05_asof_join_convert.sql"),
            ("../files/fx/06_period_lock_and_snapshot.sql", "06_period_lock_and_snapshot.sql"),
            ("../files/fx/07_restate_after_lock_demo.sql", "07_restate_after_lock_demo.sql"),
            ("../files/samples/motors/load_motors.sql", "load_motors.sql"),
            ("../files/samples/motors/cash_opening.csv", "cash_opening.csv"),
            ("../files/samples/motors/cash_flow.csv", "cash_flow.csv"),
            ("../files/samples/motors/cash_scenario.csv", "cash_scenario.csv"),
            ("../files/samples/motors/liquidity_floor.csv", "liquidity_floor.csv"),
            ("../files/cash13/01_cash_tables_ddl_load.sql", "01_cash_tables_ddl_load.sql"),
            ("../files/cash13/02_v_cash_flow_week.sql", "02_v_cash_flow_week.sql"),
            ("../files/cash13/03_v_cash_13w.sql", "03_v_cash_13w.sql"),
            ("../files/cash13/04_v_cash_runway.sql", "04_v_cash_runway.sql"),
            ("../files/cash13/05_v_cash_week1_avf.sql", "05_v_cash_week1_avf.sql"),
            ("../files/cash13/06_v_receipt_slip.sql", "06_v_receipt_slip.sql"),
            ("../files/cash13/07_checks.sql", "07_checks.sql"),
            ("../files/pvm/01_v_plant_cost.sql", "01_v_plant_cost.sql"),
            ("../files/pvm/02_v_cost_per_vehicle.sql", "02_v_cost_per_vehicle.sql"),
            ("../files/pvm/03_v_unit_economics.sql", "03_v_unit_economics.sql"),
            ("../files/pvm/04_v_pvm_variance.sql", "04_v_pvm_variance.sql"),
            ("../files/pvm/05_jedox_rules.txt", "05_jedox_rules.txt"),
            ("../files/pvm/06_checks.sql", "06_checks.sql"),
            ("../files/capex/01_v_capex_status.sql", "01_v_capex_status.sql"),
            ("../files/capex/02_v_capex_exceptions.sql", "02_v_capex_exceptions.sql"),
            ("../files/capex/03_v_capex_alert.sql", "03_v_capex_alert.sql"),
            ("../files/capex/04_checks.sql", "04_checks.sql"),
            ("../files/bom/01_v_bom_exploded.sql", "01_v_bom_exploded.sql"),
            ("../files/bom/02_v_std_cost_rollup.sql", "02_v_std_cost_rollup.sql"),
            ("../files/bom/03_v_ppv.sql", "03_v_ppv.sql"),
            ("../files/bom/04_v_usage_var.sql", "04_v_usage_var.sql"),
            ("../files/bom/05_checks.sql", "05_checks.sql"),
            ("../files/erpctl/01_erp_gl_landing_ddl.sql", "01_erp_gl_landing_ddl.sql"),
            ("../files/erpctl/02_views.sql", "02_views.sql"),
            ("../files/erpctl/03_load_and_log.sql", "03_load_and_log.sql"),
            ("../files/erpctl/04_v_control_recon.sql", "04_v_control_recon.sql"),
            ("../files/erpctl/05_jedox_hop.sql", "05_jedox_hop.sql"),
            ("../files/erpctl/06_control_evidence.sql", "06_control_evidence.sql"),
            ("../files/erpctl/07_checks.sql", "07_checks.sql"),
            ("../files/anomaly/01_v_close_status.sql", "01_v_close_status.sql"),
            ("../files/anomaly/02_v_je_zscore.sql", "02_v_je_zscore.sql"),
            ("../files/anomaly/03_v_je_iqr.sql", "03_v_je_iqr.sql"),
            ("../files/anomaly/04_v_je_rules.sql", "04_v_je_rules.sql"),
            ("../files/anomaly/05_v_je_flags_alert.sql", "05_v_je_flags_alert.sql"),
            ("../files/anomaly/06_checks.sql", "06_checks.sql"),
        ),
        "downloads_heading": "Snowflake downloads",
    },
    "jedox": {
        "modifier": "fdh-section--jedox",
        "h1": "Jedox",
        "label": "Posts",
        "few": False,
        "mascot": "jedox-cube",
        "alt": "Jedox mascot in a purple blazer holding a purple cube",
        "size": (143, 260),
        "cards": (
            (
                "Management report export",
                "management-report-export/",
                "Jedox · Excel",
                "Which elements belong in the export file, and which ones double-count.",
                "5 min read",
                True,
                False,
            ),
            (
                "Snowflake to Jedox load",
                "snowflake-to-jedox/",
                "Snowflake · Jedox",
                LOAD_SUMMARY,
                "10 min read",
                False,
                False,
            ),
            (
                "Relational extracts",
                "relational-extracts/",
                "Snowflake · Jedox",
                "Point-and-click table or your own SQL? Both run in Snowflake and return the same 58 rows.",
                "7 min read",
                False,
                False,
            ),
            (
                "Automated value emails",
                "automated-value-emails/",
                "Jedox · Groovy",
                "Send each cost center owner their own budget vs actuals from a Groovy job.",
                "17 min read",
                False,
                False,
            ),
            (
                "Email only when a Jedox load fails",
                "failure-alerts/",
                "Jedox · Integrator",
                "Email one alert a night when a Jedox Integrator load fails, warns, or loads zero rows.",
                "15 min read",
                False,
                False,
            ),
            (
                "Email builder and checker",
                "email-builder/",
                "Jedox · Groovy",
                "Fill in the email job from the browser, then check it for the usual traps.",
                "Interactive tool",
                False,
                True,
            ),
        ),
        "downloads": (
            ("../files/jedox/mgmt_report_export_sample.csv", "mgmt_report_export_sample.csv"),
            ("../files/relational/relational_extract_actuals.sql", "relational_extract_actuals.sql"),
            ("../files/email/send_value_emails.groovy", "send_value_emails.groovy"),
            ("../files/email/recipients.csv", "recipients.csv"),
            ("../files/alerts/job_runs.csv", "job_runs.csv"),
            ("../files/alerts/alert_on_failure.groovy", "alert_on_failure.groovy"),
            ("../files/alerts/test_alert_logic.groovy", "test_alert_logic.groovy"),
            ("../files/relational/v_fact_actuals.sql", "v_fact_actuals.sql"),
            ("../files/relational/v_fact_budget.sql", "v_fact_budget.sql"),
        ),
        "downloads_heading": "Jedox downloads",
    },
    "vba": {
        "modifier": "fdh-section--vba",
        "h1": "VBA and Excel",
        "label": "Posts",
        "few": True,
        "mascot": "vba-laptop",
        "alt": "VBA mascot in a green cardigan sitting with an open laptop",
        "size": (210, 260),
        "cards": (
            (
                "Month-close checks",
                "month-close-checks/",
                "VBA · Excel",
                "Flag a blank reporting period, empty Input_ drivers and #REF! or #N/A errors before the pack goes out.",
                "12 min read",
                True,
                False,
            ),
            (
                "Your VBA email macro after New Outlook",
                "new-outlook-email/",
                "VBA · Outlook",
                "Classic or New Outlook? What to switch to when VBA can't send, and a fallback so no month-end mail is lost.",
                "5 min read",
                False,
                False,
            ),
            (
                "Is your finance workbook hit by VBScript deprecation?",
                "vbscript-deprecation/",
                "VBA · Excel",
                "Find the macros that use VBScript RegExp or call a .vbs script before Windows turns VBScript off.",
                "10 min read",
                False,
                False,
            ),
            (
                "Excel as a thin front end",
                "excel-thin-front-end/",
                "VBA · Excel",
                "Move P&L and variance into Snowflake views and refresh the workbook with one button.",
                "20 min read",
                False,
                False,
            ),
        ),
        "downloads": (
            ("../files/vba/FPNA_MonthCloseChecks.bas", "FPNA_MonthCloseChecks.bas"),
            ("../files/email/SendOrSave.bas", "SendOrSave.bas"),
            ("../files/vba/ScanVBScript.bas", "ScanVBScript.bas"),
            ("../files/vba/modChecks.bas", "modChecks.bas"),
            ("../files/vba/modValidate.bas", "modValidate.bas"),
            ("../files/vba/modCleanup.bas", "modCleanup.bas"),
            ("../files/thinfront/01_reporting_views.sql", "01_reporting_views.sql"),
            (
                "../files/thinfront/02_excel_read_grants_for_admin.sql",
                "02_excel_read_grants_for_admin.sql",
            ),
            ("../files/thinfront/FDH_ThinFront.bas", "FDH_ThinFront.bas"),
            ("../files/thinfront/BUILD-SPEC.md", "BUILD-SPEC.md"),
            ("../files/thinfront/README.md", "README.md"),
        ),
        "downloads_heading": "VBA and Excel downloads",
    },
}


def article_html(page: Path) -> str:
    full = page.read_text(encoding="utf-8")
    start = full.find('<article class="md-content__inner')
    if start < 0:
        raise AssertionError(f"article missing in {page}")
    pos = start
    depth = 0
    while pos < len(full):
        open_at = full.find("<article", pos)
        close_at = full.find("</article>", pos)
        if close_at < 0:
            break
        if open_at != -1 and open_at < close_at:
            depth += 1
            pos = open_at + len("<article")
            continue
        depth -= 1
        pos = close_at + len("</article>")
        if depth == 0:
            return full[start:pos]
    raise AssertionError(f"article tags are unbalanced in {page}")


def attrs(tag: str) -> dict[str, str]:
    return dict(re.findall(r'([:\w-]+)="([^"]*)"', tag))


class SectionPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (SITE / "index.html").is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")

    def test_section_css_is_the_mockup_file(self):
        css = SECTION_CSS.read_text(encoding="utf-8")
        digest = hashlib.sha256(css.encode("utf-8")).hexdigest()
        self.assertEqual(digest, SECTION_CSS_SHA256)
        self.assertIn("prefers-reduced-motion:reduce", css)
        self.assertIn("transform:none", css)
        self.assertIn("min-height:44px", css)
        self.assertIn("grid-template-columns:repeat(auto-fill,minmax(300px,1fr))", css)
        self.assertIn(".fdh-cards--few{grid-template-columns:1fr}", css)
        self.assertIn("@media (max-width:600px)", css)
        self.assertIn("grid-template-columns:1fr", css)
        listed = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
        self.assertIn("stylesheets/section.css", listed)
        extra = (ROOT / "docs" / "stylesheets" / "extra.css").read_text(encoding="utf-8")
        self.assertIn(".md-typeset li .fdh-card__title a:not(.md-button)", extra)
        self.assertIn(
            'a[download="FPNA_MonthCloseChecks.bas"]',
            extra,
        )
        self.assertIn("white-space: nowrap", extra)

    def test_section_pages_cards_mascots_and_downloads(self):
        load_summaries = []
        for slug, spec in SECTIONS.items():
            page = SITE / slug / "index.html"
            self.assertTrue(page.is_file(), slug)
            full = page.read_text(encoding="utf-8")
            html = article_html(page)
            self.assertIn(f"fdh-section {spec['modifier']}", html)
            self.assertIn('class="fdh-hero__eyebrow">Section<', html)
            self.assertEqual(html.count("<h1"), 1, slug)
            self.assertIn(f"<h1>{spec['h1']}</h1>", html)
            self.assertRegex(
                html,
                rf'<h2 class="fdh-label"[^>]*>{re.escape(spec["label"])}</h2>',
            )
            self.assertEqual(html.count(">Start here<"), 1, slug)
            self.assertEqual("fdh-cards--few" in html, spec["few"], slug)
            self.assertEqual("fdh-next" in html, spec["few"], slug)
            if spec["few"]:
                self.assertIn('class="fdh-card__go" aria-hidden="true">Read →<', html)
                self.assertIn('href="../jedox/"', html)
                self.assertIn('href="../snowflake/"', html)
                self.assertIn("Where the numbers come from:", html)
            else:
                self.assertNotIn("fdh-card__go", html)

            pictures = re.findall(r"<picture\b[^>]*>.*?</picture>", html, re.S)
            self.assertEqual(len(pictures), 1, slug)
            block = pictures[0]
            self.assertIn('class="fdh-hero__mascot"', block)
            sources = re.findall(r"<source\b[^>]*>", block)
            image = re.search(r"<img\b[^>]*>", block)
            self.assertEqual(len(sources), 2, slug)
            self.assertIsNotNone(image)
            phone_attrs = attrs(sources[0])
            desk_attrs = attrs(sources[1])
            image_attrs = attrs(image.group(0))
            stem = f"../assets/mascots/section/{spec['mascot']}"
            self.assertEqual(phone_attrs.get("media"), "(max-width: 600px)")
            self.assertEqual(phone_attrs.get("type"), "image/webp")
            self.assertEqual(desk_attrs.get("type"), "image/webp")
            self.assertNotIn("media", desk_attrs)
            self.assertEqual(
                phone_attrs.get("srcset"),
                f"{stem}-phone.webp 1x, {stem}-phone-2x.webp 2x",
            )
            self.assertEqual(
                desk_attrs.get("srcset"),
                f"{stem}.webp 1x, {stem}-2x.webp 2x",
            )
            self.assertEqual(image_attrs.get("src"), f"{stem}.png")
            self.assertEqual(image_attrs.get("alt"), spec["alt"])
            self.assertTrue(image_attrs["alt"].strip())
            self.assertEqual(image_attrs.get("loading"), "eager")
            self.assertEqual(image_attrs.get("fetchpriority"), "high")
            self.assertEqual(image_attrs.get("decoding"), "async")
            self.assertEqual(image_attrs.get("width"), str(spec["size"][0]))
            self.assertEqual(image_attrs.get("height"), str(spec["size"][1]))
            png = local_target(page, image_attrs["src"])
            self.assertIsNotNone(png)
            self.assertTrue(png.is_file(), image_attrs["src"])
            self.assertEqual(png_size(png), spec["size"])
            expected_sizes = {
                f"{stem}-phone.webp": (round(132 * spec["size"][0] / spec["size"][1]), 132),
                f"{stem}-phone-2x.webp": (round(132 * spec["size"][0] / spec["size"][1]) * 2, 264),
                f"{stem}.webp": spec["size"],
                f"{stem}-2x.webp": (spec["size"][0] * 2, spec["size"][1] * 2),
            }
            for href, expected in expected_sizes.items():
                target = local_target(page, href)
                self.assertIsNotNone(target, href)
                self.assertTrue(target.is_file(), href)
                self.assertEqual(webp_size(target), expected, href)
            self.assertEqual(webp_size(local_target(page, f"{stem}.webp")), png_size(png))

            cards = re.findall(r"<article class=\"fdh-card[^\"]*\">.*?</article>", html, re.S)
            self.assertEqual(len(cards), len(spec["cards"]), slug)
            for card, expected in zip(cards, spec["cards"]):
                title, href, tools, summary, meta, start, tool = expected
                self.assertEqual("fdh-card--start" in card, start, title)
                self.assertEqual("fdh-card--tool" in card, tool, title)
                self.assertIn(f'class="fdh-card__tools">{tools}<', card)
                self.assertIn(f'href="{href}"', card)
                self.assertIn(f">{title}</a>", card)
                self.assertIn(summary, html_lib.unescape(card))
                self.assertIn(summary, (ROOT / "card-summaries.md").read_text(encoding="utf-8"))
                self.assertIn(meta, card)
                if meta != "Interactive tool":
                    self.assertIn('aria-hidden="true">◷<', card)
                target = local_target(page, href)
                self.assertIsNotNone(target, href)
                self.assertTrue(target.is_file(), href)
                if title == "Snowflake to Jedox load":
                    load_summaries.append(summary)

            self.assertIn(spec["downloads_heading"], html)
            for href, filename in spec["downloads"]:
                self.assertIn(f'href="{href}"', html)
                self.assertIn(f'download="{filename}"', html)
                self.assertIn(f'data-goatcounter-click="download-{filename}"', html)
                self.assertIn(f'data-goatcounter-title="Download {filename}"', html)
                self.assertIn('data-goatcounter-no-session="1"', html)
                target = local_target(page, href)
                self.assertIsNotNone(target, href)
                self.assertTrue(target.is_file(), f"{slug} {href}")
                self.assertEqual(target.name, filename)
            all_downloads = local_target(page, "../downloads/")
            self.assertIsNotNone(all_downloads)
            self.assertTrue(all_downloads.is_file())
            self.assertIn('href="../downloads/">All downloads →<', html)
            self.assertIn("stylesheets/section.css", full)
            self.assertRegex(
                full,
                r'href="\.\./stylesheets/section\.css\?v=[^"]+" media="print"',
            )
            head, _, body = full.partition("</head>")
            self.assertNotIn("section.css", head)
            extra_css = (SITE / "stylesheets" / "extra.css").read_text(encoding="utf-8")
            self.assertIn(".fdh-section{--tool:#38BDF8;--tool-rgb:56,189,248}", extra_css)
            self.assertNotIn("stylesheets/email-tool.css", full)
            self.assertNotIn("codemirror-bundle.js", full)
            self.assertIn("javascripts/reveal.js", full)
            self.assertRegex(full, r'data-md-type="toc"[^>]*hidden|hidden[^>]*data-md-type="toc"')
            sidebar = full.split('class="md-sidebar md-sidebar--primary"', 1)[1]
            self.assertNotIn(" hidden", sidebar[:80])

        self.assertEqual(load_summaries, [LOAD_SUMMARY, LOAD_SUMMARY])

    def test_phone_rules_hide_the_wide_card_arrow(self):
        css = SECTION_CSS.read_text(encoding="utf-8")
        phone = css.split("@media (max-width:600px)", 1)[1].split("@media", 1)[0]
        self.assertIn(".fdh-cards{grid-template-columns:1fr}", phone)
        self.assertIn(".fdh-cards--few .fdh-card__go{display:none}", phone)
        self.assertIn(".md-typeset .fdh-downloads ul a{width:100%}", phone)
        reduced = css.split("@media (prefers-reduced-motion:reduce)", 1)[1]
        self.assertIn("transition:none", reduced)
        self.assertIn("transform:none", reduced)
