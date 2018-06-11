module.exports = {
  coverageDirectory: '__coverage__',
  coverageThreshold: {
    global: {
      branches: 58,
      functions: 78,
      lines: 79,
      statements: 81,
    },
  },
  collectCoverageFrom: [
    '<rootDir>/src/**',
    '!<rootDir>/src/**/__snapshots__/**',
    '!<rootDir>/src/server.js',
  ],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/lib'],
};
