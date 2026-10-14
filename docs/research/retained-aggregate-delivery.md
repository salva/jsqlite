# Retained derived aggregate bounded delivery

This slice repairs retained ORDER/LIMIT input into AggInfo and its correlated
scalar caller, not all SELECT composition. Native capture is independently
produced by `derived-order-limit-aggregate-native.py`, manifest-pinned SQLite;
28 SQL ×3 encodings, exact cells/all five metadata fields, two reset runs. Retained
capture SHA7040f8e222a7ba52e8f51c16e6f5e16e022ab83be81afd49901ef4cda44d36f2
is revision-bound evidence, not compatibility credit. Historical diagnoses and
full command receipts: [[card:card-m-f-k]] status.md (accepted v168, v174 and current).

New acceptance `derived-aggregate-resources.test.mjs` runs through public Fetch:
byte/entry/work/result limits, entry abort/deadline, saved error identity, reset
then smaller rebind, two executions, failure/Halt/finalize refund and same-connection
recovery for all encodings (18 tests). Private budget observation delegates actual
reserve unchanged; no opcode injection or host evaluator. Abort/deadline checks
here are at entry, **not** an in-flight latency claim. Existing packed resource
suite's in-flight receipts remain separate; retained route live asynchronous
abort/deadline/control breadth is outstanding, not silently inherited.

Tests first found real missing Parse.nVar publication: all18 failed bind with
SQLITE_RANGE25. Internal aggregate returned empty parameter metadata; enclosing
compileSelect failed to publish its shared ParameterBuilder. Upstream
build.c sqlite3FinishCoding → vdbeaux.c sqlite3VdbeMakeReady initializes nVar/aVar
from enclosing Parse. Fix is at publication plus direct retained entry, not bind
or SQL dispatch. First direct-entry-only attempt did not fix public caller;
caller fix produced15/18. Three result-test failures were invalid test hypotheses:
operation options do not support maxResultBytes and integers have no text payload
cost. Correct connection result limit8 plus group_concat text100 proves real
failure followed by smaller result recovery without changing runtime semantics.

Fresh fail-fast receipt proc-5596e987c895: typecheck0; retained public3/3,
resources18/18, affected composition/conditional MakeRecord/packing29/29 =50/50;
scoped hygiene0. Remainder read from returned stdout URL. Earlier packed/resource
57/57 receipt proc-b9d3e3ae8519 is unchanged-input preservation, not retained route
coverage; command later failed tracked-path check intentionally. No whole-project
or raw348 acceptance; other nine failed components remain separate.

Delivery includes only linked scalar/retained input/adjacent grouping vdbe hunks,
aggregate shared parameter publication, three dedicated tests/producer, current
own guide/map/API paragraphs and this evidence. Excludes metadata TVF, physical
index planning, unrelated docs/source/staged peers and unknown deletions. Uses
separate Git index seeded from HEAD, explicit hunk selection; preserves real index
bytes and workspace except own edits. Remaining handoff: [[card:card-w]] exact225
must run against coherent reviewed committed inputs, with affected receipt above;
[[card:card-m-f-d]] independent bounded review is required. Neither receipt nor
approval fabricated. No zero remaining global lowering-gap claim.
