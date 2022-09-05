module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/$1',
  },
  rootDir: 'src',
  bail: 1,
  verbose: true,
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/node_modules/**'],
  coverageDirectory: '../coverage',
}
