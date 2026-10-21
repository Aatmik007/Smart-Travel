/**
 * JammuMove Deterministic Multimodal Route Engine
 * 
 * Supports:
 * - Public Bus (Route 1A & Route 4 verified timetables)
 * - Shared E-Rickshaw / Auto corridors
 * - Walking transfers (short hops <= 1.2 km)
 * - Carpools (dynamically ingested from verified database listings)
 * 
 * Shortest Path: Dijkstra-based multi-criteria routing with penalties for transfers,
 * optimized for 'duration', 'cost', or 'transfers'.
 */

const dbService = require('../data/dbService');

// Canonical transit hubs with GPS coordinates and aliases
const CANONICAL_HUBS = {
  janipur: {
    id: 'janipur',
    name: 'Janipur',
    lat: 32.7533,
    lng: 74.8461,
    aliases: ['janipur', 'janipur chowk', 'high court', 'janipur colony']
  },
  jewelChowk: {
    id: 'jewelChowk',
    name: 'Jewel Chowk',
    lat: 32.7291,
    lng: 74.8617,
    aliases: ['jewel chowk', 'jewel', 'vinayak chowk', 'dogra chowk']
  },
  gandhiNagar: {
    id: 'gandhiNagar',
    name: 'Gandhi Nagar',
    lat: 32.7096,
    lng: 74.8732,
    aliases: ['gandhi nagar', 'gole market', 'apsara road', 'gandhinagar']
  },
  jammuUniversity: {
    id: 'jammuUniversity',
    name: 'Jammu University',
    lat: 32.7163,
    lng: 74.8647,
    aliases: ['jammu university', 'university', 'bahu fort road', 'ju campus']
  },
  railwayStation: {
    id: 'railwayStation',
    name: 'Jammu Tawi Railway Station',
    lat: 32.7056,
    lng: 74.8794,
    aliases: ['railway station', 'jammu tawi', 'railway', 'station', 'train station']
  },
  channiHimmat: {
    id: 'channiHimmat',
    name: 'Channi Himmat',
    lat: 32.6953,
    lng: 74.8967,
    aliases: ['channi himmat', 'channi', 'channi sector', 'channi chowk']
  },
  satwari: {
    id: 'satwari',
    name: 'Satwari Chowk (Airport)',
    lat: 32.6888,
    lng: 74.8622,
    aliases: ['satwari', 'satwari chowk', 'airport', 'jammu airport', 'satwari cantt']
  },
  talabTillo: {
    id: 'talabTillo',
    name: 'Talab Tillo',
    lat: 32.7275,
    lng: 74.8317,
    aliases: ['talab tillo', 'tillo', 'canal road', 'talab tiloo']
  },
  panjtirthi: {
    id: 'panjtirthi',
    name: 'Panjtirthi',
    lat: 32.7431,
    lng: 74.8719,
    aliases: ['panjtirthi', 'panjtirthi chowk', 'circular road']
  },
  parade: {
    id: 'parade',
    name: 'Parade Ground',
    lat: 32.7358,
    lng: 74.8672,
    aliases: ['parade ground', 'parade', 'shalamar', 'shalamar road']
  }
};

/**
 * Haversine formula: Computes great-circle distance in km between two GPS points
 */
function haversineDistance(c1, c2) {
  const R = 6371; // km
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLng = (c2.lng - c1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

/**
 * Resolves a natural-language query string to a canonical hub
 */
function resolveHub(nameOrQuery) {
  if (!nameOrQuery || typeof nameOrQuery !== 'string') return null;
  const q = nameOrQuery.toLowerCase().trim();

  // Direct match by ID
  if (CANONICAL_HUBS[q]) return CANONICAL_HUBS[q];

  // Match by canonical name or aliases
  for (const hub of Object.values(CANONICAL_HUBS)) {
    if (hub.name.toLowerCase() === q) return hub;
    for (const alias of hub.aliases) {
      if (q === alias || q.includes(alias)) {
        return hub;
      }
    }
  }

  return null;
}

/**
 * Verified base connections for Jammu Public Transit & Local Mobility
 */
const STATIC_CONNECTIONS = [
  // --- BUS ROUTE 1A (Electric Bus: Janipur <-> Jewel Chowk <-> Gandhi Nagar <-> Satwari) ---
  // Adjacent & Multi-stop Direct Segments on Route 1A
  {
    from: 'janipur',
    to: 'jewelChowk',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 3.8,
    durationMins: 15,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 1A Smart Electric Bus towards Jewel Chowk at Janipur Main Chowk.'
  },
  {
    from: 'jewelChowk',
    to: 'janipur',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 3.8,
    durationMins: 15,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 1A Smart Electric Bus towards Janipur at Jewel Chowk Bus Bay.'
  },
  {
    from: 'jewelChowk',
    to: 'gandhiNagar',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 2.6,
    durationMins: 12,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 1A E-Bus across Tawi Bridge to Gandhi Nagar Stop.'
  },
  {
    from: 'gandhiNagar',
    to: 'jewelChowk',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 2.6,
    durationMins: 12,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 1A E-Bus from Gandhi Nagar towards Jewel Chowk.'
  },
  {
    from: 'gandhiNagar',
    to: 'satwari',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 2.8,
    durationMins: 12,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 1A E-Bus towards Satwari Chowk & Airport.'
  },
  {
    from: 'satwari',
    to: 'gandhiNagar',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 2.8,
    durationMins: 12,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 1A E-Bus from Satwari Chowk towards Gandhi Nagar.'
  },
  {
    from: 'janipur',
    to: 'gandhiNagar',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 6.4,
    durationMins: 27,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board direct Route 1A E-Bus from Janipur Main Chowk via Jewel Chowk to Gandhi Nagar.'
  },
  {
    from: 'gandhiNagar',
    to: 'janipur',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 6.4,
    durationMins: 27,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board direct Route 1A E-Bus from Gandhi Nagar via Jewel Chowk to Janipur.'
  },
  {
    from: 'janipur',
    to: 'satwari',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 9.2,
    durationMins: 39,
    fare: 25,
    confidence: 'verified',
    instruction: 'Board direct Route 1A E-Bus from Janipur across city to Satwari Chowk (Airport).'
  },
  {
    from: 'satwari',
    to: 'janipur',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 9.2,
    durationMins: 39,
    fare: 25,
    confidence: 'verified',
    instruction: 'Board direct Route 1A E-Bus from Satwari Chowk across city to Janipur.'
  },
  {
    from: 'jewelChowk',
    to: 'satwari',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 5.4,
    durationMins: 24,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board Route 1A E-Bus from Jewel Chowk via Gandhi Nagar to Satwari Chowk.'
  },
  {
    from: 'satwari',
    to: 'jewelChowk',
    mode: 'bus',
    line: 'Route 1A E-Bus',
    distanceKm: 5.4,
    durationMins: 24,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board Route 1A E-Bus from Satwari Chowk via Gandhi Nagar to Jewel Chowk.'
  },

  // --- BUS ROUTE 4 (Circular Bus: Panjtirthi <-> Parade <-> Jewel Chowk <-> University <-> Railway Station) ---
  {
    from: 'panjtirthi',
    to: 'parade',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 0.9,
    durationMins: 6,
    fare: 10,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus from Panjtirthi Stand to Parade Ground.'
  },
  {
    from: 'parade',
    to: 'panjtirthi',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 0.9,
    durationMins: 6,
    fare: 10,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus from Parade Ground to Panjtirthi Stand.'
  },
  {
    from: 'parade',
    to: 'jewelChowk',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 1.1,
    durationMins: 8,
    fare: 10,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus at Parade Ground towards Jewel Chowk.'
  },
  {
    from: 'jewelChowk',
    to: 'parade',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 1.1,
    durationMins: 8,
    fare: 10,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus at Jewel Chowk towards Parade Ground.'
  },
  {
    from: 'jewelChowk',
    to: 'jammuUniversity',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 1.6,
    durationMins: 10,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus from Jewel Chowk towards Jammu University Main Gate.'
  },
  {
    from: 'jammuUniversity',
    to: 'jewelChowk',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 1.6,
    durationMins: 10,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus from Jammu University towards Jewel Chowk.'
  },
  {
    from: 'jammuUniversity',
    to: 'railwayStation',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 1.8,
    durationMins: 10,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus from Jammu University terminating at Jammu Tawi Railway Station.'
  },
  {
    from: 'railwayStation',
    to: 'jammuUniversity',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 1.8,
    durationMins: 10,
    fare: 15,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus at Jammu Tawi Railway Station towards University & Parade.'
  },
  {
    from: 'panjtirthi',
    to: 'railwayStation',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 5.4,
    durationMins: 34,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board direct Route 4 Bus from Panjtirthi via Parade and Jewel Chowk to Jammu Tawi Railway Station.'
  },
  {
    from: 'railwayStation',
    to: 'panjtirthi',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 5.4,
    durationMins: 34,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board direct Route 4 Bus from Jammu Tawi Railway Station via University and Jewel Chowk to Panjtirthi.'
  },
  {
    from: 'parade',
    to: 'railwayStation',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 4.5,
    durationMins: 28,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board direct Route 4 Bus from Parade Ground to Jammu Tawi Railway Station.'
  },
  {
    from: 'railwayStation',
    to: 'parade',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 4.5,
    durationMins: 28,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board direct Route 4 Bus from Railway Station to Parade Ground.'
  },
  {
    from: 'jewelChowk',
    to: 'railwayStation',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 3.4,
    durationMins: 20,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus from Jewel Chowk via University to Jammu Tawi Railway Station.'
  },
  {
    from: 'railwayStation',
    to: 'jewelChowk',
    mode: 'bus',
    line: 'Route 4 Bus',
    distanceKm: 3.4,
    durationMins: 20,
    fare: 20,
    confidence: 'verified',
    instruction: 'Board Route 4 Bus from Railway Station via University to Jewel Chowk.'
  },

  // --- E-RICKSHAW / AUTO SHORT-HOP FEEDER CORRIDORS ---
  {
    from: 'jewelChowk',
    to: 'talabTillo',
    mode: 'erickshaw',
    line: 'Local E-Rickshaw',
    distanceKm: 2.8,
    durationMins: 12,
    fare: 15,
    confidence: 'verified',
    instruction: 'Take a shared E-Rickshaw along Canal Road from Jewel Chowk to Talab Tillo.'
  },
  {
    from: 'talabTillo',
    to: 'jewelChowk',
    mode: 'erickshaw',
    line: 'Local E-Rickshaw',
    distanceKm: 2.8,
    durationMins: 12,
    fare: 15,
    confidence: 'verified',
    instruction: 'Take a shared E-Rickshaw along Canal Road to Jewel Chowk.'
  },
  {
    from: 'jammuUniversity',
    to: 'railwayStation',
    mode: 'erickshaw',
    line: 'University Feeder E-Rickshaw',
    distanceKm: 1.8,
    durationMins: 7,
    fare: 15,
    confidence: 'verified',
    instruction: 'Take an E-Rickshaw from University Gate 1 to Jammu Tawi Railway Station.'
  },
  {
    from: 'railwayStation',
    to: 'jammuUniversity',
    mode: 'erickshaw',
    line: 'University Feeder E-Rickshaw',
    distanceKm: 1.8,
    durationMins: 7,
    fare: 15,
    confidence: 'verified',
    instruction: 'Take an E-Rickshaw from Railway Station Exit to Jammu University.'
  },
  {
    from: 'gandhiNagar',
    to: 'railwayStation',
    mode: 'erickshaw',
    line: 'Gandhi Nagar Station Auto',
    distanceKm: 2.1,
    durationMins: 9,
    fare: 20,
    confidence: 'verified',
    instruction: 'Take a shared auto/e-rickshaw from Gandhi Nagar to Jammu Tawi Railway Station.'
  },
  {
    from: 'railwayStation',
    to: 'gandhiNagar',
    mode: 'erickshaw',
    line: 'Gandhi Nagar Station Auto',
    distanceKm: 2.1,
    durationMins: 9,
    fare: 20,
    confidence: 'verified',
    instruction: 'Take a shared auto/e-rickshaw from Railway Station to Gandhi Nagar.'
  },
  {
    from: 'railwayStation',
    to: 'channiHimmat',
    mode: 'erickshaw',
    line: 'Channi Shared Auto',
    distanceKm: 3.2,
    durationMins: 12,
    fare: 25,
    confidence: 'verified',
    instruction: 'Take a shared auto/e-rickshaw from Railway Station towards Channi Himmat Sector 1.'
  },
  {
    from: 'channiHimmat',
    to: 'railwayStation',
    mode: 'erickshaw',
    line: 'Channi Shared Auto',
    distanceKm: 3.2,
    durationMins: 12,
    fare: 25,
    confidence: 'verified',
    instruction: 'Take a shared auto from Channi Himmat to Jammu Tawi Railway Station.'
  },
  {
    from: 'gandhiNagar',
    to: 'satwari',
    mode: 'erickshaw',
    line: 'Satwari Corridor Auto',
    distanceKm: 2.8,
    durationMins: 10,
    fare: 20,
    confidence: 'verified',
    instruction: 'Take a local auto from Gandhi Nagar towards Satwari Chowk / Airport.'
  },
  {
    from: 'satwari',
    to: 'gandhiNagar',
    mode: 'erickshaw',
    line: 'Satwari Corridor Auto',
    distanceKm: 2.8,
    durationMins: 10,
    fare: 20,
    confidence: 'verified',
    instruction: 'Take a local auto from Satwari Chowk towards Gandhi Nagar.'
  },

  // --- WALKING TRANSFERS (<= 1.2 km) ---
  {
    from: 'panjtirthi',
    to: 'parade',
    mode: 'walking',
    line: 'Walking Transfer',
    distanceKm: 0.9,
    durationMins: 12,
    fare: 0,
    confidence: 'verified',
    instruction: 'Walk 900m via Circular Road between Panjtirthi and Parade Ground.'
  },
  {
    from: 'parade',
    to: 'panjtirthi',
    mode: 'walking',
    line: 'Walking Transfer',
    distanceKm: 0.9,
    durationMins: 12,
    fare: 0,
    confidence: 'verified',
    instruction: 'Walk 900m via Circular Road between Parade Ground and Panjtirthi.'
  }
];

/**
 * Builds the graph representation combining static transit connections
 * and dynamic active/scheduled carpools from the database.
 */
async function buildTransitGraph() {
  const graph = {};

  // Initialize adjacency list for all canonical hubs
  for (const hubId of Object.keys(CANONICAL_HUBS)) {
    graph[hubId] = [];
  }

  // 1. Add static verified connections
  for (const conn of STATIC_CONNECTIONS) {
    if (graph[conn.from]) {
      graph[conn.from].push({ ...conn });
    }
  }

  // 2. Dynamically ingest active & scheduled carpool trips from DB
  try {
    const carpoolTrips = await dbService.find('trips', { type: 'carpool' });
    const eligibleTrips = (carpoolTrips || []).filter(
      t => t.status === 'scheduled' || t.status === 'active'
    );

    for (const trip of eligibleTrips) {
      const fromHub = resolveHub(trip.startLocation ? trip.startLocation.name : '');
      const toHub = resolveHub(trip.endLocation ? trip.endLocation.name : '');

      if (fromHub && toHub && fromHub.id !== toHub.id) {
        const dist = haversineDistance(fromHub, toHub);
        // Approx 35 km/h car speed in Jammu traffic
        const dur = Math.max(10, Math.round((dist / 35) * 60));
        const stopsArray = Array.isArray(trip.stops) ? trip.stops.map(s => typeof s === 'string' ? s : s.name).filter(Boolean) : [];
        const stopsText = stopsArray.length > 0 ? ` (via ${stopsArray.join(', ')})` : '';

        graph[fromHub.id].push({
          from: fromHub.id,
          to: toHub.id,
          mode: 'carpool',
          line: trip.routeName ? `${trip.routeName}${stopsText}` : `Carpool (${fromHub.name} ➔ ${toHub.name})`,
          tripId: trip._id ? trip._id.toString() : undefined,
          distanceKm: dist,
          durationMins: dur,
          fare: Number(trip.price) || 50,
          confidence: 'verified',
          instruction: `Book and board verified carpool "${trip.routeName}"${stopsText} directly to ${toHub.name}.`
        });
      }
    }
  } catch (err) {
    // If DB read fails, engine operates purely with verified static network
    console.warn('[RouteEngine Warning] Could not ingest dynamic carpools:', err.message);
  }

  return graph;
}

/**
 * Multi-criteria weight evaluation for an edge
 */
function getEdgeWeight(edge, preference, prevMode) {
  const isTransfer = prevMode && prevMode !== edge.mode;
  const transferPenaltyMins = isTransfer ? 5 : 0;

  switch (preference) {
    case 'cost':
      // Minimize out-of-pocket fare; walking is free (0 fare)
      return edge.fare + 0.1 * edge.durationMins;

    case 'transfers':
      // Heavily penalize each vehicular boarding / transfer
      return 50 + (edge.mode === 'walking' ? 10 : 0) + 0.5 * edge.durationMins;

    case 'duration':
    default:
      // Minimize total time including transfer penalties
      return edge.durationMins + transferPenaltyMins + 0.05 * edge.fare;
  }
}

/**
 * Dijkstra shortest-path algorithm
 */
function dijkstra(graph, startHubId, endHubId, preference, edgePenaltyMap = {}) {
  const distances = {};
  const previous = {};
  const previousEdge = {};
  const unvisited = new Set(Object.keys(graph));

  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
  }
  distances[startHubId] = 0;

  while (unvisited.size > 0) {
    // Find unvisited node with lowest distance
    let current = null;
    let minDistance = Infinity;
    for (const node of unvisited) {
      if (distances[node] < minDistance) {
        minDistance = distances[node];
        current = node;
      }
    }

    if (current === null || minDistance === Infinity) break;
    if (current === endHubId) break;

    unvisited.delete(current);

    const edges = graph[current] || [];
    const prevEdge = previousEdge[current];
    const prevMode = prevEdge ? prevEdge.mode : null;

    for (const edge of edges) {
      if (!unvisited.has(edge.to)) continue;

      const baseWeight = getEdgeWeight(edge, preference, prevMode);
      const penaltyKey = `${edge.from}->${edge.to}:${edge.mode}:${edge.line}`;
      const penalty = edgePenaltyMap[penaltyKey] || 1;
      const weight = baseWeight * penalty;

      const alt = distances[current] + weight;
      if (alt < distances[edge.to]) {
        distances[edge.to] = alt;
        previous[edge.to] = current;
        previousEdge[edge.to] = edge;
      }
    }
  }

  // If destination unreachable
  if (distances[endHubId] === Infinity || !previousEdge[endHubId]) {
    return null;
  }

  // Reconstruct path
  const pathLegs = [];
  let curr = endHubId;
  while (curr !== startHubId) {
    const edge = previousEdge[curr];
    if (!edge) break;
    pathLegs.unshift(edge);
    curr = previous[curr];
  }

  return pathLegs;
}

/**
 * Consolidates consecutive legs on the same bus line if applicable,
 * computes totals and generates structured journey
 */
function formatJourney(legs, originHub, destHub, routeId, label) {
  let totalDistanceKm = 0;
  let totalDurationMins = 0;
  let totalFare = 0;
  let transfers = 0;
  const modesSet = new Set();

  const formattedLegs = legs.map((leg, idx) => {
    totalDistanceKm += leg.distanceKm;
    totalDurationMins += leg.durationMins;
    totalFare += leg.fare;
    modesSet.add(leg.mode);

    if (idx > 0 && (leg.mode !== legs[idx - 1].mode || leg.line !== legs[idx - 1].line)) {
      transfers++;
    }

    const fromHub = CANONICAL_HUBS[leg.from];
    const toHub = CANONICAL_HUBS[leg.to];

    return {
      legIndex: idx + 1,
      from: fromHub ? fromHub.name : leg.from,
      to: toHub ? toHub.name : leg.to,
      fromId: leg.from,
      toId: leg.to,
      mode: leg.mode,
      line: leg.line,
      distanceKm: leg.distanceKm,
      durationMins: leg.durationMins,
      fare: leg.fare,
      confidence: leg.confidence || 'verified',
      instruction: leg.instruction
    };
  });

  // Transfer wait time overhead (approx 4 mins per transfer)
  totalDurationMins += transfers * 4;

  // Single-fare cap for consecutive bus legs on the same route if applicable
  const busLegs = legs.filter(l => l.mode === 'bus');
  if (busLegs.length > 1) {
    const firstLine = busLegs[0].line;
    if (busLegs.every(l => l.line === firstLine)) {
      // Direct full bus route cap (₹20-25)
      totalFare = Math.min(totalFare, 25);
    }
  }

  return {
    routeId,
    label,
    summary: Array.from(modesSet).map(m => {
      switch (m) {
        case 'bus': return 'Smart Bus';
        case 'erickshaw': return 'E-Rickshaw';
        case 'walking': return 'Walking';
        case 'carpool': return 'Carpool';
        default: return m;
      }
    }).join(' + '),
    totalFare: Math.round(totalFare),
    totalDurationMins: Math.round(totalDurationMins),
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    transfers,
    modes: Array.from(modesSet),
    confidence: formattedLegs.every(l => l.confidence === 'verified') ? 'verified' : 'estimated',
    legs: formattedLegs
  };
}

/**
 * Main Multimodal Planning Function
 * 
 * @param {string} originName Natural language or hub ID of departure
 * @param {string} destinationName Natural language or hub ID of arrival
 * @param {string} preference 'duration' | 'cost' | 'transfers'
 * @returns {Promise<Object>} Structured routing response
 */
async function findMultimodalRoutes(originName, destinationName, preference = 'duration') {
  const originHub = resolveHub(originName);
  const destHub = resolveHub(destinationName);

  if (!originHub) {
    return {
      success: false,
      code: 'UNKNOWN_ORIGIN',
      message: `Departure location "${originName}" is not recognized in our Jammu transit network.`,
      supportedHubs: Object.values(CANONICAL_HUBS).map(h => h.name)
    };
  }

  if (!destHub) {
    return {
      success: false,
      code: 'UNKNOWN_DESTINATION',
      message: `Destination location "${destinationName}" is not recognized in our Jammu transit network.`,
      supportedHubs: Object.values(CANONICAL_HUBS).map(h => h.name)
    };
  }

  if (originHub.id === destHub.id) {
    return {
      success: false,
      code: 'SAME_LOCATION',
      message: `Origin and destination cannot both be "${originHub.name}". Please specify distinct transit points.`
    };
  }

  const normalizedPref = ['cost', 'transfers', 'duration'].includes(preference)
    ? preference
    : 'duration';

  const graph = await buildTransitGraph();

  // 1. Compute Primary Optimal Route
  const primaryLegs = dijkstra(graph, originHub.id, destHub.id, normalizedPref);

  if (!primaryLegs || primaryLegs.length === 0) {
    return {
      success: false,
      code: 'NO_ROUTE_FOUND',
      message: `No connected public transit or carpool route currently links ${originHub.name} and ${destHub.name}.`,
      origin: originHub,
      destination: destHub
    };
  }

  const routes = [];
  const primaryRoute = formatJourney(primaryLegs, originHub, destHub, 'route_1', 
    normalizedPref === 'cost' ? 'Cheapest Option' : normalizedPref === 'transfers' ? 'Fewer Transfers' : 'Fastest Option'
  );
  routes.push(primaryRoute);

  // 2. Find Alternative Route using edge penalties
  const penaltyMap = {};
  for (const leg of primaryLegs) {
    const key = `${leg.from}->${leg.to}:${leg.mode}:${leg.line}`;
    penaltyMap[key] = 2.5; // Discourage repeating the exact primary route
  }

  const altLegs = dijkstra(graph, originHub.id, destHub.id, normalizedPref, penaltyMap);
  if (altLegs && altLegs.length > 0) {
    // Check if distinct from primary
    const altLegKeys = altLegs.map(l => `${l.from}-${l.to}-${l.mode}`).join('|');
    const primaryLegKeys = primaryLegs.map(l => `${l.from}-${l.to}-${l.mode}`).join('|');

    if (altLegKeys !== primaryLegKeys) {
      const altRoute = formatJourney(altLegs, originHub, destHub, 'route_2', 'Alternative Route');
      routes.push(altRoute);
    }
  }

  // 3. If primary was not optimized for cost, compute cost-optimal route as alternative
  if (normalizedPref !== 'cost' && routes.length < 3) {
    const costLegs = dijkstra(graph, originHub.id, destHub.id, 'cost');
    if (costLegs && costLegs.length > 0) {
      const costKeys = costLegs.map(l => `${l.from}-${l.to}-${l.mode}`).join('|');
      const exists = routes.some(r => r.legs.map(l => `${l.fromId}-${l.toId}-${l.mode}`).join('|') === costKeys);

      if (!exists) {
        routes.push(formatJourney(costLegs, originHub, destHub, `route_${routes.length + 1}`, 'Budget Transit Option'));
      }
    }
  }

  return {
    success: true,
    origin: {
      id: originHub.id,
      name: originHub.name,
      lat: originHub.lat,
      lng: originHub.lng
    },
    destination: {
      id: destHub.id,
      name: destHub.name,
      lat: destHub.lat,
      lng: destHub.lng
    },
    preference: normalizedPref,
    routes
  };
}

/**
 * Extracts travel intent, origin, destination, and routing preferences from natural text
 */
function extractTransitIntent(message) {
  if (!message || typeof message !== 'string') return null;
  const msg = message.toLowerCase();

  // Check preference hints
  let preference = 'duration';
  if (/(cheap|cheapest|budget|low fare|minimum cost|save money|lowest price)/i.test(msg)) {
    preference = 'cost';
  } else if (/(direct|fewest transfer|fewer transfer|no transfer|single bus|without transfer)/i.test(msg)) {
    preference = 'transfers';
  } else if (/(fast|fastest|quick|quickest|least time|shortest duration|urgent)/i.test(msg)) {
    preference = 'duration';
  }

  // Find all hubs mentioned in message
  const foundHubs = [];
  for (const hub of Object.values(CANONICAL_HUBS)) {
    for (const alias of hub.aliases) {
      const idx = msg.indexOf(alias);
      if (idx !== -1) {
        // avoid duplicate hub match on multiple aliases
        if (!foundHubs.some(f => f.hub.id === hub.id)) {
          foundHubs.push({ hub, alias, index: idx });
        }
        break;
      }
    }
  }

  if (foundHubs.length >= 2) {
    // Sort by appearance in message
    foundHubs.sort((a, b) => a.index - b.index);
    let originHub = foundHubs[0].hub;
    let destHub = foundHubs[1].hub;

    // Check for "to [X] from [Y]" pattern
    const toFromMatch = msg.match(/\bto\s+([a-z\s]+?)\s+from\s+([a-z0-9\s]+)/i);
    if (toFromMatch) {
      const toCandidate = resolveHub(toFromMatch[1]);
      const fromCandidate = resolveHub(toFromMatch[2]);
      if (toCandidate && fromCandidate && toCandidate.id !== fromCandidate.id) {
        originHub = fromCandidate;
        destHub = toCandidate;
      }
    }

    return {
      hasRouteIntent: true,
      origin: originHub,
      destination: destHub,
      preference
    };
  }

  if (foundHubs.length === 1) {
    return {
      hasRouteIntent: false,
      singleHub: foundHubs[0].hub,
      preference
    };
  }

  return null;
}

/**
 * Formats structured multimodal routing results into courteous, verified Markdown
 */
function formatDeterministicReply(routeResult) {
  if (!routeResult || !routeResult.success || !routeResult.routes || routeResult.routes.length === 0) {
    return `No verified transit route is currently available for that corridor in our Jammu municipal network.`;
  }

  const primary = routeResult.routes[0];
  const origin = routeResult.origin.name;
  const destination = routeResult.destination.name;

  let reply = `Here is the verified **${primary.label}** journey from **${origin}** to **${destination}** (~${primary.totalDistanceKm} km):\n\n`;
  reply += `• **Modes**: ${primary.summary}\n`;
  reply += `• **Estimated Duration**: ~${primary.totalDurationMins} mins\n`;
  reply += `• **Total Fare**: ₹${primary.totalFare} (${primary.confidence === 'verified' ? 'Verified municipal rates' : 'Estimated'})\n`;
  reply += `• **Transfers**: ${primary.transfers === 0 ? 'Direct connection (0 transfers)' : `${primary.transfers} transfer(s)`}\n`;

  const primaryVia = primary.legs.map(l => l.to).slice(0, -1);
  if (primaryVia.length > 0) {
    reply += `• **Intermediate Waypoints**: ${primaryVia.join(', ')}\n`;
  }
  reply += '\n';

  reply += `**Step-by-step Journey Legs**:\n`;
  for (const leg of primary.legs) {
    const modeIcon = leg.mode === 'bus' ? '🚌' : leg.mode === 'erickshaw' ? '🛺' : leg.mode === 'walking' ? '🚶' : '🚗';
    reply += `${leg.legIndex}. ${modeIcon} **${leg.mode.toUpperCase()}** (${leg.line}): ${leg.instruction} (~${leg.durationMins} mins, ₹${leg.fare})\n`;
  }

  if (routeResult.routes.length > 1) {
    reply += `\n**Alternative Option(s)**:\n`;
    for (let i = 1; i < routeResult.routes.length; i++) {
      const alt = routeResult.routes[i];
      const altLines = alt.legs.map(l => l.line).join(' + ');
      const altVia = alt.legs.map(l => l.to).slice(0, -1);
      const viaText = altVia.length > 0 ? ` via ${altVia.join(', ')}` : '';
      reply += `• **${alt.label}**: ${altLines}${viaText} (~${alt.totalDurationMins} mins, ₹${alt.totalFare}, ${alt.transfers} transfers)\n`;
    }
  }

  reply += `\n💡 *Tip: You can view the route cards and switch preferences (⚡ Fastest / 💰 Cheapest / 🔄 Fewer Transfers) using the Journey Planner.*`;

  return reply;
}

module.exports = {
  CANONICAL_HUBS,
  STATIC_CONNECTIONS,
  haversineDistance,
  resolveHub,
  buildTransitGraph,
  findMultimodalRoutes,
  extractTransitIntent,
  formatDeterministicReply
};
