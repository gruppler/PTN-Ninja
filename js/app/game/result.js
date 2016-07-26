// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'i18n!nls/main', 'lodash'], function (r, t, _) {

  var result_label = {
    '0': 'loss',
    '1': 'win',
    'F': 'flat win',
    'R': 'road win',
    '1/2': 'draw'
  };

  var Result = function (string, game) {
    var parts = string.match(r.grammar.result_grouped);

    game.config.result = this;

    if (!string.length) {
      this.print = function () {
        return '';
      };

      return false;
    }

    this.prefix = parts[1];
    this.text = parts[2];
    parts = this.text.split('-');
    this.player1 = parts[0];
    this.player2 = parts[1];

    if (this.player2 == '0') {
      this.victor = 1;
      this.message = t.result[this.player1]({ player: game.config.player1 });
    } else if (this.player1 == '0') {
      this.victor = 2;
      this.message = t.result[this.player2]({ player: game.config.player2 });
    } else {
      this.victor = 2;
      this.message = t.result.tie;
    }

    this.player1_label = result_label[this.player1];
    this.player2_label = result_label[this.player2];

    return this;
  }

  Result.prototype.print_value = _.template(
    '<span class="result">'+
      '<span class="player1 <%=this.player1_label%>">'+
        '<%=this.player1%>'+
      '</span>'+
      '-'+
      '<span class="player2 <%=this.player2_label%>">'+
        '<%=this.player2%>'+
      '</span>'+
    '</span>'
  );

  Result.prototype.print = function () {
    return this.prefix + this.print_value();
  };

  Result.prototype.print_text = function () {
    return this.prefix + this.text;
  };

  return Result;

});
