import type { Exam } from '../../shared/types';

export const OFFLINE_PRACTICE_DRILLS: Exam[] = [
  {
    "id": "PRACTICE-QA-01",
    "code": "PRACTICE-QA-01",
    "title": "Quantitative Aptitude: Arithmetic & Algebra Practice Drill",
    "description": "Step-by-step math practice focusing on speed calculations, quadratic factorizations, circumference mensuration, and percentages with instant hints and formula derivations.",
    "category": "Banking & Insurance",
    "durationMinutes": 30,
    "totalMarks": 25,
    "negativeMarking": "No negative marking (Practice)",
    "difficulty": "Moderate",
        "sections": [
      "Quantitative Aptitude"
    ],
    "questionCount": 5,
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
            "text": "250 metres"
          },
          {
            "id": "PRACTICE-QA-01-q1-o2",
            "number": 2,
            "text": "270 metres"
          },
          {
            "id": "PRACTICE-QA-01-q1-o3",
            "number": 3,
            "text": "300 metres"
          },
          {
            "id": "PRACTICE-QA-01-q1-o4",
            "number": 4,
            "text": "320 metres"
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
            "text": "x = 3"
          },
          {
            "id": "PRACTICE-QA-01-q2-o2",
            "number": 2,
            "text": "x = 4"
          },
          {
            "id": "PRACTICE-QA-01-q2-o3",
            "number": 3,
            "text": "x = 1/3"
          },
          {
            "id": "PRACTICE-QA-01-q2-o4",
            "number": 4,
            "text": "x = 5"
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
            "text": "352 metres"
          },
          {
            "id": "PRACTICE-QA-01-q3-o2",
            "number": 2,
            "text": "440 metres"
          },
          {
            "id": "PRACTICE-QA-01-q3-o3",
            "number": 3,
            "text": "528 metres"
          },
          {
            "id": "PRACTICE-QA-01-q3-o4",
            "number": 4,
            "text": "616 metres"
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
            "text": "Rs. 900"
          },
          {
            "id": "PRACTICE-QA-01-q4-o2",
            "number": 2,
            "text": "Rs. 960"
          },
          {
            "id": "PRACTICE-QA-01-q4-o3",
            "number": 3,
            "text": "Rs. 1000"
          },
          {
            "id": "PRACTICE-QA-01-q4-o4",
            "number": 4,
            "text": "Rs. 1050"
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
            "text": "6 hours 40 minutes"
          },
          {
            "id": "PRACTICE-QA-01-q5-o2",
            "number": 2,
            "text": "6 hours 15 minutes"
          },
          {
            "id": "PRACTICE-QA-01-q5-o3",
            "number": 3,
            "text": "7 hours"
          },
          {
            "id": "PRACTICE-QA-01-q5-o4",
            "number": 4,
            "text": "7 hours 30 minutes"
          }
        ],
        "correctOption": 1,
        "explanation": "Combined 1 hour work = 1/12 + 1/15 = 9/60 = 3/20. Total time T = 20/3 hours = 6 hours and (2/3 * 60) minutes = 6 hours 40 minutes.",
        "hint": "Find the LCM of 12 and 15 (which is 60). In 1 hour, pipe A fills 5 units and pipe B fills 4 units, giving 9 units/hr. Divide 60 by 9."
      }
    ]
  },
  {
    "id": "PRACTICE-LR-02",
    "code": "PRACTICE-LR-02",
    "title": "Logical Reasoning: Syllogisms & Seating Drills",
    "description": "Learn deductive logic, statement-conclusion validity, Venn diagram methodology, and linear seating arrangements with detailed visual explanations.",
    "category": "Staff Selection",
    "durationMinutes": 25,
    "totalMarks": 20,
    "negativeMarking": "No negative marking (Practice)",
    "difficulty": "Easy",
        "sections": [
      "Logical Reasoning"
    ],
    "questionCount": 4,
    "questions": [
      {
        "id": "PRACTICE-LR-02-q1",
        "section": "Logical Reasoning",
        "questionNumber": 1,
        "questionText": "Identify the next number in the increasing alphanumeric sequence: B2, D4, F8, H16, ...",
        "options": [
          {
            "id": "PRACTICE-LR-02-q1-o1",
            "number": 1,
            "text": "I32"
          },
          {
            "id": "PRACTICE-LR-02-q1-o2",
            "number": 2,
            "text": "J32"
          },
          {
            "id": "PRACTICE-LR-02-q1-o3",
            "number": 3,
            "text": "J24"
          },
          {
            "id": "PRACTICE-LR-02-q1-o4",
            "number": 4,
            "text": "K32"
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
        "options": [
          {
            "id": "PRACTICE-LR-02-q2-o1",
            "number": 1,
            "text": "Only Conclusion I follows"
          },
          {
            "id": "PRACTICE-LR-02-q2-o2",
            "number": 2,
            "text": "Only Conclusion II follows"
          },
          {
            "id": "PRACTICE-LR-02-q2-o3",
            "number": 3,
            "text": "Neither Conclusion I nor II follows"
          },
          {
            "id": "PRACTICE-LR-02-q2-o4",
            "number": 4,
            "text": "Both Conclusions follow"
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
        "options": [
          {
            "id": "PRACTICE-LR-02-q3-o1",
            "number": 1,
            "text": "Only Conclusion I follows"
          },
          {
            "id": "PRACTICE-LR-02-q3-o2",
            "number": 2,
            "text": "Only Conclusion II follows"
          },
          {
            "id": "PRACTICE-LR-02-q3-o3",
            "number": 3,
            "text": "Neither Conclusion follows"
          },
          {
            "id": "PRACTICE-LR-02-q3-o4",
            "number": 4,
            "text": "Both Conclusions I and II follow"
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
        "options": [
          {
            "id": "PRACTICE-LR-02-q4-o1",
            "number": 1,
            "text": "TJHIU"
          },
          {
            "id": "PRACTICE-LR-02-q4-o2",
            "number": 2,
            "text": "TJHGU"
          },
          {
            "id": "PRACTICE-LR-02-q4-o3",
            "number": 3,
            "text": "UJHIU"
          },
          {
            "id": "PRACTICE-LR-02-q4-o4",
            "number": 4,
            "text": "TJHIW"
          }
        ],
        "correctOption": 1,
        "explanation": "Each letter is shifted forward by +1: B->C, R->S, A->B, I->J, N->O. Applying +1 to SIGHT: S->T, I->J, G->H, H->I, T->U. Thus, TJHIU is the correct answer.",
        "hint": "Notice the relationship between B and C, R and S. It is a simple +1 alphabetical advance."
      }
    ]
  },
  {
    "id": "PRACTICE-VA-03",
    "code": "PRACTICE-VA-03",
    "title": "Verbal Ability: Vocabulary & Grammar Master Drill",
    "description": "Master high-frequency antonyms, subject-verb agreement rules, idioms, sentence correction, and vocabulary comprehension with contextual examples.",
    "category": "Civil Services",
    "durationMinutes": 20,
    "totalMarks": 20,
    "negativeMarking": "No negative marking (Practice)",
    "difficulty": "Moderate",
        "sections": [
      "Verbal Ability"
    ],
    "questionCount": 4,
    "questions": [
      {
        "id": "PRACTICE-VA-03-q1",
        "section": "Verbal Ability",
        "questionNumber": 1,
        "questionText": "Choose the word that is most nearly OPPOSITE in meaning (antonym) to the word: EPHEMERAL.",
        "options": [
          {
            "id": "PRACTICE-VA-03-q1-o1",
            "number": 1,
            "text": "Transient"
          },
          {
            "id": "PRACTICE-VA-03-q1-o2",
            "number": 2,
            "text": "Permanent"
          },
          {
            "id": "PRACTICE-VA-03-q1-o3",
            "number": 3,
            "text": "Fleeting"
          },
          {
            "id": "PRACTICE-VA-03-q1-o4",
            "number": 4,
            "text": "Delicate"
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
        "options": [
          {
            "id": "PRACTICE-VA-03-q2-o1",
            "number": 1,
            "text": "Neither the candidate nor the invigilators was present in the examination hall."
          },
          {
            "id": "PRACTICE-VA-03-q2-o2",
            "number": 2,
            "text": "Neither the candidate nor the invigilators were present in the examination hall."
          },
          {
            "id": "PRACTICE-VA-03-q2-o3",
            "number": 3,
            "text": "Neither the candidate or the invigilators were present in the examination hall."
          },
          {
            "id": "PRACTICE-VA-03-q2-o4",
            "number": 4,
            "text": "Neither the candidate nor the invigilators has been present in the examination hall."
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
        "options": [
          {
            "id": "PRACTICE-VA-03-q3-o1",
            "number": 1,
            "text": "To cause an accidental fire at night"
          },
          {
            "id": "PRACTICE-VA-03-q3-o2",
            "number": 2,
            "text": "To work or study late into the night"
          },
          {
            "id": "PRACTICE-VA-03-q3-o3",
            "number": 3,
            "text": "To waste valuable fuel needlessly"
          },
          {
            "id": "PRACTICE-VA-03-q3-o4",
            "number": 4,
            "text": "To wake up early before sunrise"
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
        "options": [
          {
            "id": "PRACTICE-VA-03-q4-o1",
            "number": 1,
            "text": "Accomodation"
          },
          {
            "id": "PRACTICE-VA-03-q4-o2",
            "number": 2,
            "text": "Accommodation"
          },
          {
            "id": "PRACTICE-VA-03-q4-o3",
            "number": 3,
            "text": "Acommodation"
          },
          {
            "id": "PRACTICE-VA-03-q4-o4",
            "number": 4,
            "text": "Accommadation"
          }
        ],
        "correctOption": 2,
        "explanation": "Accommodation has double \"c\" and double \"m\": A-C-C-O-M-M-O-D-A-T-I-O-N.",
        "hint": "Remember the mnemonic: Accommodation has enough room for two Cs and two Ms."
      }
    ]
  },
  {
    "id": "PRACTICE-GA-04",
    "code": "PRACTICE-GA-04",
    "title": "General Awareness & Digital Accessibility Quiz Drill",
    "description": "Practice fundamental Indian constitutional provisions, landmark supreme court writs, environmental science, and W3C digital accessibility standards.",
    "category": "Railways",
    "durationMinutes": 20,
    "totalMarks": 20,
    "negativeMarking": "No negative marking (Practice)",
    "difficulty": "Easy",
        "sections": [
      "General Awareness",
      "Quantitative Aptitude"
    ],
    "questionCount": 4,
    "questions": [
      {
        "id": "PRACTICE-GA-04-q1",
        "section": "General Awareness",
        "questionNumber": 1,
        "questionText": "Under the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, what is the minimum required contrast ratio for normal body text against its background?",
        "options": [
          {
            "id": "PRACTICE-GA-04-q1-o1",
            "number": 1,
            "text": "3:1"
          },
          {
            "id": "PRACTICE-GA-04-q1-o2",
            "number": 2,
            "text": "4.5:1"
          },
          {
            "id": "PRACTICE-GA-04-q1-o3",
            "number": 3,
            "text": "7:1"
          },
          {
            "id": "PRACTICE-GA-04-q1-o4",
            "number": 4,
            "text": "10:1"
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
        "options": [
          {
            "id": "PRACTICE-GA-04-q2-o1",
            "number": 1,
            "text": "aria-live"
          },
          {
            "id": "PRACTICE-GA-04-q2-o2",
            "number": 2,
            "text": "aria-hidden"
          },
          {
            "id": "PRACTICE-GA-04-q2-o3",
            "number": 3,
            "text": "tabindex=\"0\""
          },
          {
            "id": "PRACTICE-GA-04-q2-o4",
            "number": 4,
            "text": "role=\"presentation\""
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
            "text": "8 cm"
          },
          {
            "id": "PRACTICE-GA-04-q3-o2",
            "number": 2,
            "text": "10 cm"
          },
          {
            "id": "PRACTICE-GA-04-q3-o3",
            "number": 3,
            "text": "12 cm"
          },
          {
            "id": "PRACTICE-GA-04-q3-o4",
            "number": 4,
            "text": "14 cm"
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
        "options": [
          {
            "id": "PRACTICE-GA-04-q4-o1",
            "number": 1,
            "text": "Article 21A"
          },
          {
            "id": "PRACTICE-GA-04-q4-o2",
            "number": 2,
            "text": "Article 19"
          },
          {
            "id": "PRACTICE-GA-04-q4-o3",
            "number": 3,
            "text": "Article 45"
          },
          {
            "id": "PRACTICE-GA-04-q4-o4",
            "number": 4,
            "text": "Article 51A"
          }
        ],
        "correctOption": 1,
        "explanation": "Article 21A was inserted by the 86th Constitutional Amendment Act, 2002, making free and compulsory education a fundamental right for children between the ages of 6 and 14.",
        "hint": "It was added as an amendment right beside Article 21 (Protection of Life and Personal Liberty)."
      }
    ]
  },
  {
    "id": "DI-DATA-01",
    "code": "DI-DATA-01",
    "title": "Data Interpretation & Chart Analysis Drill",
    "description": "Challenging multi-stage Data Interpretation practice series with interactive auditory bar, line, and pie sonification for competitive exams (Banking PO, SSC CGL, CSAT).",
    "category": "Banking & Insurance",
    "durationMinutes": 30,
    "totalMarks": 60,
    "negativeMarking": "No negative marking (Practice)",
    "difficulty": "Challenging",
        "sections": [
      "Data Interpretation"
    ],
    "questionCount": 6,
    "questions": [
      {
        "id": "DI-DATA-01-q1",
        "section": "Data Interpretation",
        "questionNumber": 1,
        "questionType": "DI",
        "questionText": "The annual sales in the peak year 2022 is approximately what percentage higher than the overall 5-year average annual sales?",
        "mathLatex": "\\text{Percentage Higher} = \\frac{\\text{Sales}_{2022} - \\text{Sales}_{\\text{avg}}}{\\text{Sales}_{\\text{avg}}} \\times 100",
        "graph": {
          "enabled": true,
          "type": "bar",
          "title": "Annual Company Sales",
          "xAxisLabel": "Year",
          "yAxisLabel": "Sales",
          "unit": "Crore",
          "data": [
            {
              "id": "2020",
              "label": "2020",
              "value": 40
            },
            {
              "id": "2021",
              "label": "2021",
              "value": 65
            },
            {
              "id": "2022",
              "label": "2022",
              "value": 90
            },
            {
              "id": "2023",
              "label": "2023",
              "value": 55
            },
            {
              "id": "2024",
              "label": "2024",
              "value": 75
            }
          ],
          "sonification": {
            "enabled": true,
            "spatialAudio": true,
            "trendDetection": true,
            "peakDetection": true,
            "haptic": true,
            "voiceDetail": "standard",
            "minFrequency": 250,
            "maxFrequency": 900
          }
        },
        "options": [
          {
            "id": "DI-DATA-01-q1-o1",
            "number": 1,
            "text": "31.5%"
          },
          {
            "id": "DI-DATA-01-q1-o2",
            "number": 2,
            "text": "38.5%"
          },
          {
            "id": "DI-DATA-01-q1-o3",
            "number": 3,
            "text": "42.2%"
          },
          {
            "id": "DI-DATA-01-q1-o4",
            "number": 4,
            "text": "47.8%"
          }
        ],
        "correctOption": 2,
        "explanation": "Total 5-year sales = 40 + 65 + 90 + 55 + 75 = 325 Crore. 5-year average = 325 / 5 = 65 Crore. Sales in peak year 2022 = 90 Crore. Percentage increase over average = ((90 - 65) / 65) * 100 = (25 / 65) * 100 = 38.46% ≈ 38.5%.",
        "hint": "Calculate the average across all 5 years first, then find the percentage increase of 2022 over that average."
      },
      {
        "id": "DI-DATA-01-q2",
        "section": "Data Interpretation",
        "questionNumber": 2,
        "questionType": "DI",
        "questionText": "In 2024, the ratio of domestic sales to export sales was 3 : 2, whereas in 2021 the ratio was 3 : 10. What is the total combined domestic sales (in Crore) for the years 2021 and 2024 combined?",
        "mathLatex": "\\text{Domestic}_{2021} + \\text{Domestic}_{2024} = \\left(\\frac{3}{13} \\times 65\\right) + \\left(\\frac{3}{5} \\times 75\\right)",
        "graph": {
          "enabled": true,
          "type": "bar",
          "title": "Annual Company Sales",
          "xAxisLabel": "Year",
          "yAxisLabel": "Sales",
          "unit": "Crore",
          "data": [
            {
              "id": "2020",
              "label": "2020",
              "value": 40
            },
            {
              "id": "2021",
              "label": "2021",
              "value": 65
            },
            {
              "id": "2022",
              "label": "2022",
              "value": 90
            },
            {
              "id": "2023",
              "label": "2023",
              "value": 55
            },
            {
              "id": "2024",
              "label": "2024",
              "value": 75
            }
          ],
          "sonification": {
            "enabled": true,
            "spatialAudio": true,
            "trendDetection": true,
            "peakDetection": true,
            "haptic": true,
            "voiceDetail": "standard",
            "minFrequency": 250,
            "maxFrequency": 900
          }
        },
        "options": [
          {
            "id": "DI-DATA-01-q2-o1",
            "number": 1,
            "text": "48 Crore"
          },
          {
            "id": "DI-DATA-01-q2-o2",
            "number": 2,
            "text": "54 Crore"
          },
          {
            "id": "DI-DATA-01-q2-o3",
            "number": 3,
            "text": "60 Crore"
          },
          {
            "id": "DI-DATA-01-q2-o4",
            "number": 4,
            "text": "66 Crore"
          }
        ],
        "correctOption": 3,
        "explanation": "In 2021, total sales = 65 Crore; ratio Domestic:Export = 3:10, so Domestic = (3/13) * 65 = 15 Crore. In 2024, total sales = 75 Crore; ratio Domestic:Export = 3:2, so Domestic = (3/5) * 75 = 45 Crore. Combined domestic sales = 15 + 45 = 60 Crore.",
        "hint": "Divide 2021 sales by 13 and multiply by 3; divide 2024 sales by 5 and multiply by 3, then add them together."
      },
      {
        "id": "DI-DATA-01-q3",
        "section": "Data Interpretation",
        "questionNumber": 3,
        "questionType": "DI",
        "questionText": "What is the ratio of the average yield of the three lowest production years to the average yield of the three highest production years?",
        "mathLatex": "\\text{Ratio} = \\frac{\\text{Avg}(\\text{3 Lowest Years})}{\\text{Avg}(\\text{3 Highest Years})}",
        "graph": {
          "enabled": true,
          "type": "line",
          "title": "Annual Crop Yield Production",
          "xAxisLabel": "Year",
          "yAxisLabel": "Yield",
          "unit": "Metric Tons",
          "data": [
            {
              "id": "2018",
              "label": "2018",
              "value": 80
            },
            {
              "id": "2019",
              "label": "2019",
              "value": 100
            },
            {
              "id": "2020",
              "label": "2020",
              "value": 120
            },
            {
              "id": "2021",
              "label": "2021",
              "value": 90
            },
            {
              "id": "2022",
              "label": "2022",
              "value": 135
            },
            {
              "id": "2023",
              "label": "2023",
              "value": 105
            }
          ],
          "sonification": {
            "enabled": true,
            "spatialAudio": true,
            "trendDetection": true,
            "peakDetection": true,
            "haptic": true,
            "voiceDetail": "standard",
            "minFrequency": 250,
            "maxFrequency": 900
          }
        },
        "options": [
          {
            "id": "DI-DATA-01-q3-o1",
            "number": 1,
            "text": "2 : 3"
          },
          {
            "id": "DI-DATA-01-q3-o2",
            "number": 2,
            "text": "3 : 4"
          },
          {
            "id": "DI-DATA-01-q3-o3",
            "number": 3,
            "text": "4 : 5"
          },
          {
            "id": "DI-DATA-01-q3-o4",
            "number": 4,
            "text": "5 : 7"
          }
        ],
        "correctOption": 2,
        "explanation": "The three lowest yield years are 2018 (80), 2021 (90), and 2019 (100), with an average of (80 + 90 + 100) / 3 = 90 MT. The three highest yield years are 2023 (105), 2020 (120), and 2022 (135), with an average of (105 + 120 + 135) / 3 = 120 MT. Ratio = 90 : 120 = 3 : 4.",
        "hint": "Identify the 3 lowest values and 3 highest values from the line chart, find their averages, and simplify the ratio."
      },
      {
        "id": "DI-DATA-01-q4",
        "section": "Data Interpretation",
        "questionNumber": 4,
        "questionType": "DI",
        "questionText": "Between which two consecutive years was the percentage decrease in production yield the greatest?",
        "mathLatex": "\\% \\text{ Decrease} = \\frac{\\text{Yield}_{t-1} - \\text{Yield}_t}{\\text{Yield}_{t-1}} \\times 100",
        "graph": {
          "enabled": true,
          "type": "line",
          "title": "Annual Crop Yield Production",
          "xAxisLabel": "Year",
          "yAxisLabel": "Yield",
          "unit": "Metric Tons",
          "data": [
            {
              "id": "2018",
              "label": "2018",
              "value": 80
            },
            {
              "id": "2019",
              "label": "2019",
              "value": 100
            },
            {
              "id": "2020",
              "label": "2020",
              "value": 120
            },
            {
              "id": "2021",
              "label": "2021",
              "value": 90
            },
            {
              "id": "2022",
              "label": "2022",
              "value": 135
            },
            {
              "id": "2023",
              "label": "2023",
              "value": 105
            }
          ],
          "sonification": {
            "enabled": true,
            "spatialAudio": true,
            "trendDetection": true,
            "peakDetection": true,
            "haptic": true,
            "voiceDetail": "standard",
            "minFrequency": 250,
            "maxFrequency": 900
          }
        },
        "options": [
          {
            "id": "DI-DATA-01-q4-o1",
            "number": 1,
            "text": "2018 to 2019"
          },
          {
            "id": "DI-DATA-01-q4-o2",
            "number": 2,
            "text": "2020 to 2021 (25.0% drop)"
          },
          {
            "id": "DI-DATA-01-q4-o3",
            "number": 3,
            "text": "2022 to 2023 (22.2% drop)"
          },
          {
            "id": "DI-DATA-01-q4-o4",
            "number": 4,
            "text": "Both declines were identical in percentage"
          }
        ],
        "correctOption": 2,
        "explanation": "Both periods experienced an absolute decline of 30 Metric Tons. However, the percentage drop from 2020 to 2021 was ((120 - 90) / 120) * 100 = 25.0%, whereas from 2022 to 2023 it was ((135 - 105) / 135) * 100 = 22.22%. Therefore, the percentage decrease was greatest between 2020 and 2021.",
        "hint": "Check the starting year base value for both 30 MT drops; the smaller base produces a higher percentage decline."
      },
      {
        "id": "DI-DATA-01-q5",
        "section": "Data Interpretation",
        "questionNumber": 5,
        "questionType": "DI",
        "questionText": "What is the central angle (in degrees) subtended at the center of the pie chart by the combined sectors of Healthcare and Agriculture & Irrigation?",
        "mathLatex": "\\theta = \\left(\\frac{\\%_{\\text{Healthcare}} + \\%_{\\text{Agriculture}}}{100}\\right) \\times 360^\\circ",
        "graph": {
          "enabled": true,
          "type": "pie",
          "title": "State Annual Budget Allocation Breakdown",
          "xAxisLabel": "Sector",
          "yAxisLabel": "Allocation",
          "unit": "%",
          "data": [
            {
              "id": "infra",
              "label": "Infrastructure",
              "value": 25
            },
            {
              "id": "health",
              "label": "Healthcare",
              "value": 20
            },
            {
              "id": "edu",
              "label": "Education",
              "value": 18
            },
            {
              "id": "defence",
              "label": "Defence & Police",
              "value": 15
            },
            {
              "id": "agri",
              "label": "Agriculture & Irrigation",
              "value": 12
            },
            {
              "id": "welfare",
              "label": "Social Welfare",
              "value": 10
            }
          ],
          "sonification": {
            "enabled": true,
            "spatialAudio": false,
            "trendDetection": false,
            "peakDetection": true,
            "haptic": true,
            "voiceDetail": "standard",
            "minFrequency": 250,
            "maxFrequency": 900
          }
        },
        "options": [
          {
            "id": "DI-DATA-01-q5-o1",
            "number": 1,
            "text": "108.0 degrees"
          },
          {
            "id": "DI-DATA-01-q5-o2",
            "number": 2,
            "text": "115.2 degrees"
          },
          {
            "id": "DI-DATA-01-q5-o3",
            "number": 3,
            "text": "122.4 degrees"
          },
          {
            "id": "DI-DATA-01-q5-o4",
            "number": 4,
            "text": "128.6 degrees"
          }
        ],
        "correctOption": 2,
        "explanation": "Combined percentage for Healthcare (20%) and Agriculture & Irrigation (12%) = 32%. Central angle subtended in a 360-degree circle = (32 / 100) * 360 = 32 * 3.6 = 115.2 degrees.",
        "hint": "Remember each 1% in a pie chart equals 3.6 degrees. Multiply 32 by 3.6."
      },
      {
        "id": "DI-DATA-01-q6",
        "section": "Data Interpretation",
        "questionNumber": 6,
        "questionType": "DI",
        "questionText": "If the total state budget outlay is Rs. 3,50,000 Crore, how much more funds (in Crore) are allocated to Infrastructure and Education combined compared to Defence & Police and Social Welfare combined?",
        "mathLatex": "\\Delta = \\left[(25\\% + 18\\%) - (15\\% + 10\\%)\\right] \\times 350{,}000",
        "graph": {
          "enabled": true,
          "type": "pie",
          "title": "State Annual Budget Allocation Breakdown",
          "xAxisLabel": "Sector",
          "yAxisLabel": "Allocation",
          "unit": "%",
          "data": [
            {
              "id": "infra",
              "label": "Infrastructure",
              "value": 25
            },
            {
              "id": "health",
              "label": "Healthcare",
              "value": 20
            },
            {
              "id": "edu",
              "label": "Education",
              "value": 18
            },
            {
              "id": "defence",
              "label": "Defence & Police",
              "value": 15
            },
            {
              "id": "agri",
              "label": "Agriculture & Irrigation",
              "value": 12
            },
            {
              "id": "welfare",
              "label": "Social Welfare",
              "value": 10
            }
          ],
          "sonification": {
            "enabled": true,
            "spatialAudio": false,
            "trendDetection": false,
            "peakDetection": true,
            "haptic": true,
            "voiceDetail": "standard",
            "minFrequency": 250,
            "maxFrequency": 900
          }
        },
        "options": [
          {
            "id": "DI-DATA-01-q6-o1",
            "number": 1,
            "text": "Rs. 54,000 Crore"
          },
          {
            "id": "DI-DATA-01-q6-o2",
            "number": 2,
            "text": "Rs. 58,500 Crore"
          },
          {
            "id": "DI-DATA-01-q6-o3",
            "number": 3,
            "text": "Rs. 63,000 Crore"
          },
          {
            "id": "DI-DATA-01-q6-o4",
            "number": 4,
            "text": "Rs. 67,500 Crore"
          }
        ],
        "correctOption": 3,
        "explanation": "Group 1 (Infrastructure 25% + Education 18%) = 43%. Group 2 (Defence & Police 15% + Social Welfare 10%) = 25%. Difference = 43% - 25% = 18%. 18% of Rs. 3,50,000 Crore = (18 / 100) * 3,50,000 = Rs. 63,000 Crore.",
        "hint": "Subtract 25% from 43% to find the net percentage difference (18%), then calculate 18% of 3,50,000."
      }
    ]
  }
];
