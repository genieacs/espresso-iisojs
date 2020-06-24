import * as BI from "./bigint";
import Cube from "./cube";
import Cover from "./cover";
import _sat from "./sat";
import _allSat from "./all-sat";
import _tautology from "./tautology";
import _complement from "./complement";
import _espresso from "./espresso";
import { BIGINT_1 } from "./common";

function toCubes(input: number[][]): Cube[] {
  return input.map((i) => Cube.from(i));
}

function fromCubes(input: Cube[]): number[][] {
  return input.map((i) => [...i.set]);
}

export function sat(pos: number[][]): boolean {
  const input = Cover.from(toCubes(pos));
  return _sat(input);
}

export function allSat(pos: number[][], aux?: number): number[][] {
  const cover = Cover.from(toCubes(pos));
  let mask = cover.bigint;
  if (aux) {
    const a = Math.trunc(aux / 2) * 2;
    const m = BI.sub(BI.lshift(BIGINT_1, BI.BigInt(a)), BIGINT_1);
    mask = BI.and(mask, m);
  }
  const output = _allSat(cover, mask);
  return fromCubes(output);
}

export function tautology(sop: number[][]): boolean {
  const input = Cover.from(toCubes(sop));
  return _tautology(input);
}

export function complement(sop: number[][]): number[][] {
  const cover = Cover.from(toCubes(sop));
  const output = _complement(cover);
  return fromCubes(output);
}

export function espresso(
  onSet: number[][],
  dcSet: number[][],
  offSet = false
): number[][] {
  const _onSet = toCubes(onSet);
  const _dcSet = toCubes(dcSet);
  const _offSet = offSet
    ? _complement(Cover.from([..._onSet, ..._dcSet]))
    : undefined;
  const output = _espresso(_onSet, _dcSet, _offSet);
  return fromCubes(output);
}
