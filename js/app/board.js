'use strict';

define(['util/messages', 'i18n!nls/main', 'lodash'], function (Messages, t, _) {

  var m = new Messages('board');

  var Board, Square, Stone;

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

    if (game) {
      this.parse(game);
    }

    return this;
  };

  Board.prototype.parse = function (game) {
    var row, col
      , a = 'a'.charCodeAt(0);

    this.game = game;
    this.size = game.config.size;
    this.tps = game.config.tps;

    for (row = 1; row <= this.size; row++) {
      this.squares[row] = {}
      for (col = 0; col < this.size; col++) {
        this.squares[row][String.fromCharCode(a + col)] = {}
      }
    }
  };

  Board.prototype.to_tps = function () {
    // x5/x5/x5/x5/x5 1 1
  };

  return Board;

})
