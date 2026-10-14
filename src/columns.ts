import * as BI from "./bigint.ts";
import Cube from "./cube.ts";
import {
  BIGINT_0,
  BIGINT_1,
  BIGINT_INDEX,
  bitIndices,
  invBi32,
} from "./common.ts";

// The blocking and covering matrices of a cube's expansion have the cube's
// literals as columns, so a row is a mask of columns: a number when the cube
// has at most 32 literals, a BigInt otherwise. Columns ascend with literals,
// which keeps every iteration order the same as when rows were Sets.
export default abstract class Columns<R> {
  declare protected readonly _cube: Cube;
  // Column -> literal, and literal -> column
  declare protected readonly _lits: number[];
  declare private readonly _columns: number[];
  declare readonly all: R;
  declare readonly none: R;

  constructor(cube: Cube, lits: number[], all: R, none: R) {
    this._cube = cube;
    this._lits = lits;
    this._columns = [];
    lits.forEach((l, j) => (this._columns[l] = j));
    this.all = all;
    this.none = none;
  }

  static from(cube: Cube): Columns<unknown> {
    const k = cube.lits.length;
    if (!cube.wide) {
      // Column = variable, unless the cube holds both polarities of one
      const lits: number[] = [];
      let all = 0;
      let i = 0;
      for (; i < k; ++i) {
        const v = cube.lits[i] >>> 1;
        if (all & (1 << v)) break;
        all |= 1 << v;
        lits[v] = cube.lits[i];
      }
      if (i === k) return new WordColumns(cube, lits, all, true);
    }
    const lits = cube.lits.slice().sort((a, b) => a - b);
    if (k > 32) return new BigColumns(cube, lits);
    return new WordColumns(cube, lits, k === 32 ? -1 : 2 ** k - 1, false);
  }

  abstract bit(j: number): R;
  abstract and(a: R, b: R): R;
  abstract or(a: R, b: R): R;
  abstract andNot(a: R, b: R): R;
  abstract isNone(row: R): boolean;
  abstract isUnit(row: R): boolean;
  abstract columns(row: R): number[];

  lit(j: number): number {
    return this._lits[j];
  }

  column(lit: number): number {
    return this._columns[lit];
  }

  has(row: R, j: number): boolean {
    return !this.isNone(this.and(row, this.bit(j)));
  }

  // Per off-set cube: the cube's literals it contradicts
  blockingRows(offSet: Cube[]): R[] {
    const rows: R[] = [];
    for (const c of offSet) {
      let row = this.none;
      for (const l of c.lits) {
        const j = this.column(l ^ 1);
        if (j !== undefined) row = this.or(row, this.bit(j));
      }
      if (!this.isNone(row)) rows.push(row);
    }
    return rows;
  }

  // Per on-set cube: the cube's literals it lacks
  coveringRows(onSet: Cube[]): R[] {
    const rows: R[] = [];
    for (const c of onSet) {
      let has = this.none;
      for (const l of c.lits) {
        const j = this.column(l);
        if (j !== undefined) has = this.or(has, this.bit(j));
      }
      const row = this.andNot(this.all, has);
      if (!this.isNone(row)) rows.push(row);
    }
    return rows;
  }

  countColumns(rows: R[]): number[] {
    const count = new Array<number>(this._lits.length).fill(0);
    for (const r of rows) for (const j of this.columns(r)) ++count[j];
    return count;
  }

  // Removes the rows that intersect `mask`; returns the union of the rest
  dropRows(rows: R[], mask: R): R {
    let n = 0;
    let union = this.none;
    for (const r of rows) {
      if (!this.isNone(this.and(r, mask))) continue;
      rows[n++] = r;
      union = this.or(union, r);
    }
    rows.length = n;
    return union;
  }

  // Removes `mask` from every row, dropping the rows this empties
  deleteColumns(rows: R[], mask: R): void {
    let n = 0;
    for (const r of rows) {
      const rest = this.andNot(r, mask);
      if (this.isNone(rest) && !this.isNone(r)) continue;
      rows[n++] = rest;
    }
    rows.length = n;
  }

  // Removes `mask` from every row, keeping emptied rows
  clearColumns(rows: R[], mask: R): void {
    for (let i = 0; i < rows.length; ++i) rows[i] = this.andNot(rows[i], mask);
  }

  // A blocking row as the off-set literals it stands for, in the order
  // `new Set(bitIndices(...))` used to give MINUCOV
  blockingSet(row: R): Set<number> {
    const lits = this.columns(row).map((j) => this._lits[j] ^ 1);
    return new Set(lits.sort((a, b) => (a >>> 5) - (b >>> 5) || b - a));
  }
}

class WordColumns extends Columns<number> {
  // Columns are variable numbers rather than ranks
  declare private readonly _byVar: boolean;

  constructor(cube: Cube, lits: number[], all: number, byVar: boolean) {
    super(cube, lits, all, 0);
    this._byVar = byVar;
  }

  bit(j: number): number {
    return 1 << j;
  }

  and(a: number, b: number): number {
    return a & b;
  }

  or(a: number, b: number): number {
    return a | b;
  }

  andNot(a: number, b: number): number {
    return a & ~b;
  }

  isNone(row: number): boolean {
    return row === 0;
  }

  isUnit(row: number): boolean {
    return row !== 0 && (row & (row - 1)) === 0;
  }

  has(row: number, j: number): boolean {
    return (row & (1 << j)) !== 0;
  }

  countColumns(rows: number[]): number[] {
    const count = new Array<number>(32).fill(0);
    for (const r of rows)
      for (let b = r; b !== 0; b &= b - 1) ++count[31 - Math.clz32(b & -b)];
    return count;
  }

  columns(row: number): number[] {
    const res: number[] = [];
    for (let b = row; b !== 0; b &= b - 1) res.push(31 - Math.clz32(b & -b));
    return res;
  }

  // By variable, rows come straight out of the cube words: whatever the
  // other cubes hold above them can't intersect the cube
  blockingRows(offSet: Cube[]): number[] {
    if (!this._byVar) return super.blockingRows(offSet);
    const lo = invBi32(this._cube.lo);
    const hi = invBi32(this._cube.hi);
    const rows: number[] = [];
    for (const c of offSet) {
      const row = compress(lo & c.lo) | (compress(hi & c.hi) << 16);
      if (row) rows.push(row);
    }
    return rows;
  }

  coveringRows(onSet: Cube[]): number[] {
    if (!this._byVar) return super.coveringRows(onSet);
    const lo = this._cube.lo;
    const hi = this._cube.hi;
    const rows: number[] = [];
    for (const c of onSet) {
      const row = compress(lo & ~c.lo) | (compress(hi & ~c.hi) << 16);
      if (row) rows.push(row);
    }
    return rows;
  }
}

class BigColumns extends Columns<BI.bigint> {
  constructor(cube: Cube, lits: number[]) {
    super(cube, lits, BI.sub(BIGINT_INDEX[lits.length], BIGINT_1), BIGINT_0);
  }

  bit(j: number): BI.bigint {
    return BIGINT_INDEX[j];
  }

  and(a: BI.bigint, b: BI.bigint): BI.bigint {
    return BI.and(a, b);
  }

  or(a: BI.bigint, b: BI.bigint): BI.bigint {
    return BI.or(a, b);
  }

  andNot(a: BI.bigint, b: BI.bigint): BI.bigint {
    return BI.and(a, BI.not(b));
  }

  isNone(row: BI.bigint): boolean {
    return BI.eq(row, BIGINT_0);
  }

  isUnit(row: BI.bigint): boolean {
    return !this.isNone(row) && this.isNone(BI.and(row, BI.sub(row, BIGINT_1)));
  }

  columns(row: BI.bigint): number[] {
    return bitIndices(row);
  }
}

// Gathers the variable bits of one word (16 literal pairs) into the low 16
function compress(bits: number): number {
  let x = (bits | (bits >>> 1)) & 0x55555555;
  x = (x | (x >>> 1)) & 0x33333333;
  x = (x | (x >>> 2)) & 0x0f0f0f0f;
  x = (x | (x >>> 4)) & 0x00ff00ff;
  return (x | (x >>> 8)) & 0x0000ffff;
}
