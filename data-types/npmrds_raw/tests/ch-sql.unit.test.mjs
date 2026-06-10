/**
 * Unit tests for npmrds_raw ClickHouse DDL + merge-INSERT builders.
 * These SQL strings are load-bearing: npmrds/add and every downstream consumer
 * depend on the exact engine, keys, column shapes, and epoch math.
 * Pure string builders — no ClickHouse connection.
 */
import { describe, it, expect } from 'vitest';
import * as ch from '../ch-sql.js';

const squish = (s) => s.replace(/\s+/g, ' ').trim();

describe('rawDataTableDDL (the production npmrds_raw table)', () => {
  const ddl = squish(ch.rawDataTableDDL('npmrds_raw.s1_v2_test'));
  it('targets the given fully-qualified table', () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS npmrds_raw.s1_v2_test');
  });
  it('uses AggregatingMergeTree partitioned by month, ordered by (tmc, epoch, date)', () => {
    expect(ddl).toContain('ENGINE = AggregatingMergeTree()');
    expect(ddl).toContain('PARTITION BY toYYYYMM(date)');
    expect(ddl).toContain('ORDER BY (tmc, epoch, date)');
  });
  it('has SimpleAggregateFunction(max, ...) columns for all three vehicle classes', () => {
    for (const k of ['all_vehicles', 'passenger_vehicles', 'freight_trucks']) {
      expect(ddl).toContain(`travel_time_${k} SimpleAggregateFunction(max, Nullable(Float64))`);
      expect(ddl).toContain(`data_density_${k} SimpleAggregateFunction(max, Nullable(String))`);
    }
  });
  it('keys are non-nullable and carries a state column', () => {
    expect(ddl).toContain('tmc String');
    expect(ddl).toContain('date Date');
    expect(ddl).toContain('epoch Int64');
    expect(ddl).toContain('state String');
  });
});

describe('tempDataTableDDL (raw CSV staging)', () => {
  const ddl = squish(ch.tempDataTableDDL('temp.foo'));
  it('is a ReplacingMergeTree of all-String columns ordered by (tmc_code, measurement_tstamp)', () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS temp.foo');
    expect(ddl).toContain('ENGINE = ReplacingMergeTree()');
    expect(ddl).toContain('ORDER BY (tmc_code, measurement_tstamp)');
    expect(ddl).toContain('tmc_code String');
    expect(ddl).toContain('travel_time_seconds String');
    expect(ddl).toContain('data_density String');
  });
});

describe('tmcIdentificationTableDDL (final typed TMC table)', () => {
  const ddl = squish(ch.tmcIdentificationTableDDL('npmrds_raw_tmc_identification.s3_v4_t'));
  it('is a ReplacingMergeTree ordered by (tmc, county) with a wkb_geometry column', () => {
    expect(ddl).toContain('ENGINE = ReplacingMergeTree()');
    expect(ddl).toContain('ORDER BY (tmc, county)');
    expect(ddl).toContain('wkb_geometry String');
  });
});

describe('vehicleInsertSQL (CH-side merge — one INSERT per vehicle class)', () => {
  it('maps all_vehicles to its travel_time / data_density columns with epoch + date + state', () => {
    const sql = squish(ch.vehicleInsertSQL({
      destTable: 'npmrds_raw.s1_v2_t', tempTable: 'temp.combined', vehicleKey: 'all_vehicles', stateCode: 'NY',
    }));
    expect(sql).toContain('INSERT INTO npmrds_raw.s1_v2_t (tmc, date, epoch, travel_time_all_vehicles, data_density_all_vehicles, state)');
    expect(sql).toContain('FROM temp.combined');
    expect(sql).toContain('toDate(substring(measurement_tstamp, 1, 10))');
    expect(sql).toContain('(toInt64(toUnixTimestamp(measurement_tstamp)) % 86400) / 300');
    expect(sql).toContain("'ny'"); // state literal, lower-cased
  });

  it('maps passenger_vehicles and freight_trucks to their own columns', () => {
    expect(squish(ch.vehicleInsertSQL({ destTable: 'd', tempTable: 't', vehicleKey: 'passenger_vehicles', stateCode: 'ny' })))
      .toContain('travel_time_passenger_vehicles, data_density_passenger_vehicles');
    expect(squish(ch.vehicleInsertSQL({ destTable: 'd', tempTable: 't', vehicleKey: 'freight_trucks', stateCode: 'ny' })))
      .toContain('travel_time_freight_trucks, data_density_freight_trucks');
  });

  it('rejects an unknown vehicle key', () => {
    expect(() => ch.vehicleInsertSQL({ destTable: 'd', tempTable: 't', vehicleKey: 'spaceships', stateCode: 'ny' }))
      .toThrow(/vehicle/i);
  });
});

describe('VEHICLE_SOURCES mapping (which RITIS datasource feeds which column)', () => {
  it('maps the three RITIS datasources to the three column keys', () => {
    // all_vehicles <- combined, passenger_vehicles <- passenger, freight_trucks <- truck
    expect(ch.VEHICLE_SOURCE_TO_KEY['npmrds2_combined']).toBe('all_vehicles');
    expect(ch.VEHICLE_SOURCE_TO_KEY['npmrds2_passenger']).toBe('passenger_vehicles');
    expect(ch.VEHICLE_SOURCE_TO_KEY['npmrds2_truck']).toBe('freight_trucks');
  });
});
