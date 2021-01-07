import pkg from '../package.json';
const version = pkg.version;

import {Config, ConfigA, ConfigB} from './config';
import {Table} from 'apache-arrow';
import {TopLevelSpec} from 'vega-lite';

export {version};

// export utilities
export * as vg from 'vega';
export * as vge from 'vega-embed';
export * as vgg from 'vega-lite';
export * as arrow from 'apache-arrow';

export function makeConfig(): Config {
  let cfga: ConfigA = {
  };
  let cfgb: ConfigB = {
  };

  return true ? cfga : cfgb
}

// export function makeTable(): Table {
//   let tab = Table.new()
//   return tab
// }

/// A Glimpse Specification
export type GlimpseSpec = TopLevelSpec;

/// The glimpse shell that contains a siz
export class GlimpseShell {
  public spec: GlimpseSpec;
  public dataTable: any;
  public renderOptions: any;
}
