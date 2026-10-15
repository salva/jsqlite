# Current admission and explicit roadmap lane

Owner decision: new derived CTE admission is not a dependency for browser E2E.
The two original gap probes remain unchanged and separately runnable. After
retained ORDER-key repair `58a22728c6c6d9bf8261aa3154359de8695c47ec`, both pass
their original assertions; neither SQL nor expectations were changed. Historical
unsupported prepare failures remain recorded in BUDGET-GAP.md. This does not
change the accepted bounded browser milestone or award SQL compatibility credit.

Use the README environment setup, then:

```sh
timeout 180s node test/browser/run.mjs                      # current (default)
JSQLITE_BROWSER_LANE=gap timeout 180s node test/browser/run.mjs # original gap, exit 0 after repair
JSQLITE_BROWSER_LANE=all timeout 180s node test/browser/run.mjs # both
```

Report selection records lane, declared counts and gap IDs/SQL/provenance.
Archive report.json after each invocation; each run overwrites it. Independent
review [card-v-d v109](record:///status.md?card=card-v-d&v=109) authenticated
LOCAL alpha.6 source a572862f and installed artifact: **full47 + Chinook48**,
current48 and **original gap 2/2 pass**, Chromium148 / Playwright1.60.
These denominators are separate, not a 40/40 conformance claim. Publication is
WITHDRAWN/DEFERRED. Historical current38 reviews remain revision-bound at
[earlier review](record:///status.md?card=card-m-f-d&v=39).
Gap success checks native rows at300; rejection150 requires runtime limit,
saved primary error and cleanup. This is not an exact composed allocator peak.

Current admitted window ordinal44 on digest-bound w2rows.db uses `sum(d)` with
one preceding/following frame. Independently captured typed rows/metadata remain
unchanged. Browser success359/reset and rejection358/200 exercise shared budget.
Dev-only `observe-window-budget.mjs` temporarily wraps reserve/release/cursor
methods and restores them in finally; no runtime artifacts are modified.
Peak359 = retained sorter192 + frame96 + packed71 logical bytes on the same budget.
There is no consumed-sorter refund. Delete releases24 before the next non-release
cursor transition (transient packed releases may intervene); halt drains to0,
reset reexecution again reaches359. Source-derived private-controls/lookahead114
checks supplement, not replace, browser execution. Evidence and historical failed
observer assumptions: [b48](record:///status.md?card=card-v-b&v=48).

Pinned window.c windowCodeOp/windowCodeStep and vdbe.c sorter/buffer lifecycle
own the path; VM SorterOpen/OpenEphemeral share #privateBytes. These are logical
browser units, not native heap/work/performance parity. Historical336 =192+144
observations describe their old revision only, not current limits. Broader
optimizer/product debt and Chromium-only/external-watchdog boundaries remain.
