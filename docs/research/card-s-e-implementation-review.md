# Current bounded schema-width implementation handoff

Requested independent **component and system review**, via [[card:card-s-e]]; component expectation owner [[card:card-s-e-a]], implementation [[card:card-s-e-b]]. Not full implementation acceptance. Supersedes cumulative checkpoint narrative for review entry; history remains in status.md.

## Current owning changes (unstaged)

Against HEAD `6ba3b52c2a3d4740164656882618aa37e5f64280`:

|Path|Current diff +/−|Owned responsibility|
|---|---:|---|
|src/internal/schema.ts|261/67|column affinity/dimensions; table/index defaults; WR/PK physical-layout authority; one default/stat1/post-default/freeze cache publication; callback Mem/NUL/uint64/size/global index/named table ownership|
|src/internal/where-plan.ts|105/21|explicit numeric→BigInt logical costs; indexed ratio/seek/lookup/full eligibility; unchanged insertion dominance, width tie on surviving paths; prior unsorted recurrence; residual cardinality; missing CollSeq caller errors|
|src/internal/parse.ts|29/6|declared type preservation; syntax integer production|
|src/internal/resolve.ts|6/8|IPK and transient publication|
|src/internal/mem.ts,utf.ts|2/2,17/0|shared encoded callback conversion/surrogate branch|
|src/index.ts|2/1|schema format error public boundary|
|src/internal/vdbe.ts **mixed**|30/14|owned IPK/WR mapping/transient freeze/LEFT null-pass continuation; peer arithmetic remains separate|

Current VDBE hunk anchors (old line):1,8,1660,2079,3463,3536,3552,4155,5236,5261,5548,5764,6611. Arithmetic hunks1660/6611 are peer, not owned. Earlier checkpoint29 split is stale: review current diff, not old patch. Guide/source map/audit are also mixed. No whole mixed-file staging. Current tracked test changes include stat-format/stat-record boundaries (own corrected source assertions) and ordered cost assertion; advanced-index test is peer. All row-width test/capture/case/fixture additions are review evidence; original native expectations preserved. Full exact dirty inventory and current VDBE diff: purpose-named `width-handoff/inventory.txt`, `vdbe-current.diff` beneath card work root. Index empty, diff-check clean.

## Source contract to review

`build.c` sqlite3AddColumn/AffinityType/estimateTableWidth/estimateIndexWidth/default vectors/WR conversion; `analyze.c` callback/decodeIntArray/post-load defaults; `util.c` GetInt32/Atoi; `where.c`3552/4050/4239/5818 and candidate dominance2744; residual3037/3579/4173/4279. `docs/research/card-s-e-estimate-census.md` enumerates persistent and four transient owners. Shared immutable layout owns structural fields even without executable KeyInfo; supported executable descriptor shares identical field/PK arrays. No competing statistics, JS bytes, re-ranking, discarded-loop revival, STAT4 or skipscan credit. Constructor/error-cleanup census beyond these observed publishers and full arbitrary-byte/alias/expression/join metadata coverage remain incomplete; review those gaps rather than awarding closure from sample count.

## Fresh current verification

Commands use `node --experimental-strip-types --test`:

* `npm run typecheck && ... test/conformance/row-width*.test.mjs`: **1962 total,1487 pass,475 fail**, zero skips/cancels; typecheck passed. proc-38e4f504409d.
* Advanced/candidate lifecycle/ordered exhaustion/stat choice/multisource/relational lifecycle plus value private-state, HTTP acquisition, Btree storage and first-select suites: **205,204 pass,1 fail**; sole retained reverse-sorter assertion. proc-44c23414b9b1. Exact advanced credit remains24/30, not universal compatibility.
* Reacquired R2 native capture then `where-order-consumption-public.test.mjs`: **63 prepared comparisons,0 execution/error differences**, test1/1, proc-8c2cafb6e194.
* Reacquired pinned-byte Chinook then `test/schema/catalog-init.test.mjs`: **14/14**, proc-69ef61e18b90.
* Focused publication/transients/width/error controls **132/132**, proc-97314ac767e3, reused unchanged source; aggregate above is now fresh after caller change.

Logs/hashes retained in card work `width-handoff/`. Original120 snapshots8,785,920 bytes reused, not recaptured; sourceID and fixture hashes in manifest/proposal/capture JSON. Native expectations development-only, not product runtime.

## Mandatory residuals, grouped by owner

**475 = original123 + isolated349 + joined-WR3.** These overlap by behavior, not independent compatibility gaps; do not sum additional test denominators.

* **Candidate insertion expectation,3 original tests:** exact `SELECT a FROM t WHERE a=1` native tb9/9, TS capability/OpenIndex/typed rows/reset9/9 (`row-width-insertion-tie.test.mjs`, native JSON). Original `tie-small-a` ta expectations remain unchanged. where.c2744 discards later equal loop before5818 tie; width must NOT enter candidate dominance. Parent requested to route evidence/expectation correction to [[card:card-s-e-a]]. No authorization or delivery inferred.
* **Root existing SeekRowid/REAL affinity and joined semantics:** isolated120 join +120 path-bias +109 rowid failures with JS-number original bindings. Live SQL in `cases/row-width-native.json`: `SELECT a FROM t WHERE id=?1 LIMIT 4`; `SELECT x.id,y.c FROM t AS x CROSS JOIN t AS y WHERE x.id=?1 AND y.a=x.a ORDER BY y.id LIMIT 4`; `SELECT x.id,y.a FROM t x CROSS JOIN t y INDEXED BY ta WHERE x.id=?1 AND y.a=x.a LIMIT 4`. Current isolated public tests preserve number bindings, reset/clear/rebind, native nonempty. Existing source branch rejects initial REAL before lossless NUMERIC affinity (vdbe.c5495); historical HEAD0/360 vs current11/360, BigInt diagnostic not acceptance. Root mandatory [] versus native nonempty before ANALYZE remains visible, not all original123 assigned unrelated. Request existing semantic owner diagnosis; no independent SELECT repair here.
* **Root joined WR storage fence,3:** `SELECT x.a,y.b,hex(y.c) FROM w x CROSS JOIN w y NOT INDEXED WHERE y.a=x.a ORDER BY x.a,y.b`; native `[A,2,00],[é,1,FF]`, current compile fence, same HEAD fence. `row-width-wr-joined.test.mjs` fresh red. Ordinary WR mapping passes do not cover joined access.
* **Reverse-sorter assertion:** exact forced m_abc joined query and NOT INDEXED control (`cases/advanced-index.json`/advanced suite). Native rows3,2,1; forced SORT0/scan1. Current parity six encoding controls passed historically; peer assertion still asks sorter>=3. Parent disposition required, not adding sorter to satisfy assertion.

## Previously missing artifacts — acquisition now resolved locally

* `$SAIVAGE_CARD_WORK_ROOT/r2-native/capture.json`: produced via `python3 test/conformance/capture-where-order-consumption.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" --output-dir "$SAIVAGE_CARD_WORK_ROOT/r2-native"`. Script asserts manifest sourceID. Original unavailable path now present, fresh public63 comparison above.
* `$SAIVAGE_CARD_WORK_ROOT/chinook-fixture/Chinook_Sqlite.sqlite`: download exact URL in `test/fixtures/public/chinook.json`, require1,007,616 bytes/SHA7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15 before use. Download verified and four catalog missing-input tests now pass as part14/14. Mutable upstream URL must never bypass hash validation.

## Review request and remaining delivery gate

Please independently inspect width-only producer/callback/constructor/cost/tie semantic ownership, selected immutable access and typed lifecycle, preserving peers. Review bounded implementation despite mandatory cross-scope reds; do not require unrelated broad green or waive native rows. Expanded metadata/census/resource completeness remains a stated gap, not another unknown-collation feature assignment. No independent review received; no staging until coherent owned paths reviewed. Parent/root disposition and existing-a expectation correction requested through parent; this document is a durable request, not proof of notification delivery.

### Width-only acceptance pass (current, after handoff)

Fresh owned suites: all `row-width*.test.mjs` except preimplementation,
isolated-public/isolated-joined,wr-joined,tie-full =270/270, typecheck0.
Exclusion is a reporting partition, NOT waiver: separately ran mandatory
preimplementation/isolated/WR joined1692:1217/475. Together exactly1962:
1487/475, no skips/cancels. `tie-full` exclusion pattern matched no files.
Additional selected/callback/failed-publication/STAT4/corruption/private-state/
HTTP/Btree/first-select80/80. Commands/logs in current status.

Strengthened REAL noncover test now connects same immutable physical descriptor
and chosen capability, setup/run/output BigInt, OpenIndex exact root, native five
metadata fields to public retained reset/clear/rebind and cache identity through
all three encodings;3/3. No runtime changes; rows/native fixture unchanged.
Constructor and estimate-use scans refreshed under width-acceptance work child;
persistent defaults/stat1/post-default/cache and four transient constructors are
identified. Nested arbitrary expression/error/cancellation completeness remains
bounded, not universal proof. Component/system review is now explicitly requested
on this270-green owned partition plus mandatory475 residuals; independent review
has not yet been received. Do not convert reporting partitions to acceptance.

Latest exact cost contract: REAL noncover native-metadata regression asserts
source-derived one-bound clamp/min, truncated width ratio, seek LogEstAdd and
separate table lookup (not merely BigInt type). Exact run/output and descriptor/
root/public lifecycle pass3/3; focused producer/callback/cost/residual/tie/
publication/transient160/160 and typecheck0. No new runtime change/native
recapture; mandatory475 unchanged evidence remains applicable. Bounded execution
slice ready for independent review; review scheduling/dispositions require
parent action, not another unrelated runtime workaround.
