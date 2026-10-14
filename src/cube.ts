import * as BI from "./bigint.ts";
import { BIGINT_0, BIGINT_INDEX, BIGINT_32, invBi } from "./common.ts";

export default class Cube {
  private declare readonly _bigint: BI.bigint;
  declare private readonly _lits: number[];
  private declare readonly _hash: number;

  private constructor(bigint: BI.bigint, lits: number[], hash: number) {
    this._bigint = bigint;
    this._lits = lits;
    this._hash = hash;
  }

  get bigint(): BI.bigint {
    return this._bigint;
  }

  get lits(): readonly number[] {
    return this._lits;
  }

  get size(): number {
    return this._lits.length;
  }

  get hash(): number {
    return this._hash;
  }

  // Holds some literal together with its complement
  get empty(): boolean {
    return BI.ne(BI.and(this._bigint, invBi(this._bigint)), BIGINT_0);
  }

  raise(n: number): Cube {
    const idx = this._lits.indexOf(n);
    if (idx < 0) return this;
    const lits = this._lits.slice();
    lits.splice(idx, 1);
    return new Cube(
      BI.xor(this._bigint, BIGINT_INDEX[n]),
      lits,
      this._hash ^ (1 << n),
    );
  }

  lower(n: number): Cube {
    if (this._lits.indexOf(n) >= 0) return this;
    const lits = this._lits.slice();
    lits.push(n);
    return new Cube(
      BI.or(this._bigint, BIGINT_INDEX[n]),
      lits,
      this._hash ^ (1 << n),
    );
  }

  covers(c: Cube): boolean {
    if (this._lits.length > c._lits.length) return false;
    return BI.eq(BI.and(this._bigint, c._bigint), this._bigint);
  }

  static parse(str: string): Cube {
    let bigint = BIGINT_0;
    let hash = 0;
    const lits: number[] = [];
    for (let idx = 0; idx < str.length; ++idx) {
      const p = str[idx];
      if (p === "-") continue;
      const i = idx * 2;
      if (p === "0") {
        bigint = BI.or(bigint, BIGINT_INDEX[i]);
        lits.push(i);
        hash ^= 1 << i;
      } else if (p === "1") {
        bigint = BI.or(bigint, BIGINT_INDEX[i + 1]);
        lits.push(i + 1);
        hash ^= 2 << i;
      } else if (p === "/") {
        bigint = BI.or(bigint, BIGINT_INDEX[i]);
        bigint = BI.or(bigint, BIGINT_INDEX[i + 1]);
        lits.push(i, i + 1);
        hash ^= 3 << i;
      } else {
        throw new Error("Invalid cube string");
      }
    }
    return new Cube(bigint, lits, hash);
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
    const l: number[] = [];
    // The Set this used to build deduplicated for free
    for (const i of lits) {
      if (l.indexOf(i) >= 0) continue;
      l.push(i);
      hash ^= 1 << i;
      bigint = BI.or(bigint, BIGINT_INDEX[i]);
    }
    return new Cube(bigint, l, hash);
  }

  static fromBigInt(bigint: BI.bigint): Cube {
    let hash = 0;
    const lits: number[] = [];
    let offset = 0;
    let n = bigint;
    while (BI.ne(n, BIGINT_0)) {
      let b = BI.toNumber(BI.asIntN(32, n));
      hash ^= b;
      n = BI.rshift(n, BIGINT_32);
      let i = Math.clz32(b);
      while (i < 32) {
        const li = 31 - i;
        lits.push(offset + li);
        b ^= 1 << li;
        i = Math.clz32(b);
      }
      offset += 32;
    }
    return new Cube(bigint, lits, hash);
  }
}
