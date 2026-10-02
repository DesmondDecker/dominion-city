module.exports = {
  testEnvironment: 'node',
  globalSetup: './__tests__/globalSetup.js',
  globalTeardown: './__tests__/globalTeardown.js',
  testMatch: ['**/__tests__/**/*.test.js'],
  testTimeout: 20000, // mongodb-memory-server's first boot can be slow
};
