# Grouped JSON virtual-rowid metadata repair

Candidate base: d3d37778c4dbf911a59bacfa532c37dec91a2fcd. This is a scoped
metadata repair, not new table-function breadth or engine/release acceptance.

## Ownership

Pinned json.c `jsonEachConnect` declares ten columns on a schema-owned eponymous
virtual table, without a btree root. select.c `columnTypeImpl` follows TK_COLUMN
source identity: negative column uses iPKey when present, otherwise INTEGER and
canonical rowid origin; table/schema supply module/main. Output aliases only
change names. Computed expressions do not inherit these origins.

The mixed aggregate bridge already retains distinct physical and virtual row
identities in input and saved-group phases. Its SELECT-private rootPage=0 JSON
TableNode was mistaken for a provenance-less ephemeral producer by resolution.
Bind schema provenance to that specific source object before expansion, and use
ordinary resolved descriptors, including negative-column iPKey semantics. No
name allowlist, expression-origin fabrication, metadata based on runtime values,
new evaluator, changed rows, or host module registration. Linked producer plans
retain precedence; unbound ephemeral sources retain unknown origins. Physical
rowid/IPK logic and the separate PRAGMA rowid admission gate remain unchanged.
This WeakMap is a representation adaptation of native schema/Table identity,
not an exceptional algorithm substitution.

## Tests-first / evidence

Existing json-mixed-rowid-integration reproducer: CURRENT base168 cases120pass,
48 grouped metadata failures. Fresh pinned3.53.4 recapture with same fixtures and
retained card-w integration library/profile matched all168 tracked cases exactly.
The additional native capture script/JSON here covers96 ordered metadata/typed
row cases: duplicate aliases, computed expressions, grouped physical/virtual
identity distinction, correlated arguments, predicate-only consumption and LEFT
NULL extension for all4 modules, two physical shapes, three encodings. Public
tests compare every descriptor in order and rows through DONE/reset/re-step,
then finalize. No helper-only credit.

Workspace source includes unrelated peer edits removing direct-rowid metadata;
applying only this repair atop exact committed base produces264/264 focused
cases. Dirty-workspace run216/264 exposes48 direct companion failures from that
unrelated difference and is NOT claimed green. Parent integration must retain
the committed direct-rowid path; do not publish a dirty snapshot.

Commands, logs, attempted hypotheses and final225/type/package/JSON results are
in current record:///status.md?card=card-r-d. Source patch is isolated against the
base with separate index; MAIN promotion/review must go through parent/r-e.

## Parent integration review and fresh evidence — [[card:card-r-e]]

Reviewed exact6a3c2cb source against actual parent d3d37778 and pinned
json.c jsonEachConnect declaration and select.c columnTypeImpl. Original
SELECT-private virtual TableNode gets provenance before resolution; linked
producer precedence remains first, unbound ephemeral/computed origins NULL.
Negative-column iPKey/INTEGER/rowid metadata consumes retained schema/module
identity. WeakMap is representation/ownership adaptation, not a metadata allowlist
or value rewrite. Existing committed direct-rowid identity metadata remains;
dirty peer removal is excluded. Separate PRAGMA identity rejection gate retained.

Fresh exact candidate public503/503 includes original168 + added96 full ordered
metadata/typed/reset cases plus mixed/header/LEFT/table routes; type/package
boundary pass. Pragma133/133 + public companion scripts pass. Evidence:
work:///cards/card-r-e/processes/proc-6230ac052169/stdout.log.
Independent pinned96 and168 repeated byte-identically on same fixtures/full
3.53.4 source identity (proc-941d9efb323d); JSON scalar/aggregate/pretty/catalog
controls pass. Native96 SHA39fff89561a587f2b1b822c2258297b5606589610cd15e497d7b44d0f341b6e8;
168 SHAb934a8700c8a6baf79af8e963d4490319dea8b346996cf22c9cf49f155056927.
Exact original225 list taken from r-d original225 manifest: fresh225 completed,
zero fail, two pinned prerequisites0, input drift[] (proc-92f4ea59adb5;
manifest grouped-incorporation/exact225/integration-run/manifest.json).
Chinook7/7, B1/B5 56/56 match0credit (proc-a99f60bc987d).
Vector/generated tests pass; attempted nonexistent package script failed,
correct npm run test:package passes (proc-666f5f2ce1aa), tarballSHA
98754dc6b6d63dfdcea9f8f38b03fb74859635d319373bf9889ceb56e08aef96.
Separate tvf-r1 PRAGMA rowid/five-admission gate passed; trailing fingerprint
Python typo made that whole command exit1, no source change (proc-d08213acc656).

An accidental default runner used320 rather than original225 files and had9
failures (proc-d3b7bb6e17bb). Not acceptance: missing environment/native producers
for derived/retained tests and unrelated OR/record/right/skipscan/stat4 checks.
A wrong common-checkpoint capture could not satisfy derived-order corpus;
24 resource controls passed but3 ordered cases hit unsupported compound arms
(proc-c62c20800c4f). No suppression or invented whole-goal green. Exact scoped
225 rerun is authoritative for requested original gate; wider failures remain
explicit follow-up context, not repaired by this metadata-only union.

Scoped promotion uses temporary index exact candidate8 files plus this evidence,
expected-old d3d37778 ref update. All nonowned HEAD blobs, default index and
existing peer worktree content preserved. Exact included/excluded patches at
work:///cards/card-r-e/grouped-incorporation/ (resolve/vdbe.*.patch).
No pretty/scanner/PRAGMA/value/runtime breadth or other-component source included.
