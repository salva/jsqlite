// Research-only local CLI configuration; no automatic fixes.
import { createRequire } from 'node:module';
const require = createRequire(`${process.env.SAIVAGE_CARD_WORK_ROOT}/beta6-analyzers/package.json`);
const ts = require('typescript-eslint');
export default [{
  files: ['**/*.ts'],
  languageOptions: { parser: ts.parser, ecmaVersion: 'latest', sourceType: 'module' },
  plugins: { '@typescript-eslint': ts.plugin },
  rules: {
    complexity: ['warn', { max: 20, variant: 'classic' }],
    'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 120, skipBlankLines: true, skipComments: true }],
    'max-depth': ['warn', 5],
    'max-params': 'off',
    '@typescript-eslint/max-params': ['warn', { max: 7 }],
  },
}];
