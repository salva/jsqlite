/* Upstream-derived lexical foundation: src/tokenize.c:sqlite3GetToken (SQLite 3.53.4).
 * Input is UTF-8 bytes so all spans and tails use SQLite's byte unit. */
import { keywordTable } from "../generated/keyword-table.ts";

export type TokenKind = "space" | "comment" | "id" | "keyword" | "integer" | "float" | "string" | "blob" | "variable" | "punct" | "illegal" | "eof";
export interface SqlToken { readonly kind: TokenKind; readonly startByte: number; readonly endByte: number; readonly text: string; }

const keyword = (text: string) => keywordTable.has(text.toUpperCase());
const digit = (c: number) => c >= 48 && c <= 57;
const hex = (c: number) => digit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
const id = (c: number) => c >= 128 || digit(c) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36;
const decode = (b: Uint8Array, a: number, z: number) => new TextDecoder().decode(b.subarray(a, z));

export function encodeSql(sql: string): Uint8Array {
  for (let i = 0; i < sql.length; i++) {
    const c = sql.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const d = sql.charCodeAt(++i); if (!(d >= 0xdc00 && d <= 0xdfff)) throw new TypeError("SQL contains an unpaired surrogate"); }
    else if (c >= 0xdc00 && c <= 0xdfff) throw new TypeError("SQL contains an unpaired surrogate");
  }
  return new TextEncoder().encode(sql);
}

export function tokenize(bytes: Uint8Array): readonly SqlToken[] {
  const out: SqlToken[] = [];
  const push = (kind: TokenKind, a: number, z: number) => out.push(Object.freeze({ kind, startByte: a, endByte: z, text: decode(bytes, a, z) }));
  let i = 0;
  while (i < bytes.length) {
    const a = i, c = bytes[i]!;
    if (c === 32 || c === 9 || c === 10 || c === 12 || c === 13) { while (i < bytes.length && [32,9,10,12,13].includes(bytes[i]!)) i++; push("space",a,i); continue; }
    if (c === 45 && bytes[i+1] === 45) { i += 2; while (i < bytes.length && bytes[i] !== 10) i++; push("comment",a,i); continue; }
    if (c === 47 && bytes[i+1] === 42 && i+2 < bytes.length) { i += 3; while (i < bytes.length && !(bytes[i-1] === 42 && bytes[i] === 47)) i++; if (i < bytes.length) i++; push("comment",a,i); continue; }
    if (c === 39 || c === 34 || c === 96) { const q=c; i++; let closed=false; while(i<bytes.length){ if(bytes[i]===q){ if(bytes[i+1]===q){i+=2;continue;} i++;closed=true;break;} i++; } push(closed ? (q===39?"string":"id") : "illegal",a,i); continue; }
    if (c === 91) { i++; while(i<bytes.length && bytes[i]!==93)i++; const ok=i<bytes.length; if(ok)i++; push(ok?"id":"illegal",a,i); continue; }
    if ((c===120||c===88) && bytes[i+1]===39) { i+=2; while(i<bytes.length&&hex(bytes[i]!))i++; const ok=bytes[i]===39 && ((i-a)&1)===0; while(i<bytes.length&&bytes[i]!==39)i++; if(bytes[i]===39)i++; push(ok?"blob":"illegal",a,i); continue; }
    if (digit(c) || (c===46 && digit(bytes[i+1]??-1))) {
      let kind:TokenKind="integer"; if(c===46){kind="float";i++;} while(digit(bytes[i]??-1)||bytes[i]===95)i++;
      if(bytes[i]===46){kind="float";i++;while(digit(bytes[i]??-1)||bytes[i]===95)i++;}
      if((bytes[i]===101||bytes[i]===69) && (digit(bytes[i+1]??-1)||((bytes[i+1]===43||bytes[i+1]===45)&&digit(bytes[i+2]??-1)))) { kind="float"; i+=2; while(digit(bytes[i]??-1)||bytes[i]===95)i++; }
      while(id(bytes[i]??-1)){kind="illegal";i++;} push(kind,a,i); continue;
    }
    if (c===63) { i++; while(digit(bytes[i]??-1))i++; push("variable",a,i); continue; }
    if (c===58||c===64||c===36||c===35) { i++; let n=0; while(i<bytes.length){if(id(bytes[i]??-1)){i++;n++;continue;}if(bytes[i]===58&&bytes[i+1]===58){i+=2;continue;}if(n>0&&bytes[i]===40){i++;while(i<bytes.length&&!([32,9,10,12,13,41].includes(bytes[i]!)))i++;if(bytes[i]===41)i++;else{push("illegal",a,i);break;}continue;}break;} if(out.at(-1)?.startByte!==a)push(n?"variable":"illegal",a,i); continue; }
    if (id(c) && !digit(c)) { i++; while(id(bytes[i]??-1))i++; const text=decode(bytes,a,i); push(keyword(text)?"keyword":"id",a,i); continue; }
    if (c===0xef&&bytes[i+1]===0xbb&&bytes[i+2]===0xbf){i+=3;push("space",a,i);continue;}
    if (",;()+-*/%=<>.!|&~".includes(String.fromCharCode(c))) { i++; if ((c===60||c===62||c===33||c===61||c===124) && [61,62,60,124].includes(bytes[i]??-1)) i++; push(c===33&&i===a+1?"illegal":"punct",a,i); continue; }
    i++; push("illegal",a,i);
  }
  out.push(Object.freeze({kind:"eof",startByte:i,endByte:i,text:""})); return Object.freeze(out);
}
