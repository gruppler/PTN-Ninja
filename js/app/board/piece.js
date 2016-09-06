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
      this.scale = 1;
      this.x = 100*(square.col - this.board.size/2);
      this.y = 100*(this.board.size/2 - 1 - square.row);
    } else {
      this.scale = this.board.size/10;

      this.x = 100*(this.board.size + this.player*2/3 - 0.5)/2 - 5*this.board.size;

      this.y = (
        95 * this.piece_index *
          this.board.size /
            (this.board.piece_counts.total - 1 / this.board.size)
        + 25
      ) - 50*(this.board.size + 1);
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

    location = this.tpl.piece_location(this);

    if (!this.$view) {
      this.$view = $(this.tpl.piece(this));
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
      this.$stone[0].className = this.tpl.stone_class(this);
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

    if (square) {
      this.$view.addClass('played');
    } else {
      this.$view.removeClass('played');
      this.$stone.removeClass('S');
    }

    this.needs_updated = false;

    return this.$view;
  };

  Piece.prototype.tpl = {
    stone_class: _.template('stone p<%=player%> <%=stone%>'),
    piece_location: _.template(
      'translate(<%=x%>%, <%=y%>%) scale(<%=scale%>)'
    ),
    piece: _.template(
      '<div class="piece">'+
        '<div class="wrapper">'+
          '<div class="captive p<%=player%>"></div>'+
          '<div class="<%=tpl.stone_class(obj)%>"></div>'+
        '</div>'+
      '</div>'
    )
  };

  return Piece;

});
