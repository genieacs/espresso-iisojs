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
  return input.map((i) => [...i.lits]);
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
  bias?: (a: number, b: number) => number;
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
  // The callbacks take a Set. Calls come in runs for the same cube, so the
  // last conversion is kept.
  const { canRaise, canLower, bias } = options;
  let cube: Cube | undefined;
  let cubeSet = new Set<number>();
  const set = (c: Cube): Set<number> => {
    if (c !== cube) cubeSet = new Set((cube = c).lits);
    return cubeSet;
  };
  const res = _espresso(
    _onSet,
    _dcSet,
    _offSet,
    canRaise && ((i, c) => canRaise(i, set(c))),
    canLower && ((i, c) => canLower(i, set(c))),
    bias,
  );
  return fromCubes(res);
}
