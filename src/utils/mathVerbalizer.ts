/**
 * LaTeX / Math to Verbal Spoken Language Converter
 * Translates mathematical notation into screen-reader friendly natural language.
 */

export function verbalizeMath(latex: string): string {
  if (!latex) return '';

  let verbal = latex.trim();

  // Normalize common spacing
  verbal = verbal.replace(/\\quad|\\qquad|\\,|\\;/g, ' ');

  // Units
  verbal = verbal.replace(/\\text\{\s*km\/h\s*\}/gi, ' kilometers per hour');
  verbal = verbal.replace(/\\text\{\s*m\/s\s*\}/gi, ' meters per second');
  verbal = verbal.replace(/\\text\{\s*seconds?\s*\}/gi, ' seconds');
  verbal = verbal.replace(/\\text\{\s*metres?\s*\}/gi, ' meters');
  verbal = verbal.replace(/\\text\{\s*meters?\s*\}/gi, ' meters');
  verbal = verbal.replace(/\\text\{\s*cm\s*\}/gi, ' centimeters');
  verbal = verbal.replace(/\\text\{([^}]+)\}/g, '$1');

  // Fractions: \frac{num}{den} -> "fraction: num over den, end fraction"
  verbal = verbal.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, 'fraction: $1 over $2, end fraction');

  // Square roots: \sqrt{arg} or \sqrt[n]{arg}
  verbal = verbal.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1th root of $2');
  verbal = verbal.replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1');

  // Powers and exponents: x^2 -> "x squared", x^3 -> "x cubed", x^{n} -> "x to the power of n"
  verbal = verbal.replace(/([a-zA-Z0-9\(\)]+)\^2(?![0-9])/g, '$1 squared');
  verbal = verbal.replace(/([a-zA-Z0-9\(\)]+)\^3(?![0-9])/g, '$1 cubed');
  verbal = verbal.replace(/([a-zA-Z0-9\(\)]+)\^\{([^}]+)\}/g, '$1 to the power of $2');
  verbal = verbal.replace(/([a-zA-Z0-9\(\)]+)\^([0-9a-zA-Z])/g, '$1 to the power of $2');

  // Subscripts: x_1 -> "x sub 1"
  verbal = verbal.replace(/([a-zA-Z0-9])_\{([^}]+)\}/g, '$1 sub $2');
  verbal = verbal.replace(/([a-zA-Z0-9])_([0-9a-zA-Z])/g, '$1 sub $2');

  // Implications and arrows
  verbal = verbal.replace(/\\implies|\\Rightarrow/g, ' which implies that ');
  verbal = verbal.replace(/\\iff|\\Leftrightarrow/g, ' if and only if ');
  verbal = verbal.replace(/\\to|\\rightarrow/g, ' approaches ');

  // Inequalities and comparisons
  verbal = verbal.replace(/\\le|\\leq/g, ' is less than or equal to ');
  verbal = verbal.replace(/\\ge|\\geq/g, ' is greater than or equal to ');
  verbal = verbal.replace(/\\neq|\\ne/g, ' is not equal to ');
  verbal = verbal.replace(/\\approx/g, ' is approximately equal to ');
  verbal = verbal.replace(/\\pm/g, ' plus or minus ');
  verbal = verbal.replace(/\\times/g, ' multiplied by ');
  verbal = verbal.replace(/\\div/g, ' divided by ');
  verbal = verbal.replace(/\\cdot/g, ' dot ');

  // Symbols
  verbal = verbal.replace(/\\pi/g, 'pi');
  verbal = verbal.replace(/\\theta/g, 'theta');
  verbal = verbal.replace(/\\alpha/g, 'alpha');
  verbal = verbal.replace(/\\beta/g, 'beta');
  verbal = verbal.replace(/\\gamma/g, 'gamma');
  verbal = verbal.replace(/\\Delta|\\delta/g, 'delta');
  verbal = verbal.replace(/\\infty/g, 'infinity');
  verbal = verbal.replace(/\\degree|°/g, ' degrees');
  verbal = verbal.replace(/\\%/g, ' percent');
  verbal = verbal.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'sum from $1 to $2 of ');
  verbal = verbal.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, 'integral from $1 to $2 of ');

  // Clean remaining backslashes
  verbal = verbal.replace(/\\/g, '');

  // Consolidate extra spaces
  verbal = verbal.replace(/\s+/g, ' ').trim();

  return verbal;
}
