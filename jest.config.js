module.exports = {
  transform: {
    "^.+\\.tsx?$": "esbuild-jest",
  },
  moduleDirectories: ["<rootDir>/src", "<rootDir>/node_modules"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
