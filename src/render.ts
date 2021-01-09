import * as vg from 'vega';
import * as vgg from 'vega-lite';
import vegaEmbed from 'vega-embed';
// import Scenegraph from 'vega-scenegraph';

export var version = "1.0";

export function render(opts: any) {
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
    vegaSpec = vgg.compile(vlspec).spec;
  }

  var chart = vg.parse(vegaSpec);

  // some environments (like pure JavaScriptCore) don't have setTimeout,
  // so we fake it by adding all the timeouts to a stack and then
  // immediately flushing them at the end of this function
  var pseudoTimeouts: any[] = [];
  if (typeof global.setTimeout === "undefined") {
    var setTimeout: any = function (f: any, delay: number) {
      pseudoTimeouts.push(f);
    };
    global.setTimeout = setTimeout;
  }

  try {
    var view = new vg.View(chart);

    var evaluateData = function () {
      if (returnScenegraph === true) {
        result["scenegraph"] = sceneObject(view.scenegraph());
      }
      var state = view.getState({data: vg.truthy, signals: vg.falsy, recurse: true});
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
          dataMapSafe[key] = [{"error": "Error: " + e}];
        }
      });

      result["data"] = dataMapSafe;
    };

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
      while (pseudoTimeouts.length > 0) {pseudoTimeouts.pop()();}
      delete global.setTimeout; // restore the previous lack of setTimeout
    }
  }

  return result;
}


// Renders the specified glance spec using the given options & data.
export function renderAsync(spec: any, opts: any, data: any) {
  let randomSeed = opts['randomSeed'];
  let returnData = opts['returnData'];

  if (typeof randomSeed === 'number') {
    // pre-render pass: initialize random number seed if we specified one
    // TODO: fix failure to lookup…
    // vg.setRandom(vg.randomLCG(randomSeed));
  }

  let embedResult = vegaEmbed('#vz', spec, opts);
  return embedResult.then((result: any) => {
    handleRenderResult(result, data).runAsync();

    var obj = {'msg': 'success'};
    if (returnData === true) {
      let view = result.view;
      // https://vega.github.io/vega/docs/api/view/#view_getState
      let state = view.getState({
        data: (name: any, dataset: any) => {
          return true;
        }, signals: (name: any, operator: any) => {
          return false;
        }, recurse: true
      });

      // this would be fastest, but we have some unserializable references in here
      // obj['data'] = state.data;
      obj['data'] = {};
      Object.keys(state.data).forEach(function (key) {
        // obj['data'][key] = view.data(key);
        try {
          if (typeof window[glanceKey].lastReturnData !== 'object') {
            window[glanceKey].lastReturnData = {};
          }

          // obj['data'][key] = JSON.parse(JSON.stringify(view.data(key)));
          let json = JSON.stringify(view.data(key)); // this may fail due to cycles
          if (window[glanceKey].lastReturnData[key] == json) {
            // if the JSON is the same as we sent back last time, just send a null to signify that it is unchanged
            obj['data'][key] = null;
          } else {
            window[glanceKey].lastReturnData[key] = json;
            obj['data'][key] = json;
          }
        } catch (e) {
          // some data tables have unserializable references
          obj['data'][key] = {"error": "Error: " + e};
        }
      });
    } else {
      window[glanceKey].lastReturnData = {}; // no last return data
    }

    return obj;
  });
}


// Post callback in webkit environments
function postcb(msg: any) {
  if (typeof window['webkit'] !== "undefined") {
    if (typeof window['webkit'].messageHandlers === "object") {
      if (typeof window['webkit'].messageHandlers['glanceCallback'] !== "undefined") {
        window['webkit'].messageHandlers['glanceCallback'].postMessage(msg);
      }
    }
  }
}

// simple function to transform arrays-of-arrays into arrays-of-objects to allow for storing data values more compactly
function array2obj(rowValues: any[], keys: any[]) {
  return rowValues.reduce(function (acc, cur, idx) {
    acc[keys[idx]] = cur;
    return acc;
  }, {});
}

// updates the view datasets with the given data maps
function updateDatasets(view: any, data: any) {
  for (let key in data || {}) {
    // we need to ensure that the data already exists in the runtime
    // or an error will be thrown
    if (view._runtime.data.hasOwnProperty(key)) {
      view = view.data(key, data[key]);
    }
  }
  return view;
}

let glanceKey = '_glance';

function handleRenderResult(result: any, data: any) {
  window[glanceKey] = window[glanceKey] || {};

  if (window && window[glanceKey] && window[glanceKey].view) {
    window[glanceKey].view.finalize(); // clean up view event handlers
  }

  window[glanceKey].view = result.view;
  window[glanceKey].spec = result.spec;

  if (data != null) { // we assigned new data; apply it
    window[glanceKey].data = data;
  }

  // 'keydown', 'keypress', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'mouseout', 'mouseover', 'dragover', 'dragenter', 'dragleave', 'click', 'dblclick', 'wheel', 'mousewheel', 'touchstart', 'touchmove', 'touchend'
  const allEvents = ['dblclick'];

  function addEvents(view: any) {
    allEvents.forEach(key => {
      view = view.addEventListener(key, handleEvent);
    });
    return view
  }

  return addEvents(updateDatasets(window[glanceKey].view, window[glanceKey].data));
}

function sceneObject(ob: any): any {
  // TODO: figure out how to use Scenegraph
  // return JSON.parse(vg.sceneToJSON(ob));
  return JSON.parse(JSON.stringify(ob));
}

function handleEvent(e: any, d: any) {
  var msg = {
    'event': JSON.parse(JSON.stringify(e, ['vegaType', 'clientX', 'clientY']))
  };

  if (typeof d === 'object') {
    window[glanceKey].lastEvent = d; // debugging

    // convert the entire scene to JSON
    msg['scene'] = sceneObject(d);

    if (typeof d.mark === 'object') {
      msg['mark'] = sceneObject(d.mark);

      if (typeof d.mark.group === 'object') {
        msg['group'] = sceneObject(d.mark.group);
      }
    }

    msg['datum'] = JSON.parse(JSON.stringify(d['datum'] || null));

    // msg['bounds'] = JSON.parse(JSON.stringify(d['bounds'] || null)); // this is not the absolute position
    msg['bounds'] = d._svg.getBoundingClientRect().toJSON()

    // extract unique symbol value
    var symbolKey = Reflect.ownKeys(d).find(key => key.toString() === 'Symbol(vega_id)')
    msg['vega_id'] = JSON.parse(JSON.stringify(d[symbolKey] || null));
  }

  window[glanceKey]['lastEventMessage'] = msg;

  postcb(msg);
}

function arrays2objs(rows: any[]) {
  let keys = rows[0]; // first array is the key names
  return rows.slice(1).reduce(function (acc, cur) {
    acc.push(array2obj(cur, keys));
    return acc;
  }, []);
}




