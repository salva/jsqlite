#!/usr/bin/env python3
"""Machine-accounting regression for the relational public TS runner."""
import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "test/conformance/cases/stage3-relational-working-state.json"
RUNNER = ROOT / "test/conformance/run-relational-working-state-ts.mjs"
SCHEMA = "jsqlite-relational-ts-accounting-v1"


class RelationalTsAccounting(unittest.TestCase):
    def test_success_accounting_is_post_result_and_matches_manifest_credit(self):
        completed = subprocess.run(
            ["node", "--experimental-strip-types", "--test", str(RUNNER)],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        lines = completed.stdout.splitlines()
        summaries = []
        for index, line in enumerate(lines):
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if value.get("schema") == SCHEMA:
                summaries.append((index, value))
        self.assertEqual(len(summaries), 1, completed.stdout)
        summary_index, summary = summaries[0]
        result_indices = [
            index for index, line in enumerate(lines)
            if "schema-v4 relational public TS consumers" in line and line.lstrip().startswith("✔")
        ]
        self.assertEqual(len(result_indices), 1, completed.stdout)
        self.assertGreater(
            summary_index,
            result_indices[0],
            "pass accounting must be emitted only after the public assertions pass",
        )

        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        credited = [case for case in manifest["cases"] if case["ts"]["credit"]]
        attempted = [case for case in manifest["cases"] if case["ts"]["attempted"]]
        expected = {
            "schema": SCHEMA,
            "declared": len(manifest["cases"]),
            "attempted": len(attempted),
            "passed": len(attempted),
            "unattempted": len(manifest["cases"]) - len(attempted),
            "creditedUpstream": sum(case["credit"] == "upstream" for case in credited),
            "creditedCompanions": sum(case["credit"] != "upstream" for case in credited),
        }
        self.assertEqual(summary, expected)
        self.assertEqual(manifest["accounting"]["tsCreditedCases"], len(credited))


if __name__ == "__main__":
    unittest.main()
