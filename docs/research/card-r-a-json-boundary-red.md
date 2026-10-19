# JSON foundation boundary red — committed 2274 input

Input: exact `git archive 2274a1467ddaf5f6277d8f8596aa9ddcadc95851`, extracted under `$SAIVAGE_CARD_WORK_ROOT/json-foundation-red-2274`. No dirty project sources or index entries were used. Existing foundation tests pass (2/2, process `proc-61231c521610`).

## Public boundary probe

Process `proc-1939312d9c9e` failed a source-derived assertion: `json_valid(?1)` for `'['.repeat(1000)+'0'+']'.repeat(1000)` returned INTEGER `0n`, expected `1n`. This reproduces an actual positive-depth defect, not a header decoder defect.

A diagnostic continuation (`proc-9357b4a98167`, exit 0) ran the same archived public Fetch adapter against `encoding-utf8`, `encoding-utf16le`, and `encoding-utf16be` fixtures:

- For payload sizes 11,12,255,256,65535,65536, bind a JSON string containing exactly N ASCII `a` characters and independently construct JSONB TEXT bytes. Expected prefixes respectively: `B7`, `C70C`, `C7FF`, `D70100`, `D7FFFF`, `E700010000`. Each query `SELECT jsonb(?1),json(?2),json_valid(?2,8)` matched exact BLOB bytes, canonical string text and INTEGER 1, including reset/re-step, in all three encodings.
- Text nesting 1000 returned INTEGER 0 in all three encodings (incorrect); 1001 returned INTEGER 0 (expected rejection).
- Construct JSONB from scalar `00`, wrapping N times in ARRAY headers with independently encoded payload length. At depth1000, strict validation returned 1 and rendering succeeded; at1001 rendering raised kind `sqlite`, message `malformed JSON`, in all three encodings. The scalar chosen here is JSON null, so rendered length at1000 is2004.

## Owning source comparison

Pinned `reference/sqlite/sqlite-src-3530400/src/json.c`, `jsonTranslateTextToBlob` increments depth only entering `{`/`[` (lines1594,1698); scalar parsing does not increment container depth. `src/internal/json.ts:Parser.value` increments `#depth` for **every** value, including the scalar leaf. Thus 1000 containers plus a scalar leaf reaches1001 and rejects. Repair belongs in Parser container depth ownership/reset, not validation flags or a SQL special case.

`jsonbPayloadSize` branches at header nibble11/12/13/14/15; these representative minimal TEXT boundary probes pass and do not establish every malformed/nonminimal header branch. `jsonbValidityCheck` checks `iDepth>JSON_MAX_DEPTH`; rendering container depth is separate. Keep existing CB nonminimal controls and lazy malformed semantics unchanged.

Native oracle was rebuilt from this exact archive with `ORACLE_WORK_ROOT=$SAIVAGE_CARD_WORK_ROOT/json-boundary-oracle sh tools/oracle/build.sh` and CLI target `make ... sqlite3` (`proc-5cd739bd9ca4`, exit0). `proc-4d95c4e24c49`, exit0, reported exact version3.53.4/source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc` and native TEXT `json_valid` results999→1,1000→1,1001→0, independently confirming the red mismatch.

No repair or commit was performed in this red node. Broader typed error/lifetime, JSONB empty-vs-scalar depth, and exact native differential capture remain follow-up acceptance obligations; the focused passing header probe is not a universal JSON compatibility claim.
