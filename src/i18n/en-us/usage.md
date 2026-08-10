# This App

This is an editor and viewer for [Portable Tak Notation (PTN)](https://ustak.org/portable-tak-notation/). Originally built for transcription of live games, it has become a fully-featured analysis tool for the game [Tak](https://ustak.org/play-beautiful-game-tak/).

PTN Ninja is a [progressive web app](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/What_is_a_progressive_web_app), which means you can install it on your device as if it were a native app. This provides several benefits, including faster load times.

The app is built to work well out of the box on mobile devices and touch screens, but it also comes loaded with options and hotkeys.

:::

- Press <kbd>P</kbd> to access the **UI Preferences**.
- Press <kbd>Ctrl</kbd><kbd>/</kbd> to see a searchable list of hotkeys.
- Press <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>H</kbd> to toggle UI hints.

:::

## Games

PTN Ninja stores your games in a database on your device to allow easy switching between them using the Game Selector. Games you load will be stored until you close them using the Game Selector.

You can load games (or moves) from your clipboard, files, PTN Ninja links, or PlayTak Game IDs. To load from your clipboard, first copy one of the following:

- TPS
- PTN (full game, or partial moves)
- A PTN Ninja link
- [PlayTak game ID](https://www.playtak.com/games)
- JSON copied from [TakBot's](https://github.com/humanat/takbot) `/info` command

::: tip

Press <kbd>E</kbd> to edit the game metadata directly.

:::

:::

- To load an existing game, press <kbd>L</kbd>, or **click** the **+** button in the lower-right corner, to open the Load Game dialog.
  - To quickly load one or more games from files, press <kbd>Ctrl</kbd><kbd>O</kbd>.
  - To quickly load a game or branch from your clipboard, press <kbd>Ctrl</kbd><kbd>V</kbd> after copying TPS, full or partial PTN, a PTN Ninja link, a PlayTak game ID, or game JSON from TakBot.
- To create a new game, press <kbd>N</kbd>, or **click** the **+** button in the lower-right corner, then select the New Game tab.
  - Or, **drag** one or more **.ptn** or **.txt** files into the window.
- Use the Game Selector in the top toolbar, or hotkeys, to switch between games.
  - To quickly switch to the previous game, press <kbd>Alt</kbd><kbd>\\</kbd>, or **Right-click** the **+** button in the lower-right corner.
  - Press <kbd>/</kbd> to quickly search your games.
  - **Click** the game count to automatically close or download multiple games.

:::

::: info Note

When opening via URL a game with the same name as an already open game, the new game will replace the existing game.

If you prefer to instead open the new game under a unique name (by appending an incrementing number), select the "Replace" option found in the **UI Preferences** under "Duplicate Game Names."

**Replacing a game will preserve the undo history of the existing game, so the replacement can be undone at any time.**

:::

## PlayTak Games

Games can be loaded directly from [PlayTak](https://www.playtak.com/games), either finished or still in progress. An in-progress game is followed live; moves appear as they are played, and the clocks are recorded to PTN comments at each turn.

:::

- Open the Load Game dialog with <kbd>L</kbd>, then choose **PlayTak Game** to browse.
  - The **Ongoing** tab lists games in progress.
  - The **Recent** tab lists finished games, and can be filtered by player name and game type.
- **Click** a game to select it, then **click** OK to load it.
- If you already know the game's number, type or paste it into the Game ID field at the top of the dialog instead.
- Or skip the dialog entirely: copy a PlayTak game ID and press <kbd>Ctrl</kbd><kbd>V</kbd>.

:::

While a followed game is in progress, the Game Selector shows the PlayTak icon, highlighted while the connection is live.

:::

- While you are at the latest position, the board follows the game as moves arrive. If you scrub back to look at an earlier position, incoming moves are still appended, but your place is kept. Navigate to the end again to resume following.
- Each player's remaining time is recorded as the game goes, so scrubbing back through a game shows the clocks as they stood at that point. The live clock shows only at the latest position.
- When the game ends, the result is written into the PTN and the connection closes.
- If the connection drops, **click** the PlayTak icon in the Game Selector to reconnect.

:::

::: info Note

A followed game is an ordinary game in every other respect; you can annotate it, run engine analysis on it, and branch from it while it is still being played. The moves PlayTak has sent are protected from editing, so your branches never conflict with what arrives next.

:::

# The Board

PTN Ninja's board offers a 2D representation of the 3D game. To accommodate large stacks, any pieces beyond the carry limit are displayed in a small stack to the right of the movable stack. Only the top 10 of these pieces are displayed, should a stack grow into a tower. In 3D mode, all pieces beyond the carry limit are displayed as normal, but translucent.

## Place a Stone

PTN Ninja offers multiple modes of interaction for placing a stone. You may interact with the board directly, selecting an empty square multiple times to cycle the stone type, or you may select an un-played stone to determine its type before placing it.

::: tip

To **right-click** on a touchscreen device, try **long-pressing**.

:::

:::

- **Click** on a square to place a flat stone.
  - **Click** the square again to cycle the stone type.
  - Or, **right-click** the square to cycle in the reverse order.
- Alternatively, **click** an un-played stone to select it.
  - **Click** the selected stone to make it standing or flat again.
  - Or, **right-click** any un-played flat stone to select a standing stone or make it flat again.
  - **Click** another un-played stone to drop the selected stone.

:::

## Move Stones

Moving a stone or stack of stones is fairly straightforward:

:::

- **Click** a square to select the whole stack.
  - Or, **right-click** a square to select pieces from the **top** of the stack.
- Then, **click** further squares to drop pieces.
  - Or, **right-click** a square to pick up dropped pieces, or drop the remaining stack if there are none.
- To cancel the move, **click** the initial square or press <kbd>Esc</kbd>.

:::

If you're using a keyboard and mouse, you can move stacks more efficiently:

:::

- You can press <kbd>Enter</kbd> while hovering a square to pick up or drop as many stones as possible.
- You can also use <kbd>1-8</kbd> to pick up or drop specific numbers of pieces.
- To dynamically select or drop pieces such that your piece remains on top, press <kbd>\`</kbd>.
- Once a direction is defined by hovering over an adjacent square and dropping one or more pieces, further hotkeys will drop pieces in neighboring squares without regard to the mouse position.

:::

## Playback

PTN Ninja enables you to navigate the timeline of a game freely.

::: tip

The Play/Pause button is hidden by default and can be shown via **UI Preferences**.

:::

:::

- Use the Play/Pause button to automatically progress through the game.
- Move backward and forward through the game history using the **Navigation Controls** or <kbd>◀/▶</kbd>.
- **Right-click** the Back or Forward button to move by a **half-step** or use <kbd>Shift</kbd><kbd>◀/▶</kbd>.

:::

To navigate through a game quickly, you can scrub using a **mouse wheel** or the **Scrub Bar**, which is located above the **Navigation Controls** but disabled by default.

:::

- To use the **Scrub Bar**, enable it with <kbd>Shift</kbd><kbd>S</kbd> or via **UI Preferences**, then **drag** or **click** it to quickly jump to a different point in the game.
- Or, use the **scroll wheel** to scrub. You may need to enable it via **UI Preferences**.
  - Hold <kbd>Shift</kbd> while scrolling to scrub slowly.
  - Scrolling can be calibrated in the **UI Preferences**.

:::

## Flip and Rotate

PTN Ninja allows you to rotate and flip the orientation of the board, which may help reduce visual bias during analysis, or in getting a better view around tall stacks. This does not affect the notation, so the axis labels change accordingly.

If you want to preserve a transformation, you can apply it to the game notation.

:::

- Use the Rotate and Flip button found next to the board (or hotkeys), to change the board orientation.
- **Right-click** the Rotate/Flip button to reset the board orientation.
- Rotate left, right, and 180° with <kbd>[</kbd>, <kbd>]</kbd> , and <kbd>-</kbd> respectively.
- Flip horizontally and vertically with <kbd>;</kbd> and <kbd>Shift</kbd><kbd>;</kbd> respectively.
- Reset or apply the transformation with <kbd>=</kbd> or <kbd>Shift</kbd><kbd>+</kbd> respectively.

:::

## 3D Mode

While 2D mode gives a more analytical view of the board, 3D mode offers some semblance of how the game might look on a physical board.

:::

- Toggle 3D/2D mode using the **Board Preferences** button in the corner of the board area, or using the hotkey <kbd>D</kbd>.
- Rotate the board by dragging in the space around it.
- Reset the board rotation by **right-clicking** in the space around the board.

:::

# PTN

[PTN](https://ustak.org/portable-tak-notation/) is the notation that describes the moves of the game. PTN Ninja reads and writes information using this notation.

::: tip

You can insert moves with <kbd>Ctrl</kbd><kbd>V</kbd> after copying partial PTN.

:::

:::

- To toggle display of the full PTN, use the leftmost button in the header toolbar, or press <kbd>Q</kbd>.
- **Click** an unselected ply to navigate to it.
- **Click** a selected ply to do or undo it.

:::

Though the UI should provide for most of your PTN editing needs, PTN Ninja also offers an interactive PTN notation editor.

:::

- To edit the game's notation, **click** the 'edit' button in the PTN panel's header toolbar, or press <kbd>Shift</kbd><kbd>E</kbd>.
  - To edit header tags, **click** the menu button in the lower-left corner and select "Show Header Tags."

:::

## Branches

PTN Ninja records multiple lines of play, called "branches." The PTN panel offers three display modes:

- **Current Branch** — Shows only the current line of play (default).
- **Inline Branches** — Shows all branches inline, with collapsible branch points.
- **All Branches** — Shows all branches in a tree structure with indentation.

::: tip

You can perform several actions on branches by **right-clicking** the branch name wherever it appears.

:::

:::

- To change the branch display mode, **click** the leftmost button in the PTN panel's header toolbar.
  - To toggle quickly between showing and hiding branches, **right-click** this button.
- **Click** the 'branch' menu in the bottom toolbar, or press <kbd>B</kbd>, to see the list of all branches.
  - This button is highlighted when not on the main branch.
- Use <kbd>▲/▼</kbd> to navigate between branches.
  - When the branch menu (<kbd>B</kbd>) is open, <kbd>▲/▼</kbd> navigates between all branches.
  - When the branch menu is closed, <kbd>▲/▼</kbd> will not allow jumps between unrelated branches.
  - <kbd>Shift</kbd><kbd>▲/▼</kbd> jumps to the first or last branch within related branches.
  - <kbd>Ctrl</kbd><kbd>▲</kbd> jumps to the main branch.
  - In "Inline Branches" mode, <kbd>▲</kbd> can also be used to collapse the current branch at its parent ply.
- **Right-click** a branch or use the menu button to **promote**, **rename**, or **delete** it.

:::

## Trimming

PTN Ninja provides a few automated tools for removing irrelevant information:

:::

- **Trim Branches** deletes all plies outside the currently selected line of play.
- **Trim to Current Ply** deletes all plies leading to the current board state.
- **Trim to Current Board** deletes all plies, preserving the board state.

:::

## TPS Mode

[Tak Positional System (TPS)](https://ustak.org/tak-positional-system-tps/) is a notation used to describe Tak board states.

TPS Mode enables you to create any board state directly. To enter TPS Mode, **click** the 'edit' icon in the TPS field of the New Game or Edit Game dialogs.

::: info Note

TPS edit mode is available only for games with no plies.

:::

:::

- Select a piece type and color from the piece selector or unplayed pieces, then **click** a square to place a piece.
- **Right-click** a square to remove a piece. The color and type of that piece will be selected.
- Remember to select the next player's color before committing your changes.

:::

## Notes

One feature of PTN is support for comments. PTN Ninja provides a chat-like interface for creating, editing, and viewing these comments or notes.

::: tip

**Right-click** the right-most button in the header toolbar to toggle note notifications.

:::

:::

- To toggle display of Notes, use the rightmost button in the header toolbar, or press <kbd>W</kbd> and select the "Saved" tab.
- Focus the text input, enter your comments, then press <kbd>Shift</kbd><kbd>Enter</kbd> to save the text.
- Press <kbd>Esc</kbd> to defocus the text input.
- In the Saved Results section, **click** the delete icon in the Notes section header to remove only user notes for the current position. Analysis notes are preserved.

:::

Notes support Markdown formatting. While typing in the note input, the following shortcuts wrap your selection (or insert empty markers at the cursor):

:::

- <kbd>Ctrl</kbd><kbd>B</kbd> — **bold**
- <kbd>Ctrl</kbd><kbd>I</kbd> — _italic_
- <kbd>Ctrl</kbd><kbd>U</kbd> — underline
- <kbd>Ctrl</kbd><kbd>E</kbd> — `code`
- <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>X</kbd> — ~~strikethrough~~
- Pasting a URL while text is selected wraps the selection as a link.

:::

# Analysis

Thanks to the [Tak Community](https://discord.gg/2xEt42X), PTN Ninja now offers several analysis features, including **engine analysis** and an **opening explorer**.

:::

To quickly switch between Notes and Analysis, press <kbd>Shift</kbd><kbd>W</kbd>.

:::

## Engine Analysis

PTN Ninja offers two built-in engines: **Tiltak (wasm)** for general positional evaluation, and the **Tinuë Solver (wasm)** for forced-road (Tinuë) search. It also supports connecting to any engine that uses **TEI** via websockets, using a bridge like [websocketd](http://websocketd.com/). Due to the inherent differences in these engines and how they interact with PTN Ninja, they offer different advantages:

- [Tiltak (wasm)](https://github.com/MortenLohne/tiltak-wasm)
  - runs on this device
  - built into PTN Ninja
  - used to check positions for road threats
- [Tinuë Solver (wasm)](https://github.com/gruppler/syntaks/tree/tinue-solver)
  - runs on this device
  - built into PTN Ninja
  - dedicated Tinuë solver
  - built on [syntaks](https://github.com/Ciekce/syntaks) by [Ciekce](https://github.com/Ciekce)
- [TEI](https://github.com/MortenLohne/racetrack?tab=readme-ov-file#tei)
  - can run on any network-accessible device
  - can take full advantage of hardware
  - facilitates engine development

::: info Note

Both built-in wasm engines are activated by default. They can be removed from the active engines list at any time (like any other engine) and re-added via "Add Engine" — your choice is remembered across reloads.

:::

### Connecting a TEI Engine

To use a TEI engine with PTN Ninja, you'll need [websocketd](http://websocketd.com/) to bridge the engine's standard I/O to WebSocket.

:::

1. Install [websocketd](http://websocketd.com/).
2. Run your engine via websocketd:
   `websocketd --port=7731 ./path/to/your/engine`

   To allow connections from other devices, add `--address=0.0.0.0`.

3. In PTN Ninja, select the TEI engine and click the cog icon to show its settings.
4. Under address, enter `127.0.0.1` if connecting from the same device, or the IP address of the device running the engine if connecting from another device on the same network.
5. Set the port to match the port used in step 2.
6. Make sure SSL is disabled.
7. Click Connect.

:::

::: info Note

You can run multiple engines on the same device by giving each engine a different port.

If you want to access your engine(s) from outside your network, consider setting up a reverse proxy like [Nginx Proxy Manager](https://nginxproxymanager.com/), running your engines as services, and configuring SSL for a personal domain. You can then assign a different subdomain to each engine.

A TEI connection can be saved as a custom engine. This enables quick switching between different connection settings and allows you to specify supported size/komi, search limit types and ranges, and preset engine-specific options.

:::

::: warning Troubleshooting

If the connection fails, check the browser console for error messages. Chrome may have stricter security requirements than Firefox for WebSocket connections.

:::

### Using Engine Analysis

You can add multiple engines to analyze positions in parallel. Each engine runs independently, allowing you to compare suggestions from different engines simultaneously.

:::

- **Click** the "Add Engine" button in the Analysis panel to add another engine.
- Use the engine selector dropdown to choose which engine to add.
- Engines can be reordered from each engine's menu, either one step at a time with "Move Up"/"Move Down" or straight to either end with "Move to Top"/"Move to Bottom."
- To remove an engine, **click** the menu icon and select "Remove."
- Press <kbd>V</kbd> to toggle analysis visualizations.
- Press <kbd>Shift</kbd><kbd>V</kbd> to toggle all analysis visuals together — the board visualizations, evaluation bars, and evaluation marks.
- **Hover** over a ply within a PV to preview the resulting board position as a thumbnail. If the ply has a continuation, a navigation control appears beneath the thumbnail showing the current move.
- While previewing, step the thumbnail through the continuation one ply at a time using the **back/forward buttons** in the preview, or the **scroll wheel** over the ply (when scroll navigation is enabled). The preview is cumulative, showing the position after each successive ply of the PV.
- On a touchscreen, **long-press** a ply to show the preview, and **drag horizontally** across a ply within a PV to step through its continuation.
- **Click** a ply within a PV to insert and navigate to that ply.
- **Click** the row containing the PV to insert the entire PV and navigate to the first ply of the PV.

:::

::: info Note

PV plies that are displayed with an outline match the previous position's PV.

PV plies that are displayed as solid match what was actually played in the current branch.

:::

The **Toolbar Analysis** (below the board) displays suggestions from one source at a time. When multiple engines or saved results are available, a source selector appears.

:::

- To show or hide the Toolbar Analysis, **click** the expand/collapse button in the bottom-right, or press <kbd>A</kbd>.
- **Click** the source selector icon to choose which suggestions to display.
- Use the **scroll wheel** over the source selector to quickly cycle through sources.
- **Click** the up/down arrows or **scroll wheel** over the suggestion list to navigate between multiple suggestions from the same engine.
- **Right-click** the source selector icon to toggle all analysis visuals together (board visualizations, evaluation bars, and evaluation marks).
- When the board is wide enough, inline analysis buttons (Analyze Position, Analyze Branch, Analyze Game, Save, Delete) appear above the toolbar.

:::

### Managing Results

Engine analysis results can be saved to the game's PTN as notes, or cleared when no longer needed.

:::

- To save results to notes, use the menu in each engine's section.
  - "Save Current Position" saves only the current position's results generated by the engine.
  - "Save All" saves all analyzed positions generated by the engine.
- To clear an engine's unsaved results, use the menu to select "Clear Results" or "Clear Current Position."
- Saved results appear in the "Saved" panel and can be deleted individually or in bulk.
  - **Click** the delete icon in the Saved Results header to delete all saved results or just the current position's results.
  - **Click** the menu icon on an individual saved result to delete it.

The Saved Results settings include options for managing results:

- "Suggestions to Save per Engine" limits how many suggestions are saved per position for each engine.
- "Auto-save after each Position" automatically saves results for each position as it is analyzed.
- "Auto-save on Search Completion" automatically saves results after any finite search completes.

The Engine Analysis settings include:

- "Engine Evaluation Marks" toggles the display of dynamic evaluation marks on moves.
- "Evaluation Mark Thresholds" configures the centipiece score-loss thresholds for Brilliant (`!!`), Good (`!`), Bad (`?`), and Blunder (`??`).

:::

Analyzing a whole game or branch interacts with saving in a few specific ways:

:::

- Positions the engine has already analyzed are skipped.
- Results are written to the PTN automatically when "Auto-save on Search Completion" is enabled. When it is disabled, save them yourself from the engine menu.
- What gets written is the evaluation score and the PV ("principal variation"), plus evaluation marks if those are enabled.
- How much gets written is capped in two ways in the Saved Results settings section: by the number of suggestions, and the number of plies per suggestion.
- Search info (engine name, depth, nodes, search time) is saved by default, but this can be disabled to reduce PTN file size if necessary.

:::

### Evaluation Scores and Marks

The evaluation score is displayed as a colored bar denoting which player is evaluated to have the better position. It appears in the PTN panel and on the board behind the unplayed pieces.

Evaluation marks summarize how good a move was, judged by how far the evaluation moved between the ply and its previous position.

:::

- `!!` Brilliant and `!` Good denote exceptional moves.
- `?` Bad and `??` Blunder denote mistakes.
- The score-loss thresholds for each are set under "Evaluation Mark Thresholds" in each engine's settings, via the "Edit" menu option.

:::

### Marking Plies by Hand

The PTN panel's toolbar writes marks directly onto the current ply in the PTN. These buttons need no engine and work regardless of which analysis tab is selected.

:::

- The `?` and `!` buttons toggle evaluation marks. **Left-click** for the single mark, **right-click** for the double.
- The Tak/Tinuë button toggles `'` (Tak) with **left-click** or <kbd>'</kbd>, and `"` (Tinuë) with **right-click** or <kbd>Shift</kbd><kbd>"</kbd>.
- **Auto-Mark Tak**, at the left of the group, marks all existing tak threats and keeps marking new ones as moves are played.

:::

### Marks from Engine Analysis

Engines produce evaluation marks of their own, which are kept separately from the ones you place by hand.

:::

- On the Engines tab, the mark is computed on-the-fly from unsaved results, so it moves when you change the thresholds.
- On the Saved tab, the mark is read from the saved analysis note, appearing as it was when the results were saved.
- Saving results does **not** write a mark onto the ply. The mark is stored inside the analysis note along with the score and PV and travels with that note.

:::

::: info Note

While "Engine Evaluation Marks" is enabled, an available analysis mark is displayed **in place of** the ply's own `?` or `!`. Your manual mark is not overwritten; turn the setting off to see it again. Tak and Tinuë marks always show either way.

:::

### Evaluation Graph

The **Evaluation Graph** plots the evaluations along the current branch as a single image, giving you the shape of the whole game at a glance.

:::

- Find it in the **Share** menu, under "Generate" > "Evaluation Graph."
- The graph covers the branch you are currently on, one slot per ply, and grows wider with longer games.
- Save or share the image the way you would any other: **right-click** it, or **long-press** on a touchscreen.
- **Click** anywhere outside the image to dismiss it.

:::

::: info Note

The graph is drawn from whatever evaluations the game already has (saved analysis notes and results from the active engine) so analyze the game or load a game with saved analysis before expecting a full curve. Plies with no evaluation leave a gap.

Where an engine reported win/draw/loss probabilities, the graph uses those in preference to the raw score, matching the evaluation bars in the PTN panel.

:::

### Tinuë Search

The **Tinuë Solver (wasm)** is dedicated to finding Tinuë. It runs alongside other engines and uses the same Analyze Position/Branch/Game controls.

:::

- Set "Depth" in the engine settings to cap per-position search depth (odd values ≥ 3). The default finds most Tinuës; lowering it trades finding the longer ones for speed.
- Set "Nodes" to cap the search per position. When a position exceeds the cap, the search is abandoned and the sweep moves on. Raising it resolves more positions, with diminishing returns.
- "Analyze Game" and "Analyze Branch" iterate **backwards** from the end of the game, auto-following the board to each position. Full-game analysis covers the main branch first, then sub-branches.
- Enable **Auto-Mark Tinuë** in the engine settings (cog icon) to have the engine write `"` marks into the PTN as it proves Tinuës.

:::

::: info Search scope

Full-game/branch sweeps and one-shot position analysis search only moves that make a road threat. This "**strict**" search makes the search fast enough to be useful, and most Tinuës fit this profile (unbroken chains of road threats).

**Interactive mode** runs the strict search first and then, if it completed without finding anything, continues into an unbounded search of every legal move for as long as you stay on the position.

:::

When a search proves no Tinuë, it produces no suggestions, so the verdict is shown in place of the results:

:::

- **"No strict tinuë"**: nothing found among road threats. A quiet Tinuë may still exist; interactive mode will keep looking.
- **"No tinuë"**: the interactive extension searched every move and found nothing.
- **"Search incomplete"**: the node limit was reached before the position could be resolved. Raise the limit to search further.
- **"Lost position"**: the side to move has no forced win because the _opponent_ does. Rather than report "no Tinuë", the engine searches every reply and lists the defenses that hold out longest, along with how each one eventually loses.

:::

### Finding the Tinuë Origin

Once a Tinuë is proven, the engine can trace it back to the point where the win first became forced.

:::

- **Click** "Find origin" beneath the engine's results. The search runs without moving the board from the current position.
- The origin appears as a move chip in its place; **click** it to navigate there.
- The origin is named by the move that means something: the attacker's move when they took the win, or the defender's blunder that handed it over.
- **"Origin (at least)"** means a position along the way exceeded the node limit, so the true origin may be earlier than the one shown.

:::

### Interactive Analysis Lock

When using engine analysis in interactive mode, you can "lock" the analysis engine to a specific board position, or to the latest position of an ongoing game. This prevents the engine from following your navigation through the game, allowing you to analyze a particular position in depth while exploring other parts of the game.

:::

- To lock the analysis to the current position, **click** the lock icon that appears in the Bot Suggestions panel when interactive mode is active.
- To unlock and return to following your navigation, **click** the lock icon again.
- When locked, the engine displays the locked ply information instead of the next played ply, but the displayed results continue to follow your navigation.
- If the locked position is the last played position, and a new move is played, analysis will move to the new position.

:::

::: info Note

The lock is automatically cleared when you switch to a different game to prevent analyzing a position from the wrong game. Interactive analysis is also stopped before switching games.

:::

## Opening Explorer

The **opening explorer** enables you to see the outcomes of [PlayTak games](https://www.playtak.com/games) according to their opening moves. The database is updated daily and accommodates all transpositions of the position. The Top Games from Position section lists the games with highest-rated players that included the current position.

:::

- To change the **opening explorer**'s database preferences, **click** the 'cog' icon in the PlayTak Openings section.
- **Click** a game in the "Top Games from Position" section to open that game and navigate to the current position.
- To disable querying the opening database, hide the Analysis panel, or collapse both "PlayTak Openings" and "Top Games from Position" sections.

:::

# Themes

PTN Ninja offers a variety of built-in themes, but you can also create your own. You can select and edit themes using the Theme Selector found in both the **Board Preferences** and **UI Preferences**, or directly from the theme editor.

:::

- Access the theme editor directly using <kbd>Shift</kbd><kbd>T</kbd>.
- Themes can be exported as JSON text, enabling you to share your theme with others.

:::
