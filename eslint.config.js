import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Deterministic code must not read wall-clock time or unseeded randomness, and must avoid
// transcendental Math functions whose results ECMAScript leaves implementation-approximated.
const transcendental = ["sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh", "exp", "expm1", "log", "log1p", "log2", "log10", "pow", "cbrt", "hypot"];
const determinismRules = {
  "no-restricted-properties": [
    "error",
    { object: "Math", property: "random", message: "Use the seeded Rng from src/engine/rng.ts." },
    { object: "Date", property: "now", message: "Deterministic code uses simulation ticks, not wall-clock time." },
    { object: "performance", property: "now", message: "Deterministic code uses simulation ticks, not wall-clock time." },
    ...transcendental.map((property) => ({
      object: "Math",
      property,
      message: "Transcendental functions are implementation-approximated; use basic arithmetic so replays match across engines.",
    })),
  ],
  "no-restricted-syntax": [
    "error",
    { selector: "NewExpression[callee.name='Date']", message: "Deterministic code must not construct wall-clock dates." },
    { selector: "BinaryExpression[operator='**']", message: "Exponentiation may be implementation-approximated; multiply explicitly." },
  ],
};

export default tseslint.config(
  { ignores: ["dist", "coverage", "playwright-report", "test-results"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: [
      "src/engine/**/*.ts",
      "src/evidence/**/*.ts",
      "src/assistant/**/*.ts",
      "src/scenarios/**/*.ts",
      "src/experiment/**/*.ts",
    ],
    ignores: ["**/*.test.ts", "src/assistant/providers/externalModel.ts", "src/engine/pacer.ts"],
    rules: determinismRules,
  },
);
