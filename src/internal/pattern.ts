import { JSQLiteError } from "../index.ts";

export interface PatternControl {
  charge(units: number): void;
  check(): void;
}

interface PatternInfo {
  readonly matchAll: string;
  readonly matchOne: string;
  readonly matchSet: boolean;
  readonly noCase: boolean;
}

const LIKE_INFO: PatternInfo = { matchAll: "%", matchOne: "_", matchSet: false, noCase: true };
const GLOB_INFO: PatternInfo = { matchAll: "*", matchOne: "?", matchSet: true, noCase: false };

function sameCharacter(left: string, right: string, noCase: boolean): boolean {
  if (left === right) return true;
  if (!noCase) return false;
  const a = left.codePointAt(0)!, b = right.codePointAt(0)!;
  return a < 0x80 && b < 0x80 && String.fromCodePoint(a).toLowerCase() === String.fromCodePoint(b).toLowerCase();
}

function globSet(pattern: readonly string[], start: number, value: string): { end: number; matches: boolean } | null {
  let i = start, invert = false, seen = false, prior: number | null = null;
  if (pattern[i] === "^") { invert = true; i++; }
  if (pattern[i] === "]") { if (value === "]") seen = true; prior = 0x5d; i++; }
  while (i < pattern.length && pattern[i] !== "]") {
    const current = pattern[i++]!;
    if (current === "-" && prior !== null && i < pattern.length && pattern[i] !== "]") {
      const upper = pattern[i++]!.codePointAt(0)!, point = value.codePointAt(0)!;
      if (point >= prior && point <= upper) seen = true;
      prior = null;
    } else {
      if (current === value) seen = true;
      prior = current.codePointAt(0)!;
    }
  }
  if (i >= pattern.length) return null;
  return { end: i + 1, matches: seen !== invert };
}

/**
 * Browser-safe state-machine form of pinned func.c:patternCompare.  SQLite's
 * routine recursively resumes after matchAll; the explicit work-list preserves
 * the same alternatives without depending on the host call-stack.  Visited
 * (pattern,input) states remove only repeated searches and do not alter results.
 */
export function sqlitePatternCompare(
  patternText: string,
  inputText: string,
  mode: "like" | "glob",
  escape: string | null,
  control?: PatternControl,
): boolean {
  const info = mode === "like" ? LIKE_INFO : GLOB_INFO;
  const pattern = [...patternText.split("\0", 1)[0]!], input = [...inputText.split("\0", 1)[0]!];
  const stack: Array<readonly [number, number]> = [[0, 0]], seen = new Set<string>();
  let work = 0;
  while (stack.length) {
    const [pi, si] = stack.pop()!, key = `${pi}:${si}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if ((work++ & 255) === 0) { control?.charge(1); control?.check(); }
    if (pi === pattern.length) { if (si === input.length) return true; continue; }
    const token = pattern[pi]!;
    if (mode === "like" && escape !== null && token === escape) {
      if (pi + 1 < pattern.length && si < input.length && sameCharacter(pattern[pi + 1]!, input[si]!, info.noCase)) stack.push([pi + 2, si + 1]);
      continue;
    }
    if (token === info.matchAll) {
      stack.push([pi + 1, si]);
      if (si < input.length) stack.push([pi, si + 1]);
      continue;
    }
    if (token === info.matchOne) { if (si < input.length) stack.push([pi + 1, si + 1]); continue; }
    if (info.matchSet && token === "[") {
      if (si >= input.length) continue;
      const set = globSet(pattern, pi + 1, input[si]!);
      if (set?.matches) stack.push([set.end, si + 1]);
      continue;
    }
    if (si < input.length && sameCharacter(token, input[si]!, info.noCase)) stack.push([pi + 1, si + 1]);
  }
  return false;
}

export function validateLikeEscape(value: string): string {
  const characters = [...value.split("\0", 1)[0]!];
  if (characters.length !== 1) throw new JSQLiteError("sqlite", "ESCAPE expression must be a single character", { code: 1 });
  return characters[0]!;
}
