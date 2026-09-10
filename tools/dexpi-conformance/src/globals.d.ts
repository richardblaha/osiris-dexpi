// The editor sources `import xml from './foo.xml'` as a raw string (esbuild
// `text` loader / build.mjs). Mirror that here so tsc resolves the imports.
declare module '*.xml' {
  const content: string;
  export default content;
}
declare module '*.dexpi' {
  const content: string;
  export default content;
}
