// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/messages', 'i18n!nls/main', 'lodash'], function (Messages, t, _) {

  var Board, Square, Piece;
  var m = new Messages('board')
    , m_parse = new Messages('parse');

  var opposite_direction = {
    '+': '-',
    '-': '+',
    '<': '>',
    '>': '<'
  };

  var direction_name = {
    '+': 'up',
    '-': 'down',
    '<': 'left',
    '>': 'right'
  };

  function xor(a, b) {
    return a && !b || !a && b;
  }

  var tpl = {
    row: _.template('<span class="row"><%=obj%></span>'),

    col: _.template('<span class="col"><%=obj%></span>'),

    square: _.template(
      '<div class="square c<%=col_i%> r<%=row_i%> <%=color%>">'+
        '<div class="road">'+
          '<div class="up"></div>'+
          '<div class="down"></div>'+
          '<div class="left"></div>'+
          '<div class="right"></div>'+
        '</div>'+
      '</div>'
    ),

    stone_class: _.template('stone p<%=player%> <%=stone%> <%=height_class%>'),
    piece_location: _.template('translate(<%=x%>.0%, <%=y%>.0%)'),
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

  var comment = _.ary(_.bind(m.comment, m), 1);


  // Piece

  Piece = function (board, player, stone, col_i, row_i, ply, captives) {
    this.board = board;
    this.tpl = this.board.tpl;
    this.player = player || 1;
    this.stone = stone || 'F';
    this.col_i = col_i;
    this.row_i = row_i;
    this.stack = '';
    this.ply = ply || null;
    if (captives) {
      this.set_captives(captives);
    } else {
      this.captives = [];
    }

    return this;
  };

  Piece.prototype.set_captives = function (captives) {
    var that = this;

    this.captor = null;
    this.captives = captives || [];

    _.each(this.captives, function (captive, index) {
      captive.index = index;
      captive.captor = that;
      captive.square = that.square;
      captive.col_i = that.col_i;
      captive.row_i = that.row_i;
      captive.stone = 'F';
      captive.captives.length = 0;
    });
  };

  Piece.prototype.render = function () {
    var that = this
      , location;

    if (this.board.defer_render) {
      this.needs_updated = true;
      return;
    }

    if (!this.square) {
      this.board.$pieces.unplace(this.$view);
      return;
    }

    // Set height
    if (this.captor) {
      this.height = this.captor.captives.length - this.index;
      this.is_immovable = this.index >= this.board.size - 1;
    } else if (this.captives.length) {
      this.height = this.captives.length + 1;
      this.is_immovable = false;
      _.invokeMap(this.captives, 'render');
    } else {
      this.height = 1;
      this.is_immovable = false;
    }

    // Determine stack classes
    this.height_class = 'h'+Math.min(5, this.height);
    if (
      this.captor &&
      (this.captor.stone == 'F' || this != this.captor.captives[0])
    ) {
      this.height_class = '';
    }

    // Render or update view
    this.x = 100*( this.col_i - this.board.size/2);
    this.y = 100*(this.board.size/2 - 1 - this.row_i);
    location = tpl.piece_location(this);

    if (!this.$view) {
      this.$view = $(tpl.piece(this));
      this.$view.css({
        'z-index': this.height,
        'transform': location
      });
      this.$stone = this.$view.find('.stone');
      this.$captive = this.$view.find('.captive');
      this.$view.data('model', this);
    } else {
      if (this.prev_location == location || this.prev_height < this.height) {
        this.$view.afterTransition().css({
          'z-index': this.height,
          'transform': location
        });
      } else {
        // Update z-index after ply
        this.$view.afterTransition().afterTransition(function (event) {
          that.$view.css('z-index', that.height);
        });
        this.$view.css('transform', location);
      }
      this.$stone[0].className = tpl.stone_class(this);
      this.$stone.removeClass('F S').addClass(this.stone);
    }
    this.prev_height = this.height;
    this.prev_location = location;

    // Update captive indicator
    if (this.captor || this.captives.length) {
      this.$captive.addClass('visible');
      if ((this.captor || this).captives.length >= this.board.size && !this.is_immovable) {
        this.height += 1.5;
      }
    } else {
      this.$captive.removeClass('visible');
    }
    this.$captive.css('transform', 'translateY('+(-65*(this.height - 1)) + '%)');

    if (this.square && !this.$view.closest('html').length) {
      this.board.$pieces.place(this.$view);
    }

    this.needs_updated = false;

    return this.$view;
  };


  // Square

  Square = function (board, col_i, row_i) {
    this.board = board;
    this.col_i = col_i;
    this.row_i = row_i;
    this.col = board.cols[col_i];
    this.row = board.rows[row_i];
    this.color = xor(row_i%2, col_i%2) ? 'dark' : 'light';
    this.piece = null;
    this.neighbors = {};

    return this;
  };

  Square.prototype.parse = function (tps) {
    var that = this
      , tps, player, stone = 'F';

    tps = tps.split('').reverse();

    if (!/\d/.test(tps[0])) {
      stone = tps.shift();
    }

    player = tps.shift();

    return this.set_piece(
      new Piece(this.board, player, stone, this.col_i, this.row_i, false,
        _.map(tps, function (player) {
          return new Piece(that.board, player);
        })
      ),
      false, true
    );
  };

  Square.prototype.to_tps = function () {};

  Square.prototype.set_piece = function (piece, captives) {
    var that = this
      , previous_piece = this.piece;

    this.piece = piece || null;

    if (this.$view) {
      this.$view.removeClass('p1 p2');
    }

    if (piece) {
      piece.square = this;
      piece.col_i = this.col_i;
      piece.row_i = this.row_i;
      piece.set_captives(captives || piece.captives);
      piece.render();

      if (this.$view) {
        this.$view.addClass('p'+piece.player);
        _.each(direction_name, function (dn, d) {
          if (that.neighbors[d]) {
            if (
              piece.stone != 'S' &&
              that.neighbors[d].piece &&
              that.neighbors[d].piece.player == piece.player &&
              that.neighbors[d].piece.stone != 'S'
            ) {
              that.$view.addClass(dn);
              that.neighbors[d].$view.addClass(direction_name[opposite_direction[d]]);
            } else {
              that.$view.removeClass(dn);
              that.neighbors[d].$view.removeClass(direction_name[opposite_direction[d]]);
            }
          } else if (piece.stone != 'S') {
            that.$view.addClass(dn);
          } else {
            that.$view.removeClass(dn);
          }
        })
      }
    } else if (previous_piece) {
      previous_piece.render();

      if (this.$view) {
        _.each(direction_name, function (dn, d) {
          if (that.neighbors[d]) {
            that.$view.removeClass(dn);
            that.neighbors[d].$view.removeClass(direction_name[opposite_direction[d]]);
          }
        })
      }
    }

    return this.piece;
  };

  Square.prototype.set_active = function () {
    if (this.$view) {
      this.$view.addClass('active');
    }
  };

  Square.prototype.render = function () {
    this.$view = $(tpl.square(this));
    this.$view.data('model', this);

    return this.$view;
  };

  Square.prototype.place = function (ply) {
    var piece = this.board.pieces[ply.id];

    if (this.piece) {
      return this.board.illegal_ply(ply);
    }

    if (!piece) {
      piece = new Piece(
        this.board,
        ply.player,
        ply.stone,
        this.col_i,
        this.row_i,
        ply
      );
      this.board.pieces[ply.id] = piece;
    }

    this.set_piece(piece, false, true);
    ply.squares[0] = this;

    this.piece.render();

    return true;
  };

  Square.prototype.undo_place = function (ply) {
    if (this.piece) {
      this.piece.square = null;
      this.set_piece();
      return true;
    } else {
      return false;
    }
  };

  Square.prototype.slide = function (ply) {
    var that = this
      , square = this
      , piece = this.piece
      , moving_stack, remaining_stack, i;

    function illegal() {
      return that.board.illegal_ply(ply);
    }

    if (
      !piece ||
      ply.count > this.board.size ||
      piece.captives.length < ply.count - 1
    ) {
      return illegal();
    }

    ply.squares[0] = this;

    remaining_stack = piece.captives.splice(ply.count - 1);
    square.set_piece(remaining_stack[0], remaining_stack.slice(1));
    moving_stack = [piece].concat(piece.captives);

    for (i = 0; i < ply.drops.length; i++) {
      square = square.neighbors[ply.direction];
      if (!square) {
        return illegal();
      }

      remaining_stack = moving_stack.splice(-ply.drops[i]);

      if (square.piece) {
        if (square.piece.stone == 'C') {
          return illegal();
        } else if(square.piece.stone == 'S') {
          if (remaining_stack.length > 1 || remaining_stack[0].stone != 'C') {
            return illegal();
          }

          ply.flattens[i] = true;
        } else {
          ply.flattens[i] = false;
        }

        remaining_stack.push(square.piece);
        remaining_stack = remaining_stack.concat(square.piece.captives);
      }

      square.set_piece(remaining_stack[0], remaining_stack.slice(1));
      ply.squares[i + 1] = square;
    }

    return true;
  };

  Square.prototype.undo_slide = function (ply) {
    var square = this
      , backwards = opposite_direction[ply.direction]
      , moving_stack = []
      , remaining_stack, i;

    for (i = 0; i < ply.drops.length; i++) {
      square = square.neighbors[ply.direction];
    }

    for (i = ply.drops.length - 1; i >= 0; i--) {
      moving_stack.push(square.piece);
      moving_stack = moving_stack.concat(
        square.piece.captives.slice(0, ply.drops[i] - 1)
      );
      remaining_stack = square.piece.captives.slice(ply.drops[i] - 1);

      if (remaining_stack[0] && ply.flattens[i]) {
        remaining_stack[0].stone = 'S';
      }
      square.set_piece(remaining_stack[0], remaining_stack.slice(1));

      square = square.neighbors[backwards];
    }
    if (this.piece) {
      moving_stack.push(this.piece);
      moving_stack = moving_stack.concat(this.piece.captives);
    }
    this.set_piece(moving_stack[0], moving_stack.slice(1));

    return true;
  };


  // Board

  Board = function (game) {
    this.ply = 0;
    this.size = 5;
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.pieces = {};
    this.initial_pieces = {};
    this.init_callbacks = [];
    this.ply_callbacks = [];
    this.tpl = tpl;

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
    this.pieces = {};
    this.initial_pieces = {};
    this.cols.length = 0;
    this.rows.length = 0;
  };

  Board.prototype.init = function (game, silent) {
    var i, j, row, col, col_letter, square, piece, tps
      , a = 'a'.charCodeAt(0);

    if (silent !== true) {
      _.invokeMap(this.callbacks_start, 'call', this, this);
      m.clear(false, true);
      this.pause();
    }

    this.defer_render = true;
    this.game = game;
    this.size = 1*game.config.size;
    this.tps = game.config.tps;

    this.saved_ply = this.ply;
    this.clear();

    for (col = 0; col < this.size; col++) {
      col_letter = String.fromCharCode(a + col);
      this.cols[col] = col_letter;
    }

    for (row = 0; row < this.size; row++) {
      this.rows[row] = row + 1;
    }

    this.squares = {};
    for (row = 0; row < this.size; row++) {
      for (col = 0; col < this.size; col++) {
        square = new Square(this, col, row);
        this.squares[this.cols[col]+this.rows[row]] = square;
        if (row) {
          square.neighbors['-'] = this.squares[this.cols[col]+this.rows[row-1]];
          this.squares[this.cols[col]+this.rows[row-1]].neighbors['+'] = square;
        }
        if (col) {
          square.neighbors['<'] = this.squares[this.cols[col-1]+this.rows[row]];
          this.squares[this.cols[col-1]+this.rows[row]].neighbors['>'] = square;
        }
      }
    }

    if (this.tps) {
      if (this.tps.board.length != this.size) {
        m_parse.error(t.error.invalid_TPS_dimensions);
        return false;
      }
      for (i = 0, row = this.size - 1; row >= 0; i++, row--) {
        for (col = 0, j = 0; j < this.tps.board[i].length; col++, j++) {
          tps = this.tps.board[i][j];
          if (!tps || col >= this.size) {
            m_parse.error(t.error.invalid_TPS_dimensions);
            return false;
          }

          if (tps[0] == 'x') {
            if (tps[1]) {
              col += 1*tps[1] - 1;
            }
          } else {
            this.initial_pieces['tps-'+i+'-'+j] = this.squares[this.cols[col]+this.rows[row]].parse(tps);
          }
        }
      }
      this.tps.board;
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
    // x5/x5/x5/x5/x5 1 1
  };

  Board.prototype.render = function () {
    this.$view = $(tpl.board(this));
    this.$squares = this.$view.find('.squares');
    this.$pieces = this.$view.find('.pieces');
    this.pieces = _.clone(this.initial_pieces);

    this.$squares.append.apply(
      this.$squares,
      _.invokeMap(this.squares, 'render')
    );

    this.$pieces.empty().append(
      _.invokeMap(
        _.filter(this.pieces, { captor: null }),
        'render'
      )
    );

    if (this.saved_ply) {
      this.go_to_ply(this.saved_ply);
    }

    return this.$view;
  };

  Board.prototype.update = function() {
    _.invokeMap(
      _.filter(this.pieces, { needs_updated: true }),
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
      this.show_comments(this.game);
    } else {
      this.show_comments(ply);
    }

    _.invokeMap(this.ply_callbacks, 'call', this, this.ply - 1);

    if (ply.is_slide) {
      ply_result = square.slide(ply);
    } else {
      ply_result = square.place(ply);
    }

    this.set_active_squares(ply);

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
      this.show_comments(this.game);
      this.set_active_squares(ply);
    } else {
      this.show_comments(this.game.plys[this.ply - 1]);
      this.set_active_squares(this.game.plys[this.ply - 1]);
    }

    _.invokeMap(this.ply_callbacks, 'call', this, this.ply - 1);

    if (ply.is_slide) {
      return square.undo_slide(ply);
    } else {
      return square.undo_place(ply);
    }
  };

  Board.prototype.illegal_ply = function (ply) {
    m_parse.error(
      t.error.illegal_ply({ ply: ply.ply })
    );
    ply.mark_illegal();
    return false;
  };

  Board.prototype.set_active_squares = function (ply) {
    if (this.$view) {
      this.$squares.children().removeClass('active');
      _.invokeMap(ply.squares, 'set_active');
    }
  };

  Board.prototype.show_comments = function (ply) {
    m.clear(false, true);

    if (!ply || this.defer_render) {
      return;
    }

    if (ply && ply.evaluation && /'/.test(ply.evaluation)) {
      m['player'+ply.player](t.Tak);
    }

    if (ply && ply.evaluation && /[!?]/.test(ply.evaluation)) {
      comment(ply.evaluation.replace(/[^!?]/g, ''));
    }

    if (ply.comments) {
      _.map(ply.comments, comment);
    }

    if (ply.is_last && this.game.result) {
      m['player'+this.game.result.victor](this.game.result.text);
      if (this.game.result.comments) {
        _.map(this.game.result.comments, comment);
      }
    }
  };

  Board.prototype.play = function () {
    if (this.do_ply() && this.game.plys[this.ply]) {
      this.play_timer = setInterval(_.bind(this.do_ply, this), 1000);
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
        this.show_comments(this.game);
      } else {
        this.show_comments(this.game.plys[this.ply - 1]);
      }

      this.update();
    }
  };

  return Board;

})
