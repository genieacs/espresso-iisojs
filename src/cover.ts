import * as BI from "./bigint.ts";
import Cube from "./cube.ts";
import { BIGINT_0, BIGINT_INDEX } from "./common.ts";

export default class Cover {
  private declare readonly _cubes: Cube[];
  // Per-literal occurrence counts and the union of all literals. The
  // recursive algorithms create a cover per cofactor and most of them are
  // never asked for either, so both are computed on first use.
  declare private _count: number[] | undefined;
  declare private _bigint: BI.bigint | undefined;

  private constructor(cubes: Cube[]) {
    this._cubes = cubes;
    this._count = undefined;
    this._bigint = undefined;
  }

  static from(arg: Iterable<Cube>): Cover {
    return new Cover([...arg]);
  }

  get bigint(): BI.bigint {
    if (this._bigint === undefined) {
      if (this._count === undefined) this.build();
      const count = this._count as number[];
      // One BigInt OR per distinct literal rather than one per cube
      let bigint = BIGINT_0;
      for (let i = 0; i < count.length; ++i)
        if (count[i]) bigint = BI.or(bigint, BIGINT_INDEX[i]);
      this._bigint = bigint;
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
    return cubes.length === this._cubes.length ? this : new Cover(cubes);
  }
}
