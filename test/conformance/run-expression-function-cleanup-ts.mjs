// Project-specific function-context cleanup invariants. Native registration
// destructors return void, so secondary-cleanup-error precedence is not a native
// oracle claim. This executable zero-credit gate remains failing until the shared
// Mem/function context is translated.
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../../src/internal/vdbe.ts",import.meta.url),"utf8");
const required=["FunctionContext","cleanupResult","firstError"];
const missing=required.filter(x=>!source.includes(x));
assert.ok(missing.length>0,"remove zero-credit guard only after behavioral cleanup tests replace this structural gate");
console.log(JSON.stringify({schema:"jsqlite-function-cleanup-ts-gap/1",credit:0,outcome:"unimplemented-temporary",missing}));
