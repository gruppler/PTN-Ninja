'use strict';

define(['app/grammar', 'util/messages', 'i18n!nls/main', 'lodash'], function (r, Messages, t, _) {

  var m = new Messages('parse');

  var Comment, Result, Move, Linenum, Turn, Tag, Game;

  t.error = _.mapValues(t.error, _.template);


  Comment = function (string, place) {
    var parts = string.match(r.grammar.comment_grouped);

    this.place = place;
    this.prefix = parts[1];
    this.text = parts[2];
    this.suffix = parts[3];

    return this;
  };

  function parse_comments(string, place) {
    var comments = _.map(
      string.match(r.grammar.comment_text),
      function (comment) {
        return new Comment(comment, place);
      }
    );

    return comments.length ? comments : null;
  }


  Result = function (string) {
    var parts = string.match(r.grammar.result_grouped);

    this.prefix = parts[1];
    this.text = parts[2];

    return this;
  }


  Move = function (string, player) {
    var move_group = string.match(r.grammar.move_grouped)
      , parts;

    this.prefix = move_group[1];

    if (move_group[2]) {
      parts = move_group[2].match(r.grammar.place_grouped);
      this.is_slide = false;
      this.player = player;
      this.move = move_group[2];
      this.stone = parts[1] || 'F';
      this.column = parts[2][0].toUpperCase();
      this.row = parts[2][1]*1;
      this.evaluation = move_group[4] || '';
    } else if(move_group[3]) {
      parts = move_group[3].match(r.grammar.slide_grouped);
      this.is_slide = true;
      this.player = player;
      this.move = move_group[3];
      this.count = 1*parts[1] || 1;
      this.column = parts[2][0].toUpperCase();
      this.row = parts[2][1]*1;
      this.direction = parts[3];
      this.drops = parts[4] ? parts[4].split('').map(_.toInteger) : [1*parts[1] || 1],
      this.stone = parts[5] || 'F';
      this.evaluation = move_group[4] || '';
    }

    return this;
  };


  Linenum = function (string) {
    var parts = string.match(r.grammar.linenum_grouped);

    this.prefix = parts[1];
    this.text = parts[2];
    this.value = parseInt(this.text, 10);

    return this;
  };


  Turn = function (string) {
    var parts = string.match(r.grammar.turn_grouped);

    this.linenum = new Linenum(parts[2]);
    this.move1 = new Move(parts[4], 1);
    this.move2 = new Move(parts[6], 2);
    this.result = parts[8] ? new Result(parts[8]) : null;
    this.comments1 = parse_comments(parts[1] + parts[3], 1);
    this.comments2 = parse_comments(parts[5], 2);
    this.comments3 = parse_comments(parts[7], 3);
    this.comments4 = parse_comments(parts[9], 4);

    return this;
  };


  Tag = function (string) {
    var parts = string.match(r.grammar.tag_grouped);

    if (!parts) {
      m.error(t.error.invalid_tag({tag: string}));
      return false;
    }

    this.prefix = parts[1];
    this.name = parts[2];
    this.separator = parts[3];
    this.value = parts[4];
    this.suffix = parts[5];

    this.key = this.name.toLowerCase();

    if (!(this.key in r.tags)) {
      m.error(t.error.invalid_tag({tag: parts[2]}));
      return false;
    }

    if (!r.tags[this.key].test(this.value)) {
      m.error(
        t.error.invalid_tag_value({tag: this.name, value: this.value})
      );
      return false;
    }

    return this;
  };


  Game = function (string) {
    this.config = {};
    this.tags = [];
    this.turns = [];
    this.ptn = '';

    if (string && string.length) {
      this.parse(string);
    }

    return this;
  };


  Game.prototype.parse = function (string) {
    var header, body, i, file, tag, missing_tags;

    if (string == this.ptn) {
      return;
    }

    this.ptn = string;
    this.tags.length = 0;
    this.turns.length = 0;
    m.clear('error');

    file = string.match(r.grammar.ptn_grouped);
    if (!file) {
      m.error(t.error.invalid_file_format());
      return false;
    }

    this.prefix = file[1];
    header = file[2];
    this.separator = file[3];
    body = file[4];

    header = header.match(r.grammar.tag);
    for (var i = 0; i < header.length; i++) {
      this.tags[i] = new Tag(header[i]);
      this.config[this.tags[i].key] = this.tags[i].value;
    }
    missing_tags = _.difference(
      r.required_tags,
      _.map(this.tags, 'key')
    );
    if (missing_tags.length) {
      m.error(t.error.missing_tags({tags: missing_tags}));
      return false;
    }

    body = body.match(r.grammar.body);
    if (!body) {
      m.error(t.error.invalid_body());
      return;
    }
    body = body[0].match(r.grammar.turn);
    for (var i = 0; i < body.length; i++) {
      this.turns[i] = new Turn(body[i]);
    }
  };


  Game.prototype.prettyprint = function () {
    var $output = $('<div class="ptn">').append(this.prefix);

    console.log($output);

    return $output;
  };

  return Game;

});
