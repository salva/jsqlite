# Ordinary extraction producer correction

Author evidence for [[card:card-r-b]], not independent acceptance. Finding:
[exacta352 independent review](card-r-e-extract-review.md), accepted status v105.
Pinned SQLite source ID is recorded in `card-r-b-extract-native.json`.

## Source ownership

Read pinned `json.c:jsonExtractFunc`4074–4195 and actual VDBE dispatch. The former
TS extraction pre-scanned all NULL paths before parsing and directly accessed
Mem bytes; its jsonb wrapper reparsed a TEXT result. The translated shared
`jsonExtractFunc` now admits the document first, then converts and releases each
reached private path Mem, performs lookup, and produces single or multipath
results with the native flag relationships. NULL stops only at its position;
errors before it remain errors. Arrows use the same owner with JSON_ABPATH and
JSON_JSON/JSON_SQL behavior retained. No parallel evaluator or SQL-text shortcut.
Private document-conversion Mem is released with finally in `parseJsonMem`.
Node/array intermediates remain ordinary GC-owned objects; this is not a resource
census or exhaustive malformed JSONB parity claim. Existing eager node decoding
and rendering boundaries remain; no exceptional new algorithm is introduced.

## Tests and hypothesis qualification

Before implementation, development C API capture pinned 184 native cases and
public three-encoding regression failed 0/3 (`proc-81ea51c87d3c`), exposing direct
Mem access. Matrix includes malformed/NULL order, INTEGER/int64/REAL/BLOB paths,
sequential errors, missing/scalar/container output, subtype consumers and JSONB.
Public checks value class, value/bytes, exact SQLite metadata and two reset
executions plus finalize. These are finite lifecycle checks, not resource-zero
or cancellation/deadline proof.

First repaired run: typecheck and arrows passed; extraction failed 0/3
(`proc-8b52cd4261a9`). Inspection of all seven differences per encoding showed
harness representation errors: JS Number stringification of REAL1.0 as '1',
Uint8Array stringification instead of bytes, and native column_text conversion
for BLOB. The capture now reads BLOB via column_blob/bytes; the public harness
compares REAL numerically while retaining class and BLOB hex exactly. Direct
REAL results replace hex(REAL) tests, which had tested a separate formatting
consumer rather than extraction. No product changes were made for these harness
differences; no native case was excluded. This capture refinement followed
implementation, unlike the initial 184-case capture.

Current guide and map link here; exact commands, primary outputs, delivery hash
and remaining verification obligations are synthesized in current status.md.
No full-suite, exhaustive malformed corpus or independent union approval.
