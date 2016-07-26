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
          '<i class="icon-<%=icon%>"></i><%=message%>'+
          '<i class="icon-x"></i>'+
        '</div>'+
      '</div>'
    ),

    group: _.template('<div class="messages-<%=group%>">')
  };

  $messages = $('#messages');
  $messages
    .on('click', 'i.icon-x', remove_message)
    .on('remove', remove_message);

  Messages = function(group, is_visible) {
    this.enabled = true;
    this.group = group || 'general';
    this.$messages = $messages.children('.messages-'+group);
    if (!this.$messages.length) {
      this.$messages = $(tpl.group({group: group})).appendTo($messages);
    }

    if (is_visible) {
      this.$messages.addClass('visible');
    }

    return this;
  };

  Messages.prototype.add = function (message, seconds, group, type, icon) {
    var $message = $(tpl.message({
      type: type,
      icon: icon || type,
      group: group || this.group,
      message: message || '&nbsp;'
    }));
    $message.addClass('animating');
    this.$messages.append($message);
    $message.height();
    $message.removeClass('animating');

    app.$window.trigger(type+':'+(group || this.group));
    app.$window.trigger(type);

    if (seconds) {
      setTimeout(_.bind(remove_message, $message), seconds*1000);
    }

    return $message;
  };

  Messages.prototype.clear = function (type, animate) {
    var $messages = this.$messages.children(type ? '.'+type : '');

    if (animate) {
      $messages.map(remove_message);
    } else{
      $messages.remove();
    }

    app.$window.trigger('clear:'+(type ? type+':' : '')+this.group);
  };

  Messages.prototype.clear_all = function (type) {
    $messages.find('.message'+(type ? '.'+type : '')).remove();
    app.$window.trigger('clear' + (type ? ':'+type : ''));
  };

  Messages.prototype.success = function (message, seconds, group) {
    return this.add(message, seconds, group, 'success');
  };

  Messages.prototype.warning = function (message, seconds, group) {
    return this.add(message, seconds, group, 'warning');
  };

  Messages.prototype.error = function (message, seconds, group) {
    return this.add(message, seconds, group, 'error');
  };

  Messages.prototype.help = function (message, seconds, group) {
    return this.add(message, seconds, group, 'help');
  };

  Messages.prototype.info = function (message, seconds, group) {
    return this.add(message, seconds, group, 'info');
  };

  Messages.prototype.comment = function (message, seconds, group) {
    return this.add(message, seconds, group, 'comment');
  };

  Messages.prototype.player1 = function (message, seconds, group) {
    return this.add(message, seconds, group, 'player1', 'player');
  };

  Messages.prototype.player2 = function (message, seconds, group) {
    return this.add(message, seconds, group, 'player2', 'player');
  };

  function remove_message() {
    var $message = $(this);
    if (!$message.hasClass('message')) {
      $message = $message.closest('.message');
    }
    if ($message.hasClass('animating')) {
      $message.remove();
    } else {
      $message.afterTransition(function () {
        $message.remove();
      }).addClass('animating');
    }
  }

  return Messages;

});
