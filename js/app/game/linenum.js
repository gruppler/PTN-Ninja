// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'i18n!nls/main', 'lodash'], function (r, t, _) {

  var Linenum = function (string, game) {
    var parts = string.match(r.grammar.linenum_grouped);

    this.game = game;
    this.prefix = parts[1];
    this.value = game.get_linenum();
    this.text = this.value + '.';

    this.char_index = game.char_index;
    game.char_index += this.prefix.length + this.text.length;

    if (
      string.length != this.prefix.length + this.text.length
      && app.range.last_bounds && app.range.last_bounds[1] >= game.char_index - 1
    ) {
      app.range.last_bounds[0] += this.text.length - string.length;
      app.range.last_bounds[1] = app.range.last_bounds[0];
      game.caret_moved = true;
    }

    return this;
  };

  Linenum.prototype.print = _.template(
    '<span class="space"><%=this.prefix%></span>'+
    '<span class="linenum"><%=this.text%></span>'
  );

  Linenum.prototype.print_text = function (update_char_index) {
    var text = this.prefix + this.text;

    if (update_char_index) {
      this.char_index = this.game.char_index;
      this.game.char_index += text.length;
    }

    return text;
  };

  return Linenum;

});
