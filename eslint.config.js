'use strict';
module.exports=[
  {
    files:['**/*.js','**/*.cjs','**/*.mjs'],
    ignores:['dist/**','node_modules/**','.worktrees/**'],
    languageOptions:{ecmaVersion:'latest',sourceType:'commonjs',globals:{console:'readonly',process:'readonly',Buffer:'readonly',URL:'readonly',URLSearchParams:'readonly',fetch:'readonly',structuredClone:'readonly',crypto:'readonly',globalThis:'readonly',window:'readonly',document:'readonly',navigator:'readonly',setTimeout:'readonly',clearTimeout:'readonly',setInterval:'readonly',clearInterval:'readonly'}},
    rules:{'no-dupe-keys':'error','no-unreachable':'error','no-constant-condition':['error',{checkLoops:false}],'no-unsafe-finally':'error','no-func-assign':'error','no-class-assign':'error','no-import-assign':'error'}
  }
];
