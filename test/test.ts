import test from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import Cube from "../src/cube.ts";
import complement from "../src/complement.ts";
import Cover from "../src/cover.ts";
import allSat from "../src/all-sat.ts";
import tautology from "../src/tautology.ts";
import sat from "../src/sat.ts";
import espresso from "../src/espresso.ts";

const smtSolvers: { [name: string]: (string: string) => string } = {
  cvc5: (input: string) => {
    const res = execSync("cvc5 --lang smt2", { input });
    return res.toString().trim();
  },
  z3: (input: string) => {
    const res = execSync("z3 -smt2 -in", { input });
    return res.toString().trim();
  },
  "yices-smt2": (input: string) => {
    const res = execSync("yices-smt2", { input });
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
  const lines = [`.i ${varCount}`, ".o 1", `.p ${onSet.length + dcSet.length}`];
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

function parsePlaFile(content: string): { onSet: Cube[]; dcSet: Cube[] } {
  const lines = content.split("\n").map((l) => l.trim());

  const onSet: Cube[] = [];
  const dcSet: Cube[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith(".e")) break;
    if (line.startsWith(".")) continue;

    const [input, output] = line.split(/[\s|]/);
    if (output === "0") continue;
    else if (output === "1") onSet.push(Cube.parse(input));
    else if (output === "-") dcSet.push(Cube.parse(input));
    else throw new Error("Only single-output PLAs are supported");
  }

  return { onSet, dcSet };
}

function smtSop(terms: Cube[]): string {
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

function smtPos(terms: Cube[]): string {
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

function smtAssert(expression: string): boolean {
  const MAX_VARS = 130;
  const lines = ["(set-logic QF_UF)"];
  for (let i = 0; i < MAX_VARS; ++i) lines.push(`(declare-const v${i} Bool)`);
  lines.push(`(assert ${expression})`);
  lines.push("(check-sat)");
  lines.push("(exit)");
  const res = smtSolver(lines.join("\n"));
  if (res === "sat") return true;
  if (res === "unsat") return false;
  throw new Error("Unexpected result from SMT solver: " + res);
}

function COST(cover: Cube[]): number {
  return cover.reduce((a, c) => a + c.set.size, 0);
}

async function runTests(dir: string): Promise<void> {
  const examples = await readdir(dir);
  for (const filename of examples) {
    await test(filename, async (t) => {
      const content = await readFile(join(dir, filename), "utf-8");
      const { onSet, dcSet } = parsePlaFile(content);
      const cover = Cover.from([...onSet, ...dcSet]);
      const t1 = Date.now();
      const offSet = complement(Cover.from([...onSet, ...dcSet]));
      const min = espresso(onSet, dcSet, offSet);
      const t2 = Date.now();
      const minPresto = espresso(onSet, dcSet);
      const t3 = Date.now();
      const minRef = espressoRef(onSet, dcSet);
      const t4 = Date.now();

      assert.equal(sat(cover), smtAssert(smtPos(cover.cubes)));

      assert(
        !smtAssert(`(xor ${smtSop(allSat(cover))} ${smtPos(cover.cubes)})`),
      );

      assert.equal(
        tautology(cover),
        !smtAssert(`(not ${smtSop(cover.cubes)})`),
      );

      assert(!smtAssert(`(= ${smtSop(offSet)} ${smtSop(cover.cubes)})`));

      assert(
        !smtAssert(
          `(xor ${smtSop([...min, ...dcSet])} ${smtSop(cover.cubes)})`,
        ),
      );

      assert(
        !smtAssert(
          `(xor ${smtSop([...minPresto, ...dcSet])} ${smtSop(cover.cubes)})`,
        ),
      );

      const time = t2 - t1;
      const timePresto = t3 - t2;
      const timeRef = t4 - t3;
      const cost = COST(min);
      const costRef = COST(minRef);
      const costPresto = COST(minPresto);

      t.diagnostic(
        `cost: ${cost}/${costPresto}/${costRef}, time: ${time}/${timePresto}/${timeRef}`,
      );
    });
  }
}

runTests("test/examples").catch((err) => {
  console.error(err);
  process.exit(1);
});
