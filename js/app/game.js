// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'app/messages', 'i18n!nls/main', 'lodash', 'lzstring'], function (r, Messages, t, _) {

  var Comment, Result, Ply, Linenum, Move, Tag, TPS, Game;
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

    game.config.result = this;

    if (!string.length) {
      this.print = function () {
        return '';
      };

      return false;
    }

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
        this.is_illegal = true;
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
      this.true_stone = this.stone == 'C' ? this.stone : 'F';
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
      this.is_illegal = true;
    }

    return this;
  };

  Ply.prototype.print_place = _.template(
    '<span class="space"><%=this.prefix%></span>'+
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
    '<span class="space"><%=this.prefix%></span>'+
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

  Linenum = function (string, game) {
    var parts = string.match(r.grammar.linenum_grouped);

    this.prefix = parts[1];
    this.value = game.get_linenum();
    this.text = ''+this.value + '.';

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

    this.linenum = new Linenum(parts[1], game, _.compact(parts.slice(2)).length);

    if (this.linenum.value == 1) {
      first_player = 2;
      second_player = 1;
    } else if(game.config.tps && this.linenum.value == game.config.tps.move){
      first_player = game.config.tps.player;
      second_player = first_player == 1 ? 2 : 1;
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
    var output = '<span class="move" data-id="'+this.linenum.value+'">';

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
    this.q2 = parts[6];
    this.suffix = parts[7];

    this.key = this.name.toLowerCase();
    this.icon = tag_icons[this.key] || 'circle';

    if (!(this.key in r.tags)) {
      m.error(t.error.invalid_tag({tag: parts[2]}));
      game.is_valid = false;
      return false;
    }

    if (!r.tags[this.key].test(this.value) && this.key != 'tps') {
      game.is_valid = false;
      return false;
    }

    if (this.key == 'result') {
      new Result(this.value, game);
      this.print_value = function() {
        return _.trim(game.config.result.print(game.config.result));
      };
    } else if(this.key == 'tps') {
      game.config.tps = new TPS(this.value, game);
      this.print_value = _.bind(game.config.tps.print, game.config.tps);
    }else{
      game.config[this.key] = this.value;
    }

    return this;
  };

  Tag.prototype.print = _.template(
    '<span class="tag">'+
      '<%=this.prefix%>'+
      '<i class="icon-<%=this.icon%>"></i>'+
      '<span class="name"><%=this.name%></span>'+
      '<%=this.separator%>'+
      '<span class="opening quote"><%=this.q1%></span>'+
      '<span class="value <%=this.q1 ? this.key : ""%>">'+
        '<%=this.print_value()%>'+
      '</span>'+
      '<span class="closing quote"><%=this.q2%></span>'+
      '<%=this.suffix%>'+
    '</span>'
  );

  Tag.prototype.print_value = function () {
    return ''+this.value;
  };


  // TPS

  TPS = function (string, game) {
    var parts = string.match(r.grammar.tps_grouped)
      , tps;

    this.is_valid = true;

    // Invalid
    if (!parts[1]) {
      m.error(t.error.invalid_tag_value({tag: t.TPS, value: string}));
      this.is_valid = false;
      game.is_valid = false;
      this.text = string;
      this.print = print_invalid;

      return false;
    }

    this.squares = parse_squares(this, parts[1], 1*game.config.size);
    this.space1 = parts[2];
    this.player = parts[3];
    this.space2 = parts[4];
    this.move = parts[5];
    this.suffix = parts[6];

    if (this.invalid_dimensions) {
      m.error(t.error.invalid_TPS_dimensions);
    } else if (this.suffix && /\S/.test(this.suffix)) {
      m.error(t.error.invalid_tag_value({tag: t.TPS, value: this.suffix}));
    } else if (!this.is_valid) {
      m.error(t.error.invalid_tag_value({
        tag: t.TPS,
        value: _.find(this.squares, {error: true}).text
      }));
    } else if (!this.player) {
      m.error(t.error.tps_missing_player);
    } else if (!this.move) {
      m.error(t.error.tps_missing_move);
    }

    this.player *= 1;
    this.move *= 1;

    return this;
  };

  TPS.prototype.print = _.template(
    '<%=_.invokeMap(this.squares, "print").join("")%>'+
    '<%=this.space1%>'+
    '<% if (this.player) { %>'+
      '<span class="player player<%=this.player%>">'+
        '<i class="icon-player-<%=this.player == 1 ? "solid" : "line"%>"></i>'+
        '<%=this.player%>'+
      '</span>'+
    '<% } %>'+
    '<%=this.space2%>'+
    '<% if (this.move) { %>'+
      '<span class="move"><i class="icon-round"></i><%=this.move%></span>'+
    '<% } %>'+
    '<span class="illegal"><%=this.suffix%></span>'
  );

  function parse_squares(tps, string, size) {
    var row = size - 1, col = 0
      , squares;

    var squares = _.map(
      _.compact(string.match(r.grammar.cols)),
      function (square, i) {
        square = new TPS.Square(square, row, col);

        if (col >= size || row < 0) {
          square.error = true;
          square.separator_error = square.separator == ',';
          tps.invalid_dimensions = true;
        }

        if (square.is_space) {
          col += square.count;
          if (col > size) {
            square.error = true;
            tps.invalid_dimensions = true;
          }
        } else {
          col++;
        }

        if (square.separator == '/') {
          if (col < size || row == 0) {
            square.separator_error = true;
            tps.invalid_dimensions = true;
          }

          row--;
          col = 0;
        } else if (square.separator == ',' && col == size) {
          square.separator_error = true;
          tps.invalid_dimensions = true;
        }

        return square;
      }
    );

    if (row != 0 || col < size) {
      tps.invalid_dimensions = true;
    }

    return squares || [];
  }

  TPS.Square = function (string, row, col) {
    var parts = string.match(r.grammar.col_grouped)
      , stack_parts;

    this.square = app.i_to_square(row, col);

    if (parts[2]) {
      this.is_space = false;
      this.print = this.print_stack;
      this.text = parts[2];

      stack_parts = this.text.match(r.grammar.stack_grouped);
      this.pieces = stack_parts[1].split('').concat(stack_parts[2]);
    } else {
      this.is_space = true;
      this.print = this.print_space;
      this.text = parts[1] || '';
      this.count = 1*this.text[1] || 1;
    }
    this.separator = parts[3];

    return this;
  }

  TPS.Square.prototype.print_space = _.template(
    '<span class="square space<%=this.error ? " illegal":""%>" data-square="<%=this.square%>" data-count="<%=this.count%>"><%=this.text%></span>'+
    '<span class="separator<%=this.separator_error ? " illegal":""%>"><%=this.separator%></span>'
  );

  TPS.Square.prototype.print_stack = _.template(
    '<span class="square stack<%=this.error ? " illegal":""%>" data-square="<%=this.square%>">'+
      '<% _.map(this.pieces, function(piece, i) { %>'+
        '<span class="piece player<%=piece[0]%>">'+
          '<%=piece%>'+
        '</span>'+
      '<% }).join("") %>'+
    '</span>'+
    '<span class="separator<%=this.separator_error ? " illegal":""%>"><%=this.separator%></span>'
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
    }
    missing_tags = _.difference(
      r.required_tags,
      _.map(this.tags, 'key')
    );
    if (missing_tags.length) {
      m.error(t.error.missing_tags({tags: missing_tags}));
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

  return Game;

});
