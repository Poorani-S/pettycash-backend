module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: "detect" },
  },
  plugins: ["react"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
  ],
  ignorePatterns: ["dist/", "node_modules/"],
  overrides: [
    {
      files: ["vite.config.js"],
      env: {
        node: true,
      },
    },
  ],
  rules: {
    // Keep lint lightweight for this codebase (focus on syntax/parsing errors).
    "no-unused-vars": "off",
    "react/prop-types": "off",
    "react/no-unescaped-entities": "off",
  },
};
