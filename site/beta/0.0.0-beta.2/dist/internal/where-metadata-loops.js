import { JSQLiteError } from "../index.js";
import { resolvedExpressionCarrier } from "./resolve.js";
import { jsonTableInputReady } from "./json-table-plan.js";
import { sqliteLogEst } from "./schema.js";
/** pragmaVtabBestIndex + whereLoopAddVirtualOne. Selected hidden EQ
 * constraints carry their exact reduction to invocation-owned omit handling;
 * other constraints remain residual. argv use linked source identities. */
export function metadataWhereLoops(plan, source, external, sourcePrereq = 0n) {
    if (source.table.kind !== 'metadata-module')
        throw new JSQLiteError('internal', 'expected metadata declaration');
    const ordinal = plan.sources.indexOf(source), hidden = source.table.columns.findIndex(c => c.hidden);
    const constraints = [];
    const visit = (node) => {
        if (node.reduction.signature === 'expr ::= expr AND expr') {
            node.children.forEach(visit);
            return;
        }
        if (node.reduction.signature !== 'expr ::= expr EQ|NE expr' || !node.reduction.children.some(c => c.kind === 'terminal' && (c.value.text === '=' || c.value.text === '==')))
            return;
        for (let side = 0; side < 2; side++) {
            const col = node.children[side]?.column;
            if (col?.source === source && hidden >= 0 && col.columnIndex >= hidden)
                constraints.push({ column: col.columnIndex - hidden, rhs: node.children[1 - side], constraint: node });
        }
    };
    if (plan.source.where?.reduction?.kind === 'reduction')
        visit(resolvedExpressionCarrier(plan, plan.source.where.reduction));
    for (const owner of plan.sources)
        if (owner.on?.reduction?.kind === 'reduction')
            visit(resolvedExpressionCarrier(plan, owner.on.reduction));
    for (const [column, arg] of (source.arguments ?? []).entries()) {
        if (arg.reduction?.kind !== 'reduction')
            throw new JSQLiteError('internal', 'metadata argument lost reduction');
        constraints.push({ column, rhs: resolvedExpressionCarrier(plan, arg.reduction) });
    }
    const available = new Set([...external, ...plan.sources.filter(s => s !== source)]);
    // pragmaVtabBestIndex rejects any unusable hidden EQ, even a duplicate.
    if (constraints.some(c => !jsonTableInputReady(c.rhs, available)))
        return [];
    let prereq = sourcePrereq;
    for (let i = 0; i < plan.sources.length; i++) {
        const s = plan.sources[i];
        if (s === source)
            continue;
        const without = new Set(available);
        without.delete(s);
        if (constraints.some(c => !jsonTableInputReady(c.rhs, without)))
            prereq |= 1n << BigInt(i);
    }
    const seen = new Map();
    for (const c of constraints)
        seen.set(c.column, c);
    const args = seen.has(0) ? [seen.get(0), ...(seen.has(1) ? [seen.get(1)] : [])] : [];
    const rows = hidden < 0 ? 25n : args.length ? 20n : 2147483647n;
    return [Object.freeze({ kind: 'metadata-module', source, sourceOrdinal: ordinal, prereq, setupCost: 0n, runCost: BigInt(sqliteLogEst(hidden < 0 ? 1n : args.length ? 20n : 2147483647n)), outputRows: BigInt(sqliteLogEst(rows)), terms: Object.freeze([]), sortIdentity: 0, arguments: Object.freeze(args) })];
}
