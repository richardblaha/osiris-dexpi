/**
 * WebGPU Buffer Manager
 *
 * Handles GPU buffer lifecycle, capacity growth, and efficient partial/sub-buffer updates.
 */

import {
  GPUDevice,
  GPUBuffer,
  GPUBufferUsage,
  SYMBOL_INSTANCE_BYTES,
  LINE_SEGMENT_BYTES,
  TEXT_GLYPH_BYTES,
} from './types';

export class GpuBufferManager {
  private instanceBuffer: GPUBuffer | null = null;
  private lineBuffer: GPUBuffer | null = null;
  private textBuffer: GPUBuffer | null = null;

  private instanceCapacity = 0;
  private lineCapacity = 0;
  private textCapacity = 0;

  constructor(private readonly device: GPUDevice) {}

  /**
   * Uploads instance data for symbols, resizing buffer if needed.
   */
  public updateInstances(data: Float32Array, count: number): GPUBuffer {
    const requiredBytes = Math.max(count * SYMBOL_INSTANCE_BYTES, 1024);
    if (!this.instanceBuffer || this.instanceCapacity < requiredBytes) {
      if (this.instanceBuffer) {
        this.instanceBuffer.destroy();
      }
      // Allocate with 20% headroom to reduce frequent allocations
      this.instanceCapacity = Math.ceil(requiredBytes * 1.2);
      this.instanceBuffer = this.device.createBuffer({
        label: 'Symbols Instance Buffer',
        size: this.instanceCapacity,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    if (count > 0) {
      this.device.queue.writeBuffer(this.instanceBuffer, 0, data.buffer as ArrayBuffer, data.byteOffset, count * SYMBOL_INSTANCE_BYTES);
    }
    return this.instanceBuffer;
  }

  /**
   * Uploads line segment data for pipelines and signals, resizing buffer if needed.
   */
  public updateLines(data: Float32Array, count: number): GPUBuffer {
    const requiredBytes = Math.max(count * LINE_SEGMENT_BYTES, 1024);
    if (!this.lineBuffer || this.lineCapacity < requiredBytes) {
      if (this.lineBuffer) {
        this.lineBuffer.destroy();
      }
      this.lineCapacity = Math.ceil(requiredBytes * 1.2);
      this.lineBuffer = this.device.createBuffer({
        label: 'Lines Segment Buffer',
        size: this.lineCapacity,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    if (count > 0) {
      this.device.queue.writeBuffer(this.lineBuffer, 0, data.buffer as ArrayBuffer, data.byteOffset, count * LINE_SEGMENT_BYTES);
    }
    return this.lineBuffer;
  }

  /**
   * Uploads glyph data for KKS and dimension labels, resizing buffer if needed.
   */
  public updateText(data: Float32Array, count: number): GPUBuffer {
    const requiredBytes = Math.max(count * TEXT_GLYPH_BYTES, 1024);
    if (!this.textBuffer || this.textCapacity < requiredBytes) {
      if (this.textBuffer) {
        this.textBuffer.destroy();
      }
      this.textCapacity = Math.ceil(requiredBytes * 1.2);
      this.textBuffer = this.device.createBuffer({
        label: 'MSDF Text Buffer',
        size: this.textCapacity,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    if (count > 0) {
      this.device.queue.writeBuffer(this.textBuffer, 0, data.buffer as ArrayBuffer, data.byteOffset, count * TEXT_GLYPH_BYTES);
    }
    return this.textBuffer;
  }

  public getInstanceBuffer(): GPUBuffer | null {
    return this.instanceBuffer;
  }

  public getLineBuffer(): GPUBuffer | null {
    return this.lineBuffer;
  }

  public getTextBuffer(): GPUBuffer | null {
    return this.textBuffer;
  }

  public dispose(): void {
    if (this.instanceBuffer) {
      this.instanceBuffer.destroy();
      this.instanceBuffer = null;
    }
    if (this.lineBuffer) {
      this.lineBuffer.destroy();
      this.lineBuffer = null;
    }
    if (this.textBuffer) {
      this.textBuffer.destroy();
      this.textBuffer = null;
    }
  }
}

