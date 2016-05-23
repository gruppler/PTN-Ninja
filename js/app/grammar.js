'use strict';

define(['lodash'], function (_) {

  var required_tags = {
    'player1': /^(.*)$/,
    'player2': /^(.*)$/,
    'date': /^(\d\d\d\d)\.(\d\d?)\.(\d\d?)$/,
    'size': /^([3-9])$/,
    'result': /^(R-0|0-R|F-0|0-F|1\/2-1\/2)$/
  };

  var other_tags = {
    'event': /^(.*)$/,
    'site': /^(.*)$/,
    'time': /^(\d\d):(\d\d):(\d\d)$/,
    'round': /^(\d+)$/,
    'rating1': /^(\d+)$/,
    'rating2': /^(\d+)$/,
    'tps': /^[1-9xSC\/,]+\s+[1,2]\s+\d+$/,
    'points': /^(\d+)$/,
    'clock': /^(\d+min(?:\+\d+sec))$/
  };

  var grammar = {
    col: '(?:x[1-9]?|[12]+[SC]?)',
    row: '(?:<col>(?:,<col>){2,8})',
    tps: '^<row>(?:\\/<row>){2,8}\\s+[12]\\s+\\d+$',

    tag: '(?:\\s*\\[[^\\]]+\\])',
    tag_grouped: '(\\s*\\[\\s*)(\\S+)(\\s+\\")([^"]+)(\\"\\s*\\])',
    header: '^<tag>+$',

    stone: '[FSC]?',
    square: '[a-i][1-9]',
    count: '[1-9]?',
    direction: '(?:\\+|-|<|>)',
    drops: '[1-9]*',
    place: '(?:<stone><square>)',
    place_grouped: '(<stone>)(<square>)',
    slide: '(?:<count><square><direction><drops><stone>)',
    slide_grouped: '(<count>)(<square>)(<direction>)(<drops>)(<stone>)',
    comment: '(?:\\s*\\{[^}]*\\})*',
    comment_text: '\\s*\\{\\s*[^}]*[^}\\s]?\\s*\\}',
    comment_grouped: '(\\s*\\{\\s*)([^}]*[^}\\s])?(\\s*\\})',
    result: '(?:\\s*(?:R-0|0-R|F-0|0-F|1\\/2-1\\/2))',
    result_grouped: '(\\s*)(R-0|0-R|F-0|0-F|1\\/2-1\\/2)',
    evaluation: '[?!\']*',
    move: '(?:\\s*(?:<slide>|<place>)<evaluation>)',
    move_grouped: '(\\s*)(?:(<slide>)|(<place>))(<evaluation>)',
    linenum: '\\s*\\d+\\.',
    linenum_grouped: '(\\s*)(\\d+\\.)',
    turn: '(?:<comment><linenum><comment><move><comment><move>?<comment><result>?<comment>\\s*)',
    turn_grouped: '(<comment>)(<linenum>)(<comment>)(<move>)(<comment>)(<move>?)(<comment>)(<result>?)(<comment>)(\\s*)',

    body: '^<turn>*$',
    ptn_grouped: '^(<tag>+)(\\s*)((?:.+\\s*)*)$'
  };

  var tokens = (new RegExp('<'+_.keys(grammar).join('>|<')+'>', 'g'));
  _.each(grammar, function (expression, token) {
    grammar[token] = expression.replace(tokens, function (token) {
      return grammar[_.trim(token, '<>')];
    });
  });
  _.each(grammar, function (expression, token) {
    grammar[token] = new RegExp(expression, /_grouped$/.test(token) ? '' : 'g');
  });

  console.log(grammar);

  return {
    tags: _.merge({}, required_tags, other_tags),
    required_tags: _.keys(required_tags),
    other_tags: _.keys(other_tags),
    grammar: grammar
  };

});
