import {Config as VgConfig} from 'vega';
import {Config as VlConfig} from 'vega-lite';

export type ConfigA = VgConfig;
export type ConfigB = VlConfig;

export type Config = ConfigA | ConfigB;

export type GlimpseTheme = VlConfig;
