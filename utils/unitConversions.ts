/**
 * Unit conversion helpers for metric ↔ standard (imperial).
 * Backend and calorie math always use metric (kg, cm).
 */

export type UnitSystem = 'metric' | 'standard';

const LB_PER_KG = 2.20462;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

/** Convert kg to pounds. */
export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

/** Convert pounds to kg. */
export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Convert cm to feet and inches. Returns [feet, inches] with inches 0–11. */
export function cmToFtIn(cm: number): [number, number] {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = Math.round((totalInches - feet * INCHES_PER_FOOT) * 10) / 10;
  return [feet, Math.min(11.9, Math.max(0, inches))];
}

/** Convert feet and inches to cm. */
export function ftInToCm(feet: number, inches: number): number {
  return (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;
}
