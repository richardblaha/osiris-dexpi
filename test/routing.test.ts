import { describe, it, expect } from 'vitest';
import {
  OrthogonalRouter,
  JumperDetector,
  type OrthogonalSegment,
} from '../src/webgpu';

describe('OrthogonalRouter (A* CAD Routing)', () => {
  it('connects two aligned points with a direct straight line', () => {
    const waypoints = OrthogonalRouter.route({
      start: { x: 50, y: 100 },
      end: { x: 250, y: 100 },
      gridSize: 10,
    });

    expect(waypoints).toHaveLength(2);
    expect(waypoints[0]).toEqual({ x: 50, y: 100 });
    expect(waypoints[1]).toEqual({ x: 250, y: 100 });
  });

  it('generates an L-shaped orthogonal route when no obstacles exist', () => {
    const waypoints = OrthogonalRouter.route({
      start: { x: 50, y: 50 },
      end: { x: 150, y: 150 },
      startDir: { x: 1, y: 0 },
      gridSize: 10,
    });

    expect(waypoints).toHaveLength(3);
    expect(waypoints[0]).toEqual({ x: 50, y: 50 });
    expect(waypoints[1]).toEqual({ x: 150, y: 50 });
    expect(waypoints[2]).toEqual({ x: 150, y: 150 });
  });

  it('navigates around an equipment obstacle without penetrating its bounding box', () => {
    // Vessel obstacle placed directly between start and end
    const obstacle = {
      minX: 80,
      minY: 60,
      maxX: 140,
      maxY: 140,
    };

    const start = { x: 40, y: 100 };
    const end = { x: 180, y: 100 };

    const waypoints = OrthogonalRouter.route({
      start,
      end,
      obstacles: [obstacle],
      gridSize: 10,
      bendPenalty: 30,
      margin: 10,
    });

    expect(waypoints.length).toBeGreaterThanOrEqual(4);
    expect(waypoints[0]).toEqual(start);
    expect(waypoints[waypoints.length - 1]).toEqual(end);

    // Verify none of the intermediate segments penetrate the obstacle interior
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      // If segment is horizontal
      if (p1.y === p2.y) {
        const segY = p1.y;
        if (segY > obstacle.minY && segY < obstacle.maxY) {
          const segMinX = Math.min(p1.x, p2.x);
          const segMaxX = Math.max(p1.x, p2.x);
          const overlapsX = segMinX < obstacle.maxX && segMaxX > obstacle.minX;
          expect(overlapsX).toBe(false);
        }
      }
      // If segment is vertical
      if (p1.x === p2.x) {
        const segX = p1.x;
        if (segX > obstacle.minX && segX < obstacle.maxX) {
          const segMinY = Math.min(p1.y, p2.y);
          const segMaxY = Math.max(p1.y, p2.y);
          const overlapsY = segMinY < obstacle.maxY && segMaxY > obstacle.minY;
          expect(overlapsY).toBe(false);
        }
      }
    }
  });
});

describe('JumperDetector (CAD Line Crossing Bridge)', () => {
  it('detects perpendicular line crossing and generates a jumper arc on the lower priority line', () => {
    // Horizontal line (high priority)
    const segH: OrthogonalSegment = {
      id: 'pipe_horiz',
      p1: { x: 0, y: 50 },
      p2: { x: 100, y: 50 },
      priority: 10,
      isVertical: false,
    };

    // Vertical line (lower priority)
    const segV: OrthogonalSegment = {
      id: 'pipe_vert',
      p1: { x: 50, y: 0 },
      p2: { x: 50, y: 100 },
      priority: 5,
      isVertical: true,
    };

    const polylines = JumperDetector.processJumpers([segH, segV], {
      jumperRadius: 5,
      horizontalPriorityBonus: 10,
    });

    expect(polylines).toHaveLength(2);

    // Horizontal line should remain a clean 2-point line
    const resH = polylines.find((p) => p[0].x === 0 && p[p.length - 1].x === 100)!;
    expect(resH).toHaveLength(2);

    // Vertical line should have jumper arc points inserted around y = 50
    const resV = polylines.find((p) => p[0].y === 0 && p[p.length - 1].y === 100)!;
    expect(resV.length).toBeGreaterThan(2);

    // Verify jumper bulges away from center line
    const arcPoints = resV.filter((p) => p.x > 50);
    expect(arcPoints.length).toBeGreaterThan(0);
    const maxBulge = Math.max(...arcPoints.map((p) => p.x));
    expect(maxBulge).toBeGreaterThan(55);
  });
});
