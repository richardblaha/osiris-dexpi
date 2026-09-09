/**
 * WebGPU Engine - Core Types and Memory Layout Definitions
 *
 * Defines WebGPU ambient interfaces (zero external npm dependencies required)
 * and binary POD (Plain Old Data) layouts strictly compliant with WGSL std430 alignment rules.
 */

// ============================================================================
// Ambient WebGPU API declarations
// ============================================================================

export type GPUBufferUsageFlags = number;
export type GPUShaderStageFlags = number;
export type GPUTextureFormat = string;

export interface GPUObjectDescriptorBase {
  label?: string;
}

export interface GPUBufferDescriptor extends GPUObjectDescriptorBase {
  size: number;
  usage: GPUBufferUsageFlags;
  mappedAtCreation?: boolean;
}

export interface GPUBuffer {
  readonly size: number;
  readonly usage: GPUBufferUsageFlags;
  destroy(): void;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>;
}

export interface GPUTextureDescriptor extends GPUObjectDescriptorBase {
  size: [number, number, number?] | { width: number; height: number; depthOrArrayLayers?: number };
  format: GPUTextureFormat;
  usage: number;
}

export interface GPUTextureViewDescriptor extends GPUObjectDescriptorBase {
  format?: GPUTextureFormat;
}

export interface GPUTextureView {}

export interface GPUTexture {
  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
  destroy(): void;
}

export interface GPUSamplerDescriptor extends GPUObjectDescriptorBase {
  addressModeU?: string;
  addressModeV?: string;
  magFilter?: string;
  minFilter?: string;
}

export interface GPUSampler {}

export interface GPUShaderModuleDescriptor extends GPUObjectDescriptorBase {
  code: string;
}

export interface GPUShaderModule {}

export interface GPUBindGroupLayoutDescriptor extends GPUObjectDescriptorBase {
  entries: Array<{
    binding: number;
    visibility: GPUShaderStageFlags;
    buffer?: {
      type?: 'uniform' | 'storage' | 'read-only-storage';
      hasDynamicOffset?: boolean;
      minBindingSize?: number;
    };
    texture?: {
      sampleType?: string;
      viewDimension?: string;
    };
    sampler?: {
      type?: 'filtering' | 'non-filtering' | 'comparison';
    };
  }>;
}

export interface GPUBindGroupLayout {}

export interface GPUBindGroupDescriptor extends GPUObjectDescriptorBase {
  layout: GPUBindGroupLayout;
  entries: Array<{
    binding: number;
    resource: { buffer: GPUBuffer; offset?: number; size?: number } | GPUTextureView | GPUSampler;
  }>;
}

export interface GPUBindGroup {}

export interface GPUPipelineLayoutDescriptor extends GPUObjectDescriptorBase {
  bindGroupLayouts: GPUBindGroupLayout[];
}

export interface GPUPipelineLayout {}

export interface GPUVertexBufferLayout {
  arrayStride: number;
  stepMode?: 'vertex' | 'instance';
  attributes: Array<{
    format: string;
    offset: number;
    shaderLocation: number;
  }>;
}

export interface GPURenderPipelineDescriptor extends GPUObjectDescriptorBase {
  layout: GPUPipelineLayout | 'auto';
  vertex: {
    module: GPUShaderModule;
    entryPoint: string;
    buffers?: GPUVertexBufferLayout[];
  };
  fragment?: {
    module: GPUShaderModule;
    entryPoint: string;
    targets: Array<{
      format: GPUTextureFormat;
      blend?: {
        color: { srcFactor: string; dstFactor: string; operation?: string };
        alpha: { srcFactor: string; dstFactor: string; operation?: string };
      };
      writeMask?: number;
    }>;
  };
  primitive?: {
    topology?: 'triangle-list' | 'triangle-strip' | 'line-list' | 'line-strip';
    cullMode?: 'none' | 'front' | 'back';
    frontFace?: 'ccw' | 'cw';
  };
  multisample?: {
    count?: number;
  };
}

export interface GPURenderPipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

export interface GPUColorAttachment {
  view: GPUTextureView;
  resolveTarget?: GPUTextureView;
  clearValue?: { r: number; g: number; b: number; a: number };
  loadOp: 'load' | 'clear';
  storeOp: 'store' | 'discard';
}

export interface GPURenderPassDescriptor extends GPUObjectDescriptorBase {
  colorAttachments: GPUColorAttachment[];
}

export interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]): void;
  setVertexBuffer(slot: number, buffer: GPUBuffer, offset?: number, size?: number): void;
  setIndexBuffer(buffer: GPUBuffer, indexFormat: 'uint16' | 'uint32', offset?: number, size?: number): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number): void;
  end(): void;
}

export interface GPUCommandBuffer {}

export interface GPUCommandEncoderDescriptor extends GPUObjectDescriptorBase {}

export interface GPUCommandEncoder {
  beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

export interface GPUQueue {
  writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

export interface GPUDevice {
  readonly queue: GPUQueue;
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
  createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
  destroy(): void;
}

export interface GPUAdapter {
  requestDevice(descriptor?: {
    requiredLimits?: Record<string, number>;
  }): Promise<GPUDevice>;
}

export interface GPUCanvasContext {
  configure(configuration: {
    device: GPUDevice;
    format: GPUTextureFormat;
    alphaMode?: 'opaque' | 'premultiplied';
  }): void;
  getCurrentTexture(): GPUTexture;
  unconfigure(): void;
}

export interface GPU {
  requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

declare global {
  interface Navigator {
    readonly gpu?: GPU;
  }
}

// WebGPU Usage Constants
export const GPUBufferUsage = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
} as const;

export const GPUShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
} as const;

// ============================================================================
// POD Binary Memory Layouts (std430 / std140 Compliant)
// ============================================================================

/** Camera uniforms (Total size: 80 bytes, aligned to 256 bytes for standard uniform offsets) */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Symbol Instance Layout (Total size: 80 bytes = 20 float32s / uint32s, align: 16 bytes)
 *
 * Byte Offsets:
 *   [0..15]   transform_row0: vec4<f32> (m00, m01, 0.0, tx)
 *   [16..31]  transform_row1: vec4<f32> (m10, m11, 0.0, ty)
 *   [32..47]  color_primary: vec4<f32> (r, g, b, a)
 *   [48..63]  color_secondary: vec4<f32> (r, g, b, a)
 *   [64..67]  symbol_type_id: u32
 *   [68..71]  flags: u32 (bit 0: selected, bit 1: hovered, bit 2: mirrorX, bit 3: mirrorY)
 *   [72..75]  entity_id: u32 (integer ID for picking)
 *   [76..79]  lod_min_zoom: f32
 */
export const SYMBOL_INSTANCE_FLOATS = 20;
export const SYMBOL_INSTANCE_BYTES = 80;

export const SYMBOL_FLAGS = {
  SELECTED: 1 << 0,
  HOVERED: 1 << 1,
  MIRROR_X: 1 << 2,
  MIRROR_Y: 1 << 3,
} as const;

/**
 * Line Segment Layout (Total size: 48 bytes = 12 float32s / uint32s, align: 16 bytes)
 *
 * Byte Offsets:
 *   [0..7]    point_a: vec2<f32> (x, y)
 *   [8..15]   point_b: vec2<f32> (x, y)
 *   [16..19]  width_px: f32
 *   [20..23]  style_flags: u32 (bit 0-3: solid/dash/dot, bit 4: jumper_arc)
 *   [24..27]  entity_id: u32
 *   [28..31]  _pad0: u32
 *   [32..47]  color: vec4<f32> (r, g, b, a)
 */
export const LINE_SEGMENT_FLOATS = 12;
export const LINE_SEGMENT_BYTES = 48;

export const LINE_STYLE = {
  SOLID: 0,
  DASHED: 1,
  DOTTED: 2,
  JUMPER_ARC: 1 << 4,
} as const;

/**
 * Text Glyph Layout (Total size: 64 bytes = 16 float32s / uint32s, align: 16 bytes)
 *
 * Byte Offsets:
 *   [0..7]    pos_min: vec2<f32> (x0, y0)
 *   [8..15]   pos_max: vec2<f32> (x1, y1)
 *   [16..23]  uv_min: vec2<f32> (u0, v0)
 *   [24..31]  uv_max: vec2<f32> (u1, v1)
 *   [32..47]  color: vec4<f32> (r, g, b, a)
 *   [48..51]  screen_pixel_size: f32
 *   [52..55]  entity_id: u32
 *   [56..63]  _pad: vec2<u32>
 */
export const TEXT_GLYPH_FLOATS = 16;
export const TEXT_GLYPH_BYTES = 64;

export interface SymbolMeshSlice {
  symbolTypeId: number;
  name: string;
  firstIndex: number;
  indexCount: number;
  baseVertex: number;
}

