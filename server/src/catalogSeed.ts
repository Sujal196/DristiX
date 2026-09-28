/**
 * Seed catalog for DristiX.
 *
 * GENERATED FILE — do not edit by hand. It was produced by reading the app's
 * original bundled catalog so the move to the database was lossless.
 *
 * This file deliberately lives on the SERVER. The same questions used to be
 * imported by the frontend store, which put every answer key in the JavaScript
 * bundle where any user could read it. Now they exist only here and in
 * MongoDB, and the browser receives them stripped of correctOption until an
 * attempt is submitted.
 */

export interface SeedQuestion {
  id: string;
  section: string;
  questionNumber: number;
  questionText: string;
  mathLatex: string | null;
  diagramUrl?: string | null;
  diagramType?: string | null;
  diagramDescription?: string | null;
  diagramAiExplanation?: {
    visualBreakdown: string[];
    educationalContext: string;
    keyPoints: string[];
    audioNarration: string;
  } | null;
  options: { id: string; number: number; text: string; mathLatex: string | null }[];
  correctOption: number;
  explanation: string;
  hint: string;
}

export interface SeedExam {
  code: string;
  title: string;
  description: string;
  category: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarking: number;
  difficulty: string;
  published: boolean;
  questions: SeedQuestion[];
}

export const CATALOG_SEED = [
  {
    "code": "SSC-CGL-01",
    "title": "SSC CGL Tier-1 Comprehensive Mock Test",
    "description": "Full-length simulation test covering Quantitative Aptitude, Logical Reasoning, Verbal English Ability, and General Awareness according to the latest SSC CGL examination pattern.",
    "category": "Staff Selection",
    "durationMinutes": 60,
    "totalMarks": 200,
    "negativeMarking": 0.5,
    "difficulty": "Moderate",
    "published": true,
    "questions": [
      {
        "id": "SSC-CGL-01-q1",
        "section": "Quantitative Aptitude",
        "questionNumber": 1,
        "questionText": "A train travelling at 72 km/h crosses a 250 m long platform in 26 seconds. What is the length of the train in metres?",
        "mathLatex": "v = 72 \\text{ km/h} = 72 \\times \\frac{5}{18} = 20 \\text{ m/s}",
        "options": [
          {
            "id": "SSC-CGL-01-q1-o1",
            "number": 1,
            "text": "250 metres",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q1-o2",
            "number": 2,
            "text": "270 metres",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q1-o3",
            "number": 3,
            "text": "300 metres",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q1-o4",
            "number": 4,
            "text": "320 metres",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Speed in m/s = 72 * (5/18) = 20 m/s. Total distance covered in 26 s = speed * time = 20 * 26 = 520 metres. Length of the train = Total distance - Platform length = 520 - 250 = 270 metres.",
        "hint": "First convert the train speed from km/h to m/s by multiplying with 5/18. Then multiply by 26 seconds to get the combined length of the train and platform."
      },
      {
        "id": "SSC-CGL-01-q2",
        "section": "Quantitative Aptitude",
        "questionNumber": 2,
        "questionText": "Solve for the positive root of the quadratic equation given below:",
        "mathLatex": "2x^2 - 7x + 3 = 0",
        "options": [
          {
            "id": "SSC-CGL-01-q2-o1",
            "number": 1,
            "text": "x = 3",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q2-o2",
            "number": 2,
            "text": "x = 4",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q2-o3",
            "number": 3,
            "text": "x = 1/3",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q2-o4",
            "number": 4,
            "text": "x = 5",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "Factorizing: 2x^2 - 6x - x + 3 = 0 -> 2x(x - 3) - 1(x - 3) = 0 -> (2x - 1)(x - 3) = 0. The roots are x = 1/2 and x = 3. Among the choices, x = 3 is the integer positive root.",
        "hint": "Split the middle term -7x into -6x and -x, or use the quadratic formula with a=2, b=-7, and c=3."
      },
      {
        "id": "SSC-CGL-01-q3",
        "section": "Quantitative Aptitude",
        "questionNumber": 3,
        "questionText": "In the triangle ABC shown in the geometry diagram, base AB = 5.8 cm, interior angle A = 60°, and interior angle B = 30°. What is the measure of interior angle C at the top vertex?",
        "mathLatex": "\\angle C = 180^\\circ - (60^\\circ + 30^\\circ) = 90^\\circ",
        "diagramType": "geometry",
        "diagramDescription": "Geometry diagram of triangle ABC. Base AB measures 5.8 cm. Interior angle A at bottom-left is 60 degrees. Interior angle B at bottom-right is 30 degrees. Vertex C is at the top.",
        "diagramUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 280\" width=\"100%\" height=\"100%\"><rect width=\"400\" height=\"280\" fill=\"%23ffffff\" rx=\"16\"/><g stroke=\"%230f172a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"80,220 320,220 180,60\"/><path d=\"M 120 220 A 40 40 0 0 0 105 185\" stroke=\"%232563eb\" stroke-width=\"2.5\"/><path d=\"M 280 220 A 40 40 0 0 1 295 185\" stroke=\"%232563eb\" stroke-width=\"2.5\"/></g><g fill=\"%230f172a\" font-family=\"system-ui, sans-serif\" font-weight=\"bold\"><text x=\"65\" y=\"240\" font-size=\"22\" text-anchor=\"end\">A</text><text x=\"335\" y=\"240\" font-size=\"22\" text-anchor=\"start\">B</text><text x=\"180\" y=\"45\" font-size=\"22\" text-anchor=\"middle\">C</text><text x=\"200\" y=\"255\" font-size=\"18\" text-anchor=\"middle\" fill=\"%231e293b\">5.8 cm</text><text x=\"130\" y=\"210\" font-size=\"16\" fill=\"%231d4ed8\">60°</text><text x=\"260\" y=\"210\" font-size=\"16\" fill=\"%231d4ed8\">30°</text></g></svg>",
        "diagramAiExplanation": {
          "visualBreakdown": [
            "Triangle Vertices: Point A (bottom-left), Point B (bottom-right), Point C (top).",
            "Base Side AB: Labeled with length 5.8 cm at the bottom.",
            "Interior Angles: Angle A is 60° (with blue arc), Angle B is 30° (with blue arc)."
          ],
          "educationalContext": "The diagram displays triangle ABC with base AB = 5.8 cm, Angle A = 60°, and Angle B = 30°. By Angle Sum Property of a triangle, the sum of all interior angles equals 180°. Therefore, Angle C = 180° - (60° + 30°) = 90° (a right angle).",
          "keyPoints": [
            "Base AB = 5.8 cm",
            "Angle A = 60°, Angle B = 30°",
            "Angle C = 180° - (60° + 30°) = 90°"
          ],
          "audioNarration": "Visual geometry diagram: Triangle A B C. Base side A B is 5.8 centimeters long. Interior angle A at bottom left is 60 degrees. Interior angle B at bottom right is 30 degrees. Vertex C is at top. Sum of interior angles is 180 degrees, making top angle C equal to 90 degrees."
        },
        "options": [
          {
            "id": "SSC-CGL-01-q3-o1",
            "number": 1,
            "text": "75 degrees",
            "mathLatex": "75^\\circ"
          },
          {
            "id": "SSC-CGL-01-q3-o2",
            "number": 2,
            "text": "90 degrees",
            "mathLatex": "90^\\circ"
          },
          {
            "id": "SSC-CGL-01-q3-o3",
            "number": 3,
            "text": "100 degrees",
            "mathLatex": "100^\\circ"
          },
          {
            "id": "SSC-CGL-01-q3-o4",
            "number": 4,
            "text": "120 degrees",
            "mathLatex": "120^\\circ"
          }
        ],
        "correctOption": 2,
        "explanation": "Sum of interior angles of a triangle = 180°. Angle C = 180° - (Angle A + Angle B) = 180° - (60° + 30°) = 180° - 90° = 90°.",
        "hint": "Recall that the sum of all three interior angles in any Euclidean triangle is always 180 degrees."
      },
      {
        "id": "SSC-CGL-01-q4",
        "section": "Logical Reasoning",
        "questionNumber": 4,
        "questionText": "Identify the next number in the increasing alphanumeric sequence: B2, D4, F8, H16, ...",
        "mathLatex": null,
        "options": [
          {
            "id": "SSC-CGL-01-q4-o1",
            "number": 1,
            "text": "I32",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q4-o2",
            "number": 2,
            "text": "J32",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q4-o3",
            "number": 3,
            "text": "J24",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q4-o4",
            "number": 4,
            "text": "K32",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Letters skip one position each time: B (+2) -> D (+2) -> F (+2) -> H (+2) -> J. Numbers are powers of 2: 2, 4, 8, 16, 32. Thus, the next term is J32.",
        "hint": "Look at the letters and numbers as two separate patterns: alternate English alphabets and powers of 2."
      },
      {
        "id": "SSC-CGL-01-q5",
        "section": "Logical Reasoning",
        "questionNumber": 5,
        "questionText": "Statements: All mangoes are fruits. Some fruits are sweet. Conclusion I: Some mangoes are sweet. Conclusion II: All fruits are mangoes.",
        "mathLatex": null,
        "options": [
          {
            "id": "SSC-CGL-01-q5-o1",
            "number": 1,
            "text": "Only Conclusion I follows",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q5-o2",
            "number": 2,
            "text": "Only Conclusion II follows",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q5-o3",
            "number": 3,
            "text": "Neither Conclusion I nor II follows",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q5-o4",
            "number": 4,
            "text": "Both Conclusions follow",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "The subset of fruits that are sweet does not necessarily overlap with mangoes. Furthermore, all mangoes being fruits does not imply all fruits are mangoes. Therefore, neither conclusion strictly follows.",
        "hint": "Draw two intersecting Venn diagrams: one circle for mangoes inside fruits, and a second overlapping circle for sweet things touching fruits."
      },
      {
        "id": "SSC-CGL-01-q6",
        "section": "Verbal Ability",
        "questionNumber": 6,
        "questionText": "Choose the word that is most nearly OPPOSITE in meaning (antonym) to the word: EPHEMERAL.",
        "mathLatex": null,
        "options": [
          {
            "id": "SSC-CGL-01-q6-o1",
            "number": 1,
            "text": "Transient",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q6-o2",
            "number": 2,
            "text": "Permanent",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q6-o3",
            "number": 3,
            "text": "Fleeting",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q6-o4",
            "number": 4,
            "text": "Delicate",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Ephemeral means lasting for a very short time (transient, fleeting). The exact antonym is Permanent, meaning lasting indefinitely.",
        "hint": "Ephemeral describes things like morning dew or shooting stars that disappear quickly."
      },
      {
        "id": "SSC-CGL-01-q7",
        "section": "Verbal Ability",
        "questionNumber": 7,
        "questionText": "Select the grammatically correct sentence among the four options:",
        "mathLatex": null,
        "options": [
          {
            "id": "SSC-CGL-01-q7-o1",
            "number": 1,
            "text": "Neither the candidate nor the invigilators was present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q7-o2",
            "number": 2,
            "text": "Neither the candidate nor the invigilators were present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q7-o3",
            "number": 3,
            "text": "Neither the candidate or the invigilators were present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q7-o4",
            "number": 4,
            "text": "Neither the candidate nor the invigilators has been present in the examination hall.",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "When subjects are joined by \"neither... nor\", the verb agrees with the subject closest to it. Here \"invigilators\" is plural, so the plural verb \"were\" is required.",
        "hint": "Rule of proximity: with \"neither... nor\", look at the noun immediately before the verb."
      },
      {
        "id": "SSC-CGL-01-q8",
        "section": "General Awareness",
        "questionNumber": 8,
        "questionText": "Under the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, what is the minimum required contrast ratio for normal body text against its background?",
        "mathLatex": null,
        "options": [
          {
            "id": "SSC-CGL-01-q8-o1",
            "number": 1,
            "text": "3:1",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q8-o2",
            "number": 2,
            "text": "4.5:1",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q8-o3",
            "number": 3,
            "text": "7:1",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q8-o4",
            "number": 4,
            "text": "10:1",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum - Level AA) requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large-scale text (18pt or 14pt bold). Level AAA requires 7:1.",
        "hint": "Level AA requires a ratio between 4:1 and 5:1 for regular text."
      },
      {
        "id": "SSC-CGL-01-q9",
        "section": "General Awareness",
        "questionNumber": 9,
        "questionText": "Which HTML5 attribute informs assistive technologies that a dynamic section of the page has updated without shifting keyboard focus?",
        "mathLatex": null,
        "options": [
          {
            "id": "SSC-CGL-01-q9-o1",
            "number": 1,
            "text": "aria-live",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q9-o2",
            "number": 2,
            "text": "aria-hidden",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q9-o3",
            "number": 3,
            "text": "tabindex=\"0\"",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q9-o4",
            "number": 4,
            "text": "role=\"presentation\"",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "The aria-live attribute (with values polite or assertive) marks an area as a live region so screen readers automatically announce dynamic content changes without moving focus.",
        "hint": "Look for the ARIA attribute whose name implies that the content is active and \"living\"."
      },
      {
        "id": "SSC-CGL-01-q10",
        "section": "Quantitative Aptitude",
        "questionNumber": 10,
        "questionText": "If the hypotenuse of a right-angled triangle is 13 cm and one of the legs is 5 cm, find the length of the other leg using the Pythagorean theorem:",
        "mathLatex": "a^2 + b^2 = c^2 \\implies 5^2 + b^2 = 13^2",
        "options": [
          {
            "id": "SSC-CGL-01-q10-o1",
            "number": 1,
            "text": "8 cm",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q10-o2",
            "number": 2,
            "text": "10 cm",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q10-o3",
            "number": 3,
            "text": "12 cm",
            "mathLatex": null
          },
          {
            "id": "SSC-CGL-01-q10-o4",
            "number": 4,
            "text": "14 cm",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "Using Pythagorean theorem: b^2 = 13^2 - 5^2 = 169 - 25 = 144. Therefore, b = sqrt(144) = 12 cm.",
        "hint": "13 squared is 169 and 5 squared is 25. Subtract 25 from 169 and find the square root."
      }
    ]
  },
  {
    "code": "IBPS-PO-02",
    "title": "IBPS PO Quantitative Aptitude Speed Drill",
    "description": "High-yield mathematical drill covering quadratic equations, arithmetic time-speed-distance, mensuration, and percentages with LaTeX-based mathematical formulas.",
    "category": "Banking & Insurance",
    "durationMinutes": 20,
    "totalMarks": 35,
    "negativeMarking": 0.25,
    "difficulty": "Challenging",
    "published": true,
    "questions": [
      {
        "id": "IBPS-PO-02-q1",
        "section": "Quantitative Aptitude",
        "questionNumber": 1,
        "questionText": "A train travelling at 72 km/h crosses a 250 m long platform in 26 seconds. What is the length of the train in metres?",
        "mathLatex": "v = 72 \\text{ km/h} = 72 \\times \\frac{5}{18} = 20 \\text{ m/s}",
        "options": [
          {
            "id": "IBPS-PO-02-q1-o1",
            "number": 1,
            "text": "250 metres",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q1-o2",
            "number": 2,
            "text": "270 metres",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q1-o3",
            "number": 3,
            "text": "300 metres",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q1-o4",
            "number": 4,
            "text": "320 metres",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Speed in m/s = 72 * (5/18) = 20 m/s. Total distance covered in 26 s = speed * time = 20 * 26 = 520 metres. Length of the train = Total distance - Platform length = 520 - 250 = 270 metres.",
        "hint": "First convert the train speed from km/h to m/s by multiplying with 5/18. Then multiply by 26 seconds to get the combined length of the train and platform."
      },
      {
        "id": "IBPS-PO-02-q2",
        "section": "Quantitative Aptitude",
        "questionNumber": 2,
        "questionText": "Solve for the positive root of the quadratic equation given below:",
        "mathLatex": "2x^2 - 7x + 3 = 0",
        "options": [
          {
            "id": "IBPS-PO-02-q2-o1",
            "number": 1,
            "text": "x = 3",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q2-o2",
            "number": 2,
            "text": "x = 4",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q2-o3",
            "number": 3,
            "text": "x = 1/3",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q2-o4",
            "number": 4,
            "text": "x = 5",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "Factorizing: 2x^2 - 6x - x + 3 = 0 -> 2x(x - 3) - 1(x - 3) = 0 -> (2x - 1)(x - 3) = 0. The roots are x = 1/2 and x = 3. Among the choices, x = 3 is the integer positive root.",
        "hint": "Split the middle term -7x into -6x and -x, or use the quadratic formula with a=2, b=-7, and c=3."
      },
      {
        "id": "IBPS-PO-02-q3",
        "section": "Quantitative Aptitude",
        "questionNumber": 3,
        "questionText": "A circular running track has a radius of 14 metres. If a runner completes 5 full laps, what is the total distance covered in metres? (Take pi = 22/7)",
        "mathLatex": "C = 2\\pi r = 2 \\times \\frac{22}{7} \\times 14",
        "options": [
          {
            "id": "IBPS-PO-02-q3-o1",
            "number": 1,
            "text": "352 metres",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q3-o2",
            "number": 2,
            "text": "440 metres",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q3-o3",
            "number": 3,
            "text": "528 metres",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q3-o4",
            "number": 4,
            "text": "616 metres",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Circumference of track C = 2 * (22/7) * 14 = 88 metres. Total distance for 5 laps = 5 * 88 = 440 metres.",
        "hint": "Recall the formula for circumference of a circle: C = 2 * pi * r. Multiply the single-lap circumference by 5."
      },
      {
        "id": "IBPS-PO-02-q4",
        "section": "Quantitative Aptitude",
        "questionNumber": 4,
        "questionText": "A sum of money invested under compound interest amounts to Rs. 2,420 in 2 years and to Rs. 2,662 in 3 years. Find the annual rate of interest.",
        "mathLatex": "A = P\\left(1 + \\frac{r}{100}\\right)^t",
        "options": [
          {
            "id": "IBPS-PO-02-q4-o1",
            "number": 1,
            "text": "8% per annum",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q4-o2",
            "number": 2,
            "text": "10% per annum",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q4-o3",
            "number": 3,
            "text": "12% per annum",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q4-o4",
            "number": 4,
            "text": "15% per annum",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Interest earned in the 3rd year = 2662 - 2420 = Rs. 242. Rate r = (242 / 2420) * 100 = 10% per annum.",
        "hint": "The difference between amounts of two consecutive years is the simple interest on the earlier amount."
      },
      {
        "id": "IBPS-PO-02-q5",
        "section": "Quantitative Aptitude",
        "questionNumber": 5,
        "questionText": "In what ratio must a grocer mix two varieties of pulses costing Rs. 15 and Rs. 20 per kg respectively, so as to get a mixture worth Rs. 16.50 per kg?",
        "mathLatex": "\\frac{q_1}{q_2} = \\frac{20 - 16.50}{16.50 - 15} = \\frac{3.50}{1.50}",
        "options": [
          {
            "id": "IBPS-PO-02-q5-o1",
            "number": 1,
            "text": "3 : 7",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q5-o2",
            "number": 2,
            "text": "5 : 7",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q5-o3",
            "number": 3,
            "text": "7 : 3",
            "mathLatex": null
          },
          {
            "id": "IBPS-PO-02-q5-o4",
            "number": 4,
            "text": "7 : 5",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "By the rule of alligation: (Price of dearer - Mean price) : (Mean price - Price of cheaper) = (20 - 16.50) : (16.50 - 15) = 3.5 : 1.5 = 7 : 3.",
        "hint": "Apply the weighted average or rule of alligation formula."
      }
    ]
  },
  {
    "code": "CSAT-P2-01",
    "title": "UPSC Civil Services CSAT Paper-II Practice Test",
    "description": "Rigorous aptitude and reasoning test focusing on logical deduction, syllogisms, verbal comprehension, critical reasoning, and analytical decision-making.",
    "category": "Civil Services",
    "durationMinutes": 45,
    "totalMarks": 100,
    "negativeMarking": 0.83,
    "difficulty": "Challenging",
    "published": true,
    "questions": [
      {
        "id": "CSAT-P2-01-q1",
        "section": "Logical Reasoning",
        "questionNumber": 1,
        "questionText": "Identify the next number in the increasing alphanumeric sequence: B2, D4, F8, H16, ...",
        "mathLatex": null,
        "options": [
          {
            "id": "CSAT-P2-01-q1-o1",
            "number": 1,
            "text": "I32",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q1-o2",
            "number": 2,
            "text": "J32",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q1-o3",
            "number": 3,
            "text": "J24",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q1-o4",
            "number": 4,
            "text": "K32",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Letters skip one position each time: B (+2) -> D (+2) -> F (+2) -> H (+2) -> J. Numbers are powers of 2: 2, 4, 8, 16, 32. Thus, the next term is J32.",
        "hint": "Look at the letters and numbers as two separate patterns: alternate English alphabets and powers of 2."
      },
      {
        "id": "CSAT-P2-01-q2",
        "section": "Logical Reasoning",
        "questionNumber": 2,
        "questionText": "Statements: All mangoes are fruits. Some fruits are sweet. Conclusion I: Some mangoes are sweet. Conclusion II: All fruits are mangoes.",
        "mathLatex": null,
        "options": [
          {
            "id": "CSAT-P2-01-q2-o1",
            "number": 1,
            "text": "Only Conclusion I follows",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q2-o2",
            "number": 2,
            "text": "Only Conclusion II follows",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q2-o3",
            "number": 3,
            "text": "Neither Conclusion I nor II follows",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q2-o4",
            "number": 4,
            "text": "Both Conclusions follow",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "The subset of fruits that are sweet does not necessarily overlap with mangoes. Furthermore, all mangoes being fruits does not imply all fruits are mangoes. Therefore, neither conclusion strictly follows.",
        "hint": "Draw two intersecting Venn diagrams: one circle for mangoes inside fruits, and a second overlapping circle for sweet things touching fruits."
      },
      {
        "id": "CSAT-P2-01-q3",
        "section": "Verbal Ability",
        "questionNumber": 3,
        "questionText": "Choose the word that is most nearly OPPOSITE in meaning (antonym) to the word: EPHEMERAL.",
        "mathLatex": null,
        "options": [
          {
            "id": "CSAT-P2-01-q3-o1",
            "number": 1,
            "text": "Transient",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q3-o2",
            "number": 2,
            "text": "Permanent",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q3-o3",
            "number": 3,
            "text": "Fleeting",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q3-o4",
            "number": 4,
            "text": "Delicate",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Ephemeral means lasting for a very short time (transient, fleeting). The exact antonym is Permanent, meaning lasting indefinitely.",
        "hint": "Ephemeral describes things like morning dew or shooting stars that disappear quickly."
      },
      {
        "id": "CSAT-P2-01-q4",
        "section": "Verbal Ability",
        "questionNumber": 4,
        "questionText": "Select the grammatically correct sentence among the four options:",
        "mathLatex": null,
        "options": [
          {
            "id": "CSAT-P2-01-q4-o1",
            "number": 1,
            "text": "Neither the candidate nor the invigilators was present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q4-o2",
            "number": 2,
            "text": "Neither the candidate nor the invigilators were present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q4-o3",
            "number": 3,
            "text": "Neither the candidate or the invigilators were present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q4-o4",
            "number": 4,
            "text": "Neither the candidate nor the invigilators has been present in the examination hall.",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "When subjects are joined by \"neither... nor\", the verb agrees with the subject closest to it. Here \"invigilators\" is plural, so the plural verb \"were\" is required.",
        "hint": "Rule of proximity: with \"neither... nor\", look at the noun immediately before the verb."
      },
      {
        "id": "CSAT-P2-01-q5",
        "section": "Logical Reasoning",
        "questionNumber": 5,
        "questionText": "Five friends A, B, C, D, and E are sitting in a row facing North. A is to the immediate left of B. C is to the immediate right of D. E is sitting at the extreme right end. D is between B and C. Who is sitting in the middle?",
        "mathLatex": null,
        "options": [
          {
            "id": "CSAT-P2-01-q5-o1",
            "number": 1,
            "text": "A",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q5-o2",
            "number": 2,
            "text": "B",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q5-o3",
            "number": 3,
            "text": "D",
            "mathLatex": null
          },
          {
            "id": "CSAT-P2-01-q5-o4",
            "number": 4,
            "text": "C",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "Arranging according to clues: A is left of B (A, B). D is between B and C (B, D, C). E is at the extreme right. The full seating arrangement from left to right is A, B, D, C, E. The person in the exact middle (3rd position) is D.",
        "hint": "Start with fixed positions: A-B together, then D between B and C, and place E at the far right."
      }
    ]
  },
  {
    "code": "RRB-NTPC-04",
    "title": "Railway RRB NTPC General Awareness & Science Sprint",
    "description": "Fast-paced general knowledge and digital accessibility test focusing on constitution, national infrastructure, environmental science, and public accessibility standards.",
    "category": "Railways",
    "durationMinutes": 25,
    "totalMarks": 50,
    "negativeMarking": 0.33,
    "difficulty": "Easy",
    "published": true,
    "questions": [
      {
        "id": "RRB-NTPC-04-q1",
        "section": "General Awareness",
        "questionNumber": 1,
        "questionText": "Under the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, what is the minimum required contrast ratio for normal body text against its background?",
        "mathLatex": null,
        "options": [
          {
            "id": "RRB-NTPC-04-q1-o1",
            "number": 1,
            "text": "3:1",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q1-o2",
            "number": 2,
            "text": "4.5:1",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q1-o3",
            "number": 3,
            "text": "7:1",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q1-o4",
            "number": 4,
            "text": "10:1",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum - Level AA) requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large-scale text (18pt or 14pt bold). Level AAA requires 7:1.",
        "hint": "Level AA requires a ratio between 4:1 and 5:1 for regular text."
      },
      {
        "id": "RRB-NTPC-04-q2",
        "section": "General Awareness",
        "questionNumber": 2,
        "questionText": "Which HTML5 attribute informs assistive technologies that a dynamic section of the page has updated without shifting keyboard focus?",
        "mathLatex": null,
        "options": [
          {
            "id": "RRB-NTPC-04-q2-o1",
            "number": 1,
            "text": "aria-live",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q2-o2",
            "number": 2,
            "text": "aria-hidden",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q2-o3",
            "number": 3,
            "text": "tabindex=\"0\"",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q2-o4",
            "number": 4,
            "text": "role=\"presentation\"",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "The aria-live attribute (with values polite or assertive) marks an area as a live region so screen readers automatically announce dynamic content changes without moving focus.",
        "hint": "Look for the ARIA attribute whose name implies that the content is active and \"living\"."
      },
      {
        "id": "RRB-NTPC-04-q3",
        "section": "Quantitative Aptitude",
        "questionNumber": 3,
        "questionText": "If the hypotenuse of a right-angled triangle is 13 cm and one of the legs is 5 cm, find the length of the other leg using the Pythagorean theorem:",
        "mathLatex": "a^2 + b^2 = c^2 \\implies 5^2 + b^2 = 13^2",
        "options": [
          {
            "id": "RRB-NTPC-04-q3-o1",
            "number": 1,
            "text": "8 cm",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q3-o2",
            "number": 2,
            "text": "10 cm",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q3-o3",
            "number": 3,
            "text": "12 cm",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q3-o4",
            "number": 4,
            "text": "14 cm",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "Using Pythagorean theorem: b^2 = 13^2 - 5^2 = 169 - 25 = 144. Therefore, b = sqrt(144) = 12 cm.",
        "hint": "13 squared is 169 and 5 squared is 25. Subtract 25 from 169 and find the square root."
      },
      {
        "id": "RRB-NTPC-04-q4",
        "section": "General Awareness",
        "questionNumber": 4,
        "questionText": "Which Indian railway zone is the largest in terms of route kilometer network?",
        "mathLatex": null,
        "options": [
          {
            "id": "RRB-NTPC-04-q4-o1",
            "number": 1,
            "text": "Western Railway",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q4-o2",
            "number": 2,
            "text": "Northern Railway",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q4-o3",
            "number": 3,
            "text": "Central Railway",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q4-o4",
            "number": 4,
            "text": "Southern Railway",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Northern Railway (headquartered at Baroda House, New Delhi) is the largest railway zone in India, operating over 6,800 kilometers of route track.",
        "hint": "This zone has its headquarters in New Delhi and covers Punjab, Haryana, and Uttar Pradesh."
      },
      {
        "id": "RRB-NTPC-04-q5",
        "section": "General Awareness",
        "questionNumber": 5,
        "questionText": "What is the standard screen-reader landmark role used to designate the main primary content area in accessible web pages?",
        "mathLatex": null,
        "options": [
          {
            "id": "RRB-NTPC-04-q5-o1",
            "number": 1,
            "text": "role=\"banner\"",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q5-o2",
            "number": 2,
            "text": "role=\"main\"",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q5-o3",
            "number": 3,
            "text": "role=\"contentinfo\"",
            "mathLatex": null
          },
          {
            "id": "RRB-NTPC-04-q5-o4",
            "number": 4,
            "text": "role=\"complementary\"",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "role=\"main\" (or the HTML5 <main> tag) designates the central, unique content area of a document, enabling screen reader users to jump directly past headers and navigation.",
        "hint": "Think of the primary tag in HTML5 that encloses everything except header and footer."
      }
    ]
  },
  {
    "code": "PRACTICE-QA-01",
    "title": "Quantitative Aptitude: Arithmetic & Algebra Practice Drill",
    "description": "Step-by-step math practice focusing on speed calculations, quadratic factorizations, circumference mensuration, and percentages with instant hints and formula derivations.",
    "category": "Banking & Insurance",
    "durationMinutes": 30,
    "totalMarks": 25,
    "negativeMarking": 0,
    "difficulty": "Moderate",
    "published": true,
    "questions": [
      {
        "id": "PRACTICE-QA-01-q1",
        "section": "Quantitative Aptitude",
        "questionNumber": 1,
        "questionText": "A train travelling at 72 km/h crosses a 250 m long platform in 26 seconds. What is the length of the train in metres?",
        "mathLatex": "v = 72 \\text{ km/h} = 72 \\times \\frac{5}{18} = 20 \\text{ m/s}",
        "options": [
          {
            "id": "PRACTICE-QA-01-q1-o1",
            "number": 1,
            "text": "250 metres",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q1-o2",
            "number": 2,
            "text": "270 metres",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q1-o3",
            "number": 3,
            "text": "300 metres",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q1-o4",
            "number": 4,
            "text": "320 metres",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Speed in m/s = 72 * (5/18) = 20 m/s. Total distance covered in 26 s = speed * time = 20 * 26 = 520 metres. Length of the train = Total distance - Platform length = 520 - 250 = 270 metres.",
        "hint": "First convert the train speed from km/h to m/s by multiplying with 5/18. Then multiply by 26 seconds to get the combined length of the train and platform."
      },
      {
        "id": "PRACTICE-QA-01-q2",
        "section": "Quantitative Aptitude",
        "questionNumber": 2,
        "questionText": "Solve for the positive root of the quadratic equation given below:",
        "mathLatex": "2x^2 - 7x + 3 = 0",
        "options": [
          {
            "id": "PRACTICE-QA-01-q2-o1",
            "number": 1,
            "text": "x = 3",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q2-o2",
            "number": 2,
            "text": "x = 4",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q2-o3",
            "number": 3,
            "text": "x = 1/3",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q2-o4",
            "number": 4,
            "text": "x = 5",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "Factorizing: 2x^2 - 6x - x + 3 = 0 -> 2x(x - 3) - 1(x - 3) = 0 -> (2x - 1)(x - 3) = 0. The roots are x = 1/2 and x = 3. Among the choices, x = 3 is the integer positive root.",
        "hint": "Split the middle term -7x into -6x and -x, or use the quadratic formula with a=2, b=-7, and c=3."
      },
      {
        "id": "PRACTICE-QA-01-q3",
        "section": "Quantitative Aptitude",
        "questionNumber": 3,
        "questionText": "A circular running track has a radius of 14 metres. If a runner completes 5 full laps, what is the total distance covered in metres? (Take pi = 22/7)",
        "mathLatex": "C = 2\\pi r = 2 \\times \\frac{22}{7} \\times 14",
        "options": [
          {
            "id": "PRACTICE-QA-01-q3-o1",
            "number": 1,
            "text": "352 metres",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q3-o2",
            "number": 2,
            "text": "440 metres",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q3-o3",
            "number": 3,
            "text": "528 metres",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q3-o4",
            "number": 4,
            "text": "616 metres",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Circumference of track C = 2 * (22/7) * 14 = 88 metres. Total distance for 5 laps = 5 * 88 = 440 metres.",
        "hint": "Recall the formula for circumference of a circle: C = 2 * pi * r. Multiply the single-lap circumference by 5."
      },
      {
        "id": "PRACTICE-QA-01-q4",
        "section": "Quantitative Aptitude",
        "questionNumber": 4,
        "questionText": "If a shopkeeper offers a discount of 20% on the marked price of Rs. 1500 and still makes a profit of 25%, what was the cost price of the article?",
        "mathLatex": "\\text{SP} = 1500 \\times (1 - 0.20) = 1200, \\quad \\text{CP} = \\frac{1200}{1.25} = 960",
        "options": [
          {
            "id": "PRACTICE-QA-01-q4-o1",
            "number": 1,
            "text": "Rs. 900",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q4-o2",
            "number": 2,
            "text": "Rs. 960",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q4-o3",
            "number": 3,
            "text": "Rs. 1000",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q4-o4",
            "number": 4,
            "text": "Rs. 1050",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Discounted Selling Price = 1500 - 20% of 1500 = Rs. 1200. Since Profit = 25%, Selling Price = 1.25 * Cost Price. Cost Price = 1200 / 1.25 = Rs. 960.",
        "hint": "First calculate the selling price after 20% discount on Rs. 1500. Then divide that SP by 1.25 to get the original cost price."
      },
      {
        "id": "PRACTICE-QA-01-q5",
        "section": "Quantitative Aptitude",
        "questionNumber": 5,
        "questionText": "Two pipes A and B can fill a cistern in 12 hours and 15 hours respectively. If both are opened together, how long will they take to fill the tank?",
        "mathLatex": "\\frac{1}{T} = \\frac{1}{12} + \\frac{1}{15} = \\frac{5 + 4}{60} = \\frac{9}{60} = \\frac{3}{20}",
        "options": [
          {
            "id": "PRACTICE-QA-01-q5-o1",
            "number": 1,
            "text": "6 hours 40 minutes",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q5-o2",
            "number": 2,
            "text": "6 hours 15 minutes",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q5-o3",
            "number": 3,
            "text": "7 hours",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-QA-01-q5-o4",
            "number": 4,
            "text": "7 hours 30 minutes",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "Combined 1 hour work = 1/12 + 1/15 = 9/60 = 3/20. Total time T = 20/3 hours = 6 hours and (2/3 * 60) minutes = 6 hours 40 minutes.",
        "hint": "Find the LCM of 12 and 15 (which is 60). In 1 hour, pipe A fills 5 units and pipe B fills 4 units, giving 9 units/hr. Divide 60 by 9."
      }
    ]
  },
  {
    "code": "PRACTICE-LR-02",
    "title": "Logical Reasoning: Syllogisms & Seating Drills",
    "description": "Learn deductive logic, statement-conclusion validity, Venn diagram methodology, and linear seating arrangements with detailed visual explanations.",
    "category": "Staff Selection",
    "durationMinutes": 25,
    "totalMarks": 20,
    "negativeMarking": 0,
    "difficulty": "Easy",
    "published": true,
    "questions": [
      {
        "id": "PRACTICE-LR-02-q1",
        "section": "Logical Reasoning",
        "questionNumber": 1,
        "questionText": "Identify the next number in the increasing alphanumeric sequence: B2, D4, F8, H16, ...",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-LR-02-q1-o1",
            "number": 1,
            "text": "I32",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q1-o2",
            "number": 2,
            "text": "J32",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q1-o3",
            "number": 3,
            "text": "J24",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q1-o4",
            "number": 4,
            "text": "K32",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Letters skip one position each time: B (+2) -> D (+2) -> F (+2) -> H (+2) -> J. Numbers are powers of 2: 2, 4, 8, 16, 32. Thus, the next term is J32.",
        "hint": "Look at the letters and numbers as two separate patterns: alternate English alphabets and powers of 2."
      },
      {
        "id": "PRACTICE-LR-02-q2",
        "section": "Logical Reasoning",
        "questionNumber": 2,
        "questionText": "Statements: All mangoes are fruits. Some fruits are sweet. Conclusion I: Some mangoes are sweet. Conclusion II: All fruits are mangoes.",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-LR-02-q2-o1",
            "number": 1,
            "text": "Only Conclusion I follows",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q2-o2",
            "number": 2,
            "text": "Only Conclusion II follows",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q2-o3",
            "number": 3,
            "text": "Neither Conclusion I nor II follows",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q2-o4",
            "number": 4,
            "text": "Both Conclusions follow",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "The subset of fruits that are sweet does not necessarily overlap with mangoes. Furthermore, all mangoes being fruits does not imply all fruits are mangoes. Therefore, neither conclusion strictly follows.",
        "hint": "Draw two intersecting Venn diagrams: one circle for mangoes inside fruits, and a second overlapping circle for sweet things touching fruits."
      },
      {
        "id": "PRACTICE-LR-02-q3",
        "section": "Logical Reasoning",
        "questionNumber": 3,
        "questionText": "Statements: Some doctors are teachers. All teachers are counsellors. Conclusions: (I) Some counsellors are doctors. (II) Some counsellors are teachers.",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-LR-02-q3-o1",
            "number": 1,
            "text": "Only Conclusion I follows",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q3-o2",
            "number": 2,
            "text": "Only Conclusion II follows",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q3-o3",
            "number": 3,
            "text": "Neither Conclusion follows",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q3-o4",
            "number": 4,
            "text": "Both Conclusions I and II follow",
            "mathLatex": null
          }
        ],
        "correctOption": 4,
        "explanation": "Since all teachers are counsellors, the overlapping area between doctors and teachers is also inside counsellors, so some counsellors are doctors (I holds). Also, because all teachers are counsellors, the subset of counsellors that are teachers is non-empty, so some counsellors are teachers (II holds). Both conclusions follow.",
        "hint": "Draw Venn diagrams: Teachers circle completely inside Counsellors circle. Doctors circle overlaps with Teachers."
      },
      {
        "id": "PRACTICE-LR-02-q4",
        "section": "Logical Reasoning",
        "questionNumber": 4,
        "questionText": "In a code language, if BRAIN is written as CSBJO, how will SIGHT be written in that same code?",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-LR-02-q4-o1",
            "number": 1,
            "text": "TJHIU",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q4-o2",
            "number": 2,
            "text": "TJHGU",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q4-o3",
            "number": 3,
            "text": "UJHIU",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-LR-02-q4-o4",
            "number": 4,
            "text": "TJHIW",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "Each letter is shifted forward by +1: B->C, R->S, A->B, I->J, N->O. Applying +1 to SIGHT: S->T, I->J, G->H, H->I, T->U. Thus, TJHIU is the correct answer.",
        "hint": "Notice the relationship between B and C, R and S. It is a simple +1 alphabetical advance."
      }
    ]
  },
  {
    "code": "PRACTICE-VA-03",
    "title": "Verbal Ability: Vocabulary & Grammar Master Drill",
    "description": "Master high-frequency antonyms, subject-verb agreement rules, idioms, sentence correction, and vocabulary comprehension with contextual examples.",
    "category": "Civil Services",
    "durationMinutes": 20,
    "totalMarks": 20,
    "negativeMarking": 0,
    "difficulty": "Moderate",
    "published": true,
    "questions": [
      {
        "id": "PRACTICE-VA-03-q1",
        "section": "Verbal Ability",
        "questionNumber": 1,
        "questionText": "Choose the word that is most nearly OPPOSITE in meaning (antonym) to the word: EPHEMERAL.",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-VA-03-q1-o1",
            "number": 1,
            "text": "Transient",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q1-o2",
            "number": 2,
            "text": "Permanent",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q1-o3",
            "number": 3,
            "text": "Fleeting",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q1-o4",
            "number": 4,
            "text": "Delicate",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Ephemeral means lasting for a very short time (transient, fleeting). The exact antonym is Permanent, meaning lasting indefinitely.",
        "hint": "Ephemeral describes things like morning dew or shooting stars that disappear quickly."
      },
      {
        "id": "PRACTICE-VA-03-q2",
        "section": "Verbal Ability",
        "questionNumber": 2,
        "questionText": "Select the grammatically correct sentence among the four options:",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-VA-03-q2-o1",
            "number": 1,
            "text": "Neither the candidate nor the invigilators was present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q2-o2",
            "number": 2,
            "text": "Neither the candidate nor the invigilators were present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q2-o3",
            "number": 3,
            "text": "Neither the candidate or the invigilators were present in the examination hall.",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q2-o4",
            "number": 4,
            "text": "Neither the candidate nor the invigilators has been present in the examination hall.",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "When subjects are joined by \"neither... nor\", the verb agrees with the subject closest to it. Here \"invigilators\" is plural, so the plural verb \"were\" is required.",
        "hint": "Rule of proximity: with \"neither... nor\", look at the noun immediately before the verb."
      },
      {
        "id": "PRACTICE-VA-03-q3",
        "section": "Verbal Ability",
        "questionNumber": 3,
        "questionText": "Choose the option that best expresses the meaning of the idiom: \"To burn the midnight oil\".",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-VA-03-q3-o1",
            "number": 1,
            "text": "To cause an accidental fire at night",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q3-o2",
            "number": 2,
            "text": "To work or study late into the night",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q3-o3",
            "number": 3,
            "text": "To waste valuable fuel needlessly",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q3-o4",
            "number": 4,
            "text": "To wake up early before sunrise",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "\"To burn the midnight oil\" historically referred to using oil lamps to study or work diligently late into the night.",
        "hint": "Think of hardworking students studying late hours for an examination using oil lamps."
      },
      {
        "id": "PRACTICE-VA-03-q4",
        "section": "Verbal Ability",
        "questionNumber": 4,
        "questionText": "Identify the correctly spelt word among the given options:",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-VA-03-q4-o1",
            "number": 1,
            "text": "Accomodation",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q4-o2",
            "number": 2,
            "text": "Accommodation",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q4-o3",
            "number": 3,
            "text": "Acommodation",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-VA-03-q4-o4",
            "number": 4,
            "text": "Accommadation",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "Accommodation has double \"c\" and double \"m\": A-C-C-O-M-M-O-D-A-T-I-O-N.",
        "hint": "Remember the mnemonic: Accommodation has enough room for two Cs and two Ms."
      }
    ]
  },
  {
    "code": "PRACTICE-GA-04",
    "title": "General Awareness & Digital Accessibility Quiz Drill",
    "description": "Practice fundamental Indian constitutional provisions, landmark supreme court writs, environmental science, and W3C digital accessibility standards.",
    "category": "Railways",
    "durationMinutes": 20,
    "totalMarks": 20,
    "negativeMarking": 0,
    "difficulty": "Easy",
    "published": true,
    "questions": [
      {
        "id": "PRACTICE-GA-04-q1",
        "section": "General Awareness",
        "questionNumber": 1,
        "questionText": "Under the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, what is the minimum required contrast ratio for normal body text against its background?",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-GA-04-q1-o1",
            "number": 1,
            "text": "3:1",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q1-o2",
            "number": 2,
            "text": "4.5:1",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q1-o3",
            "number": 3,
            "text": "7:1",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q1-o4",
            "number": 4,
            "text": "10:1",
            "mathLatex": null
          }
        ],
        "correctOption": 2,
        "explanation": "WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum - Level AA) requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large-scale text (18pt or 14pt bold). Level AAA requires 7:1.",
        "hint": "Level AA requires a ratio between 4:1 and 5:1 for regular text."
      },
      {
        "id": "PRACTICE-GA-04-q2",
        "section": "General Awareness",
        "questionNumber": 2,
        "questionText": "Which HTML5 attribute informs assistive technologies that a dynamic section of the page has updated without shifting keyboard focus?",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-GA-04-q2-o1",
            "number": 1,
            "text": "aria-live",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q2-o2",
            "number": 2,
            "text": "aria-hidden",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q2-o3",
            "number": 3,
            "text": "tabindex=\"0\"",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q2-o4",
            "number": 4,
            "text": "role=\"presentation\"",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "The aria-live attribute (with values polite or assertive) marks an area as a live region so screen readers automatically announce dynamic content changes without moving focus.",
        "hint": "Look for the ARIA attribute whose name implies that the content is active and \"living\"."
      },
      {
        "id": "PRACTICE-GA-04-q3",
        "section": "Quantitative Aptitude",
        "questionNumber": 3,
        "questionText": "If the hypotenuse of a right-angled triangle is 13 cm and one of the legs is 5 cm, find the length of the other leg using the Pythagorean theorem:",
        "mathLatex": "a^2 + b^2 = c^2 \\implies 5^2 + b^2 = 13^2",
        "options": [
          {
            "id": "PRACTICE-GA-04-q3-o1",
            "number": 1,
            "text": "8 cm",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q3-o2",
            "number": 2,
            "text": "10 cm",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q3-o3",
            "number": 3,
            "text": "12 cm",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q3-o4",
            "number": 4,
            "text": "14 cm",
            "mathLatex": null
          }
        ],
        "correctOption": 3,
        "explanation": "Using Pythagorean theorem: b^2 = 13^2 - 5^2 = 169 - 25 = 144. Therefore, b = sqrt(144) = 12 cm.",
        "hint": "13 squared is 169 and 5 squared is 25. Subtract 25 from 169 and find the square root."
      },
      {
        "id": "PRACTICE-GA-04-q4",
        "section": "General Awareness",
        "questionNumber": 4,
        "questionText": "Which Article of the Constitution of India provides for the Right to Education as a Fundamental Right for children aged 6 to 14 years?",
        "mathLatex": null,
        "options": [
          {
            "id": "PRACTICE-GA-04-q4-o1",
            "number": 1,
            "text": "Article 21A",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q4-o2",
            "number": 2,
            "text": "Article 19",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q4-o3",
            "number": 3,
            "text": "Article 45",
            "mathLatex": null
          },
          {
            "id": "PRACTICE-GA-04-q4-o4",
            "number": 4,
            "text": "Article 51A",
            "mathLatex": null
          }
        ],
        "correctOption": 1,
        "explanation": "Article 21A was inserted by the 86th Constitutional Amendment Act, 2002, making free and compulsory education a fundamental right for children between the ages of 6 and 14.",
        "hint": "It was added as an amendment right beside Article 21 (Protection of Life and Personal Liberty)."
      }
    ]
  }
] as const satisfies SeedExam[];

/** Practice entries are the ones with no negative marking. */
export function isPracticeEntry(code: string): boolean {
  return code.startsWith('PRACTICE');
}
