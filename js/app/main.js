'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'app/messages',
  'app/game',
  'app/board',
  'lodash',
  'jquery',
  'jquery.keymap',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, Messages, Game, Board, _, $) {

  var $window = $(window)
    , $body = $('body')
    , $ptn = $('#ptn')
    , $viewer = $('#viewer')
    , $permalink = $('#permalink')
    , $messages_parse = $('.messages-parse')
    , m = new Messages('general')
    , game = new Game()
    , board = new Board()
    , baseurl = location.origin + location.pathname
    , default_ptn = 'NoZQlgLgpgBARABQDYEMCeAVFBrAdAYwHsBbOAXQChgBRANygDsJ4B5BpMB2ZdcqgERTR4AJgAMARgBsuMQFZcEuX2A80UAE4T4Acw0BXAA6GkmlWs0jdGqI1O0wQgBYoGKgEpQAzvqTM4YgC0AGIq4ABesHDKlBQw8QmJiQDeMBiQpjAAvhQUErgwKHIwyQCCSADu6F4wFZBOMBBOsEQaXBpeuF1ZMFASFCIFACba+HIUAMzDVkPjACwFUHO94wowEksA1OuzAHwUMjAgszAARuMA7AUSe9oAwrMUABwFD8unIhQAnAX4E2cTPJiX7LCSnCa7foSfJnZYoOZ5QbrfBzTbaG5ySF5KY7VHacF5BYwIZzADkxMBSmupzmgQk5LBIjReUOIBQ-xuE2ZEiuMBRMBEf02nwkLwFY0CVhEJIAPCKfhTyXMUZDAeJrkMufSYBMVWqYSAxjA5FA5IFxiIkRi6UdNQMcScaQMiSBTWd+iI1hJ2ZCzp8RIcRODJYU1bz8FY-gMxWyrCgPQq5rKycaljLxhNgetTTbTZMYUGJnKAZMkcraaDNXTJjjBRDI-0JkSJH8ZdrkiwGuoUE4ADQwACSMB0hGYTTAXgAhD1ku4wDonBAAPw5RJQCaTydxBJBYIlFgAMz5hH0HSg-cIXBgxEI9BgB40JFqnAYnB0MECAH1AjkgA';

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

  // For debugging purposes only:
  window.game = game;
  window.board = board;
  //

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

    $ptn.attr('contenteditable', game.is_editing);
  }

  $('title').text(t.app_title);

  $('#fab').click(function () {
    if ($body.hasClass('error')) {
      if ($messages_parse.hasClass('visible')) {
        $messages_parse.shrink(function () {
          this.removeClass('visible').height('');
        });
      } else {
        $messages_parse.addClass('visible').grow();
      }
    } else {
      toggle_edit_mode();
    }
  }).mousedown(function (event) {
    event.stopPropagation();
    event.preventDefault();
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

  $('#controls button.first').click(board.first);
  $('#controls button.prev').click(board.prev);
  $('#controls button.play').click(board.playpause);
  $('#controls button.next').click(board.next);
  $('#controls button.last').click(board.last);

  if (window.File && window.FileReader && window.FileList && window.Blob) {
    $window.on('drop', function(event) {
      var file = event.originalEvent.dataTransfer.files[0]
        , i, file, ext;

      event.stopPropagation();
      event.preventDefault();

      if (file && /.ptn$/i.test(file.name)) {
        var reader = new FileReader();
        reader.onload = function (event) {
          board.ply = 0;
          game.parse(event.target.result);
          bililiteRange($ptn[0]).undo(0);
          location.hash = game.ptn_compressed;
        }
        reader.readAsText(file);
      }
    }).on('dragover', function(event) {
      event.preventDefault();
      event.stopPropagation();
    }).on('dragleave', function(event) {
      event.preventDefault();
      event.stopPropagation();
    }).on('hashchange', function () {
      board.ply = 0;
      game.parse(location.hash.substr(1) || default_ptn, true);
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
      $this.one('webkitTransitionEnd transitionend', function () {
        callback.call($this);
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

    $this.addClass('animated');
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
  game.parse(location.hash ? location.hash.substr(1) : default_ptn, true);
  bililiteRange($ptn[0]).undo(0);

  if (location.hash && !$body.hasClass('error')) {
    toggle_edit_mode(false);
  }

  $ptn.on('keydown', function (event) {
    if (game.is_editing) {
      switch (event.keymap) {
        case '^z':
          bililiteRange.undo(event);
          event.preventDefault();
          event.stopPropagation();
          break;
        case '^Z':
          bililiteRange.redo(event);
          event.preventDefault();
          event.stopPropagation();
          break;
      }
    }
  }).on('keyup mouseup', function (event) {
    if (game.is_editing) {
      var $focus = $(getSelection().focusNode)
        , ply = $focus.add($focus.next()).closest('.ply').data('ply');

      if (!_.isUndefined(ply)) {
        board.go_to_ply(ply + 1);
      }
    }
  });

});
