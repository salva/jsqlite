# Metadata cursor identity — bounded delivery

Current source: pinned SQLite 3.53.4, sourceID and image hashes asserted by
`tools/oracle/capture-metadata-identity.py`; independently captured typed rows,
all five metadata fields and repeated drain/reset/finalize/close receipts in
`identity-native.json` cover UTF-8, UTF-16le and UTF-16be.

`pragma.c:pragmaVtabClear/Filter/Next/Rowid` owns each occurrence's iRowid:
clear before argument conversion, zero initial counter, increment before step,
first row 1, clear at EOF. `resolve.c:lookupName` gives real columns precedence
before implicit aliases. The TS MetadataFilter/Next/Close owner retains the same
counter independently of visible cid/seq; singleton/mixed payloads, linked WHERE,
AggInfo and window sourceRow carry that identity without a physical B-tree or
JSON identity surrogate. Resident SchemaGraph is retained only when resolution
has a real SchemaGraph, never fabricated for a shared caller.

`vdbemem.c:valueToText/sqlite3ValueText` conversion uses a private Mem because TS
stores one byte-kind rather than concurrent MEM_Blob/MEM_Str representations.
Tradeoff: temporary value/byte copy; producer storage remains unchanged. Filter
clears before converting and copies the C-string prefix. Selected BestIndex
hidden-EQ reductions carry invocation-owned omit identity into WHERE/ON;
unselected duplicates remain residual. This is not a replacement evaluator.

Native-first regression and failed-hypothesis evidence is retained in
[[card:card-e-n]] status248/251/254/257: conversion-only removed a crash but
returned no rows until selected omit ownership was corrected. Correlated binding
repair follows source identity and enclosing covering-index storage location,
not coincident cursor numbers. `metadata-identity.test.mjs`, the positive former
boundary suite and Mem-core tests retain the original reproducer. Finite scalar
invocation controls cover saved errors/cancel/reuse/private exhaustion separately;
these do not establish exhaustive mid-execution cancellation, malformed UTF or
all linked/group/window compositions. Shared runtime cleanup returns metadata
generators on statement reset/finalize/error; early LIMIT retains statement-owned
state until cleanup. Independent finite acceptance covers the entire 15-path
identity producer/caller delta at `404b6d00c526765b9dc777fb2def7fa773c4e895`,
tree `f2bdce2536223e88c59afb0a2bbc09d131135bf3`, against `34a7fdf4`:
[[card:card-e-l]] `record:///status.md?card=card-e-l&v=269`.
Earlier pending-review provenance remains in [[card:card-e-n]] accepted status261/264/269.
Generic unsupported composition and exhaustive lifecycle/UTF coverage remain open;
root [[card:card-w]] latest352/38/36/18 exact-artifact replay remains separate.

Detailed artifact identities and verification commands/results are retained in
those card records. This document is source rationale, not a whole-product
compatibility claim.
