import { open } from "../../src/index.ts";

/** Singular adapter entry. The Request and every public error pass through unchanged. */
export async function openFixture(request, options) {
  return open(request, options);
}
