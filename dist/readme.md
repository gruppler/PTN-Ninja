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
| Key                        | Action                                 |
| -------------------------- | -------------------------------------- |
| <kbd>Esc</kbd>             | Toggle between Play Mode and Edit Mode |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>/</kbd> | Load sample PTN |

#### Edit Mode
| Key                            | Action |
| ------------------------------ | ------ |
| <kbd>Ctrl</kbd> + <kbd>z</kbd> | Undo   |

#### Play Mode
| Key                                 | Action        |
| ----------------------------------- | ------------- |
| <kbd>Spacebar</kbd>                 | Play/Pause    |
| <kbd>&uarr;</kbd>                   | Previous Move |
| <kbd>&darr;</kbd>                   | Next Move     |
| <kbd>&larr;</kbd>                   | Previous Ply  |
| <kbd>&rarr;</kbd>                   | Next Ply      |
| <kbd>Ctrl</kbd> + <kbd>&larr;</kbd> | First Ply     |
| <kbd>Ctrl</kbd> + <kbd>&rarr;</kbd> | Last Ply      |



## To Do
- Known Bugs
  - Enable moving to Ply 0 from editor
  - Support "load" as first "ply" for TPS where next ply is black
  - Don't display result if not explicitly stated at end
    - Unless a road is built


- Embed code generator
  - In the share menu
  - Open new window (embed.html#C0mpr3s5edPTN)
  - Resize window to set iframe aspect ratio
    - Aspect ratio inputs update onResize
    - Embed code updates onResize
  - Fluid size


- Sidebar menu
  - Use https://github.com/mango/slideout
  - Items:
    - Open file
    - Load sample PTN
    - Edit Mode:
      - Set current ply as start
        - Encode current board as TPS and add to header
        - Remove preceding notation
      - Automatic formatting options
    - Play Mode:
      - Playback speed
      - Enable/disable annotations
      - Editing GUI options
    - About (readme.html)


- Editing via GUI (i.e. easy mode)
  - Allow for easy live transcription and puzzle completion
  - Toggle switch, or enabled only if result is blank?
  - Use the editor's undo feature
  - UI for adding comments and evaluation marks
  - UI for tags
    - Show all possible tags
    - Indicate required tags
    - Inputs provide options or format validation


- Edit Mode Improvements
  - Automatic line numbers
    - Insert line numbers after Enter keypress
    - Insert if missing
    - Correct if wrong
  - Automatically insert closing braces and quotes
    - [], "", {}
  - Auto formatting
    - Styles
      - Verbose
        - Insert all stone types (before place, after slide)
        - Insert all slide and drop counts
      - Minimal
        - Opposite of Verbose
    - Pad line numbers
    - Pad between plies based on longest move.ply1
    - Automatically insert Tak marks (')
      - "Tak" detection
        - Board.find_road(player, ply)
          - Highlight squares composing road
        - Board.possible_plys(player)


## Legal
&copy; 2016 Craig Laparo

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.
