// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'app/messages', 'i18n!nls/main', 'lodash', 'lzstring'], function (r, Messages, t, _) {

  var Comment, Result, Ply, Linenum, Move, Tag, Game;
  var m = new Messages('parse');

  var result_label = {
    '0': 'loss',
    '1': 'win',
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
    'time': 'time',
    'clock': 'timer'
  };

  var compress = LZString.compressToEncodedURIComponent
    , decompress = LZString.decompressFromEncodedURIComponent;

  var print_invalid = _.template(
    '<span class="invalid">'+
      '<%=this.text.replace(/(\\S)/, \'<span class="first-letter">$1</span>\')%>'+
    '</span>'
  );

  // Comment

  Comment = function (string) {
    var parts = string.match(r.grammar.comment_grouped);

    if (!parts) {
      this.prefix = string;
      this.text = '';
      this.suffix = '';
      return this;
    }

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

  Result = function (string, game) {
    var parts = string.match(r.grammar.result_grouped);

    this.prefix = parts[1];
    parts = parts[2].split('-');
    this.player1 = parts[0];
    this.player2 = parts[1];

    if (this.player2 == '0') {
      this.victor = 1;
      this.text = t.result[this.player1]({ player: game.config.player1 });
    } else if (this.player1 == '0') {
      this.victor = 2;
      this.text = t.result[this.player2]({ player: game.config.player2 });
    } else {
      this.victor = 2;
      this.text = t.result.tie;
    }

    this.player1_label = result_label[this.player1];
    this.player2_label = result_label[this.player2];

    game.result = this;
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


  // Ply

  Ply = function (string, player, game) {
    var ply_group = string.match(r.grammar.ply_grouped)
      , parts;

    this.prefix = ply_group[1];

    if (ply_group[2]) {

      // Slide
      parts = ply_group[2].match(r.grammar.slide_grouped);
      this.print = this.print_slide;
      this.is_slide = true;
      this.player = player;
      this.ply = ply_group[2];
      this.count_text = parts[1] || '';
      this.count = 1*this.count_text || 1;
      this.col = parts[2][0];
      this.row = parts[2][1]*1;
      this.square = this.col+this.row;
      this.squares = [];
      this.direction = parts[3];
      this.drops_text = parts[4] || '',
      this.drops = parts[4] ? parts[4].split('').map(_.toInteger) : [this.count];
      this.flattens = {};
      this.stone_text = parts[5] || '';
      this.evaluation = ply_group[4] || '';
      if (_.sum(this.drops) != this.count) {
        m.error(t.error.invalid_ply({ply: this.ply}));
        this.mark_illegal();
      }
    } else if(ply_group[3]) {

      // Place
      parts = ply_group[3].match(r.grammar.place_grouped);
      this.print = this.print_place;
      this.is_slide = false;
      this.player = player;
      this.ply = ply_group[3];
      this.stone_text = parts[1] || '';
      this.stone = this.stone_text || 'F';
      this.col = parts[2][0];
      this.row = parts[2][1]*1;
      this.square = this.col+this.row;
      this.squares = [];
      this.evaluation = ply_group[4] || '';
    }

    if (
      this.row > game.config.size ||
      (this.col.charCodeAt(0) - '`'.charCodeAt(0)) > game.config.size
    ) {
      game.is_valid = false;
      m.error(t.error.invalid_square({square: this.col+this.row}));
    }

    return this;
  };

  Ply.prototype.mark_illegal = function () {
    this.is_illegal = true;
  };

  Ply.prototype.print_place = _.template(
    '<%=this.prefix%>'+
    '<span class="ply <%=this.is_illegal ? "illegal" : ""%> player<%=this.player%>" data-ply="<%=this.id%>">'+
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
    '<%=this.prefix%>'+
    '<span class="ply <%=this.is_illegal ? "illegal" : ""%> player<%=this.player%>" data-ply="<%=this.id%>">'+
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


  // Move

  Move = function (string, game) {
    var parts = string.match(r.grammar.move_grouped)
      , first_player = 1
      , second_player = 2;

    if (parts[9]) {
      game.is_valid = false;
      this.text = string;
      this.print = print_invalid;
      m.error(t.error.invalid_movetext({text: _.trim(string)[0]}));
      return this;
    }

    this.linenum = new Linenum(parts[1]);

    if(game.config.tps && this.linenum.value == game.config.tps.move){
      first_player = game.config.tps.player;
      second_player = first_player == 1 ? 2 : 1;
      if (this.linenum.value == 1) {
        first_player = second_player;
        second_player = first_player == 1 ? 2 : 1;
      }
    } else if (this.linenum.value == 1) {
      first_player = 2;
      second_player = 1;
    }

    this.comments1 = parse_comments(parts[2]);
    this.comments2 = parse_comments(parts[4]);
    this.comments3 = parse_comments(parts[6]);
    this.comments4 = parse_comments(parts[8]);

    if (parts[3]) {
      this.ply1 = new Ply(parts[3], first_player, game);
    } else {
      this.ply1 = null;
    }
    if (this.comments2) {
      if (this.comments1) {
        this.ply1.comments = _.map(this.comments1, 'text').concat(
          _.map(this.comments2, 'text')
        );
      } else {
        this.ply1.comments = _.map(this.comments2, 'text');
      }
    }

    if (parts[5]) {
      this.ply2 = new Ply(parts[5], second_player, game);
      this.ply2.comments = _.map(this.comments3, 'text');
    } else {
      this.ply2 = null;
    }

    if (parts[7]) {
      this.result = new Result(parts[7], game);
      this.result.comments = _.map(this.comments4, 'text');
    } else {
      this.result = null;
    }

    return this;
  };

  Move.prototype.print = function(){
    var output = '<span class="move">';

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
    output += '</span>';

    return output;
  };


  // Tag

  Tag = function (string, game) {
    var parts = string.match(r.grammar.tag_grouped);

    if (!parts) {
      game.is_valid = false;
      this.text = string;
      this.print = print_invalid;
      m.error(t.error.invalid_tag({tag: _.truncate(string, {length: 5})}));
      return this;
    }

    this.prefix = parts[1];
    this.name = parts[2];
    this.separator = parts[3];
    this.q1 = parts[4];
    this.value = parts[5];
    this.value_print = this.value;
    this.q2 = parts[6];
    this.suffix = parts[7];

    this.key = this.name.toLowerCase();
    this.icon = tag_icons[this.key] || 'circle';

    if (!(this.key in r.tags)) {
      m.error(t.error.invalid_tag({tag: parts[2]}));
      game.is_valid = false;
      return false;
    }

    if (!r.tags[this.key].test(this.value)) {
      if (this.key != 'tps') {
        m.error(
          t.error.invalid_tag_value({tag: this.name, value: this.value})
        );
      }
      game.is_valid = false;
      return false;
    }

    if (this.key == 'result' && this.value) {
      this.value_print = new Result(this.value, game).print();
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
      '<%=this.separator%><%=this.q1%>'+
      '<span class="value <%=this.q1 ? this.key : ""%>">'+
        '<%=this.value_print%>'+
      '</span>'+
      '<%=this.q2%><%=this.suffix%>'+
    '</span>'
  );


  // Game

  Game = function (simulator) {
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

  Game.prototype.parse = function (string, is_compressed) {
    var decompressed, header, body, i, file, tag, missing_tags, tps;

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

    this.is_valid = true;
    this.result = null;
    this.tags.length = 0;
    this.moves.length = 0;
    this.plys.length = 0;
    m.clear('error');

    file = this.ptn.match(r.grammar.ptn_grouped);
    if (!file) {
      m.error(t.error.invalid_file_format);
      this.is_valid = false;
      return false;
    }

    header = file[1];
    this.comment_text = parse_comments(file[2]);
    this.comments = this.comment_text ? _.map(this.comment_text, 'text') : null;
    body = file[3];
    this.suffix = file[4] || '';

    // Header
    header = header.match(r.grammar.header);
    if (!header) {
      m.error(t.error.invalid_header);
      this.is_valid = false;
      return false;
    }
    header = header[0].match(r.grammar.tag);
    this.config = {};
    for (var i = 0; i < header.length; i++) {
      this.tags[i] = new Tag(header[i], this);
      this.config[this.tags[i].key] = this.tags[i].value;
    }
    missing_tags = _.difference(
      r.required_tags,
      _.map(this.tags, 'key')
    );
    if (missing_tags.length) {
      m.error(t.error.missing_tags({tags: missing_tags}));
      this.is_valid = false;
    }

    // TPS
    if (this.config.tps) {
      tps = this.config.tps.match(r.grammar.tps_grouped);
      if (!tps) {
        m.error(t.error.invalid_tag_value({tag: t.TPS, value: this.config.tps}));
        return false;
      } else {
        this.config.tps = {
          board: _.invokeMap(tps[1].split(/\//g), 'split', /,/g),
          player: 1*tps[2],
          move: 1*tps[3]
        };
      }
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

        if (this.moves[i].result) {
          (this.moves[i].ply2 || this.moves[i].ply1).result = this.moves[i].result;
        }
      }

      if (this.plys.length) {
        _.last(this.plys).is_last = true;
      }
    }

    this.simulator.validate(this);

    _.invokeMap(this.callbacks_end, 'call', this, this);

    return true;
  };


  Game.prototype.print = function () {
    var output = '';

    output += _.invokeMap(this.tags, 'print').join('');
    output += this.comment_text ? _.invokeMap(this.comment_text, 'print').join('') : '';
    output += _.invokeMap(this.moves, 'print').join('');
    output += this.suffix;

    return output;
  };

  return Game;

});
