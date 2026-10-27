# WITHOUT ROWID declaration ownership

`prepare.c:sqlite3InitCallback` constructs a declaration once and blank-SQL catalog rows attach roots to existing indexes. `build.c:sqlite3CreateIndex` merges duplicate column/collation sequences ignoring direction and updates linked order (4330–4377,4496–4515). `convertToWithoutRowidTable` retains the primary identity, delays INTEGER PK creation, compacts repeated column/collation pairs, and aliases the root (2354–2455).

The loader separates declaration construction and persisted-root attachment. Its load-local `Map<TableNode, definitions>` retains the first WR computation and actual column objects; this is not SQL memoization, a public model or a performance claim. Raw definition terms remain separate from compacted physical PK terms. Ordinary rowid timing is unchanged. The root/index-link/statistics/publication owners remain unchanged.

Reproduce with explicit paths (no install needed):

```
export WR_ORACLE=<pinned-build>/libsqlite3-oracle.so
export WR_FIXTURES=<owned-work>/wr-declaration/fixtures
python3 test/schema/capture-wr-declaration.py
node --experimental-strip-types --test test/schema/wr-declaration-identity.test.mjs
```

Capture checks source ID against manifest before generating three encoded databases and native `index_list/index_xinfo`, exact typed selected cells and five-field metadata for six tables plus expression/type controls. It also reopens four corrupted-schema variants per encoding: missing-PK-name vs STRICT type competition, invalid conflicting clauses, orphan explicit table link and invalid root. Tests compare native rejection codes/messages as well as linked positions, key direction/collation, column identity, table-root alias, immutable publication, cancellation/retry and independent reopened owners. Public reads preserve INTEGER as decimal strings, REAL as numbers, TEXT, NULL and BLOB hex separately, and compare every metadata field. Original string-normalized green evidence remains revision-bound; it is not retroactively typed evidence. The loader now uses `prepare.c:corruptSchema` object context at the affected PK-name and explicit-index linkage/root failures; declaration order and error codes are unchanged.

Existing `stat4-schema-lifecycle.test.mjs` and `stat4-prepare-controls.test.mjs` supply low allocation/work/deadline/cancel/no-publication/same-owner retry controls. `stat4-enabled-boundary.test.mjs` reuses source-ID/hash-checked native all-encoding selected/forced typed-row receipts on exact fixtures; these are representative consumers, not optimizer estimate parity. Fixtures/receipt are reproducible disposable evidence, not committed full captures. The source-shape assertion discriminates one WR construction plus three retained attachment consumers and preserves ordinary-rowid fallback. It is not a runtime work counter. Accepted red v56's global no-replay assertion also flagged ordinary rowid recomputation; that is intentionally outside this WR-only repair, not silently generalized away. Original red evidence stays in accepted record history.

Current execution details/hashes and limitations are in [[card:card-e-h]] status. Independent whole-path review and combined enrollment remain separate acceptance. Selected tests do not establish exhaustive corrupt-root/error-order/resource parity or optimizer behavior.
