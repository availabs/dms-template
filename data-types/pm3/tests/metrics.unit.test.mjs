/**
 * Unit tests: the pm3 metric registry.
 *
 * pm3-vs-map21 difference encoded here:
 *   - map21 computes 3 metrics (lottr, tttr, phed);
 *   - pm3 computes 11: speed_pctl + lottr/tttr + the full phed/ted family
 *     (speed-limit and freeflow thresholds, all-vehicles and truck).
 */
import { describe, it, expect } from 'vitest';
import worker from '../worker.js';

const { METRIC_NAMES, buildMetricConfigs } = worker;

// map21/worker.js's metric list (read-only dependency — re-encoded here as the
// reference value; see METRIC_CONFIGS in data-types/map21/worker.js).
const MAP21_METRIC_NAMES = ['lottr', 'tttr', 'phed'];

const PM3_METRIC_NAMES = [
  'speed_pctl',
  'lottr',
  'tttr',
  'phed',
  'phed_freeflow',
  'phed_truck',
  'phed_truck_freeflow',
  'ted',
  'ted_freeflow',
  'ted_truck',
  'ted_truck_freeflow',
];

describe('pm3 metric registry', () => {
  it('computes exactly the 11 legacy pm3 metrics, in legacy order', () => {
    expect(METRIC_NAMES).toEqual(PM3_METRIC_NAMES);
  });

  it('is a strict superset of map21: all 3 map21 metrics plus 8 pm3-only ones', () => {
    for (const m of MAP21_METRIC_NAMES) expect(METRIC_NAMES).toContain(m);
    const pm3Only = METRIC_NAMES.filter((m) => !MAP21_METRIC_NAMES.includes(m));
    expect(pm3Only).toEqual([
      'speed_pctl',
      'phed_freeflow', 'phed_truck', 'phed_truck_freeflow',
      'ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow',
    ]);
  });

  it('configures speed_pctl over the ALL bin with the CH meta table injected at runtime', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'npmrds_meta.tbl_2023' });
    expect(cfg.speed_pctl.timeBins).toEqual(['ALL']);
    expect(cfg.speed_pctl.metadataTable).toBe('npmrds_meta.tbl_2023');
    expect(typeof cfg.speed_pctl.calculator).toBe('function');
  });

  it('uses truck AVO/AADT keys for the *_truck metrics and all-vehicle keys otherwise', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    for (const m of ['phed_truck', 'phed_truck_freeflow', 'ted_truck', 'ted_truck_freeflow']) {
      expect(cfg[m].avoKey).toBe('avgvehicleoccupancytruck');
      expect(cfg[m].dirAadtKey).toBe('directionalaadttruck');
      expect(cfg[m].npmrdsDataKeys).toBe('travel_time_freight_trucks');
      expect(cfg[m].secondaryDataKey).toBe('travel_time_all_vehicles');
    }
    for (const m of ['phed', 'phed_freeflow', 'ted', 'ted_freeflow']) {
      expect(cfg[m].avoKey).toBe('avg_vehicle_occupancy');
      expect(cfg[m].dirAadtKey).toBe('directionalaadt');
      expect(cfg[m].npmrdsDataKeys).toBe('travel_time_all_vehicles');
    }
  });

  it('uses freeflow threshold speed for *_freeflow variants and speed_limit otherwise', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    for (const m of ['phed_freeflow', 'phed_truck_freeflow', 'ted_freeflow', 'ted_truck_freeflow']) {
      expect(cfg[m].thresholdSpeedVersion).toBe('freeflow');
    }
    for (const m of ['phed', 'phed_truck', 'ted', 'ted_truck']) {
      expect(cfg[m].thresholdSpeedVersion).toBe('speed_limit');
    }
  });

  it('ted* metrics run over the ALL bin; phed* over AMP + ALT_PMP (legacy peak windows)', () => {
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    for (const m of ['ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow']) {
      expect(cfg[m].timeBins).toEqual(['ALL']);
    }
    for (const m of ['phed', 'phed_freeflow', 'phed_truck', 'phed_truck_freeflow']) {
      expect(cfg[m].timeBins).toEqual(['AMP', 'ALT_PMP']);
    }
  });

  it('reuses map21 calculators (lottr/tttr → calcTtrMeasure, phed family → calcPhed)', async () => {
    // require() through the same CJS loader the worker uses, so identity
    // (===) proves reuse rather than a copied implementation.
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const { calcTtrMeasure } = req('../../map21/calcTtrMeasure.js');
    const { calcPhed } = req('../../map21/calcPhed.js');
    const cfg = buildMetricConfigs({ chMetaTableName: 'x.y' });
    expect(cfg.lottr.calculator).toBe(calcTtrMeasure);
    expect(cfg.tttr.calculator).toBe(calcTtrMeasure);
    for (const m of ['phed', 'phed_freeflow', 'phed_truck', 'phed_truck_freeflow',
                     'ted', 'ted_freeflow', 'ted_truck', 'ted_truck_freeflow']) {
      expect(cfg[m].calculator).toBe(calcPhed);
    }
  });
});
