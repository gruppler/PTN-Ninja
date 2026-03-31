import Vue from "vue";
import Game from "../../Game";

const PLAYTAK_WS_HOST = process.env.DEV
  ? "beta.playtak.com"
  : "www.playtak.com";
const PLAYTAK_API_HOST = process.env.DEV
  ? "api.beta.playtak.com"
  : "api.playtak.com";

export const PLAYTAK_GAMES_URL = `https://${PLAYTAK_WS_HOST}/games`;

export const PLAYTAK_API_BASE_URL = process.env.DEV
  ? "/playtak-api/v1"
  : `https://${PLAYTAK_API_HOST}/v1`;

const PLAYTAK_WS_URL = `wss://${PLAYTAK_WS_HOST}/ws`;
const PLAYTAK_WS_PROTOCOL = "binary";
const PLAYTAK_CLIENT_NAME = "PTN Ninja";
const PLAYTAK_START_TIMEOUT_MS = 15000;
const PLAYTAK_KEEPALIVE_MS = 25000;

let playtakFollowSession = null;

const parseInteger = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createPlaytakGuestToken = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const length = 20;
  let token = "";

  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.getRandomValues
  ) {
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      token += chars[values[i] % chars.length];
    }
    return token;
  }

  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
};

const decodePlaytakMessage = async (payload) => {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload instanceof Blob) {
    const buffer = await payload.arrayBuffer();
    return new TextDecoder("utf-8").decode(new Uint8Array(buffer));
  }

  if (payload instanceof ArrayBuffer) {
    return new TextDecoder("utf-8").decode(new Uint8Array(payload));
  }

  return String(payload || "");
};

const parsePlaytakObserveLine = (line) => {
  const spl = line.trim().split(/\s+/);
  if (spl[0] !== "Observe" || spl.length < 10) {
    return null;
  }

  return {
    id: parseInteger(spl[1], 0),
    player1: spl[2],
    player2: spl[3],
    size: parseInteger(spl[4], 0),
    time: parseInteger(spl[5], 0),
    increment: parseInteger(spl[6], 0),
    komiHalf: parseInteger(spl[7], 0),
    flats: parseInteger(spl[8], 0),
    caps: parseInteger(spl[9], 0),
  };
};

const parseGameListIDToken = (value) =>
  parseInteger(String(value || "").replace(/^Game#/i, ""), 0);

const isLikelyPlaytakRating = (value) => Number.isFinite(value) && value >= 100;

const isLikelyExtraMove = (value) =>
  Number.isFinite(value) && value > 0 && value <= 200;

const isLikelyExtraTime = (value) =>
  Number.isFinite(value) && value > 0 && value <= 7200;

const parseGameListOptionalFields = (tokens) => {
  const values = tokens.map((value) => parseInteger(value, 0));
  let extraMove = 0;
  let extraTime = 0;
  let rating1 = 0;
  let rating2 = 0;

  if (values.length >= 4) {
    [extraMove, extraTime, rating1, rating2] = values;
    return { extraMove, extraTime, rating1, rating2 };
  }

  if (values.length === 3) {
    const [first, second, third] = values;
    extraMove = first;
    extraTime = second;
    rating1 = third;
    return { extraMove, extraTime, rating1, rating2 };
  }

  if (values.length === 2) {
    const [first, second] = values;
    const looksLikeExtras =
      isLikelyExtraMove(first) && isLikelyExtraTime(second);
    const looksLikeRatings =
      isLikelyPlaytakRating(first) || isLikelyPlaytakRating(second);

    if (!looksLikeExtras && looksLikeRatings) {
      rating1 = first;
      rating2 = second;
    } else {
      extraMove = first;
      extraTime = second;
    }

    return { extraMove, extraTime, rating1, rating2 };
  }

  if (values.length === 1) {
    const [first] = values;
    if (isLikelyPlaytakRating(first)) {
      rating1 = first;
    } else {
      extraMove = first;
    }
  }

  return { extraMove, extraTime, rating1, rating2 };
};

const parsePlaytakGameListAddLine = (line) => {
  const spl = line.trim().split(/\s+/);
  if (spl[0] !== "GameList" || spl[1] !== "Add" || spl.length < 11) {
    return null;
  }

  const id = parseGameListIDToken(spl[2]);
  if (!id) {
    return null;
  }

  let index = 3;
  const player1 = spl[index++] || "";
  if (!player1) {
    return null;
  }

  let rating1 = 0;
  const maybeRating1 = parseInteger(spl[index], 0);
  if (isLikelyPlaytakRating(maybeRating1) && spl[index + 1] === "vs") {
    rating1 = maybeRating1;
    index += 1;
  }

  let player2 = "";
  if (spl[index] === "vs") {
    player2 = spl[index + 1] || "";
    index += 2;
  } else {
    player2 = spl[index] || "";
    index += 1;
  }

  if (!player2) {
    return null;
  }

  let rating2 = 0;
  const maybeRating2 = parseInteger(spl[index], 0);
  if (isLikelyPlaytakRating(maybeRating2)) {
    rating2 = maybeRating2;
    index += 1;
  }

  if (spl.length - index < 8) {
    return null;
  }

  const size = parseInteger(spl[index++], 0);
  const time = parseInteger(spl[index++], 0);
  const increment = parseInteger(spl[index++], 0);
  const komiHalf = parseInteger(spl[index++], 0);
  const flats = parseInteger(spl[index++], 0);
  const caps = parseInteger(spl[index++], 0);
  const unrated = spl[index++] === "1";
  const tournament = spl[index++] === "1";

  const optionalFields = parseGameListOptionalFields(spl.slice(index));

  return {
    id,
    player1,
    player2,
    size,
    time,
    increment,
    komiHalf,
    flats,
    caps,
    unrated,
    tournament,
    extraMove: optionalFields.extraMove,
    extraTime: optionalFields.extraTime,
    rating1: rating1 || optionalFields.rating1,
    rating2: rating2 || optionalFields.rating2,
  };
};

const parsePlaytakGameListRemoveLine = (line) => {
  const spl = line.trim().split(/\s+/);
  if (spl[0] !== "GameList" || spl[1] !== "Remove" || spl.length < 3) {
    return 0;
  }

  return parseGameListIDToken(spl[2]);
};

const convertPlaytakMoveToPTN = (command, args) => {
  if (command === "P") {
    const square = args[0];
    if (!/^[A-H][1-8]$/i.test(square || "")) {
      return null;
    }
    const piece = args[1] === "C" ? "C" : args[1] === "W" ? "S" : "";
    return piece + square.toLowerCase();
  }

  if (command === "M") {
    const from = args[0];
    const to = args[1];
    if (!/^[A-H][1-8]$/i.test(from || "") || !/^[A-H][1-8]$/i.test(to || "")) {
      return null;
    }

    const file1 = from[0].toUpperCase();
    const rank1 = parseInteger(from[1], 0);
    const file2 = to[0].toUpperCase();
    const rank2 = parseInteger(to[1], 0);

    let direction = "";
    if (file2 === file1) {
      direction = rank2 > rank1 ? "+" : "-";
    } else {
      direction = file2 > file1 ? ">" : "<";
    }

    const drops = args.slice(2).filter((n) => /^\d+$/.test(n));
    if (!drops.length) {
      return null;
    }
    const carry = drops.reduce((sum, n) => sum + parseInteger(n, 0), 0);
    return `${carry}${from.toLowerCase()}${direction}${drops.join("")}`;
  }

  return null;
};

const isCurrentGamePlaytakID = (id) => {
  const game = Vue.prototype.$game;
  if (!game) {
    return false;
  }

  if (game.config && game.config.playtakID !== undefined) {
    return String(game.config.playtakID) === String(id);
  }

  const raw = game.tag("playtakid", true);
  const text = game.tag("playtakid");
  return String(raw || text || "") === String(id);
};

const isAtEndOfMainBranch = (game) =>
  game && game.board.ply
    ? !game.board.ply.branch && !game.board.nextPly && game.board.plyIsDone
    : game && game.plies.length === 0;

const getPlaytakMainlinePlies = (game) =>
  game.plies.filter((ply) => ply && !ply.branch && ply.text !== "--");

const getPlaytakSyncedMainlineCount = (game) => {
  if (!game) {
    return 0;
  }
  const mainlineLength = game.plies.filter(
    (ply) => ply && !ply.branch && ply.text !== "--"
  ).length;
  const configuredCount = parseInteger(
    game.config && game.config.playtakSyncedMainline,
    mainlineLength
  );
  return Math.max(0, Math.min(configuredCount, mainlineLength));
};

const flushPlaytakFollowQueue = async (dispatch, session) => {
  if (!session || session.flushing || !session.gameReady) {
    return;
  }

  session.flushing = true;
  try {
    while (
      playtakFollowSession === session &&
      session.gameReady &&
      session.queue.length
    ) {
      if (!isCurrentGamePlaytakID(session.id)) {
        stopPlaytakFollowSession();
        return;
      }

      const ply = session.queue.shift();
      await dispatch("APPEND_PLY", {
        ply,
        playtakLive: {
          playtakID: session.id,
          syncedMainlineCount: session.syncedMainlineCount,
        },
      });
      const game = Vue.prototype.$game;
      if (game && game.config) {
        session.syncedMainlineCount = parseInteger(
          game.config.playtakSyncedMainline,
          session.syncedMainlineCount
        );
      }
    }
  } catch (error) {
    console.error(error);
    stopPlaytakFollowSession();
  } finally {
    session.flushing = false;
  }
};

export const getPlaytakFollowSessionGameName = () =>
  playtakFollowSession && playtakFollowSession.gameName
    ? playtakFollowSession.gameName
    : null;

export const isPlaytakFollowSessionActive = () => !!playtakFollowSession;

export const stopPlaytakFollowSession = () => {
  const session = playtakFollowSession;
  if (!session) {
    return;
  }

  playtakFollowSession = null;
  session.isStopping = true;

  if (session.startTimeout) {
    clearTimeout(session.startTimeout);
    session.startTimeout = null;
  }

  if (session.keepAliveTimer) {
    clearInterval(session.keepAliveTimer);
    session.keepAliveTimer = null;
  }

  if (session.socket && session.socket.readyState <= WebSocket.OPEN) {
    try {
      session.socket.close();
    } catch (error) {
      console.error(error);
    }
  }
};

export const followPlaytakGame = ({
  id,
  state = null,
  dispatch,
  notifyWarning,
}) => {
  const gameID = parseInteger(id, 0);
  if (!gameID) {
    throw "Game does not exist";
  }

  stopPlaytakFollowSession();

  return new Promise((resolve, reject) => {
    const session = {
      id: gameID,
      socket: null,
      guestToken: createPlaytakGuestToken(),
      isStopping: false,
      startupDone: false,
      observeReceived: false,
      gameReady: false,
      gameName: null,
      queue: [],
      flushing: false,
      lastMoveKey: null,
      replayMainline: [],
      replayIndex: 0,
      syncedMainlineCount: 0,
      startTimeout: null,
      keepAliveTimer: null,
    };

    playtakFollowSession = session;

    const rejectStartup = (error) => {
      if (session.startupDone) {
        return;
      }
      session.startupDone = true;
      stopPlaytakFollowSession();
      reject(error && error.message ? error.message : error || "unknown");
    };

    const resolveStartup = (game) => {
      if (session.startupDone) {
        return;
      }
      session.startupDone = true;
      resolve(game);
    };

    const send = (message) => {
      if (
        session.socket &&
        session.socket.readyState === WebSocket.OPEN &&
        playtakFollowSession === session
      ) {
        session.socket.send(message);
      }
    };

    const sendLogin = () => {
      send(`Client ${PLAYTAK_CLIENT_NAME}`);
      send("Protocol 2");
      send(`Login Guest ${session.guestToken}`);
    };

    const startKeepAlive = () => {
      if (session.keepAliveTimer) {
        clearInterval(session.keepAliveTimer);
      }
      session.keepAliveTimer = setInterval(() => {
        send("PING");
      }, PLAYTAK_KEEPALIVE_MS);
    };

    const handleLine = (line) => {
      if (playtakFollowSession !== session) {
        return;
      }

      if (line.startsWith("Login or Register")) {
        sendLogin();
        return;
      }

      if (line.startsWith("Error")) {
        if (!session.observeReceived) {
          const message = line.includes(":")
            ? line.split(":").slice(1).join(":").trim()
            : line.substring(5).trim();
          rejectStartup(message || "Game does not exist");
        }
        return;
      }

      if (line.startsWith("Welcome ")) {
        send(`Observe ${session.id}`);
        return;
      }

      if (line.startsWith("Observe ")) {
        const info = parsePlaytakObserveLine(line);
        if (!info || info.id !== session.id) {
          return;
        }

        session.observeReceived = true;
        if (session.startTimeout) {
          clearTimeout(session.startTimeout);
          session.startTimeout = null;
        }

        if (isCurrentGamePlaytakID(session.id)) {
          const currentGame = Vue.prototype.$game;
          if (currentGame && !currentGame.board.isGameEnd) {
            session.syncedMainlineCount =
              getPlaytakSyncedMainlineCount(currentGame);
            session.replayMainline = currentGame.plies
              .filter((ply) => !ply.branch && ply.text !== "--")
              .slice(0, session.syncedMainlineCount)
              .map((ply) => ply.text);
            session.replayIndex = 0;
            session.gameReady = true;
            session.gameName = currentGame.name;
            resolveStartup(currentGame);
            flushPlaytakFollowQueue(dispatch, session);
            return;
          }
        }

        const tags = {
          site: "PlayTak.com",
          event: "Online Play",
          player1: info.player1,
          player2: info.player2,
          size: info.size,
          komi: info.komiHalf / 2,
          flats: info.flats,
          caps: info.caps,
        };
        const game = new Game({
          tags,
          state,
          config: {
            playtakID: String(session.id),
            playtakLive: true,
            playtakSyncedMainline: 0,
          },
        });

        if (notifyWarning) {
          game.warnings.forEach((warning) => notifyWarning(warning));
        }

        dispatch("ADD_GAME", game)
          .then(() => {
            if (playtakFollowSession !== session) {
              return;
            }
            const activeGame = Vue.prototype.$game || game;
            session.syncedMainlineCount =
              getPlaytakSyncedMainlineCount(activeGame);
            session.gameReady = true;
            session.gameName = Vue.prototype.$game
              ? Vue.prototype.$game.name
              : null;
            resolveStartup(Vue.prototype.$game || game);
            flushPlaytakFollowQueue(dispatch, session);
          })
          .catch(rejectStartup);
        return;
      }

      const gameMsg = line.match(/^Game#(\d+)\s+(.*)$/);
      if (!gameMsg || parseInteger(gameMsg[1], 0) !== session.id) {
        return;
      }

      const parts = gameMsg[2].split(/\s+/);
      const command = parts[0];

      if (command === "P" || command === "M") {
        const moveKey = parts.join(" ");
        if (moveKey === session.lastMoveKey) {
          return;
        }
        session.lastMoveKey = moveKey;

        const ply = convertPlaytakMoveToPTN(command, parts.slice(1));
        if (!ply) {
          return;
        }

        if (session.replayIndex < session.replayMainline.length) {
          const expectedPly = session.replayMainline[session.replayIndex];
          if (expectedPly === ply) {
            session.replayIndex += 1;
            return;
          }
          session.syncedMainlineCount = Math.max(
            0,
            Math.min(
              session.replayIndex,
              parseInteger(session.syncedMainlineCount, 0)
            )
          );
          session.replayIndex = session.replayMainline.length;
        }

        session.queue.push(ply);
        if (session.gameReady) {
          flushPlaytakFollowQueue(dispatch, session);
        }
        return;
      }

      if (
        command === "Undo" &&
        session.gameReady &&
        isCurrentGamePlaytakID(session.id)
      ) {
        const game = Vue.prototype.$game;
        if (game) {
          const plies = game.plies.filter((ply) => ply.branch === "");
          const lastPly = plies.length ? plies[plies.length - 1] : null;
          if (lastPly) {
            session.syncedMainlineCount = Math.max(
              0,
              parseInteger(session.syncedMainlineCount, 0) - 1
            );
            dispatch("DELETE_PLY", {
              plyID: lastPly.id,
              fromServer: true,
              playtakLive: {
                playtakID: session.id,
                syncedMainlineCount: session.syncedMainlineCount,
              },
            });
          }
        }
      }
    };

    session.startTimeout = setTimeout(() => {
      if (!session.observeReceived) {
        rejectStartup("Game does not exist");
      }
    }, PLAYTAK_START_TIMEOUT_MS);

    try {
      session.socket = new WebSocket(PLAYTAK_WS_URL, PLAYTAK_WS_PROTOCOL);
    } catch (error) {
      rejectStartup(error);
      return;
    }

    session.socket.onopen = () => {
      sendLogin();
      startKeepAlive();
    };

    session.socket.onmessage = async ({ data }) => {
      try {
        const message = await decodePlaytakMessage(data);
        message
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach(handleLine);
      } catch (error) {
        console.error(error);
      }
    };

    session.socket.onerror = () => {
      if (!session.observeReceived) {
        rejectStartup("Could not connect to PlayTak");
      }
    };

    session.socket.onclose = () => {
      if (session.startTimeout) {
        clearTimeout(session.startTimeout);
        session.startTimeout = null;
      }

      if (session.keepAliveTimer) {
        clearInterval(session.keepAliveTimer);
        session.keepAliveTimer = null;
      }

      if (playtakFollowSession === session) {
        playtakFollowSession = null;
      }

      if (!session.isStopping && !session.startupDone) {
        reject("Disconnected from PlayTak");
      }
    };
  });
};

export const fetchPlaytakOngoingGames = ({ timeoutMs = 2200 } = {}) => {
  if (typeof WebSocket === "undefined") {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    const guestToken = createPlaytakGuestToken();
    const games = new Map();
    let socket = null;
    let done = false;
    let timeout = null;

    const finalize = (error = null) => {
      if (done) {
        return;
      }
      done = true;

      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      if (socket && socket.readyState <= WebSocket.OPEN) {
        try {
          socket.close();
        } catch (closeError) {
          console.error(closeError);
        }
      }

      if (error) {
        reject(error);
        return;
      }

      resolve(Array.from(games.values()).sort((a, b) => b.id - a.id));
    };

    const send = (message) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    };

    const sendLogin = () => {
      send(`Client ${PLAYTAK_CLIENT_NAME}`);
      send("Protocol 2");
      send(`Login Guest ${guestToken}`);
    };

    timeout = setTimeout(() => finalize(), timeoutMs);

    try {
      socket = new WebSocket(PLAYTAK_WS_URL, PLAYTAK_WS_PROTOCOL);
    } catch (error) {
      finalize(error);
      return;
    }

    socket.onopen = () => {
      sendLogin();
    };

    socket.onmessage = async ({ data }) => {
      if (done) {
        return;
      }

      try {
        const message = await decodePlaytakMessage(data);
        message
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => {
            if (line.startsWith("Login or Register")) {
              sendLogin();
              return;
            }

            if (line.startsWith("GameList Add ")) {
              const game = parsePlaytakGameListAddLine(line);
              if (game && game.id) {
                games.set(game.id, game);
              }
              return;
            }

            if (line.startsWith("GameList Remove ")) {
              const id = parsePlaytakGameListRemoveLine(line);
              if (id) {
                games.delete(id);
              }
            }
          });
      } catch (error) {
        console.error(error);
      }
    };

    socket.onerror = () => {
      finalize("Could not connect to PlayTak");
    };

    socket.onclose = () => {
      finalize();
    };
  });
};
