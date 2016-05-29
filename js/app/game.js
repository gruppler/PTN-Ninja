'use strict';

define(['app/grammar', 'app/messages', 'i18n!nls/main', 'lodash', 'lzstring'], function (r, Messages, t, _) {

  var Comment, Result, Move, Linenum, Turn, Tag, Game;
  var m = new Messages('parse');

  var result_label = {
    '0': 'loss',
    'F': 'flat win',
    'R': 'road win',
    '1/2': 'draw'
  };

  var tag_icons = {
    'player1': 'player-solid',
    'player2': 'player-line',
    'date': 'date',
    'size': 'grid-line',
    'result': 'result',
    'event': 'event',
    'site': 'site',
    'round': 'round',
    'rating1': 'star-solid',
    'rating2': 'star-line',
    'tps': 'grid-solid',
    'points': 'points',
    'clock': 'timer'
  };

  var compress = LZString.compressToEncodedURIComponent
    , decompress = LZString.decompressFromEncodedURIComponent;


  // Comment

  Comment = function (string) {
    var parts = string.match(r.grammar.comment_grouped);

    this.prefix = parts[1];
    this.text = parts[2];
    this.suffix = parts[3];

    return this;
  };

  Comment.prototype.print = _.template(
    '<span class="comment">'+
      '<%=this.prefix%>'+
      '<span class="text"><%=this.text%></span>'+
      '<%=this.suffix%>'+
    '</span>'
  );

  function parse_comments(string) {
    var comments = _.map(
      string.match(r.grammar.comment_text),
      function (comment) {
        return new Comment(comment);
      }
    );

    return comments.length ? comments : null;
  }


  // Result

  Result = function (string) {
    var parts = string.match(r.grammar.result_grouped);

    this.prefix = parts[1];
    parts = parts[2].split('-');
    this.player1 = parts[0];
    this.player2 = parts[1];

    this.player1_label = result_label[this.player1];
    this.player2_label = result_label[this.player2];

    return this;
  }

  Result.prototype.print = _.template(
    '<%=this.prefix%>'+
    '<span class="result">'+
      '<span class="player1 <%=this.player1_label%>">'+
        '<%=this.player1%>'+
      '</span>'+
      '-'+
      '<span class="player2 <%=this.player2_label%>">'+
        '<%=this.player2%>'+
      '</span>'+
    '</span>'
  );


  // Move

  Move = function (string, player) {
    var move_group = string.match(r.grammar.move_grouped)
      , parts;

    this.prefix = move_group[1];

    if (move_group[2]) {
      parts = move_group[2].match(r.grammar.slide_grouped);
      this.is_slide = true;
      this.player = player;
      this.move = move_group[2];
      this.count_text = parts[1] || '';
      this.count = 1*this.count_text || 1;
      this.column = parts[2][0];
      this.row = parts[2][1]*1;
      this.direction = parts[3];
      this.drops_text = parts[4] || '',
      this.drops = parts[4] ? parts[4].split('').map(_.toInteger) : [1*parts[1] || 1],
      this.stone_text = parts[5] || '';
      this.stone = this.stone_text || 'F';
      this.evaluation = move_group[4] || '';
      this.print = this.print_slide;
    } else if(move_group[3]) {
      parts = move_group[3].match(r.grammar.place_grouped);
      this.is_slide = false;
      this.player = player;
      this.move = move_group[3];
      this.stone_text = parts[1] || '';
      this.stone = this.stone_text || 'F';
      this.column = parts[2][0];
      this.row = parts[2][1]*1;
      this.evaluation = move_group[4] || '';
      this.print = this.print_place;
    }

    return this;
  };

  Move.prototype.print_place = _.template(
    '<%=this.prefix%>'+
    '<span class="move place player<%=this.player%>" data-move="<%=this.id%>">'+
      '<% if (this.stone_text) { %>'+
        '<span class="stone"><%=this.stone_text%></span>'+
      '<% } %>'+
      '<span class="column"><%=this.column%></span>'+
      '<span class="row"><%=this.row%></span>'+
      '<% if (this.evaluation) { %>'+
      '<span class="evaluation"><%=this.evaluation%></span>'+
      '<% } %>'+
    '</span>'
  );

  Move.prototype.print_slide = _.template(
    '<%=this.prefix%>'+
    '<span class="move slide player<%=this.player%>" data-move="<%=this.id%>">'+
      '<span class="count_text"><%=this.count_text%></span>'+
      '<span class="column"><%=this.column%></span>'+
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


  // Linenum

  Linenum = function (string) {
    var parts = string.match(r.grammar.linenum_grouped);

    this.prefix = parts[1];
    this.text = parts[2];
    this.value = parseInt(this.text, 10);

    return this;
  };

  Linenum.prototype.print = _.template(
    '<%=this.prefix%>'+
    '<span class="linenum"><%=this.text%></span>'
  );


  Turn = function (string) {
    var parts = string.match(r.grammar.turn_grouped);

    this.linenum = new Linenum(parts[1]);

    this.comments1 = parse_comments(parts[2]);
    this.comments2 = parse_comments(parts[4]);
    this.comments3 = parse_comments(parts[6]);
    this.comments4 = parse_comments(parts[8]);

    this.move1 = new Move(parts[3], this.linenum.value == 1 ? 2: 1);
    this.move1.comments_before = this.comments1;
    this.move1.comments = this.comments2;

    if (parts[5]) {
      this.move2 = new Move(parts[5], this.linenum.value == 1 ? 1: 2);
      this.move2.comments = this.comments3;
    } else {
      this.move2 = null;
    }

    if (parts[7]) {
      this.result = new Result(parts[7]);
      this.result.comments = this.comments4;
    } else {
      this.result = null;
    }

    return this;
  };

  Turn.prototype.print = function(){
    var output = '<span class="turn">';

    output += this.linenum.print();
    if (this.comments1) {
      output += _.invokeMap(this.comments1, 'print').join('');
    }
    output += this.move1.print();
    if (this.comments2) {
      output += _.invokeMap(this.comments2, 'print').join('');
    }
    if (this.move2) {
      output += this.move2.print();
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

    return output + '</span>';
  };


  // Tag

  Tag = function (string) {
    var parts = string.match(r.grammar.tag_grouped);

    if (!parts) {
      m.error(t.error.invalid_tag({tag: string}));
      this.prefix = '';
      this.name = '';
      this.separator = '';
      this.value = '';
      this.value_print = '';
      this.suffix = string;
      return false;
    }

    this.prefix = parts[1];
    this.name = parts[2];
    this.separator = parts[3];
    this.value = parts[4];
    this.value_print = this.value;
    this.suffix = parts[5];

    this.key = this.name.toLowerCase();
    this.icon = tag_icons[this.key];

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

    if (this.key == 'result') {
      this.value_print = new Result(this.value).print();
    } else {
      this.value_print = this.value;
    }

    return this;
  };

  Tag.prototype.print = _.template(
    '<span class="tag">'+
      '<%=this.prefix%>'+
      '<i class="icon-<%=this.icon%>"></i>'+
      '<span class="name"><%=this.name%></span>'+
      '<%=this.separator%>'+
      '<span class="value <%=this.key%>"><%=this.value_print%></span>'+
      '<%=this.suffix%>'+
    '</span>'
  );


  // Game

  Game = function (string) {
    this.config = {};
    this.tags = [];
    this.turns = [];
    this.moves = [];
    this.ptn = '';
    this.callbacks_start = [];
    this.callbacks_end = [];

    if (string && string.length) {
      this.parse(string);
    }

    return this;
  };

  Game.prototype.on_parse_start = function (fn) {
    this.callbacks_start.push(fn);
  };

  Game.prototype.on_parse_end = function (fn) {
    this.callbacks_end.push(fn);
  };

  Game.prototype.parse = function (string, is_compressed) {
    var decompressed, header, body, i, file, tag, missing_tags;

    if (is_compressed) {
      decompressed = decompress(string);
      if (decompressed == this.ptn) {
        return false;
      } else {
        this.ptn = decompressed;
        this.ptn_compressed = string;
      }
    } else if (string == this.ptn) {
      return false;
    } else {
      this.ptn = string;
      this.ptn_compressed = compress(string);
    }

    _.invokeMap(this.callbacks_start, 'call', this, this);

    this.tags.length = 0;
    this.turns.length = 0;
    this.moves.length = 0;
    m.clear('error');

    file = this.ptn.match(r.grammar.ptn_grouped);
    if (!file) {
      m.error(t.error.invalid_file_format);
      return false;
    }

    header = file[1];
    this.comment = file[2] ? new Comment(file[2]) : '';
    body = file[3];
    this.suffix = file[4] || '';

    // Header

    header = header.match(r.grammar.header);
    if (!header) {
      m.error(t.error.invalid_header);
      return false;
    }
    header = header[0].match(r.grammar.tag);
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

    // Body

    body = body.match(r.grammar.body);
    if (!body) {
      m.error(t.error.invalid_body);
      return false;
    }
    body = body[0].match(r.grammar.turn);
    for (var i = 0; i < body.length; i++) {
      this.turns[i] = new Turn(body[i]);

      this.turns[i].move1.id = this.moves.length;
      this.moves.push(this.turns[i].move1);

      if (this.turns[i].move2) {
        this.turns[i].move2.id = this.moves.length;
        this.moves.push(this.turns[i].move2);
      }
    }

    _.invokeMap(this.callbacks_end, 'call', this, this);

    return true;
  };


  Game.prototype.print = function () {
    var output = '';

    output += _.invokeMap(this.tags, 'print').join('');
    output += this.comment ? this.comment.print() : '';
    output += _.invokeMap(this.turns, 'print').join('');
    output += this.suffix;

    return output;
  };

  return Game;

});
