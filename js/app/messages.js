// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['jquery', 'lodash', 'domReady!'], function ($, _) {
  var Messages, $messages;

  var tpl = {
    message: _.template(
      '<div class="message <%=type%>">'+
        '<div class="content">'+
          '<i class="material-icons"><%=icon%></i><%=message%>'+
          '<i class="material-icons close">close</i>'+
        '</div>'+
      '</div>'
    ),

    group: _.template('<div class="messages-<%=group%>">')
  };

  $messages = $('#messages');
  $messages
    .on('click', 'i.close', remove_message)
    .on('remove', remove_message);

  Messages = function(group) {
    this.enabled = true;
    this.group = group || 'general';
    this.$messages = $messages.children('.messages-'+group);
    if (!this.$messages.length) {
      this.$messages = $(tpl.group({group: group})).appendTo($messages);
    }

    return this;
  };

  Messages.prototype.add = function (message, seconds, group, type, icon, prepend) {
    var $message = $(tpl.message({
      type: type,
      icon: icon || type,
      group: group || this.group,
      message: message || '&nbsp;'
    }));
    this.$messages[prepend ? 'prepend' : 'append']($message);

    app.$window.trigger(type+':'+(group || this.group));
    app.$window.trigger(type);

    if (seconds) {
      setTimeout(_.bind(remove_message, $message), seconds*1000);
    }

    return $message;
  };

  Messages.prototype.clear = function (type) {
    var $messages = this.$messages.children(type ? '.'+type : '');

    if ($messages.length) {
      $messages.remove();
      app.$window.trigger('clear:'+(type ? type+':' : '')+this.group);

      return true;
    }

    return false;
  };

  Messages.prototype.clear_all = function (type) {
    $messages.find('.message'+(type ? '.'+type : '')).remove();
    app.$window.trigger('clear' + (type ? ':'+type : ''));
  };

  Messages.prototype.success = function (message, seconds, group) {
    return this.add(message, seconds, group, 'success', 'check_circle', true);
  };

  Messages.prototype.warning = function (message, seconds, group) {
    return this.add(message, seconds, group, 'warning', false, true);
  };

  Messages.prototype.error = function (message, seconds, group) {
    return this.add(message, seconds, group, 'error');
  };

  Messages.prototype.help = function (message, seconds, group) {
    return this.add(message, seconds, group, 'help', false, true);
  };

  Messages.prototype.info = function (message, seconds, group) {
    return this.add(message, seconds, group, 'info', false, true);
  };

  Messages.prototype.comment = function (message, seconds, group) {
    return this.add(message, seconds, group, 'comment', 'mode_comment');
  };

  Messages.prototype.player1 = function (message, seconds, group) {
    return this.add(message, seconds, group, 'player1', 'person');
  };

  Messages.prototype.player2 = function (message, seconds, group) {
    return this.add(message, seconds, group, 'player2', 'person');
  };

  function remove_message() {
    var $message = $(this);
    if (!$message.hasClass('message')) {
      $message = $message.closest('.message');
    }
    $message.remove();
  }

  return Messages;

});
