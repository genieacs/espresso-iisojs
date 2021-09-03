import * as BI from "./bigint";
import { BIGINT_0, BIGINT_INDEX, BIGINT_32 } from "./common";

export default class Cube {
  private declare readonly _bigint: BI.bigint;
  private declare readonly _set: Set<number>;
  private declare readonly _hash: number;

  private constructor(bigint: BI.bigint, set: Set<number>, hash: number) {
    this._bigint = bigint;
    this._set = set;
    this._hash = hash;
  }

  get bigint(): BI.bigint {
    return this._bigint;
  }

  get set(): Set<number> {
    return this._set;
  }

  get hash(): number {
    return this._hash;
  }

  raise(n: number): Cube {
    if (!this._set.has(n)) return this;
    const b = BI.xor(this._bigint, BIGINT_INDEX[n]);
    const s = new Set(this._set);
    s.delete(n);
    const h = this._hash ^ (1 << n);
    return new Cube(b, s, h);
  }

  covers(c: Cube): boolean {
    return (
      this.set.size <= c.set.size &&
      BI.eq(BI.and(this.bigint, c.bigint), this.bigint)
    );
  }

  static parse(str: string): Cube {
    const parts = str.split("");
    let bigint = BIGINT_0;
    let hash = 0;
    const set: Set<number> = new Set();
    for (const [idx, p] of parts.entries()) {
      if (p === "-") continue;
      const i = idx * 2;
      if (p === "0") {
        bigint = BI.or(bigint, BIGINT_INDEX[i]);
        set.add(i);
        hash ^= 1 << i;
      } else if (p === "1") {
        bigint = BI.or(bigint, BIGINT_INDEX[i + 1]);
        set.add(i + 1);
        hash ^= 2 << i;
      } else if (p === "/") {
        bigint = BI.or(bigint, BIGINT_INDEX[i]);
        set.add(i);
        bigint = BI.or(bigint, BIGINT_INDEX[i + 1]);
        set.add(i + 1);
        hash ^= 3 << i;
      } else {
        throw new Error("Invalid cube string");
      }
    }
    return new Cube(bigint, set, hash);
  }

  toString(): string {
    let litStr = this.bigint.toString(2);
    if (litStr.length % 2) litStr = "0" + litStr;
    const arr = (litStr.match(/.{2}/g) as string[]).reverse();

    const str = arr.map((s) => {
      if (s === "00") return "-";
      else if (s === "01") return "0";
      else if (s === "10") return "1";
      return "/";
    });

    return str.join("");
  }

  static from(lits: Iterable<number>): Cube {
    let bigint = BIGINT_0;
    let hash = 0;
    const set: Set<number> = new Set();
    for (const i of lits) {
      set.add(i);
      hash ^= 1 << i;
      bigint = BI.or(bigint, BIGINT_INDEX[i]);
    }
    return new Cube(bigint, set, hash);
  }

  static fromBigInt(bigint: BI.bigint): Cube {
    let hash = 0;
    const set: Set<number> = new Set();
    let offset = 0;
    let n = bigint;
    while (BI.ne(n, BIGINT_0)) {
      let b = BI.toNumber(BI.asIntN(32, n));
      hash ^= b;
      n = BI.rshift(n, BIGINT_32);
      let i = Math.clz32(b);
      while (i < 32) {
        const li = 31 - i;
        set.add(offset + li);
        b ^= 1 << li;
        i = Math.clz32(b);
      }
      offset += 32;
    }
    return new Cube(bigint, set, hash);
  }
}
