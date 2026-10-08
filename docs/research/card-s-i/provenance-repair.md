# Provenance repair evidence — [[card:card-s-i-a]]

The native controls previously trusted capture source identity without checking it in the test process. Capture-time authentication alone does not reject a later stale fixture. The native Case5 tests now check manifest/capture/profile source IDs, versionNumber, exact encoding inventory and unique case identities before opcode assertions. No runtime admission changed.

Focused native/public subset exit0,36/36; full suite exit1,42 tests/36 pass/6 required selected reds, no skips. Logs: `provenance-controls.log`, `provenance-full.log`; process summary work:///cards/card-s-i-a/processes/proc-27852bbe087b/stdout.log. Test hash `22e1d93bbd2a4a123700e94e8ca3a1ddefe3f110cc6119f83ba7b74cdd7986a1`.

Dev-only mutation check extracts the real authentication function: pinned input accepted and sourceId='stale oracle' rejected (exit0), work:///cards/card-s-i-a/processes/proc-14d8dc737649/stdout.log. Initial VM-realm harness failed before mutation because cross-realm arrays fail deepStrictEqual, not because pinned input differed. Node subcommand exit1; subsequent sha256 command made combined process exit0, work:///cards/card-s-i-a/processes/proc-54fdeaa52941/stderr.log. Repeated with same-realm dev-only Function harness; no product eval/native dependency added.

Review remains outstanding. This adds test provenance validation, not adapted optimizer credit or selected runtime proof. Prior raw failure logs retain whitespace by design. Any final commit must include these updated test/evidence inputs, not use the obsolete candidate tree.
