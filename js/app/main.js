'use strict';

requirejs([
  'i18n!nls/main',
  'app/game',
  'app/board',
  'lodash',
  'jquery',
  'lzstring',
  'domReady!'
], function (t, Game, Board, _, $) {

  var $ptn = $('#ptn')
    , $permalink = $('#permalink')
    , encode = LZString.compressToEncodedURIComponent
    , decode = LZString.decompressFromEncodedURIComponent
    , game = new Game()
    , board = new Board()
    , default_ptn = 'NoZQlgLgpgBARABQDYEMCeAVFBrAdAYwHsBbOAXQChgBRANygDsJ4B5BpMB2ZdcqgERTR4AJgAMARgBsuMQFZcEuX2AYwxWHDEBmAFwSALLoMB2FTzRQAThPgBzKwFcADs6TXzqS1ZH2rURndaMCEACxQGFQAlKABnRyRmLQBaADEVcAAvTWVKAG8KGBhVBBB4AA9tABoJESqREAB6cvqG1oBhGol6iUba7pFamrqJfs7+hsbBkBqenokZ2qaW6fqq8t9bESk+AF8KQqKj4+O8mDUIdxh9iglcGBQ5GDyAQSQAd3RYmHfIUJgIKFYEQrFwrLFcJDdjAoBIKCJ7gATWz4OQUbRI3yItEGe5QAwwtEKGASfEAahJ2IAfBQZDAQNiYAAjNEme4Sam2drYigADnu3IJTJEFAAnPd8NpmdpbmIJQSJEztFS4aN7kyCSgDLcEST8AYybYOXIVbcMZSDbYlbdcTBEQTETKlOyNckjcLDbc6SAUFKOdpPRI2TB9TARJKySKJPyw6jkr4RPaADxR8V2qUGfUqmXidmOw0wbRZnN3emomByKByZJokS641u+mO+Hmxka+G2kBV5lwkTEiS+lXMkXbe4iJXxh454P4XyS+Exn2+FC9tMGZMEysGJNo7RyklVxtV9Gl8faFPS9G6zMGZIKx1u9Hm8PKudw7S2iSSpMSADkzxYf5LBQUIqhgABJGA7EIZhATAWIAEJoTyKIwDsUIIAAfn2Y4oG0BCEMOIoxDSACADMQ0IRxwSgMDCC4GBiEIegYDIqwSB+TgGE4OwYGSAB9ZJdiAA';

  $('title').text(t.app_title);
  $permalink.attr('title', t.Permalink);

  function parse_text() {
    game.parse($ptn.text());
    board.parse(game);
    $permalink.attr('href', '#'+encode(game.ptn));
  }

  $ptn.on('blur paste', parse_text)
    .on('keyup cut mouseup', _.debounce(parse_text, 300));

  if (location.hash) {
    $ptn.text(decode(location.hash.substr(1)));
  } else {
    $ptn.text(decode(default_ptn));
  }

  parse_text();

});
