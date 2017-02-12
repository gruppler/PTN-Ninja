// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/messages'], function (Messages) {

  var m = new Messages('global');

  function notify_toggle(property, status) {
    return m.info(property+': <strong>'+(status ? t.On : t.Off)+'</strong>', 1.5);
  }

  function select_option(option) {
    app.$body.find('[data-option='+option+']:visible:first').click();
  }

  return {

    // Global
    global: {

      'Escape': function (event, $focus, $parent) {
        if (app.board.selected_pieces.length) {
          app.board.deselect_all();
        } else {
          app.menu.toggle();
        }

        event.preventDefault();
        event.stopPropagation();
      },

      '^Spacebar': function (event, $focus, $parent) {
        app.toggle_edit_mode();
        event.preventDefault();
        event.stopPropagation();
      },

      '^s': function (event, $focus, $parent) {
        app.$download.click();
        event.preventDefault();
        event.stopPropagation();
      },

      '^o': function (event, $focus, $parent) {
        app.$open.click();
        event.preventDefault();
        event.stopPropagation();
      },

      '^d': function (event, $focus, $parent) {
        app.game.parse(app.default_ptn, true);
        event.preventDefault();
        event.stopPropagation();
      },

      '^z': function (event) {
        app.undo(event);
        event.preventDefault();
        event.stopPropagation();
      },

      '^Z': function (event) {
        app.redo(event);
        event.preventDefault();
        event.stopPropagation();
      },

      '^y': function (event) {
        app.redo(event);
        event.preventDefault();
        event.stopPropagation();
      },

      '^?': function (event, $focus, $parent) {
        app.about();
        event.preventDefault();
        event.stopPropagation();
      }

    },

    // Edit Mode
    edit: {

      '^C': function (event, $focus, $parent) {
        app.board.trim_to_current_ply();
        event.stopPropagation();
        event.preventDefault();
      },

      '[': function (event, $focus, $parent) {
        app.insert_text(']');
        event.preventDefault();
        event.stopPropagation();
      },

      '"': function (event, $focus, $parent) {
        if (!$focus.closest('.ply').length) {
          app.insert_text('"');
          event.preventDefault();
          event.stopPropagation();
        }
      },

      '\'': function (event, $focus, $parent) {
        if (!$focus.closest('.ply').length) {
          app.insert_text('\'');
          event.preventDefault();
          event.stopPropagation();
        }
      },

      '{': function (event, $focus, $parent) {
        if ($focus.closest('.body').length) {
          app.insert_text('}');
          event.preventDefault();
          event.stopPropagation();
        }
      },

      'Tab': function (event, $focus, $parent) {
        app.insert_text('\t', true);
        event.stopPropagation();
        event.preventDefault();
      },

      'Enter': function (event, $focus, $parent) {
        var $move = $parent.parent('.move')
          , move;

        if (app.game.moves.length) {
          if ($move.length && $parent.is(':last-child')) {
            move = app.game.moves[$move.data('index')] || app.game.moves[0];
          } else if ($parent.hasClass('body')) {
            move = _.last(app.game.moves);
          }

          if (
            move && (
              move.ply2
              || move.ply1 && move.ply1.turn == 2 - (move.linenum.value == 1)
            )
          ) {
            app.insert_text((move.linenum.value + 1)+'.'+move.ply1.prefix, true);
          }
        }
      }

    },


    // Play Mode
    play: {

      'Spacebar': function (event, $focus, $parent) {
        app.board.playpause(event);
        event.preventDefault();
        event.stopPropagation();
      },

      'ArrowLeft': function (event, $focus, $parent) {
        app.board.prev_ply(event);
        event.preventDefault();
        event.stopPropagation();
      },

      'ArrowRight': function (event, $focus, $parent) {
        app.board.next_ply(event);
        event.preventDefault();
        event.stopPropagation();
      },

      '+ArrowLeft': function (event, $focus, $parent) {
        app.board.prev(event);
        event.preventDefault();
        event.stopPropagation();
      },

      '+ArrowRight': function (event, $focus, $parent) {
        app.board.next(event);
        event.preventDefault();
        event.stopPropagation();
      },

      '^ArrowLeft': function (event, $focus, $parent) {
        app.board.first(event);
        event.preventDefault();
        event.stopPropagation();
      },

      '^ArrowRight': function (event, $focus, $parent) {
        app.board.last(event);
        event.preventDefault();
        event.stopPropagation();
      },

      'ArrowDown': function (event, $focus, $parent) {
        app.board.next_move(event);
        event.preventDefault();
        event.stopPropagation();
      },

      'ArrowUp': function (event, $focus, $parent) {
        app.board.prev_move(event);
        event.preventDefault();
        event.stopPropagation();
      },

      'd': function (event, $focus, $parent) {
        app.config.toggle('board_3d');
        notify_toggle(t.Board_3D, app.config.board_3d);
        event.preventDefault();
        event.stopPropagation();
      },

      'A': function (event, $focus, $parent) {
        app.config.toggle('animate_board');
        notify_toggle(t.Animate_Board, app.config.animate_board);
        event.preventDefault();
        event.stopPropagation();
      },

      'F': function (event, $focus, $parent) {
        app.config.toggle('show_fab');
        notify_toggle(t.Show_FAB, app.config.show_fab);
        event.preventDefault();
        event.stopPropagation();
      },

      'a': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('annotations', mode);
        notify_toggle(t.Annotations, app.config[mode].annotations);
        event.preventDefault();
        event.stopPropagation();
      },

      's': function (event, $focus, $parent) {
        app.config.toggle('board_shadows');
        notify_toggle(t.Board_Shadows, app.config.board_shadows);
        event.preventDefault();
        event.stopPropagation();
      },

      'c': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('show_play_controls', mode);
        notify_toggle(t.Play_Controls, app.config[mode].show_play_controls);
        event.preventDefault();
        event.stopPropagation();
      },

      'h': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('square_hl', mode);
        notify_toggle(t.Square_Highlights, app.config[mode].square_hl);
        event.preventDefault();
        event.stopPropagation();
      },

      'r': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('show_roads', mode);
        notify_toggle(t.Road_Connections, app.config[mode].show_roads);
        event.preventDefault();
        event.stopPropagation();
      },

      'f': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('show_flat_counts', mode);
        notify_toggle(t.Flat_Counts, app.config[mode].show_flat_counts);
        event.preventDefault();
        event.stopPropagation();
      },

      'm': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('show_current_move', mode);
        notify_toggle(t.Current_Move, app.config[mode].show_current_move);
        event.preventDefault();
        event.stopPropagation();
      },

        'u': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('show_unplayed_pieces', mode);
        notify_toggle(t.Unplayed_Pieces, app.config[mode].show_unplayed_pieces);
        event.preventDefault();
        event.stopPropagation();
      },

      'x': function (event, $focus, $parent) {
        var mode = app.game.is_editing ? 'edit' : 'play';
        app.config.toggle('show_axis_labels', mode);
        notify_toggle(t.Axis_Labels, app.config[mode].show_axis_labels);
        event.preventDefault();
        event.stopPropagation();
      },

      0: _.wrap(0, select_option),
      1: _.wrap(1, select_option),
      2: _.wrap(2, select_option),
      3: _.wrap(3, select_option),
      4: _.wrap(4, select_option),
      5: _.wrap(5, select_option),
      6: _.wrap(6, select_option),
      7: _.wrap(7, select_option),
      8: _.wrap(8, select_option),
      9: _.wrap(9, select_option)

    }

  };
});
