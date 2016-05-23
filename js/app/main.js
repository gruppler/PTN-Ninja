'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'util/messages',
  'app/game',
  'app/board',
  'lodash',
  'jquery',
  'lzstring',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, Messages, Game, Board, _, $) {

  var $ptn = $('#ptn')
    , $permalink = $('#permalink')
    , encode = LZString.compressToEncodedURIComponent
    , decode = LZString.decompressFromEncodedURIComponent
    , m = new Messages('general')
    , game = new Game()
    , board = new Board()
    , baseurl = location.origin + location.pathname
    , default_ptn = 'NoZQlgLgpgBARABQDYEMCeAVFBrAdAYwHsBbOAXQChgBRANygDsJ4B5BpMB2ZdcqgERTR4AJgAMARgBsuMQFZcEuX2AYwxWHDEBmAFwSALLoMB2FTzRQAThPgBzKwFcADs6TXzqS1ZH2rURndaMCEACxQGFQAlKABnRyRmLQBaADEVcAAvTWVKAG8KGBhVBBB4AA9tABoJESqREAB6cvqG1oBhGol6iUba7pFamrqJfs7+hsbBkBqenokZ2qaW6fqq8t9bESk+AF8KQqKj4+O8mDUIdxh9iglcGBQ5GDyAQSQAd3RYmHfIUJgIKFYEQrFwrLFcJDdjAoBIKCJ7gATWz4OQUbRI3yItEGe5QAwwtEKGASfEAahJ2IAfBQZDAQNiYAAjNEme4Sam2drYigADnu3IJTJEFAAnPd8NpmdpbmIJQSJEztFS4aN7kyCSgDLcEST8AYybYOXIVbcMZSDbYlbdcTBEQTETKlOyNckjcLDbc6SAUFKOdpPRI2TB9TARJKySKJPyw6jkr4RPaADxR8V2qUGfUqmXidmOw0wbRZnN3emomByKByZJokS641u+mO+Hmxka+G2kBV5lwkTEiS+lXMkXbe4iJXxh454P4XyS+Exn2+FC9tMGZMEysGJNo7RyklVxtV9Gl8faFPS9G6zMGZIKx1u9Hm8PKudw7S2iSSpMSADkzxYf5LBQUIqhgABJGA7EIZhATAWIAEJoTyKIwDsUIIAAfn2Y4oG0BCEMOIoxDSACADMQ0IRxwSgMDCC4GBiEIegYDIqwSB+TgGE4OwYGSAB9ZJdiAA';

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
  $permalink.attr('title', t.Permalink);

  if (location.hash) {
    $ptn.text(decode(location.hash.substr(1)));
  } else {
    $ptn.text(decode(default_ptn));
  }

  function parse_text() {
    var ptn = $ptn.text()
      , href, length

    if (!game.parse(ptn)) {
      return;
    }

    $ptn.html(game.print());
    board.parse(game);

    href = '#'+encode(game.ptn);
    length = (baseurl + href).length;
    $permalink.attr({
      href: href,
      title: t.Permalink+' ('+t.n_characters({n: length})+')'
    });
    m.clear('warning', 'url');
    if (length > 2000) {
      m.warning(t.warning.long_url, 0, 'url');
    }
  }

  bililiteRange.fancyText($ptn[0], parse_text);
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

});
