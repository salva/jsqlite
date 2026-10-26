# CTE fallback linked identity repair (beta candidate)

## Source ownership

Pinned SQLite 3.53.4 `resolve.c:lookupName` initializes and installs the matched
source cursor/table on Expr; `select.c` lines6470–6477 expands, resolves, checks
errors and installs type information before tag0488 materialization. The beta
fallback had independently split spelling and searched transient column names
for projection and equality ON. This was semantic selection, not only layout.

`compileCteDerivedSourcesFallback` now invokes existing `resolveTransientArm`,
which creates transient source tables and calls the shared NameContext resolver.
Both result and ON reduction carriers consume its `ResolvedColumnUse`; object
identity locates the source in `plan.sources`, and columnIndex selects the row
register. No local alias/name lookup remains. Nonlocal/rowid/merged references
cannot enter this bounded direct-column specialization. Equality syntax admission
is still local; operand binding is not. Other compilers are unchanged.

Once/Gosub/Return/OpenDup, ephemeral setup, independent reader rewind/next,
parameter and parent builder/destination contracts are untouched. This uses
existing TS logical identity and register layout, not an exceptional replacement
algorithm or a parallel evaluator. No public API change.

## Candidate-local author verification

Cwd `/work/jsqlite2/integration-beta5`, separate from root; no cross-root promotion.
Native first: proc-f8efde3ef349 ran original pinned suite before migration controls;
proc-66d36cee7f0a ran extended native suite before adding matching public control:

`PYTHONDONTWRITEBYTECODE=1 timeout 100s python3 test/conformance/select-cte-fallback-destination-owner-native.py /work/jsqlite2/.saivage/work/cards/card-s-c-d-n/oracle-build/build/libsqlite3-oracle.so`

Both exit0; script verifies manifest SourceID. Added forced-window repeated reader
JOIN with parenthesized operands yields INTEGER1,2. Eight native row cases plus
two prepare-error assertions, not29 native cases. Existing library unchanged.

Final guarded proc-6a7a55adddce exit0:

- `timeout 100s node --experimental-strip-types --test --test-concurrency=1 --test-timeout=100000 test/conformance/select-cte-fallback-destination-owner.test.mjs`: **29/29**, no fail/skip/cancel,822ms. Original26 retained; new JOIN case across three encodings checks computed metadata, types/rows, reset/DONE/finalize. The existing structural test now asserts linked consumption and forbids the reproduced local spelling resolver.
- `timeout 180s npx tsc --noEmit`: exit0.
- scoped `git diff --check`: exit0.
- affected source/paired-test SHA receipt captured.

Primary captures: `work:///cards/card-t-b/semantic-green/{native.log,final2.log,type2.log,inputs.sha}`.
Initial attempt failed at module import (duplicate existing import); removed only
the added duplicate. Next original26 passed but typecheck failed because ExprNode
reduction can be a terminal. Added explicit reduction-kind narrowing at carrier
consumption; final tests/typecheck above pass. Earlier attempts are retained in
`focused.log`, `focused2.log`, `type.log`; they are not represented as passing.

This is bounded author evidence on affected paths, not independent acceptance or
a frozen complete candidate inventory. Retained-view definition/error matrix,
candidate-wide caller inventory authentication and parent G1/G2/W/V full combined
native/type/package/browser/export acceptance remain separate outstanding work.
No broad SQL compatibility or fault/resource parity is claimed.
