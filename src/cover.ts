import * as BI from "./bigint.ts";
import Cube from "./cube.ts";
import {
  BIGINT_0,
  BIGINT_1,
  BIGINT_2_64,
  BIGINT_32,
  BIGINT_INDEX,
  BIGINT_ODD,
  fromWords,
} from "./common.ts";

export interface Cofactor {
  cover: Cover;
  lit: BI.bigint;
  free: BI.bigint;
  // A cube was reduced to the empty cube, i.e. the cofactor is a tautology
  // (for DNF covers) / a contradiction (for CNF covers).
  taut: boolean;
}

export default class Cover {
  private declare readonly _cubes: Cube[];
  // Per-literal occurrence counts and the union of all literals. The
  // recursive algorithms create a cover per cofactor and most of them are
  // never asked for either, so both are computed on first use.
  declare private _count: number[] | undefined;
  declare private _bigint: BI.bigint | undefined;
  // Whether any cube is wide (has literals at bit 64 or above); checked once
  // per root cover and inherited by everything derived from it, so that
  // propagate() can pick its integer fast path without having to look at the
  // cubes again.
  declare private readonly _wide: boolean;

  private constructor(cubes: Cube[], wide: boolean) {
    this._cubes = cubes;
    this._wide = wide;
    this._count = undefined;
    this._bigint = undefined;
  }

  static from(arg: Iterable<Cube>): Cover {
    const cubes = [...arg];
    let wide = false;
    for (let j = 0; j < cubes.length; ++j) if (cubes[j].wide) wide = true;
    return new Cover(cubes, wide);
  }

  get bigint(): BI.bigint {
    if (this._bigint === undefined) {
      if (this._wide) {
        if (this._count === undefined) this.build();
        const count = this._count as number[];
        // One BigInt OR per distinct literal rather than one per cube
        let bigint = BIGINT_0;
        for (let i = 0; i < count.length; ++i)
          if (count[i]) bigint = BI.or(bigint, BIGINT_INDEX[i]);
        this._bigint = bigint;
      } else {
        // No counts needed for this, and the words make it cheap
        let lo = 0;
        let hi = 0;
        for (const c of this._cubes) {
          lo |= c.lo;
          hi |= c.hi;
        }
        this._bigint = fromWords(lo, hi);
      }
    }
    return this._bigint as BI.bigint;
  }

  get cubes(): Cube[] {
    return this._cubes;
  }

  public count(i: number): number {
    if (this._count === undefined) this.build();
    return (this._count as number[])[i];
  }

  private build(): void {
    const count: number[] = [];
    for (const cube of this._cubes) {
      for (const i of cube.lits) {
        while (count.length <= i + 1 - (i % 2)) count.push(0);
        ++count[i];
      }
    }
    this._count = count;
  }

  public filter(callback: (cube: Cube) => boolean): Cover {
    const cubes = this._cubes.filter(callback);
    // Nothing was dropped, so this cover already is the result
    return cubes.length === this._cubes.length
      ? this
      : new Cover(cubes, this._wide);
  }

  // Unit propagation over the cofactor described by `lit` (literals assigned
  // false) and `free` (literals still undecided): drop every cube that
  // conflicts with `lit`, and repeatedly assign the unit cubes that appear.
  //
  // Every caller of this used to pass its own closure to filter(), which made
  // that call site megamorphic and kept V8 from inlining the inner loop. This
  // is the same loop with the callback folded in.
  public propagate(lit: BI.bigint, free: BI.bigint): Cofactor {
    // Covers of up to 32 variables -- in practice nearly all of them -- keep
    // every literal below bit 64, so the whole loop can run on two machine
    // words instead of allocating a BigInt for each of its bitwise operations.
    // Cube.lo and Cube.hi are exactly those two words of Cube.bigint.
    if (
      !this._wide &&
      BI.gte(lit, BIGINT_0) &&
      BI.lt(lit, BIGINT_2_64) &&
      BI.gte(free, BIGINT_0) &&
      BI.lt(free, BIGINT_2_64)
    ) {
      return this.propagate64(
        lit,
        free,
        BI.toNumber(BI.asUintN(32, lit)) | 0,
        BI.toNumber(BI.rshift(lit, BIGINT_32)) | 0,
        BI.toNumber(BI.asUintN(32, free)) | 0,
        BI.toNumber(BI.rshift(free, BIGINT_32)) | 0,
      );
    }
    return this.propagateBig(lit, free);
  }

  private propagate64(
    litBi: BI.bigint,
    freeBi: BI.bigint,
    litLo: number,
    litHi: number,
    freeLo: number,
    freeHi: number,
  ): Cofactor {
    // Bits at even indices, i.e. the number-sized BIGINT_ODD. A literal and
    // its complement always share a word, so the pair shift never crosses one.
    const ODD = 0x55555555;
    let src = this._cubes;
    let taut = false;
    let changed = false;
    for (;;) {
      const len = src.length;
      let cubes: Cube[] | undefined;
      let repeat = false;
      for (let j = 0; j < len; ++j) {
        const c = src[j];
        const cLo = c.lo;
        const cHi = c.hi;
        let keep = true;
        if ((litLo & cLo) | (litHi & cHi)) {
          keep = false;
        } else {
          const dLo = cLo & freeLo;
          const dHi = cHi & freeHi;
          if ((dLo | dHi) === 0) {
            taut = true;
          } else if (
            dHi === 0
              ? (dLo & (dLo - 1)) === 0
              : dLo === 0 && (dHi & (dHi - 1)) === 0
          ) {
            // Unit cube: the single literal it still depends on
            repeat = true;
            keep = false;
            changed = true;
            if (dHi === 0) {
              litLo |= dLo;
              if ((dLo & ODD) === 0) freeLo ^= dLo >>> 1;
              else freeLo ^= dLo << 1;
            } else {
              litHi |= dHi;
              if ((dHi & ODD) === 0) freeHi ^= dHi >>> 1;
              else freeHi ^= dHi << 1;
            }
          }
        }
        if (keep) {
          if (cubes) cubes.push(c);
        } else if (!cubes) {
          cubes = src.slice(0, j);
        }
      }
      if (cubes) src = cubes;
      if (taut || !repeat) {
        return {
          cover: src === this._cubes ? this : new Cover(src, this._wide),
          lit: changed ? fromWords(litLo, litHi) : litBi,
          free: changed ? fromWords(freeLo, freeHi) : freeBi,
          taut,
        };
      }
    }
  }

  private propagateBig(lit: BI.bigint, free: BI.bigint): Cofactor {
    let src = this._cubes;
    let taut = false;
    for (;;) {
      const len = src.length;
      let cubes: Cube[] | undefined;
      let repeat = false;
      for (let j = 0; j < len; ++j) {
        const c = src[j];
        const cb = c.bigint;
        let keep = true;
        if (BI.ne(BI.and(lit, cb), BIGINT_0)) {
          keep = false;
        } else {
          const diff = BI.and(cb, free);
          if (BI.eq(diff, BIGINT_0)) {
            taut = true;
          } else if (BI.eq(BI.and(diff, BI.sub(diff, BIGINT_1)), BIGINT_0)) {
            // Unit cube: the single literal it still depends on
            repeat = true;
            keep = false;
            lit = BI.or(lit, diff);
            if (BI.eq(BI.and(BIGINT_ODD, diff), BIGINT_0))
              free = BI.xor(free, BI.rshift(diff, BIGINT_1));
            else free = BI.xor(free, BI.lshift(diff, BIGINT_1));
          }
        }
        if (keep) {
          if (cubes) cubes.push(c);
        } else if (!cubes) {
          cubes = src.slice(0, j);
        }
      }
      if (cubes) src = cubes;
      if (taut || !repeat) {
        return {
          cover: src === this._cubes ? this : new Cover(src, this._wide),
          lit,
          free,
          taut,
        };
      }
    }
  }
}
