# Immutable estimate ownership census — card-s-e-b checkpoint 25

Scope: current checkout, not accepted compatibility. Parent [[card:card-s-e]] architecture approval does not accept runtime. Pinned sourceID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. Re-read build.c2222–2257,4551 onward; current schema/WHERE constructors. This census replaces no native expectations.

## Persistent construction and publication

| State / source owner | Actual TS owner and consumers | Evidence / limit |
|---|---|---|
| AddColumn/AffinityType dimensions | schema ColumnNode.szEst, parse complete declared type | Original/declared20-column hex controls and raw UTF8/UTF16 controls; full arbitrary byte matrix open |
| AddPrimaryKey before WR conversion | schema declaredIntegerPrimaryKey; rowid alias publication and implicit delayed WR creation share it | inline/table DESC, WR delayed and merge controls; direction metadata in new controls source-derived, not native xinfo |
| CreateIndex grammar linkage and conflict merging | implicitIndexDefinitions retains ordinals/list positions, linkIndex APPDEF cleanup | conflict history/native index_list controls; full grammar/error census open |
| convertToWithoutRowidTable | compact same column/collation, retained primary terms own storageKey; synthetic PK aliases table root | WR duplicate/distinct-collation/IPK fixtures; joined mapping not certified |
| estimateTableWidth | columns sum plus no-IPK slot, LogEst(*4) | TableNode.szTabRow; physical storage unchanged |
| estimateIndexWidth | exact PhysicalIndex.fields column szEst or1, not declared key count | IndexNode.szIdxRow; WR PK suffix mapping authority |
| DefaultRowEst | defaultRowEst uses table floor99, partial decrement10, prefix sequence and unique final0 | immutable IndexNode.rowLogEst; no WeakMap stat competitor |
| AnalysisLoad callback/decodeIntArray | schema callback shared Mem DB encoding→UTF8 bytes, C NUL, ASCII key; named-table update distinct from global index lookup | native callbacks/invalid UTF8/UTF16; complete invalid-byte matrix open |
| post-load missing defaults, freeze, publish | schema final index defaults/freeze then table freeze then graphs.set | checkpoint38 cached graph/owner/physical backlink/freeze/read-only mutation120/120; errors before graphs.set do not cache successful graph; public prepare SchemaFormatError→sqlite11/cause; full cleanup/resource proof open |

Construction is automatic identities → retained grammar linkage → APPDEF insertion → defaults → stat1 callback → missing defaults → freeze/cache. STAT4 samples reject rather than claiming represented selectivity; noSkipScan retained without skip-scan implementation. Duplicate stat order retained. Producer mutations occur only before publication; schema numeric estimates explicitly become BigInt WHERE costs.

## Transient constructor inventory

- resolve.ts nested compound derived producer: columns szEst0, table szTabRow1, nRowLogEst200, no IPK/root0/no indexes.
- vdbe.ts CTE tableForCte owner around2083, derived metadata producer around4159, synthetic derived owner around5777: same width placeholders0/1. These are SELECT columns, not persistent AddColumn widths. select.c2246 zero allocation,2376 says szEst unused,2432 allows any nonzero table width.
- Source-derived nested resolver test covers actual resolver owner. Top-level direct resolver harness initially fails no-such-table:d; VDBE handles that separate owner. Public derived VALUES/CTE composition covers bounded executions, not all constructors.
- No transient PhysicalIndex publishes root0 as persistent access. Literal mock tables can retain older fallback identity; real/transient producers publish explicit column/null.

## Actual consumers

where-plan.ts indexLoopEstimate owns where.c3552 seek,4239 full-scan ratio/truncation/table-lookup costs. Persistent schema widths are bounded number; logical costs BigInt. Synthetic IPK probe width3 is independent, not persistent IndexNode width. Full-scan admission, candidate insertion/exhaustion, sort identity and prior-unsorted path recurrence remain source branches, not width-based insertion ranking. Tie compares exact width only among retained equal-cost paths; it cannot revive discarded candidates.

planWhere produces selected capability; compileSelect ordinary/joined lowering uses its physical root/fields. Supplemental production checks assert setup/run/output and tc OpenIndex roots covering/noncover; internal costs are source-derived, not independently captured native internal costs. Public ordinary typed rows/column names/errors/reset/rebind/clear1080 cases and direct-column origin metadata3 cases are bounded evidence. Joins stop original public nodes early and remain unwaived.

## Review isolation and residual gates

Current unstaged source inventory: schema224 additions/53 deletions, WHERE53/19, parse29/6, resolve5/7, Mem2/2, UTF17/0, VDBE20/10 (mixed peer changes). Whole-file VDBE staging is inappropriate: isolate earlier owned physical-column/IPK changes and checkpoint24 placeholder literals; preserve peer arithmetic/advanced work. Documents also contain mixed history. No staging or implementation review acceptance at this checkpoint. Current checkpoint29 unstaged VDBE inventory29 additions/14 deletions:
11 owned hunks27/12 (IPK identity, SELECT placeholder widths, WR physical mapping,
LEFT synthetic-null continuation) versus2 preserved peer bitwise hunks2/2.
Both isolated patches reverse-check against current checkout; index untouched.
Review patch SHA0d5f2093fb804320850b2aaf09c8fa85383502e206518382e5cc5b31ee028b7e
stored purpose work child width-twentyninth, not a staged delivery or review approval.
Fresh width1416:1293/123; affected/resource229:228/1; standalone typecheck0.
Whole-file VDBE staging remains inappropriate. Census is not permission to stage
unreviewed paths.

Original acceptance240:117 pass123 fail. Latest width1410:1287/123; selected greens do not waive these. Root SeekRowid REAL numeric conversion/join and no-order tie/reverse-sorter expectation dispositions remain pending; no assertion that all123 are unrelated. Advanced credit24/30; analyzeC exact0/24; missing broad artifacts remain open. Complete metadata aliases/expressions/joins, declaration hex/invalid bytes, page-local/offpath/deadline/private-memory matrix, constructor error ordering and independent component/system review remain required. No universal optimizer, STAT4, skip-scan, OR or count optimization credit.

## Checkpoint46 current constructor/publication refresh

Actual src census (not only field-name prediction): persistent schema table480;
index linkage construction followed by physical width/default pass564, stat1
584–599, missing defaults/freeze600, graph cache609. statisticsForIndex88
returns exact index; graphs409 is identity cache,not statistics competitor.
No other persistent estimate publisher found in src scans.

Transient owners: resolve453/455 compound-derived result; vdbe2083/2084
materialized source metadata,4160 transientSourceTable for derived/CTE,
5782/5784 derived aggregate metadata. All use column0/table1/rows200,
no persistent index. select.c2376 column estimate unused;2432 width1;
2464 rows200 and no IPK. Found publication divergence: result metadata tables
and index arrays not consistently frozen,despite immutable consumer contract.
Shared freezeTransientTable now publishes completed nonphysical metadata:
resolve bindTransientProducer,vdbe transientSourceTable and immediate metadata
constructors,SchemaGraph.withTransientTable. Does not run persistent defaults
or ANALYZE; WeakMap producer linkage stays external,not competing statistics.
No visible-affinity/collation/storage changes; physical indexes prohibited.

This freezes scalar/array ownership,not every nested Expr/foreign-key object or
all cancellation/error transitions. Exact cleanup/transient execution census
still bounded; missing external native artifacts unchanged.

Checkpoint47 strengthens regression at actual withTransientTable boundary:
current3/3, isolated source with only boundary freeze removed0/3 (all frozen
invariant failures). No inferred native internal metadata claim. Fresh broad
publication/derived/CTE/compound200/200, typecheck0 via &&; fresh width1956:
1481/475 (no skips), original mandatory reds retained. Resources49/49;
affected170:168/2 includes original reverse-sorter assertion and missing
r2-native/capture.json input, not a new transient regression. Units omitted by
mistyped test/unit paths rerun at actual acquisition/storage/value/select paths.

Checkpoint48 transient error-order coverage: physical root and nonempty index
metadata rejection precedes any freeze; repeated publication retains exact
owner; original cached persistent graph unchanged. Three encodings pass;
isolated late-guard mutation0/3 frozen-array failures. Fresh publication/WR/
STAT4/corruption159/159, no skipped/cancelled. Public compound reset separate.

Further census uncertainty: physicalIndex325 can return null for unsupported
collation/NULLS/key production; persistent default width574 currently falls back
to1 in that case. build.c2236 sums all aiColumn fields,regardless supported TS
access. This branch needs explicit unsupported-schema tests and owning policy
review rather than pretending width1 is source-faithful. Existing supported
fixtures do not establish this branch is unreachable; no compatibility credit.

Checkpoint49 real unknown-collation index reproduces fabricated width (3/3 red).
Pinned native ordinary q scan succeeds with A in all encodings; forced qi returns
SQLITE_ERROR/no query solution. Tried whole-schema rejection,then reverted:
that blocks legitimate table scan and is not a coherent source-faithful policy.
Need structural field ownership separate from executable built-in KeyInfo;
no width1 fallback or global rejection credit. Final tests retain expected
structural width LogEst(108) (CHAR100=26 plus rowid1),still0/3. No runtime change
retained this checkpoint; missing four Chinook tests remain unwaived.

Checkpoint50 resolves nullable executable descriptor width fallback. Shared
physicalIndexLayout builds source declared/stored/PK-suffix/rowid fields once;
IndexNode.layout immutable owner persists regardless CollSeq support. Exact
supported PhysicalIndex.fields/PK arrays reference same owner; executable
KeyInfo only constructed after all named collations supported. build.c2236
width uses layout fields;5653–5700 KeyInfo/unknown CollSeq deactivates access,
not source record ownership. Real unknown-collation3/3 metadata/public scan/
reset/forced-rejection matches pinned scan/nonusable-index observations;
full forced error code/message parity not asserted. No host collation support.

Checkpoint51 native WR unknown-CollSeq exact index_xinfo records agree with
shared layout fields: PK a custom DESC,b,c; same-collation suffix dedups a;
different-collation suffix repeats a custom DESC and maps PK [1,2]. Three
encodings frozen metadata/source widths pass3/3; independent native ordinary
WR read and forced secondary reads fail prepare1,TS rejects too (not exact
code/message parity). New36,864 fixture bytes; no WR executable access credit.
Fresh complement156:153/3 includes existing joined-WR storage fence failures,
not new owner regressions. Checkpoint50 width/affected evidence reused runtime
unchanged; independent review/root/parent/native-input gaps remain unwaived.

Checkpoint52 unknown-CollSeq caller now preserves native SQLite error1 rather
than temporary unsupported: forced unavailable index => no query solution;
unforced WR unavailable primary storage => no such collation sequence.
Owning btreeLoops uses retained layout names; existing capability gating/cost
ordering unchanged. build.c5653–5700/where.c6169 branches; six encoding controls
assert exact public kind/code/extendedCode/message/null classification across
repeated prepares,stable graph and immediate close. First harness syntax error
corrected;final6/6. Fresh affected173:170/3 existing joined-WR fence only.

Current width-only acceptance refresh: constructor/estimate-use scans show
persistent layout at three index ownership transitions; all persistent defaults
and callback updates precede623 index freeze,630 table freeze,632 graphs.set.
Transient root/index rejection precedes mutation at422; resolve binding764 and
VDBE2084/4165/5785 use same freeze publisher. No second statistics publisher
found. Bounded source scan does not certify every nested expression cleanup.
Fresh owned270/270;mandatory1692:1217/475 separately retained. REAL noncover
metadata lifecycle test now checks exact selected capability/physical/root,
frozen layout identity and metadata after retained execution,not just samples.
