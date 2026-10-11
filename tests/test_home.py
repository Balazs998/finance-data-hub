import re
import unittest
from pathlib import Path

from test_built_site import ROOT, SITE, local_target

MASCOTS = ROOT / "docs" / "assets" / "mascots"
CSS = ROOT / "docs" / "stylesheets" / "extra.css"

EXPECTED_FILES = (
    "jedox/head-laptop.png",
    "jedox/head-laptop.webp",
    "jedox/head-presenting.png",
    "jedox/head-presenting.webp",
    "jedox/head-thumbsup.png",
    "jedox/head-thumbsup.webp",
    "snowflake/head.png",
    "snowflake/head.webp",
    "trio-full.png",
    "trio-full.webp",
    "trio-group-246.webp",
    "trio-group-494.png",
    "trio-group-494.webp",
    "trio-group-680.webp",
    "trio-group-988.webp",
)

HERO_ALTS = (
    "Three mascots standing together: Snowflake in a blue hoodie, Jedox in a purple blazer with his arms around the others, and VBA in a green cardigan, waving",
)

HOME_LINKS = {
    "snowflake/plan-vs-actuals/": "Start with Plan vs actuals",
    "downloads/": "Browse downloads",
    "jedox/snowflake-to-jedox/": "Snowflake to Jedox load",
    "jedox/automated-value-emails/": "Automated value emails",
    "jedox/email-builder/": "Create your own email",
}


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[12:16] != b"IHDR":
        raise AssertionError(f"{path} is not a PNG")
    return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")


def webp_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[0:4] != b"RIFF" or data[8:12] != b"WEBP" or data[12:16] != b"VP8X":
        raise AssertionError(f"{path} is not a VP8X WebP")
    if not data[20] & 0x10:
        raise AssertionError(f"{path} has no alpha channel")
    width = 1 + int.from_bytes(data[24:27], "little")
    height = 1 + int.from_bytes(data[27:30], "little")
    return width, height


def media_blocks(css: str, snippet: str) -> list[str]:
    blocks = []
    start = 0
    while True:
        found = css.find(snippet, start)
        if found < 0:
            break
        brace = css.find("{", found)
        depth = 0
        for index in range(brace, len(css)):
            if css[index] == "{":
                depth += 1
            elif css[index] == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(css[brace + 1 : index])
                    start = index + 1
                    break
        else:
            break
    return blocks


class HomePageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = SITE / "index.html"
        if not cls.page.is_file():
            raise AssertionError("site/index.html is missing. Run mkdocs build first.")
        cls.html = cls.page.read_text(encoding="utf-8")
        cls.css = CSS.read_text(encoding="utf-8")

    def test_hero_copy_and_actions(self):
        self.assertIn("FINANCE DATA HUB", self.html)
        self.assertIn(
            '<h1 id="build-the-fpa-pack-without-the-manual-work">',
            self.html,
        )
        self.assertIn("Build the FP&amp;A pack", self.html)
        self.assertIn(
            '<span class="home-accent">without the manual work</span>',
            self.html,
        )
        self.assertIn(
            "Tested Snowflake SQL, Jedox Integrator jobs and Excel VBA, "
            "each with sample data you can download and run.",
            self.html,
        )
        self.assertEqual(self.html.count('class="home-bar"'), 1)
        self.assertEqual(self.html.count("<span></span>"), 3)
        self.assertIn(
            'class="md-button home-btn home-btn--primary" href="snowflake/plan-vs-actuals/"',
            self.html,
        )
        self.assertIn(">Start with Plan vs actuals →<", self.html)
        self.assertIn(
            'class="md-button home-btn home-btn--secondary" href="downloads/"',
            self.html,
        )
        self.assertIn(">Browse downloads<", self.html)

    def test_audiences_path_posts_and_joins(self):
        for text in (
            "FP&amp;A analysts",
            "Stop rebuilding the pack by hand.",
            "Controllers",
            "Trust that no row went missing.",
            "Data people",
            "Copy tested SQL, Groovy and VBA.",
            "Follow the data, step by step",
            "Join budget and actuals without losing a row.",
            "Clear the slice, then load fresh actuals into the cube.",
            "One Integrator job sends every owner their numbers.",
            "Latest posts",
            "Jedox · Groovy",
            "Jedox · Integrator",
            "Jedox · Builder",
            "Snowflake · SQL",
            "Why it matters",
            "Same sample data, three joins:",
            ">605<",
            ">696<",
            ">701<",
            "inner join",
            "left join",
            "full join",
            "✓ no rows lost",
            "Rows kept by each join. Only the full join keeps all&nbsp;701.",
            "Oct 9, 2026",
        ):
            self.assertIn(text, self.html)
        self.assertNotIn('class="home-new"', self.html)
        self.assertEqual(self.html.count('class="home-date"'), 4)
        self.assertEqual(self.html.count(">Oct 9, 2026<"), 4)
        self.assertEqual(self.html.count('class="home-step"'), 3)
        self.assertIn(
            'class="home-card home-why" href="snowflake/plan-vs-actuals/"',
            self.html,
        )
        latest = self.html.split('id="latest-posts"', 1)[1].split('id="why-it-matters"', 1)[0]
        plan_post = latest.split('href="snowflake/plan-vs-actuals/"', 1)[1].split("</li>", 1)[0]
        self.assertIn('class="home-date"', plan_post)
        jedox_srcs = re.findall(
            r'href="jedox/[^"]+"[\s\S]*?src="(assets/mascots/jedox/[^"]+)"',
            latest,
        )
        self.assertEqual(len(jedox_srcs), 3)
        self.assertEqual(len(set(jedox_srcs)), 3)

    def test_newsletter_box_is_absent(self):
        for banned in (
            "Notify me",
            "you@example.com",
            "New post every two weeks",
            "newsletter",
            'type="email"',
        ):
            self.assertNotIn(banned, self.html)
            self.assertNotIn(banned, (ROOT / "docs" / "index.md").read_text(encoding="utf-8"))

    def test_home_links_resolve(self):
        for href, label in HOME_LINKS.items():
            self.assertIn(f'href="{href}"', self.html, href)
            self.assertIn(label, self.html)
            target = local_target(self.page, href)
            self.assertIsNotNone(target, href)
            self.assertTrue(target.is_file(), href)

    def test_mascots_are_the_used_poses_with_dimensions_and_alt(self):
        found = sorted(
            path.relative_to(MASCOTS).as_posix()
            for path in MASCOTS.rglob("*")
            if path.is_file()
        )
        self.assertEqual(found, list(EXPECTED_FILES))
        for relative in EXPECTED_FILES:
            if relative.endswith(".png"):
                png_size(MASCOTS / relative)
                webp = (MASCOTS / relative).with_suffix(".webp")
                self.assertEqual(png_size(MASCOTS / relative), webp_size(webp), relative)

        pictures = re.findall(r"<picture>\s*(.*?)</picture>", self.html, re.S)
        self.assertGreaterEqual(len(pictures), 5)
        hero = self.html.split('class="hero"', 1)[1].split('class="reveal"', 1)[0]
        self.assertIn("assets/mascots/trio-group-246.webp 246w", hero)
        self.assertIn("assets/mascots/trio-group-494.webp 494w", hero)
        self.assertIn("assets/mascots/trio-group-680.webp 680w", hero)
        self.assertIn("assets/mascots/trio-group-988.webp 988w", hero)
        self.assertIn('fetchpriority="high"', hero)
        self.assertIn('src="assets/mascots/trio-group-494.png"', hero)
        self.assertIn('width="494"', hero)
        self.assertIn('height="573"', hero)
        self.assertEqual(png_size(MASCOTS / "trio-group-494.png"), (494, 573))
        self.assertEqual(webp_size(MASCOTS / "trio-group-246.webp"), (246, 285))
        self.assertEqual(webp_size(MASCOTS / "trio-group-680.webp"), (680, 789))
        self.assertEqual(webp_size(MASCOTS / "trio-group-988.webp"), (988, 1146))
        self.assertNotIn("trio-full", hero)
        self.assertNotIn("pointing.", hero)
        self.assertNotIn("thumbsup.", hero)
        for alt in HERO_ALTS:
            self.assertIn(f'alt="{alt}"', hero)
        self.assertNotIn('loading="lazy"', hero)
        avatars = re.findall(r"<img\b[^>]*class=\"home-avatar\"[^>]*>", self.html)
        self.assertEqual(len(avatars), 4)
        for tag in avatars:
            self.assertIn('alt=""', tag)
            self.assertIn('loading="lazy"', tag)
            self.assertIn('width="176"', tag)
            self.assertIn('height="176"', tag)
        for block in pictures:
            source = re.search(
                r'<source\b[^>]*\bsrcset="([^"]+)"[^>]*\btype="image/webp"',
                block,
            )
            image = re.search(r"<img\b[^>]*>", block)
            self.assertIsNotNone(source, block)
            self.assertIsNotNone(image, block)
            first_webp = source.group(1).split(",")[0].strip().split()[0]
            self.assertTrue(first_webp.endswith(".webp"), block)
            attrs = dict(re.findall(r'([:\w-]+)="([^"]*)"', image.group(0)))
            src = attrs.get("src", "")
            self.assertTrue(src.endswith(".png"), block)
            self.assertIn("width", attrs)
            self.assertIn("height", attrs)
            self.assertIn("alt", attrs)
            if "home-avatar" in attrs.get("class", ""):
                self.assertEqual(attrs["alt"], "")
                self.assertEqual(attrs.get("loading"), "lazy")
            else:
                self.assertTrue(attrs["alt"].strip())
                self.assertNotIn("loading", attrs)
            png = local_target(self.page, src)
            webp = local_target(self.page, first_webp)
            self.assertIsNotNone(png)
            self.assertIsNotNone(webp)
            self.assertTrue(png.is_file(), src)
            self.assertTrue(webp.is_file(), first_webp)
            self.assertEqual(png_size(png), (int(attrs["width"]), int(attrs["height"])), src)

    def test_phone_layout_and_reduced_motion(self):
        phone = media_blocks(self.css, "max-width: 760px")
        self.assertTrue(phone)
        block = phone[0]
        self.assertIn("order: -1;", block)
        self.assertIn("flex-direction: column;", block)
        self.assertIn("width: 100%;", block)
        self.assertIn("gap: 12px;", self.css)
        self.assertIn("flex-wrap: nowrap;", self.css)
        self.assertIn("max-width: 1200px;", self.css)
        self.assertIn("grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);", self.css)
        self.assertNotIn("max-width: 90rem;", self.css)
        self.assertIn("overflow-x: auto;", block)
        self.assertIn("-webkit-overflow-scrolling: touch;", block)
        self.assertIn("min-width: 240px;", block)
        self.assertIn("grid-template-columns: 1fr;", block)

        reduced = media_blocks(self.css, "prefers-reduced-motion: reduce")
        self.assertEqual(len(reduced), 1)
        self.assertIn("transition: none;", reduced[0])
        self.assertNotIn("@keyframes home-wave", self.css)
        self.assertIn("rgba(56, 189, 248, .35)", self.css)
        self.assertIn("rgba(139, 124, 246, .35)", self.css)
        self.assertIn("rgba(163, 230, 53, .28)", self.css)
        self.assertIn("circle at 22% 55%", self.css)
        self.assertIn("circle at 52% 50%", self.css)
        self.assertIn("circle at 82% 55%", self.css)
        self.assertNotIn("mix-blend-mode:", self.css)
        group = (MASCOTS / "trio-group-494.png").read_bytes()
        self.assertEqual(group[25], 6, "trio-group-494.png needs a real alpha channel")
        self.assertIn("max-width: 76.234375em", self.css)
        phone_tabs = media_blocks(self.css, "max-width: 76.234375em")
        self.assertTrue(any("display: none;" in item and ".md-tabs" in item for item in phone_tabs))
        self.assertNotIn("color: #8b7cf6", self.css.lower())
        self.assertNotIn("color: var(--chart-2)", self.css)
        self.assertNotIn("color: var(--dn-violet)", self.css)

    def test_self_hosted_fonts_logo_and_robots(self):
        self.assertNotIn("fonts.googleapis.com", self.html)
        self.assertNotIn("fonts.gstatic.com", self.html)
        self.assertNotIn('as="font"', self.html)
        self.assertIn('href="stylesheets/font-rest.css', self.html)
        self.assertIn('media="print"', self.html)
        self.assertIn("requestAnimationFrame", self.html)
        self.assertNotIn("code-font.css", self.html)
        self.assertIn('alt="Finance Data Hub home"', self.html)
        self.assertIn('width="48"', self.html)
        self.assertIn('height="48"', self.html)
        self.assertNotIn("fonts.googleapis.com", (ROOT / "overrides" / "main.html").read_text(encoding="utf-8"))
        checker = (SITE / "jedox" / "email-checker" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("fonts.googleapis.com", checker)
        self.assertNotIn('as="font"', checker)
        self.assertIn('href="../../stylesheets/font-rest.css', checker)
        self.assertIn('id="email-how" open', checker)
        for name in (
            "inter-latin-400-normal.woff2",
            "inter-latin-500-normal.woff2",
            "inter-latin-600-normal.woff2",
            "inter-latin-700-normal.woff2",
            "space-grotesk-latin-500-normal.woff2",
            "space-grotesk-latin-600-normal.woff2",
            "space-grotesk-latin-700-normal.woff2",
            "jetbrains-mono-latin-400-normal.woff2",
            "jetbrains-mono-latin-400-italic.woff2",
            "jetbrains-mono-latin-500-normal.woff2",
            "jetbrains-mono-latin-700-normal.woff2",
        ):
            font = SITE / "fonts" / name
            self.assertTrue(font.is_file(), name)
            self.assertEqual(font.read_bytes()[:4], b"wOF2", name)
        for licence in ("OFL-Inter.txt", "OFL-SpaceGrotesk.txt", "OFL-JetBrainsMono.txt"):
            text = (SITE / "fonts" / licence).read_text(encoding="utf-8")
            self.assertIn("SIL Open Font License", text)
        self.assertIn("size-adjust:", self.css)
        self.assertIn("ascent-override:", self.css)
        self.assertIn('font-family: "Inter Fallback"', self.css)
        self.assertIn('font-family: "Space Grotesk Fallback"', self.css)
        self.assertIn('font-family: "JetBrains Mono Fallback"', self.css)
        self.assertNotIn("jetbrains-mono-latin", self.css)
        self.assertNotIn(".woff2", self.css)
        font_rest = (ROOT / "docs" / "stylesheets" / "font-rest.css").read_text(encoding="utf-8")
        for name in (
            "inter-latin-400-normal.woff2",
            "inter-latin-700-normal.woff2",
            "space-grotesk-latin-600-normal.woff2",
            "space-grotesk-latin-700-normal.woff2",
            "jetbrains-mono-latin-400-normal.woff2",
            "jetbrains-mono-latin-400-italic.woff2",
            "jetbrains-mono-latin-500-normal.woff2",
            "jetbrains-mono-latin-700-normal.woff2",
        ):
            self.assertIn(name, font_rest)
        self.assertTrue((SITE / "stylesheets" / "font-rest.css").is_file())
        self.assertFalse((SITE / "stylesheets" / "code-font.css").exists())
        reveal = (ROOT / "docs" / "javascripts" / "reveal.js").read_text(encoding="utf-8")
        self.assertNotIn("code-font", reveal)
        self.assertNotIn("loadCodeFont", reveal)
        main = (ROOT / "overrides" / "main.html").read_text(encoding="utf-8")
        self.assertNotIn("as=\"font\"", main)
        self.assertIn("font-rest.css", main)
        self.assertIn('media="print"', main)
        self.assertIn("requestAnimationFrame", main)
        self.assertNotIn("code-font.css", main)
        robots = (SITE / "robots.txt").read_text(encoding="utf-8")
        self.assertIn("User-agent: *", robots)
        self.assertIn("Allow: /", robots)
        self.assertIn(
            "Sitemap: https://balazs998.github.io/finance-data-hub/sitemap.xml",
            robots,
        )


if __name__ == "__main__":
    unittest.main()
