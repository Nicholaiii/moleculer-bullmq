// build.config.ts
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/index'
  ],
  externals: ['moleculer'],
  rollup: {
    cjsBridge: true,
    emitCJS: true
  },
  declaration: true, // generate .d.ts files
})
