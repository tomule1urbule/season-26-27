// Bundles the app with esbuild into dist/ (no other build tooling needed).
//   npm run build   → dist/
//   npm run dev     → dist/ + local server with live rebuild on http://localhost:5173
import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const serve = process.argv.includes('--serve');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('public', 'dist', { recursive: true });

const opts = {
  entryPoints: { app: 'src/main.jsx' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  minify: !serve,
  sourcemap: serve,
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': serve ? '"development"' : '"production"' },
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173 });
  console.log(`Dev server: http://localhost:${port}  (edits to public/data/garmin.json need a restart)`);
} else {
  await esbuild.build(opts);
  console.log('Built → dist/');
}
