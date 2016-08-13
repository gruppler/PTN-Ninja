# [PTN Ninja](http://ptn.ninja)
&copy; 2016 Craig Laparo

This is an editor and viewer for [Portable Tak Notation (PTN)](https://www.reddit.com/r/Tak/wiki/portable_tak_notation). It aims to be...

- Intuitive, with a minimal UI that is enjoyable to use.
- Interactive, with an editing experience that teaches or aides understanding of notation.
- Responsive, with a fluid design that works as well on a phone as it does in fullscreen on a desktop.

If you want to support my work: [
  [Donate USD](https://www.paypal.me/gruppler) |
  [Donate Bitcoins](bitcoin:12mD2HUNb4MJoLfVDDLS1wep1hdhrSY3L8)
]

[Report an issue](https://github.com/gruppler/PTN-Ninja/issues/)

## Getting Started

To load a "**.ptn**" file, **drag** the file into the window, or copy the contents and paste into the editor. Toggle between **Edit Mode** and **Play Mode** using the FAB (the big button in the lower-right corner). If there are any problems with the PTN, the FAB will turn red, and clicking it will display the error message(s). The editor checks the validity of the syntax as well as the legality of each ply.

## Hotkeys
#### Global
| Key                                                       | Action             |
| --------------------------------------------------------- | -----------------  |
| <kbd>Esc</kbd>                                            | Toggle Menu        |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>Space</kbd>                 | FAB action         |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>s</kbd>                     | Download .ptn file |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>o</kbd>                     | Open .ptn file     |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>d</kbd>                     | Load default PTN   |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>&#x21E7;</kbd>+<kbd>/</kbd> | Load sample PTN    |

#### Play Mode
| Key                                                       | Action             |
| --------------------------------------------------------- | ------------------ |
| <kbd>Space</kbd>                                          | Play/Pause         |
| <kbd>&uarr;</kbd>                                         | Previous Move      |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>&#x21E7;</kbd>              | Previous Move      |
| <kbd>&darr;</kbd>                                         | Next Move          |
| <kbd>&larr;</kbd>                                         | Previous Ply       |
| <kbd>&rarr;</kbd>                                         | Next Ply           |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>&larr;</kbd>                | First Ply          |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>&rarr;</kbd>                | Last Ply           |
| <kbd>a</kbd>                                              | Toggle Annotations |

#### Edit Mode
| Key                                                       | Action             |
| --------------------------------------------------------- | ------------------ |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>z</kbd>                     | Undo               |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>&#x21E7;</kbd>+<kbd>z</kbd> | Redo               |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>&#x2325;/Alt</kbd>+<kbd>z</kbd> | Revert         |
| <kbd>&#x2318;/Ctrl</kbd>+<kbd>&#x2325;/Alt</kbd>+<kbd>t</kbd> | Trim to current ply* |
\* This deletes all plies before and including the current ply, storing the current board position in a TPS tag in the header.


## Legal
&copy; 2016 Craig Laparo

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.
