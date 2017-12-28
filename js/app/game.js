// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/config',
  'app/game/tag',
  'app/game/move',
  'app/game/linenum',
  'app/game/comment',
  'app/grammar',
  'app/messages',
  'i18n!nls/main',
  'lodash',
  'lzstring',
], function (config, Tag, Move, Linenum, Comment, r, Messages, t, _) {

  var compress = LZString.compressToEncodedURIComponent
    , decompress = LZString.decompressFromEncodedURIComponent;

  var Game = function (simulator) {
    this.simulator = simulator;
    this.is_valid = false;
    this.config = {};
    this.tags = [];
    this.moves = [];
    this.indexed_moves = {};
    this.branches = {};
    this.plys = [];
    this.ptn = '';
    this.callbacks_start = [];
    this.callbacks_end = [];

    return this;
  };

  Game.prototype.on_parse_start = function (fn, is_original) {
    if (_.isFunction(fn)) {
      this.callbacks_start.push(fn);
    } else {
      _.invokeMap(this.callbacks_start, 'call', is_original);
    }

    return this;
  };

  Game.prototype.on_parse_end = function (fn, is_original) {
    if (_.isFunction(fn)) {
      this.callbacks_end.push(fn);
    } else {
      _.invokeMap(this.callbacks_end, 'call', is_original);
    }

    return this;
  };

  Game.prototype.parse = function (input, is_from_URL, is_original) {
    var plaintext, header, body, i, file, missing_tags, tps;

    if (is_from_URL) {
      if (/^[A-Za-z0-9$+-]+$/.test(input)) {
        plaintext = decompress(input);
      } else {
        plaintext = decodeURIComponent(input);
        input = compress(plaintext);
      }
      if (plaintext == this.ptn) {
        return false;
      }
    } else if (input == this.ptn) {
      return false;
    } else {
      plaintext = input;
    }

    if (is_original) {
      this.original_ptn = plaintext;
      sessionStorage.ptn = this.original_ptn;
    } else if (!this.original_ptn) {
      this.original_ptn = sessionStorage.ptn;
    }

    this.on_parse_start(false, is_original);

    this.text = false;
    this.comment_text = false;
    this.comments = false;
    this.is_valid = true;
    this.caret_moved = false;
    this.tags.length = 0;
    this.moves.length = 0;
    this.indexed_moves = {};
    this.branches = {};
    this.plys.length = 0;
    this.m.clear('error');
    this.m.clear('warning');
    this.char_index = 0;

    file = plaintext.match(r.grammar.ptn_grouped);
    if (!file) {
      this.m.error(t.error.invalid_notation);
      this.is_valid = false;
      this.text = plaintext;
    } else {

      header = file[1];
      body = file[3];
      this.suffix = file[4] || '';

      // Header
      header = header.match(r.grammar.tag);
      this.config = {};
      for (var i = 0; i < header.length; i++) {
        new Tag(header[i], this);
      }
      missing_tags = _.difference(
        r.required_tags,
        _.map(this.tags, 'key')
      );
      if (missing_tags.length) {
        this.m.error(t.error.missing_tags({tags: missing_tags}));
        this.is_valid = false;
      }

      // Game comments
      this.comment_text = Comment.parse(file[2], this);
      this.comments = this.comment_text ? _.map(this.comment_text, 'text') : null;

      // Body
      if (body) {
        // Recursively parse moves
        new Move(body, this);
      }

    }

    this.update_text();

    if (this.simulator.validate(this)) {
      this.on_parse_end(false, is_original);
      return true;
    } else {
      return false;
    }

  };

  Game.prototype.revert = function () {
    this.parse(this.original_ptn, false, true);
  };

  Game.prototype.get_unique_id = function (linenum) {
    var new_id, prefix, suffix;

    if (_.isString(linenum)) {
      linenum = Linenum.parse_id(linenum);
    }

    if (config.branch_numbering) {
      new_id = 1;
      prefix = linenum.branch + linenum.value + '-';
      suffix = '.'+linenum.value+'.';
      while (_.has(this.indexed_moves, prefix + new_id + suffix)) {
        new_id++;
      }
    } else {
      new_id = linenum.id;
      prefix = '';
      suffix = linenum.value+'.';
      while (_.has(this.indexed_moves, new_id + suffix)) {
        new_id += '.';
      }
    }

    return prefix + new_id + suffix;
  };

  Game.prototype.get_linenum = function () {
    var last_move = _.last(this.moves);

    if (last_move && last_move.linenum) {
      return Linenum.parse_id(
        last_move.linenum.branch+(last_move.linenum.value + 1)+'.'
      );
    } else {
      return Linenum.parse_id(this.get_first_linenum()+'.');
    }
  };

  Game.prototype.get_first_linenum = function () {
    return this.config.tps && this.config.tps.move ?
      this.config.tps.move : 1;
  };

  Game.prototype.update_text = function (update_char_index) {
    this.ptn = this.print_text(update_char_index);
    this.ptn_compressed = compress(this.ptn);
  };

  Game.prototype.insert_ply = function (ply, branch, linenum, turn, is_done, flattens) {
    var move_id = branch + linenum + '.'
      , prev_move_id = branch + (linenum - 1) + '.'
      , move = this.indexed_moves[move_id]
      , prev_move;

    if (!move) {
      if (prev_move_id in this.indexed_moves) {
        prev_move = this.indexed_moves[prev_move_id];
        move = new Move(move_id, this);
        this.moves.splice(prev_move.index + 1, 0, this.moves.pop());
        for (var i = prev_move.index + 1; i < this.moves.length; i++) {
          this.moves[i].index = i;
        }
        move.suffix = prev_move.suffix;
        prev_move.suffix = '\n';
      } else {
        move = new Move(this.suffix + move_id, this);
        this.suffix = '';
      }
    }

    if (move.plys[turn - 1]) {
      if (move.plys[turn - 1].text == ply) {
        app.update_after_ply_insert(move.plys[turn - 1].index, is_done);
        return move.plys[turn - 1];
      }
      // New branch
      if (move.plys[turn - 1].original) {
        move_id = this.get_unique_id(move.original.linenum);
      } else {
        move_id = this.get_unique_id(move.linenum);
      }
      move = new Move('\n\n' + move_id, this);

      if (turn == 2) {
        move.insert_ply('--', 1);
      }
    }

    ply = move.insert_ply(ply, turn, flattens);

    this.update_text();
    app.update_after_ply_insert(ply.index, is_done);

    return ply;
  };

  Game.prototype.delete_branch = function (move, exclude_branch) {
    if (move.branch === exclude_branch) {
      return;
    }
    _.remove(this.moves, move);
    if (move.next) {
      this.delete_branch(move.next, exclude_branch);
    }
    for (var branch in move.branches) {
      this.delete_branch(move.branches[branch], exclude_branch);
    }
  };

  Game.prototype.trim_to_current_ply = function (board) {
    var ply = this.plys[board.ply_index]
      , old_tag = _.find(this.tags, { key: 'tps' })
      , prefix, bounds;

    if (this.moves.length && this.moves[0].linenum) {
      prefix = this.moves[0].linenum.prefix;
    } else {
      return;
    }

    new Tag(
      '\n[TPS "'+board.to_tps()+'"]',
      this,
      old_tag ? old_tag.index : false
    );

    if (ply) {
      if (ply.turn == 2) {
        _.remove(this.moves, function (move) {
          return move.linenum.value <= ply.move.linenum.value
            || move.branch.indexOf(ply.branch) != 0;
        });
      } else {
        _.remove(this.moves, function (move) {
          return move.linenum.value < ply.move.linenum.value
            || move.branch.indexOf(ply.branch) != 0;
        });
        ply.move.plys[0] = null;
        ply.move.comments1 = null;
        ply.move.comments2 = null;
        if (ply.next && !_.isEmpty(ply.next.branches)) {
          for (var branch in ply.next.branches) {
            ply.next.branches[branch].move.plys[0] = null;
            ply.next.branches[branch].move.comments1 = null;
            ply.next.branches[branch].move.comments2 = null;
          }
        }
      }

      // Remove orphaned branches
      for(var branch in this.branches){
        var branch_ply = this.branches[branch];
        var move = branch_ply.move;
        if (
          this.moves.indexOf(move.original) < 0 ||
          move.original.plys[branch_ply.original.turn - 1] != branch_ply.original
        ) {
          this.delete_branch(move, ply.branch);
        }
      }

      if (this.moves.length) {
        this.moves[0].linenum.prefix = prefix;
        if (ply.branch) {
          var prefix = new RegExp('^'+ply.branch.replace(/\./g, '\\.'));
          _.each(this.moves, function (move) {
            move.linenum.text = move.linenum.text.replace(prefix, '');
          });
        }
      } else {
        this.suffix = prefix;
      }
      board.ply_index = 0;
      board.ply_is_done = false;
    }

    this.parse(this.print_text());
    app.range.pushstate();

    bounds = this.plys.length ? this.get_bounds(this.plys[0])[1] : 'end';
    app.update_ptn_branch();
    app.set_caret(bounds);
    app.scroll_to_ply();
  };

  Game.prototype.print = function () {
    var output = '';

    if (this.text) {
      output += this.print_invalid();
    }

    output += '<span class="header">';

    if (this.tags) {
      output += _.invokeMap(this.tags, 'print').join('');
    }

    output += '</span><span class="body">'

    if (this.comment_text) {
      output += _.invokeMap(this.comment_text, 'print').join('');
    }
    if (this.moves) {
      output += _.invokeMap(this.moves, 'print').join('');
    }
    if (this.suffix) {
      output += this.suffix;
    }

    output += '</span>';

    return output;
  };

  Game.prototype.print_text = function (update_char_index) {
    var output = '';

    if (update_char_index) {
      this.char_index = 0;
    }

    output += _.invokeMap(this.tags, 'print_text', update_char_index).join('');
    if (this.comment_text) {
      output += _.invokeMap(
        this.comment_text, 'print_text', update_char_index
      ).join('');
    }
    output += _.invokeMap(this.moves, 'print_text', update_char_index).join('');
    output += this.suffix;

    return output;
  };

  Game.prototype.get_bounds = function (token) {
    return [
      token.char_index + (token.prefix ? token.prefix.length : 0),
      token.char_index + (token.print_text ? token.print_text().length : 0)
        - (token.suffix ? token.suffix.length : '')
    ];
  };

  Game.prototype.m = new Messages('parse');

  Game.prototype.print_invalid = _.template(
    '<span class="space"><%=this.prefix%></span>'+
    '<span class="invalid">'+
      '<%=this.text.replace(/^\\s*(\\S)/, \'<span class="first-letter">$1</span>\')%>'+
    '</span>'
  );

  return Game;

});
