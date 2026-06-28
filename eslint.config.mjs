import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";
import checkFilePlugin from "eslint-plugin-check-file";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    ...tseslint.configs.recommended,
    {
        ignores: [
            "**/dist",
            "**/out-tsc",
            "**/node_modules",
            "**/.opencode"
        ]
    },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [],
                    depConstraints: [
                        {
                            sourceTag: "*",
                            onlyDependOnLibsWithTags: ["*"]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    ignoreRestSiblings: true
                }
            ],
            "@typescript-eslint/naming-convention": [
                "warn",
                { selector: "class", format: ["PascalCase"] },
                { selector: "interface", format: ["PascalCase"] },
                { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
                { selector: "function", format: ["camelCase"] }
            ],
            "no-console": ["warn", { allow: ["warn", "error"] }]
        }
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        rules: {
            "jsdoc/require-jsdoc": "off",
            "jsdoc/require-param": "off",
            "jsdoc/require-param-description": "off",
            "jsdoc/require-returns": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "no-useless-escape": "warn",
            "@typescript-eslint/no-empty-function": "warn",
            "@typescript-eslint/no-this-alias": "off"
        }
    },
    {
        files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
        plugins: {
            "check-file": checkFilePlugin,
        },
        rules: {
            "check-file/folder-naming-convention": [
                "error",
                {
                    "**/*": "KEBAB_CASE",
                },
            ],
            "check-file/filename-naming-convention": [
                "error",
                {
                    "**/*": "KEBAB_CASE",
                },
                {
                    ignoreMiddleExtensions: true,
                },
            ],
        },
    },
];
