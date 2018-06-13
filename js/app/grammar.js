// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['lodash'], function (_) {

  var required_tags = {
    'size': /^([3-9])$/
  };

  var other_tags = {
    'player1': /^(.*)$/,
    'player2': /^(.*)$/,
    'date': /^(\d\d\d\d)\.(\d\d?)\.(\d\d?)$/,
    'result': /^(R-0|0-R|F-0|0-F|1-0|0-1|1\/2-1\/2|)$/,
    'event': /^.*$/,
    'site': /^.*$/,
    'round': /^\d+$/,
    'rating1': /^\d+$/,
    'rating2': /^\d+$/,
    'tps': /^[1-9xSC\/,]+\s+[1,2]\s+\d+$/,
    'points': /^\d+$/,
    'time': /^\d\d(:\d\d){1,2}$/,
    'clock': /^\d+min(\+\d+sec)$|^((((\d\s+)?\d\d?:)?\d\d?:)?\d\d?\s*)?(\+(((\d\s+)?\d\d?:)?\d\d?:)?\d\d?)?$/
  };

  var grammar = {
    space: '(?:x[1-9]?)',
    stack: '(?:[12]+[SC]?)',
    stack_grouped: '([12]*)([12][SC]?)',
    separator: '[,\\/]',
    col: '(?:<space>|<stack>)',
    cols: '(<col>?<separator>?)',
    col_grouped: '(<space>?)(<stack>?)(<separator>?)',
    tps_grouped: '((?:<col>|<separator>)*)(?:(\\s+)([12]))?(?:(\\s+)([1-9]\\d*))?([^]*)',

    tag: '(?:[^\\[]*\\[.*\\]?)',
    tag_grouped: '([^\\[]*\\[\\s*?)(\\S+)(\\s*)([\'"]?)([^\\4]*)(\\4)([^]*\\]?)',

    stone: '[FSC]?',
    square: '[a-i][1-9]',
    count: '[1-9]?',
    direction: '(?:[-+<>])',
    drops: '[1-9]*',
    place: '(?:<stone><square>)',
    place_grouped: '(<stone>)(<square>)',
    slide: '(?:<count><square><direction><drops><stone>)',
    slide_grouped: '(<count>)(<square>)(<direction>)(<drops>)(<stone>)',
    comment: '(?:\\s*?\\{[^}]*\\}?)*',
    comment_text: '\\s*\\{\\s*[^}]*[^}\\s]?\\s*\\}?',
    comment_grouped: '(\\s*\\{\\s*)([^}]*[^}\\s])?(\\s*\\}?)',
    result: '(?:(?:\\s|--)*(?:R-0|0-R|F-0|0-F|1-0|0-1|1\\/2-1\\/2))',
    result_grouped: '((?:\\s|--)*)(R-0|0-R|F-0|0-F|1-0|0-1|1\\/2-1\\/2)',
    evaluation: '[?!\'"]*',
    nop: '(?:\\s*(?:load|--|\\.\\.\\.))',
    nop_grouped: '(\\s*)(\\S+)',
    ply: '(?:\\s*(?:<slide>|<place>)<evaluation>)',
    ply_grouped: '(\\s*)(?:(<slide>)|(<place>))(<evaluation>)',
    linenum: '(?:^|\\s)+(?:\\d+(?:-\\d*)?\\.+)+',
    linenum_grouped: '(^|\\s+)((?:\\d+(?:-\\d*)?\\.+)+)',
    move: '(?:<linenum><comment>(?:<nop>|<ply>)?<comment><ply>?<comment><result>?<comment>[ \\t]*[^]*)',
    move_grouped: '^(<linenum>)(<comment>)(<nop>|<ply>?)(<comment>)(<ply>?)(<comment>)(<result>?)(<comment>)(\\s*)([^]*)',
    move_only: '^<move>$',

    ptn_grouped: '^(<tag>+)(<comment>)((?:.|\\s)*?)((?:\\s|--)*)$'
  };

  var tokens = (new RegExp('<'+_.keys(grammar).join('>|<')+'>', 'g'))
    , get_token = function (token) {
        return grammar[_.trim(token, '<>')];
      };

  _.each(grammar, function (expression, token) {
    grammar[token] = expression.replace(tokens, get_token);
  });
  _.each(grammar, function (expression, token) {
    grammar[token] = new RegExp(
      expression,
      /_grouped|_only/.test(token) ? '' : 'g'
    );
  });

  return {
    tags: _.merge({}, required_tags, other_tags),
    required_tags: _.keys(required_tags),
    other_tags: _.keys(other_tags),
    grammar: grammar
  };

});
