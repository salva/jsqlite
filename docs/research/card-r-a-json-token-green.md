# JSON5 name production repair — card-r-a

## Source comparison and boundary

Input: complete `429876289cadb84d154483c3b543674b498571df` (tree `fb78b3443e494272862d072ba787c83ee0fb178a`). Independent original evidence: `work:///cards/card-r-e/processes/proc-33ed5bc7c112/stdout.log`, as attributed in card-r-e-jsonb-error-position-review.md. First nine fixture rows retain all original bindings/controls including nested `[Inf]`.

Pinned SQLite3.53.4 `json.c:aNanInfName/jsonTranslateTextToBlob(default)` → `Parser.literal`: table order inf/infinity/NaN/QNaN/SNaN; first-byte/case-insensitive prefix then ASCII alphanumeric boundary. FLOAT payload is `9e999` (not the display replacement `9.0e999`); NaN aliases produce actual NULL, not number-shaped NaN. Strict mode rejects nonstandard names. Lowercase null tries exact standard production then falls through; t/f fail directly after exact literal/boundary checks. No case-insensitive boolean/null extension. Signed numeric inf retains its existing distinct optional-inity/prefix rules; signed NaN remains rejected. No independent whole-token scan remains. UTF16 cursor/ordinary ordered nodes are representation adaptations, not algorithm substitution.

Object caller first tries value production: successful non-TEXT labels fail at label entry; only a failed producer permits identifier fallback. This matters for `{inf:0}` versus `{infx:0}`. Quoted labels remain strings. Complete-text conversion treats NUL at current trailing cursor as C terminator, not trailing junk, while required children/strings still reject NUL. Existing whitespace, numeric, string, binary validator and ambiguous-BLOB owners remain unchanged except this conversion boundary and object admission.

## Tests-first evidence

`python3 docs/research/card-r-a-json-token-capture.py <retained source-verified json-boundary-oracle/build/sqlite3> <assembly>/test/conformance/json-token-native.json` verifies exact3.53.4 source ID before independently capturing3129 finite cases. No rebuild claimed. Capture is development-only, not runtime. Public Fetch bound TEXT in all3 encodings asserts INTEGER flags1/2/15/error, reset/re-step, canonical TEXT/full JSONB bytes and json_type/typeof extract/json(jsonb()) composition against captured native results. Cases enumerate source names/case/sign, prefixes/suffixes (ASCII alnum/underscore/nonASCII/NUL), EOF, delimiters, comments, nesting and label/value distinction; finite coverage is not universal JSON compatibility.

* proc-ac146f0590ad: capture succeeds; original429876 new suite fails3/3 on first `Inf`.
* proc-ffc5f75e196c: translated name owner exposes trailing NUL conversion divergence on `inf\0`.
* proc-7806b197e705: conversion fix exposes object label admission on `{inf:0}`.
* proc-3715b327a111: source-derived object value-first admission passes3/3 new tests.
* proc-ae7204dc40db: typecheck and12/12 string/TEXT/whitespace/numeric tests pass.
* proc-2ac01f8176b7:8/8 Unicode/JSONB validation/BLOB/flags-order tests pass. Final help command is not used to infer those passes.

One dedicated edit of internal disposable assembly was refused by the file tool's internal-state protection; subsequent assembly generation used run_command at the supplied purpose-named card work directory, not generic private-state modification. No workspace runtime overwrite or default-index/MAIN movement.

Resource limitations remain: constant bounded name table adds no unbounded scan; synchronous JSONB validation still lacks per-byte cooperative charging/yield, and representative VM admission/reuse is not cancellation/deadline/heap equivalence. Full configured gate/REAL/package/independent acceptance and whole-brief obligations remain open. Prior full429876386 configured/2 completed/384 unperformed plus8 prerequisites is not green. Prior timing/setup failures remain in accepted status history; this finite repair does not erase them.

Final default bounded gate proc-9e1371ff5a32 exit0:21/21 files including all12 boundary wrappers and new token suite. Authenticated proc-b305f0384656: concurrency1/watchdog30/input_drift[]. Retained manifest `work:///cards/card-r-a/json-token-final-gate/integration-run/manifest.json`, SHA256 `0c7fd1018eec12bb96acc62e4743d26f389f2ce0b224d8e38309112789a05e74`. No full configured pass claimed.
