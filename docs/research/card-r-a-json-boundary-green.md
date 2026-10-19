# JSON container-depth and header boundary correction

Base: `2274a1467ddaf5f6277d8f8596aa9ddcadc95851`. Reproduction and prior branch findings: [red evidence](card-r-a-json-boundary-red.md), [preserved diagnostic probe](card-r-a-json-boundary-red-probe.mjs).

## Current owning contract

Pinned `jsonTranslateTextToBlob` increments nesting only for object/array productions, not scalar leaves. `Parser.value` now follows that rule: skip whitespace, inspect the production, increment/check for a container only, decrement only that container after successful completion. Error abandons the per-call parser, as before; there is no shared counter to poison the next invocation. Both array and object terminals at depth1000 accept,1001 reject, whether the leaf is scalar or an empty container. No host parser or algorithm substitution.

JSONB rendering and strict validation deliberately have distinct entry depths. `jsonTranslateBlobToText` enters at depth0, whereas `jsonValidFunc` calls `jsonbValidityCheck` at depth1. Accordingly JSONB containing1000 arrays plus null **renders**, but strict flag8 returns0;999 arrays plus null passes strict validation. The earlier red diagnostic's strict1000 result1 was a second real entry-depth divergence, not a desired contract. Corrected `jsonValid` to pass depth1 to the existing validator. This does not add universal eager validation or change lazy table demand, recognized BLOB fallback, duplicate labels, raw numbers, JSON5, subtype or resource accounting.

Minimal TEXT JSONB headers at payload lengths11/12/255/256/65535/65536 remain exact. Tests bind independent bytes and text, compare entire BLOB output, render and strict validation, in all3 database encodings. Existing nonminimal CB controls remain unchanged.

## Native primary evidence

[Capture script](card-r-a-json-boundary-capture.py) and [native results](card-r-a-json-boundary-native.json) use the same-version verified CLI built during red. Full exact source identity is retained in the capture. Native hex is compared byte-for-byte, then compactly retained with header prefixes and SHA256 rather than a giant repeated ASCII payload. TEXT arrays/objects and scalar/empty leaves at1000/1001 are independently checked. The first attempted native capture rejected our incorrect hypothesis that strict JSONB1000 should pass (`proc-33ee376b20bc`, exit1, native0); pinned `jsonValidFunc` explained the depth1 entry and both TS and expectations were corrected. Final capture `proc-2f17ed5e3c22` passed; this is not broad conformance credit.

## Public regression and verification

`test/conformance/json-foundation-boundaries.test.mjs`:3 public Fetch tests (UTF8/UTF16LE/UTF16BE), minimal-header boundaries, complete bytes/classes/names, reset/re-step and copied BLOB survival after finalize; positive and negative TEXT nesting for both container productions and multiple leaf kinds; rendering, strict JSONB depth distinctions, typed malformed errors saved on reset, finalize cleanup and recovery SELECT1. Existing red probe remains unmodified evidence.

Validation uses an exact archived base with only the two source edits and new boundary test; not dirty peer sources. `proc-40bcb41c94ba`, exit0: `npm run typecheck`; `node --experimental-strip-types --test test/conformance/json-*.test.mjs`1871/1871 passed. Earlier focused new tests passed3/3 in `proc-0a3cfbad5dc7`. No claims about broader untested malformed header lengths, universal deep-validation, allocator identity, or whole-goal approval. Peer/index/deletion work remains untouched; standalone commit is for independent integration, not MAIN publication.
