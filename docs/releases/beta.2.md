# JSQLite2 0.0.0-beta.2

Second public beta: SQL functionality and composition improvements. Accepted
local source: `e48e22f56240f321deda9e51d1ea71baebf390b2`. Release packaging adds
version metadata, GPL notices and publication documentation; no beta.3 index work
or engine edits are included. Earlier releases remain immutable.

## Changes since beta.1

- Generated outer-column metadata Filter arguments in supported scalar and
  aggregate queries use the existing resolved WHERE and positioned-row owners.
- Joined metadata window queries use the shared producer/coroutine path.
- Corrected cumulative window peer-result publication.
- Representative physical LEFT metadata aggregates, correlated count+sum,
  derived JOIN count, Window JOIN, UNION ALL aggregate and LEFT ON versus
  WHERE-null compositions match pinned SQLite across all three text encodings.

## Validation

Independent root review accepts the bounded local beta.2 product milestone.
Exact accepted source: **482 files completed, 8,684 test passes, five unchanged
skips, zero failures/cancellations**, 16 prerequisites successful, and all
**809 companion tests across 39 files** passed; no input drift or unrun files.
Native/public common45, leads45 and six-family18 observations match typed rows,
all five metadata fields and two reset executions. Counts overlap and are not
a SQLite compatibility percentage. Five skipscan compiled/concurrent/corruption/
memory/recovery-copy cases receive no pass credit.

Actual Chromium/HTTP **50 checks** and independently exercised installed demo/
original Chinook query passed on authenticated package bytes. The new joined
Window query has native/public and installed coverage, not invented additional
browser-inventory credit. Original unreduced20k and unpartitioned WR workloads
also completed under current ceilings; historical timeouts remain historical
failures, not retroactively green or causally explained.

Publication separately validates the versioned tarball, byte equality of every
emitted module/declaration to the accepted package, and the pinned public site.
Exact publication commands, hashes, failed attempts and remote outcomes are in
the external publication receipt. Accepted full-suite results are not claimed
as fresh publication reruns.

## Installation and limits

Download `jsqlite2-0.0.0-beta.2.tgz` and `SHA256SUMS` from the
[GitHub prerelease](https://github.com/salva/jsqlite/releases/tag/v0.0.0-beta.2),
verify the tarball hash, then `npm install --ignore-scripts ./jsqlite2-0.0.0-beta.2.tgz`.
Alternatively serve the complete `dist/` ESM tree and import `dist/index.js`.
No npm registry publication. GPL-3.0-or-later; LICENSE/NOTICE and corresponding
source accompany the release. Chinook retains its separate MIT notice.

This is bounded support, **not all SQLite or arbitrary SQL combinations**.
Broader generated/module Filter, joined/window/compound/planner compositions and
index-supported paths remain work. Exhaustive resource/interruption schedules,
native allocator parity, all-browser certification and hard-real-time guarantees
are not established. Tests-first chronology deviations and failed setup attempts
remain disclosed in accepted review evidence. Native SQLite is development-only;
there is no native/WASM/runtime server evaluator.

The playground retains its60-second watchdog and1000-row cap, not promises of
universal performance or hard preemption. See the exact-version [API](../api.md),
[guide](../TRANSLATION.md) and [SPEC](../SPEC.md). Beta.3 index work proceeds
separately; beta.2 is a milestone, not whole-project completion.
