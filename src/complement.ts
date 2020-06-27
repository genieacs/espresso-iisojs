import * as BI from "./bigint";
import Cover from "./cover";
import {
  BIGINT_0,
  invBi,
  BIGINT_INDEX,
  bitIndices,
  bitIndicesOdd,
  MAX_LITERALS,
  popcount,
  componentReduction,
  BIGINT_ODD,
  BIGINT_1,
} from "./common";
import Cube from "./cube";

export default function complement(
  cover: Cover,
  lit = BIGINT_0,
  free = cover.bigint
): Cube[] {
  let repeat = false;
  let taut = false;
  do {
    repeat = false;
    cover = cover.filter((c) => {
      if (BI.ne(BI.and(lit, c.bigint), BIGINT_0)) return false;
      const diff = BI.and(c.bigint, free);
      const pc = popcount(diff, 2);
      if (pc === 1) {
        repeat = true;
        lit = BI.or(lit, diff);
        if (BI.eq(BI.and(BIGINT_ODD, diff), BIGINT_0))
          free = BI.xor(free, BI.rshift(diff, BIGINT_1));
        else free = BI.xor(free, BI.lshift(diff, BIGINT_1));
        return false;
      }
      if (pc === 0) taut = true;
      return true;
    });
    if (taut) return [];
  } while (repeat);

  if (!cover.cubes.length) return [Cube.fromBigInt(invBi(lit))];

  free = BI.and(cover.bigint, free);
  const res: Cube[] = [];

  if (cover.cubes.length === 1) {
    const inv = invBi(lit);
    for (const f of bitIndices(free))
      res.push(Cube.fromBigInt(BI.or(inv, BIGINT_INDEX[f ^ 1])));
    return res;
  }

  let binate = -1;
  let binateness = 0;
  let binatenessMin = 0;
  let sparseness = 0;
  const freeIdx = bitIndicesOdd(free);
  const elim: Set<number> = new Set();
  for (const f of freeIdx) {
    const count0 = cover.count(f);
    const count1 = cover.count(f + 1);
    const count = count0 + count1;
    if (count0 && count1) {
      if (count >= binateness) {
        const min = Math.min(count0, count1);
        if (count > binateness || min > binatenessMin) {
          binate = f;
          binateness = count;
          binatenessMin = min;
        }
      }
    } else if (count === cover.cubes.length) {
      elim.add(f);
      res.push(
        Cube.fromBigInt(invBi(BI.or(lit, BIGINT_INDEX[count0 ? f : f + 1])))
      );
      free = BI.xor(free, BIGINT_INDEX[count0 ? f : f + 1]);
    }
    sparseness = Math.max(sparseness, count);
  }

  if (sparseness * 3 < cover.cubes.length && freeIdx.length - elim.size > 8) {
    const covers = componentReduction(
      cover.cubes,
      freeIdx.filter((f) => !elim.has(f))
    );
    if (covers.length > 1) {
      const cov = Cover.from(covers.pop() as Cube[]);
      let res1 = complement(cov, lit, free);
      for (const c of covers) {
        if (!res1.length) return res;
        const res2 = complement(Cover.from(c), lit, free);
        const res3: Cube[] = [];
        for (const r1 of res1) {
          for (const r2 of res2)
            res3.push(Cube.fromBigInt(BI.or(r1.bigint, r2.bigint)));
        }

        res1 = res3;
      }
      return [...res, ...res1];
    }
  }

  if (binate === -1) {
    complementUnate(cover, res, lit, free);
    return res;
  }

  const res1 = complement(
    cover,
    BI.or(lit, BIGINT_INDEX[binate]),
    BI.xor(free, BIGINT_INDEX[binate + 1])
  );
  let res2 = complement(
    cover,
    BI.or(lit, BIGINT_INDEX[binate + 1]),
    BI.xor(free, BIGINT_INDEX[binate])
  );

  const hashMask = 3 << binate;
  const hashMaskBi = BI.or(BIGINT_INDEX[binate], BIGINT_INDEX[binate + 1]);
  const remove: Set<Cube> = new Set();
  outer: for (const [i, r1] of res1.entries()) {
    const h = r1.hash ^ hashMask;
    for (const r2 of res2) {
      if (r2.hash === h && BI.eq(BI.xor(r1.bigint, r2.bigint), hashMaskBi)) {
        res1[i] = Cube.fromBigInt(BI.and(r1.bigint, r2.bigint));
        remove.add(r2);
        continue outer;
      }
    }
  }
  if (remove.size) res2 = res2.filter((r) => !remove.has(r));

  return [...res, ...res1, ...res2];
}

function complementUnate(
  cover: Cover,
  res: Cube[],
  lit: BI.bigint,
  free: BI.bigint
): void {
  let repeat = false;
  let tautology = false;
  let largestCubeSize = MAX_LITERALS;
  let largestCube = BIGINT_0;
  do {
    largestCubeSize = MAX_LITERALS;
    largestCube = BIGINT_0;
    repeat = false;
    cover = cover.filter((c) => {
      if (BI.ne(BI.and(lit, c.bigint), BIGINT_0)) return false;
      const diff = BI.and(c.bigint, free);
      const pc = popcount(diff, largestCubeSize);
      if (pc === 1) {
        repeat = true;
        lit = BI.or(lit, diff);
        return false;
      }
      if (pc < largestCubeSize) {
        largestCube = diff;
        largestCubeSize = pc;
      }
      if (pc === 0) tautology = true;
      return true;
    });
    if (tautology) return;
  } while (repeat);

  if (!cover.cubes.length) {
    res.push(Cube.fromBigInt(invBi(lit)));
    return;
  }

  const freeIdx = bitIndices(largestCube);

  if (cover.cubes.length === 1) {
    const inv = invBi(lit);
    for (const f of freeIdx)
      res.push(Cube.fromBigInt(BI.or(inv, BIGINT_INDEX[f ^ 1])));
    return;
  }

  let unate = -1;
  let unateness = 0;
  let sparseness = 0;
  for (const f of freeIdx) {
    const count = cover.count(f);
    sparseness = Math.max(sparseness, count);
    if (count > unateness) {
      unate = f;
      unateness = count;
    }
  }

  complementUnate(cover, res, BI.or(lit, BIGINT_INDEX[unate]), free);
  complementUnate(cover, res, lit, BI.xor(free, BIGINT_INDEX[unate]));
}
