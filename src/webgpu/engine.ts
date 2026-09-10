/**
 * WebGPU P&ID Render Engine
 *
 * Coordinates pipelines for instanced parametric symbols, thick orthogonal lines,
 * and MSDF text labels with smooth 60 FPS camera manipulation.
 */

import {
  GPUDevice,
  GPUAdapter,
  GPUCanvasContext,
  GPUTextureFormat,
  GPURenderPipeline,
  GPUBuffer,
  GPUBindGroup,
  GPUTexture,
  GPUSampler,
  GPUBufferUsage,
  CameraState,
  SymbolMeshSlice,
} from './types';
import { SYMBOLS_WGSL } from './shaders/symbols.wgsl';
import { LINES_WGSL } from './shaders/lines.wgsl';
import { TEXT_WGSL } from './shaders/text.wgsl';
import { GpuBufferManager } from './bufferManager';
import { WebGpuPidAdapter, GpuBufferPackage } from './adapter';
import type { PidView } from '../model/view/projection';

export class WebGpuPidEngine {
  private adapter!: GPUAdapter;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private bufferManager!: GpuBufferManager;
  private pidAdapter = new WebGpuPidAdapter();

  // Uniforms
  private cameraUniformBuffer!: GPUBuffer;

  // Pipelines
  private symbolPipeline!: GPURenderPipeline;
  private linePipeline!: GPURenderPipeline;
  private textPipeline!: GPURenderPipeline;

  // Bind groups
  private symbolBindGroup!: GPUBindGroup;
  private lineBindGroup!: GPUBindGroup;
  private textBindGroup!: GPUBindGroup;

  // Stencil Mesh Geometry (Vessels, Valves, Pumps, Instruments)
  private stencilVertexBuffer!: GPUBuffer;
  private stencilIndexBuffer!: GPUBuffer;
  private stencilSlices = new Map<number, SymbolMeshSlice>();

  // Text Atlas
  private dummyAtlasTexture!: GPUTexture;
  private atlasSampler!: GPUSampler;

  // Counts and batches for rendering
  private activeInstanceCount = 0;
  private activeLineCount = 0;
  private activeGlyphCount = 0;
  private instanceBatches: Array<{ symbolTypeId: number; firstInstance: number; count: number }> = [];

  // Render loop control
  private animationFrameId: number | null = null;
  private isRunning = false;

  public camera: CameraState = {
    x: 0,
    y: 0,
    zoom: 1.0,
    viewportWidth: 800,
    viewportHeight: 600,
  };

  constructor(private readonly canvas: HTMLCanvasElement) {}

  public async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported by this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) {
      throw new Error('Could not acquire WebGPU adapter.');
    }
    this.adapter = adapter;

    this.device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: 256 * 1024 * 1024,
      },
    });

    this.context = this.canvas.getContext('webgpu') as unknown as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this.bufferManager = new GpuBufferManager(this.device);

    this.setupCameraUniforms();
    this.setupMasterStencilMeshes();
    this.setupAtlasTexture();
    this.setupPipelines();
    this.setupEventListeners();
  }

  private setupCameraUniforms(): void {
    // 256 bytes buffer for uniform alignment
    this.cameraUniformBuffer = this.device.createBuffer({
      label: 'Camera Uniforms Buffer',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private setupMasterStencilMeshes(): void {
    const vertices: number[] = [];
    const indices: number[] = [];

    const addSlice = (typeId: number, name: string, verts: number[], idxs: number[]) => {
      const baseVertex = vertices.length / 3;
      const firstIndex = indices.length;
      for (const v of verts) vertices.push(v);
      for (const i of idxs) indices.push(i);
      this.stencilSlices.set(typeId, {
        symbolTypeId: typeId,
        name,
        firstIndex,
        indexCount: idxs.length,
        baseVertex,
      });
    };

    // 0: Valve (two opposing triangles)
    addSlice(
      0,
      'valve',
      [
        -0.5, -0.3, 1.0,
         0.5, -0.3, 1.0,
         0.0,  0.0, 1.0,
         0.5,  0.3, 1.0,
        -0.5,  0.3, 1.0,
      ],
      [0, 1, 2, 2, 3, 4]
    );

    // 1: Centrifugal Pump (circle + tangential nozzle)
    const pumpVerts: number[] = [0, -0.05, 0.0];
    const pumpIndices: number[] = [];
    const pumpSteps = 8;
    const pumpRadius = 0.35;
    for (let i = 0; i < pumpSteps; i++) {
      const angle = (i * 2 * Math.PI) / pumpSteps;
      pumpVerts.push(Math.cos(angle) * pumpRadius, -0.05 + Math.sin(angle) * pumpRadius, 1.0);
    }
    for (let i = 0; i < pumpSteps; i++) {
      pumpIndices.push(0, 1 + i, 1 + ((i + 1) % pumpSteps));
    }
    pumpVerts.push(0.35, -0.05, 1.0, 0.35, 0.45, 1.0, 0.15, 0.45, 1.0);
    pumpIndices.push(9, 10, 11);
    addSlice(1, 'pump', pumpVerts, pumpIndices);

    // 2: Vessel / Tank (cylinder + top and bottom dished heads)
    addSlice(
      2,
      'vessel',
      [
        -0.35, -0.35, 1.0,
         0.35, -0.35, 1.0,
         0.35,  0.35, 1.0,
        -0.35,  0.35, 1.0,
         0.0,   0.5,  1.0,
         0.0,  -0.5,  1.0,
      ],
      [0, 1, 2, 2, 3, 0, 3, 2, 4, 0, 5, 1]
    );

    // 3: Process Instrument (circle bubble)
    const instVerts: number[] = [0, 0, 0.0];
    const instIndices: number[] = [];
    const instSteps = 8;
    for (let i = 0; i < instSteps; i++) {
      const angle = (i * 2 * Math.PI) / instSteps;
      instVerts.push(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, 1.0);
    }
    for (let i = 0; i < instSteps; i++) {
      instIndices.push(0, 1 + i, 1 + ((i + 1) % instSteps));
    }
    addSlice(3, 'instrument', instVerts, instIndices);

    // 4: Heat Exchanger
    addSlice(
      4,
      'heatExchanger',
      [
        -0.45, -0.45, 1.0,
         0.45, -0.45, 1.0,
         0.45,  0.45, 1.0,
        -0.45,  0.45, 1.0,
        -0.4,   0.0,  1.0,
         0.4,   0.0,  1.0,
      ],
      [0, 1, 2, 2, 3, 0, 4, 5, 2]
    );

    // 5: Compressor (trapezoid)
    addSlice(
      5,
      'compressor',
      [
        -0.4, -0.4, 1.0,
        -0.4,  0.4, 1.0,
         0.4,  0.2, 1.0,
         0.4, -0.2, 1.0,
      ],
      [0, 1, 2, 2, 3, 0]
    );

    // 6: Nozzle / Port (flange)
    addSlice(
      6,
      'nozzle',
      [
        -0.2, -0.4, 1.0,
         0.2, -0.4, 1.0,
         0.2, -0.2, 1.0,
        -0.2, -0.2, 1.0,
      ],
      [0, 1, 2, 2, 3, 0]
    );

    const vArray = new Float32Array(vertices);
    const iArray = new Uint16Array(indices);

    this.stencilVertexBuffer = this.device.createBuffer({
      label: 'Master Stencil Vertex Buffer',
      size: vArray.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.stencilVertexBuffer, 0, vArray);

    this.stencilIndexBuffer = this.device.createBuffer({
      label: 'Master Stencil Index Buffer',
      size: iArray.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.stencilIndexBuffer, 0, iArray);
  }

  private setupAtlasTexture(): void {
    // 4x4 MSDF placeholder texture
    this.dummyAtlasTexture = this.device.createTexture({
      label: 'MSDF Texture Atlas',
      size: [4, 4, 1],
      format: 'rgba8unorm',
      usage: 0x04 | 0x08, // TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST
    });

    this.atlasSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
  }

  private setupPipelines(): void {
    // 1. Symbol Pipeline
    const symbolShader = this.device.createShaderModule({ code: SYMBOLS_WGSL });
    const symbolBGL = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: 0x1, buffer: { type: 'uniform' } },
        { binding: 1, visibility: 0x1, buffer: { type: 'read-only-storage' } },
      ],
    });
    const symbolLayout = this.device.createPipelineLayout({ bindGroupLayouts: [symbolBGL] });
    this.symbolPipeline = this.device.createRenderPipeline({
      layout: symbolLayout,
      vertex: {
        module: symbolShader,
        entryPoint: 'vs_symbol_main',
        buffers: [
          {
            arrayStride: 12, // vec2<f32> + f32
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32' },
            ],
          },
        ],
      },
      fragment: {
        module: symbolShader,
        entryPoint: 'fs_symbol_main',
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    // 2. Lines Pipeline
    const linesShader = this.device.createShaderModule({ code: LINES_WGSL });
    const linesBGL = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: 0x1, buffer: { type: 'uniform' } },
        { binding: 1, visibility: 0x1, buffer: { type: 'read-only-storage' } },
      ],
    });
    const linesLayout = this.device.createPipelineLayout({ bindGroupLayouts: [linesBGL] });
    this.linePipeline = this.device.createRenderPipeline({
      layout: linesLayout,
      vertex: {
        module: linesShader,
        entryPoint: 'vs_thick_line',
      },
      fragment: {
        module: linesShader,
        entryPoint: 'fs_thick_line',
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    // 3. Text Pipeline
    const textShader = this.device.createShaderModule({ code: TEXT_WGSL });
    const textBGL = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: 0x1, buffer: { type: 'uniform' } },
        { binding: 1, visibility: 0x1, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: 0x2, texture: { sampleType: 'float' } },
        { binding: 3, visibility: 0x2, sampler: { type: 'filtering' } },
      ],
    });
    const textLayout = this.device.createPipelineLayout({ bindGroupLayouts: [textBGL] });
    this.textPipeline = this.device.createRenderPipeline({
      layout: textLayout,
      vertex: {
        module: textShader,
        entryPoint: 'vs_msdf_text',
      },
      fragment: {
        module: textShader,
        entryPoint: 'fs_msdf_text',
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });
  }

  public loadPidView(view: PidView): void {
    const pkg = this.pidAdapter.projectToGpuBuffers(view);
    this.loadBuffers(pkg);
  }

  public loadBuffers(pkg: GpuBufferPackage): void {
    this.activeInstanceCount = pkg.instanceCount;
    this.activeLineCount = pkg.lineCount;
    this.activeGlyphCount = pkg.glyphCount;
    this.instanceBatches = pkg.instanceBatches || [];

    const instBuf = this.bufferManager.updateInstances(pkg.instances, pkg.instanceCount);
    const lineBuf = this.bufferManager.updateLines(pkg.lines, pkg.lineCount);
    const textBuf = this.bufferManager.updateText(pkg.glyphs, pkg.glyphCount);

    // Rebind descriptors
    this.symbolBindGroup = this.device.createBindGroup({
      layout: this.symbolPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniformBuffer } },
        { binding: 1, resource: { buffer: instBuf } },
      ],
    });

    this.lineBindGroup = this.device.createBindGroup({
      layout: this.linePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniformBuffer } },
        { binding: 1, resource: { buffer: lineBuf } },
      ],
    });

    this.textBindGroup = this.device.createBindGroup({
      layout: this.textPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraUniformBuffer } },
        { binding: 1, resource: { buffer: textBuf } },
        { binding: 2, resource: this.dummyAtlasTexture.createView() },
        { binding: 3, resource: this.atlasSampler },
      ],
    });
  }

  private updateCameraUniforms(): void {
    const { x, y, zoom, viewportWidth, viewportHeight } = this.camera;

    const halfW = viewportWidth / (2 * zoom);
    const halfH = viewportHeight / (2 * zoom);

    const left = x - halfW;
    const right = x + halfW;
    const top = y - halfH;
    const bottom = y + halfH;

    const sx = 2 / (right - left);
    const sy = 2 / (top - bottom);
    const tx = -(right + left) / (right - left);
    const ty = -(top + bottom) / (top - bottom);

    const uniformData = new Float32Array([
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, 1, 0,
      tx, ty, 0, 1,
      viewportWidth, viewportHeight, zoom, 0.0,
    ]);

    if (!this.device || !this.cameraUniformBuffer) return;
    this.device.queue.writeBuffer(this.cameraUniformBuffer, 0, uniformData);
  }

  public renderFrame(): void {
    if (!this.device || !this.context) return;
    this.updateCameraUniforms();

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.08, g: 0.1, b: 0.12, a: 1.0 }, // Osiris dark CAD
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    // 1. Draw Lines
    if (this.activeLineCount > 0 && this.lineBindGroup) {
      renderPass.setPipeline(this.linePipeline);
      renderPass.setBindGroup(0, this.lineBindGroup);
      renderPass.draw(6, this.activeLineCount, 0, 0);
    }

    // 2. Draw Symbols
    if (this.activeInstanceCount > 0 && this.symbolBindGroup) {
      renderPass.setPipeline(this.symbolPipeline);
      renderPass.setBindGroup(0, this.symbolBindGroup);
      renderPass.setVertexBuffer(0, this.stencilVertexBuffer);
      renderPass.setIndexBuffer(this.stencilIndexBuffer, 'uint16');

      if (this.instanceBatches.length > 0) {
        for (const batch of this.instanceBatches) {
          const slice = this.stencilSlices.get(batch.symbolTypeId) || this.stencilSlices.get(0)!;
          renderPass.drawIndexed(
            slice.indexCount,
            batch.count,
            slice.firstIndex,
            slice.baseVertex,
            batch.firstInstance
          );
        }
      } else {
        const slice = this.stencilSlices.get(0)!;
        renderPass.drawIndexed(slice.indexCount, this.activeInstanceCount, slice.firstIndex, slice.baseVertex, 0);
      }
    }

    // 3. Draw Text
    if (this.activeGlyphCount > 0 && this.textBindGroup) {
      renderPass.setPipeline(this.textPipeline);
      renderPass.setBindGroup(0, this.textBindGroup);
      renderPass.draw(6, this.activeGlyphCount, 0, 0);
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = () => {
      if (!this.isRunning) return;
      this.renderFrame();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private setupEventListeners(): void {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      this.camera.x -= dx / this.camera.zoom;
      this.camera.y -= dy / this.camera.zoom;
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        this.camera.zoom = Math.max(0.005, Math.min(100.0, this.camera.zoom * factor));
      },
      { passive: false }
    );
  }

  public dispose(): void {
    this.stop();
    this.bufferManager.dispose();
    if (this.cameraUniformBuffer) this.cameraUniformBuffer.destroy();
    if (this.stencilVertexBuffer) this.stencilVertexBuffer.destroy();
    if (this.stencilIndexBuffer) this.stencilIndexBuffer.destroy();
    if (this.dummyAtlasTexture) this.dummyAtlasTexture.destroy();
    if (this.device) this.device.destroy();
  }
}

