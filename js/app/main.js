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

  var $ptn = $('#ptn')
    , $permalink = $('#permalink')
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

  $('title').text(t.app_title);

  game.on_update(function () {
    var href, length;

    $ptn.html(this.print());
    board.parse(this);

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
  game.parse(location.hash ? location.hash.substr(1) : default_ptn, true);

  bililiteRange.fancyText($ptn[0], function () {
    game.parse($ptn.text());
  });
  bililiteRange($ptn[0]).undo(0);
  $ptn.on('keydown', function (event) {
		if (event.ctrlKey && event.which == 90) {
      if (event.shiftKey) {
        bililiteRange.redo(event);
      } else {
        bililiteRange.undo(event);
      }
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
        }
        reader.readAsText(file);
      }
    }).on('hashchange', function () {
      game.parse(location.hash.substr(1), true);
    });
  }

});
