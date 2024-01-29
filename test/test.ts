import { execSync } from "node:child_process";
import Cube from "../src/cube.ts";
import complement from "../src/complement.ts";
import Cover from "../src/cover.ts";
import allSat from "../src/all-sat.ts";
import tautology from "../src/tautology.ts";
import sat from "../src/sat.ts";
import espresso from "../src/espresso.ts";

const smtSolvers: { [name: string]: (string: string) => string } = {
  "yices-smt2": (input: string) => {
    const res = execSync("yices-smt2", { input });
    return res.toString().trim();
  },
  cvc4: (input: string) => {
    const res = execSync(`cvc4 --lang smt2`, { input });
    return res.toString().trim();
  },
  z3: (input: string) => {
    const res = execSync(`z3 -smt2 -in`, { input });
    return res.toString().trim();
  },
};

let smtSolver: (input: string) => string = smtSolvers["yices-smt2"];
for (const [name, solver] of Object.entries(smtSolvers)) {
  try {
    execSync(`${name} --version`, { stdio: [null, null, null] });
    smtSolver = solver;
    break;
  } catch (err) {
    // Ignore
  }
}

const espressoCmd = (input: string): string => {
  const res = execSync(`espresso`, { input });
  return res.toString();
};

function espressoRef(onSet: Cube[], dcSet: Cube[]): Cube[] {
  let maxVar = 0;
  for (const o of onSet) maxVar = Math.max(maxVar, ...o.set);
  for (const o of dcSet) maxVar = Math.max(maxVar, ...o.set);
  const varCount = Math.trunc(maxVar / 2) + 1;
  const lines = [`.i ${varCount}`, ".o 1"];
  const filler = "-".repeat(varCount);
  for (const c of onSet)
    lines.push((c.toString() + filler).slice(0, varCount) + " 1");
  for (const c of dcSet)
    lines.push((c.toString() + filler).slice(0, varCount) + " -");
  lines.push(".e");
  const input = lines.join("\n");
  const output = espressoCmd(input);
  return output
    .split("\n")
    .filter((l) => ["0", "1", "-"].includes(l[0]))
    .map((l) => Cube.parse(l.slice(0, varCount)));
}

let _seed = 0;
function seed(s: number): void {
  _seed = s % 2147483647;
  if (_seed <= 0) _seed += 2147483646;
}
function random(): number {
  _seed = (_seed * 16807) % 2147483647;
  return _seed / 2147483646;
}

function randomCube(maxVar: number, cardinality: number): Cube {
  const set: Set<number> = new Set();
  while (set.size < cardinality) {
    const i = Math.trunc(random() * maxVar * 2);
    if (!set.has(i) && !set.has(i ^ 1)) set.add(i);
  }
  return Cube.from(set);
}

function randomCover(count: number, minCrd: number, maxCrd: number): Cube[] {
  const res: Cube[] = [];
  const crdRange = maxCrd - minCrd;
  for (let i = 0; i < count; ++i) {
    const crd = minCrd + Math.trunc(random() * crdRange);
    res.push(randomCube(maxCrd, crd));
  }
  return res;
}

seed(0);
const SAMPLES: Cube[][] = [];
for (let vars = 1; vars < 11; ++vars) {
  for (let i = 0; i < vars * 2; ++i) {
    const minterms = Math.trunc(2 ** vars / 2);
    SAMPLES.push(randomCover(minterms, Math.ceil(vars * 0.7), vars));
  }
}

function cubesToSmtSop(terms: Cube[]): string {
  const strs = terms.map((term) => {
    if (!term.set.size) return "true";
    const arr = Array.from(term.set).map((i) => {
      const I = Math.trunc(i / 2);
      return i % 2 ? `v${I}` : `(not v${I})`;
    });
    return `(and ${arr.join(" ")})`;
  });
  if (!strs.length) return "false";
  return `(or ${strs.join(" ")})`;
}

function cubesToSmtPos(terms: Cube[]): string {
  const strs = terms.map((term) => {
    if (!term.set.size) return "false";
    const arr = Array.from(term.set).map((i) => {
      const I = Math.trunc(i / 2);
      return i % 2 ? `v${I}` : `(not v${I})`;
    });
    return `(or ${arr.join(" ")})`;
  });
  if (!strs.length) return "true";
  return `(and ${strs.join(" ")})`;
}

function isEquivalent(smtStr1: string, smtStr2: string): boolean {
  const lines = ["(set-logic QF_UF)"];
  for (let i = 0; i < 32; ++i) lines.push(`(declare-const v${i} Bool)`);
  lines.push(`(assert (xor ${smtStr1} ${smtStr2}))`);
  lines.push("(check-sat)");
  lines.push("(exit)");
  return smtSolver(lines.join("\n")) === "unsat";
}

function isTautology(smtStr: string): boolean {
  const lines = ["(set-logic QF_UF)"];
  for (let i = 0; i < 32; ++i) lines.push(`(declare-const v${i} Bool)`);
  lines.push(`(assert (not ${smtStr}))`);
  lines.push("(check-sat)");
  lines.push("(exit)");
  return smtSolver(lines.join("\n")) === "unsat";
}

function isSatisfiable(smtStr: string): boolean {
  const lines = ["(set-logic QF_UF)"];
  for (let i = 0; i < 32; ++i) lines.push(`(declare-const v${i} Bool)`);
  lines.push(`(assert ${smtStr})`);
  lines.push("(check-sat)");
  lines.push("(exit)");
  return smtSolver(lines.join("\n")) === "sat";
}

// sat
process.stdout.write("sat: ");
for (const [i, pos] of SAMPLES.entries()) {
  const cov = [...pos, ...(SAMPLES[i + 1] || []), ...(SAMPLES[i + 2] || [])];
  const s = sat(Cover.from(cov));
  const smtStr = cubesToSmtPos(cov);
  if (isSatisfiable(smtStr) !== s) throw new Error("sat failed");
}
process.stdout.write("pass\n");

// allSat
process.stdout.write("allSet: ");
for (const pos of SAMPLES) {
  const sop = allSat(Cover.from(pos));
  const smtStr1 = cubesToSmtPos(pos);
  const smtStr2 = cubesToSmtSop(sop);
  if (!isEquivalent(`${smtStr1}`, smtStr2)) throw new Error("allSat failed");
}
process.stdout.write("pass\n");

// tautology
process.stdout.write("tautology: ");
for (const [i, sop] of SAMPLES.entries()) {
  const cov = [...sop, ...(SAMPLES[i + 1] || []), ...(SAMPLES[i + 2] || [])];
  const taut = tautology(Cover.from(cov));
  const smtStr = cubesToSmtSop(cov);
  if (isTautology(smtStr) !== taut) throw new Error("tautology failed");
}
process.stdout.write("pass\n");

// complement
process.stdout.write("complement: ");
for (const sample of SAMPLES) {
  const comp = complement(Cover.from(sample));
  const smtStr1 = cubesToSmtSop(sample);
  const smtStr2 = cubesToSmtSop(comp);
  if (!isEquivalent(`(not ${smtStr1})`, smtStr2))
    throw new Error("complement failed");
}
process.stdout.write("pass\n");

function COST(cover: Cube[]): number {
  return cover.reduce((a, c) => a + c.set.size, 0);
}

// espresso
process.stdout.write("espresso: ");
let totalCost = 0;
let totalCostPresto = 0;
let totalCostRef = 0;
for (const [idx, onSet] of SAMPLES.entries()) {
  const dcSet = idx ? SAMPLES[idx - 1] : [];
  const offSet = complement(Cover.from([...onSet, ...dcSet]));
  const min = espresso(onSet, dcSet, offSet);
  const minPresto = espresso(onSet, dcSet);
  const minRef = espressoRef(onSet, dcSet);
  const cost = COST(min);
  const costPresto = COST(minPresto);
  const costRef = COST(minRef);
  totalCost += cost;
  totalCostPresto += costPresto;
  totalCostRef += costRef;
  const str = cubesToSmtSop([...min, ...dcSet]);
  const strPresto = cubesToSmtSop([...minPresto, ...dcSet]);
  const strRef = cubesToSmtSop([...onSet, ...dcSet]);
  if (!isEquivalent(str, strRef) || !isEquivalent(strPresto, strRef))
    throw new Error("espresso correctness test failed");
}
const costThreshold = Math.trunc(totalCostRef * 1.03);
if (totalCost > costThreshold || totalCostPresto > costThreshold)
  throw new Error("espresso cardinality test failed");
process.stdout.write("pass\n");
