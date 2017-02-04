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

    this.turn = 1;
    this.ply_index = 0;
    this.ply_is_done = false;
    this.is_eog = false;
    this.comments_ply_index = -2;
    this.size = 5;
    this.squares = {};
    this.rows = [];
    this.cols = [];
    this.all_pieces = [];
    this.pieces = {};
    this.flat_score = {1:0, 2:0};
    this.empty_count = this.size * this.size;
    this.selected_pieces = [];
    this.tmp_ply = null;
    this.init_callbacks = [];
    this.resize_callbacks = [];
    this.ply_callbacks = [];

    _.bindAll(this, [
      'resize',
      'rotate_handler',
      'reset_rotation',
      'select_square',
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
      'last',
      'direction_name'
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
    this.turn = 1;
    this.ply_index = 0;
    this.ply_is_done = false;
    this.is_eog = false;
    this.comments_ply_index = -2;
    this.squares = {};
    this.all_pieces = [];
    this.flat_score[1] = 0;
    this.flat_score[2] = 0;
    this.empty_count = this.size * this.size;
    this.selected_pieces.length = 0;
    this.tmp_ply = null;
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
    this.empty_count = this.size * this.size;
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
        this.squares[square.coord] = square;
        if (row) {
          square.neighbors['-'] = this.squares[app.square_coord([col, row-1])];
          this.squares[app.square_coord([col, row-1])].neighbors['+'] = square;
        }
        if (col) {
          square.neighbors['<'] = this.squares[app.square_coord([col-1, row])];
          this.squares[app.square_coord([col-1, row])].neighbors['>'] = square;
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
          if (!that.squares[square.coord].parse(square.text)) {
            that.invalid_tps(square);
          }
        }
      });
      if (this.tps.player) {
        this.turn = this.tps.player;
      }
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
      this.check_game_end();
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


  Board.prototype.current_linenum = function () {
    var current_ply = this.game.plys[this.ply_index];
    if (current_ply) {
      return current_ply.move.linenum.value
        + 1*(this.ply_is_done && current_ply.turn == 2);
    } else {
      return this.game.config.tps && this.game.config.tps.move ?
        this.game.config.tps.move : 1;
    }
  };


  // Returns true if game end, or if not game end but ply has result
  Board.prototype.check_game_end = function () {
    var current_ply = this.game.plys[this.ply_index]
      , pieces = this.pieces[this.turn == 1 ? 2 : 1]
      , roads = this.find_roads()
      , result;

    this.is_eog = false;

    if (!current_ply) {
      return false;
    }

    if (roads && roads.length) {
      // Road
      if (roads[current_ply.turn].length) {
        result = current_ply.turn == 1 ? 'R-0' : '0-R';
      } else if (roads[current_ply.turn == 1 ? 2 : 1].length) {
        // Completed opponent's road
        result = current_ply.turn == 1 ? '0-R' : 'R-0';
      }
    } else if (this.empty_count == 0 || pieces.F.concat(pieces.C).length == 0) {
      // Last empty square or last piece
      if (this.flat_score[1] == this.flat_score[2]) {
        // Draw
        result = '1/2-1/2';
      } else if (this.flat_score[1] > this.flat_score[2]) {
        result = 'F-0';
      } else {
        result = '0-F';
      }
    } else if (current_ply.move.result && current_ply.move.result.type != '1') {
      // Not game end, so remove result
      if (current_ply.is_last()) {
        current_ply.move.result = null;
        this.game.config.result = null;
      }
      current_ply.result = null;
      this.game.update_text(true);
      // Return true to indicate a change was made
      return true;
    } else {
      return false;
    }

    result = current_ply.move.insert_result(result, current_ply.turn);
    if (roads && roads.length) {
      result.roads = roads;
    }

    this.is_eog = true;
    return true;
  };


  Board.prototype.find_roads = function () {
    var possible_roads = { 1: {}, 2: {} };

    // Recursively follow a square and return all connected squares and edges
    function _follow_road(square) {
      var squares = {}
        , edges = {}
        , i, neighbor, road;

      squares[square.coord] = square;
      delete possible_roads[square.player][square.coord];

      if (square.is_edge) {
        // Note which edge(s) the road touches
        edges[square.edges[0]] = true;
        if (square.edges[1]) {
          edges[square.edges[1]] = true;
        }
      }

      for (i = 0; i < square.road_connections.length; i++) {
        neighbor = square.neighbors[square.road_connections[i]];
        if (_.has(possible_roads[square.player], neighbor.coord)) {
          // Haven't gone this way yet; find out where it goes
          road = _follow_road(neighbor);
          // Report back squares and edges
          _.assign(squares, road.squares);
          _.assign(edges, road.edges);
        }
      }

      return {
        squares: squares,
        edges: edges
      };
    }

    // Remove all dead_ends and their non-junction neighbors from squares
    // Mutates squares, but not dead_ends
    function _remove_dead_ends(dead_ends, squares) {
      var next_neighbors
        , i, j, square, neighbor;

      dead_ends = dead_ends.concat();

      while (dead_ends.length) {
        for (i = 0; i < dead_ends.length; i++) {
          square = dead_ends[i];

          next_neighbors = [];
          for (var j = 0; j < square.road_connections.length; j++) {
            neighbor = square.neighbors[square.road_connections[j]];
            if (_.has(squares, neighbor.coord)) {
              next_neighbors.push(neighbor);
            }
          }

          if (next_neighbors.length < 2) {
            delete squares[square.coord];
            dead_ends[i] = next_neighbors[0];
          } else {
            dead_ends[i] = undefined;
          }
        }
        dead_ends = _.compact(dead_ends);
      }
    }

    // Gather player-controlled squares and dead ends
    var possible_dead_ends = {
          1: { ns: [], ew: [] },
          2: { ns: [], ew: [] }
        }
      , dead_ends = []
      , coord, square, edges;

    for (coord in this.squares) {
      square = this.squares[coord];
      edges = square.is_edge ? square.edges.join('') : null;

      if (square.road_connections.length == 1) {
        if (square.is_edge) {
          // An edge with exactly one friendly neighbor
          possible_roads[square.player][coord] = square;

          if (!square.is_corner) {
            if (square.is_ns) {
              possible_dead_ends[square.player].ns.push(square);
            } else if (square.is_ew) {
              possible_dead_ends[square.player].ew.push(square);
            }
          }
        } else {
          // A non-edge dead end
          dead_ends.push(square);
        }
      } else if (square.road_connections.length > 1) {
        // An intersection
        possible_roads[square.player][coord] = square;
      }
    }

    // Remove dead ends not connected to edges
    _remove_dead_ends(dead_ends, possible_roads[1]);
    _remove_dead_ends(dead_ends, possible_roads[2]);

    // Find roads that actually bridge opposite edges
    var roads = {
          1: [], 2: [],
          squares: {
            1: {}, 2: {}, all: {}
          }
        }
      , road;

    for (i = 1; i <= 2; i++) {
      while (!_.isEmpty(possible_roads[i])) {
        // Start with any square in possible_roads
        for (coord in possible_roads[i]) break;

        // Follow the square to get all connected squares
        road = _follow_road(possible_roads[i][coord]);

        // Find connected opposite edge pair(s)
        road.edges.ns = road.edges['-'] && road.edges['+'] || false;
        road.edges.ew = road.edges['<'] && road.edges['>'] || false;

        if (road.edges.ns || road.edges.ew) {
          if (!road.edges.ns || !road.edges.ew) {
            // Remove dead ends connected to the non-winning edges
            _remove_dead_ends(
              possible_dead_ends[i][road.edges.ns ? 'ew' : 'ns'],
              road.squares
            );
          }

          // Keep the road; at least one opposite edge pair is connected
          roads[i].push({
            ns: road.edges.ns,
            ew: road.edges.ew,
            squares: _.keys(road.squares)
          });
          _.assign(roads.squares[i], road.squares);
          _.assign(roads.squares.all, road.squares);
        }
      }
    }

    roads.squares[1] = _.keys(roads.squares[1]);
    roads.squares[2] = _.keys(roads.squares[2]);
    roads.squares.all = _.keys(roads.squares.all);
    roads.length = roads[1].length + roads[2].length;

    return roads;
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
          app.square_coord([j, this.size - 1 - i])
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


  Board.prototype.rotate_handler = function (event) {
    if (
      !config.board_3d
      || event.type == 'touchstart'
        && event.originalEvent.touches.length != 2
      || event.type == 'mousedown'
        && !event.metaKey && !event.ctrlKey && event.button != 1
    ) {
      return;
    }

    var x, y;

    if (event.originalEvent.touches) {
      x = (event.originalEvent.touches[0].clientX + event.originalEvent.touches[1].clientX)/2;
      y = (event.originalEvent.touches[0].clientY + event.originalEvent.touches[1].clientY)/2;
    } else {
      x = event.clientX;
      y = event.clientY;
    }

    app.dragging = {
      x: x,
      y: y,
      rotation: config.board_rotation
    };

    app.$document.on(
      'mousemove touchmove',
      app.rotate_board
    );

    app.$document.on('mouseup touchend', this.stop_rotating);

    event.preventDefault();
    event.stopPropagation();
  };


  Board.prototype.stop_rotating = function () {
    app.$document.off('mousemove touchmove', app.rotate_board);
    delete app.dragging;
  };


  Board.prototype.reset_rotation = function (event) {
    if (
      // 3D enabled
      config.board_3d
      && (
        !event
        || event.target == app.$viewer[0]
        && (
          event.metaKey || event.ctrlKey || event.button == 1
          || event.click_duration
          && (
            event.button == 1
            || event.originalEvent.type == 'touchstart'
          )
        )
      )
    ) {
      this.stop_rotating();
      app.rotate_board(false);
    }
  };


  Board.prototype.select_square = function (event) {
    if (
      app.dragging
      || event.type == 'touchstart'
        && event.originalEvent.touches.length != 1
      || event.type == 'mousedown'
        && (
          event.metaKey || event.ctrlKey
          || event.button != 0 && event.button != 1
        )
    ) {
      return;
    }

    var square = $(event.target).data('model');

    square.select(event);

    event.preventDefault();
    event.stopPropagation();
  };


  Board.prototype.deselect_all = function (silently) {
    if (silently) {
      for (var i = 0; i < this.selected_pieces.length; i++) {
        this.selected_pieces[i].is_selected = false;
        this.selected_pieces[i].square.is_selected = false;
      }
    } else if (this.tmp_ply) {
      this.selected_pieces[0].square.drop_selection(true);
    } else {
      var piece;

      while (this.selected_pieces.length) {
        piece = this.selected_pieces.pop();
        piece.is_selected = false;
      }

      if (piece) {
        piece.render();
        this.update_valid_squares();
        this.update_active_squares();
      }
    }
  };


  Board.prototype.update_view = function() {
    this.update_pieces();
    this.update_squares();
    this.update_scores();
    this.on_ply();
  };


  Board.prototype.update_squares = function() {
    _.invokeMap(
      _.filter(this.squares, { needs_updated: true }),
      'update_view'
    );
  };


  Board.prototype.update_pieces = function() {
    _.invokeMap(
      _.filter(this.all_pieces, { needs_updated: true, captor: null }),
      'render'
    );
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


  Board.prototype.update_ptn = function() {
    var current_ply = this.game.plys[this.ply_index] || this.game.plys[0]
      , ply1, ply2, $ply1, $ply2;

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
        if (ply1.turn == current_ply.move.first_turn) {
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

    if (
      this.selected_pieces.length
      || this.ply_index >= this.game.plys.length
      || this.ply_index < 0
    ) {
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
    this.is_eog = !!ply.result;
    this.turn = ply.turn == 1 ? 2 : 1;

    if (!this.defer_render) {
      this.on_ply();
    }

    if (ply.is_last()) {
      this.pause();
    }

    return ply_result;
  };


  Board.prototype.undo_ply = function () {
    var ply, square, piece, ply_result;

    if (!this.ply_is_done) {
      return true;
    }

    if (
      this.selected_pieces.length
      || this.ply_index >= this.game.plys.length
      || this.ply_index < 0
    ) {
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
    this.is_eog = false;
    this.turn = ply.turn;

    if (!this.defer_render) {
      this.on_ply();
    }

    return ply_result;
  };


  Board.prototype.illegal_ply = function (ply) {
    if (this.game.is_editing) {
      this.m_parse.error(
        t.error.illegal_ply({ ply: ply.text })
      ).click(function () {
        app.select_token_text(ply);
      });
    }
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


  Board.prototype.update_active_squares = function () {
    var ply = this.game.plys[this.ply_index];

    if (ply) {
      if (ply.result && ply.result.roads && this.ply_is_done) {
        this.set_active_squares(ply.result.roads.squares[ply.result.victor]);
      } else {
        this.set_active_squares(ply.squares);
      }
    } else {
      this.set_active_squares();
    }
  };


  Board.prototype.update_valid_squares = function () {
    if (!this.$view) {
      return;
    }

    var that = this
      , current_ply = this.game.plys[this.ply_index]
      , square, direction, neighbor;

    function clear_all() {
      var coord, square;
      for (coord in that.squares) {
        square = that.squares[coord];
        square.needs_updated = true;
        square.is_valid = false;
        square.is_selected = false;
        square.is_placed = false;
      }
    }

    if (this.tmp_ply) {
      clear_all();
      square = this.selected_pieces[0].square;
      square.is_valid = true;
      square.is_selected = true;
      this.validate_neighbor(square, square.neighbors[this.tmp_ply.direction]);
    } else if (this.selected_pieces.length) {
      clear_all();
      square = this.selected_pieces[0].square;
      square.is_valid = true;
      square.is_selected = true;
      for (direction in square.neighbors) {
        this.validate_neighbor(square, square.neighbors[direction]);
      }
    } else if(!this.is_eog) {
      for (square in this.squares) {
        square = this.squares[square];
        square.needs_updated = true;
        if (square.piece) {
          if (square.piece.ply === current_ply) {
            square.is_valid = true;
            square.is_selected = false;
            square.is_placed = true;
          } else if (square.piece.player == this.turn) {
            square.is_valid = true;
            square.is_selected = false;
            square.is_placed = false;
          } else {
            square.is_valid = false;
            square.is_selected = false;
            square.is_placed = false;
          }
        } else {
          square.is_valid = true;
          square.is_selected = false;
          square.is_placed = false;
        }
      }
    } else {
      clear_all();
      if (current_ply && !current_ply.is_slide) {
        square = this.squares[current_ply.square];
        square.is_valid = true;
        square.is_placed = true;
      }
    }

    if (this.$view) {
      this.update_squares();
    }
  };


  Board.prototype.validate_neighbor = function (square, neighbor, pending_drops) {
    if (
      neighbor && (
        !neighbor.piece
        || neighbor.piece.stone != 'C' && (
          neighbor.piece.stone != 'S'
          || this.selected_pieces[0].stone == 'C'
            && this.selected_pieces.length == 1 + (pending_drops || 0)
        )
      )
    ) {
      if (!neighbor.is_valid) {
        neighbor.needs_updated = true;
      }
      neighbor.is_valid = true;
      return true;
    }
    return false;
  };


  Board.prototype.show_comments = function (ply) {
    var that = this
      , result = this.game.config.result;

    if (this.defer_render) {
      return;
    }

    this.m.clear();

    // Show comments before first move
    if (!ply || ply.is_first() && !this.ply_is_done) {
      if (this.game.comments) {
        _.map(this.game.comments.concat(), this.comment);
      }
      return;
    }

    // Show result
    if (
      this.ply_is_done && (
        ply.result
        || result && result.type == '1' && ply.is_last()
      )
    ) {
      this.m['player'+result.victor](result.message);
      if (result.comments) {
        _.map(result.comments.concat(), this.comment);
      }
    }

    // Show ply comments
    if (ply.comments) {
      _.map(ply.comments.concat(), this.comment);
    }

    // Show Tak and Tinue
    if (this.ply_is_done && ply.evaluation && /['"]/.test(ply.evaluation)) {
      this.m['player'+ply.player](
        /"|''/.test(ply.evaluation) ? t.Tinue : t.Tak
      );
    }
  };


  Board.prototype.play = function () {
    if (
      !this.selected_pieces.length && (
        this.game.plys[this.ply_index]
        && this.ply_index != this.game.plys.length - 1
        || !this.ply_is_done
      )
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
    if (this.selected_pieces.length) {
      return false;
    }

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

  Board.prototype.direction_names = {
    '+': 'up',
    '-': 'down',
    '<': 'left',
    '>': 'right'
  };

  Board.prototype.direction_name = function (direction) {
    return this.direction_names[direction];
  };

  return Board;

});
