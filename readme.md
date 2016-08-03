# PTN Ninja
&copy; 2016 Craig Laparo

An editor and viewer for Portable Tak Notation (http://ptn.ninja)

If you want to support my work:
[Donate USD](https://www.paypal.me/gruppler) |
[Donate Bitcoins](bitcoin:12mD2HUNb4MJoLfVDDLS1wep1hdhrSY3L8)

## Getting Started
To load a **.ptn** file, simply drag the file into the window, or copy the contents and paste into the editor. Toggle between **Edit Mode** and **Play Mode** using the FAB (the big button in the lower-right corner).

If there are any problems with the PTN, the FAB will turn red, and clicking it will display the error message(s).

The **share** menu in the upper-right corner allows you to do the following:
- Share the current PTN as a URL. The PTN is compressed and is always up to date.
- Download the current PTN as a **.ptn** file.
- Open a **.ptn** or **.txt** file from your system. (I agree, it doesn't belong in the "share" menu)



## Hotkeys
#### Global
| Key                                           | Action             |
| --------------------------------------------- | -----------------  |
| <kbd>Esc</kbd>                                | Toggle Menu        |
| <kbd>Ctrl</kbd>+<kbd>Space</kbd>              | FAB action         |
| <kbd>Ctrl</kbd>+<kbd>s</kbd>                  | Download .ptn file |
| <kbd>Ctrl</kbd>+<kbd>o</kbd>                  | Open .ptn file     |
| <kbd>Ctrl</kbd>+<kbd>d</kbd>                  | Load default PTN   |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>/</kbd> | Load sample PTN    |

#### Edit Mode
| Key                                           | Action              |
| ----------------------------------------------| ------------------- |
| <kbd>Ctrl</kbd>+<kbd>z</kbd>                  | Undo                |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>z</kbd> | Redo                |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>t</kbd>   | Trim to current ply |

#### Play Mode
| Key                               | Action             |
| --------------------------------- | ------------------ |
| <kbd>Space</kbd>                  | Play/Pause         |
| <kbd>&uarr;</kbd>                 | Previous Move      |
| <kbd>&darr;</kbd>                 | Next Move          |
| <kbd>&larr;</kbd>                 | Previous Ply       |
| <kbd>&rarr;</kbd>                 | Next Ply           |
| <kbd>Ctrl</kbd>+<kbd>&larr;</kbd> | First Ply          |
| <kbd>Ctrl</kbd>+<kbd>&rarr;</kbd> | Last Ply           |
| <kbd>a</kbd>                      | Toggle Annotations |



## To Do
- Refactor:
  - Use [MDL](https://getmdl.io/started/index.html)
    - As a subtree? submodule?
    - Include only scss files if possible
  - Messages
    - Use MDL if possible
    - Rethink positioning?
  - Hotkeys
    - Include textual description (for hotkey help)
  - Config
    - Include type and textual description (for easier rendering of preference controls)
  - main.js
    - Re-organize and comment
- Improve performance
  - Re-write caret position ply detection
    - Don't use $.closest()
  - Delete simulator when entering Play Mode (after validation)
    - Test to verify this is worth it
- Sidebar menu
  - ~~Use https://github.com/mango/slideout~~
  - Use MDL if possible
  - Game Properties
    - Open modal dialog to edit tags
  - ~~Open~~
  - ~~Load sample game~~
  - Load stress test
  - Edit Mode:
    - ~~Trim to current ply~~
      - ~~Encode current board as TPS and add to header~~
      - ~~Remove preceding notation~~
    - Toggle: Highlight current ply's squares
    - Automatic Formatting:
      - Styles:
        - Verbose
          - Insert all stone types (before place, after slide)
          - Insert all slide and drop counts
        - Minimal
          - Opposite of Verbose
      - Toggle: Pad line numbers
        - Pad between plies based on longest ply1
      - Automatically insert analytical notation
        - Use [TakAnalysis by nqeron](https://github.com/nqeron/TakAnalysis)
  - Play Mode:
    - Highlight current ply's squares
    - Show annotations
    - Playback speed
  - Board:
    - Show current move
      - Include line number
      - Show both plies side by side
      - Position below board
    - Show row/column labels
    - Show player names and flat counts
    - Show un-played pieces
    - Show play controls
  - About
    - Modal iframe of rendered readme.md
  - Ad
    - Persistent option to hide it (because I hate ads)
    - Show donate links on hide
- Embed code generator
  - In the share menu
  - Open new window (index.html#C0mpr3s5edPTN)
  - Resize window to set iframe aspect ratio
    - Aspect ratio inputs update onResize
    - Embed code updates onResize
  - Option to include current ply in URL
  - Allow initial mode override
  - Allow preference override
    - Presets:
      - Current Board Only (Screenshot Mode)
        - Include only TPS in URL hash
      - Minimal Play Mode
      - Maximal Play Mode
  - API
    - Use [window.postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
    - Send and/or receive in JSON:
      - Raw PTN text
      - Compressed PTN
      - Parsed PTN
      - Current board TPS
      - PTN changes
      - Navigation events:
        - Previous
        - Next
        - Ply by ID
        - Move by ID
      - Single ply (to be) performed
        - Errors from Board.do_ply()
      - Errors from Game.parse()
      - Message to be displayed
        - Types:
          - success
          - warning
          - error
          - help
          - info
          - comment
          - player1
          - player2
- Edit Mode Improvements
  - ~~Improve visibility while editing~~
  - ~~Highlight current square~~
  - ~~Automatically insert closing braces and quotes~~
    - ~~[], "", {}~~
  - Delete preceding auto-matched brace/quote on Backspace
  - ~~Automatic line numbers~~
    - ~~Insert line numbers after Enter keypress~~
    - ~~Insert if missing~~
    - ~~Correct if wrong~~
  - Don't bail unless necessary
    - Use a warning instead
    - Namely, required tags should warn
  - TPS parsing
    - ~~Insert player and move icons~~
    - ~~Highlight notation~~
    - ~~Realtime parsing~~
    - ~~Highlight current square~~
    - Don't rely on Size tag
    - Warn about "Size" and "TPS" conflict
- Editing via GUI (i.e. easy mode)
  - Board.do_ply(new_ply)
    - Overwrite any following PTN if new_ply is valid
  - Allow for easy live transcription and puzzle completion
  - Toggle switch, or enabled only if result is blank?
  - Use the editor's undo feature?
  - UI for adding comments and evaluation marks
    - Menu
    - Hotkeys
  - UI for tags
    - Show all possible tags
    - Indicate required tags
    - Inputs provide options or format validation
  - Integrate with existing bots
- Known Bugs:
  - ~~Allow C to smash S by sliding stack if no captives~~
  - ~~Handle illegal moves better~~
  - ~~Enable moving to Ply 0 from editor~~
  - ~~Support "load" as first "ply" for TPS where next ply is black~~
  - Don't display result if road win but no road is built


## Legal
&copy; 2016 Craig Laparo

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.
