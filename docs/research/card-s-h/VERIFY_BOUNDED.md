# Independent bounded verification evidence

Input: ff2cca0d8880d3f0a1749611c12d2e6f5fed92f6, tree eb9361fff0fbe37dcf0180cc2fc9874f41f93d11. No production changes in this verification. Acceptance remains open.

## Original public capture correction

`skipscan-compiled-copy.test.mjs` previously discarded all non-stat1 original variants even with ALL_VARIANTS=1, and silently filtered prepare errors. Thus its original-capture run could not establish the named 87-capture gate. The test now honors ALL_VARIANTS for original controls and checks native prepare-error codes instead of dropping them. Default selected-only behavior is unchanged. No row/cursor expectations changed.

On corrected test, `SKIPSCAN_DEFAULT_PROOF=1 SKIPSCAN_ALL_VARIANTS=1 SKIPSCAN_NATIVE_ROOT=$SAIVAGE_CARD_WORK_ROOT/skipscan-native timeout 60 node --experimental-strip-types --test test/conformance/skipscan-compiled-copy.test.mjs` passes1/1 with84 public row cases and3 prepare-error cases, all3encodings (proc-35cbf1ce3e6d). Original native87 includes controls; it is not87 selected skips. Default selected run passes1/1 (proc-4564a21232cb). Outputs are under work:///cards/card-s-h-d/processes/ with those exact process IDs and stdout.log.

## Other independently executed checks

- Enabled serial32-file OR/skipscan loop, per-file timeout60: proc-bba238a5b5e1 exit0,363/363,0skip/cancel/fail. It ran before the original-capture test correction, which is separately checked above; production inputs unchanged. Per-file evidence under card work beta3-verify/enabled-final. Earlier integration runner proc-9944a09917bf exited1 solely reporting tracked generated pycache input drift; its memory/recovery were skipped because enable variables were omitted on rerun. Do not treat that run as enabled acceptance. Native Python bytecode generation modified the tracked pycache; only that generated change was restored, no peer edits discarded.
- Admission/REAL/row-width/operand bounded runner: proc-bf693631fb86 exit0, four files completed; this is not whole-product coverage.
- Useful20k, full metadata/error/bind/reset and reservation-reprepare controls: proc-6458fd30dcab9/9 exit0. Each encoding unforced chosen40seeks/100indexNext/100tableSeeks, forced ci1/2858/2858; same typed rows. Reprepare exercises52 reservation frontiers/encoding, primary limit identity/reset/retry. Entry timeout0/preabort and maxWork1 are NOT sample-loop deadline/cancel coverage.
- Typecheck proc-f0626b008a25 explicitly reached TYPECHECK_PASS. Its build failed missing local node_modules; runtime/package unreached. After an ordinary local symlink to existing installed dependencies, proc-5f11ac6e28b8 build, runtime import(open,JSQLiteError), package-boundary all exit0. Browser not run.

## Fresh native identity

Built pinned noSTAT4 and STAT4 libraries locally, captured useful all-encoding variants via shared-tree capture-skiprange.py copied into disposable work. This script is not in candidate Git; SHA256 5aeb925e68d635f0ae2fbd886b3da7e0071495327afd06f68df2706e7a0d38d0. Enabled library SHA256 7e74c4d09168a1b322a26102e1bfdbe5ad06cd43d8fd9a25ee641de4895932a4; disabled56f05b294e285a133c63bcb4f6945471ccdaca297a340fff36b210968ea71fcb. Both sourceID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`; amalgamation SHA256 b1dd5d74ec7f29055a6684fa06fb3c2f6821c87dd38f9a458dfd2e8a1db28189. Profiles include ENABLE_COLUMN_METADATA/ENABLE_MATH_FUNCTIONS; enabled alone ENABLE_STAT4. Full options/raw samples/cases are retained in card-work beta3-verify/input/docs/research/card-s-h/skiprange-useful/skiprange-native.json. Capture proc-44ebd03c524d exit0; inspect its output, not trailing hashes alone. Native b>100 enabled694VM vs disabled14344VM is not TS runtime count parity.

## Open acceptance

Missing meaningful actual public new-sample-path mid-loop cancellation/deadline assertion: existing skiprange-control is a standalone probe with arbitrary thrown sentinels; reprepare tests are reservation-frontier failures and entry controls. Sorter checkpoint deadline tests exercise another semantic owner. Need actual sample-loop public control injection, primary error, scratch release/reset/retry and hook restoration without production scheduler changes. No product failure inferred.

Full changed control/caller/lowering/cleanup source review, browser smoke and current guide/map/API/CONFORMANCE/audit reconciliation remain uncompleted mandatory gates, not unavailable evidence and not waived by these passes. Existing broader gap prose is not independently accepted current implementation disposition. No final bounded approval or release claim.
