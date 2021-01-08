"use strict";
!function (world, gv, d3, vega, vegaLite, vegaEmbed) {
  var glance = {
    version: "1.0",
    gv: gv,
    d3: d3,
    vega: vega,
    vegaLite: vegaLite,
    vegaEmbed: vegaEmbed
  };

  // Renders the specified glance spec using the given options & data.
  glance.renderAsync = function (spec, opts, data) {
    let randomSeed = opts['randomSeed'];
    let returnData = opts['returnData'];

    if (typeof randomSeed === 'number') {
      // pre-render pass: initialize random number seed if we specified one
      gv.vg.setRandom(gv.vg.randomLCG(randomSeed));
    }

    let embedResult = vegaEmbed('#vz', spec, opts);
    return embedResult.then((result) => {
      handleRenderResult(result, data).runAsync();

      var obj = { 'msg': 'success' };
      if (returnData === true) {
        let view = result.view;
        // https://vega.github.io/vega/docs/api/view/#view_getState
        let state = view.getState({
          data: (name, dataset) => {
            return true;
          }, signals: (name, operator) => {
            return false;
          }, recurse: true
        });

        // this would be fastest, but we have some unserializable references in here
        // obj['data'] = state.data;
        obj['data'] = {};
        Object.keys(state.data).forEach(function (key) {
          // obj['data'][key] = view.data(key);
          try {
            if (typeof window._glance.lastReturnData !== 'object') {
              window._glance.lastReturnData = {};
            }

            // obj['data'][key] = JSON.parse(JSON.stringify(view.data(key)));
            let json = JSON.stringify(view.data(key)); // this may fail due to cycles
            if (window._glance.lastReturnData[key] == json) {
              // if the JSON is the same as we sent back last time, just send a null to signify that it is unchanged
              obj['data'][key] = null;
            } else {
              window._glance.lastReturnData[key] = json;
              obj['data'][key] = json;
            }
          } catch (e) {
            // some data tables have unserializable references
            obj['data'][key] = { "error": "Error: " + e };
          }
        });
      } else {
        window._glance.lastReturnData = {}; // no last return data
      }

      return obj;
    });
  };

  // very similar to vega.parse.spec, except it is synchronous and requires that there be no external resources to load
  // note that this is currently only used for headless synchronous evaluation
  glance.render = function (opts) {
    // JSC sends this as an array; unwap to the first element
    while (Object.prototype.toString.call(opts) == '[object Array]') {
      opts = opts[0];
    }

    if (typeof opts !== 'object') {
      throw Error("Options passed to glance.render is not an object");
    }

    var result = {}; // the result map, containing SVG, vega spec, etc.

    // console.log("rendering: " + JSON.stringify(opts));

    // can either specify a vega spec or a glance model
    var vegaSpec = opts['vegaSpec'];
    var vegaLiteSpec = opts['spec'];
    var data = opts['data'];
    var elementID = opts['elementID'];
    var returnSVG = opts['returnSVG'];
    var returnScenegraph = opts['returnScenegraph'];
    var returnCanvas = opts['returnCanvas'];
    var returnData = opts['returnData'];

    // compile a vega-lite spec into vega
    if (typeof vegaLiteSpec !== "undefined") {
      var vlspec = typeof vegaLiteSpec === "object"
        ? vegaLiteSpec : JSON.parse(vegaLiteSpec);
      vegaSpec = vegaLite.compile(vlspec).spec;
    }

    var chart = gv.vg.parse(vegaSpec);

    // some environments (like pure JavaScriptCore) don't have setTimeout,
    // so we fake it by adding all the timeouts to a stack and then
    // immediately flushing them at the end of this function
    var pseudoTimeouts = [];
    if (typeof global.setTimeout === "undefined") {
      global.setTimeout = function (f, delay) {
        pseudoTimeouts.push(f);
      };
    }

    try {
      var view = new gv.vg.View(chart);

      function evaluateData() {
        if (returnScenegraph === true) {
          result["scenegraph"] = view.scenegraph().toJSON();
        }
        var state = view.getState({ data: gv.vg.truthy, signals: gv.vg.falsy, recurse: true });
        var dataMap = state.data;

        var dataMapSafe = {}; // filtered data for values that can be serialized
        Object.keys(dataMap).forEach(function (key) {
          try {
            // the contents of the data map have circular dependencies, but view.data() does not.
            // however, we still need to use dataMap becuase it is the only way to get the data keys.
            // dataMapSafe[key] = JSON.parse(JSON.stringify(dataMap[key]));
            dataMapSafe[key] = JSON.parse(JSON.stringify(view.data(key)));
            // dataMapSafe[key] = view.data(key);
          } catch (e) {
            // some of the data cannot be placed in the map:
            // “JSON.stringify cannot serialize cyclic structures.”
            dataMapSafe[key] = [{ "error": "Error: " + e }];
          }
        });

        result["data"] = dataMapSafe;
      }

      if (returnSVG === true) {
        view.toSVG().then(function (svg) {
          result["svg"] = svg;
          if (returnData === true) {
            evaluateData(); // eval after running
          }
        }).catch(function (error) {
          result["error"] = error;
        });
      } else if (returnCanvas === true) {
        view.toCanvas().then(function (canvas) {
          result["canvas"] = canvas;
          if (returnData === true) {
            evaluateData(); // eval after running
          }
        }).catch(function (error) {
          result["error"] = error;
        });
      } else {
        // when we only want the data and not the rendering, perform a run get the data callback
        view.runAsync().then(function () {
          evaluateData();
        });
      }
    } catch (e) {
      // need to fill in decription as it is lost on throw
      e.description = e.toString();
      result["error"] = e;
    } finally {
      if (pseudoTimeouts.length > 0) { // flush the fake timeouts
        while (pseudoTimeouts.length > 0) { pseudoTimeouts.pop()(); }
        delete global.setTimeout; // restore the previous lack of setTimeout
      }
    }

    return result;
  };


  // Post callback in webkit environments
  function postcb(msg) {
    if (typeof window.webkit !== "undefined") {
      if (typeof window.webkit.messageHandlers === "object") {
        if (typeof window.webkit.messageHandlers['glanceCallback'] !== "undefined") {
          window.webkit.messageHandlers['glanceCallback'].postMessage(msg);
        }
      }
    }
  }

  // simple function to transform arrays-of-arrays into arrays-of-objects to allow for storing data values more compactly
  function array2obj(rowValues, keys) {
    return rowValues.reduce(function (acc, cur, idx) {
      acc[keys[idx]] = cur;
      return acc;
    }, {});
  }


  function handleRenderResult(result, data) {
    window._glance = window._glance || {};

    if (window && window._glance && window._glance.view) {
      window._glance.view.finalize(); // clean up view event handlers
    }

    window._glance.view = result.view;
    window._glance.spec = result.spec;

    if (data != null) { // we assigned new data; apply it
      window._glance.data = data;
    }

    // 'keydown', 'keypress', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'mouseout', 'mouseover', 'dragover', 'dragenter', 'dragleave', 'click', 'dblclick', 'wheel', 'mousewheel', 'touchstart', 'touchmove', 'touchend'
    const allEvents = ['dblclick'];

    function addEvents(view) {
      allEvents.forEach(key => {
        view = view.addEventListener(key, handleEvent);
      });
      return view
    }

    return addEvents(updateDatasets(window._glance.view, window._glance.data));
  }

  function handleEvent(e, d) {
    var msg = {
      'event': JSON.parse(JSON.stringify(e, ['vegaType', 'clientX', 'clientY']))
    };

    if (typeof d === 'object') {
      window._glance.lastEvent = d; // debugging

      // convert the entire scene to JSON
      msg['scene'] = JSON.parse(gv.vg.sceneToJSON(d));

      if (typeof d.mark === 'object') {
        msg['mark'] = JSON.parse(gv.vg.sceneToJSON(d.mark));

        if (typeof d.mark.group === 'object') {
          msg['group'] = JSON.parse(gv.vg.sceneToJSON(d.mark.group));
        }
      }

      msg['datum'] = JSON.parse(JSON.stringify(d['datum'] || null));

      // msg['bounds'] = JSON.parse(JSON.stringify(d['bounds'] || null)); // this is not the absolute position
      msg['bounds'] = d._svg.getBoundingClientRect().toJSON()

      // extract unique symbol value
      var symbolKey = Reflect.ownKeys(d).find(key => key.toString() === 'Symbol(vega_id)')
      msg['vega_id'] = JSON.parse(JSON.stringify(d[symbolKey] || null));
    }

    window._glance['lastEventMessage'] = msg;

    postcb(msg);
  }

  function arrays2objs(rows) {
    let keys = rows[0]; // first array is the key names
    return rows.slice(1).reduce(function (acc, cur) {
      acc.push(array2obj(cur, keys));
      return acc;
    }, []);
  }

  // updates the view datasets with the given data maps
  function updateDatasets(view, data) {
    for (let key in data || {}) {
      // we need to ensure that the data already exists in the runtime
      // or an error will be thrown
      if (view._runtime.data.hasOwnProperty(key)) {
        view = view.data(key, data[key]);
      }
    }
    return view;
  }


  if (typeof define === "function" && define.amd) define(glance); else if (typeof module === "object" && module.exports) module.exports = glance;
  world.glance = glance;
}(this, typeof (glimpseviz) == 'undefined' ? null : glimpseviz, typeof (d3) == 'undefined' ? null : d3, typeof (vega) == 'undefined' ? null : vega, typeof (vegaLite) == 'undefined' ? null : vegaLite, typeof (vegaEmbed) == 'undefined' ? null : vegaEmbed);
