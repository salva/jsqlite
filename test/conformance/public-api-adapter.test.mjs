import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { openFixture } from "./public-api-adapter.mjs";
import { startFixtureServer } from "./fixture-server.mjs";
import { JSQLiteError } from "../../src/index.ts";

const fixtureRoot = path.resolve(new URL("../fixtures", import.meta.url).pathname);

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("adapter reaches the real public connection before genuine prepare unsupported", async () => {
  const bridge = await startFixtureServer(fixtureRoot);
  let connection;
  try {
    const request = new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`);
    connection = await openFixture(request);
    assert.equal(typeof connection.prepare, "function");
    assert.equal(typeof connection.close, "function");
    assert.throws(
      () => connection.prepare("SELECT 1"),
      error => error instanceof JSQLiteError && error.kind === "unsupported" &&
        error.unsupportedClassification === "temporary" &&
        error.message === "SQL preparation is not implemented",
    );
  } finally {
    connection?.close();
    await closeServer(bridge.server);
  }
});

test("adapter does not mask public SQLite or transport failures as unsupported", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(Uint8Array.of(1, 2, 3));
    await assert.rejects(
      openFixture(new Request("https://example.test/malformed")),
      (error) => error instanceof JSQLiteError && error.kind === "sqlite" && error.unsupportedClassification === null,
    );

    const cause = new Error("sentinel transport failure");
    globalThis.fetch = async () => { throw cause; };
    await assert.rejects(
      openFixture(new Request("https://example.test/transport")),
      (error) => error instanceof JSQLiteError && error.kind === "transport" && error.cause === cause && error.unsupportedClassification === null,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});
