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
- To cancel the move, **click** the initial square.

:::

If you're using a keyboard and mouse, you can move stacks more efficiently:

:::

- You can press <kbd>Enter</kbd> while hovering a square to pick up or drop as many stones as possible.
- To dynamically select or drop pieces such that your piece remains on top, press <kbd>\`</kbd>.
- To cancel the move, press <kbd>Esc</kbd>.

:::

## Playback

PTN Ninja enables you to navigate the timeline of a game freely.

::: tip

The Play/Pause button is hidden by default and can be shown via **UI Preferences**.

:::

:::

- Use the Play/Pause button to automatically progress through the game.
- Move backward and forward through the game history using the **Play Controls** or <kbd>◀/▶</kbd>.
- **Right-click** the Back or Forward button to move by a **half-step** or use <kbd>Shift</kbd><kbd>◀/▶</kbd>.

:::

To navigate through a game quickly, you can scrub using a **mouse wheel** or the **Scrub Bar**, which is located above the **Play Controls** but disabled by default.

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

PTN Ninja records multiple lines of play, called "branches." Branches outside the current line of play are hidden by default. You can display branches by **clicking** the 'branch' button in the PTN panel's header toolbar.

::: tip

You can perform several actions on branches by **right-clicking** the branch name wherever it appears.

:::

:::

- To show all branches (or hide other branches) in the PTN panel, **click** the "branch" icon in the header toolbar, or press <kbd>Shift</kbd><kbd>B</kbd>.
- Click the 'branch' menu in the bottom toolbar, or press <kbd>B</kbd>, to see the list of all branches.
- Use <kbd>▲/▼</kbd> to navigate between branches.
- **Right-click** a branch name to **promote**, **rename**, or **delete** it.

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

- To toggle display of Notes, use the rightmost button in the header toolbar, or press <kbd>W</kbd>.
- Focus the text input, enter your comments, then press <kbd>Shift</kbd><kbd>Enter</kbd> to save the text.
- Press <kbd>Esc</kbd> to defocus the text input.
- In the Notes panel, **right-click** a note to **edit** or **delete** it.
- To remove all notes, **click** the menu button to the right of the text input and select "Remove All."

:::

# Analysis

Thanks to the [Tak Community](https://discord.gg/2xEt42X), PTN Ninja now offers several analysis features, including **bot analysis** and an **opening explorer**.

:::

To quickly switch between Notes and Analysis, press <kbd>Shift</kbd><kbd>W</kbd>.

:::

## Bot Analysis

PTN Ninja currently offers access to three built-in bots: **Tiltak (cloud)**, **Tiltak (wasm)**, and **Topaz**. It also supports connecting to any bot that uses **TEI** via websockets, using a bridge like [websocketd](http://websocketd.com/). Due to the inherent differences in these bots and how they interact with PTN Ninja, they offer different advantages:

- [Tiltak (cloud)](https://github.com/MortenLohne/tiltak)
  - can provide quick analysis of the entire game
  - can store evaluations and PVs in PTN
  - offers several suggestions
  - runs in the cloud
- [Tiltak (wasm)](https://github.com/MortenLohne/tiltak-wasm)
  - provides continual evaluation of the current position
  - updates the evaluation and PV in real time
  - offers a single suggestion
  - runs on your device
- [Topaz (wasm)](https://github.com/Jakur/topaz-tak)
  - can provide deep analysis of the current position
  - stops early if a forced win/loss is found
  - offers a single suggestion
  - runs on your device
- [TEI](https://github.com/MortenLohne/racetrack?tab=readme-ov-file#tei)
  - can provide continual evaluation of the current position
  - can update the evaluation and PV in real time
  - offers a single suggestion
  - can take full advantage of your hardware
  - facilitates bot development

:::

- To switch between bots and change their settings, **click** the 'cog' icon in the Bot Suggestions section.
- To analyze the current branch, disable "Show All Branches," then **click** "Analyze Branch" button
- To analyze the entire game (including all branches), enable "Show All Branches," then **click** "Analyze Game" button

:::

::: info Note

When using the "Analyze Game" or "Analyze Branch" button, any positions that have already been analyzed will be skipped. If all plies have been analyzed, this button will be disabled.

After full game or branch analysis, the evaluation score and PV ("principle variation") are saved to the game's PTN as notes and annotation marks. The number of plies saved to notes can be changed in the bot's settings, accessed via the 'cog' icon in the Bot Suggestions section.

The evaluation score is displayed as a colored bar (denoting which player is evaluated to have a better position) in the PTN panel, Notes panel, and on the board behind the unplayed pieces.

The annotation marks "?" and "??" denote mistakes and blunders, while "!" and "!!" denote exceptional and brilliant moves, as determined by the magnitude of differences in Tiltak's evaluation scores between the ply and its previous position.

:::

:::

- Press <kbd>V</kbd> to toggle display of the evaluation bars.
- **Hover** over a ply within a PV to preview the board state after that ply.
- **Click** a ply within a PV to insert and navigate to that ply.
- **Click** the row containing the PV to insert the entire PV and navigate to the first ply of the PV.

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
