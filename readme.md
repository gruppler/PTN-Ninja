# PTN Ninja

This is an editor and viewer for [Portable Tak Notation (PTN)](https://www.reddit.com/r/Tak/wiki/portable_tak_notation). It aims to be...

* Useful for transcription of live games, even on a phone.
* Intuitive, with a minimal UI that is enjoyable to use.
* Interactive, with an editing experience that teaches or aides understanding of notation.
* Responsive, with a fluid design that works as well on a phone as it does in fullscreen on a desktop.

If you want to support this project, you can...

* [Report an issue or feature request](https://github.com/gruppler/PTN-Ninja/issues/)
* [Become a Patron](https://www.patreon.com/gruppler)
* [Donate USD](https://www.paypal.me/gruppler)

## Getting Started
Toggle between **Edit Mode** and **Play Mode** using the FAB (the big button in the lower-right corner).

### Edit Mode
**Tap** or **click** a **ply** to move the board to that point in the game. **Tap** or **click** again **within the current ply** to toggle the done/undone state of the ply.

If there are any problems with the PTN, the FAB will turn red, and clicking it will display the error message(s). You can **tap** or **click** the **error message** to move the caret to the relevant position in the PTN.

The editor checks the validity of the syntax as well as the legality of each ply, and automatically maintains the correct game result(s).

#### Load a Game
- **Drag** a **.ptn file** into the window
- Or, press <kbd>Ctrl or &#x2318;</kbd> + <kbd>o</kbd>
- Or, select **Open** from the menu
- Or, **copy** the contents and **paste** into the editor

### Play Mode
- Navigate the game using the **Play Controls** or **arrow hotkeys** listed below
- **Tap** or **click** the **buttons** displayed around the Current Move to navigate by move (two plies)
- **Tap** or **click** the **plies** of the Current Move

#### Place a Stone
- **Tap** or **click** on a **square** to place a flat stone
- Then, **tap** or **click** the **square** again to cycle the stone type
- Or, **long-touch** or **right-click** a **square** to place a standing stone
- Or, **long-click** a **square** to place a cap stone

#### Move a Piece or Stack
- **Tap** or **click** a **square** to select the piece or stack
- Or, **long-touch** or **right-click** a **square** to select the **top piece** of a stack
- Then, **tap** or **click** further **squares** to drop pieces
- Or, **long-touch** or **right-click** a **square** to drop the selected stack
- Or, press <kbd>Esc</kbd> to drop the selected stack in place

### 3D Mode
3D Mode is experimental and may not work well or at all on some browsers or devices. It works best in Chrome.

#### Rotate the Board
- **Two-finger-drag**
- Or, <kbd>Ctrl or &#x2318;</kbd> + **left-click** **drag**
- Or, **middle-click** + **drag**

#### Reset the Board Rotation
- **Long-touch** outside the board
- Or, <kbd>Ctrl or &#x2318;</kbd> + **click-hold** outside the board
- Or, **middle-click-hold** outside the board

---
## Hotkeys
### Global
Key|Action
:--|:--
<kbd>Esc</kbd>|Toggle Menu, or drop selected stack
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Space</kbd>|Toggle Edit/Play Mode
<kbd>Ctrl or &#x2318;</kbd> + <kbd>s</kbd>|Save .ptn File
<kbd>Ctrl or &#x2318;</kbd> + <kbd>o</kbd>|Open .ptn File
<kbd>Ctrl or &#x2318;</kbd> + <kbd>z</kbd>|Undo
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Shift</kbd> + <kbd>z</kbd>|Redo
<kbd>Ctrl or &#x2318;</kbd> + <kbd>y</kbd>|Redo
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Shift</kbd> + <kbd>/</kbd>|Help/About PTN Ninja

---
### Edit Mode
Key|Action
:--|:--
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Shift</kbd> + <kbd>c</kbd>|Trim to current ply*
<kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>c</kbd>|Trim to current board**

\*This deletes all plies before and including the current ply, storing the current board state in a TPS tag in the header.

\*\*This deletes all moves, storing the current board state in a TPS tag in the header.

---
### Play Mode
Key|Action
:--|:--
<kbd>n</kbd>|New Game
<kbd>Space</kbd>|Play/Pause
<kbd>&larr;</kbd>|Previous Ply
<kbd>&rarr;</kbd>|Next Ply
<kbd>Shift</kbd> + <kbd>&larr;</kbd>|Previous Half-Ply
<kbd>Shift</kbd> + <kbd>&rarr;</kbd>|Next Half-Ply
<kbd>&uarr;</kbd>|Previous Move
<kbd>&darr;</kbd>|Next Move
<kbd>Ctrl or &#x2318;</kbd> + <kbd>&larr;</kbd>|First Ply
<kbd>Ctrl or &#x2318;</kbd> + <kbd>&rarr;</kbd>|Last Ply
<kbd>1</kbd> &ndash; <kbd>9</kbd>|Select Branch 1-9
<kbd>0</kbd>|Select Original Branch
<kbd>b</kbd>|Toggle Branch List
<kbd>a</kbd>|Toggle Annotations
<kbd>x</kbd>|Toggle Axis Labels
<kbd>m</kbd>|Toggle Current Move
<kbd>f</kbd>|Toggle Flat Counts
<kbd>c</kbd>|Toggle Play Controls
<kbd>Shift</kbd> + <kbd>b</kbd>|Toggle Branch Highlight
<kbd>h</kbd>|Toggle Selected Square Highlight
<kbd>r</kbd>|Toggle Road Connections
<kbd>u</kbd>|Toggle Unplayed Pieces
<kbd>d</kbd>|Toggle 3D Board
<kbd>s</kbd>|Toggle Board Shadows
<kbd>Shift</kbd> + <kbd>a</kbd>|Toggle Board Animations
<kbd>Shift</kbd> + <kbd>u</kbd>|Toggle UI Animations
<kbd>Shift</kbd> + <kbd>f</kbd>|Toggle Mode Button (FAB)


## Legal
&copy; 2016 Craig Laparo

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.
