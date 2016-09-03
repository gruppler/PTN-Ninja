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
  'bililiteRange.fancytext'
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

    board: new Board(),
    game: new Game(new Board()),

    default_ptn: '[Date "'+today+'"]\n[Player1 "'+t.Player1_name+'"]\n[Player2 "'+t.Player2_name+'"]\n[Result ""]\n[Size "5"]\n\n1. ',

    sample_ptn: sample_ptn,

    is_in_iframe: top.location != self.location,

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
      configure_board: _.template(
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

    configure_board: function () {
      this.dialog(
        t.Configure_Board,
        this.tpl.configure_board({
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
      } else if (_.isUndefined(confirmed)) {
        this.confirm(t.confirm.Revert_Game, this.revert_game);
      }
    },


    // Edit Mode Functions

    undo: function (event) {
      bililiteRange.undo(event || {target: this.$ptn[0], preventDefault: nop});
    },

    redo: function (event) {
      bililiteRange.redo(event || {target: this.$ptn[0], preventDefault: nop});
    },

    scroll_to_ply: function () {
      if (this.$ptn.$ply) {
        this.$ptn.scrollTop(
          this.$ptn.scrollTop() + this.$ptn.$ply.offset().top
          - (window.innerHeight - this.$ptn.$ply.height())/2
        );
      }
    },

    toggle_edit_mode: function (on) {
      var was_editing = this.game.is_editing;

      if (_.isBoolean(on)) {
        if (on && !this.game.is_editing) {
          this.$viewer.transition();
          this.game.is_editing = true;
          this.$html.addClass('editmode');
          this.$html.removeClass('playmode');
        } else if (!on && this.game.is_editing) {
          this.$viewer.transition();
          this.game.is_editing = false;
          this.$html.addClass('playmode');
          this.$html.removeClass('editmode');
        }
      } else {
        this.game.is_editing = !this.game.is_editing;
        this.$viewer.transition();
        this.$html.toggleClass('editmode playmode');
      }

      if (this.game.is_editing && !was_editing) {
        this.board.pause();
        this.scroll_to_ply();
      }

      this.$ptn.attr('contenteditable', this.game.is_editing);
    },

    // Read and parse the file
    read_file: function (file) {
      var that = this;

      if (file && /\.ptn$|\.txt$/i.test(file.name)) {
        var reader = new FileReader();
        reader.onload = function (event) {
          that.board.ply_id = 0;
          that.game.parse(event.target.result);
          bililiteRange(that.$ptn[0]).undo(0);
          location.hash = that.game.ptn_compressed;
        }
        reader.readAsText(file);
      }
    },

    // Insert text into PTN before or after caret
    insert_text: function (text, before) {
      bililiteRange(this.$ptn[0]).bounds('selection')
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

  _.bindAll(app,
    'dialog',
    'confirm',
    'revert_game',
    'undo',
    'redo',
    'scroll_to_ply',
    'toggle_edit_mode',
    'insert_text'
  );


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

  return app;

});
