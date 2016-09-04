// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'app/config',
  'app/app',
  'app/messages',
  'filesaver',
  'lodash',
  'jquery',
  'jquery.keymap',
  'jquery.aftertransition',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, config, app, Messages, saveAs, _, $) {

  var baseurl = location.origin + location.pathname
    , m = new Messages('general', true);

  window.app = app;


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
  app.$menu_edit = $('#menu-edit');
  app.$menu_play = $('#menu-play');


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
    app.$ptn.$header = app.$ptn.find('span.header');
    app.$ptn.$header.$tps = app.$ptn.$header.find('span.value.tps');
    app.$ptn.$body = app.$ptn.find('span.body');
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
    app.board.set_active_squares(ply ? ply.squares : false);
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


  // UI changes for parse errors
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
    } else if (app.game.is_editing && event.keymap in app.hotkeys.edit) {
      // Edit Mode
      app.hotkeys.edit[event.keymap](event, $focus, $parent);
    } else if (!app.game.is_editing && event.keymap in app.hotkeys.play) {
      // Play Mode
      app.hotkeys.play[event.keymap](event, $focus, $parent);
    } else if (event.keymap in app.hotkeys.global) {
      // Global
      app.hotkeys.global[event.keymap](event, $focus, $parent);
    }
  });


  // Update board when cursor moves
  app.$ptn.on('keyup mouseup', function (event) {
    var focus, $focus
      , $ply, ply_id
      , $square, squares, square, i;

    if (!app.game.is_editing) {
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

      ply_id = 1*$ply.data('id');

      if (_.isInteger(ply_id)) {
        app.board.go_to_ply(
          ply_id,
          app.board.ply_id != ply_id
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
  });

});
