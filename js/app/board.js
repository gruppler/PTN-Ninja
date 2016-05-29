'use strict';

define(['app/messages', 'i18n!nls/main', 'lodash'], function (Messages, t, _) {

  var Board, Square, Piece;
  var m = new Messages('board');

  function xor(a, b) {
    return a && !b || !a && b;
  }

  window.tpl = {};

  tpl.row = _.template('<span class="row"><%=obj%></span>');

  tpl.col = _.template('<span class="col"><%=obj%></span>');

  tpl.square = _.template('<div class="square c<%=col_i%> r<%=row_i%> <%=color%>"></div>');

  tpl.piece = _.template('<div class="piece <%=type%> c<%=col_i%> r<%=row_i%> p<%=player%>"></div>');

  tpl.board = _.template(
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
  );


  // Piece

  Piece = function () {
    this.type = 'F';

    return this;
  };


  // Square

  Square = function (col_i, row_i, board) {
    this.board = board;
    this.col_i = col_i;
    this.row_i = row_i;
    this.col = board.cols[col_i];
    this.row = board.rows[row_i];
    this.color = xor(row_i%2, col_i%2) ? 'dark' : 'light';
    this.pieces = [];

    return this;
  };

  Square.prototype.parse = function (tps) {

  };

  Square.prototype.to_tps = function () {};


  // Board

  Board = function (game) {
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.callbacks_start = []
    this.callbacks_end = [];

    if (game) {
      this.parse(game);
    }

    return this;
  };

  Board.prototype.on_parse_start = function (fn) {
    this.callbacks_start.push(fn);
  };

  Board.prototype.on_parse_end = function (fn) {
    this.callbacks_end.push(fn);
  };

  Board.prototype.parse = function (game) {
    var row, col
      , a = 'a'.charCodeAt(0), col_letter;

    _.invokeMap(this.callbacks_start, 'call', this, this);

    this.game = game;
    this.size = game.config.size;
    this.tps = game.config.tps;

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
    return tpl.board(this);
  };

  return Board;

})
