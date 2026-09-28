import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const optionSchema = new Schema(
  {
    id: { type: String, required: true },
    number: { type: Number, required: true, min: 1, max: 9 },
    text: { type: String, required: true },
    mathLatex: { type: String, default: undefined },
  },
  { _id: false }
);

/**
 * Questions are EMBEDDED in the exam document rather than living in their own
 * collection.
 *
 * Two reasons. First, an exam is a self-contained aggregate: reading one
 * question never requires a join, and deleting an exam removes its questions in
 * a single document delete with no cascade bookkeeping. Second, keeping the
 * answer key inside the same document as the question means sanitising happens
 * in exactly one place — see services/question.service.ts.
 */
const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    section: { type: String, required: true, trim: true },
    questionNumber: { type: Number, required: true, min: 1 },
    questionText: { type: String, required: true },
    mathLatex: { type: String, default: undefined },
    diagramUrl: { type: String, default: undefined },
    diagramType: { type: String, enum: ['image', 'svg', 'chart', 'geometry'], default: 'image' },
    diagramDescription: { type: String, default: undefined },
    diagramAiExplanation: {
      visualBreakdown: { type: [String], default: [] },
      educationalContext: { type: String, default: '' },
      keyPoints: { type: [String], default: [] },
      audioNarration: { type: String, default: '' },
    },
    options: { type: [optionSchema], required: true },

    // ── SENSITIVE. Never leaves the server until after submission. ──
    correctOption: { type: Number, required: true, min: 1, max: 9 },
    explanation: { type: String, default: '' },
    hint: { type: String, default: '' },
  },
  { _id: false }
);

const examSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Staff Selection' },
    durationMinutes: { type: Number, required: true, min: 1, max: 600 },
    totalMarks: { type: Number, required: true, min: 1 },
    negativeMarking: { type: Number, default: 0, min: 0, max: 10 },
    difficulty: { type: String, enum: ['Easy', 'Moderate', 'Challenging'], default: 'Moderate' },
    published: { type: Boolean, default: false, index: true },
    questions: {
      type: [questionSchema],
      default: [],
      // A published exam must actually have questions, otherwise a student
      // would start an attempt and immediately hit an empty screen. Uses the
      // array-form validator so `this` is bound to the document.
      validate: {
        validator: function (qs: unknown[]) {
          return !this.published || qs.length > 0;
        },
        message: 'A published exam must contain at least one question.',
      },
    },
  },
  { timestamps: true }
);

type ExamShape = InferSchemaType<typeof examSchema>;
export type ExamDoc = HydratedDocument<ExamShape>;

export const Exam: Model<ExamShape> =
  (mongoose.models.Exam as Model<ExamShape>) ??
  mongoose.model<ExamShape>('Exam', examSchema);
