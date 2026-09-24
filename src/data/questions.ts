export interface QuestionOption {
  id: string;
  number: number;
  text: string;
  mathLatex?: string;
}

export interface QuestionItem {
  id: string;
  section: string;
  questionNumber: number;
  questionText: string;
  mathLatex?: string;
  options: QuestionOption[];
  correctOption: number;
  explanation: string;
  hint: string;
}

export const EXAM_SECTIONS = [
  'Quantitative Aptitude',
  'Logical Reasoning',
  'Verbal Ability',
  'General Awareness',
] as const;

export const QUESTIONS: QuestionItem[] = [
  {
    id: 'q-1',
    section: 'Quantitative Aptitude',
    questionNumber: 1,
    questionText: 'A train travelling at 72 km/h crosses a 250 m long platform in 26 seconds. What is the length of the train in metres?',
    mathLatex: 'v = 72 \\text{ km/h} = 72 \\times \\frac{5}{18} = 20 \\text{ m/s}',
    options: [
      { id: 'opt_1', number: 1, text: '250 metres' },
      { id: 'opt_2', number: 2, text: '270 metres' },
      { id: 'opt_3', number: 3, text: '300 metres' },
      { id: 'opt_4', number: 4, text: '320 metres' },
    ],
    correctOption: 2,
    explanation: 'Speed in m/s = 72 * (5/18) = 20 m/s. Total distance covered in 26 s = speed * time = 20 * 26 = 520 metres. Length of the train = Total distance - Platform length = 520 - 250 = 270 metres.',
    hint: 'First convert the train speed from km/h to m/s by multiplying with 5/18. Then multiply by 26 seconds to get the combined length of the train and platform.',
  },
  {
    id: 'q-2',
    section: 'Quantitative Aptitude',
    questionNumber: 2,
    questionText: 'Solve for the positive root of the quadratic equation given below:',
    mathLatex: '2x^2 - 7x + 3 = 0',
    options: [
      { id: 'opt_1', number: 1, text: 'x = 3' },
      { id: 'opt_2', number: 2, text: 'x = 4' },
      { id: 'opt_3', number: 3, text: 'x = 1/3' },
      { id: 'opt_4', number: 4, text: 'x = 5' },
    ],
    correctOption: 1,
    explanation: 'Factorizing: 2x^2 - 6x - x + 3 = 0 -> 2x(x - 3) - 1(x - 3) = 0 -> (2x - 1)(x - 3) = 0. The roots are x = 1/2 and x = 3. Among the choices, x = 3 is the integer positive root.',
    hint: 'Split the middle term -7x into -6x and -x, or use the quadratic formula with a=2, b=-7, and c=3.',
  },
  {
    id: 'q-3',
    section: 'Quantitative Aptitude',
    questionNumber: 3,
    questionText: 'A circular running track has a radius of 14 metres. If a runner completes 5 full laps, what is the total distance covered in metres? (Take pi = 22/7)',
    mathLatex: 'C = 2\\pi r = 2 \\times \\frac{22}{7} \\times 14',
    options: [
      { id: 'opt_1', number: 1, text: '352 metres' },
      { id: 'opt_2', number: 2, text: '440 metres' },
      { id: 'opt_3', number: 3, text: '528 metres' },
      { id: 'opt_4', number: 4, text: '616 metres' },
    ],
    correctOption: 2,
    explanation: 'Circumference of track C = 2 * (22/7) * 14 = 88 metres. Total distance for 5 laps = 5 * 88 = 440 metres.',
    hint: 'Recall the formula for circumference of a circle: C = 2 * pi * r. Multiply the single-lap circumference by 5.',
  },
  {
    id: 'q-4',
    section: 'Logical Reasoning',
    questionNumber: 4,
    questionText: 'Identify the next number in the increasing alphanumeric sequence: B2, D4, F8, H16, ...',
    options: [
      { id: 'opt_1', number: 1, text: 'I32' },
      { id: 'opt_2', number: 2, text: 'J32' },
      { id: 'opt_3', number: 3, text: 'J24' },
      { id: 'opt_4', number: 4, text: 'K32' },
    ],
    correctOption: 2,
    explanation: 'Letters skip one position each time: B (+2) -> D (+2) -> F (+2) -> H (+2) -> J. Numbers are powers of 2: 2, 4, 8, 16, 32. Thus, the next term is J32.',
    hint: 'Look at the letters and numbers as two separate patterns: alternate English alphabets and powers of 2.',
  },
  {
    id: 'q-5',
    section: 'Logical Reasoning',
    questionNumber: 5,
    questionText: 'Statements: All mangoes are fruits. Some fruits are sweet. Conclusion I: Some mangoes are sweet. Conclusion II: All fruits are mangoes.',
    options: [
      { id: 'opt_1', number: 1, text: 'Only Conclusion I follows' },
      { id: 'opt_2', number: 2, text: 'Only Conclusion II follows' },
      { id: 'opt_3', number: 3, text: 'Neither Conclusion I nor II follows' },
      { id: 'opt_4', number: 4, text: 'Both Conclusions follow' },
    ],
    correctOption: 3,
    explanation: 'The subset of fruits that are sweet does not necessarily overlap with mangoes. Furthermore, all mangoes being fruits does not imply all fruits are mangoes. Therefore, neither conclusion strictly follows.',
    hint: 'Draw two intersecting Venn diagrams: one circle for mangoes inside fruits, and a second overlapping circle for sweet things touching fruits.',
  },
  {
    id: 'q-6',
    section: 'Verbal Ability',
    questionNumber: 6,
    questionText: 'Choose the word that is most nearly OPPOSITE in meaning (antonym) to the word: EPHEMERAL.',
    options: [
      { id: 'opt_1', number: 1, text: 'Transient' },
      { id: 'opt_2', number: 2, text: 'Permanent' },
      { id: 'opt_3', number: 3, text: 'Fleeting' },
      { id: 'opt_4', number: 4, text: 'Delicate' },
    ],
    correctOption: 2,
    explanation: 'Ephemeral means lasting for a very short time (transient, fleeting). The exact antonym is Permanent, meaning lasting indefinitely.',
    hint: 'Ephemeral describes things like morning dew or shooting stars that disappear quickly.',
  },
  {
    id: 'q-7',
    section: 'Verbal Ability',
    questionNumber: 7,
    questionText: 'Select the grammatically correct sentence among the four options:',
    options: [
      { id: 'opt_1', number: 1, text: 'Neither the candidate nor the invigilators was present in the examination hall.' },
      { id: 'opt_2', number: 2, text: 'Neither the candidate nor the invigilators were present in the examination hall.' },
      { id: 'opt_3', number: 3, text: 'Neither the candidate or the invigilators were present in the examination hall.' },
      { id: 'opt_4', number: 4, text: 'Neither the candidate nor the invigilators has been present in the examination hall.' },
    ],
    correctOption: 2,
    explanation: 'When subjects are joined by "neither... nor", the verb agrees with the subject closest to it. Here "invigilators" is plural, so the plural verb "were" is required.',
    hint: 'Rule of proximity: with "neither... nor", look at the noun immediately before the verb.',
  },
  {
    id: 'q-8',
    section: 'General Awareness',
    questionNumber: 8,
    questionText: 'Under the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, what is the minimum required contrast ratio for normal body text against its background?',
    options: [
      { id: 'opt_1', number: 1, text: '3:1' },
      { id: 'opt_2', number: 2, text: '4.5:1' },
      { id: 'opt_3', number: 3, text: '7:1' },
      { id: 'opt_4', number: 4, text: '10:1' },
    ],
    correctOption: 2,
    explanation: 'WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum - Level AA) requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large-scale text (18pt or 14pt bold). Level AAA requires 7:1.',
    hint: 'Level AA requires a ratio between 4:1 and 5:1 for regular text.',
  },
  {
    id: 'q-9',
    section: 'General Awareness',
    questionNumber: 9,
    questionText: 'Which HTML5 attribute informs assistive technologies that a dynamic section of the page has updated without shifting keyboard focus?',
    options: [
      { id: 'opt_1', number: 1, text: 'aria-live' },
      { id: 'opt_2', number: 2, text: 'aria-hidden' },
      { id: 'opt_3', number: 3, text: 'tabindex="0"' },
      { id: 'opt_4', number: 4, text: 'role="presentation"' },
    ],
    correctOption: 1,
    explanation: 'The aria-live attribute (with values polite or assertive) marks an area as a live region so screen readers automatically announce dynamic content changes without moving focus.',
    hint: 'Look for the ARIA attribute whose name implies that the content is active and "living".',
  },
  {
    id: 'q-10',
    section: 'Quantitative Aptitude',
    questionNumber: 10,
    questionText: 'If the hypotenuse of a right-angled triangle is 13 cm and one of the legs is 5 cm, find the length of the other leg using the Pythagorean theorem:',
    mathLatex: 'a^2 + b^2 = c^2 \\implies 5^2 + b^2 = 13^2',
    options: [
      { id: 'opt_1', number: 1, text: '8 cm' },
      { id: 'opt_2', number: 2, text: '10 cm' },
      { id: 'opt_3', number: 3, text: '12 cm' },
      { id: 'opt_4', number: 4, text: '14 cm' },
    ],
    correctOption: 3,
    explanation: 'Using Pythagorean theorem: b^2 = 13^2 - 5^2 = 169 - 25 = 144. Therefore, b = sqrt(144) = 12 cm.',
    hint: '13 squared is 169 and 5 squared is 25. Subtract 25 from 169 and find the square root.',
  },
];
