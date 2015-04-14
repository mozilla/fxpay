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
/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define('api',[
  'exports',
  'errors',
  'settings'
], function(exports, errors, settings) {

  'use strict';

  function API(baseUrl, opt) {
    opt = opt || {};
    this.baseUrl = baseUrl;
    this.log = settings.log;
    this.timeoutMs = settings.apiTimeoutMs || 10000;
    this.versionPrefix = settings.apiVersionPrefix || undefined;
  }

  API.prototype.url = function(path, opt) {
    opt = opt || {};
    opt.versioned = (typeof opt.versioned !== 'undefined'
                     ? opt.versioned: true);
    var url = this.baseUrl;
    if (opt.versioned) {
      url += (this.versionPrefix || '');
    }
    url += path;
    return url;
  };

  API.prototype.request = function(method, path, data, cb, opt) {
    opt = opt || {};
    var defaultCType = (data ? 'application/x-www-form-urlencoded': null);
    opt.contentType = opt.contentType || defaultCType;
    var defaultHeaders = {
      'Accept': 'application/json'
    };
    if (opt.contentType) {
      defaultHeaders['Content-Type'] = opt.contentType;
    }

    opt.headers = opt.headers || {};
    for (var h in defaultHeaders) {
      if (!(h in opt.headers)) {
        opt.headers[h] = defaultHeaders[h];
      }
    }
    opt.headers['x-fxpay-version'] = settings.libVersion;

    var log = this.log;
    var api = this;
    var url;
    if (!cb) {
      cb = function(err, data) {
        if (err) {
          throw err;
        }
        log.info('default callback received data:', data);
      };
    }
    if (/^http(s)?:\/\/.*/.test(path)) {
      // Requesting an absolute URL so no need to prefix it.
      url = path;
    } else {
      url = this.url(path);
    }
    var xhr = new XMLHttpRequest();
    // This doesn't seem to be supported by sinon yet.
    //xhr.responseType = "json";

    var events = {
      abort: function() {
        cb(errors.ApiRequestAborted('XHR request aborted for path: ' + path));
      },
      error: function(evt) {
        log.debug('XHR error event:', evt);
        cb(errors.ApiRequestError('received XHR error for path: ' + path));
      },
      load: function() {
        var data;
        if (this.status.toString().slice(0, 1) !== '2') {
          // TODO: handle status === 0 ?
          // TODO: handle redirects?
          var err = errors.BadApiResponse(
                    'Unexpected status: ' + this.status + ' for URL: ' + url);
          log.debug(err.toString(), 'response:', this.responseText);
          return cb(err);
        }

        log.debug('XHR load: GOT response:', this.responseText);
        try {
          // TODO: be smarter about content-types here.
          data = JSON.parse(this.responseText);
        } catch (parseErr) {
          var err = errors.BadJsonResponse(
              'Unparsable JSON for URL: ' + url + '; exception: ' + parseErr);
          log.debug(err.toString(), 'response:', this.responseText);
          return cb(err);
        }

        cb(null, data);
      },
      timeout: function() {
        cb(errors.ApiRequestTimeout(
              'XHR request to ' + url + ' timed out after ' +
              api.timeoutMs + 'ms'));
      }
    };

    for (var k in events) {
      xhr.addEventListener(k, events[k], false);
    }

    log.debug('opening', method, 'to', url);
    xhr.open(method, url, true);

    // Has to be after xhr.open to avoid
    // invalidStateError in IE.
    xhr.timeout = api.timeoutMs;

    for (var hdr in opt.headers) {
      xhr.setRequestHeader(hdr, opt.headers[hdr]);
    }
    if (opt.contentType === 'application/x-www-form-urlencoded' && data) {
      data = serialize(data);
    }
    xhr.send(data);
  };

  API.prototype.get = function(path, cb, opt) {
    this.request('GET', path, null, cb, opt);
  };

  API.prototype.del = function(path, cb, opt) {
    this.request('DELETE', path, null, cb, opt);
  };

  API.prototype.post = function(path, data, cb, opt) {
    this.request('POST', path, data, cb, opt);
  };

  API.prototype.put = function(path, data, cb, opt) {
    this.request('PUT', path, data, cb, opt);
  };

  function serialize(obj) {
    // {"foo": "bar", "baz": "zup"} -> "foo=bar&baz=zup"
    var str = [];
    for (var p in obj){
      if (obj.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    }
    return str.join("&");
  }

  exports.API = API;

});

/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/jakearchibald/es6-promise/master/LICENSE
 * @version   2.0.0
 */

(function() {
    "use strict";

    function $$utils$$objectOrFunction(x) {
      return typeof x === 'function' || (typeof x === 'object' && x !== null);
    }

    function $$utils$$isFunction(x) {
      return typeof x === 'function';
    }

    function $$utils$$isMaybeThenable(x) {
      return typeof x === 'object' && x !== null;
    }

    var $$utils$$_isArray;

    if (!Array.isArray) {
      $$utils$$_isArray = function (x) {
        return Object.prototype.toString.call(x) === '[object Array]';
      };
    } else {
      $$utils$$_isArray = Array.isArray;
    }

    var $$utils$$isArray = $$utils$$_isArray;
    var $$utils$$now = Date.now || function() { return new Date().getTime(); };
    function $$utils$$F() { }

    var $$utils$$o_create = (Object.create || function (o) {
      if (arguments.length > 1) {
        throw new Error('Second argument not supported');
      }
      if (typeof o !== 'object') {
        throw new TypeError('Argument must be an object');
      }
      $$utils$$F.prototype = o;
      return new $$utils$$F();
    });

    var $$asap$$len = 0;

    var $$asap$$default = function asap(callback, arg) {
      $$asap$$queue[$$asap$$len] = callback;
      $$asap$$queue[$$asap$$len + 1] = arg;
      $$asap$$len += 2;
      if ($$asap$$len === 2) {
        // If len is 1, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        $$asap$$scheduleFlush();
      }
    };

    var $$asap$$browserGlobal = (typeof window !== 'undefined') ? window : {};
    var $$asap$$BrowserMutationObserver = $$asap$$browserGlobal.MutationObserver || $$asap$$browserGlobal.WebKitMutationObserver;

    // test for web worker but not in IE10
    var $$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' &&
      typeof importScripts !== 'undefined' &&
      typeof MessageChannel !== 'undefined';

    // node
    function $$asap$$useNextTick() {
      return function() {
        process.nextTick($$asap$$flush);
      };
    }

    function $$asap$$useMutationObserver() {
      var iterations = 0;
      var observer = new $$asap$$BrowserMutationObserver($$asap$$flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    // web worker
    function $$asap$$useMessageChannel() {
      var channel = new MessageChannel();
      channel.port1.onmessage = $$asap$$flush;
      return function () {
        channel.port2.postMessage(0);
      };
    }

    function $$asap$$useSetTimeout() {
      return function() {
        setTimeout($$asap$$flush, 1);
      };
    }

    var $$asap$$queue = new Array(1000);

    function $$asap$$flush() {
      for (var i = 0; i < $$asap$$len; i+=2) {
        var callback = $$asap$$queue[i];
        var arg = $$asap$$queue[i+1];

        callback(arg);

        $$asap$$queue[i] = undefined;
        $$asap$$queue[i+1] = undefined;
      }

      $$asap$$len = 0;
    }

    var $$asap$$scheduleFlush;

    // Decide what async method to use to triggering processing of queued callbacks:
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      $$asap$$scheduleFlush = $$asap$$useNextTick();
    } else if ($$asap$$BrowserMutationObserver) {
      $$asap$$scheduleFlush = $$asap$$useMutationObserver();
    } else if ($$asap$$isWorker) {
      $$asap$$scheduleFlush = $$asap$$useMessageChannel();
    } else {
      $$asap$$scheduleFlush = $$asap$$useSetTimeout();
    }

    function $$$internal$$noop() {}
    var $$$internal$$PENDING   = void 0;
    var $$$internal$$FULFILLED = 1;
    var $$$internal$$REJECTED  = 2;
    var $$$internal$$GET_THEN_ERROR = new $$$internal$$ErrorObject();

    function $$$internal$$selfFullfillment() {
      return new TypeError("You cannot resolve a promise with itself");
    }

    function $$$internal$$cannotReturnOwn() {
      return new TypeError('A promises callback cannot return that same promise.')
    }

    function $$$internal$$getThen(promise) {
      try {
        return promise.then;
      } catch(error) {
        $$$internal$$GET_THEN_ERROR.error = error;
        return $$$internal$$GET_THEN_ERROR;
      }
    }

    function $$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
      try {
        then.call(value, fulfillmentHandler, rejectionHandler);
      } catch(e) {
        return e;
      }
    }

    function $$$internal$$handleForeignThenable(promise, thenable, then) {
       $$asap$$default(function(promise) {
        var sealed = false;
        var error = $$$internal$$tryThen(then, thenable, function(value) {
          if (sealed) { return; }
          sealed = true;
          if (thenable !== value) {
            $$$internal$$resolve(promise, value);
          } else {
            $$$internal$$fulfill(promise, value);
          }
        }, function(reason) {
          if (sealed) { return; }
          sealed = true;

          $$$internal$$reject(promise, reason);
        }, 'Settle: ' + (promise._label || ' unknown promise'));

        if (!sealed && error) {
          sealed = true;
          $$$internal$$reject(promise, error);
        }
      }, promise);
    }

    function $$$internal$$handleOwnThenable(promise, thenable) {
      if (thenable._state === $$$internal$$FULFILLED) {
        $$$internal$$fulfill(promise, thenable._result);
      } else if (promise._state === $$$internal$$REJECTED) {
        $$$internal$$reject(promise, thenable._result);
      } else {
        $$$internal$$subscribe(thenable, undefined, function(value) {
          $$$internal$$resolve(promise, value);
        }, function(reason) {
          $$$internal$$reject(promise, reason);
        });
      }
    }

    function $$$internal$$handleMaybeThenable(promise, maybeThenable) {
      if (maybeThenable.constructor === promise.constructor) {
        $$$internal$$handleOwnThenable(promise, maybeThenable);
      } else {
        var then = $$$internal$$getThen(maybeThenable);

        if (then === $$$internal$$GET_THEN_ERROR) {
          $$$internal$$reject(promise, $$$internal$$GET_THEN_ERROR.error);
        } else if (then === undefined) {
          $$$internal$$fulfill(promise, maybeThenable);
        } else if ($$utils$$isFunction(then)) {
          $$$internal$$handleForeignThenable(promise, maybeThenable, then);
        } else {
          $$$internal$$fulfill(promise, maybeThenable);
        }
      }
    }

    function $$$internal$$resolve(promise, value) {
      if (promise === value) {
        $$$internal$$reject(promise, $$$internal$$selfFullfillment());
      } else if ($$utils$$objectOrFunction(value)) {
        $$$internal$$handleMaybeThenable(promise, value);
      } else {
        $$$internal$$fulfill(promise, value);
      }
    }

    function $$$internal$$publishRejection(promise) {
      if (promise._onerror) {
        promise._onerror(promise._result);
      }

      $$$internal$$publish(promise);
    }

    function $$$internal$$fulfill(promise, value) {
      if (promise._state !== $$$internal$$PENDING) { return; }

      promise._result = value;
      promise._state = $$$internal$$FULFILLED;

      if (promise._subscribers.length === 0) {
      } else {
        $$asap$$default($$$internal$$publish, promise);
      }
    }

    function $$$internal$$reject(promise, reason) {
      if (promise._state !== $$$internal$$PENDING) { return; }
      promise._state = $$$internal$$REJECTED;
      promise._result = reason;

      $$asap$$default($$$internal$$publishRejection, promise);
    }

    function $$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      parent._onerror = null;

      subscribers[length] = child;
      subscribers[length + $$$internal$$FULFILLED] = onFulfillment;
      subscribers[length + $$$internal$$REJECTED]  = onRejection;

      if (length === 0 && parent._state) {
        $$asap$$default($$$internal$$publish, parent);
      }
    }

    function $$$internal$$publish(promise) {
      var subscribers = promise._subscribers;
      var settled = promise._state;

      if (subscribers.length === 0) { return; }

      var child, callback, detail = promise._result;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        if (child) {
          $$$internal$$invokeCallback(settled, child, callback, detail);
        } else {
          callback(detail);
        }
      }

      promise._subscribers.length = 0;
    }

    function $$$internal$$ErrorObject() {
      this.error = null;
    }

    var $$$internal$$TRY_CATCH_ERROR = new $$$internal$$ErrorObject();

    function $$$internal$$tryCatch(callback, detail) {
      try {
        return callback(detail);
      } catch(e) {
        $$$internal$$TRY_CATCH_ERROR.error = e;
        return $$$internal$$TRY_CATCH_ERROR;
      }
    }

    function $$$internal$$invokeCallback(settled, promise, callback, detail) {
      var hasCallback = $$utils$$isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        value = $$$internal$$tryCatch(callback, detail);

        if (value === $$$internal$$TRY_CATCH_ERROR) {
          failed = true;
          error = value.error;
          value = null;
        } else {
          succeeded = true;
        }

        if (promise === value) {
          $$$internal$$reject(promise, $$$internal$$cannotReturnOwn());
          return;
        }

      } else {
        value = detail;
        succeeded = true;
      }

      if (promise._state !== $$$internal$$PENDING) {
        // noop
      } else if (hasCallback && succeeded) {
        $$$internal$$resolve(promise, value);
      } else if (failed) {
        $$$internal$$reject(promise, error);
      } else if (settled === $$$internal$$FULFILLED) {
        $$$internal$$fulfill(promise, value);
      } else if (settled === $$$internal$$REJECTED) {
        $$$internal$$reject(promise, value);
      }
    }

    function $$$internal$$initializePromise(promise, resolver) {
      try {
        resolver(function resolvePromise(value){
          $$$internal$$resolve(promise, value);
        }, function rejectPromise(reason) {
          $$$internal$$reject(promise, reason);
        });
      } catch(e) {
        $$$internal$$reject(promise, e);
      }
    }

    function $$$enumerator$$makeSettledResult(state, position, value) {
      if (state === $$$internal$$FULFILLED) {
        return {
          state: 'fulfilled',
          value: value
        };
      } else {
        return {
          state: 'rejected',
          reason: value
        };
      }
    }

    function $$$enumerator$$Enumerator(Constructor, input, abortOnReject, label) {
      this._instanceConstructor = Constructor;
      this.promise = new Constructor($$$internal$$noop, label);
      this._abortOnReject = abortOnReject;

      if (this._validateInput(input)) {
        this._input     = input;
        this.length     = input.length;
        this._remaining = input.length;

        this._init();

        if (this.length === 0) {
          $$$internal$$fulfill(this.promise, this._result);
        } else {
          this.length = this.length || 0;
          this._enumerate();
          if (this._remaining === 0) {
            $$$internal$$fulfill(this.promise, this._result);
          }
        }
      } else {
        $$$internal$$reject(this.promise, this._validationError());
      }
    }

    $$$enumerator$$Enumerator.prototype._validateInput = function(input) {
      return $$utils$$isArray(input);
    };

    $$$enumerator$$Enumerator.prototype._validationError = function() {
      return new Error('Array Methods must be provided an Array');
    };

    $$$enumerator$$Enumerator.prototype._init = function() {
      this._result = new Array(this.length);
    };

    var $$$enumerator$$default = $$$enumerator$$Enumerator;

    $$$enumerator$$Enumerator.prototype._enumerate = function() {
      var length  = this.length;
      var promise = this.promise;
      var input   = this._input;

      for (var i = 0; promise._state === $$$internal$$PENDING && i < length; i++) {
        this._eachEntry(input[i], i);
      }
    };

    $$$enumerator$$Enumerator.prototype._eachEntry = function(entry, i) {
      var c = this._instanceConstructor;
      if ($$utils$$isMaybeThenable(entry)) {
        if (entry.constructor === c && entry._state !== $$$internal$$PENDING) {
          entry._onerror = null;
          this._settledAt(entry._state, i, entry._result);
        } else {
          this._willSettleAt(c.resolve(entry), i);
        }
      } else {
        this._remaining--;
        this._result[i] = this._makeResult($$$internal$$FULFILLED, i, entry);
      }
    };

    $$$enumerator$$Enumerator.prototype._settledAt = function(state, i, value) {
      var promise = this.promise;

      if (promise._state === $$$internal$$PENDING) {
        this._remaining--;

        if (this._abortOnReject && state === $$$internal$$REJECTED) {
          $$$internal$$reject(promise, value);
        } else {
          this._result[i] = this._makeResult(state, i, value);
        }
      }

      if (this._remaining === 0) {
        $$$internal$$fulfill(promise, this._result);
      }
    };

    $$$enumerator$$Enumerator.prototype._makeResult = function(state, i, value) {
      return value;
    };

    $$$enumerator$$Enumerator.prototype._willSettleAt = function(promise, i) {
      var enumerator = this;

      $$$internal$$subscribe(promise, undefined, function(value) {
        enumerator._settledAt($$$internal$$FULFILLED, i, value);
      }, function(reason) {
        enumerator._settledAt($$$internal$$REJECTED, i, reason);
      });
    };

    var $$promise$all$$default = function all(entries, label) {
      return new $$$enumerator$$default(this, entries, true /* abort on reject */, label).promise;
    };

    var $$promise$race$$default = function race(entries, label) {
      /*jshint validthis:true */
      var Constructor = this;

      var promise = new Constructor($$$internal$$noop, label);

      if (!$$utils$$isArray(entries)) {
        $$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
        return promise;
      }

      var length = entries.length;

      function onFulfillment(value) {
        $$$internal$$resolve(promise, value);
      }

      function onRejection(reason) {
        $$$internal$$reject(promise, reason);
      }

      for (var i = 0; promise._state === $$$internal$$PENDING && i < length; i++) {
        $$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
      }

      return promise;
    };

    var $$promise$resolve$$default = function resolve(object, label) {
      /*jshint validthis:true */
      var Constructor = this;

      if (object && typeof object === 'object' && object.constructor === Constructor) {
        return object;
      }

      var promise = new Constructor($$$internal$$noop, label);
      $$$internal$$resolve(promise, object);
      return promise;
    };

    var $$promise$reject$$default = function reject(reason, label) {
      /*jshint validthis:true */
      var Constructor = this;
      var promise = new Constructor($$$internal$$noop, label);
      $$$internal$$reject(promise, reason);
      return promise;
    };

    var $$es6$promise$promise$$counter = 0;

    function $$es6$promise$promise$$needsResolver() {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }

    function $$es6$promise$promise$$needsNew() {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }

    var $$es6$promise$promise$$default = $$es6$promise$promise$$Promise;

    /**
      Promise objects represent the eventual result of an asynchronous operation. The
      primary way of interacting with a promise is through its `then` method, which
      registers callbacks to receive either a promise’s eventual value or the reason
      why the promise cannot be fulfilled.

      Terminology
      -----------

      - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
      - `thenable` is an object or function that defines a `then` method.
      - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
      - `exception` is a value that is thrown using the throw statement.
      - `reason` is a value that indicates why a promise was rejected.
      - `settled` the final resting state of a promise, fulfilled or rejected.

      A promise can be in one of three states: pending, fulfilled, or rejected.

      Promises that are fulfilled have a fulfillment value and are in the fulfilled
      state.  Promises that are rejected have a rejection reason and are in the
      rejected state.  A fulfillment value is never a thenable.

      Promises can also be said to *resolve* a value.  If this value is also a
      promise, then the original promise's settled state will match the value's
      settled state.  So a promise that *resolves* a promise that rejects will
      itself reject, and a promise that *resolves* a promise that fulfills will
      itself fulfill.


      Basic Usage:
      ------------

      ```js
      var promise = new Promise(function(resolve, reject) {
        // on success
        resolve(value);

        // on failure
        reject(reason);
      });

      promise.then(function(value) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Advanced Usage:
      ---------------

      Promises shine when abstracting away asynchronous interactions such as
      `XMLHttpRequest`s.

      ```js
      function getJSON(url) {
        return new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();

          xhr.open('GET', url);
          xhr.onreadystatechange = handler;
          xhr.responseType = 'json';
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.send();

          function handler() {
            if (this.readyState === this.DONE) {
              if (this.status === 200) {
                resolve(this.response);
              } else {
                reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
              }
            }
          };
        });
      }

      getJSON('/posts.json').then(function(json) {
        // on fulfillment
      }, function(reason) {
        // on rejection
      });
      ```

      Unlike callbacks, promises are great composable primitives.

      ```js
      Promise.all([
        getJSON('/posts'),
        getJSON('/comments')
      ]).then(function(values){
        values[0] // => postsJSON
        values[1] // => commentsJSON

        return values;
      });
      ```

      @class Promise
      @param {function} resolver
      Useful for tooling.
      @constructor
    */
    function $$es6$promise$promise$$Promise(resolver) {
      this._id = $$es6$promise$promise$$counter++;
      this._state = undefined;
      this._result = undefined;
      this._subscribers = [];

      if ($$$internal$$noop !== resolver) {
        if (!$$utils$$isFunction(resolver)) {
          $$es6$promise$promise$$needsResolver();
        }

        if (!(this instanceof $$es6$promise$promise$$Promise)) {
          $$es6$promise$promise$$needsNew();
        }

        $$$internal$$initializePromise(this, resolver);
      }
    }

    $$es6$promise$promise$$Promise.all = $$promise$all$$default;
    $$es6$promise$promise$$Promise.race = $$promise$race$$default;
    $$es6$promise$promise$$Promise.resolve = $$promise$resolve$$default;
    $$es6$promise$promise$$Promise.reject = $$promise$reject$$default;

    $$es6$promise$promise$$Promise.prototype = {
      constructor: $$es6$promise$promise$$Promise,

    /**
      The primary way of interacting with a promise is through its `then` method,
      which registers callbacks to receive either a promise's eventual value or the
      reason why the promise cannot be fulfilled.

      ```js
      findUser().then(function(user){
        // user is available
      }, function(reason){
        // user is unavailable, and you are given the reason why
      });
      ```

      Chaining
      --------

      The return value of `then` is itself a promise.  This second, 'downstream'
      promise is resolved with the return value of the first promise's fulfillment
      or rejection handler, or rejected if the handler throws an exception.

      ```js
      findUser().then(function (user) {
        return user.name;
      }, function (reason) {
        return 'default name';
      }).then(function (userName) {
        // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
        // will be `'default name'`
      });

      findUser().then(function (user) {
        throw new Error('Found user, but still unhappy');
      }, function (reason) {
        throw new Error('`findUser` rejected and we're unhappy');
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
        // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
      });
      ```
      If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.

      ```js
      findUser().then(function (user) {
        throw new PedagogicalException('Upstream error');
      }).then(function (value) {
        // never reached
      }).then(function (value) {
        // never reached
      }, function (reason) {
        // The `PedgagocialException` is propagated all the way down to here
      });
      ```

      Assimilation
      ------------

      Sometimes the value you want to propagate to a downstream promise can only be
      retrieved asynchronously. This can be achieved by returning a promise in the
      fulfillment or rejection handler. The downstream promise will then be pending
      until the returned promise is settled. This is called *assimilation*.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // The user's comments are now available
      });
      ```

      If the assimliated promise rejects, then the downstream promise will also reject.

      ```js
      findUser().then(function (user) {
        return findCommentsByAuthor(user);
      }).then(function (comments) {
        // If `findCommentsByAuthor` fulfills, we'll have the value here
      }, function (reason) {
        // If `findCommentsByAuthor` rejects, we'll have the reason here
      });
      ```

      Simple Example
      --------------

      Synchronous Example

      ```javascript
      var result;

      try {
        result = findResult();
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js
      findResult(function(result, err){
        if (err) {
          // failure
        } else {
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findResult().then(function(result){
        // success
      }, function(reason){
        // failure
      });
      ```

      Advanced Example
      --------------

      Synchronous Example

      ```javascript
      var author, books;

      try {
        author = findAuthor();
        books  = findBooksByAuthor(author);
        // success
      } catch(reason) {
        // failure
      }
      ```

      Errback Example

      ```js

      function foundBooks(books) {

      }

      function failure(reason) {

      }

      findAuthor(function(author, err){
        if (err) {
          failure(err);
          // failure
        } else {
          try {
            findBoooksByAuthor(author, function(books, err) {
              if (err) {
                failure(err);
              } else {
                try {
                  foundBooks(books);
                } catch(reason) {
                  failure(reason);
                }
              }
            });
          } catch(error) {
            failure(err);
          }
          // success
        }
      });
      ```

      Promise Example;

      ```javascript
      findAuthor().
        then(findBooksByAuthor).
        then(function(books){
          // found books
      }).catch(function(reason){
        // something went wrong
      });
      ```

      @method then
      @param {Function} onFulfilled
      @param {Function} onRejected
      Useful for tooling.
      @return {Promise}
    */
      then: function(onFulfillment, onRejection) {
        var parent = this;
        var state = parent._state;

        if (state === $$$internal$$FULFILLED && !onFulfillment || state === $$$internal$$REJECTED && !onRejection) {
          return this;
        }

        var child = new this.constructor($$$internal$$noop);
        var result = parent._result;

        if (state) {
          var callback = arguments[state - 1];
          $$asap$$default(function(){
            $$$internal$$invokeCallback(state, child, callback, result);
          });
        } else {
          $$$internal$$subscribe(parent, child, onFulfillment, onRejection);
        }

        return child;
      },

    /**
      `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
      as the catch block of a try/catch statement.

      ```js
      function findAuthor(){
        throw new Error('couldn't find that author');
      }

      // synchronous
      try {
        findAuthor();
      } catch(reason) {
        // something went wrong
      }

      // async with promises
      findAuthor().catch(function(reason){
        // something went wrong
      });
      ```

      @method catch
      @param {Function} onRejection
      Useful for tooling.
      @return {Promise}
    */
      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };

    var $$es6$promise$polyfill$$default = function polyfill() {
      var local;

      if (typeof global !== 'undefined') {
        local = global;
      } else if (typeof window !== 'undefined' && window.document) {
        local = window;
      } else {
        local = self;
      }

      var es6PromiseSupport =
        "Promise" in local &&
        // Some of these methods are missing from
        // Firefox/Chrome experimental implementations
        "resolve" in local.Promise &&
        "reject" in local.Promise &&
        "all" in local.Promise &&
        "race" in local.Promise &&
        // Older version of the spec had a resolver object
        // as the arg rather than a function
        (function() {
          var resolve;
          new local.Promise(function(r) { resolve = r; });
          return $$utils$$isFunction(resolve);
        }());

      if (!es6PromiseSupport) {
        local.Promise = $$es6$promise$promise$$default;
      }
    };

    var es6$promise$umd$$ES6Promise = {
      'Promise': $$es6$promise$promise$$default,
      'polyfill': $$es6$promise$polyfill$$default
    };

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define('promise',[],function() { return es6$promise$umd$$ES6Promise; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = es6$promise$umd$$ES6Promise;
    } else if (typeof this !== 'undefined') {
      this['ES6Promise'] = es6$promise$umd$$ES6Promise;
    }
}).call(this);
/**
 * Utils module.
 * @module utils
 */

define('utils',[
  'exports',
  'errors',
  'settings'
], function(exports, errors, settings) {

  'use strict';

 /**
  * Populates an object with defaults if the key is not yet defined.
  * Similar to _.defaults except this takes only a single defaults object.
  * @param {object} object - the object to populate defaults on
  * @param {object} defaults - the defaults to use
  * @returns {object}
  */
  exports.defaults = function(object, defaults) {
    object = object || {};
    Object.keys(defaults).forEach(function(key) {
      if (typeof object[key] === 'undefined') {
        object[key] = defaults[key];
      }
    });
    return object;
  };

 /**
  * Gets the app origin
  * @returns {string}
  */
  exports.getSelfOrigin = function(settingsObj) {
    settingsObj = settingsObj || settings;
    if (settingsObj.appSelf) {
      // This might be null for type:web packaged apps.
      // If that's a requirement, the caller should check for nulls.
      return settingsObj.appSelf.origin;
    } else {
      var win = settingsObj.window;
      if (win.location.origin) {
        return win.location.origin;
      } else {
        return win.location.protocol + '//' + win.location.hostname;
      }
    }
  };

 /**
  * Gets the the origin of the URL provided.
  * @param {string} url - the URL to introspect the origin from
  * @returns {string}
  */
  exports.getUrlOrigin = function(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.origin || (a.protocol + '//' + a.host);
  };

 /**
  * Gets the center coordinates for a passed width and height.
  * Uses centering calcs that work on multiple monitors (bug 1122683).
  * @param {number} w - width
  * @param {number} h - height
  * @returns {list}
  */
  exports.getCenteredCoordinates = function(w, h) {
    var x = window.screenX +
      Math.max(0, Math.floor((window.innerWidth - w) / 2));
    var y = window.screenY +
      Math.max(0, Math.floor((window.innerHeight - h) / 2));
    return [x, y];
  };

 /**
  * Re-center an existing window.
  * @param {object} winRef - A reference to an existing window
  * @param {number} [w] - width
  * @param {number} [h] - height
  * @returns {undefined}
  */
  exports.reCenterWindow = function(winRef, w, h) {
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

 /**
  * Open a window
  * @param {object} [options] - the settings object
  * @param {string} [options.url] - the window url
  * @param {string} [options.title] - the window title
  * @param {number} [options.w] - the window width
  * @param {number} [options.h] - the window height
  * @returns {object} windowRef - a window reference.
  */
  exports.openWindow = function(options) {
    var defaults = {
      url: '',
      title: 'FxPay',
      w: settings.winWidth,
      h: settings.winHeight,
    };

    options = exports.defaults(options, defaults);
    var xy = exports.getCenteredCoordinates(options.w, options.h);

    var winOptString = 'toolbar=no,location=yes,directories=no,' +
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

 /**
  * Get the App object returned from [`mozApps.getSelf()`](http://goo.gl/x4BDqs)
  * @param {module:utils~getAppSelfCallback} callback - the callback function.
  * @returns {undefined}
  */
  exports.getAppSelf = function getAppSelf(callback) {
    function storeAppSelf(appSelf) {
      if (appSelf === null) {
        throw new Error('cannot store a null appSelf');
      }
      settings.appSelf = appSelf;
      return appSelf;
    }

    if (settings.appSelf !== null) {
      // This means getAppSelf() has already run successfully so let's
      // return the value immediately.
      return callback(null, settings.appSelf);
    }

    if (!settings.mozApps) {
      settings.log.info(
          'web platform does not define mozApps, cannot get appSelf');
      return callback(null, storeAppSelf(false));
    }
    var appRequest = settings.mozApps.getSelf();

    appRequest.onsuccess = function() {
      var appSelf = this.result;
      // In the case where we're in a Firefox that supports mozApps but
      // we're not running as an app, this could be falsey.
      settings.log.info('got appSelf from mozApps.getSelf()');
      callback(null, storeAppSelf(appSelf || false));
    };

    appRequest.onerror = function() {
      var errCode = this.error.name;
      settings.log.error('mozApps.getSelf() returned an error', errCode);
      // We're not caching an appSelf result here.
      // This allows nested functions to report errors better.
      callback(errors.InvalidApp('invalid application: ' + errCode,
                                 {code: errCode}), settings.appSelf);
    };
  };

 /**
  * The callback called by {@link module:utils.getAppSelf }
  * @callback module:utils~getAppSelfCallback
  * @param {object} error - an error object. Will be null if no error.
  * @param {object} appSelf - the [appSelf object](http://goo.gl/HilsmA)
  */


 /**
  * Log a deprecation message with some extra info.
  * @param {string} msg - log message
  * @param {string} versionDeprecated - the version when deprecated
  * @returns {undefined}
  */
  exports.logDeprecation = function(msg, versionDeprecated) {
    settings.log.warn(
        msg + '. This was deprecated in ' + versionDeprecated + '. ' +
        'More info: https://github.com/mozilla/fxpay/releases/tag/' +
        versionDeprecated);
  };

});

define('receipts',[
  'exports',
  'api',
  'errors',
  'products',
  'settings',
  'utils'
], function(exports, api, errors, products, settings, utils) {

  'use strict';

  exports.all = function(callback) {
    utils.getAppSelf(function(error, appSelf) {
      if (error) {
        return callback(error);
      }

      var nativeNum = 0;
      var receipts = [];
      if (appSelf && appSelf.receipts) {
        nativeNum = appSelf.receipts.length;
        receipts = Array.prototype.slice.call(appSelf.receipts);
      }

      var locNum = 0;
      var storedReceipts = settings.localStorage.getItem(
        settings.localStorageKey);

      if (storedReceipts) {
        storedReceipts = JSON.parse(storedReceipts);
        for (var j = 0; j < storedReceipts.length; j++) {
          if (receipts.indexOf(storedReceipts[j]) === -1) {
            receipts.push(storedReceipts[j]);
            locNum++;
          } else {
            settings.log.info(
              'ignoring dupe receipt fetched from local storage',
              storedReceipts[j].substring(0, 5));
          }
        }
      }

      settings.log.info('receipts fetched from mozApps:', nativeNum);
      settings.log.info('receipts fetched from localStorage:', locNum);

      callback(null, receipts);
    });
  };


  exports.add = function(receipt, onFinish) {
    utils.getAppSelf(function(error, appSelf) {
      if (error) {
        return onFinish(error);
      }
      if (appSelf && appSelf.addReceipt) {
        settings.log.info('adding receipt to device with addReceipt');
        return addReceiptNatively(receipt, onFinish);
      } else {
        if (!settings.localStorage) {
          return onFinish(errors.PayPlatformUnavailable(
                          'no storage mechanism for adding receipts'));
        }
        settings.log.info('adding receipt to device with localStorage');
        return addReceiptWithLocStor(receipt, onFinish);
      }
    });
  };


  exports.validateAppReceipt = function(receipt, callback) {
    exports.verifyAppData(receipt, function(err, data, productInfo) {
      if (err) {
        return callback(err, productInfo);
      }

      verifyReceiptOnServer(receipt, data, productInfo,
                            function(err, productInfo) {
        if (err) {
          return callback(err, productInfo);
        }

        var selfOrigin = utils.getSelfOrigin();

        // Even though it's valid, make sure it's a receipt for our app.
        if (productInfo.productUrl !== selfOrigin) {
          return callback(errors.InvalidReceipt(
                            'valid receipt but wrong product; our origin: ' +
                            selfOrigin + '; receipt product origin: ' +
                            productInfo.productUrl), productInfo);
        }

        callback(null, productInfo);
      });
    });
  };


  exports.validateInAppProductReceipt = function(receipt, productInfo,
                                                 onRestore) {
    exports.verifyInAppProductData(receipt, productInfo,
                                   function(err, data, verifiedProductInfo) {
      if (err) {
        return onRestore(err, verifiedProductInfo);
      }

      verifyReceiptOnServer(receipt, data, verifiedProductInfo,
                            function(err, serverProductInfo) {
        onRestore(err, serverProductInfo);
      });
    });
  };


  exports.verifyData = function(receipt, productInfo, onVerify) {
    verifyReceiptJwt(receipt, function(err, data) {
      if (err) {
        return onVerify(err, data, {});
      }

      verifyReceiptStoreData(data, productInfo,
                             function(err, productInfo) {
        if (err) {
          return onVerify(err, data, productInfo);
        }

        verifyReceiptCheckUrl(data, function(err) {
          if (err) {
            return onVerify(err, data, productInfo);
          }

          onVerify(null, data, productInfo);
        });
      });
    });
  };


  exports.verifyAppData = function(receipt, callback) {
    var productInfo = new products.Product();

    exports.verifyData(receipt, productInfo,
                       function(error, data, productInfo) {
      if (error) {
        return callback(error, data, productInfo);
      }

      utils.getAppSelf(function(error, appSelf) {
        if (error) {
          return callback(error, data, productInfo);
        }
        if (!appSelf) {
          return callback(errors.PayPlatformUnavailable(
                            'mozApps.getSelf() is needed to verify receipts'),
                            data, productInfo);
        }

        var manifest = appSelf.manifest;
        var allowAny;

        if (!manifest.installs_allowed_from) {
          // This is an unlikely case but let's guess that it implies "*".
          allowAny = true;
        } else {
          allowAny = manifest.installs_allowed_from.indexOf('*') !== -1;
        }
        if (allowAny) {
          settings.log.warn('your paid app manifest specifies ' +
                            'installs_allowed_from = ["*"] which means ' +
                            'an attacker can provide a spoofed receipt ' +
                            'validation service');
        }
        if (!allowAny &&
            manifest.installs_allowed_from.indexOf(data.iss) === -1) {
          return callback(errors.InvalidReceipt(
                'receipt issuer ' + data.iss + ' is not an allowed issuer; ' +
                'allowed: ' + manifest.installs_allowed_from),
                data, productInfo);
        }

        productInfo.productId = data.product.storedataObject.id;
        if (!productInfo.productId) {
          return callback(errors.InvalidReceipt(
                            'Could not find app productId in storedata:' +
                            data.product.storedata), data, productInfo);
        }

        callback(null, data, productInfo);
      });
    });
  };


  exports.verifyInAppProductData = function(receipt, productInfo, callback) {
    exports.verifyData(receipt, productInfo,
                       function(error, data, productInfo) {
      if (error) {
        return callback(error, data, productInfo);
      }

      productInfo.productId = data.product.storedataObject.inapp_id;
      if (!productInfo.productId) {
        return callback(errors.InvalidReceipt(
                        'Could not find in-app productId in storedata: ' +
                        data.product.storedata), data, productInfo);
      }

      callback(null, data, productInfo);
    });
  };


  exports.checkStoreData = function(receipt) {
    // Return the storedata portion of the receipt without doing any
    // server validation. If the receipt is unparsable, returns null.
    var data = getReceiptData(receipt);
    if (!data) {
      return null;
    }
    return parseStoreData(data);
  };


  //
  // private functions:
  //


  function addReceiptNatively(receipt, onFinish) {
    var receiptReq = settings.appSelf.addReceipt(receipt);

    receiptReq.onsuccess = function() {
      settings.log.info('item fully purchased and receipt installed');
      onFinish(null);
    };

    receiptReq.onerror = function() {
      var errCode = this.error.name;
      onFinish(errors.AddReceiptError(
                        'error calling app.addReceipt: ' + errCode,
                        {code: errCode}));
    };
  }


  function addReceiptWithLocStor(receipt, onFinish) {
    var allReceipts = settings.localStorage.getItem(settings.localStorageKey);
    if (allReceipts) {
      allReceipts = JSON.parse(allReceipts);
    } else {
      allReceipts = [];
    }
    if (allReceipts.indexOf(receipt) === -1) {
      allReceipts.push(receipt);
    } else {
      settings.log.info('not adding receipt', receipt.substring(0, 5),
                        'because it has already been added');
    }
    settings.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify(allReceipts));

    onFinish(null);
  }


  function verifyReceiptJwt(receipt, onVerify) {
    var data = getReceiptData(receipt);
    if (!data) {
      return onVerify(new errors.InvalidReceipt('invalid JWT data'), {});
    }
    onVerify(null, data);
  }


  function verifyReceiptOnServer(receipt, data, productInfo, callback) {
    settings.log.debug('receipt data:', data);
    var api = getApiFromReceipt(data);

    settings.log.info('about to post to verifier URL', data.verify);

    api.post(data.verify, receipt, function(err, verifyResult) {
      productInfo.receiptInfo = exports.ReceiptInfo(receipt, verifyResult);

      if (err) {
        settings.log.error('Error verifying receipt:', err.toString());
        return callback(err, productInfo);
      }

      settings.log.info('verification result:', verifyResult);

      if (verifyResult.status === 'ok') {
        settings.log.info('validated receipt for', productInfo);

        return callback(null, productInfo);

      } else {
        return callback(errors.InvalidReceipt(
                          'receipt ' + receipt.substring(0, 50) +
                           ' is invalid; service returned: ' +
                           verifyResult.status + ' ' + verifyResult.reason),
                        productInfo);
      }

    }, {contentType: 'text/plain'});
  }


  function verifyReceiptStoreData(data, productInfo, onVerify) {

    if (!data.product) {
      return onVerify(errors.InvalidReceipt(
                        'receipt is missing the product field'),
                      productInfo);
    }

    if (!data.product.url) {
      return onVerify(errors.InvalidReceipt('receipt is missing product.url'),
                      productInfo);
    }

    if (!data.product.storedata) {
      return onVerify(
          errors.InvalidReceipt('receipt is missing product.storedata'),
          productInfo);
    }

    data.product.storedataObject = parseStoreData(data);
    if (!data.product.storedataObject) {
      return onVerify(errors.InvalidReceipt('missing storedata'), productInfo);
    }

    var isTestReceipt = (data.typ === 'test-receipt');

    if (isTestReceipt && !settings.allowTestReceipts) {
      return onVerify(errors.TestReceiptNotAllowed(
                'cannot restore test receipts when allowTestReceipts is false'),
                productInfo);
    }

    var productUrl = data.product.url;
    if (productUrl && !productUrl.match(/^(http(s)?|app):\/\/.*$/g)) {
      // Assume that un-prefixed product URLs are for packaged apps.
      // TODO: This seems wrong. Remove this when it's fixed in
      // Marketplace receipts: bug 1034264.
      productUrl = 'app://' + productUrl;
    }

    productInfo.productUrl = productUrl;

    if (!isTestReceipt) {
      // Make sure the receipt belongs only to this app.
      // In the future, it seems plausible that productUrl would
      // point to a specific path on the server rather than just the
      // origin. Instead of accounting for it, let's wait until that happens.
      var selfOrigin = utils.getSelfOrigin();
      if (productUrl !== selfOrigin) {
        return onVerify(errors.InvalidReceipt(
                          'app origin ' + selfOrigin +
                          ' does not match receipt product URL ' + productUrl),
                        productInfo);
      }
    }

    onVerify(null, productInfo);
  }


  function verifyReceiptCheckUrl(data, onVerify) {

    // Make sure the receipt check URL is in the whitelist so we
    // don't give away free products.
    var urlOk = false;
    var verifyUrl = data.verify || '';

    for (var i = 0; i < settings.receiptCheckSites.length; i++) {
      var domain = settings.receiptCheckSites[i];
      if (verifyUrl.indexOf(domain) === 0) {
        urlOk = true;
        break;
      }
    }
    if (!urlOk) {
      return onVerify(errors.InvalidReceipt(
                          'Receipt check URL ' + data.verify +
                          ' is not whitelisted. Valid choices: ' +
                          settings.receiptCheckSites),
                      data);
    }

    onVerify(null, data);
  }


  function getReceiptData(receipt) {
    var data;

    if (typeof receipt !== 'string') {
      settings.log.error('unexpected receipt type:', typeof receipt);
      return null;
    }

    var majorParts = receipt.split('~');
    if (majorParts.length === 1) {
      data = majorParts[0];
    } else if (majorParts.length === 2) {
      // Ignore the preceding json key.
      data = majorParts[1];
    } else {
      settings.log.error('wrong number of tilde separated ' +
                         'segments in receipt');
      return null;
    }

    var jwtParts = data.split('.');
    if (jwtParts.length !== 3) {
      settings.log.error('wrong number of JWT segments in receipt:',
                         jwtParts.length);
      return null;
    }
    // Throw away the first and last JWT parts.
    data = jwtParts[1];

    try {
      data = base64urldecode(data);
    } catch (exc) {
      settings.log.error('error base64 decoding receipt:', exc.name,
                         exc.message);
      return null;
    }
    try {
      data = JSON.parse(data);
    } catch (exc) {
      settings.log.error('error parsing receipt JSON:', exc.name,
                         exc.message);
      return null;
    }

    return data;
  }


  function parseStoreData(receiptData) {
    if (!receiptData.product) {
      return null;
    }
    if (typeof receiptData.product.storedata !== 'string') {
      settings.log.error('unexpected storedata in receipt:',
                         receiptData.product.storedata);
      return null;
    }

    var params = {};
    receiptData.product.storedata.split('&').forEach(function(pair) {
      var parts = pair.split('=');
      params[parts[0]] = decodeURIComponent(parts[1]);
    });

    return params;
  }


  function getApiFromReceipt(receiptData) {
    // The issuer of the receipt is typically the Marketplace.
    // This is the site we want to use for making API requests.
    var apiUrlBase = receiptData.iss;
    settings.log.info('derived base API URL from receipt:', apiUrlBase);
    return new api.API(apiUrlBase);
  }


  function base64urldecode(s) {
    s = s.replace(/-/g, '+'); // 62nd char of encoding
    s = s.replace(/_/g, '/'); // 63rd char of encoding
    switch (s.length % 4) { // Pad with trailing '='s
    case 0:
      break; // No pad chars in this case
    case 1:
      s += "===";
      break;
    case 2:
      s += "==";
      break;
    case 3:
      s += "=";
      break;
    default:
      throw "Illegal base64url string!";
    }
    return atob(s);
  }


  function ReceiptInfo(receipt, verificationResult) {
    // Information about a receipt.

    verificationResult = verificationResult || {};

    if (!(this instanceof ReceiptInfo)) {
      // Allow caller to construct object without `new`.
      var obj = Object.create(ReceiptInfo.prototype);
      return ReceiptInfo.apply(obj, arguments);
    }

    // This is the original JWT (JSON Web Token) receipt string.
    this.receipt = receipt;

    // verificationResult is a JSON server response from
    // the validator. For more info see:
    // jshint maxlen: false
    // https://wiki.mozilla.org/Apps/WebApplicationReceipt#Verification_of_a_Receipt

    // A string, containing one of the values "ok", "pending", "refunded",
    // "expired" or "invalid."
    this.status = verificationResult.status;

    // An optional field, normally only populated when a receipt is invalid,
    // this will give you a reason it failed.
    this.reason = verificationResult.reason;

    return this;
  }

  exports.ReceiptInfo = ReceiptInfo;

});

define('products',[
  'exports',
  'api',
  'errors',
  'promise',
  'receipts',
  'settings',
  'utils'
], function(exports, apiModule, errors, promise, receipts, settings, utils) {

  'use strict';

  var Promise = promise.Promise;

  exports.get = function(productId, opt) {
    return buildProductReceiptMap()
      .then(function() {
        return new Promise(function(resolve, reject) {
          exports.getById(productId, function(error, product) {
            if (error) {
              settings.log.error(
                'no existing product with productId=' + productId +
                '; error: ' + error);
              return reject(error);
            }

            resolve(product);
          }, opt);
        });
      });
  };


  exports.all = function(callback) {
    settings.initialize();
    var promise = buildProductReceiptMap()
      .then(function() {
        return new Promise(function(resolve, reject) {
          var allProducts = [];

          var api = new apiModule.API(settings.apiUrlBase);
          var origin = utils.getSelfOrigin();
          if (!origin) {
            return reject(
                errors.InvalidApp('an origin is needed to get products'));
          }
          origin = encodeURIComponent(origin);
          var url;

          if (settings.fakeProducts) {
            settings.log.warn('about to fetch fake products');
            url = '/payments/stub-in-app-products/';
          } else {
            settings.log.info('about to fetch real products for app',
                              origin);
            url = '/payments/' + origin + '/in-app/?active=1';
          }

          api.get(url, function(err, result) {
            if (err) {
              return reject(err);
            }
            if (!result || !result.objects) {
              settings.log.debug('unexpected API response', result);
              return reject(errors.BadApiResponse(
                                      'received empty API response'));
            }
            settings.log.info('total products fetched:', result.objects.length);
            for (var i=0; i < result.objects.length; i++) {
              var ob = result.objects[i];
              var productInfo = createProductFromApi(ob);
              allProducts.push(productInfo);
            }
            resolve(allProducts);
          });
        });
      });

    if (callback) {
      utils.logDeprecation(
        'getProducts(callback) is no longer supported; use the returned ' +
        'promise instead', '0.0.15');
      promise.then(function(products) {
        callback(null, products);
      }).catch(function(error) {
        callback(error, []);
      });
    }

    return promise;
  };


  exports.getById = function(productId, onFetch, opt) {
    opt = opt || {};
    if (typeof opt.fetchStubs === 'undefined') {
      opt.fetchStubs = false;
    }
    if (!opt.api) {
      opt.api = new apiModule.API(settings.apiUrlBase);
    }
    var origin = encodeURIComponent(utils.getSelfOrigin());
    var url;

    if (opt.fetchStubs) {
      url = '/payments/stub-in-app-products/' + productId.toString() + '/';
    } else {
      url = '/payments/' + origin + '/in-app/' + productId.toString() + '/';
    }
    settings.log.info(
      'fetching product info at URL', url, 'fetching stubs?', opt.fetchStubs);

    opt.api.get(url, function(err, productData) {
      if (err) {
        settings.log.error('Error fetching product info', err.toString());
        return onFetch(err, {productId: productId});
      }
      onFetch(null, createProductFromApi(productData));
    });
  };


  function Product(params) {
    params = params || {};
    this.pricePointId = params.pricePointId;
    this.productId = params.productId;
    this.name = params.name;
    this.smallImageUrl = params.smallImageUrl;
    this.receiptInfo = params.receiptInfo || {};
  }

  exports.Product = Product;

  Product.prototype.getReceiptMap = function() {
    if (!settings.productReceiptMap) {
      // Sadly, building a receipt map must be done asynchronously so
      // we need to rely on a higher level function to set it up.
      throw errors.IncorrectUsage(
        'cannot proceed with this method; receipt map is empty');
    }
    return settings.productReceiptMap;
  };

  Product.prototype.hasReceipt = function() {
    return typeof this.getReceiptMap()[this.productId] !== 'undefined';
  };

  Product.prototype.validateReceipt = function() {
    var receiptMap = this.getReceiptMap();
    var product = this;

    return new Promise(function(resolve, reject) {

      var receipt = receiptMap[product.productId];
      if (!receipt) {
        return reject(errors.InvalidReceipt(
                        'could not find installed receipt for productId=' +
                        product.productId));
      }

      receipts.validateInAppProductReceipt(receipt, product,
                                           function(error, product) {
        if (error) {
          settings.log.error('receipt validation error: ' + error);
          error.productInfo = product;
          return reject(error);
        } else {
          return resolve(product);
        }
      });

    });
  };


  //
  // private functions:
  //


  function buildProductReceiptMap() {
    return new Promise(function(resolve, reject) {
      if (settings.productReceiptMap) {
        return resolve(settings.productReceiptMap);
      }

      settings.log.debug('building a product->receipt map');

      receipts.all(function(error, allReceipts) {
        if (error) {
          return reject(error);
        }

        settings.productReceiptMap = {};

        allReceipts.forEach(function(receipt) {
          var storedata = receipts.checkStoreData(receipt);
          if (!storedata) {
            settings.log.debug(
              'ignoring receipt with missing or unparsable storedata');
            return;
          }
          if (!storedata.inapp_id) {
            return settings.log.debug('ignoring receipt without inapp_id');
          }
          settings.log.debug('found receipt with inapp_id=',
                             storedata.inapp_id);
          settings.productReceiptMap[storedata.inapp_id] = receipt;
        });

        resolve(settings.productReceiptMap);
      });
    });
  }

  function createProductFromApi(ob) {
    return new Product({
      pricePointId: ob.price_id,
      productId: ob.guid,
      name: ob.name,
      smallImageUrl: ob.logo_url,
    });
  }

});

define('adapter',[
  'exports',
  'api',
  'errors',
  'products',
  'receipts',
  'utils'
], function(exports, api, errors, products, receipts, utils) {

  'use strict';

  function FxInappAdapter() {
    //
    // Adapter for Firefox Marketplace in-app products.
    //
    // This implements the backend details about how a
    // purchase JWT is generated and it has some hooks for
    // initialization and finishing up purchases.
    //
    // This is the default adapter and serves as a guide
    // for what public methods you need to implement if you
    // were to create your own.
    //
    // You should avoid setting any adapter properties here
    // that might rely on settings. Instead, use the configure()
    // hook.
    //
  }

  FxInappAdapter.prototype.toString = function() {
    return '<FxInappAdapter at ' + (this.api && this.api.baseUrl) + '>';
  };

  FxInappAdapter.prototype.configure = function(settings) {
    //
    // Adds a configuration hook for when settings change.
    //
    // This is called when settings are first intialized
    // and also whenever settings are reconfigured.
    //
    this.settings = settings;
    this.api = new api.API(settings.apiUrlBase);
    settings.log.info('configuring Firefox Marketplace In-App adapter');
  };

  FxInappAdapter.prototype.startTransaction = function(opt, callback) {
    //
    // Start a transaction.
    //
    // The `opt` object contains the following parameters:
    //
    // - productId: the ID of the product purchased.
    //
    // When finished, execute callback(error, transactionData).
    //
    // - error: an error if one occurred or null if not
    // - transactionData: an object that describes the transaction.
    //   This can be specific to your adapter but must include
    //   the `productJWT` parameter which is a JSON Web Token
    //   that can be passed to navigator.mozPay().
    //
    opt = utils.defaults(opt, {
      productId: null
    });
    var settings = this.settings;
    this.api.post(settings.prepareJwtApiUrl, {inapp: opt.productId},
                  function(err, productData) {
      if (err) {
        return callback(err);
      }
      settings.log.debug('requested JWT for ', opt.productId, 'from API; got:',
                         productData);
      return callback(null, {productJWT: productData.webpayJWT,
                             productId: opt.productId,
                             productData: productData});
    });
  };

  FxInappAdapter.prototype.transactionStatus = function(transData, callback) {
    //
    // Get the status of a transaction.
    //
    // The `transData` object received is the same one returned by
    // startTransaction().
    //
    // When finished, execute callback(error, isCompleted, productInfo).
    //
    // - error: an error if one occurred or null if not.
    // - isCompleted: true or false if the transaction has been
    //   completed successfully.
    // - productInfo: an object that describes the product purchased.
    //   If there was an error or the transaction was not completed,
    //   this can be null.
    //   A productInfo object should have the propeties described at:
    //
    //   https://developer.mozilla.org/en-US/Marketplace/Monetization
    //   /In-app_payments_section/fxPay_iap#Product_Info_Object
    //
    var self = this;
    var url = self.api.url(transData.productData.contribStatusURL,
                           {versioned: false});
    self.api.get(url, function(err, data) {
      if (err) {
        return callback(err);
      }

      if (data.status === 'complete') {
        self._finishTransaction(data, transData.productId,
                                function(err, productInfo) {
          if (err) {
            return callback(err);
          }
          callback(null, true, productInfo);
        });
      } else if (data.status === 'incomplete') {
        return callback(null, false);
      } else {
        return callback(errors.ConfigurationError(
                          'transaction status ' + data.status + ' from ' +
                           url + ' was unexpected'));
      }
    });
  };

  FxInappAdapter.prototype._finishTransaction = function(data, productId,
                                                         callback) {
    //
    // Private helper method to finish transactionStatus().
    //
    var settings = this.settings;
    settings.log.info('received completed transaction:', data);

    receipts.add(data.receipt, function(err) {
      if (err) {
        return callback(err);
      }
      products.getById(productId, function(err, fullProductInfo) {
        if (err) {
          return callback(err, fullProductInfo);
        }
        callback(null, fullProductInfo);
      }, {
        // If this is a purchase for fake products, only fetch stub products.
        fetchStubs: settings.fakeProducts,
      });
    });
  };

  exports.FxInappAdapter = FxInappAdapter;

});

define('settings',[
  'exports',
  'adapter',
  'errors'
], function(exports, adapter, errors) {

  'use strict';
  var pkgInfo = {"version": "0.0.16"};  // this is updated by `grunt bump`

  var defaultSettings = {

    // Public settings.
    //
    // Reject test receipts which are generated by the Marketplace
    // and do not indicate real purchases.
    allowTestReceipts: false,
    apiUrlBase: 'https://marketplace.firefox.com',
    apiVersionPrefix: '/api/v1',
    // When truthy, this will override the API object's default.
    apiTimeoutMs: null,
    // When defined, this optional map will override or
    // append values to payProviderUrls.
    extraProviderUrls: null,
    // When true, work with fake products and test receipts.
    // This implies allowTestReceipts=true.
    fakeProducts: false,
    // This object is used for all logging.
    log: window.console || {
      // Shim in a minimal set of the console API.
      debug: function() {},
      error: function() {},
      info: function() {},
      log: function() {},
      warn: function() {},
    },
    // Only these receipt check services are allowed.
    receiptCheckSites: [
      'https://receiptcheck.marketplace.firefox.com',
      'https://marketplace.firefox.com'
    ],

    // Private settings.
    //
    adapter: null,
    // This will be the App object returned from mozApps.getSelf().
    // On platforms that do not implement mozApps it will be false.
    appSelf: null,
    // True if configuration has been run at least once.
    alreadyConfigured: false,
    // Map of product IDs to installed receipts.
    // These receipts may or may not be valid.
    productReceiptMap: null,
    // Map of JWT types to payment provider URLs.
    payProviderUrls: {
      'mozilla/payments/pay/v1':
          'https://marketplace.firefox.com/mozpay/?req={jwt}'
    },
    // Reference window so tests can swap it out with a stub.
    window: window,
    // Width for payment window as a popup.
    winWidth: 276,
    // Height for payment window as a popup.
    winHeight: 384,
    // Relative API URL that accepts a product ID and returns a JWT.
    prepareJwtApiUrl: '/webpay/inapp/prepare/',
    onerror: function(err) {
      throw err;
    },
    oninit: function() {
      exports.log.info('fxpay version:', exports.libVersion);
      exports.log.info('initialization ran successfully');
    },
    onrestore: function(error, info) {
      if (error) {
        exports.log.error('error while restoring product:', info.productId,
                          'message:', error);
      } else {
        exports.log.info('product', info.productId,
                         'was restored from receipt');
      }
    },
    localStorage: window.localStorage || null,
    localStorageKey: 'fxpayReceipts',
    // When true, we're running on a broken webRT. See bug 1133963.
    onBrokenWebRT: (navigator.mozPay &&
                    navigator.userAgent.indexOf('Mobile') === -1),
    mozPay: navigator.mozPay || null,
    mozApps: navigator.mozApps || null,
    libVersion: pkgInfo.version,
  };

  exports.configure = function settings_configure(newSettings, opt) {
    //
    // Configure new settings values.
    //
    opt = opt || {};

    // On first run, we always need to reset.
    if (!exports.alreadyConfigured) {
      opt.reset = true;
    }

    // Reset existing configuration.
    if (opt.reset) {
      for (var def in defaultSettings) {
        exports[def] = defaultSettings[def];
      }
    }

    // Merge new values into existing configuration.
    for (var param in newSettings) {
      if (typeof exports[param] === 'undefined') {
        return exports.onerror(errors.IncorrectUsage(
                      'configure() received an unknown setting: ' + param));
      }
      exports[param] = newSettings[param];
    }

    // Set some implied values from other parameters.
    if (exports.extraProviderUrls) {
      exports.log.info('adding extra pay provider URLs',
                       exports.extraProviderUrls);
      for (var paySpec in exports.extraProviderUrls) {
        exports.payProviderUrls[paySpec] = exports.extraProviderUrls[paySpec];
      }
    }
    if (exports.fakeProducts) {
      exports.allowTestReceipts = true;
    }

    // Construct our in-app payments adapter.
    var DefaultAdapter = adapter.FxInappAdapter;
    if (!exports.adapter) {
      exports.log.info('creating default adapter');
      exports.adapter = new DefaultAdapter();
    }

    // Configure the new adapter or re-configure an existing adapter.
    exports.adapter.configure(exports);
    exports.log.info('using adapter:', exports.adapter.toString());

    exports.log.info('(re)configuration completed; fxpay version:',
                     exports.libVersion);
    exports.alreadyConfigured = true;

    return exports;
  };


  exports.initialize = function(newSettings) {
    //
    // A hook to ensure that settings have been initialized.
    // Any public fxpay method that a user may call should call
    // this at the top. It can be called repeatedly without harm.
    //
    // When a newSettings object is defined, all settings will be
    // reconfigured with those values.
    //
    if (typeof newSettings === 'object' && newSettings) {
      exports.configure(newSettings);
    } else if (!exports.alreadyConfigured) {
      exports.configure();
    }
  };

});

define('errors',[
  'exports',
  'settings'
], function(exports, settings) {

  'use strict';

  exports.createError = createError;

  // All error classes will implicitly inherit from this.
  exports.FxPayError = createError('FxPayError');

  exportErrors([
    ['ConfigurationError'],
    ['FailedWindowMessage'],
    ['IncorrectUsage'],
    ['InvalidApp'],
    ['InvalidJwt'],
    ['NotImplementedError'],
    ['PayWindowClosedByUser', {code: 'DIALOG_CLOSED_BY_USER'}],
    ['UnknownMessageOrigin'],
  ]);


  exports.PaymentFailed = createError('PaymentFailed');

  exportErrors([
    ['AppReceiptMissing'],
    ['InvalidReceipt'],
    ['PurchaseTimeout'],
    ['TestReceiptNotAllowed'],
  ], {
    inherits: exports.PaymentFailed,
  });


  exports.PlatformError = createError('PlatformError');

  exportErrors([
    ['AddReceiptError'],
    ['PayPlatformError'],
    ['PayPlatformUnavailable'],
  ], {
    inherits: exports.PlatformError,
  });


  exports.ApiError = createError('ApiError');

  exportErrors([
    ['ApiRequestAborted'],
    ['ApiRequestError'],
    ['ApiRequestTimeout'],
    ['BadApiResponse'],
    ['BadJsonResponse'],
  ], {
    inherits: exports.ApiError,
  });


  function createError(name, classOpt) {
    classOpt = classOpt || {};
    var errorParent = classOpt.inherits || exports.FxPayError || Error;

    function CreatedFxPayError(message, opt) {
      opt = opt || {};

      if (!(this instanceof CreatedFxPayError)) {
        // Let callers create instances without `new`.
        var obj = Object.create(CreatedFxPayError.prototype);
        return CreatedFxPayError.apply(obj, arguments);
      }
      this.message = message;
      this.stack = (new Error()).stack;
      if (opt.code) {
        this.code = opt.code;
      }

      // Some code will attach a productInfo object
      // on to the exception before throwing.
      // This object contains information such as
      // the exact reason why a receipt was invalid.
      this.productInfo = opt.productInfo || {};
      var logger = settings.log || console;
      logger.error(this.toString());

      return this;
    }

    CreatedFxPayError.prototype = Object.create(errorParent.prototype);
    CreatedFxPayError.prototype.name = name;

    if (classOpt.code) {
      CreatedFxPayError.prototype.code = classOpt.code;
    }

    CreatedFxPayError.prototype.toString = function() {
      var str = Error.prototype.toString.call(this);
      if (this.code) {
        str += ' {code: ' + this.code + '}';
      }
      return str;
    };

    return CreatedFxPayError;
  }


  function exportErrors(errList, defaultOpt) {
    errList.forEach(function(errArgs) {
      var cls = errArgs[0];
      var opt = defaultOpt || {};
      if (errArgs[1]) {
        Object.keys(errArgs[1]).forEach(function(optKey) {
          opt[optKey] = errArgs[1][optKey];
        });
      }
      // Export the created error class.
      exports[cls] = createError.call(this, cls, opt);
    });
  }

});

define('jwt',[
  'exports',
  'errors',
  'settings'
], function(exports, errors, settings) {

  'use strict';

  // This is a very minimal JWT utility. It does not validate signatures.

  exports.decode = function jwt_decode(jwt, callback) {
    var parts = jwt.split('.');

    if (parts.length !== 3) {
      settings.log.debug('JWT: not enough segments:', jwt);
      return callback(errors.InvalidJwt('JWT does not have 3 segments'));
    }

    var jwtData = parts[1];
    // Normalize URL safe base64 into regular base64.
    jwtData = jwtData.replace("-", "+", "g").replace("_", "/", "g");
    var jwtString;
    try {
      jwtString = atob(jwtData);
    } catch (error) {
      return callback(errors.InvalidJwt(
                        'atob() error: ' + error.toString() +
                        ' when decoding JWT ' + jwtData));
    }
    var data;

    try {
      data = JSON.parse(jwtString);
    } catch (error) {
      return callback(errors.InvalidJwt(
                        'JSON.parse() error: ' + error.toString() +
                        ' when parsing ' + jwtString));
    }
    callback(null, data);
  };


  exports.getPayUrl = function jwt_getPayUrl(encodedJwt, callback) {
    exports.decode(encodedJwt, function(err, jwtData) {
      if (err) {
        return callback(err);
      }

      var payUrl = settings.payProviderUrls[jwtData.typ];
      if (!payUrl) {
        return callback(errors.InvalidJwt(
                          'JWT type ' + jwtData.typ +
                          ' does not map to any known payment providers'));
      }
      if (payUrl.indexOf('{jwt}') === -1) {
        return callback(errors.ConfigurationError(
                          'JWT type ' + jwtData.typ +
                          ' pay URL is formatted incorrectly: ' + payUrl));
      }

      payUrl = payUrl.replace('{jwt}', encodedJwt);
      settings.log.info('JWT', jwtData.typ, 'resulted in pay URL:', payUrl);
      callback(null, payUrl);
    });
  };

});

define('pay',[
  'exports',
  'errors',
  'jwt',
  'settings',
  'utils'
], function(exports, errors, jwt, settings, utils) {

  'use strict';

  var timer;

  exports.processPayment = function pay_processPayment(jwt, callback, opt) {
    opt = utils.defaults(opt, {
      managePaymentWindow: true,
      paymentWindow: undefined,
    });

    if (settings.mozPay) {
      settings.log.info('processing payment with mozPay using jwt', jwt);

      var payReq = settings.mozPay([jwt]);

      payReq.onerror = function mozPay_onerror() {
        settings.log.error('mozPay: received onerror():', this.error.name);
        if (settings.onBrokenWebRT &&
            this.error.name === 'USER_CANCELLED') {
          // This is a workaround for bug 1133963.
          settings.log.warn(
            'webRT: pretending the cancel message is actually a success!');
          callback();
        } else {
          callback(errors.PayPlatformError(
                                'mozPay error: ' + this.error.name,
                                {code: this.error.name}));
        }
      };

      payReq.onsuccess = function mozPay_onsuccess() {
        settings.log.debug('mozPay: received onsuccess()');
        callback();
      };

    } else {
      if (!opt.paymentWindow) {
        return callback(errors.IncorrectUsage(
                          'Cannot start a web payment without a ' +
                          'reference to the payment window'));
      }
      settings.log.info('processing payment with web flow');
      return processWebPayment(opt.paymentWindow, opt.managePaymentWindow,
                               jwt, callback);
    }
  };


  exports.acceptPayMessage = function pay_acceptPayMessage(event,
                                                           allowedOrigin,
                                                           paymentWindow,
                                                           callback) {
    settings.log.debug('received', event.data, 'from', event.origin);

    if (event.origin !== allowedOrigin) {
      return callback(errors.UnknownMessageOrigin(
                  'ignoring message from foreign window at ' + event.origin));
    }
    var eventData = event.data || {};

    if (eventData.status === 'unloaded') {
      // Look for the window having been closed.
      if (timer) {
        window.clearTimeout(timer);
      }
      // This delay is introduced so that the closed property
      // of the window has time to be updated.
      timer = window.setTimeout(function(){
        if (!paymentWindow || paymentWindow.closed === true) {
          return callback(
              errors.PayWindowClosedByUser('Window closed by user'));
        }
      }, 300);
    } else if (eventData.status === 'ok') {
      settings.log.info('received pay success message from window at',
                        event.origin);
      return callback();
    } else if (eventData.status === 'failed') {
      return callback(errors.FailedWindowMessage(
                'received pay fail message with status=' + eventData.status +
                ', code=' + eventData.errorCode + ' from window at ' +
                event.origin, {code: eventData.errorCode}));
    } else {
      return callback(errors.FailedWindowMessage(
                          'received pay message with unknown status ' +
                          eventData.status + ' from window at ' +
                          event.origin));
    }
  };


  function processWebPayment(paymentWindow, managePaymentWindow, payJwt,
                             callback) {
    jwt.getPayUrl(payJwt, function(err, payUrl) {
      if (err) {
        return callback(err);
      }
      // Now that we've extracted a payment URL from the JWT,
      // load it into the freshly created popup window.
      paymentWindow.location = payUrl;

      // This interval covers closure of the popup
      // whilst on external domains that won't postMessage
      // onunload.
      var popupInterval = setInterval(function() {
        if (!paymentWindow || paymentWindow.closed) {
          clearInterval(popupInterval);
          return callback(errors.PayWindowClosedByUser(
                              'polling detected a closed window'));
        }
      }, 500);

      function receivePaymentMessage(event) {

        function messageCallback(err) {
          if (err instanceof errors.UnknownMessageOrigin) {
            // These could come from anywhere so ignore them.
            return;
          }

          // We know if we're getting messages from our UI
          // at this point so we can do away with the
          // interval watching for the popup closing
          // whilst on 3rd party domains.
          if (popupInterval) {
            clearInterval(popupInterval);
          }

          settings.window.removeEventListener('message',
                                              receivePaymentMessage);
          if (managePaymentWindow) {
            paymentWindow.close();
          } else {
            settings.log.info('payment window should be closed but client ' +
                              'is managing it');
          }
          if (err) {
            return callback(err);
          }
          callback();
        }

        exports.acceptPayMessage(event, utils.getUrlOrigin(payUrl),
                                 paymentWindow, messageCallback);
      }

      settings.window.addEventListener('message', receivePaymentMessage);

    });
  }
});

define('fxpay',[
  'exports',
  'errors',
  'promise',
  'pay',
  'receipts',
  'products',
  'settings',
  'utils'
], function(exports, errors, promise, pay,
            receipts, products, settings, utils) {

  'use strict';

  //
  // publicly exported functions:
  //

  var Promise = promise.Promise;

  exports.errors = errors;
  exports.settings = settings;

  exports.configure = function() {
    return settings.configure.apply(settings, arguments);
  };


  exports.init = function _init(opt) {
    settings.initialize(opt);
    utils.logDeprecation(
      'fxpay.init() is no longer supported; use ' +
      'fxpay.getProducts()...product.validateReceipt() instead', '0.0.15');

    exports.getProducts()
      .then(function(products) {
        products.forEach(function(product) {

          if (product.hasReceipt()) {
            product.validateReceipt().then(function(productInfo) {
              settings.onrestore(null, productInfo);
            }).catch(function(error) {
              settings.onrestore(error, error.productInfo);
            });
          }

        });
      })
      .then(settings.oninit)
      .catch(settings.onerror);

  };


  exports.validateAppReceipt = function validateAppReceipt() {
    settings.initialize();
    return new Promise(function(resolve, reject) {
      utils.getAppSelf(function(error, appSelf) {
        if (error) {
          return reject(error);
        }
        if (!appSelf) {
          return reject(errors.PayPlatformUnavailable(
                              'mozApps.getSelf() required for receipts'));
        }
        var allAppReceipts = [];

        receipts.all(function(error, allReceipts) {
          if (error) {
            return reject(error);
          }

          allReceipts.forEach(function(receipt) {
            var storedata = receipts.checkStoreData(receipt);
            if (!storedata) {
              settings.log.info(
                'ignoring receipt with missing or unparsable storedata');
              return;
            }
            if (storedata.inapp_id) {
              settings.log.info('ignoring in-app receipt with storedata',
                                storedata);
              return;
            }
            allAppReceipts.push(receipt);
          });

          settings.log.info('app receipts found:', allAppReceipts.length);

          var appReceipt;

          if (allAppReceipts.length === 0) {
            return reject(errors.AppReceiptMissing(
                                'no receipt found in getSelf()'));
          } else if (allAppReceipts.length === 1) {
            appReceipt = allAppReceipts[0];
            settings.log.info('Installed receipt:', appReceipt);
            return receipts.validateAppReceipt(appReceipt,
                                               function(error, productInfo) {
              settings.log.info('got verification result for', productInfo);
              if (error) {
                error.productInfo = productInfo;
                reject(error);
              } else {
                resolve(productInfo);
              }
            });
          } else {
            // TODO: support multiple app stores? bug 1134739.
            // This is an unlikely case where multiple app receipts are
            // installed.
            return reject(errors.NotImplementedError(
                'multiple app receipts were found which is not yet supported'));
          }
        });
      });
    });
  };


  exports.purchase = function _purchase(productId) {
    settings.initialize();
    var callback;
    var opt;

    if (typeof arguments[1] === 'function') {
      // Old style: fxpay.purchase(productId, callback, opt)
      callback = arguments[1];
      opt = arguments[2];
    } else {
      // New style: fxpay.purchase(productId, opt);
      opt = arguments[1];
    }

    opt = utils.defaults(opt, {
      maxTries: undefined,
      managePaymentWindow: undefined,
      paymentWindow: undefined,
      pollIntervalMs: undefined,
    });

    settings.initialize();

    var promise = new Promise(function(resolve, reject) {
      if (typeof opt.managePaymentWindow === 'undefined') {
        // By default, do not manage the payment window when a custom
        // window is defined. This means the client must close its own window.
        opt.managePaymentWindow = !opt.paymentWindow;
      }

      var partialProdInfo = new products.Product({productId: productId});
      settings.log.debug('starting purchase for product', productId);

      if (!settings.mozPay) {
        if (!opt.paymentWindow) {
          // Open a blank payment window on the same event loop tick
          // as the click handler. This avoids popup blockers.
          opt.paymentWindow = utils.openWindow();
        } else {
          settings.log.info('web flow will use client provided payment window');
          utils.reCenterWindow(opt.paymentWindow,
                               settings.winWidth, settings.winHeight);
        }
      }

      function closePayWindow() {
        if (opt.paymentWindow && !opt.paymentWindow.closed) {
          if (opt.managePaymentWindow) {
            opt.paymentWindow.close();
          } else {
            settings.log.info('payment window should be closed but client ' +
                              'is managing it');
          }
        }
      }

      settings.adapter.startTransaction({productId: productId},
                                        function(err, transData) {
        if (err) {
          closePayWindow();
          err.productInfo = partialProdInfo;
          return reject(err);
        }
        pay.processPayment(transData.productJWT, function(err) {
          if (err) {
            closePayWindow();
            err.productInfo = partialProdInfo;
            return reject(err);
          }

          // The payment flow has completed and the window has closed.
          // Wait for payment verification.

          waitForTransaction(
            transData,
            function(err, fullProductInfo) {
              if (err) {
                err.productInfo = partialProdInfo;
                reject(err);
              } else {
                resolve(fullProductInfo);
              }
            }, {
              maxTries: opt.maxTries,
              pollIntervalMs: opt.pollIntervalMs
            }
          );
        }, {
          managePaymentWindow: opt.managePaymentWindow,
          paymentWindow: opt.paymentWindow,
        });
      });
    });

    if (callback) {
      utils.logDeprecation(
        'purchase(id, callback) is no longer supported; use the returned ' +
        'promise instead', '0.0.15');
      promise.then(function(productInfo) {
        callback(null, productInfo);
      }).catch(function(error) {
        callback(error, error.productInfo || new products.Product());
      });
    }

    return promise;
  };


  exports.getProduct = function getProduct() {
    settings.initialize();
    return products.get.apply(products, arguments);
  };


  exports.getProducts = function getProducts() {
    settings.initialize();
    return products.all.apply(products, arguments);
  };


  //
  // private functions:
  //


  // NOTE: if you change this function signature, change the setTimeout below.
  function waitForTransaction(transData, cb, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || 10;
    opt.pollIntervalMs = opt.pollIntervalMs || 1000;
    opt._tries = opt._tries || 1;

    var log = settings.log;
    log.debug('Getting transaction state for', transData,
              'tries=', opt._tries);

    if (opt._tries > opt.maxTries) {
      log.error('Giving up on transaction for', transData,
                'after', opt._tries, 'tries');
      return cb(errors.PurchaseTimeout(
                        'timeout while waiting for completed transaction'));
    }

    settings.adapter.transactionStatus(
        transData, function(err, isComplete, productInfo) {
      if (err) {
        return cb(err);
      }
      if (isComplete) {
        return cb(null, productInfo);
      } else {
        log.debug('Re-trying incomplete transaction in',
                  opt.pollIntervalMs, 'ms');
        window.setTimeout(function() {
          waitForTransaction(transData, cb, {
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs,
            _tries: opt._tries + 1
          });
        }, opt.pollIntervalMs);
      }
    });
  }

});


  return require('fxpay');
}));

