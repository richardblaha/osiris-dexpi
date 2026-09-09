/**
 * Text Layout Engine for Technical P&ID Labels (KKS & Dimensions)
 */

import { TechnicalFontAtlas } from './fontMetrics';
import { TEXT_GLYPH_FLOATS } from '../types';

export interface TextLayoutOptions {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  entityId: number;
  color?: [number, number, number, number];
  align?: 'left' | 'center' | 'right';
}

export class TextLayoutEngine {
  /**
   * Layouts a text string into TextGlyph POD structs written into targetBuffer.
   * Returns the count of glyphs written.
   */
  public static layoutString(
    options: TextLayoutOptions,
    targetBuffer: Float32Array,
    startGlyphIndex: number
  ): number {
    const {
      text,
      x,
      y,
      fontSize,
      entityId,
      color = [0.9, 0.9, 0.95, 1.0],
      align = 'center',
    } = options;

    if (!text || text.length === 0) return 0;

    const len = text.length;

    // 1. Calculate total string width for alignment
    let totalWidth = 0;
    for (let i = 0; i < len; i++) {
      const g = TechnicalFontAtlas.getGlyph(text[i]);
      totalWidth += g.advance * fontSize;
    }

    let startX = x;
    if (align === 'center') {
      startX = x - totalWidth * 0.5;
    } else if (align === 'right') {
      startX = x - totalWidth;
    }

    let cursorX = startX;
    const targetU32 = new Uint32Array(targetBuffer.buffer);

    // 2. Output each glyph quad
    for (let i = 0; i < len; i++) {
      const g = TechnicalFontAtlas.getGlyph(text[i]);
      const glyphOffset = (startGlyphIndex + i) * TEXT_GLYPH_FLOATS;

      const gw = g.width * fontSize;
      const gh = g.height * fontSize;

      // pos_min
      targetBuffer[glyphOffset + 0] = cursorX;
      targetBuffer[glyphOffset + 1] = y;

      // pos_max
      targetBuffer[glyphOffset + 2] = cursorX + gw;
      targetBuffer[glyphOffset + 3] = y + gh;

      // uv_min
      targetBuffer[glyphOffset + 4] = g.uvMin[0];
      targetBuffer[glyphOffset + 5] = g.uvMin[1];

      // uv_max
      targetBuffer[glyphOffset + 6] = g.uvMax[0];
      targetBuffer[glyphOffset + 7] = g.uvMax[1];

      // color
      targetBuffer[glyphOffset + 8] = color[0];
      targetBuffer[glyphOffset + 9] = color[1];
      targetBuffer[glyphOffset + 10] = color[2];
      targetBuffer[glyphOffset + 11] = color[3];

      // font_size
      targetBuffer[glyphOffset + 12] = fontSize;

      // entity_id & pads
      targetU32[glyphOffset + 13] = entityId;
      targetU32[glyphOffset + 14] = 0;
      targetU32[glyphOffset + 15] = 0;

      cursorX += g.advance * fontSize;
    }

    return len;
  }
}

