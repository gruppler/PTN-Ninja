'use strict';

define(['jquery'], function ($) {
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

  Messages.prototype.add = function (message, group, type) {
    $messages.append(
      template({
        type: type,
        group: group ? group : this.group,
        message: message
      })
    );
  };

  Messages.prototype.clear = function (type) {
    $messages.children('.'+this.group+(type ? '.'+type : '')).remove();
  };

  Messages.prototype.clear_all = function (type) {
    $messages.children(type ? '.'+type : '').remove();
  };

  Messages.prototype.success = function (message, group) {
    this.add(message, group, 'success');
  };

  Messages.prototype.warning = function (message, group) {
    this.add(message, group, 'warning');
  };

  Messages.prototype.error = function (message, group) {
    this.add(message, group, 'error');
  };

  Messages.prototype.help = function (message, group) {
    this.add(message, group, 'help');
  };

  Messages.prototype.info = function (message, group) {
    this.add(message, group, 'info');
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
