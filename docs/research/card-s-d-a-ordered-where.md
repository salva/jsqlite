# Ordered WHERE repair decisions

Before implementation ([[card:card-s-d-a]]): sourceOrdinal is C iTab; a separate
numeric sortIdentity represents iSortIdx. Zero denotes no potentially helpful
ORDER index. Nonzero identities distinguish physical index owners even when
currently proved ORDER-prefix counts match. IPK scans/seeks share the IPK identity.
Immutable admissions stay shared; list replacement only copies adjusted costs.
An ordered array adapts C linked-list positions, including tail deletion and
setup assertions. A builder-owned remaining budget is decremented before cost
adjustment/drop; planWhere shares it across source groups with the pinned
20000 baseline/1000 per-source increment (whereInt.h449–460).

Solver arrays are unsorted bounded slots, not Pareto sets. Costs use the previous
unsorted accumulator, conditional nonzero setup, and no-sort bias. Equivalent
mask/order-class slots compare the C cost/rows/unsorted vector; worst-slot selection
and final single slot preserve source branch order, including the pinned initial
worst secondary value nRow (where.c6115). Current multi-source ORDER proof stays
conservatively known zero; this does not add a global ORDER prover.

OR-set cost-only insertion is not reachable: no OR lowering or automatic-index
execution is added. STAT4, generalized IN/range/skipscan/BIGNULL/star heuristics
remain unimplemented. Schema currently lacks szIdxRow; exact indexed size ties
must be identified as residual unless size metadata is supplied, not guessed from
index field counts. Default non-indexed/equal-size ties retain prior slot.

## Bounded verification

The original three failing owning-path checks now pass, expanded to seven;
foundation/analysis plus repair: 29/29. Existing assertions retaining all proposed
candidates were revised to the pinned ordered dominance contract, not waived.
A first implementation run exposed six stale candidate/cost expectations;
intermediate expectation edits mischaracterized a rowid/index tradeoff and were
corrected to keep both incomparable candidates. Full outputs/temporal evidence
are in [[card:card-s-d-a]] status record. No public API diagnostics added.

Ordinary69 and advanced-index/storage combined runner: 126/126 test entries,
including newly recaptured R1/R2 public controls. First R1/R2 invocation failed
ENOENT for local captures; pinned native capture scripts then generated them
(post-implementation, not native-FIRST) and rerun passed. Frozen stat1 read-only
native recapture matches six before/after/all-encoding snapshots; IN/range typed
public and selected interruption tests pass4/4. This reuses existing fixtures,
not new comprehensive stat1 or metadata/error compatibility evidence.

Residual: solver supports explicit internal indexRowSize tie inputs, but schema
has no pinned szIdxRow producer; production indexed ties currently retain the
prior slot. Multi-source ORDER remains conservative zero. OR cost-only seam is
unreachable and unimplemented, rather than regular-loop insertion masquerading
as OR lowering. Wider selected/storage inventory and independent changed-export
acceptance remain follow-up. Next source-based slice: translate index row-size
producer/stat1 size extension into schema and exact tie caller handoff, then OR
set cost ownership before any OR lowering.
