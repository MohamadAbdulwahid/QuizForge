import baseConfig from "../../eslint.config.mjs";
import jsdoc from "eslint-plugin-jsdoc";

export default [
    ...baseConfig,
    {
        plugins: {
            jsdoc
        },
        rules: {
            // Require JSDoc for functions and classes
            'jsdoc/require-jsdoc': ['warn', {
                require: {
                    FunctionDeclaration: true,
                    MethodDefinition: true,
                    ClassDeclaration: true,
                    ArrowFunctionExpression: false,
                    FunctionExpression: false
                }
            }],
            
            // Require description in JSDoc
            'jsdoc/require-description': 'warn',
            
            // Require @param for all parameters
            'jsdoc/require-param': 'warn',
            
            // Require @returns for functions that return
            'jsdoc/require-returns': 'warn',
            
            // Check param names match actual parameters
            'jsdoc/check-param-names': 'error',
            
            // Validate tag names
            'jsdoc/check-tag-names': 'error',
            
            // Enforce hyphen before param description
            'jsdoc/require-hyphen-before-param-description': 'warn',
        }
    }
];
