import typescript from '@rollup/plugin-typescript';

export default {
  input: "src/main.ts",
  plugins: [
    typescript()
  ],
  output: [
    { file: "index.mjs", format: 'es' },
    { file: "index.cjs", format: "cjs" }
  ]
};
