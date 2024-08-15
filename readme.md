# PTN Ninja

This is an editor and viewer for [Portable Tak Notation (PTN)](https://ustak.org/portable-tak-notation/). It aims to be...

- Useful for transcription of live games, even on a phone.
- Intuitive, with a minimal UI that is enjoyable to use.
- Responsive, with a fluid design that works as well on a phone as it does in full-screen on a desktop.

## Installation

### Prerequisites

- Quasar: https://quasar.dev/quasar-cli/installation
- Firebase: https://firebase.google.com/docs/emulator-suite/install_and_configure

### Install the client-side dependencies

```bash
yarn
```

### Install the server-side dependencies (optional)

```bash
pushd functions && npm install && popd
```

#### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
yarn dev
```

#### Start the server emulators (optional)

```bash
yarn emulate
```

#### Lint the files

```bash
yarn lint
```

#### Build the app for production

```bash
yarn build
```

## API

PTN Ninja can send and receive messages with its opening or parent window using [`Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage). These messages are objects containing an `action`, as well as a `value` where applicable.

For example:

```js
{
  action: "SET_UI",
  value: {
    showRoads: true
  }
}
```

### Actions

#### `SET_NAME` (value: `<String>`)

- Set the game title

#### `SET_UI` (value: `<Object>`)

- Set one or more UI parameters

#### `TOGGLE_UI` (value: `<String>`)

- Toggle the specified UI parameter

#### `SET_CURRENT_PTN` (value: `<String>`)

- Replace the current game with the provided PTN

#### `DELETE_PLY` (value: `<Number>`)

- Delete the ply specified by ID

#### `INSERT_PLY` (value: `<String>`)

- Execute a single ply specified as a string in PTN (e.g. `Sb4`)

#### `INSERT_PLIES` (value: `<Object>: { plies, prev }`)

- Execute a series of `plies` specified as strings in PTN (e.g. `['d5', 'e4']`, or `d5 e4`) and go backward `prev` plies

#### `DELETE_BRANCH` (value: `<String>`)

- Delete the specified branch

#### `GO_TO_PLY` (value: `<Object>: { plyID, isDone }`)

- Navigate to the specified ply

#### `PLAY`

- Begin stepping through plies from current position

#### `PAUSE`

- Stop stepping through plies

#### `PLAY_PAUSE`

- Toggle between PLAY and PAUSE

#### `PREV`

- Navigate backward

#### `NEXT`

- Navigate forward

#### `FIRST`

- Navigate to the beginning

#### `LAST`

- Navigate to the end

#### `UNDO`

- Undo

#### `REDO`

- Redo

#### `PROMOTE_BRANCH` (value: `<String>`)

- Promote a branch specified by its name

#### `MAKE_BRANCH_MAIN` (value: `<String>`)

- Swap a branch with its main line, specified by branch name

#### `RENAME_BRANCH` (value: `<Object>: { oldName, newName }`)

- Rename a branch

#### `TOGGLE_EVALUATION` (value: `<Object>: { type, double }`)

- Toggle evaluation notation on the current ply

#### `EDIT_NOTE` (value: `<Object>: { plyID, index, message }`)

- Replace the specified comment

#### `ADD_NOTE` (value: `<Object>: { message, plyID }`)

- Add a comment to the specified ply, or the current ply if not specified

#### `ADD_NOTES` (value: `<Object>: { [plyID]: Array(messages) }`)

- Add the comments to the specified plies

#### `REMOVE_NOTE` (value: `<Object>: { plyID, index }`)

- Remove the specified comment

#### `TRIM_BRANCHES`

- Remove non-active branches

#### `TRIM_TO_BOARD`

- Remove plies, preserving the board state

#### `TRIM_TO_PLY`

- Remove all plies preceding the current ply

#### `CANCEL_MOVE`

- Abort any in-progress piece movement interaction

#### `NOTIFY` (value: `<String>|<Object>`)

- Issue a notification

#### `NOTIFY_ERROR` (value: `<String>|<Object>`)

- Issue an error notification

#### `NOTIFY_SUCCESS` (value: `<String>|<Object>`)

- Issue a success notification

#### `NOTIFY_WARNING` (value: `<String>|<Object>`)

- Issue a warning notification

#### `NOTIFY_HINT` (value: `<String>|<Object>`)

- Issue a hint notification

#### `ROTATE_180`

- Rotate the board 180 degrees

#### `ROTATE_LEFT`

- Rotate the board left 90 degrees

#### `ROTATE_RIGHT`

- Rotate the board right 90 degrees

#### `FLIP_HORIZONTAL`

- Flip the board horizontally

#### `FLIP_VERTICAL`

- Flip the board vertically

#### `RESET_TRANSFORM`

- Reset any board transformation

#### `APPLY_TRANSFORM` (value: `<Array>: [ int a, int b ]` )

- Apply the specified board transformation `[int a, int b]` where `a` is the number of clockwise rotations [0, 3], and `b` is the number of horizontal flips [0, 1].

#### `HIGHLIGHT_SQUARES` (value: `<Array>: [ <String> ]` )

- Highlight the squares specified as an array of string coordinates (e.g. 'a1'). If no squares are provided, the most recent ply is highlighted.

## URLs

PTN Ninja uses [lz-string](https://pieroxy.net/blog/pages/lz-string/guide.html#inline_menu_3) to encode PTN and some other parameters for use in the URL. However, it will also do its best to read these parameters when passed as plaintext.

The structure of the URL is as follows:

`https://ptn.ninja/<PTN>&<param1>=<value1>&<param2>=<value2>[...]`

To get a shortened URL, send a POST request to `https://url.ptn.ninja/short` with request body `{ ptn, params (optional) }` where `ptn` is a string, and `params` is an optional object containing any of the parameters below. If the request is valid, you'll receive the complete shortenend URL as plain text in response.

### URL Parameters

#### `name`

- Title of the game

#### `ply`

- Index of the current ply
- Ending with `!` means `plyIsDone == true`

#### `targetBranch`

- Name of the current branch

#### `theme`

- ID or JSON of the theme to be used

#### `axisLabels` (default: `true`)

- Show axis labels

#### `flatCounts` (default: `true`)

- Show flat counts

#### `stackCounts` (default: `true`)

- Show stack counts

#### `turnIndicator` (default: `true`)

- Show turn indicator

#### `highlightSquares` (default: `true`)

- Show square highlights

#### `playSpeed` (default: `60`)

- Steps per minute to be used for playback

#### `showAllBranches` (default: `false`)

- Show all branches

#### `showControls` (default: `true`)

- Show playback controls

#### `showMove` (default: `true`)

- Show the current move

#### `showPTN` (default: `true`)

- Show the PTN panel

#### `showRoads` (default: `true`)

- Show road connections

#### `showScrubber` (default: `true`)

- Show the playback scrubber

#### `showText` (default: `true`)

- Show the Notes panel

#### `unplayedPieces` (default: `true`)

- Show unplayed pieces

## Legal

&copy; 2022 Craig Laparo

This work is licensed under a GNU AGPLv3 [License](https://www.gnu.org/licenses/agpl-3.0.en.html).
