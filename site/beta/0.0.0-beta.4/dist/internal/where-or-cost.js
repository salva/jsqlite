export function whereOrMove(dest, src) {
    dest.a = src.a.map(cost => ({ ...cost }));
}
export function whereOrInsert(set, prereq, rRun, nOut) {
    let slot;
    for (const old of set.a) {
        if (rRun <= old.rRun && (prereq & old.prereq) === prereq) {
            slot = old;
            break;
        }
        if (old.rRun <= rRun && (old.prereq & prereq) === old.prereq)
            return false;
    }
    if (!slot) {
        if (set.a.length < 3) {
            slot = { prereq, rRun, nOut };
            set.a.push(slot);
        }
        else {
            slot = set.a[0];
            // Literal pinned comparison, NOT a generic Pareto/worst-cost eviction.
            for (let i = 1; i < set.a.length; i++)
                if (slot.rRun > set.a[i].rRun)
                    slot = set.a[i];
            if (slot.rRun <= rRun)
                return false;
        }
    }
    slot.prereq = prereq;
    slot.rRun = rRun;
    if (slot.nOut > nOut)
        slot.nOut = nOut;
    return true;
}
/** whereLoopInsert pOrSet branch. false is SQLITE_DONE, not discarded cost.
 * The caller owns iterator closure and passes the same budget to copied builders.
 * nLTerm counts actual constrained terms, not the loop's residual expression list.
 */
export function whereOrCollect(set, budget, nLTerm, cost) {
    if (budget.remaining === 0n) {
        set.a.length = 0;
        return false;
    }
    budget.remaining--;
    if (nLTerm > 0)
        whereOrInsert(set, cost.prereq, cost.rRun, cost.nOut);
    return true;
}
/** whereLoopAddOr: reset sCur per arm in caller, abandon on zero costs;
 * first processed arm moves, subsequent arms multiply stored slots in i/j order.
 * The caller supplies sqlite3LogEstAdd and inserts published parent loops with
 * rRun+1, setup0 and sort0 only after every actual arm succeeds.
 */
export function whereOrAccumulate(sum, current, first, add) {
    if (current.a.length === 0) {
        sum.a.length = 0;
        return false;
    }
    if (first) {
        whereOrMove(sum, current);
        return true;
    }
    const previous = { a: [] };
    whereOrMove(previous, sum);
    sum.a.length = 0;
    for (const left of previous.a)
        for (const right of current.a) {
            whereOrInsert(sum, left.prereq | right.prereq, add(left.rRun, right.rRun), add(left.nOut, right.nOut));
        }
    return true;
}
