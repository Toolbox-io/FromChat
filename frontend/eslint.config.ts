import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
    js.configs.recommended,
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true
                }
            }
        },
        plugins: {
            "@typescript-eslint": typescript,
            "react": react,
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
            "jsx-a11y": jsxA11y
        },
        rules: {
            // TypeScript rules
            ...typescript.configs.recommended.rules,
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-non-null-assertion": "off",

            // React rules
            ...react.configs.recommended.rules,
            "react/react-in-jsx-scope": "off", // Not needed with React 17+
            "react/prop-types": "off", // Using TypeScript instead
            "react/jsx-uses-react": "off", // Not needed with React 17+
            "react/jsx-uses-vars": "error",
            "react/jsx-no-undef": "error",
            "react/jsx-key": "error",
            "react/jsx-no-duplicate-props": "error",
            "react/jsx-pascal-case": "error",
            "react/no-array-index-key": "off",
            "react/no-danger": "off",
            "react/no-deprecated": "error",
            "react/no-direct-mutation-state": "error",
            "react/no-unescaped-entities": "error",
            "react/no-unknown-property": "error",
            "react/require-render-return": "error",
            "react/self-closing-comp": "error",
            "react/jsx-wrap-multilines": "error",
            "react/jsx-closing-bracket-location": "off",
            "react/jsx-closing-tag-location": "error",
            "react/jsx-curly-spacing": ["error", "never"],
            "react/jsx-equals-spacing": ["error", "never"],
            "react/jsx-first-prop-new-line": ["off", "multiline-multiprop"],
            "react/jsx-max-props-per-line": ["error", { maximum: 2, when: "multiline" }],
            "react/jsx-no-bind": "off",
            "react/jsx-no-literals": "off",
            "react/jsx-sort-props": "off",

            // React Hooks rules
            ...reactHooks.configs.recommended.rules,

            // React Refresh rules
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true }
            ],

            // Accessibility rules
            ...jsxA11y.configs.recommended.rules,
            "jsx-a11y/alt-text": "off",
            "jsx-a11y/anchor-has-content": "error",
            "jsx-a11y/aria-props": "error",
            "jsx-a11y/aria-proptypes": "error",
            "jsx-a11y/aria-unsupported-elements": "error",
            "jsx-a11y/click-events-have-key-events": "off",
            "jsx-a11y/heading-has-content": "error",
            "jsx-a11y/img-redundant-alt": "warn",
            "jsx-a11y/no-access-key": "error",
            "jsx-a11y/role-has-required-aria-props": "error",
            "jsx-a11y/role-supports-aria-props": "error",
            "jsx-a11y/scope": "error",
            "jsx-a11y/tabindex-no-positive": "error",
            "jsx-a11y/no-noninteractive-element-interactions": "off",
            "jsx-a11y/anchor-is-valid": "off",

            // General JavaScript/TypeScript rules
            "no-console": "off",
            "no-debugger": "error",
            "no-unused-vars": "off", // Handled by TypeScript version
            "prefer-const": "error",
            "no-var": "error",
            "no-undef": "off", // Handled by TypeScript version
            "eqeqeq": ["error", "always"],
            "curly": "off", // Changed from error to warn
            "brace-style": ["off", "1tbs"],
            "comma-dangle": "warn", // Changed from error to warn
            "comma-spacing": ["error", { before: false, after: true }],
            "comma-style": ["error", "last"],
            "computed-property-spacing": ["error", "never"],
            "func-call-spacing": ["off", "never"],
            "key-spacing": ["error", { beforeColon: false, afterColon: true }],
            "keyword-spacing": ["error", { before: true, after: true }],
            "object-curly-spacing": ["error", "always"],
            "semi-spacing": ["error", { before: false, after: true }],
            "space-before-blocks": "error",
            "space-before-function-paren": ["off", "never"],
            "space-in-parens": ["error", "never"],
            "space-infix-ops": "error",
            "space-unary-ops": ["error", { words: true, nonwords: false }],
            "quotes": "warn", // Changed from error to warn
            "max-len": ["warn", { code: 150, ignoreUrls: true, ignoreStrings: true }],
            "no-empty": "off"
        },
        settings: {
            react: {
                version: "detect"
            }
        }
    },
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "build/**",
            "out/**",
            "*.min.js",
            "coverage/**",
            ".nyc_output/**",
            "backend/**",
            "deployment/**",
            "web-calls/**"
        ]
    }
];
