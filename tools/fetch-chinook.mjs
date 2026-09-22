import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const contractUrl = new URL("../test/fixtures/public/chinook.json", import.meta.url);
const contract = JSON.parse(await readFile(contractUrl, "utf-8"));
const destination = resolve(process.argv[2] ?? "Chinook_Sqlite.sqlite");
const response = await fetch(contract.url);
if (!response.ok) throw new Error(`Chinook fetch failed: HTTP ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
const digest = createHash("sha256").update(bytes).digest("hex");
if (bytes.byteLength !== contract.bytes || digest !== contract.sha256) {
  throw new Error(`Chinook identity mismatch: ${bytes.byteLength} bytes sha256 ${digest}`);
}
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, bytes);
console.log(`${destination}\t${bytes.byteLength}\t${digest}`);
