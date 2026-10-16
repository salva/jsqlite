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

Focused existing 177 tests: 174 pass, three pre-existing identity boundary tests
fail because they expect metadata rowid rejection, now admitted by current parent;
the failed assert leaves an unfinalized statement and cleanup masks it with busy.
Unmodified parent GROUP baseline proc-cf661e49e464 is 12 pass/12 fail, including
these same three boundary failures plus nine destination regressions. The repair
removes those nine failures without changing unrelated identity admission. Do not
report the full 177 suite green or silently rewrite its old boundary expectations.

Typecheck passes. Broad composition/JSON/rowid/schema/STRICT command in
proc-3f25032ec16c passes 2600/2600. This finite slice is not generic virtual-table
planner, all-seven aggregate, exhaustive errors/cancellation or volatile-expression
parity. Independent review and expanded native adjacent multiple-aggregate/alias
coverage remain separate obligations. Accepted alpha7 is unchanged; reported
runtime defect must remain qualified against that immutable artifact, not hidden
by source correction or a rebuild. No publication or release action is authorized.
