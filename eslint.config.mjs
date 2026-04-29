import html from "eslint-plugin-html";
import globals from "globals";

export default [
  {
    files: ["**/*.html"],
    plugins: {
      html
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        firebase: "readonly",
        google: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn"
    }
  }
];
