import html from "eslint-plugin-html";

export default [
  {
    files: ["**/*.html"],
    plugins: {
      html
    },
    languageOptions: {
      globals: {
        // This stops the "firebase is not defined" errors
        firebase: "readonly",
        google: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly"
      }
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "warn"
    }
  }
];
