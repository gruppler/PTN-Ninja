// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'i18n!nls/main',
  'app/config',
  'app/hotkeys',
  'app/menu',
  'app/game',
  'app/board',
  'mdown!../../readme.md',
  'text!../../sample.ptn',
  'lodash',
  'jquery',
  'dialog-polyfill',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'smoothscroll'
], function (t, config, hotkeys, menu, Game, Board, readme, sample_ptn, _, $, dialogPolyfill) {

  var baseurl = location.origin + location.pathname;

  var d = new Date()
    , today = function () {
        return d.getFullYear() +'.'+
        _.padStart(d.getMonth()+1,2,0) +'.'+
        _.padStart(d.getDate(),2,0);
      }
    , a = 'a'.charCodeAt(0)
    , nop = function () {}
    , default_ptn_tpl = _.template(
        '[Date "<%=today%>"]\n'+
        '[Player1 "<%=player1%>"]\n'+
        '[Player2 "<%=player2%>"]\n'+
        '[Size "<%=size%>"]\n'+
        '[Result ""]\n'+
        '\n'+
        '1. '
      );

  var app = {

    piece_counts: {
      3: { F: 10, C: 0, total: 10 },
      4: { F: 15, C: 0, total: 15 },
      5: { F: 21, C: 1, total: 22 },
      6: { F: 30, C: 1, total: 31 },
      7: { F: 40, C: 2, total: 42 },
      8: { F: 50, C: 2, total: 52 },
      9: { F: 60, C: 3, total: 63 }
    },

    config: config,
    hotkeys: hotkeys,
    menu: menu,

    mode: 'play',
    board: new Board(),
    game: new Game(new Board()),

    default_ptn: function () {
      return default_ptn_tpl({
        today: today(),
        player1: config.player1,
        player2: config.player2,
        size: config.board_size
      });
    },

    sample_ptn: sample_ptn,

    hash: (location.hash || config.last_session).substr(1),

    tpl: {
      dialog: _.template(
        '<dialog class="mdl-dialog">'+
          '<h3 class="mdl-dialog__title"><%=title%></h3>'+
          '<div class="mdl-dialog__content">'+
            '<%=content%>'+
          '</div>'+
          '<div class="mdl-dialog__actions">'+
            '<% _.each(actions, function (action) { %>'+
              '<button type="button" class="mdl-button mdl-button--flat'+
                '<%= action.className ? " "+action.className : "" %>"'+
                '<% _.each(_.omit(action, ["label", "value", "callback", "className"]), function(value, key) { %>'+
                  '<% if (_.isBoolean(value)) { %>'+
                    ' <%= value ? key : "" %>'+
                  '<% } else { %>'+
                    ' <%=key%>="<%-value%>"'+
                  '<% } %>'+
                '<% }) %>'+
              '><%=action.label%></button>'+
            '<% }) %>'+
          '</div>'+
        '</dialog>'
      )
    },


    // Dialogs

    current_dialogs: [],

    dialog: function (opt) {
      var that = this;

      var $dialog = $(
            this.tpl.dialog({
              title: opt.title,
              content: opt.content,
              actions: opt.actions || []
            })
          ).addClass(opt.className).appendTo(this.$body);

      var dialog = $dialog[0]
        , $actions = $dialog.find('.mdl-dialog__actions button')
        , $action;

      function close () {
        dialog.close();
        _.pull(that.current_dialogs, dialog);
        $dialog.remove();
      }

      if (!dialog.showModal) {
        dialogPolyfill.registerDialog(dialog);
      }

      $dialog.find('[class^=mdl]').each(function (i, element) {
        componentHandler.upgradeElement(element);
      });

      _.each(opt.actions, function (action, i) {
        var value = _.has(action, 'value') ? action.value : i
          , callback = _.has(action, 'callback') ? action.callback : false;

        $action = $actions.eq(i);

        if (callback) {
          $action.click(function () {
            callback(value, $dialog);
          });
        }
        $actions.eq(i).click(close);
      });

      dialog.showModal();
      this.current_dialogs.push(dialog);
      $dialog.find('input:eq(0)').focus();
      if (opt.callback) {
        $dialog.find('form').submit(function (event) {
          opt.callback(event);
          close();
        });
      }

      return dialog;
    },

    confirm: function (text, callback) {
      var dialog = this.dialog({
        title: text.title,
        content: text.content,
        actions: [{
          label: t.OK,
          value: true,
          callback: callback
        },{
          label: t.Cancel,
          value: false,
          callback: callback
        }]
      });

      return dialog;
    },

    about: function () {
      this.dialog({
        title: t.app_title,
        content: readme,
        actions: [{label: t.Close}],
        className: 'scrolling'
      });
    },

    create_new_game: function (event) {
      $(event.target).find('input').each(function (i, input) {
        if (input.name) {
          config.set(input.name, input.value);
        }
      })
      app.game.parse(app.default_ptn(), true);
      event.preventDefault();
      event.stopPropagation();
      return false;
    },

    new_game: function () {
      this.dialog({
        title: t.New_Game,
        content: '<form>'+
          '<div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label">'+
            '<input class="mdl-textfield__input" type="number" name="board_size" min="3" max="9" pattern="[3-9]" value="'+config.board_size+'" id="board_size">'+
            '<label class="mdl-textfield__label" for="board_size">'+t.Size+'</label>'+
          '</div>'+
          '<div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label">'+
            '<input class="mdl-textfield__input" type="text" name="player1" value="'+config.player1+'" id="player1">'+
            '<label class="mdl-textfield__label" for="player1">'+t.Player1+'</label>'+
          '</div>'+
          '<div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label">'+
            '<input class="mdl-textfield__input" type="text" name="player2" value="'+config.player2+'" id="player2">'+
            '<label class="mdl-textfield__label" for="player2">'+t.Player2+'</label>'+
          '</div>'+
          '<input type="submit" hidden>'+
        '</form>',
        callback: function (event) {
          app.create_new_game(event);
        },
        actions: [{
          label: t.OK,
          callback: function (n, $dialog) {
            $dialog.find('form').submit();
          }
        }, {
          label: t.Cancel
        }],
      });
    },

    revert_game: function (confirmed) {
      if (confirmed === true) {
        this.game.revert();
        this.clear_undo_history();
      } else if (_.isUndefined(confirmed)) {
        this.confirm(t.confirm.Revert_Game, this.revert_game);
      }
    },


    // Edit Mode Functions

    toggle_edit_mode: function (on) {
      var was_editing = this.game.is_editing;

      if (_.isBoolean(on)) {
        this.game.is_editing = on;
      } else {
        this.game.is_editing = !this.game.is_editing;
      }

      if (!was_editing && this.game.is_editing) {
        this.$html.addClass('editmode');
        this.$html.removeClass('playmode');
        this.$menu_edit.addClass('mdl-accordion--opened');
        this.$menu_play.removeClass('mdl-accordion--opened');

        this.update_ptn_branch();
        this.scroll_to_ply(true);
        this.save_scroll_position();
        if (this.can_hover) {
          this.editable_on();
        }
      } else if (was_editing && !this.game.is_editing) {
        this.$html.addClass('playmode');
        this.$html.removeClass('editmode');
        this.$menu_play.addClass('mdl-accordion--opened');
        this.$menu_edit.removeClass('mdl-accordion--opened');
        this.clear_scroll_position();
        this.$ptn.blur();
        this.editable_off();
        if (this.game.plys.length && !this.board.selected_pieces.length) {
          this.board.update_active_squares();
        }
      }

      this.mode = this.game.is_editing ? 'edit' : 'play';
      this.update_url();
      this.config.update_flags();
      this.board.resize();
    },

    toggle_editable: function (is_on) {
      is_on = _.isBoolean(is_on) ? is_on : !app.$ptn.prop('contenteditable');

      app.$ptn.prop('contenteditable', is_on);
      return is_on;
    },

    editable_on: function () {
      return app.toggle_editable(true);
    },

    editable_off: function () {
      return app.toggle_editable(false);
    },

    update_after_parse: function (is_original) {
      app.update_ptn();
      if (app.game.is_valid) {
        app.board.init(app.game);

        if (app.game.is_editing && app.$focus && !document.contains(app.$focus[0])) {
          app.set_position_from_caret();
        }
      }

      app.update_permalink();
      app.update_url();

      if (is_original) {
        app.clear_undo_history();
      }

      if (app.game.is_editing && app.game.caret_moved) {
        _.defer(app.restore_caret);
      }
    },

    update_permalink: function () {
      var href, length;

      href = '?#'+app.game.ptn_compressed;
      length = (baseurl + href).length;

      app.$permalink.attr({
        href: href,
        title: t.n_characters({n: length})
      });
    },

    update_url: function () {
      var url = app.game.ptn_compressed;

      if (app.board.current_ply) {
        url += '&ply='+app.board.current_ply.index;
        if (app.board.ply_is_done) {
          url += '!';
        }
        if (app.board.target_branch) {
          url += '&branch='+app.board.target_branch;
        }
      }

      if (app.mode == 'edit') {
        url += '&mode=edit';
      }

      history.replaceState(undefined, undefined, '?#'+url);
      config.set('last_session', location.hash);
    },

    update_ptn: function () {
      app.$ptn.html(app.game.print());
      app.$ptn.$header = app.$ptn.find('span.header');
      app.$ptn.$header.$tps = app.$ptn.$header.find('span.value.tps');
      app.$ptn.$body = app.$ptn.find('span.body');
      app.$ptn.$ply = app.$ptn.$body.find('.ply.active:first');
      app.update_ptn_branch();
    },

    update_ptn_branch: function (branch) {
      var i, move, $move
        , ply1_is_in_branch
        , ply2_is_in_branch;

      if (_.isUndefined(branch)) {
        branch = app.board.target_branch;
      }

      if (!app.game.plys.length) {
        return;
      }

      for (i = 0; i < app.game.moves.length; i++) {
        move = app.game.moves[i];
        ply1_is_in_branch = false;
        ply2_is_in_branch = false;
        $move = app.$ptn.$body.children('.move[data-index='+i+']');

        if (move.plys[0] && move.plys[0].is_in_branch(branch)) {
          ply1_is_in_branch = true;
          $move.find('.ply[data-index='+move.plys[0].index+']')
            .removeClass('other-branch');
        }

        if (move.plys[1] && move.plys[1].is_in_branch(branch)) {
          ply2_is_in_branch = true;
          $move.find('.ply[data-index='+move.plys[1].index+']')
            .removeClass('other-branch');
        }

        if (ply1_is_in_branch || ply2_is_in_branch) {
          $move.add($move.find('.other-branch'))
            .removeClass('other-branch');

          if (move.plys[0] && !ply1_is_in_branch) {
            $move.find('.ply[data-index='+move.plys[0].index+']')
              .addClass('other-branch');
          } else if (move.plys[1] && !ply2_is_in_branch) {
            $move.find('.ply[data-index='+move.plys[1].index+']')
              .addClass('other-branch');
          }
        } else if (!move.plys.length && _.startsWith(branch, move.branch)) {
          $move.add($move.find('.other-branch'))
            .removeClass('other-branch');
        } else {
          $move.addClass('other-branch') .find('.other-branch').removeClass('other-branch');
        }
      }
    },

    set_active_ply: function (ply) {
      app.$ptn.$ply = ply ?
      app.$ptn.find('.ply[data-index="'+ply.index+'"]') :
      null;

      if (app.$ptn.$ply && app.$ptn.$ply.length) {
        app.$ptn.$ply.prevAll('.linenum').andSelf().addClass('active');
      }
    },

    update_after_ply: function (ply) {
      var is_first = !ply || !ply.prev && !app.board.ply_is_done
        , is_last = !ply || !ply.next && app.board.ply_is_done;

      app.update_url();

      if (app.$ptn.$ply && app.$ptn.$ply.length) {
        if (app.$ptn.$ply.data('model') != ply) {
          app.$ptn.$ply.prevAll('.linenum').andSelf().removeClass('active');
          app.set_active_ply(ply);
        }
      } else {
        app.set_active_ply(ply);
      }

      if (app.board.ply_is_done) {
        app.$html.addClass('ply-is-done');
      } else {
        app.$html.removeClass('ply-is-done');
      }

      app.$controls.$first.attr('disabled', is_first);
      app.$controls.$prev_move.attr('disabled', is_first);
      app.$controls.$prev.attr('disabled', is_first);
      app.$controls.$next.attr('disabled', is_last);
      app.$controls.$next_move.attr('disabled', is_last);
      app.$controls.$last.attr('disabled', is_last);

      app.$ptn.$body.children().removeClass('branch-option');
      app.board.clear_options();
      app.board.show_messages();
      app.board.update_ptn();
      app.board.update_active_squares();
      app.board.update_valid_squares();
      for (var i = 0; i < app.board.branch_options.length; i++) {
        app.$ptn.$body.children(
          '.move[data-index='+app.board.branch_options[i].move.index+']'
        ).addClass('branch-option');
      }
      app.$html.removeClass('p1 p2');
      if (app.board.is_eog) {
        app.$html.addClass('p'+app.board.current_ply.player);
      } else {
        app.$html.addClass('p'+app.board.turn);
      }
      if (!app.$ptn.prop('contenteditable') || !app.$ptn.is(':focus')) {
        app.scroll_to_ply();
      }
    },

    update_after_ply_insert: function (index, is_already_done) {
      app.board.tmp_ply = null;

      app.board.set_current_ply(index, !!is_already_done);
      app.board.go_to_ply(index, true, true);
      app.board.check_game_end();
      app.update_ptn();
      app.board.defer_render = false;
      app.board.update_view();

      app.update_permalink();
      app.update_url();
      app.range.pushstate();
      app.scroll_to_ply();
    },

    resize: function (event) {
      app.board.resize();
      app.restore_scroll_position();
    },

    rotate_board: function (event) {
      if (_.isBoolean(event)) {
        config.set('board_rotation', config.defaults.board_rotation);
        return;
      }

      var x, y, magnitude;

      if (event.originalEvent.touches) {
        x = (event.originalEvent.touches[0].clientX + event.originalEvent.touches[1].clientX)/2;
        y = (event.originalEvent.touches[0].clientY + event.originalEvent.touches[1].clientY)/2;
      } else {
        x = event.clientX;
        y = event.clientY;
      }

      x = Math.max(-1, Math.min(1,
        app.dragging.rotation[0]
        + config.board_rotate_sensitivity
          * (x - app.dragging.x) / app.board.width
      ));

      y = Math.max(-1, Math.min(1,
        app.dragging.rotation[1]
        - config.board_rotate_sensitivity
          * (y - app.dragging.y) / app.board.width
      ));

      if (Math.abs(x) < 0.05) {
        x = 0;
      }
      if (Math.abs(y) < 0.05) {
        y = 0;
      }

      magnitude = Math.sqrt(x*x + y*y);

      config.set('board_rotation', [x, y, magnitude]);
      event.preventDefault();
      event.stopPropagation();
    },

    set_editor_width: function (vw, board_width) {
      var editor_width = vw - board_width - 16;

      if (!this.game.is_editing) {
        return;
      }

      if (editor_width < 340) {
        if (this.is_side_by_side) {
          this.is_side_by_side = false;
          this.$editor.css('width', '100%');
          this.$html.removeClass('side-by-side');
        }
      } else {
        if (!this.is_side_by_side) {
          this.is_side_by_side = true;
          this.$html.addClass('side-by-side');
        }
        this.$editor.css('width', editor_width+'px');
      }
    },

    save_caret: function () {
      this.range.last_bounds = this.range.bounds('selection').bounds();
    },

    restore_caret: function () {
      if (this.range.last_bounds) {
        this.set_caret(this.range.last_bounds);
      } else if (this.board.current_ply) {
        this.set_caret(
          this.game.get_bounds(
            this.board.current_ply
          )[1]
        );
      } else {
        this.set_caret('end');
      }
    },

    move_caret: function (relative_bounds) {
      if (!this.range.last_bounds) {
        return;
      }

      if (_.isArray(relative_bounds)) {
        relative_bounds[0] += this.range.last_bounds[0];
        relative_bounds[1] += this.range.last_bounds[1];
      } else {
        relative_bounds = [
          this.range.last_bounds[0] + relative_bounds,
          this.range.last_bounds[1] + relative_bounds
        ];
      }

      this.set_caret(relative_bounds);
    },

    set_caret: function (bounds, no_scroll) {
      if (_.isNumber(bounds)) {
        bounds = [bounds, bounds];
      }
      this.range.bounds(bounds).select();
      this.save_caret();

      if (this.game.is_editing) {
        this.$ptn.focus();
        if (!no_scroll) {
          this.range.scrollIntoView();
        }
      }
    },

    select_token_text: function (token) {
      this.set_caret(this.game.get_bounds(token));
    },

    save_scroll_position: function () {
      var scrollTop = app.$ptn.scrollTop()
        , vh = app.$ptn.height()
        , $header = app.$ptn.children('.header')
        , $body = app.$ptn.children('.body')
        , body_offset = $body.offset()
        , top, $siblings, i;

      top = app.$focus && app.$focus.length ? app.$focus.offset().top : undefined;

      if (app.$focus && top > 0 && top < vh) {
        // If the focused element is within view, use it
        app.$scroll_middle = app.$focus;
        app.scroll_middle_offset = app.$scroll_middle.offset().top;
      } else {
        // Find the line-level element in the middle of the viewport
        if (body_offset && body_offset.top <= 0) {
          $siblings = $body.children();
        } else {
          $siblings = $header.children();
        }
        for (
          i = 0;
          i < $siblings.length && $siblings.eq(i).offset().top < 0;
          i++
        ) {}

        app.$scroll_middle = $siblings.eq(i ? i - 1 : 0);
        if (app.$scroll_middle.length) {
          app.scroll_middle_offset = app.$scroll_middle.offset().top;
        }
      }
    },

    restore_scroll_position: function () {
      if (!app.$scroll_middle) {
        return;
      }

      app.$ptn.scrollTop(
        app.$ptn.scrollTop()
          + app.$scroll_middle.offset().top - app.scroll_middle_offset
      );
    },

    clear_scroll_position: function () {
      app.$scroll_middle = null;
    },

    clear_undo_history: function () {
      app.range.data().undos = false;
      app.range.pushstate();
    },

    undo: function (event) {
      var undos = app.range.data().undos;

      if (undos && undos.undo != undos) {
        app.range.undo();
      }

      if (event) {
        event.preventDefault();
      }
    },

    redo: function (event) {
      var undos = app.range.data().undos;

      if (undos && undos.redo != undos) {
        app.range.undo(-1);
      }

      if (event) {
        event.preventDefault();
      }
    },

    scroll_to_ply: function (instantly) {
      var offset;

      if (
        app.game.is_editing
        && this.$ptn.$ply
        && (offset = this.$ptn.$ply.offset())
      ) {
        offset = offset.top
          - (window.innerHeight - this.$ptn.$ply.height()) / 2;

        if (offset) {
          if (instantly || !config.animate_ui) {
            this.$ptn.stop().scrollTop(this.$ptn.scrollTop() + offset);
          } else {
            this.$ptn.stop().animate({
              scrollTop: this.$ptn.scrollTop() + offset
            }, {
              duration: 200
            });
          }
        }
      }
    },

    set_position_from_caret: function (event) {
      var focus, $focus
        , ply, move
        , $square, squares, square, i;

      if (!app.game.is_editing || app.dragging) {
        return;
      }

      if (event) {
        if (event.type == 'keyup' && app.$ptn.prop('contenteditable') != 'true') {
          return;
        }

        app.save_caret();
      }

      focus = getSelection().focusNode;
      if (focus) {
        focus = focus.parentNode;
      }
      if (focus.nodeType == Node.TEXT_NODE && focus.nextSibling) {
        focus = focus.nextSibling;
      }
      if (focus.className == 'opening quote') {
        focus = focus.nextSibling;
      }
      if (focus.className == 'space') {
        focus = focus.previousSibling;
      }
      $focus = $(focus);
      app.$focus = $focus;

      if (app.$ptn.$body[0].contains(focus)) {
        // Body

        if ($focus.hasClass('body')) {
          ply = _.last(app.game.plys);
        } else if (
          $focus.is('.linenum, .branch, .value, .invalid, .invalid .first-letter')
        ) {
          move = app.game.moves[1*$focus.closest('.move').data('index')];
          if (move) {
            if (move.plys.length) {
              ply = move.plys[0];
            } else if (move.prev && move.prev.plys.length) {
              ply = _.last(move.prev.plys);
            } else if (move.original && move.original.plys.length) {
              ply = move.original.plys[0];
            }
          }
        } else if ($focus.hasClass('comment')) {
          ply = app.game.plys[
            1*$focus.prevAll('.ply').add($focus.next('.ply')).data('index')
          ];
        } else if ($focus.hasClass('text')) {
          $focus = $focus.closest('.comment');
          ply = app.game.plys[
            1*$focus.prevAll('.ply').add($focus.next('.ply')).data('index')
          ];
        } else if ($focus.hasClass('space')) {
          ply = app.game.plys[
            1*$focus.next('.ply').data('index')
          ];
        } else if ($focus.is('.win, .loss, .draw')) {
          $focus = $focus.closest('.result');
          ply = app.game.plys[1*$focus.prevAll('.ply').data('index')];
        } else if ($focus.hasClass('result')) {
          ply = app.game.plys[1*$focus.prevAll('.ply').data('index')];
        } else {
          move = app.game.moves[1*$focus.closest('.move').data('index')];
          ply = app.game.plys[1*$focus.closest('.ply').data('index')];
        }

        if (ply) {
          if (ply.is_nop && ply.original) {
            ply = ply.original;
          }
          app.board.go_to_ply(
            ply.index,
            app.board.ply_index != ply.index || !app.board.ply_is_done || !event || event.type == 'keyup'
          );
        }

      } else if (
        app.$ptn.$header.$tps.length
        && (
          app.$ptn.$header.$tps[0] == focus
          || app.$ptn.$header.$tps[0].contains(focus)
        )
      ) {
        // TPS

        if ($focus.hasClass('separator')) {
          $square = $focus.next().closest('.square');
        } else if (app.$ptn.$header.$tps[0] == focus) {
          $square = $(app.$ptn.$header.$tps[0].querySelector('.square'));
        } else {
          $square = $focus.closest('.square');
        }

        if ($square && $square.length) {
          square = app.board.squares[$square.data('coord')];
          if (square) {
            squares = [square];

            if ($square.hasClass('space')) {
              for (i = 0; i < 1*$square.data('count') - 1; i++) {
                squares.push(_.last(squares).neighbors['>']);
              }
            }
          }
        }

        app.board.go_to_ply(0, false);
        app.board.set_active_squares(squares);
      } else {
        // Clear square highlighting
        app.board.set_active_squares();
      }
    },

    // Read and parse the file
    read_file: function (file) {
      var that = this;

      if (file && /\.ptn$|\.txt$/i.test(file.name)) {
        var reader = new FileReader();
        reader.onload = function (event) {
          that.board.ply_index = 0;
          that.game.parse(event.target.result, false, true);
          app.hash = that.game.ptn_compressed;
          app.update_url();
        }
        reader.readAsText(file);
      }
    },

    // Insert text into PTN before or after caret
    insert_text: function (text, before) {
      app.range.bounds('selection')
        .text(text, before ? 'end' : 'start')
        .select();
    },

    // Convert between [0, 0] and 'a1'
    square_coord: function (square) {
      if (_.isString(square)) {
        return [
          square[0].charCodeAt(0) - a,
          1*square[1] - 1
        ];
      } else if (_.isArray(square)) {
        return String.fromCharCode(a + square[0]) + (square[1] + 1);
      }
    }
  };

  // Test for passive event handlers
  app.supports_passive = false;
  try {
    var opts = Object.defineProperty({}, 'passive', {
      get: function() {
        app.supports_passive = true;
      }
    });
    window.addEventListener('test', null, opts);
  } catch (e) {}

  _.bindAll(app, [
    'dialog',
    'confirm',
    'revert_game',
    'undo',
    'redo',
    'scroll_to_ply',
    'toggle_edit_mode',
    'set_editor_width',
    'save_caret',
    'restore_caret',
    'move_caret',
    'set_caret',
    'select_token_text',
    'insert_text'
  ]);


  // Reformat Readme
  readme = (function () {
    var $readme = $('<div>').html(readme);

    $readme.find('a').attr({
      target: '_blank',
      rel: 'noopener'
    });

    $readme.find('h3:eq(0)').remove();

    return $readme.html();
  })();

  app.set_position_from_caret = _.throttle(app.set_position_from_caret, 100);

  return app;

});
