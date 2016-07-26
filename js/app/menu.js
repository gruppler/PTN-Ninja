// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'app/config',
  'i18n!nls/main',
  'lodash',
  'jquery',
  'slideout',
  'domReady!'
], function (config, t, _, $, Slideout) {

  var $panel = $('#app')
    , $menu = $('#menu')
    , $menu_button = $('#menu-button');

  var Menu = new Slideout({
    'panel': $panel[0],
    'menu': $menu[0],
    'padding': 256,
    'tolerance': 70
  });

  Menu.content = {

    items: [{
      title: t.About_App,
      href: 'https://github.com/gruppler/PTN-Ninja/blob/master/readme.md',
      target: '_blank',
      rel: 'noopener'
    },{
      title: t.Open,
      onclick: 'app.$open.click()'
    },{
      title: t.Load_sample_game,
      onclick: 'app.game.parse(app.sample_ptn, true)'
    }],

    sections: [{
      title: t.Edit_Mode,
      items: [{
        title: t.Trim_to_current_ply,
        onclick: 'app.board.trim_to_current_ply()'
      }]
    }],

  };

  Menu.tpl = {
    item: _.template(
      '<li>'+
        '<a '+
          '<% _.each(obj, function(value, key) { %>'+
            ' <%=key%>="<%=value%>"'+
          '<% }) %>'+
        '>'+
          '<%=obj.title%>'+
        '</a>'+
      '</li>'
    ),

    section: _.template(
      '<li>'+
        '<h3><%=obj.title%></h3>'+
        '<ul>'+
          '<%= _.map(obj.items, app.menu.tpl.item).join("") %>'+
          '<%= _.map(obj.sections, app.menu.tpl.section).join("") %>'+
        '</ul>'+
      '</li>'
    ),

    menu: _.template(
      '<ul>'+
        '<%= _.map(items, app.menu.tpl.item).join("") %>'+
        '<%= _.map(sections, app.menu.tpl.section).join("") %>'+
      '</ul>'
    )
  };

  Menu.render = function () {
    $menu.html(this.tpl.menu(this.content));
  };

  $menu_button.click('click', function() {
    Menu.toggle();
  });
	Menu.enableTouch();

	Menu.on('open', function () {
		app.board.pause();
	});

  return Menu;

});
