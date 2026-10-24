#!/usr/bin/env python3
"""Guard current bounded-window contracts, not obsolete headings or run inventories.

Each document owns a different part of the contract. Numeric witnesses belong
in linked revision-bound evidence, not duplicated in every current document.
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
contracts = {
    'docs/TRANSLATION.md': [
        'pending input/end-peer ownership', 'EOF-before-inverse and deletion before Next',
        'typed Mem int64/overflow', 'Compatible cache-required value/EXCLUDE routes remain retained',
        'shared sourceRow handoff defaults to complete payload/identity snapshots for ordinary AggInfo consumers',
        "Only the window caller requests `sourceRowPolicy: 'modules'`",
        'without an unused full-row register copy',
        'Live Mem accounting and halt-time context release remain enabled',
        'logical accounting evidence, not universal native minima',
    ],
    'docs/api.md': [
        'explicit ROWS/RANGE/GROUPS frames, bounds and EXCLUDE',
        'Unrepresented combinations fail with temporary unsupported',
        'Admission follows parsed/resolved graph branches and is atomic at prepare',
        'budget shared by every simultaneously live sorter and ephemeral cursor',
        'Reset, failure, and finalize release all reservations before later connection work is admitted',
        '`reset()` likewise completes cleanup before reporting the prior error',
        'first-error cleanup remain required',
    ],
    'docs/SQLITE_SOURCE_MAP.md': [
        'window.c:selectWindowRewriteExprCb',
        'caller-selected sourceRow policy (complete snapshots for AggInfo; module-only for window physical-cursor Yield handoff)',
        'json-mixed-rowid-red/metadata-generated-aggregate',
        'physical window input retains only rewritten terminals',
        'sqlite3WindowCodeInit', 'sqlite3WindowCodeStep', 'windowCacheFrame',
        '`window-rewrite.ts`, `vdbe.ts`, `mem.ts`, packed private owners',
    ],
    'docs/reviews/translation-fidelity-2026-09-14.md': [
        'sourceRow snapshot policy caller-owned',
        'physical/module payload and identity by default for AggInfo, modules-only for the window caller',
        'global module-only filter broke mixed JSON/metadata physical aggregate consumers',
        'Live Mem charges remain', 'cache85-byte boundary and done-time context release',
        'does not certify whole-window, installed/browser or full-matrix acceptance',
    ],
}

def check_contract(text, markers, path):
    normalized = ' '.join(text.split())
    for marker in markers:
        assert marker in normalized, (path, marker)

for path, markers in contracts.items():
    text = (root / path).read_text()
    check_contract(text, markers, path)
    # Negative controls: no required semantic assertion may become optional.
    for marker in markers:
        normalized = ' '.join(text.split()).replace(marker, '')
        try:
            check_contract(normalized, [marker], path)
        except AssertionError:
            pass
        else:
            raise AssertionError((path, 'ineffective contract assertion', marker))
    if path != 'docs/api.md':
        links = re.findall(r'\]\(([^)\s]*window-owner-correction\.md)\)', text)
        assert links, (path, 'missing owner evidence link')
        for link in links:
            assert (root / path).parent.joinpath(link).is_file(), (path, link)

# Preserve corrected boundaries and historical provenance at their evidence owner.
evidence = (root / 'docs/research/card-s-i/window-owner-correction.md').read_text()
check_contract(evidence, [
    'live String register3 + packed record71 + logical row11 =85;84 rejects,85 succeeds',
    '358 reject;359,360 succeed', 'not native allocator parity or a universal minimum',
    'ddbc399', 'Earlier335/336 passing receipts', '200 before rows',
], 'window-owner-correction.md')
print('bounded window ownership, caller, accounting, lifecycle, admission and evidence contracts coherent')
