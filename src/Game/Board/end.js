import Result from "../PTN/Result";

import { cloneDeep, compact, isEmpty } from "lodash";

export default class BoardGameEnd {
  checkGameEnd(updatePTN = true) {
    if (!this.ply) {
      return false;
    }

    let player = this.ply.player;
    let pieces = this.pieces.played[player];
    let roads = this.findRoads();
    let result;

    if (roads && roads.length) {
      // Check current player first
      if (roads[player].length) {
        result = player == 1 ? "R-0" : "0-R";
      } else if (roads[player == 1 ? 2 : 1].length) {
        // Completed opponent's road
        result = player == 1 ? "0-R" : "R-0";
      }
    } else if (
      pieces.flat.length + pieces.cap.length ===
        this.game.pieceCounts[player].total ||
      !this.squares.find((row) => row.find((square) => !square.pieces.length))
    ) {
      // Last empty square or last piece
      if (this.flats[0] == this.flats[1]) {
        // Draw
        result = "1/2-1/2";
      } else if (this.flats[0] > this.flats[1]) {
        result = "F-0";
      } else {
        result = "0-F";
      }
    } else if (this.ply.result && this.ply.result.type != "1") {
      this.ply.result = null;
      this.game._updatePTN();
      return false;
    } else {
      return false;
    }

    result = Result.parse(result);
    if (roads && roads.length) {
      result.roads = roads;
    }
    this.ply.result = result;
    if (updatePTN) {
      this.game._updatePTN();
    }

    return true;
  }

  findRoads(player) {
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
        2: [],
      },
      edges: {
        1: { NS: false, EW: false },
        2: { NS: false, EW: false },
      },
      length: 0,
    };
    let road;

    // Gather player-controlled squares and dead ends
    this.forEachSquare((square) => {
      let piece = square.piece;
      if (piece && !piece.isStanding) {
        let player = piece.color;
        connections[square.static.coord] = square.connected
          .map((side) => square.static.neighbors[side])
          .filter((square) => square);

        let neighbors = connections[square.static.coord];

        if (neighbors.length === 1) {
          if (square.static.isEdge) {
            // An edge with exactly one friendly neighbor
            possibleRoads[player][square.static.coord] = square;
            possibleDeadEnds[player].push(square);
          } else {
            // A non-edge dead end
            deadEnds.push(square);
          }
        } else if (neighbors.length > 1) {
          // An intersection
          possibleRoads[player][square.static.coord] = square;
          if (
            square.static.isEdge &&
            neighbors.length === 2 &&
            neighbors.find((square) => square.static.isEdge) &&
            neighbors.find((square) => !square.static.isEdge)
          ) {
            possibleDeadEnds[player].push(square);
          }
        }
      } else {
        connections[square.static.coord] = [];
      }
    });

    // Remove dead ends not connected to edges
    players.forEach((player) =>
      removeDeadEnds(deadEnds, possibleRoads[player], connections)
    );

    // Find roads that actually bridge opposite edges
    players.forEach((player) => {
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

    return Object.freeze(roads);
  }
}

// Recursively follow a square and return all connected squares and edges
function followRoad(square, possibleRoads, connections) {
  let squares = {};
  let edges = {};
  let road;
  let player = square.piece.color;

  squares[square.static.coord] = square;
  delete possibleRoads[player][square.static.coord];

  if (square.static.isEdge) {
    // Note which edge(s) the road touches
    square.static.edges.forEach((edge) => (edges[edge] = true));
  }

  connections[square.static.coord].forEach((neighbor) => {
    if (neighbor.static.coord in possibleRoads[player]) {
      // Haven't gone this way yet; find out where it goes
      road = followRoad(neighbor, possibleRoads, connections);
      // Report back squares and edges
      Object.assign(squares, road.squares);
      Object.assign(edges, road.edges);
    }
  });

  return {
    squares: squares,
    edges: edges,
  };
}

// Remove all deadEnds and their non-junction neighbors from squares
function removeDeadEnds(deadEnds, squares, connections, winningEdge = "") {
  deadEnds = deadEnds.concat();
  while (deadEnds.length) {
    deadEnds.forEach((square, i) => {
      let isWinningEdge =
        (square.static.isEdge && !winningEdge) ||
        square.static["is" + winningEdge];
      let nextNeighbors = [];
      connections[square.static.coord].forEach((neighbor) => {
        if (neighbor.static.coord in squares) {
          nextNeighbors.push(neighbor);
        }
      });

      if (
        nextNeighbors.length < 2 &&
        (!isWinningEdge ||
          (nextNeighbors[0] && nextNeighbors[0].static["is" + winningEdge]))
      ) {
        delete squares[square.static.coord];
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
    squares: Object.keys(road.squares),
  });
  Object.assign(roads.squares[player], road.squares);
  if (road.edges.NS) roads.edges[player].NS = true;
  if (road.edges.EW) roads.edges[player].EW = true;
}
