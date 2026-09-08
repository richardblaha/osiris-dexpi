import { registerDefaultShapes } from '@maxgraph/core';
import { registerPidStencils } from '../stencils/registry';

let shapesRegistered = false;

/**
 * Registers the maxGraph default shapes plus the professional P&ID stencil library
 * (draw.io Apache-2.0 stencils + local ISA-5.1 instrument bubbles) with the
 * {@link StencilShapeRegistry}. Idempotent.
 */
export function registerPidShapes(): void {
  if (shapesRegistered) return;
  registerDefaultShapes();
  registerPidStencils();
  shapesRegistered = true;
}
