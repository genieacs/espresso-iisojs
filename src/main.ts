import Cube from "./cube";
import Cover from "./cover";
import _sat from "./sat";
import _allSat from "./all-sat";
import _tautology from "./tautology";
import _complement from "./complement";
import _espresso from "./espresso";

function toCubes(input: number[][]): Cube[] {
  return input.map((i) => Cube.from(i));
}

function fromCubes(input: Cube[]): number[][] {
  return input.map((i) => [...i.set]);
}

export function sat(cnf: number[][]): boolean {
  const cover = Cover.from(toCubes(cnf));
  return _sat(cover);
}

export function allSat(cnf: number[][]): number[][] {
  const cover = Cover.from(toCubes(cnf));
  const res = _allSat(cover);
  return fromCubes(res);
}

export function tautology(dnf: number[][]): boolean {
  const cover = Cover.from(toCubes(dnf));
  return _tautology(cover);
}

export function complement(dnf: number[][]): number[][] {
  const cover = Cover.from(toCubes(dnf));
  const res = _complement(cover);
  return fromCubes(res);
}

export function espresso(
  onSet: number[][],
  dcSet: number[][],
  computeOffSet = false
): number[][] {
  const _onSet = toCubes(onSet);
  const _dcSet = toCubes(dcSet);
  const _offSet = computeOffSet
    ? _complement(Cover.from([..._onSet, ..._dcSet]))
    : undefined;
  const res = _espresso(_onSet, _dcSet, _offSet);
  return fromCubes(res);
}
