// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/config', 'i18n!nls/main', 'lodash'], function (config, t, _) {

  var Square = function (board, row, col) {
    this.board = board;
    this.col = col;
    this.row = row;
    this.square = app.i_to_square([col, row]);
    this.color = (row % 2 != col % 2) ? 'dark' : 'light';
    this.piece = null;
    this.neighbors = {};

    _.bindAll(this, 'render', 'select');

    return this;
  };

  Square.prototype.to_tps = function () {
    return this.piece ? this.piece.to_tps() : 'x';
  };

  Square.prototype.parse = function (tps) {
    var that = this
      , piece, captives, player, stone = 'F';

    tps = tps.split('').reverse();

    if (!/\d/.test(tps[0])) {
      stone = tps.shift();
    }

    player = tps.shift();
    piece = this.board.pieces[player][stone == 'C' ? stone : 'F'].pop();

    if (!piece) {
      return false;
    }

    piece.stone = stone;

    captives = _.map(tps, function (player) {
      return that.board.pieces[player].F.pop();
    });

    if (captives.indexOf(undefined) >= 0) {
      return false;
    }

    piece.set_captives(captives);

    return this.set_piece(piece, false);
  };

  Square.prototype.set_piece = function (piece, captives) {
    var that = this
      , previous_piece = this.piece;

    this.piece = piece || null;

    if (this.$view) {
      this.$view.removeClass('p1 p2');
    }

    if (previous_piece && previous_piece.stone == 'F') {
      this.board.flat_score[previous_piece.player]--;
    }

    if (piece) {
      this.board.flat_score[piece.player] += 1*(piece.stone == 'F');
      piece.square = this;
      piece.set_captives(captives || piece.captives);
      piece.render();
    } else if (previous_piece) {
      previous_piece.render();

      if (this.$view) {
        this.$view.removeClass(_.values(this.board.direction_name).join(' '));
        _.each(this.board.direction_name, function (dn, d) {
          if (that.neighbors[d]) {
            that.$view.removeClass(dn);
            that.neighbors[d].$view.removeClass(
              that.board.direction_name[
                that.board.opposite_direction[d]
              ]
            );
          }
        })
      }
    }

    if (!this.board.defer_render) {
      this.board.update_scores();
    }

    return this.piece;
  };

  Square.prototype.set_active = function () {
    if (this.$view) {
      this.$view.addClass('active');
    }
  };

  Square.prototype.render = function () {
    this.$view = $(this.tpl(this));
    this.$view.data('model', this);

    return this.$view;
  };

  Square.prototype.select = function () {
    var tmp_ply = this.board.tmp_ply
      , piece, stone;

    if (this.board.selected_pieces.length) {
      if (this.board.selected_pieces[0].square == this) {
        // Drop selected piece in current square
        this.board.selected_pieces.pop().is_selected = false;
        this.piece.render();

        if (tmp_ply) {
          tmp_ply.drops[tmp_ply.drops.length - 1] += 1;
        }
        if (!this.board.selected_pieces.length) {
          this.board.set_active_squares(app.get_current_ply().squares);
        }
      } else {
        // Drop selected piece in different square
        var prev_square = this.board.selected_pieces[0].square
          , remaining_stack = prev_square.piece.captives.slice(
              this.board.selected_pieces.length - 1
            );

        if (tmp_ply) {
          tmp_ply.drops.push(1);
        } else {
          tmp_ply = this.board.tmp_ply = {
            count: this.board.selected_pieces.length,
            square: prev_square.square,
            direction: _.findKey(prev_square.neighbors, this),
            drops: [1]
          };
        }

        // Record wall flattening
        if (this.piece && this.piece.stone == 'S') {
          tmp_ply.flattens = tmp_ply.drops.length - 1;
        }

        _.last(this.board.selected_pieces).is_selected = false;
        prev_square.set_piece(remaining_stack[0], remaining_stack.slice(1));
        this.set_piece(
          this.board.selected_pieces[0],
          this.board.selected_pieces.slice(1).concat(
            this.piece ? [this.piece].concat(this.piece.captives) : []
          )
        );
        this.board.selected_pieces.pop();
        this.set_active();
      }

      if (tmp_ply && !this.board.selected_pieces.length) {
        // Insert slide as new ply
        this.board.game.insert_ply(
          ''
          + (tmp_ply.count > 1 ? tmp_ply.count : '')
          + tmp_ply.square
          + tmp_ply.direction
          + (tmp_ply.drops.length > 1 ? tmp_ply.drops.join('') : ''),
          this.board.ply_index + 1*this.board.ply_is_done,
          true,
          tmp_ply.flattens
        );
      }

      this.board.update_valid_squares();
    } else if (this.piece) {
      piece = this.piece;

      if (piece.ply && this.board.ply_index == piece.ply.index) {
        // Cycle through F, S, C
        if (piece.stone == 'F') {
          stone = 'S';
        } else {
          if (
            piece.stone == 'C' && this.board.pieces[piece.player].F.length
            || piece.stone == 'S' && !this.board.pieces[piece.player].C.length
          ) {
            stone = '';
          } else {
            stone = 'C';
          }
        }
        this.board.go_to_ply(this.board.ply_index, false);
        this.board.game.insert_ply(
          stone + this.square,
          this.board.ply_index
        );
      } else {
        // Select piece or stack
        this.board.selected_pieces = [piece].concat(
          piece.captives.slice(0, this.board.size - 1)
        );
        for (var i = 0; i < this.board.selected_pieces.length; i++) {
          this.board.selected_pieces[i].is_selected = true;
        }
        piece.render();
        this.board.update_valid_squares();
        this.board.set_active_squares([this]);
      }
    } else {
      // Place piece as new ply
      stone = '';
      if (!this.board.pieces[this.board.turn].F.length) {
        if (this.board.pieces[this.board.turn].C.length) {
          stone = 'C';
        } else {
          return;
        }
      }
      this.board.game.insert_ply(
        stone + this.square,
        this.board.ply_index + 1*this.board.ply_is_done
      );
    }
  };

  Square.prototype.place = function (ply) {
    var pieces = this.board.pieces[ply.player][ply.true_stone]
      , piece;

    if (this.piece || !pieces.length) {
      return this.board.illegal_ply(ply);
    }

    piece = pieces.pop();

    piece.set_ply(ply);
    this.set_piece(piece, false, true);

    this.piece.render();

    return true;
  };

  Square.prototype.undo_place = function (ply) {
    if (this.piece) {
      this.board.pieces[this.piece.player][this.piece.true_stone].push(this.piece);
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
      piece.captives.length < ply.count - 1 ||
      piece.player != ply.player
    ) {
      return illegal();
    }

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

          ply.flattens = i;
        }

        remaining_stack.push(square.piece);
        remaining_stack = remaining_stack.concat(square.piece.captives);
      }

      square.set_piece(remaining_stack[0], remaining_stack.slice(1));
    }

    return true;
  };

  Square.prototype.undo_slide = function (ply) {
    var square = this
      , backwards = this.board.opposite_direction[ply.direction]
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

      if (remaining_stack[0] && ply.flattens === i) {
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

  Square.prototype.tpl = _.template(
    '<div class="square c<%=col%> r<%=row%> <%=color%>">'+
      '<div class="road">'+
        '<div class="up"></div>'+
        '<div class="down"></div>'+
        '<div class="left"></div>'+
        '<div class="right"></div>'+
      '</div>'+
    '</div>'
  );

  return Square;

});
