// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/board/piece',
  'app/board/square',
  'app/config',
  'app/messages',
  'i18n!nls/main',
  'lodash'
], function (Piece, Square, config, Messages, t, _) {

  var Board = function (game) {
    this.ply = 0;
    this.size = 5;
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.all_pieces = [];
    this.pieces = {};
    this.init_callbacks = [];
    this.ply_callbacks = [];

    if (game) {
      this.init(game);
    }

    return this;
  };

  Board.prototype.on_init = function (fn) {
    this.init_callbacks.push(fn);
    return this;
  };

  Board.prototype.on_ply = function (fn) {
    this.ply_callbacks.push(fn);
    return this;
  };

  Board.prototype.clear = function () {
    this.ply = 0;
    this.squares = {};
    this.all_pieces = [];
    this.pieces = {
      1: {
        F: [],
        C: []
      },
      2: {
        F: [],
        C: []
      }
    };

    this.rows.length = 0;
    this.cols.length = 0;
  };

  Board.prototype.init = function (game, silent) {
    var that = this
      , i, j, row, col, col_letter, square, piece, tps
      , a = 'a'.charCodeAt(0);

    if (silent !== true) {
      _.invokeMap(this.callbacks_start, 'call', this, this);
      this.m.clear(false, true);
      this.pause();
    }

    this.defer_render = true;
    this.game = game;
    this.size = 1*game.config.size;
    this.piece_counts = _.clone(app.piece_counts[this.size]);
    this.tps = game.config.tps && game.config.tps.is_valid ? game.config.tps : undefined;

    this.saved_ply = this.ply;
    this.clear();

    if (!this.piece_counts) {
      return false;
    }

    for (col = 0; col < this.size; col++) {
      col_letter = String.fromCharCode(a + col);
      this.cols[col] = col_letter;
    }

    for (row = 0; row < this.size; row++) {
      this.rows[row] = row + 1;
    }

    // Create all the squares and label the neighbors
    for (row = 0; row < this.size; row++) {
      for (col = 0; col < this.size; col++) {
        square = new Square(this, row, col);
        this.squares[square.square] = square;
        if (row) {
          square.neighbors['-'] = this.squares[app.i_to_square(row-1, col)];
          this.squares[app.i_to_square(row-1, col)].neighbors['+'] = square;
        }
        if (col) {
          square.neighbors['<'] = this.squares[app.i_to_square(row, col-1)];
          this.squares[app.i_to_square(row, col-1)].neighbors['>'] = square;
        }
      }
    }

    // Create all the pieces
    _.each(this.pieces, function (stones, player) {
      _.each(stones, function (count, stone) {
        while (that.pieces[player][stone].length < that.piece_counts[stone]) {
          new Piece(that, player, stone);
        }
      })
    });

    // Parse TPS
    if (this.tps) {
      _.each(this.tps.squares, function (square) {
        if (!square.is_space && !square.error) {
          if (!that.squares[square.square].parse(square.text)) {
            that.invalid_tps(square);
          }
        }
      });
    }

    if (silent !== true) {
      this.defer_render = false;
      _.invokeMap(this.init_callbacks, 'call', this, this);
    }

    return true;
  };

  Board.prototype.validate = function (game) {
    this.init(game, true);
    this.go_to_ply(game.plys.length, true);
    this.clear();
  };

  Board.prototype.to_tps = function () {
    var squares = []
      , i, j;

    for (i = 0; i < this.size; i++) {
      squares[i] = [];
      for (j = 0; j < this.size; j++) {
        squares[i][j] = this.squares[app.i_to_square(this.size - 1 - i, j)].to_tps();
      }
      squares[i] = squares[i].join(',');
    }
    squares = squares.join('/');

    squares = squares.replace(/x(\d?),x/g, function (count) {
      if (count) {
        return 'x'+(count + 1);
      } else {
        return 'x2';
      }
    });

    return squares + ' ' +this.game.player+ ' ' + this.game.moves.length + 1;
  };

  Board.prototype.render = function () {
    this.$view = $(this.tpl.board(this));
    this.$squares = this.$view.find('.squares');
    this.$pieces = this.$view.find('.pieces');

    this.$squares.append.apply(
      this.$squares,
      _.invokeMap(this.squares, 'render')
    );

    this.$pieces.empty();
    _.invokeMap(
      _.filter(this.all_pieces, {captive: null}),
      'render'
    );

    this.go_to_ply(this.saved_ply || 0);

    return this.$view;
  };

  Board.prototype.update = function() {
    _.invokeMap(
      _.filter(this.all_pieces, { needs_updated: true }),
      'render'
    );
  };

  Board.prototype.do_ply = function () {
    var ply, square, piece, ply_result;

    if (this.ply >= this.game.plys.length || this.ply < 0) {
      return false;
    }

    ply = this.game.plys[this.ply++];
    square = this.squares[ply.square];

    if (ply.is_illegal) {
      this.pause();
      this.ply -= 1;
      return false;
    }

    if (this.ply == 0) {
      this.show_comments(0);
    } else {
      this.show_comments(ply);
    }

    _.invokeMap(this.ply_callbacks, 'call', this, this.ply - 1);


    if (ply.is_nop) {
      ply_result = true;
    } else if (ply.is_slide) {
      ply_result = square.slide(ply);
    } else {
      ply_result = square.place(ply);
    }

    this.set_active_squares(ply.squares);

    if (this.ply == this.game.plys.length) {
      this.pause();
    }

    return ply_result;
  };

  Board.prototype.undo_ply = function () {
    var ply, square, piece;

    if (this.ply > this.game.plys.length || this.ply <= 0) {
      return false;
    }

    ply = this.game.plys[--this.ply];
    square = this.squares[ply.square];

    if (ply.is_illegal) {
      this.ply += 1;
      return false;
    }

    if (this.ply == 0) {
      this.show_comments(0);
      this.set_active_squares(ply.squares);
    } else {
      this.show_comments(this.game.plys[this.ply - 1]);
      this.set_active_squares(this.game.plys[this.ply - 1].squares);
    }

    _.invokeMap(this.ply_callbacks, 'call', this, this.ply - 1);

    if (ply.is_nop) {
      return true;
    } else if (ply.is_slide) {
      return square.undo_slide(ply);
    } else {
      return square.undo_place(ply);
    }
  };

  Board.prototype.illegal_ply = function (ply) {
    this.m_parse.error(
      t.error.illegal_ply({ ply: ply.ply })
    );
    ply.is_illegal = true;
    return false;
  };

  Board.prototype.invalid_tps = function (square) {
    this.m_parse.error(
      t.error.invalid_tag_value({tag: t.TPS, value: square.text})
    );
    square.error = true;

    return false;
  };

  Board.prototype.set_active_squares = function (squares) {
    if (this.$view) {
      this.$squares.children().removeClass('active');
      _.invokeMap(squares, 'set_active');
    }
  };

  Board.prototype.show_comments = function (ply) {
    var result = this.game.config.result;

    this.m.clear(false, true);

    if (ply === 0) {
      if (this.game.comments) {
        _.map(this.game.comments, this.comment);
      }
      this.m.player1(this.game.config.player1);
      this.m.player2(this.game.config.player2);
    }

    if (!ply || this.defer_render) {
      return;
    }

    if (ply && ply.evaluation && /['"]/.test(ply.evaluation)) {
      this.m['player'+ply.player](/"|''/.test(ply.evaluation) ? t.Tinue : t.Tak);
    }

    if (ply && ply.evaluation && /[!?]/.test(ply.evaluation)) {
      this.comment(ply.evaluation.replace(/[^!?]/g, ''));
    }

    if (ply.comments) {
      _.map(ply.comments, this.comment);
    }

    if (ply.is_last && result && result.text) {
      this.m['player'+result.victor](result.text);
      if (result.comments) {
        _.map(result.comments, this.comment);
      }
    }
  };

  Board.prototype.play = function () {
    if (this.do_ply() && this.game.plys[this.ply]) {
      this.play_timer = setInterval(_.bind(this.do_ply, this), 6e4/config.play_speed);
      this.is_playing = true;
      $('body').addClass('playing');
    }
  };

  Board.prototype.pause = function () {
    clearInterval(this.play_timer);
    this.is_playing = false;
    $('body').removeClass('playing');
  };

  Board.prototype.playpause = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (this.is_playing) {
      this.pause();
    } else {
      this.play();
    }
  };

  Board.prototype.prev = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.pause();
    this.undo_ply();
  };

  Board.prototype.next = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.pause();
    this.do_ply();
  };

  Board.prototype.prev_move = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.pause();
    this.go_to_ply(this.ply + 2);
  };

  Board.prototype.next_move = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.pause();
    this.go_to_ply(this.ply - 2);
  };

  Board.prototype.first = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.pause();
    this.go_to_ply(0);
  };

  Board.prototype.last = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.pause();
    this.go_to_ply(this.game.plys.length);
  };

  Board.prototype.go_to_ply = function (ply, is_silent) {
    this.defer_render = true;
    if (ply > this.ply) {
      while (this.ply < ply && this.do_ply()) {}
    } else if (ply < this.ply) {
      while (this.ply > ply && this.undo_ply()) {}
    }

    if (is_silent !== true) {
      this.defer_render = false;

      if (ply <= 0) {
        this.show_comments(0);
        if (this.$view) {
          this.$squares.children().removeClass('active');
        }
      } else {
        this.show_comments(this.game.plys[this.ply - 1]);
      }

      this.update();
    }
  };

  Board.prototype.tpl = {
    row: _.template('<span class="row"><%=obj%></span>'),

    col: _.template('<span class="col"><%=obj%></span>'),

    square: _.template(
      '<div class="square c<%=col%> r<%=row%> <%=color%>">'+
        '<div class="road">'+
          '<div class="up"></div>'+
          '<div class="down"></div>'+
          '<div class="left"></div>'+
          '<div class="right"></div>'+
        '</div>'+
      '</div>'
    ),

    stone_class: _.template('stone p<%=player%> <%=stone%>'),
    piece_location: _.template(
      'translate(<%=x%>%, <%=y%>%) scale(<%=scale%>) rotate(<%=rotate%>deg)'
    ),
    piece: _.template(
      '<div class="piece">'+
        '<div class="wrapper">'+
          '<div class="captive p<%=player%>"></div>'+
          '<div class="<%=tpl.stone_class(obj)%>"></div>'+
        '</div>'+
      '</div>'
    ),

    board: _.template(
      '<div class="board size-<%=size%>">'+
        '<div class="row labels">'+
          '<%=_.map(rows, tpl.row).join("")%>'+
        '</div>'+
        '<div class="col labels">'+
          '<%=_.map(cols, tpl.col).join("")%>'+
        '</div>'+
        '<div class="squares"></div>'+
        '<div class="pieces"></div>'+
      '</div>'
    )
  };

  Board.prototype.m = new Messages('board');
  Board.prototype.m_parse = new Messages('parse');
  Board.prototype.comment = _.ary(_.bind(
    Board.prototype.m.comment, Board.prototype.m
  ), 1);

  Board.prototype.opposite_direction = {
    '+': '-',
    '-': '+',
    '<': '>',
    '>': '<'
  };

  Board.prototype.direction_name = {
    '+': 'up',
    '-': 'down',
    '<': 'left',
    '>': 'right'
  };

  return Board;

});
