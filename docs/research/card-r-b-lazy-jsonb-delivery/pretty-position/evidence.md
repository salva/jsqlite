# F5 — pretty consumed-position ownership (experimental, not adopted)

## Current source contract

Pinned SQLite3.53.4 `src/json.c:jsonTranslateBlobToText` returns the first
unconsumed byte. NULL/TRUE/FALSE return `i+1`, even with a nonzero size nibble.
`jsonTranslateBlobToPrettyText` forwards this return for scalars and uses the
plain renderer for object labels; labels can themselves be containers. The
plain renderer sees the whole parse, not a slice bounded to a guessed extent.
Pretty containers instead return their declared end. Object labels receive the
current incremented indentation depth; label overshoot is checked before colon
and value traversal. Ordinary scalar extents, header failure and reached payload
errors stay with the existing plain renderer. No strict validator is introduced.

`jsonBlobTextAt(bytes,at,depth,charge)` now returns `{value,next}` from that
existing renderer. `jsonBlobText` remains its root wrapper, preserving compact
callers. `jsonPretty.visitBinary` forwards `next`, releases output Mem after raw
publication, and passes label depth+1. This is a caller-contract correction, not
an algorithm substitution, eager decode, tag-specific pretty special case or
second evaluator. It preserves raw byte publication and F1–F4. Text pretty,
strict validity, public contracts and native depth boundaries are unchanged.

## Tests and primary evidence

Tests/capture were authored before the runtime change. Fresh author execution
of the retained pinned library (not a new compilation/profile certification):

```
python3 docs/research/card-r-b-capture-pretty-position.py \
 <r-e>/review37-verify/oracle-profile/build/libsqlite3-oracle.so \
 docs/research/card-r-b-pretty-position-native.json
```

[Capture output](work:///cards/card-r-b/processes/proc-9a5488a91270/stdout.log):
85 binary cases,1530 statements, each twice; all3enc native in-memory encoding
PRAGMAs (not persisted native encoded images). Receipt SHA
`284dfac2cae733924b09b236a8ce9a0f5407aa896189663770300f527f0961b7`.
Library SHA `b74284142511a672e841ef5c370cab35f2d873912082319831759459bba05347`;
source `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.

The public Fetch regression compares pretty/default/empty-indent, compact,
valid4/8 and error_position. Cases include nonzero and nonminimal NULL/boolean
headers, siblings of different tags, scalar roots, labels/containers, nested
parent boundaries, reserved and truncated headers, raw text tags. Values here
are TEXT/INTEGER, not a REAL/BLOB result matrix. All five prepare metadata
fields, columnType, exact text/integer value, error kind/code/message,
repeated step/reset saved-error identity, valid TEXT rebind, DONE/finalize and
DB/server close are checked in all three encoded fixture images.

Preimplementation runs:
- [Initial harness failure](work:///cards/card-r-b/processes/proc-2f7f074ec736/stdout.log):
  metadata key typo `declType` rather than `declaredType`,0/3. Corrected harness,
  not a product diagnosis.
- [Corrected pre-repair run](work:///cards/card-r-b/processes/proc-9e0a20377ad7/stdout.log):
  0/3, malformed JSON from pretty traversal. Failed-case finalize propagated the
  saved error before the collected assertion list; it is not a complete failure
  census. Original explicit public witnesses/expected values remain in
  [accepted status292](record:///status.md?card=card-r-b&v=292).
- First shared-renderer repair: typecheck and new regression3/3
  ([output](work:///cards/card-r-b/processes/proc-0d765fba8376/stdout.log)).
  Source review then corrected label depth to depth+1, matching C iDepth;
  no depth1000 runtime-guard claim or generator rewrite was resurrected.

Final runtime:
- `npm run typecheck && node --experimental-strip-types --test test/conformance/json-pretty-position.test.mjs test/conformance/json-pretty-corrections.test.mjs`:
  typecheck PASS,24/24,exit0 ([output](work:///cards/card-r-b/processes/proc-621d29fb73b8/stdout.log)).
- `node --experimental-strip-types --test test/conformance/json-pretty-position.test.mjs test/conformance/json-foundation-boundaries-binary-*.test.mjs test/conformance/json-pretty-corrections.test.mjs test/conformance/json-depth-oracle-*.test.mjs test/conformance/json-pretty-live-binary-*.test.mjs test/conformance/json-lazy-*.test.mjs test/conformance/json-pretty.test.mjs`:
  **70/70**,0fail/cancel/skip,exit0,25.346s
  ([output](work:///cards/card-r-b/processes/proc-a80c4a0391c0/stdout.log)).
  Depth components24.26–24.44s. Preserves legitimate1001 too-deep expectation,
  raw-byte probes and live interruption controls.
- Broader exploratory affected paths (additional path/table/encoding/aggregate/
  direct Window tests):251/251,exit0,39.822s
  ([output](work:///cards/card-r-b/processes/proc-7f35516c7b9a/stdout.log)).
  Begun before final label-depth adjustment; not claimed final-input full gate.

## Exact export and applicability

`identity.json` and `runtime.patch` in this directory are an incremental repair
against reviewer combined4959 manifest
`fd9ee31c25072a20c6f37d0e13cd420387682f31c594282e689f3e405b001349`.
Base json.ts `9c9c56b3025c868a73f87151760becdcd36732ec545abd173594f9522dee5220`;
result `4d2009a767e8aaad49878e60f3fa13a294d1f35f609c8fcc14cde35d6e3a72b5`.
Patch SHA `1e447f9585a4eaa2640c8f5883a5a4d83e3800f173292a9b7534683a09bff6c7`.
[Authentication](work:///cards/card-r-b/processes/proc-086fc425bdf3/stdout.log).
Apply only to that authenticated runtime; copy the provided test to
`test/conformance/json-pretty-position.test.mjs` and root receipt to
`docs/research/card-r-b-pretty-position-native.json`. Preserve earlier exports;
this replaces neither their provenance nor the accepted depth-resource tests.
Experimental source is `work:///cards/card-r-b/json-lazy-admission/source`.
Root runtime/index/MAIN/peer inputs are not adopted or committed.

This finite malformed-binary compatibility evidence is not a guarantee for
arbitrary invalid JSONB. Independent combined full409+new/native8/immutable20k
under30/type/package and whole55/source/caller/API/lifetime/resource acceptance
remain required. Baseline4959 full green does not certify this replacement.
No new heap census/quota/browser gate; no publication/operator change.
All processes terminal; retained source/captures/logs remain owned.
