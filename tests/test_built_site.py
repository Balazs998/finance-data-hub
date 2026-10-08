import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"

EXPECTED_EVENTS = {
    "download-gl_actuals_pnl.sql",
    "download-FPNA_MonthCloseChecks.bas",
    "download-mgmt_report_export_sample.csv",
}


class AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
        self.goatcounter = []

    def handle_starttag(self, tag, attrs):
        found = dict(attrs)
        if tag == "a" and "href" in found:
            self.hrefs.append(found["href"])
        if tag == "script" and "data-goatcounter" in found:
            self.goatcounter.append(found["data-goatcounter"])


def parse(path: Path) -> AnchorParser:
    parser = AnchorParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


SITE_PREFIX = "/finance-data-hub"


def local_target(page: Path, href: str) -> Path | None:
    if href.startswith(("#", "mailto:", "javascript:")):
        return None
    parsed = urlparse(href)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path)
    if path.startswith("/"):
        if path.rstrip("/") == SITE_PREFIX:
            return SITE / "index.html"
        if not path.startswith(SITE_PREFIX + "/"):
            return None
        relative = path[len(SITE_PREFIX) + 1 :]
        parts = [part for part in Path(relative).parts if part not in {".", "..", ""}]
        target = SITE.joinpath(*parts) if parts else SITE / "index.html"
    else:
        target = (page.parent / path).resolve()
    if target.is_dir():
        target = target / "index.html"
    return target


class BuiltSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (SITE / "index.html").is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")

    def test_analytics_snippet_uses_the_site_code(self):
        for relative in ("index.html", "downloads/index.html", "about/index.html"):
            html = (SITE / relative).read_text(encoding="utf-8")
            self.assertIn(
                'data-goatcounter="https://financedatahub.goatcounter.com/count"',
                html,
            )
            self.assertIn('src="https://gc.zgo.at/count.js"', html)
            self.assertEqual(html.count("gc.zgo.at/count.js"), 1)

    def test_home_page_fades_sections_only_when_js_runs(self):
        html = (SITE / "index.html").read_text(encoding="utf-8")
        css = (ROOT / "docs/stylesheets/extra.css").read_text(encoding="utf-8")
        self.assertIn('document.documentElement.classList.add("js")', html)
        self.assertGreaterEqual(html.count('class="hero reveal"'), 1)
        self.assertGreaterEqual(html.count('class="reveal"'), 2)
        self.assertIn("javascripts/reveal.js", html)
        self.assertIn(".reveal {\n  opacity: 1;", css)
        self.assertIn("html.js .reveal {\n  opacity: 0;", css)
        self.assertNotIn("\n.reveal {\n  opacity: 0;", css)
        self.assertIn("@media (prefers-reduced-motion: reduce)", css)

    def test_links_and_headings_are_sky_not_violet(self):
        css = (ROOT / "docs/stylesheets/extra.css").read_text(encoding="utf-8")
        html = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn("--dn-link: #38bdf8;", css)
        self.assertIn("--dn-violet: #8b7cf6;", css)
        self.assertIn("--dn-violet-text: #a78bfa;", css)
        self.assertIn("--md-typeset-a-color: var(--dn-link);", css)
        self.assertIn("--md-accent-fg-color: var(--dn-link);", css)
        self.assertIn("color: var(--dn-link);", css)
        self.assertNotIn("color: var(--dn-violet);", css)
        self.assertNotIn("--md-typeset-a-color: var(--dn-violet", css)
        self.assertNotIn("deep-purple", html)
        self.assertIn('data-md-color-accent="light-blue"', html)

    def test_download_events_are_named_per_file_and_the_files_exist(self):
        page = SITE / "downloads" / "index.html"
        html = page.read_text(encoding="utf-8")
        for event in EXPECTED_EVENTS:
            self.assertIn(f'data-goatcounter-click="{event}"', html)
            self.assertIn('data-goatcounter-no-session="1"', html)
        parser = parse(page)
        download_hrefs = [
            href
            for href in parser.hrefs
            if "files/" in href or "releases/download/" in href
        ]
        self.assertGreaterEqual(len(download_hrefs), 3)
        for href in download_hrefs:
            target = local_target(page, href)
            self.assertIsNotNone(target, href)
            self.assertTrue(target.is_file(), f"missing download target {href}")

    def test_internal_links_resolve(self):
        missing = []
        for page in SITE.rglob("*.html"):
            for href in parse(page).hrefs:
                target = local_target(page, href)
                if target is not None and not target.is_file():
                    missing.append(f"{page.relative_to(SITE)} -> {href}")
        self.assertEqual(missing, [])

    def test_sample_sql_is_published_and_is_real(self):
        sql = (SITE / "files" / "sql" / "gl_actuals_pnl.sql").read_text(encoding="utf-8")
        self.assertIn("qualify row_number()", sql)
        self.assertIn("amount_pnl", sql)
        article = (SITE / "snowflake" / "month-end-actuals" / "index.html").read_text(
            encoding="utf-8"
        )
        self.assertIn(">qualify<", article)
        self.assertIn("nullif(trim(l.entity_code), '')", sql)
        self.assertIn("nullif(trim(l.cost_center_code), '')", sql)
        self.assertIn("coalesce(l.entity_code, '(none)') not in ('E900')", sql)
        self.assertIn("download-gl_actuals_pnl.sql", article)
        self.assertIn("DIM_ACCOUNT", article)
        self.assertNotIn("lorem ipsum", article.lower())

    def test_home_page_hides_edit_icon_but_other_pages_keep_it(self):
        home = (SITE / "index.html").read_text(encoding="utf-8")
        about = (SITE / "about" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("md-content__button", home)
        self.assertNotIn("/edit/main/docs/index.md", home)
        self.assertIn("md-content__button", about)
        self.assertIn("/edit/main/docs/about.md", about)

    def test_home_topic_cards_use_three_columns_on_desktop(self):
        home = (SITE / "index.html").read_text(encoding="utf-8")
        css = (ROOT / "docs/stylesheets/extra.css").read_text(encoding="utf-8")
        self.assertIn('class="grid cards topic-cards"', home)
        self.assertIn("@media screen and (min-width: 45em)", css)
        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr));", css)


if __name__ == "__main__":
    unittest.main()
