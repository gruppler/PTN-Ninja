// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/config',
  'app/game/tag',
  'app/game/move',
  'app/game/comment',
  'app/grammar',
  'app/messages',
  'i18n!nls/main',
  'lodash',
  'lzstring',
], function (config, Tag, Move, Comment, r, Messages, t, _) {

  var compress = LZString.compressToEncodedURIComponent
    , decompress = LZString.decompressFromEncodedURIComponent;

  var Game = function (simulator) {
    this.simulator = simulator;
    this.is_valid = false;
    this.config = {};
    this.tags = [];
    this.moves = [];
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
    var plaintext, header, body, i, file, tag, missing_tags, tps;

    if (is_from_URL) {
      if (/^[A-Za-z0-9$+-]+$/.test(input)) {
        plaintext = decompress(input);
      } else {
        plaintext = decodeURIComponent(input);
        input = compress(plaintext);
      }
      if (plaintext == this.ptn) {
        return false;
      } else {
        this.ptn = plaintext;
        this.ptn_compressed = input;
      }
    } else if (input == this.ptn) {
      return false;
    } else {
      this.ptn = input;
      this.ptn_compressed = compress(input);
    }

    if (is_original) {
      this.original_ptn = this.ptn;
      sessionStorage.ptn = this.original_ptn;
    } else if (!this.original_ptn) {
      this.original_ptn = sessionStorage.ptn;
    }

    this.on_parse_start(false, is_original);

    this.is_valid = true;
    this.result = null;
    this.tags.length = 0;
    this.moves.length = 0;
    this.plys.length = 0;
    this.m.clear('error');

    file = this.ptn.match(r.grammar.ptn_grouped);
    if (!file) {
      this.m.error(t.error.invalid_file_format);
      this.is_valid = false;
      return false;
    }

    header = file[1];
    this.comment_text = Comment.parse(file[2]);
    this.comments = this.comment_text ? _.map(this.comment_text, 'text') : null;
    body = file[3];
    this.suffix = file[4] || '';

    // Header
    header = header.match(r.grammar.header);
    if (!header) {
      this.m.error(t.error.invalid_header);
      this.is_valid = false;
      return false;
    }
    header = header[0].match(r.grammar.tag);
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

    // Body
    if (body) {
      // Recursively parse moves
      new Move(body, this);

      if (this.plys.length) {
        this.plys[0].is_first = true;
        _.last(this.plys).is_last = true;
      }
    }

    if (this.simulator.validate(this)) {
      this.on_parse_end(false, is_original);
      return true;
    } else {
      return false;
    }

  };

  Game.prototype.revert = function () {
    this.parse(this.original_ptn, false, true);
  }

  Game.prototype.get_linenum = function () {
    return this.config.tps && this.config.tps.move ?
      this.config.tps.move + this.moves.length :
      this.moves.length + 1;
  };

  Game.prototype.trim_to_current_ply = function (board) {
    var ply = this.plys[board.ply_index]
      , old_tag = _.find(this.tags, { key: 'tps' })
      , bounds;

    new Tag(
      '\n[TPS "'+board.to_tps()+'"]',
      this,
      old_tag ? old_tag.index : false
    );

    if (ply) {
      this.moves.splice(0, ply.move.index + (ply.turn == 2));
      if (ply.move.ply1 == ply) {
        ply.move.ply1 = null;
        ply.move.comments1 = null;
        ply.move.comments2 = null;
      }
      if (ply.turn == 2 && this.moves[0] && this.moves[0].linenum) {
        this.moves[0].linenum.prefix = ply.move.suffix
          + this.moves[0].linenum.prefix;
      }
      board.ply_index = 0;
      board.ply_is_done = false;
    }

    this.parse(this.print_text());

    bounds = this.plys.length ? this.get_bounds(this.plys[0])[1] : 'end';
    app.set_caret(bounds);
  };

  Game.prototype.print = function () {
    var output = '<span class="header">';

    output += _.invokeMap(this.tags, 'print').join('');
    output += '</span><span class="body">'
    output += this.comment_text ? _.invokeMap(this.comment_text, 'print').join('') : '';
    output += _.invokeMap(this.moves, 'print').join('');
    output += this.suffix;
    output += '</span>';

    return output;
  };

  Game.prototype.print_text = function () {
    var output = '';

    output += _.invokeMap(this.tags, 'print_text').join('');
    output += this.comment_text ? _.invokeMap(this.comment_text, 'print_text').join('') : '';
    output += _.invokeMap(this.moves, 'print_text').join('');
    output += this.suffix;

    return output;
  };

  Game.prototype.get_bounds = function (ply) {
    var bounds = [0, 0];

    // Count all tags
    bounds[0] += _.invokeMap(this.tags, 'print_text').join('').length;

    // Count game comment
    if (this.comment_text) {
      bounds[0] += _.invokeMap(this.comment_text, 'print_text').join('').length;
    }

    // Count all moves preceding ply's move
    bounds[0] += _.invokeMap(
      this.moves.slice(0, ply.move.index),
      'print_text'
    ).join('').length;

    // Count all move elements preceding ply
    if (ply.move.linenum) {
      bounds[0] += ply.move.linenum.print_text().length;
    }
    if (ply.move.comments1) {
      bounds[0] += _.invokeMap(ply.move.comments1, 'print_text').join('').length;
    }
    if (ply == ply.move.ply2) {
      if (ply.move.ply1) {
        bounds[0] += ply.move.ply1.print_text().length;
      }
      if (ply.move.comments2) {
        bounds[0] += _.invokeMap(ply.move.comments2, 'print_text').join('').length;
      }
    }

    bounds[1] = bounds[0] + ply.print_text().length;
    if (ply.prefix) {
      bounds[0] += ply.prefix.length;
    }

    return bounds;
  };

  Game.prototype.m = new Messages('parse');

  Game.prototype.print_invalid = _.template(
    '<span class="invalid">'+
      '<%=this.text.replace(/(\\S)/, \'<span class="first-letter">$1</span>\')%>'+
    '</span>'
  );

  return Game;

});
