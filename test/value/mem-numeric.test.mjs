import assert from "node:assert/strict";
import test from "node:test";
import { Mem, memToPublicInitial } from "../../src/internal/mem.ts";
import { arithmeticBinary } from "../../src/internal/vdbe-primitives.ts";

const enc = new TextEncoder();
function text(s, encoding = "utf-8") { const m = new Mem(); m.setText(encoding === "utf-8" ? enc.encode(s) : (() => { const b=new Uint8Array(s.length*2),v=new DataView(b.buffer); for(let i=0;i<s.length;i++)v.setUint16(i*2,s.charCodeAt(i),encoding==="utf-16le"); return b; })(), encoding); return m; }

test("UPSTREAM cast.test numeric extrema, prefix, decimal and nonnumeric casts", () => {
  for (const [input, expected] of [["9223372036854775807",9223372036854775807n],["-9223372036854775808",-9223372036854775808n],["123abc",123n],["abc",0n]]) {
    const m=text(input); m.cast("numeric","utf-8"); assert.equal(memToPublicInitial(m),expected);
  }
  const real=text("123.456xyz"); real.cast("numeric","utf-8"); assert.equal(memToPublicInitial(real),123.456);
  const over=text("9223372036854775808"); over.cast("numeric","utf-8"); assert.equal(typeof memToPublicInitial(over),"number");
  const max=text("999999999999999999999"); max.cast("integer","utf-8"); assert.equal(memToPublicInitial(max),9223372036854775807n);
  const min=text("-999999999999999999999"); min.cast("integer","utf-8"); assert.equal(memToPublicInitial(min),-9223372036854775808n);
  const rounded=text("3500000000000000.2500001"); rounded.cast("real","utf-8"); assert.equal(memToPublicInitial(rounded),3500000000000000);
  const leadingZeroes=text("00000000000000000000123.5"); leadingZeroes.cast("numeric","utf-8"); assert.equal(memToPublicInitial(leadingZeroes),123.5);
  const leadingZeroExponent=text("000000000000000000001.25e2"); leadingZeroExponent.cast("numeric","utf-8"); assert.equal(memToPublicInitial(leadingZeroExponent),125n);
});

test("UPSTREAM cast.test integer/real/text/blob and signed-zero/nonfinite behavior", () => {
  const trunc=text("-123.9"); trunc.cast("integer","utf-8"); assert.equal(memToPublicInitial(trunc),-123n);
  const r=text("44"); r.cast("real","utf-8"); assert.equal(memToPublicInitial(r),44); assert.equal(typeof memToPublicInitial(r),"number");
  const zero=text("-0.0"); zero.cast("real","utf-8"); assert.ok(Object.is(memToPublicInitial(zero),-0));
  const inf=text("1e999"); inf.cast("real","utf-8"); assert.equal(memToPublicInitial(inf),Infinity);
  const i=new Mem(); i.setInt64(123n); i.cast("text","utf-8"); assert.equal(memToPublicInitial(i),"123"); i.cast("blob","utf-8"); assert.deepEqual(memToPublicInitial(i),enc.encode("123"));
  for (const [input, expected] of [[1e20,"1.0e+20"],[1e-7,"1.0e-07"],[1e15,"1000000000000000.0"],[1e-4,"0.0001"],[-1e20,"-1.0e+20"]]) {
    const value=new Mem(); value.setDouble(input); value.cast("text","utf-8"); assert.equal(memToPublicInitial(value),expected);
  }
  // Pinned SQLite 3.53.4 vdbeMemRenderNum/"%!.17g" observations. These
  // distinguish its conditional round-trip shortening from both 15-digit
  // formatting and JavaScript's unconditionally shortest Number spelling.
  for (const [input, expected] of [
    [1.2345678901234567,"1.2345678901234567"],
    [1.0000000000000002,"1.0000000000000002"],
    [Number.MIN_VALUE,"4.9406564584124654e-324"],
    [Number.MAX_VALUE,"1.7976931348623157e+308"],
    [999999999999999.9,"999999999999999.88"],
    // Deterministic binary64 differential cases exercise SQLite's private
    // conversion rather than host decimal decomposition.
    [1.0014082596188545e-122,"1.0014082596188545e-122"],
    [-1.3390233450313502e-281,"-1.3390233450313502e-281"],
    [-1.0455731240036311e-291,"-1.0455731240036311e-291"],
    [1.1340841101892859e+114,"1.1340841101892859e+114"],
    [0.1,"0.1"],
    [49.47,"49.47"],
  ]) {
    const value=new Mem(); value.setDouble(input); value.cast("text","utf-8"); assert.equal(memToPublicInitial(value),expected);
  }
});

test("PINNED-NATIVE vdbeMemRenderNum renders both IEEE zero payloads canonically", () => {
  for (const input of [0, -0]) {
    const cached = new Mem(); cached.setDouble(input); cached.stringify("utf-8", false);
    assert.equal(cached.textValue(), "0.0");
    assert.deepEqual([cached.diagnostic().numeric, cached.diagnostic().bytes], ["real", "text"]);
    assert.equal(Object.is(cached.realValue(), -0), Object.is(input, -0), "non-forced cache retains zero sign");

    const forced = new Mem(); forced.setDouble(input); forced.cast("text", "utf-8");
    assert.equal(forced.textValue(), "0.0");
    assert.deepEqual([forced.diagnostic().numeric, forced.diagnostic().bytes], [null, "text"]);
  }
  // COMPANION: applicable vdbe arithmetic-produced signed zero before stringify.
  for (const [left, right, negative] of [[0, 2, false], [-0, 2, true]]) {
    const a = new Mem(); a.setDouble(left); const b = new Mem(); b.setDouble(right);
    const result = arithmeticBinary("multiply", a, b);
    assert.equal(Object.is(result.realValue(), -0), negative);
    result.stringify("utf-8", false);
    assert.equal(result.textValue(), "0.0");
    assert.equal(Object.is(result.realValue(), -0), negative);
  }
});

test("PINNED-NATIVE numericType remains distinct from affinity and INTEGER cast", () => {
  // vdbe.c computeNumericType accepts a numeric prefix and preserves decimal or
  // exponent inputs as REAL. It computes into a caller-private value here, so
  // the source Mem must retain its TEXT class and exact encoded bytes.
  for (const encoding of ["utf-8", "utf-16le", "utf-16be"]) {
    for (const [input, expected] of [["12x", 12n], ["-2", -2n], ["1.0", 1], ["1e2", 100]]) {
      const source = text(input, encoding);
      const before = new Uint8Array(source.textBytes());
      const numeric = source.numericTypeCopy();
      assert.equal(memToPublicInitial(numeric), expected, `${encoding} numericType ${input}`);
      assert.equal(numeric.initialStorageClass, input.includes(".") || input.includes("e") ? "real" : "integer");
      assert.equal(source.initialStorageClass, "text");
      assert.deepEqual(source.textBytes(), before);
    }

    // vdbemem.c sqlite3VdbeIntValue instead consumes only the signed decimal
    // prefix. These neighbors prevent reconflating CAST with numericType.
    for (const [input, expected] of [["1e2", 1n], ["123e+5", 123n], ["-123.9", -123n], ["x12", 0n]]) {
      const value = text(input, encoding);
      value.cast("integer", encoding);
      assert.equal(memToPublicInitial(value), expected, `${encoding} INTEGER cast ${input}`);
    }
  }

  // Arithmetic is a numericType caller: integral exponent spelling remains a
  // REAL result instead of NUMERIC affinity's exact-integer storage class.
  const left = text("1e2");
  const zero = new Mem(); zero.setInt64(0n);
  const result = arithmeticBinary("add", left, zero);
  assert.equal(result.initialStorageClass, "real");
  assert.equal(memToPublicInitial(result), 100);
});

test("UPSTREAM vdbemem/vdbe masks preserve caches or clear forms and retain subtype", () => {
  for (const make of [() => { const m=new Mem(); m.setInt64(12n); return m; }, () => { const m=new Mem(); m.setDouble(12.5); return m; }, () => { const m=new Mem(); m.setIntReal(12n); return m; }]) {
    const m=make(); m.setSubtype(7); m.markFromBind(); m.stringify("utf-8",false);
    assert.equal(m.diagnostic().bytes,"text"); assert.notEqual(m.diagnostic().numeric,null);
    const cached=m.textBytes(); m.stringify("utf-8",false); assert.equal(m.textBytes(),cached);
    m.changeEncoding("utf-16le"); assert.notEqual(m.diagnostic().numeric,null);
    assert.equal(m.diagnostic().subtype,null); assert.equal(m.diagnostic().fromBind,false);
  }
  const affinity=text("48.00"); affinity.setSubtype(9); affinity.markFromBind(); affinity.applyAffinity("numeric","utf-8");
  assert.equal(affinity.diagnostic().bytes,null); assert.equal(affinity.diagnostic().numeric,"integer"); assert.equal(affinity.diagnostic().subtype,9); assert.equal(affinity.diagnostic().fromBind,true);
  const cached=new Mem(); cached.setDouble(4.5); cached.stringify("utf-8",false); cached.setSubtype(11); cached.cast("integer","utf-8");
  assert.equal(cached.diagnostic().bytes,null); assert.equal(cached.diagnostic().numeric,"integer"); assert.equal(cached.diagnostic().subtype,11);
  const asText=new Mem(); asText.setInt64(4n); asText.stringify("utf-8",false); asText.setSubtype(12); asText.cast("text","utf-8");
  assert.equal(asText.diagnostic().numeric,null); assert.equal(asText.diagnostic().bytes,"text"); assert.equal(asText.diagnostic().subtype,12);
  const asBlob=new Mem(); asBlob.setInt64(5n); asBlob.stringify("utf-8",false); asBlob.setSubtype(13); asBlob.cast("blob","utf-8");
  assert.equal(asBlob.diagnostic().numeric,null); assert.equal(asBlob.diagnostic().bytes,"blob"); assert.equal(asBlob.diagnostic().subtype,13);
});
test("UPSTREAM numeric affinity requires full text and prefers exact integer", () => {
  const no=text("123abc"); no.applyAffinity("numeric","utf-8"); assert.equal(memToPublicInitial(no),"123abc");
  const yes=text("48.00"); yes.applyAffinity("numeric","utf-8"); assert.equal(memToPublicInitial(yes),48n);
  for (const encoding of ["utf-16le","utf-16be"]) { const m=text("123",encoding); m.applyAffinity("numeric",encoding); assert.equal(memToPublicInitial(m),123n); }
  const nul=text("12\0x"); nul.cast("numeric","utf-8"); assert.equal(memToPublicInitial(nul),12n);
  const odd = new Mem(); odd.setText(Uint8Array.of(0x31,0,0x32,0,0xff),"utf-16le"); odd.cast("integer","utf-16le"); assert.equal(memToPublicInitial(odd),12n);
});
test('vdbe.c FLEXNUM converts numeric text but retains REAL and BLOB',()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const real=new Mem();real.setDouble(1);real.applyAffinity('flexnum',encoding);assert.equal(memToPublicInitial(real),1);assert.equal(typeof memToPublicInitial(real),'number');
  const numeric=text('1.0',encoding);numeric.applyAffinity('flexnum',encoding);assert.equal(memToPublicInitial(numeric),1n);
  const bad=text('1x',encoding);bad.applyAffinity('flexnum',encoding);assert.equal(memToPublicInitial(bad),'1x');
  const blob=new Mem();blob.setBlob(enc.encode('1'));blob.applyAffinity('flexnum',encoding);assert.deepEqual(memToPublicInitial(blob),enc.encode('1'));
 }
});
