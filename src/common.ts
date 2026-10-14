import * as BI from "./bigint.ts";
import Cube from "./cube.ts";

export const MAX_LITERALS = 512;
export const BIGINT_0 = BI.BigInt(0);
export const BIGINT_1 = BI.BigInt(1);
export const BIGINT_0C = BI.not(BIGINT_0);
export const BIGINT_32 = BI.BigInt(32);
export const BIGINT_2_32 = BI.lshift(BI.BigInt(1), BIGINT_32);
export const BIGINT_2_64 = BI.lshift(BIGINT_2_32, BIGINT_32);

export const BIGINT_INDEX: BI.bigint[] = [];
export const BIGINT_INDEXC: BI.bigint[] = [];
for (let i = 0; i <= MAX_LITERALS; ++i) {
  const b = BI.lshift(BIGINT_1, BI.BigInt(i));
  BIGINT_INDEX.push(b);
  BIGINT_INDEXC.push(BI.not(b));
}

export const BIGINT_ODD = BIGINT_INDEX.filter((b, i) => i % 2 === 0).reduce(
  (acc, cur) => BI.or(acc, cur),
);

export function bitIndices(bits: BI.bigint): number[] {
  const res: number[] = [];
  // Fast path for the common single-word case: skips the asIntN/rshift pair,
  // each of which allocates a BigInt.
  if (BI.gte(bits, BIGINT_0) && BI.lt(bits, BIGINT_2_32)) {
    let b = BI.toNumber(bits) | 0;
    let i = Math.clz32(b);
    while (i < 32) {
      const li = 31 - i;
      res.push(li);
      b ^= 1 << li;
      i = Math.clz32(b);
    }
    return res;
  }
  let offset = 0;
  while (BI.ne(bits, BIGINT_0)) {
    let b = BI.toNumber(BI.asIntN(32, bits));
    bits = BI.rshift(bits, BIGINT_32);
    let i = Math.clz32(b);
    while (i < 32) {
      const li = 31 - i;
      res.push(offset + li);
      b ^= 1 << li;
      i = Math.clz32(b);
    }
    offset += 32;
  }
  return res;
}

export function bitIndicesOdd(bits: BI.bigint): number[] {
  const ODD = 0b1010101010101010101010101010101;
  const res: number[] = [];
  if (BI.gte(bits, BIGINT_0) && BI.lt(bits, BIGINT_2_32)) {
    let b = BI.toNumber(bits) | 0;
    b = (b & ODD) | ((b >> 1) & ODD);
    let i = Math.clz32(b);
    while (i < 32) {
      const li = 31 - i;
      res.push(li);
      b ^= 1 << li;
      i = Math.clz32(b);
    }
    return res;
  }
  let offset = 0;
  while (BI.ne(bits, BIGINT_0)) {
    let b = BI.toNumber(BI.asIntN(32, bits));
    b = (b & ODD) | ((b >> 1) & ODD);
    bits = BI.rshift(bits, BIGINT_32);
    let i = Math.clz32(b);
    while (i < 32) {
      const li = 31 - i;
      res.push(offset + li);
      b ^= 1 << li;
      i = Math.clz32(b);
    }
    offset += 32;
  }
  return res;
}

export function componentReduction(
  cubes: Cube[],
  cols: Iterable<number>,
): Cube[][] {
  const map: Map<number, Set<Cube>> = new Map();
  for (const i of cols) {
    const I = i - (i % 2);
    if (map.has(I)) continue;
    const s: Set<Cube> = new Set();
    for (const c of cubes)
      if (c.lits.includes(i) || c.lits.includes(i + 1)) s.add(c);
    if (s.size) map.set(I, s);
  }

  if (map.size <= 1) return [cubes];

  for (const c of cubes) {
    let prev = -1;
    for (const [k, v] of map) {
      if (!v.has(c)) continue;
      if (prev === -1) {
        prev = k;
        continue;
      }
      map.set(prev, new Set([...(map.get(prev) as Set<Cube>), ...v]));
      map.delete(k);
      if (map.size === 1) return [cubes];
    }
  }

  return [...map.values()].map((c) => [...c]);
}

// Merges the results of splitting on `binate`: a cube of res2 that equals one
// of res1 except for the split variable's literal is dropped, and the res1
// cube loses that literal. If the variable is projected out of the results,
// the halves can only share whole cubes, and those are dropped from res2.
// Indexing res2 by hash keeps this linear; each res1 cube still gets the
// first match in res2 order.
export function mergeSplit(
  res1: Cube[],
  res2: Cube[],
  binate: number,
  projected = false,
): Cube[] {
  const byHash: Map<number, Cube[]> = new Map();
  for (const r2 of res2) {
    const l = byHash.get(r2.hash);
    if (l) l.push(r2);
    else byHash.set(r2.hash, [r2]);
  }
  const hashMask = projected ? 0 : 3 << binate;
  const mask = projected
    ? BIGINT_0
    : BI.or(BIGINT_INDEX[binate], BIGINT_INDEX[binate + 1]);
  const remove: Set<Cube> = new Set();
  for (let i = 0; i < res1.length; ++i) {
    const r1 = res1[i];
    for (const r2 of byHash.get(r1.hash ^ hashMask) ?? []) {
      if (BI.eq(BI.xor(r1.bigint, r2.bigint), mask)) {
        if (!projected) res1[i] = Cube.fromBigInt(BI.and(r1.bigint, r2.bigint));
        remove.add(r2);
        break;
      }
    }
  }
  return remove.size ? res2.filter((r) => !remove.has(r)) : res2;
}

export function invBi(n: BI.bigint): BI.bigint {
  return BI.or(
    BI.lshift(BI.and(n, BIGINT_ODD), BIGINT_1),
    BI.and(BI.rshift(n, BIGINT_1), BIGINT_ODD),
  );
}

// invBi() on one 32-bit word
export function invBi32(n: number): number {
  return ((n & 0x55555555) << 1) | ((n >>> 1) & 0x55555555);
}

// The bigint whose first two 32-bit words are `lo` and `hi`
export function fromWords(lo: number, hi: number): BI.bigint {
  if (hi === 0) return BI.BigInt(lo >>> 0);
  return BI.or(BI.BigInt(lo >>> 0), BI.lshift(BI.BigInt(hi >>> 0), BIGINT_32));
}

export function popcount(n: BI.bigint, max = MAX_LITERALS): number {
  let c = 0;
  for (; c < max && BI.ne(n, BIGINT_0); ++c) n = BI.and(n, BI.sub(n, BIGINT_1));
  return c;
}
