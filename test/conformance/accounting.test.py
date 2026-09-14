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

    def test_ts_unimplemented_totals_are_separated(self):
        proc = subprocess.run(
            ["node", str(ROOT / "test/conformance/run-ts.mjs")],
            cwd=ROOT, text=True, capture_output=True,
        )
        self.assertNotEqual(proc.returncode, 0, "unimplemented TS lane must not pass")
        reports = [json.loads(line) for line in proc.stdout.splitlines()]
        observations = [row for row in reports if "caseId" in row]
        report = reports[-1]["summary"]
        self.assertEqual([row["caseId"] for row in observations], self.selected)
        self.assertEqual(report["disposition"], "unimplemented-temporary")
        self.assertEqual(report["upstream"], len(self.upstream))
        self.assertEqual(report["companions"], len(self.companions))
        self.assertEqual(report["attempted"], len(self.selected))
        self.assertEqual(report["credit"], 0)


if __name__ == "__main__":
    unittest.main()
