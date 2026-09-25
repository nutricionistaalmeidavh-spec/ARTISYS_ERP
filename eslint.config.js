'use strict';
const globals={console:'readonly',process:'readonly',Buffer:'readonly',URL:'readonly',URLSearchParams:'readonly',fetch:'readonly',structuredClone:'readonly',crypto:'readonly',globalThis:'readonly',window:'readonly',document:'readonly',navigator:'readonly',setTimeout:'readonly',clearTimeout:'readonly',setInterval:'readonly',clearInterval:'readonly'};
const rules={'no-dupe-keys':'error','no-unreachable':'error','no-constant-condition':['error',{checkLoops:false}],'no-unsafe-finally':'error','no-func-assign':'error','no-class-assign':'error','no-import-assign':'error'};
module.exports=[
  {ignores:['dist/**','node_modules/**','.worktrees/**']},
  {files:['**/*.js','**/*.cjs'],languageOptions:{ecmaVersion:'latest',sourceType:'commonjs',globals},rules},
  {files:['**/*.mjs'],languageOptions:{ecmaVersion:'latest',sourceType:'module',globals},rules}
];
