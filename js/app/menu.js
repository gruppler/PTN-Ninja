// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define([
  'i18n!nls/main',
  'lodash',
  'jquery',
  'slideout',
  'domReady!'
], function (t, _, $, Slideout) {

  var $panel = $('#app')
    , $menu = $('#menu')
    , $menu_button = $('#menu-button');

  var Menu = new Slideout({
    'panel': $panel[0],
    'menu': $menu[0],
    'padding': 256,
    'tolerance': 70
  });

  $menu_button.click('click', function() {
    Menu.toggle();
  });
	Menu.enableTouch();

	Menu.on('open', function () {
		app.board.pause();
	});

  return Menu;

});
