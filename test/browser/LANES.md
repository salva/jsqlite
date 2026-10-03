# Current admission and explicit roadmap lane

Owner decision: new derived CTE admission is not a dependency for browser E2E.
The two exact unsupported probes remain unchanged, runnable and failing; they
are not deleted or converted to conformance passes.

Use the README environment setup, then:

```sh
timeout 180s node test/browser/run.mjs                      # current (default)
JSQLITE_BROWSER_LANE=gap timeout 180s node test/browser/run.mjs # debt, exit 1 today
JSQLITE_BROWSER_LANE=all timeout 180s node test/browser/run.mjs # both
```

Report selection records lane, declared counts and gap IDs/SQL/provenance.
Archive report.json after each invocation; each run overwrites it. Latest saved
current-report.json has 38/38 pass; gap-report.json has 2/2 fail unsupported at
prepare. Those denominators are separate, not a 40/40 conformance claim.

Admitted replacement: existing aggregate-window-private-controls ordinal44 SQL
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
