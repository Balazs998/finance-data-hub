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
                "Email builder and checker",
                "email-builder/",
                "Jedox · Groovy",
                "Fill in the email job from the browser, then check it for the usual traps.",
                "Interactive tool",
                False,
                True,
            ),
            (
                "Business Rule Studio",
                "rule-studio/",
                "Jedox",
                "The demo cubes are the fictional FDH_DEMO model.",
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
        ),
        "downloads": (
            ("../files/vba/FPNA_MonthCloseChecks.bas", "FPNA_MonthCloseChecks.bas"),
            ("../files/email/SendOrSave.bas", "SendOrSave.bas"),
            ("../files/vba/ScanVBScript.bas", "ScanVBScript.bas"),
            ("../files/vba/modChecks.bas", "modChecks.bas"),
            ("../files/vba/modValidate.bas", "modValidate.bas"),
            ("../files/vba/modCleanup.bas", "modCleanup.bas"),
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
                self.assertIn("More VBA modules are on the way.", html)
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
