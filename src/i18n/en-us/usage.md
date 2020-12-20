Getting Started
===

::: tip
To **right-click** on a touchscreen device, try **long-pressing**.
:::

### Games

PTN Ninja can store multiple games to allow easy switching between them via the Game Selector. Loaded games are stored in the browser until closed from the Game Selector. You're responsible for closing games you no longer need.

::: tip
You can automatically close or download multiple games by **clicking** the game count.
:::

You can load games from **.ptn** or **.txt** files, or from URLs originating from [PlayTak](https://www.playtak.com/games) or PTN Ninja itself.

:::
- To create a new game, **click** the **+** button in the main menu to open the New Game dialog.
- To load an existing game, **click** the **+** button in the main menu, then select the Load Game tab.
- Or, **drag** one or more **.ptn** or **.txt** files into the window.
- Use the Game Selector in the top toolbar, or hotkeys, to switch between games.
- **Swipe left** or **right-click** the Floating Action Button to switch to the previous game.
:::

When opening via URL a game with the same name as an already open game, the new game will be opened under a unique name (by means of an incrementing number at the end). If you prefer to instead replace the open game, this option ("Replace") can be found in the UI section of the Preferences dialog under "Duplicate Game Names." Replacing a game will preserve the undo history of the existing game, so the replacement can be undone.

### Playback

PTN Ninja enables you to navigate the timeline of a game freely by these means:

:::
- Use the Play/Pause button to automatically progress through the game.
- Move backward and forward through the game history using the **Play Controls** or <kbd>◀/▶</kbd>.
- **Right-click** the Back or Forward button to move by a **half-step** or use <kbd>Shift</kbd><kbd>◀/▶</kbd>.
- **Drag** or **click** the scrub bar to quickly jump to a different point in the game.
:::

### Place a Stone

PTN Ninja offers multiple modes of interaction for placing a stone. You may interact with the board directly, selecting an empty square multiple times to cycle the stone type, or you may select an un-played stone to determine its type before placing it.

:::
- **Click** on a square to place a flat stone.
  - **Click** the square again to cycle the stone type.
  - Or, **right-click** the square to cycle in the reverse order.
- Alternatively, **click** an un-played stone to select it.
  - **Click** the selected stone to make it standing or flat again.
  - Or, **right-click** any un-played flat stone to select a standing stone or make it flat again.
  - **Click** another un-played stone to drop the selected stone.
:::

### Move a Stone or Stack

Moving a stone or stack of stones is fairly straightforward:

:::
- **Click** a square to select the whole stack.
  - Or, **right-click** a square to select pieces from the **top** of the stack.
- Then, **click** further squares to drop pieces.
  - Or, **right-click** a square to pick up dropped pieces, or drop the remaining stack if there are none.
- To cancel the move, **click** the initial square.
:::

Branches
---

PTN Ninja records multiple lines of play, called "branches." Branches outside the current line of play are hidden by default. You can display branches by **clicking** the Branch button in the PTN toolbar.

:::
- Click the Branch menu in the bottom toolbar, or press <kbd>B</kbd>, to see the contextual branch menu.
- Use <kbd>▲/▼</kbd> <span>or</span> <kbd>0-9</kbd> to navigate between branches.
- **Right-click** a branch title to **rename** or **delete** it.
:::

PTN
---

[PTN](https://www.reddit.com/r/Tak/wiki/portable_tak_notation) is the notation that describes the moves of the game. PTN Ninja reads and writes information using this notation.

:::
- To toggle display of the full PTN, use the leftmost button in the header toolbar, or press <kbd>Q</kbd>.
- **Click** an unselected ply to navigate to it.
- **Click** a selected ply to do or undo it.
- **Right-click** an unselected ply to navigate to it, toggling the done/undone state.
:::

### Trimming
PTN Ninja provides a few automated tools for removing irrelevant information:

:::
- **Trim Branches** deletes all plies outside the currently selected branch.
- **Trim to Current Ply** deletes all plies leading to the current board state.
- **Trim to Current Board** deletes all plies, preserving the board state.
:::

Notes
---

One feature of PTN is support for comments. PTN Ninja provides a chat-like interface for creating, editing, and viewing these comments or notes.

:::
- To toggle display of Notes, use the rightmost button in the header toolbar, or press <kbd>W</kbd>.
- Press <kbd>/</kbd> to focus the text input, then enter your comments.
- Press <kbd>Shift</kbd><kbd>Enter</kbd> to save the text.
- Press <kbd>Esc</kbd> to defocus the text input.
- In the Notes panel, **right-click** a note to **edit** or **delete** it.
- **Right-click** the Notes button in the header toolbar to toggle note notifications.
:::

TPS Mode
---

TPS Mode enables you to create any board state directly. Enter TPS Mode by **clicking** the Edit button in the TPS field of the Edit Game dialog. TPS edit mode is available only for games with no plies.

:::
- Select a piece type and color from the piece selector, then **click** a square to place a piece.
- **Right-click** a square to remove a piece. The color and type of that piece will be selected.
:::

3D Mode
---

3D mode may not work in all browsers, so it's disabled by default. You can toggle it by **clicking** the 3D button in the corner of the board area.

:::
- Rotate the board by dragging it.
- Reset the board rotation by **right-clicking** in the space around the board.
:::
