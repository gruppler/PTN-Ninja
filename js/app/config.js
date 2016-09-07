// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['lodash'], function (_) {

  var callbacks = {};

  var config = {

    defaults: {
      // Edit Mode
      editmode_square_hl: true,
      show_parse_errors: true,
      board_opacity: 50,

      // Play Mode
      playmode_square_hl: true,
      show_annotations: true,
      play_speed: 40, // BPM

      // Board
      animate_pieces: true,
      show_axis_labels: true,
      show_player_scores: true,
      show_current_move: true,
      show_unplayed_pieces: true,
      show_play_controls: true,
      show_roads: true
    },

    toggle: function (prop) {
      this.set(prop, !this[prop]);
    },

    set: function (prop, value, initiator) {
      this[prop] = value;
      localStorage[prop] = JSON.stringify(value);

      if (app.$html && _.isBoolean(value)) {
        if (value) {
          app.$html.addClass(prop.replace(/_/g, '-'));
        } else {
          app.$html.removeClass(prop.replace(/_/g, '-'));
        }
      }

      this.on_change(prop, null, initiator);
    },

    load: function () {
      var prop, stored;

      for (var prop in this.defaults) {
        stored = localStorage[prop];
        if (stored) {
          this.set(prop, JSON.parse(stored));
        } else {
          this[prop] = this.defaults[prop];
        }
      }
    },

    on_change: function (prop, fn, initiator) {
      if (_.isFunction(fn)) {
        if (!(prop in callbacks)) {
          callbacks[prop] = [fn];
        } else {
          callbacks[prop].push(fn);
        }
      } else {
        _.invokeMap(callbacks[prop], 'call', config, config[prop], prop, initiator);
      }

      return this;
    }

  };

  config.load();

  return config;

});
