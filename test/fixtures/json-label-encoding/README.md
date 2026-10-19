# JSON label encoding fixtures

Read-only copies of the independently prepared SQLite databases used by
`docs/research/card-r-e-jsonb-error-position-review.md`, retained from
`work:///cards/card-r-e/json-label-verify` by card-r-c. Each has ordinary rowid
`CREATE TABLE t(x)` and rows 0 through 5, in UTF8/UTF16LE/UTF16BE respectively.
No runtime database writes are needed. These bytes avoid an unrelated unsupported
WITHOUT ROWID aggregate preparation path in the older mixed-encoding fixture.

Oracle source identity and native receipt are documented in that research and
card-r-c status v65 plus subsequent repair evidence. Fixture creation is not a
new native-oracle execution; author checks compare current public APIs against
the independently retained same-version receipt.
