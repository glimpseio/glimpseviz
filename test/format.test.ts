
import * as fs from 'fs';
import * as pako from 'pako';

import * as vg from 'vega';
import * as vgg from 'vega-lite';

import {TopLevelSpec as GlimpseViz} from 'vega-lite';
import {compile as compileGrammar} from 'vega-lite';

import {makeConfig} from '../src/index';
import {GlimpseTheme} from '../src/config';


describe('glimpse-format', () => {
  describe('load glimpse', () => {
    it('should load from uncompessed file.', () => {
      const contents: Uint8Array = fs.readFileSync("examples/glimpse/density.glimpse");
      // const uncompressed = pako.inflate(contents, {to: 'string'});
      const spec: GlimpseViz = JSON.parse(contents.toString());
      // console.log(spec);

      // console.log(spec.transform);

      const comp = compileGrammar(spec)

    });

    it('should load from compressed file.', () => {
      const contents: Uint8Array = fs.readFileSync("examples/glimpse/pareto.glimpse");
      const uncompressed: string = pako.inflate(contents, {to: 'string'});

      // console.log("uncompressed", uncompressed);

      const spec: GlimpseViz = JSON.parse(uncompressed);
      // console.log(spec);

      // const comp = compileGrammar(spec)

    });

    it('should compile.', () => {
      const theme: GlimpseTheme = {
        background: "red"
      };

      theme.background = 'green';

      const spec: GlimpseViz = {
        mark: 'bar',
        data: {
          values: [{"a": 1}, {"b": 2}, {"c": 3}]
        },
        transform: [
          {
            calculate: "1+2",
            as: "onePlusTwo"
          }
        ],
        encoding: {
          x: {field: 'a'}
        },
        config: theme
      };

      // console.log(JSON.stringify(spec));

      const comp = compileGrammar(spec)

      // console.log(JSON.stringify(comp));
    });
  });
});
