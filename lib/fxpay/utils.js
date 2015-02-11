(function() {
  'use strict';

  var exports = fxpay.utils = {};

  exports.defaults = function(object, defaults) {
    object = object || {};
    // Similar to _.defaults except this takes only a single defaults object.
    Object.keys(defaults).forEach(function(key) {
      if (typeof object[key] === 'undefined') {
        object[key] = defaults[key];
      }
    });
    return object;
  };

  exports.getSelfOrigin = function(settings) {
    if (!settings) {
      settings = fxpay.getattr('settings');
    }
    if (settings.appSelf) {
      if (!settings.appSelf.origin) {
        throw new Error('app does not have an origin');
      }
      return settings.appSelf.origin;
    } else {
      var win = settings.window;
      if (win.location.origin) {
        return win.location.origin;
      } else {
        return win.location.protocol + '//' + win.location.hostname;
      }
    }
  };

  exports.getUrlOrigin = function(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.origin || (a.protocol + '//' + a.host);
  };

  exports.getCenteredCoordinates = function(w, h) {
    // Centering calcs that work on multiple monitors (bug 1122683).
    var x = window.screenX +
      Math.max(0, Math.floor((window.innerWidth - w) / 2));
    var y = window.screenY +
      Math.max(0, Math.floor((window.innerHeight - h) / 2));
    return [x, y];
  };

  exports.reCenterWindow = function(winRef, w, h) {
    var settings = fxpay.getattr('settings');
    w = w || settings.winWidth;
    h = h || settings.winHeight;
    var xy = exports.getCenteredCoordinates(w, h);
    try {
      // Allow for the chrome as resizeTo args are the external
      // window dimensions not the internal ones.
      w = w + (winRef.outerWidth - winRef.innerWidth);
      h = h + (winRef.outerHeight - winRef.innerHeight);
      settings.log.log('width: ', w, 'height:', h);
      winRef.resizeTo(w, h);
      winRef.moveTo(xy[0], xy[1]);
    } catch(e) {
      settings.log.log("We don't have permission to resize this window");
    }
  };

  exports.openWindow = function(options) {
    var settings = fxpay.getattr('settings');
    var defaults = {
      url: '',
      title: 'FxPay',
      w: settings.winWidth,
      h: settings.winHeight,
    };

    options = exports.defaults(options, defaults);
    var xy = exports.getCenteredCoordinates(options.w, options.h);

    var winOptString = 'toolbar=no,location=no,directories=no,' +
      'menubar=no,scrollbars=yes,resizable=no,copyhistory=no,' +
      'width=' + options.w + ',height=' + options.h +
      ',top=' + xy[1] + ',left=' + xy[0];

    var windowRef = settings.window.open(options.url, options.title,
                                         winOptString);
    if (!windowRef) {
      settings.log.error('window.open() failed. URL:', options.url);
    }
    return windowRef;
  };

})();
