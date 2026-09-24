import { QUESTIONS } from './questions';
import type { Exam } from './exams';

export const PRACTICE_DRILLS_CATALOG: Exam[] = [
  {
    id: 'practice-quant-arithmetic',
    code: 'PRACTICE-QA-01',
    title: 'Quantitative Aptitude: Arithmetic & Algebra Practice Drill',
    description:
      'Step-by-step math practice focusing on speed calculations, quadratic factorizations, circumference mensuration, and percentages with instant hints and formula derivations.',
    category: 'Banking & Insurance',
    durationMinutes: 30,
    totalMarks: 25,
    negativeMarking: 'No negative marking (Practice Mode)',
    difficulty: 'Moderate',
    sections: ['Quantitative Aptitude'],
    questions: [
      QUESTIONS[0], // Train speed
      QUESTIONS[1], // Quadratic equation
      QUESTIONS[2], // Circular track
      {
        id: 'pq-4',
        section: 'Quantitative Aptitude',
        questionNumber: 4,
        questionText:
          'If a shopkeeper offers a discount of 20% on the marked price of Rs. 1500 and still makes a profit of 25%, what was the cost price of the article?',
        mathLatex: '\\text{SP} = 1500 \\times (1 - 0.20) = 1200, \\quad \\text{CP} = \\frac{1200}{1.25} = 960',
        options: [
          { id: 'pq_opt_1', number: 1, text: 'Rs. 900' },
          { id: 'pq_opt_2', number: 2, text: 'Rs. 960' },
          { id: 'pq_opt_3', number: 3, text: 'Rs. 1000' },
          { id: 'pq_opt_4', number: 4, text: 'Rs. 1050' },
        ],
        correctOption: 2,
        explanation:
          'Discounted Selling Price = 1500 - 20% of 1500 = Rs. 1200. Since Profit = 25%, Selling Price = 1.25 * Cost Price. Cost Price = 1200 / 1.25 = Rs. 960.',
        hint: 'First calculate the selling price after 20% discount on Rs. 1500. Then divide that SP by 1.25 to get the original cost price.',
      },
      {
        id: 'pq-5',
        section: 'Quantitative Aptitude',
        questionNumber: 5,
        questionText:
          'Two pipes A and B can fill a cistern in 12 hours and 15 hours respectively. If both are opened together, how long will they take to fill the tank?',
        mathLatex: '\\frac{1}{T} = \\frac{1}{12} + \\frac{1}{15} = \\frac{5 + 4}{60} = \\frac{9}{60} = \\frac{3}{20}',
        options: [
          { id: 'pq_opt_1', number: 1, text: '6 hours 40 minutes' },
          { id: 'pq_opt_2', number: 2, text: '6 hours 15 minutes' },
          { id: 'pq_opt_3', number: 3, text: '7 hours' },
          { id: 'pq_opt_4', number: 4, text: '7 hours 30 minutes' },
        ],
        correctOption: 1,
        explanation:
          'Combined 1 hour work = 1/12 + 1/15 = 9/60 = 3/20. Total time T = 20/3 hours = 6 hours and (2/3 * 60) minutes = 6 hours 40 minutes.',
        hint: 'Find the LCM of 12 and 15 (which is 60). In 1 hour, pipe A fills 5 units and pipe B fills 4 units, giving 9 units/hr. Divide 60 by 9.',
      },
    ],
  },
  {
    id: 'practice-reasoning-logic',
    code: 'PRACTICE-LR-02',
    title: 'Logical Reasoning: Syllogisms & Seating Drills',
    description:
      'Learn deductive logic, statement-conclusion validity, Venn diagram methodology, and linear seating arrangements with detailed visual explanations.',
    category: 'Staff Selection',
    durationMinutes: 25,
    totalMarks: 20,
    negativeMarking: 'No negative marking (Practice Mode)',
    difficulty: 'Easy',
    sections: ['Logical Reasoning'],
    questions: [
      QUESTIONS[3], // Alphanumeric sequence
      QUESTIONS[4], // Syllogisms mangoes
      {
        id: 'plr-3',
        section: 'Logical Reasoning',
        questionNumber: 3,
        questionText:
          'Statements: Some doctors are teachers. All teachers are counsellors. Conclusions: (I) Some counsellors are doctors. (II) Some counsellors are teachers.',
        options: [
          { id: 'plr_opt_1', number: 1, text: 'Only Conclusion I follows' },
          { id: 'plr_opt_2', number: 2, text: 'Only Conclusion II follows' },
          { id: 'plr_opt_3', number: 3, text: 'Neither Conclusion follows' },
          { id: 'plr_opt_4', number: 4, text: 'Both Conclusions I and II follow' },
        ],
        correctOption: 4,
        explanation:
          'Since all teachers are counsellors, the overlapping area between doctors and teachers is also inside counsellors, so some counsellors are doctors (I holds). Also, because all teachers are counsellors, the subset of counsellors that are teachers is non-empty, so some counsellors are teachers (II holds). Both conclusions follow.',
        hint: 'Draw Venn diagrams: Teachers circle completely inside Counsellors circle. Doctors circle overlaps with Teachers.',
      },
      {
        id: 'plr-4',
        section: 'Logical Reasoning',
        questionNumber: 4,
        questionText:
          'In a code language, if BRAIN is written as CSBJO, how will SIGHT be written in that same code?',
        options: [
          { id: 'plr_opt_1', number: 1, text: 'TJHIU' },
          { id: 'plr_opt_2', number: 2, text: 'TJHGU' },
          { id: 'plr_opt_3', number: 3, text: 'UJHIU' },
          { id: 'plr_opt_4', number: 4, text: 'TJHIW' },
        ],
        correctOption: 1,
        explanation:
          'Each letter is shifted forward by +1: B->C, R->S, A->B, I->J, N->O. Applying +1 to SIGHT: S->T, I->J, G->H, H->I, T->U. Thus, TJHIU is the correct answer.',
        hint: 'Notice the relationship between B and C, R and S. It is a simple +1 alphabetical advance.',
      },
    ],
  },
  {
    id: 'practice-verbal-english',
    code: 'PRACTICE-VA-03',
    title: 'Verbal Ability: Vocabulary & Grammar Master Drill',
    description:
      'Master high-frequency antonyms, subject-verb agreement rules, idioms, sentence correction, and vocabulary comprehension with contextual examples.',
    category: 'Civil Services',
    durationMinutes: 20,
    totalMarks: 20,
    negativeMarking: 'No negative marking (Practice Mode)',
    difficulty: 'Moderate',
    sections: ['Verbal Ability'],
    questions: [
      QUESTIONS[5], // Ephemeral
      QUESTIONS[6], // Subject verb agreement
      {
        id: 'pva-3',
        section: 'Verbal Ability',
        questionNumber: 3,
        questionText:
          'Choose the option that best expresses the meaning of the idiom: "To burn the midnight oil".',
        options: [
          { id: 'pva_opt_1', number: 1, text: 'To cause an accidental fire at night' },
          { id: 'pva_opt_2', number: 2, text: 'To work or study late into the night' },
          { id: 'pva_opt_3', number: 3, text: 'To waste valuable fuel needlessly' },
          { id: 'pva_opt_4', number: 4, text: 'To wake up early before sunrise' },
        ],
        correctOption: 2,
        explanation:
          '"To burn the midnight oil" historically referred to using oil lamps to study or work diligently late into the night.',
        hint: 'Think of hardworking students studying late hours for an examination using oil lamps.',
      },
      {
        id: 'pva-4',
        section: 'Verbal Ability',
        questionNumber: 4,
        questionText:
          'Identify the correctly spelt word among the given options:',
        options: [
          { id: 'pva_opt_1', number: 1, text: 'Accomodation' },
          { id: 'pva_opt_2', number: 2, text: 'Accommodation' },
          { id: 'pva_opt_3', number: 3, text: 'Acommodation' },
          { id: 'pva_opt_4', number: 4, text: 'Accommadation' },
        ],
        correctOption: 2,
        explanation:
          'Accommodation has double "c" and double "m": A-C-C-O-M-M-O-D-A-T-I-O-N.',
        hint: 'Remember the mnemonic: Accommodation has enough room for two Cs and two Ms.',
      },
    ],
  },
  {
    id: 'practice-general-awareness',
    code: 'PRACTICE-GA-04',
    title: 'General Awareness & Digital Accessibility Quiz Drill',
    description:
      'Practice fundamental Indian constitutional provisions, landmark supreme court writs, environmental science, and W3C digital accessibility standards.',
    category: 'Railways',
    durationMinutes: 20,
    totalMarks: 20,
    negativeMarking: 'No negative marking (Practice Mode)',
    difficulty: 'Easy',
    sections: ['General Awareness'],
    questions: [
      QUESTIONS[7], // WCAG
      QUESTIONS[8], // Article 32
      QUESTIONS[9], // Greenhouse
      {
        id: 'pga-4',
        section: 'General Awareness',
        questionNumber: 4,
        questionText:
          'Which Article of the Constitution of India provides for the Right to Education as a Fundamental Right for children aged 6 to 14 years?',
        options: [
          { id: 'pga_opt_1', number: 1, text: 'Article 21A' },
          { id: 'pga_opt_2', number: 2, text: 'Article 19' },
          { id: 'pga_opt_3', number: 3, text: 'Article 45' },
          { id: 'pga_opt_4', number: 4, text: 'Article 51A' },
        ],
        correctOption: 1,
        explanation:
          'Article 21A was inserted by the 86th Constitutional Amendment Act, 2002, making free and compulsory education a fundamental right for children between the ages of 6 and 14.',
        hint: 'It was added as an amendment right beside Article 21 (Protection of Life and Personal Liberty).',
      },
    ],
  },
];
