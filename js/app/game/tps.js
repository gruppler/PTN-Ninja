// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'i18n!nls/main', 'lodash'], function (r, t, _) {

  var TPS = function (string, game, tag) {
    var that = this
      , parts = string.match(r.grammar.tps_grouped)
      , tps;

    this.is_valid = true;
    this.invalid_dimensions = false;

    if (tag) {
      this.tag = tag;
      this.char_index = tag.char_index + tag.print_text().length
        - string.length - tag.q2.length - tag.suffix.length;
    }

    // Invalid
    if (!parts[1]) {
      game.m.error(
        t.error.invalid_tag_value({tag: t.TPS, value: string})
      ).click(function () {
        app.set_caret([
          that.char_index,
          that.char_index + string.length
        ]);
      });
      this.is_valid = false;
      game.is_valid = false;
      this.text = string;
      this.print = game.print_invalid;

      return false;
    }

    this.squares = TPS.Square.parse(this, parts[1], 1*game.config.size);
    this.space1 = parts[2];
    this.player = parts[3];
    this.space2 = parts[4];
    this.move = parts[5];
    this.suffix = parts[6];

    if (this.invalid_dimensions !== false) {
      game.m.error(
        t.error.invalid_TPS_dimensions
      ).click(function () {
        app.set_caret(that.invalid_dimensions);
      });
    } else if (this.suffix && /\S/.test(this.suffix)) {
      game.m.error(
        t.error.invalid_tag_value({tag: t.TPS, value: this.suffix})
      ).click(function () {
        app.set_caret([
          that.char_index + string.length - that.suffix.length,
          that.char_index + string.length
        ]);
      });
    } else if (!this.is_valid) {
      game.m.error(
        t.error.invalid_tag_value({
          tag: t.TPS,
          value: _.find(this.squares, {error: true}).text
        })
      ).click(function () {
        app.set_caret([
          that.char_index,
          that.char_index + string.length
        ]);
      });
    } else if (!this.player) {
      game.m.error(
        t.error.tps_missing_player
      ).click(function () {
        app.set_caret(that.char_index + string.length);
      });
    } else if (!this.move) {
      game.m.error(
        t.error.tps_missing_move
      ).click(function () {
        app.set_caret(that.char_index + string.length);
      });
    }

    this.player *= 1;
    this.move *= 1;

    return this;
  };

  TPS.prototype.print = _.template(
    '<%=_.invokeMap(this.squares, "print").join("")%>'+
    '<%=this.space1%>'+
    '<% if (this.player) { %>'+
      '<span class="player<%=this.player%>">'+
        '<i class="material-icons player<%=this.player%>"></i>'+
        '<%=this.player%>'+
      '</span>'+
    '<% } %>'+
    '<%=this.space2%>'+
    '<% if (this.move) { %>'+
      '<span class="move">'+
        '<i class="material-icons move"></i>'+
        '<%=this.move%>'+
      '</span>'+
    '<% } %>'+
    '<span class="invalid">'+
      '<%=this.suffix.replace('+
        '/(\\S[a-zA-Z]*)/,'+
        '\'<span class="first-letter">$1</span>\''+
      ')%>'+
    '</span>'
  );

  TPS.Square = function (string, row, col, char_index) {
    var parts = string.match(r.grammar.col_grouped)
      , stack_parts;

    this.char_index = char_index;
    this.coord = app.square_coord([col, row]);

    if (parts[2]) {
      this.is_space = false;
      this.print = this.print_stack;
      this.text = parts[2];

      stack_parts = this.text.match(r.grammar.stack_grouped);
      this.pieces = stack_parts[1].split('').concat(stack_parts[2]);
    } else {
      this.is_space = true;
      this.print = this.print_space;
      this.text = parts[1] || '';
      this.count = 1*this.text[1] || 1;
    }
    this.separator = parts[3];

    return this;
  };

  TPS.Square.parse = function(tps, string, size) {
    var row = size - 1, col = 0
      , squares, char_index = tps.char_index;

    var squares = _.map(
      _.compact(string.match(r.grammar.cols)),
      function (square, i) {
        square = new TPS.Square(square, row, col, char_index);
        char_index += square.text.length + square.separator.length;

        if (col >= size || row < 0) {
          square.error = true;
          square.separator_error = square.separator == ',';
          tps.invalid_dimensions = char_index;
        }

        if (square.is_space) {
          col += square.count;
          if (col > size) {
            square.error = true;
            tps.invalid_dimensions = char_index;
          }
        } else {
          col++;
        }

        if (square.separator == '/') {
          if (col < size || row == 0) {
            square.separator_error = true;
            tps.invalid_dimensions = char_index;
          }

          row--;
          col = 0;
        } else if (square.separator == ',' && col == size) {
          square.separator_error = true;
          tps.invalid_dimensions = char_index;
        }

        return square;
      }
    );

    if (row != 0 || col < size) {
      tps.invalid_dimensions = char_index;
    }

    return squares || [];
  };

  TPS.Square.prototype.print_space = _.template(
    '<span '+
      'class="square space<%=this.error ? " illegal":""%>" '+
      'data-coord="<%=this.coord%>" '+
      'data-count="<%=this.count%>"'+
    '>'+
      '<%=this.text%>'+
    '</span>'+
    '<span class="separator<%=this.separator_error ? " illegal":""%>">'+
      '<%=this.separator%>'+
    '</span>'
  );

  TPS.Square.prototype.print_stack = _.template(
    '<span '+
      'class="square stack<%=this.error ? " illegal":""%>" '+
      'data-coord="<%=this.coord%>"'+
    '>'+
      '<% _.map(this.pieces, function(piece, i) { %>'+
        '<span class="piece player<%=piece[0]%>">'+
          '<%=piece[0]%>'+
          '<% if (piece.length > 1) { %>'+
            '<span class="stone"><%=piece[1]%></span>'+
          '<% } %>'+
        '</span>'+
      '<% }).join("") %>'+
    '</span>'+
    '<span class="separator<%=this.separator_error ? " illegal":""%>">'+
      '<%=this.separator%>'+
    '</span>'
  );

  return TPS;

});
