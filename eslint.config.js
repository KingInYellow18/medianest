const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const importPlugin = require("eslint-plugin-import");
const prettier = require("eslint-plugin-prettier");

const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [
    // Base configuration for all TypeScript files
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module",
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: "./tsconfig.base.json",
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
            import: importPlugin,
            prettier,
        },
        rules: {
            // ESLint recommended rules
            ...js.configs.recommended.rules,
            
            // TypeScript rules
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/strict-boolean-expressions": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/require-await": "warn",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/no-base-to-string": "off",
            
            // Import rules
            "import/order": [
                "error",
                {
                    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "import/no-duplicates": "error",
            "import/no-cycle": "warn",
            "import/no-unresolved": "error",
            "import/no-named-as-default": "warn",
            "import/no-named-as-default-member": "off",
            
            // General rules
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-debugger": "error",
            "prettier/prettier": "error",
        },
        settings: {
            "import/parsers": {
                "@typescript-eslint/parser": [".ts", ".tsx"],
            },
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: [
                        "./tsconfig.base.json",
                        "./frontend/tsconfig.json",
                        "./backend/tsconfig.json",
                        "./shared/tsconfig.json",
                    ],
                },
            },
        },
    }
];