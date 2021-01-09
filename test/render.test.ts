
import * as glimpseviz from '../src/index';
import * as glance from '../src/render';
import * as vg from 'vega';
import * as vgg from 'vega-lite';

import {TopLevelSpec as GlimpseViz} from 'vega-lite';
import {compile as compileGrammar} from 'vega-lite';


describe('rendering', () => {
  describe('specs', () => {
    it('should render array', () => {
      var spec = {
        'mark': 'bar',
        'data': {
          'name': 'table',
          'values': [1, 2, 3, 4]
        },
        'encoding': {
          'x': {'field': '0'}
        }
      };

      // need canvas in order to run, but jest-puppeteer seems to cause other test issues

      expect(glance.version).toBe("1.0");

      let rendered = glance.render({
        'spec': spec,
        'returnSVG': true,
        'returnCanvas': false,
        'returnData': false,
        'returnScenegraph': true,
        'opts': {
          'mode': 'vega-lite',
          'renderer': 'svg'
        }
      });

      expect(rendered).toStrictEqual({});


      // var vegaSpec = opts['vegaSpec'];
      // var vegaLiteSpec = opts['spec'];
      // var data = opts['data'];
      // var elementID = opts['elementID'];
      // var returnSVG = opts['returnSVG'];
      // var returnScenegraph = opts['returnScenegraph'];
      // var returnCanvas = opts['returnCanvas'];
      // var returnData = opts['returnData'];

    });
  });
});
