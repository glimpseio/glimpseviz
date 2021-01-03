import {makeConfig} from '../src/index';


import {GlimpseTheme} from '../src/config';

// import {SignalRef} from 'vega';

import vg from 'vega';
import vgg from 'vega-lite';
import {TopLevelSpec as GlimpseViz} from 'vega-lite';

import {compile as compileGrammar} from 'vega-lite';

import {Table, FloatVector, DateVector, Float16Vector, Schema, RecordBatchJSONWriter, JSONMessageReader, RecordBatchStreamReader, ArrowJSONLike} from 'apache-arrow';

import pako from 'pako';

import fs from 'fs';
import path from 'path';

describe('glimpse-api', () => {
  describe('arithmitic', () => {
    it('should add numbers.', () => {
      expect(1 + 2).toBe(3);
    });

    it('should multiply numbers', () => {
      expect(1 * 2).toBe(2);
    });

    it('should divide numbers', () => {
      expect(1 / 2).toBe(0.5);
    });
  });

  describe('load glimpse', () => {
    it('should load from uncompessed file.', () => {
      const contents: Uint8Array = fs.readFileSync("examples/density.glimpse");
      // const uncompressed = pako.inflate(contents, {to: 'string'});
      const spec: GlimpseViz = JSON.parse(contents.toString());
      // console.log(spec);

      // console.log(spec.transform);

      const comp = compileGrammar(spec)

    });

    it('should load from compressed file.', () => {
      const contents: Uint8Array = fs.readFileSync("examples/pareto.glimpse");
      const uncompressed = pako.inflate(contents, {to: 'string'});

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

  describe('create arrow', () => {
    it('should deserialize from JSON.', () => {
      const table = Table.from("[1,2,3]");

      console.log("loaded table", table.get(0));
    });

    it('should serialize to JSON.', () => {
      const LENGTH = 11;
      const precipitationValues: Float32Array = Float32Array.from({length: LENGTH}, (_, i) => i); // Number((Math.random() * 20).toFixed(1)));
      const dateValues: Array<Date> = Array.from({length: LENGTH}, (_, i) => new Date('2020-12-12')); // new Date(Date.now() - 1000 * 60 * 60 * 24 * i));
      const rainfall = Table.new([FloatVector.from(precipitationValues), DateVector.from(dateValues)], ['precipitation', 'date']);

      expect(rainfall.count()).toBe(LENGTH);

      expect(rainfall.get(0).toJSON()).toStrictEqual({"date": new Date("2020-12-12T00:00:00.000Z"), "precipitation": 0});
      expect(rainfall.get(1).toJSON()).toStrictEqual({"date": new Date("2020-12-12T00:00:00.000Z"), "precipitation": 1});

      function writeJSON(table: Table): string {
        // note that `serialize(encoding = 'binary', stream = true)` should do this, but the 'json' encoding is not implemented
        const writer: RecordBatchJSONWriter = RecordBatchJSONWriter.writeAll(rainfall);
        const string = writer.toString(true);
        return string;
      }


      const rainfallJSON = writeJSON(rainfall);
      // console.log("JSON", rainfallJSON);
      const json: ArrowJSONLike = JSON.parse(rainfallJSON);

      expect(json.schema?.fields).toStrictEqual([{"children": [], "name": "precipitation", "nullable": true, "type": {"name": "floatingpoint", "precision": "SINGLE"}}, {"children": [], "name": "date", "nullable": true, "type": {"name": "date", "unit": "MILLISECOND"}}]);
      expect(json.batches?.length).toBe(1);
      expect(json.dictionaries).toBe(undefined);

      // json.pipe(process.stdout);

      // RecordBatchJSONReaderImpl();

      // RecordBatchStreamReader.
      // new JSONMessageReader(json);

      // const schema = Schema.new();
    });
  });
});
