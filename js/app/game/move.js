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
      , first_player = 1
      , second_player = 2
      , first_turn = 1;

    this.game = game;

    this.linenum = new Linenum(parts[1], game, _.compact(parts.slice(2)).length);

    if(game.config.tps && this.linenum.value == game.config.tps.move){
      if (game.config.tps.player == 1) {
        first_player = (this.linenum.value == 1) ? 2 : 1;
        second_player = first_player - 1 || 2;
      } else {
        first_player = (this.linenum.value == 1) ? 1 : 2;
        second_player = 0;
        first_turn = 2;
      }
    } else if (this.linenum.value == 1) {
      first_player = 2;
      second_player = 1;
    }

    this.comments1 = Comment.parse(parts[2]);
    this.comments2 = Comment.parse(parts[4]);
    this.comments3 = Comment.parse(parts[6]);
    this.comments4 = Comment.parse(parts[8]);

    if (parts[3]) {
      this.ply1 = new Ply(parts[3], first_player, game, this);
      this.ply1.turn = first_turn;
      if (this.ply1.is_nop) {
        second_player = first_player;
      }
    } else {
      this.ply1 = null;
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

    if (parts[5]) {
      this.ply2 = new Ply(parts[5], second_player, game, this);
      this.ply2.comments = _.map(this.comments3, 'text');
      this.ply2.turn = 2;
    } else {
      this.ply2 = null;
    }

    if (parts[7]) {
      this.result = new Result(parts[7], game);
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

    this.index = game.moves.length;
    game.moves[this.index] = this;

    if (parts[10]) {
      if (r.grammar.move_only.test(parts[10])) {
        new Move(parts[10], game);
      } else {
        this.text = parts[10];
        this.is_invalid = true;
        game.is_valid = false;
        game.m.error(t.error.invalid_movetext({text: _.trim(this.text)[0]}));
      }
    }

    return this;
  };

  Move.prototype.print = function(){
    var output = '<span class="move" data-index="'+this.index+'">';

    output += this.linenum.print();
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

  Move.prototype.print_text = function(){
    var output = '';

    if (this.linenum) {
      output += this.linenum.print_text();
    }
    if (this.comments1) {
      output += _.invokeMap(this.comments1, 'print_text').join('');
    }
    if (this.ply1) {
      output += this.ply1.print_text();
    }
    if (this.comments2) {
      output += _.invokeMap(this.comments2, 'print_text').join('');
    }
    if (this.ply2) {
      output += this.ply2.print_text();
    }
    if (this.comments3) {
      output += _.invokeMap(this.comments3, 'print_text').join('');
    }
    if (this.result) {
      output += this.result.print_text();
    }
    if (this.comments4) {
      output += _.invokeMap(this.comments4, 'print_text').join('');
    }
    if (this.suffix) {
      output += this.suffix;
    }
    if (this.text) {
      output += this.text;
    }

    return output;
  };

  return Move;

});
