interface Options {
  computeOffSet?: boolean;
  canRaise?: (idx: number, set: Set<number>) => boolean;
}

export declare function sat(cnf: number[][]): boolean;
export declare function allSat(cnf: number[][]): number[][];
export declare function tautology(dnf: number[][]): boolean;
export declare function complement(dnf: number[][]): number[][];
export declare function espresso(onSet: number[][], dcSet?: number[][], options?: Options): number[][];
