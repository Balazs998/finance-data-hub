import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SQL_FENCE = re.compile(r"(?ims)^```sql[^\n]*\n(.*?)^```[ \t]*$")


def lines_with_internal_double_spaces(text: str) -> list[int]:
    """Line numbers whose content, after leading indentation, has two spaces."""
    found = []
    for number, line in enumerate(text.splitlines(), 1):
        if "  " in line.lstrip(" \t"):
            found.append(number)
    return found


class SqlWhitespaceTests(unittest.TestCase):
    def test_sql_blocks_and_downloads_have_single_spaces(self):
        problems = []
        for path in sorted((DOCS / "files").rglob("*.sql")):
            bad = lines_with_internal_double_spaces(path.read_text(encoding="utf-8"))
            if bad:
                problems.append(f"{path.relative_to(ROOT)} lines {bad}")
        for path in sorted(DOCS.rglob("*.md")):
            text = path.read_text(encoding="utf-8")
            for index, body in enumerate(SQL_FENCE.findall(text), 1):
                bad = lines_with_internal_double_spaces(body)
                if bad:
                    problems.append(
                        f"{path.relative_to(ROOT)} sql block {index} lines {bad}"
                    )
        self.assertEqual(problems, [])


if __name__ == "__main__":
    unittest.main()
