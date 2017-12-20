// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/config', 'i18n!nls/main', 'lodash'], function (config, t, _) {

  var Square = function (board, row, col) {
    this.needs_updated = false;
    this.board = board;
    this.col = col;
    this.row = row;
    this.coord = app.square_coord([col, row]);
    this.color = (row % 2 != col % 2) ? 'dark' : 'light';
    this.piece = null;
    this.player = 0;
    this.neighbors = {};

    this.is_edge = false;
    this.is_corner = false;
    this.is_ns = false;
    this.is_ew = false;
    this.is_valid = false;
    this.is_selected = false;
    this.is_placed = false;

    this.edges = [];
    this.connections = [];
    this.road_connections = [];

    if (row == 0) {
      this.is_edge = true;
      this.is_ns = true;
      this.edges.push('-');
    }
    if (row == board.size - 1) {
      this.is_edge = true;
      this.is_ns = true;
      this.edges.push('+');
    }
    if (col == 0) {
      this.is_edge = true;
      this.is_ew = true;
      this.edges.push('<');
    }
    if (col == board.size - 1) {
      this.is_edge = true;
      this.is_ew = true;
      this.edges.push('>');
    }
    this.is_corner = this.edges.length == 2;

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

  Square.prototype.set_connection = function (direction, on, is_edge) {
    var index = this.connections.indexOf(direction)
      , road_index = !is_edge ? this.road_connections.indexOf(direction) : -1;

    if (on) {
      if (index < 0) {
        this.connections.push(direction);
        if (!is_edge) {
          this.road_connections.push(direction);
        }
        this.needs_updated = true;
      }
    } else if (index >= 0) {
      this.connections.splice(index, 1);
      if (!is_edge && road_index >= 0) {
        this.road_connections.splice(road_index, 1);
      }
      this.needs_updated = true;
    }
  };

  Square.prototype.set_piece = function (piece, captives) {
    var previous_piece = this.piece
      , direction, opposite_direction, neighbor;

    this.piece = piece || null;

    if (previous_piece && previous_piece.stone == 'F') {
      this.board.flat_score[previous_piece.player]--;
    }

    if (piece) {
      this.player = piece.player;
      this.board.flat_score[piece.player] += 1*(piece.stone == 'F');
      piece.square = this;
      piece.set_captives(captives || piece.captives);
      piece.render();
      this.needs_updated = true;
      if (!previous_piece) {
        this.board.empty_count -= 1;
      }
    } else if (previous_piece) {
      this.board.empty_count += 1;
      this.player = 0;
      previous_piece.render();
      this.needs_updated = true;
    }

    for (direction in this.board.direction_names) {
      opposite_direction = this.board.opposite_direction[direction];
      neighbor = this.neighbors[direction];

      if (neighbor) {
        if (
          piece
          && neighbor.player == this.player
          && piece.stone != 'S'
          && neighbor.piece.stone != 'S'
        ) {
          // Connected to neighbor
          this.set_connection(direction, true);
          neighbor.set_connection(opposite_direction, true);
        } else {
          // Disconnected from neighbor
          this.set_connection(direction, false);
          neighbor.set_connection(opposite_direction, false);
        }

        if (neighbor.needs_updated) {
          neighbor.update_view();
        }
      } else if (piece && piece.stone != 'S') {
        // Board edge connection
        this.set_connection(direction, true, true);
      } else {
        // Non-road square
        this.set_connection(direction, false);
      }
    }

    if (this.$view && this.needs_updated && !this.board.defer_render) {
      this.update_view();
      this.board.update_scores();
    }

    return this.piece;
  };

  Square.prototype.set_active = function () {
    if (this.$view) {
      this.$view.addClass('active');
    }
  };

  Square.prototype.set_option = function (option) {
    if (this.$view) {
      this.$view.addClass('option');

      if (_.isUndefined(option) || _.isString(option) && !option.length) {
        return;
      }

      if (this.$view.$option.text().length) {
        this.$view.$option.text(this.$view.$option.text()+', '+option);
      } else {
        this.$view.$option.text(option);
      }
    }
  };

  Square.prototype.render = function () {
    this.$view = $(this.tpl(this));
    this.$view.$option = this.$view.find('.option-number');
    this.$view.data('model', this);

    return this.$view;
  };

  Square.prototype.update_view = function () {
    var coord, square, classes = [];

    if (!this.$view) {
      return;
    }

    if (this.board.defer_render) {
      this.needs_updated = true;
      return;
    }

    this.$view.removeClass(
      'p1 p2 valid selected placed '
      + _.values(this.board.direction_names).join(' ')
    );
    if (this.player) {
      classes.push('p'+this.player);
    }
    if (this.is_valid) {
      classes.push('valid');
    }
    if (this.is_selected) {
      classes.push('selected');
    }
    if (this.is_placed) {
      classes.push('placed');
    }

    this.$view.addClass(
      classes.join(' ')+' '
      + _.map(this.connections, this.board.direction_name).join(' ')
    );

    this.needs_updated = false;
  };

  Square.prototype.select = function (event) {
    var tmp_ply = this.board.tmp_ply
      , is_alt_select = event && (!!event.click_duration || event.button == 2)
      , linenum = this.board.current_linenum()
      , player = linenum == 1 ? (this.board.turn == 1 ? 2 : 1) : this.board.turn
      , piece, stone;


    if (this.board.selected_pieces.length) {
      this.drop_selection(is_alt_select);
    } else if (this.piece) {
      // Nothing selected yet, but this square has a piece
      piece = this.piece;

      if (
        piece.ply && this.board.ply_index == piece.ply.index
        && linenum != 1
        && !(linenum == 2 && this.board.turn == 1)
      ) {
        // Cycle through F, S, C
        if (piece.stone == 'F') {
          stone = 'S';
        } else {
          if (
            piece.stone == 'C' && this.board.pieces[player == 1 ? 2 : 1].F.length
            || piece.stone == 'S' && !this.board.pieces[player == 1 ? 2 : 1].C.length
          ) {
            stone = '';
          } else {
            stone = 'C';
          }
        }
        this.board.go_to_ply(this.board.ply_index, false);
        this.board.current_move.plys.pop();
        this.board.game.insert_ply(
          stone + this.coord,
          this.board.current_branch,
          this.board.current_linenum(),
          this.board.turn
        );
      } else if (linenum != 1) {
        // Select piece or stack
        this.board.selected_pieces = is_alt_select ?
          [piece] : [piece].concat(piece.captives.slice(0, this.board.size - 1)
        );
        for (var i = 0; i < this.board.selected_pieces.length; i++) {
          this.board.selected_pieces[i].is_selected = true;
        }
        piece.render();
        this.board.update_valid_squares();
        this.board.set_active_squares([this]);
        this.$view.addClass('selected');
      }
    } else {
      // Place piece as new ply
      stone = '';

      if (linenum != 1) {
        if (
          is_alt_select && event.button === 0
          || !this.board.pieces[player].F.length
        ) {
          // Long-left-click, or no flats left
          if (this.board.pieces[player].C.length) {
            stone = 'C';
          } else {
            stone = 'S';
          }
        } else if (is_alt_select) {
          // Long-touch but not long-click
          stone = 'S';
        }
      }

      this.board.game.insert_ply(
        stone + this.coord,
        this.board.current_branch,
        this.board.current_linenum(),
        this.board.turn
      );
    }
  };

  Square.prototype.drop_selection = function (drop_all) {
    var tmp_ply = this.board.tmp_ply
      , piece, direction;

    if (this.board.selected_pieces[0].square == this) {
      // Drop selected piece (or pieces if drop_all) in current square
      if (drop_all) {
        piece = this.piece;
        this.board.deselect_all(true);
        if (tmp_ply) {
          tmp_ply.drops[tmp_ply.drops.length - 1] += this.board.selected_pieces.length;
        }
        this.board.selected_pieces.length = 0;
      } else {
        piece = this.board.selected_pieces.pop();
        piece.is_selected = false;
        if (tmp_ply) {
          tmp_ply.drops[tmp_ply.drops.length - 1] += 1;
        }
      }
      piece.render();

      if (!this.board.selected_pieces.length) {
        this.board.set_active_squares(
          this.board.game.plys.length ?
            this.board.current_ply.squares
            : []
          );
      }
    } else {
      // Drop selected piece (or pieces if drop_all) in different square
      var prev_square = this.board.selected_pieces[0].square
        , remaining_stack = prev_square.piece.captives.slice(
            this.board.selected_pieces.length - 1
          );

      // Update or create temporary ply
      if (tmp_ply) {
        if (!this.board.validate_neighbor(this, this.neighbors[tmp_ply.direction], this.board.selected_pieces.length - 1)) {
          drop_all = true;
        }
        tmp_ply.drops.push(
          drop_all ? this.board.selected_pieces.length : 1
        );
      } else {
        direction = _.findKey(prev_square.neighbors, this);
        if (!this.board.validate_neighbor(this, this.neighbors[direction], this.board.selected_pieces.length - 1)) {
          drop_all = true;
        }
        tmp_ply = this.board.tmp_ply = {
          count: this.board.selected_pieces.length,
          square: prev_square.coord,
          direction: direction,
          drops: [drop_all ? this.board.selected_pieces.length : 1]
        };
      }

      // Record wall flattening
      if (this.piece && this.piece.stone == 'S') {
        tmp_ply.flattens = tmp_ply.drops.length - 1;
      }

      // Mark dropped piece(s) as not selected
      if (drop_all) {
        this.board.deselect_all(true);
      } else {
        _.last(this.board.selected_pieces).is_selected = false;
      }

      // Place the selection on this square, leaving behind remaining_stack
      prev_square.set_piece(remaining_stack[0], remaining_stack.slice(1));
      this.set_piece(
        this.board.selected_pieces[0],
        this.board.selected_pieces.slice(1).concat(
          this.piece ? [this.piece].concat(this.piece.captives) : []
        )
      );

      // Update selection
      if (drop_all) {
        this.board.selected_pieces.length = 0;
      } else {
        this.board.selected_pieces.length -= 1;
      }

      this.set_active();
    }

    this.is_selected = !!this.piece && this.piece.is_selected;

    if (tmp_ply && !this.board.selected_pieces.length) {
      // Temporary ply and nothing selected
      // Insert slide as new ply
      this.board.game.insert_ply(
        ''
          + (tmp_ply.count > 1 ? tmp_ply.count : '')
          + tmp_ply.square
          + tmp_ply.direction
          + (tmp_ply.drops.length > 1 ? tmp_ply.drops.join('') : ''),
        this.board.current_branch,
        this.board.current_linenum(),
        this.board.turn,
        true,
        tmp_ply.flattens
      );
    }

    this.board.update_valid_squares();
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
      , moving_stack, remaining_stack, i
      , was_render_deferred = this.board.defer_render;

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

    this.board.defer_render = true;

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

    if (!was_render_deferred) {
      this.board.defer_render = false;
      this.board.update_view();
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
      '<div class="option-number"></div>'+
    '</div>'
  );

  return Square;

});
