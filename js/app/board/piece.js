// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/config', 'app/messages', 'i18n!nls/main', 'lodash'], function (config, Messages, t, _) {

  var Piece = function (board, player, stone) {
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

    board.all_pieces.push(this);
    board.pieces[this.player][this.true_stone].push(this);

    _.bindAll(this, 'render');

    return this;
  };

  Piece.prototype.to_tps = function () {
    return _.map(this.captives, 'player').reverse().join('')
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
      , location, captive_offset = 6;

    if (this.board.defer_render) {
      this.needs_updated = true;
      return;
    }

    // Set Z
    if (this.captor) {
      this.z = this.captor.captives.length - this.stack_index;
      this.is_immovable = this.stack_index >= this.board.size - 1;
    } else if (this.captives.length) {
      this.z = this.captives.length + 1;
      this.is_immovable = false;
      _.invokeMap(this.captives, 'render');
    } else {
      this.z = square ? 1 : this.piece_index;
      this.is_immovable = false;
    }

    // Set X and Y
    if (square) {
      this.x = 100*square.col;
      this.y = -100*square.row;
      if(this.is_immovable) {
        this.y += captive_offset*(1 - this.z);
      } else {
        this.y += captive_offset*(
          1 - this.z + 1*(this.stone == 'S' && !!this.captives.length)
        );

        if ((this.captor||this).z > this.board.size) {
          this.y += captive_offset*((this.captor||this).z - this.board.size);
        }
      }
    } else {
      this.z += this.board.piece_counts.total;

      if (this.player == 2) {
        this.z += this.board.piece_counts.total;
        this.x = 75;
      } else {
        this.x = 0;
      }

      this.y = (this.board.size - 1) * -100 * this.piece_index / this.board.piece_counts.total;
    }

    // Render or update the view
    if (!this.$view) {
      this.$view = $(this.tpl.piece(this));
      this.$stone = this.$view.find('.stone');
      this.$captive = this.$view.find('.captive');
      this.$view.data('model', this);
    } else {
      this.$view[0].style = this.tpl.location(this);
      this.$view[0].className = this.tpl.piece_class(this);
      this.$stone[0].className = this.tpl.stone_class(this);
      this.$stone.removeClass('F S').addClass(this.stone);
    }

    // Update road visualization
    if (!this.captor && square) {
      square.$view.removeClass('p1 p2').addClass('p'+this.player);
      _.each(this.board.direction_name, function (dn, d) {
        if (square.neighbors[d]) {
          if (
            that.stone != 'S' &&
            square.neighbors[d].piece &&
            square.neighbors[d].piece.player == that.player &&
            square.neighbors[d].piece.stone != 'S'
          ) {
            square.$view.addClass(dn);
            square.neighbors[d].$view.addClass(
              that.board.direction_name[
                that.board.opposite_direction[d]
              ]
            );
          } else {
            square.$view.removeClass(dn);
            square.neighbors[d].$view.removeClass(
              that.board.direction_name[
                that.board.opposite_direction[d]
              ]
            );
          }
        } else if (that.stone != 'S') {
          // Edge
          square.$view.addClass(dn);
        } else {
          square.$view.removeClass(dn);
        }
      });
    }

    if (!$.contains(app.$html[0], this.$view[0])) {
      this.board.$pieces.append(this.$view);
    }

    this.needs_updated = false;

    return this.$view;
  };

  Piece.prototype.tpl = {
    piece_class: _.template(
      'piece'+
      '<% if (square) { %>'+
        '<% if (is_immovable) { %>'+
          ' immovable'+
        '<% } %>'+
      '<% } else { %>'+
        ' unplayed'+
      '<% } %>'
    ),
    location: _.template(
      'transform: translate3d(<%=x%>%, <%=y%>%, <%=z%>px);'
    ),
    stone_class: _.template('stone p<%=player%> <%=stone%>'),
    piece: _.template(
      '<div class="<%=tpl.piece_class(obj)%>" '+
        ' style="<%=tpl.location(obj)%>"'+
      '>'+
        '<div class="captive p<%=player%>"></div>'+
        '<div class="<%=tpl.stone_class(obj)%>"></div>'+
      '</div>'
    )
  };

  return Piece;

});
