import path from 'path';
import alias from '@rollup/plugin-alias';
import copy from 'rollup-plugin-copy';
import livereload from 'rollup-plugin-livereload';
import postcss from 'rollup-plugin-postcss';
import resolve from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import { terser } from 'rollup-plugin-terser';

const outputPath = path.resolve(__dirname, 'dist');
const production = !process.env.ROLLUP_WATCH;

export default {
  input: path.join(__dirname, 'src', 'app.js'),
  output: {
    dir: outputPath,
    format: 'iife',
  },
  plugins: [
    alias({
      entries: {
        'softxels-viewer-config': (
          process.env.CONFIG || path.resolve(__dirname, `config.${production ? 'prod' : 'dev'}.js`)
        ),
      },
    }),
    copy({
      targets: [{ src: 'public/*', dest: 'dist' }],
      copyOnce: !production,
    }),
    resolve({
      browser: true,
    }),
    postcss({
      extract: 'app.css',
      minimize: production,
    }),
    ...(production ? [
      terser({ format: { comments: false } }),
    ] : [
      serve({
        contentBase: outputPath,
        port: 8080,
      }),
      livereload(outputPath),
    ]),
  ],
  watch: { clearScreen: false },
};
