#!/usr/bin/env python3
"""Validate the closed, zero-credit comparison/key tests-first tranche."""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
PIN = ROOT / "reference/sqlite/sqlite-src-3530400"
PATH = ROOT / "test/conformance/cases/stage3-comparison-key.json"
REF = re.compile(r"^test/([^:]+):(\S+)$")
FORBIDDEN = ("localeCompare", "toLocale", "toLowerCase", "toUpperCase", "Intl.Collator")


def normalize_sql(text):
    """Collapse Tcl/SQL formatting whitespace, but preserve bytes inside SQL quotes."""
    out, quoted, pending_space = [], False, False
    for char in text:
        if char == "'":
            if pending_space and out and not quoted:
                out.append(" ")
            pending_space = False
            out.append(char)
            quoted = not quoted
        elif char.isspace() and not quoted:
            pending_space = True
        else:
            if pending_space and out:
                out.append(" ")
            pending_space = False
            out.append(char)
    return "".join(out).strip()


class ComparisonKeyManifestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = PATH.read_text(encoding="utf-8")
        cls.data = json.loads(cls.raw)

    def test_pin_and_bounded_unique_cases(self):
        pin = json.loads((ROOT / "reference/sqlite/manifest.json").read_text())
        self.assertEqual(self.data["schema"], "jsqlite-comparison-key-cases/1")
        self.assertEqual(self.data["sourceId"], pin["sqliteSourceId"])
        cases = self.data["upstreamCases"] + self.data["internalVectors"] + self.data["localSafetyCompanions"]
        ids = [case["id"] for case in cases]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(len(cases), 12)
        self.assertLessEqual(len(cases), 20)

    def test_exact_upstream_ids_and_expectations_exist(self):
        for case in self.data["upstreamCases"]:
            match = REF.fullmatch(case["ref"])
            self.assertIsNotNone(match, case["ref"])
            filename, case_id = match.groups()
            text = (PIN / "test" / filename).read_text(encoding="utf-8")
            matches = list(re.finditer(
                rf"(?m)^\s*(?:do_test|do_execsql_test)\s+{re.escape(case_id)}(?:\s|\{{)", text
            ))
            self.assertEqual(len(matches), 1, case["ref"])
            next_case = re.search(r"(?m)^\s*(?:do_test|do_execsql_test)\s+", text[matches[0].end():])
            end = matches[0].end() + next_case.start() if next_case else len(text)
            block = text[matches[0].start():end]
            self.assertIn(normalize_sql(case["sql"]), normalize_sql(block))
            self.assertIn(normalize_sql(case["expectedTcl"]), normalize_sql(block))

    def test_source_anchors_name_real_pinned_routines(self):
        corpus = "\n".join((PIN / p).read_text(encoding="utf-8", errors="replace") for p in (
            "src/vdbeaux.c", "src/vdbe.c", "src/main.c", "src/sqliteInt.h"
        ))
        anchors = [a for case in self.data["internalVectors"] for a in case["sourceAnchors"]]
        for anchor in anchors:
            symbol = anchor.rsplit(":", 1)[1]
            self.assertIn(symbol, corpus, anchor)
        for required in ("sqlite3MemCompare", "sqlite3VdbeRecordUnpack", "sqlite3VdbeRecordCompare",
                         "binCollFunc", "nocaseCollatingFunc", "rtrimCollFunc"):
            self.assertTrue(any(a.endswith(":" + required) for a in anchors), required)

    def test_zero_credit_and_closed_handoff(self):
        self.assertEqual(self.data["proposedModule"], "src/internal/comparison.ts")
        self.assertEqual(self.data["proposedExports"],
                         ["compareMem", "compareBuiltinText", "unpackRecordKey", "compareRecordKey"])
        for case in self.data["upstreamCases"]:
            self.assertEqual(case["disposition"], "unimplemented-temporary")
        for case in self.data["internalVectors"]:
            self.assertEqual(case["disposition"], "executable-internal-no-public-sql-credit")
        for case in self.data["localSafetyCompanions"]:
            self.assertEqual(case["disposition"], "local-safety-no-credit")
        native = self.data["nativeDifferentialBoundaries"]
        self.assertEqual(len(native), 5)
        for case in native:
            self.assertEqual(case["disposition"], "native-oracle-no-public-sql-credit")
        record_native = self.data["nativeRecordComparatorBoundaries"]
        self.assertEqual(len(record_native), 11)
        self.assertEqual(len({case["id"] for case in record_native}), 11)
        self.assertEqual(
            {case["defaultRc"] for case in record_native if case["expected"]["eqSeen"]},
            {-1, 0, 1},
        )
        self.assertEqual(
            {(case["sortFlags"], case["expected"]["sign"])
             for case in record_native if case["id"].startswith("native-record-null-order-")},
            {(0, 1), (1, -1), (2, -1), (3, 1)},
        )
        self.assertEqual(
            {case["id"] for case in record_native if "short-" in case["id"]},
            {"native-record-short-seek-rhs-default", "native-record-short-packed-lhs-corrupt"},
        )
        corrupt = next(case for case in record_native if case["id"] == "native-record-short-packed-lhs-corrupt")
        self.assertEqual(corrupt["expected"], {"sign": 0, "eqSeen": False, "errorCode": 11})
        assumption = next(case for case in record_native if case["id"] == "native-record-truncated-payload-source-assumption")
        self.assertEqual(assumption["expected"], {"sign": -1, "eqSeen": False, "errorCode": 0})
        self.assertEqual(assumption["disposition"], "native-source-assumption-observation-no-credit")
        self.assertIn("padded/valid b-tree", assumption["rationale"])
        safety_cases = {case["id"]: case for case in self.data["localSafetyCompanions"]}
        missing = safety_cases["record-missing-next-serial-after-equal-prefix"]
        self.assertEqual(missing["expectedError"], "corrupt")
        self.assertIs(missing["expectedEqSeen"], False)
        self.assertEqual(missing["nativeObservation"], corrupt["id"])
        safety = safety_cases["record-declared-serial-truncated-payload"]
        self.assertEqual(safety["expectedError"], "corrupt")
        self.assertIs(safety["expectedEqSeen"], False)
        self.assertIn("stricter untrusted-input", safety["rationale"])
        runtime = (ROOT / "test/value/comparison.test.mjs").read_text(encoding="utf-8")
        for case in (missing, safety):
            self.assertEqual(runtime.count(f'test("{case["runtimeTest"]}"'), 1, case["id"])
        for case in record_native:
            expected_disposition = (
                "native-source-assumption-observation-no-credit"
                if case["id"] == "native-record-truncated-payload-source-assumption"
                else "native-oracle-no-public-sql-credit"
            )
            self.assertEqual(case["disposition"], expected_disposition)
            self.assertTrue(case["sourceAnchors"])
        for case in self.data["futureBacklog"]:
            self.assertIs(case["executable"], False)

    def test_declared_executable_evidence_names_exact_runtime_tests(self):
        evidence = self.data["executableEvidence"]
        self.assertEqual(len(evidence), 4)
        self.assertEqual(len({case["id"] for case in evidence}), len(evidence))
        runtime = (ROOT / "test/value/comparison.test.mjs").read_text(encoding="utf-8")
        for case in evidence:
            title = case["runtimeTest"]
            # Exact test-title linkage prevents accounting newer executable
            # coverage merely as prose or stale temporary vectors.
            self.assertEqual(runtime.count(f'test("{title}"'), 1, case["id"])
            self.assertIn(case["disposition"], (
                "executable-internal-no-public-sql-credit", "local-safety-no-credit"
            ))
        self.assertEqual(
            {case["id"] for case in evidence},
            {"record-production-orientation", "record-incremental-actual-field-limits",
             "record-seek-caller-construction", "record-keyinfo-immutable-identity-handoff"},
        )
        keyinfo = next(case for case in evidence if case["id"] == "record-keyinfo-immutable-identity-handoff")
        self.assertEqual(
            set(keyinfo["covers"]),
            {"defensive-deep-copy", "runtime-deep-freeze", "retained-keyinfo-identity",
             "comparison-mismatch-rejection", "js-mutation-attempts"},
        )
        self.assertIn("src/sqliteInt.h:UnpackedRecord.pKeyInfo", keyinfo["sourceAnchors"])

    def test_current_pin_uses_nfield_default_rc_and_eqseen_not_legacy_modes(self):
        sqlite_int = (PIN / "src/sqliteInt.h").read_text(encoding="utf-8")
        vdbeaux = (PIN / "src/vdbeaux.c").read_text(encoding="utf-8")
        vdbe = (PIN / "src/vdbe.c").read_text(encoding="utf-8")
        corpus = "\n".join((sqlite_int, vdbeaux, vdbe))

        # SQLite 3.53.4 has no historical UNPACKED_* prefix-mode flags. Its
        # caller contract is the explicit UnpackedRecord state below.
        for legacy in ("UNPACKED_PREFIX_SEARCH", "UNPACKED_PREFIX_MATCH", "UNPACKED_INCRKEY"):
            self.assertNotIn(legacy, corpus)
        runtime = (ROOT / "src/internal/comparison.ts").read_text(encoding="utf-8")
        for legacy_mode in ('"prefix-search"', '"prefix-match"'):
            self.assertNotIn(
                legacy_mode,
                runtime,
                f"runtime must model current nField/default_rc/eqSeen state, not inert {legacy_mode}",
            )
        for field in ("u16 nField", "i8 default_rc", "u8 eqSeen"):
            self.assertIn(field, sqlite_int)
        self.assertRegex(vdbeaux, r"p->nField\s*=\s*pKeyInfo->nKeyField\s*\+\s*1\s*;")
        self.assertRegex(vdbeaux, r"p->nField\s*=\s*u\s*;")
        self.assertRegex(vdbeaux, r"pPKey2->eqSeen\s*=\s*1\s*;")
        self.assertRegex(vdbeaux, r"return\s+pPKey2->default_rc\s*;")

        # Seek callers construct non-empty prefixes and choose the exact
        # default_rc polarity documented by the opcode implementation.
        self.assertIn("assert( nField>0 );", vdbe)
        self.assertRegex(vdbe, r"r\.nField\s*=\s*\(u16\)nField\s*;")
        self.assertRegex(vdbe, r"oc!=OP_SeekGT\s*\|\|\s*r\.default_rc==-1")
        self.assertRegex(vdbe, r"oc!=OP_SeekLE\s*\|\|\s*r\.default_rc==-1")
        self.assertRegex(vdbe, r"oc!=OP_SeekGE\s*\|\|\s*r\.default_rc==\+1")
        self.assertRegex(vdbe, r"oc!=OP_SeekLT\s*\|\|\s*r\.default_rc==\+1")
        self.assertRegex(vdbe, r"r\.eqSeen\s*=\s*0\s*;")
        # Other current callers explicitly use zero, while the Idx boundary
        # family also has a source-current -1 construction.
        self.assertGreaterEqual(len(re.findall(r"r\.default_rc\s*=\s*0\s*;", vdbe)), 3)
        self.assertRegex(vdbe, r"pOp->opcode==OP_IdxLE\s*\|\|\s*pOp->opcode==OP_IdxGT")
        self.assertRegex(vdbe, r"r\.default_rc\s*=\s*-1\s*;")

    def test_no_host_string_or_collation_shortcuts(self):
        for token in FORBIDDEN:
            self.assertNotIn(token, self.raw)
        self.assertIn("host registration is permanently excluded", self.raw)


if __name__ == "__main__":
    unittest.main()
