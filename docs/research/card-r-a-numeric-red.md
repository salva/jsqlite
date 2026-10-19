# Numeric parser red on complete785b

Exact input `785b01a3a711692f6056f78380ff66a57a6744a7`, tree `db73c82830ce07280dc650e00f912bf0eb6441b8`, extracted by git archive to `$SAIVAGE_CARD_WORK_ROOT/json-numeric-red-785b`. Existing workspace/index edits untouched; no runtime repair performed. Independent finding: [review](card-r-e-error-position-review.md).

## Public/native comparison

Public command: copy [probe](card-r-a-numeric-red-probe.mjs) into `test/conformance/` of the exact archive, run `node --experimental-strip-types test/conformance/json-numeric-red-probe.mjs`. Process `proc-b78ac89674fc`, exit0 (diagnostic, no assertions of native equality), compares INTEGER class and checks reset/re-step stability across UTF8/UTF16LE/UTF16BE. Primary full output: `work:///cards/card-r-a/processes/proc-b78ac89674fc/stdout.log`.

Pinned CLI command: `$SAIVAGE_CARD_WORK_ROOT/json-boundary-oracle/build/sqlite3 :memory: < $SAIVAGE_CARD_WORK_ROOT/json-numeric-red-785b/native-numeric.sql`. `proc-7a20e428a2d7`, exit0, exact native identity3.53.4 / `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. Reuses the source-verified native build established in prior red; source identity unchanged.

| Input | TS error-position | Native error-position |
|---|---:|---:|
| `1e` |1|2|
| `[1e]` |2|3|
| `1e+`, `1e-` |1|3|
| space then `1e` |2|3|
| `["é",1e]` |6|7|
| `["😀",1e+]` |6|8|
| `01` |0|2|

`01` additionally returns json_valid flag2=1 in TS,0 native. Controls `1.`→position0/valid1, `0x`→1/0, `.e`→1/0, `1e2` and `1e+2`→0/1 agree. All listed public results are stable on reset in all3 encodings; error-position output remains INTEGER, not REAL/text.

## Ownership

Pinned jsonTranslateTextToBlob numeric branch consumes exponent sign and assigns iErr to exponent marker or sign if no digit follows (lines1940–1948). Leading-zero branches reject at the relevant digit. TS Parser.value instead scans a delimiter-bounded whole token, uses number/strictNumber regex predicates and rejects at token start. Thus numeric acceptance AND error production diverge before jsonErrorPosition's character conversion. Repair belongs to Parser numeric scanning/production, retaining depth ownership and all existing scalar binary/header consumers. No downstream SQL-specific offset patch is warranted. Unicode cases show the importance of keeping byte/character conversion separate from scanner positions.

## Foundation suite timing qualification

Same process also ran `node --experimental-strip-types --test --test-timeout=30000 test/conformance/json-foundation-boundaries.test.mjs` on exact785b:3 passed,0 failed/cancelled, per-test16.711/17.815/22.862sec; total58.408sec. This does NOT resolve the independently reported timeout under the full369 gate or replace its retained failed result. The current archive has3 encoding tests; preserve prior immutable20k6/6 timing29.742 and wrong-relocated31.626 as distinct reported inputs, not a new same-input measurement. Repair-stage timing investigation must compare generated workloads/lifecycle against C and retain30s timeout/depth/work controls unchanged; no weakening here.
