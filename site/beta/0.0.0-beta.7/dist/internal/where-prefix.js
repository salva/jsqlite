/** wherecode.c:codeAllEqualityTerms, 925–946. The caller owns equality
 * evaluation/IN setup and exit labels; this owner emits physical positioning.
 * Keys retain ordinal slots, including leading skipped fields (not SQL NULL
 * predicates). Column copies overwrite the initialization NULLs on first entry.
 */
export function beginPrefixLoop(ops, cursor, keys, affinities, keyInfo, reverse, nSkip = 0) {
    if (!Number.isInteger(nSkip) || nSkip < 0 || nSkip > keys.length || keys.length !== affinities.length)
        throw new Error('invalid positional prefix layout');
    let restart = null, empty = null;
    if (nSkip) {
        for (let i = 0; i < nSkip; i++)
            ops.push({ code: 'Null', p2: keys[i] });
        empty = ops.length;
        ops.push({ code: reverse ? 'IndexLast' : 'IndexRewind', p1: cursor, p2: 0 });
        const first = ops.length;
        ops.push({ code: 'Goto', p2: 0 });
        restart = ops.length;
        // The skipped fields come from OP_Column, already in index encoding/type.
        // wherecode.c applies equality affinity starting at nSkip, never to these.
        ops.push({ code: 'IndexSeekPrefix', p1: cursor, keys: keys.slice(0, nSkip), affinities: Array(nSkip).fill('blob'), keyInfo, reverse, strict: true, p2: 0 });
        ops[first] = { code: 'Goto', p2: ops.length };
        for (let i = 0; i < nSkip; i++)
            ops.push({ code: 'Column', p1: i, p2: keys[i], p3: cursor });
    }
    return { restart, empty, nSkip };
}
/** Emit only after codeEqualityTerm/IN initialization and NULL guards. Keeping
 * this separate ensures strict restart flows through Column and then RHS code,
 * not directly to a seek with stale RHS iterator state (wherecode.c950ff).
 */
export function emitPrefixSeek(ops, entry, cursor, keys, affinities, keyInfo, reverse, strict, scan) {
    if (keys.length !== affinities.length)
        throw new Error('invalid positional prefix layout');
    const seek = ops.length;
    // wherecode.c aStartOp: zero constraints position with Rewind/Last,
    // never a zero-field Seek (not a valid UnpackedRecord).
    if (entry.restart !== null && keys.length === entry.nSkip) {
        // wherecode.c2026: Column already positioned this skipped prefix.
        // A fall-through label preserves caller exit fixups without seeking again.
        ops.push({ code: 'Goto', p2: seek + 1 });
    }
    else if (keys.length === 0)
        ops.push({ code: reverse ? 'IndexLast' : 'IndexRewind', p1: cursor, p2: 0 });
    else
        ops.push({ code: 'IndexSeekPrefix', p1: cursor, keys, affinities, keyInfo, reverse, strict, ...(scan?.enabled && !reverse && !strict ? { seekScan: { steps: Math.floor((scan.rowLogEst + 9) / 10), hasRange: scan.hasRange } } : {}), p2: 0 });
    return { ...entry, seek, keys, affinities };
}
/** where.c:sqlite3WhereEnd, 7664–7668: suffix/IN exhaustion reaches
 * strict restart; restart/initial empty reach the final level exit.
 * Caller patches its suffix/IN exits separately; never redirects EQ NULL here.
 */
export function finishPrefixLoop(ops, loop, exit) {
    if (loop.restart === null)
        return;
    ops.push({ code: 'Goto', p2: loop.restart });
    for (const at of [loop.restart, loop.empty]) {
        const op = ops[at];
        if (op.code !== 'IndexSeekPrefix' && op.code !== 'IndexRewind' && op.code !== 'IndexLast')
            throw new Error('invalid prefix exit owner');
        ops[at] = { ...op, p2: exit };
    }
}
