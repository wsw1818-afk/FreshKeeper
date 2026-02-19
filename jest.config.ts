import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: true,
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
    }],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: ['text', 'text-summary', 'html'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
};

export default config;
