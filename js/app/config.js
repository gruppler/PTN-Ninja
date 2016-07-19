// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['lodash'], function (_) {

  var config = {

    defaults: {
      play_speed: 40,
      show_parse_errors: false,
      show_annotations: true
    },

    set: function (key, value) {
      this[key] = value;
      localStorage[key] = JSON.stringify(value);
    },

    load: function () {
      var key, stored;

      for (var key in this.defaults) {
        stored = localStorage[key];
        this[key] = stored ? JSON.parse(stored) : this.defaults[key];
      }
    }

  };

  config.load();

  return config;

});
