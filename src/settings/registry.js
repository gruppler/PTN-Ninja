/**
 * The settings registry: one entry per setting that the Settings UI shows.
 *
 * Entries are plain data. The registry never imports Vue or the store; the UI
 * reads values with `getValue` and writes them with `setValue`, which goes
 * through the same Vuex actions every other writer uses.
 *
 * Entry = {
 *   id            "<store>:<key>", the same IDs the settings sync uses
 *   store, key    where the value lives: state[store][key]
 *   label         i18n key
 *   hint?         i18n key
 *   keywords?     extra search terms
 *   category, section
 *   control       "toggle" | "select" | "slider" | "number" | "theme" | "component"
 *   options?      [{ label (i18n key), value }] for "select"
 *   min?, max?, step?
 *   unit?         i18n key shown after a slider's value
 *   component?    name of the component rendered for "component"
 *   dependsOn?    id of the parent, which must come before it in SETTINGS
 *   disabledWhen? (rootState) => boolean, disabled while true
 *   forcedValue?  the value shown while disabledWhen is true
 *   disabledHint? i18n key explaining why it is disabled
 *   hotkey?       key of HOTKEYS.UI
 *   get?, set?    (rootState) => value and (dispatch, value), for a row
 *                 that stands for several settings rather than one key
 *   sync          "always" | "layout" | "board3D" | "input" | "engines" | "never"
 * }
 *
 * A child follows its parent in SETTINGS, with only the parent's other
 * children (and their children) between them.
 */

import { HOTKEYS } from "../keymap";
import {
  MOVE_HIGHLIGHT_OPTIONS,
  getMoveHighlight,
  moveHighlightFlags,
} from "../utils/moveHighlight";

export { HOTKEYS };

// Off until there are accounts to sign in to and settings sync to go with
// them: hides the Account and Sync category.
const ACCOUNTS = false;

export const CATEGORIES = [
  {
    id: "board",
    label: "settings.categories.board",
    icon: "board",
    sections: [
      { id: "theme", label: "settings.sections.board.theme" },
      { id: "onBoard", label: "settings.sections.board.onBoard" },
      { id: "aroundBoard", label: "settings.sections.board.aroundBoard" },
      { id: "view", label: "settings.sections.board.view" },
      { id: "sound", label: "settings.sections.board.sound" },
    ],
  },
  {
    id: "analysis",
    label: "settings.categories.analysis",
    icon: "analysis",
    sections: [
      { id: "onBoard", label: "settings.sections.analysis.onBoard" },
      { id: "suggestions", label: "settings.sections.analysis.suggestions" },
      { id: "annotations", label: "settings.sections.analysis.annotations" },
      { id: "saving", label: "settings.sections.analysis.saving" },
      {
        id: "openingDatabase",
        label: "settings.sections.analysis.openingDatabase",
      },
      { id: "engines", label: "settings.sections.analysis.engines" },
    ],
  },
  {
    id: "navigation",
    label: "settings.categories.navigation",
    icon: "navigation",
    sections: [
      { id: "controls", label: "settings.sections.navigation.controls" },
      { id: "scrolling", label: "settings.sections.navigation.scrolling" },
      { id: "loading", label: "settings.sections.navigation.loading" },
    ],
  },
  {
    id: "notifications",
    label: "settings.categories.notifications",
    icon: "notifications",
    sections: [
      {
        id: "notifications",
        label: "settings.sections.notifications.notifications",
      },
    ],
  },
  {
    id: "general",
    label: "settings.categories.general",
    icon: "ui_preferences",
    sections: [{ id: "general", label: "settings.sections.general.general" }],
  },
  ...(ACCOUNTS
    ? [
        {
          id: "account",
          label: "settings.categories.account",
          icon: "account",
          sections: [
            { id: "account", label: "settings.sections.account.account" },
          ],
        },
      ]
    : []),
];

// Entry builders. `id` is "<store>:<key>"; the rest is the entry's own fields.
const entry = (id, fields) => {
  const [store, key] = id.split(":");
  return { id, store, key, ...fields };
};
const ui = (key, fields) =>
  entry("ui:" + key, { control: "toggle", ...fields });
const analysis = (key, fields) =>
  entry("analysis:" + key, { control: "toggle", ...fields });

const EVAL_TYPES = ["advantage", "cp", "wdl"].map((value) => ({
  label: "analysis.evalTypes." + value,
  value,
}));

export const SETTINGS = [
  // Board / Theme
  ui("themeID", {
    label: "Theme",
    control: "theme",
    category: "board",
    section: "theme",
    sync: "always",
  }),

  // Board / On the board
  // One choice for two stored flags: highlightPieces, listed with the unlisted
  // keys below, takes the place of highlightSquares
  ui("highlightSquares", {
    label: "Highlight Last Move",
    keywords: ["squares", "pieces", "outline"],
    control: "select",
    options: MOVE_HIGHLIGHT_OPTIONS,
    category: "board",
    section: "onBoard",
    get: (rootState) => getMoveHighlight(rootState.ui),
    set: (dispatch, value) =>
      Object.entries(moveHighlightFlags(value)).forEach((flag) =>
        dispatch("ui/SET_UI", flag)
      ),
    sync: "always",
  }),
  ui("flatWinHighlights", {
    label: "Flat Win Highlights",
    category: "board",
    section: "onBoard",
    sync: "always",
  }),
  ui("showRoads", {
    label: "Road Connections",
    category: "board",
    section: "onBoard",
    hotkey: "showRoads",
    sync: "always",
  }),
  ui("stackCounts", {
    label: "Stack Counts",
    category: "board",
    section: "onBoard",
    hotkey: "stackCounts",
    sync: "always",
  }),
  ui("centerStackCounts", {
    label: "Center Stack Counts",
    category: "board",
    section: "onBoard",
    disabledWhen: (rootState) =>
      Boolean(rootState.ui.axisLabels && rootState.ui.axisLabelsSmall),
    forcedValue: true,
    disabledHint: "settings.lockedBySmallAxisLabels",
    sync: "always",
  }),

  // Board / Around the board
  ui("turnIndicator", {
    label: "Turn Indicator",
    category: "board",
    section: "aroundBoard",
    sync: "always",
  }),
  ui("flatCounts", {
    label: "Flat Counts",
    category: "board",
    section: "aroundBoard",
    dependsOn: "ui:turnIndicator",
    sync: "always",
  }),
  ui("moveNumber", {
    label: "Move Number",
    category: "board",
    section: "aroundBoard",
    sync: "always",
  }),
  ui("evalText", {
    label: "Evaluation Text",
    keywords: ["evaluation", "analysis"],
    category: "board",
    section: "aroundBoard",
    dependsOn: "ui:moveNumber",
    sync: "always",
  }),
  ui("unplayedPieces", {
    label: "Unplayed Pieces",
    category: "board",
    section: "aroundBoard",
    sync: "always",
  }),
  ui("axisLabels", {
    label: "Axis Labels",
    keywords: ["coordinates"],
    category: "board",
    section: "aroundBoard",
    hotkey: "axisLabels",
    sync: "always",
  }),
  ui("axisLabelsSmall", {
    label: "Axis Labels Small",
    category: "board",
    section: "aroundBoard",
    dependsOn: "ui:axisLabels",
    sync: "always",
  }),

  // Board / View
  ui("animateBoard", {
    label: "Animate Board",
    category: "board",
    section: "view",
    sync: "always",
  }),
  ui("animateScrub", {
    label: "Animate While Scrubbing",
    category: "board",
    section: "view",
    dependsOn: "ui:animateBoard",
    sync: "always",
  }),
  ui("verticalLayout", {
    label: "Vertical Layout",
    category: "board",
    section: "view",
    disabledWhen: (rootState) => !rootState.ui.unplayedPieces,
    disabledHint: "settings.requiresUnplayedPieces",
    sync: "layout",
  }),
  ui("verticalLayoutAuto", {
    label: "Vertical Layout Auto",
    category: "board",
    section: "view",
    dependsOn: "ui:verticalLayout",
    sync: "layout",
  }),
  ui("board3D", {
    label: "3D Board",
    category: "board",
    section: "view",
    hotkey: "board3D",
    sync: "board3D",
  }),
  ui("orthographic", {
    label: "Orthographic",
    category: "board",
    section: "view",
    dependsOn: "ui:board3D",
    sync: "board3D",
  }),
  ui("perspective", {
    label: "Perspective",
    control: "slider",
    min: 1,
    max: 10,
    step: 1,
    category: "board",
    section: "view",
    dependsOn: "ui:board3D",
    disabledWhen: (rootState) => Boolean(rootState.ui.orthographic),
    sync: "board3D",
  }),

  // Board / Sound
  ui("sound", {
    label: "Piece Sounds",
    keywords: ["clack", "audio", "mute"],
    control: "select",
    options: [
      { label: "Every Move", value: "moves" },
      { label: "Live Games", value: "live" },
      { label: "Off", value: "off" },
    ],
    category: "board",
    section: "sound",
    sync: "always",
  }),
  ui("soundVolume", {
    label: "Volume",
    control: "slider",
    min: 0,
    max: 100,
    step: 5,
    category: "board",
    section: "sound",
    dependsOn: "ui:sound",
    disabledWhen: (rootState) => rootState.ui.sound === "off",
    sync: "always",
  }),

  // Analysis / On the board
  // The suggestions from one source, under the board
  ui("showToolbarAnalysis", {
    label: "Suggestion Bar",
    keywords: ["toolbar", "analysis", "suggestions"],
    category: "analysis",
    section: "onBoard",
    hotkey: "showToolbarAnalysis",
    sync: "layout",
  }),
  // All of the analysis overlays at once, as Shift+V toggles them
  entry("action:analysisVisuals", {
    label: "Analysis Visuals",
    keywords: ["overlays", "suggestions", "evaluation"],
    control: "toggle",
    category: "analysis",
    section: "onBoard",
    hotkey: "toggleAnalysisVisuals",
    get: (rootState) =>
      Boolean(
        rootState.ui.showAnalysisBoard ||
          rootState.ui.showEval ||
          rootState.analysis.showEvalMarks
      ),
    set: (dispatch, value) => dispatch("ui/SET_ANALYSIS_VISUALIZATIONS", value),
    sync: "never",
  }),
  ui("showAnalysisBoard", {
    label: "Visualize Suggestions",
    category: "analysis",
    section: "onBoard",
    hotkey: "showAnalysisBoard",
    sync: "always",
  }),
  ui("showEval", {
    label: "Evaluation Bars",
    category: "analysis",
    section: "onBoard",
    sync: "always",
  }),
  ui("boardEvalBar", {
    label: "Board Evaluation Bar",
    category: "analysis",
    section: "onBoard",
    dependsOn: "ui:showEval",
    sync: "always",
  }),
  analysis("showEvalMarks", {
    label: "analysis.engineEvalMarks",
    category: "analysis",
    section: "onBoard",
    sync: "always",
  }),

  // Analysis / Suggestions
  analysis("showContinuation", {
    label: "analysis.showContinuation",
    category: "analysis",
    section: "suggestions",
    sync: "always",
  }),
  analysis("showFullPVs", {
    label: "analysis.showFullSuggestion",
    category: "analysis",
    section: "suggestions",
    dependsOn: "analysis:showContinuation",
    sync: "always",
  }),
  analysis("evalType", {
    label: "analysis.evalType",
    control: "select",
    options: EVAL_TYPES,
    category: "analysis",
    section: "suggestions",
    sync: "always",
  }),
  analysis("analyzeBackward", {
    label: "analysis.analyzeBackward",
    category: "analysis",
    section: "suggestions",
    sync: "always",
  }),

  // Analysis / Annotations
  ui("autoAnnotateTak", {
    label: "Auto-Annotate Tak",
    keywords: ["tinue", "marks"],
    category: "analysis",
    section: "annotations",
    sync: "always",
  }),

  // Analysis / Saving
  analysis("pvsToSave", {
    label: "analysis.pvsToSave",
    control: "number",
    min: 1,
    max: 20,
    category: "analysis",
    section: "saving",
    sync: "always",
  }),
  analysis("pvLimit", {
    label: "analysis.pliesToSave",
    control: "number",
    min: 0,
    max: 100,
    category: "analysis",
    section: "saving",
    sync: "always",
  }),
  analysis("saveSearchStats", {
    label: "analysis.saveSearchStats",
    category: "analysis",
    section: "saving",
    sync: "always",
  }),
  analysis("autoSaveEachPosition", {
    label: "analysis.autoSaveEachPosition",
    category: "analysis",
    section: "saving",
    sync: "always",
  }),
  analysis("autoSaveOnSearchComplete", {
    label: "analysis.autoSaveOnSearchComplete",
    category: "analysis",
    section: "saving",
    sync: "always",
  }),

  // Analysis / Opening database
  analysis("dbSettings", {
    label: "settings.sections.analysis.openingDatabase",
    control: "component",
    component: "OpeningsSettings",
    keywords: [
      "players",
      "rating",
      "komi",
      "tournament",
      "dates",
      "bot games",
      "top games",
    ],
    category: "analysis",
    section: "openingDatabase",
    sync: "always",
  }),

  // Analysis / Engines
  analysis("activeBots", {
    label: "Engines",
    control: "component",
    component: "SettingsEngines",
    category: "analysis",
    section: "engines",
    sync: "engines",
  }),

  // Navigation / Controls
  ui("showControls", {
    label: "Nav Controls",
    category: "navigation",
    section: "controls",
    sync: "layout",
  }),
  ui("hapticNavControls", {
    label: "Haptic Nav Controls",
    category: "navigation",
    section: "controls",
    dependsOn: "ui:showControls",
    sync: "input",
  }),
  ui("showPlayButton", {
    label: "Play Button",
    category: "navigation",
    section: "controls",
    dependsOn: "ui:showControls",
    sync: "layout",
  }),
  ui("playSpeed", {
    label: "Play Speed",
    control: "slider",
    min: 30,
    max: 160,
    step: 10,
    unit: "FPM",
    category: "navigation",
    section: "controls",
    dependsOn: "ui:showPlayButton",
    sync: "always",
  }),
  ui("showScrubber", {
    label: "Scrub Bar",
    category: "navigation",
    section: "controls",
    sync: "layout",
  }),

  // Navigation / Scrolling
  ui("scrollNavigation", {
    label: "Scroll wheel navigation",
    category: "navigation",
    section: "scrolling",
    sync: "input",
  }),
  ui("scrollThreshold", {
    label: "Scroll threshold",
    control: "component",
    component: "SettingScrollThreshold",
    category: "navigation",
    section: "scrolling",
    dependsOn: "ui:scrollNavigation",
    sync: "input",
  }),

  // Navigation / Loading
  ui("skipToEndOnLoad", {
    label: "Skip to End on Load",
    category: "navigation",
    section: "loading",
    sync: "always",
  }),

  // Notifications
  ui("notifyGame", {
    label: "Game Notifications",
    category: "notifications",
    section: "notifications",
    sync: "always",
  }),
  ui("notifyNotes", {
    label: "Note Notifications",
    category: "notifications",
    section: "notifications",
    sync: "always",
  }),
  ui("notifyAnalysisNotes", {
    label: "Analysis Note Notifications",
    category: "notifications",
    section: "notifications",
    dependsOn: "ui:notifyNotes",
    sync: "always",
  }),

  // General
  ui("showHints", {
    label: "UI Hints",
    category: "general",
    section: "general",
    sync: "always",
  }),
  ui("nativeSharing", {
    label: "Native Sharing",
    category: "general",
    section: "general",
    sync: "never",
  }),
  ui("openDuplicate", {
    label: "Duplicate Game Names",
    control: "select",
    options: [
      { label: "Rename", value: "rename" },
      { label: "Replace", value: "replace" },
    ],
    category: "general",
    section: "general",
    sync: "always",
  }),
  ui("showChangelogAfterUpdate", {
    label: "Show Changelog After Update",
    category: "general",
    section: "general",
    sync: "always",
  }),

  // Account
  ...(ACCOUNTS
    ? [
        entry("account:status", {
          label: "settings.categories.account",
          control: "component",
          component: "SettingsAccount",
          category: "account",
          section: "account",
          sync: "never",
        }),
      ]
    : []),
];

/**
 * Every other key of the ui and analysis defaults, which no Settings control
 * shows, with its sync class.
 */
export const UNLISTED = {
  "ui:analysisSections": "layout",
  "ui:boardMenuSections": "never",
  "ui:boardRotation": "board3D",
  "ui:boardSize": "never",
  "ui:boardSpace": "never",
  "ui:boardTransform": "never",
  "ui:disableBoard": "never",
  "ui:disableNavigation": "never",
  "ui:disablePTN": "never",
  "ui:disablePTNTools": "never",
  "ui:disableStoneCycling": "never",
  "ui:disableText": "never",
  "ui:disableUndo": "never",
  "ui:editHeader": "never",
  "ui:editingBranch": "never",
  "ui:embedConfig": "always",
  "ui:firstMoveNumber": "never",
  "ui:gameTimer": "always",
  "ui:gifConfig": "always",
  "ui:highlighterColor": "always",
  "ui:highlighterCustomColor": "always",
  "ui:highlightPieces": "always",
  "ui:inlineBranches": "always",
  "ui:isPortrait": "never",
  "ui:isSmallToggles": "layout",
  "ui:isVertical": "never",
  "ui:komi": "always",
  "ui:offline": "never",
  "ui:player": "always",
  "ui:player1": "always",
  "ui:player2": "always",
  "ui:playerName": "always",
  "ui:playtakGameTypeFilter": "always",
  "ui:playtakPlayerFilter": "always",
  "ui:pngConfig": "always",
  "ui:selectedPiece": "never",
  "ui:showAllBranches": "always",
  "ui:showBoardPrefsBtn": "layout",
  "ui:showBoardTransformBtn": "layout",
  "ui:showHeader": "never",
  "ui:showMove": "always",
  "ui:showPTN": "layout",
  "ui:showText": "layout",
  "ui:size": "always",
  "ui:textTab": "never",
  "ui:theme": "never",
  "ui:themeManualMode": "always",
  "ui:themes": "always",
  "ui:toggleLayout": "layout",
  "analysis:analysisSource": "never",
  "analysis:botID": "engines",
  "analysis:botList": "never",
  "analysis:botLogs": "never",
  "analysis:botMetaOverrides": "never",
  "analysis:botMetas": "never",
  "analysis:botPositions": "never",
  "analysis:botSettings": "engines",
  "analysis:botStates": "never",
  "analysis:collapsedBots": "never",
  "analysis:currentOpeningMoves": "never",
  "analysis:customBots": "never",
  "analysis:expandSuggestionPVs": "never",
  "analysis:openingPositions": "never",
  "analysis:openingStats": "never",
  "analysis:preferSavedResults": "never",
  "analysis:savedBotName": "never",
};

export const byId = (id) => SETTINGS.find((entry) => entry.id === id);

/** The direct children of an entry, in order */
export const childrenOf = (id) =>
  SETTINGS.filter((entry) => entry.dependsOn === id);

/**
 * The top-level entries of a section, in order. With `ids`, only those.
 * Children are reached through childrenOf.
 */
export const entriesIn = (category, section, ids) =>
  SETTINGS.filter(
    (entry) =>
      entry.category === category &&
      entry.section === section &&
      !entry.dependsOn &&
      (!ids || ids.includes(entry.id))
  );

/**
 * The entries matching a query, case-insensitively, against their label,
 * hint, keywords and section label. `t` translates an i18n key. Each match
 * is preceded by its ancestors (`context: true`, unless they match too) and
 * followed by its descendants. Results are in registry order.
 */
// Lowercase, without accents, so "tinue" finds "Tinuë"
export const normalizeText = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// `extraKeywords` adds searchable text that comes from live data, by entry id
// (e.g. engine names for the Engines row).
export const search = (query, t, extraKeywords = {}) => {
  const needle = normalizeText(String(query || "").trim());
  if (!needle) {
    return [];
  }
  const sectionLabel = (entry) => {
    const category = CATEGORIES.find((c) => c.id === entry.category);
    const section =
      category && category.sections.find((s) => s.id === entry.section);
    return section ? t(section.label) : "";
  };
  const matches = (entry) =>
    [
      entry.label && t(entry.label),
      entry.hint && t(entry.hint),
      ...(entry.keywords || []),
      ...(extraKeywords[entry.id] || []),
      sectionLabel(entry),
    ].some((text) => text && normalizeText(text).includes(needle));

  const matched = new Set(SETTINGS.filter(matches).map((e) => e.id));
  // Matches and their descendants are results in their own right
  const shown = new Set();
  const include = (entry) => {
    shown.add(entry.id);
    childrenOf(entry.id).forEach(include);
  };
  SETTINGS.filter((e) => matched.has(e.id)).forEach(include);

  const results = [];
  const contextIds = new Set();
  matched.forEach((id) => {
    for (let e = byId(id); e && e.dependsOn; ) {
      e = byId(e.dependsOn);
      if (!shown.has(e.id)) {
        contextIds.add(e.id);
      }
    }
  });
  SETTINGS.forEach((entry) => {
    if (shown.has(entry.id)) {
      results.push({ entry, context: false });
    } else if (contextIds.has(entry.id)) {
      results.push({ entry, context: true });
    }
  });
  return results;
};

/** The entry's value in the Vuex root state */
export const getValue = (rootState, entry) =>
  entry.get ? entry.get(rootState) : rootState[entry.store][entry.key];

/**
 * How a row shows an entry right now:
 * - value: what the control shows. An option the game disables reads false;
 *   a row locked by disabledWhen shows its forcedValue, if it has one.
 * - locked: disabledWhen is true, so disabledHint applies.
 * - disabled: the game disables it, it's locked, or its parent is off or
 *   disabled, recursively.
 * - hidden: it's disabled by the game in an embed, or its parent is hidden.
 *   A row whose parent is off stays visible, disabled.
 *
 * `disabledOptions` is getters["game/disabledOptions"].
 */
export const entryState = (rootState, disabledOptions, entry) => {
  const parent = entry.dependsOn
    ? entryState(rootState, disabledOptions, byId(entry.dependsOn))
    : null;
  const parentOff = Boolean(parent && !parent.value);
  const gameDisabled = Boolean(
    disabledOptions && disabledOptions.includes(entry.key)
  );
  const locked = Boolean(entry.disabledWhen && entry.disabledWhen(rootState));

  let value =
    entry.get || rootState[entry.store]
      ? getValue(rootState, entry)
      : undefined;
  if (gameDisabled) {
    value = false;
  } else if (locked && "forcedValue" in entry) {
    value = entry.forcedValue;
  }

  return {
    value,
    locked,
    disabled: Boolean(
      gameDisabled || locked || (parent && (parent.disabled || parentOff))
    ),
    hidden: Boolean(
      (parent && parent.hidden) || (gameDisabled && rootState.ui.embed)
    ),
  };
};

/** Write an entry's value through the store action that owns its module */
export const setValue = (dispatch, entry, value) =>
  entry.set
    ? entry.set(dispatch, value)
    : dispatch(entry.store === "ui" ? "ui/SET_UI" : "analysis/SET", [
        entry.key,
        value,
      ]);
