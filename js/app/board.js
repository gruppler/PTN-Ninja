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
    var that = this;

    this.ply_index = 0;
    this.ply_is_done = false;
    this.comments_ply_index = -2;
    this.size = 5;
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.all_pieces = [];
    this.pieces = {};
    this.flat_score = {1:0, 2:0};
    this.init_callbacks = [];
    this.resize_callbacks = [];
    this.ply_callbacks = [];

    _.bindAll(this, [
      'resize',
      'update_view',
      'reposition_pieces',
      'rotate',
      'play',
      'pause',
      'playpause',
      'prev',
      'next',
      'prev_ply',
      'next_ply',
      'prev_move',
      'next_move',
      'first',
      'last'
    ]);

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


  Board.prototype.on_resize = function (fn) {
    if (fn) {
      this.resize_callbacks.push(fn);
    } else {
      _.invokeMap(this.resize_callbacks, 'call', this, this);
    }

    return this;
  };


  Board.prototype.on_ply = function (fn) {
    if (fn) {
      this.ply_callbacks.push(fn);
    } else {
      _.invokeMap(this.ply_callbacks, 'call', this, this.game.plys[this.ply_index]);
    }

    return this;
  };


  Board.prototype.clear = function () {
    this.ply_index = 0;
    this.ply_is_done = false;
    this.comments_ply_index = -2;
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
      this.m.clear();
      this.pause();
    }

    this.defer_render = true;
    this.game = game;
    this.size = 1*game.config.size;
    this.piece_counts = _.clone(app.piece_counts[this.size]);
    this.tps = game.config.tps && game.config.tps.is_valid ? game.config.tps : undefined;

    this.saved_ply_index = this.ply_index;
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
          square.neighbors['-'] = this.squares[app.i_to_square([col, row-1])];
          this.squares[app.i_to_square([col, row-1])].neighbors['+'] = square;
        }
        if (col) {
          square.neighbors['<'] = this.squares[app.i_to_square([col-1, row])];
          this.squares[app.i_to_square([col-1, row])].neighbors['>'] = square;
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
    if (this.init(game, true)) {
      this.go_to_ply(game.plys.length, true, true);
      this.clear();
      return true;
    } else {
      return false;
    }
  };


  Board.prototype.trim_to_current_ply = function () {
    if (this.game.plys.length) {
      this.game.trim_to_current_ply(this);
    }
  };


  Board.prototype.to_tps = function () {
    var ply = this.game.plys[this.ply_index] || this.game.plys[this.ply_index - 1]
      , squares = []
      , i, j;

    this.do_ply();

    for (i = 0; i < this.size; i++) {
      squares[i] = [];
      for (j = 0; j < this.size; j++) {
        squares[i][j] = this.squares[
          app.i_to_square([j, this.size - 1 - i])
        ].to_tps();
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
      (ply.move.linenum.value + (ply.turn == 2));
  };


  Board.prototype.render = function () {
    var that = this;

    this.$view = $(this.tpl.board(this));
    this.$board = this.$view.find('.board');
    this.$unplayed_bg = this.$view.find('.unplayed-bg').parent();
    this.$row_labels = this.$view.find('.row.labels');
    this.$col_labels = this.$view.find('.col.labels');
    this.$squares = this.$view.find('.squares');
    this.$pieces = this.$view.find('.pieces');
    this.$ptn = this.$view.find('.ptn');
    this.$ptn.$prev_move = this.$ptn.find('.prev_move');
    this.$ptn.$next_move = this.$ptn.find('.next_move');
    this.$scores = this.$view.find('.scores');
    this.$bar1 = this.$scores.find('.player1');
    this.$bar2 = this.$scores.find('.player2');
    this.$score1 = this.$bar1.find('.score');
    this.$score2 = this.$bar2.find('.score');

    this.rotate();

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
      _.isUndefined(this.saved_ply_index) ? 0 : this.saved_ply_index,
      this.saved_ply_is_done
    );

    this.$ptn.on('click tap', '.ply', function (event) {
      var $ply = $(event.currentTarget)
        , ply_index = $ply.data('index');

      that.go_to_ply(
        ply_index,
        that.ply_index != ply_index
          || !that.ply_is_done
      );
    }).on('click tap', '.prev_move', this.prev_move)
      .on('click tap', '.next_move', this.next_move);

    return this.$view;
  };


  Board.prototype.resize = function (from_config) {
    if (!this.$view) {
      return;
    }

    var vw = app.$viewer.width()
      , vh = app.$viewer.height()
      , board_config = config[app.mode]
      , unplayed_ratio = board_config.show_unplayed_pieces ?
          1 + 1.75/this.size : 1
      , axis_width = 16
      , margin, width, height, size, unplayed_size;

    // Subtract enabled board elements' dimensions
    // to find remaining available proportional board space
    width = vw;
    height = vh;

    if (!config.board_only) {
      width -= 32;
      height -= 32;
    }

    if (board_config.show_axis_labels) {
      axis_width = this.$row_labels.width();
      width -= axis_width;
      height -= this.$col_labels.outerHeight();
    }
    if (board_config.show_flat_counts) {
      height -= this.$scores.outerHeight();
    }
    if (board_config.show_current_move) {
      height -= this.$ptn.outerHeight();
    }
    if (board_config.show_play_controls) {
      height -= app.$controls.outerHeight();
    }

    if (width < height * unplayed_ratio) {
      size = width / unplayed_ratio;
    } else {
      size = height;
    }
    unplayed_size = size * (unplayed_ratio - 1);

    if (_.isBoolean(from_config)) {
      app.$viewer.transition();
    }
    this.$board.css({
      width: size,
      height: size
    });
    this.$unplayed_bg.width(unplayed_size);

    this.vw = vw;
    this.vh = vh;
    this.width = size
      + board_config.show_unplayed_pieces * unplayed_size
      + axis_width;

    this.on_resize();
  };


  Board.prototype.update_view = function() {
    _.invokeMap(
      _.filter(this.all_pieces, { needs_updated: true, captor: null }),
      'render'
    );

    this.update_scores();
    this.on_ply();
  };


  Board.prototype.reposition_pieces = function() {
    _.invokeMap(
      _.compact(_.map(this.squares, 'piece'))
        .concat(this.pieces[1].F)
        .concat(this.pieces[1].C)
        .concat(this.pieces[2].F)
        .concat(this.pieces[2].C),
      'render'
    );
  };


  Board.prototype.rotate = function () {
    this.$view.css('transform', this.tpl.board_rotation(config));
  };


  Board.prototype.update_ptn = function(current_ply) {
    var ply1, ply2, $ply1, $ply2;

    if (current_ply && !current_ply.move.is_invalid) {
      ply1 = current_ply.move.ply1;
      ply2 = current_ply.move.ply2;

      if (this.$move && this.$move.length) {
        this.$move.remove();
      }
      this.$move = $(current_ply.move.print());

      this.$ptn.$prev_move.after(this.$move);
      $ply1 = this.$ptn.find('.ply:eq(0)');
      $ply2 = this.$ptn.find('.ply:eq(1)');

      if (ply1) {
        if (ply1.turn == 1) {
          if (ply1 == current_ply) {
            $ply1.addClass('active');
          }
        }
      }
      if (ply2) {
        if (ply2 == current_ply) {
          $ply2.addClass('active');
        }
      }

      this.$ptn.$prev_move.attr(
        'disabled',
        current_ply.index == 0 && !this.ply_is_done
      );
      this.$ptn.$next_move.attr(
        'disabled',
        current_ply.index == this.game.plys.length - 1 && this.ply_is_done
      );
    }
  };


  Board.prototype.update_scores = function() {
    var total = (this.flat_score[1] + this.flat_score[2])/100;
    this.$score1.text(this.flat_score[1]);
    this.$score2.text(this.flat_score[2]);
    this.$bar1.width(total ? this.flat_score[1]/total+'%' : '');
    this.$bar2.width(total ? this.flat_score[2]/total+'%' : '');
  };


  Board.prototype.do_ply = function () {
    var ply, square, piece, ply_result;

    if (this.ply_is_done) {
      return true;
    }

    if (this.ply_index >= this.game.plys.length || this.ply_index < 0) {
      return false;
    }

    ply = this.game.plys[this.ply_index];
    square = this.squares[ply.square];

    if (ply.is_illegal || !ply.is_valid) {
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

    if (this.ply_index >= this.game.plys.length || this.ply_index < 0) {
      return false;
    }

    ply = this.game.plys[this.ply_index];
    square = this.squares[ply.square];

    if (ply.is_illegal || !ply.is_valid) {
      return false;
    }

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
    ).click(function () {
      app.select_token_text(ply);
    });
    ply.is_illegal = true;
    return false;
  };


  Board.prototype.invalid_tps = function (square) {
    this.m_parse.error(
      t.error.invalid_tag_value({tag: t.TPS, value: square.text})
    ).click(function () {
      app.set_caret([
        square.char_index,
        square.char_index + square.text.length
      ]);
    });
    square.error = true;

    return false;
  };


  Board.prototype.set_active_squares = function (squares) {
    if (this.$view) {
      this.$squares.children().removeClass('active');
      if (squares && squares.length) {
        if (_.isString(squares[0])) {
          squares = _.pick(this.squares, squares);
        }
        _.invokeMap(squares, 'set_active');
      }
    }
  };


  Board.prototype.show_comments = function (ply) {
    var that = this
      , result = this.game.config.result
      , comments_ply_index = (!ply || ply.is_first && !this.ply_is_done) ? -1 : ply.index;

    if (this.defer_render || this.comments_ply_index == comments_ply_index) {
      return;
    }

    this.comments_ply_index = comments_ply_index;

    this.m.clear();

    // Show comments before first move
    if (comments_ply_index == -1) {
      if (this.game.comments) {
        _.map(this.game.comments.concat().reverse(), this.comment);
      }
      return;
    }

    // Show result
    if (ply.is_last && this.game.is_valid && result && result.message) {
      this.m['player'+result.victor](result.message);
      if (result.comments) {
        _.map(result.comments.concat().reverse(), this.comment);
      }
    }

    // Show ply comments
    if (ply.comments) {
      _.map(ply.comments.concat().reverse(), this.comment);
    }

    // Show Tak and Tinue
    if (ply.evaluation && /['"]/.test(ply.evaluation)) {
      this.m['player'+ply.player](
        /"|''/.test(ply.evaluation) ? t.Tinue : t.Tak
      );
    }
  };


  Board.prototype.play = function () {
    if (
      this.game.plys[this.ply_index]
      && this.ply_index != this.game.plys.length - 1
      || !this.ply_is_done
    ) {
      this.is_playing = true;
      app.$html.addClass('playing');
      this.next();
    }
  };


  Board.prototype.pause = function () {
    clearTimeout(this.play_timer);
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

    if (!this.ply_is_done && this.ply_index) {
      this.ply_index--;
      this.ply_is_done = true;
      if (!this.defer_render) {
        this.on_ply();
      }
    } else {
      this.undo_ply();
    }
  };


  Board.prototype.next = function (event) {
    if (this.is_playing) {
      clearTimeout(this.play_timer);
      this.play_timer = setTimeout(this.next, 6e4/config.play.speed);
      this.play_timestamp = new Date().getTime();
    }

    if (event) {
      event.stopPropagation();
      event.preventDefault();

      this.pause();
    }

    if (this.ply_is_done && this.ply_index < this.game.plys.length - 1) {
      this.ply_index++;
      this.ply_is_done = false;
      if (!this.defer_render) {
        this.on_ply();
      }
    } else {
      return this.do_ply();
    }
  };


  Board.prototype.prev_ply = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();

      this.pause();
    }

    if (!this.ply_is_done && this.ply_index) {
      this.ply_index--;
      this.ply_is_done = true;
    }
    return this.undo_ply();
  };


  Board.prototype.next_ply = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();

      this.pause();
    }

    if (this.ply_is_done && this.ply_index < this.game.plys.length - 1) {
      this.ply_index++;
      this.ply_is_done = false;
    }
    return this.do_ply();
  };


  Board.prototype.prev_move = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.go_to_ply(this.ply_index - 2, this.ply_is_done && this.ply_index > 1);
  };


  Board.prototype.next_move = function (event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.go_to_ply(this.ply_index + 2, this.ply_is_done);
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

    this.go_to_ply(this.game.plys.length - 1, true);
  };


  Board.prototype.go_to_ply = function (ply_index, do_ply, is_silent) {
    this.pause();
    this.defer_render = true;

    if (ply_index < 0) {
      do_ply = false;
    } else if (ply_index >= this.game.plys.length) {
      do_ply = true;
    }

    ply_index = Math.min(this.game.plys.length - 1, Math.max(0, ply_index));

    while (this.ply_index < ply_index && this.do_ply()) {
      this.ply_index++;
      this.ply_is_done = false;
    }
    while (this.ply_index > ply_index && this.undo_ply()) {
      this.ply_index--;
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

    board_rotation: _.template(
      'translate3d('+
        '<%=board_rotation[0]*board_max_angle/9%>em, '+
        '<%=board_rotation[1]*board_max_angle/-9%>em, '+
        '<%=board_rotation[2]*board_max_angle/-3%>em'+
      ') rotate3d('+
        '<%=board_rotation[1]%>, '+
        '<%=board_rotation[0]%>, '+
        '0, '+
        '<%=board_rotation[2]*board_max_angle%>deg'+
      ')'
    ),

    board: _.template(
      '<div class="table size-<%=size%>">'+

        '<div class="top">'+
          '<div></div>'+

          '<div>'+
            '<div class="scores">'+
              '<span class="player1">'+
                '<span class="name"><%=game.config.player1%></span>'+
                '<span class="score"><%=flat_score[1]%></span>'+
              '</span>'+
              '<span class="player2">'+
                '<span class="score"><%=flat_score[2]%></span>'+
                '<span class="name"><%=game.config.player2%></span>'+
              '</span>'+
            '</div>'+
          '</div>'+

          '<div></div>'+
        '</div>'+

        '<div class="middle">'+

          '<div class="left row-label-container">'+
            '<div class="row labels">'+
              '<%=_.map(rows, tpl.row).join("")%>'+
            '</div>'+
          '</div>'+

          '<div class="center">'+
            '<div class="board">'+
              '<div class="squares"></div>'+
              '<div class="pieces"></div>'+
            '</div>'+
          '</div>'+

          '<div class="right unplayed-bg-cell">'+
            '<div class="unplayed-bg"></div>'+
          '</div>'+

        '</div>'+

        '<div class="bottom">'+
          '<div></div>'+

          '<div>'+
            '<div class="col labels">'+
              '<%=_.map(cols, tpl.col).join("")%>'+
            '</div>'+
            '<div class="ptn">'+
              '<button class="prev_move mdl-button mdl-js-button mdl-button--icon" disabled>'+
                '<i class="material-icons">&#xE316;</i>'+
              '</button>'+
              '<button class="next_move mdl-button mdl-js-button mdl-button--icon" disabled>'+
                '<i class="material-icons">&#xE313;</i>'+
              '</button>'+
            '</div>'+
          '</div>'+

          '<div></div>'+
        '</div>'+

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
