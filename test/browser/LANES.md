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
review [[card:card-m-f-d]] reran **current 38/38 pass** and **original gap 2/2 pass**
in Chromium 153.0.8010.12 / Playwright 1.63.0. Those denominators are separate,
not a 40/40 conformance claim. Gap success checks exact native rows at
maxPrivateBytes=300; the 150-byte control requires a runtime limit, saved error
and cleanup, not unsupported prepare success. Evidence and archived report hashes:
[review status](record:///status.md?card=card-m-f-d&v=39).

The previously admitted replacement remains in current coverage: existing aggregate-window-private-controls ordinal44 SQL
on digest-bound w2rows.db, `sum(d)` with one preceding/following frame. Native
capture-window.py independently captures successful ordered metadata/typed rows.
Browser success at maxPrivateBytes=336 checks those exact native values and reset
reexecution. Limit at 200 checks primary saved error, cleanup and connection reuse.

`timeout 30s node test/browser/observe-window-budget.mjs` is a development-only
observation against the same emitted ESM closure. It temporarily wraps reservation
methods, restores them in finally, and does not alter browser/runtime artifacts.
Observed six sorter reserves of 32 bytes (192 total), then six window ephemeral
reserves of 24 on the **same budget object**, beginning at usedBytes=192 and
ending at 336. VM SorterOpen/OpenEphemeral pass the same #privateBytes; sorter
records remain reserved through drain while window buffer inserts occur. This
proves live shared ownership rather than guessing from SQL names. A 200 bound
admits sorter-alone192 and buffer-alone144 but rejects simultaneous total; 336
admits complete query. No native memory-count parity claim: these are documented
logical browser private-byte units, not C allocation sizes. Pinned window.c
windowCacheFrame/windowCodeStep and vdbe.c sorter/buffer lifecycle are owner
references. Public aggregate-window controls and primitive shared-budget tests
also pass (9/9 in one scoped Node command), supplementing rather than replacing
browser proof. Broader optimizer/whole-product debt remains; independent reviewer
acceptance is still required.
