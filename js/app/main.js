// PTN Player by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
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
], function (t, Messages, Game, Board, saveAs, _, $) {

  var $window = $(window)
    , $body = $('body')
    , $ptn = $('#ptn')
    , $viewer = $('#viewer')
    , $fab = $('#fab')
    , $permalink = $('#permalink')
    , $messages_parse = $('.messages-parse')
    , m = new Messages('general')
    , game = new Game()
    , board = new Board()
    , baseurl = location.origin + location.pathname
    , d = new Date()
    , today = d.getFullYear() +'.'+
        _.padStart(d.getMonth()+1,2,0) +'.'+
        _.padStart(d.getDate(),2,0)
    , default_ptn = '[Date "'+today+'"]\n[Player1 "White"]\n[Player2 "Black"]\n[Result ""]\n[Size "5"]\n\n'
    , sample_ptn = 'NoZQlgLgpgBARABQDYEMCeAVFBrAdAYwHsBbOAXQChgBRANygDsJ4B5BpMB2ZdcqgERTR4AJgAMARgBsuMQFZcEuX2A80UAE4T4Acw0BXAA6GkmlWs0jdGqI1O0wQgBYoGKgEpQAzvqTM4YgC0AGIq4ABesHDKlBQw8QmJiQDeMBiQpjAAvhQUErgwKHIwyQCCSADu6F4wFZBOMBBOsEQaXBpeuF1ZMFASFCIFACba+HIUAMzDVkPjACwFUHO9cgDkFAowEksA1FuzAHwUMjAgszAARuMA7AUSh9oAwrMUABwFz8sXIhQAnAX4CaXCZ5MQA5YSC4TA79CT5S7LFBzPKDLb4OY7bT3OQw1YAQjyU32GO0ULyCxgQzmq0pIKUdwuc0CEnxW2+mLyJxAKCB9wmHIktxg6JgIkBOx+EneorGgSsIipAB5Jf9aTS5uiYSDxHchvyWTAJprtfCQGMYHIoHJAuMRKjsczTnqBkTzoyBhSQFbLiyBpsJDyYZcfiITiIoXLCtqhfgrICBtLuVYUP0RKq5krqRalorxhMwVsrY6rZN4eGJsrgZNURqmVm+Y7kgAKfQMIaEACUOQmRLF0Lj-QmFIkgMVBuSLAa6hQTgANDAAJIwHSEZhNMBePE9ZLuMA6JwQAD8OUSUAmeIJiSCwRKMCbgHtSQAFMIBC0kfHfvgFY-mCAblJAICk3+yCggA';

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

  _.bindAll(board, [
    'play',
    'pause',
    'playpause',
    'prev',
    'next',
    'first',
    'last'
  ]);

  function toggle_edit_mode(on) {
    if (_.isBoolean(on)) {
      if (on && !game.is_editing) {
        $viewer.transition();
        game.is_editing = true;
        $body.addClass('editmode');
        $body.removeClass('playmode');
      } else if (!on && game.is_editing) {
        $viewer.transition();
        game.is_editing = false;
        $body.addClass('playmode');
        $body.removeClass('editmode');
      }
    } else {
      game.is_editing = !game.is_editing;
      $viewer.transition();
      $body.toggleClass('editmode playmode');
    }

    if (game.is_editing) {
      board.pause();
    }

    $ptn.attr('contenteditable', game.is_editing);
  }

  function read_file(file) {
    if (file && /\.ptn$|\.txt$/i.test(file.name)) {
      var reader = new FileReader();
      reader.onload = function (event) {
        board.ply = 0;
        game.parse(event.target.result);
        bililiteRange($ptn[0]).undo(0);
        location.hash = game.ptn_compressed;
      }
      reader.readAsText(file);
    }
  }

  $('title').text(t.app_title);

  $fab.click(function () {
    if ($body.hasClass('error')) {
      $messages_parse.toggleClass('visible');
    } else {
      toggle_edit_mode();
    }
  }).mousedown(function (event) {
    event.stopPropagation();
    event.preventDefault();
  }).mouseover(function () {
    $fab.attr('title',
      $body.hasClass('error') ? t.ShowHide_Errors :
        game.is_editing ? t.Play_Mode : t.Edit_Mode
    );
  });

  game.on_parse_start(function () {
    if ($ptn.text() != this.ptn) {
      $ptn.text(this.ptn);
    }
  });

  game.on_parse_end(function () {
    var href, length;

    $ptn.html(this.print());
    if (game.is_valid) {
      board.init(game);
    }

    href = '#'+this.ptn_compressed;
    length = (baseurl + href).length;

    $permalink.attr({
      href: href,
      title: t.Permalink+' ('+t.n_characters({n: length})+')'
    });

    m.clear('warning', 'url');
    if (length > 2000) {
      m.warning(t.warning.long_url, 0, 'url');
    }
  });

  board.on_init(function () {
    $viewer.empty().append(board.render());
  }).on_ply(function (ply) {
    $ptn.find('.ply').removeClass('active')
      .filter('[data-ply="'+ply+'"]').addClass('active');
  });

  $('#controls button.first')
    .on('touchstart click', board.first)
    .attr('title', t.First_Ply);
  $('#controls button.prev')
    .on('touchstart click', board.prev)
    .attr('title', t.Previous_Ply);
  $('#controls button.play')
    .on('touchstart click', board.playpause)
    .attr('title', t.PlayPause);
  $('#controls button.next')
    .on('touchstart click', board.next)
    .attr('title', t.Next_Ply);
  $('#controls button.last')
    .on('touchstart click', board.last)
    .attr('title', t.Last_Ply);

  $('#share').attr('title', t.Share);

  $('#download').on('touchstart click', function (event) {
    event.stopPropagation();
    event.preventDefault();

    saveAs(
      new Blob([game.ptn], {type: "text/plain;charset=utf-8"}),
      (game.config.player1 || t.Player1) +
      ' vs ' +
      (game.config.player2 || t.Player2) +
      (
        game.config.date ?
        ' ' + game.config.date
        : ''
      )
      + '.ptn'
    );
  }).attr('title', t.Download);

  $('#open').on('change', function (event) {
    event.stopPropagation();
    event.preventDefault();
    read_file(this.files[0]);
    $(this).val('');
  }).attr('title', t.Open);

  if (window.File && window.FileReader && window.FileList && window.Blob) {
    $window.on('drop', function(event) {
      event.stopPropagation();
      event.preventDefault();
      read_file(event.originalEvent.dataTransfer.files[0]);
    }).on('dragover', function(event) {
      event.preventDefault();
      event.stopPropagation();
    }).on('dragleave', function(event) {
      event.preventDefault();
      event.stopPropagation();
    }).on('hashchange', function () {
      board.ply = 0;
      game.parse(location.hash.substr(1) || default_ptn, !!location.hash);
      bililiteRange($ptn[0]).undo(0);
    });
  }

  $window.on('error:parse', function () {
    $body.addClass('error');
    toggle_edit_mode(true);
  }).on('clear:error:parse', function () {
    $body.removeClass('error');
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

  $.fn.grow = function (callback) {
    var $this = $(this)
      , height = $this.height();

    $this.height(0);
    $this.height();
    $this.height(height);
    $this.afterTransition(function () {
      $this.height('');
      if (_.isFunction(callback)) {
        callback.call($this);
      }
    });

    return this;
  };

  $.fn.shrink = function (callback) {
    var $this = $(this);

    $this.height($this.height());
    $this.height();
    $this.height(0);
    $this.afterTransition(callback);

    return this;
  };


  $.fn.place = function ($piece) {
    $piece.addClass('placing');
    $piece.appendTo(this);
    $piece.height();
    $piece.removeClass('placing');

    return this;
  };

  $.fn.unplace = function ($piece) {
    $piece.afterTransition(function () {
      $piece.detach();
    });
    $piece.addClass('placing');

    return this;
  };

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

  bililiteRange.fancyText($ptn[0], function () {
    return game.parse($ptn.text());
  });

  board.ply = 0;
  game.parse(location.hash.substr(1) || default_ptn, !!location.hash);
  bililiteRange($ptn[0]).undo(0);

  if (location.hash && !$body.hasClass('error')) {
    toggle_edit_mode(false);
  }
  $viewer.afterTransition();

  $window.on('keydown', function (event) {
    if (game.is_editing) {

      // Edit Mode
      switch (event.keymap) {
        case '^z':
          bililiteRange.undo(event);
          break;
        case '^Z':
          bililiteRange.redo(event);
          break;
      }

    } else {

      // Play Mode
      switch (event.keymap) {
        case 'Spacebar':
          board.playpause();
          event.preventDefault();
          break;
        case 'ArrowLeft':
          board.prev();
          event.preventDefault();
          break;
        case 'ArrowRight':
          board.next();
          event.preventDefault();
          break;
        case '^ArrowLeft':
          board.first();
          event.preventDefault();
          break;
        case '^ArrowRight':
          board.last();
          event.preventDefault();
          break;
      }

    }

    // Global
    switch (event.keymap) {
      case 'Escape':
        toggle_edit_mode();
        break;
      case '^?':
        game.parse(sample_ptn, true);
        break;
    }
  });

  // Go to focused ply
  $ptn.on('keydown keyup mouseup touchstart touchend', function (event) {
    if (game.is_editing) {
      var $focus = $(getSelection().focusNode)
        , ply = $focus.add($focus.next()).closest('.ply').data('ply');

      if (!_.isUndefined(ply)) {
        board.go_to_ply(ply + 1);
      }
    }
  });

});
