/**
 * Font Metrics & MSDF Glyph Atlas Definitions
 *
 * Provides character metrics and UV mapping for technical P&ID notation
 * (KKS tags, pipe codes, dimensions, ISO process symbols).
 */

export interface GlyphMetric {
  char: string;
  width: number;
  height: number;
  advance: number;
  uvMin: [number, number];
  uvMax: [number, number];
}

// 16x16 grid layout for ASCII & common technical symbols
const GRID_SIZE = 16;
const CELL_UV_STEP = 1.0 / GRID_SIZE;

const TECHNICAL_CHARS =
  ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_=./:()+[]#%*';

export class TechnicalFontAtlas {
  private static metricsMap = new Map<string, GlyphMetric>();

  static {
    for (let i = 0; i < TECHNICAL_CHARS.length; i++) {
      const ch = TECHNICAL_CHARS[i];
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);

      const u0 = col * CELL_UV_STEP;
      const v0 = row * CELL_UV_STEP;
      const u1 = u0 + CELL_UV_STEP;
      const v1 = v0 + CELL_UV_STEP;

      this.metricsMap.set(ch, {
        char: ch,
        width: 0.65, // Standard technical DIN character aspect ratio
        height: 1.0,
        advance: 0.72,
        uvMin: [u0, v0],
        uvMax: [u1, v1],
      });
    }
  }

  public static getGlyph(char: string): GlyphMetric {
    const metric = this.metricsMap.get(char);
    if (metric) return metric;

    // Fallback to '?' or space
    return (
      this.metricsMap.get('?') ?? {
        char: '?',
        width: 0.65,
        height: 1.0,
        advance: 0.72,
        uvMin: [0, 0],
        uvMax: [CELL_UV_STEP, CELL_UV_STEP],
      }
    );
  }
}

