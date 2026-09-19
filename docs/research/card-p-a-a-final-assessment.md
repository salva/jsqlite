# Superseded assessment — [[card:card-p-a-a]]

The prior refutation of commit `c4b3c81` is retained in card record history and is **superseded by the second repair**. The current implementation contract is [`card-p-a-a-ordinary-scalars.md`](card-p-a-a-ordinary-scalars.md) plus `test/conformance/cases/stage3-ordinary-scalars.spec.json`.

The repair uses the profile's `SQLITE_MAX_FUNCTION_ARG=1000` and captures valid 1000-argument plus rejected 1001-argument probes; includes active `sqlite_compileoption_used/1` and `sqlite_compileoption_get/1`; records explicit source/profile/product dispositions for other conditional and extension-facing rows; derives catalog membership and flags from pinned macro operands and captured compile options; and gives every case and slice an upstream assertion link or an explicit source-authored local-companion rationale. Native and public unsupported captures remain zero TypeScript credit.
