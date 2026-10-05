# Current bounded integration outcome — [[card:card-w]]

## Snapshot and result

Base HEAD: `18435d0830f9daeec7aa93156e5f1cce9187b5a7` (approved compound repair).
Reviewed integration index tree: `82cec07694d5e16cbf7bde78785b471a4d73259a`.
This tree excludes unrelated root bitwise changes, advanced-index test changes,
research and caches. Integrated WHERE alias/readiness and joined-EXISTS sort
hunks are attributed to [[card:card-t-d]]; compound private state is already
committed by [[card:card-j]]. No new engine implementation by this card.

* Dirty-current original225 selection: **225 completed / 0 fail / 0 timeout /
  0 not-run**, aggregate exit0, input drift[]. Manifest
  `card-w-current-integration/dirty-original225-manifest.json`, SHA256
  `f94960b9a529bb19d475fc188a32f0c01587d9745d8ddf25fb38b361f527ea85`.
* First exact index export: **224 completed / 1 fail**, exit1. Parser generator
  lacked ignored extracted pinned `src/parse.y`; no engine assertion failed.
  `staged-full-manifest.json` and `first-staged-219.log` retain that failure
  (see manifest for authoritative log name). Supplying the extracted source
  read-only yielded focused generator2/2 exit0. This prerequisite is required,
  not waived or replaced with a skip.
* Final exact index export, `proc-6b9aaca891a9`: **225 completed / 0 fail /
  0 timeout / 0 not-run**, aggregate exit0, input drift[]. Manifest
  `card-w-current-integration/staged-final-full-manifest.json`, SHA256
  `029f18da63b0cf74081ba923937d215cd115aa9d7b2bcfb91979fae83706a1a3`.
  Per-file commands, exits, durations and log hashes are in the manifest;
  logs remain under the card work `current-integration/staged-final-NNN.log`.
  Completion output: `work:///cards/card-w/processes/proc-6b9aaca891a9/stdout.log`.
* Post-run `proc-372ec44e239f`: all1178 export inputs, extracted reference
  inputs and225 log hashes revalidated. Index patch/tree unchanged. Unrelated
  dirty VDBE, advanced-index test and runtime-review bytes matched pre-run
  hashes. A preliminary comparison of tree-ID text with `git ls-files` text
  returned false because those are different representations; actual
  `git write-tree` comparison matches exactly.

The full225 list includes the original four-red files
`run-expression-bounded-ts.mjs`, `run-ordinary-scalars-pattern-ts.mjs`,
`run-order-limit-contract-ts.mjs`, and combined affected scalar/subquery,
compound, WHERE alias/B4, endpoint, lifecycle and window paths. Original focused
12/12 and combined19/19 evidence remains in
[diagnosis chronology](card-w-integration-diagnosis.md). Final export also
passes the new membership tests. Counts are observations, not compatibility
percentages or corpus-wide completion.

## Reproduction and boundary

Use Node24.18.0, npm11.16.0, Python3.12.3, POSIX process groups, compiler and
manifest-pinned SQLite3.53.4 source archive/extraction. Verify the archive SHA256
`d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b`;
source ID is `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
`tools/oracle/build.sh` produces the development-only library/profile in the
purpose-scoped work root. The runner invokes that build and r1/r2 capture scripts
before selecting suites requiring their native fixtures. Exact export reused
those already-generated pinned fixtures; it did not pretend to build them in
that export. No native runtime is packaged.

From the project root, with a writable, purpose-scoped `SAIVAGE_CARD_WORK_ROOT`:

```sh
npm run test:integration:harness
npm run test:integration
# To repeat the exact historical/current225 selection rather than a growing glob:
python3 - <<'PY'
import json, subprocess
m=json.load(open('docs/research/card-w-current-integration/staged-final-full-manifest.json'))
raise SystemExit(subprocess.call(['python3','tools/test/integration.py',*m['files']]))
PY
```

Runner defaults serial; positive `--jobs N` is optional, not equivalent timing
evidence. Per-file30s process-group watchdog, TERM then3s KILL grace; native
prerequisite180s bound. Failed prerequisites classify selected files not-run.
Timeout is always non-pass, never proof of engine interruption. Concurrent
invocations require separate work roots. Node commands use
`--experimental-strip-types --test FILE`. Both Chinook environment variables
point to vendored `examples/browser/chinook.sqlite`; no live-network fixture
prerequisite. Inventory excludes only the argv-requiring audit entrypoint as
previously reconstructed, not failing tests.

Harness tests freshly passed2/2 and retained-HTTP-body teardown1/1
(`proc-f1ae0c1a5418`); cached whitespace check0. Teardown closes the server then
all connections after SQL cleanup, preserving assertion failures. Coverage
checks normal exit, exact exit7, TERM timeout, ignored-TERM KILL and invalid jobs.
Thirty-second limits and engine budgets were not increased. Serial scheduling
resolved observed contention-sensitive row-width/format watchdogs; it does not
prove all old hangs had the same cause.

## Fresh artifact/browser evidence

Dirty typecheck/boundary/build and bounded package checks passed
(`proc-b21d89df29e0`); dirty tarball SHA256
`7c411dde32eff28c6da6e19d19392909b3450f987ca34fbe71e57a069957fab1`.
Exact staged-export guarded typecheck, boundary, build, package passed exit0
(`proc-2d48b3a176e9`),31 runtime modules /64 package files,366085 compressed bytes,
1870482 unpacked bytes. Fresh staged tarball SHA256
`6d5efe0226bb7fddde83c2038d39570af582a1083ef0d04542de93c03358e52a`;
`staged-package.json` SHA256
`3303c97d2b3b0ddd41576913c4719bf5aa57b4f7e80fa16df9827fe3b17227ff`.
These distinct dirty/index artifacts are not a published package claim.

Dirty and exact staged browser lanes each pass current38/38 and gap2/2
(`proc-31de8950ea44`, `proc-9873362841e0`). Playwright1.60.0,
Chromium148.0.7778.96. Reports retain actual dist module hashes and per-case
native provenance: `staged-browser-current.json` SHA256
`c3bd0b96e6e36a8fdaf59faabc3885defdb0a954975f754df144115f51ebb7f8`,
`staged-browser-gap.json` SHA256
`49611263e40d69b8971398190df3ecbcfc940f8aba522ee6dc183b12edde7d1d`.
The browser-tool download used network, not database fixture acquisition.

## Historical failures and remaining gaps

Historical immutable6ba3 broad1539/1543 exit1, killed/nonterminating monolithic
42-file harness, initial216/3/5 run, repaired221/1/3 and220/1/4 trials and
serial222/1/2 exit1 remain unwaived. These are different snapshots, not current
reds. Their exact repro SQL/typed outcomes and owner routing remain in the
chronology; source-authoritative repairs are linked through the owner report.
The original42-file command/list and exhaustive nontermination attribution
remain unreconstructed. Historical package30s watchdog124 remains a historical
nonpass; fresh bounded60s package completion is new evidence, not erasure.
No deleted assertions, skip conversions, rewritten expectations, expanded work
limits, scope changes or causal assertions from merely old reproduction.

Current diagnosis: meaningful bounded integration coverage passes. No currently
reproduced engine blocker remains in this225-file selection. This is not full
SQLite compatibility, every repository test/script, release conformance or
proof of recoverable engine interruption. Source/index snapshot evidence is
separated from dirty runtime evidence and subsequent documentation-only changes.
