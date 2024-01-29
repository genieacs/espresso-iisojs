import * as BI from "./bigint";
import Cube from "./cube";

export const MAX_LITERALS = 512;
export const BIGINT_0 = BI.BigInt(0);
export const BIGINT_1 = BI.BigInt(1);
export const BIGINT_0C = BI.not(BIGINT_0);
export const BIGINT_32 = BI.BigInt(32);

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
    for (const c of cubes) if (c.set.has(i) || c.set.has(i + 1)) s.add(c);
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

export function invBi(n: BI.bigint): BI.bigint {
  return BI.or(
    BI.lshift(BI.and(n, BIGINT_ODD), BIGINT_1),
    BI.and(BI.rshift(n, BIGINT_1), BIGINT_ODD),
  );
}

export function popcount(n: BI.bigint, max = MAX_LITERALS): number {
  let c = 0;
  for (; c < max && BI.ne(n, BIGINT_0); ++c) n = BI.and(n, BI.sub(n, BIGINT_1));
  return c;
}
