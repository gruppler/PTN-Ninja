// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/config',
  'i18n!nls/main',
  'lodash',
  'jquery',
  'domReady!'
], function (config, t, _, $) {

  var $panel = $('#app')
    , $menu = $('#menu')
    , $menu_button = $('.mdl-layout__drawer-button').addClass('mdl-button mdl-js-button mdl-button--icon mdl-js-ripple-effect');

  var Menu = {};

  Menu.open = function () {
    if (!$menu.hasClass('is-visible')) {
      this.toggle();
    }
  };

  Menu.close = function () {
    if ($menu.hasClass('is-visible')) {
      this.toggle();
    }
  };

  Menu.toggle = function () {
    $menu_button.click();
  };

  $menu_button.focus(function () {
    $menu_button.blur();
  });

  Menu.content = [{
    id: 'global',
    items: [{
      label: t.About_App,
      icon: 'help',
      onclick: 'app.about()',
    },{
      label: t.Permalink,
      icon: 'link',
      class: 'permalink',
      href: '#'+app.ptn_compressed,
      target: '_blank',
      rel: 'noopener'
    },{
      label: t.Download,
      icon: 'file_download',
      id: 'download',
      href: '#'
    },{
      label: t.Open,
      icon: 'folder_open',
      id: 'open',
      type: 'file',
      accept: '.ptn,.txt'
    },{
      label: t.Load_Sample_Game,
      icon: 'apps',
      onclick: 'app.game.parse(app.sample_ptn, true)'
    }]
  },{
    id: 'edit',
    label: t.Edit_Mode,
    icon: 'mode_edit',
    items: [{
      label: t.Highlight_Squares,
      type: 'checkbox',
      checked: config.editmode_square_hl,
      'data-id': 'editmode_square_hl'
    },{
      label: t.Show_Parse_Errors,
      type: 'checkbox',
      checked: config.show_parse_errors,
      'data-id': 'show_parse_errors'
    },{
      label: t.Board_Opacity,
      type: 'slider',
      min: 0,
      max: 100,
      step: 5,
      value: config.board_opacity,
      'data-realtime': true,
      'data-id': 'board_opacity'
    },{
      label: t.Undo,
      icon: 'undo',
      onclick: 'app.undo()',
      class: 'keep-open'
    },{
      label: t.Redo,
      icon: 'redo',
      onclick: 'app.redo()',
      class: 'keep-open'
    },{
      label: t.Trim_to_current_ply,
      icon: 'content_cut',
      onclick: 'app.board.trim_to_current_ply()'
    },{
      label: t.Revert_Game,
      icon: 'restore',
      onclick: 'app.revert_game()'
    }]
  },{
    id: 'play',
    label: t.Play_Mode,
    icon: 'play_arrow',
    items: [{
      label: t.Highlight_Squares,
      type: 'checkbox',
      checked: config.playmode_square_hl,
      'data-id': 'playmode_square_hl'
    },{
      label: t.Show_Annotations,
      type: 'checkbox',
      checked: config.show_annotations,
      'data-id': 'show_annotations'
    },{
      label: t.Play_Speed,
      type: 'slider',
      min: 20,
      max: 200,
      step: 10,
      value: config.play_speed,
      'data-id': 'play_speed'
    }]
  },{
    id: 'board',
    label: t.Board_Settings,
    icon: 'settings',
    items: [{
      label: t.Animate_Pieces,
      type: 'checkbox',
      checked: config.animate_pieces,
      'data-id': 'animate_pieces'
    },{
      label: t.Axis_Labels,
      type: 'checkbox',
      checked: config.show_axis_labels,
      'data-id': 'show_axis_labels'
    },{
      label: t.Player_Scores,
      type: 'checkbox',
      checked: config.show_player_scores,
      'data-id': 'show_player_scores'
    },{
      label: t.Current_Move,
      type: 'checkbox',
      checked: config.show_current_move,
      'data-id': 'show_current_move'
    },{
      label: t.Unplayed_Pieces,
      type: 'checkbox',
      checked: config.show_unplayed_pieces,
      'data-id': 'show_unplayed_pieces'
    },{
      label: t.Play_Controls,
      type: 'checkbox',
      checked: config.show_play_controls,
      'data-id': 'show_play_controls'
    },{
      label: t.Road_Connections,
      type: 'checkbox',
      checked: config.show_roads,
      'data-id': 'show_roads'
    }]
  }];

  Menu.tpl = {

    item: function (obj) {
      if ('items' in obj) {
        if ('label' in obj) {
          return app.menu.tpl.accordion(obj);
        } else {
          return app.menu.tpl.section(obj);
        }
      } else if ('href' in obj || 'onclick' in obj) {
        return app.menu.tpl.anchor(obj);
      } else if ('type' in obj) {
        return app.menu.tpl[obj.type](obj);
      }
    },

    menu: function (obj) {
      return '<span class="mdl-layout-title">'+t.app_title+'</span>'
        + _.map(obj.content, app.menu.tpl.item).join('');
    },

    section: _.template(
      '<nav id="menu-<%=obj.id%>" class="mdl-list mdl-navigation">'+
        '<%= _.map(items, app.menu.tpl.item).join("") %>'+
      '</nav>'
    ),

    accordion: _.template(
      '<div id="menu-<%=obj.id%>" class="mdl-accordion mdl-list mdl-navigation">'+
        '<a class="mdl-navigation__link mdl-accordion__button keep-open">'+
          '<span class="label">'+
            '<i class="material-icons"><%=obj.icon%></i>'+
            '<%=obj.label%>'+
          '</span>'+
          '<i class="material-icons mdl-accordion__icon">expand_more</i>'+
        '</a>'+
        '<div class="mdl-accordion__content-wrapper">'+
          '<div class="mdl-accordion__content mdl-list">'+
            '<%= _.map(obj.items, app.menu.tpl.item).join("") %>'+
          '</div>'+
        '</div>'+
      '</div>'
    ),

    anchor: _.template(
      '<a class="mdl-navigation__link"'+
        '<% _.each(_.omit(obj, ["label", "icon"]), function(value, key) { %>'+
          ' <%=key%>="<%-value%>"'+
        '<% }) %>'+
      '>'+
        '<i class="material-icons"><%=obj.icon%></i>'+
        '<%=obj.label%>'+
      '</a>'
    ),

    checkbox: _.template(
      '<div class="mdl-navigation__link item-checkbox">'+
        '<label class="mdl-checkbox mdl-js-checkbox">'+
          '<input type="checkbox" class="mdl-checkbox__input"'+
            '<% _.each(_.omit(obj, ["label", "type"]), function(value, key) { %>'+
              '<% if (_.isBoolean(value) && !/^data-/.test(key)) { %>'+
                ' <%= value ? key : "" %>'+
              '<% } else { %>'+
                ' <%=key%>="<%-value%>"'+
              '<% } %>'+
            '<% }) %>'+
            '>'+
          '<span class="mdl-checkbox__label"><%=obj.label%></span>'+
        '</label>'+
      '</div>'
    ),

    slider: _.template(
      '<div class="mdl-navigation__link item-slider">'+
        '<span class="mdl-slider__label"><%=obj.label%></span>'+
        '<input class="mdl-slider mdl-js-slider" type="range"'+
          '<% _.each(_.omit(obj, ["label", "type"]), function(value, key) { %>'+
            '<% if (_.isBoolean(value) && !/^data-/.test(key)) { %>'+
              ' <%= value ? key : "" %>'+
            '<% } else { %>'+
              ' <%=key%>="<%-value%>"'+
            '<% } %>'+
          '<% }) %>'+
        '>'+
      '</div>'
    ),

    file: _.template(
      '<div class="mdl-navigation__link item-file">'+
        '<i class="material-icons"><%=obj.icon%></i>'+
        '<%=obj.label%>'+
        '<input class="invisible-file-input"'+
          '<% _.each(_.omit(obj, ["label", "icon"]), function(value, key) { %>'+
            '<% if (_.isBoolean(value) && !/^data-/.test(key)) { %>'+
              ' <%= value ? key : "" %>'+
            '<% } else { %>'+
              ' <%=key%>="<%-value%>"'+
            '<% } %>'+
          '<% }) %>'+
        '>'+
      '</div>'
    )

  };

  Menu.render = function () {
    $menu.html(this.tpl.menu(this));

    // Initialize widgets
    $menu.find('.mdl-slider, .mdl-checkbox').each(function () {
      componentHandler.upgradeElement(this);
    });
    $menu.find('.mdl-accordion__content').each(function(){
      var $content = $(this);
      $content.css('margin-top', -$content.outerHeight());
    });
    $menu.on('click', '.mdl-accordion__button', function () {
      $(this).parent('.mdl-accordion').toggleClass('mdl-accordion--opened');
    });

    // Hang on to the permalink
    app.$permalink = $('.permalink');

    // Close menu after selecting an anchor item
    $menu.on('click', 'a:not(.keep-open)', app.menu.toggle);

    // Effectively extend the touch zone for checkboxes to the entire item
    $menu.on('click', '.item-checkbox', function (event) {
      if (this == event.target) {
        $(this).find('input').click();
      }
    });

    // Update config when inputs change
    $menu.on('change', 'input[type=checkbox][data-id]', function () {
      var $this = $(this)
        , prop = $this.data('id');

      config.toggle(prop, $this.checked, 'menu');
    }).on('change input', 'input[type=range][data-id]', function (event) {
      var $this = $(this)
        , prop = $this.data('id');

      if (event.type == 'change' || $this.data('realtime')) {
        config.set(prop, 1*this.value, 'menu');
      }
    });

    // Update checkboxes when config changes
    $menu.find('.mdl-checkbox').each(function () {
      var that = this
        , prop = $(this).find('input').data('id');

      config.on_change(prop, function (value, prop, initiator) {
        if (initiator != 'menu') {
          if (value) {
            that.MaterialCheckbox.check();
          } else {
            that.MaterialCheckbox.uncheck();
          }
        }
      });
    });

    // Update sliders when config changes
    $menu.find('.mdl-slider').each(function () {
      config.on_change(
        $(this).data('id'),
        _.bind(this.MaterialSlider.change, this.MaterialSlider)
      );
    });
  };

  return Menu;

});
