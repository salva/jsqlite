# Immutable row-width/stat1 production proposal

Draft for Planner assessment, [[card:card-s-e-a]], parent [[card:card-s-e]]. **No runtime changes are authorized by this note.** Tests and independent native snapshots precede consumer implementation. Existing candidate ordering/exhaustion and semantic guards from [[card:card-s-d]] are invariants, not work to reopen.

## Scope and evidence ownership

Read owner SPEC/PLAN, current TRANSLATION WHERE section and SQLITE_SOURCE_MAP WHERE section, audit revision 2026-09-29 (immutable stat1) and current schema/WHERE producers. The guide correctly calls indexed width a gap; six earlier stat-choice successes do not imply width support. Current schema.ts loader skips NULL idx/table estimates, requires TEXT idx and exact decimal prefix tokens, rejects all extensions except exact `unordered`. Current real WHERE loops do not produce optional indexRowSize. This proposal closes the **producer → immutable schema → real WHERE → selected ordinary/joined compilation** contract, not independent ranking or JS memory measurement.

Pinned SQLite 3.53.4 source ID: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. Archive SHA256 `d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b`. Native library was built from the verified archive via tools/oracle/build.sh, with column metadata/math functions, without STAT4/COSTMULT. No host sqlite3 oracle or native runtime dependency.

Source hashes: build.c `c71549801eb2f56dcba062a6ce1c347d93203e43deb05c08ba4ad71a2c08d867`; analyze.c `d015f3d70cbf0701500c4f972bd845aa621b23e7be3a205878f5925cb1694f3a`; where.c `e96a8fea366c785acbdc19ef4bd31f1d4cbe5a2aa7661a1286a1f4e491ae547c`; util.c `f3ad5a891625459352c1b57c053d3b89dcc973206644126a857c0ff82b7ce37f`.

## Proposed immutable owners (ordinary representation adaptation)

* ColumnNode owns readonly `szEst` (integer in units of approximately four bytes). Build it alongside affinity, not from values/pages. Translate sqlite3AddColumn1495ff standard-type branch and sqlite3AffinityType1649ff **together**. Untyped default is BLOB affinity but szEst=1; standard BLOB/TEXT szEst=5, standard numeric/integer/REAL=1. Custom scanning preserves CHAR's pointer, BLOB immediate-parenthesis pointer, INT precedence/early break and the conditional affinity overrides. For low affinity, scan from retained pointer for the first digit, sqlite3GetInt32 into initial zero, divide by four then add one and saturate at 255; absent pointer uses 16. VARCHAR(100)=26, BLOB(1000)=251, CHAR without digits=1; not all text columns have size 5. Overflow in declared dimensions leaves zero, not a wrapped size. Retain declaredType/defaults/affinity semantics unchanged.
* TableNode owns readonly `szTabRow`, `nRowLogEst`, `hasStat1`. Defaults come from build.c estimateTableWidth2222: sum **all declared columns**, including IPK slot, add one only if C iPKey<0, multiply by four and LogEst. Do not use the absence of a physical rowid as this condition: WR conversion clears iPKey. Default nRowLogEst=200 (1048576) for this pinned build; preserve sqlite3DefaultRowEst's table floor/99 adjustment and prefix defaults/unique final estimate at build.c4518ff. A table stat and a partial-index stat have different ownership.
* IndexNode owns readonly `szIdxRow` (LogEst), `hasStat1`, readonly prefix `rowLogEst`, `unordered`, and retained `noSkipScan` metadata. Existing statisticsForIndex can remain an accessor, but may not maintain a second mutable competing estimate owner. Construct locally, load stats in physical record order, freeze once before publishing the graph. If WeakMaps remain for representation compatibility, publish one immutable estimate bundle per object and expose one accessor; callers must not infer missing values as defaults. Keep names/provenance separate from physical root identity.
* Planning uses BigInt logical LogEst arithmetic. Source-width parsing is explicit and bounded (see below), not incidental JS bitwise coercion. All actual indexed loops carry `indexRowSize=BigInt(index.szIdxRow)`; table scans have no index width. Synthetic rowid probe carries source `szIdxRow=3`, `[table.nRowLogEst,0]`; do not add it to schema catalog or persistent index list. Its seek/scan branch is distinct from a persistent ordinary index.

## Exact physical identity before width

build.c estimateIndexWidth2236 sums **actual nColumn**, not nKeyCol or SQL terms: each nonnegative column uses its szEst, XN_ROWID/XN_EXPR each adds one, then multiply by four and LogEst. Existing PhysicalIndex.fields is the authoritative TS nColumn layout; never append a second guessed suffix for costing.

* Ordinary persistent explicit and schema autoindexes: declared key fields (including repeated columns if upstream retains them), expression fields at one unit, actual rowid tail at one. IPK table's IPK column estimate remains one even when stored as NULL in table record. Persistent `sqlite_autoindex_*` objects are schema-owned UNIQUE/PK btrees, **not** where.c automatic query indexes; those remain unimplemented.
* WR primary: convertToWithoutRowidTable2340ff converts single IPK into a real PK index, removes redundant PK entries by isDupColumn (column identity plus required collation, not direction), sets nColumn=nKeyCol, uses table root, then appends declared nonvirtual columns not already present by column identity. Primary is a covering physical index, not a synthetic rowid probe.
* WR secondary: eliminate rowid tail, append only PK entries not matched in declared keys by column **and collation**. Direction does not determine dedup; PK descending affects auxiliary mapping/control separately. Different-collation copies count twice. A PK may occupy declared, interspersed or auxiliary fields; retain existing primaryKeyFields exact ordinal mapping. An expression cannot stand in for an ordinary PK column. Width follows fields even where SQL term count differs. No storage/restart/key-identity refactor.
* Defaults for fixture t: [1,1,1,26,251,5], table LogEst(1140), ta/tc/te LogEst(8), tb LogEst(112), persistent UNIQUE u index LogEst(24). noipk [1,5,11,1,5] => table LogEst(96). WR [5,1,1] => table LogEst(32); PK LogEst(28); wx(b,a BINARY,a NOCASE) LogEst(44); wy(a NOCASE,b DESC) LogEst(24). Encodings do not change these declared estimates.

## Stat1 callback and parser contract

Read analyze.c decodeIntArray1520ff and analysisLoader1605–1649 against util.c sqlite3GetInt321303ff/sqlite3Atoi1362; do **not** implement split/trim/parseInt.

Callback has three text-or-NULL argv values, produced by sqlite3_exec column_text coercion (legacy.c90, OOM checked before callback), even for numeric/BLOB storage. Translate this text boundary through existing Mem/encoding primitives; stop at NUL as C does. Numeric rendering must use SQLite text conversion (REAL distinction matters), BLOB callback conversion must match database encoding/native controls. Existing loader's TEXT-only policy is not native semantics. NULL tbl/stat ignores row; unknown table ignores row; NULL idx selects table fakeIdx; idx equal to tbl selects WR primary where one exists; otherwise index lookup is **global schema lookup**, not restricted to the named table. Missing index falls back to table fakeIdx, not ignore. Nonpartial globally matched index updates **argv[0] named pTable**, not pIndex.pTable, with its decoded prefix[0] and HasStat1; partial matched index updates neither table. The index itself receives its estimates/HasStat1 in both cases. Do not shortcut through index.table. Later physical stat rows overwrite earlier state, and parsing resets unordered/noSkipScan on each decode. Width stays its prior default/loaded value if no matched sz token. Table fakeIdx starts with current table width, decodes one prefix integer, hands width back.

Each prefix slot initializes v=0, consumes ASCII digits while updating unsigned tRowcnt, stores LogEst, then advances at most **one ASCII space**. Non-digit/non-space can produce zeros across remaining slots without moving z. Missing slots leave existing prefix defaults unchanged. tRowcnt is the source unsigned 64-bit type: explicitly apply BigInt.asUintN(64) for decimal accumulation, then convert to LogEst; retain unbounded BigInt for planner sums/masks. This is an intentional source fixed-width lexical boundary, not a general 32-bit estimate policy. Repeated spaces, tabs, signs and short arrays must follow the source state machine.

Tail token recognition compares remaining suffix with strglob patterns: unordered*, noskipscan*, sz=[0-9]*. The star admits arbitrary suffix after an initial digit; sz=20suffix parses 20. sqlite3Atoi delegates GetInt32; overflow leaves initialized zero; clamp any result below 2 to 2; then LogEst. Unsigned `0x`/`0X` with a following hex digit is admitted by sz glob and GetInt32 (util.c1303), strips leading hex zeros, accepts at most eight significant hex digits and rejects sign bit/extra digit; `sz=0x10` gives16, `0x7fffffff` gives2147483647, `0x80000000`/`0x100000000` clamp2. Signed hex fails sz glob (width retained); GetInt32 itself processes a leading sign before its else-if hex branch, so signed hex is not equivalent. Decimal leading zeros are stripped. Declared dimension scanning uses this same primitive, not decimal-only parseInt. 2147483647 is admitted, 2147483648/very long decimal returns zero => 2; no modulo wrap. sz=-1 is not a matched sz token. Walk to space then skip all spaces for next tail token. Unknown tokens are ignored **because upstream ignores them**, not because unsupported estimates may be ignored arbitrarily. noskipscan retained but explicitly has no consumer/skipscan credit. COSTMULT is absent from pinned profile; do not implement enabled-profile semantics silently. Nonempty STAT4 remains temporary unsupported and checked before stat1 plan publication; empty STAT4 remains no-sample evidence only.

If an existing conversion primitive cannot reproduce a storage class, keep a targeted temporary unsupported result for that relevant callback boundary until its owner is translated. Do not fall back to default costs. Native malformed stats are generally admitted and produce odd but defined planner estimates; malformed physical records remain corruption, not token errors. Public signatures/exclusions unchanged.

## Consumers and integration order

1. Schema constructs physical identities and defaults, applies immutable stat snapshots, then runs sqlite3AnalysisLoad1988 post-load defaults on every index lacking HasStat1, then freezes graph. That second default pass can floor a named table count to99 even after table-only stat1; retain HasStat1/width and recalculate missing index prefix[0]. Existing resolution-only transient tables require an explicit nonphysical/default estimate bundle (not fabricated root-zero btree plans); census constructors before making fields required.
2. where-plan.ts btreeLoops/capabilities obtain table row count and index prefix estimates from the same owners. Preserve candidate sequence, source masks, NULL/equality guards, exploration budget and s-d ordered insertion.
3. where.c3552: non-IPK index step cost = nOut+1+trunc(15*indexWidth/tableWidth); IPK scan cost=nOut+16; then LogEstAdd(rLogSize,cost). Translate estLog(rSize) with rSize from **probe.aiRowLogEst[0]**, not an independently chosen table estimate, and the table-lookup branch with current logical arithmetic, not physical bytes. where.c4050 synthetic probe width=3; where.c4239 full scan eligibility includes width< table width under the existing covering-index-scan gate, and full scan run cost uses same truncated ratio. Preserve noncovering lookups/residual reduction/error ordering; this is not merely a tie-field fix.
4. where.c5818 whereLoopIsNoBetter: only two indexed loops participate; candidate smaller width is better; all other cases noBetter. No optional missing-metadata bypass for produced indexed loops. Existing candidate solver order/unsorted bounded slots stay intact.
5. Ordinary and joined SELECT compile callers consume chosen capability unchanged. Private production program OpenIndex roots plus runtime accounting must prove selected access. They must not re-rank or mutate schema estimates. count optimization in select.c owns separate smallest-index choice (upstream analyzeC count examples); report required future caller, do not opportunistically rewrite SELECT count in this card.

Rejected alternatives: JS object/page byte measurements; number truncation via `|0`; widths from key count alone; independently injected loop tests as sole acceptance; token whitespace normalization; dropping NULL/unknown idx rows; treating persistent autoindex as automatic query-index support; broad optimizer reimplementation. No new public diagnostics/config/services, no main-file writes or native distribution.

## Native-first artifacts and denominator (initial draft evidence; revision below supersedes counts/hashes)

`test/conformance/capture-row-width.py` uses verified pinned native library, writes development fixtures, closes and reopens READONLY. `cases/row-width-native.json` records source identity/archive hash, each fixture hash/bytes, typed NULL/INTEGER/REAL IEEE754/TEXT UTF8/BLOB cells, column names, prepare error code/message, binding runs using native reset+clear, EXPLAIN QUERY PLAN and actual cursor operations, sqlite_schema/stat1/index_xinfo. 21 states × 3 encodings = 63 snapshots: before/after ANALYZE, swapped sz, clamp/overflow/max, NULL idx/stat/tbl, unknown idx/table/token, BLOB names/stat with embedded NUL, numeric classes, spacing/tab/sign/uint64 overflow, WR table-name mapping. No STAT4 credit. Native controls are not TS coverage credit.

`row-width-preimplementation.test.mjs` adds typed public initial/reset/rebind/clear assertions, covering/noncovering REAL, collation/affinity/NULL/order, forced scan/expression/WR controls; immutable default assertions and **real** planWhere single/joined handoff; production compileSelect OpenIndex roots from frozen native EQP (no helper-injected loops or new diagnostic seam). Frozen swapped widths discriminate ta versus tb; max-int exercises joined tb plus sorter. Public join currently returns [] for nonempty pinned results: a separate live joined path gap, not evidence that width alone will fix correctness. Route to semantic owner; do not change expected rows or suppress join.

Upstream mapped scope: analyzeC.test has 24 explicitly declared do_*test calls (including setup/row/EQP controls; no general SQLite denominator). IDs 4.0–4.3 and 5.0–5.3 test sz selection via count(a); mapped only stat/width producer semantics here, **zero exact test-port credit** because SELECT count optimization is separate. 4.4 maps clamp/table fakeIdx empty-IN behavior; fixture clamp uses nonempty ordinary queries instead, not a direct port. Existing case 6.* names and other optimizer families are not claimed. Our 63 native snapshots/102 TS test nodes are separate denominators, not added to upstream credit or advanced24/30.

## Initial validation / operational residuals (historical)

Build command: `sh tools/oracle/build.sh` (exit0). Native generation and independent read-only recapture: `python3 test/conformance/capture-row-width.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" --regenerate`, then without --regenerate (both exit0). Disposable build/logs remain card work child, never runtime/main-file writes. Native test fixture bytes 4,632,576 (63 files). Final JSON size/hash and final baseline recorded in status.

Initial test run 72/72 failed, partly a test bug using nonexistent columnName; repaired to public columnMetadata.name, **not** weakened expectations. Second run 0/72 passed: public join typed-row divergence, stat loader rejections and absent default metadata. Third run 3/84 passed before bounded LIMIT capture refinement; rerun required against final artifacts. No broad compatibility claim. Retained errors/cleanup/reset guards require implementation-stage affected suites; existing unrelated root reds remain unwaived. Full column origin metadata, duplicate/cross-table stat order, embedded-NUL/invalid-byte encoding matrix, and a standalone full cost/tie equality discriminator remain bounded follow-up evidence needs (the production width/root tests cover real handoff, not every branch). No exhaustive unrelated optimizer research.

Planner decision requested: approve immutable owner/physical-field contract and exact callback parser boundaries before implementation; assign schema/WHERE producer-consumer work together, with joined row correctness routed separately. Follow-up must add explicit cost-vector/table-only sz/table-row-count assertions and remaining physical/default cases to the same production acceptance, not helper-only loops. OR-set/lowering, STAT4, wider IN/range, skipscan/BIGNULL/automatic query indices/star/multisource ORDER remain residual. Preserve page-local corruption/resource/cancel/private-state and all s-d guards; run affected broad tests after runtime work, not infer them from this proposal.

Initial draft artifact evidence (superseded by revision): bounded result captures use LIMIT 4 for larger ordinary
rowsets (native recaptured after changing SQL; same expected result scope applies
to TS). 63 DB exports remain 4,632,576 bytes; JSON is 4,043,234 bytes, SHA256
`7422878346c004c25344cbd1f73c616835089f18cf4ee7beb7896802c67dc325`.
Generator SHA256 `c4a5ffc5a23de2736d4e4c4cca9ae0cc40225d18aff008aa4b78ec699aaac6bb`.
Final test file SHA256 `d0acda34bb6b0ba3278b45d082603b722e527bb30c3ed8ad707eaaad374f6dfb`.
Final baseline after extra physical/stat owner assertions: exit1, 102 attempted,
3 passed / 99 failed / 0 skipped. Passing nodes are real chosen-production-root
before-ANALYZE checks in all three encodings. Failing public nodes retain the
joined typed-row divergence ([]) on otherwise supported defaults; sz rows reject,
metadata absent, and malformed stats remain unrepresented. No expected native
result was weakened. Typecheck exit0; git diff --check exit0. Prior erroneous
test API call and earlier runs remain recorded above, not characterized as runtime
failures. Current HEAD `6ba3b52c2a3d4740164656882618aa37e5f64280`; exact dirty/index
inventory in `card-s-e-row-width-inventory.txt`. Index is empty; peer vdbe.ts and
run-advanced-index-ts.test.mjs edits and untracked t-card artifacts preserved.
No src edits by this card, no staging/commit, no API change.

## Review revision: R1–R4 (2026-10-04)

Immutable preceding review: `record:///review.md?card=card-s-e-a&v=3`.
R1 corrects semantic ownership above: global index decode versus argv[0] named
table assignment. Cross-table/partial/duplicate/reversed snapshots and immutable
assertions preserve both table identities, flags, prefix slots and width.
R3 adds unsigned hex/case/zeros/sign/overflow controls and documents GetInt32's
actual else-if ordering. R4 captures and publicly asserts a second execution after
reset **without clear/rebind**, before distinct rebind and clear-to-NULL; prepare
error message is asserted at the prepare operation along with code.

R2 adds forced ordinary/joined real planWhere setup/run/output vectors for covering
and noncovering access; path rows/cost/unsorted recurrence from actual selected
loops. No helper-injected loop ranking or runtime diagnostic is added. Table-only
low/high controls assert immutable count/width, post-load floor99, real rowid/table
scan vectors. Full-scan equal/larger width controls remove competing covering
indexes, freeze native table access and assert forced-index scan ratio cost.
Tie states remove partial competitor, use sz16 versus20 (LogEst40 versus43;
16 versus17 would round equal), table sz1048576 (LogEst200), identical prefix
1024/10. Both truncated ratios are3; forced real producer vectors must be equal
in setup/run/output; unforced cover chooses ta when smaller, tb when smaller or
equal. ORDER BY id control separates ta order proof from tb sort cost. Native
access differences alone are not claimed as internal trace proof of every solver
comparison; these are branch-isolating production acceptance with explicit
cost equality prerequisites, preserving unsorted slot order rather than sorting.
Indexed-versus-table boundary is covered by full scan equal/larger and rowid
controls; exotic solver/multi-ORDER combinations remain outside bounded scope.

120 snapshots (40 states × three encodings) are now independent native-first
fixtures for this revision. tp exists only in cross-partial, so it cannot mask
ordinary tie/cost controls. Native writer closes before read-only capture;
recapture must equal recorded typed results, metadata, EQP and cursor operations.
Upstream denominator remains24 explicit analyzeC calls, zero exact-port credit;
additional native and TS nodes do not alter advanced24/30 or product exclusions.
No src runtime edits, signatures, public diagnostics, config or native deployment.
Planner assessment remains required before implementing schema/parser/WHERE
callers together; count optimization and live joined row divergence are separate
semantic owners. Historical baseline evidence above is not current acceptance.

### Revision validation (author-run, not independent Reviewer execution)

Generation and independent read-only recapture both exit0 (proc-1645bfed1509).
120 exports total **8,785,920 bytes**, all120 byte/hash validations passed.
JSON 11,251,579 bytes SHA256
`bede4de16474ef866a26b52d2c4f853f867c031897203fa2ea451a6b5db2ae48`;
generator SHA256 `ef22dc414032b76a3c89ad5dd7cb2f3418290db894fb46a54d34ae82c7623044`;
acceptance SHA256 `4a63f4adc403d9d44126d6ebb04f1965551094c1d6ffd80a8ab7af46f675b8f7`.
Native controls include reset-retained typed rows. Current TS command remains
`node --experimental-strip-types --test test/conformance/row-width-preimplementation.test.mjs`:
**exit1,237 attempted,9 passed,228 failed,0 skipped** (proc-93a8eea04ab2).
Passing: before-ANALYZE physical roots ×3, table-only-low/high compile roots ×3.
Table-only compile roots pass because existing default path coincides with native;
this is NOT count/width handoff credit (immutable/vector assertions still red).
Missing estimate metadata, sz rejection and joined typed rows remain red.
Intermediate revision237/237 red (proc-434d93c25fcc) included a partial competitor
masking ordinary roots; native fixtures were corrected, not expectations relaxed.
Typecheck exit0 and diff check exit0 (proc-3f78ff4189ce). Current HEAD and complete
dirty/index inventory appended to companion inventory; no staged paths, no owned
runtime source change. Selected tests are deliberately failing preimplementation
acceptance, not compatibility evidence. No broader suite waiver implied.

Representation contract: immutable schema LogEst scalars and rowLogEst entries
remain bounded JS numbers (existing schema convention); convert explicitly to
BigInt at WHERE boundaries. Logical planner calculations remain BigInt; lexical
unsigned64 and GetInt32 parsing are independently bounded source semantics.
Unnecessary competing owners, native runtime, new trace API and callback token
normalization remain rejected. Operational effect is development artifact size
only; read-only runtime freeze/default/stat publication must preserve current
resource/error order when implemented. Residual expanded declared-dimension hex
matrix, invalid-byte callback encodings and full metadata are not claimed covered.

## Second review correction — per-round path state

Preceding immutable review: `record:///review.md?card=card-s-e-a&v=6`.
The previous acceptance recurrence incorrectly fed prior **total** cost into
joined extensions. Corrected against pinned where.c5961–5965,5993–5995,6109:
start rows/total/unsorted at zero for these top-level, empty-ORDER controls
(nQueryLoop=0; source seed MIN(nQueryLoop,48)). Each loop adds prior rows to run,
LogEstAdds nonzero setup, then LogEstAdds **prior unsorted**. Publish total from
that extension, then unsorted=total-2 for every no-sort round; accumulate output
rows separately. Subsequent rounds consume that biased unsorted, not total.
No runtime solver repair is proposed or needed to correct this test owner.

A dedicated real `path-bias` SQL control uses tie-equal fixture with outer IPK
lookup and forced inner covering ta (CROSS dependency), no ORDER. Native typed
rows/access/lifecycle are captured before TS execution. Source vectors outer
setup0/run37/output0 and inner setup0/run45/output33 distinguish final total51,
unsorted49 from erroneous prior-total52/50. Real planWhere must publish these
values, and real compileSelect roots must match captured native access. Fixed
numeric assertions prevent a loop-only reconstruction from hiding a recurrence
regression. General production-cost tests now maintain separate accumulators,
including setup branch; no helper-injected candidates or new diagnostics.
Previous 237-node baseline remains historical, not the refreshed result.

Second-revision author validation: native regeneration and independent read-only
recapture exit0/exit0 (proc-70bd2d4a2e20). All120 export hashes/bytes verified,
8,785,920 bytes unchanged. All three tie-equal native path-bias EQPs select outer
INTEGER PRIMARY KEY and inner COVERING INDEX ta. JSON now12,307,559 bytes SHA256
`29c20873490cc9f689280b0fb4e052ce4693a76259c5178d2f6e805972a969bc`;
generator `c8be442e5504e1d30673edb1db50715c3fda3b6070e14beea22b11134124b966`;
acceptance `c3aa96a9eb97268cc6b40b10cca343738679e9889ce874d03e95214cb2eef0d2`.
Refreshed same TS command: exit1,240 attempted,9 pass/231 fail/0 skipped
(proc-fd8a76e107a4). New joined vector nodes reject at existing sz loader before
cost assertions: intentionally red preimplementation, not demonstrated runtime
path correctness. Prior9 root passes remain not estimate credit. Typecheck and
diff check exit0 (proc-33ba79ba7737); actual HEAD/dirty/index inventory appended.
No src runtime changes, no expected result weakening, no broader suite claim.

## Post-runtime acceptance correction — exact no-ORDER versus ORDER (2026-10-04)

Diagnosis supplied by [[card:card-s-e-b]] status v171/current v183 handoff is
material evidence, not runtime authorization. Fresh pinned read-only controls
were captured before the corrected acceptance was executed, **after runtime
implementation**: not retroactive preimplementation native-FIRST. Exact auxiliary
`SELECT a FROM t WHERE a=1` selects tb for tie-small-a, tie-small-b and tie-equal
in all encodings. Previous no-ORDER smaller-width expectation was false for
small-a (three assertions). Only that disproven expected identity changes; forced
cost equality, public typed rows, reset/rebind/clear, path cost and compiled native
roots remain required.

Source comparison: where.c2744–2808 whereLoopFindLesser first requires identical
iTab/iSortIdx, then dependency/setup/run/output dominance. It does **not** compare
width. No-ORDER ta/tb equality candidates can collapse here before the solver;
adding width to dominance would alter upstream. where.c5800–5821
whereLoopIsNoBetter belongs to equal solver cost/output/unsorted comparisons,
not admission dominance. Actual `SELECT a FROM t WHERE a=1 ORDER BY a` retains
source order-useful sort identities: native ta for small-a, tb for small-b/equal.
Acceptance now passes the actual lowercase binary OrderRequirement to production
planWhere for this control; forced vectors still prove equal setup/run/output,
then the unforced ORDER case discriminates smaller versus equal/larger width at
the source solver boundary. Existing ORDER BY id control (ta versus tb sorter)
and forced joined path-bias control stay unchanged. The earlier prose saying
unqualified unforced cover chooses ta when smaller is superseded by this exact
SQL distinction, not a broader algorithm exception.

Sorter assessment: the live reverse-sorter>=3 assertion in
`run-advanced-index-ts.test.mjs` is pre-existing peer/parent coverage, not authored
by this architecture acceptance. Exact forced m_abc JOIN reverse b SQL and
NOT INDEXED control are identified in `card-s-e-implementation-review.md`;
its native SORT0/scan1 contradiction must be disposed by that owner/parent.
No peer sorter test was changed, no sorter added, no public rows relaxed.
Original root semantic failures (reported475) remain mandatory; this bounded
expectation correction is not their resolution. No src runtime edits or candidate
ordering/dominance changes; s-d guards/exhaustion retained.

Post-runtime correction validation (author-run): fixed-input native regeneration
and independent read-only recapture both exit0 (proc-d2eb0de0f3bf), 120 exports,
8,785,920 bytes; all export size/hash entries reverified. Earlier recapture
proc-a29ed00709e6 failed because the author changed generator inputs during the
run; this sequencing failure is retained, not attributed to runtime. The initial
ORDER test used uppercase BINARY instead of the internal lowercase collation;
its 240-node result was111 pass/129 fail, not the final gate.
Final corrected acceptance proc-532d458c2628: **240 attempted,120 pass/120 fail,
0 skip, exit1**. All120 private production nodes pass; all120 public nodes remain
red at joined typed-row comparison (empty versus native nonempty). No public
rows or lifecycle expectations weakened. Aggregate row-width command
proc-93fa26896ba9: **1962 attempted,1490 pass/472 fail,0 skip,exit1**; reduction
from attributed b checkpoint475 is exactly the three disproven no-ORDER identity
expectations, not resolution or waiver of semantic failures. Typecheck and diff
check both exit0 (proc-3f70d1368651). These checks do not approve b runtime or
replace independent review of its other assertions. Peer sorter disposition
remains with parent/peer owner; no runtime edits made by this card.

Current artifacts: JSON14,737,868 bytes SHA256
`4ad0e43f934f8fa4c2e3a2f56d443e0cd8a88a890adbb3e737794d2a6777a115`;
generator8785 bytes `afd8092323a0b2cb7cc981635faddbf03c6b11c83507205302dc2780f58e5ce2`;
acceptance15072 bytes `e40c293aad26781d8482b4781749b80477ee2e117e07048267ec93a3c6e0e5a3`.
HEAD remains6ba3b52c2a3d4740164656882618aa37e5f64280; staged index empty.
Actual dirty inventory appended in companion. Review scope is this bounded
source/test expectation correction, not runtime implementation acceptance;
architecture residuals and source denominator above remain unchanged.
