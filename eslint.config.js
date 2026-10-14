import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "no-shadow": ["error", { allow: ["err"] }],
      "prefer-arrow-callback": "error",
      curly: ["error", "multi-or-nest", "consistent"],
      "no-buffer-constructor": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        { allowExpressions: true },
      ],
    },
  },
);
