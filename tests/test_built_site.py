import re
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


def _downloads_linked_from_notes() -> list[tuple[str, list[str]]]:
    """Notes that link a download, in nav order. Independent of the hook."""
    docs = ROOT / "docs"
    fence = re.compile(r"(?ms)^(```+)[^\n]*\n.*?^\1[ \t]*$")
    shortcode = re.compile(r"\[\[download:([^\]|\s]+)")
    nav = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
    notes = []
    for path in docs.rglob("*.md"):
        src = path.relative_to(docs).as_posix()
        if src == "downloads.md":
            continue
        body = fence.sub("", path.read_text(encoding="utf-8"))
        files: list[str] = []
        for match in shortcode.finditer(body):
            relative = match.group(1).strip()
            if relative not in files:
                files.append(relative)
        if files:
            if src not in nav:
                raise AssertionError(f"{src} links a download but is not in the nav")
            notes.append((nav.index(src), src, files))
    notes.sort()
    return [(src, files) for _pos, src, files in notes]


def _note_href(src: str) -> str:
    slug = src[:-3] if src.endswith(".md") else src
    return f"../{slug}/"


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


PLAN_VS_ACTUAL_DOWNLOADS = (
    "samples/fact_budget.csv",
    "samples/fact_actuals.csv",
    "samples/dim_account.csv",
    "samples/dim_cost_center.csv",
    "samples/load_snowflake.sql",
    "sql/plan_vs_actual.sql",
)


class PlanVsActualsPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (SITE / "index.html").is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")

    def test_plan_vs_actuals_page_builds_with_diagram_and_downloads(self):
        page = SITE / "snowflake" / "plan-vs-actuals" / "index.html"
        self.assertTrue(page.is_file(), "plan vs actuals page was not built")
        html = page.read_text(encoding="utf-8")
        self.assertIn("Plan vs. actuals in Snowflake SQL, without losing rows", html)
        self.assertIn('class="diagram-scroll"', html)
        self.assertIn('tabindex="0"', html)
        self.assertIn(
            'aria-label="Join coverage diagram, scroll sideways on small screens"',
            html,
        )
        self.assertIn(
            'alt="What each join keeps on the sample data. INNER JOIN keeps 605 cells with both budget and actual. LEFT JOIN from budget keeps 696, adding 91 budget-only cells. FULL OUTER JOIN keeps all 701, adding the 5 actual-only cells too."',
            html,
        )

        css_hits = [
            path
            for path in SITE.rglob("*.css")
            if ".diagram-scroll" in path.read_text(encoding="utf-8")
        ]
        self.assertTrue(css_hits, ".diagram-scroll is missing from the built CSS")
        source_css = (ROOT / "docs/stylesheets/extra.css").read_text(encoding="utf-8")
        built_css = "\n".join(path.read_text(encoding="utf-8") for path in css_hits)
        self.assertIn(".diagram-scroll", source_css)
        self.assertIn("overflow-x: auto;", source_css)
        self.assertIn("-webkit-overflow-scrolling: touch;", source_css)
        self.assertIn("--diagram-min-width: 600px;", source_css)
        self.assertIn("min-width: var(--diagram-min-width);", source_css)
        self.assertNotIn("min-width: 1000px;", source_css)
        self.assertNotRegex(source_css, r"(?<![-])width: 1200px;")
        desktop_css = source_css.split("@media screen and (min-width: 60em)", 1)[1]
        self.assertIn("overflow: visible;", desktop_css)
        self.assertIn("width: 100%;", desktop_css)
        self.assertIn("min-width: 0;", desktop_css)
        self.assertIn("height: auto;", desktop_css)
        self.assertIn("--diagram-min-width: 600px;", built_css)
        self.assertIn("min-width: 60em", built_css)
        self.assertIn('width="720"', html)
        self.assertIn('height="400"', html)

        srcs = re.findall(r'<img\b[^>]*\bsrc="([^"]*02-join-coverage\.svg)"', html)
        self.assertEqual(len(srcs), 1, html)
        image = local_target(page, srcs[0])
        self.assertIsNotNone(image, srcs[0])
        self.assertTrue(image.is_file(), f"diagram image missing: {srcs[0]}")
        self.assertIn('viewBox="0 0 720 400"', image.read_text(encoding="utf-8"))

        parser = parse(page)
        resolved = []
        for relative in PLAN_VS_ACTUAL_DOWNLOADS:
            matches = [href for href in parser.hrefs if href.endswith(relative)]
            self.assertEqual(len(matches), 1, relative)
            target = local_target(page, matches[0])
            self.assertIsNotNone(target, matches[0])
            self.assertTrue(target.is_file(), f"missing download {relative} ({matches[0]})")
            resolved.append(relative)
        self.assertEqual(len(resolved), 6)

        start = html.find('<div class="downloads">')
        self.assertGreaterEqual(start, 0)
        end = html.find("</div>", start)
        cluster = html[start:end]
        self.assertEqual(cluster.count("md-button download"), 6)
        self.assertIn("grid-template-columns: minmax(0, 1fr);", source_css)
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr));", source_css)
        self.assertIn("gap: 0.75rem;", source_css)
        self.assertIn("margin-top: 1rem;", source_css)
        self.assertIn("border: 1px solid #2a3847;", source_css)
        self.assertIn("border-color: #38bdf8;", source_css)
        self.assertIn("outline: 2px solid #38bdf8;", source_css)
        base_rule, desktop_rule = source_css.split(".md-typeset .downloads {")[1:]
        self.assertIn(
            "grid-template-columns: minmax(0, 1fr);",
            base_rule.split("}", 1)[0],
        )
        self.assertIn("repeat(2, minmax(0, 1fr))", desktop_rule.split("}", 1)[0])
        self.assertLess(
            source_css.find("@media screen and (min-width: 45em)"),
            source_css.find("repeat(2, minmax(0, 1fr))"),
        )

        actuals = (SITE / "files" / "samples" / "fact_actuals.csv").read_text(encoding="utf-8")
        self.assertEqual(len(actuals.splitlines()) - 1, 610)


SNOWFLAKE_TO_JEDOX_DOWNLOADS = (
    "samples/dim_cost_center.csv",
    "samples/dim_account.csv",
    "samples/fact_actuals.csv",
    "samples/fact_budget.csv",
    "samples/load_snowflake.sql",
)

PIPELINE_ALT = (
    "Snowflake to Jedox pipeline: clear the Actual slice first, "
    "then load fresh actuals into the PnL cube"
)


class SnowflakeToJedoxPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (SITE / "index.html").is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")

    def test_snowflake_to_jedox_page_builds_with_diagram_and_downloads(self):
        page = SITE / "jedox" / "snowflake-to-jedox" / "index.html"
        self.assertTrue(page.is_file(), "snowflake to jedox page was not built")
        html = page.read_text(encoding="utf-8")
        self.assertIn(
            "From Snowflake to Jedox: a rerun-safe actuals load with Integrator",
            html,
        )
        self.assertNotIn("headerlink", html)
        self.assertNotIn("DRAFT", html)
        self.assertIn('class="diagram-scroll"', html)
        self.assertIn('tabindex="0"', html)
        self.assertIn(
            'aria-label="Pipeline diagram, scroll sideways on small screens"',
            html,
        )
        self.assertIn('style="--diagram-min-width: 700px"', html)
        self.assertIn(f'alt="{PIPELINE_ALT}"', html)
        self.assertIn('width="840"', html)
        self.assertIn('height="500"', html)

        srcs = re.findall(r'<img\b[^>]*\bsrc="([^"]*01-pipeline-diagram\.svg)"', html)
        self.assertEqual(len(srcs), 1, html)
        self.assertTrue(srcs[0].endswith("../01-pipeline-diagram.svg"), srcs[0])
        image = local_target(page, srcs[0])
        self.assertIsNotNone(image, srcs[0])
        self.assertTrue(image.is_file(), f"diagram image missing: {srcs[0]}")
        svg = image.read_text(encoding="utf-8")
        self.assertIn('viewBox="0 0 840 500"', svg)
        self.assertIn('width="840"', svg)
        self.assertIn('height="500"', svg)

        hrefs = re.findall(r'<a\b[^>]*\bhref="([^"]*01-pipeline-diagram\.svg)"', html)
        self.assertEqual(hrefs, ["../01-pipeline-diagram.svg"])
        linked = local_target(page, hrefs[0])
        self.assertEqual(linked, image)

        parser = parse(page)
        resolved = []
        for relative in SNOWFLAKE_TO_JEDOX_DOWNLOADS:
            matches = [href for href in parser.hrefs if href.endswith(relative)]
            self.assertEqual(len(matches), 1, relative)
            target = local_target(page, matches[0])
            self.assertIsNotNone(target, matches[0])
            self.assertTrue(
                target.is_file(), f"missing download {relative} ({matches[0]})"
            )
            resolved.append(relative)
        self.assertEqual(len(resolved), 5)

        start = html.find('<div class="downloads">')
        self.assertGreaterEqual(start, 0)
        end = html.find("</div>", start)
        cluster = html[start:end]
        self.assertEqual(cluster.count("md-button download"), 5)
        self.assertEqual(cluster.count(' download="'), 5)

        article_link = (
            '<a href="../../snowflake/plan-vs-actuals/">Plan vs. actuals in Snowflake</a>'
        )
        self.assertIn(article_link, html)
        plan = local_target(page, "../../snowflake/plan-vs-actuals/")
        self.assertIsNotNone(plan)
        self.assertTrue(plan.is_file(), "plan vs actuals link does not resolve")
        self.assertEqual(plan, SITE / "snowflake" / "plan-vs-actuals" / "index.html")

        jedox = (SITE / "jedox" / "index.html").read_text(encoding="utf-8")
        snowflake = (SITE / "snowflake" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Snowflake to Jedox load", jedox)
        self.assertIn('href="snowflake-to-jedox/"', jedox)
        self.assertIn("Snowflake to Jedox load", snowflake)
        self.assertIn('href="../jedox/snowflake-to-jedox/"', snowflake)
        for section, href in (
            (SITE / "jedox" / "index.html", "snowflake-to-jedox/"),
            (SITE / "snowflake" / "index.html", "../jedox/snowflake-to-jedox/"),
        ):
            target = local_target(section, href)
            self.assertIsNotNone(target, href)
            self.assertTrue(target.is_file(), href)
        nav = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn("Snowflake to Jedox load", nav)
        self.assertNotIn(
            "From Snowflake to Jedox: a rerun-safe actuals load with Integrator",
            nav,
        )


VALUE_EMAIL_DOWNLOADS = (
    "email/send_value_emails.groovy",
    "email/email-template.html",
    "email/recipients.csv",
    "samples/dim_account.csv",
    "samples/dim_cost_center.csv",
)

PREVIEW_ALT = (
    "Sample email for cost center CC4010 for 2026-03, comparing Budget and "
    "Actual by account, with unfavorable variances highlighted."
)


class ValueEmailsPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (SITE / "index.html").is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")

    def test_value_emails_page_builds_with_preview_and_downloads(self):
        page = SITE / "jedox" / "automated-value-emails" / "index.html"
        self.assertTrue(page.is_file(), "value emails page was not built")
        html = page.read_text(encoding="utf-8")
        self.assertIn(
            "Automated value emails from Jedox Integrator with a generic Groovy template",
            html,
        )
        self.assertNotIn("headerlink", html)
        self.assertNotIn("J-dox signed off", html)
        self.assertNotIn("Build note", html)
        self.assertNotIn("test_builder", html)
        self.assertNotIn("test-output", html)
        self.assertIn(f'alt="{PREVIEW_ALT}"', html)
        source_css_preview = (ROOT / "docs/stylesheets/extra.css").read_text(encoding="utf-8")
        self.assertIn('class="email-preview"', html)
        self.assertIn('width="608"', html)
        self.assertIn('height="638"', html)
        self.assertIn("max-width: 420px;", source_css_preview)
        self.assertIn("width: 100%;", source_css_preview)
        self.assertIn("height: auto;", source_css_preview)
        self.assertIn("margin: 1.2em auto;", source_css_preview)

        srcs = re.findall(r'<img\b[^>]*\bsrc="([^"]*03-email-preview\.png)"', html)
        self.assertEqual(srcs, ["../03-email-preview.png"])
        image = local_target(page, srcs[0])
        self.assertIsNotNone(image, srcs[0])
        self.assertTrue(image.is_file(), f"preview image missing: {srcs[0]}")
        png = image.read_bytes()
        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertEqual(int.from_bytes(png[16:20], "big"), 608)
        self.assertEqual(int.from_bytes(png[20:24], "big"), 638)

        parser = parse(page)
        preview_links = [href for href in parser.hrefs if href.endswith("03-email-preview.png")]
        self.assertEqual(preview_links, ["../03-email-preview.png"])
        preview = local_target(page, preview_links[0])
        self.assertIsNotNone(preview)
        self.assertTrue(preview.is_file())

        resolved = []
        for relative in VALUE_EMAIL_DOWNLOADS:
            matches = [href for href in parser.hrefs if href.endswith(relative)]
            self.assertEqual(len(matches), 1, relative)
            target = local_target(page, matches[0])
            self.assertIsNotNone(target, matches[0])
            self.assertTrue(target.is_file(), f"missing download {relative} ({matches[0]})")
            resolved.append(relative)
        self.assertEqual(resolved, list(VALUE_EMAIL_DOWNLOADS))

        groovy = (SITE / "files" / "email" / "send_value_emails.groovy").read_text(encoding="utf-8")
        self.assertIn("PART 1", groovy)
        self.assertNotIn("${", groovy)
        recipients = (SITE / "files" / "email" / "recipients.csv").read_text(encoding="utf-8")
        self.assertEqual(len([line for line in recipients.splitlines() if line.strip()]) - 1, 10)
        self.assertIn("owner.cc4010@example.com", recipients)
        template = (SITE / "files" / "email" / "email-template.html").read_text(encoding="utf-8")
        for marker in (
            "{{SUBJECT}}",
            "{{HEADER_LABEL}}",
            "{{TITLE}}",
            "{{PERIOD}}",
            "{{VERSION}}",
            "{{GREETING}}",
            "{{INTRO}}",
            "{{HEADER_CELLS}}",
            "{{TABLE_ROWS}}",
            "{{TOTAL_CELLS}}",
            "{{NOTE}}",
            "{{FOOTER}}",
        ):
            self.assertIn(marker, template)

        published = [path.relative_to(SITE).as_posix() for path in SITE.rglob("*")]
        self.assertFalse(any(name == "test_builder.groovy" for name in (Path(p).name for p in published)))
        self.assertFalse(any("test-output" in path for path in published))

        home = (SITE / "index.html").read_text(encoding="utf-8")
        section = (SITE / "jedox" / "index.html").read_text(encoding="utf-8")
        self.assertIn("automated-value-emails", home)
        self.assertIn("automated-value-emails", section)
        for href in parse(SITE / "index.html").hrefs:
            if "automated-value-emails" in href:
                target = local_target(SITE / "index.html", href)
                self.assertIsNotNone(target, href)
                self.assertTrue(target.is_file(), href)
                break
        else:
            self.fail("home page does not link to the value emails article")


SOCIAL_BASE = "https://balazs998.github.io/finance-data-hub/assets/social/"
SOCIAL_PAGES = {
    "index.html": "home.png",
    "snowflake/plan-vs-actuals/index.html": "plan-vs-actuals.png",
    "jedox/snowflake-to-jedox/index.html": "snowflake-to-jedox.png",
    "jedox/automated-value-emails/index.html": "automated-value-emails.png",
    "about/index.html": "home.png",
    "snowflake/month-end-actuals/index.html": "home.png",
}
SOCIAL_FILES = (
    "home.png",
    "plan-vs-actuals.png",
    "automated-value-emails.png",
    "snowflake-to-jedox.png",
)


def meta_contents(html: str, attr: str, key: str) -> list[str]:
    found = []
    for match in re.finditer(r"<meta\b[^>]*>", html):
        tag = match.group(0)
        if f'{attr}="{key}"' not in tag:
            continue
        content = re.search(r'\bcontent="([^"]*)"', tag)
        found.append(content.group(1) if content else "")
    return found


class SocialPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (SITE / "index.html").is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")

    def test_og_and_twitter_images_are_absolute(self):
        for relative, image in SOCIAL_PAGES.items():
            html = (SITE / relative).read_text(encoding="utf-8")
            url = SOCIAL_BASE + image
            self.assertEqual(meta_contents(html, "property", "og:image"), [url], relative)
            self.assertEqual(meta_contents(html, "name", "twitter:image"), [url], relative)
            self.assertEqual(
                meta_contents(html, "name", "twitter:card"),
                ["summary_large_image"],
                relative,
            )
            titles = meta_contents(html, "property", "og:title")
            descriptions = meta_contents(html, "property", "og:description")
            self.assertEqual(len(titles), 1, relative)
            self.assertTrue(titles[0].strip(), relative)
            self.assertEqual(len(descriptions), 1, relative)
            self.assertTrue(descriptions[0].strip(), relative)
            self.assertEqual(meta_contents(html, "name", "twitter:title"), titles, relative)
            self.assertEqual(
                meta_contents(html, "name", "twitter:description"),
                descriptions,
                relative,
            )

        home = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertEqual(
            meta_contents(home, "property", "og:title"),
            ["Finance Data Hub"],
        )
        self.assertIn(
            "Practical notes on Snowflake, Jedox, and Excel VBA",
            meta_contents(home, "property", "og:description")[0],
        )
        article = (SITE / "snowflake" / "plan-vs-actuals" / "index.html").read_text(
            encoding="utf-8"
        )
        self.assertEqual(
            meta_contents(article, "property", "og:title"),
            [
                "Plan vs. actuals in Snowflake SQL, without losing rows - Finance Data Hub"
            ],
        )
        self.assertIn("FULL OUTER JOIN", meta_contents(article, "property", "og:description")[0])
        email = (SITE / "jedox" / "automated-value-emails" / "index.html").read_text(
            encoding="utf-8"
        )
        self.assertEqual(
            meta_contents(email, "property", "og:title"),
            [
                "Automated value emails from Jedox Integrator with a generic Groovy template"
                " - Finance Data Hub"
            ],
        )

        load = (SITE / "jedox" / "snowflake-to-jedox" / "index.html").read_text(
            encoding="utf-8"
        )
        self.assertEqual(
            meta_contents(load, "property", "og:title"),
            [
                "From Snowflake to Jedox: a rerun-safe actuals load with Integrator"
                " - Finance Data Hub"
            ],
        )
        self.assertIn(
            "key-pair service user",
            meta_contents(load, "property", "og:description")[0],
        )

        for name in SOCIAL_FILES:
            path = SITE / "assets" / "social" / name
            self.assertTrue(path.is_file(), name)
            png = path.read_bytes()
            self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"), name)
            self.assertEqual(int.from_bytes(png[16:20], "big"), 1200, name)
            self.assertEqual(int.from_bytes(png[20:24], "big"), 630, name)


class DownloadAttributeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (SITE / "index.html").is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")

    def test_every_download_shortcode_link_has_a_download_attribute(self):
        found_template = False
        checked = 0
        for page in SITE.rglob("*.html"):
            parser = _DownloadLinkParser()
            parser.feed(page.read_text(encoding="utf-8"))
            for attrs in parser.links:
                href = attrs.get("href", "")
                if "files/" not in href and "releases/download/" not in href:
                    continue
                filename = href.rstrip("/").rsplit("/", 1)[-1]
                self.assertIn("download", attrs, f"{page} {href}")
                self.assertEqual(attrs["download"], filename, href)
                checked += 1
                if filename == "email-template.html":
                    found_template = True
                    self.assertEqual(attrs["download"], "email-template.html")
        self.assertGreaterEqual(checked, 8)
        self.assertTrue(found_template, "email-template.html download link was not built")


class _DownloadLinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        found = dict(attrs)
        classes = found.get("class", "").split()
        if "download" in classes:
            self.links.append(found)


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
        self.assertIn('class="hero"', html)
        self.assertNotIn("hero reveal", html)
        self.assertGreaterEqual(html.count('class="reveal"'), 3)
        self.assertIn("javascripts/reveal.js", html)
        self.assertIn(".reveal {\n  opacity: 1;", css)
        self.assertIn("html.js .reveal.reveal-wait {\n  opacity: 0;", css)
        self.assertNotIn("\n.reveal {\n  opacity: 0;", css)
        self.assertNotIn("html.js .reveal {\n  opacity: 0;", css)
        reveal_js = (ROOT / "docs/javascripts/reveal.js").read_text(encoding="utf-8")
        self.assertIn("IntersectionObserver", reveal_js)
        self.assertIn("getBoundingClientRect", reveal_js)
        self.assertIn("reveal-wait", reveal_js)
        self.assertIn("pageFitsViewport", reveal_js)
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

    def test_downloads_page_lists_every_file(self):
        page = SITE / "downloads" / "index.html"
        html = page.read_text(encoding="utf-8")
        start = html.find('<article class="md-content__inner')
        self.assertGreaterEqual(start, 0)
        end = html.find("</article>", start)
        article = html[start:end]
        self.assertNotIn("[[file-index]]", article)

        disk = sorted(
            path.relative_to(ROOT / "docs" / "files").as_posix()
            for path in (ROOT / "docs" / "files").rglob("*")
            if path.is_file()
        )
        self.assertGreaterEqual(len(disk), 12)
        for relative in disk:
            self.assertIn(f"files/{relative}", article, relative)

        notes = _downloads_linked_from_notes()
        self.assertEqual(sorted({rel for _src, files in notes for rel in files}), disk)

        # Each file has exactly one button on the page.
        buttons = re.findall(r'<a class="md-button download" href="\.\./files/([^"]+)"', article)
        self.assertEqual(sorted(buttons), disk)
        self.assertEqual(article.count("md-button download"), len(disk))

        # Shared sample files sit in one "Sample data" group at the top.
        sample_heading = article.find(">Sample data<")
        self.assertGreaterEqual(sample_heading, 0)
        sample_files = [rel for rel in disk if rel.startswith("samples/")]
        self.assertEqual(len(sample_files), 5)
        first_note_heading = article.find("<h2", sample_heading + 1)
        sample_section = article[sample_heading:first_note_heading]
        for relative in sample_files:
            self.assertIn(f"files/{relative}", sample_section, relative)

        # Every other file sits in the group of the note that links it.
        rest = article[first_note_heading:]
        for src, files in notes:
            own = [rel for rel in files if rel not in sample_files]
            if not own:
                continue
            href = f'href="{_note_href(src)}"'
            pos = rest.find(href)
            self.assertGreaterEqual(pos, 0, src)
            next_heading = rest.find("<h2", pos)
            section = rest[pos : next_heading if next_heading >= 0 else len(rest)]
            for relative in own:
                self.assertIn(f"files/{relative}", section, f"{relative} is missing from the {src} group")

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

    def test_home_hides_the_sidebar_and_other_pages_keep_tabs(self):
        home = (SITE / "index.html").read_text(encoding="utf-8")
        about = (SITE / "about" / "index.html").read_text(encoding="utf-8")
        plan = (SITE / "snowflake" / "plan-vs-actuals" / "index.html").read_text(encoding="utf-8")
        self.assertIn('data-md-type="navigation" hidden', home)
        self.assertIn('data-md-type="toc" hidden', home)
        self.assertIn('class="md-tabs"', home)
        tabs = home.split('class="md-tabs"', 1)[1].split("</nav>", 1)[0]
        for label in ("Snowflake", "Jedox", "VBA", "Downloads"):
            self.assertIn(label, tabs)
        self.assertIn("md-search", home)
        for page in (about, plan):
            self.assertIn("md-sidebar--primary", page)
            self.assertIn('class="md-tabs"', page)
            self.assertIn("md-search", page)
        versioned = re.compile(
            r'(?:href|src)="(?:\.\./)*(?:stylesheets/(?:extra|email-tool)\.css|javascripts/reveal\.js)\?v=[0-9a-f]+"'
        )
        self.assertGreaterEqual(len(versioned.findall(home)), 3)
        self.assertGreaterEqual(len(versioned.findall(plan)), 3)
        self.assertNotIn("gc.zgo.at/count.js?v=", home)

    def test_no_repo_box_or_edit_button_and_release_links_stay(self):
        pages = [
            SITE / "index.html",
            SITE / "snowflake" / "plan-vs-actuals" / "index.html",
            SITE / "jedox" / "email-checker" / "index.html",
        ]
        for page in pages:
            html = page.read_text(encoding="utf-8")
            self.assertNotIn("md-header__source", html, page.name)
            self.assertNotIn("md-content__button", html, page.name)
            self.assertNotIn("/edit/main/docs/", html, page.name)
            self.assertNotIn("md-social", html, page.name)
            self.assertNotIn("fontawesome/brands/github", html, page.name)
        config = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
        self.assertNotIn("repo_url:", config)
        self.assertNotIn("repo_name:", config)
        self.assertNotIn("edit_uri:", config)
        self.assertNotIn("content.action.edit", config)
        self.assertNotIn("content.action.view", config)
        # Release URLs are built from the repo constant in hooks/site.py.
        hook = (ROOT / "hooks" / "site.py").read_text(encoding="utf-8")
        self.assertIn('REPO = "Balazs998/finance-data-hub"', hook)
        self.assertNotIn("repo_url", hook)
        checker = pages[2].read_text(encoding="utf-8")
        self.assertIn("email-checker", checker.lower())
        downloads = (SITE / "downloads" / "index.html").read_text(encoding="utf-8")
        self.assertIn('class="md-button download"', downloads)
        self.assertIn("files/", downloads)

    def test_home_sections_use_three_columns_on_desktop(self):
        home = (SITE / "index.html").read_text(encoding="utf-8")
        css = (ROOT / "docs/stylesheets/extra.css").read_text(encoding="utf-8")
        self.assertIn('class="home-path"', home)
        self.assertIn('class="home-who"', home)
        self.assertNotIn("topic-cards", home)
        self.assertIn("@media screen and (min-width: 45em)", css)
        self.assertIn("grid-template-columns: repeat(3, minmax(0, 1fr));", css)

    def test_relational_extracts_page_and_left_nav(self):
        page = SITE / "jedox" / "relational-extracts" / "index.html"
        self.assertTrue(page.is_file(), "relational extracts page was not built")
        html = page.read_text(encoding="utf-8")
        self.assertIn("Relational extract: table setup or your own SQL?", html)
        self.assertNotIn("DRAFT", html)
        self.assertIn('class="diagram-scroll"', html)
        self.assertIn('class="diagram-frame"', html)
        self.assertIn("Swipe to see the full diagram →", html)
        self.assertIn("RelationalTable", html)
        self.assertIn("content.tabs.link", (ROOT / "mkdocs.yml").read_text(encoding="utf-8"))
        self.assertIn('href="../snowflake-to-jedox/"', html)
        target = local_target(page, "../snowflake-to-jedox/")
        self.assertIsNotNone(target)
        self.assertTrue(target.is_file())
        diagram = local_target(page, "../relational-extract-diagram.svg")
        self.assertIsNotNone(diagram)
        self.assertTrue(diagram.is_file())
        for relative in (
            "relational/relational_extract_actuals.sql",
            "relational/v_jedox_actuals_by_group.sql",
            "relational/query_history_lookup.sql",
        ):
            self.assertIn(f"files/{relative}", html)
            sql = (ROOT / "docs" / "files" / relative).read_text(encoding="utf-8")
            for line in sql.splitlines():
                self.assertNotIn("  ", line.strip(), relative)
        downloads = (SITE / "downloads" / "index.html").read_text(encoding="utf-8")
        self.assertIn("relational/relational_extract_actuals.sql", downloads)
        self.assertIn("Relational extracts", downloads)

        labels = (
            "Management report export",
            "Snowflake to Jedox load",
            "Relational extracts",
            "Automated value emails",
            "Create your own email",
        )
        pages = [path for path in SITE.rglob("index.html") if path != SITE / "index.html"]
        self.assertGreaterEqual(len(pages), 10)
        for built in pages:
            text = built.read_text(encoding="utf-8")
            sidebar = text.split('class="md-sidebar md-sidebar--primary"', 1)[1]
            sidebar = sidebar.split('class="md-sidebar md-sidebar--secondary"', 1)[0]
            self.assertNotIn(" hidden", sidebar[:80], built.relative_to(SITE))
            positions = [sidebar.find(label) for label in labels]
            self.assertTrue(all(pos >= 0 for pos in positions), built.relative_to(SITE))
            self.assertEqual(positions, sorted(positions), built.relative_to(SITE))
        active = html.split('class="md-sidebar md-sidebar--primary"', 1)[1]
        active = active.split('class="md-sidebar md-sidebar--secondary"', 1)[0]
        self.assertIn("Relational extracts", active)
        self.assertIn("md-nav__link--active", active)

    def test_heading_permalinks_are_absent_but_ids_remain(self):
        home = (SITE / "index.html").read_text(encoding="utf-8")
        article = (SITE / "snowflake" / "month-end-actuals" / "index.html").read_text(
            encoding="utf-8"
        )
        for html in (home, article):
            self.assertNotIn("headerlink", html)
        self.assertIn('<h1 id="build-the-fpa-pack-without-the-manual-work">', home)
        self.assertIn('<h2 id="follow-the-data-step-by-step">', home)
        self.assertIn('id="latest-posts"', home)
        self.assertIn('id="why-it-matters"', home)
        self.assertNotIn('id="where-to-start"', home)
        self.assertIn('<h1 id="month-end-actuals">', article)
        self.assertIn('href="#grain"', article)


if __name__ == "__main__":
    unittest.main()
