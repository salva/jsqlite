#!/usr/bin/env python3
"""Validate the exact, zero-credit Stage 3 Mem implementation tranche."""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PIN = ROOT / "reference/sqlite/sqlite-src-3530400"
MANIFEST_PATH = ROOT / "test/conformance/cases/stage3-mem.json"
RANGE_OR_WILDCARD = re.compile(r"\.\.|\*|\bgenerated\b|\bselected\b", re.I)
REF = re.compile(r"^test/([^:]+):(\S+)$")
MUTATING_SQL = re.compile(
    r"\b(?:insert|update|delete|replace|create|drop|alter|vacuum|reindex|attach|detach|begin|commit|rollback|savepoint|release)\b",
    re.I,
)


class MemManifestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        cls.exact = cls.manifest["exactTranche"]

    def test_identity_and_closed_bounded_ids(self):
        pin_manifest = json.loads((ROOT / "reference/sqlite/manifest.json").read_text())
        self.assertEqual(self.manifest["schema"], "jsqlite-mem-cases/2")
        self.assertEqual(self.manifest["sourceId"], pin_manifest["sqliteSourceId"])
        cases = (self.exact["upstreamCases"] + self.exact["adaptationCases"]
                 + self.exact["nativeProvenanceCases"])
        ids = [case["id"] for case in cases]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreater(len(ids), 0)
        self.assertLessEqual(len(ids), 20, "initial tranche must remain bounded")

    def test_exact_upstream_refs_exist_with_declared_multiplicity(self):
        for case in self.exact["upstreamCases"] + self.exact["nativeProvenanceCases"]:
            ref = case["ref"]
            self.assertIsNone(RANGE_OR_WILDCARD.search(ref), ref)
            match = REF.fullmatch(ref)
            self.assertIsNotNone(match, ref)
            filename, case_id = match.groups()
            text = (PIN / "test" / filename).read_text(encoding="utf-8")
            # Tcl cases in this tranche use literal do_test/do_execsql_test names.
            occurrences = len(re.findall(
                rf"(?m)^\s*(?:do_test|do_execsql_test)\s+{re.escape(case_id)}(?:\s|\{{)", text
            ))
            self.assertEqual(occurrences, case.get("upstreamOccurrences", 1), ref)

    def test_executable_ts_operations_are_read_only_and_have_no_ts_write_setup(self):
        executable = self.exact["upstreamCases"] + self.exact["adaptationCases"]
        for case in executable:
            operation_text = json.dumps(case["operation"])
            setup_text = json.dumps(case["setup"])
            self.assertIsNone(MUTATING_SQL.search(operation_text), case["id"])
            self.assertIsNone(MUTATING_SQL.search(setup_text), case["id"])
            self.assertNotIn("bind-step-query", operation_text, case["id"])
        for case in self.exact["nativeProvenanceCases"]:
            self.assertIs(case["executableTs"], False)
            self.assertEqual(case["disposition"], "native-evidence-no-ts-credit")
            self.assertIn("native", case["setupOwner"].lower())

    def test_every_exact_case_is_executable_spec_but_zero_credit(self):
        for case in self.exact["upstreamCases"] + self.exact["adaptationCases"]:
            self.assertEqual(case["disposition"], "unimplemented-temporary", case["id"])
            self.assertIsInstance(case["setup"], list)
            self.assertIn("kind", case["operation"])
            self.assertIn("expected", case)
            self.assertTrue(case["prerequisites"])
        for item in self.manifest["internalCompanions"]:
            self.assertEqual(item["disposition"], "unimplemented-temporary")
        for item in self.manifest["futureBacklog"]:
            self.assertIs(item["executable"], False)

    def test_both_zero_payloads_are_mandatory_native_boundaries(self):
        boundaries = self.manifest["nativeDifferentialBoundaries"]
        self.assertEqual(
            {item["binary64Bits"] for item in boundaries},
            {"0000000000000000", "8000000000000000"},
        )
        for item in boundaries:
            self.assertIs(item["executableNative"], True)
            self.assertIs(item["executableTs"], False)
            self.assertEqual(item["expectedText"], "0.0")
            self.assertEqual(item["disposition"], "native-differential-no-public-sql-credit")


if __name__ == "__main__":
    unittest.main()
