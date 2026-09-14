import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import test from "node:test";

const apiUrl = new URL("../../src/index.ts", import.meta.url);
const fixtureRoot = new URL("../fixtures/", import.meta.url);
async function fixtureBytes() {
  const current = JSON.parse(await readFile(new URL("CURRENT.json", fixtureRoot), "utf8"));
  return readFile(new URL(
    `generations/${current.generationId}/generated/empty.db`,
    fixtureRoot,
  ));
}

async function listen(handler) {
  const server = http.createServer(handler);
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  return {
    close: () => new Promise((resolve) => {
      server.close(resolve);
      for (const socket of sockets) socket.destroy();
    }),
    url: new URL(`http://127.0.0.1:${address.port}/empty.db`),
  };
}

function assertJSQLiteError(error, kind) {
  assert.equal(error?.name, "JSQLiteError");
  assert.equal(error?.kind, kind);
  assert.equal(error?.code, null, `${kind} must not fabricate a SQLite result code`);
  return true;
}

test("public open acquires a complete SQLite file through real Fetch", async (t) => {
  const bytes = await fixtureBytes();
  const { close, url } = await listen((_request, response) => {
    response.writeHead(200, {
      "content-type": "application/vnd.sqlite3",
      "content-length": String(bytes.byteLength),
    });
    response.end(bytes);
  });
  t.after(close);

  const api = await import(apiUrl.href);
  assert.equal(typeof api.open, "function", "src/index.ts must export runtime open()");

  const connection = await api.open(url);
  assert.equal(typeof connection.close, "function");
  connection.close();
  assert.throws(
    () => connection.close(),
    (error) => assertJSQLiteError(error, "misuse"),
    "close releases connection-owned residency and repeated close is misuse",
  );
});

test("public open applies Fetch options, redirect handling, and streamed byte limits", async (t) => {
  const bytes = await fixtureBytes();
  const requests = [];
  const { close, url } = await listen((request, response) => {
    requests.push({ url: request.url, marker: request.headers["x-storage-review"] });
    if (request.url === "/empty.db") {
      response.writeHead(302, { location: "/chunked.db" });
      response.end();
      return;
    }
    response.writeHead(200, {
      "content-type": "application/vnd.sqlite3",
      "transfer-encoding": "chunked",
    });
    response.write(bytes.subarray(0, 64));
    response.end(bytes.subarray(64));
  });
  t.after(close);

  const api = await import(apiUrl.href);
  await assert.rejects(
    api.open(url, {
      fetchOptions: { headers: { "x-storage-review": "present" } },
      limits: { maxFileBytes: bytes.byteLength - 1 },
    }),
    (error) => assertJSQLiteError(error, "limit"),
  );
  assert.deepEqual(requests, [
    { url: "/empty.db", marker: "present" },
    { url: "/chunked.db", marker: "present" },
  ]);
});

test("public open rejects a declared oversized file before consuming its body", async (t) => {
  const bytes = await fixtureBytes();
  let bodyBytesSent = 0;
  const { close, url } = await listen((_request, response) => {
    response.writeHead(200, {
      "content-type": "application/vnd.sqlite3",
      "content-length": String(bytes.byteLength),
    });
    // One byte is enough for Fetch to resolve with headers. Keeping the body
    // incomplete distinguishes the declared-length guard from streamed counting.
    bodyBytesSent += 1;
    response.write(bytes.subarray(0, 1));
  });
  t.after(close);

  const api = await import(apiUrl.href);
  await assert.rejects(
    api.open(url, { limits: { maxFileBytes: bytes.byteLength - 1 } }),
    (error) => assertJSQLiteError(error, "limit"),
  );
  assert.equal(bodyBytesSent, 1, "the oversized response body was not streamed to completion");
});

test("public open distinguishes caller cancellation, timeout, and HTTP failure", async (t) => {
  const pendingResponses = new Set();
  const { close, url } = await listen((request, response) => {
    if (request.url === "/missing.db") {
      response.writeHead(404);
      response.end("missing");
      return;
    }
    pendingResponses.add(response);
    response.on("close", () => pendingResponses.delete(response));
    response.writeHead(200, { "content-type": "application/vnd.sqlite3" });
    response.write(Buffer.from("SQLite format 3\0"));
  });
  t.after(() => {
    for (const response of pendingResponses) response.destroy();
    return close();
  });

  const api = await import(apiUrl.href);
  await assert.rejects(
    api.open(new URL("/missing.db", url)),
    (error) => assertJSQLiteError(error, "transport"),
  );

  const controller = new AbortController();
  const cancelled = api.open(new URL("/cancel.db", url), { signal: controller.signal });
  setTimeout(() => controller.abort("review cancellation"), 10);
  await assert.rejects(cancelled, (error) => assertJSQLiteError(error, "cancelled"));

  await assert.rejects(
    api.open(new URL("/timeout.db", url), { timeoutMs: 10 }),
    (error) => assertJSQLiteError(error, "timeout"),
  );
});

test("public open separates malformed SQLite data from transport failures", async (t) => {
  const malformed = Buffer.alloc(512);
  const { close, url } = await listen((_request, response) => {
    response.writeHead(200, { "content-length": String(malformed.byteLength) });
    response.end(malformed);
  });
  t.after(close);

  const api = await import(apiUrl.href);
  await assert.rejects(api.open(url), (error) => {
    assert.equal(error?.name, "JSQLiteError");
    assert.equal(error?.kind, "sqlite");
    assert.equal(error?.code, 11);
    assert.equal(error?.extendedCode, 11);
    return true;
  });
});
