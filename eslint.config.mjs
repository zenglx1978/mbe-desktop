import tseslint from 'typescript-eslint'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'release-*/**', 'node_modules/**', '*.js', '*.cjs', 'build/**'] },
  ...tseslint.configs.recommended,
  // ── 主进程：console.log 允许（启动日志必要），但建议用 logger 替代 ──
  {
    files: ['src/main/**/*.ts'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // ── 渲染进程：严禁 console.log 进入生产代码 ──
  {
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // 渲染层严禁 console.log — 使用 console.warn/error 显式标记意图
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
)
