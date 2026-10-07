# Bounded aggregate shared WHERE consumer

Current repair starts from `bb5cf804345bf867f206c620b511275c48afc548`.
`select.c:8531` and `8884` enter WHERE before feeding the group sorter or
updating the implicit accumulator. Joined aggregate input now calls the existing
`compileInnerTableSelect` consumeRow contract: the existing planWhere candidate,
path, cost, admissibility, seek, ON/WHERE, outer and continuation machinery owns
row production. Capture runs while those physical cursors remain positioned.
No new optimizer, host join, scheduling change or budget was introduced.
Single-source aggregate scan lowering and retained coroutine input are unchanged.

Hash-matched Chinook: `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`.
Independent pinned oracle source ID is
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Exact submitted album/track aggregate yields the ten typed rows captured in
`test/conformance/aggregate-where-chinook.test.mjs`, to SQLITE_DONE. Oracle evidence:
`work:///cards/card-l-c/processes/proc-86701cb5f5c2/stdout.log`.

Baseline: correct rows/metadata but zero planner candidates/paths and 1,215,888
table advances, ~46 seconds. Test failed selected-access assertion. Repaired:
4 candidates, 2 paths, 3,503 table seeks, 3,503 table advances, 7,006 residual tests,
222 sorter rows; zero index seeks is the shared planner's actual selected path,
not a claim to choose the globally fastest native path. ~0.8–1.0 seconds local
first drain, with completion/reset and row/reset replay. All three executions
pass a 200,000 charged-work cap. This is a bound, not an exact dispatch/work
count; existing accounting does not expose those totals. Baseline dispatch/work
numbers supplied externally were not independently asserted.

Attempts: first repaired row access passed rows but planner accounting was
omitted from the grouped Program return; propagating that owning return fixed
accounting. An intermediate optional-property type error was corrected using
conditional property spread. Subsequent focused run passes 1/1. Existing C1-C6
and lifecycle run passes 15/15; affected aggregate semantic/phase/derived/outer
and recursive suite passes 97/97. Typecheck and card diff checks pass. Evidence
in the card status links full commands/results including intermediate failures.
Chromium 148 / Playwright 1.60 built-artifact Chinook lane passes 1/1; that lane
is the existing B1 case, not new-query browser coverage. The exact new query is
public Node Fetch coverage. No exhaustive new-query-specific cancellation or
all-encoding native recapture is claimed; established lifecycle and all-encoding
phase/outer suites remain passing.
