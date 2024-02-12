import Cube from "./cube.ts";
import Cover from "./cover.ts";
import _sat from "./sat.ts";
import _allSat from "./all-sat.ts";
import _tautology from "./tautology.ts";
import _complement from "./complement.ts";
import _espresso from "./espresso.ts";

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

interface Options {
  computeOffSet?: boolean;
  canRaise?: (idx: number, set: Set<number>) => boolean;
  canLower?: (idx: number, set: Set<number>) => boolean;
}

export function espresso(
  onSet: number[][],
  dcSet: number[][] = [],
  options: Options = {},
): number[][] {
  const _onSet = toCubes(onSet).filter((c) => !c.empty);
  const _dcSet = toCubes(dcSet).filter((c) => !c.empty);
  const _offSet = options.computeOffSet
    ? _complement(Cover.from([..._onSet, ..._dcSet]))
    : undefined;
  const res = _espresso(
    _onSet,
    _dcSet,
    _offSet,
    options.canRaise,
    options.canLower,
  );
  return fromCubes(res);
}
