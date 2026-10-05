# Bounded STAT4 admission repair

At base `e660c3b`, public prepare rejected nonempty sqlite_stat4 before stat1
loading. Pinned analyze.c:sqlite3AnalysisLoad1942–2028 instead makes samples
conditional on SQLITE_ENABLE_STAT4, after ordinary stat1/default loading.
The repair follows that non-STAT4 branch without introducing another catalog
owner or changing consumed schema/type/record validation. Sample estimates
remain unimplemented; this is not plan/cost parity or a new exclusion.

The admission gate's expected rows/types/name/reset remain intact. Once the
owning rejection was removed, it exposed a test API typo: `columnName(0)` is
not the project's public API. It now asserts the same name through the existing
`columnMetadata(0).name`, rather than adding an unrelated public API alias.

Evidence (card-e-h process artifacts):
- Red gate: proc-c18a6dd3048b, 0/3, all encodings rejected at schema.ts614.
- First repair run: proc-9841fbfa1303, 21/27; six failures exposed that metadata
  API typo, while all stat-record controls passed.
- Corrected focused run: proc-3c372d8d418d, all admission, stat1/format/record,
  corruption and IN/range controls pass without skips (40 tests).
- Typecheck passed; first schema/storage/parser run proc-76a0bf03514e had
  328/332 with four ENOENT failures for the disposable Chinook capture.
- Reacquired digest-bound Chinook (SHA256 7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15):
  proc-fe06d10c7ce3 then passed schema/storage/record/generator 332/332, no skips.
- Package-boundary and diff checks passed proc-9c4e65b7e7e6.
- Accounting passed proc-6ddd5b1b3cd0 (deterministic inventory, not SQL parity).

Exact logs are `work:///cards/card-e-h/processes/<process-id>/stdout.log`;
large rerun log is under card work `stat4-admission/schema-tests.log`.
The initial native-build attempt used a disallowed workspace-local override
and failed before building; corrected build uses the prescribed oracle-build.

Pinned non-STAT4 native rebuild/comparison passed proc-7abe4a36e142: verified
source ID, ENABLE_STAT4 false, all six encoding/query pairs repeated twice.
Library SHA256 b8ba542c98b52a3b7a8644f44d1dc0f9eb69488165c482f574753537b9543dea.
