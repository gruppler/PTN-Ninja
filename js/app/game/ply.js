// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'i18n!nls/main', 'lodash'], function (r, t, _) {

  var Ply = function (string, player, game, move) {
    var ply_group = string.match(r.grammar.ply_grouped)
      , parts;

    this.move = move;

    this.is_nop = false;
    this.is_illegal = false;

    if (!ply_group) {
      this.is_nop = true;
      this.print = this.print_nop;
      this.player = player;

      ply_group = string.match(r.grammar.nop_grouped)
      this.prefix = ply_group[1];
      this.text = ply_group[2];

      if (!game.config.tps || game.config.tps.player == 1) {
        game.m.error(t.error.invalid_ply({ply: this.text}));
        this.is_illegal = true;
        this.text = this.prefix + this.text;
        this.print = game.print_invalid;
      }

      return this;
    }

    this.prefix = ply_group[1];

    if (ply_group[2]) {

      // Slide
      parts = ply_group[2].match(r.grammar.slide_grouped);
      this.print = this.print_slide;
      this.is_slide = true;
      this.player = player;
      this.text = ply_group[2];
      this.count_text = parts[1] || '';
      this.count = 1*this.count_text || 1;
      this.col = parts[2][0];
      this.row = parts[2][1]*1;
      this.square = this.col+this.row;
      this.squares = [];
      this.direction = parts[3];
      this.drops_text = parts[4] || '',
      this.drops = parts[4] ? parts[4].split('').map(_.toInteger) : [this.count];
      this.flattens = {};
      this.stone_text = parts[5] || '';
      this.evaluation = ply_group[4] || '';
      if (_.sum(this.drops) != this.count) {
        game.m.error(t.error.invalid_ply({ply: this.text}));
        this.is_illegal = true;
      }
    } else if (ply_group[3]) {

      // Place
      parts = ply_group[3].match(r.grammar.place_grouped);
      this.print = this.print_place;
      this.is_slide = false;
      this.player = player;
      this.text = ply_group[3];
      this.stone_text = parts[1] || '';
      this.stone = this.stone_text || 'F';
      this.true_stone = this.stone == 'C' ? this.stone : 'F';
      this.col = parts[2][0];
      this.row = parts[2][1]*1;
      this.square = this.col+this.row;
      this.squares = [];
      this.evaluation = ply_group[4] || '';
    }

    if (!this.player) {
      game.is_valid = false;
      this.is_illegal = true;
      this.text = string;
      this.print = game.print_invalid;
      game.m.error(t.error.invalid_movetext({text: _.trim(string)[0]}));
      return this;
    }

    if (
      this.row > game.config.size ||
      (this.col.charCodeAt(0) - '`'.charCodeAt(0)) > game.config.size
    ) {
      game.is_valid = false;
      game.m.error(t.error.invalid_square({square: this.col+this.row}));
      this.is_illegal = true;
    }

    return this;
  };

  Ply.prototype.print_place = _.template(
    '<span class="space"><%=this.prefix%></span>'+
    '<span class="ply player<%=this.player%><%=this.is_illegal ? " illegal" : ""%>" data-id="<%=this.id%>">'+
      '<% if (this.stone_text) { %>'+
        '<span class="stone"><%=this.stone_text%></span>'+
      '<% } %>'+
      '<span class="column"><%=this.col%></span>'+
      '<span class="row"><%=this.row%></span>'+
      '<% if (this.evaluation) { %>'+
        '<span class="evaluation"><%=this.evaluation%></span>'+
      '<% } %>'+
    '</span>'
  );

  Ply.prototype.print_slide = _.template(
    '<span class="space"><%=this.prefix%></span>'+
    '<span class="ply player<%=this.player%><%=this.is_illegal ? " illegal" : ""%>" data-id="<%=this.id%>">'+
      '<span class="count_text"><%=this.count_text%></span>'+
      '<span class="column"><%=this.col%></span>'+
      '<span class="row"><%=this.row%></span>'+
      '<span class="direction"><%=this.direction%></span>'+
      '<% if (this.drops_text) { %>'+
        '<span class="drops"><%=this.drops_text%></span>'+
      '<% } %>'+
      '<% if (this.stone_text) { %>'+
        '<span class="stone"><%=this.stone_text%></span>'+
      '<% } %>'+
      '<% if (this.evaluation) { %>'+
        '<span class="evaluation"><%=this.evaluation%></span>'+
      '<% } %>'+
    '</span>'
  );

  Ply.prototype.print_nop = _.template(
    '<span class="space"><%=this.prefix%></span>'+
    '<span class="ply nop" data-id="<%=this.id%>">'+
      '<%=this.text%>'+
    '</span>'
  );

  Ply.prototype.print_text = function () {
    return this.prefix + this.text;
  };

  return Ply;

});
