# Review37 R2 — resolve before scheduling

Parent: `4d1ccfa6e284abdbacec885650de15737e12f98f`; accepted red evidence is
`record:///status.md?card=card-r-d&v=129`. Delivery hash is recorded in current
card status (this document is part of that delivery).

## Source comparison and correction

Pinned resolve.c lookupName counts matches over the complete NameContext source
scope before selecting a column or reporting ambiguity (754–785). whereexpr.c
produces prereqAll from resolved expression source usage (1156–1197), then
wherecode.c defers terms with unavailable sources and outer-join constraints
(2620 onward). The old mixed producer instead called bind(term,false), hiding
the JSON schema, accepting physical collisions and removing them from residuals.

The bounded binder now optionally records resolved SrcItem object identities
while resolving against both sources. Ready-term lowering resolves all split
terms first, then schedules by those identities, not by trial binding a smaller
schema or catching name errors. Nested expression branches propagate the same
set. JSON payload and identity register replacements retain source identity in
that set; physical columns retain affinity/collation and physical identity.
Nested SELECT ownership remains its own NameContext and is conservatively
residual; this does not certify generalized correlated planning. LEFT remains
outside early scheduling, preserving ON-match-before-WHERE and NULL extension.
Arguments continue to have their original left-to-right scope. No sorter,
destination, cursor, rowid, metadata or resource implementation was replaced.

## Evidence

`card-r-d-resolution-capture.py` uses the independently built pinned3.53.4
library and asserts its full source ID. It creates ten-column physical collision
fixtures natively in UTF-8/UTF-16LE/UTF-16BE; the capture embeds those exact bytes.
480 prepare errors cover all ten visible/hidden names, bare and nested-coalesce
AND expressions, WHERE/ON and all four modules. Exact code1/messages and prepare
phase are asserted publicly, followed by recovery SELECT1.
156 qualified controls independently capture full descriptors, storage-class
rows, error phase/code/message, native reset and repeated execution: physical
skip/survive malformed, JSON-dependent and mixed residual malformed, LEFT
physical/JSON deferral and valid qualified sources. Public controls repeat/reset
and finalize, reusing the established readiness harness.

Commands in `$SAIVAGE_CARD_WORK_ROOT/resolution-repair/source`:

- `python3 docs/research/card-r-d-resolution-capture.py > docs/research/card-r-d-resolution-native.json`
- `npm run typecheck`
- Node strip-types test runner: resolution two suites, mixed-readiness,
  mixed-ordered, mixed-rowid-integration, grouped-rowid-metadata,
  physical-left-red, ordered-integration, ordered-resources, selected-in-integration.

Final typecheck and1413/1413 tests passed (proc-b38f885ae2b2); logs in purpose
child typecheck-final.log/regressions.log. Untouched original red240 native/SQL
inputs rerun with only source import redirected:240/240 exact prepare errors,
proc-d745aaa403c6. Original red artifacts remain unchanged in resolution-red.

Attempt history: initial typecheck rejected nonexistent Expression kind
`parameter`; corrected to actual `variable`, no runtime workaround. First focused
resolution480 + readiness240 passed. Controls generator accidentally retained
its reused serializer's output call, producing two concatenated JSON documents;
two runs failed parsing before tests. Removed duplicate serializer output,
then636/636 passed. Consolidated repeated fixture bytes without changing SQL,
regenerated capture and final1413 passed. These harness failures are not runtime
successes. Logs controls.log/controls2.log/controls3.log preserve them.

No original225/package/Chinook/CHECK/FK or global planning/corpus/release claim.
Earlier qualified-malformed readiness tests remain in the final verification.
Parent/r-e independent review and integration remain required.
