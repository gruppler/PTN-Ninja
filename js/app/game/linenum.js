// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'i18n!nls/main', 'lodash'], function (r, t, _) {

  var Linenum = function (string, game) {
    var parts = string.match(r.grammar.linenum_grouped);

    this.prefix = parts[1];
    this.value = game.get_linenum();
    this.text = ''+this.value + '.';

    return this;
  };

  Linenum.prototype.print = _.template(
    '<%=this.prefix%>'+
    '<span class="linenum"><%=this.text%></span>'
  );

  Linenum.prototype.print_text = function () {
    return this.prefix + this.text;
  };

  return Linenum;

});
