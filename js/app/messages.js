'use strict';

define(['jquery', 'lodash'], function ($, _) {
  var Messages, $messages;

  var $window = $(window)
    , $body = $('body');

  var template = _.template(
    '<div class="message <%=type%>">'+
      '<div class="content">'+
        '<i class="icon-<%=type%>"></i><%=message%>'+
        '<i class="icon-x"></i>'+
      '</div>'+
    '</div>'
  );

  Messages = function(group) {
    this.enabled = true;
    this.group = group || 'general';
    this.$messages = $('<div class="messages-'+group+'">').appendTo($messages);

    return this;
  };

  Messages.prototype.add = function (message, seconds, group, type) {
    var $message = $(template({
      type: type,
      group: group || this.group,
      message: message
    }));
    this.$messages.append($message);
    $message.grow();

    $window.trigger(type+':'+(group || this.group));
    $window.trigger(type);

    if (seconds) {
      setTimeout(_.bind(remove_message, $message), seconds*1000);
    }

    return $message;
  };

  Messages.prototype.clear = function (type) {
    this.$messages.children(type ? '.'+type : '').remove();
    $window.trigger('clear:'+(type ? type+':' : '')+this.group);
  };

  Messages.prototype.clear_all = function (type) {
    $messages.find('.message'+(type ? '.'+type : '')).remove();
    $window.trigger('clear' + (type ? ':'+type : ''));
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

  function remove_message() {
    var $message = $(this);
    if (!$message.hasClass('message')) {
      $message = $message.closest('.message');
    }
    $message.shrink(function () {
      this.remove();
    });
  }

  $(function () {
    $messages = $('#messages');
    $messages
      .on('click', 'i.icon-x', remove_message)
      .on('remove', remove_message);
  });

  return Messages;

});
