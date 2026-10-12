import base64
import hashlib
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RuleStudioTests(unittest.TestCase):
    def test_node_suites(self):
        completed = subprocess.run(
            [
                "node",
                "--test",
                str(ROOT / "tests" / "rules.test.js"),
                str(ROOT / "tests" / "worker-contract.test.js"),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            completed.returncode,
            0,
            completed.stdout + "\n" + completed.stderr,
        )

    def test_pack_sources_and_demo_names(self):
        import json

        pack = json.loads((ROOT / "knowledge" / "jedox-rules-2026.1.json").read_text())
        examples = json.loads((ROOT / "knowledge" / "examples-2026.1.json").read_text())
        self.assertEqual(pack["jedox_version"], "2026.1")
        older = json.loads((ROOT / "knowledge" / "jedox-rules-2025.1.json").read_text())
        self.assertEqual(older["jedox_version"], "2025.1")
        self.assertGreater(
            sum(1 for fn in older["functions"] if fn.get("unverified_for_version")),
            100,
        )
        self.assertNotEqual(
            next(fn for fn in older["functions"] if fn["name"] == "ISNULL").get("unverified_for_version"),
            True,
        )
        self.assertEqual(len(pack["functions"]), 104)
        for fn in pack["functions"]:
            self.assertTrue(str(fn["source"]).startswith("https://knowledgebase.jedox.com/"), fn["name"])
        cubes = examples["metadata"]["cubes"]
        self.assertEqual(list(cubes), ["PnL", "FX_RATE", "PnL_FX"])
        centers = examples["metadata"]["elements"]["CostCenter"]["base"]
        self.assertEqual(
            centers,
            ["CC1000", "CC1010", "CC2000", "CC3000", "CC3010", "CC4000", "CC4010", "CC5000", "CC5010", "CC6000"],
        )
        accounts = examples["metadata"]["elements"]["Account"]["base"]
        self.assertEqual(
            accounts,
            ["400000", "410000", "500000", "600000", "610000", "620000", "630000", "640000"],
        )
        self.assertEqual(examples["metadata"]["elements"]["Period"]["consolidated"], ["FY2026"])
        self.assertIn("All Cost Centers", examples["metadata"]["elements"]["CostCenter"]["consolidated"])
        self.assertNotIn("PLAN_VS_ACTUAL", json.dumps(examples))
        joined = "\n".join(example["rule"] for example in examples["examples"])
        self.assertIn('PALO.DATA("FDH_DEMO","FX_RATE",!\'Currency\',!\'Period\',"Rate")', joined)
        self.assertNotIn("N:", joined)


class RuleStudioPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = ROOT / "site" / "jedox" / "rule-studio" / "index.html"
        if not cls.page.is_file():
            raise AssertionError("Rule Studio page was not built. Run mkdocs build first.")

    def test_page_is_offline_by_default_and_uses_the_demo_model(self):
        html = self.page.read_text(encoding="utf-8")
        self.assertIn("Business Rule Studio", html)
        self.assertIn("Mock provider", html)
        self.assertIn("Role (hint)", html)
        self.assertIn("Jedox has no special measures dimension type", html)
        self.assertIn("Save history in this browser", html)
        self.assertIn("Delete all history", html)
        self.assertIn("nothing is stored", html.lower())
        self.assertIn('id="rs-version"', html)
        self.assertIn('id="rs-version-note"', html)
        self.assertIn('role="tablist"', html)
        self.assertIn('aria-controls="p-gen"', html)
        self.assertIn('<h2 style="margin-top:0">What gets sent</h2>', html)
        self.assertIn("<h2>Environment</h2>", html)
        self.assertIn('id="rs-history-title"', html)
        self.assertIn(">History</h2>", html)
        self.assertNotIn(">History</h3>", html)
        self.assertNotIn('id="rs-editor" class="rs-editor-host" aria-label', html)
        ui = (ROOT / "docs/javascripts/rule-studio-ui.js").read_text(encoding="utf-8")
        self.assertIn('"aria-label": "Jedox rule editor"', ui)
        self.assertIn("ArrowRight", ui)
        self.assertIn("ArrowLeft", ui)
        self.assertIn('"Home"', ui)
        self.assertIn('"End"', ui)
        self.assertIn("jedox-rules-2025.1.json", ui)
        self.assertIn(
            "Jedox 2025.1: rules are checked against the 2026.1 reference; Jedox's public docs list no rule changes between these versions.",
            ui,
        )
        self.assertNotIn("speedup", html.lower())
        self.assertNotIn("PLAN_VS_ACTUAL", html)
        self.assertNotIn("FX_RATES", html)
        config = (ROOT / "docs/javascripts/rule-studio-config.js").read_text(encoding="utf-8")
        self.assertIn('endpoint: ""', config)

    def test_rule_studio_content_security_policy(self):
        html = self.page.read_text(encoding="utf-8")
        head = html.split("</head>", 1)[0]
        meta = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', head)
        self.assertIsNotNone(meta)
        policy = meta.group(1)
        scripts = (
            'document.documentElement.classList.add("js");',
            'requestAnimationFrame(function(){requestAnimationFrame(function(){var link=document.getElementById("font-rest");if(link)link.media="all";});});',
        )
        for script in scripts:
            digest = "sha256-" + base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode("ascii")
            self.assertIn(f"<script>{script}</script>", html)
            self.assertIn("'" + digest + "'", policy)
        inline = re.findall(r"<script\b([^>]*)>(.*?)</script>", html, flags=re.IGNORECASE | re.DOTALL)
        hashed = 0
        for attrs, body in inline:
            if re.search(r"\bsrc\s*=", attrs, flags=re.IGNORECASE):
                continue
            if re.search(r"""\btype\s*=\s*['"]application/(?:json|ld\+json)['"]""", attrs, flags=re.IGNORECASE):
                continue
            digest = "sha256-" + base64.b64encode(hashlib.sha256(body.encode("utf-8")).digest()).decode("ascii")
            self.assertIn("'" + digest + "'", policy)
            hashed += 1
        self.assertGreaterEqual(hashed, len(scripts))
        self.assertIn("default-src 'self'", policy)
        self.assertIn("script-src 'self' https://challenges.cloudflare.com https://gc.zgo.at", policy)
        self.assertIn("frame-src https://challenges.cloudflare.com", policy)
        self.assertIn("connect-src 'self' https://financedatahub.goatcounter.com", policy)
        self.assertNotIn("workers.dev", policy)
        self.assertIn("img-src 'self' data:", policy)
        self.assertIn("style-src 'self' 'unsafe-inline'", policy)
        self.assertIn("object-src 'none'", policy)
        self.assertIn("base-uri 'self'", policy)
        self.assertIn("https://gc.zgo.at/count.js", html)
        self.assertIn("https://financedatahub.goatcounter.com/count", html)
        self.assertIn("font-rest.css", html)
        self.assertNotIn("fonts.googleapis.com", html)
        self.assertNotIn("fonts.gstatic.com", html)
        home = (ROOT / "site" / "index.html").read_text(encoding="utf-8")
        self.assertIn("font-rest.css", home)
        self.assertNotIn("fonts.googleapis.com", home)
        self.assertNotIn("fonts.gstatic.com", home)
        self.assertNotIn('http-equiv="Content-Security-Policy"', home)


if __name__ == "__main__":
    unittest.main()
