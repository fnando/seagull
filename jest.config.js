module.exports = {
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleDirectories: ["<rootDir>/src", "<rootDir>/node_modules"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
