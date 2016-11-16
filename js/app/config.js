// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['lodash'], function (_) {

  var callbacks = {};

  var config = {

    presets: {
      minimal: {
        show_axis_labels: false,
        show_player_scores: false,
        show_current_move: false,
        show_unplayed_pieces: false,
        show_play_controls: false
      },
      edit_mode: {
        square_hl: true,
        show_roads: true,
        show_axis_labels: true,
        show_player_scores: true,
        show_current_move: false,
        show_unplayed_pieces: false,
        show_play_controls: false
      },
      full: {
        square_hl: true,
        show_roads: true,
        show_axis_labels: true,
        show_player_scores: true,
        show_current_move: true,
        show_unplayed_pieces: true,
        show_play_controls: true
      }
    },

    defaults: {
      edit: {
        board_opacity: 50,
        show_parse_errors: true
      },

      play: {
        speed: 60, // BPM
        show_annotations: true
      },

      // Board
      board_rotation: [0, 0, 0],
      board_max_angle: 30,
      board_rotate_sensitivity: 3,
      board_3d: false,
      animate_board: true,
      show_fab: true
    },

    toggle: function (prop, mode, initiator) {
      this.set(
        prop,
        mode ? !this[mode][prop] : !this[prop],
        mode,
        initiator
      );
    },

    set: function (prop, value, mode, initiator) {
      var is_first_change;

      if (mode) {
        is_first_change = _.isUndefined(localStorage[mode+'.'+prop]);
        this[mode][prop] = value;
        localStorage[mode+'.'+prop] = JSON.stringify(value);
      } else {
        is_first_change = _.isUndefined(localStorage[prop]);
        this[prop] = value;
        localStorage[prop] = JSON.stringify(value);
      }

      this.on_change(prop, null, mode, initiator, is_first_change);
    },

    set_css_flag: function (prop, value) {
      if (app.$html && _.isBoolean(value)) {
        if (value) {
          app.$html.addClass(prop.replace(/_/g, '-'));
        } else {
          app.$html.removeClass(prop.replace(/_/g, '-'));
        }
      }
    },

    update_flags: function () {
      var prop, value;

      for (prop in this[app.mode]) {
        value = this[app.mode][prop];
        this.set_css_flag(prop, value);
      }
    },

    load_preset: function (preset, mode, silent) {
      _.assignIn(this[mode], this.presets[preset]);
      if (!silent && mode == app.mode) {
        this.update_flags();
      }
    },

    load: function () {
      var i = 0, prop, stored, mode;

      _.assignIn(this, this.defaults);
      config.load_preset('edit_mode', 'edit', true);
      config.load_preset('full', 'play', true);

      while (prop = localStorage.key(i++)) {
        stored = localStorage[prop];
        mode = prop.match(/(\w+)\./);
        if (mode) {
          mode = mode[1];
          prop = prop.substr(mode.length + 1);
        }
        this.set(prop, JSON.parse(stored), mode);
      }
    },

    on_change: function (prop, fn, mode, initiator, is_first_change) {
      var value, i;

      function _listen(prop) {
        if (!(prop in callbacks)) {
          callbacks[prop] = [fn];
        } else {
          callbacks[prop].push(fn);
        }
      }

      if (_.isFunction(fn)) {
        if (_.isArray(prop)) {
          _.each(prop, _listen);
        } else {
          _listen(prop);
        }
      } else {
        value = mode ? this[mode][prop] : this[prop];

        // Update CSS flags when any config changes
        if (!mode || mode == app.mode) {
          this.set_css_flag(prop, value);
        }

        if (prop in callbacks) {
          for (i = 0; i < callbacks[prop].length; i++) {
            callbacks[prop][i].call(
              this,
              value,
              prop,
              mode,
              initiator,
              is_first_change
            );
          }
        }
      }

      return this;
    }

  };

  config.load();

  return config;

});
