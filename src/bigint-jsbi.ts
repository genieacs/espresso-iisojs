import JSBI from "jsbi";

export function and(a: JSBI, b: JSBI): JSBI {
  return JSBI.bitwiseAnd(a, b);
}

export function or(a: JSBI, b: JSBI): JSBI {
  return JSBI.bitwiseOr(a, b);
}

export function xor(a: JSBI, b: JSBI): JSBI {
  return JSBI.bitwiseXor(a, b);
}

export function not(a: JSBI): JSBI {
  return JSBI.bitwiseNot(a);
}

export function lshift(a: JSBI, b: JSBI): JSBI {
  return JSBI.leftShift(a, b);
}

export function rshift(a: JSBI, b: JSBI): JSBI {
  return JSBI.signedRightShift(a, b);
}

export function sub(a: JSBI, b: JSBI): JSBI {
  return JSBI.subtract(a, b);
}

export function toNumber(a: JSBI): number {
  return JSBI.toNumber(a);
}

export function eq(a: JSBI, b: JSBI): boolean {
  return JSBI.equal(a, b);
}

export function ne(a: JSBI, b: JSBI): boolean {
  return JSBI.notEqual(a, b);
}

export function lt(a: JSBI, b: JSBI): boolean {
  return JSBI.lessThan(a, b);
}

export function lte(a: JSBI, b: JSBI): boolean {
  return JSBI.lessThanOrEqual(a, b);
}

export function gt(a: JSBI, b: JSBI): boolean {
  return JSBI.greaterThan(a, b);
}

export function gte(a: JSBI, b: JSBI): boolean {
  return JSBI.greaterThanOrEqual(a, b);
}

export function asUintN(a: number, b: JSBI): JSBI {
  return JSBI.asUintN(a, b);
}

export function asIntN(a: number, b: JSBI): JSBI {
  return JSBI.asIntN(a, b);
}

const _BigInt = JSBI.BigInt;
type _bigint = JSBI;
export { _BigInt as BigInt, _bigint as bigint };
