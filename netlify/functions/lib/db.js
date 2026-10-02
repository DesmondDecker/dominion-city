require('./env');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}
const mongoose = require('mongoose');

// Increase buffer timeout from default 10s to 45s so slow network handshakes don't abort queries
mongoose.set('bufferTimeoutMS', 45000);

let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

async function connectDB() {
  // If we are already connected and ready, return immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If a connection is already in flight, wait for it
  if (cached.promise) {
    try {
      await cached.promise;
      if (mongoose.connection.readyState === 1) {
        return mongoose;
      }
    } catch {
      // Previous promise failed, will retry below
    }
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in environment variables');

  cached.promise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    })
    .then((m) => {
      cached.conn = m;
      return m;
    })
    .catch((err) => {
      cached.promise = null;
      cached.conn = null;
      throw err;
    });

  await cached.promise;
  return mongoose;
}

module.exports = { connectDB };
