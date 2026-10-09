import re
import unittest
from pathlib import Path

CSS = Path(__file__).resolve().parents[1] / "docs" / "stylesheets" / "extra.css"

# Text color on every background it is painted on. Normal text needs 4.5:1.
PAIRS = (
    ("text", "bg"),
    ("text", "surface"),
    ("text", "surface-2"),
    ("text", "code"),
    ("text", "hover"),
    ("text", "hero-glow"),
    ("text", "mark"),
    ("muted", "bg"),
    ("muted", "surface"),
    ("muted", "surface-2"),
    ("muted", "code"),
    ("muted", "hover"),
    ("muted", "hero-glow"),
    ("muted", "mark"),
    ("faint", "bg"),
    ("faint", "surface"),
    ("faint", "surface-2"),
    ("faint", "code"),
    ("faint", "hero-glow"),
    ("link", "bg"),
    ("link", "surface"),
    ("link", "surface-2"),
    ("link", "code"),
    ("link", "hover"),
    ("link", "hero-glow"),
    ("link", "mark"),
    ("violet-text", "code"),
    ("lime", "code"),
    ("negative", "code"),
)


def channel(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    red, green, blue = (int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)


def contrast(foreground: str, background: str) -> float:
    lighter, darker = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def blend(background: str, foreground: str, alpha: float) -> str:
    mixed = []
    for index in (0, 2, 4):
        base = int(background[index : index + 2], 16)
        ink = int(foreground[index : index + 2], 16)
        mixed.append(round(base * (1 - alpha) + ink * alpha))
    return "".join(f"{part:02x}" for part in mixed)


def tokens() -> dict[str, str]:
    found = dict(re.findall(r"--dn-([a-z0-9-]+):\s*#([0-9a-fA-F]{6})", CSS.read_text()))
    charts = dict(re.findall(r"--chart-([a-z0-9-]+):\s*#([0-9a-fA-F]{6})", CSS.read_text()))
    return {name: value.lower() for name, value in {**found, **charts}.items()}


class ContrastTests(unittest.TestCase):
    def test_text_on_every_background_meets_aa(self):
        palette = tokens()
        backgrounds = {
            "bg": palette["bg"],
            "surface": palette["surface"],
            "surface-2": palette["surface-2"],
            "code": palette["code-bg"],
            "hover": blend(palette["surface"], palette["link"], 0.14),
            "hero-glow": blend(palette["surface"], palette["link"], 0.16),
            "mark": blend(palette["bg"], palette["link"], 0.25),
        }
        colors = {
            "text": palette["text"],
            "muted": palette["text-muted"],
            "faint": palette["text-faint"],
            "link": palette["link"],
            "violet-text": palette["violet-text"],
            "lime": palette["3"],
            "negative": palette["negative"],
        }
        failures = []
        for ink, ground in PAIRS:
            ratio = contrast(colors[ink], backgrounds[ground])
            if ratio < 4.5:
                failures.append(f"{ink} on {ground}: {ratio:.2f}")
        self.assertEqual(failures, [])

    def test_checker_token_colours_meet_aa_on_the_editor(self):
        palette = tokens()
        editor = "18222e"
        pairs = {
            "keyword": palette["violet-text"],
            "string": palette["3"],
            "comment": palette["text-faint"],
            "number": "fbbf24",
            "call": palette["link"],
        }
        failures = []
        for name, ink in pairs.items():
            ratio = contrast(ink, editor)
            if ratio < 4.5:
                failures.append(f"{name} on editor: {ratio:.2f}")
        self.assertEqual(failures, [])

    def test_chart_violet_is_not_a_text_color(self):
        css = CSS.read_text()
        self.assertEqual(tokens()["violet"], "8b7cf6")
        self.assertEqual(tokens()["2"], "8b7cf6")
        self.assertNotIn("color: var(--dn-violet)", css)
        self.assertNotIn("color: var(--chart-2)", css)
        self.assertNotIn("color: #8b7cf6", css.lower())


if __name__ == "__main__":
    unittest.main()
