import { open } from "../src/index.js";
import type {
  ColumnMetadata,
  Connection,
  PrepareResult,
  SqliteStorageClass,
  SqliteValue,
  Statement,
  StepResult,
} from "../src/index.js";

function expectType<T>(_value: T): void {}

const connection = await open("/db.sqlite", {
  timeoutMs: 100,
  limits: { maxFileBytes: 1024, maxWorkUnits: 50 },
});
expectType<Connection>(connection);
const prepared = connection.prepare("select ?1, :name");
expectType<PrepareResult>(prepared);
expectType<number>(prepared.tailOffset);
expectType<string>(prepared.tail);

if (prepared.statement) {
  const statement: Statement = prepared.statement;
  statement.bind(1, 7n);
  statement.bind(":name", "Ada");
  expectType<StepResult>(await statement.step());
  expectType<SqliteValue>(statement.column(0));
  expectType<bigint | null>(statement.columnInteger(0));
  expectType<number | null>(statement.columnReal(0));
  expectType<string | null>(statement.columnText(0));
  expectType<Uint8Array | null>(statement.columnBlob(0));
  expectType<SqliteStorageClass>(statement.columnType(0));
  expectType<ColumnMetadata>(statement.columnMetadata(0));
}

// @ts-expect-error INTEGER is bigint, not a potentially lossy number.
prepared.statement?.bind(1, true);
// @ts-expect-error Fetch signal belongs at OpenOptions.signal.
void open("/db.sqlite", { fetchOptions: { signal: new AbortController().signal } });
// @ts-expect-error column indexes are numeric.
prepared.statement?.column("name");
