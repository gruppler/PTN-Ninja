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
    , $menu_button = $('.mdl-layout__drawer-button');

  var Menu = {};

  Menu.toggle = function () {
    $menu_button.click();
  };

  Menu.content = [{
    id: 'play',
    items: [{
      title: t.Play_Mode,
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
      min: 30,
      max: 200,
      step: 10,
      value: config.play_speed,
      'data-id': 'play_speed'
    }]
  },{
    id: 'edit',
    items: [{
      title: t.Edit_Mode,
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
      title: t.Undo,
      icon: 'undo',
      onclick: 'app.undo()',
      class: 'keep-open'
    },{
      title: t.Redo,
      icon: 'redo',
      onclick: 'app.redo()',
      class: 'keep-open'
    },{
      title: t.Trim_to_current_ply,
      icon: 'content_cut',
      onclick: 'app.board.trim_to_current_ply()'
    }]
  },{
    id: 'global',
    items: [{
      title: t.Permalink,
      icon: 'link',
      class: 'permalink',
      href: '#'+app.ptn_compressed,
      target: '_blank',
      rel: 'noopener'
    },{
      title: t.Download,
      icon: 'file_download',
      onclick: 'app.$download.click()'
    },{
      title: t.Open,
      icon: 'folder_open',
      onclick: 'app.$open.click()'
    },{
      title: t.Load_sample_game,
      icon: 'apps',
      onclick: 'app.game.parse(app.sample_ptn, true)'
    },{
      title: t.About_App,
      icon: 'code',
      href: 'readme.md',
      target: '_blank',
      rel: 'noopener'
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
      return '<span class="mdl-layout-title">'+t.App_Title+'</span>'
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
        '<% _.each(_.omit(obj, ["title", "icon"]), function(value, key) { %>'+
          ' <%=key%>="<%=value%>"'+
        '<% }) %>'+
      '>'+
        '<li class="mdl-navigation__link">'+
            '<i class="material-icons"><%=obj.icon%></i>'+
            '<%=obj.title%>'+
        '</li>'+
      '</a>'
    ),

    switch: _.template(
      '<li class="mdl-navigation__link">'+
        '<label class="mdl-switch mdl-js-switch">'+
          '<input type="checkbox" class="mdl-switch__input"'+
            '<%= obj.checked ? " checked" : "" %>'+
            '<% _.each(_.omit(obj, ["label", "type", "checked"]), function(value, key) { %>'+
              ' <%=key%>="<%=value%>"'+
            '<% }) %>'+
            '>'+
          '<span class="mdl-checkbox__label"><%=obj.label%></span>'+
        '</label>'+
      '</li>'
    ),

    slider: _.template(
      '<li class="mdl-navigation__link">'+
        '<%=obj.label%>'+
        '<input class="mdl-slider mdl-js-slider" type="range"'+
          '<% _.each(_.omit(obj, ["label", "type"]), function(value, key) { %>'+
            ' <%=key%>="<%=value%>"'+
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
        , val = config[prop];

      if (_.isBoolean(val)) {
        config.toggle(prop, this.checked, 'menu');
      } else if (_.isNumber(val)) {
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
