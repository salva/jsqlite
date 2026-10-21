# beta.3 scalar/count primitives — author delivery, consumer pending

## Interface for [[card:card-s-h-c]]

`src/internal/stat4-skipscan.ts` exports `stat4Column(sample,column,encoding,destination,check,reserve)` and `stat4SkipScanRange({probe,samples,column,affinity,lower?,upper?})`.

- Use original padded sample `{p,n}`, column=nEq>0, column affinity and existing KeyInfo collation. Scalar decoder scans only through target field; later header/payload is not decoded. Reserved10/11 and NaN decode NULL, unlike strict ordinary record readers. Structural failure throws `ComparisonError('corrupt')`, distinct from extraction unavailable.
- Loop returns `{nLower,nUpper,nDiff,done,adjust}`. When done, caller subtracts adjust from nOut; otherwise preserve upstream heuristic fallback. Absent bounds are undefined; present but unsupported productions are unavailable; allocated SQL NULL is known. No DESC inversion. Existing literal extraction owns affinity and reprepare sensitivity. No SQL text evaluator.
- Probe prefix slots/nField/nRecValid are unchanged. Scratch is not retained in schema/program/statements. Actual bound and sample Mem objects release on all exits in p1,p2,pVal order; copy reservations release afterward. Existing probe reserve/check callbacks are used; signal/deadline semantics remain their caller's responsibility.
- Scalar API returns the reservation release handle: caller must keep it while destination bytes live and release it after clearing/releasing destination. The loop handles that internally. Scalar copies adapt source borrowed sample pointers to existing owned Mem setters; logical reservation64+2*field length covers copied bytes/scratch, not measured heap. Header varints and payload work are charged before copying; synchronous host operations are not event-loop-preemptible. Bound lexical/binding reservations mirror ProbeSetValue's conservative scale, scoped to this invocation rather than growing prefix slots.

No consumer dispatch change: c owns range-cost dispatch/selected-plan behavior; d owns combined integration. `where-plan.ts` currently still gates ordinary sampleRange with nSkip===0. This is NEW primitive software, not historical R1 replay, but does not yet pass useful public plan selection.

## Source and evidence

Pinned SQLite3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`; read actual vdbemem.c2149–2190 and where.c1980–2056. Count loop preserves lower=-1/upper=nSample+1, lower presence0, upper known0/unknown nSample, both extractions, scalar decode then lower/upper>=0 counts, clamp1, paired narrow fallback, native LogEst adjustment, cleanup. Error exceptions prevent consumption of partial count output (C caller likewise receives non-OK rc).

Tests-first `node --experimental-strip-types --test test/conformance/stat4-skipscan-primitives.test.mjs` failed missing implementation (proc-0eb69e97eafe); after implementation3/3 and typecheck0 (proc-440e463f9eab). Expanded to6 tests covering all three encodings, NOCASE with DESC, TEXT/BLOB, reserved/NaN NULL, unavailable, corruption before destination mutation, later malformed header ignored, paired fallback, prefix invariance, every check-frontier primary failure, actual reservation release, denied allocation and successful retry.6/6 pass (proc-3e781ec724df).

Finite affected suite command `node --experimental-strip-types --test test/conformance/stat4-*.test.mjs docs/research/card-s-h/skiprange-control.test.mjs`: **90/90**, TEST_EXIT0; `npx tsc --noEmit` TYPECHECK_EXIT0, proc-972266854954. Tests run in current combined dirty workspace, not isolated acceptance. Removed unused test import afterward, no behavioral change.

Direct native oracle `skipscan-column-oracle.c` compiled `cc -O0 -DNDEBUG -I "$SAIVAGE_CARD_WORK_ROOT/padded-oracle" docs/research/card-s-h/skipscan-column-oracle.c -lm -ldl -o "$SAIVAGE_CARD_WORK_ROOT/skipscan-primitives/column"`. Six records 040801ff2a/040801/03080601/03080a/0308077ff8000000000000/03080f41 at column1 UTF8 produce INTEGER42/CORRUPT/CORRUPT/NULL/NULL/TEXT raw41 respectively, matching TS assertions. Source identity printed per invocation; amalgamation SHA256 b1dd5d74ec7f29055a6684fa06fb3c2f6821c87dd38f9a458dfd2e8a1db28189. Same proc-972266854954 capture. Native sample-attributed useful evidence and branch matrix remain in SKIPRANGE.md; no claim this internal finite oracle establishes universal parity.

Original focused public reproducer rerun unchanged: `node --experimental-strip-types --test docs/research/card-s-h/skiprange-useful.test.mjs` **0/3, TEST_EXIT1**, proc-f4f8b26f2533; expected missing consumer dispatch persists. This must remain red until c integrates; primitive tests passing are not public-plan acceptance.

## Delivery identity and remaining work

Working source SHA2560a4c46fac85fe77b44569f9bf9617e218581f0c1fcbb9f30b91102b203d88716; test d1d5adbff5542b67528bbd3b479388fdade4108cd3d0c7794051ea43e95a27ab. Starting/current precommit HEAD631dc2fc10ae2214c78d68a7d4b2aa817129c269, real staged entry checksum3beabd614a4cf95b5affaaca98596c76d3655bccefcc3efe8ba502a6bf11e25d unchanged through tests. New files can be committed with standard path-limited Git, excluding peer staged work. Guide/map overlapping peer edits receive only narrow current owner mappings in workspace; do not blanket-stage them. No public API/resources/release/operator changes.

Remaining: consuming c dispatch, actual selected improvement, extended boundary/native count instrumentation and independent combined acceptance. Current outcome still_red, useful next attempt is concrete dispatch to these primitives, not cost tuning or another R1 loader rerun.
