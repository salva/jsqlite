# Retained FROM coroutine prefix correction

Base: integration-delivery6f84136bf2926eee66ede913eb8aff98da1745d5,
tree55546ae79f6e49178e037e337b0d7d74cda5a9d7. SQLite3.53.4 sourceId
2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc.

## Owning comparison

select.c:7266–7300 checks CteUse, global right-join marker, coroutine optimization,
self-join-view, first-source shortcuts, then walks backward over actual SrcItems.
At each edge it rejects JT_OUTER/JT_CROSS and each prior isSubquery. The actual
caller compileResolvedTableProducer incorrectly supplied source.index>0. Physical
prefixes therefore materialized despite native coroutine eligibility. Replacing
that fact with constant false would break genuine subquery/barrier prefixes.

precedingFromCoroutineBarrier walks the same represented prefix: derivedSources
(or derived fallback), cteDerived and schema.views retain subquery identity;
physical catalog tables do not. All three helper callers now use this primitive.
The specialized derived caller already requires two sources and physical outer;
the CTE fallback checks one source only, so its prefix remains empty. Existing
CteUse/materialization, self-view/OpenDup, scope/readiness and global right-join
gates are unchanged. This does not expand admitted SQL or flatten children.
LEFT/RIGHT flags imply native JT_OUTER (select.c sqlite3JoinType:221ff), even
when parser.outer denotes only the explicit keyword; both spellings are barriers.
No exceptional algorithm substitution is involved.

## Verification and limits

Original proc-11abfa25aac4: unchanged from-subquery-routes20 tests,19pass/1fail,
missing InitCoroutine on exact original t1 fixture/query. W independently captured
8 typed INTEGER pairs and real coroutine opcodes in
work:///cards/card-w/beta4-6f84-verification/from-route-native.json; attributed
native evidence, not a new author capture.

First additional prefix test run proc-885e4e6b2628:50/51, failed implicit LEFT
barrier; chained tsc did not run. This exposed explicit-keyword versus native
JT_OUTER representation, corrected in the owning walk, not the example.
proc-cf4652ed2fd7 then51/51 plus chained tsc. Expanded final regression run
proc-9b03ea7fcc96:51/51, zero fail/skip/cancel, chained tsc exit0:

```
node --experimental-strip-types --test --test-concurrency=1 --test-timeout=60000 \
 test/conformance/from-subquery-routes.test.mjs \
 test/conformance/retained-filter-demand.test.mjs \
 test/conformance/select-derived-table-compound-owner.test.mjs
./node_modules/.bin/tsc --noEmit
```

Original opcode prohibition unchanged. Existing public all-encoding typed rows,
metadata/reset/error and resource/lazy invocation tests pass. Added primitive
regressions cover multiple physical prefixes, prior derived/view/expanded CTE,
remote and immediate CROSS, implicit/explicit LEFT and RIGHT. Expanded CTE
prefix is a constructed post-expansion carrier test, not new public CTE coverage.
No independent acceptance or full509+39 gate claimed. Separate correlated20k
watchdog failures remain ROOT investigation; no performance fix claimed.
Primary author log: work:///cards/card-m-f-k/processes/proc-9b03ea7fcc96/stdout.log.
