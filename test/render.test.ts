
import * as glimpseviz from '../src/index';

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

      glimpseviz.glance.render({
        'spec': spec,
        'returnSVG': true,
        'returnCanvas': false,
        'returnData': false,
        'opts': {
          'mode': 'vega-lite',
          'renderer': 'svg'
        }
      });


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
