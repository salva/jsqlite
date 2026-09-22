import { open } from "../../src/index.ts";
import { VdbeStatement } from "../../src/internal/vdbe.ts";

/** Singular adapter entry. The Request and every public error pass through unchanged. */
export async function openFixture(request, options) {
  return open(request, options);
}

/** Production-private accounting seam; never exported by src/index.ts. */
export function privateAccounting(statement) {
  if (!(statement instanceof VdbeStatement)) throw new TypeError("not a production VDBE statement");
  return statement.privateAccounting();
}
