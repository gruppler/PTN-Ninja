'use strict';

define(['app/messages', 'i18n!nls/main', 'lodash'], function (Messages, t, _) {

  var Board, Square, Stone;
  var m = new Messages('board');

  Stone = function (config) {
    config = _.defaults(config, {
      type: 'F'
    });

    return this;
  };


  Square = function (config) {
    config = _.defaults(config, {
      tps: ''
    });

    this.pieces = parse_tps(this.tps);
  };

  Square.prototype.parse = function (tps) {

  };

  Square.prototype.to_tps = function () {};


  Board = function (game) {
    this.squares = {};
    this.rows = [];
    this.cols = [];

    if (game) {
      this.parse(game);
    }

    return this;
  };

  Board.prototype.parse = function (game) {
    var row, col
      , a = 'a'.charCodeAt(0), col_letter;

    this.game = game;
    this.size = game.config.size;
    this.tps = game.config.tps;

    this.squares = {};
    this.rows.length = 0;
    this.cols.length = 0;
    for (row = 1; row <= this.size; row++) {
      this.rows.push(row);
      for (col = 0; col < this.size; col++) {
        col_letter = String.fromCharCode(a + col);
        this.cols.push(col_letter);
        this.squares[col_letter+row] = {
          row: row,
          col: col_letter
        };
      }
    }
  };

  Board.prototype.to_tps = function () {
    // x5/x5/x5/x5/x5 1 1
  };

  Board.prototype.render = function () {
    return '';
  };

  return Board;

})
