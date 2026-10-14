import * as BI from "./bigint.ts";
import Cube from "./cube.ts";
import tautology from "./tautology.ts";
import Cover from "./cover.ts";
import Columns from "./columns.ts";
import {
  bitIndices,
  BIGINT_INDEX,
  invBi,
  BIGINT_0,
  popcount,
  BIGINT_ODD,
  BIGINT_1,
  bitIndicesOdd,
  componentReduction,
  BIGINT_0C,
  MAX_LITERALS,
} from "./common.ts";

type CanRaiseCallback = (idx: number, cube: Cube) => boolean;
type CanLowerCallback = (idx: number, cube: Cube) => boolean;
type BiasCallback = (a: number, b: number) => number;

function COVERS(cover: Cover, cube: Cube): boolean {
  return tautology(cover, invBi(cube.bigint));
}

// The rows of the blocking and covering matrices are column masks, whose type
// (number or BigInt) only Columns knows about; see there for the mapping.
function EXPAND1(
  cube: Cube,
  onSet: Cube[],
  offSet: Cube[],
  canRaise: CanRaiseCallback,
  bias: BiasCallback,
): Cube {
  return expand1(Columns.from(cube), cube, onSet, offSet, canRaise, bias);
}

function expand1(
  cols: Columns<unknown>,
  cube: Cube,
  onSet: Cube[],
  offSet: Cube[],
  canRaise: CanRaiseCallback,
  bias: BiasCallback,
): Cube {
  const blockingMatrix = cols.blockingRows(offSet);
  const coveringMatrix = cols.coveringRows(onSet);

  // Columns still to be raised, and the order to consider them in
  const order = cube.lits
    .slice()
    .sort(bias)
    .map((l) => cols.column(l));
  let toRaise = cols.all;

  const count = cols.countColumns(coveringMatrix);

  while (coveringMatrix.length && blockingMatrix.length) {
    let essential = cols.none;
    for (const b of blockingMatrix)
      if (cols.isUnit(b)) essential = cols.or(essential, b);

    if (!cols.isNone(essential)) {
      toRaise = cols.andNot(toRaise, essential);
      const blocked = cols.dropRows(blockingMatrix, essential);
      cols.dropRows(coveringMatrix, essential);

      // Columns no off-set cube blocks any more can all be raised at once
      const inessential = cols.andNot(toRaise, blocked);
      for (const j of order)
        if (cols.has(inessential, j)) cube = cube.raise(cols.lit(j));
      toRaise = cols.andNot(toRaise, inessential);
      cols.deleteColumns(coveringMatrix, inessential);
      if (!blockingMatrix.length || !coveringMatrix.length) break;
    }

    // Columns that on their own would absorb an on-set cube, in row order
    const feasible: number[] = [];
    let seen = cols.none;
    for (const c of coveringMatrix) {
      if (!cols.isUnit(c) || !cols.isNone(cols.and(c, seen))) continue;
      seen = cols.or(seen, c);
      feasible.push(cols.columns(c)[0]);
    }

    if (feasible.length) {
      let cnt = 0;
      let raise = -1;
      for (const j of feasible.sort((a, b) => bias(cols.lit(a), cols.lit(b)))) {
        if (count[j] > cnt && canRaise(cols.lit(j), cube)) {
          cnt = count[j];
          raise = j;
        }
      }
      if (raise >= 0) {
        const bit = cols.bit(raise);
        toRaise = cols.andNot(toRaise, bit);
        cube = cube.raise(cols.lit(raise));
        cols.deleteColumns(coveringMatrix, bit);
        cols.clearColumns(blockingMatrix, bit);
        continue;
      }
    }

    let cnt = 0;
    let raise = -1;
    for (const j of order) {
      if (!cols.has(toRaise, j)) continue;
      if (count[j] > cnt && canRaise(cols.lit(j), cube)) {
        cnt = count[j];
        raise = j;
      }
    }

    if (raise < 0) {
      toRaise = cols.none;
      break;
    }

    const bit = cols.bit(raise);
    toRaise = cols.andNot(toRaise, bit);
    cube = cube.raise(cols.lit(raise));
    cols.clearColumns(coveringMatrix, bit);
    cols.clearColumns(blockingMatrix, bit);
  }

  if (blockingMatrix.length) {
    const MINLOW = MINUCOV(blockingMatrix.map((b) => cols.blockingSet(b)));
    for (const m of MINLOW)
      toRaise = cols.andNot(toRaise, cols.bit(cols.column(m ^ 1)));
  }

  for (const j of order) {
    if (cols.has(toRaise, j) && canRaise(cols.lit(j), cube))
      cube = cube.raise(cols.lit(j));
  }

  return cube;
}

function EXPAND1_PRESTO(
  cube: Cube,
  onSet: Cube[],
  cover: Cover,
  canRaise: CanRaiseCallback,
  bias: BiasCallback,
): Cube {
  return expand1Presto(Columns.from(cube), cube, onSet, cover, canRaise, bias);
}

function expand1Presto(
  cols: Columns<unknown>,
  cube: Cube,
  onSet: Cube[],
  cover: Cover,
  canRaise: CanRaiseCallback,
  bias: BiasCallback,
): Cube {
  const coveringMatrix = cols.coveringRows(onSet);

  const toRaise = cube.lits.map((l) => cols.column(l));
  const count = cols.countColumns(coveringMatrix);

  while (toRaise.length) {
    let feasible = cols.none;
    for (const c of coveringMatrix)
      if (cols.isUnit(c)) feasible = cols.or(feasible, c);

    toRaise.sort(
      (a, b) =>
        +cols.has(feasible, a) - +cols.has(feasible, b) ||
        count[a] - count[b] ||
        bias(cols.lit(b), cols.lit(a)),
    );

    const cantRaise: number[] = [];
    while (toRaise.length) {
      const r = toRaise.pop() as number;
      if (!canRaise(cols.lit(r), cube)) {
        cantRaise.unshift(r);
        continue;
      }
      const nc = cube.raise(cols.lit(r));
      if (!COVERS(cover, nc)) {
        cols.dropRows(coveringMatrix, cols.bit(r));
        toRaise.push(...cantRaise);
        break;
      }
      cube = nc;
      // No row is ever empty here, so this drops exactly the emptied ones
      cols.deleteColumns(coveringMatrix, cols.bit(r));
      toRaise.push(...cantRaise.splice(0));
    }
  }

  return cube;
}

function EXPAND(
  onSet: Cube[],
  dcSet: Cube[],
  offSet: Cube[] | undefined,
  primes: WeakSet<Cube>,
  canRaise: CanRaiseCallback,
  bias: BiasCallback,
): Cube[] {
  if (!onSet.length) return onSet;
  onSet = onSet.slice();
  onSet.sort((a, b) => a.size - b.size);

  const firstCube = onSet[0];
  do {
    let cube = onSet[0];
    if (!primes.has(cube)) {
      cube = offSet
        ? EXPAND1(cube, onSet, offSet, canRaise, bias)
        : EXPAND1_PRESTO(
            cube,
            onSet,
            Cover.from([...onSet, ...dcSet]),
            canRaise,
            bias,
          );
    }
    onSet = onSet.filter((o) => !cube.covers(o));
    onSet.push(cube);
  } while (
    onSet[0].size >= firstCube.size &&
    BI.ne(onSet[0].bigint, firstCube.bigint)
  );

  return onSet;
}

function REDUNDANT(onSet: Cube[], dcSet: Cube[]): [Cube[], Cube[]] {
  const cubes = [...dcSet, ...onSet];
  const E: Cube[] = []; // Relatively essential
  const R: Cube[] = []; // Redundant
  for (let i = 0; i < onSet.length; ++i) {
    const cube = cubes.pop() as Cube;
    if (COVERS(Cover.from(cubes), cube)) R.push(cube);
    else E.push(cube);
    cubes.unshift(cube);
  }
  return [E, R];
}

function PARTIALLY_REDUNDANT(R: Cube[], E: Cube[], dcSet: Cube[]): Cube[] {
  const cover = Cover.from([...dcSet, ...E]);
  return R.filter((c) => !COVERS(cover, c));
}

function MAXCLIQ(covers: Set<number>[]): Set<number>[] {
  const neighbors: Map<number, Set<number>> = new Map();
  const len = covers.length;
  for (let i = 0; i < len; ++i) neighbors.set(i, new Set());
  for (let i = 0; i < len; ++i) {
    const c1 = covers[i];
    const set1 = neighbors.get(i) as Set<number>;
    for (let j = i + 1; j < len; ++j) {
      const c2 = covers[j];
      let connected = false;
      for (const n of c1) {
        if (c2.has(n)) {
          connected = true;
          break;
        }
      }
      if (!connected) {
        const set2 = neighbors.get(j) as Set<number>;
        set1.add(j);
        set2.add(i);
      }
    }
  }

  const keys = Array.from(covers.keys());
  keys.sort(
    (a, b) =>
      (neighbors.get(b) as Set<number>).size -
      (neighbors.get(a) as Set<number>).size,
  );

  let solution: number[] = [];
  let solutionWeight = 0;
  let exitCounter = 0;
  function bronKerbosch(R: number[], P: number[], X: number[]): void {
    if (exitCounter > len) return;
    if (!P.length && !X.length) {
      ++exitCounter;
      if (R.length >= solution.length) {
        const w = R.reduce(
          (acc, cur) => acc + (neighbors.get(cur) as Set<number>).size,
          0,
        );
        if (w > solutionWeight || R.length > solution.length) {
          solution = R;
          solutionWeight = w;
          exitCounter = 0;
        }
      }
      return;
    }

    const excl: Set<number> = new Set();
    const pivotNeigh: Set<number> = neighbors.get(P[0]) as Set<number>;

    for (const p of P) {
      if (pivotNeigh.has(p)) continue;
      const neigh = neighbors.get(p) as Set<number>;
      const newP = P.filter((i) => neigh.has(i) && !excl.has(i));
      const newX = X.filter((i) => neigh.has(i));
      bronKerbosch([...R, p], newP, newX);
      if (solution.length > R.length + P.length) return;
      X.push(p);
      excl.add(p);
    }
  }

  bronKerbosch([], keys, []);

  return solution.map((i) => covers[i]);
}

function WEED(covers: Set<number>[], cover: Set<number>): Set<number> {
  let points: Set<number>[] = covers.map(
    (m) => new Set([...m].filter((x) => cover.has(x))),
  );
  const essential: Set<number> = new Set();

  for (;;) {
    for (const point of points) {
      if (point.size === 1) {
        const [p] = point;
        essential.add(p);
      }
    }

    points = points.filter((point) => {
      for (const p of point) if (essential.has(p)) return false;
      return point.size > 1;
    });

    if (!points.length) break;

    const candidates: Map<number, Set<number>> = new Map();
    for (const point of points) {
      for (const p of point)
        if (!candidates.has(p)) candidates.set(p, new Set());

      if (point.size === 2) {
        const [p1, p2] = point;
        const cand1 = candidates.get(p1) as Set<number>;
        const cand2 = candidates.get(p2) as Set<number>;
        cand1.add(p2);
        cand2.add(p1);
      }
    }

    const eliminate = Array.from(candidates).reduce((acc, cur) =>
      cur[1].size < acc[1].size ? cur : acc,
    )[0];
    for (const point of points) point.delete(eliminate);
  }

  return essential;
}

function MINUCOV(covers: Set<number>[]): Set<number> {
  let res: Set<number> = new Set();
  const I = MAXCLIQ(covers);
  let remaining = covers;

  for (const i of I) {
    const freq: Map<number, Set<Set<number>>> = new Map();
    for (const c of covers) {
      for (const j of c) {
        if (i.has(j)) {
          let s = freq.get(j);
          if (!s) freq.set(j, (s = new Set()));
          s.add(c);
        }
      }
    }
    const [v, set] = Array.from(freq).reduce((acc, cur) =>
      cur[1].size > acc[1].size ? cur : acc,
    );
    remaining = remaining.filter((m) => !set.has(m));
    res.add(v);
  }

  res = WEED(covers, res);

  if (remaining.length) res = new Set([...res, ...MINUCOV(remaining)]);

  return res;
}

function LTAUT1(
  cover: Cover,
  index: WeakMap<Cube, number>,
  lit: BI.bigint,
  free: BI.bigint,
): Set<number>[] {
  let repeat = false;
  let dc = false;
  const S: number[] = [];
  do {
    repeat = false;
    cover = cover.filter((c) => {
      if (BI.ne(BI.and(lit, c.bigint), BIGINT_0)) return false;
      const diff = BI.and(c.bigint, free);
      const pc = popcount(diff, 2);
      if (pc === 1 && !index.has(c)) {
        repeat = true;
        lit = BI.or(lit, diff);
        if (BI.eq(BI.and(BIGINT_ODD, diff), BIGINT_0))
          free = BI.xor(free, BI.rshift(diff, BIGINT_1));
        else free = BI.xor(free, BI.lshift(diff, BIGINT_1));
        return false;
      }
      if (pc === 0) {
        const i = index.get(c);
        if (i != null) {
          S.push(i);
          return false;
        }
        dc = true;
      }
      return true;
    });
    if (dc) return [];
  } while (repeat);

  if (cover.cubes.length <= 1) return [new Set(S)];

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
    } else {
      elim.add(f);
      lit = BI.or(lit, BIGINT_INDEX[count0 ? f : f + 1]);
      free = BI.xor(free, BIGINT_INDEX[count0 ? f + 1 : f]);
    }
    sparseness = Math.max(sparseness, count);
  }

  if (binate === -1) return [new Set(S)];

  if (sparseness * 3 < cover.cubes.length && freeIdx.length - elim.size > 8) {
    const covers = componentReduction(
      cover.cubes,
      freeIdx.filter((f) => !elim.has(f)),
    );
    if (covers.length > 1) {
      let res: Set<number>[] = [new Set(S)];
      for (const cov of covers) {
        const res2 = res;
        res = LTAUT1(Cover.from(cov), index, lit, free);
        const res3: Set<number>[] = [];
        for (const r1 of res)
          for (const r2 of res2) res3.push(new Set([...r1, ...r2]));

        res = res3;
      }
      return res;
    }
  }

  let res1 = LTAUT1(
    cover,
    index,
    BI.or(lit, BIGINT_INDEX[binate]),
    BI.xor(free, BIGINT_INDEX[binate + 1]),
  );
  let res2 = LTAUT1(
    cover,
    index,
    BI.or(lit, BIGINT_INDEX[binate + 1]),
    BI.xor(free, BIGINT_INDEX[binate]),
  );

  const rem1: Set<Set<number>> = new Set();
  const rem2: Set<Set<number>> = new Set();

  for (const r1 of res1) {
    for (const r2 of res2) {
      if (r1.size <= r2.size) {
        let found = true;
        for (const n of r1) {
          if (!r2.has(n)) {
            found = false;
            break;
          }
        }
        if (found) rem2.delete(r2);
      } else {
        let found = true;
        for (const n of r2) {
          if (!r1.has(n)) {
            found = false;
            break;
          }
        }
        if (found) rem1.delete(r1);
      }
    }
  }

  if (rem1.size) res1 = res1.filter((r) => !rem1.has(r));
  if (rem2.size) res2 = res2.filter((r) => !rem2.has(r));

  return [...res1, ...res2].map((s) => new Set([...S, ...s]));
}

function NOCOVERMAT(Rp: Cube[], E: Cube[], dcSet: Cube[]): Set<number>[] {
  const res: Map<number, Set<number>[]> = new Map();
  const index: WeakMap<Cube, number> = new WeakMap();
  for (const [i, p] of Rp.entries()) index.set(p, i);
  const cover = Cover.from([...Rp, ...E, ...dcSet]);

  for (const r of Rp) {
    const lit = invBi(r.bigint);
    const free = BI.and(cover.bigint, BI.not(BI.or(r.bigint, lit)));
    const res2 = LTAUT1(cover, index, lit, free);
    // Merge and eliminate duplicates
    for (const r2 of res2) {
      let hash = 0;
      for (const i of r2) hash ^= 1 << i;
      const grp = res.get(hash);
      if (!grp) {
        res.set(hash, [r2]);
        continue;
      }

      let found = false;
      loop: for (const g of grp) {
        if (g.size !== r2.size) continue;
        for (const i of g) if (!r2.has(i)) continue loop;
        found = true;
        break;
      }
      if (!found) grp.push(r2);
    }
  }

  return [...res.values()].flat();
}

function MINIMAL_IRREDUNDANT(Rp: Cube[], E: Cube[], dcSet: Cube[]): Cube[] {
  const CM = NOCOVERMAT(Rp, E, dcSet);
  const J = MINUCOV(CM);
  return Rp.filter((c, i) => J.has(i));
}

function IRREDUNDANT_COVER(onSet: Cube[], dcSet: Cube[]): Cube[] {
  const [E, R] = REDUNDANT(onSet, dcSet);
  const Rp = PARTIALLY_REDUNDANT(R, E, dcSet);
  const Rc = MINIMAL_IRREDUNDANT(Rp, E, dcSet);
  return [...E, ...Rc];
}

function ESSENTIAL_PRIMES(onSet: Cube[], dcSet: Cube[]): Cube[] {
  const cover = [...dcSet, ...onSet];
  const res: Cube[] = [];
  for (let i = 0; i < onSet.length; ++i) {
    const ess = cover.pop() as Cube;
    const essInv = invBi(ess.bigint);
    const cov: Cube[] = [];
    for (const cube of cover) {
      const conflict = BI.and(essInv, cube.bigint);
      const dist = popcount(conflict, 2);
      if (dist === 0) cov.push(cube);
      else if (dist === 1)
        cov.push(Cube.fromBigInt(BI.xor(cube.bigint, conflict)));
    }
    if (!tautology(Cover.from(cov), essInv)) res.push(ess);
    cover.unshift(ess);
  }
  return res;
}

function CUBE_ORDER(cubes: Cube[]): void {
  if (cubes.length <= 1) return;
  const seed = cubes.reduce((acc, cur) => (cur.size <= acc.size ? cur : acc));
  cubes.sort((a, b) => {
    const pc1 = popcount(BI.and(a.bigint, seed.bigint));
    const dist1 = a.size - pc1 + (seed.size - pc1);
    const pc2 = popcount(BI.and(b.bigint, seed.bigint));
    const dist2 = b.size - pc2 + (seed.size - pc2);
    return dist1 - dist2;
  });
}

// Returns inverted cube
function SCCC(cover: Cover, lit: BI.bigint, free: BI.bigint): BI.bigint {
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
    if (taut) return BIGINT_0C;
  } while (repeat);

  if (cover.cubes.length <= 1) return lit;

  free = BI.and(cover.bigint, free);

  let binate = -1;
  let binateness = 0;
  let binatenessMin = 0;
  let sparseness = 0;
  const freeIdx = bitIndicesOdd(free);
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
    }
    sparseness = Math.max(sparseness, count);
  }

  if (binate === -1) return lit;

  if (sparseness * 3 < cover.cubes.length && freeIdx.length > 8) {
    const covers = componentReduction(cover.cubes, freeIdx);
    if (covers.length > 1) {
      for (const cov of covers)
        lit = BI.or(lit, SCCC(Cover.from(cov), lit, free));
      return lit;
    }
  }

  const res1 = SCCC(
    cover,
    BI.or(lit, BIGINT_INDEX[binate]),
    BI.xor(free, BIGINT_INDEX[binate + 1]),
  );

  const res2 = SCCC(
    cover,
    BI.or(lit, BIGINT_INDEX[binate + 1]),
    BI.xor(free, BIGINT_INDEX[binate]),
  );
  return BI.and(res1, res2);
}

function REDUCE(
  onSet: Cube[],
  dcSet: Cube[],
  primes: WeakSet<Cube>,
  canLower: CanLowerCallback,
): Cube[] {
  onSet = onSet.slice();
  CUBE_ORDER(onSet);
  for (let i = onSet.length; i > 0; --i) {
    const cube = onSet.shift() as Cube;
    const cubeInv = invBi(cube.bigint);
    const cubeMask = BI.or(cube.bigint, cubeInv);
    const cov = [...onSet, ...dcSet].filter((c) =>
      BI.eq(BI.and(cubeInv, c.bigint), BIGINT_0),
    );
    const sccc = SCCC(Cover.from(cov), cubeInv, BI.not(cubeMask));
    if (BI.gte(sccc, BIGINT_0)) {
      if (BI.eq(sccc, cubeInv)) {
        onSet.push(cube);
        primes.add(cube);
      } else {
        let reduced = cube;
        for (let toLower = bitIndices(sccc); toLower.length; ) {
          const toLowerRetry: number[] = [];
          for (const t of toLower) {
            if (canLower(t ^ 1, reduced)) reduced = reduced.lower(t ^ 1);
            else toLowerRetry.push(t);
          }
          if (toLowerRetry.length === toLower.length) break;
          toLower = toLowerRetry;
        }
        onSet.push(reduced);
      }
    }
  }
  return onSet;
}

function MAXIMUM_REDUCTION(
  onSet: Cube[],
  dcSet: Cube[],
  canLower: CanLowerCallback,
): Cube[] {
  const reducedCubes: Cube[] = [];
  for (let i = onSet.length; i > 0; --i) {
    const cube = onSet.shift() as Cube;
    const cubeInv = invBi(cube.bigint);
    const cubeMask = BI.or(cube.bigint, cubeInv);
    const cov = [...onSet, ...dcSet].filter((c) =>
      BI.eq(BI.and(cubeInv, c.bigint), BIGINT_0),
    );
    const sccc = SCCC(Cover.from(cov), cubeInv, BI.not(cubeMask));
    if (BI.ne(sccc, cubeInv) && BI.gte(sccc, BIGINT_0)) {
      let reduced = cube;
      for (let toLower = bitIndices(sccc); toLower.length; ) {
        const toLowerRetry: number[] = [];
        for (const t of toLower) {
          if (canLower(t ^ 1, reduced)) reduced = reduced.lower(t ^ 1);
          else toLowerRetry.push(t);
        }
        if (toLowerRetry.length === toLower.length) break;
        toLower = toLowerRetry;
      }
      reducedCubes.push(reduced);
    }
    onSet.push(cube);
  }
  return reducedCubes;
}

function LAST_GASP(
  onSet: Cube[],
  dcSet: Cube[],
  offSet: Cube[] | undefined,
  canRaise: CanRaiseCallback,
  canLower: CanLowerCallback,
  bias: BiasCallback,
): Cube[] {
  const reduced = MAXIMUM_REDUCTION(onSet, dcSet, canLower);
  const newCubes: Cube[] = [];
  const cover = offSet ? null : Cover.from([...onSet, ...dcSet]);
  for (let i = reduced.length; i > 0; --i) {
    const cube = reduced.shift() as Cube;
    const expanded = offSet
      ? EXPAND1(cube, reduced, offSet, canRaise, bias)
      : EXPAND1_PRESTO(cube, reduced, cover as Cover, canRaise, bias);

    for (const c of reduced) if (expanded.covers(c)) newCubes.push(expanded);

    reduced.push(cube);
  }
  if (!newCubes.length) return onSet;
  return IRREDUNDANT_COVER([...onSet, ...newCubes], dcSet);
}

function COST(cover: Cube[]): number {
  return cover.reduce((a, c) => a + c.size, 0);
}

export default function espresso(
  onSet: Cube[],
  dcSet: Cube[],
  offSet?: Cube[],
  canRaise: CanRaiseCallback = () => true,
  canLower: CanLowerCallback = () => true,
  bias: BiasCallback = () => 0,
): Cube[] {
  if (!onSet.length) return onSet;
  const primes: WeakSet<Cube> = new WeakSet();
  onSet = EXPAND(onSet, dcSet, offSet, primes, canRaise, bias);
  onSet = IRREDUNDANT_COVER(onSet, dcSet);
  const essentialPrimes = ESSENTIAL_PRIMES(onSet, dcSet);
  if (essentialPrimes.length) {
    onSet = onSet.filter((c) => !essentialPrimes.includes(c));
    dcSet = [...dcSet, ...essentialPrimes];
  }

  // Never return the original cover to guarantee result guided by canRaise
  let cost = onSet.length * MAX_LITERALS;

  for (;;) {
    let onSet2 = REDUCE(onSet, dcSet, primes, canLower);
    onSet2 = EXPAND(onSet2, dcSet, offSet, primes, canRaise, bias);
    onSet2 = IRREDUNDANT_COVER(onSet2, dcSet);
    let cost2 = COST(onSet2);
    if (cost2 <= cost) onSet = onSet2;
    if (cost2 >= cost) {
      onSet2 = LAST_GASP(onSet, dcSet, offSet, canRaise, canLower, bias);
      cost2 = COST(onSet2);
      if (cost2 <= cost) onSet = onSet2;
      if (cost2 >= cost) break;
    }
    cost = cost2;
  }

  return [...essentialPrimes, ...onSet];
}
