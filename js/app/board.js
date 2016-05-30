'use strict';

define(['app/messages', 'i18n!nls/main', 'lodash'], function (Messages, t, _) {

  var Board, Square, Piece;
  var m = new Messages('board');

  function xor(a, b) {
    return a && !b || !a && b;
  }

  var tpl = {
    row: _.template('<span class="row"><%=obj%></span>'),

    col: _.template('<span class="col"><%=obj%></span>'),

    square: _.template('<div class="square c<%=col_i%> r<%=row_i%> <%=color%>"></div>'),

    piece: _.template(
      '<div class="piece c<%=col_i%> r<%=row_i%>">'+
        '<div class="stone <%=stone%> player<%=player%>">'+
          '<div class="captives"></div>'+
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
        '<div class="squares">'+
          '<%=_.map(squares, tpl.square).join("")%>'+
        '</div>'+
        '<div class="pieces"></div>'+
      '</div>'
    )
  };


  // Piece

  Piece = function (player, stone, col_i, row_i, captives) {
    this.player = player || 1;
    this.stone = stone || 'F';
    this.col_i = col_i;
    this.row_i = row_i;
    this.captives = captives || [];

    return this;
  };

  Piece.prototype.render = function () {
    this.$view = $(tpl.piece(this));
    this.$captives = this.$view.find('.captives');

    return this.$view;
  };


  // Square

  Square = function (col_i, row_i, board) {
    this.board = board;
    this.col_i = col_i;
    this.row_i = row_i;
    this.col = board.cols[col_i];
    this.row = board.rows[row_i];
    this.color = xor(row_i%2, col_i%2) ? 'dark' : 'light';
    this.piece = null;

    return this;
  };

  Square.prototype.place = function (move) {
    if (this.piece) {
      m.error(t.illegal_move({ move: move.move }));
      return false;
    }

    this.piece = new Piece(move.player, move.stone, this.col_i, this.row_i);

    return this.piece;
  };

  Square.prototype.undo_place = function (move) {};

  Square.prototype.parse = function (tps) {};

  Square.prototype.to_tps = function () {};


  // Board

  Board = function (game) {
    this.move = 0;
    this.size = 5;
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.callbacks_start = []
    this.callbacks_end = [];
    this.tpl = tpl;

    if (game) {
      this.init(game);
    }

    return this;
  };

  Board.prototype.on_init_start = function (fn) {
    this.callbacks_start.push(fn);
  };

  Board.prototype.on_init_end = function (fn) {
    this.callbacks_end.push(fn);
  };

  Board.prototype.init = function (game) {
    var row, col
      , a = 'a'.charCodeAt(0), col_letter;

    _.invokeMap(this.callbacks_start, 'call', this, this);

    this.game = game;
    this.size = game.config.size;
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
        this.squares[this.cols[col]+this.rows[row]] =
          new Square(col, row, this);
      }
    }

    _.invokeMap(this.callbacks_end, 'call', this, this);

    return true;
  };

  Board.prototype.to_tps = function () {
    // x5/x5/x5/x5/x5 1 1
  };

  Board.prototype.render = function () {
    this.$view = $(tpl.board(this));
    this.$squares = this.$view.find('.squares');
    this.$pieces = this.$view.find('.pieces');

    return this.$view;
  };

  Board.prototype.do_move = function (is_silent) {
    var move, square, piece;

    if (this.move >= this.game.moves.length || this.move < 0) {
      return false;
    }

    move = this.game.moves[this.move++];
    square = this.squares[move.square];

    if (move.is_slide) {
      return this.slide(move, is_silent);
    } else {
      piece = square.place(move);
      if (piece && is_silent !== true) {
        this.$pieces.append(piece.render());
        return true;
      } else {
        return false;
      }
    }
  };

  Board.prototype.undo_move = function () {};

  Board.prototype.slide = function (move) {};

  Board.prototype.undo_slide = function (move) {};

  Board.prototype.play = function () {};

  Board.prototype.pause = function () {};

  Board.prototype.prev = function () {};

  Board.prototype.next = function () {};

  Board.prototype.first = function () {};

  Board.prototype.last = function () {};

  return Board;

})
