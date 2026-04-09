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
      "no-undef": "off",
      "no-unused-vars": "warn"
    }
  }
];
