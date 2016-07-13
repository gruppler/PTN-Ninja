// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/game/tag',
  'app/game/move',
  'app/game/comment',
  'app/grammar',
  'app/messages',
  'i18n!nls/main',
  'lodash',
  'lzstring',
], function (Tag, Move, Comment, r, Messages, t, _) {

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

  Game.prototype.on_parse_start = function (fn) {
    this.callbacks_start.push(fn);
    return this;
  };

  Game.prototype.on_parse_end = function (fn) {
    this.callbacks_end.push(fn);
    return this;
  };

  Game.prototype.parse = function (input, is_from_URL) {
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

    _.invokeMap(this.callbacks_start, 'call', this, this);

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
      this.tags[i] = new Tag(header[i], this);
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
    body = body.match(r.grammar.move);
    if (body) {
      for (var i = 0; i < body.length; i++) {
        this.moves[i] = new Move(body[i], this);

        if (this.moves[i].ply1) {
          this.moves[i].ply1.id = this.plys.length;
          this.plys.push(this.moves[i].ply1);
        }

        if (this.moves[i].ply2) {
          this.moves[i].ply2.id = this.plys.length;
          this.plys.push(this.moves[i].ply2);
        }

        if (this.moves[i].result && (this.moves[i].ply2 || this.moves[i].ply1)) {
          (this.moves[i].ply2 || this.moves[i].ply1).result = this.moves[i].result;
        }
      }

      if (this.plys.length) {
        this.plys[0].is_first = true;
        _.last(this.plys).is_last = true;
      }
    }

    this.simulator.validate(this);

    _.invokeMap(this.callbacks_end, 'call', this, this);

    return true;
  };

  Game.prototype.get_linenum = function () {
    return this.config.tps && this.config.tps.move ?
      this.config.tps.move + this.moves.length :
      this.moves.length + 1;
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

  Game.prototype.m = new Messages('parse');

  Game.prototype.print_invalid = _.template(
    '<span class="invalid">'+
      '<%=this.text.replace(/(\\S)/, \'<span class="first-letter">$1</span>\')%>'+
    '</span>'
  );

  return Game;

});
