import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const feedbackSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    studentName: { type: String, default: 'Candidate' },
    studentRoll: { type: String, default: '' },
    examId: { type: String, required: true },
    examTitle: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    tags: { type: [String], default: [] },
    comment: { type: String, default: '' },
    inputMethod: {
      type: String,
      enum: ['voice', 'keyboard', 'mixed'],
      default: 'keyboard',
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ examId: 1, createdAt: -1 });
feedbackSchema.index({ studentId: 1, createdAt: -1 });

type FeedbackShape = InferSchemaType<typeof feedbackSchema>;
export type FeedbackDoc = HydratedDocument<FeedbackShape>;

export const Feedback: Model<FeedbackShape> =
  (mongoose.models.Feedback as Model<FeedbackShape>) ??
  mongoose.model<FeedbackShape>('Feedback', feedbackSchema);
