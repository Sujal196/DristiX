/**
 * LaTeX / Math to Verbal Spoken Language Converter
 * Translates mathematical notation into screen-reader friendly natural language.
 */

export function verbalizeMath(latex: string): string {
  if (!latex) return '';

  let verbal = latex.trim();

  // Normalize common spacing
  verbal = verbal.replace(/\\quad|\\qquad|\\,|\\;/g, ' ');

  // Angles & Geometry (must run before powers)
  verbal = verbal.replace(/\\angle\s*([a-zA-Z0-9])/g, 'angle $1');
  verbal = verbal.replace(/\\angle/g, 'angle ');
  verbal = verbal.replace(/\\triangle\s*([a-zA-Z0-9]+)/g, 'triangle $1');
  verbal = verbal.replace(/\\triangle/g, 'triangle ');

  // Degrees (LaTeX standard ^\circ, ^{\circ}, \degree, °, unicode degrees)
  verbal = verbal.replace(/([0-9]+(?:\.[0-9]+)?)\s*(?:\^\{\\circ\}|\^\\circ|\\circ|\^\{\\degree\}|\^\\degree|\\degree|[°\u00B0\u02DA\u2218])/g, '$1 degrees');
  verbal = verbal.replace(/(?:\^\{\\circ\}|\^\\circ|\\circ|\^\{\\degree\}|\^\\degree|\\degree|[°\u00B0\u02DA\u2218])/g, ' degrees');

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
  verbal = verbal.replace(/([a-zA-Z0-9()]+)\^2(?![0-9])/g, '$1 squared');
  verbal = verbal.replace(/([a-zA-Z0-9()]+)\^3(?![0-9])/g, '$1 cubed');
  verbal = verbal.replace(/([a-zA-Z0-9()]+)\^\{([^}]+)\}/g, '$1 to the power of $2');
  verbal = verbal.replace(/([a-zA-Z0-9()]+)\^([0-9a-zA-Z])/g, '$1 to the power of $2');

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
  verbal = verbal.replace(/\\degree|[°\u00B0\u02DA\u2218]/g, ' degrees');
  verbal = verbal.replace(/\\%/g, ' percent');
  verbal = verbal.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'sum from $1 to $2 of ');
  verbal = verbal.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, 'integral from $1 to $2 of ');

  // Arithmetic operators (explicit words so bilingual/Hindi TTS doesn't speak '+' as 'jod', '-' as 'ghatav', '=' as 'barabar')
  verbal = verbal.replace(/=/g, ' equals ');
  verbal = verbal.replace(/\\pm|±/g, ' plus or minus ');
  verbal = verbal.replace(/\\mp|∓/g, ' minus or plus ');
  verbal = verbal.replace(/\\times|×/g, ' multiplied by ');
  verbal = verbal.replace(/\\div|÷/g, ' divided by ');
  verbal = verbal.replace(/\\cdot/g, ' dot ');
  verbal = verbal.replace(/\+/g, ' plus ');
  verbal = verbal.replace(/[-−]/g, ' minus ');

  // Clean remaining backslashes
  verbal = verbal.replace(/\\/g, '');

  // Guard against any leftover circ / ^circ being misread as 'sa' by TTS
  verbal = verbal.replace(/([0-9]+(?:\.[0-9]+)?)\s*\^?\s*circ\b/gi, '$1 degrees');
  verbal = verbal.replace(/\^?\bcirc\b/gi, ' degrees');

  // Consolidate extra spaces
  verbal = verbal.replace(/\s+/g, ' ').trim();

  return verbal;
}

/**
 * Normalizes general text, question options, and prompts for natural TTS vocalization.
 * Translates numeric ratios (e.g. 3:1, 4.5:1, 7:1, 10:1), negative numbers, abbreviations,
 * and units into clean spoken words instead of literal punctuation reading.
 */
export function verbalizeForSpeech(rawText: string): string {
  if (!rawText) return '';

  let text = verbalizeMath(rawText);

  // 1. Ratios: 3:1 -> "3 to 1", 4.5:1 -> "4.5 to 1", 7:1 -> "7 to 1", 10:1 -> "10 to 1"
  // Handles decimals and integer numbers separated by colons without clock time indicators
  text = text.replace(/(^|[\s(])(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)(?!\s*(?:am|pm|hours?|mins?|seconds?|sec))(?=[\s).,;!?]|$)/gi, '$1$2 to $3');

  // 2. Question number formats: Q1. / Q8. -> "Question 1.", "Question 8."
  text = text.replace(/\bQ(\d+)\./gi, 'Question $1.');

  // 3. Option abbreviations: Opt 1 / Opt. 2 -> "Option 1", "Option 2"
  text = text.replace(/\bOpt\.?\s*(\d+)/gi, 'Option $1');

  // 4. Accessibility standard acronyms: WCAG -> "W C A G" (spell out so TTS doesn't garble)
  text = text.replace(/\bWCAG\b/g, 'W C A G');

  // 5. Negative numbers & penalties: -0.5 -> "minus 0.5", -2 -> "minus 2"
  text = text.replace(/(^|[\s(])-(\d+(?:\.\d+)?)/g, '$1minus $2');
  text = text.replace(/(^|[\s(])\+(\d+(?:\.\d+)?)/g, '$1plus $2');

  // 6. Percentages & Units
  text = text.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent');
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:°C|℃)/g, '$1 degrees Celsius');
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:°F|℉)/g, '$1 degrees Fahrenheit');
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:[°\u00B0\u02DA\u2218]|\^?\s*circ\b)/gi, '$1 degrees');
  text = text.replace(/[°\u00B0\u02DA\u2218]/g, ' degrees ');
  text = text.replace(/\^?\bcirc\b/gi, ' degrees ');
  text = text.replace(/(\d+(?:\.\d+)?)\s*km\/h/gi, '$1 kilometers per hour');
  text = text.replace(/(\d+(?:\.\d+)?)\s*m\/s/gi, '$1 meters per second');

  // 7. Math comparisons & operators in plain text
  text = text.replace(/=/g, ' equals ');
  text = text.replace(/\+/g, ' plus ');
  text = text.replace(/(^|\s)[-−](\s|$)/g, '$1minus$2');
  text = text.replace(/±/g, ' plus or minus ');
  text = text.replace(/∓/g, ' minus or plus ');
  text = text.replace(/≠/g, ' is not equal to ');
  text = text.replace(/≤/g, ' is less than or equal to ');
  text = text.replace(/≥/g, ' is greater than or equal to ');
  text = text.replace(/×/g, ' multiplied by ');
  text = text.replace(/÷/g, ' divided by ');

  // 8. Decimals without leading zero (e.g. .5 -> 0.5)
  text = text.replace(/(^|[\s(])\.(\d+)(?=[\s).,;!?]|$)/g, '$10.$2');

  // Consolidate extra whitespace
  return text.replace(/\s+/g, ' ').trim();
}
