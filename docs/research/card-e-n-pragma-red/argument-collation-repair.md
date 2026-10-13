# Argument/collation bounded repair

[[card:card-e-l]] repair authorized after accepted diagnosis v133. Earlier
[independent assessment](independent-assessment.md) records 12 failures; this
checkpoint supersedes those current defects, not historical evidence or scoped
MAIN assembly requirement. No staging/commit, no wider PRAGMA acceptance.

Owning repairs: parse.y plus_num returns number terminal; parse.ts PRAGMA
argument selection now skips PLUS leaf rather than selecting its spelling.
Negative-number path unchanged. build.c4251–4269 assigns Index.azColl from
explicit COLLATE spelling, inherited column spelling, or BINARY; 4287 copies PK
suffix spelling. schema physical layout now retains collationName beside folded
lookup identity for declared, inherited PK suffix and BINARY auxiliary fields.
pragma.c1395–1410 consumes that metadata, not registered CollSeq spelling.
KeyInfo comparisons/planning retain folded identities and duplicate-field
matching unchanged. No SQL-specific path, alternative evaluator, datatype or
STRICT/gencol change.

New capture-argument-collation.py asserts manifest pinned sourceID before fixture
creation. argument-collation-native.json retains embedded SHA256-checked images
and typed native receipts for 19 queries×three encodings. Public comparison
checks manifest identity, image hashes, typed rows, exact errors and reset.
Upper/lower/mixed NOCASE, inherited RtRiM, explicit RTRIM and WITHOUT ROWID PK
suffix/base layouts extend initial failing probes. Native base independent
reproducer was acquired before repair; extended controls acquired after repair,
not mislabeled pre-code evidence. database_list filename adaptation remains
explicit; parameter syntax and unknown database/no-op controls included.

Commands/results:
- Initial owning repair `node $SAIVAGE_CARD_WORK_ROOT/pragma-assess/compare.mjs`
  + typecheck: mismatches0 (proc-63497cf2d58a), formerly12.
- Public new57 probes plus db117/table39/indexFK90, parser34/typecheck pass
  (proc-e414270acf6f; original new receipt then42 probes before expansion).
- Extended native57/public pass (proc-f92c5e3ef097).
- schema+STRICT336/336 zero skips; boundary/build/distributable PASS45modules92
  (proc-f28934b8a338 tail read). Package SHA256
  6cc5a3d88ff571ccdadd64d5ffd8c4cbd44bafae49fb071d9d46da8b71dd405b;
  isolated browser-global VM, not GUI.
- Durable capture initially failed open because new purpose work directory not
  created (proc-755cba94e9e2); later public0/peer-index equality in same sequential
  command did not erase capture failure. Added mkdir to capture script, fresh
  capture57/public0/typecheck/diff-check all pass (proc-7878853c355b, fail-fast).

Changed three source files, two bounded guide/map hunks, and four regression/
evidence files. Peer cached index byte-identical to initial snapshot; no staging
or deletion. Existing source edits were retained. Detailed missing durable
limits/cleanup/duplicate-metadata breadth remains independent assessment scope;
not falsely credited by these normal-row controls. Exact coherent MAIN assembly
and final verification belong to owner [[card:card-e-n]]/root and later node.
