'use strict';

define(['app/messages', 'i18n!nls/main', 'lodash'], function (Messages, t, _) {

  var Board, Square, Piece;
  var m = new Messages('board');

  var opposite_direction = {
    '+': '-',
    '-': '+',
    '<': '>',
    '>': '<'
  };

  function xor(a, b) {
    return a && !b || !a && b;
  }

  var tpl = {
    row: _.template('<span class="row"><%=obj%></span>'),

    col: _.template('<span class="col"><%=obj%></span>'),

    square: _.template('<div class="square c<%=col_i%> r<%=row_i%> <%=color%>"></div>'),

    piece_class: _.template('piece c<%=col_i%> r<%=row_i%>'),
    stone_class: _.template('stone p<%=player%> <%=stone%> <%=height_class%>'),
    piece: _.template(
      '<div class="<%=tpl.piece_class(obj)%>">'+
        '<div class="captive p<%=player%>"></div>'+
        '<div class="<%=tpl.stone_class(obj)%>"></div>'+
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


  // Piece

  Piece = function (board, player, stone, col_i, row_i, captives) {
    this.board = board;
    this.board.pieces.push(this);
    this.tpl = this.board.tpl;
    this.player = player || 1;
    this.stone = stone || 'F';
    this.col_i = col_i;
    this.row_i = row_i;
    this.stack = '';
    this.captives = captives || [];

    return this;
  };

  Piece.prototype.set_captives = function (captives) {
    var that = this;

    this.captor = null;
    this.captives = captives || [];

    _.each(this.captives, function (captive) {
      captive.square = that.square;
      captive.col_i = that.col_i;
      captive.row_i = that.row_i;
      captive.stone = 'F';
      captive.captives.length = 0;
    });
  };

  Piece.prototype.render = function () {
    var that = this;

    // Render/update captives
    if (this.captives.length) {
      this.height = this.captives.length + 1;

      _.each(this.captives, function (captive, z) {
        captive.captor = that;
        captive.height = that.captives.length - z;
        captive.is_immovable = z >= that.board.size - 1;

        if (!captive.$view) {
          captive.render();
          that.board.$pieces.append(captive.$view);
        } else {
          captive.render();
        }
      });
    } else if (!this.captor) {
      this.height = 1;
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
    if (!this.$view) {
      this.$view = $(tpl.piece(this));
      this.$view.css('z-index', this.height);
      this.$stone = this.$view.find('.stone');
      this.$captive = this.$view.find('.captive');
      this.$view.data('model', this);
    } else {
      if (
        1*this.$view.css('z-index') <= this.height ||
        this.$view.hasClass('c'+this.col_i+' r'+this.row_i)
      ) {
        // Update z-index now
        this.$view.css('z-index', this.height);
      } else {
        // Update z-index after move
        this.$view.afterTransition(function () {
          that.$view.css('z-index', this.height);
        });
      }
      this.$view[0].className = tpl.piece_class(this);
      this.$stone[0].className = tpl.stone_class(this);
      this.$stone.removeClass('F S').addClass(this.stone);
    }

    // Update captive indicators
    if (this.captor || this.captives.length) {
      this.$captive.addClass('visible');
      if ((this.captor || this).captives.length >= this.board.size && !this.is_immovable) {
        this.height++;
      }
    } else {
      this.$captive.removeClass('visible');
    }
    this.$captive.css('margin-bottom', (this.height - 1)*5 + '%');

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

  Square.prototype.set_piece = function (piece, captives, is_silent) {
    this.piece = piece || null;

    if (piece) {
      piece.square = this;
      piece.col_i = this.col_i;
      piece.row_i = this.row_i;
      piece.set_captives(captives || piece.captives);

      if (is_silent !== true) {
        piece.render();
      }
    }
  };

  Square.prototype.render = function () {
    this.$view = $(tpl.square(this));
    this.$view.data('model', this);

    return this.$view;
  };

  Square.prototype.place = function (move, is_silent) {
    if (this.piece) {
      m.error(t.error.illegal_move({ move: move.move }));
      return false;
    }

    this.set_piece(new Piece(
      this.board,
      move.player,
      move.stone,
      this.col_i,
      this.row_i
    ), false, true);

    if (is_silent !== true) {
      this.board.$pieces.place(this.piece.render());
    }

    return true;
  };

  Square.prototype.undo_place = function (move, is_silent) {
    if (this.piece) {
      if (is_silent !== true && this.piece.$view) {
        this.board.$pieces.unplace(this.piece.$view);
      }
      _.pull(this.board.pieces, this.piece);
      this.set_piece();
      return true;
    } else {
      return false;
    }
  };

  Square.prototype.slide = function (move, is_silent) {
    var square = this
      , piece = this.piece
      , moving_stack, remaining_stack, i;

    function error() {
      m.error(t.error.illegal_move({ move: move.move }));
      return false;
    }

    if (
      !piece ||
      move.count > this.board.size ||
      piece.captives.length < move.count - 1
    ) {
      return error();
    }

    remaining_stack = piece.captives.splice(move.count - 1);
    square.set_piece(remaining_stack[0], remaining_stack.slice(1), is_silent);
    moving_stack = [piece].concat(piece.captives);

    for (i = 0; i < move.drops.length; i++) {
      square = square.neighbors[move.direction];
      remaining_stack = moving_stack.splice(-move.drops[i]);

      if (square.piece) {
        if (square.piece.stone == 'C') {
          return error();
        } else if(square.piece.stone == 'S') {
          if (piece.stone != 'C' || piece.captives.length) {
            return error();
          }

          move.flattens[i] = true;
        } else {
          move.flattens[i] = false;
        }

        remaining_stack.push(square.piece);
        remaining_stack = remaining_stack.concat(square.piece.captives);
      }

      square.set_piece(remaining_stack[0], remaining_stack.slice(1), is_silent);
    }

    return true;
  };

  Square.prototype.undo_slide = function (move, is_silent) {
    var square = this
      , backwards = opposite_direction[move.direction]
      , moving_stack = []
      , remaining_stack, i;

    for (i = 0; i < move.drops.length; i++) {
      square = square.neighbors[move.direction];
    }

    for (i = move.drops.length - 1; i >= 0; i--) {
      moving_stack.push(square.piece);
      moving_stack = moving_stack.concat(
        square.piece.captives.slice(0, move.drops[i] - 1)
      );
      remaining_stack = square.piece.captives.slice(move.drops[i] - 1);

      if (remaining_stack[0] && move.flattens[i]) {
        remaining_stack[0].stone = 'S';
      }
      square.set_piece(remaining_stack[0], remaining_stack.slice(1), is_silent);

      square = square.neighbors[backwards];
    }
    if (this.piece) {
      moving_stack.push(this.piece);
      moving_stack = moving_stack.concat(this.piece.captives);
    }
    this.set_piece(moving_stack[0], moving_stack.slice(1), is_silent);

    return true;
  };

  Square.prototype.parse = function (tps) {};

  Square.prototype.to_tps = function () {};


  // Board

  Board = function (game) {
    this.move = 0;
    this.size = 5;
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.callbacks = [];
    this.tpl = tpl;

    if (game) {
      this.init(game);
    }

    return this;
  };

  Board.prototype.on_init = function (fn) {
    this.callbacks.push(fn);
  };

  Board.prototype.init = function (game) {
    var row, col, a = 'a'.charCodeAt(0), col_letter, square;

    _.invokeMap(this.callbacks_start, 'call', this, this);

    this.game = game;
    this.size = 1*game.config.size;
    this.tps = game.config.tps;
    this.move = 0;

    this.cols.length = 0;
    for (col = 0; col < this.size; col++) {
      col_letter = String.fromCharCode(a + col);
      this.cols[col] = col_letter;
    }

    this.rows.length = 0;
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

    _.invokeMap(this.callbacks, 'call', this, this);

    return true;
  };

  Board.prototype.to_tps = function () {
    // x5/x5/x5/x5/x5 1 1
  };

  Board.prototype.render = function () {
    this.$view = $(tpl.board(this));
    this.$squares = this.$view.find('.squares');
    this.$pieces = this.$view.find('.pieces');
    this.pieces = [];

    this.$squares.append.apply(
      this.$squares,
      _.invokeMap(this.squares, 'render')
    );

    return this.$view;
  };

  Board.prototype.update = function() {
    this.$pieces.empty().append(_.invokeMap(this.pieces, 'render'));
  };

  Board.prototype.do_move = function (is_silent) {
    var move, square, piece;

    if (this.move >= this.game.moves.length || this.move < 0) {
      return false;
    }

    move = this.game.moves[this.move++];
    square = this.squares[move.square];

    if (move.is_slide) {
      return square.slide(move, is_silent);
    } else {
      return square.place(move, is_silent);
    }
  };

  Board.prototype.undo_move = function (is_silent) {
    var move, square, piece;

    if (this.move > this.game.moves.length || this.move <= 0) {
      return false;
    }

    move = this.game.moves[--this.move];
    square = this.squares[move.square];

    if (move.is_slide) {
      return square.undo_slide(move, is_silent);
    } else {
      return square.undo_place(move);
    }
  };

  Board.prototype.play = function () {
    //
    this.is_playing = true;
  };

  Board.prototype.pause = function () {
    clearTimeout(this.play_timer);
    this.is_playing = false;
  };

  Board.prototype.playpause = function () {
    if (this.is_playing) {
      this.pause();
    } else {
      this.play();
    }
  };

  Board.prototype.prev = function () {
    this.undo_move();
  };

  Board.prototype.next = function () {
    this.do_move();
  };

  Board.prototype.first = function () {
    this.go_to_move(0);
  };

  Board.prototype.last = function () {
    this.go_to_move(this.game.moves.length);
  };

  Board.prototype.go_to_move = function (move) {
    if (move > this.move) {
      while (this.move < move && this.do_move(true)) {}
    } else if (move < this.move) {
      while (this.move >= move && this.undo_move(true)) {}
    }
    this.update();
  };

  return Board;

})
