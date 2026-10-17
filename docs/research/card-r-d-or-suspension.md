# Controlled OR cancellation witness

The d424-derived test-only correction follows scheduler-owner disposition record:///status.md?card=card-t&v=153, not a new runtime timer guarantee. Pinned SQLite3.53.4 vdbe.c check_for_interrupt checks delivered interrupt before progress/error transfer. Actual TS Function/PureFunc → chargeScalarInputs → admission checkpoint → scheduler yield uses4ms admission spacing and MessageChannel except periodic timer turns; neither orders an external timer before a finite first return. No runtime algorithm changes.

Wrapper delegates ORIGINAL production task first, then holds that admitted VM suspension through one controlled setTimeout callback. Signal initially live, branch1 active, connection prepare excluded. Callback aborts; wrapper returns normally so production checkpoint discovers signal. Inner/outer finally restore seam/clear timer. Original SQL1MiB/allenc/primary identity/repeated-step/reset/deadline20ms/work100/finalize/connection cleanup preserved; successful reset reuse added. This is eligible-suspension cancellation, not latency/fairness/native task equivalence.

## Author evidence

Artifacts: work:///cards/card-r-d/or-suspension-repair/. Parent d424e3f35794e99a4e6402eaeaa77e86abd8b599. Independent r-e159 baseline1/8 failure versus candidate8/8 passes stays attributed, not erased. Original bytes retained in parent and independent baseline log.

- proc-9e6d2dda95de full OR suite: green.log198/198.
- proc-c94219c3747c set-e typecheck then OR/task-scheduler/vdbe-host-admission/JSON producer-close/grouped-snapshot: focused.log310/310, no skip/cancel/fail. Real-clock tests unchanged; no browser run here.
- proc-9a4f4e178150 negative.py restores each mutation in finally; negative-results.json. Targeted tests with30s subprocess cap each exit1: no-yield (task count0), preabort (no live suspension), ignored-signal (not cancelled), lost-primary (identity), exclusion-removed (missing prepare exception). Individual logs retain exact failures. Omitted-real-delegation is STRUCTURAL: exact awaited-original-before-count invariant rejects removal, not a runtime claim that wrapper detects arbitrary fabricated transport.

First coherent repair passed; intended negative failures are sensitivity evidence, not runtime success. No forced clock/admission/work or fabricated cancellation/runtime edits/watchdog increase. Independent final complete-combined review required. Prior unchanged-runtime native/public/broad/package evidence retains r-e159 applicability/limits, not fresh evidence here.
