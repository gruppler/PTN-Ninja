/* A polyfill for browsers that don't support ligatures. */
/* The script tag referring to this file must be placed before the ending body tag. */

/* To provide support for elements dynamically added, this script adds
   method 'icomoonLiga' to the window object. You can pass element references to this method.
*/
(function () {
    'use strict';
    function supportsProperty(p) {
        var prefixes = ['Webkit', 'Moz', 'O', 'ms'],
            i,
            div = document.createElement('div'),
            ret = p in div.style;
        if (!ret) {
            p = p.charAt(0).toUpperCase() + p.substr(1);
            for (i = 0; i < prefixes.length; i += 1) {
                ret = prefixes[i] + p in div.style;
                if (ret) {
                    break;
                }
            }
        }
        return ret;
    }
    var icons;
    if (!supportsProperty('fontFeatureSettings')) {
        icons = {
            'move': '&#xe900;',
            'menu': '&#xe5d2;',
            'preferences': '&#xe429;',
            'open': '&#xe2c8;',
            'download': '&#xe2c0;',
            'time': '&#xe8b5;',
            'player': '&#xe853;',
            'add': '&#xe145;',
            'grid-solid': '&#xe5c3;',
            'points': '&#xe6dd;',
            'cancel': '&#xe5c9;',
            'comment': '&#xe0ca;',
            'check': '&#xe5ca;',
            'success': '&#xe86c;',
            'ex': '&#xe5cd;',
            'edit': '&#xe254;',
            'drag_handle': '&#xe25d;',
            'error': '&#xe000;',
            'date': '&#xe24f;',
            'event': '&#xe616;',
            'first': '&#xe5dc;',
            'fullscreen': '&#xe5d0;',
            'fullscreen-exit': '&#xe5d1;',
            'result': '&#xe90e;',
            'star-solid': '&#xe838;',
            'grid-line': '&#xe3ec;',
            'help': '&#xe887;',
            'info': '&#xe88e;',
            'link': '&#xe157;',
            'down': '&#xe313;',
            'left': '&#xe314;',
            'right': '&#xe315;',
            'up': '&#xe316;',
            'last': '&#xe5dd;',
            'circle': '&#xe3fa;',
            'pause': '&#xe034;',
            'player-line': '&#xe7ff;',
            'player-solid': '&#xe7fd;',
            'play': '&#xe037;',
            'site': '&#xe80b;',
            'remove': '&#xe15b;',
            'warning': '&#xe002;',
            'settings': '&#xe8b8;',
            'share': '&#xe80d;',
            'star-line': '&#xe83a;',
            'star': '&#xe8d0;',
            'thumb_down': '&#xe8db;',
            'thumb_up': '&#xe8dc;',
            'timer': '&#xe425;',
            'round': '&#xe923;',
          '0': 0
        };
        delete icons['0'];
        window.icomoonLiga = function (els) {
            var classes,
                el,
                i,
                innerHTML,
                key;
            els = els || document.getElementsByTagName('*');
            if (!els.length) {
                els = [els];
            }
            for (i = 0; ; i += 1) {
                el = els[i];
                if (!el) {
                    break;
                }
                classes = el.className;
                if (/icomoon-liga/.test(classes)) {
                    innerHTML = el.innerHTML;
                    if (innerHTML && innerHTML.length > 1) {
                        for (key in icons) {
                            if (icons.hasOwnProperty(key)) {
                                innerHTML = innerHTML.replace(new RegExp(key, 'g'), icons[key]);
                            }
                        }
                        el.innerHTML = innerHTML;
                    }
                }
            }
        };
        window.icomoonLiga();
    }
}());
