import shared from '@kimmy/config/eslint';
import next from '@next/eslint-plugin-next';
import a11y from 'eslint-plugin-jsx-a11y';
export default [
  ...shared,
  { files: ['**/*.{ts,tsx}'], plugins: { '@next/next': next, 'jsx-a11y': a11y }, rules: { ...next.configs.recommended.rules, ...next.configs['core-web-vitals'].rules, ...a11y.configs.recommended.rules } },
];
