# Shared STAT4 sample ownership correction

## Input and reproduced gap

Independent finding: [[card:card-s-h-d]] accepted status45, candidate
`1c9b67675a17519627493bc05d9d3accce9a32b0`, tree
`df1c9561035999b803d41259091afb053a5ac4fb`. On that exact checkout, loader→scalar
reproduction copied1048584 bytes before its first rejected check, with zero
reservations and exact sentinel propagation (b proc-e468806beb23). The new
`stat4-owned-sample.test.mjs` failed **0/2**, proc-45935076e499: both scalar
and packed-probe first-check assertions saw1048584 rather than0 copied bytes.
These tests preserve the original1MiB padded record reproducer; they do not
weaken its rejection or allocation-order requirement.

## Source comparison and remedy

Pinned SQLite3.53.4 analyze.c:loadStatTbl1884–1890 acquires/copies n+8 once
into IndexSample.p. vdbemem.c:sqlite3Stat4Column2149ff borrows that pointer,
checks header/payload endpoints and extracts only the destination field.
vdbeaux.c's stat4 packed-record comparator likewise consumes retained bytes.
TS's defensive `sample.p` getter was introduced to prevent mutable aliases,
but scalar destructuring and probe.compare invoked its full-record slice before
their first checked operation. Adding accounting around this unnecessary repeated
copy would retain a source ownership divergence instead of correcting it.

`stat4-record.ts` now holds a module-private WeakMap from schema sample identity
to its already charged owned bytes. Loader registers the sample once; trusted
scalar/probe readers borrow through the internal accessor. Public sample.p still
copies. The registry is an encapsulation/representation adaptation, not another
estimator or algorithm substitution: it neither sorts/decodes records nor adds
another byte owner. The weak key does not extend schema/sample lifetime; values
are the existing n+8 allocation, not another copy. Internal callers must not mutate
or leak the borrow. It is an internal module boundary, not a hostile-code sandbox;
no public API exposes registration/access. Hand-built structural primitive inputs
retain their pre-existing p contract. Ordinary public copy reads remain explicit
copies outside execution primitive accounting, not a public heap-limit promise.

n, padding, counts, schema publication/failure, lazy serial interpretation,
comparison error channel and destination mutation/cleanup order are unchanged.
Scalar field and comparison/transcode reservations/checks remain with their
existing owners; no allowance is loosened or public contract changed. Raw records
are not eagerly unpacked. Ordinary strict record readers are untouched.

## Coverage and commands on corrected combined input

- `node --experimental-strip-types --test test/conformance/stat4-owned-sample.test.mjs`
  **2/2 exit0**; `npx tsc --noEmit` exit0, proc-76a2ee694c47.
  Loader input and public getter copies can be mutated without affecting owned
  bytes. Both actual consumers reject their first check with zero slice bytes;
  scalar first-reservation rejection also copies zero; retry yields correct
  value/comparison, all reservations release. Prototype hook restored in finally.
- `node --experimental-strip-types --test test/conformance/stat4-*.test.mjs docs/research/card-s-h/skiprange-*.test.mjs`
  **126/126 exit0,0skip/cancel/fail**, proc-566f333dd677; full output
  `work:///cards/card-s-h-b/processes/proc-566f333dd677/stdout.log`, tail read.
  Includes loader/lifecycle, KeyStats, probe, padded malformed/native fixtures,
  all encodings, field/error ordering and reservation-frontier checks; actual
  public midloop signal cancellation, injected elapsed-clock deadline and schema
  allowance rejection with cleanup/reset/retry; useful public selection also
  passes. These checks are author verification, not d's independent acceptance.
  Injected clock evidence is not scheduler fairness/event-loop preemption.

Earlier primary-checkout public0/3 failures are retained in b status21–24 but do
not describe this newer integrated candidate. Native identity/oracle provenance
remains in SKIPSCAN_PRIMITIVES.md and d's VERIFY_BOUNDED.md; no native runtime is
used here and no universal compatibility/plan-parity claim follows. d retains
remaining independent caller/lowering review, native/browser reconciliation and
broader documentation gates from status45. This correction changes only shared
sample access, both consumers, targeted tests and concise owning guide/map notes.
