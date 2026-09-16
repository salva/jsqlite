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

test("adapter reaches the real public prepared SELECT path", async () => {
  const bridge = await startFixtureServer(fixtureRoot);
  let connection;
  try {
    const request = new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`);
    connection = await openFixture(request);
    assert.equal(typeof connection.prepare, "function");
    assert.equal(typeof connection.close, "function");
    const prepared = connection.prepare("SELECT 1");
    assert.equal(await prepared.statement.step(), "row");
    assert.equal(prepared.statement.columnInteger(0), 1n);
    assert.equal(await prepared.statement.step(), "done");
    prepared.statement.finalize();
    assert.throws(() => connection.prepare("SELECT 7,(SELECT 8)"), error =>
      error instanceof JSQLiteError && error.kind === "unsupported" &&
      error.unsupportedClassification === "temporary");
    const compound = connection.prepare("SELECT 1 UNION ALL SELECT 2").statement;
    assert.equal(await compound.step(), "row");
    assert.equal(compound.columnInteger(0), 1n);
    assert.equal(await compound.step(), "row");
    assert.equal(compound.columnInteger(0), 2n);
    assert.equal(await compound.step(), "done");
    compound.finalize();
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
