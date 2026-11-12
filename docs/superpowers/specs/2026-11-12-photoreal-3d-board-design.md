# Photorealistic 3D board

**Status:** approved by Craig on 2026-11-12. Not yet built.

## Why

PTN Ninja's "3D Board" is the 2D board tilted with CSS transforms: flat
squares and flat pieces, seen at an angle. It reads as a diagram leaning
back, not as a game on a table.

Craig wants a mode for playing Tak that is beautiful: a real board with real
pieces, lit and shadowed, on a phone as much as on a desktop. The inspiration
is a render he made in Blender for the cover of Noah Fields' _Tak Puzzle
Compendium_: a framed board with coordinates on the frame, beveled flats,
cylindrical capstones, standing walls, reserves beside the board, and soft
shadows. It is inspiration, not a target to copy: what matters more is that
every theme, including custom ones, is rendered faithfully, with procedural
textures that can be configured.

The tilted CSS board stays, renamed **2.5D**. The new mode takes the name
**3D**.

## What was learned before writing this

Two throwaway prototypes answered the questions that could have sunk the
idea. The first (`public/prototype-3d/`, three.js on WebGL):

- **It can look right.** Procedural stone, wood and brushed metal, soft
  shadows, and the cover's layout were judged "looks great".
- **It can run on a phone.** On Craig's phone the highest tier held well over
  60 fps once two things were true: no post-processing passes, and shadows
  computed only when a piece moves. The first attempt, with a screen-space
  ambient occlusion pass, ran at 13 fps.

The second (`public/prototype-sound/`) asked whether a synthesized piece
sound can be believable. The Tak community calls that sound the "clack" and
judges a set by it, so a toy beep would be worse than silence.

- **It can be believable**, but only when built from measurement. Sums of
  decaying tones sounded like beeps. Sounds rebuilt from a recording of real
  pieces, impact by impact, were judged "highly plausible" beside the
  recording itself.

Their findings are requirements below, each marked _(from the prototype)_.

## Goals

- A 3D board mode that is lit, shadowed, and made of materials, for live play
  on mobile and desktop.
- Seen from straight above, it is the 2D board: same layout, same piece
  footprints. Turning 3D on is a smooth change, not a jump to another place.
- It tilts with the 2.5D board's controls and settings, and shows the same
  picture the 2.5D board would at the same tilt.
- Every theme, built-in or custom, works in 3D and looks like itself.
- Pieces, board and frame take procedural textures (stone, wood, metal, or
  none), chosen in the 3D settings and applied to whatever theme is in use.
- Everything the board does in 2D and 2.5D works in 3D.
- Pieces move in arcs and land with a sound.
- Holds 60 fps on a current mid-range phone at the default quality.

## Non-goals

- **Exported images, GIFs and thumbnails** stay 2D, drawn by TPS-Ninja.
- **Custom piece shapes.** Shapes are fixed in this work; materials are what
  change.
- **New themes.** No themes are added, and none is restyled to look like the
  cover.
- **Recorded sounds.** Every sound is synthesized, from numbers measured off
  a recording; no audio files are shipped.
- **Sound tuning controls.** See section 7.
- **Image textures, model uploads, or free placement of lights.**
- **Offline or progressive ray tracing** for stills.
- **Physics.** Pieces move along authored paths; nothing topples.
- **Replacing 2D or 2.5D.** Both remain, unchanged in behavior.

## Anti-goals

What would make this a failure even if it works:

- **Cost for people who never open it.** No three.js in the initial bundle,
  no slower first load, no new work on the 2D or 2.5D paths.
- **A board that plays differently.** The same taps, drags, selections, undo
  and keyboard shortcuts must do the same things in every mode. 3D is a view,
  never a second rule set.
- **A battery drain.** A board at rest must cost nothing per frame.
- **A top view that doesn't match 2D.** If the two disagree by a few pixels,
  the transition looks like a bug.
- **Beauty that hides the position.** Stack heights, piece colors and types,
  the last move and the road must be at least as readable as in 2.5D.

## The design

### 1. Three views of one board

The board has one state and three ways to draw it:

| View     | What it is                                                   |
| -------- | ------------------------------------------------------------ |
| **2D**   | Today's flat board.                                          |
| **2.5D** | Today's "3D Board": the 2D board tilted with CSS, unchanged. |
| **3D**   | New: a WebGL scene.                                          |

- The Settings row and the board menu offer the three views in place of the
  "3D Board" toggle.
- **`board3D` keeps its name and now means the new 3D view** _(Craig's
  decision)_. Anyone who has 3D on today, and any embed that asks for it, gets
  the new mode, so there is no migration. 2.5D is a new choice, stored
  separately.
- `boardRotation`, `perspective` and `orthographic` apply to 2.5D and 3D
  alike, with one stored value each, so switching between them keeps the
  angle.
- The **D** hotkey still toggles between flat and tilted. _(My call: it
  toggles between 2D and whichever of 2.5D or 3D was used last.)_
- If WebGL can't start (it can't in some embedded browsers), 3D falls back to
  2.5D and says so once.
- **Embeds.** A URL can select any view, as it can set any board setting, and
  3D must work there. Existing embeds with `board3D` set get the new view. The
  Embed dialog does not offer the view in this work. _(My call.)_

### 2. Geometry that agrees with the 2D board

One square is the unit. _(All from the prototype, at Craig's direction.)_

- **Flats** are half a square wide, with the 2D stone's corner radius (10% of
  the stone, 0.05 of a square) on every edge, and **0.1875 of a square
  thick**: the width of the 2D wall.
- **Walls** are that same flat stood on edge and turned 45°, each player's
  the opposite way, as in 2D. From above, a wall is exactly the 2D wall.
- **Capstones** are half a square across and about as tall, with a rounded
  top edge.
- **Stacks** are real: each piece rests on the one below. A stack over the
  carry limit is simply tall; the 2D board's side tabs for buried pieces have
  no 3D equivalent and aren't drawn.
- **Layout** is the 2D board's: flat counts and turn indicator above the
  board, coordinates in bands to its left and below it, and unplayed pieces
  in a panel to its right (below it in vertical layout). Unplayed pieces are
  arranged as 2.5D arranges them: a column per player, flats in stacks of one
  board-size each, capstones at the far end.
- **A frame** surrounds all of that, standing slightly proud of the board and
  panel. The coordinate bands and header sit on it. The frame is the one
  element with no 2D counterpart.
- All board sizes from 3 to 8, both layouts, and board rotation and flipping
  (`boardTransform`) are supported.

### 3. The camera is the 2.5D transform

The 2.5D board is tilted by
`rotateZ(-x·y·45°) rotate3d(y, x, 0, |x,y|·30°)` under a CSS perspective of
the screen's height times `3^(1 − perspective/10)`, then scaled and moved to
fit.

The 3D camera reproduces this exactly by taking the **inverse of that tilt**
and the field of view that CSS perspective implies, then backing off until
the whole layout fits and centering it. _(From the prototype: projecting the
board's corners both ways agrees to rounding error at every tilt tested.)_

Consequences worth keeping:

- At rotation `[0, 0]` the camera looks straight down and the picture is the
  2D board.
- The drag is 2.5D's: three board-widths of travel for the full range, give
  past the ends that springs back, a snap to center, right-click to reset.
- Because the camera moves and the board doesn't, **lights and shadows are
  fixed to the board**. Tilting never changes a shadow.
- Any DOM element given the 2.5D transform lines up with the scene. This is
  what lets parts of the existing board be layered over the canvas (see 6).
- `orthographic` uses an orthographic camera with the same tilt.

**Size and position.** _(My call.)_

- **At zero tilt the 2D board governs.** Squares, header, coordinate bands and
  panel land exactly where the 2D board draws them. The frame takes its width
  from the padding the 2D board leaves around itself, and is thinner where
  that padding is small, as on a phone. It never pushes the board inward.
- **Under tilt, 3D fits its own layout**: the frame plus an allowance above
  the board for a stack one board-size tall. The fit changes continuously
  with the tilt and ends at the 2D position at zero.
- **It does not refit as stacks grow.** The 2.5D board refits on every ply,
  measuring every stone, and so breathes during play. 3D holds still; a stack
  taller than the allowance may pass the edge of the fit.
- 3D therefore need not be the same size as 2.5D at a given tilt. The
  cross-fade between them eases the size as well.

**Transition.** Switching between 2D and 3D eases the tilt between `[0, 0]`
and the stored rotation while cross-fading the two renderings. Switching
between 2.5D and 3D is a cross-fade at the same tilt. `animateBoard` off
makes both immediate.

### 4. Light and shadow

- **Centered above the layout** _(Craig's direction)_, in one of two rigs:
  **Single**, one lamp; and **Soft**, the same light spread over a lamp and a
  ring of four close around it, whose shadows overlap into one diffuse edge.
  Soft is the stand-in for an area light. _(My call: Soft is the default. The
  rig is one of the 3D settings.)_
- **The light is neutral white** _(Craig's decision)_, and the renderer's
  tone response is chosen so that an untextured piece shows its theme color
  as closely as lighting allows. The prototype's warm lamp and film-style
  tone curve are not carried over: they shift every color, and lit pieces
  would sit beside header bars drawn in the theme's exact colors.
- Low environment lighting fills the shadows and gives metals something to
  reflect. It is generated, not downloaded, and neutral too.
- **Shadow maps are rendered only when the scene changes**: a piece moves,
  the theme changes, the board resizes. _(From the prototype; this is what
  made soft shadows affordable on a phone.)_ While a piece is animating they
  update each frame, for that animation only.
- **No post-processing passes** at any quality tier. _(From the prototype.)_
  Contact darkening comes from the soft rig, not from screen-space ambient
  occlusion.

### 5. Themes and textures

**Procedural textures.** A material is a texture and a few numbers, evaluated
per pixel from the piece's own coordinates, with no image files:

- **Texture:** none, stone, wood, or brushed metal. The wood follows the
  recipe in Craig's Blender files: noise stretched along the grain, warped,
  mapped through a color ramp, with the same noise as a slight bump.
- **Colors** the pattern blends between. By default they are tones of the
  theme's color for that part, so wood on a red piece is red wood, in any
  theme.
- **Pattern:** how visible the pattern is, from a plain even surface to
  strongly figured. _(Craig's direction: the control must change how visible
  the noise is, not only move it.)_
- **Uniqueness:** how different one piece is from the next. At zero every
  piece is identical; higher values give each piece its own region of the
  pattern and a slight difference in tone.
- **Roughness, metalness, sheen,** and bump strength. Sheen is the soft
  brightening at grazing angles that reads as dust or fuzz.

Board squares, the unplayed-pieces panel and the frame take the same
textures. Each square is its own piece of material.

**Every theme carries over** _(Craig's priority)_. Built-in or custom, a theme
gets a faithful translation computed from what it already has:

| Theme value                                | In 3D                                  |
| ------------------------------------------ | -------------------------------------- |
| `board1`, `board2`, `boardChecker`         | Square colors                          |
| `boardStyle` (blank, diamonds, grid)       | The same inset shape on each square    |
| `rings`, ring colors, `rings-opacity`      | The same tint, on the board's surface  |
| `board3`                                   | The unplayed-pieces panel              |
| `secondary`                                | The frame, and darker, the table       |
| player flat and special colors             | Flats; walls and capstones             |
| player border colors, `piece-border-width` | A darker rim on each piece             |
| `primary`                                  | Last-move highlight and turn indicator |
| player road colors                         | Road indication                        |
| text colors                                | Coordinates and header text            |

With no texture set, a theme looks like itself, lit. The frame takes the page
background's color because the header and coordinates sit on that color in
2D, and their text is already chosen to read against it.

**Textures are 3D settings, not part of a theme** _(Craig's decision)_. A
theme stays what it is today, a set of colors and board options, and its
format doesn't change. The texture of each player's pieces, of the board and
of the frame and panel, with the numbers above, and the light rig, are
settings of the 3D view:

- They apply to every theme, so changing theme keeps the wood, and any theme,
  custom ones included, can be given a texture without being edited or
  copied.
- They sit in their own 3D section of Settings and the board menu, where the
  board itself is the preview, and are synced with the other 3D settings.
- A URL can set them like any other board setting, so an embed can ask for
  them.
- The theme editor, exported themes and TPS-Ninja are untouched.

The cost is that a theme can't carry a complete 3D look with it. If that is
wanted later, a theme could suggest textures that the settings then adopt;
it is not part of this work.

No theme is added or restyled.

**Stacking** is another 3D setting: how carelessly pieces sit, in rotation and position, from perfectly square to visibly
hand-placed. _(Craig's direction.)_ The offsets are stable per piece, so a
stack doesn't shuffle when something else moves.

### 6. Everything the board does

All of it works in 3D. What draws it differs.

**In the scene**, because it must sit under or among the pieces:

- Square highlights for the last move, selection, valid squares, the
  highlighter tool, flat-win squares, and engine suggestions.
- Road indication.
- The **last-move outline** (Highlight Last Move: Pieces), as a rim around
  the pieces that moved. _(From the prototype: each moved piece drawn again
  slightly larger, inside out and unlit.)_
- Selected pieces, lifted off their stack as in 2.5D.
- Coordinates on the frame.

**Pointer input** is resolved against the scene, not against flat squares:
tapping a tall stack selects that stack, not the square its top happens to
cover. Taps then go through the same store actions as today, so rules,
undo and keyboard handling are untouched. Unplayed pieces are tappable as
they are now.

**Layered over the canvas** with the 2.5D transform, as DOM, for the first
release _(my call)_:

- The header: flat counts, player names, clocks, komi and move number, using
  today's components.
- The analysis overlay's arrows and ghost pieces.
- Stack counts and the small in-board coordinates.

These line up exactly but aren't lit, and a tall stack near an edge can pass
behind them. Moving them into the scene is later work, not part of this.

Where today's component can't be reused as it is, a 3D-specific one is
written rather than bending the 2D one. Stack counts and small coordinates
are drawn inside the 2D piece and square today, next to the stone and click
handling that 3D replaces, and anything attached to a stack must sit at the
3D stack's real height, which differs from 2.5D's. The anti-goal about 2D and
2.5D is about their behavior and cost, not about leaving their files
untouched.

**The evaluation bar** is the fill of the unplayed-pieces panel, underneath
the pieces, so it is drawn in the scene as the panel's surface, not layered.

**Animation.** Pieces travel in arcs, as in `playtak-ui`, not in straight
lines _(Craig's direction)_:

- A moving piece goes steadily across the board while rising and falling
  along a parabola, higher for longer trips, and turns to its final
  orientation on the way. A placed piece arcs in from its reserve stack. In a
  stack move every carried piece leaves together and arcs to its own square.
- A capstone flattening a wall lands on it as the wall falls flat.
- Lifting pieces to select them, and setting them back, is a short straight
  move rather than an arc.
- Undoing or stepping back plays the same arcs in reverse.
- Durations follow the 2D board's transitions, so the three views keep pace
  with each other and with playback. `animateBoard` and `animateScrub` are
  honored; a new move arriving mid-flight sends pieces to their new places
  from wherever they are.

### 7. Sound

Pieces make a sound when they land _(Craig's direction)_: the "clack". It is
part of how a set feels, so it must be believable, not a stand-in.

**The sounds.** _(From the prototype.)_ There are seven, and one event built from two of them:

| Sound             | On the board | On a stack |
| ----------------- | ------------ | ---------- |
| A flat lands      | measured     | measured   |
| A capstone lands  | measured     | measured   |
| A wall lands      | derived      | derived    |
| A wall falls flat | (none)       | derived    |

**A wall flattened** is the capstone landing on a stack, followed 55 ms later
by the wall falling flat.

- **Board and stack are different sounds.** A piece set on bare board and a
  piece set on another piece measured differently enough to hear: on a stack
  it is brighter and taps a second time within 10 ms. _(My call to keep the
  distinction, accepted with the prototype.)_
- **Measured** means taken from Craig's clack-test recording of stone pieces
  on an oak table: for each third-octave band from 125 Hz to 12.7 kHz, how loud
  it is and how fast it dies, plus the times and levels of the after-taps as
  the piece rocks flat. **Derived** means built from the measured ones,
  because the recording has no wall: a wall is the flat's table shifted a
  band higher, shorter and quieter, with more chatter.
- The tables and after-taps are `MEASURED` and `PRESETS` in the prototype's
  `clack.js`. They are the specification; carry them over as they are.

**How a sound is made.** _(From the prototype. Each point fixed something
that was audibly or measurably wrong.)_

- Every sound is synthesized in the browser; no audio files are shipped.
- A landing is a few impacts: the first, then quieter after-taps over the
  next 40 ms. Each impact sets every band ringing at its measured level and
  lets it die at its measured rate, which for most bands is within 10 ms.
- Each band is about three resonances spread across it. One per band leaves
  peaks in the spectrum that the ear takes for a note.
- Every resonance starts from rest and swells over the contact time (about
  half a millisecond) before it dies. Starting at full strength adds a click
  that a real impact doesn't have.
- No two are alike: each gets its own resonances, and pitch and loudness
  wander a few percent. The after-taps' times wander too.
- A sound is computed once into a buffer when it is needed, well under a
  millisecond of work, and played at the moment of landing.

**When each plays.**

- A piece landing sounds at the moment it lands, timed from its arc. In 2D
  and 2.5D, which have no arc, it sounds as the piece's transition ends.
- "On a stack" is chosen when the square already holds a piece.
- In a stack move, each square the pieces are dropped on sounds once, in
  order, as each drop lands. In 2D and 2.5D, where the pieces all arrive
  together, the drops follow each other 90 ms apart. _(My call.)_
- A stack moved by taps on the board is set down by those taps, before the
  move is complete. Only its last landing sounds, when the move completes.
  _(My call. Sounding each drop as it is tapped is a later refinement.)_
- A move that arrives while eight or more landings are still to sound is
  silent, so a burst of moves after a reconnect doesn't rattle. _(My call.)_
- A capstone flattening a wall plays the flattened-wall sound in place of the
  capstone's own.

**The sound follows the texture** _(Craig's decision)_. A piece textured as
stone, wood or metal in the 3D view lands with that material's sound. In 2D
and 2.5D, and for a piece with no texture, it is the measured sound.

| The piece landing is               | Sound                              |
| ---------------------------------- | ---------------------------------- |
| in 2D or 2.5D, or untextured in 3D | The measured sound                 |
| stone, in 3D                       | The measured sound                 |
| wood, in 3D                        | Lower, duller, a softer contact    |
| metal, in 3D                       | Higher, brighter, a harder contact |

- Wood and metal are the measured sound altered, by the numbers in
  `MATERIALS` in the prototype's `clack.js`. They are guesses, accepted by
  ear with the prototype; a recording of each would be the way to improve
  them.
- The texture that counts is that of the piece that lands, which is its
  owner's: in a stack move a drop takes the texture of the piece on top of
  what is dropped. What it lands on doesn't change the sound beyond board or
  stack. _(My call.)_
- The sounds are built with the sound step, which plays the measured one
  everywhere until the textures step gives pieces a material.

**The setting** has three choices _(Craig's direction)_:

| Choice         | Plays on                                               |
| -------------- | ------------------------------------------------------ |
| **Off**        | Nothing.                                               |
| **Live games** | New moves arriving in a live online game, as an alert. |
| **Every move** | Any move made on the board, by anyone, in any game.    |

**Navigation is always silent.** Stepping, scrubbing, playback and jumping
through a game make no sound in any mode; only a move being made does.

- **Every move is the default.** _(My call. The clack is part of playing, a
  move is something the person just did or is waiting for, and the device's
  own volume governs it.)_
- The setting has a volume, is synced like other board settings, and applies
  in all three views. _(My calls.)_
- An embedded board is silent unless its URL asks for sound. _(My call: a
  page that embeds a game hasn't asked for noise.)_
- Browsers allow audio only after the user has touched the page; until then
  the board is silent, without error, and nothing is saved up to play later.

**Left out of this work** _(my call)_:

- **Tuning controls for users.** The app offers the three choices and a
  volume. The prototype stays the tuning tool.

### 8. Performance and quality

- **Render on demand.** A frame is drawn only when something changed: a
  move, a tilt, an animation, a resize. An idle board draws nothing.
- **One draw per shape and color.** All flats of a color are one instanced
  mesh, with a per-piece seed for uniqueness.
- **Quality** is a per-device setting, not synced: Low, Medium, High, and
  Auto. The tiers differ only in resolution (1×, 1.5×, 2× up to the
  screen's own), pattern detail, and shadow sharpness. _(From the
  prototype.)_ Auto starts at Medium and steps down or up from measured
  frame times.
- **Loading.** three.js and the scene code load only when 3D is first
  turned on, and the board shows the 2.5D view until they're ready.
- **Budget:** 60 fps at Medium on a current mid-range phone, including while
  pieces animate; no measurable change to load time or frame rate in 2D and
  2.5D.
- **Shadows in motion are the known risk.** The prototype never moved a piece,
  and the Soft rig is five shadow maps. If the budget isn't met while pieces
  move, shadows may be updated more coarsely or less often during the motion,
  and are redrawn in full the moment it ends. What gives way first is for the
  builder to measure on a phone in step 3. _(My call.)_

## Order of work

Each step leaves the app releasable.

1. **Views.** Offer today's tilted board as 2.5D and introduce the view
   choice, stored as in section 1. Until step 2 lands, choosing 3D shows the
   2.5D view.
2. **A static 3D board.** Scene, geometry, layout, camera and tilt parity,
   fit, translated themes without textures, light and shadow, the
   layered header and stack counts, lazy loading, WebGL fallback. Positions
   display in full; nothing is interactive.
3. **Play.** Pointer input, selection, square highlights, roads, the
   last-move outline, arced move animation, render on demand, quality tiers.
4. **Textures.** Stone, wood and metal, pattern and uniqueness, the light
   rig and the stacking setting, in a 3D section of Settings. Once sound is
   in, a textured piece takes its material's sound.
5. **Sound.** The synthesized sounds, from the sound prototype's tables, in
   all three materials; the setting; and their timing in all three views.
   This step doesn't depend on the 3D view and can be built at any point;
   until textures exist every piece makes the measured sound.
6. **The rest of the board.** The layered analysis overlay; board styles and
   rings; vertical layout; view transitions.

## Left to the builder

- Names: how the 2.5D choice is stored beside `board3D`, the 3D settings'
  keys, component and module names.
- How the scene code is split into modules, and how it reads board state. It
  must follow the project rule: read from Vuex output, change through Vuex
  actions, never touch a Game object.
- How three.js is bundled under this project's webpack 4 and Babel setup,
  including whatever transpiling its modern syntax needs.
- The exact shader code, noise functions and constants. The prototype's are
  a starting point, not a specification.
- The arc's exact height and timing curve, and the size of the selection
  lift. `playtak-ui`'s jump (`src/js/board.js`) is the reference for feel.
- How the sound code is organized and scheduled. What it computes is fixed by
  section 7 and the prototype's `clack.js`; a builder should check their
  version against the prototype's output, band by band.
- Auto quality's thresholds.
- How the scene is tested. Layout and theme translation should be plain
  functions that can be checked without a GPU.

## Decisions already made

By Craig:

- The cover render is inspiration, not a target. Faithful rendering of every
  theme, with configurable procedural textures, comes first.
- Neutral light; no warm tint.
- No new themes, and no change to what a theme is: textures and the light
  rig are 3D settings that apply to every theme.
- Anyone with 3D on today gets the new 3D view; no migration.
- Pieces move in arcs, as in `playtak-ui`.
- Synthesized sounds for placing a flat, a wall and a capstone, and for
  flattening a wall, playing on live-game moves only or on every move made,
  and never during navigation. They must be believable: the third pass of
  the sound prototype, measured from his recording, is the standard.
- A textured piece in 3D makes its texture's sound; everything else makes the
  measured one.
- From the 3D prototype: piece dimensions that match the 2D board from above,
  the 2D layout, the 2.5D tilt controls, a light centered above the board,
  and controls for pattern visibility, uniqueness, stacking and sheen.

Calls made in writing this up, each marked _(my call)_ above:

- The D hotkey toggles between 2D and the tilted view used last.
- The Embed dialog doesn't offer the view; a URL can still select it.
- At zero tilt the 2D board governs size and position; under tilt 3D fits its
  own layout and doesn't refit as stacks grow.
- The Soft rig is the default.
- The header, analysis overlay, stack counts and in-board coordinates are
  layered over the canvas as DOM for the first release.
- If the frame rate can't be held while pieces move, shadows give way during
  the motion.
- Sound is synced and applies in all three views.
- A piece landing on a stack sounds different from one landing on the board.
- Every move is the default sound choice; embeds are silent unless asked.
- In 2D and 2.5D a spread stack's drops sound 90 ms apart; a stack moved by
  taps sounds only its last landing.
- A landing takes the texture of the piece that lands, not of what it lands
  on.
- Users get no sound tuning controls.

Nothing is left open.
