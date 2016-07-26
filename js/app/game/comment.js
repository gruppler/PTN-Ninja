// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['app/grammar', 'i18n!nls/main', 'lodash'], function (r, t, _) {

  var Comment = function (string) {
    var parts = string.match(r.grammar.comment_grouped);

    if (!parts) {
      this.prefix = string;
      this.text = '';
      this.suffix = '';
      return this;
    }

    this.prefix = parts[1];
    this.text = parts[2];
    this.suffix = parts[3];

    return this;
  };

  Comment.prototype.print = _.template(
    '<span class="comment">'+
      '<%=this.prefix%>'+
      '<span class="text"><%=this.text%></span>'+
      '<%=this.suffix%>'+
    '</span>'
  );

  Comment.prototype.print_text = function () {
    return this.prefix + this.text + this.suffix;
  };

  Comment.parse = function(string) {
    var comments = _.map(
      string.match(r.grammar.comment_text),
      function (comment) {
        return new Comment(comment);
      }
    );

    return comments.length ? comments : null;
  };

  return Comment;

});
