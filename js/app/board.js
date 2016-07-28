// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/config',
  'app/board/piece',
  'app/board/square',
  'app/messages',
  'i18n!nls/main',
  'lodash'
], function (config, Piece, Square, Messages, t, _) {

  var Board = function (game) {
    this.ply_id = 0;
    this.ply_is_done = false;
    this.comments_ply_id = -2;
    this.size = 5;
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.all_pieces = [];
    this.pieces = {};
    this.flat_score = {1:0, 2:0};
    this.init_callbacks = [];
    this.ply_callbacks = [];

    if (game) {
      this.init(game);
    }

    return this;
  };

  Board.prototype.on_init = function (fn) {
    if (fn) {
      this.init_callbacks.push(fn);
    } else {
      _.invokeMap(this.init_callbacks, 'call', this, this);
    }

    return this;
  };

  Board.prototype.on_ply = function (fn) {
    if (fn) {
      this.ply_callbacks.push(fn);
    } else {
      _.invokeMap(this.ply_callbacks, 'call', this, this.game.plys[this.ply_id]);
    }

    return this;
  };

  Board.prototype.clear = function () {
    this.ply_id = 0;
    this.ply_is_done = false;
    this.comments_ply_id = -2;
    this.squares = {};
    this.all_pieces = [];
    this.flat_score[1] = 0;
    this.flat_score[2] = 0;
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
      this.m.clear(false, true);
      this.pause();
    }

    this.defer_render = true;
    this.game = game;
    this.size = 1*game.config.size;
    this.piece_counts = _.clone(app.piece_counts[this.size]);
    this.tps = game.config.tps && game.config.tps.is_valid ? game.config.tps : undefined;

    this.saved_ply_id = this.ply_id;
    this.saved_ply_is_done = this.ply_is_done;
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
      this.on_init();
    }

    return true;
  };

  Board.prototype.validate = function (game) {
    this.init(game, true);
    this.go_to_ply(game.plys.length, true, true);
    this.clear();
  };

  Board.prototype.trim_to_current_ply = function () {
    if (this.game.plys.length) {
      this.game.trim_to_current_ply(this);
    }
  };

  Board.prototype.to_tps = function () {
    var ply = this.game.plys[this.ply_id] || this.game.plys[this.ply_id - 1]
      , squares = []
      , i, j;

    this.do_ply();

    for (i = 0; i < this.size; i++) {
      squares[i] = [];
      for (j = 0; j < this.size; j++) {
        squares[i][j] = this.squares[app.i_to_square(this.size - 1 - i, j)].to_tps();
      }
      squares[i] = squares[i].join(',');
    }
    squares = squares.join('/');

    squares = squares.replace(/x((?:,x)+)/g, function (spaces) {
      return 'x'+(1 + spaces.length)/2;
    });

    return squares + ' ' +
      (ply ? ply.turn - 1 || 2 : 1) +
      ' ' +
      (ply.move.id + 1 + 1*(ply.turn == 2));
  };

  Board.prototype.render = function () {
    this.$view = $(this.tpl.board(this));
    this.$squares = this.$view.find('.squares');
    this.$pieces = this.$view.find('.pieces');
    this.$ply1 = this.$view.find('.scores .player1 .ptn');
    this.$ply2 = this.$view.find('.scores .player2 .ptn');
    this.$score1 = this.$view.find('.scores .player1 .score');
    this.$score2 = this.$view.find('.scores .player2 .score');

    this.$squares.append.apply(
      this.$squares,
      _.invokeMap(this.squares, 'render')
    );

    this.$pieces.empty();
    _.invokeMap(
      _.filter(this.all_pieces, {captive: null}),
      'render'
    );

    this.go_to_ply(
      _.isUndefined(this.saved_ply_id) ? 0 : this.saved_ply_id,
      this.saved_ply_is_done
    );

    return this.$view;
  };

  Board.prototype.update_view = function() {
    _.invokeMap(
      _.filter(this.all_pieces, { needs_updated: true }),
      'render'
    );

    this.update_scores();
    this.on_ply();
  };

  Board.prototype.update_plys = function(current_ply) {
    var ply1, ply2;

    this.$ply2.removeClass('active');
    this.$ply1.removeClass('active');

    if (current_ply) {
      ply1 = current_ply.move.ply1;
      ply2 = current_ply.move.ply2;
    }

    if (ply1) {
      if (ply1.turn == 1) {
        this.$ply1.html(ply1.print());
        if (ply1 == current_ply) {
          this.$ply1.addClass('active');
        }
      } else {
        this.$ply1.empty();
        ply2 = ply1;
      }
    }
    if (ply2) {
      this.$ply2.html(ply2.print());
      if (ply2 == current_ply) {
        this.$ply2.addClass('active');
      }
    }
  };

  Board.prototype.update_scores = function() {
    this.$score1.text(this.flat_score[1]);
    this.$score2.text(this.flat_score[2]);
  };

  Board.prototype.do_ply = function () {
    var ply, square, piece, ply_result;

    if (this.ply_is_done) {
      return true;
    }

    if (this.ply_id >= this.game.plys.length || this.ply_id < 0) {
      return false;
    }

    ply = this.game.plys[this.ply_id];
    square = this.squares[ply.square];

    if (ply.is_illegal) {
      this.pause();
      return false;
    }

    if (ply.is_nop) {
      ply_result = true;
    } else if (ply.is_slide) {
      ply_result = square.slide(ply);
    } else {
      ply_result = square.place(ply);
    }

    this.ply_is_done = true;

    if (!this.defer_render) {
      this.on_ply();
    }

    if (ply.is_last) {
      this.pause();
    }

    return ply_result;
  };

  Board.prototype.undo_ply = function () {
    var ply, square, piece, ply_result;

    if (!this.ply_is_done) {
      return true;
    }

    if (this.ply_id > this.game.plys.length || this.ply_id < 0) {
      return false;
    }

    ply = this.game.plys[this.ply_id];
    square = this.squares[ply.square];

    if (ply.is_nop) {
      ply_result = true;
    } else if (ply.is_slide) {
      ply_result = square.undo_slide(ply);
    } else {
      ply_result = square.undo_place(ply);
    }

    this.ply_is_done = false;

    if (!this.defer_render) {
      this.on_ply();
    }

    return ply_result;
  };

  Board.prototype.illegal_ply = function (ply) {
    this.m_parse.error(
      t.error.illegal_ply({ ply: ply.text })
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
      if (squares) {
        _.invokeMap(squares, 'set_active');
      }
    }
  };

  Board.prototype.show_comments = function (ply) {
    var result = this.game.config.result;

    if (this.defer_render) {
      return;
    }

    if (
      this.game.comments && this.comments_ply_id != -1 &&
      (!ply || ply.is_first && !this.ply_is_done)
    ) {
      this.m.clear(false, true);
      _.map(this.game.comments, this.comment);
      this.comments_ply_id = -1;
      return;
    }

    if (ply && this.comments_ply_id == ply.id) {
      return;
    }

    this.m.clear(false, true);

    if (!ply) {
      return;
    }

    this.comments_ply_id = ply.id;

    if (ply.evaluation && /['"]/.test(ply.evaluation)) {
      this.m['player'+ply.player](/"|''/.test(ply.evaluation) ? t.Tinue : t.Tak);
    }

    if (ply.evaluation && /[!?]/.test(ply.evaluation)) {
      this.comment(ply.evaluation.replace(/[^!?]/g, ''));
    }

    if (ply.comments) {
      _.map(ply.comments, this.comment);
    }

    if (ply.is_last && result && result.message) {
      this.m['player'+result.victor](result.message);
      if (result.comments) {
        _.map(result.comments, this.comment);
      }
    }
  };

  Board.prototype.play = function () {
    if (this.do_ply() && this.game.plys[this.ply_id]) {
      this.play_timer = setInterval(this.next, 6e4/config.play_speed);
      this.is_playing = true;
      app.$html.addClass('playing');
    }
  };

  Board.prototype.pause = function () {
    clearInterval(this.play_timer);
    this.is_playing = false;
    app.$html.removeClass('playing');
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

      this.pause();
    }

    this.undo_ply();
    if (this.ply_id) {
      this.ply_id--;
      this.ply_is_done = true;
    }
  };

  Board.prototype.next = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();

      this.pause();
    }

    if (this.ply_is_done && this.ply_id < this.game.plys.length - 1) {
      this.ply_id++;
      this.ply_is_done = false;
    }
    return this.do_ply();
  };

  Board.prototype.prev_move = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.go_to_ply(this.ply_id - 2, this.ply_is_done && this.ply_id > 1);
  };

  Board.prototype.next_move = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.go_to_ply(this.ply_id + 2, this.ply_is_done);
  };

  Board.prototype.first = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.go_to_ply(0, false);
  };

  Board.prototype.last = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.go_to_ply(this.game.plys.length, true);
  };

  Board.prototype.go_to_ply = function (ply_id, do_ply, is_silent) {
    this.pause();
    this.defer_render = true;

    if (ply_id < 0) {
      do_ply = false;
    } else if (ply_id >= this.game.plys.length) {
      do_ply = true;
    }

    ply_id = Math.min(this.game.plys.length - 1, Math.max(0, ply_id));

    while (this.ply_id < ply_id && this.do_ply()) {
      this.ply_id++;
      this.ply_is_done = false;
    }
    while (this.ply_id > ply_id && this.undo_ply()) {
      this.ply_id--;
      this.ply_is_done = true;
    }

    if (do_ply) {
      this.do_ply();
    } else {
      this.undo_ply();
    }

    if (is_silent !== true) {
      this.defer_render = false;
      this.update_view();
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
        '<div class="scores">'+
          '<span class="player1">'+
            '<span class="name"><%=game.config.player1%></span>'+
            '<span class="ptn"></span>'+
            '<span class="score"><%=flat_score[1]%></span>'+
          '</span>'+
          '<span class="player2">'+
            '<span class="score"><%=flat_score[2]%></span>'+
            '<span class="ptn"></span>'+
            '<span class="name"><%=game.config.player2%></span>'+
          '</span>'+
        '</div>'+
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

  Board.prototype.m = new Messages('board', config.show_annotations);
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
