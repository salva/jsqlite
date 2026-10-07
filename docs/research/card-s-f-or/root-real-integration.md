# Root REAL extraction integration diagnosis

The root mixed worktree omitted the reviewed joined logical result-column emitter in be1e5b3 (introduced by 0c5d290). Raw Column returned compact integral REAL storage as INTEGER. Pinned expr.c sqlite3ExprCodeGetColumn and update.c sqlite3ColumnDefault place RealAffinity after Column for declared REAL, while rowid uses its separate opcode. Direct and coalesced joined output now consume that emitter before Copy/NotNull; no raw record/index/Mem or metadata conversion changes.

Root three-encoding correlated-IN tests failed at typed rows (194/197 broader run). Restoring only this owner hunk reached a stale tableNext0 assertion; actual global Next2 belongs to the enclosing table loop. Restored the reviewed movement-owner assertions from be1e5b3, preserving exact repeated roots and native typed rows. Root focused178/178/type0 then passed. Detailed commands/failure provenance: [[card:card-s-f-c]] status.

This isolated integration candidate starts at reviewed be1e5b3 and carries only two existing root peer bitwise import/dispatch hunks, plus this evidence note. It is not a full root export: staged JSON/research and other peer changes remain excluded and untouched. e30 source readiness applies to be1e5b3, not automatically to this new input. New gate evidence and independent review are required; no product/main acceptance implied.
