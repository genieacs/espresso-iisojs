import * as BI from "./bigint.ts";
import Cover from "./cover.ts";
import {
  BIGINT_0,
  invBi,
  BIGINT_INDEX,
  bitIndicesOdd,
  popcount,
  componentReduction,
  BIGINT_ODD,
  BIGINT_1,
} from "./common.ts";

export default function tautology(
  cover: Cover,
  lit = BIGINT_0,
  free = BI.and(cover.bigint, BI.not(BI.or(lit, invBi(lit)))),
): boolean {
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
    if (taut) return true;
  } while (repeat);

  if (cover.cubes.length <= 1) return false;

  free = BI.and(cover.bigint, free);

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
      return false;
    } else {
      elim.add(f);
      lit = BI.or(lit, BIGINT_INDEX[count0 ? f : f + 1]);
      free = BI.xor(free, BIGINT_INDEX[count0 ? f + 1 : f]);
    }
    sparseness = Math.max(sparseness, count);
  }

  if (binate === -1) return false;

  if (sparseness * 3 < cover.cubes.length && freeIdx.length - elim.size > 8) {
    const covers = componentReduction(
      cover.cubes,
      freeIdx.filter((f) => !elim.has(f)),
    );
    if (covers.length > 1) {
      for (const cov of covers)
        if (!tautology(Cover.from(cov), lit, free)) return false;

      return true;
    }
  }

  if (
    !tautology(
      cover,
      BI.or(lit, BIGINT_INDEX[binate]),
      BI.xor(free, BIGINT_INDEX[binate + 1]),
    )
  )
    return false;

  return tautology(
    cover,
    BI.or(lit, BIGINT_INDEX[binate + 1]),
    BI.xor(free, BIGINT_INDEX[binate]),
  );
}
