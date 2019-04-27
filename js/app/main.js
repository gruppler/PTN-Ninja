// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'app/messages',
  'app/config',
  'app/app',
  'filesaver',
  'lodash',
  'jquery',
  'jquery.keymap',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'material',
  'domReady!'
], function (t, Messages, config, app, saveAs, _, $) {

  window.app = app;
  window.t = t;

  app.$window = $(window);
  app.$document = $(document);
  app.$html = $('html');
  app.$body = $('body');

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


  // Long-click/press
  $.fn.longClick = function(selector, callback, normal_callback) {
    var timeout = 350
      , max_distance = 5
      , $this = $(this)
      , coords = {};

    if (_.isFunction(selector)) {
      if (_.isFunction(callback)) {
        normal_callback = callback;
      }
      callback = selector;
      selector = '';
    }

    function start(event) {
      if ($this.timer) {
        return;
      }

      if (event.type == 'touchstart') {
        coords.x = event.originalEvent.touches[0].clientX;
        coords.y = event.originalEvent.touches[0].clientY;
        $this.off('mousedown', selector, start);
        $this.on('touchend', selector, normal_click);
        $this.on('touchstart', selector, cancel);
      } else {
        coords.x = event.clientX;
        coords.y = event.clientY;
        $this.on('mouseup', selector, normal_click);
      }

      app.$document.on('mousemove touchmove', selector, cancel_if_too_far);
      $this.on('mouseout', selector, cancel);

      $this.timer = setTimeout(function () {
        cancel();

        event.click_duration = timeout;
        event.preventDefault();
        event.stopPropagation();

        callback(event);
      }, timeout);
    }

    function cancel() {
      clearTimeout($this.timer);
      $this.timer = null;
      $this.off('touchend mouseup', selector, normal_click);
      app.$document.off('mousemove touchmove', selector, cancel_if_too_far);
      $this.off('mouseout touchstart', selector, cancel);
    }

    function cancel_if_too_far(event) {
      var x, y;

      if (event.type == 'touchmove') {
        x = event.originalEvent.touches[0].clientX;
        y = event.originalEvent.touches[0].clientY;
      } else {
        x = event.clientX;
        y = event.clientY;
      }
      if (
        max_distance < Math.sqrt(
          Math.pow(coords.x - x, 2)
          + Math.pow(coords.y - y, 2)
        )
      ) {
        cancel();
      }
    }

    function normal_click(event) {
      if (_.isFunction(normal_callback)) {
        normal_callback(event);
      }
      cancel();
    }

    $this.on('touchstart mousedown', selector, start);

    return this;
  };


  $('title').text(t.app_title);

  if (!app.$html.hasClass('mdl-js')) {
    componentHandler.init();
  }

  // Initialize Menu
  app.menu.render();

  app.$ptn = $('#ptn');
  app.$viewer = $('#viewer');
  app.$view_wrapper = app.$viewer.children('.view-wrapper');
  app.$board_view = app.$viewer.find('.table-wrapper');
  app.$controls = app.$viewer.find('.controls');
  app.$controls.$first = app.$controls.find('button.first');
  app.$controls.$prev_move = app.$controls.find('button.prev_move');
  app.$controls.$prev = app.$controls.find('button.prev');
  app.$controls.$play = app.$controls.find('button.play');
  app.$controls.$next = app.$controls.find('button.next');
  app.$controls.$next_move = app.$controls.find('button.next_move');
  app.$controls.$last = app.$controls.find('button.last');
  app.$editor = $('#editor');
  app.$editor.$bg = app.$editor.find('.background');
  app.$fab = $('#fab');
  app.$download = $('#download');
  app.$open = $('#open');
  app.$menu_edit = $('#menu-edit');
  app.$menu_play = $('#menu-play');
  app.$messages = $('#messages');
  app.m = new Messages('global');

  // Require a long-press to edit unless there's a mouse
  // (and presumably a keyboard)
  app.$ptn.longClick(app.editable_on);
  app.$ptn.on('blur', app.editable_off);

  app.can_hover = false;
  app.$window.one('mousemove', function (event) {
    if (!app.touches) {
      app.can_hover = true;
      app.$html.addClass('can-hover');
      app.toggle_editable(true);
      app.$ptn.off('blur', app.editable_off);
    }
  }).one('touchstart', function (event) {
    app.$window.off('mousemove');
    app.editable_off();
  });

  app.range = bililiteRange(app.$ptn[0]);
  app.range.undo(0);


  // Add boolean preferences to html class
  app.$html.addClass(
    _.map(_.keys(_.pickBy(app.config, _.isBoolean)), function (prop) {
      return app.config[prop] ? prop.replace(/_/g, '-') : '';
    }).join(' ')
  );


  // Initialize embed stuff
  if (config.is_in_iframe) {
    app.$html.addClass('embed');
  }


  // Initialize FAB
  app.$fab.on('touchstart click', function (event) {
    event.stopPropagation();
    event.preventDefault();
    if (app.$html.hasClass('error')) {
      if (app.game.is_editing) {
        config.toggle('show_parse_errors');
      } else {
        app.toggle_edit_mode(true);
      }
    } else {
      app.toggle_edit_mode();
    }
  }).mouseover(function () {
    app.$fab.attr('title',
      app.$html.hasClass('error') ? t.Show_Hide_Errors :
        app.game.is_editing ? t.Play_Mode : t.Edit_Mode
    );
  });


  // Initialize play controls
  app.$controls.$first
    .on('touchstart click', app.board.first)
    .attr('title', t.First_Ply);
  app.$controls.$prev_move
    .on('touchstart click', app.board.prev_move)
    .attr('title', t.Previous_Move);
  app.$controls.$prev
    .on('touchstart click', app.board.prev_ply)
    .attr('title', t.Previous_Ply);
  app.$controls.$play
    .on('touchstart click', app.board.playpause)
    .attr('title', t.PlayPause);
  app.$controls.$next
    .on('touchstart click', app.board.next_ply)
    .attr('title', t.Next_Ply);
  app.$controls.$next_move
    .on('touchstart click', app.board.next_move)
    .attr('title', t.Next_Move);
  app.$controls.$last
    .on('touchstart click', app.board.last)
    .attr('title', t.Last_Ply);


  // Re-render $ptn
  // Initialize board
  // Update Permalink
  app.$permalink = $('#permalink');
  app.game.on_parse_end(app.update_after_parse);

  // Store game before unloading
  app.$window.on('unload', function () {
    app.config.set('last_session', location.hash);
  });


  // Re-render $viewer after board initialization
  app.board.on_init(function () {
    app.$board_view.empty().append(app.board.render());
    app.board.resize();
  });


  // Resize board after window resize and board config changes
  app.$window.on('resize', app.resize);
  app.config.on_change([
    'board_3d',
    'show_axis_labels',
    'show_flat_counts',
    'show_current_move',
    'show_unplayed_pieces',
    'show_play_controls'
  ], app.resize);


  // Update editor width after every board resize
  app.board.on_resize(function () {
    app.set_editor_width(app.board.vw, app.board.width);
  });


  // Update current ply display
  app.board.on_ply(app.update_after_ply);
  app.board.on_branch_change(app.update_ptn_branch);


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
    app.$editor.$bg.css('opacity', (100 - opacity)/100);
  }, 'edit');
  config.on_change('board_opacity', false, 'edit');

  // Update piece positioning after toggling 3D
  config.on_change('board_3d', app.board.reposition_pieces);
  config.on_change('board_3d', function (value, prop, n, i, is_first_change) {
    if (is_first_change && !config.is_blink) {
      app.m.help(t.help.board_3d_experimental);
    }
  });

  // Open menu on left edge touch
  app.$body.on('touchstart', function (event) {
    if (event.originalEvent.touches[0].clientX < 10) {
      app.menu.open();
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // Rotate board in 3D mode
  config.on_change('board_rotation', app.board.rotate);
  app.$viewer.on(
    'mousedown touchstart',
    app.board.rotate_handler
  ).longClick(
    '.square.valid',
    app.board.select_square,
    app.board.select_square
  ).on('contextmenu', function (event) {
    event.preventDefault();
  }).longClick(app.board.reset_rotation)


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
        app.game.config.result ?
        ' ' + app.game.config.result.text.replace(/\//g, '-')
        : ''
      ) +
      (
        app.game.config.date ?
        ' ' + app.game.config.date
        : ''
      ) +
      (
        app.game.config.time ?
        '-' + app.game.config.time.replace(/\D/g, '.')
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


  // Listen for dropped files
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
    });
  }


  // UI changes for parse errors
  app.$window.on('error:parse', function () {
    app.$html.addClass('error');
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

  // Parse URL parameters
  var ply_index, ply_is_done

  if (app.hash.indexOf('&') >= 0) {
    ply_index = app.hash.match(/&ply=(\d+!?)/);
    if (ply_index) {
      ply_is_done = ply_index[1].indexOf('!') > 0;
      ply_index = parseInt(ply_index[1], 10);
    }

    if (app.hash.indexOf('&mode=edit') >= 0) {
      app.mode = 'edit';
    }

    app.hash = app.hash.replace(/&.*$/, '');
  }

  // Load the initial PTN
  app.game.parse(
    app.hash || app.default_ptn(),
    !!app.hash,
    !sessionStorage.ptn
  );
  app.clear_undo_history();

  // Go to initial ply
  if (_.isNumber(ply_index)) {
    app.board.go_to_ply(ply_index, ply_is_done);
  }


  // Listen for caret movement
  app.$ptn.on('keyup mouseup', app.set_position_from_caret);
  if (app.supports_passive) {
    app.$ptn[0].addEventListener(
      'scroll',
      app.save_scroll_position,
      {passive: true}
    );
  } else {
    app.$ptn.on('scroll', app.save_scroll_position);
  }


  // Set initial mode
  if (config.animate_board) {
    app.$html.removeClass('animate-board');
    app.toggle_edit_mode(app.mode == 'edit' || app.$html.hasClass('error'));
    app.$html.height(); // Update DOM before re-enabling animations
    app.$html.addClass('animate-board');
  } else {
    app.toggle_edit_mode(app.mode == 'edit' || app.$html.hasClass('error'));
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

    event.keymap.replace('~', '^');

    if (app.current_dialogs.length) {
      // Modal Dialog
      if (event.keymap == 'Escape') {
        dialog = app.current_dialogs.pop();
        dialog.close();
        $(dialog).remove();
      }
    } else if (
      app.game.is_editing
      && app.$ptn.prop('contenteditable') == 'true'
      && app.$ptn.is(':focus')
    ) {
      // Edit Mode
      if (_.has(app.hotkeys.edit, event.keymap)) {
        app.hotkeys.edit[event.keymap](event, $focus, $parent);
      } else if (_.has(app.hotkeys.global, event.keymap)) {
        // Global
        app.hotkeys.global[event.keymap](event, $focus, $parent);
      }
    } else if (_.has(app.hotkeys.play, event.keymap)) {
      // Play Mode
      app.hotkeys.play[event.keymap](event, $focus, $parent);
    } else if (_.has(app.hotkeys.global, event.keymap)) {
      // Global
      app.hotkeys.global[event.keymap](event, $focus, $parent);
    }
  });

  app.$html.removeClass('loading');

});
