const publicEntrypoint = new URL("../../src/index.js", import.meta.url);
function temporaryUnsupported(message, cause) {
  const error = new Error(message, { cause });
  error.name = "JSQLiteError"; error.kind = "unsupported"; error.code = null;
  error.extendedCode = null; error.unsupportedClassification = "temporary";
  return error;
}
/** Singular Stage 2 adapter entry; no runtime implementation exists at this milestone. */
export async function openFixture(request) {
  let api;
  try { api = await import(publicEntrypoint.href); }
  catch (cause) { throw temporaryUnsupported("public runtime engine is not implemented", cause); }
  if (typeof api.open !== "function") throw temporaryUnsupported("public runtime open() is not implemented");
  return api.open(request);
}
