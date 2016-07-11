// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/config', 'app/messages', 'i18n!nls/main', 'lodash'], function (config, Messages, t, _) {

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

  var tpl = {
    row: _.template('<span class="row"><%=obj%></span>'),

    col: _.template('<span class="col"><%=obj%></span>'),

    square: _.template(
      '<div class="square c<%=col%> r<%=row%> <%=color%>">'+
        '<div class="road">'+
          '<div class="up"></div>'+
          '<div class="down"></div>'+
          '<div class="left"></div>'+
          '<div class="right"></div>'+
        '</div>'+
      '</div>'
    ),

    stone_class: _.template('stone p<%=player%> <%=stone%>'),
    piece_location: _.template(
      'translate(<%=x%>%, <%=y%>%) scale(<%=scale%>) rotate(<%=rotate%>deg)'
    ),
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

  Piece = function (board, player, stone) {
    this.needs_updated = true;
    this.board = board;
    this.player = 1*player || 1;
    this.stone = stone || 'F';
    this.true_stone = stone == 'C' ? stone : 'F';
    this.ply = null;
    this.square = null;
    this.captor = null;
    this.captives = [];
    this.piece_index = board.pieces[this.player][this.true_stone].length;
    if (this.stone == 'C') {
      this.piece_index += board.piece_counts.F;
    }

    this.tpl = this.board.tpl;  // give template access to tpl

    board.all_pieces.push(this);
    board.pieces[this.player][this.true_stone].push(this);
    return this;
  };

  Piece.to_tps = function () {
    return _.map(this.captives, 'player').join('')
      + this.player
      + (this.stone == 'F' ? '' : this.stone);
  };

  Piece.prototype.set_ply = function (ply) {
    this.ply = ply;
    if (!ply.is_slide) {
      this.stone = ply.stone;
    }
  };

  Piece.prototype.set_captives = function (captives) {
    var that = this;

    this.captor = null;
    this.captives = captives || [];

    _.each(this.captives, function (captive, index) {
      captive.stack_index = index;
      captive.captor = that;
      captive.square = that.square;
      captive.stone = 'F';
      captive.captives.length = 0;
    });
  };

  Piece.prototype.render = function () {
    var that = this
      , square = this.square
      , location, captive_offset = 6, capstones;

    if (this.board.defer_render) {
      this.needs_updated = true;
      return;
    }

    // Set height
    if (this.captor) {
      this.height = this.captor.captives.length - this.stack_index;
      this.is_immovable = this.stack_index >= this.board.size - 1;
    } else if (this.captives.length) {
      this.height = this.captives.length + 1;
      this.is_immovable = false;
      _.invokeMap(this.captives, 'render');
    } else {
      this.height = square ? 1 : this.piece_index;
      this.is_immovable = false;
    }

    // Calculate location transform
    if (square) {
      this.rotate = 0;
      this.scale = 1;
      this.x = 100*(square.col - this.board.size/2);
      this.y = 100*(this.board.size/2 - 1 - square.row);
    } else {
      this.rotate = this.player == 1 ? -90 : 90;
      this.scale = this.board.size/10;

      this.x = (this.player == 1 ? -1 : 1) * (
        85 * (
          this.board.size/(2*this.board.piece_counts.total - 2/this.board.size) * (
            this.piece_index
          )
        ) + 25
      ) - 50;

      this.y = -100*(this.board.size + 1)/2 - 5*this.board.size;
    }

    // Offset captives
    if (square && !this.is_immovable) {
      this.y += captive_offset*(
        1 - this.height + 1*(this.stone == 'S' && !!this.captives.length)
      );

      if ((this.captor||this).height > this.board.size) {
        this.y += captive_offset*((this.captor||this).height - this.board.size);
      }
    }

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

    if (square && this.is_immovable) {
      this.$view.addClass('immovable');
      this.$captive.css('transform', 'translateY('+(-captive_offset*(this.height - 1)/0.07) + '%)');
    } else {
      this.$view.removeClass('immovable');
      this.$captive.css('transform', '');
    }

    if (!this.$view.closest('html').length) {
      this.board.$pieces.append(this.$view);
    }

    // Update road visualization
    if (!this.captor && square) {
      square.$view.removeClass('p1 p2').addClass('p'+this.player);
      _.each(direction_name, function (dn, d) {
        if (square.neighbors[d]) {
          if (
            that.stone != 'S' &&
            square.neighbors[d].piece &&
            square.neighbors[d].piece.player == that.player &&
            square.neighbors[d].piece.stone != 'S'
          ) {
            square.$view.addClass(dn);
            square.neighbors[d].$view.addClass(
              direction_name[opposite_direction[d]]
            );
          } else {
            square.$view.removeClass(dn);
            square.neighbors[d].$view.removeClass(direction_name[opposite_direction[d]]);
          }
        } else if (that.stone != 'S') {
          // Edge
          square.$view.addClass(dn);
        } else {
          square.$view.removeClass(dn);
        }
      });
    }

    if (square) {
      this.$view.addClass('played');
    } else {
      this.$view.removeClass('played');
      this.$stone.removeClass('S');
    }

    this.needs_updated = false;

    return this.$view;
  };


  // Square

  Square = function (board, row, col) {
    this.board = board;
    this.col = col;
    this.row = row;
    this.square = app.i_to_square(row, col);
    this.color = (row % 2 != col % 2) ? 'dark' : 'light';
    this.piece = null;
    this.neighbors = {};

    return this;
  };

  Square.prototype.to_tps = function () {
    return this.piece ? this.piece.to_tps() : 'x';
  };

  Square.prototype.parse = function (tps) {
    var that = this
      , piece, player, stone = 'F';

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

    piece.set_captives(
      _.map(tps, function (player) {
        return that.board.pieces[player].F.pop();
      })
    );

    if (piece.captives.indexOf(undefined) >= 0) {
      return false;
    }

    return this.set_piece(piece, false);
  };

  Square.prototype.set_piece = function (piece, captives) {
    var that = this
      , previous_piece = this.piece;

    this.piece = piece || null;

    if (this.$view) {
      this.$view.removeClass('p1 p2');
    }

    if (piece) {
      piece.square = this;
      piece.set_captives(captives || piece.captives);
      piece.render();
    } else if (previous_piece) {
      previous_piece.render();

      if (this.$view) {
        this.$view.removeClass(_.values(direction_name).join(' '));
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
    var pieces = this.board.pieces[ply.player][ply.true_stone]
      , piece;

    if (this.piece || !pieces.length) {
      return this.board.illegal_ply(ply);
    }

    piece = pieces.pop();

    piece.set_ply(ply);
    this.set_piece(piece, false, true);
    ply.squares[0] = this;

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
    this.all_pieces = [];
    this.pieces = {};
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
    this.squares = {};
    this.all_pieces = [];
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
      _.invokeMap(this.callbacks_start, 'call', this, this);
      m.clear(false, true);
      this.pause();
    }

    this.defer_render = true;
    this.game = game;
    this.size = 1*game.config.size;
    this.piece_counts = _.clone(app.piece_counts[this.size]);
    this.tps = game.config.tps && game.config.tps.is_valid ? game.config.tps : undefined;

    this.saved_ply = this.ply;
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
          square.neighbors['-'] = this.squares[app.i_to_square(row-1, col)];
          this.squares[app.i_to_square(row-1, col)].neighbors['+'] = square;
        }
        if (col) {
          square.neighbors['<'] = this.squares[app.i_to_square(row, col-1)];
          this.squares[app.i_to_square(row, col-1)].neighbors['>'] = square;
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
      _.each(this.tps.squares, function (square, i) {
        if (!square.is_space && !square.error) {
          if (!that.squares[square.square].parse(square.text)) {
            that.invalid_tps(square, i);
          }
        }
      });
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
    var squares = []
      , i, j;

    for (i = 0; i < this.size; i++) {
      squares[i] = [];
      for (j = 0; j < this.size; j++) {
        squares[i][j] = this.squares[app.i_to_square(this.size - 1 - i, j)].to_tps();
      }
      squares[i] = squares[i].join(',');
    }
    squares = squares.join('/');

    squares = squares.replace(/x(\d?),x/g, function (count) {
      if (count) {
        return 'x'+(count + 1);
      } else {
        return 'x2';
      }
    });

    return squares + ' ' +this.game.player+ ' ' + this.game.moves.length + 1;
  };

  Board.prototype.render = function () {
    this.$view = $(tpl.board(this));
    this.$squares = this.$view.find('.squares');
    this.$pieces = this.$view.find('.pieces');

    this.$squares.append.apply(
      this.$squares,
      _.invokeMap(this.squares, 'render')
    );

    this.$pieces.empty();
    _.invokeMap(
      _.filter(this.all_pieces, {captive: null}),
      'render'
    );

    this.go_to_ply(this.saved_ply || 0);

    return this.$view;
  };

  Board.prototype.update = function() {
    _.invokeMap(
      _.filter(this.all_pieces, { needs_updated: true }),
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
      this.show_comments(0);
    } else {
      this.show_comments(ply);
    }

    _.invokeMap(this.ply_callbacks, 'call', this, this.ply - 1);

    if (ply.is_slide) {
      ply_result = square.slide(ply);
    } else {
      ply_result = square.place(ply);
    }

    this.set_active_squares(ply.squares);

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
      this.show_comments(0);
      this.set_active_squares(ply.squares);
    } else {
      this.show_comments(this.game.plys[this.ply - 1]);
      this.set_active_squares(this.game.plys[this.ply - 1].squares);
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
    ply.is_illegal = true;
    return false;
  };

  Board.prototype.invalid_tps = function (square) {
    m_parse.error(
      t.error.invalid_tag_value({tag: t.TPS, value: square.text})
    );
    square.error = true;

    return false;
  };

  Board.prototype.set_active_squares = function (squares) {
    if (this.$view) {
      this.$squares.children().removeClass('active');
      _.invokeMap(squares, 'set_active');
    }
  };

  Board.prototype.show_comments = function (ply) {
    m.clear(false, true);

    if (ply === 0) {
      if (this.game.comments) {
        _.map(this.game.comments, comment);
      }
      m.player1(this.game.config.player1);
      m.player2(this.game.config.player2);
    }

    if (!ply || this.defer_render) {
      return;
    }

    if (ply && ply.evaluation && /['"]/.test(ply.evaluation)) {
      m['player'+ply.player](/"|''/.test(ply.evaluation) ? t.Tinue : t.Tak);
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
      this.play_timer = setInterval(_.bind(this.do_ply, this), 6e4/config.play_speed);
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
        this.show_comments(0);
        if (this.$view) {
          this.$squares.children().removeClass('active');
        }
      } else {
        this.show_comments(this.game.plys[this.ply - 1]);
      }

      this.update();
    }
  };

  return Board;

});
