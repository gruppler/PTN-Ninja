// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/game/result',
  'app/game/tps',
  'app/grammar',
  'i18n!nls/main',
  'lodash'
], function (Result, TPS, r, t, _) {

  var tag_icons = {
    'player1': 'player-solid',
    'player2': 'player-line',
    'date': 'date',
    'size': 'grid-line',
    'result': 'result',
    'event': 'event',
    'site': 'site',
    'round': 'round',
    'rating1': 'star-solid',
    'rating2': 'star-line',
    'tps': 'grid-solid',
    'points': 'points',
    'time': 'time',
    'clock': 'timer'
  };

  var Tag = function (string, game) {
    var parts = string.match(r.grammar.tag_grouped);

    this.text = string;

    if (!parts) {
      game.is_valid = false;
      this.print = game.print_invalid;
      game.m.error(t.error.invalid_tag({tag: _.truncate(string, {length: 5})}));
      return this;
    }

    this.prefix = parts[1];
    this.name = parts[2];
    this.separator = parts[3];
    this.q1 = parts[4];
    this.value = parts[5];
    this.q2 = parts[6];
    this.suffix = parts[7];

    this.key = this.name.toLowerCase();
    this.icon = tag_icons[this.key] || 'circle';

    if (!(this.key in r.tags)) {
      game.m.error(t.error.invalid_tag({tag: parts[2]}));
      game.is_valid = false;
      return false;
    }

    if (!r.tags[this.key].test(this.value) && this.key != 'tps') {
      game.is_valid = false;
      return false;
    }

    if (this.key == 'result' && this.value) {
      new Result(this.value, game);
      this.print_value = function () {
        return game.config.result.print_value();
      };
    } else if(this.key == 'tps') {
      game.config.tps = new TPS(this.value, game);
      this.print_value = _.bind(game.config.tps.print, game.config.tps);
    }else{
      game.config[this.key] = this.value;
    }

    return this;
  };

  Tag.prototype.print = _.template(
    '<span class="tag">'+
      '<%=this.prefix%>'+
      '<i class="icon-<%=this.icon%>"></i>'+
      '<span class="name"><%=this.name%></span>'+
      '<%=this.separator%>'+
      '<span class="opening quote"><%=this.q1%></span>'+
      '<span class="value <%=this.q1 ? this.key : ""%>">'+
        '<%=this.print_value()%>'+
      '</span>'+
      '<span class="closing quote"><%=this.q2%></span>'+
      '<%=this.suffix%>'+
    '</span>'
  );

  Tag.prototype.print_value = function () {
    return ''+this.value;
  };

  Tag.prototype.print_text = function () {
    return this.text;
  };

  return Tag;

});
