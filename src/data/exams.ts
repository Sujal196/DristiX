import { QUESTIONS } from './questions';
import type { QuestionItem } from './questions';

export interface Exam {
  id: string;
  code: string;
  title: string;
  description: string;
  category: 'Staff Selection' | 'Banking & Insurance' | 'Civil Services' | 'Railways';
  durationMinutes: number;
  totalMarks: number;
  negativeMarking: string;
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
  sections: string[];
  questions: QuestionItem[];
}

export const EXAM_CATEGORIES = [
  'All',
  'Staff Selection',
  'Banking & Insurance',
  'Civil Services',
  'Railways',
] as const;

export type ExamCategory = (typeof EXAM_CATEGORIES)[number];

export const EXAMS_CATALOG: Exam[] = [
  {
    id: 'ssc-cgl-tier1-full',
    code: 'SSC-CGL-01',
    title: 'SSC CGL Tier-1 Comprehensive Mock Test',
    description:
      'Full-length simulation test covering Quantitative Aptitude, Logical Reasoning, Verbal English Ability, and General Awareness according to the latest SSC CGL examination pattern.',
    category: 'Staff Selection',
    durationMinutes: 60,
    totalMarks: 200,
    negativeMarking: '-0.50 marks per incorrect response',
    difficulty: 'Moderate',
    sections: ['Quantitative Aptitude', 'Logical Reasoning', 'Verbal Ability', 'General Awareness'],
    questions: QUESTIONS,
  },
  {
    id: 'ibps-po-quant-speed',
    code: 'IBPS-PO-02',
    title: 'IBPS PO Quantitative Aptitude Speed Drill',
    description:
      'High-yield mathematical drill covering quadratic equations, arithmetic time-speed-distance, mensuration, and percentages with LaTeX-based mathematical formulas.',
    category: 'Banking & Insurance',
    durationMinutes: 20,
    totalMarks: 35,
    negativeMarking: '-0.25 marks per incorrect response',
    difficulty: 'Challenging',
    sections: ['Quantitative Aptitude'],
    questions: [
      QUESTIONS[0], // Train speed
      QUESTIONS[1], // Quadratic equation
      QUESTIONS[2], // Circular track
      {
        id: 'bank-q-4',
        section: 'Quantitative Aptitude',
        questionNumber: 4,
        questionText:
          'A sum of money invested under compound interest amounts to Rs. 2,420 in 2 years and to Rs. 2,662 in 3 years. Find the annual rate of interest.',
        mathLatex: 'A = P\\left(1 + \\frac{r}{100}\\right)^t',
        options: [
          { id: 'b_opt_1', number: 1, text: '8% per annum' },
          { id: 'b_opt_2', number: 2, text: '10% per annum' },
          { id: 'b_opt_3', number: 3, text: '12% per annum' },
          { id: 'b_opt_4', number: 4, text: '15% per annum' },
        ],
        correctOption: 2,
        explanation:
          'Interest earned in the 3rd year = 2662 - 2420 = Rs. 242. Rate r = (242 / 2420) * 100 = 10% per annum.',
        hint: 'The difference between amounts of two consecutive years is the simple interest on the earlier amount.',
      },
      {
        id: 'bank-q-5',
        section: 'Quantitative Aptitude',
        questionNumber: 5,
        questionText:
          'In what ratio must a grocer mix two varieties of pulses costing Rs. 15 and Rs. 20 per kg respectively, so as to get a mixture worth Rs. 16.50 per kg?',
        mathLatex: '\\frac{q_1}{q_2} = \\frac{20 - 16.50}{16.50 - 15} = \\frac{3.50}{1.50}',
        options: [
          { id: 'b_opt_1', number: 1, text: '3 : 7' },
          { id: 'b_opt_2', number: 2, text: '5 : 7' },
          { id: 'b_opt_3', number: 3, text: '7 : 3' },
          { id: 'b_opt_4', number: 4, text: '7 : 5' },
        ],
        correctOption: 3,
        explanation:
          'By the rule of alligation: (Price of dearer - Mean price) : (Mean price - Price of cheaper) = (20 - 16.50) : (16.50 - 15) = 3.5 : 1.5 = 7 : 3.',
        hint: 'Apply the weighted average or rule of alligation formula.',
      },
    ],
  },
  {
    id: 'upsc-csat-paper2',
    code: 'CSAT-P2-01',
    title: 'UPSC Civil Services CSAT Paper-II Practice Test',
    description:
      'Rigorous aptitude and reasoning test focusing on logical deduction, syllogisms, verbal comprehension, critical reasoning, and analytical decision-making.',
    category: 'Civil Services',
    durationMinutes: 45,
    totalMarks: 100,
    negativeMarking: '-0.83 marks per incorrect response',
    difficulty: 'Challenging',
    sections: ['Logical Reasoning', 'Verbal Ability'],
    questions: [
      QUESTIONS[3], // Alphanumeric sequence
      QUESTIONS[4], // Syllogisms mangoes
      QUESTIONS[5], // Ephemeral antonym
      QUESTIONS[6], // Subject-verb agreement
      {
        id: 'csat-q-5',
        section: 'Logical Reasoning',
        questionNumber: 5,
        questionText:
          'Five friends A, B, C, D, and E are sitting in a row facing North. A is to the immediate left of B. C is to the immediate right of D. E is sitting at the extreme right end. D is between B and C. Who is sitting in the middle?',
        options: [
          { id: 'c_opt_1', number: 1, text: 'A' },
          { id: 'c_opt_2', number: 2, text: 'B' },
          { id: 'c_opt_3', number: 3, text: 'D' },
          { id: 'c_opt_4', number: 4, text: 'C' },
        ],
        correctOption: 3,
        explanation:
          'Arranging according to clues: A is left of B (A, B). D is between B and C (B, D, C). E is at the extreme right. The full seating arrangement from left to right is A, B, D, C, E. The person in the exact middle (3rd position) is D.',
        hint: 'Start with fixed positions: A-B together, then D between B and C, and place E at the far right.',
      },
    ],
  },
  {
    id: 'rrb-ntpc-general',
    code: 'RRB-NTPC-04',
    title: 'Railway RRB NTPC General Awareness & Science Sprint',
    description:
      'Fast-paced general knowledge and digital accessibility test focusing on constitution, national infrastructure, environmental science, and public accessibility standards.',
    category: 'Railways',
    durationMinutes: 25,
    totalMarks: 50,
    negativeMarking: '-0.33 marks per incorrect response',
    difficulty: 'Easy',
    sections: ['General Awareness'],
    questions: [
      QUESTIONS[7], // WCAG contrast ratio
      QUESTIONS[8], // Article 32 Constitution
      QUESTIONS[9], // Green greenhouse gas
      {
        id: 'rrb-q-4',
        section: 'General Awareness',
        questionNumber: 4,
        questionText:
          'Which Indian railway zone is the largest in terms of route kilometer network?',
        options: [
          { id: 'r_opt_1', number: 1, text: 'Western Railway' },
          { id: 'r_opt_2', number: 2, text: 'Northern Railway' },
          { id: 'r_opt_3', number: 3, text: 'Central Railway' },
          { id: 'r_opt_4', number: 4, text: 'Southern Railway' },
        ],
        correctOption: 2,
        explanation:
          'Northern Railway (headquartered at Baroda House, New Delhi) is the largest railway zone in India, operating over 6,800 kilometers of route track.',
        hint: 'This zone has its headquarters in New Delhi and covers Punjab, Haryana, and Uttar Pradesh.',
      },
      {
        id: 'rrb-q-5',
        section: 'General Awareness',
        questionNumber: 5,
        questionText:
          'What is the standard screen-reader landmark role used to designate the main primary content area in accessible web pages?',
        options: [
          { id: 'r_opt_1', number: 1, text: 'role="banner"' },
          { id: 'r_opt_2', number: 2, text: 'role="main"' },
          { id: 'r_opt_3', number: 3, text: 'role="contentinfo"' },
          { id: 'r_opt_4', number: 4, text: 'role="complementary"' },
        ],
        correctOption: 2,
        explanation:
          'role="main" (or the HTML5 <main> tag) designates the central, unique content area of a document, enabling screen reader users to jump directly past headers and navigation.',
        hint: 'Think of the primary tag in HTML5 that encloses everything except header and footer.',
      },
    ],
  },
];
