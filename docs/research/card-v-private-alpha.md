# Private local alpha stabilization — [[card:card-v-d]]

## Finite private-local alpha contract (bounded review, not global certification)

SPEC remains the broad read-only product scope. A private alpha describes current
implemented admission and temporary debt, not a smaller product. No registry,
public repository or external distribution; no operator configuration changes.
The independently tested runtime source is `2f1545c`, with fresh core238 and
additional352 passing. Later committed test-only coverage establishes malicious
input/reuse, realistic indexed throughput, real Chromium credential/CORS and
8.5MB overflow delivery; see [final package reconciliation](card-v-a-final-alpha.md)
for release source/artifact provenance and reuse boundaries. No dirty/staged peer
repairs are included. Settled JSON r v24/f1eb053 remains retained; optional JSON
breadth is not a prerequisite. Historical failed candidates stay historical.

Advertised core consists of the existing public open/prepare/step/reset/
finalize/bind/clear/column/close contract in [api](../api.md), for semantic graphs
actually admitted by committed producers and consumers:

| Area | Required candidate evidence before advertising |
|---|---|
| Acquisition/storage/schema | Local bytes and real HTTP Fetch, default credential omission and explicit options; UTF8/UTF16le/UTF16be; ordinary rowid and WITHOUT ROWID tables, views, realistic indexes/overflow, schema introspection and common STAT4-bearing DB admission |
| Values/lifecycle | Exact INTEGER/REAL/NULL/TEXT/BLOB distinctions, positional metadata including duplicate names, bind ownership, tail/prepare controls, first/next/empty/reset/finalize/close/zombie and saved errors |
| SELECT intersections | Source-admitted joins including outer joins, aggregates/grouping, subqueries/views, ordinary/recursive CTEs, compounds and windows in realistic combinations; ordered native rows/types/metadata/errors, not isolated smoke examples |
| Functions | Implemented ordinary/math/date-time/JSON dispatch and admitted compositions; settled JSON evidence retained, no optional breadth gate |
| Safety/resource behavior | Malicious SQL/files and corruption; primary-error cleanup/reuse; cancellation/deadline/work/row/file/output/private budgets; simultaneous private ownership; realistic completion/performance within existing watchdogs |
| Delivery | Exact-source ESM/declaration closure and consumer types/imports; private versioned local tarball; reproducibility; no Node/native/WASM/evaluator runtime additions; actual static demo against the resulting artifact |

This matrix is finite release verification work, not an upstream assertion
coverage denominator. No known wrong advertised rows are acceptable. Unsupported
in-scope constructs must be identified honestly as temporary, not silently
approximated or reclassified. A semantic acceptance predicate must be supplied
by code/owner evidence, not a SQL-text allowlist invented by integration.

## Supported evidence and temporary gaps

| Supported finite intersection | Evidence and remaining boundary |
|---|---|
| Schema/storage/encodings | Common STAT4 admission, forced/unforced typed queries and reset now pass in all three encodings; native capture closure delivered. Optional STAT4 samples are not used for plan/cost estimation, not a database rejection. No native planner/cost parity claim. |
| SELECT/function core | Native-bound 238-file engine suite, additional352 control tests and installed Chromium38 plus separately retained historical gap2 pass. Joins/aggregates/subqueries/CTEs/windows/functions apply only to producer/consumer graphs actually admitted; no arbitrary-composition guarantee or SQL-text allowlist. |
| Values/lifecycle | INTEGER BigInt vs REAL, NULL/TEXT/BLOB, positional metadata, ownership, reset/saved errors/cleanup are covered by native expectations and public control tests. This is not all tests in every browser. |
| Safety/acquisition | Actual HTTP limits/options/cancel/error/reuse; three-encoding malicious preparation/corruption campaign; actual Chromium same-site cross-origin default omission, opt-in/preflight/CORS denial/reuse. Not universal adversarial fuzzing, cross-site cookie policy or other-browser certification. |
| Practical completion | Native exact211-row indexed Chinook range join repeated three times and 256-row 8.5MB indexed overflow TEXT/BLOB delivery repeated three times under unchanged watchdogs. Observed times are not latency, heap or arbitrary-query termination guarantees. |
| Delivery | Private deterministic ESM/declaration closure, independent installed types/imports and local publish dry-run only; artifact-specific browser/demo and review identities in final evidence. No public distribution. |

Other untranslated read-only graphs, joined WITHOUT ROWID RIGHT/FULL tracking,
joined IN SELECT routes and remaining optimizer breadth remain temporary in-scope
gaps, per API/guide semantic owners. This does not retract accepted bounded routes
or claim exhaustive compatibility. Old f1eb053 STAT4 prepare failure is provenance,
not the repaired runtime's current admission. Original schema and repeated capture
closures through2f1545c discharge that blocker; see resumed diagnosis for exact IDs.
No known wrong advertised rows are accepted. Any new wrong row/type/metadata/error,
state leak or timeout requires attribution; no skips, weakened expectations or
watchdog inflation. Material guarantee changes require owner authorization.

## Permanent exclusions

Exactly SPEC/api permanent exclusions: mutating SQL/transactions/savepoints,
database rewriting/checkpoint/vacuum/schema mutation; native/WASM/embedded SQLite
runtime; externally loaded extensions or host callbacks/application virtual
tables; CLI/Tcl/shell/server/network-protocol compatibility; browser WAL/journal
recovery/sidecar application. Development native fixture generation is allowed.
No new exclusion is authorized by this proposal.

## Evidence and coordination

Retain and reuse [w integration outcome](card-w-current-integration-outcome.md)
and `tools/test/integration.py` / its harness. Do not wait for or activate w.
Export committed source into a purpose-named card work child, preserving the
main workspace index and unrelated edits. Record commit/tree, tracked input
hashes, pin/archive/extracted source identity, CURRENT fixture generation and
native build/profile identity; report every command exit/timeout/not-run and
post-run drift. Historical225, browser38/gap2 and old tarball hashes are provenance
only. Candidate-specific logs/manifests belong in card evidence, not this contract.

Original package [[card:card-v-a]] and demo [[card:card-v-c]] owners receive the
exact candidate commit/tree plus fixture/oracle/evidence identities after source
stabilization. Artifact manifest must additionally name version, tarball digest,
packed closure and demo inputs. Reverification after actual versioned artifact
may require integration corrections. This document describes bounded private-local admission and its evidence boundary;
final artifact review is recorded separately, never global completion.
