/**
 * Graph-search algorithms for the Smart Urban Traffic Navigator.
 *
 * All five algorithms operate on the city road-network graph and return
 * a SearchResult: the path (list of node ids), total distance (km),
 * estimated travel time (minutes), number of nodes expanded, and the
 * congested segments along the path.
 *
 * Travel time is computed from per-segment distance and a speed adjusted
 * by simulated congestion. A* and Best-First Search use a heuristic
 * (straight-line / haversine distance to the goal). The Heuristic-Based
 * Search combines multiple heuristics (distance + traffic + safety)
 * according to the chosen route preference.
 */

import {
  RoadGraph,
  GraphEdge,
  haversineKm,
  getEdge,
  cityGraph,
} from './cityGraph';
import { getCongestionFactor, CongestionLevel } from './traffic';

export type AlgorithmName =
  | 'bfs'
  | 'dfs'
  | 'best_first'
  | 'a_star'
  | 'heuristic';

export type RoutePreference =
  | 'shortest'
  | 'fastest'
  | 'lowest_traffic'
  | 'safest'
  | 'balanced';

export interface CongestedSegment {
  roadName: string;
  from: string;
  to: string;
  level: CongestionLevel;
  delayMin: number;
}

export interface SearchResult {
  algorithm: AlgorithmName;
  algorithmLabel: string;
  path: string[];
  pathLabels: string[];
  totalDistanceKm: number;
  travelTimeMin: number;
  nodesExpanded: number;
  congestedSegments: CongestedSegment[];
  trafficLevel: CongestionLevel;
  safetyScore: number;
  /** nodes in the returned path */
  pathLength: number;
  found: boolean;
}

interface Step {
  node: string;
  gCost: number; // accumulated cost from start
  path: string[];
}

const ALGORITHM_LABELS: Record<AlgorithmName, string> = {
  bfs: 'Breadth-First Search',
  dfs: 'Depth-First Search',
  best_first: 'Best-First Search',
  a_star: 'A* Search',
  heuristic: 'Heuristic-Based Search',
};

function edgeCost(
  edge: GraphEdge,
  preference: RoutePreference,
  goalId: string,
  graph: RoadGraph
): number {
  const distKm = edge.distance / 1000;
  const congestionFactor = getCongestionFactor(edge, 'medium');
  const speedKmh = edge.baseSpeed * congestionFactor;
  const timeMin = (distKm / speedKmh) * 60;

  switch (preference) {
    case 'shortest':
      return distKm;
    case 'fastest':
      return timeMin;
    case 'lowest_traffic': {
      const penalty =
        getCongestionFactor(edge, 'medium') < 0.6 ? 1 : 5;
      return distKm + penalty * timeMin;
    }
    case 'safest':
      return distKm * (11 - edge.safety);
    case 'balanced':
      return distKm + timeMin * 0.5 + (11 - edge.safety) * 0.3;
    default:
      return distKm;
  }
}

function heuristic(
  nodeId: string,
  goalId: string,
  graph: RoadGraph,
  preference: RoutePreference
): number {
  const node = graph.nodes[nodeId];
  const goal = graph.nodes[goalId];
  if (!node || !goal) return 0;
  const straightKm = haversineKm(node.lat, node.lng, goal.lat, goal.lng);

  switch (preference) {
    case 'shortest':
    case 'lowest_traffic':
      return straightKm;
    case 'fastest':
      return (straightKm / 50) * 60; // assume 50km/h optimistic
    case 'safest':
      return straightKm * 2;
    case 'balanced':
      return straightKm + (straightKm / 50) * 60 * 0.5;
    default:
      return straightKm;
  }
}

function buildResult(
  algorithm: AlgorithmName,
  path: string[],
  nodesExpanded: number,
  graph: RoadGraph,
  preference: RoutePreference
): SearchResult {
  const label = ALGORITHM_LABELS[algorithm];
  if (path.length === 0 || path.length === 1) {
    return {
      algorithm,
      algorithmLabel: label,
      path,
      pathLabels: path.map((id) => graph.nodes[id]?.label ?? id),
      totalDistanceKm: 0,
      travelTimeMin: 0,
      nodesExpanded,
      congestedSegments: [],
      trafficLevel: 'low',
      safetyScore: 0,
      pathLength: path.length,
      found: path.length > 0,
    };
  }

  let totalDistanceKm = 0;
  let travelTimeMin = 0;
  let safetySum = 0;
  const congestedSegments: CongestedSegment[] = [];
  let highCount = 0;
  let medCount = 0;
  let lowCount = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const edge = getEdge(path[i], path[i + 1]);
    if (!edge) continue;
    const distKm = edge.distance / 1000;
    totalDistanceKm += distKm;

    const level = getCongestionLevelForEdge(edge);
    const factor = getCongestionFactor(edge, level);
    const speedKmh = edge.baseSpeed * factor;
    const baseTimeMin = (distKm / edge.baseSpeed) * 60;
    const adjTimeMin = (distKm / speedKmh) * 60;
    const delay = adjTimeMin - baseTimeMin;
    travelTimeMin += adjTimeMin;
    safetySum += edge.safety;

    if (level === 'high') {
      highCount++;
      congestedSegments.push({
        roadName: edge.roadName,
        from: graph.nodes[path[i]]?.label ?? path[i],
        to: graph.nodes[path[i + 1]]?.label ?? path[i + 1],
        level,
        delayMin: Math.round(delay * 10) / 10,
      });
    } else if (level === 'medium') {
      medCount++;
      if (delay > 0.5) {
        congestedSegments.push({
          roadName: edge.roadName,
          from: graph.nodes[path[i]]?.label ?? path[i],
          to: graph.nodes[path[i + 1]]?.label ?? path[i + 1],
          level,
          delayMin: Math.round(delay * 10) / 10,
        });
      }
    } else {
      lowCount++;
    }
  }

  const avgSafety = safetySum / (path.length - 1);
  const trafficLevel: CongestionLevel =
    highCount >= medCount && highCount > 0
      ? 'high'
      : medCount > lowCount
        ? 'medium'
        : 'low';

  return {
    algorithm,
    algorithmLabel: label,
    path,
    pathLabels: path.map((id) => graph.nodes[id]?.label ?? id),
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    travelTimeMin: Math.round(travelTimeMin * 10) / 10,
    nodesExpanded,
    congestedSegments,
    trafficLevel,
    safetyScore: Math.round(avgSafety * 10) / 10,
    pathLength: path.length,
    found: true,
  };
}

function getCongestionLevelForEdge(edge: GraphEdge): CongestionLevel {
  // Deterministic pseudo-level based on road name hash so it's stable
  // across runs but clearly labelled as simulated.
  const hash = edge.roadName
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const mod = hash % 10;
  if (mod < 4) return 'low';
  if (mod < 8) return 'medium';
  return 'high';
}

// ---------- BFS ----------
function bfs(
  start: string,
  goal: string,
  graph: RoadGraph,
  preference: RoutePreference
): SearchResult {
  const queue: string[][] = [[start]];
  const visited = new Set<string>();
  let expanded = 0;

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    if (visited.has(node)) continue;
    visited.add(node);
    expanded++;

    if (node === goal) {
      return buildResult('bfs', path, expanded, graph, preference);
    }

    for (const neighbor of graph.adjacency[node] ?? []) {
      if (!visited.has(neighbor)) {
        queue.push([...path, neighbor]);
      }
    }
  }
  return buildResult('bfs', [], expanded, graph, preference);
}

// ---------- DFS ----------
function dfs(
  start: string,
  goal: string,
  graph: RoadGraph,
  preference: RoutePreference
): SearchResult {
  const stack: string[][] = [[start]];
  const visited = new Set<string>();
  let expanded = 0;

  while (stack.length > 0) {
    const path = stack.pop()!;
    const node = path[path.length - 1];
    if (visited.has(node)) continue;
    visited.add(node);
    expanded++;

    if (node === goal) {
      return buildResult('dfs', path, expanded, graph, preference);
    }

    const neighbors = [...(graph.adjacency[node] ?? [])].reverse();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push([...path, neighbor]);
      }
    }
  }
  return buildResult('dfs', [], expanded, graph, preference);
}

// ---------- Best-First Search (greedy) ----------
function bestFirst(
  start: string,
  goal: string,
  graph: RoadGraph,
  preference: RoutePreference
): SearchResult {
  const open: Step[] = [{ node: start, gCost: 0, path: [start] }];
  const visited = new Set<string>();
  let expanded = 0;

  while (open.length > 0) {
    open.sort(
      (a, b) =>
        heuristic(a.node, goal, graph, preference) -
        heuristic(b.node, goal, graph, preference)
    );
    const { node, path } = open.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    expanded++;

    if (node === goal) {
      return buildResult('best_first', path, expanded, graph, preference);
    }

    for (const neighbor of graph.adjacency[node] ?? []) {
      if (!visited.has(neighbor)) {
        open.push({
          node: neighbor,
          gCost: 0,
          path: [...path, neighbor],
        });
      }
    }
  }
  return buildResult('best_first', [], expanded, graph, preference);
}

// ---------- A* Search ----------
function aStar(
  start: string,
  goal: string,
  graph: RoadGraph,
  preference: RoutePreference
): SearchResult {
  const open: Step[] = [{ node: start, gCost: 0, path: [start] }];
  const visited = new Set<string>();
  let expanded = 0;

  while (open.length > 0) {
    open.sort((a, b) => {
      const fa = a.gCost + heuristic(a.node, goal, graph, preference);
      const fb = b.gCost + heuristic(b.node, goal, graph, preference);
      return fa - fb;
    });
    const { node, gCost, path } = open.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    expanded++;

    if (node === goal) {
      return buildResult('a_star', path, expanded, graph, preference);
    }

    for (const neighbor of graph.adjacency[node] ?? []) {
      if (visited.has(neighbor)) continue;
      const edge = getEdge(node, neighbor);
      if (!edge) continue;
      const stepCost = edgeCost(edge, preference, goal, graph);
      open.push({
        node: neighbor,
        gCost: gCost + stepCost,
        path: [...path, neighbor],
      });
    }
  }
  return buildResult('a_star', [], expanded, graph, preference);
}

// ---------- Heuristic-Based Search ----------
// Combines a weighted multi-factor cost (distance + time + traffic +
// safety) with a straight-line heuristic, tuned by route preference.
function heuristicBased(
  start: string,
  goal: string,
  graph: RoadGraph,
  preference: RoutePreference
): SearchResult {
  const open: Step[] = [{ node: start, gCost: 0, path: [start] }];
  const visited = new Set<string>();
  let expanded = 0;

  const weightFor = (pref: RoutePreference) => {
    switch (pref) {
      case 'shortest':
        return { dist: 1, time: 0.2, traffic: 0.3, safety: 0.2 };
      case 'fastest':
        return { dist: 0.3, time: 1, traffic: 0.5, safety: 0.2 };
      case 'lowest_traffic':
        return { dist: 0.3, time: 0.3, traffic: 1, safety: 0.3 };
      case 'safest':
        return { dist: 0.3, time: 0.2, traffic: 0.3, safety: 1 };
      case 'balanced':
        return { dist: 0.4, time: 0.4, traffic: 0.4, safety: 0.4 };
    }
  };
  const w = weightFor(preference);

  const multiCost = (edge: GraphEdge): number => {
    const distKm = edge.distance / 1000;
    const level = getCongestionLevelForEdge(edge);
    const factor = getCongestionFactor(edge, level);
    const speedKmh = edge.baseSpeed * factor;
    const timeMin = (distKm / speedKmh) * 60;
    const trafficPenalty = (1 - factor) * 10;
    const safetyPenalty = (10 - edge.safety) * 0.5;
    return (
      w.dist * distKm +
      w.time * timeMin +
      w.traffic * trafficPenalty +
      w.safety * safetyPenalty
    );
  };

  const multiHeuristic = (nodeId: string): number => {
    const node = graph.nodes[nodeId];
    const goalNode = graph.nodes[goal];
    if (!node || !goalNode) return 0;
    const straight = haversineKm(node.lat, node.lng, goalNode.lat, goalNode.lng);
    return (
      w.dist * straight +
      w.time * (straight / 50) * 60 +
      w.traffic * 0.5 +
      w.safety * 0.5
    );
  };

  while (open.length > 0) {
    open.sort(
      (a, b) =>
        a.gCost + multiHeuristic(a.node) - (b.gCost + multiHeuristic(b.node))
    );
    const { node, gCost, path } = open.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    expanded++;

    if (node === goal) {
      return buildResult('heuristic', path, expanded, graph, preference);
    }

    for (const neighbor of graph.adjacency[node] ?? []) {
      if (visited.has(neighbor)) continue;
      const edge = getEdge(node, neighbor);
      if (!edge) continue;
      open.push({
        node: neighbor,
        gCost: gCost + multiCost(edge),
        path: [...path, neighbor],
      });
    }
  }
  return buildResult('heuristic', [], expanded, graph, preference);
}

const ALGORITHMS = {
  bfs,
  dfs,
  best_first: bestFirst,
  a_star: aStar,
  heuristic: heuristicBased,
} as const;

export function runAlgorithm(
  algorithm: AlgorithmName,
  start: string,
  goal: string,
  preference: RoutePreference
): SearchResult {
  const fn = ALGORITHMS[algorithm];
  return fn(start, goal, cityGraph, preference);
}

export function runAllAlgorithms(
  start: string,
  goal: string,
  preference: RoutePreference
): SearchResult[] {
  return (Object.keys(ALGORITHMS) as AlgorithmName[]).map((alg) =>
    runAlgorithm(alg, start, goal, preference)
  );
}

export const ALGORITHM_INFO: Array<{
  id: AlgorithmName;
  label: string;
  short: string;
  description: string;
  completeness: string;
  optimality: string;
  timeComplexity: string;
  spaceComplexity: string;
}> = [
  {
    id: 'bfs',
    label: 'Breadth-First Search',
    short: 'BFS',
    description:
      'Explores all neighbours at the current depth before moving deeper. Guarantees the fewest-hops path but ignores road distance, traffic, and safety.',
    completeness: 'Complete on finite graphs',
    optimality: 'Optimal only for unweighted (hop-count) cost',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
  },
  {
    id: 'dfs',
    label: 'Depth-First Search',
    short: 'DFS',
    description:
      'Explores as far as possible along each branch before backtracking. Fast and memory-light but not optimal — it returns whichever path it stumbles upon first.',
    completeness: 'Complete on finite graphs',
    optimality: 'Not optimal',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
  },
  {
    id: 'best_first',
    label: 'Best-First Search',
    short: 'Greedy Best-First',
    description:
      'A greedy search that always expands the node that appears closest to the goal by a straight-line heuristic. Fast but can be misled by traffic or road layout.',
    completeness: 'Complete (with visited set)',
    optimality: 'Not optimal',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
  },
  {
    id: 'a_star',
    label: 'A* Search',
    short: 'A*',
    description:
      'Combines the actual cost from the start (g) with a heuristic estimate to the goal (h). With an admissible heuristic it is both complete and optimal — the backbone of real route planners.',
    completeness: 'Complete',
    optimality: 'Optimal with admissible heuristic',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
  },
  {
    id: 'heuristic',
    label: 'Heuristic-Based Search',
    short: 'Heuristic-Based',
    description:
      'A custom weighted multi-factor search that blends distance, travel time, simulated traffic, and safety into the cost, tuned by the chosen route preference.',
    completeness: 'Complete',
    optimality: 'Optimal for the weighted cost function',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
  },
];

export function formatTravelTime(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const remaining = Math.round((min % 60) * 10) / 10;
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
}

export const PREFERENCE_INFO: Array<{
  id: RoutePreference;
  label: string;
  description: string;
}> = [
  { id: 'shortest', label: 'Shortest Distance', description: 'Minimise total road distance in kilometres.' },
  { id: 'fastest', label: 'Fastest Travel Time', description: 'Minimise estimated travel time using speed adjusted for traffic.' },
  { id: 'lowest_traffic', label: 'Lowest Traffic', description: 'Prefer segments with lighter simulated congestion.' },
  { id: 'safest', label: 'Safest Route', description: 'Prefer segments with higher safety ratings.' },
  { id: 'balanced', label: 'Balanced Route', description: 'Balance distance, time, traffic, and safety equally.' },
];
