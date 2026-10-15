# Mixed physical/JSON ordered consumer repair

Scoped to [[card:card-r-d]], based on committed MAIN
`3aae6a9a2fea4755802641a844152508b60c446c`. Exact checkpoint:
`SELECT t.x,j.value FROM t JOIN json_each(t.js) j ORDER BY t.x,j.key`.

The producer previously rejected ORDER/DISTINCT/LIMIT before opening cursors.
Pinned `json.c:jsonEachBestIndex/Filter` supplies hidden arguments and cursor
iteration, not arbitrary t.x/j.key ordering. `select.c:selectInnerLoop`,
`codeDistinct`, `computeLimitRegisters`, `generateSortTail` own the consumers:
WHERE, result projection, DISTINCT, sorter insertion, sorted drain, OFFSET,
result destination, LIMIT. The repair lowers the mixed cursor through existing
Found/IdxInsert, Sorter, KeyInfo, SelectDest and limit instructions. ON match and
NULL completion remain ahead of the same WHERE consumer. Physical and JSON
identity storage and metadata are unchanged. ORDER accepts source expressions,
result aliases (including COLLATE wrappers) and result ordinals.

The existing bounded memory sorter remains the shared representation; no new
host evaluator or JSON-specific sort algorithm is introduced. Full scan sorting
retains its existing private-state caps rather than promising native external
sort/spill or top-N resource equivalence. Other generic SELECT composition
limits, reverse correlation and unsupported join kinds remain unchanged.

## Revision-bound evidence

Work artifacts are under `$SAIVAGE_CARD_WORK_ROOT/ordered-consumer-repair`.
Native profile is independently pinned 3.53.4/full bf7c7f3 source ID; the checked
capture script asserts identity. New capture/test: 84 cases, four modules,
three encodings, complete ordered descriptors, typed rows, reset/re-execution,
DESC/OFFSET, DISTINCT both sorted and streaming, aliases/COLLATE/NULL placement,
LEFT empty identity and LIMIT0 malformed-input suppression. Fixtures are existing
encoding fixtures; initial t.n hypothesis was invalid (no such column) and was
replaced by physical rowid before acceptance. No invalid-query case is counted.

Workspace inherited direct-rowid metadata removal caused companion failures;
that peer change was preserved. An exact committed archive with ONLY this repair
is evidence authority. Applying the raw contextual patch failed on those peer
metadata differences; scoped owning blocks were applied preserving committed
metadata. Initial archive 78/84: tree container atom NULL sorted incorrectly.
Diagnosis was alias COLLATE resolution: the alias wrapper was bound as an
unresolved source column instead of resolving its result expression. Resolving
ORDER aliases recursively under COLLATE fixed the owning lowering (no data-case
specialization). Typecheck and 84/84 passed (proc-ec95359f79ae).

Exact checkpoint fresh native/current comparison on candidate source:
3/3 encodings, full metadata and both executions match (proc-d1d86f7a9fd5).
Native expected INTEGER pairs (1,10),(1,11),(2,20); native source/fixture/library
identities retained in capture/native.json. Same command then ran 287/287 shared
rowid/grouped-metadata/LEFT/JSON/selected-IN regressions. Existing observer
exit0 is not blanket corpus success. No broader release, PRAGMA, census,
Chinook/CHECK/FK or exhaustive resource/cancellation parity credit is implied.
