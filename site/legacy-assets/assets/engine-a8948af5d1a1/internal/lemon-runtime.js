import { lemonTables, productions, tokenIds } from "../generated/parser-tables.js";
/** Pinned lempar.c state/action encoding with source-rule-keyed immutable values. */
export function lemonParse(terminals, values = [], limits = { maxWorkUnits: 10_000_000, maxParserDepth: 2500, maxExpressionDepth: 1000 }, reductionAction, stopAfterStatement = false, canonicalizeReduction) {
    const t = lemonTables;
    const stack = [{ state: 0 }];
    const reductions = [];
    let input = 0;
    let lookahead = terminals[0] ?? 0;
    let pendingReduce = null;
    let work = 0;
    const shiftAction = (state, token) => {
        if (state > t.shiftCount)
            return state;
        const offset = t.shiftOffset[state];
        let candidate = token;
        for (;;) {
            const index = offset + candidate;
            if (index >= 0 && index < t.action.length && t.lookahead[index] === candidate) {
                return t.action[index];
            }
            const fallback = t.fallback[candidate] ?? 0;
            if (fallback !== 0) {
                candidate = fallback;
                continue;
            }
            const wildcardIndex = offset + t.wildcard;
            return candidate > 0 && wildcardIndex >= 0 && wildcardIndex < t.action.length &&
                t.lookahead[wildcardIndex] === t.wildcard
                ? t.action[wildcardIndex]
                : t.defaults[state];
        }
    };
    const reduceAction = (state, lhs) => {
        if (state > t.reduceCount)
            return t.defaults[state];
        const offset = t.reduceOffset[state];
        const index = offset + lhs;
        return offset < t.reduceMin || offset > t.reduceMax || index < 0 ||
            index >= t.action.length || t.lookahead[index] !== lhs
            ? t.defaults[state]
            : t.action[index];
    };
    const shiftedState = (action) => action >= t.minShiftReduce && action <= t.maxShiftReduce
        ? action + t.minReduce - t.minShiftReduce
        : action;
    while (true) {
        if (++work > limits.maxWorkUnits)
            throw new RangeError("SQL parser exceeds maxWorkUnits");
        const action = pendingReduce ?? shiftAction(stack.at(-1).state, lookahead);
        pendingReduce = null;
        if (action < t.nState || action >= t.minShiftReduce && action <= t.maxShiftReduce) {
            if (stack.length >= limits.maxParserDepth)
                throw new RangeError("SQL parser exceeds maxParserDepth");
            stack.push({
                state: shiftedState(action),
                value: { kind: "terminal", tokenId: lookahead, value: values[input] },
            });
            lookahead = terminals[++input] ?? 0;
            continue;
        }
        const rule = action >= t.minReduce && action <= t.maxReduce
            ? action - t.minReduce
            : -1;
        if (rule >= 0) {
            reductions.push(rule);
            const count = -t.ruleNrhs[rule];
            const popped = count ? stack.splice(stack.length - count, count) : [];
            const children = popped.flatMap(entry => entry.value ? [entry.value] : []);
            // Bound the Expr tree authored by parse.y reductions, including deep
            // unary/binary forms without parentheses.
            const childExpressionDepth = popped.reduce((depth, entry) => Math.max(depth, entry.expressionDepth ?? 0), 0);
            const signature = productions[rule].signature;
            const expressionDepth = signature.startsWith("expr ::=")
                ? childExpressionDepth + 1
                : childExpressionDepth;
            if (expressionDepth > limits.maxExpressionDepth) {
                throw new RangeError("SQL expression exceeds maxExpressionDepth");
            }
            const semantic = reductionAction?.(signature, children);
            const reduction = {
                kind: "reduction",
                rule,
                signature,
                children,
                ...(semantic === undefined ? {} : { semantic }),
            };
            // Semantic opcode normalization never changes the LR rule/goto or trace.
            const value = canonicalizeReduction?.(reduction) ?? reduction;
            if (stopAfterStatement && signature === "cmdx ::= cmd" && lookahead === tokenIds.SEMI) {
                return { accepted: true, reductions, value, statementEndInput: input };
            }
            const next = reduceAction(stack.at(-1).state, t.ruleLhs[rule]);
            if (stack.length >= limits.maxParserDepth)
                throw new RangeError("SQL parser exceeds maxParserDepth");
            stack.push({ state: shiftedState(next), value, expressionDepth });
            if (next >= t.minShiftReduce && next <= t.maxShiftReduce) {
                pendingReduce = t.minReduce + next - t.minShiftReduce;
            }
            continue;
        }
        if (action === t.acceptAction) {
            const value = stack.at(-1)?.value;
            return value === undefined
                ? { accepted: true, reductions }
                : { accepted: true, reductions, value };
        }
        return { accepted: false, reductions, terminalAction: action, errorInput: input };
    }
}
export const lemonAccepts = (terminals) => lemonParse(terminals).accepted;
