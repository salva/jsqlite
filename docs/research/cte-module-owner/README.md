# Bounded CTE/module source identity repair

Source: pinned select.c `resolveFromTermToCte` installs a transient Table,
subquery and CteUse on the SrcItem before consumers bind expressions. It does
not retry that name as a catalog table. `tag-select-0488` uses a private
materialization destination; `TF_NoVisibleRowid` prevents exposing its rowid.

The mixed JSON producer now uses the existing lowered CTE descriptor,
`transientSourceTable`, producer compiler and private ephemeral destination.
The aggregate module adapter installs the same transient descriptor in its
linked plan, preserving origins through AggInfo. Producer inputs allocate from
the enclosing builder; the consumer's existing Rewind/Column/Next and module
filter/ON/WHERE/sorter schedule remain unchanged. The aggregate payload uses
NULL for the unexposed transient rowid, not a user-visible CTE rowid.

This remains a bounded eager-materialization adaptation: SQLite may flatten or
choose a coroutine for these one-use sources. There is no browser necessity
for that substitution; the current mixed-module consumer requires a retained
cursor. First-row latency/work/memory can therefore differ. Existing private
limits charge retained state. This is not native planner/streaming parity or
unrestricted WITH support. A generic coroutine consumer is remaining work.

## Revision-bound evidence

Repair started at MAIN 3a3677c3c4290eeedbe7d493876019f2cdcdd09d.
`capture.py` independently asserts the manifest source ID against the pinned
native library. `native.json` retains full typed rows and metadata for five
companions, three encodings, two executions: plain composition, original GROUP,
explicit aliases/materialized LIMIT, empty producer, and NULL LEFT completion.
Public regression: `test/conformance/cte-module-owner.test.mjs`; fixtures under
`test/fixtures/cte-module-owner`. These companions add no upstream test credit.

Detailed commands, attempted hypotheses, matrix residuals and delivery boundary
are in [[card:card-n-b]] status. Broader PRAGMA, recursive/module and window
composition are not accepted by this evidence.

### Combined lifecycle companions

The native capture additionally retains one parameterized materialized CTE/JSON
LEFT consumer with five changed binding/reset executions (populated, NULL JSON,
LIMIT zero, empty JSON and populated reuse) in each encoding. The public owner
regression compares typed cells and complete metadata. `cte-module-resources`
checks private bytes/entries, work/result limits, pre-abort/deadline, live task
abort/deadline, saved errors, refunds, reset/rebind and same-connection recovery.
These are companions, not extra upstream credit or exhaustive resource proof.
Explicit derived mixed-module input is rejected at prepare with a typed temporary
gap before catalog lookup in both plain and aggregate adapters; recursive mixed-
module input is also temporarily rejected. Admission companions cover both derived
consumers, recursive rejection, CTE rowid rejection and same-connection recovery
in all encodings. Neither residual is broadened into execution support.
