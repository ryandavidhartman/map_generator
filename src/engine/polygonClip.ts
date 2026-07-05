// Thin, isolated wrapper around the `polygon-clipping` package to work around a real bug in
// its published build: the bundled .d.ts declares named exports (`export function
// intersection(...)`), but the actual ESM bundle only exports a single `default` object
// containing those functions (confirmed by direct testing under Vite's ESM-native module
// loading — `import { intersection } from 'polygon-clipping'` typechecks but is `undefined` at
// runtime). Isolating the workaround here means the rest of the app can just import a normal,
// correctly-typed function.
import * as polygonClippingNamespace from 'polygon-clipping'

export type Ring = polygonClippingNamespace.Ring
export type Polygon = polygonClippingNamespace.Polygon
export type MultiPolygon = polygonClippingNamespace.MultiPolygon

const polygonClipping = (
  (polygonClippingNamespace as unknown as { default?: typeof polygonClippingNamespace }).default ?? polygonClippingNamespace
) as typeof polygonClippingNamespace

export function intersectPolygons(a: Polygon, b: Polygon): MultiPolygon {
  return polygonClipping.intersection(a, b)
}
