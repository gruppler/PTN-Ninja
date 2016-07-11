// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'app/config',
  'app/hotkeys',
  'app/messages',
  'app/game',
  'app/board',
  'filesaver',
  'lodash',
  'jquery',
  'jquery.keymap',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, config, hotkeys, Messages, Game, Board, saveAs, _, $) {

  var baseurl = location.origin + location.pathname

    , simulator = new Board()

    , $messages_parse = $('.messages-parse')
    , m = new Messages('general')

    , d = new Date()
    , today = d.getFullYear() +'.'+
    _.padStart(d.getMonth()+1,2,0) +'.'+
    _.padStart(d.getDate(),2,0)

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

        board: new Board(),
        game: new Game(simulator),

        $window: $(window),
        $body: $('body'),
        $ptn: $('#ptn'),
        $viewer: $('#viewer'),
        $fab: $('#fab'),
        $permalink: $('#permalink'),
        $download: $('#download'),
        $open: $('#open'),

        undo: bililiteRange.undo,
        redo: bililiteRange.redo,

        default_ptn: '[Date "'+today+'"]\n[Player1 "White"]\n[Player2 "Black"]\n[Result ""]\n[Size "5"]\n\n1. ',

        sample_ptn: 'NoZQlgLgpgBARABQDYEMCeAVFBrAdAYwHsBbOAXQChgBRANygDsJ4B5BpMB2ZdcqgERTR4AJgAMARgBsuMQFZcEuX2A80UAE4T4Acw0BXAA6GkmlWs0jdGqI1O0wQgBYoGKgEpQAzvqTM4YgC0AGIq4ABesHDKlBQw8QmJiQDeMBiQpjAAvhQUErgwKHIwyQCCSADu6F4wFZBOMBBOsEQaXBpeuF1ZMFASFCIFACba+HIUAMzDVkPjACwFUHO9cgDkFAowEksA1FuzAHwUMjAgszAARuMA7AUSh9oAwrMUABwFz8sXIhQAnAX4CaXCZ5MQA5YSC4TA79CT5S7LFBzPKDLb4OY7bT3OQw1YAQjyU32GO0ULyCxgQzmq0pIKUdwuc0CEnxW2+mLyJxAKCB9wmHIktxg6JgIkBOx+EneorGgSsIipAB5Jf9aTS5uiYSDxHchvyWTAJprtfCQGMYHIoHJAuMRKjsczTnqBkTzoyBhSQFbLiyBpsJDyYZcfiITiIoXLCtqhfgrICBtLuVYUP0RKq5krqRalorxhMwVsrY6rZN4eGJsrgZNURqmVm+Y7kgAKfQMIaEACUOQmRLF0Lj-QmFIkgMVBuSLAa6hQTgANDAAJIwHSEZhNMBePE9ZLuMA6JwQAD8OUSUAmeIJiSCwRKMCbgHtSQAFMIBC0kfHfvgFY-mCAblJAICk3+yCggA'
      };

  window.app = app;

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

  _.bindAll(app.board, [
    'play',
    'pause',
    'playpause',
    'prev',
    'next',
    'first',
    'last'
  ]);

  app.toggle_edit_mode = function (on) {
    if (_.isBoolean(on)) {
      if (on && !app.game.is_editing) {
        app.$viewer.transition();
        app.game.is_editing = true;
        app.$body.addClass('editmode');
        app.$body.removeClass('playmode');
      } else if (!on && app.game.is_editing) {
        app.$viewer.transition();
        app.game.is_editing = false;
        app.$body.addClass('playmode');
        app.$body.removeClass('editmode');
      }
    } else {
      app.game.is_editing = !app.game.is_editing;
      app.$viewer.transition();
      app.$body.toggleClass('editmode playmode');
    }

    if (app.game.is_editing) {
      app.board.pause();
    }

    app.$ptn.attr('contenteditable', app.game.is_editing);
  };

  app.read_file = function (file) {
    if (file && /\.ptn$|\.txt$/i.test(file.name)) {
      var reader = new FileReader();
      reader.onload = function (event) {
        app.board.ply = 0;
        app.game.parse(event.target.result);
        bililiteRange(app.$ptn[0]).undo(0);
        location.hash = app.game.ptn_compressed;
      }
      reader.readAsText(file);
    }
  };

  app.insert_text = function (text, before) {
    bililiteRange(app.$ptn[0]).bounds('selection')
      .text(text, before ? 'end' : 'start')
      .select();
  };

  app.i_to_square = function (row, col) {
    return String.fromCharCode('a'.charCodeAt(0) + col) + (row + 1);
  };

  $('title').text(t.app_title);

  app.$fab.on('touchstart click', function (event) {
    event.stopPropagation();
    event.preventDefault();
    if (app.$body.hasClass('error')) {
      $messages_parse.toggleClass('visible');
    } else {
      app.toggle_edit_mode();
    }
  }).mouseover(function () {
    app.$fab.attr('title',
      app.$body.hasClass('error') ? t.ShowHide_Errors :
        app.game.is_editing ? t.Play_Mode : t.Edit_Mode
    );
  });

  app.game.on_parse_start(function () {
    if (app.$ptn.text() != this.ptn) {
      app.$ptn.text(this.ptn);
    }
  });

  app.game.on_parse_end(function () {
    var href, length;

    app.$ptn.html(this.print());
    if (app.game.is_valid) {
      app.board.init(app.game);
    }

    href = '#'+this.ptn_compressed;
    length = (baseurl + href).length;

    app.$permalink.attr({
      href: href,
      title: t.Permalink+' ('+t.n_characters({n: length})+')'
    });

    m.clear('warning', 'url');
    if (length > 2000) {
      m.warning(t.warning.long_url, 0, 'url');
    }
  });

  app.board.on_init(function () {
    app.$viewer.empty().append(app.board.render());
  }).on_ply(function (ply) {
    app.$ptn.find('.ply').removeClass('active')
      .filter('[data-ply="'+ply+'"]').addClass('active');
  });

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

  $('#share').attr('title', t.Share);

  $('#download').on('touchstart click', function (event) {
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
  }).attr('title', t.Download);

  $('#open').on('change', function (event) {
    event.stopPropagation();
    event.preventDefault();
    app.read_file(this.files[0]);
    $(this).val('');
  }).attr('title', t.Open);

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
      app.board.ply = 0;
      app.game.parse(location.hash.substr(1) || app.default_ptn, !!location.hash);
      bililiteRange(app.$ptn[0]).undo(0);
    });
  }

  app.$window.on('error:parse', function () {
    app.$body.addClass('error');
    app.toggle_edit_mode(true);
  }).on('clear:error:parse', function () {
    app.$body.removeClass('error');
  });


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


  // Initialize

  bililiteRange.fancyText(app.$ptn[0], function () {
    return app.game.parse(app.$ptn.text());
  });

  app.board.ply = 0;
  app.game.parse(location.hash.substr(1) || app.default_ptn, !!location.hash);
  bililiteRange(app.$ptn[0]).undo(0);

  if (location.hash && !app.$body.hasClass('error')) {
    app.toggle_edit_mode(false);
  }
  app.$viewer.afterTransition();

  app.$window.on('keydown', function (event) {
    var $focus = $(getSelection().focusNode)
      , $parent = $focus.parent();

    if (app.game.is_editing) {

      // Edit Mode
      if (event.keymap in hotkeys.edit) {
        hotkeys.edit[event.keymap](event, $focus, $parent);
      }

    } else {

      // Play Mode
      if (event.keymap in hotkeys.play) {
        hotkeys.play[event.keymap](event, $focus, $parent);
      }

    }

    // Global
    if (event.keymap in hotkeys.global) {
      hotkeys.global[event.keymap](event, $focus, $parent);
    }

  });

  // Go to focused ply
  app.$ptn.on('touchstart touchend keyup mouseup', function (event) {
    var $square, squares, square, i;

    if (app.game.is_editing) {
      var $focus = $(getSelection().focusNode).parent()
        , ply, $squares;

      $focus = $focus.add($focus.next());

      ply = $focus.closest('.ply').data('ply');
      if (!_.isUndefined(ply)) {
        app.board.go_to_ply(ply + 1);
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

        app.board.set_active_squares(squares);
      } else if ($focus.closest('.header').length) {
        app.board.go_to_ply(0);
      }
    }
  });

});
