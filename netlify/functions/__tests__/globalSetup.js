const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  global.__MONGOD__ = mongod;

  // globalSetup runs in the main Jest process, before test-file workers
  // are spawned — env vars set here are inherited by those workers,
  // which is what lets every test file's connectDB() call reach this
  // same in-memory instance without any test file needing to know
  // it exists.
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret-not-for-real-use';
};
