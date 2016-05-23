'use strict';

define(['jquery', 'lodash'], function ($, _) {
  var Messages, $messages;

  var template = _.template(
    '<div class="<%=type%> <%=group||""%>">\
      <i class="icon-<%=type%>"></i><%=message%>\
      <i class="icon-x"></i>\
    </div>'
  );

  Messages = function(group) {
    this.group = group || 'general';
  };

  Messages.prototype.add = function (message, seconds, group, type) {
    var $message = $(template({
      type: type,
      group: group ? group : this.group,
      message: message
    }));
    $messages.append($message);
    if (seconds) {
      setTimeout(_.bind($message.remove, $message), seconds*1000);
    }
  };

  Messages.prototype.clear = function (type, group) {
    $messages.children('.'+(group || this.group)+(type ? '.'+type : '')).remove();
  };

  Messages.prototype.clear_all = function (type) {
    $messages.children(type ? '.'+type : '').remove();
  };

  Messages.prototype.success = function (message, seconds, group) {
    this.add(message, seconds, group, 'success');
  };

  Messages.prototype.warning = function (message, seconds, group) {
    this.add(message, seconds, group, 'warning');
  };

  Messages.prototype.error = function (message, seconds, group) {
    this.add(message, seconds, group, 'error');
  };

  Messages.prototype.help = function (message, seconds, group) {
    this.add(message, seconds, group, 'help');
  };

  Messages.prototype.info = function (message, seconds, group) {
    this.add(message, seconds, group, 'info');
  };


  function remove_message() {
    $(this).closest('div').remove();
  }

  $(function () {
    $messages = $('#messages');
    $messages.on('click', 'i.icon-x', remove_message);
  });

  return Messages;

});
