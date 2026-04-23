import Vue from "vue";
import Game from "../../Game";
import Tag from "../../Game/PTN/Tag";

const PLAYTAK_WS_HOST = process.env.PLAYTAK_BETA
  ? "beta.playtak.com"
  : "playtak.com";
const PLAYTAK_API_HOST = process.env.PLAYTAK_BETA
  ? "api.beta.playtak.com"
  : "api.playtak.com";

export const PLAYTAK_GAMES_URL = `https://${PLAYTAK_WS_HOST}/games`;

export const PLAYTAK_API_BASE_URL = process.env.PLAYTAK_USE_PROXY
  ? "/playtak-api/v1"
  : `https://${PLAYTAK_API_HOST}/v1`;

const PLAYTAK_WS_URL = `wss://${PLAYTAK_WS_HOST}/ws`;
const PLAYTAK_WS_PROTOCOL = "binary";
const PLAYTAK_CLIENT_NAME = "PTN Ninja";
const PLAYTAK_START_TIMEOUT_MS = 15000;
const PLAYTAK_KEEPALIVE_MS = 25000;
const PLAYTAK_GUEST_TOKEN_STORAGE_KEY = "playtakGuestToken";

let playtakFollowSession = null;
let playtakOngoingSession = null;
let playtakGuestToken = "";
const playtakRatingsCache = new Map();
const playtakRatingsInFlight = new Map();
const playtakConnectionState = Vue.observable({
  follow: false,
  ongoing: false,
});

const setPlaytakConnectionState = (key, connected) => {
  playtakConnectionState[key] = Boolean(connected);
};

export const getPlaytakConnectionState = () => playtakConnectionState;

export const isPlaytakConnected = () =>
  playtakConnectionState.follow || playtakConnectionState.ongoing;

const parseInteger = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFlexibleInteger = (value, fallback = 0) => {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }

  const parsed = parseInt(text, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  const match = text.match(/-?\d+/);
  if (!match) {
    return fallback;
  }

  const matched = parseInt(match[0], 10);
  return Number.isFinite(matched) ? matched : fallback;
};

const PLAYTAK_RESULT_PATTERN =
  /^(0-0|R-0|0-R|F-0|0-F|1-0|0-1|1\/2-1\/2|1\/2)$/i;

export const normalizePlaytakResult = (value) => {
  const source =
    value && typeof value === "object"
      ? value.text ||
        value.valueText ||
        value.ptn ||
        (value.value && value.value.text) ||
        value.value ||
        ""
      : value;

  const text = String(source || "")
    .replace(/½/g, "1/2")
    .trim()
    .toUpperCase()
    .replace(/^[^0-9RF]+/, "")
    .replace(/[^0-9RF\/-]+$/, "");

  if (!text) {
    return "";
  }

  if (!PLAYTAK_RESULT_PATTERN.test(text)) {
    return "";
  }

  return text === "1/2" ? "1/2-1/2" : text;
};

const isPlaytakTerminalResult = (value) => {
  const normalized = normalizePlaytakResult(value);
  return Boolean(normalized && normalized !== "0-0");
};

export const getPlaytakIDFromGame = (game) =>
  String(
    (game && game.config && game.config.playtakID) ||
      (game && typeof game.tag === "function"
        ? game.tag("playtakid", true) || game.tag("playtakid")
        : "") ||
      ""
  ).trim();

const getPlaytakMainlineResult = (game) => {
  if (!game || !Array.isArray(game.plies)) {
    return "";
  }

  const mainline = game.plies.filter(
    (ply) => ply && !ply.branch && ply.text !== "--"
  );
  const lastMainlinePly = mainline.length
    ? mainline[mainline.length - 1]
    : null;

  return normalizePlaytakResult(
    lastMainlinePly && lastMainlinePly.result ? lastMainlinePly.result.text : ""
  );
};

const getPlaytakTagResult = (game) => {
  if (!game) {
    return "";
  }

  if (typeof game.tag === "function") {
    const directResult =
      normalizePlaytakResult(game.tag("result", true)) ||
      normalizePlaytakResult(game.tag("result"));
    if (directResult) {
      return directResult;
    }
  }

  return normalizePlaytakResult(
    game.ptn && game.ptn.tags && game.ptn.tags.result
  );
};

const getPlaytakPtnHeaderResult = (game) => {
  const ptn = game && game.ptn;
  if (typeof ptn !== "string") {
    return "";
  }

  const match = ptn.match(/\[\s*Result\s+"([^"]+)"\s*\]/i);
  return match ? normalizePlaytakResult(match[1]) : "";
};

const getPlaytakStateResult = (game) => {
  const state = game && game.state;
  if (!state) {
    return "";
  }

  const directResult = normalizePlaytakResult(state.result);
  if (directResult) {
    return directResult;
  }

  const statePly = String(state.ply || "").replace(/½/g, "1/2");
  const match = statePly.match(
    /(?:^|\s)(0-0|R-0|0-R|F-0|0-F|1-0|0-1|1\/2-1\/2|1\/2)(?=$|\s|[.,;:!?])/i
  );
  return match ? normalizePlaytakResult(match[1]) : "";
};

const getPlaytakPositionResult = (game) =>
  normalizePlaytakResult(game && game.position && game.position.result);

export const getPlaytakResultFromGame = (game) => {
  const tagResult = getPlaytakTagResult(game);
  const mainlineResult = getPlaytakMainlineResult(game);
  const stateResult = getPlaytakStateResult(game);
  const positionResult = getPlaytakPositionResult(game);
  const ptnHeaderResult = getPlaytakPtnHeaderResult(game);

  return (
    tagResult ||
    mainlineResult ||
    stateResult ||
    positionResult ||
    ptnHeaderResult
  );
};

export const getPlaytakStatusColor = ({
  playtakID = "",
  playtakResult = "",
  finished = false,
  connected = false,
} = {}) => {
  if (!String(playtakID || "").trim()) {
    return null;
  }

  if (finished || isPlaytakTerminalResult(playtakResult)) {
    return null;
  }

  return connected ? "primary" : null;
};

const extractPlaytakResultFromLine = (line) => {
  const text = String(line || "").replace(/½/g, "1/2");
  const match = text.match(
    /(?:^|\s)(0-0|R-0|0-R|F-0|0-F|1-0|0-1|1\/2-1\/2|1\/2)(?=$|\s|[.,;:!?])/i
  );
  return match ? normalizePlaytakResult(match[1]) : "";
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

const isValidPlaytakGuestToken = (value) => /^[a-z]{20}$/i.test(value || "");

const readStoredPlaytakGuestToken = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return "";
  }

  try {
    return String(
      window.localStorage.getItem(PLAYTAK_GUEST_TOKEN_STORAGE_KEY) || ""
    ).trim();
  } catch (error) {
    return "";
  }
};

const storePlaytakGuestToken = (value) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    if (!value) {
      window.localStorage.removeItem(PLAYTAK_GUEST_TOKEN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PLAYTAK_GUEST_TOKEN_STORAGE_KEY, value);
  } catch (error) {
    return;
  }
};

const getPlaytakGuestToken = ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && isValidPlaytakGuestToken(playtakGuestToken)) {
    return playtakGuestToken;
  }

  if (!forceRefresh) {
    const storedToken = readStoredPlaytakGuestToken();
    if (isValidPlaytakGuestToken(storedToken)) {
      playtakGuestToken = storedToken;
      return playtakGuestToken;
    }
  }

  playtakGuestToken = createPlaytakGuestToken();
  storePlaytakGuestToken(playtakGuestToken);
  return playtakGuestToken;
};

const parsePlaytakErrorMessage = (line) => {
  const text = String(line || "").trim();
  if (!text) {
    return "";
  }

  if (text.includes(":")) {
    return text.split(":").slice(1).join(":").trim();
  }

  return text.replace(/^Error\s*/i, "").trim();
};

const shouldRetryPlaytakGuestToken = (message) =>
  /login|register|guest|name|username|auth|taken|invalid/i.test(
    String(message || "")
  );

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

const parsePlayerTokenWithRating = (token) => {
  const raw = String(token || "").trim();
  if (!raw) {
    return { name: "", rating: 0 };
  }

  const match = raw.match(/^(.*?)(?:\[(\d+)\]|\((\d+)\))$/);
  if (!match) {
    return { name: raw, rating: 0 };
  }

  const name = String(match[1] || "").trim();
  const ratingText = match[2] || match[3] || "";
  const rating = parseFlexibleInteger(ratingText, 0);

  if (!name || !isLikelyPlaytakRating(rating)) {
    return { name: raw, rating: 0 };
  }

  return { name, rating };
};

const isLikelyPlaytakRating = (value) => Number.isFinite(value) && value >= 100;

const isLikelyExtraMove = (value) =>
  Number.isFinite(value) && value > 0 && value <= 200;

const isLikelyExtraTime = (value) =>
  Number.isFinite(value) && value > 0 && value <= 7200;

const parseGameListOptionalFields = (tokens) => {
  const values = tokens.map((value) => parseFlexibleInteger(value, 0));
  let extraMove = 0;
  let extraTime = 0;
  let rating1 = 0;
  let rating2 = 0;

  if (values.length >= 4) {
    const [first, second, third, fourth] = values;
    const firstPairLooksLikeRatings =
      isLikelyPlaytakRating(first) && isLikelyPlaytakRating(second);
    const secondPairLooksLikeExtras =
      isLikelyExtraMove(third) && isLikelyExtraTime(fourth);
    const firstPairLooksLikeExtras =
      isLikelyExtraMove(first) && isLikelyExtraTime(second);
    const secondPairLooksLikeRatings =
      isLikelyPlaytakRating(third) && isLikelyPlaytakRating(fourth);

    if (firstPairLooksLikeRatings && secondPairLooksLikeExtras) {
      rating1 = first;
      rating2 = second;
      extraMove = third;
      extraTime = fourth;
    } else if (firstPairLooksLikeExtras && secondPairLooksLikeRatings) {
      extraMove = first;
      extraTime = second;
      rating1 = third;
      rating2 = fourth;
    } else {
      [extraMove, extraTime, rating1, rating2] = values;
    }

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
  const parsedPlayer1 = parsePlayerTokenWithRating(spl[index++] || "");
  const player1 = parsedPlayer1.name;
  if (!player1) {
    return null;
  }

  let rating1 = parsedPlayer1.rating || 0;
  const maybeRating1 = parseFlexibleInteger(spl[index], 0);
  if (isLikelyPlaytakRating(maybeRating1) && spl[index + 1] === "vs") {
    rating1 = maybeRating1;
    index += 1;
  }

  let player2Token = "";
  if (spl[index] === "vs") {
    player2Token = spl[index + 1] || "";
    index += 2;
  } else {
    player2Token = spl[index] || "";
    index += 1;
  }

  const parsedPlayer2 = parsePlayerTokenWithRating(player2Token);
  const player2 = parsedPlayer2.name;

  if (!player2) {
    return null;
  }

  let rating2 = parsedPlayer2.rating || 0;
  const maybeRating2 = parseFlexibleInteger(spl[index], 0);
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

const getPlaytakPlayerRating = async (playerName) => {
  const name = String(playerName || "").trim();
  if (!name || /^guest/i.test(name)) {
    return 0;
  }

  if (playtakRatingsCache.has(name)) {
    return playtakRatingsCache.get(name) || 0;
  }

  if (playtakRatingsInFlight.has(name)) {
    return playtakRatingsInFlight.get(name);
  }

  const request = fetch(
    `${PLAYTAK_API_BASE_URL}/ratings/${encodeURIComponent(name)}`
  )
    .then(async (response) => {
      if (!response || !response.ok) {
        return 0;
      }

      const data = await response.json().catch(() => ({}));
      const rating = parseInteger(data && data.rating, 0);
      return rating > 0 ? rating : 0;
    })
    .catch(() => 0)
    .then((rating) => {
      playtakRatingsCache.set(name, rating);
      return rating;
    })
    .finally(() => {
      playtakRatingsInFlight.delete(name);
    });

  playtakRatingsInFlight.set(name, request);
  return request;
};

const enrichOngoingGamesWithRatings = async (games) => {
  const list = Array.isArray(games) ? games : [];
  if (!list.length) {
    return [];
  }

  const playersNeedingRatings = new Set();
  list.forEach((game) => {
    if (!parseInteger(game && game.rating1, 0)) {
      playersNeedingRatings.add(
        String(game && game.player1 ? game.player1 : "")
      );
    }
    if (!parseInteger(game && game.rating2, 0)) {
      playersNeedingRatings.add(
        String(game && game.player2 ? game.player2 : "")
      );
    }
  });

  const names = Array.from(playersNeedingRatings)
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) {
    return list;
  }

  const ratingEntries = await Promise.all(
    names.map(async (name) => [name, await getPlaytakPlayerRating(name)])
  );
  const ratingsByName = new Map(ratingEntries);

  return list.map((game) => {
    const player1Name = String(game && game.player1 ? game.player1 : "").trim();
    const player2Name = String(game && game.player2 ? game.player2 : "").trim();
    const rating1 =
      parseInteger(game && game.rating1, 0) ||
      ratingsByName.get(player1Name) ||
      0;
    const rating2 =
      parseInteger(game && game.rating2, 0) ||
      ratingsByName.get(player2Name) ||
      0;

    if (rating1 === game.rating1 && rating2 === game.rating2) {
      return game;
    }

    return {
      ...game,
      rating1,
      rating2,
    };
  });
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

const getPlaytakMainlinePlies = (game) => {
  if (!game || !Array.isArray(game.plies)) {
    return [];
  }

  return game.plies.filter((ply) => ply && !ply.branch && ply.text !== "--");
};

const isPlaytakMainlineEnded = (game) => {
  if (!game) {
    return false;
  }

  if (
    game.config &&
    String(game.config.playtakID || "").trim() &&
    game.config.isOngoing === false
  ) {
    return true;
  }

  const mainline = getPlaytakMainlinePlies(game);
  const lastMainlinePly = mainline.length
    ? mainline[mainline.length - 1]
    : null;
  if (lastMainlinePly && lastMainlinePly.result) {
    return true;
  }

  return isPlaytakTerminalResult(getPlaytakResultFromGame(game));
};

export const isPlaytakGameMainlineEnded = (game) =>
  isPlaytakMainlineEnded(game);

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

        if (isPlaytakMainlineEnded(game)) {
          stopPlaytakFollowSession();
          return;
        }
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
    setPlaytakConnectionState("follow", false);
    return;
  }

  playtakFollowSession = null;
  session.isStopping = true;
  setPlaytakConnectionState("follow", false);

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
      guestToken: getPlaytakGuestToken(),
      loginSentCount: 0,
      retriedGuestToken: false,
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
      lastTime1: null,
      lastTime2: null,
      lastTimeUpdate: null,
      lastTimerTurn: null,
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

    const sendLogin = (forceRefreshGuestToken = false) => {
      session.guestToken = getPlaytakGuestToken({
        forceRefresh: forceRefreshGuestToken,
      });
      send(`Client ${PLAYTAK_CLIENT_NAME}`);
      send("Protocol 2");
      send(`Login Guest ${session.guestToken}`);
      session.loginSentCount += 1;
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
        if (!session.loginSentCount) {
          sendLogin();
          return;
        }

        if (!session.retriedGuestToken) {
          session.retriedGuestToken = true;
          sendLogin(true);
          return;
        }

        rejectStartup("Could not login to PlayTak");
        return;
      }

      if (line.startsWith("Error")) {
        const message = parsePlaytakErrorMessage(line);
        if (
          !session.observeReceived &&
          !session.retriedGuestToken &&
          shouldRetryPlaytakGuestToken(message)
        ) {
          session.retriedGuestToken = true;
          sendLogin(true);
          return;
        }

        sendLogin();
        if (!session.observeReceived) {
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
          if (currentGame && !isPlaytakMainlineEnded(currentGame)) {
            session.syncedMainlineCount =
              getPlaytakSyncedMainlineCount(currentGame);
            session.replayMainline = currentGame.plies
              .filter((ply) => !ply.branch && ply.text !== "--")
              .slice(0, session.syncedMainlineCount)
              .map((ply) => ply.text);
            session.replayIndex = 0;
            session.gameReady = true;
            session.gameName = currentGame.name;
            dispatch("SET_PLAYTAK_LIVE_CONFIG", {
              playtakID: session.id,
              syncedMainlineCount: session.syncedMainlineCount,
            });
            session.lastTimerTurn =
              session.syncedMainlineCount % 2 === 0 ? 1 : 2;
            if (session.lastTimeUpdate) {
              dispatch("SET_GAME_TIME", {
                time1: session.lastTime1,
                time2: session.lastTime2,
                lastTimeUpdate: session.lastTimeUpdate,
                timerTurn: session.lastTimerTurn,
              });
            }
            resolveStartup(currentGame);
            flushPlaytakFollowQueue(dispatch, session);
            return;
          }
        }

        const tags = {
          ...Tag.now(),
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
            session.lastTimerTurn =
              session.syncedMainlineCount % 2 === 0 ? 1 : 2;
            if (session.lastTimeUpdate) {
              dispatch("SET_GAME_TIME", {
                time1: session.lastTime1,
                time2: session.lastTime2,
                lastTimeUpdate: session.lastTimeUpdate,
                timerTurn: session.lastTimerTurn,
              });
            }
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
      const reportedResult = extractPlaytakResultFromLine(gameMsg[2]);

      if (
        isPlaytakTerminalResult(reportedResult) &&
        isCurrentGamePlaytakID(session.id) &&
        session.gameReady
      ) {
        const game = Vue.prototype.$game;
        const existingTagResult = normalizePlaytakResult(
          game && typeof game.tag === "function"
            ? game.tag("result", true) || game.tag("result")
            : ""
        );
        const mainline = game ? getPlaytakMainlinePlies(game) : [];
        const lastMainlinePly = mainline.length
          ? mainline[mainline.length - 1]
          : null;
        const existingPlyResult = normalizePlaytakResult(
          lastMainlinePly && lastMainlinePly.result
            ? lastMainlinePly.result.text
            : ""
        );

        if (!existingTagResult) {
          dispatch("SET_TAGS", {
            result: reportedResult,
          }).catch((error) => {
            console.error(error);
          });
        }

        if (!existingPlyResult) {
          dispatch("SET_PLAYTAK_LAST_MAINLINE_RESULT", reportedResult).catch(
            (error) => {
              console.error(error);
            }
          );
        }

        dispatch("MARK_PLAYTAK_ENDED");
        stopPlaytakFollowSession();
        return;
      }

      if (command === "Time" || command === "Timems") {
        const isMs = command === "Timems";
        const time1 =
          Math.max(parseInteger(parts[1], 0), 0) * (isMs ? 1 : 1000);
        const time2 =
          Math.max(parseInteger(parts[2], 0), 0) * (isMs ? 1 : 1000);

        session.lastTime1 = time1;
        session.lastTime2 = time2;
        session.lastTimeUpdate = performance.now();

        if (session.gameReady) {
          dispatch("SET_GAME_TIME", {
            time1,
            time2,
            lastTimeUpdate: session.lastTimeUpdate,
            timerTurn: session.lastTimerTurn,
          });
        }
        return;
      }

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

        session.lastTimerTurn = session.lastTimerTurn === 1 ? 2 : 1;
        if (session.gameReady) {
          dispatch("SET_GAME_TIMER_TURN", session.lastTimerTurn);
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
        session.lastTimerTurn = session.lastTimerTurn === 1 ? 2 : 1;
        dispatch("SET_GAME_TIMER_TURN", session.lastTimerTurn);
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
      setPlaytakConnectionState("follow", true);
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

      setPlaytakConnectionState("follow", false);

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

  const toSortedGames = (session) =>
    Array.from(session.games.values()).sort((a, b) => b.id - a.id);

  const createOngoingSession = () => ({
    socket: null,
    guestToken: getPlaytakGuestToken(),
    loginSentCount: 0,
    retriedGuestToken: false,
    games: new Map(),
    keepAliveTimer: null,
    hasReceivedGameList: false,
    waiters: [],
    isStopping: false,
  });

  const resolveWaiters = async (session) => {
    if (!session.waiters.length) {
      return;
    }
    const snapshot = await enrichOngoingGamesWithRatings(
      toSortedGames(session)
    );
    const waiters = [...session.waiters];
    session.waiters = [];
    waiters.forEach((waiter) => {
      try {
        waiter.resolve(snapshot);
      } catch (error) {
        console.error(error);
      }
    });
  };

  const rejectWaiters = (session, error) => {
    if (!session.waiters.length) {
      return;
    }
    const waiters = [...session.waiters];
    session.waiters = [];
    waiters.forEach((waiter) => {
      try {
        waiter.reject(error);
      } catch (rejectError) {
        console.error(rejectError);
      }
    });
  };

  const startOngoingKeepAlive = (session) => {
    if (session.keepAliveTimer) {
      clearInterval(session.keepAliveTimer);
    }
    session.keepAliveTimer = setInterval(() => {
      if (session.socket && session.socket.readyState === WebSocket.OPEN) {
        session.socket.send("PING");
      }
    }, PLAYTAK_KEEPALIVE_MS);
  };

  const sendOngoingLogin = (session, forceRefreshGuestToken = false) => {
    if (!session.socket || session.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    session.guestToken = getPlaytakGuestToken({
      forceRefresh: forceRefreshGuestToken,
    });
    session.socket.send(`Client ${PLAYTAK_CLIENT_NAME}`);
    session.socket.send("Protocol 2");
    session.socket.send(`Login Guest ${session.guestToken}`);
    session.loginSentCount += 1;
  };

  const ensureOngoingSession = () => {
    if (!playtakOngoingSession) {
      playtakOngoingSession = createOngoingSession();
    }

    const session = playtakOngoingSession;
    const isSocketActive =
      session.socket && session.socket.readyState <= WebSocket.OPEN;
    if (isSocketActive) {
      return session;
    }

    session.isStopping = false;
    session.loginSentCount = 0;
    session.retriedGuestToken = false;

    try {
      session.socket = new WebSocket(PLAYTAK_WS_URL, PLAYTAK_WS_PROTOCOL);
    } catch (error) {
      rejectWaiters(session, error);
      throw error;
    }

    session.socket.onopen = () => {
      setPlaytakConnectionState("ongoing", true);
      sendOngoingLogin(session);
      startOngoingKeepAlive(session);
    };

    session.socket.onmessage = async ({ data }) => {
      try {
        const message = await decodePlaytakMessage(data);
        let hasChanges = false;

        message
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => {
            if (line.startsWith("Login or Register")) {
              if (!session.loginSentCount) {
                sendOngoingLogin(session);
                return;
              }

              if (!session.retriedGuestToken) {
                session.retriedGuestToken = true;
                sendOngoingLogin(session, true);
                return;
              }

              rejectWaiters(session, "Could not login to PlayTak");
              if (
                session.socket &&
                session.socket.readyState <= WebSocket.OPEN
              ) {
                session.isStopping = true;
                session.socket.close();
              }
              return;
            }

            if (line.startsWith("Error")) {
              const message = parsePlaytakErrorMessage(line);
              if (
                !session.retriedGuestToken &&
                shouldRetryPlaytakGuestToken(message)
              ) {
                session.retriedGuestToken = true;
                sendOngoingLogin(session, true);
                return;
              }
              return;
            }

            if (line.startsWith("GameList Add ")) {
              const game = parsePlaytakGameListAddLine(line);
              if (game && game.id) {
                session.games.set(game.id, game);
                session.hasReceivedGameList = true;
                hasChanges = true;
              }
              return;
            }

            if (line.startsWith("GameList Remove ")) {
              const id = parsePlaytakGameListRemoveLine(line);
              if (id) {
                session.games.delete(id);
                session.hasReceivedGameList = true;
                hasChanges = true;
              }
            }
          });

        if (hasChanges || session.hasReceivedGameList) {
          await resolveWaiters(session);
        }
      } catch (error) {
        console.error(error);
      }
    };

    session.socket.onerror = () => {
      rejectWaiters(session, "Could not connect to PlayTak");
    };

    session.socket.onclose = () => {
      if (session.keepAliveTimer) {
        clearInterval(session.keepAliveTimer);
        session.keepAliveTimer = null;
      }
      session.socket = null;
      setPlaytakConnectionState("ongoing", false);

      if (session.isStopping) {
        rejectWaiters(session, "Disconnected from PlayTak");
      }
    };

    return session;
  };

  let session;
  try {
    session = ensureOngoingSession();
  } catch (error) {
    return Promise.reject(error && error.message ? error.message : error);
  }

  if (session.hasReceivedGameList) {
    return enrichOngoingGamesWithRatings(toSortedGames(session));
  }

  return new Promise((resolve, reject) => {
    let done = false;
    const waiter = {
      resolve: (games) => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timeout);
        resolve(games);
      },
      reject: (error) => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timeout);
        reject(error && error.message ? error.message : error || "unknown");
      },
    };

    session.waiters.push(waiter);

    const timeout = setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      session.waiters = session.waiters.filter(
        (candidate) => candidate !== waiter
      );
      resolve(toSortedGames(session));
    }, timeoutMs);
  });
};

export const stopPlaytakOngoingGamesSession = () => {
  const session = playtakOngoingSession;
  if (!session) {
    setPlaytakConnectionState("ongoing", false);
    return;
  }

  playtakOngoingSession = null;
  session.isStopping = true;
  setPlaytakConnectionState("ongoing", false);

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

  session.waiters = [];
};
