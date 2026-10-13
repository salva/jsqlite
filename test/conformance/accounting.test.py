#!/usr/bin/env python3
"""Regression tests for Stage 2 conformance-result accounting."""
import collections
import json
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = json.loads(
    (ROOT / "test/conformance/cases/stage2-initial.json").read_text(encoding="utf-8")
)
ARTIFACT = ROOT / "test/conformance/last-native.jsonl"


class ConformanceAccountingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.upstream = MANIFEST["upstreamCases"]
        cls.companions = MANIFEST["companionCases"]
        cls.selected = cls.upstream + cls.companions
        cls.rows = [json.loads(line) for line in ARTIFACT.read_text(encoding="utf-8").splitlines()]
        cls.summary = next(row["summary"] for row in cls.rows if "summary" in row)

    def test_observations_match_both_closed_sets(self):
        observed = collections.Counter(
            row["ref"] for row in self.rows
            if "ref" in row and not row["ref"].startswith("fixture-open:")
        )
        self.assertEqual(observed, collections.Counter(self.selected))

    def test_companions_receive_no_upstream_credit(self):
        self.assertIs(MANIFEST["companionUpstreamCredit"], False)
        self.assertTrue(set(self.upstream).isdisjoint(self.companions))
        self.assertEqual(self.summary["oraclePassed"], len(self.upstream))
        self.assertEqual(self.summary["companionPassedNoCredit"], len(self.companions))
        self.assertEqual(self.summary["oracleObservations"], len(self.selected))
        self.assertEqual(self.summary["tsUnimplemented"], len(self.upstream))
        self.assertEqual(self.summary["tsCompanionUnimplementedNoCredit"], len(self.companions))

    def run_diagnostic(self, path=None):
        command = ["node", str(ROOT / "test/conformance/run-ts.mjs")]
        if path: command.append(str(path))
        proc = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
        reports = [json.loads(line) for line in proc.stdout.splitlines()]
        self.assertTrue(reports, proc.stderr)
        self.assertIn("summary", reports[-1], proc.stderr)
        return proc, reports[:-1], reports[-1]["summary"]

    def test_current_diagnostic_totals_are_separated(self):
        proc, observations, report = self.run_diagnostic()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual([row["caseId"] for row in observations], self.selected)
        self.assertTrue(all(row["credit"] == 0 and row["matched"] for row in observations))
        self.assertEqual(report, dict(declared=47, attempted=47, upstream=38,
            companions=9, completed=44, observedErrors=3, passed=47, failed=0,
            unattempted=0, credit=0, disposition="diagnostic-no-credit"))

    def test_unmatched_expectation_keeps_summary_and_nonpass(self):
        import os
        # Disposable fixture under the owning card's work root, never product.
        work = pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"]) / "accounting-negative"
        work.mkdir(exist_ok=True)
        data = json.loads((ROOT / "test/conformance/cases/stage2-ts.json").read_text())
        data["cases"][0]["diagnosticExpected"] = dict(disposition="observed-error",
            error=dict(operation="prepare",kind="sqlite",code=1,extendedCode=1,message="intentional unmatched expectation"))
        fixture = work / "cases.json"
        fixture.write_text(json.dumps(data))
        proc, observations, report = self.run_diagnostic(fixture)
        self.assertNotEqual(proc.returncode, 0)
        self.assertEqual(len(observations), 47)
        self.assertEqual(report["failed"], 1)
        self.assertEqual(report["passed"], 46)
        self.assertEqual(report["credit"], 0)
        self.assertEqual(report["unattempted"], 0)


if __name__ == "__main__":
    unittest.main()
