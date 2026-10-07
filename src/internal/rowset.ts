import { PrivateStateByteBudget, PrivateStateLimitError, type PrivateStateControl } from './private-state.ts';

// Pinned rowset.c: RowSetEntry is shared by pending lists, search trees and
// forest links. Logical allocation charges (not JS heap measurements): 64-byte
// owner plus 42 entries * 24 bytes + 8-byte chunk link. Initial malloc slack is
// deliberately zero; chunks are retained until clear/delete, including merged
// duplicates. Algorithms and batch visibility are unchanged.
type Node = { v: bigint; left: Node | null; right: Node | null };
const CHUNK_ENTRIES = 42, CHUNK_BYTES = 8 + CHUNK_ENTRIES * 24, OWNER_BYTES = 64;
export class RowSet {
  #entry: Node | null = null;
  #last: Node | null = null;
  #forest: Node | null = null;
  #chunks: Node[][] = [];
  #fresh = 0;
  #sorted = true;
  #next = false;
  #batch = 0;
  #deleted = false;
  readonly budget: PrivateStateByteBudget;
  readonly maxEntries: number;
  control: PrivateStateControl;
  constructor(budget: PrivateStateByteBudget, maxEntries: number, control: PrivateStateControl) {
    this.budget = budget; this.maxEntries = maxEntries; this.control = control;
    budget.reserve(OWNER_BYTES);
  }
  #live(): void { if (this.#deleted) throw new Error('deleted RowSet'); }
  async #alloc(): Promise<Node> {
    await this.control.checkpoint(0);
    if (!this.#fresh) {
      if ((this.#chunks.length + 1) * CHUNK_ENTRIES > this.maxEntries) throw new PrivateStateLimitError('RowSet exceeds entry limit');
      this.budget.reserve(CHUNK_BYTES);
      this.#chunks.push([]);
      this.#fresh = CHUNK_ENTRIES;
    }
    --this.#fresh;
    const node: Node = {v: 0n, left: null, right: null};
    this.#chunks.at(-1)!.push(node);
    return node;
  }
  async insert(value: bigint): Promise<void> {
    this.#live(); if (this.#next) throw new Error('RowSet insert after next');
    await this.control.checkpoint(1);
    const node = await this.#alloc(); node.v = value;
    if (this.#last) { if (value <= this.#last.v) this.#sorted = false; this.#last.right = node; }
    else this.#entry = node;
    this.#last = node;
  }
  async #merge(a: Node, b: Node): Promise<Node> {
    const head: Node = {v:0n, left:null, right:null}; let tail = head;
    for (;;) {
      await this.control.checkpoint(1);
      if (a.v <= b.v) {
        if (a.v < b.v) { tail.right = a; tail = a; }
        const next = a.right; if (!next) { tail.right = b; break; } a = next;
      } else {
        tail.right = b; tail = b;
        const next = b.right; if (!next) { tail.right = a; break; } b = next;
      }
    }
    return head.right!;
  }
  async #sort(input: Node | null): Promise<Node | null> {
    const buckets: (Node | null)[] = Array(40).fill(null);
    while (input) {
      await this.control.checkpoint(1);
      const next = input.right; input.right = null;
      let i = 0;
      while (buckets[i]) { input = await this.#merge(buckets[i]!, input); buckets[i++] = null; }
      if (i >= buckets.length) throw new PrivateStateLimitError('RowSet sort depth exceeds bound');
      buckets[i] = input; input = next;
    }
    input = buckets[0]!;
    for (let i = 1; i < buckets.length; ++i) if (buckets[i]) input = input ? await this.#merge(input, buckets[i]!) : buckets[i]!;
    return input;
  }
  async #treeToList(node: Node): Promise<[Node, Node]> {
    await this.control.checkpoint(1);
    let first = node, last = node;
    if (node.left) { const [head, tail] = await this.#treeToList(node.left); first = head; tail.right = node; }
    if (node.right) { const [head, tail] = await this.#treeToList(node.right); node.right = head; last = tail; }
    return [first, last];
  }
  async #listToTree(list: Node): Promise<Node> {
    const cursor = {list: list.right}; list.left = list.right = null;
    const nDeep = async (depth: number): Promise<Node | null> => {
      await this.control.checkpoint(1);
      if (!cursor.list) return null;
      if (depth > 1) {
        const left = await nDeep(depth - 1), node = cursor.list;
        if (!node) return left;
        node.left = left; cursor.list = node.right; node.right = await nDeep(depth - 1); return node;
      }
      const node = cursor.list; cursor.list = node.right; node.left = node.right = null; return node;
    };
    let root = list;
    for (let depth = 1; cursor.list; ++depth) {
      const left = root; root = cursor.list; cursor.list = root.right;
      root.left = left; root.right = await nDeep(depth);
    }
    return root;
  }
  async test(batch: number, value: bigint): Promise<boolean> {
    this.#live(); if (this.#next) throw new Error('RowSet test after next');
    if (batch !== this.#batch) {
      let pending = this.#entry;
      if (pending) {
        if (!this.#sorted) pending = (await this.#sort(pending))!;
        let tree = this.#forest, previous: Node | null = null;
        while (tree) {
          previous = tree;
          if (!tree.left) { tree.left = await this.#listToTree(pending); break; }
          const [head] = await this.#treeToList(tree.left); tree.left = null;
          pending = await this.#merge(head, pending); tree = tree.right;
        }
        if (!tree) {
          tree = await this.#alloc();
          if (previous) previous.right = tree; else this.#forest = tree;
          tree.left = await this.#listToTree(pending);
        }
        this.#entry = this.#last = null; this.#sorted = true;
      }
      this.#batch = batch;
    }
    for (let tree = this.#forest; tree; tree = tree.right) {
      let node = tree.left;
      while (node) {
        await this.control.checkpoint(1);
        if (node.v < value) node = node.right;
        else if (node.v > value) node = node.left;
        else return true;
      }
    }
    return false;
  }
  async next(): Promise<bigint | null> {
    this.#live(); if (this.#forest) throw new Error('RowSet next after test');
    if (!this.#next) { if (!this.#sorted) this.#entry = await this.#sort(this.#entry); this.#sorted = this.#next = true; }
    if (!this.#entry) return null;
    const value = this.#entry.v; this.#entry = this.#entry.right;
    if (!this.#entry) this.clear();
    return value;
  }
  clear(): void {
    this.#live(); this.budget.release(this.#chunks.length * CHUNK_BYTES);
    this.#chunks = []; this.#fresh = 0; this.#entry = this.#last = this.#forest = null;
    this.#sorted = true; this.#next = false;
    // sqlite3RowSetClear deliberately does not reset iBatch.
  }
  delete(): void { if (!this.#deleted) { this.clear(); this.budget.release(OWNER_BYTES); this.#deleted = true; } }
}
