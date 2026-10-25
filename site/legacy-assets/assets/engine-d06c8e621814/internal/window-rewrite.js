import { resolvedExpressionCarrier, expressionStructurallyEqual } from "./resolve.js";
import { sqliteAsciiFold } from "./sqlite-case.js";
import { productions, tokenIds } from "../generated/parser-tables.js";
const aggregateNames = new Set(["avg", "count", "group_concat", "max", "min", "sum", "total", "string_agg", "json_group_array", "jsonb_group_array", "json_group_object", "jsonb_group_object", "median", "percentile", "percentile_cont", "percentile_disc"]);
function leaves(node) { return node.kind === "terminal" ? (node.value ? [node.value] : []) : node.children.flatMap(leaves); }
function expression(node, alias) { return Object.freeze({ kind: "tokens", tokens: Object.freeze(leaves(node)), reduction: node, ...(alias === undefined ? {} : { alias }) }); }
function functionName(node) { if (!node.signature.startsWith("expr ::= ID|INDEXED|JOIN_KW LP"))
    return null; const token = node.children.find(child => child.kind === "terminal")?.value; return token ? sqliteAsciiFold(token.text) : null; }
function integerSortKey(value) {
    const unwrap = (node) => { if (node.kind !== "reduction")
        return node; if (node.signature.startsWith("expr ::= LP expr RP") || node.signature.startsWith("expr ::= expr COLLATE") || node.signature === "expr ::= term") {
        const child = node.children.find(item => item.kind === "reduction" && (item.signature.startsWith("expr ::=") || item.signature.startsWith("term ::=")));
        return child ? unwrap(child) : node;
    } return node; };
    const node = value.reduction ? unwrap(value.reduction) : undefined;
    return !!node && node.kind === "reduction" && node.signature === "term ::= INTEGER";
}
const nullTermRule = productions.find(production => production.signature === "term ::= NULL|FLOAT|BLOB")?.id;
/** sqlite3ExprDup plus exprListAppendList's bIntToNull mutation. The generated
 * producer owns this tree; frame expressions remain immutable and unchanged. */
function copySortExpression(value, integerToNull) {
    const copy = (node) => {
        if (node.kind === "terminal")
            return Object.freeze({ kind: "terminal", tokenId: node.tokenId, value: Object.freeze({ ...node.value }) });
        if (integerToNull && node.signature === "term ::= INTEGER") {
            if (nullTermRule === undefined)
                throw new Error("generated parser lacks NULL term production");
            const source = leaves(node)[0];
            if (!source)
                throw new Error("integer terminal lacks source token");
            const token = Object.freeze({ ...source, kind: "keyword", text: "NULL" });
            return Object.freeze({ kind: "reduction", rule: nullTermRule, signature: "term ::= NULL|FLOAT|BLOB", children: Object.freeze([Object.freeze({ kind: "terminal", tokenId: tokenIds.NULL, value: token })]) });
        }
        return Object.freeze({ kind: "reduction", rule: node.rule, signature: node.signature, children: Object.freeze(node.children.map(copy)), ...(node.semantic === undefined ? {} : { semantic: node.semantic }) });
    };
    const reduction = value.reduction ? copy(value.reduction) : undefined;
    return Object.freeze({ kind: "tokens", tokens: Object.freeze(reduction ? leaves(reduction) : value.tokens.map(token => Object.freeze({ ...token }))), ...(reduction ? { reduction } : {}), ...(value.alias === undefined ? {} : { alias: value.alias }) });
}
function sameOrderTerm(parent, producer, resolved) {
    // expr.c:sqlite3ExprListCompare compares sort flags before sqlite3ExprCompare.
    // The generated sort is a deep copy, so parser-node identity is unavailable.
    return parent.descending === producer.descending && parent.nulls === producer.nulls &&
        expressionStructurallyEqual(parent.expr, producer.expression, resolved.source.from.items, false);
}
function windowArguments(owner) {
    const call = owner.reduction;
    if (!call || call.kind !== "reduction")
        return Object.freeze([]);
    const list = call.children.find((child) => child.kind === "reduction" && child.signature.startsWith("exprlist ::="));
    if (!list)
        return Object.freeze([]);
    const collect = (node) => {
        if (node.signature === "exprlist ::=")
            return [];
        const nested = node.children.find((child) => child.kind === "reduction" && child.signature.startsWith("nexprlist ::="));
        if (node.signature.startsWith("exprlist ::="))
            return nested ? collect(nested) : [];
        const argument = node.children.find((child) => child.kind === "reduction" && child.signature.startsWith("expr ::="));
        return [...(nested ? collect(nested) : []), ...(argument ? [expression(argument)] : [])];
    };
    return Object.freeze(collect(list));
}
/** selectWindowRewriteExprCb/selectWindowRewriteSelectCb over immutable nodes.
 * Scalar subqueries are traversed, but only qualified columns owned by the
 * original outer SrcList cross that boundary. Local columns/functions stay put. */
function liftExpressions(owners, select, main) {
    const output = [], repairs = [], outerCursors = new Set(select.sources.map(source => source.cursorId));
    const uses = new Map();
    const collectUses = (resolved) => { for (const use of resolved.columnUses)
        uses.set(use.expression, { cursorId: use.source.cursorId, selectDepth: use.selectDepth }); resolved.nested.forEach(collectUses); };
    collectUses(select);
    const append = (node, kind, depth, correlated, aggDepth) => { const expr = expression(node); output.push(Object.freeze({ expression: expr, kind, bufferColumn: output.length, selectDepth: depth, aggregateDepthBefore: aggDepth, aggregateDepthAfter: aggDepth === null ? null : aggDepth + 1, correlatedFromScalarSubquery: correlated })); };
    const walk = (node, depth, owner) => {
        if (node.kind !== "reduction")
            return;
        const nested = node.signature === "expr ::= LP select RP" || node.signature === "expr ::= EXISTS LP select RP" || node.signature === "expr ::= expr in_op LP select RP";
        if (nested) {
            const selected = node.children.find(child => child.kind === "reduction" && child.signature.startsWith("select ::="));
            const semantic = selected?.kind === "reduction" ? selected.semantic : undefined;
            if (semantic) {
                for (const item of [...semantic.result, ...semantic.orderBy.map(term => term.expr), ...(semantic.where ? [semantic.where] : [])])
                    if (item.reduction)
                        walk(item.reduction, depth + 1, item);
            }
            return;
        }
        const name = functionName(node);
        const isWindow = node.children.some(child => child.kind === "reduction" && child.signature.startsWith("filter_over ::=") && child.children.some(part => part.kind === "reduction" && part.signature.startsWith("over_clause ::=")));
        if (isWindow) {
            if (!select.windows.some(window => window.owner === owner && window.compatibleGroup === main.compatibleGroup))
                append(node, "window", depth, false, null);
            return;
        }
        if (name && aggregateNames.has(name)) {
            if (depth === 0)
                append(node, "aggregate", depth, false, 0);
            else {
                // window.c:sqlite3WindowExtraAggFuncDepth increments only aggregates whose
                // resolver op2 reaches across the SELECT depth introduced by rewrite. A
                // correlated column owned by the original SrcList is the immutable
                // resolver evidence for that ownership; local nested aggregates are left.
                const crossing = (value) => { if (value.kind !== "reduction")
                    return 0; const use = uses.get(value); return use && outerCursors.has(use.cursorId) ? use.selectDepth : Math.max(0, ...value.children.map(crossing)); };
                const aggregateDepth = crossing(node);
                if (aggregateDepth >= depth)
                    repairs.push(Object.freeze({ expression: expression(node), selectDepth: depth, aggregateDepthBefore: aggregateDepth, aggregateDepthAfter: aggregateDepth + 1 }));
            }
            return;
        }
        if (node.signature === "expr ::= ID|INDEXED|JOIN_KW" || node.signature === "expr ::= nm DOT nm" || node.signature === "expr ::= nm DOT nm DOT nm") {
            const use = uses.get(node);
            if (depth === 0)
                append(node, "column", depth, false, null);
            else if (use && outerCursors.has(use.cursorId))
                append(node, "column", depth, true, null);
            return;
        }
        node.children.forEach(child => walk(child, depth, owner));
    };
    for (const owner of owners)
        if (owner.reduction)
            walk(owner.reduction, 0, owner);
    return { lifted: output, aggregateDepthRepairs: repairs };
}
function resolvedBinding(value, uses) {
    let node = value.reduction?.kind === "reduction" ? value.reduction : undefined;
    while (node) {
        const use = uses.get(node);
        if (use)
            return Object.freeze({ source: use.source, columnIndex: use.columnIndex });
        if (node.signature === "expr ::= LP expr RP" || node.signature.startsWith("expr ::= expr COLLATE") || node.signature === "expr ::= term") {
            const child = node.children.find((item) => item.kind === "reduction" && (item.signature.startsWith("expr ::=") || item.signature.startsWith("term ::=")));
            if (child) {
                node = child;
                continue;
            }
        }
        return null;
    }
    return null;
}
/** Immutable port of window.c:sqlite3WindowRewrite/sqlite3WindowCodeInit. */
export function sqlite3WindowRewrite(resolved, allocation) {
    const groups = new Map();
    for (const window of resolved.windows) {
        const group = groups.get(window.compatibleGroup);
        if (group)
            group.push(window);
        else
            groups.set(window.compatibleGroup, [window]);
    }
    let nextCursor = Math.max(allocation?.cursors ?? 0, Math.max(-1, ...resolved.sources.map(source => source.cursorId)) + 1), nextRegister = allocation?.registers ?? 0;
    const layers = [];
    let parentOrder = resolved.source.orderBy;
    let prefixElided = false;
    const uses = new Map();
    const collectUses = (owner) => { for (const use of owner.columnUses)
        uses.set(use.expression, use); owner.nested.forEach(collectUses); };
    collectUses(resolved);
    const groupEntries = [...groups.entries()];
    for (const [groupIndex, [compatibleGroup, windows]] of groupEntries.entries()) {
        const main = windows[0];
        const orderFlags = main.orderTerms;
        const producerOrderBy = Object.freeze([...main.partitionBy.map(value => { const copiedIntegerToNull = integerSortKey(value); return Object.freeze({ expression: copySortExpression(value, copiedIntegerToNull), sourceExpression: value, binding: resolvedBinding(value, uses), source: "partition", copiedIntegerToNull, descending: false, nulls: null }); }), ...main.orderBy.map((value, index) => { const copiedIntegerToNull = integerSortKey(value), flags = orderFlags[index] ?? { descending: false, nulls: null }; return Object.freeze({ expression: copySortExpression(value, copiedIntegerToNull), sourceExpression: value, binding: resolvedBinding(value, uses), source: "order", copiedIntegerToNull, ...flags }); })]);
        if (layers.length === 0 && parentOrder.length <= producerOrderBy.length && parentOrder.every((term, index) => sameOrderTerm(term, producerOrderBy[index], resolved))) {
            parentOrder = Object.freeze([]);
            prefixElided = true;
        }
        const terminalRewrite = liftExpressions([...resolved.result.map(result => result.expression), ...parentOrder.map(term => { const index = resolved.orderResultColumns[resolved.source.orderBy.indexOf(term)]; return index !== null && index !== undefined ? resolved.result[index].expression : term.expr; }), ...groupEntries.slice(groupIndex + 1).flatMap(([, pending]) => pending.flatMap(window => [...window.partitionBy, ...window.orderBy, ...windowArguments(window.owner)]))], resolved, main), lifted = terminalRewrite.lifted, buffer = lifted.map(item => item.expression), bufferBindings = buffer.map(value => resolvedBinding(value, uses));
        for (const value of [...main.partitionBy, ...main.orderBy]) {
            buffer.push(value);
            bufferBindings.push(resolvedBinding(value, uses));
        }
        const functions = windows.map(window => { const argumentColumn = buffer.length; for (const value of windowArguments(window.owner)) {
            buffer.push(value);
            bufferBindings.push(resolvedBinding(value, uses));
        } const filterReduction = window.filter?.reduction; const filterExpr = filterReduction?.kind === 'reduction' ? filterReduction.children.find((child) => child.kind === 'reduction' && child.signature.startsWith('expr ::=')) : undefined; const filterCarrier = filterExpr ? resolvedExpressionCarrier(resolved, filterExpr) : null; const filterValue = filterExpr ? expression(filterExpr) : null; const filterColumn = filterValue ? (buffer.push(filterValue), bufferBindings.push(resolvedBinding(filterValue, uses)), buffer.length - 1) : null; return Object.freeze({ window, argumentColumn, filterColumn, filterCarrier, regAccum: ++nextRegister, regResult: ++nextRegister }); });
        if (buffer.length === 0) {
            buffer.push(Object.freeze({ kind: "tokens", tokens: Object.freeze([]) }));
            bufferBindings.push(null);
        }
        const iEphCsr = nextCursor;
        nextCursor += 4;
        const regGosub = ++nextRegister, addrGosub = layers.length, handoff = Object.freeze([{ code: "Gosub", register: regGosub, address: addrGosub }, { code: "Return", register: regGosub }]);
        // The producer edge is attached after all layer-local state is complete. Only
        // the first rewrite owns the original clauses; later incompatible rewrites
        // consume the complete Select produced by the preceding recursive rewrite.
        layers.push(Object.freeze({ compatibleGroup, windows: Object.freeze(functions), producerOrderBy, bufferExpressions: Object.freeze(buffer), bufferBindings: Object.freeze(bufferBindings), lifted: Object.freeze(lifted), aggregateDepthRepairs: Object.freeze(terminalRewrite.aggregateDepthRepairs), iEphCsr, duplicateCursors: Object.freeze([iEphCsr + 1, iEphCsr + 2, iEphCsr + 3]), regGosub, addrGosub, handoff }));
    }
    // Capture original predicate identities on the moved producer edge, not
    // rewritten parent expressions. ON predicates precede WHERE as before.
    const sourcePredicates = [];
    for (const item of resolved.source.from.items)
        if (item.on?.reduction?.kind === 'reduction')
            sourcePredicates.push(resolvedExpressionCarrier(resolved, item.on.reduction));
    if (resolved.source.where?.reduction?.kind === 'reduction')
        sourcePredicates.push(resolvedExpressionCarrier(resolved, resolved.source.where.reduction));
    let root = null;
    const linked = [];
    for (const [index, unlinked] of layers.entries()) {
        const producer = index === 0
            ? Object.freeze({ kind: "original", nonFlattenable: true, correlated: true, sourcePredicates: Object.freeze(sourcePredicates), from: resolved.source.from, where: resolved.source.where, groupBy: resolved.source.groupBy, having: resolved.source.having })
            : Object.freeze({ kind: "rewritten-select", nonFlattenable: true, correlated: true, parentCompatibleGroup: unlinked.compatibleGroup, select: root });
        const layer = Object.freeze({ ...unlinked, producer });
        linked.push(layer);
        root = Object.freeze({ compatibleGroup: layer.compatibleGroup, subquery: producer });
    }
    return Object.freeze({ source: resolved, layers: Object.freeze(linked), root, outer: Object.freeze({ orderBy: parentOrder, originalOrderBy: resolved.source.orderBy, orderPrefixElided: prefixElided, limit: resolved.source.limit, offset: resolved.source.offset, result: resolved.result }), movedClauses: Object.freeze(["from", "where", "groupBy", "having"]), retainedClauses: Object.freeze(["orderBy", "limit", "offset"]), multipleWindowPartitions: resolved.multipleWindowPartitions, frameExecution: "unsupported" });
}
