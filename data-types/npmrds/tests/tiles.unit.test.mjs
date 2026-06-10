/**
 * Unit tests for the per-year layer-view tiles metadata builder + the
 * remove-flow tile pruning. Shape pinned from legacy metadata.worker.mjs
 * (makeTiles) and publish.route.js (removeByYear).
 */
import { describe, it, expect } from 'vitest';
import { makeTiles, removeByYear } from '../tiles.js';

describe('makeTiles', () => {
  const tiles = makeTiles({
    pgEnv: 'npmrds2',
    prodURL: 'https://graph.example.org',
    sourceId: 9,
    viewId: 40,
    year: 2023,
    timestamp: 1700000000000,
  });

  it('builds one vector pbf source keyed by the timestamped tileset name', () => {
    expect(tiles.sources.length).toBe(1);
    expect(tiles.sources[0].id).toBe('npmrds2_s9_v40_2023_1700000000000');
    expect(tiles.sources[0].source.type).toBe('vector');
    expect(tiles.sources[0].source.format).toBe('pbf');
    expect(tiles.sources[0].source.tiles).toEqual([
      'https://graph.example.org/dama-admin/npmrds2/tiles/40/{z}/{x}/{y}/t.pbf?cols=tmc&filter=year=2023',
    ]);
  });

  it('builds the line layer bound to view_{viewId}', () => {
    expect(tiles.layers.length).toBe(1);
    expect(tiles.layers[0]).toEqual({
      id: 's9_v40_tMultiLineString',
      type: 'line',
      paint: { 'line-color': 'black', 'line-width': 1 },
      source: 'npmrds2_s9_v40_2023_1700000000000',
      'source-layer': 'view_40',
    });
  });
});

describe('removeByYear', () => {
  const sources = [
    { id: 'a', source: { tiles: ['/tiles/40/x?filter=year=2022'] } },
    { id: 'b', source: { tiles: ['/tiles/41/x?filter=year=2023'] } },
  ];
  const layers = [
    { id: 'la', source: 'a' },
    { id: 'lb', source: 'b' },
  ];
  it('drops sources whose tile URL carries the removed year, and their layers', () => {
    const out = removeByYear(sources, layers, 2023);
    expect(out.sources.map((s) => s.id)).toEqual(['a']);
    expect(out.layers.map((l) => l.id)).toEqual(['la']);
  });
  it('tolerates missing input', () => {
    expect(removeByYear(undefined, undefined, 2023)).toEqual({ sources: [], layers: [] });
  });
});
