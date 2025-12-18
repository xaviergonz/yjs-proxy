import path from "path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
  build: {
    target: "node10",
    lib: {
      entry: resolvePath("./src/index.ts"),
      name: "yjs-proxy",
    },
    sourcemap: "inline",
    minify: false,

    rollupOptions: {
      external: ["yjs"],

      output: [
        {
          format: "esm",
          entryFileNames: "yjs-proxy.esm.mjs",
        },
        {
          name: "yjs-proxy",
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
