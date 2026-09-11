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
declare module 'pixelmatch' {
  const fn: (
    a: Uint8Array | Uint8ClampedArray,
    b: Uint8Array | Uint8ClampedArray,
    out: Uint8Array | Uint8ClampedArray | null,
    w: number,
    h: number,
    opts?: { threshold?: number; includeAA?: boolean }
  ) => number;
  export default fn;
}
declare module 'pngjs' {
  export class PNG {
    constructor(opts?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: { read(b: Buffer): PNG; write(p: PNG): Buffer };
  }
}
