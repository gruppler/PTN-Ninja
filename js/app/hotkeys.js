// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([], function () {

  return {

    // Global
    global: {

      'Escape': function (event, $focus, $parent) {
        app.menu.toggle();
        event.preventDefault();
        event.stopPropagation();
      },

      '^Spacebar': function (event, $focus, $parent) {
        app.$fab.click();
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

      '^?': function (event, $focus, $parent) {
        app.game.parse(app.sample_ptn, true);
      }

    },

    // Menu Mode
    menu: {

    },

    // Edit Mode
    edit: {

      '^z': function (event, $focus, $parent) {
        app.undo(event);
      },

      '^Z': function (event, $focus, $parent) {
        app.redo(event);
      },

      '^%t': function (event, $focus, $parent) {
        app.board.trim_to_current_ply();
      },

      '[': function (event, $focus, $parent) {
        app.insert_text(']');
      },

      '"': function (event, $focus, $parent) {
        if (!$focus.closest('.ply').length) {
          app.insert_text('"');
        }
      },

      '\'': function (event, $focus, $parent) {
        if (!$focus.closest('.ply').length) {
          app.insert_text('\'');
        }
      },

      '{': function (event, $focus, $parent) {
        if ($focus.closest('.body').length) {
          app.insert_text('}');
        }
      },

      'Tab': function (event, $focus, $parent) {
        event.stopPropagation();
        event.preventDefault();

        app.insert_text('\t', true);
      },

      'Enter': function (event, $focus, $parent) {
        var $prev = $focus.prev('.move')
          , move;

        if (!$prev.length) {
          $prev = $parent.prev('.move');
        }

        if (!$prev.length) {
          $prev = $focus.closest('.invalid');
          if ($prev.length) {
            $prev = $prev.prev('.move');
          }
          if (!$prev.length) {
            $prev = $prev.closest('.move');
          }
        }

        if ($prev.length) {
          move = app.game.moves[$prev.data('id') - 1];
          if (move.ply2) {
            app.insert_text((1*$prev.data('id') + 1) + '.' + move.ply1.prefix, true);
          }
        }
      }

    },


    // Play Mode
    play: {

      'Spacebar': function (event, $focus, $parent) {
        app.board.playpause(event);
      },

      'ArrowLeft': function (event, $focus, $parent) {
        app.board.prev(event);
      },

      'ArrowRight': function (event, $focus, $parent) {
        app.board.next(event);
      },

      '^ArrowLeft': function (event, $focus, $parent) {
        app.board.first(event);
      },

      '^ArrowRight': function (event, $focus, $parent) {
        app.board.last(event);
      },

      'ArrowDown': function (event, $focus, $parent) {
        app.board.next_move(event);
      },

      'ArrowUp': function (event, $focus, $parent) {
        app.board.prev_move(event);
      },

      'a': function (event, $focus, $parent) {
        app.toggle_annotations();
      }

    }

  };
});
