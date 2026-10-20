# Retained recursive prefix RIGHT/FULL — bounded repair

Base: `6a0a8966224b3ed7fe1e0bcab58305631c9fa257`, ordinary
`card-n-b-compound-delivery` checkout. [[card:card-k-e]] status retains command
receipts and previous failed patch/obsolete assertion qualifications.

## Owner and boundary

The recursive ordinary joined consumer previously declined every RIGHT/FULL
before creating retained readers. Its retainedCursors/cursorFor contract already
feeds the original shared WHERE owner. Admission now permits physical RHS while
still declining a retained recursive RHS. No alternative evaluator, match-key
descriptor or recursive queue replay was introduced. Compound/window admissions
are unchanged; WR primary-key and module drains remain separate gaps.

Pinned `wherecode.c` 2738–2802 records RHS identity after ON and before WHERE;
`sqlite3WhereRightJoinLoop` nulls preceding handles then runs the fresh RHS scan
and shared interior. TS rightStates, NullRow, residual and Gosub branches retain
that ownership. Physical RHS rowid is unchanged. Retained prefix Column reads use
the actual retained cursor, not resolver rootPage or queue registers. `select.c`
tag-select-0484 maps to the existing OpenDup readers: shared records, independent
position/null state. Materialization completes before either match/drain pass,
and remains charged until final reader cleanup. This preserves the existing
bounded materialization tradeoff, not native streaming/work-count parity.

## Reproducible finite evidence

Build with `tools/oracle/build.sh`, then run
`python3 docs/research/recursive-join/right-full-native.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"`.
The script verifies manifest source ID and reads INTEGER/NULL plus all five
metadata fields through pinned C APIs. `right-full-native.json` retains 54 cases
(18 SQL × three actual corrected fixtures); each was stepped/reset twice.
The public test compares exact typed values and metadata, twice per case.
Cases include the original red query, duplicates, false/NULL ON, WHERE, empty
prefix, aggregate, downstream independent alias including non-null b with null a.
That last discriminator observes reader-null independence during unmatched drain.

Run `node --experimental-strip-types --test test/conformance/recursive-cte-right-full.test.mjs`.
Additional tests cover entry and post-row cancellation/reset, timer cancellation
during long production (cooperative yield), private entry/byte limits and reuse.
These do not establish exact failure-opcode placement inside match insertion or
native allocation parity, all value classes, arbitrary join composition or full
product/release acceptance. Adjacent existing RIGHT/FULL resource tests remain
separate evidence for shared match tracking; no blanket compatibility claim.
