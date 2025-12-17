import path from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
  build: {
    target: "node10",
    lib: {
      entry: resolvePath("./src/index.ts"),
      name: "pojo-yjs",
    },
    sourcemap: "inline",
    minify: false,

    rollupOptions: {
      external: ["yjs"],

      output: [
        {
          format: "esm",
          entryFileNames: "pojo-yjs.esm.mjs",
        },
        {
          name: "pojo-yjs",
          format: "umd",
          globals: {
            yjs: "Y",
          },
        },
      ],
    },
  },
  plugins: [
    dts({
      tsconfigPath: resolvePath("./tsconfig.json"),
      outDir: resolvePath("./dist/types"),
    }),
  ],
})
