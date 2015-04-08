(function (root, factory) {
   'use strict';

  if (typeof define === 'function') {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.fxpay = factory();
  }
}(this, function () {
