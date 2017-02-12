// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'i18n!nls/main', 'lodash'], function (r, t, _) {

  function get_slide_squares(ply) {
    var squares = [ply.square]
      , i = ply.drops.length
      , square = app.square_coord(ply.square);

    switch (ply.direction) {
      case '+':
        while (i--) {
          square[1]++;
          squares.push(app.square_coord(square));
        }
        break;
      case '-':
        while (i--) {
          square[1]--;
          squares.push(app.square_coord(square));
        }
        break;
      case '<':
        while (i--) {
          square[0]--;
          squares.push(app.square_coord(square));
        }
        break;
      case '>':
        while (i--) {
          square[0]++;
          squares.push(app.square_coord(square));
        }
    }

    return squares;
  }

  var Ply = function (string, player, game, move) {
    var that = this
      , ply_group = string.match(r.grammar.ply_grouped)
      , parts, i;

    this.game = game;
    this.is_valid = true;
    this.index = game.plys.length;
    game.plys[game.plys.length] = this;

    this.char_index = game.char_index;
    game.char_index += string.length;

    this.move = move;
    this.prev = null;
    this.next = null;
    this.original = null;
    this.branches = {};
    this.branch = move.branch;

    this.is_nop = false;
    this.is_illegal = false;

    if (!ply_group) {
      this.is_nop = true;
      this.print = this.print_nop;
      this.player = player;

      ply_group = string.match(r.grammar.nop_grouped)
      this.prefix = ply_group[1];
      this.text = ply_group[2];
      this.evaluation = '';

      if (
        !move.original
        && (!game.config.tps || game.config.tps.player == 1)
      ) {
        game.m.error(
          t.error.invalid_ply({ply: this.text})
        ).click(function () {
          app.select_token_text(that);
        });
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
      this.direction = parts[3];
      this.drops_text = parts[4] || '',
      this.drops = parts[4] ? parts[4].split('').map(_.toInteger) : [this.count];
      this.squares = get_slide_squares(this);
      this.flattens = null;
      this.stone_text = parts[5] || '';
      this.evaluation = ply_group[4] || '';
      if (_.sum(this.drops) != this.count) {
        game.m.error(
          t.error.invalid_ply({ply: this.text})
        ).click(function () {
          app.select_token_text(that);
        });
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
      this.squares = [this.square];
      this.evaluation = ply_group[4] || '';
    }

    if (!this.player) {
      game.is_valid = false;
      this.is_illegal = true;
      this.text = string;
      this.print = game.print_invalid;
      game.m.error(
        t.error.invalid_movetext({text: _.trim(string)[0]})
      ).click(function () {
        app.select_token_text(that);
      });
      return this;
    }

    if (
      this.row > game.config.size ||
      (this.col.charCodeAt(0) - '`'.charCodeAt(0)) > game.config.size
    ) {
      game.is_valid = false;
      game.m.error(
        t.error.invalid_square({square: this.col+this.row})
      ).click(function () {
        app.select_token_text(that);
      });
      this.is_illegal = true;
    }

    return this;
  };

  Ply.prototype.is_current = function () {
    return app.board && app.board.ply_index == this.index;
  };

  Ply.prototype.get_branch = function (branch) {
    if (branch) {
      if (branch == this.branch || _.isEmpty(this.branches)) {
        return this;
      } else if (_.has(this.branches, branch)) {
        return this.branches[branch];
      } else {
        branch = this.game.branches[branch] || this.game.plys[0];
        while (branch.branch && branch.original) {
          branch = branch.original;
          if (this.branch == branch.branch) {
            return this;
          } else if (_.has(this.branches, branch.branch)) {
            return this.branches[branch.branch];
          }
          if (!branch.original) {
            branch = branch.branch ?
              this.game.branches[branch.branch]
              : this.game.plys[0];
          }
        }
      }
      return this;
    } else {
      return this.original || this;
    }
  };

  Ply.prototype.is_in_branch = function (branch) {
    if (this.branch == branch) {
      // In same branch
      return true;
    } else if (_.startsWith(this.branch, branch)) {
      // In a child or sibling branch
      return false;
    } else if (_.startsWith(branch, this.branch)) {
      // In a parent branch
      branch = this.game.branches[branch] || this.game.plys[0];
      while (branch.branch && branch.original) {
        branch = branch.original;
        if (branch.branch == this.branch) {
          return branch.index > this.index;
        }
        if (!branch.original) {
          branch = branch.branch ?
            this.game.branches[branch.branch]
            : this.game.plys[0];
        }
      }
      return false;
    } else {
      // In a different branch
      return false;
    }
  };

  Ply.prototype.print_place = _.template(
    '<span class="space"><%=this.prefix%></span>'+
    '<span '+
      'class="ply player<%=this.player%>'+
        '<%=this.is_current() ? " active" : ""%>" '+
        '<%=this.is_illegal ? " illegal" : ""%>" '+
      'data-index="<%=this.index%>"'+
    '>'+
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
    '<span '+
      'class="ply player<%=this.player%>'+
        '<%=this.is_illegal ? " illegal" : ""%>" '+
        'data-index="<%=this.index%>"'+
      '>'+
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
    '<span class="ply nop" data-index="<%=this.index%>">'+
      '<%=this.text%>'+
    '</span>'
  );

  Ply.prototype.print_text = function (update_char_index) {
    var text = this.prefix + this.text + this.evaluation;

    if (update_char_index) {
      this.char_index = this.game.char_index;
      this.game.char_index += text.length;
    }

    return text;
  };

  return Ply;

});
