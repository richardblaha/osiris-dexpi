import * as esbuild from 'esbuild';
import * as fs from 'fs';

const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify');

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

const copyAssets = () => {
  if (fs.existsSync('src/webview/webview.css')) {
    fs.copyFileSync('src/webview/webview.css', 'dist/webview.css');
  }
  if (fs.existsSync('src/panel/panel.css')) {
    fs.copyFileSync('src/panel/panel.css', 'dist/panel.css');
  }
};

copyAssets();

/** @type {esbuild.BuildOptions[]} */
const buildConfigs = [
  // 1. VS Code Extension Host (CommonJS)
  {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    loader: { '.xml': 'text' },
    sourcemap: true,
    minify: isMinify,
  },
  // 2. Design-canvas webview (browser IIFE, WebGPU P&ID Engine + Stencils)
  {
    entryPoints: ['src/webview/index.ts'],
    bundle: true,
    outfile: 'dist/webview.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    loader: { '.xml': 'text' },
    sourcemap: true,
    minify: isMinify,
  },
  // 3. "P&ID" panel webview (browser IIFE: symbol palette + properties)
  {
    entryPoints: ['src/panel/index.ts'],
    bundle: true,
    outfile: 'dist/panel.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    loader: { '.xml': 'text' },
    sourcemap: true,
    minify: isMinify,
  },
  // 4. MCP Server CLI
  {
    entryPoints: ['src/mcp/bin.ts'],
    bundle: true,
    outfile: 'dist/mcp.js',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    loader: { '.xml': 'text' },
    banner: { js: '#!/usr/bin/env node\n' },
    sourcemap: true,
    minify: isMinify,
  },
];

async function run() {
  if (isWatch) {
    console.log('Starting esbuild in watch mode...');
    const contexts = await Promise.all(buildConfigs.map((cfg) => esbuild.context(cfg)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await Promise.all(buildConfigs.map((cfg) => esbuild.build(cfg)));
    copyAssets();
    console.log('Build completed successfully.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
