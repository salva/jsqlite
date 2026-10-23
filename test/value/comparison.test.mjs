import { sqliteUtf16ToUtf8 } from "../../src/internal/utf.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { BorrowLifetime, Mem } from "../../src/internal/mem.ts";
import {
  ComparisonError,
  compareBuiltinText,
  compareMem,
  compareRecordKey,
  KeyInfo,
  UnpackedRecordKey,
  unpackRecordKey,
} from "../../src/internal/comparison.ts";

test('synchronous register search key releases only its descriptor',()=>{
  const value=integer(42), info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]});
  const key=new UnpackedRecordKey([value],0,'seek',info,false);
  assert.equal(compareRecordKey(bytes(2,1,42),key,info),0);
  key.release();key.release();assert.equal(value.integerValue(),42n);
  assert.throws(()=>compareRecordKey(bytes(2,1,42),key,info));
  const again=new UnpackedRecordKey([value],0,'seek',info,false);
  assert.throws(()=>compareRecordKey(bytes(2,1),again,info));
  again.release();assert.equal(value.integerValue(),42n);value.release();
});

const bytes = (...values) => Uint8Array.from(values);
function integer(value) { const mem = new Mem(); mem.setInt64(BigInt(value)); return mem; }
function real(value) { const mem = new Mem(); mem.setDouble(value); return mem; }
function intReal(value) { const mem = new Mem(); mem.setIntReal(BigInt(value)); return mem; }
function text(value, encoding = "utf-8", options = {}) { const mem = new Mem(); mem.setText(bytes(...value), encoding, options); return mem; }
function blob(...value) { const mem = new Mem(); mem.setBlob(bytes(...value)); return mem; }
function ascii(value, encoding) {
  if (encoding === "utf-8") return bytes(...Buffer.from(value, "ascii"));
  const out = [];
  for (const byte of Buffer.from(value, "ascii")) out.push(...(encoding === "utf-16le" ? [byte, 0] : [0, byte]));
  return bytes(...out);
}

const keyInfo = (term = {}) => new KeyInfo({ encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 1, terms: [{ collation: "binary", ...term }] });

test("UTF16 direct output follows utf.c WRITE_UTF8 and counted terminator boundary", () => {
  const vectors=[
    [[],[]], [[0x41],[0x41]], [[0x7f,0x80,0x7ff],[0x7f,0xc2,0x80,0xdf,0xbf]],
    [[0x800,0xffff],[0xe0,0xa0,0x80,0xef,0xbf,0xbf]],
    [[0xd800],[0xed,0xa0,0x80]], [[0xdc00],[0xed,0xb0,0x80]],
    [[0xd800,0xdc00],[0xf0,0x90,0x80,0x80]],
    [[0xdbff,0xdfff],[0xf4,0x8f,0xbf,0xbf]],
    [[0xdc00,0x41],[0xf0,0x90,0x81,0x81]], [[0,0x41],[0,0x41]],
  ];
  for(const encoding of ["utf-16le","utf-16be"]) for(const [units,expected] of vectors) {
    const input=bytes(...units.flatMap(c=>encoding==="utf-16le"?[c&255,c>>8]:[c>>8,c&255]));
    for(const source of [input,bytes(...input,0xff)]) {
      const result=sqliteUtf16ToUtf8(source,encoding);
      assert.deepEqual(result,bytes(...expected));
      assert.equal(result.buffer.byteLength,2*input.length+1);
      assert.equal(new Uint8Array(result.buffer)[result.byteLength],0);
    }
  }
});

test("UTF16 builtin conversion shares Mem primitive for malformed units without mutation", () => {
  for (const encoding of ["utf-16le", "utf-16be"]) {
    const vectors = [[],[0x41],[0x41,0],[0,0],[0,0xd8],[0,0xdc],[0,0xd8,0x41,0],[0xff,0xff],[0x20,0,0x41]];
    for (const a of vectors) for (const b of vectors) {
      const left=bytes(...a), right=bytes(...b), savedLeft=left.slice(), savedRight=right.slice();
      const l=text(a,encoding), r=text(b,encoding);
      l.changeEncoding("utf-8"); r.changeEncoding("utf-8");
      for (const kind of ["nocase","rtrim"]) assert.equal(compareBuiltinText(kind,left,right,encoding),compareBuiltinText(kind,l.textBytes(),r.textBytes(),"utf-8"));
      assert.deepEqual(left,savedLeft); assert.deepEqual(right,savedRight);
    }
  }
});

test("serialized TEXT cross-encoding collation matches private Mem comparison", () => {
  const encodings=["utf-8","utf-16le","utf-16be"];
  for(const encoding of encodings) for(const callbackEncoding of encodings) for(const kind of ["binary","nocase","rtrim"]) {
    const collation={kind,encoding:callbackEncoding};
    const info=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation,desc:true}]});
    for(const a of ["A","a ","a\u0000b",""]) for(const b of ["a","A ","a\u0000c",""]) {
      const left=ascii(a,encoding),right=ascii(b,encoding);
      const life=new BorrowLifetime();
      const rhs=unpackRecordKey(bytes(2,13+2*right.length,...right),info,life);
      const expected=compareMem(text(left,encoding),text(right,encoding),collation);
      assert.equal(compareRecordKey(bytes(2,13+2*left.length,...left),rhs,info),expected===0?0:-expected);
      assert.deepEqual(rhs.values[0].textBytes(),right);
      life.invalidate();
      assert.throws(()=>compareRecordKey(bytes(2,13+2*left.length,...left),rhs,info));
      rhs.release();life.close();
    }
  }
});

test("record direct serial comparison preserves Mem ordering, suffixes and limits", () => {
  for (const encoding of ["utf-8", "utf-16le", "utf-16be"]) {
    for (const collation of ["binary", "nocase", "rtrim"]) {
      for (const desc of [false, true]) {
        const info = new KeyInfo({encoding, totalFieldCount: 2, keyFieldCount: 2,
          terms: [{collation, desc, nullsLarge: true}, {collation: "binary"}]});
        const fields = [
          {serial: 1, payload: bytes(0xff), mem: integer(-1)},
          {serial: 9, payload: bytes(), mem: integer(1)},
          ...["A", "a", "a ", "a\u0000b"].map(s => {
            const payload = ascii(s, encoding);
            return {serial: 13 + 2 * payload.length, payload, mem: text(payload, encoding)};
          }),
          {serial: 12, payload: bytes(), mem: blob()},
          {serial: 0, payload: bytes(), mem: new Mem()},
        ];
        const packed = f => bytes(3, f.serial, 9, ...f.payload);
        for (const left of fields) for (const right of fields) {
          const life = new BorrowLifetime();
          const rhs = unpackRecordKey(packed(right), info, life, {defaultRc: 1});
          const result = compareMem(left.mem, right.mem, collation);
          const isNull = left.serial === 0 || right.serial === 0;
          const ordered = result * (isNull ? -1 : 1) * (desc ? -1 : 1);
          assert.equal(compareRecordKey(packed(left), rhs, info), ordered === 0 ? 1 : ordered);
          assert.equal(rhs.eqSeen, result === 0);
          assert.throws(() => compareRecordKey(packed(left), rhs, info, {maxFields: 0}), ComparisonError);
          rhs.release(); life.close();
        }
        const rhs = unpackRecordKey(bytes(3, 9, 9), info, new BorrowLifetime());
        assert.throws(() => compareRecordKey(bytes(2, 9), rhs, info), e => e.reason === "corrupt");
        rhs.release();
      }
    }
  }
});

test("sqlite3MemCompare storage classes and exact INTEGER/REAL boundaries", () => {
  const nil = new Mem();
  assert.equal(compareMem(nil, integer(0)), -1);
  assert.equal(compareMem(integer(0), text([0x30])), -1);
  assert.equal(compareMem(text([0x30]), blob(0x30)), -1);
  assert.equal(compareMem(integer(9007199254740993n), real(9007199254740992)), 1);
  assert.equal(compareMem(integer(9223372036854775807n), real(2 ** 63)), -1);
  assert.equal(compareMem(integer(-9223372036854775808n), real(-Infinity)), 1);
  assert.equal(compareMem(integer(3), real(3.5)), -1);
  assert.equal(compareMem(integer(3), real(3)), 0);
  assert.equal(compareMem(real(-0), real(0)), 0);
  assert.equal(compareMem(real(Infinity), real(Infinity)), 0);
});

test("INTEGER/REAL boundary comparisons are antisymmetric and retain IntReal integer semantics", () => {
  const cases = [
    [integer(-9223372036854775808n), real(-Infinity), 1],
    [integer(-9223372036854775808n), real(-9223372036854776000), 0],
    [integer(-9223372036854775807n), real(-9223372036854776000), 1],
    [integer(9223372036854775807n), real(9223372036854776000), -1],
    [integer(9007199254740993n), real(9007199254740992), 1],
    [integer(9007199254740992n), real(9007199254740994), -1],
    [intReal(9007199254740993n), real(9007199254740992), 1],
  ];
  for (const [left, right, expected] of cases) {
    assert.equal(compareMem(left, right), expected);
    assert.equal(compareMem(right, left), -expected);
  }
  const one = real(1);
  const nextAboveOne = real(1 + Number.EPSILON);
  assert.equal(compareMem(one, nextAboveOne), -1);
  assert.equal(compareMem(nextAboveOne, one), 1);
  assert.equal(compareMem(intReal(42), integer(42)), 0);
});

test("storage ordering distinguishes NULL and empty TEXT/BLOB while BLOB remains bytewise", () => {
  const nil = new Mem();
  const emptyText = text([]);
  const emptyBlob = blob();
  assert.equal(compareMem(nil, emptyText), -1);
  assert.equal(compareMem(emptyText, emptyBlob), -1);
  assert.equal(compareMem(emptyBlob, blob(0)), -1);
  assert.equal(compareMem(blob(0), blob(0, 0)), -1);
  assert.equal(compareMem(blob(0xff), blob(0)), 1);
});

test("BINARY is bytewise; NOCASE folds ASCII only; RTRIM removes only trailing 0x20", () => {
  assert.equal(compareBuiltinText("binary", bytes(0x61, 0, 0x62), bytes(0x61, 0, 0x63), "utf-8"), -1);
  assert.equal(compareBuiltinText("binary", bytes(), bytes(0), "utf-8"), -1);
  assert.equal(compareBuiltinText("nocase", bytes(0x41, 0xc3, 0x86), bytes(0x61, 0xc3, 0xa6), "utf-8"), -1);
  assert.equal(compareBuiltinText("nocase", bytes(0x41, 0x62), bytes(0x61, 0x42), "utf-8"), 0);
  assert.equal(compareBuiltinText("rtrim", bytes(0x61, 0x20, 0x20), bytes(0x61), "utf-8"), 0);
  assert.equal(compareBuiltinText("rtrim", bytes(0x61, 0xc2, 0xa0), bytes(0x61), "utf-8"), 1);
  assert.equal(compareBuiltinText("nocase", new Uint8Array([0x61,0,0x62]), new Uint8Array([0x61,0,0x63]), "utf-8"), 0, "NOCASE stops at NUL for equal byte lengths");
  assert.equal(compareBuiltinText("nocase", new Uint8Array([0x61,0]), new Uint8Array([0x61,0,0x62]), "utf-8"), -1, "NOCASE uses full byte lengths after NUL prefix tie");
  // NOCASE/RTRIM callbacks are UTF-8 only; UTF-16 values translate first.
  assert.equal(compareBuiltinText("nocase", bytes(0x41, 0), bytes(0x61, 0), "utf-16le"), 0);
  assert.equal(compareBuiltinText("rtrim", bytes(0, 0x61, 0, 0x20), bytes(0, 0x61), "utf-16be"), 0);
});

test("built-in collations cover every database encoding and mixed Mem encodings", () => {
  for (const encoding of ["utf-8", "utf-16le", "utf-16be"]) {
    assert.equal(compareBuiltinText("binary", ascii("A", encoding), ascii("a", encoding), encoding), -1, `BINARY ${encoding}`);
    assert.equal(compareBuiltinText("nocase", ascii("Ab", encoding), ascii("aB", encoding), encoding), 0, `NOCASE ${encoding}`);
    assert.equal(compareBuiltinText("rtrim", ascii("a  ", encoding), ascii("a", encoding), encoding), 0, `RTRIM ${encoding}`);
  }

  const left16le = text([...ascii("Ab", "utf-16le")], "utf-16le");
  const right16be = text([...ascii("aB", "utf-16be")], "utf-16be");
  assert.equal(compareMem(left16le, right16be, { kind: "nocase", encoding: "utf-8" }), 0);
  assert.equal(compareMem(left16le, text([0x41, 0x63]), { kind: "binary", encoding: "utf-16be" }), -1);

  // SQLite's legacy UTF conversion accepts overlong UTF-8 and ignores an odd
  // trailing UTF-16 byte. Exercise those conversion rules through collations,
  // not just through Mem.changeEncoding's isolated tests.
  assert.equal(compareBuiltinText("nocase", bytes(0xc0, 0x80, 0x80), bytes(0), "utf-8"), 1);
  assert.equal(compareBuiltinText("nocase", bytes(0x41, 0, 0xff), bytes(0x61, 0), "utf-16le"), 0);
  assert.equal(compareBuiltinText("rtrim", bytes(0, 0x61, 0xff), bytes(0, 0x61), "utf-16be"), 0);
});

test("compareMem preserves source caches and converts only private text copies", () => {
  const left = integer(12); left.stringify("utf-16le", false);
  const right = integer(12); right.stringify("utf-8", false);
  const beforeLeft = left.diagnostic(), beforeRight = right.diagnostic();
  // Numeric flags win without touching simultaneous TEXT caches.
  assert.equal(compareMem(left, right, { kind: "nocase", encoding: "utf-8" }), 0);
  assert.deepEqual(left.diagnostic(), beforeLeft);
  assert.deepEqual(right.diagnostic(), beforeRight);
  const a = text([0x61, 0], "utf-16le"), b = text([0, 0x62], "utf-16be");
  const ad = a.diagnostic(), bd = b.diagnostic();
  assert.equal(compareMem(a, b, { kind: "binary", encoding: "utf-8" }), -1);
  assert.deepEqual(a.diagnostic(), ad); assert.deepEqual(b.diagnostic(), bd);
});

test("KeyInfo is defensively immutable and unpacked keys enforce descriptor identity", () => {
  const sourceTerm = { collation: { kind: "binary", encoding: "utf-8" }, desc: false, nullsLarge: false };
  const sourceTerms = [sourceTerm];
  const source = { encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 1, terms: sourceTerms };
  const info = new KeyInfo(source);

  // Construction snapshots every mutable layer supplied by the caller.
  source.encoding = "utf-16le";
  source.totalFieldCount = 9;
  source.keyFieldCount = 2;
  sourceTerm.desc = true;
  sourceTerm.nullsLarge = true;
  sourceTerm.collation.kind = "nocase";
  sourceTerms[0] = { collation: "rtrim" };
  sourceTerms.push({});
  assert.equal(info.encoding, "utf-8");
  assert.equal(info.totalFieldCount, 2);
  assert.equal(info.keyFieldCount, 1);
  assert.deepEqual(info.terms, [{ collation: { kind: "binary", encoding: "utf-8" }, desc: false, nullsLarge: false }]);

  // Descriptor, term array, terms and nested collation specs are frozen at runtime.
  assert(Object.isFrozen(info));
  assert(Object.isFrozen(info.terms));
  assert(Object.isFrozen(info.terms[0]));
  assert(Object.isFrozen(info.terms[0].collation));
  assert.throws(() => { info.encoding = "utf-16be"; }, TypeError);
  assert.throws(() => { info.terms.push({}); }, TypeError);
  assert.throws(() => { info.terms[0].desc = true; }, TypeError);
  assert.throws(() => { info.terms[0].collation.kind = "nocase"; }, TypeError);

  const rhs = unpackRecordKey(bytes(3, 9, 1, 1), info, new BorrowLifetime());
  assert.equal(rhs.keyInfo, info);
  assert.equal(compareRecordKey(bytes(3, 9, 1, 1), rhs, info), 0);

  // Structurally similar or differing metadata cannot be substituted: SQLite's
  // UnpackedRecord retains one pKeyInfo identity across unpack and comparison.
  const mismatches = [
    new KeyInfo({ encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 1, terms: [{ collation: { kind: "binary", encoding: "utf-8" }, desc: false, nullsLarge: false }] }),
    new KeyInfo({ encoding: "utf-16le", totalFieldCount: 2, keyFieldCount: 1, terms: [{}] }),
    new KeyInfo({ encoding: "utf-8", totalFieldCount: 3, keyFieldCount: 1, terms: [{}] }),
    new KeyInfo({ encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 2, terms: [{}, {}] }),
    new KeyInfo({ encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 1, terms: [{ collation: "nocase" }] }),
    new KeyInfo({ encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 1, terms: [{ desc: true }] }),
    new KeyInfo({ encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 1, terms: [{ nullsLarge: true }] }),
  ];
  for (const mismatch of mismatches) {
    assert.throws(
      () => compareRecordKey(bytes(3, 9, 1, 1), rhs, mismatch),
      error => error instanceof ComparisonError && error.reason === "internal" && /identity/.test(error.message),
    );
  }
  rhs.release();
});

test("packed key unpack, prefix defaultRc/eqSeen, DESC and NULL inversion", () => {
  const lifetime = new BorrowLifetime();
  const info = keyInfo();
  const unpacked = unpackRecordKey(bytes(3, 9, 1, 2), info, lifetime, { defaultRc: -1 });
  assert.equal(unpacked.values[0].integerValue(), 1n);
  assert.equal(unpacked.values[1].integerValue(), 2n);
  assert.equal(compareRecordKey(bytes(3, 9, 1, 7), unpacked, info), -1);
  assert.equal(unpacked.eqSeen, true);

  const nullLife = new BorrowLifetime();
  const nullInfo = keyInfo({ desc: true });
  const nullKey = unpackRecordKey(bytes(3, 0, 1, 1), nullInfo, nullLife);
  assert.equal(compareRecordKey(bytes(3, 9, 1, 1), nullKey, nullInfo), -1);
  const bigNullLife = new BorrowLifetime();
  const bigNullInfo = keyInfo({ nullsLarge: true });
  const bigNull = unpackRecordKey(bytes(3, 0, 1, 1), bigNullInfo, bigNullLife);
  assert.equal(compareRecordKey(bytes(3, 9, 1, 1), bigNull, bigNullInfo), -1);
});

test("seek caller construction rejects zero fields but permits an intentional nonempty prefix", () => {
  // vdbe.c OP_Seek* constructs UnpackedRecord with assert(nField>0), while
  // sqlite3VdbeRecordUnpack itself may reduce nField to the fields encountered.
  // Make that caller distinction explicit instead of inferring intent from an
  // arbitrary Mem-array length.
  const info = new KeyInfo({
    encoding: "utf-8",
    totalFieldCount: 3,
    keyFieldCount: 2,
    terms: [{}, {}],
  });

  assert.throws(
    () => unpackRecordKey(bytes(1), info, new BorrowLifetime(), { caller: "seek" }),
    error => error instanceof ComparisonError && error.reason === "internal" && /seek.*field/i.test(error.message),
  );

  const prefix = unpackRecordKey(bytes(2, 9), info, new BorrowLifetime(), {
    caller: "seek",
    defaultRc: 1,
  });
  assert.equal(prefix.values.length, 1);
  assert.equal(compareRecordKey(bytes(2, 9), prefix, info), 1);
  assert.equal(prefix.eqSeen, true);
  prefix.release();

  assert.throws(
    () => unpackRecordKey(bytes(4, 9, 9, 9), info, new BorrowLifetime(), { caller: "seek" }),
    error => error instanceof ComparisonError && error.reason === "internal" && /keyFieldCount/.test(error.message),
  );

  // Generic record-unpack remains distinct: a structurally valid zero-field
  // record is not globally reclassified as corrupt merely because Seek forbids
  // constructing a zero-field search key.
  const record = unpackRecordKey(bytes(1), info, new BorrowLifetime(), { caller: "record" });
  assert.equal(record.values.length, 0);
  assert.throws(
    () => compareRecordKey(bytes(1), record, info),
    error => error instanceof ComparisonError && error.reason === "internal" && /ordinary.*fewer/.test(error.message),
  );
  assert.equal(record.eqSeen, false);
  record.release();
});

test("production record comparator follows SQLite packed-LHS/unpacked-RHS orientation", () => {
  // sqlite3VdbeRecordCompare(int nKey1, const void *pKey1,
  // UnpackedRecord *pPKey2) owns default_rc/eqSeen on the unpacked RHS.
  // Exercise the production API directly; a test-local sign adapter is not a
  // substitute for source-oriented caller integration.
  const info = new KeyInfo({ encoding: "utf-8", totalFieldCount: 1, keyFieldCount: 1, terms: [{}] });
  const lessRhs = unpackRecordKey(bytes(2, 1, 2), info, new BorrowLifetime());
  assert.equal(compareRecordKey(bytes(2, 9), lessRhs, info), -1);
  assert.equal(lessRhs.eqSeen, false);
  lessRhs.release();

  for (const defaultRc of [-1, 0, 1]) {
    const prefixInfo = keyInfo();
    const rhs = unpackRecordKey(bytes(3, 9, 1, 1), prefixInfo, new BorrowLifetime(), { defaultRc });
    assert.equal(compareRecordKey(bytes(3, 9, 1, 7), rhs, prefixInfo), defaultRc);
    assert.equal(rhs.eqSeen, true);
    rhs.release();
  }
});

test("record terms apply every ASC/DESC and BIGNULL combination independently", () => {
  // NULL versus integer starts negative. SQLite applies BIGNULL first and the
  // independent DESC inversion second.
  for (const [desc, nullsLarge, expected] of [
    [false, false, 1],
    [false, true, -1],
    [true, false, -1],
    [true, true, 1],
  ]) {
    const info = keyInfo({ desc, nullsLarge });
    const unpacked = unpackRecordKey(bytes(3, 0, 1, 1), info, new BorrowLifetime());
    assert.equal(compareRecordKey(bytes(3, 9, 1, 1), unpacked, info), expected, `desc=${desc} nullsLarge=${nullsLarge}`);
    unpacked.release();
  }
});

test("equal-prefix packed LHS field shortage is corrupt while short seek RHS reaches defaultRc", () => {
  const info = new KeyInfo({ encoding: "utf-8", totalFieldCount: 2, keyFieldCount: 2, terms: [{}, {}] });
  const rhs = unpackRecordKey(bytes(3, 9, 9), info, new BorrowLifetime(), { defaultRc: 1 });

  // One equal field, then header exhaustion: there is no second serial type.
  assert.throws(
    () => compareRecordKey(bytes(2, 9), rhs, info),
    error => error instanceof ComparisonError && error.reason === "corrupt" && /header.*ended/.test(error.message),
  );
  assert.equal(rhs.eqSeen, false);

  // LOCAL-SAFETY (not native parity): the second serial type exists, but its
  // required payload does not. The pinned internal comparator assumes padded,
  // valid b-tree buffers and does not diagnose this synthetic truncation; the
  // browser-safe untrusted-input boundary deliberately rejects it.
  assert.throws(
    () => compareRecordKey(bytes(3, 9, 1), rhs, info),
    error => error instanceof ComparisonError && error.reason === "corrupt",
  );
  assert.equal(rhs.eqSeen, false);
  rhs.release();

  // In the opposite direction, an explicitly constructed short seek RHS is
  // intentional prefix state and still owns the defaultRc result.
  const seek = unpackRecordKey(bytes(2, 9), info, new BorrowLifetime(), { caller: "seek", defaultRc: -1 });
  assert.equal(compareRecordKey(bytes(3, 9, 9), seek, info), -1);
  assert.equal(seek.eqSeen, true);
  seek.release();
});

test("packed comparison stops after a decisive key term without decoding a malformed tail", () => {
  const lifetime = new BorrowLifetime();
  const info = keyInfo();
  const unpacked = unpackRecordKey(bytes(3, 1, 1, 1, 0), info, lifetime);
  // Header declares integer 2 then an 8-byte integer whose payload is absent.
  // sqlite3VdbeRecordCompare compares the first term incrementally and returns
  // before touching the malformed non-key tail.
  assert.equal(compareRecordKey(bytes(3, 1, 6, 2), unpacked, info), 1);
  // Full unpack has no early-return allowance and rejects the same absent
  // 8-byte payload instead of manufacturing a partial unpacked key.
  assert.throws(
    () => unpackRecordKey(bytes(3, 1, 6, 2), keyInfo(), new BorrowLifetime()),
    error => error instanceof ComparisonError && error.reason === "corrupt",
  );
});

test("incremental limits count compared fields and preserve decisive malformed-tail return", () => {
  const info = keyInfo();

  // The unpacked/packed keys each contain one encountered field although
  // KeyInfo permits the auxiliary second field. Incremental limits account for
  // the compared nField, not descriptor capacity.
  const equal = unpackRecordKey(bytes(2, 9), info, new BorrowLifetime());
  assert.equal(compareRecordKey(bytes(2, 9), equal, info, {
    maxFields: 1,
    maxWorkUnits: 3, // two packed bytes plus one compared field
  }), 0);
  assert.equal(equal.eqSeen, true);
  equal.release();

  // Header declares a decisive integer 2 followed by an absent 8-byte payload.
  // sqlite3VdbeRecordCompare returns after field 1. Applying exact incremental
  // limits must neither charge KeyInfo's unused capacity nor inspect that tail.
  const decisive = unpackRecordKey(bytes(2, 9), info, new BorrowLifetime());
  assert.equal(compareRecordKey(bytes(3, 1, 6, 2), decisive, info, {
    maxFields: 1,
    maxWorkUnits: 5, // four packed bytes plus one compared field
  }), 1);
  assert.equal(decisive.eqSeen, false);
  decisive.release();
});

test("field limits count encountered record fields, not KeyInfo capacity", () => {
  // LOCAL-SAFETY: sqlite3VdbeRecordUnpack allocates nKeyField+1 slots but
  // reduces nField to the number actually decoded. A deliberately short,
  // valid one-field record must therefore fit maxFields=1 even when KeyInfo
  // permits a second (rowid/auxiliary) field. The limit guards work performed,
  // not descriptor capacity.
  const info = keyInfo();
  const shortRecord = bytes(2, 9);
  const unpacked = unpackRecordKey(shortRecord, info, new BorrowLifetime(), {
    limits: { maxFields: 1 },
  });
  assert.equal(unpacked.values.length, 1);
  assert.equal(unpacked.values[0].integerValue(), 1n);
  unpacked.release();
});

test("record-key malformed inputs and resource limits fail at exact boundaries", () => {
  const info = keyInfo();
  const valid = bytes(3, 15, 1, 0x61, 2);
  const malformed = [
    [bytes(), "corrupt"],
    [bytes(0), "corrupt"],
    [bytes(2), "corrupt"],
    [bytes(2, 0x81), "corrupt"],
    [bytes(2, 10), "corrupt"],
    [bytes(2, 11), "corrupt"],
    [bytes(2, 6, 0, 0), "corrupt"],
  ];
  for (const [packed, reason] of malformed) {
    assert.throws(
      () => unpackRecordKey(packed, info, new BorrowLifetime()),
      error => error instanceof ComparisonError && error.reason === reason,
    );
  }

  const oneFieldInfo = new KeyInfo({ encoding: "utf-8", totalFieldCount: 1, keyFieldCount: 1, terms: [{}] });
  assert.throws(
    () => unpackRecordKey(bytes(3, 9, 1, 1, 2), oneFieldInfo, new BorrowLifetime()),
    error => error instanceof ComparisonError && error.reason === "corrupt",
  );

  for (const [limits, shouldPass] of [
    [{ maxBytes: valid.byteLength - 1 }, false],
    [{ maxBytes: valid.byteLength }, true],
    [{ maxFields: 1 }, false],
    [{ maxFields: 2 }, true],
    [{ maxWorkUnits: valid.byteLength + info.totalFieldCount - 1 }, false],
    [{ maxWorkUnits: valid.byteLength + info.totalFieldCount }, true],
  ]) {
    if (shouldPass) {
      const unpacked = unpackRecordKey(valid, info, new BorrowLifetime(), { limits });
      assert.equal(unpacked.values.length, 2);
      unpacked.release();
    } else {
      assert.throws(
        () => unpackRecordKey(valid, info, new BorrowLifetime(), { limits }),
        error => error instanceof ComparisonError && error.reason === "limit",
      );
    }
  }

  const unpacked = unpackRecordKey(valid, info, new BorrowLifetime());
  assert.throws(() => compareRecordKey(valid, unpacked, info, { maxBytes: 4 }), error => error instanceof ComparisonError && error.reason === "limit");
  assert.throws(() => compareRecordKey(valid, unpacked, info, { maxFields: 0 }), error => error instanceof ComparisonError && error.reason === "limit");
  assert.throws(() => compareRecordKey(valid, unpacked, info, { maxWorkUnits: 5 }), error => error instanceof ComparisonError && error.reason === "limit");
  assert.equal(compareRecordKey(valid, unpacked, info, { maxBytes: 5, maxFields: 1, maxWorkUnits: 6 }), 0);
  unpacked.release();
});

test("unpack rejects malformed/limited records and comparisons validate lifetimes", () => {
  assert.throws(() => unpackRecordKey(bytes(0x81, 0), keyInfo(), new BorrowLifetime()), error => error instanceof ComparisonError && error.reason === "corrupt");
  assert.throws(() => unpackRecordKey(bytes(3, 1, 1, 1, 2), keyInfo(), new BorrowLifetime(), { limits: { maxFields: 1 } }), error => error instanceof ComparisonError && error.reason === "limit");
  const lifetime = new BorrowLifetime();
  const borrowed = text([0x61], "utf-8", { ownership: "borrowed", lifetime });
  lifetime.invalidate();
  assert.throws(() => compareMem(borrowed, text([0x61])), error => error?.reason === "expired-borrow");
  const keyLifetime = new BorrowLifetime();
  const info = keyInfo();
  const unpacked = unpackRecordKey(bytes(3, 15, 1, 0x61, 2), info, keyLifetime);
  keyLifetime.close();
  assert.throws(() => compareRecordKey(bytes(3, 15, 1, 0x61, 2), unpacked, info), error => error?.reason === "expired-borrow");

  const released = unpackRecordKey(bytes(3, 15, 1, 0x61, 2), info, new BorrowLifetime());
  released.release();
  assert.throws(
    () => compareRecordKey(bytes(3, 15, 1, 0x61, 2), released, info),
    error => error instanceof ComparisonError && error.reason === "internal" && /released/.test(error.message),
  );
});
