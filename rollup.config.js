import fs from 'fs';
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
        'softxels-viewer-config': process.env.CONFIG || path.resolve(__dirname, 'config.js'),
      },
    }),
    copy({
      targets: [
        { src: 'src/index.html', dest: 'dist' },
        { src: 'screenshot.png', dest: 'dist' },
      ],
    }),
    resolve({
      browser: true,
    }),
    postcss({
      extract: 'app.css',
      minimize: production,
    }),
    ...(production ? [
      terser(),
      {
        writeBundle() {
          fs.writeFileSync(path.join(outputPath, 'CNAME'), 'softxels-viewer.gatunes.com');
        },
      },
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
