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

  mongoose.connection.on('disconnected', () => {
    console.warn('  mongodb  connection lost — attempting automatic reconnect...');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('  mongodb  reconnected to Atlas cluster');
  });
  mongoose.connection.on('error', (err) => {
    console.warn(`  mongodb  connection warning: ${err?.message || err}`);
  });

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB,
    // Force IPv4 resolution — avoids the [64:ff9b::*]:27017 IPv6-mapped
    // timeout that occurs when the local network has broken IPv6 routing.
    family: 4,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    // Standard 30s heartbeat: avoids aggressively tearing down and clearing the
    // entire connection pool on transient 10s internet/wifi jitter.
    heartbeatFrequencyMS: 30000,
    maxPoolSize: 20,
    minPoolSize: 1,
    maxIdleTimeMS: 60000,
    retryWrites: true,
    retryReads: true,
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
