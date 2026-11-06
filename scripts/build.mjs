import { build } from 'esbuild';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';
await build({
  entryPoints: ['src/telegram-client.js'], outfile: 'extension/vendor/telegram.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'chrome109',
  conditions: ['browser'], minify: true, legalComments: 'linked',
  plugins: [nodeModulesPolyfillPlugin({ globals: { Buffer: true, process: true }, modules: { fs: 'empty', net: 'empty', tls: 'empty', path: true, os: true, util: true, buffer: true, process: true, events: true, stream: true, zlib: true, crypto: true, assert: true } })]
});
console.log('Cliente Telegram empacotado localmente.');
