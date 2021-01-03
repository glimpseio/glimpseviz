# glimpseviz

[![Build Status](https://github.com/glimpseio/glimpseviz/workflows/Test/badge.svg)]

## The Glimpse Format

The Glimpse format is a stand-alone file format, usually with the `.glimpse` suffix, that contains everything necessary to render a rich data visualization in modern browsers.

### Contents

Data in the .glimpse format consists of a single optionally-gzipped UTF-8 JSON string in the [Vega](https://vega.github.io/vega-lite/) grammer. The data is housed in the `usermeta`'s *"glimpse"* key in the form of [Apache Arrow](https://arrow.apache.org) buffer JSON. Resources required at runtime, such as fonts and images, are contained in a `resources` dictionary within the user metadata.


FIN




