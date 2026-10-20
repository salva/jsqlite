# WR RIGHT/FULL corrective slice

## Source and current mechanism

Pinned SQLite 3.53.4 source ID:
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Base f1d4967bb3aae4b85c3d46970ec9d61ec5a74562 in admitted
`/work/jsqlite2/integration-delivery`; original protected checkout and peer work
are not delivery targets.

`where.c:7393–7425` selects rowid or primary nKeyCol/KeyInfo and clears
WHERE_IDX_ONLY for RIGHT RHS. `wherecode.c:2738–2802` reads the complete PK in
aiColumn order after ON, before WHERE, records membership but preserves every
matching combination. `sqlite3WhereRightJoinLoop` repeats identity lookup during
fresh RHS iteration, NULLs the left prefix and enters the same interior.

The TS translation retains per-barrier rightStates and rowid paths, uses existing
packed BLOBKEY machinery with case5KeyInfo for WR, and shares only physical PK
reads with Case5 OR. Column/RealAffinity reads use actual active binding. A fresh
drain can select a distinct primary/covering cursor; before Gosub it positions the
original interior primary reader using that scan's full PK. RIGHT RHS covering-only
binding is disabled, following where.c rather than remapping only the example.
Expanded WR direct/coalesced results use existing resolved column projection,
not reduction reconstruction. No new evaluator or SQL-text dispatch.

Existing packed private storage is a bounded browser representation: no native
B-tree/Bloom allocation or work-count parity is claimed. It retains typed complete
key comparison/collation/encoding, shared private budgets and ordinary cleanup.
No additional algorithm substitution is introduced here.

## Evidence and hypotheses

* Artifact/source identities verified before transfer in proc-799f8bee2252;
  initial three prepared artifacts and f1d4967 identity are recorded in card-k-e
  accepted status v21 and earlier retained records. Python/test moved using
  selected read/write; JSON regenerated with the pinned ordinary oracle library.
* Initial full-key implementation exposed expanded-star `resolved expression has
  no tree` (proc-82a593ddfa8b); responsible direct projection contract corrected.
* False-ON unmatched output then repeated final `A,2` instead of `é,1`, without
  ORDER too (proc-9d534a7984d6). Disabling covering-only RHS binding and adding
  matched-pass primary positioning alone did not repair it (proc-c1b2ad5df485).
  Fresh drain has its own selected cursor: positioning the interior reader from
  its active full key repairs the defect (proc-978c508dfed8, 3/3).
* Expanded pinned capture proc-168eb688064a: 318 executions = (44 width + 62
  mixed) × three encodings, twice reset, typed cells and five metadata fields.
  `wr-right-full-native.py` builds RTRIM/descending composite WR, mixed rowid and
  empty fixtures with the pinned C API and captures through that same library.
  Original width fixture retains repeated declared PK, NOCASE and width mapping.
* New matrix covers duplicate full-key prefix/nonunique joins, mixed rowid/WR both
  directions, each empty side/both empty, false/NULL ON, WHERE, stars, mixed
  LEFT/RIGHT/FULL, INTEGER/int64/REAL/BLOB/text/NULL, repeated barriers, existing
  USING/NATURAL and DISTINCT/LIMIT width cases. It does not claim all SQL shapes.
* New resource controls pass (proc-435ede9031ef, 9/9): private entry/byte rejection
  with later admission, initial work/deadline errors, abort after observed unmatched
  RHS output for matched/false-ON paths, reset/rebind. Abort is supplied at public
  step boundary; exact tracking-opcode failure/yield/deadline location is NOT
  established. This remains a broader resource-phase obligation.
* First adjacent run proc-f7d9635967e9 failed three obsolete WR prepare-rejection
  assertions. Replaced with unconditional existing pinned native executions,
  retaining corpus/fixture hashes. Sequential status commands had exit0 and did
  not turn that test run green.
* Final focused/adjacent run proc-939a17be4f7e: **191/191**, serial concurrency 1,
  seven files: without-rowid-right-full, without-rowid-joined,
  multisource-right-full, recursive-cte-right-full, repeated-right-full,
  recursive-cte-compound, relational-private-lifecycle. Chained TypeScript tsc
  and git diff --check passed. Full output is retained at
  `work:///cards/card-k-e/processes/proc-939a17be4f7e/stdout.log`.

Run commands from the admitted checkout:

```
python3 docs/research/recursive-join/wr-right-full-native.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" > docs/research/recursive-join/wr-right-full-native.json
node --experimental-strip-types --test --test-concurrency=1 test/conformance/without-rowid-right-full.test.mjs test/conformance/without-rowid-joined.test.mjs test/conformance/multisource-right-full.test.mjs test/conformance/recursive-cte-right-full.test.mjs test/conformance/repeated-right-full.test.mjs test/conformance/recursive-cte-compound.test.mjs test/conformance/relational-private-lifecycle.test.mjs
node /work/jsqlite2/node_modules/typescript/bin/tsc -p tsconfig.json
```

Independent full-delta review, exact-current parent package/browser gates and
broader phase-specific resource proof remain outstanding. Author green is only
the accepted reproduced WR gap, not release acceptance or arbitrary composition.
