import * as BI from "./bigint.ts";
import Cube from "./cube.ts";
import { BIGINT_0, BIGINT_INDEX } from "./common.ts";

export default class Cover {
  private declare readonly _cubes: Cube[];
  private declare readonly _count: number[];
  private declare _bigint: BI.bigint;

  private constructor(cubes: Cube[], count: number[], bigint: BI.bigint) {
    this._cubes = cubes;
    this._count = count;
    this._bigint = bigint;
  }

  static from(arg: Iterable<Cube>): Cover {
    const cubes = [];
    let bigint = BIGINT_0;
    const count = [];
    for (const cube of arg) {
      bigint = BI.or(bigint, cube.bigint);
      cubes.push(cube);
      for (const i of cube.set) {
        while (count.length <= i + 1 - (i % 2)) count.push(0);
        ++count[i];
      }
    }
    return new Cover(cubes, count, bigint);
  }

  get bigint(): BI.bigint {
    return this._bigint;
  }

  get cubes(): Cube[] {
    return this._cubes;
  }

  public count(i: number): number {
    return this._count[i];
  }

  public filter(callback: (cube: Cube) => boolean): Cover {
    const count = this._count.slice();
    let bigint = this._bigint;
    const cubes = this._cubes.filter((c) => {
      if (callback(c)) return true;
      for (const i of c.set)
        if (!--count[i]) bigint = BI.xor(bigint, BIGINT_INDEX[i]);
      return false;
    });
    return new Cover(cubes, count, bigint);
  }

  public pop(): Cube | undefined {
    const c = this._cubes.pop();
    if (!c) return undefined;
    for (const i of c.set) {
      if (!--this._count[i])
        this._bigint = BI.xor(this._bigint, BIGINT_INDEX[i]);
    }
    return c;
  }

  public push(c: Cube): number {
    const r = this._cubes.push(c);
    for (const i of c.set) ++this._count[i];
    this._bigint = BI.or(this._bigint, c.bigint);
    return r;
  }

  public unshift(c: Cube): number {
    const r = this._cubes.unshift(c);
    for (const i of c.set) ++this._count[i];
    this._bigint = BI.or(this._bigint, c.bigint);
    return r;
  }
}
