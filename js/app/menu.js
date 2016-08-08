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
    id: 'global',
    title: t.App_Title,
    items: [{
      title: t.About_App,
      href: 'readme.md',
      target: '_blank',
      rel: 'noopener'
    },{
      title: t.Open,
      onclick: 'app.$open.click()'
    },{
      title: t.Load_sample_game,
      onclick: 'app.game.parse(app.sample_ptn, true)'
    }]
  },{
    id: 'play',
    title: t.Play_Mode,
    items: [{
      label: t.Play_Speed,
      type: 'slider',
      min: 1,
      max: 100,
      value: config.play_speed
    },{
      label: t.Show_Parse_Errors,
      type: 'switch',
      checked: config.show_parse_errors,
      'data-id': 'show_parse_errors'
    },{
      label: t.Show_Annotations,
      type: 'switch',
      checked: config.show_annotations,
      'data-id': 'show_annotations'
    }]
  },{
    id: 'edit',
    title: t.Edit_Mode,
    items: [{
      title: t.Undo,
      onclick: 'app.undo()'
    },{
      title: t.Redo,
      onclick: 'app.redo()'
    },{
      title: t.Trim_to_current_ply,
      onclick: 'app.board.trim_to_current_ply()'
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

    section: _.template(
      '<span class="mdl-layout-title"><%=obj.title%></span>'+
      '<nav id="menu-<%=obj.id%>" class="mdl-navigation">'+
        '<%= _.map(items, app.menu.tpl.item).join("") %>'+
      '</nav>'
    ),

    anchor: _.template(
      '<a class="mdl-navigation__link mdl-js-ripple-effect"'+
        '<% _.each(obj, function(value, key) { %>'+
          ' <%=key%>="<%=value%>"'+
        '<% }) %>'+
      '>'+
        '<%=obj.title%>'+
      '</a>'
    ),

    switch: _.template(
      '<p class="mdl-navigation__link">'+
        '<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">'+
          '<input type="checkbox" class="mdl-switch__input"'+
            '<%= obj.checked ? " checked" : "" %>'+
          '>'+
          '<span class="mdl-switch__label"><%=obj.label%></span>'+
        '</label>'+
      '</p>'
    ),

    slider: _.template(
      '<p class="mdl-navigation__link">'+
        '<span class="mdl-slider__label"><%=obj.label%></span>'+
        '<input class="mdl-slider mdl-js-slider" type="range">'+
      '</p>'
    )
  };

  Menu.render = function () {
    $menu.html(_.map(this.content, this.tpl.section));
    $menu.find('.mdl-switch, .mdl-slider').each(function () {
      componentHandler.upgradeElement(this);
    });
  };

  return Menu;

});
