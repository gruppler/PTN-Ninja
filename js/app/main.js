// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'app/config',
  'app/app',
  'filesaver',
  'lodash',
  'jquery',
  'jquery.keymap',
  'jquery.aftertransition',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, config, app, saveAs, _, $) {

  var baseurl = location.origin + location.pathname;

  window.app = app;
  window.t = t;


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
  app.$editor = $('#editor');
  app.$fab = $('#fab');
  app.$download = $('#download');
  app.$open = $('#open');
  app.$menu_edit = $('#menu-edit');
  app.$menu_play = $('#menu-play');

  app.range = bililiteRange(app.$ptn[0]);
  app.range.undo(0);


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


  // Re-render $ptn
  // Initialize board
  // Update Permalink
  app.$permalink = $('#permalink');
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

    if (is_original) {
      app.clear_undo_history();
    }

    app.save_scroll_position();
  });


  // Re-render $viewer after board initialization
  app.board.on_init(function () {
    app.$viewer.empty().append(app.board.render());
    app.board.resize();
  });


  app.$window.on('resize', app.resize);
  app.config.on_change([
    'show_axis_labels',
    'show_player_scores',
    'show_current_move',
    'show_unplayed_pieces',
    'show_play_controls'
  ], app.resize);


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


  // Make playback speed respond immediately to speed changes
  config.on_change('speed', function (speed) {
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
  }, 'play');


  // Update opacity controls when value changes
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
    app.menu.close();
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
      app.game.parse(app.hash || app.default_ptn, !!app.hash, true);
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
  bililiteRange.fancyText(app.$ptn[0], function (editor, text) {
    text = text || app.$ptn.text();

    if (text && text != '\n') {
      return app.game.parse(text);
    }
    return false;
  }, 100);


  // Load the initial PTN
  app.game.parse(
    app.hash || app.default_ptn,
    !!app.hash,
    !sessionStorage.ptn
  );
  app.clear_undo_history();


  // Listen for caret movement
  app.$ptn.on('keyup mouseup', app.set_position_from_caret);
  app.$editor.on('scroll', app.save_scroll_position);


  // Set initial mode
  if (config.animate_board) {
    app.$html.removeClass('animate-board');
    app.toggle_edit_mode(app.$html.hasClass('error') || !location.hash);
    app.$html.height(); // Update DOM before re-enabling animations
    app.$html.addClass('animate-board');
  } else {
    app.toggle_edit_mode(app.$html.hasClass('error') || !location.hash);
  }


  // Open the relevant menu accordion
  if (app.mode == 'edit') {
    app.$menu_edit.addClass('mdl-accordion--opened');
  } else {
    app.$menu_play.addClass('mdl-accordion--opened');
  }


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

});
