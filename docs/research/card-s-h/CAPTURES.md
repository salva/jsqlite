# STAT4 capture inputs

`skiprange-native.json` is a compact, lossless regression fixture: all original
17 queries ×2 profiles ×3 encodings, typed rows, plans/programs, work counts,
samples, setup and fixture identities remain. Identical typed rowsets are shared
by SHA256 instead of repeated. `read-skiprange-capture.mjs` validates the hashes
and restores the original consumer shape; no SQL, expected rows or assertion is
removed. This is development-only data, never a shipped runtime dependency.

`skiprange-search.json` is an exploratory summary, not a golden test input. It
retains all29 differing plans, setup, counters, native source identity, typed-row
counts and equality hashes instead of duplicating every result row. The raw
capture is retained in the operator's verified pre-repair backup. Other accepted
useful20k/branch/ablation fixtures remain unchanged.

Reproduce with the pinned SQLite3.53.4 libraries, one with ENABLE_STAT4 and one
without. Scripts assert source identity; writes are fixture setup only:

```sh
export SAIVAGE_CARD_WORK_ROOT=/path/to/disposable/card-work
python3 docs/research/card-s-h/capture-skiprange.py /path/stat4.so /path/no-stat4.so
python3 docs/research/card-s-h/search-skiprange.py /path/stat4.so /path/no-stat4.so
```

Generated fixtures, full raw captures and compact outputs go under that work
root, not the source checkout. The capture script's `--useful` mode remains
available. Inspect outputs before intentionally updating committed goldens.

Raw histories/captures and the complete pre-repair Git state remain in the
operator's external history-repair backup with old→new commit/blob mappings.
Historical source-era hash references in accepted records/research remain facts
about their original bytes; they are not rewritten into fabricated new evidence.
