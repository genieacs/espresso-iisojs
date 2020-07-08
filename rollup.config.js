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
      { file: "dist/yebool.cjs.js", format: "cjs" },
			{ file: "dist/yebool.esm.js", format: 'es' }
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
			{ file: "dist/yebool-jsbi.cjs.js", format: "cjs" },
			{ file: "dist/yebool-jsbi.esm.js", format: 'es' }
		]
	}	
];
