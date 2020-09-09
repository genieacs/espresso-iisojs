import { resolve, dirname } from "path";
import typescript from '@rollup/plugin-typescript';

export default [
  // Native BigInt
  {
    input: "src/main.ts",
    plugins: [
      typescript()
    ],
    output: [
      { file: "dist/espresso-iisojs.cjs", format: "cjs" },
      { file: "dist/espresso-iisojs.mjs", format: 'es' }
    ]
  },
  
  // JSBI
  {
    input: 'src/main.ts',
    external: ["jsbi"],
    plugins: [
      {
        resolveId: (importee, importer) => {
          if (importee.endsWith("/bigint")) return resolve(dirname(importer), "bigint-jsbi.ts");
          return null;
        }
      },	  
      typescript()
    ],
    output: [
      { file: "dist/espresso-iisojs-jsbi.cjs", format: "cjs" },
      { file: "dist/espresso-iisojs-jsbi.mjs", format: 'es' }
    ]
  }	
];
