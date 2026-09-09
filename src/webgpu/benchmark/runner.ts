/**
 * Benchmark Profile Runner
 *
 * Runs headless benchmark measurements on plant schematic datasets.
 */

import { PlantSchematicGenerator, BenchmarkOptions } from './generator';
import { WebGpuPidAdapter, GpuBufferPackage } from '../adapter';

export interface BenchmarkMetrics {
  nodeCount: number;
  edgeCount: number;
  totalSegments: number;
  totalGlyphs: number;
  generationTimeMs: number;
  adapterConversionTimeMs?: number;
  totalMemoryBytes: number;
  totalMemoryMb: number;
}

export class BenchmarkRunner {
  /**
   * Executes a direct binary buffer generation benchmark.
   */
  public static benchmarkDirectGeneration(options: BenchmarkOptions): {
    metrics: BenchmarkMetrics;
    package: GpuBufferPackage;
  } {
    const start = performance.now();
    const pkg = PlantSchematicGenerator.generateDirectGpuBuffers(options);
    const duration = performance.now() - start;

    const totalBytes =
      pkg.instances.byteLength + pkg.lines.byteLength + pkg.glyphs.byteLength;

    const metrics: BenchmarkMetrics = {
      nodeCount: options.nodeCount,
      edgeCount: options.edgeCount,
      totalSegments: pkg.lineCount,
      totalGlyphs: pkg.glyphCount,
      generationTimeMs: Math.round(duration * 100) / 100,
      totalMemoryBytes: totalBytes,
      totalMemoryMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    };

    return { metrics, package: pkg };
  }

  /**
   * Executes a full PidView object model generation + adapter serialization benchmark.
   */
  public static benchmarkFullPipeline(options: BenchmarkOptions): {
    metrics: BenchmarkMetrics;
    package: GpuBufferPackage;
  } {
    const genStart = performance.now();
    const view = PlantSchematicGenerator.generatePidView(options);
    const genDuration = performance.now() - genStart;

    const adapter = new WebGpuPidAdapter();
    const adaptStart = performance.now();
    const pkg = adapter.projectToGpuBuffers(view);
    const adaptDuration = performance.now() - adaptStart;

    const totalBytes =
      pkg.instances.byteLength + pkg.lines.byteLength + pkg.glyphs.byteLength;

    const metrics: BenchmarkMetrics = {
      nodeCount: options.nodeCount,
      edgeCount: options.edgeCount,
      totalSegments: pkg.lineCount,
      totalGlyphs: pkg.glyphCount,
      generationTimeMs: Math.round(genDuration * 100) / 100,
      adapterConversionTimeMs: Math.round(adaptDuration * 100) / 100,
      totalMemoryBytes: totalBytes,
      totalMemoryMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    };

    return { metrics, package: pkg };
  }
}

