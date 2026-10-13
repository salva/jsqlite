# Review27 R1/R2 correction — [[card:card-r-e]]

Immutable review record:///review.md?card=card-r&v=27 is preserved. Base chain:
662b97b → 2067239cabe96d3c873720548b36fa51c1031f17 →
5b054edb257d8675e567a426ae0f5342e19f70d3. Read r-d status93.
Separate index/candidate, not shared MAIN promotion or dirty snapshot.

Expanded R1: 168 native/public cases = two physical tables (non-IPK t1 and IPK t),
four JSON variants, seven projection/group/FILTER/HAVING/NULL-extension shapes,
three encodings. Public Fetch compares typed values, all five metadata fields,
and reset/re-step. Native capture opens existing fixtures read-only, asserts
3.53.4 number/full source ID, metadata/math oracle profile; INTEGER strings,
REAL/TEXT/BLOB/NULL remain distinct. Capture script documents case SQL provenance.
Repeated capture byte-identical SHA b934a8700c8a6baf79af8e963d4490319dea8b346996cf22c9cf49f155056927.

Initial expanded run failed direct implicit rowid metadata (120/168 passed);
not a value/lifecycle acceptance. Owning jsonResultMetadata omitted negative
columns and independent JSON identity registers. Pinned select.c columnType
uses INTEGER/rowid for implicit identity, physical IPK declaration/name otherwise.
Added those branches with retained COLLATE origin clearing. No SQL special case,
rowid/id alias, parallel evaluator or algorithm substitution. Separate slots and
recursive ordinary layout retained from r-d. Corrected rerun 168/168 plus typecheck.

R2: bounded pretty f1eb053 delivery remains accepted but absent this baseline,
explicitly pending promotion. No obsolete unsupported decision, integration or
pretty implementation churn claimed. Current guide/API/map/audit now agree.

Fresh candidate all-&& gate: 697/697 affected JSON/rowid/shared recursive/parent/
REAL/sum/IN/CHECK-FK tests, Chinook 7/7, B1/B5 56/56 match (0 mismatch/credit),
typecheck/package boundary pass. Exact expanded command is retained in
work:///cards/card-r-e/processes/proc-c6890ef2f7d3/stdout.log (exit0).
Native repeat/cmp work:///cards/card-r-e/processes/proc-eec03343ec83/stdout.log.
Earlier cached diff failed trailing blank EOF; corrected before final commit.
Mid-iteration cancellation/general accounting/corpus/planner parity unclaimed;
existing mixed resource test covers selected work/private/pre-abort saved errors.
RIGHT/FULL/NATURAL/USING boundaries unchanged. No writes/native runtime/config.
