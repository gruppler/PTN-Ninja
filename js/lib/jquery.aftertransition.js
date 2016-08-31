'use strict';

define(['jquery'], function($){

  // Schedule callback for one-time execution after CSS transition ends,
  // or execute existing callbacks
  $.fn.afterTransition = function (callback) {
    var $this = $(this);

    if (_.isFunction(callback)) {
      $this.one('transitionend', function (event) {
        callback.call($this, event);
      });
    } else if (_.isUndefined(callback)) {
      $this.trigger('transitionend');
    }

    return this;
  }

  // Add "animated" class and remove it after transition
  // and execute optional callback
  $.fn.transition = function (callback) {
    var $this = $(this);

    $this.afterTransition().addClass('animated');
    $this.afterTransition(function () {
      $this.removeClass('animated');
      if (_.isFunction(callback)) {
        callback.call($this);
      }
    });

    return this;
  };

});
