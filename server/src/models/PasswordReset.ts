import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

/**
 * Stores temporary, time-bound password reset verification tokens.
 * A MongoDB TTL index on `expiresAt` automatically purges expired records.
 */
const passwordResetSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    resetToken: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['STUDENT', 'ADMIN'],
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

type PasswordResetShape = InferSchemaType<typeof passwordResetSchema>;
export type PasswordResetDoc = HydratedDocument<PasswordResetShape>;

export const PasswordReset: Model<PasswordResetShape> =
  (mongoose.models.PasswordReset as Model<PasswordResetShape>) ??
  mongoose.model<PasswordResetShape>('PasswordReset', passwordResetSchema);
