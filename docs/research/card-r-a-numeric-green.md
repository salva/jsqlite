# Numeric production repair on complete785b

Base `785b01a3a711692f6056f78380ff66a57a6744a7`, tree `db73c82830ce07280dc650e00f912bf0eb6441b8`. [Red evidence](card-r-a-numeric-red.md) and its probe remain unchanged. Independent review: [finding](card-r-e-error-position-review.md).

## Owner comparison

`jsonTranslateTextToBlob` numeric production (json.c1820–1975) now owns TS Parser.numeric: sign/leading-zero/hex branches; leading dot; floating-state and seen-exponent bits; duplicate dot/exponent rejection; exponent sign advancement; missing-digit marker/sign error; trailing-dot JSON5; plus stripping and raw spelling. Parser.value dispatches numeric starts directly, not delimiter-token regex validation. Removed superseded numeric regex predicates. Existing depth ownership, unknown literal errors, scalar binary encoding/extraction and consumers remain unchanged. Signed infinity is normalized by the same numeric branch as pinned C. JS indices remain UTF16 code-unit offsets; existing jsonErrorPosition alone converts them to Unicode character counts. No parallel error-only parser.

Pinned jsonConvertTextToBlob leaves iErr at initialized0 when a successfully parsed value has trailing junk. Parser.parse now matches that error production, so `0x` remains position1 rather than spuriously moving to2 after partial numeric parsing. Strict JSON validity still rejects JSON5 via the existing strict Parser mode. No exceptions or platform algorithm substitutions.

## Primary evidence and verification

[Capture](card-r-a-numeric-capture.py), [native results](card-r-a-numeric-native.json):43 finite inputs, source-verified pinned CLI identity3.53.4 / `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`, capture proc-a44a1aed570b exit0. Public regression json-numeric-production.test.mjs compares exact INTEGER positions/strict/JSON5 validity, canonical text and full JSONB hex for valid inputs in3 encodings, reset stability and typed malformed/reset/finalize/recovery. Includes exponent/sign/EOF/delimiters/comments, leading zeros, hex, dot, signed infinity, nesting and Unicode.

Initial diagnostic pipeline to head caused EPIPE (proc-75a8546d5c06); not acceptance. Full diagnostic rerun exited0 (proc-76d3d1a44544); new differential tests3/3 (proc-91af4befe5e8). Final exact785b archive plus source/test edits: `npm run typecheck` then `node --experimental-strip-types --test --test-timeout=30000 test/conformance/json-*.test.mjs`, proc-5063f6f86d7d exit0,1997 passed0failed/cancelled.

## Foundation cost investigation and residual qualification

Original exact785b standalone3-test matrix passed with16.7/17.8/22.9sec per test (red evidence); full-gate timeout remains retained, not erased. Generated nested JSONB helper spread every retained typed payload into boxed arrays on every wrapper. Replaced only that helper with Uint8Array allocation/set, preserving exact bytes/1000/1001 depths, number of queries, lifecycle work and unchanged30s timeout. No product cap/clock/depth change. After helper change, standalone3/3 passed13.160/13.106/12.186sec (proc-9d174efc65df); final JSON suite passed above. This bounds avoidable test-generation allocation, not native allocator fidelity or proof that every full369 scheduling environment meets30sec. Prior immutable20k6/6in29.742 and wrong-relocated31.626 remain distinct reported inputs. The independent full369 gate must still be rerun by integration; no claim60+1timeout is green.

All author verification ran an isolated complete785b archive, not peer workspace source. Delivery is an isolated commit/export for independent integration; no MAIN/index/peer changes or whole-goal compatibility claim.
