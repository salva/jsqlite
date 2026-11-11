# JSQLite 1.0 release ledger and structural support draft

**State: OPEN — documentation handoff, not release acceptance.** This is the
finite release worklist for the owner-adopted contract, not an executable support
change, a new audit, or a claim the existing implementation passes. Root freezes
and completes the actual candidate ledger through existing owners. No publication
is authorized. Current policy is in [SPEC](SPEC.md#adopted-jsqlite-10-release-boundary).

## Authority, precedence and evidence

The accepted root [brief v11](record:///brief.md?card=project&v=11) adopts the
full substantive r2 contract at
`/home/salva/review-inputs/jsqlite-alignment-20261111/jsqlite-release-boundaries-astra-20261111-KD8APP/RELEASE-BOUNDARIES.md`, approved in adjacent `REVIEW-r2.md`.
Its historical proposal-only/prerelease headers are superseded: release is **1.0**.
The later owner update also supersedes r2 permission to defer applicable submitted
alignment/architecture issues: **all outstanding applicable submitted corrections
must be completed before 1.0**. Guards contain danger while repair proceeds;
they do not close those corrections. A3/A5 qualifications and A21 ambiguity remain;
this rule does not turn risks into invented bugs. Unrelated unsubmitted debt and
unknown bugs do not create a perfection gate. Legitimate documented adaptations
remain possible under translation-first requirements.

Primary finding inputs (revision-bound, not current failure assertions):

- A1–A21: `SAIVAGE-HANDOFF.md` and `ANALYSIS.md` under
  `/home/salva/review-inputs/jsqlite-alignment-20261111/jsqlite-astra-alignment-20261111-AQI3ow/`.
- CF01–CF06: `FINDINGS.md`, `REPORT.md`, `00-SUBSYSTEM-MAP.md`, `EVIDENCE.md`
  under `/home/salva/review-inputs/jsqlite-select-composition-fidelity-20261027/`.
- Algorithm/simplification concerns: `REPORT-translation-first.md` and
  `EVIDENCE-translation-first.md` under
  `/home/salva/review-inputs/jsqlite-beta8-astra-translation-first-20261027/`;
  contextual maintainability findings in
  `/home/salva/review-inputs/jsqlite-quality-astra-20261025/REPORT.md`.
- Current mutable [audit](reviews/translation-fidelity-2026-09-14.md),
  [source map](SQLITE_SOURCE_MAP.md), [guide](TRANSLATION.md), [API](api.md).
  Earlier predictions must be checked against the selected candidate, not repeated
  as current fact. Full earlier guidance remains in the linked card-u history,
  reconciliation and rule-correction artifacts; this handoff deletes none of it.

## Exact baseline and candidate enrollment

| Identity / evidence | Current value and applicability |
|---|---|
| Accepted bounded baseline | G23 `38aa53d7ea8aabdd22b1e5550ac3e3ca1a5867bb`, tree `2fbb3e2f11564e60126f3a714324ba451319483a`; [G23](record:///status.md?card=card-g&v=23), root [status51](record:///status.md?card=project&v=51). Not 1.0 acceptance. |
| Complete source manifest | 5508 members, SHA256 `41241208c4ce31b43c54856827ab769dfd782edf5a1d0109fbd059863a3e05db`; `work:///cards/card-g/t69-integration/source-manifest.json`. |
| Historical G23 tarball | SHA256 `51f87443ef339a6157e72064ef902790813a477036c6c45b56c18e6f45b94c06`, 627801 bytes, 120 members/59 modules; attributed root/W/V evidence, not newly built here or final 1.0 bytes. |
| Pending A1/A6 repair | T70/Review51 finite eight-path candidate `9feddb2248e9207f40c211f959240fe7c343c9a4`, tree `9860dc835b563b9f2a5375bb81a733f4d31e374e`. Review51 approval is bounded; **pending G integration and combined validation**, not current G23 behavior. Patch SHA256 `6b65caa7f8a7d2977f7f2278cc32b283817d580e0bbb36201071ce927edeca85`; full 5511-member postmanifest `0fb6a91c03102726c16b9fe69d64fd64311f4b10a5902b8289c7ed72bab33bc2`. Local archive enrollment does not preserve G23 Git ancestry. See [T70](record:///status.md?card=card-t&v=70). |
| Separate window author effects | `/work/jsqlite2/g23-window-repair`, d234–236 author evidence only; no adoption/integration/independent approval. Do not stack it with the A1/A6 or documentation patches. Root resolves ownership through T/O. |
| Pinned oracle/source | SQLite 3.53.4, API3053004/archive3530400; SourceID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`; [manifest](../reference/sqlite/manifest.json). Archive SHA256 `d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b`. W reused native library SHA256 `0d9bd04d435fc9eb0e382e0365e8a1cd944c704d835de681ed9bd18b802c0223`; not a new build/authentication here. Record actual options/profile with final expectations. |
| Final 1.0 source/tree, lock/toolchain | **NOT FROZEN**. G freezes combined source; W/V record lock digest, Node/TypeScript/browser/OS/tool versions and build options. |
| Final emitted closure/tar/install/browser | **NOT PRODUCED/QUALIFIED for 1.0**. V binds emitted-module closure, final tar digest, exports/contents, installed ESM and built/installed browser identities; W binds applicable tests. |
| Final fixtures, expectations, inventory | **NOT FROZEN**. Owners record exact fixture/generator/typed-native expectation hashes, case/file inventory, app settings, structural rows, exceptions and per-component reuse. No moving filename alone authenticates evidence. |

## Structural support matrix

Two independent axes: **available / candidate / unknown** describe implementation
and evidence; **stable / experimental / temporary unsupported** describe release
treatment. The latter below is a **target proposal**, not a claim any row is
already 1.0 stable or that a label implements a guard. Unlisted combinations are
unknown and require honest admission boundaries, not a blanket compatibility claim.

| Source → consumer/destination | Clauses/functions and boundary | Implementation/evidence now | Proposed 1.0 treatment / necessary evidence |
|---|---|---|---|
| Immutable physical rowid tables/indexes → ordinary SELECT/result/sorter | Parameters, filters, deterministic ORDER/LIMIT, joins/LEFT, grouping/HAVING, correlated EXISTS within represented shared owners | Available bounded routes; [API](api.md)/source map, not universal cross-product | Stable mandatory core after catalog/report native, metadata, lifecycle, indexed/scan and budget cases pass; A8/A9/A15/A16/A18–20 applicability still tracked below. |
| Ordinary report CTEs / retained producers → ordinary WHERE/join/sort/final delivery | MATERIALIZED fence/Once/OpenDup; independent readers, affinity/collation, ON vs WHERE, ORDER before final LIMIT | Available bounded producers; A1/A6 candidate shared consumer enrollment, not integrated | Stable **required report slice** after repair/combined tests. Cannot remove ordinary report CTEs to pass; other unsupported shapes remain explicit, not known wrong outputs. |
| `sqlite_schema`/`sqlite_master`, supported metadata modules → inspection/report SELECT | Five catalog columns, physical rowid/NULL SQL, declared hidden fields; bounded module mixtures | Available bounded catalog/module consumers | Stable inspection slice after actual workload; not host graph-registration APIs, trigger execution, or general virtual-table support. |
| WITHOUT ROWID / generated / STRICT → inspection and represented physical consumers | Composite PK layout, generated ownership and metadata/type rules; overflow TEXT/BLOB | Available bounded routes, broader joins/plans not universal | Stable mandatory inspection cases; unsupported advanced layouts explicit; all encodings/legal page boundaries retained. |
| Compound arms → Result/Mem/Exists/derived destinations | ALL vs ordered/set merge, leftmost metadata and arm-local production; expanded widths and key identity | Available bounded paths, CF03/A9/A10 and caller migration outstanding | Stable only frozen required combinations after corrections; advanced rows experimental or temporary unsupported with tested structural gates. |
| Window producers → direct/retained/nested consumers | Exact call identity, key identity/frame schedules, aggregate-before-window ordering | Available bounded direct routes; A2/A7/A11 and ownership concerns open; separate author candidate unapproved | Advanced experimental/temporary unsupported until corrected and qualified; promoted analytics need finite native/resource workload. No experimental known-wrong-result exception. |
| Recursive CTE Queue/Current → setup/step/outer destinations | History/priority, body vs outer limits, ordinary SELECT setup/step enrollment | Bounded A4 setup accepted; CF04 STEP/outer integration remains | Advanced experimental/temporary unsupported boundaries pending required submitted correction; keep genuine queue algorithm, not generic materialization replacement. |
| JSON/module/derived/aggregate sources → enclosing expression/AggInfo consumers | Lexical identity, source-position enrollment, retained expression locations | Available bounded combinations; CF05/06 migration/caller evidence incomplete | Freeze only source-backed rows. Other combinations remain explicit; source-based owner corrections before submitted-issue closure. |
| HTTP URL → immutable database / API statement lifecycle | Identity/gzip, decoded caps, early teardown, pre-abort/deadline, BUSY/reset/finalize, private/work/row caps | Available controls, A12–15/A21 candidate applicability unclosed | Stable mandatory acquisition/control contract after R3/R4; labels cannot waive cleanup or error-before-publication. |

All rows preserve INTEGER/REAL/NULL/TEXT/BLOB and error distinctions, ordered
metadata, UTF-8/UTF-16le/UTF-16be, legal page sizes512–65536, no runtime native/WASM
backend, and explicit permanent exclusions in SPEC. No native work/plan-count or
tie-order promise is added. Temporary unsupported is continuing scope, not exclusion.

## Finite submitted-issue inventory

Owners below are existing root routes, not new assignments/acceptance. Status is
an evidence obligation, not twenty-one presumed current defects. Root/G/W attach
candidate-bound closure for each before 1.0; duplicates share demonstrated repair
only with both witnesses/consumers covered. Concrete obsolete/not-applicable
rationale must identify source branches and candidate. No row is closed merely
because a newer commit exists.

| ID | Submitted concern / current disposition | Existing owner route; remaining evidence |
|---|---|---|
| A1 | CTE joins/affinity/collation: G23 reproduced; bounded Review51 repair pending integration | T/N (+J), G/W: integrate exact candidate; native witnesses/nearby LEFT/ON/WHERE/affinity/metadata/reset and combined seams. |
| A2 | Nested scalar/EXISTS/IN windows: admission/owner inconsistency | O/T: reconcile both paths; source-owned correction and phase/type controls, not invariant leakage. Separate author candidate not approval. |
| A3 | Competing function/aggregate classifiers: proven disagreement, **no bad-output witness** | T/P/O: reconcile semantic ownership with controls; no invented functional failure or mandatory unrelated global rewrite. |
| A4 | Recursive setup GROUP/HAVING: bounded G23 accepted fix, not STEP closure | N/T: preserve positive/false HAVING/Queue native controls; carry applicability into combined candidate. |
| A5 | Map/decline-after-builder-mutation risk and misleading error; **no proven polluted successful bytecode** | T and affected owners: source/caller map and decline/publication controls at touched paths. Actual concerns require correction, not speculative bug claim. |
| A6 | Retained ORDER/LIMIT before sort: G23 reproduced, Review51 repair pending integration | T/N (+J), G/W: separate A6 witnesses despite shared A1 implementation; sort directions/ties/negative/zero bounds and early-error controls. |
| A7 | Window call identity replaced by enclosing expression: wrong types/values still reproduced on A1/A6 candidate | O/T: exact-call owner and consumers; independent review of any legitimate combined repair. d author effects not accepted. |
| A8 | Nested comma LIMIT role: bounded G23 accepted production fix | E/T: exact Lemon production, both forms/nested commas/zero-laziness; native metadata/finalize parity still not established by root51 evidence. |
| A9 | Pre-expansion width, **two sites**: named CTE and unordered UNION ALL | N and J/T: reconcile each separately on candidate, star/named width and error controls; one correction does not close both. |
| A10 | Qualified compound ORDER identity, older363eaa snapshot | J/T: current reproduction/source disposition plus named-vs-positional controls, typed order/LIMIT. |
| A11 | Window key identity/sort elision, older snapshot | O/T: distinct from A7/A10; candidate key/collation/window controls. |
| A12 | Compressed HTTP decoded length, older network failure | D/B: actual Fetch gzip vs identity, declared/decoded bounds and typed failures. Mandatory network contract. |
| A13 | Unread response ownership/teardown observation, not proof of permanent leak | D/B: candidate early-failure cancellation/reader ownership; error return alone insufficient. |
| A14 | Open deadline success publication, older zero-timeout witness | D/B: prepublication deadline and cleanup/reuse controls, not real-time guarantee. |
| A15 | Prepare abort/invalid-timeout/empty-SQL bypass, older witness | H/T/B: source-free and schema-dependent prepare, phase/code and connection reuse. |
| A16 | Numeric columnBlob bytes differ from pinned accessor | F/H: candidate numeric formatting/accessor witnesses preserving INTEGER/REAL and BLOB bytes. |
| A17 | Generated-input drift control; later harness evidence not automatic closure | Q/W: selected harness tamper/drift control once; retain receipts and source/fixture/options/environment applicability. No retroactive contamination claim. |
| A18 | GLOB translation alignment, older snapshot | P: candidate pinned-source algorithm/typed positive/negative/error reconciliation. |
| A19 | Date/time alignment, older snapshot | Q: candidate native/source boundary controls; historical date acceptance remains exact-input evidence. |
| A20 | pow/math alignment, older snapshot | Q/F: candidate libm/value/type controls; no fabricated native universal numerical parity. |
| A21 | Binding-budget contract **ambiguity, not proven bypass** | B: reconcile documented budget ownership/actual contract; documentation may be correct remedy, with relevant controls. |
| CF01 | Outer WHERE omission; earlier guard/repair not global consumer migration | T/N: bounded historical containment preserved; A1/A6 shared enrollment overlaps ordinary consumers but does not close all retained aggregate/window/set/repeated paths. Source and witness closure required. |
| CF02 | Recursive qualifier resolution | N/T: bounded direct fix evidenced in [CF02](research/recursive-join/cf02-evidence.md); candidate applicability, alias/wrong qualifier and phase controls; not reopened merely by CF04. |
| CF03 | Destination-dependent compound mini-compilers | T/J: linked ordinary ALL corrections preserved; migrate remaining affected Mem/Exists/table/derived/set/ordered callers and retire superseded gates/arm loops; source-owned algorithms retained. [Evidence](research/card-t-c-cf03.md). |
| CF04 | Manual recursive setup/step vs ordinary SELECT Queue/Current composition | N/T: G23 bounded setup accepted; STEP/enclosing consumer ownership still open. Source setup/step call edges and history/priority/body-vs-outer limits remain required. [Evidence](research/recursive-join/a4-evidence.md). |
| CF05 | Partial lexical preparation/retained expression consumption, **not blanket missing deep correlation** | T/N/J: NameContext/With identity and enclosing consumers, shared producer enrollment; preserve existing working deep references; expression-owned WITH and retained boundaries need exact disposition. |
| CF06 | AggInfo module-position/count source enrollment | T/R/M: source-position/input/group contract through actual JSON/metadata/derived consumers; existing bounded fixes not generic completion. |
| ALG/OWN | Submitted simplification/semantic-owner/algorithm concerns in translation-first and quality reports; compound materialization rationale | T and original semantic owners, root coordinates S/J/N/O as affected: reconcile submitted sections against current source/callers; retire superseded shape dispatch/walkers/manual relocation where replacement lands. Missing machinery is not platform necessity. Keep genuine upstream dispatch/queue/merge and legitimate representation adaptations; no metric quota/global rewrite. Record per-concern repair, duplicate, or candidate-bound legitimate-adaptation rationale. |

## Submitted algorithm/ownership subregister

The translation-first report explicitly supersedes its earlier recommendations.
These are finite submitted concerns, not permission to resurrect withdrawn designs.
Root and original owners attach candidate-bound dispositions to each row:

| Key | Surviving submission and exact correction boundary | Route / status |
|---|---|---|
| TF1 | Report §1 RETAIN: native WhereLevel implementation state, distinct from WhereLoop candidate; continuation stages and borrowed RIGHT/Bloom labels preserved. Replace displaced parallel collections, not a universal exit/iterator framework. | S/root with T callers: bounded current implementation/source map and regression applicability needed; no current absence inferred from old report. |
| TF2 | Report §2 NARROW: selected retained-window errors are terminal; early preselection declines may remain untouched-builder. No producer preflight/admitted IR, rollback of terminal builders or invented contaminated-program witness. | T/O: current decline/publication controls and source/error-order disposition; overlaps A5 but not automatic closure. |
| TF3 | Report §3 NARROW: implicit-index declaration identity through WR root attachment, not generic DDL/trigger caching. Keep raw declaration vs compacted PK layout phases distinct. | E/schema owners via root: current reuse/column identity, index_list/xinfo/read, error/publication and encoding evidence required. |
| TF4 | Report §4 DROP: proposed window publication-facts policy is withdrawn. Preserve native return-row control as source comparison; no mandatory implementation of rejected policy. | O/T: candidate-bound explanation of legitimate scheduling adaptation/remaining submitted ownership concern, not a fabricated new requirement to add publication facts. |
| Q6 | Quality REPORT P1 function classification; P2 admission/emission; P3 per-level continuation; P4 window setup/scheduling; P5 redundant mixed-module binder; VM switch ownership/lower-cost inventory and C1 width/C2 decline leads (§§91–212). These are contextual rankings, not size/count defects. Translation-first TF1–TF4 supersede conflicting remedies. | Root/semantic owners: reconcile each submitted item to accepted fixes/duplicates/current obligations; C1 overlaps A9 but needs exact-site evidence, C2 overlaps A5/TF2. Metrics do not require quotas, arbitrary splitting or global rewrite. |
| CM | Surviving compound eager-materialization rationale and native merge/control comparison | T/J: route-specific rationale and observable error/work/suspension evidence remain open as described below. |

The ALG/OWN row explicitly includes the surviving compound materialization
question recorded in [card-u consolidation](research/card-u-consolidation.md):
pinned `multiSelectByMerge` uses same-VM coroutine registers/PC, as TS now can.
Bounded eager materialization has real storage/early-work/error/suspension tradeoffs;
"no native resumable stack" is historical, not a current platform justification.
Route-specific rationale and native intermediate error/work/suspension comparison
remain owning Planner obligations, not a ban on legitimate materialization or
permission for card-u to refactor runtime. The owners must enumerate the implicated
report sections in their closure evidence; this aggregate row is not blanket closure
of those submitted concerns.

## Mandatory workload bundle and finite evidence to freeze

Each family requires **both small interactive and larger-but-bounded** cases.
Owners choose concrete fixture sizes/case IDs and finite app settings in existing
workload evidence, then bind hashes/inventory here; these values are **not yet
frozen**, and completion cannot be claimed without them. No workload is removed
merely because a current admission path fails.

| Family | Required coverage / expectations | Remaining owner evidence |
|---|---|---|
| Catalog browser | Chinook Album/Track, parameterized artist/album filters, deterministic pagination with tie keys, count/duration, unmatched LEFT, duplicates, typed/empty results, reset/rebind | W/V with SQL owners: small/larger fixtures, exact independent typed answers, finite settings, cancellation/cap-failure and successful app reuse on final installed distribution. |
| Application report | Nullable foreign keys, self aliases, collation, exact large integer IDs, grouped HAVING, correlated EXISTS, **ordinary CTE ORDER/LIMIT**, indexed and scan controls | T/S/J/N + W/V: concrete small/larger app cases and expectations; A1/A6 integration does not itself qualify the report bundle. |
| Inspection/interchange | Catalog/supported metadata modules, composite WR keys, generated/STRICT, overflow TEXT/BLOB/mixed values, all encodings | E/R/M + storage owners, W/V: small/larger bounded fixture matrix; eight legal page sizes with UTF-16 companions as required by R3; actual acquisition/control cases, no full-file integrity certificate. |
| Advanced promoted rows | Any selected windows/recursive/set/module cross-products | Existing owners freeze exact structural promotion and finite analytics tests; ordinary technical choice, no new generic human gate. Known wrong results contained even if not promoted; applicable submitted repairs still mandatory. |

## R1–R7 gate board (all OPEN for final 1.0)

| Gate | Completion evidence needed / owner |
|---|---|
| R1 Scope/defects | Root + semantic owners: frozen structural rows, all submitted inventory reconciled and outstanding applicable corrections completed with source-based regressions; known reachable wrong-result classes repaired or contained before output. Guards alone cannot close submitted corrections. |
| R2 Semantics | W + owners: every frozen mandatory item has an applicable pass; new/changed seams compare independently obtained pinned-native typed rows, ordered metadata and applicable error phase/code, all encodings, witnesses/nearby controls/enclosing consumers. Timeout/not-run/drift is not pass; order assertions only where SQL defines order. |
| R3 Acquisition/storage | D/B/storage + W: eight-page-size/UTF-16 sweep, table/index/record/extreme-rowid/overflow/WR/schema, touched-corruption/traversal typed negatives/cleanup, real HTTP identity/gzip, missing/truncated body, decoded caps, early teardown, abort/deadline, CORS/default credentials. |
| R4 Lifecycle/controls | B/H/owners + W: two-cycle reset/rebind/clear, saved errors/reset/finalize, BUSY/deferred close/overlap, BLOB lifetime, open/prepare pre-abort/invalid-expired timeout, mid-work abort, row/file/result/work/private caps/reuse. Representative malformed/oversized/deep SQL and schema SQL-byte/parser/expression-depth bounds; each stable materializing family gets controls. No exhaustive security corpus. |
| R5 Useful workloads | W/V + app/SQL owners: full small/larger bundle above on candidate distribution, exact answers, recorded settings/size/time, cancellation/cap failure and reuse. No general performance promise or weakened workload. |
| R6 Distribution/browser | V/W: typecheck, source package and final channel metadata/exports/contents/install instructions, final tar/closure identity, actually installed ESM and real Chromium/Fetch/demo/workloads/static import; no hidden native/WASM/Node backend. Private source assertions remain separate from conditional registry overlay. Chromium qualification is not Chromium-only product scope. Record browser/OS/tool versions, not all-browser certification. |
| R7 Integrity/decision | G/Q/W/V/root: static/generated drift, complete selected-outcome accounting, original reds plus explicit applicable replacements/nonmandatory dispositions, closure/options/environment-based reuse, affected/combined seams, final-runtime-matching installed/browser evidence, ordinary independent acceptance and one root readiness decision. Publication remains separate. |

Orchestration remains serial100000ms/file, at most80 files/batch, independent600s
batch ceiling, prerequisite180s plus appropriate termination grace; not an API
performance guarantee. No global rerun is required when finite applicable reuse
can be demonstrated. Source/harness/fixture/oracle/options/environment changes
must be assessed: shared semantic changes require affected closure and modest
combined seams; installed/browser evidence must match final runtime bytes.

Original W293 full575 remains **RED:546 completed-success,2 failures,1 cutoff,
26 not_run**,64 prerequisites completed0. Root51 reports a bounded composite
575=546 unchanged+29 focused, built/installed230 each and147 native/public pairs;
that does not erase the original600.032s overrun, prove all 1.0 gates or automatically
close A17. Preserve each component's replacement and unchanged-input reasoning;
unknown applicability remains a gap. Full detail in G23/root51 and W records.
Other earlier red/cutoff/not-run invocations, analyzer669.934s>600/cumulative1127.984s
and batch1465.786s/incomplete accounting remain unwaived, not reset by this ledger.

**Resource incident retained:** G8/W238 removed Playwright/core/launcher bytes and
retired log remain unknown. Restored manifests are not lossless recovery; quarantined
120-file reconciliation remains unused. Ancestor owner supplies original artifacts
or explicit specific replacement authority. No speculative reinstall/reset/delete;
use isolated explicit tooling. No resource release or cleanup is asserted here.

## Handoff and continuing scope

This usable draft identifies requirements and unfilled evidence; it is not the
final frozen release receipt. G integrates exact reviewed documentation preserving
shared updates (especially pending A1/A6 guide/API/map changes), then existing
owners complete their rows and root freezes final candidate/evidence. Never replace
newer shared guidance wholesale with this G23-based patch. No whole-document cleanup
is a prerequisite. After finite gates and submitted corrections pass, prepare exact
version1.0 handoff/quickstart/demo/limitations and residual ownership. Broader
read-only scope and unsubmitted nonblocking optimization work continue afterward.
