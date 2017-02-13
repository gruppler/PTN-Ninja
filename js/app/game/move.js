// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/game/comment',
  'app/game/linenum',
  'app/game/ply',
  'app/game/result',
  'app/grammar',
  'i18n!nls/main',
  'lodash'
], function (Comment, Linenum, Ply, Result, r, t, _) {

  var Move = function (string, game) {
    var parts = string.match(r.grammar.move_grouped)
      , expected_linenum = game.get_linenum()
      , ply;

    this.game = game;
    this.char_index = game.char_index;

    this.index = game.moves.length;
    this.prev = _.last(game.moves) || null;
    this.next = null;
    this.original = null;
    this.branches = {};
    game.moves[this.index] = this;

    this.first_player = 1;
    this.second_player = 2;
    this.first_turn = 1;
    this.second_turn = 2;

    // Invalid move
    if (!parts) {
      this.text = string;
      this.is_invalid = true;
      game.is_valid = false;
      game.m.error(
        t.error.invalid_movetext({text: _.trim(this.text)[0]})
      ).click(function () {
        app.set_caret(game.char_index);
      });

      return this;
    }

    // Check for new branch
    this.linenum = new Linenum(parts[1], this, game, expected_linenum);
    this.id = this.linenum.id;
    this.branch = this.linenum.branch;
    this.is_reversed = (this.linenum.original == '1.');
    if (
      this.linenum.branch != expected_linenum.branch
      && _.has(game.indexed_moves, this.linenum.original)
    ) {
      // Starts a new branch
      this.original = game.indexed_moves[this.linenum.original];
      this.original.branches[this.branch] = this;
      this.prev = this.original.prev;
    } else if(this.prev) {
      this.prev.next = this;
    }
    if (!_.has(game.indexed_moves, this.id)) {
      game.indexed_moves[this.id] = this;
    } else {
      game.m.error(
        t.error.duplicate_linenum({id: this.id})
      ).click(function () {
        app.set_caret(game.char_index);
      });
    }

    if (game.config.tps && this.linenum.original == game.config.tps.move+'.') {
      if (game.config.tps.player == 1) {
        this.first_player = (this.is_reversed) ? 2 : 1;
        this.second_player = this.first_player - 1 || 2;
      } else {
        this.first_player = (this.is_reversed) ? 1 : 2;
        this.first_turn = 2;
        this.second_player = 0;
        this.second_turn = 0;
      }
    } else if (this.is_reversed) {
      this.first_player = 2;
      this.second_player = 1;
    }

    this.comments1 = Comment.parse(parts[2], game);

    if (parts[3]) {
      ply = new Ply(parts[3], this.first_player, game, this);
      this.comments2 = Comment.parse(parts[4], game);
      this.set_ply1(ply);
    } else {
      this.ply1 = null;
    }

    if (parts[5]) {
      ply = new Ply(parts[5], this.second_player, game, this);
      this.comments3 = Comment.parse(parts[6], game);
      this.set_ply2(ply);
    } else {
      this.ply2 = null;
    }

    if (parts[7]) {
      this.result = new Result(parts[7], game, this);

      this.comments4 = Comment.parse(parts[8], game);

      this.result.comments = _.map(this.comments4, 'text');
      if (this.ply2) {
        this.ply2.result = this.result;
      } else if (this.ply1) {
        this.ply1.result = this.result;
      }
    } else {
      this.result = null;
    }

    this.suffix = parts[9];
    game.char_index += this.suffix.length;

    if (parts[10]) {
      if (r.grammar.move_only.test(parts[10])) {
        new Move(parts[10], game);
      } else {
        this.text = parts[10];
        this.is_invalid = true;
        game.is_valid = false;
        game.m.error(
          t.error.invalid_movetext({text: _.trim(this.text)[0]})
        ).click(function () {
          app.set_caret(game.char_index);
        });
      }
    }

    return this;
  };

  Move.prototype.set_ply1 = function (ply) {
    this.ply1 = ply;
    this.ply1.turn = this.first_turn;

    if (this.original) {
      this.ply1.original = this.original.ply1;
      if (!this.ply1.is_nop) {
        this.ply1.original.branches[this.branch] = this.ply1;
        this.game.branches[this.branch] = this.ply1;
        this.ply1.prev = this.ply1.original.prev;
      }
    } else if (this.ply1.is_nop) {
      this.second_player = this.first_player;
    } else if (this.prev) {
      this.ply1.prev = this.prev.ply2 || this.prev.ply1;
      this.ply1.prev.next = this.ply1;
    }

    if (this.comments1) {
      if (this.comments2) {
        this.ply1.comments = _.map(this.comments1, 'text').concat(
          _.map(this.comments2, 'text')
        );
      } else {
        this.ply1.comments = _.map(this.comments1, 'text');
      }
    } else if (this.comments2) {
      this.ply1.comments = _.map(this.comments2, 'text');
    }
  };

  Move.prototype.set_ply2 = function (ply) {
    this.ply2 = ply;
    this.ply2.turn = this.second_turn;
    if (this.original && this.ply1.is_nop) {
      this.ply2.prev = this.ply1.original;
      this.ply2.original = this.original.ply2;
      (this.original.ply2 || this.original.ply1).branches[this.branch] = this.ply2;
      this.game.branches[this.branch] = this.ply2;
    } else {
      this.ply2.prev = this.ply1;
    }
    this.ply1.next = this.ply2;

    this.ply2.comments = _.map(this.comments3, 'text');
  };

  Move.prototype.insert_ply = function (ply, turn, is_done, flattens) {
    var ply, prev_move;

    if (turn == 1 || this.first_turn == 2) {
      if (this.ply1) {
        ply = this.ply1.prefix + ply;
      } else if ((prev_move = this.game.moves[this.index - 1]) && prev_move.ply1) {
        ply = prev_move.ply1.prefix + ply;
      } else {
        ply = ' '+ply;
      }
      this.set_ply1(new Ply(ply, this.first_player, this.game, this));
    } else {
      if (this.ply2) {
        ply = this.ply2.prefix + ply;
      } else if ((prev_move = this.game.moves[this.index - 1]) && prev_move.ply2) {
        ply = prev_move.ply2.prefix + ply;
      } else {
        ply = ' '+ply;
      }
      this.set_ply2(new Ply(ply, this.second_player, this.game, this));
    }

    if (_.isNumber(flattens)) {
      ply.flattens = flattens;
    }

    return ply;
  };

  Move.prototype.insert_result = function (string, turn, silently) {
    var ply = this['ply' + (this.first_turn == 2 ? 1 : turn)]
      , old_result
      , prefix = ' ';

    if (ply) {
      old_result = ply.result;
      if (old_result) {
        prefix = old_result.prefix;
      }

      ply.result = new Result(prefix + string, this.game, this);
      this.result = ply.result;
      ply.result.comments = _.map(this.comments4, 'text');

      if (!silently) {
        this.game.update_text(true);
      }
      return ply.result;
    }
  };

  Move.prototype.get_branch = function (branch) {
    if (branch) {
      if (branch == this.branch || _.isEmpty(this.branches)) {
        return this;
      } else {
        while (branch.length) {
          if (branch in this.branches) {
            return this.branches[branch];
          } else {
            branch = branch.replace(/\d+\.$/, '');
          }
        }
        return this;
      }
    } else {
      return this.original || this;
    }
  };

  Move.prototype.print = function () {
    var output = '<span class="move" data-index="'+this.index+'">';

    if (this.linenum) {
      output += this.linenum.print();
    }
    if (this.comments1) {
      output += _.invokeMap(this.comments1, 'print').join('');
    }
    if (this.ply1) {
      output += this.ply1.print();
    }
    if (this.comments2) {
      output += _.invokeMap(this.comments2, 'print').join('');
    }
    if (this.ply2) {
      output += this.ply2.print();
    }
    if (this.comments3) {
      output += _.invokeMap(this.comments3, 'print').join('');
    }
    if (this.result) {
      output += this.result.print();
    }
    if (this.comments4) {
      output += _.invokeMap(this.comments4, 'print').join('');
    }
    if (this.suffix) {
      output += '<span class="space">'+this.suffix+'</span>';
    }
    if (this.text) {
      output += this.game.print_invalid.call(this);
    }
    output += '</span>';

    return output;
  };

  Move.prototype.print_for_board = function (branch) {
    var output = '<span class="move" data-index="'+this.index+'">';

    if (this.linenum) {
      output += this.linenum.print();
    }
    if (this.ply1) {
      output += (
        this.ply1.is_nop ?
          this.ply1.original
          : this.ply1.get_branch(branch)
      ).print();
    }
    if (this.ply2) {
      output += this.ply2.get_branch(branch).print();
    }
    if (this.result) {
      output += this.result.print();
    }
    output += '</span>';

    return output;
  };

  Move.prototype.print_text = function (update_char_index) {
    var output = '';

    if (update_char_index) {
      this.char_index = this.game.char_index;
    }

    if (this.linenum) {
      output += this.linenum.print_text(update_char_index);
    }
    if (this.comments1) {
      output += _.invokeMap(this.comments1, 'print_text', update_char_index).join('');
    }
    if (this.ply1) {
      output += this.ply1.print_text(update_char_index);
    }
    if (this.comments2) {
      output += _.invokeMap(this.comments2, 'print_text', update_char_index).join('');
    }
    if (this.ply2) {
      output += this.ply2.print_text(update_char_index);
    }
    if (this.comments3) {
      output += _.invokeMap(this.comments3, 'print_text', update_char_index).join('');
    }
    if (this.result) {
      output += this.result.print_text(update_char_index);
    }
    if (this.comments4) {
      output += _.invokeMap(this.comments4, 'print_text', update_char_index).join('');
    }
    if (this.suffix) {
      output += this.suffix;
      if (update_char_index) {
        this.game.char_index += this.suffix.length;
      }
    }
    if (this.text) {
      output += this.text;
      if (update_char_index) {
        this.game.char_index += this.text.length;
      }
    }

    return output;
  };

  return Move;

});
