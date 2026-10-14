import Cube from "./cube.ts";
import Cover from "./cover.ts";
import _sat from "./sat.ts";
import _allSat from "./all-sat.ts";
import _tautology from "./tautology.ts";
import _complement from "./complement.ts";
import _espresso from "./espresso.ts";

// Converts the inputs to cubes, numbering the variables in use from 0 in
// their original order, so that inputs with gaps in their numbering still fit
// the machine-word paths (literals below bit 64) when they use few enough
// variables. Also returns each new variable's original number.
function toCubes(...inputs: number[][][]): [Cube[][], number[]] {
  const to: number[] = [];
  for (const input of inputs)
    for (const c of input) for (const l of c) to[l >>> 1] = 0;
  const vars: number[] = [];
  to.forEach((_, v) => (to[v] = vars.push(v) - 1));
  const cubes = inputs.map((input) =>
    input.map((c) => Cube.from(c.map((l) => (to[l >>> 1] << 1) | (l & 1)))),
  );
  return [cubes, vars];
}

function fromLit(vars: number[], l: number): number {
  return (vars[l >>> 1] << 1) | (l & 1);
}

function fromCubes(cubes: Cube[], vars: number[]): number[][] {
  return cubes.map((c) => c.lits.map((l) => fromLit(vars, l)));
}

export function sat(cnf: number[][]): boolean {
  const [[cubes]] = toCubes(cnf);
  return _sat(Cover.from(cubes));
}

export function allSat(cnf: number[][]): number[][] {
  const [[cubes], vars] = toCubes(cnf);
  return fromCubes(_allSat(Cover.from(cubes)), vars);
}

export function tautology(dnf: number[][]): boolean {
  const [[cubes]] = toCubes(dnf);
  return _tautology(Cover.from(cubes));
}

export function complement(dnf: number[][]): number[][] {
  const [[cubes], vars] = toCubes(dnf);
  return fromCubes(_complement(Cover.from(cubes)), vars);
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
  const [[on, dc], vars] = toCubes(onSet, dcSet);
  const _onSet = on.filter((c) => !c.empty);
  const _dcSet = dc.filter((c) => !c.empty);
  const _offSet = options.computeOffSet
    ? _complement(Cover.from([..._onSet, ..._dcSet]))
    : undefined;
  // The callbacks take the caller's numbering, and a Set. Calls come in runs
  // for the same cube, so the last conversion is kept.
  const { canRaise, canLower, bias } = options;
  const lit = (l: number): number => fromLit(vars, l);
  let cube: Cube | undefined;
  let cubeSet = new Set<number>();
  const set = (c: Cube): Set<number> => {
    if (c !== cube) cubeSet = new Set((cube = c).lits.map(lit));
    return cubeSet;
  };
  const res = _espresso(
    _onSet,
    _dcSet,
    _offSet,
    canRaise && ((i, c) => canRaise(lit(i), set(c))),
    canLower && ((i, c) => canLower(lit(i), set(c))),
    bias && ((a, b) => bias(lit(a), lit(b))),
  );
  return fromCubes(res, vars);
}
