'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'util/messages',
  'app/game',
  'app/board',
  'lodash',
  'jquery',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, Messages, Game, Board, _, $) {

  var $body = $('body')
    , $ptn = $('#ptn')
    , $permalink = $('#permalink')
    , $messages_parse = $('.messages-parse')
    , m = new Messages('general')
    , game = new Game()
    , board = new Board()
    , baseurl = location.origin + location.pathname
    , default_ptn = 'NoZQlgLgpgBARABQDYEMCeAVFBrAdAYwHsBbOAXQChgBRANygDsJ4B5BpMB2ZdcqgERTR4AJgAMARgBsuMQFZcEuX2A80UAE4T4Acw0BXAA6GkmlWs0jdGqI1O0wQgBYoGKgEpQAzvqTM4YgC0AGIq4ABesHDKlBQw8QmJiQDeMBiQpjAAvhQUErgwKHIwyQCCSADu6F4wFZBOMBBOsEQaXBpeuF1ZMFASFCIFACba+HIUAMzDVkPjACwFUHO94wowEksA1OuzAHwUMjAgszAARuMA7AUSe9oAwrMUABwFD8unIhQAnAX4E2cTPJiX7LCSnCa7foSfJnZYoOZ5QbrfBzTbaG5ySF5KY7VHacF5BYwIbLIaApTXU5zQLoj5ovKHEAof43Cb0iRXGAomAiP6bT4SF48saBKwiEkAHgFP2J-zmKMhgPE1zJaJgEwVSphIDGMDkUDkgXGIiRGJpRzJAxxJypAyJIANZ36IjWEmZkLOnxEhxE4NFhSVnPwVj+AyFTKsKGdMrmkuW+rmEvGE2B6wN5oNkxhvomUoBkyR8upoLJNMmON5EJD-QmRIkfwlEgA5CUWA11CgnAAaGAASRgOkIzCaYC8AEIesl3GAdE4IAB+HKJKATMdjuIJILBVsAMy5hH0HSgPcIXBgxEI9BgO40JFqnAYnB0MECAH1AjkgA';

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

  function toggle_edit_mode(on) {
    if (_.isBoolean(on)) {
      $body.addClass(on ? 'editmode' : 'playmode');
      $body.removeClass(on ? 'playmode' : 'editmode');
    } else {
      $body.toggleClass('editmode playmode');
    }

    if ($body.hasClass('editmode')) {
      $ptn.attr('contenteditable', true);
    } else {
      $ptn.attr('contenteditable', false);
      board.parse(game);
    }
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
  });

  game.on_parse_start(function () {
    if ($ptn.text() != this.ptn) {
      $ptn.text(this.ptn);
    }
  });

  game.on_parse_end(function () {
    var href, length;

    $ptn.html(this.print());

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

  if (window.File && window.FileReader && window.FileList && window.Blob) {
    $(window).on('drop', function(event) {
      var file = event.originalEvent.dataTransfer.files[0]
        , i, file, ext;

      event.stopPropagation();
      event.preventDefault();

      if (file && /.ptn$/i.test(file.name)) {
        var reader = new FileReader();
        reader.onload = function (event) {
          game.parse(event.target.result);
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
      game.parse(location.hash.substr(1) || default_ptn, true);
    });
  }

  $(window).on('error', function () {
    toggle_edit_mode(true);
  });


  $.fn.grow = function (callback) {
    var $this = $(this)
      , height = $this.height();

    $this.height(0);
    $this.height();
    $this.height(height);
      $this.one('webkitTransitionEnd transitionend', function () {
        $this.height('');
        if (_.isFunction(callback)) {
          callback.call($this);
        }
      });
  };

  $.fn.shrink = function (callback) {
    var $this = $(this);

    $this.height($this.height());
    $this.height();
    $this.height(0);
    if (_.isFunction(callback)) {
      $this.one('webkitTransitionEnd transitionend', function () {
        callback.call($this);
      });
    }
  };


  // Initialize

  bililiteRange.fancyText($ptn[0], function () {
    if ($ptn.text().trim()) {
      return game.parse($ptn.text());
    }
    return false;
  });
  bililiteRange($ptn[0]).undo(0);

  game.parse(location.hash ? location.hash.substr(1) : default_ptn, true);
  if (location.hash && !$body.hasClass('error')) {
    toggle_edit_mode(false);
  }

  $ptn.on('keydown', function (event) {
    if (event.ctrlKey && event.which == 90) {
      if (event.shiftKey) {
        bililiteRange.redo(event);
      } else {
        bililiteRange.undo(event);
      }
    }
  });

});
