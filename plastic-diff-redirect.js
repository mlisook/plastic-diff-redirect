// plastic-diff-redirect
//
// Chooses a 'build' from an array of 'builds' in polymer.json
// which is compatable with the current browser (like prpl-server-node)
// and redirects the client to that build.
//
// Based on code from the Polymer team:
//   - browser-capabilities  https://github.com/Polymer/tools/tree/master/packages/browser-capabilities
//   - prpl-server-node  https://github.com/Polymer/prpl-server-node
// Modified to run in the browser and downleveled to ES5.
//

(function() {
  /**
   * For sorting build browser requirements
   */
  capabilityValue = {
    push: 0, // HTTP/2 Server Push
    serviceworker: 1, // Service Worker API
    modules: 5, // JavaScript Modules (including dynamic import() and import.meta)
    es2015: 2, // ECMAScript 2015 (aka ES6)
    es2016: 3, // ECMAScript 2016
    es2017: 4, // ECMAScript 2017
    es2018: 5 // ECMAScript 2018
  };

  /**
   * Returns the capability matrix for supported browsers
   * @param {string} ua user agent string
   */
  function bcapData(ua) {
    var zchrome = {
      es2015: since(ua, 49),
      es2016: since(ua, 58),
      es2017: since(ua, 58),
      es2018: since(ua, 64),
      push: since(ua, 41),
      serviceworker: since(ua, 45),
      modules: since(ua, 64)
    };
    var mobileSafari = {
      es2015: since(ua, 10),
      es2016: since(ua, 10, 3),
      es2017: since(ua, 10, 3),
      es2018: function() {
        return false;
      },
      push: function(ua) {
        return versionAtLeast([9, 2], parseVersion(ua.getOS().version));
      },
      serviceworker: since(ua, 11, 3),
      modules: function(ua) {
        return versionAtLeast([11, 3], parseVersion(ua.getOS().version));
      }
    };

    return {
      browserPredicates: {
        Chrome: zchrome,
        Chromium: zchrome,
        "Chrome Headless": zchrome,
        OPR: {
          es2015: since(ua, 36),
          es2016: since(ua, 45),
          es2017: since(ua, 45),
          es2018: since(ua, 51),
          push: since(ua, 28),
          serviceworker: since(ua, 32),
          modules: since(ua, 48)
        },
        Vivaldi: {
          es2015: since(ua, 1),
          es2016: since(ua, 1, 14),
          es2017: since(ua, 1, 14),
          es2018: since(ua, 1, 14),
          push: since(ua, 1),
          serviceworker: since(ua, 1),
          modules: since(ua, 1, 14)
        },
        // Note that Safari intends to stop changing their user agent strings
        // (https://twitter.com/rmondello/status/943545865204989953). The details of
        // this are not yet clear, since recent versions do seem to be changing (at
        // least the OS bit). Be sure to actually test real user agents rather than
        // making assumptions based on release notes.
        "Mobile Safari": mobileSafari,

        Safari: {
          es2015: since(ua, 10),
          es2016: since(ua, 10, 1),
          es2017: since(ua, 10, 1),
          es2018: function() {
            return false;
          },
          push: function(ua) {
            return (
              versionAtLeast([9], parseVersion(ua.getBrowser().version)) &&
              // HTTP/2 on desktop Safari requires macOS 10.11 according to
              // caniuse.com.
              versionAtLeast([10, 11], parseVersion(ua.getOS().version))
            );
          },
          // https://webkit.org/status/#specification-service-workers
          serviceworker: since(ua, 11, 1),
          modules: since(ua, 11, 1)
        },
        Edge: {
          // Edge versions before 15.15063 may contain a JIT bug affecting ES6
          // constructors (https://github.com/Microsoft/ChakraCore/issues/1496).
          // Since this bug was fixed after es2016 and 2017 support, all these
          // versions are the same.
          es2015: since(ua, 15, 15063),
          es2016: since(ua, 15, 15063),
          es2017: since(ua, 15, 15063),
          es2018: function() {
            return false;
          },
          push: since(ua, 12),
          // https://developer.microsoft.com/en-us/microsoft-edge/platform/status/serviceworker/
          serviceworker: function() {
            return false;
          },
          modules: function() {
            return false;
          }
        },
        Firefox: {
          es2015: since(ua, 51),
          es2016: since(ua, 52),
          es2017: since(ua, 52),
          es2018: since(ua, 58),
          // Firefox bug - https://bugzilla.mozilla.org/show_bug.cgi?id=1409570
          push: function() {
            return false;
          },
          serviceworker: since(ua, 44),
          modules: function() {
            return false;
          }
        }
      }
    };
  }

  /**
   * Return the set of capabilities for a user agent string.
   */
  function browserCapabilities(userAgent) {
    var ua = new UAParser(userAgent);
    var capabilities = [];
    var browserName = ua.getBrowser().name;
    if (browserName === "Chrome" && ua.getOS().name === "iOS") {
      // Chrome on iOS is really Safari.
      browserName = "Mobile Safari";
    }
    var predicates = bcapData(ua).browserPredicates[browserName || ""] || {};
    var pKeys = Object.keys(predicates);
    for (var k = 0; k < pKeys.length; k++) {
      var capability = pKeys[k];
      if (predicates[capability](ua)) {
        capabilities.push(capability);
      }
    }
    return capabilities;
  }

  /**
   * Parse a "x.y.z" version string of any length into integer parts. Returns -1
   * for a part that doesn't parse.
   */
  function parseVersion(version) {
    if (version == null) {
      return [];
    }
    return version.split(".").map(function(part) {
      var i = parseInt(part, 10);
      return isNaN(i) ? -1 : i;
    });
  }

  /**
   * Return whether `version` is at least as high as `atLeast`.
   */
  function versionAtLeast(atLeast, version) {
    for (var i = 0; i < atLeast.length; i++) {
      var r = atLeast[i];
      var v = version.length > i ? version[i] : 0;
      if (v > r) {
        return true;
      }
      if (v < r) {
        return false;
      }
    }
    return true;
  }

  /**
   * Make a predicate that checks if the browser version is at least this high.
   */
  function since(ua, maj, min, patch) {
    var atLeast = [];
    if (!isNaN(maj)) {
      atLeast.push(maj);
      if (!isNaN(min)) {
        atLeast.push(min);
        if (!isNaN(patch)) {
          atLeast.push(patch);
        }
      }
    }
    return function(ua) {
      return versionAtLeast(atLeast, parseVersion(ua.getBrowser().version));
    };
  }

  /**
   * Return whether all requirements of this build are met by the given client
   * browser capabilities.
   */
  function canServe(clientCap, requirements) {
    var client = {};
    for (var i = 0; i < clientCap.length; i++) {
      client[clientCap[i]] = true;
    }
    for (var i = 0; i < requirements.length; i++) {
      var req = requirements[i];
      if (!client.hasOwnProperty(req)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Choose a build from the array of builds
   * @param {Array} builds array of build objects
   * @param {Array} clientCap array of client capabilities as strings
   */
  function chooseBuild(builds, clientCap) {
    requirementsValue(builds);
    builds.sort(function(a, b) {
      return b.__score - a.__score;
    });
    for (var i = 0; i < builds.length; i++) {
      if (
        !builds[i].hasOwnProperty("browserCapabilities") ||
        builds[i].browserCapabilities.length == 0 ||
        canServe(clientCap, builds[i].browserCapabilities)
      ) {
        return {
          name: builds[i].name,
          basePath: builds[i].basePath
        };
      }
    }
    return null;
  }

  /**
   * adds a score to use for sorting the builds array
   * @param {Array} builds
   */
  function requirementsValue(builds) {
    if (builds && builds.length > 0) {
      for (var i = 0; i < builds.length; i++) {
        var build = builds[i];
        var result = 0;
        if (build.browserCapabilities && build.browserCapabilities.length > 0) {
          for (var j = 0; j < build.browserCapabilities.length; j++) {
            if (capabilityValue.hasOwnProperty(build.browserCapabilities[j])) {
              result += capabilityValue[build.browserCapabilities[j]];
            }
          }
        }
        build.__score = result;
      }
    }
  }

  //
  // get the polymer.json file and choose a build based on that
  //
  var fName = "polymer.json";
  var cfgXmlhttp = new XMLHttpRequest();
  cfgXmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      var cfg = JSON.parse(this.responseText);
      var userAgent = navigator.userAgent;
      var cc = browserCapabilities(userAgent);
      var bld = chooseBuild(cfg.builds, cc);
      var loc = window.location.href.replace("index.html", "");
      var locParts = /^((\w+):)?(\/\/((\w+)?(:(\w+))?@)?([^\/\?:]+)(:(\d+))?)?(\/?([^\/\?#][^\?#]*)?)?(\?([^#]+))?(#(\w*))?/.exec(
        loc
      );
      var newLoc =
        locParts[2] + // protocol
        "://" +
        locParts[8] + // host
        (locParts[10] ? ":" + locParts[10] : "") + // port
        (bld.basePath
          ? bld.basePath.substring(0, 1) == "/"
            ? bld.basePath
            : "/" + bld.basePath
          : "/" + bld.name);
      window.location.assign(newLoc);
    }
  };
  cfgXmlhttp.open("GET", fName, true);
  cfgXmlhttp.send();
})();
