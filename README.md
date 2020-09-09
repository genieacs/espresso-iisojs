# Espresso-IISOJS

This is an implementation of
[Espresso-II](https://en.wikipedia.org/wiki/Espresso_heuristic_logic_minimizer)
method for heuristic minimization of single-output boolean functions.
Multiple-output boolean functions are not supported.

Also included are the following utility functions:

- *sat*: Test boolean satisfiability for CNF formulas. The implementation is
  inspired by the tautology algorithm in Espresso-II. It implements unit
  propagation on top of that, but none of the other optimizations found in
  modern SAT solvers. Performance is reasonable for smaller input sizes.

- *allSat*: Finds all satisfying assignments for the given CNF formula.

- *tautology*: Given a DNF formula, determine whether or not it's a tautology.
  The algorithm is identical to *sat* above and therefore a modern SAT solver
  can be used to answer the tautology question for larger input sizes much more
  efficiently.

- *complement*: Computes the complement of the given DNF formula.

A formula is represented as an array of arrays of numbers. Literals are
represented as unsigned numbers where the least significant bit denotes the
polarity of the literal, and the remaining bits are the literal number
left-shifted by 1. For example, the clause `-1 2 -3` in DIMACS format would be
`[2, 5, 6]`.

# Quick start

```javascript
import { espresso } from "espresso-iisojs";

// A'BC'D' + AB'C'D' + AB'CD' + AB'CD + ABC'D' + ABCD
const original = [
  [ 2, 5, 8, 16 ],
  [ 3, 4, 8, 16 ],
  [ 3, 4, 9, 16 ],
  [ 3, 4, 9, 17 ],
  [ 3, 5, 8, 16 ],
  [ 3, 5, 9, 17 ]
];

// The don't-care terms: AB'C'D and ABCD'
const dcSet = [
  [ 3, 4, 8, 17 ],
  [ 3, 5, 9, 16 ]
];

const minimized = espresso(original, dcSet);

// Should print: [ [ 5, 8, 16 ], [ 3, 9 ], [ 3, 16 ] ]
// which is the representation of BC'D' + AC + AD'
// which is a minimized form of the original formula
console.log(minimized);
```