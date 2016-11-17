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

  var Tag = function (string, game, index) {
    var that = this
      , parts = string.match(r.grammar.tag_grouped);

    this.index = _.isNumber(index) ? index : game.tags.length;
    game.tags[this.index] = this;

    this.char_index = game.char_index;
    game.char_index += string.length;

    this.text = string;

    if (!parts) {
      game.is_valid = false;
      this.print = game.print_invalid;
      game.m.error(
        t.error.invalid_tag({tag: _.truncate(string, {length: 5})})
      ).click(function () {
        app.select_token_text(that);
      });
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
    this.icon = this.key;

    if (!(this.key in r.tags)) {
      this.icon = 'unknown';
      game.m.warning(
        t.error.unrecognized_tag({tag: parts[2]})
      ).click(function () {
        app.set_caret([
          that.char_index + that.prefix.length,
          that.char_index + that.prefix.length + that.name.length
        ]);
      });
      return this;
    } else if (r.required_tags.indexOf(this.key) >= 0) {
      this.is_required = true;
    }

    if (!r.tags[this.key].test(this.value) && this.key != 'tps') {
      game.m[this.is_required ? 'error' : 'warning'](
        t.error.invalid_tag_value({tag: this.name, value: this.value})
      ).click(function () {
        app.set_caret([
          that.char_index + string.length
            - that.value.length - that.q2.length - that.suffix.length,
          that.char_index + string.length
            - that.q2.length - that.suffix.length
        ]);
      });
      if (this.is_required) {
        game.is_valid = false;
        return false;
      }
      return this;
    }

    if (this.key == 'result' && this.value) {
      new Result(this.value, game, this);
      this.print_value = _.bind(game.config.result.print_value, game.config.result);
    } else if(this.key == 'tps') {
      game.config.tps = new TPS(this.value, game, this);
      this.print_value = _.bind(game.config.tps.print, game.config.tps);
    }else{
      game.config[this.key] = this.value;
    }

    return this;
  };

  Tag.prototype.print = _.template(
    '<span class="tag">'+
      '<%=this.prefix%>'+
      '<i class="material-icons <%=this.icon%>"></i>'+
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
