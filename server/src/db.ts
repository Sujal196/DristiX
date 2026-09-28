import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connects to MongoDB and builds the indexes.
 *
 * Index creation is awaited explicitly rather than left to Mongoose's background
 * `autoIndex`, because a unique index that has not finished building would
 * silently allow duplicate emails or roll numbers.
 */
export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB,
    serverSelectionTimeoutMS: 8000,
  });

  const { User } = await import('./models/User.js');
  const { Exam } = await import('./models/Exam.js');
  const { Attempt } = await import('./models/Attempt.js');

  await Promise.all([User.init(), Exam.init(), Attempt.init()]);

  console.log(`  mongodb  ${env.MONGODB_DB} connected (${mongoose.connection.host})`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.connection.close();
}

export { mongoose };
