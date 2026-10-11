#!/usr/bin/env python3
"""Bounded correction contract guard; replaces pre-consolidation heading assumptions."""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
for path in ['docs/TRANSLATION.md','docs/api.md','docs/SQLITE_SOURCE_MAP.md','docs/reviews/translation-fidelity-2026-09-14.md']:
    text=(root/path).read_text()
    for marker in ['Bounded window owner correction','logical peak359','358 rejects','200 remains failure','81 rejects,82 succeeds/reset','not heap/native allocator minima','window-owner-correction.md']:
        assert marker in text,(path,marker)
print('bounded window correction guide/API/map/audit coherent')
