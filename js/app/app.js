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
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'dialog-polyfill'
], function (t, config, hotkeys, menu, Game, Board, readme, sample_ptn, _, $) {

  var d = new Date()
    , today = d.getFullYear() +'.'+
    _.padStart(d.getMonth()+1,2,0) +'.'+
    _.padStart(d.getDate(),2,0)
    , a = 'a'.charCodeAt(0)
    , nop = function () {};

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

    default_ptn: '[Date "'+today+'"]\n[Player1 "'+t.Player1_name+'"]\n[Player2 "'+t.Player2_name+'"]\n[Result ""]\n[Size "5"]\n\n1. ',

    sample_ptn: sample_ptn,

    is_in_iframe: top.location != self.location,
    hash: location.hash.substr(1),

    tpl: {
      dialog: _.template(
        '<dialog class="mdl-dialog">'+
          '<h3 class="mdl-dialog__title"><%=title%></h3>'+
          '<div class="mdl-dialog__content">'+
            '<%=content%>'+
          '</div>'+
          '<div class="mdl-dialog__actions">'+
            '<% _.each(actions, function (action) { %>'+
              '<button type="button" class="mdl-button mdl-button--flat mdl-js-ripple-effect'+
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
      ),
      board_settings: _.template(
        ''
      )
    },


    // Dialogs

    current_dialogs: [],

    dialog: function (title, content, actions, className) {
      var that = this;

      var $dialog = $(
            this.tpl.dialog({
              title: title,
              content: content,
              actions: actions || []
            })
          ).addClass(className).appendTo(this.$body);

      var dialog = $dialog[0]
        , $actions = $dialog.find('.mdl-dialog__actions button')
        , $action;

      if (!dialog.showModal) {
        dialogPolyfill.registerDialog(dialog);
      }

      _.each(actions, function (action, i) {
        var value = 'value' in action ? action.value : i
          , callback = 'callback' in action ? action.callback : false;

        $action = $actions.eq(i);

        $actions.eq(i).click(function () {
          dialog.close();
          _.pull(that.current_dialogs, dialog);
          $dialog.remove();
        });

        if (callback) {
          $action.click(function () {
            callback(value);
          });
        }
      });

      dialog.showModal();
      this.current_dialogs.push(dialog);

      return dialog;
    },

    confirm: function (text, callback) {
      var dialog = this.dialog(
        text.title,
        text.content,
        [{
          label: t.OK,
          value: true,
          callback: callback
        },{
          label: t.Cancel,
          value: false,
          callback: callback
        }]
      );

      return dialog;
    },

    about: function () {
      this.dialog(
        t.app_title,
        readme,
        [{label: t.Close}],
        'scrolling'
      );
    },

    board_settings: function () {
      this.dialog(
        t.Board_Settings,
        this.tpl.board_settings({
          t: t,
          config: this.config
        }),
        [{label: t.Close}],
        'scrolling'
      );
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

    resize: function (event) {
      app.board.resize(event);
      app.restore_scroll_position();
    },

    rotate_board: function (event) {
      if (_.isBoolean(event)) {
        config.set('board_rotation', [0, 0, 0]);
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
        + app.config.board_rotate_sensitivity
          * (x - app.dragging.x) / app.board.width
      ));

      y = Math.max(-1, Math.min(1,
        app.dragging.rotation[1]
        - app.config.board_rotate_sensitivity
          * (y - app.dragging.y) / app.board.width
      ));

      magnitude = Math.sqrt(x*x + y*y);

      config.set('board_rotation', [x, y, magnitude]);
      event.preventDefault();
      event.stopPropagation();
    },

    set_editor_width: function (vw, board_width) {
      var editor_width = vw - board_width - 16;

      if (editor_width < 340) {
        if (app.is_side_by_side) {
          app.is_side_by_side = false;
          app.$editor.css('width', '100%');
          app.$html.removeClass('side-by-side');
        }
      } else {
        if (!app.is_side_by_side) {
          app.is_side_by_side = true;
          app.$html.addClass('side-by-side');
        }
        app.$editor.css('width', editor_width+'px');
      }
    },

    save_scroll_position: function () {
      var scrollTop = app.$editor.scrollTop()
        , vh = app.$editor.height()
        , vmid = vh / 2
        , $header = app.$ptn.children('.header')
        , $body = app.$ptn.children('.body')
        , body_offset = $body.offset()
        , top, $siblings, i;

      top = app.$focus ? app.$focus.offset().top : undefined;

      if (app.$focus && top > 0 && top < vh) {
        // If the focused element is within view, use it
        app.$scroll_middle = app.$focus;
        app.scroll_middle_offset = app.$scroll_middle.offset().top - vmid;
      } else {
        // Find the line-level element in the middle of the viewport
        if (body_offset && body_offset.top <= vmid) {
          $siblings = $body.children();
        } else {
          $siblings = $header.children();
        }
        for (
          i = 0;
          i < $siblings.length && $siblings.eq(i).offset().top < vmid;
          i++
        ) {}

        app.$scroll_middle = $siblings.eq(i ? i - 1 : 0);
        if (app.$scroll_middle.length) {
          app.scroll_middle_offset = app.$scroll_middle.offset().top - vmid;
        }
      }

    },

    restore_scroll_position: function () {
      if (!app.$scroll_middle) {
        return;
      }

      var offset = app.$scroll_middle.offset().top - app.scroll_middle_offset
        , vmid = app.$editor.height() / 2;

      app.$editor.scrollTop(app.$editor.scrollTop() + (offset - vmid));
    },

    clear_scroll_position: function () {
      app.$scroll_middle = null;
    },

    clear_undo_history: function () {
      app.range.data().undos = false;
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

    scroll_to_ply: function () {
      if (this.$ptn.$ply) {
        this.$editor.scrollTop(
          this.$editor.scrollTop() + this.$ptn.$ply.offset().top
          - (window.innerHeight - this.$ptn.$ply.height())/2
        );
      }
    },

    set_position_from_caret: function (event) {
      var focus, $focus
        , $ply, ply_index
        , $square, squares, square, i;

      if (!app.game.is_editing || app.dragging) {
        return;
      }

      focus = getSelection().focusNode.parentNode;
      if (focus.nodeType == Node.TEXT_NODE && focus.nextSibling) {
        focus = focus.nextSibling;
      }
      if (focus.className == 'opening quote') {
        focus = focus.nextSibling;
      }
      $focus = $(focus);
      app.$focus = $focus;

      if ($.contains(app.$ptn.$body[0], focus)) {
        // Body

        if ($focus.hasClass('text')) {
          $focus = $focus.closest('.comment');
          $ply = $focus.prevAll('.ply');
        } else if ($focus.hasClass('space')) {
          $ply = $focus.next('.ply');
        } else if ($focus.is('.win, .loss, .draw')) {
          $focus = $focus.closest('.result');
          $ply = $focus.prevAll('.ply');
        } else {
          $ply = $focus.closest('.ply');
        }

        if (!$ply.length) {
          $ply = $focus.prevAll('.ply');
        }
        if (!$ply.length) {
          $ply = $focus.nextAll('.ply');
        }

        ply_index = 1*$ply.data('index');

        if (_.isInteger(ply_index)) {
          app.board.go_to_ply(
            ply_index,
            app.board.ply_index != ply_index
              || !app.board.ply_is_done
              || event.type != 'mouseup'
          );
        }

      } else if (
        app.$ptn.$header.$tps.length
        && (
          app.$ptn.$header.$tps[0] == focus
          || $.contains(app.$ptn.$header.$tps[0], focus)
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
          square = app.board.squares[$square.data('square')];
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

    toggle_edit_mode: function (on) {
      var was_editing = this.game.is_editing;

      if (_.isBoolean(on)) {
        this.game.is_editing = on;
      } else {
        this.game.is_editing = !this.game.is_editing;
      }

      if (!was_editing && this.game.is_editing) {
        this.$viewer.transition();
        this.$html.addClass('editmode');
        this.$html.removeClass('playmode');
        this.$menu_edit.addClass('mdl-accordion--opened');
        this.$menu_play.removeClass('mdl-accordion--opened');

        this.board.pause();
        this.scroll_to_ply();
      } else if (was_editing && !this.game.is_editing) {
        this.$viewer.transition();
        this.$html.addClass('playmode');
        this.$html.removeClass('editmode');
        this.$menu_play.addClass('mdl-accordion--opened');
        this.$menu_edit.removeClass('mdl-accordion--opened');
        this.clear_scroll_position();
      }

      this.$ptn.attr('contenteditable', this.game.is_editing);
      this.mode = this.game.is_editing ? 'edit' : 'play';
      this.config.update_flags();
      this.board.resize();
    },

    // Read and parse the file
    read_file: function (file) {
      var that = this;

      if (file && /\.ptn$|\.txt$/i.test(file.name)) {
        var reader = new FileReader();
        reader.onload = function (event) {
          that.board.ply_index = 0;
          that.game.parse(event.target.result, false, true);
          location.hash = app.hash = that.game.ptn_compressed;
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

    // [0, 0] to 'a1'
    i_to_square: function (square) {
      return String.fromCharCode(a + square[0]) + (square[1] + 1);
    },

    // ('a', '1') to [0, 0]
    square_to_i: function (square) {
      return [
        square[0].charCodeAt(0) - a,
        1*square[1] - 1
      ];
    }
  };

  _.bindAll(app, [
    'dialog',
    'confirm',
    'revert_game',
    'undo',
    'redo',
    'scroll_to_ply',
    'toggle_edit_mode',
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
