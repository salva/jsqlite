# Merge deadline control correction

[[card:card-s-h-c]] correction for independent [[card:card-s-h-d]] status v41. Base candidate `1fd2799957e0199808ab2d16f7d4cd411b149f85`, tree `abee767f880e236fc888ea7bbce285b99f4dc5c7` in ordinary integration-delivery checkout. No production changes.

Original enabled `skipscan-memory-copy.test.mjs` reproduced 0/1 exit1, missing timeout rejection at line53: proc-b85dbad257bd. Its global setTimeout interceptor misses MessageChannel delivery and admission-suppressed small merges. First repair hypothesis wrapping actual ExecutionTaskScheduler.yield also failed0/1 (proc-2e545f61a7f4): this small merge need not admit any host transport at all. That attempt was removed completely, not layered with the repair.

Final test wraps the actual SorterCursor.sort control.checkpoint, forwarding every production checkpoint and awaiting it; on the fifth comparison/move checkpoint, asserts retained merge entries and awaits a real1100ms timer. The original timeoutMs1000 and production Date.now checks reject, not a fake error/sentinel or altered scheduler configuration. Per-encoding completed-delay count proves boundary reached, alongside selected restart cursor, halt byte release, saved reset error, typed row recovery; final count3 covers all encodings. Existing six insertion rollback/six merge cancellation and later nine limit/recovery controls remain unchanged. Global timer monkeypatch removed; independent sorter/budget/insert/index hooks restored in original finally. This tests the awaited merge checkpoint seam, NOT proof that production admission would choose a host yield there, nor a scheduler fairness guarantee.

Enabled command prefix `SKIPSCAN_NATIVE_ROOT=/work/jsqlite2/docs/research/card-s-g SKIPSCAN_DEFAULT_PROOF=1 node --experimental-strip-types --test`:
- memory test alone:1/1 exit0 proc-cc38005f7772;
- final memory + recovery-copy + concurrent-copy:3/3 exit0, no skips, proc-0599d64f39eb; scoped diff-check0.
- disposable archive of base plus final test, changing only1100ms delay to0:0/1 exit1 missing timeout rejection proc-9304b91375ef. Demonstrates sensitivity to actual elapsed deadline crossing, not just counter or expected-error substitution. Disposable under card work root, never delivery source mutation.

Exact output URLs are `work:///cards/card-s-h-c/processes/<process-id>/stdout.log` for listed processes; complete inline outputs inspected. Author checks only, not independent approval. Original useful20k/new-path controls, WR87/native provenance and all remaining d v41 gates remain separate, not discharged by this test. Correction commits only attributable test and this evidence; preserve original candidate implementation and unrelated master peer reversals.
