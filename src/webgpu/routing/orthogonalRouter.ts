/**
 * High-Performance CAD Orthogonal Router (A* with Turn Penalty & Obstacle Avoidance)
 *
 * Computes 90-degree orthogonal routes between equipment nozzles,
 * strictly avoiding equipment bodies and minimizing bend count.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface RouteObstacle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RouteRequest {
  start: Point2D;
  end: Point2D;
  startDir?: Point2D; // Initial exit direction (e.g. [1, 0] or [0, -1])
  endDir?: Point2D;   // Final entry direction
  obstacles?: RouteObstacle[];
  gridSize?: number;  // Grid step resolution (default 10)
  bendPenalty?: number; // Cost added for each 90-degree turn (default 50)
  margin?: number;    // Clearance margin around obstacles (default 10)
}

interface SearchNode {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  gScore: number;
  fScore: number;
  parent: SearchNode | null;
}

export class OrthogonalRouter {
  /**
   * Routes an orthogonal polyline between start and end.
   * Returns sequence of bend points (waypoints) including start and end.
   */
  public static route(req: RouteRequest): Point2D[] {
    const {
      start,
      end,
      obstacles = [],
      gridSize = 10,
      bendPenalty = 40,
      margin = 10,
    } = req;

    // Fast-path: Check simple orthogonal L-route or straight line
    if (this.canConnectDirectly(start, end, obstacles, margin)) {
      return this.generateDirectRoute(start, end, req.startDir, req.endDir);
    }

    // Grid snapping
    const sx = Math.round(start.x / gridSize) * gridSize;
    const sy = Math.round(start.y / gridSize) * gridSize;
    const tx = Math.round(end.x / gridSize) * gridSize;
    const ty = Math.round(end.y / gridSize) * gridSize;

    // Expand bounding box for search space
    const boundsMinX = Math.min(sx, tx) - 200;
    const boundsMaxX = Math.max(sx, tx) + 200;
    const boundsMinY = Math.min(sy, ty) - 200;
    const boundsMaxY = Math.max(sy, ty) + 200;

    // Expanded obstacles with clearance margin
    const expandedObstacles = obstacles.map((o) => ({
      minX: o.minX - margin,
      minY: o.minY - margin,
      maxX: o.maxX + margin,
      maxY: o.maxY + margin,
    }));

    // Open set priority queue (min-heap / sorted array)
    const openSet: SearchNode[] = [];
    // Visited map: key = `${x},${y},${dirX},${dirY}`
    const closedSet = new Set<string>();

    const startNode: SearchNode = {
      x: sx,
      y: sy,
      dirX: req.startDir ? req.startDir.x : 0,
      dirY: req.startDir ? req.startDir.y : 0,
      gScore: 0,
      fScore: this.manhattan(sx, sy, tx, ty),
      parent: null,
    };
    openSet.push(startNode);

    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    let closestNode = startNode;
    let minDistanceToTarget = Infinity;
    let iterations = 0;
    const maxIterations = 2000;

    while (openSet.length > 0 && iterations++ < maxIterations) {
      // Find lowest fScore node
      let bestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].fScore < openSet[bestIdx].fScore) {
          bestIdx = i;
        }
      }
      const current = openSet.splice(bestIdx, 1)[0];

      // Reached target?
      if (current.x === tx && current.y === ty) {
        return this.reconstructPath(start, end, current);
      }

      const dist = this.manhattan(current.x, current.y, tx, ty);
      if (dist < minDistanceToTarget) {
        minDistanceToTarget = dist;
        closestNode = current;
      }

      const stateKey = `${current.x},${current.y},${current.dirX},${current.dirY}`;
      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      for (const dir of directions) {
        // Disallow immediate 180-degree U-turn
        if (current.dirX !== 0 && dir.dx === -current.dirX) continue;
        if (current.dirY !== 0 && dir.dy === -current.dirY) continue;

        const nextX = current.x + dir.dx * gridSize;
        const nextY = current.y + dir.dy * gridSize;

        // Check search space bounds
        if (
          nextX < boundsMinX ||
          nextX > boundsMaxX ||
          nextY < boundsMinY ||
          nextY > boundsMaxY
        ) {
          continue;
        }

        // Check obstacle collision (allow start and target cells)
        const isTarget = nextX === tx && nextY === ty;
        const isStart = nextX === sx && nextY === sy;
        if (!isTarget && !isStart && this.isInsideObstacle(nextX, nextY, expandedObstacles)) {
          continue;
        }

        // Turn penalty calculation
        const isTurn =
          (current.dirX !== 0 || current.dirY !== 0) &&
          (dir.dx !== current.dirX || dir.dy !== current.dirY);
        const stepCost = gridSize + (isTurn ? bendPenalty : 0);

        const tentativeG = current.gScore + stepCost;
        const hScore = this.manhattan(nextX, nextY, tx, ty);

        const nextNode: SearchNode = {
          x: nextX,
          y: nextY,
          dirX: dir.dx,
          dirY: dir.dy,
          gScore: tentativeG,
          fScore: tentativeG + hScore,
          parent: current,
        };

        openSet.push(nextNode);
      }
    }

    // Fallback: reconstruct best path reached
    return this.reconstructPath(start, end, closestNode);
  }

  private static manhattan(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  private static isInsideObstacle(x: number, y: number, obstacles: RouteObstacle[]): boolean {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (x >= o.minX && x <= o.maxX && y >= o.minY && y <= o.maxY) {
        return true;
      }
    }
    return false;
  }

  private static canConnectDirectly(
    start: Point2D,
    end: Point2D,
    obstacles: RouteObstacle[],
    margin: number
  ): boolean {
    if (obstacles.length === 0) return true;

    // If straight horizontal
    if (start.y === end.y) {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      for (const o of obstacles) {
        if (start.y >= o.minY - margin && start.y <= o.maxY + margin) {
          if (maxX >= o.minX - margin && minX <= o.maxX + margin) return false;
        }
      }
      return true;
    }

    // If straight vertical
    if (start.x === end.x) {
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      for (const o of obstacles) {
        if (start.x >= o.minX - margin && start.x <= o.maxX + margin) {
          if (maxY >= o.minY - margin && minY <= o.maxY + margin) return false;
        }
      }
      return true;
    }

    return false;
  }

  private static generateDirectRoute(
    start: Point2D,
    end: Point2D,
    startDir?: Point2D,
    endDir?: Point2D
  ): Point2D[] {
    if (start.x === end.x || start.y === end.y) {
      return [start, end];
    }

    // L-route: decide horizontal-first or vertical-first based on startDir
    if (startDir && startDir.x !== 0) {
      return [start, { x: end.x, y: start.y }, end];
    }
    if (startDir && startDir.y !== 0) {
      return [start, { x: start.x, y: end.y }, end];
    }

    return [start, { x: end.x, y: start.y }, end];
  }

  private static reconstructPath(start: Point2D, end: Point2D, endNode: SearchNode): Point2D[] {
    const rawPoints: Point2D[] = [];
    let curr: SearchNode | null = endNode;
    while (curr) {
      rawPoints.push({ x: curr.x, y: curr.y });
      curr = curr.parent;
    }
    rawPoints.reverse();

    if (rawPoints.length === 0) {
      return [start, end];
    }

    // Replace first and last with exact start/end positions
    rawPoints[0] = start;
    rawPoints[rawPoints.length - 1] = end;

    // Collinear point reduction (merge straight segments)
    const simplified: Point2D[] = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const p = rawPoints[i];
      const next = rawPoints[i + 1];

      // Check if p is strictly collinear with prev and next
      const isCollinearX = prev.x === p.x && p.x === next.x;
      const isCollinearY = prev.y === p.y && p.y === next.y;

      if (!isCollinearX && !isCollinearY) {
        simplified.push(p);
      }
    }
    simplified.push(end);

    return simplified;
  }
}

