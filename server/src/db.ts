import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignored on older Node runtimes
}

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
    // Force IPv4 resolution — avoids the [64:ff9b::*]:27017 IPv6-mapped
    // timeout that occurs when the local network has broken IPv6 routing.
    family: 4,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    // Detect a silently dead connection instead of hanging a request until the
    // client gives up. The driver re-establishes the pool on its own after a
    // reset, so a failed operation is a retriable 500, not a wedged server.
    socketTimeoutMS: 45000,
    // Re-check the topology frequently so a replica-set failover or a network
    // blip is noticed within seconds rather than after the default 10s.
    heartbeatFrequencyMS: 10000,
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
