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
        ui = (ROOT / "docs/javascripts/rule-studio-ui.js").read_text(encoding="utf-8")
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


if __name__ == "__main__":
    unittest.main()
