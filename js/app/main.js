// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'app/config',
  'app/hotkeys',
  'app/menu',
  'app/messages',
  'app/game',
  'app/board',
  'mdown!../../readme.md',
  'filesaver',
  'lodash',
  'jquery',
  'jquery.keymap',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, config, hotkeys, menu, Messages, Game, Board, readme, saveAs, _, $) {

  var baseurl = location.origin + location.pathname

    , simulator = new Board()

    , $messages_parse = $('.messages-parse')
    , $messages_board = $('.messages-board')
    , m = new Messages('general', true)

    , d = new Date()
    , today = d.getFullYear() +'.'+
    _.padStart(d.getMonth()+1,2,0) +'.'+
    _.padStart(d.getDate(),2,0)

    , nop = function () {}

    , a = 'a'.charCodeAt(0)

    , app = {

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
        game: new Game(simulator),

        default_ptn: '[Date "'+today+'"]\n[Player1 "'+t.Player1_name+'"]\n[Player2 "'+t.Player2_name+'"]\n[Result ""]\n[Size "5"]\n\n1. ',

        sample_ptn: 'NoZQlgLgpgBARABQDYEMCeAVFBrAdAYwHsBbOAXQChgBRANygDsJ4B5BpMB2ZdcqgERTR4AJgAMARgBsuMQFZcEuX2A80UAE4T4Acw0BXAA6GkmlWs0jdGqI1O0wQgBYoGKgEpQAzvqTM4YgC0AGIq4ABesHDKlBQw8QmJiQDeMBiQpjAAvhQUErgwKHIwyQCCSADu6F4wFZBOMBBOsEQaXBpeuF1ZMFASFCIFACba+HIUAMzDVkPjACwFUHO9cgDkFAowEksA1FuzAHwUMjAgszAARuMA7AUSh9oAwrMUABwFz8sXIhQAnAX4CaXCZ5MQA5YSC4TA79CT5S7LFBzPKDLb4OY7bT3OQw1YAQjyU32GO0ULyCxgQzmq0pIKUdwuc0CEnxW2+mLyJxAKCB9wmHIktxg6JgIkBOx+EneorGgSsIipAB5Jf9aTS5uiYSDxHchvyWTAJprtfCQGMYHIoHJAuMRKjsczTnqBkTzoyBhSQFbLiyBpsJDyYZcfiITiIoXLCtqhfgrICBtLuVYUP0RKq5krqRalorxhMwVsrY6rZN4eGJsrgZNURqmVm+Y7kgAKfQMIaEACUOQmRLF0Lj-QmFIkgMVBuSLAa6hQTgANDAAJIwHSEZhNMBePE9ZLuMA6JwQAD8OUSUAmeIJiSCwRKMCbgHtSQAFMIBC0kfHfvgFY-mCAblJAICk3+yCggA',

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
          var dialog = this.dialog(text.title, text.content, [{
            label: t.OK,
            value: true,
            callback: callback
          },{
            label: t.Cancel,
            value: false,
            callback: callback
          }]);

          return dialog;
        },

        about: function () {
          this.dialog('', readme, [{label: t.Close}], 'about');
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

  window.app = app;

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

  // Templatize i18n strings
  (function () {
    function _templatize(parent) {
      for (var key in parent) {
        if (parent.hasOwnProperty(key)) {
          if (_.isString(parent[key])) {
            if (/<%/.test(parent[key])) {
              parent[key] = _.template(parent[key]);
            }
          } else {
            _templatize(parent[key])
          }
        }
      }
    }
    _templatize(t);
  })();

  $('title').text(t.app_title);

  // Reformat Readme
  readme = (function () {
    var $readme = $('<div>').html(readme);

    $readme.find('a').attr({
      target: '_blank',
      rel: 'noopener'
    });

    return $readme.html();
  })();


  // Initialize Menu
  app.menu.render();

  app.$window = $(window);
  app.$html = $('html');
  app.$body = $('body');
  app.$ptn = $('#ptn');
  app.$viewer = $('#viewer');
  app.$fab = $('#fab');
  app.$permalink = $('.permalink');
  app.$download = $('#download');
  app.$open = $('#open');

  // Schedule callback for one-time execution after CSS transition ends,
  // or execute existing callbacks
  $.fn.afterTransition = function (callback) {
    var $this = $(this);

    if (_.isFunction(callback)) {
      $this.one('transitionend', function (event) {
        callback.call($this, event);
      });
    } else if (_.isUndefined(callback)) {
      $this.trigger('transitionend');
    }

    return this;
  }

  // Add "animated" class and remove it after transition
  // and execute optional callback
  $.fn.transition = function (callback) {
    var $this = $(this);

    $this.afterTransition().addClass('animated');
    $this.afterTransition(function () {
      $this.removeClass('animated');
      if (_.isFunction(callback)) {
        callback.call($this);
      }
    });

    return this;
  };

  // Add boolean preferences to html class
  app.$html.addClass(
    _.map(_.keys(_.pickBy(app.config, _.isBoolean)), function (prop) {
      return app.config[prop] ? prop.replace(/_/g, '-') : '';
    }).join(' ')
  );

  // Initialize embed stuff
  if (app.is_in_iframe) {
    app.$html.addClass('embed');
  }

  // Initialize FAB
  app.$fab.on('touchstart click', function (event) {
    event.stopPropagation();
    event.preventDefault();
    if (app.$html.hasClass('error')) {
      config.toggle('show_parse_errors');
    } else {
      app.toggle_edit_mode();
    }
  }).mouseover(function () {
    app.$fab.attr('title',
      app.$html.hasClass('error') ? t.Show_Hide_Errors :
        app.game.is_editing ? t.Play_Mode : t.Edit_Mode
    );
  });

  // Update $ptn if parsing starts somewhere else
  app.game.on_parse_start(function (is_original) {
    if (app.$ptn.text() != app.game.ptn) {
      app.$ptn.text(app.game.ptn);
    }
  });

  // Re-render $ptn
  // Initialize board
  // Update Permalinks
  app.game.on_parse_end(function (is_original) {
    var href, length;

    app.$ptn.html(app.game.print());
    if (app.game.is_valid) {
      app.board.init(app.game);
    }

    href = '#'+app.game.ptn_compressed;
    length = (baseurl + href).length;

    app.$permalink.attr({
      href: href,
      title: t.n_characters({n: length})
    });

    m.clear('warning', 'url');
    if (length > 2000) {
      m.warning(t.warning.long_url, 0, 'url');
    }

    if (is_original) {
      bililiteRange(app.$ptn[0]).undo(0);
    }
  });

  // Re-render $viewer after board initialization
  app.board.on_init(function () {
    app.$viewer.empty().append(app.board.render());
  });

  // Update current ply display
  app.board.on_ply(function (ply) {
    if (app.$ptn.$ply && app.$ptn.$ply.length) {
      app.$ptn.$ply.removeClass('active');
    }
    app.$ptn.$ply = ply ?
      app.$ptn.find('.ply[data-id="'+ply.id+'"]:first').addClass('active') :
      null;

    if (app.board.ply_is_done) {
      app.$html.addClass('ply-is-done');
    } else {
      app.$html.removeClass('ply-is-done');
    }

    app.board.show_comments(ply);
    app.board.update_plys(ply);
    app.board.set_active_squares(ply ? ply.squares : null);
  });

  // Bind and label play controls
  $('#controls button.first')
    .on('touchstart click', app.board.first)
    .attr('title', t.First_Ply);
  $('#controls button.prev')
    .on('touchstart click', app.board.prev)
    .attr('title', t.Previous_Ply);
  $('#controls button.play')
    .on('touchstart click', app.board.playpause)
    .attr('title', t.PlayPause);
  $('#controls button.next')
    .on('touchstart click', app.board.next)
    .attr('title', t.Next_Ply);
  $('#controls button.last')
    .on('touchstart click', app.board.last)
    .attr('title', t.Last_Ply);

  // Make playback speed respond immediately to speed changes
  config.on_change('play_speed', function (speed) {
    var now = new Date().getTime()
      , next_frame = app.board.play_timestamp + 6e4/speed;

    if (app.board.is_playing) {
      if (next_frame < now) {
        app.board.next();
      } else {
        clearTimeout(app.board.play_timer);
        setTimeout(app.board.next, next_frame - now);
      }
    }
  });

  // Make board opacity controls work
  config.on_change('board_opacity', function (opacity) {
    app.$viewer.css('opacity', opacity/100);
  });
  config.on_change('board_opacity');

  // Initialize Download Button
  app.$download.on('touchstart click', function (event) {
    event.stopPropagation();
    event.preventDefault();
    saveAs(
      new Blob([app.game.ptn], {type: "text/plain;charset=utf-8"}),
      (app.game.config.player1 || t.Player1) +
      ' vs ' +
      (app.game.config.player2 || t.Player2) +
      (
        app.game.config.date ?
        ' ' + app.game.config.date
        : ''
      )
      + '.ptn',
      true
    );
  });

  // Initialize Open Button
  app.$open.on('change', function (event) {
    event.stopPropagation();
    event.preventDefault();
    app.read_file(this.files[0]);
    $(this).val('');
  });

  // Listen for dropped files and hash change
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    app.$window.on('drop', function(event) {
      event.stopPropagation();
      event.preventDefault();
      app.read_file(event.originalEvent.dataTransfer.files[0]);
    }).on('dragover', function(event) {
      event.preventDefault();
      event.stopPropagation();
    }).on('dragleave', function(event) {
      event.preventDefault();
      event.stopPropagation();
    }).on('hashchange', function () {
      app.board.ply_id = 0;
      app.game.parse(location.hash.substr(1) || app.default_ptn, !!location.hash, true);
    });
  }

  app.$window.on('error:parse', function () {
    app.$html.addClass('error');
    app.toggle_edit_mode(true);
  }).on('clear:error:parse', function () {
    app.$html.removeClass('error');
  });

  // Bind update events to game parsing
  bililiteRange.fancyText(app.$ptn[0], function () {
    return app.game.parse(app.$ptn.text());
  });

  // Load the initial PTN
  app.game.parse(location.hash.substr(1) || app.default_ptn, !!location.hash, !sessionStorage.ptn);

  // Start in Play Mode if loading from valid hash
  if (location.hash && !app.$html.hasClass('error')) {
    app.toggle_edit_mode(false);
  }
  app.$viewer.afterTransition();

  // Bind hotkeys
  app.$window.on('keydown', function (event) {
    var $focus = $(getSelection().focusNode)
      , $parent = $focus.parent()
      , dialog;

    if (!event.keymap) {
      return;
    }

    event.keymap
      .replace('~', '^')
      .replace('Backspace', 'Delete');

    if (app.current_dialogs.length) {
      // Modal Dialog
      if (event.keymap == 'Escape') {
        dialog = app.current_dialogs.pop();
        dialog.close();
        $(dialog).remove();
      }
    } else if (app.game.is_editing && event.keymap in hotkeys.edit) {
      // Edit Mode
      hotkeys.edit[event.keymap](event, $focus, $parent);
    } else if (!app.game.is_editing && event.keymap in hotkeys.play) {
      // Play Mode
      hotkeys.play[event.keymap](event, $focus, $parent);
    } else if (event.keymap in hotkeys.global) {
      // Global
      hotkeys.global[event.keymap](event, $focus, $parent);
    }
  });

  // Go to focused ply
  app.$ptn.on('keyup mouseup', function (event) {
    var $square, squares, square, i;

    if (app.game.is_editing) {
      var $focus = $(getSelection().focusNode).parent()
        , ply_id, $squares;

      $focus = $focus.add($focus.next());

      ply_id = $focus.closest('.ply').data('id');
      if (!_.isUndefined(ply_id)) {
        app.board.go_to_ply(
          ply_id,
          app.board.ply_id != ply_id
            || !app.board.ply_is_done
            || event.type != 'mouseup'
        );
      } else if ($focus.closest('.tps.value').length) {
        $square = $focus.closest('.square');

        if (!($square && $square.length) && $focus.hasClass('opening quote')) {
          $square = $focus.find('.square:eq(0)');
        }

        if ($square && $square.length) {
          square = app.board.squares[$square.data('square')];
          if (square) {
            squares = [square];

            if ($square.hasClass('space')) {
              for (var i = 0; i < 1*$square.data('count') - 1; i++) {
                squares.push(_.last(squares).neighbors['>']);
              }
            }
          }
        }

        app.board.go_to_ply(0, false);
        app.board.set_active_squares(squares);
      } else if ($focus.closest('.header').length) {
        app.board.go_to_ply(0, false);
      }
    }
  });

});
