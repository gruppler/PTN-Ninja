Getting Started
===

### Games

PTN Ninja can store multiple games to allow easy switching between them via the Game Selector. Loaded games are stored in the browser until closed from the Game Selector. You're responsible for closing games you no longer need.

::: tip
You can automatically close or download multiple games by **clicking** the game count.
:::

You can load games from **.ptn** or **.txt** files, or from URLs originating from [PlayTak](https://www.playtak.com/games) or PTN Ninja itself.

:::
- To create a new game, press <kbd>N</kbd>, or **click** the **+** button in the main menu, to open the New Game dialog.
- To load an existing game, press <kbd>L</kbd>, or **click** the **+** button in the main menu, then select the Load Game tab.
- Or, **drag** one or more **.ptn** or **.txt** files into the window.
- Use the Game Selector in the top toolbar, or hotkeys, to switch between games.
- **Right-click** the Floating Action Button to switch to the previous game.
:::

::: tip
To **right-click** on a touchscreen device, try **long-pressing**.
:::

::: info Note
When opening via URL a game with the same name as an already open game, the new game will replace the existing game.

If you prefer to instead open the new game under a unique name (by appending an incrementing number), select the "Replace" option found in the UI section of the Preferences dialog under "Duplicate Game Names."

**Replacing a game will preserve the undo history of the existing game, so the replacement can be undone at any time.**
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

### Playback

PTN Ninja enables you to navigate the timeline of a game freely.

:::
- Use the Play/Pause button to automatically progress through the game.
- Move backward and forward through the game history using the **Play Controls** or <kbd>◀/▶</kbd>.
- **Right-click** the Back or Forward button to move by a **half-step** or use <kbd>Shift</kbd><kbd>◀/▶</kbd>.
:::

To navigate through a game quickly, you can scrub using a **mouse wheel** or the **Scrub Bar**, which is located above the **Play Controls** but disabled by default.

:::

- To use the **Scrub Bar**, enable it with <kbd>Shift</kbd><kbd>S</kbd> or via **UI Preferences**, then **drag** or **click** it to quickly jump to a different point in the game.
- Use the **scroll wheel** to scrub. You may need to enable it via **UI Preferences**.
  - Hold <kbd>Shift</kbd> while scrolling to scrub slowly.
:::

### Board Transformation

PTN Ninja allows you to rotate and flip the orientation of the board, which may help reduce visual bias during analysis, or in getting a better view around tall stacks. This does not affect the notation, so the axis labels change accordingly.

:::
- Use the Rotate and Flip buttons found next to the board, or hotkeys, to change the board orientation.
- **Right-click** any of the Rotate/Flip buttons to reset the board orientation.
:::

3D Mode
---

While 2D mode gives a more analytical view of the board, 3D mode offers some semblance of how the game might look on a physical board.

:::
- Toggle 3D/2D mode by **clicking** the "3D" button in the corner of the board area, or using the hotkey <kbd>D</kbd>.
- Rotate the board by dragging in the space around the it.
- Reset the board rotation by **right-clicking** in the space around the board.
:::

Branches
---

PTN Ninja records multiple lines of play, called "branches." Branches outside the current line of play are hidden by default. You can display branches by **clicking** the Branch button in the PTN toolbar.

You can perform several actions on branches by **right-clicking** the branch name wherever it appears, such as in the branch menu next to the play controls.

:::
- Click the Branch menu in the bottom toolbar, or press <kbd>B</kbd>, to see the list of all branches.
- Use <kbd>▲/▼</kbd> <span>or</span> <kbd>0-9</kbd> to navigate between branches.
- **Right-click** a branch name to **promote**, **rename**, or **delete** it.
:::

PTN
---

[PTN](https://ustak.org/portable-tak-notation/) is the notation that describes the moves of the game. PTN Ninja reads and writes information using this notation.

:::
- To toggle display of the full PTN, use the leftmost button in the header toolbar, or press <kbd>Q</kbd>.
- **Click** an unselected ply to navigate to it.
- **Click** a selected ply to do or undo it.
- **Right-click** a ply to navigate to it but leave it undone.
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

TPS Mode enables you to create any board state directly. To enter TPS Mode, **click** the Edit icon in the TPS field of the New Game or Edit Game dialogs. TPS edit mode is available only for games with no plies.

:::
- Select a piece type and color from the piece selector or unplayed pieces, then **click** a square to place a piece.
- **Right-click** a square to remove a piece. The color and type of that piece will be selected.
:::
