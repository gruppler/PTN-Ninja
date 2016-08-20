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

  Menu.toggle = function () {
    $menu_button.click();
  };

  $menu_button.focus(function () {
    $menu_button.blur();
  });

  Menu.content = [{
    id: 'global',
    items: [{
      label: t.Permalink,
      icon: 'link',
      class: 'permalink',
      href: '#'+app.ptn_compressed,
      target: '_blank',
      rel: 'noopener'
    },{
      label: t.Download,
      icon: 'file_download',
      id: 'download'
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
    },{
      label: t.About_App,
      icon: 'code',
      href: 'readme.md',
      target: '_blank',
      rel: 'noopener'
    }]
  },{
    id: 'play',
    items: [{
      label: t.Play_Mode,
      icon: 'play_arrow',
      onclick: 'app.toggle_edit_mode()',
      class: 'mode keep-open'
    },{
      label: t.Highlight_Squares,
      type: 'switch',
      checked: config.playmode_square_hl,
      'data-id': 'playmode_square_hl'
    },{
      label: t.Show_Annotations,
      type: 'switch',
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
    id: 'edit',
    items: [{
      label: t.Edit_Mode,
      icon: 'mode_edit',
      onclick: 'app.toggle_edit_mode()',
      class: 'mode keep-open'
    },{
      label: t.Highlight_Squares,
      type: 'switch',
      checked: config.editmode_square_hl,
      'data-id': 'editmode_square_hl'
    },{
      label: t.Show_Parse_Errors,
      type: 'switch',
      checked: config.show_parse_errors,
      'data-id': 'show_parse_errors'
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
  }];

  Menu.tpl = {

    item: function (obj) {
      if ('items' in obj) {
        return app.menu.tpl.section(obj);
      } else if ('href' in obj || 'onclick' in obj) {
        return app.menu.tpl.anchor(obj);
      } else if ('type' in obj) {
        return app.menu.tpl[obj.type](obj);
      }
    },

    menu: function (obj) {
      return '<span class="mdl-layout-title">'+t.app_title+'</span>'
        + _.map(obj.content, app.menu.tpl.section).join('');
    },

    section: _.template(
      '<span class="menu-<%=obj.id%> mdl-menu__item--full-bleed-divider"></span>'+
      '<nav class="menu-<%=obj.id%> mdl-navigation">'+
        '<ul class="mdl-list">'+
          '<%= _.map(items, app.menu.tpl.item).join("") %>'+
        '</ul>'+
      '</nav>'
    ),

    anchor: _.template(
      '<a'+
        '<% _.each(_.omit(obj, ["label", "icon"]), function(value, key) { %>'+
          ' <%=key%>="<%=value%>"'+
        '<% }) %>'+
      '>'+
        '<li class="mdl-navigation__link">'+
            '<i class="material-icons"><%=obj.icon%></i>'+
            '<%=obj.label%>'+
        '</li>'+
      '</a>'
    ),

    switch: _.template(
      '<li class="mdl-navigation__link item-switch">'+
        '<label class="mdl-switch mdl-js-switch">'+
          '<input type="checkbox" class="mdl-switch__input"'+
            '<% _.each(_.omit(obj, ["label", "type"]), function(value, key) { %>'+
              '<% if (_.isBoolean(value)) { %>'+
                ' <%= value ? key : "" %>'+
              '<% } else { %>'+
                ' <%=key%>="<%=value%>"'+
              '<% } %>'+
            '<% }) %>'+
            '>'+
          '<span class="mdl-checkbox__label"><%=obj.label%></span>'+
        '</label>'+
      '</li>'
    ),

    slider: _.template(
      '<li class="mdl-navigation__link item-slider">'+
        '<span class="mdl-slider__label"><%=obj.label%></span>'+
        '<input class="mdl-slider mdl-js-slider" type="range"'+
          '<% _.each(_.omit(obj, ["label", "type"]), function(value, key) { %>'+
            '<% if (_.isBoolean(value)) { %>'+
              ' <%= value ? key : "" %>'+
            '<% } else { %>'+
              ' <%=key%>="<%=value%>"'+
            '<% } %>'+
          '<% }) %>'+
        '>'+
      '</li>'
    ),

    file: _.template(
      '<li class="mdl-navigation__link item-file">'+
        '<i class="material-icons"><%=obj.icon%></i>'+
        '<%=obj.label%>'+
        '<input class="invisible-file-input"'+
          '<% _.each(_.omit(obj, ["label", "icon"]), function(value, key) { %>'+
            '<% if (_.isBoolean(value)) { %>'+
              ' <%= value ? key : "" %>'+
            '<% } else { %>'+
              ' <%=key%>="<%=value%>"'+
            '<% } %>'+
          '<% }) %>'+
        '>'+
      '</li>'
    )
  };

  Menu.render = function () {
    $menu.html(this.tpl.menu(this));

    // Initialize widgets
    $menu.find('.mdl-switch, .mdl-slider').each(function () {
      componentHandler.upgradeElement(this);
    });

    // Include menu permalink in permalink updates
    app.$permalink = $('.permalink');

    // Close menu after selecting an anchor item
    $menu.on('click', 'a:not(.keep-open)', app.menu.toggle);

    // Effectively extend the touch zone for switches to the entire item
    $menu.on('click', 'li:has(.mdl-switch)', function (event) {
      if (this == event.target) {
        $(this).find('input').click();
      }
    });

    // Update config when inputs change
    $menu.on('change', '[data-id]', function () {
      var $this = $(this)
        , prop = $this.data('id')
        , value = config[prop];

      if (_.isBoolean(value)) {
        config.toggle(prop, this.checked, 'menu');
      } else if (_.isNumber(value)) {
        config.set(prop, 1*this.value, 'menu');
      }
    });

    // Update switches when config changes
    $menu.find('.mdl-switch').each(function () {
      var that = this
        , prop = $(this).find('input').data('id');

      config.on_change(prop, function (value, prop, initiator) {
        if (initiator != 'menu') {
          if (value) {
            that.MaterialSwitch.on();
          } else {
            that.MaterialSwitch.off();
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
