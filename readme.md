# PTN Ninja

This is an editor and viewer for [Portable Tak Notation (PTN)](https://www.reddit.com/r/Tak/wiki/portable_tak_notation). It aims to be...

* Intuitive, with a minimal UI that is enjoyable to use.
* Interactive, with an editing experience that teaches or aides understanding of notation.
* Responsive, with a fluid design that works as well on a phone as it does in fullscreen on a desktop.

If you want to support this project, you can...

* [Report an issue](https://github.com/gruppler/PTN-Ninja/issues/)
* [Donate Bitcoins](bitcoin:12mD2HUNb4MJoLfVDDLS1wep1hdhrSY3L8)
* [Donate USD](https://www.paypal.me/gruppler)

## Getting Started
Toggle between **Edit Mode** and **Play Mode** using the FAB (the big button in the lower-right corner).

### Edit Mode
<kbd>Tap</kbd> or <kbd>click</kbd> a **ply** to move the board to that point in the game. <kbd>Tap</kbd> or <kbd>click</kbd> again **within the current ply** to toggle the done/undone state of the ply.

If there are any problems with the PTN, the FAB will turn red, and clicking it will display the error message(s). You can <kbd>tap</kbd> or <kbd>click</kbd> the **error message** to move the caret to the relevant position in the PTN.

The editor checks the validity of the syntax as well as the legality of each ply, and automatically maintains the correct game result and move numbers.

#### Load a Game
- <kbd>Drag</kbd> a **.ptn file** into the window
- Or, press <kbd>Ctrl or &#x2318;</kbd> + <kbd>o</kbd>
- Or, select **Open** from the menu
- Or, copy the contents and paste into the editor

### Play Mode
- Navigate the game using the **Play Controls** or **arrow hotkeys** listed below
- <kbd>Tap</kbd> or <kbd>click</kbd> the **buttons** displayed around the Current Move to navigate by move (two plies)
- <kbd>Tap</kbd> or <kbd>click</kbd> the **plies** of the Current Move

#### Place a Stone
- <kbd>Tap</kbd> or <kbd>click</kbd> on a **square** to place a flat stone
- <kbd>Tap</kbd> or <kbd>click</kbd> the **square** again to cycle the stone type
- <kbd>Long-touch</kbd> or <kbd>right-click</kbd> a **square** to place a standing stone
- <kbd>Long-click</kbd> a **square** to place a cap stone

#### Move a Piece or Stack
- <kbd>Tap</kbd> or <kbd>click</kbd> a **square** to select the piece or stack
- <kbd>Long-touch</kbd> or <kbd>right-click</kbd> a **square** to select the **top piece** of a stack
- <kbd>Tap</kbd> or <kbd>click</kbd> further **squares** to drop pieces
- <kbd>Long-touch</kbd> or <kbd>right-click</kbd> a **square** to drop the selected stack
- <kbd>Esc</kbd> also drops the selected stack in place

### 3D Mode
3D Mode is experimental and may not work well or at all on some browsers or devices. It works best in Chrome.

#### Rotate the Board
- <kbd>Two-finger-drag</kbd>
- Or, <kbd>Ctrl or &#x2318;</kbd> + <kbd>left-click</kbd> <kbd>drag</kbd>
- Or, <kbd>middle-click</kbd> + <kbd>drag</kbd>

#### Reset the Board Rotation
- <kbd>Long-touch</kbd> outside the board
- Or, <kbd>Ctrl or &#x2318;</kbd> + <kbd>click-hold</kbd> outside the board
- Or, <kbd>middle-click-hold</kbd> outside the board

---
## Hotkeys
### Global
Key|Action
:--|:--
<kbd>Esc</kbd>|Toggle Menu, or drop selected stack
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Space</kbd>|Toggle Edit/Play Mode
<kbd>Ctrl or &#x2318;</kbd> + <kbd>s</kbd>|Save .ptn File
<kbd>Ctrl or &#x2318;</kbd> + <kbd>o</kbd>|Open .ptn File
<kbd>Ctrl or &#x2318;</kbd> + <kbd>d</kbd>|Load Default PTN
<kbd>Ctrl or &#x2318;</kbd> + <kbd>z</kbd>|Undo
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Shift</kbd> + <kbd>z</kbd>|Redo
<kbd>Ctrl or &#x2318;</kbd> + <kbd>y</kbd>|Redo
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Shift</kbd> + <kbd>/</kbd>|Help/About PTN Ninja

---
### Edit Mode
Key|Action
:--|:--
<kbd>Ctrl or &#x2318;</kbd> + <kbd>Shift</kbd> + <kbd>c</kbd>|Trim to current ply*

\*This deletes all plies before and including the current ply, storing the current board position in a TPS tag in the header.

---
### Play Mode
Key|Action
:--|:--
<kbd>Space</kbd>|Play/Pause
<kbd>&larr;</kbd>|Previous Ply
<kbd>&rarr;</kbd>|Next Ply
<kbd>Shift</kbd> + <kbd>&larr;</kbd>|Previous Half-Ply
<kbd>Shift</kbd> + <kbd>&rarr;</kbd>|Next Half-Ply
<kbd>&uarr;</kbd>|Previous Move
<kbd>&darr;</kbd>|Next Move
<kbd>Ctrl or &#x2318;</kbd> + <kbd>&larr;</kbd>|First Ply
<kbd>Ctrl or &#x2318;</kbd> + <kbd>&rarr;</kbd>|Last Ply
<kbd>3</kbd>|Toggle 3D Board
<kbd>s</kbd>|Toggle Board Shadows
<kbd>Shift</kbd> + <kbd>a</kbd>|Toggle Board Animations
<kbd>Shift</kbd> + <kbd>f</kbd>|Toggle Mode Button (FAB)
<kbd>a</kbd>|Toggle Annotations
<kbd>x</kbd>|Toggle Axis Labels
<kbd>m</kbd>|Toggle Current Move
<kbd>f</kbd>|Toggle Flat Counts
<kbd>c</kbd>|Toggle Play Controls
<kbd>r</kbd>|Toggle Road Connections
<kbd>h</kbd>|Toggle Square Highlight
<kbd>u</kbd>|Toggle Unplayed Pieces


## Legal
&copy; 2016 Craig Laparo

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.
