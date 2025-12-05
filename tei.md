# Description of the Tak Engine Interface (TEI)

- All communication is done via standard input and output with text commands.

- The engine should boot and wait for input from the UI.

- The engine should wait for the `isready` or `setoption` command to set up its internal parameters
  as the boot process should be as quick as possible.

- The engine must always be able to process input from stdin, even while thinking.

- All command strings the engine receives will end with `\n`,
  and all commands the UI receives should end with `\n`.
  Note that `\n` can be `0x0c` or `0x0a0c` or any combination depending on your OS.

- The engine should never do anything it isn't explicitly told to do.

- Any excessively late replies may result in your engine process being terminated.

- Before the engine is told to search on a position, there will always be a `position` command
  to tell the engine about the current position.

- The UI will never direct the engine to search a position for which there are no legal moves.

- If the engine or the UI receives an unknown command or token, it should just ignore it and try to
  parse the rest of the command string.

- If the engine receives a command which is not supposed to come, for example `stop` when the engine is
  not calculating, it should just ignore it.

## Move format

The move format is in [Portable Tak Notation (PTN)](https://ustak.org/portable-tak-notation/).

## UI to engine

- `tei`:
  Tell the engine to use the TEI (Tak Engine Interface).
  This will be sent once as a first command after program boot
  to tell the engine to switch to TEI mode.
  After receiving the `tei` command the engine must identify itself with the `id` command
  and sent the "option" commands to tell the UI which engine settings the engine supports if any.
  After that the engine should sent `teiok` to acknowledge the TEI mode.

- `isready`:
  This is used to synchronize the engine with the UI.
  This command is required immediately after all `setoption` commands have been sent.
  The engine should not initialize memory or anything else slow or resource-intensive until the first
  `isready` has been received.
  This command must always be answered with `readyok` and can be sent also when the engine is searching,
  in which case the engine should also immediately answer with `readyok` without stopping the search.

- `setoption name <name> [value <value>]`:
  This is sent to the engine when the user wants to change the internal parameters
  of the engine.
  This must never be sent while the engine is searching.
  One command string will be sent for each parameter while the engine is waiting.
  The `name` and `value` of the option should be case-insensitive and can inlude spaces.
  The substrings "name" and "value" must be avoided to allow unambiguous parsing.
  For the `button` type, no value is needed.

- `teinewgame size <size> [halfkomi <halfkomi>]`:
  This is sent to the engine to set the board size, and optionally the half-komi value (default zero).
  It is also sent when the next search will be from a different game,
  so all memory related to search/eval/etc should be cleared.
  Since the engine's reaction to `teinewgame` can take some time, the UI should always send `isready`
  after `teinewgame` to wait for the engine to finish its operation.

- `position (tps <tps>|startpos) [moves <moves>...]`:
  Set the position described in [TPS](https://ustak.org/tak-positional-system-tps/), and play the moves if provided.
  If the game was played from the start position, the `startpos` may be used instead of TPS.

- `go`:
  Start searching on the current position set up with the `position` command.
  Given without parameters, assume `infinite`.
  One or more of the following parameters may immediately follow the `go` command:

  - `wtime <n>`:
    Milliseconds left on the clock for White, where n > 0.
  - `btime <n>`:
    Milliseconds left on the clock for Black, where n > 0.
  - `winc <n>`:
    White's increment per move in milliseconds.
  - `binc <n>`:
    Black's increment per move in milliseconds.
  - `movestogo <n>`:
    There are `<n>` moves to the next time control.
  - `depth <n>`:
    Search only `<n>` plies deep, where n > 0.
  - `nodes <n>`:
    Search only `<n>` nodes, where n > 0.
  - `movetime <n>`:
    Search until `<n>` milliseconds have passed, where n > 0.
  - `solved`:
    Search for a definite win.
  - `infinite`:
    Search until the `stop` command is received, or until naturally forced to stop by algorithmic
    or implementation limitations. This causes all other `go` parameters to be ignored.

- `stop`:
  Stop searching as soon as possible.

## Engine to UI

- `id`

  - `name <name>`:
    This must be sent after receiving the `tei` command to identify the engine's name.
  - `author <author>`:
    This must be sent after receiving the `tei` command to identify the engine's author.
  - `version <version>`:
    This may be sent after receiving the `tei` command to identify the engine's version.

- `size <size>... halfkomi <halfkomi>...`:
  This must be sent to tell the UI which board sizes and corresponding half-komi values are supported.
  Multiple sizes may be included in a single command string if their half-komi values are the same.
  The client should assume TEI version >= 1 after receiving this command.

- `teiok`:
  This must be sent after the `id`, `size`, and optional `options` to tell the UI that
  the engine has sent all info and is ready in tei mode.

- `readyok`:
  This must be sent when the engine has received an `isready` command, has
  processed all `setoption` input, and is ready to accept new commands now.
  It can be sent any time, even while the engine is searching, in response to `isready`.

- `bestmove <move>`:
  The engine has stopped searching and found `<move>` to be best in this position.
  This command must always be sent if the engine stops searching, so for every `go` command,
  a `bestmove` command is needed!
  If no move is found, `--` may be sent instead.
  Directly before that, the engine must send a final `info` command with the final search information,
  so the UI has the complete statistics about the last search.

- `info`:
  Send search information to the UI.
  This should be done whenever the information has changed, or at regular intervals.
  The engine can send any of the following types of information:

  - `depth <n>`:
    Search depth in plies.
  - `seldepth <n>`:
    Selective search depth in plies.
    If the engine sends `seldepth`, there must also be a `depth` present in the same command string.
  - `time <n>`:
    The time searched in milliseconds.
  - `nodes <n>`:
    The total number of nodes searched since the last `go` command.
  - `hashfull <n>`:
    How full the hash table is in parts per thousand.
  - `pv <moves>`
    The best line found.
  - `multipv <n> <moves>`:
    When sending multiple variations, include `multipv 1` in the command string to identify the pv,
    `multipv 2` for the next best variation, and so on, within the same command string.
  - `wdl <winchance> <drawchance> <losschance>`:
    The win/draw/lose probabilities [0, 1000] from the engine's perspective.
  - `score`
    - `cp <score>`:
      The score from the engine's point of view. The score is represented in centipieces,
      or hundreths of a flat stone.
    - `solved (win|loss|draw) <n>`:
      The position has been solved as a win/loss/draw, and the shortest forcing line found
      (so far) is <n> plies long.
    - `lowerbound`:
      The score is just a lower bound.
    - `upperbound`:
      The score is just an upper bound.
  - `nps <n>`:
    Number of nodes per second searched.
  - `string <text>`:
    Any text which will be displayed by the UI.
    After `string`, the rest of the line will be interpreted as part of that text.
  - `error <text>`:
    Any text which will be displayed by the UI as an error message.
    After `error`, the rest of the line will be interpreted as part of that text.

- `option`:
  This command tells the UI which parameters can be changed in the engine.
  This should be sent once at engine startup after the `tei` and the `id` commands,
  if any parameter can be changed in the engine.
  The UI should parse this and build a form for the user to change the settings.
  If the user wants to change an option, the UI will send a `setoption` command to the engine.
  Note that the UI need not send the `setoption` command when starting the engine for every option if
  it doesn't want to change the default value.
  One command string will be sent for each parameter.
  - `name <name>`:
    The label for the option, displayed in the UI. This may contain spaces. It should be case-insensitive.
  - `type <type>`:
    The data type of the option, to inform the UI how it should be represented in the form.
    There are five different types of options the engine can send:
    - `check`:
      A checkbox that can either be `true` or `false`.
    - `spin`:
      An integer whose bounds may be defined by `min` and `max`.
    - `combo`:
      A select list whose options are defined by `var`.
    - `button`:
      A button that can be pressed to send a command to the engine.
      When clicked, the name of the button will be sent in a `setoption` command string without a `value`.
    - `string`:
      A text field.
  - `default <value>`:
    The default value of the parameter.
  - `min`:
    The minimum value of the parameter.
  - `max`:
    The maximum value of the parameter.
  - `var`:
    A predefined value of the parameter.
    A value may contain spaces, so the string "var" should be avoided.

## Example

Here is an example exchange between the UI (denoted by `>>`) and the engine (denoted by `<<`):

```tei
>> tei

<< id name Tak Bot
<< id author James Ernest
<< id version 1.0.0
<< size 5 halfkomi 0 2 4 6 8
<< size 6 7 halfkomi 0 1 2 3 4 5
<< option name Model Path type string default ./path/to/model.ot
<< option name Strength type spin default default 10 min 1 max 10
<< option name Opening type combo default Swap var No Swap var Swap
<< option name Debug type check default false
<< option name Reset type button
<< teiok

>> setoption name model path value /home/user/takbot/model.ot
>> setoption name debug value true
>> isready

<< readyok

>> teinewgame size 6 komi 4
>> position startpos
>> isready

<< readyok

>> go movetime 1000

<< info depth 1 time 0 nodes 37 nps 484204 score win 19 pv a1
<< info depth 2 time 0 nodes 144 nps 1205354 score win 19 pv a1 b1
<< info depth 3 time 0 nodes 4428 nps 5474101 score win 21 pv a1 c3 a3
<< info depth 4 time 1 nodes 7942 nps 5607850 score win 19 pv a1 c3 a3 b1
<< info depth 5 time 7 nodes 28642 nps 4026227 score win 21 pv a1 c3 a3 c1 b3
<< info depth 6 time 51 nodes 360341 nps 7013502 score win 21 pv a1 f4 f1 a2 f2 Cf3
<< info depth 7 time 257 nodes 1770530 nps 6881820 score win 21 pv a1 f4 f1 a2 f2 Cf3 e2
<< info depth 8 time 1001 nodes 6415230 nps 6407727 score win 21 pv a1 f4 b4 b1 f1 b2 f2 c2
<< bestmove a1

>> position startpos moves f1 e1 e3 Cd3 f3 e2 f2 d2 f4 c3 f5 b3 e3- d2> Ce3 Se4 e3- e4> e4 d4 e5 d5 2e2+ d4> d4 d3+ d2 b2 b1 a1 a2 d6 c1 c4 a2- b2- b2 b3- 2a1> Sa1 3b1+ a1>
>> go infinite

<< info depth 1 time 0 nodes 140 nps 1096371 score cp 35 pv 5b2+14 c2 d1 a1 a2 b2 b3-
<< info depth 2 time 0 nodes 924 nps 2443901 score cp 35 pv 5b2+14 c2 d1 a1 a2 b2 b3-
<< info depth 3 time 2 nodes 9506 nps 4637354 score cp 77 pv c2 2b1+ d2> 5b2>113 b1 a1
<< info depth 4 time 5 nodes 25974 nps 4757455 score cp 61 pv 4b2< 2b1+ c2 c3- a1 b1
<< info depth 5 time 32 nodes 183871 nps 5576528 score cp 61 pv 4b2< 2b1+ c2 c3- a1 b1
<< info depth 6 time 115 nodes 545550 nps 4723946 score cp 35 pv 5b2+14 b2 c2 a2 d3 a1 a3
<< info depth 7 time 1840 nodes 8384916 nps 4554706 score cp 47 pv 4b2< 2b1+ b1 3b2< a1 6a2>1113 2d2<11
<< info depth 8 time 3514 nodes 16037621 nps 4562717 score cp 29 pv 4b2> 2b1+ 4c2+ c4- 2e3<11 c4 2c3> c2
<< info depth 9 time 10039 nodes 45861226 nps 4567918 score cp 33 pv 4b2> 2b1+ 4c2+ c4- 2e3<11 a4 2c3> c4 b3
<< info depth 10 time 17056 nodes 78508856 nps 4602960 score cp 29 pv 4b2> 2b1+ 4c2+ c4- 2e3<11 c4 d1 b1 e6 b4

>> stop

<< info depth 11 time 23809 nodes 113008102 nps 4746304 score cp 29 pv 4b2> 2b1+ 4c2+ c4- 2e3<11 a3 b1 a1 a2 b3 c2
<< bestmove 4b2>
```
