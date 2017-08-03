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
    var new_id, suffix;

    if (_.isString(linenum)) {
      linenum = Linenum.parse_id(linenum);
    }

    new_id = linenum.id;
    suffix = linenum.value+'.';

    while (_.has(this.indexed_moves, new_id + suffix)) {
      new_id += '0.';
    }

    return new_id + suffix;
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

  Game.prototype.insert_ply = function (ply, index, is_done, flattens) {
    var old_ply = _.isUndefined(index) ? null : this.plys[index]
      , turn, move, ply, comments;

    if (old_ply) {
      this.char_index = old_ply.char_index;
      turn = old_ply.turn;
      move = old_ply.move;
      comments = old_ply.comments;
      this.plys.splice(old_ply.index);
      this.moves.splice(move.index + 1);
      if (turn == 1 || move.first_turn == 2) {
        move.ply2 = null;
      }
    } else if (this.moves.length) {
      move = _.last(this.moves);
      turn = this.plys.length && _.last(this.plys).turn == 1 ? 2 : 1;
      if (this.plys.length && turn == 1) {
        // New move
        move.suffix = '\n';
        move = new Move((move.linenum.value + 1) + '.', this);
      }
    } else {
      turn = this.config.tps ? this.config.tps.player : 1;
      move = new Move(this.suffix + this.get_linenum().id, this);
      this.suffix = '';
    }

    ply = move.insert_ply(ply, turn, is_done, flattens);
    ply.comments = comments || [];

    this.update_text();
    app.update_after_ply_insert(ply.index, is_done);

    return ply;
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
      this.moves.splice(0, ply.move.index + (ply.turn == 2));
      if (this.moves.length) {
        this.moves[0].linenum.prefix = prefix;
      } else {
        this.suffix = prefix;
      }
      if (ply.move.plys[0] == ply) {
        ply.move.plys[0] = null;
        ply.move.comments1 = null;
        ply.move.comments2 = null;
      }
      board.ply_index = 0;
      board.ply_is_done = false;
    }

    this.parse(this.print_text());
    app.range.pushstate();

    bounds = this.plys.length ? this.get_bounds(this.plys[0])[1] : 'end';
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
