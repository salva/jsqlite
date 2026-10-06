# Residual frontier reconciliation and authenticated overlays

Continuation of c91ea38; accepted red proc-c6f3ce08d315 preserved as
`or-residual-contract.test.mjs` (same contradictory assertion, positive frontier
contract checks added). No runtime defect inferred from documentation red.

Pinned wherecode.c2350–2410 factors indexable original terms but excludes
TERM_VIRTUAL/TERM_CODED/TERM_SLICE, nullable outer-ON and subquery terms;
2499–2564 propagates recursive untestedTerms then disables the OR parent only
when all tested. TS `orRuntimeArmClause` excludes virtual/outerOn/non-indexable/
subquery terms, preserves owned direct/AND scope; represented clauses have no
coded/slice state and vector slices are unadmitted. Joined `emitJoinedOr`
computes readyMask|sourceBit, codes parent identities only if all original
nonvirtual arms are ready; downstream `codedWhere` readiness evaluates retained
full parent. Single-table arm truth runs before RowSetTest/Gosub; all source
terms are available there. Independent enclosing conjuncts remain separately
owned; common-index WhereEnd rewriting does not control residual truth.
This consolidates the guide's conflicting covering paragraph, not a behavior
change or new scope refusal. Rechecking factored constraints may repeat work;
no general optimizer or error-multiplicity parity claimed.

Authenticated d208 overlays copied byte-for-byte from d current-real-review
(frontier test/native), root project review evidence (d repeated-reset revision), and baseline-owner-review (synthetic nested RowSet
lifecycle). Frontier test SHA256182df07be82b0ba185a6768a8d15d438282fd470bfc6c8a389fbd82724e1b22c
matches d208. Nested test a96437cf50fc215897327b2f7cc919ca4804b90216db862956ac20c3a5c1ae46;
frontier native6f283e54340b8a1e623812d0917cbbcd9e2a8ca5cc5bfb6879e99a3ecd95a8c0.
Existing correlated IN lifecycle overlay remains committed unchanged. The
immutable copied review is [revision evidence](../card-s-f-or-independent-review.md),
not current contract authority. Frontier checks original differing downstream
arm truth, exact executed roots, reset/metadata/close continuation; synthetic
nested lifecycle checks owner/destructor/error behavior, not native recursive
cancellation parity. No speculative accessor quota or independent approval
inferred. Final exact commands/outcomes/identities are in current card status.

Evidence-copy correction: current-real-review/review.md was an unrelated older
review carrier; replaced by root docs/research/card-s-f-or-review.md containing
d repeated-reset verification. No unrelated review history retained as OR evidence.
