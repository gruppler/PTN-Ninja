const { cloneDeep, compact, isEmpty } = require("lodash");

exports.findRoads = function(squares, player) {
  const players = player ? [player] : [1, 2];
  let possibleRoads = { 1: {}, 2: {} };
  let connections = {};
  let possibleDeadEnds = { 1: [], 2: [] };
  let deadEnds = [];
  let roads = {
    1: [],
    2: [],
    squares: {
      1: [],
      2: []
    },
    edges: {
      1: { NS: false, EW: false },
      2: { NS: false, EW: false }
    },
    length: 0
  };
  let road;

  // Gather player-controlled squares and dead ends
  squares.forEach(row =>
    row.forEach(square => {
      let piece = square.piece;
      if (piece && !piece.isStanding) {
        let player = piece.color;
        connections[square.coord] = square.connected
          .map(side => square.neighbors[side])
          .filter(square => square);

        let neighbors = connections[square.coord];

        if (neighbors.length === 1) {
          if (square.isEdge) {
            // An edge with exactly one friendly neighbor
            possibleRoads[player][square.coord] = square;
            possibleDeadEnds[player].push(square);
          } else {
            // A non-edge dead end
            deadEnds.push(square);
          }
        } else if (neighbors.length > 1) {
          // An intersection
          possibleRoads[player][square.coord] = square;
          if (
            square.isEdge &&
            neighbors.length === 2 &&
            neighbors.find(square => square.isEdge) &&
            neighbors.find(square => !square.isEdge)
          ) {
            possibleDeadEnds[player].push(square);
          }
        }
      } else {
        connections[square.coord] = [];
      }
    })
  );

  // Remove dead ends not connected to edges
  players.forEach(player =>
    removeDeadEnds(deadEnds, possibleRoads[player], connections)
  );

  // Find roads that actually bridge opposite edges
  players.forEach(player => {
    while (!isEmpty(possibleRoads[player])) {
      // Follow any square to get all connected squares
      road = followRoad(
        possibleRoads[player][Object.keys(possibleRoads[player])[0]],
        possibleRoads,
        connections
      );

      // Find connected opposite edge pair(s)
      road.edges.NS = (road.edges.S && road.edges.N) || false;
      road.edges.EW = (road.edges.W && road.edges.E) || false;

      if (road.edges.NS || road.edges.EW) {
        if (!road.edges.NS || !road.edges.EW) {
          // Remove dead ends connected to the non-winning edges
          removeDeadEnds(
            possibleDeadEnds[player],
            road.squares,
            connections,
            road.edges.NS ? "NS" : "EW"
          );
          addRoad(roads, road, player);
        } else {
          // Double road; split into two separate roads
          let road2 = cloneDeep(road);
          road.edges.EW = false;
          road2.edges.NS = false;
          removeDeadEnds(
            possibleDeadEnds[player],
            road.squares,
            connections,
            "NS"
          );
          removeDeadEnds(
            possibleDeadEnds[player],
            road2.squares,
            connections,
            "EW"
          );
          addRoad(roads, road, player);
          addRoad(roads, road2, player);
        }
      }
    }
    roads.squares[player] = Object.keys(roads.squares[player]) || [];
    roads.length += roads[player].length;
  });

  return roads;
};

// Recursively follow a square and return all connected squares and edges
function followRoad(square, possibleRoads, connections) {
  let squares = {};
  let edges = {};
  let road;
  let player = square.piece.color;

  squares[square.coord] = square;
  delete possibleRoads[player][square.coord];

  if (square.isEdge) {
    // Note which edge(s) the road touches
    square.edges.forEach(edge => (edges[edge] = true));
  }

  connections[square.coord].forEach(neighbor => {
    if (neighbor.coord in possibleRoads[player]) {
      // Haven't gone this way yet; find out where it goes
      road = followRoad(neighbor, possibleRoads, connections);
      // Report back squares and edges
      Object.assign(squares, road.squares);
      Object.assign(edges, road.edges);
    }
  });

  return {
    squares: squares,
    edges: edges
  };
}

// Remove all deadEnds and their non-junction neighbors from squares
function removeDeadEnds(deadEnds, squares, connections, winningEdge = "") {
  deadEnds = deadEnds.concat();
  while (deadEnds.length) {
    deadEnds.forEach((square, i) => {
      let isWinningEdge =
        (square.isEdge && !winningEdge) || square["is" + winningEdge];
      let nextNeighbors = [];
      connections[square.coord].forEach(neighbor => {
        if (neighbor.coord in squares) {
          nextNeighbors.push(neighbor);
        }
      });

      if (
        nextNeighbors.length < 2 &&
        (!isWinningEdge ||
          (nextNeighbors[0] && nextNeighbors[0]["is" + winningEdge]))
      ) {
        delete squares[square.coord];
        deadEnds[i] = nextNeighbors[0];
      } else {
        deadEnds[i] = undefined;
      }
    });
    deadEnds = compact(deadEnds);
  }
}

// Add a road to the output
function addRoad(roads, road, player) {
  roads[player].push({
    edges: road.edges,
    squares: Object.keys(road.squares)
  });
  Object.assign(roads.squares[player], road.squares);
  if (road.edges.NS) roads.edges[player].NS = true;
  if (road.edges.EW) roads.edges[player].EW = true;
}
