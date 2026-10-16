# Metadata producer destination correction

The singleton module producer must preserve the enclosing SELECT destination,
just like the mixed producer. Pinned SQLite 3.53.4 `select.c:selectInnerLoop`
selects sorter, coroutine or public output from SelectDest; PRAGMA Filter/Next
owns cursor iteration, not the enclosing aggregate destination. The TS callback
is a compile-time adaptation of that input seam, not a separate evaluator.
Publish local register high-water to the shared builder before calling consume,
and recover the caller's high-water afterward. Both direct emission and sorter
drain use this contract. Predicate, offset, limit and cursor-close ordering remain
unchanged. No payload/metadata reshuffling or unsupported downgrade is involved.

## Evidence

Accepted RED: [[card:card-e-n]] `record:///status.md?card=card-e-n&v=129`.
Source parent: `37ff008ed9e1ab204a0d13dd444c3f20a6328b60`.
The exact original isolation harness is unchanged. Candidate execution
proc-7a6bd46b3a5f reports 18/18 matches, including the original name/count GROUP
query in all three encodings, full five-field metadata and two typed row runs.
Native receipts are reused pinned 3.53.4 evidence, not freshly recaptured.

`test/conformance/metadata-destination.test.mjs` reuses the existing immutable
`tvf-group-native.json` (manifest sourceID and embedded image hashes checked):
21 statements/42 runs, GROUP/ORDER, SUM/HAVING, hidden argument, empty source,
correlated physical joins/identity and ordinary ORDER. proc-ed3d53da5338 passes
all three encoding harnesses. It finalizes every prepared statement, resets after
each run and closes each connection. Existing hidden-EQ regression passes as part
of the focused suite, retaining source selection/residual WHERE ownership.

Focused existing 177 tests on 883a531: 174 passed, three identity-boundary tests
failed. Independent review223 and accepted RED139 established these were real
wrong-row admission, not stale expectations: grouped metadata rowid consumed a
synthetic NULL slot and returned (NULL,3) instead of native (1,1),(2,1),(3,1).
The destination correction remains necessary but does not resolve identity.
The subsequent boundary repair rejects metadata identity in shared name lookup
before aggregate enrollment and in singleton binding, retaining the documented
temporary boundary for rowid/_rowid_/oid. Physical and JSON identity remain
independent. Pinned pragma.c Clear/Next/xRowid owns a real cursor counter; no
counter is fabricated here. This bounded gap is not a platform constraint.
Regression `metadata-identity-boundary.test.mjs` covers projected, count-only
WHERE, group-only, joined, LEFT and correlated uses across all encodings, with
try/finally cleanup so successful unexpected prepare cannot cause BUSY masking.
Detailed current repair commands/results: [[card:card-e-n]] status (RED139 and
subsequent repair record); independent oracle provenance: [[card:card-e-l]]
status223. Existing original native receipts remain immutable.

Typecheck passes. Broad composition/JSON/rowid/schema/STRICT command in
proc-3f25032ec16c passes 2600/2600. This finite slice is not generic virtual-table
planner, all-seven aggregate, exhaustive errors/cancellation or volatile-expression
parity. Independent review and expanded native adjacent multiple-aggregate/alias
coverage remain separate obligations. Accepted alpha7 is unchanged; reported
runtime defect must remain qualified against that immutable artifact, not hidden
by source correction or a rebuild. No publication or release action is authorized.
