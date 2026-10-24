/**
 * India intercity road network graph for Smart Urban Traffic Navigator.
 *
 * Each node is a major Indian city with real lat/lng coordinates; each edge
 * is a national highway connecting two cities, carrying distance (metres),
 * base speed, road name, and a safety rating. The graph-search algorithms
 * (BFS, DFS, Best-First, A*, Heuristic-Based) traverse this graph to find
 * intercity routes.
 *
 * Coordinates are real and are fed to OSRM to obtain true road geometry for
 * display on the Leaflet map.
 */

export interface GraphNode {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** road segment distance in metres (haversine between endpoints) */
  distance: number;
  /** free-flow speed limit in km/h */
  baseSpeed: number;
  roadName: string;
  /** safety rating 0-10 (10 = safest) */
  safety: number;
}

export interface RoadGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  /** adjacency list: node id -> array of connected node ids */
  adjacency: Record<string, string[]>;
  /** edge lookup keyed by "from|to" and "to|from" (undirected) */
  edgeMap: Record<string, GraphEdge>;
}

const NODES: GraphNode[] = [
  // Tier 1 metros
  { id: 'MUM', label: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { id: 'DEL', label: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { id: 'BLR', label: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { id: 'HYD', label: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { id: 'CHE', label: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { id: 'KOL', label: 'Kolkata', lat: 22.5726, lng: 88.3639 },

  // Tier 2 cities
  { id: 'PUN', label: 'Pune', lat: 18.5204, lng: 73.8567 },
  { id: 'AHM', label: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { id: 'JAI', label: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { id: 'SUR', label: 'Surat', lat: 21.1702, lng: 72.8311 },
  { id: 'LKO', label: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { id: 'KAN', label: 'Kanpur', lat: 26.4499, lng: 80.3319 },
  { id: 'NGP', label: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { id: 'IND', label: 'Indore', lat: 22.7196, lng: 75.8577 },
  { id: 'BHO', label: 'Bhopal', lat: 23.2599, lng: 77.4126 },
  { id: 'PAT', label: 'Patna', lat: 25.5941, lng: 85.1376 },
  { id: 'VAD', label: 'Vadodara', lat: 22.3072, lng: 73.1812 },
  { id: 'GHA', label: 'Ghaziabad', lat: 28.6692, lng: 77.4538 },
  { id: 'LUD', label: 'Ludhiana', lat: 30.9010, lng: 75.8573 },
  { id: 'AGR', label: 'Agra', lat: 27.1767, lng: 78.0081 },

  // South India
  { id: 'COI', label: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  { id: 'MAD', label: 'Madurai', lat: 9.9252, lng: 78.1198 },
  { id: 'VIZ', label: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { id: 'VJC', label: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  { id: 'TIR', label: 'Tirupati', lat: 13.6288, lng: 79.4192 },
  { id: 'MYS', label: 'Mysore', lat: 12.2958, lng: 76.6394 },
  { id: 'TVM', label: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
  { id: 'KOC', label: 'Kochi', lat: 9.9312, lng: 76.2673 },

  // East & North-East
  { id: 'BHU', label: 'Bhubaneswar', lat: 20.2961, lng: 85.8245 },
  { id: 'RAN', label: 'Ranchi', lat: 23.3441, lng: 85.3096 },
  { id: 'GWA', label: 'Gwalior', lat: 26.2183, lng: 78.1828 },
  { id: 'RAI', label: 'Raipur', lat: 21.2514, lng: 81.6296 },
  { id: 'AMR', label: 'Amritsar', lat: 31.6340, lng: 74.8723 },
];

// [from, to, baseSpeed, roadName, safety]
const ROADS: Array<[string, string, number, string, number]> = [
  // Western India
  ['MUM', 'PUN', 80, 'Mumbai-Pune Expressway (NH48)', 9],
  ['MUM', 'SUR', 80, 'NH48', 8],
  ['MUM', 'NGP', 70, 'Nagpur-Mumbai Highway (NH53)', 7],
  ['SUR', 'VAD', 80, 'NH48', 8],
  ['VAD', 'AHM', 80, 'NH48', 8],
  ['AHM', 'IND', 75, 'NH59', 7],
  ['IND', 'BHO', 70, 'NH46', 7],
  ['AHM', 'JAI', 70, 'NH48', 6],
  ['JAI', 'SUR', 70, 'NH48', 6],

  // Northern India
  ['DEL', 'GHA', 70, 'NH48', 8],
  ['GHA', 'AGR', 70, 'NH19 (Yamuna Expressway)', 9],
  ['DEL', 'JAI', 75, 'NH48 (Delhi-Jaipur Highway)', 8],
  ['AGR', 'JAI', 65, 'NH23', 6],
  ['AGR', 'GWA', 65, 'NH44', 7],
  ['GWA', 'LKO', 70, 'NH46', 7],
  ['DEL', 'LUD', 75, 'NH44', 8],
  ['LUD', 'AMR', 75, 'NH3', 8],
  ['DEL', 'KAN', 70, 'NH19', 7],
  ['LKO', 'KAN', 70, 'NH27', 7],
  ['LKO', 'PAT', 65, 'NH28', 6],
  ['KAN', 'PAT', 65, 'NH19', 6],

  // Central India
  ['BHO', 'NGP', 70, 'NH69', 7],
  ['NGP', 'HYD', 75, 'NH44 (North-South Corridor)', 8],
  ['NGP', 'RAI', 70, 'NH53', 7],
  ['BHO', 'RAI', 65, 'NH30', 6],
  ['IND', 'NGP', 65, 'NH47', 6],
  ['NGP', 'KOL', 65, 'NH53', 6],

  // South India
  ['BLR', 'HYD', 80, 'NH44 (Hyderabad-Bangalore Highway)', 8],
  ['BLR', 'CHE', 80, 'NH48 (Chennai-Bangalore Highway)', 8],
  ['BLR', 'MYS', 70, 'NH275 (Mysore Road)', 9],
  ['BLR', 'COI', 70, 'NH948', 7],
  ['CHE', 'TIR', 70, 'NH71', 7],
  ['TIR', 'VJC', 70, 'NH167', 7],
  ['VJC', 'HYD', 80, 'NH65', 8],
  ['CHE', 'MAD', 70, 'NH38', 7],
  ['MAD', 'TVM', 65, 'NH44', 7],
  ['TVM', 'KOC', 65, 'NH66', 7],
  ['KOC', 'COI', 65, 'NH544', 7],
  ['COI', 'MAD', 65, 'NH44', 7],
  ['HYD', 'VIZ', 65, 'NH65', 6],
  ['VIZ', 'VJC', 65, 'NH16 (Coastal Corridor)', 7],

  // East India
  ['KOL', 'BHU', 65, 'NH16', 7],
  ['BHU', 'RAI', 65, 'NH53', 6],
  ['BHU', 'RAN', 65, 'NH43', 6],
  ['RAN', 'PAT', 60, 'NH31', 5],
  ['RAI', 'NGP', 70, 'NH53', 7],
  ['KOL', 'PAT', 60, 'NH19 (GT Road)', 6],
];

const RADIUS_KM = 6371;

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIUS_KM * c * 1000;
}

function buildGraph(): RoadGraph {
  const nodes: Record<string, GraphNode> = {};
  for (const n of NODES) nodes[n.id] = n;

  const edges: GraphEdge[] = [];
  const adjacency: Record<string, string[]> = {};
  const edgeMap: Record<string, GraphEdge> = {};

  for (const [from, to, baseSpeed, roadName, safety] of ROADS) {
    const a = nodes[from];
    const b = nodes[to];
    const distance = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    const edge: GraphEdge = {
      from,
      to,
      distance,
      baseSpeed,
      roadName,
      safety,
    };
    edges.push(edge);
    (adjacency[from] ||= []).push(to);
    (adjacency[to] ||= []).push(from);
    edgeMap[`${from}|${to}`] = edge;
    edgeMap[`${to}|${from}`] = edge;
  }

  return { nodes, edges, adjacency, edgeMap };
}

export const cityGraph: RoadGraph = buildGraph();

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return haversineMeters(lat1, lng1, lat2, lng2) / 1000;
}

export function getEdge(a: string, b: string): GraphEdge | undefined {
  return cityGraph.edgeMap[`${a}|${b}`];
}

export function nodeList(): GraphNode[] {
  return NODES;
}

export function nodeById(id: string): GraphNode | undefined {
  return cityGraph.nodes[id];
}
