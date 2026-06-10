/**
 * Unit tests for TRANSCOM event normalization (raw API payload -> table row).
 * Pure functions only — the fixture mirrors the HistoricalEventSearch
 * getEventById response shape consumed by the legacy insertEvents().
 */
import { describe, it, expect } from 'vitest';
import { parseTranscomDateTime, normalizeEvent } from '../events.js';
import { EVENT_COLUMNS } from '../sql.js';

const FIXTURE = {
  ID: 'ORI123',
  'Event Class': 'accident',
  'Reporting Organization': 'TRANSCOM',
  'Start DateTime': '03/15/2024 02:30:45 PM',
  'End DateTime': '03/15/2024 04:00:00 PM',
  'Last Updatedate': '03/15/2024 03:00:00 PM',
  'Close Date': '03/15/2024 04:00:00 PM',
  Estimated_Duration_Mins: 90,
  Facility: 'I-90',
  'Event Type': 'accident with injuries',
  'Lanes Total Count': 4,
  'Lanes Affected Count': 2,
  Description: "O'Brien crash",
  Direction: 'eastbound',
  County: 'Albany',
  State: 'NY',
  PointLAT: 42.65,
  PointLONG: -73.75,
  Eventstatus: 'Closed',
  isHighway: 1,
  InjuryInvolved: true,
  FatalityInvolved: false,
  Year: 2024,
  DayofWeek: 5,
  Tmclist: null,
};

describe('parseTranscomDateTime', () => {
  it('parses "MM/DD/YYYY hh:mm:ss A" into a wall-clock "YYYY-MM-DD HH:MM:SS"', () => {
    expect(parseTranscomDateTime('03/15/2024 02:30:45 PM')).toBe('2024-03-15 14:30:45');
    expect(parseTranscomDateTime('03/15/2024 12:05:00 AM')).toBe('2024-03-15 00:05:00');
    expect(parseTranscomDateTime('03/15/2024 12:00:00 PM')).toBe('2024-03-15 12:00:00');
  });
  it('returns null for missing values', () => {
    expect(parseTranscomDateTime(null)).toBe(null);
    expect(parseTranscomDateTime(undefined)).toBe(null);
    expect(parseTranscomDateTime('')).toBe(null);
  });
});

describe('normalizeEvent', () => {
  const row = normalizeEvent(FIXTURE);

  it('maps the API keys onto the snake_case column names', () => {
    expect(row.event_id).toBe('ORI123');
    expect(row.event_class).toBe('accident');
    expect(row.reporting_organization).toBe('TRANSCOM');
    expect(row.facility).toBe('I-90');
    expect(row.event_type).toBe('accident with injuries');
    expect(row.lanes_total_count).toBe(4);
    expect(row.county).toBe('Albany');
    expect(row.point_lat).toBe(42.65);
    expect(row.point_long).toBe(-73.75);
  });

  it('parses the TRANSCOM datetimes', () => {
    expect(row.start_date_time).toBe('2024-03-15 14:30:45');
    expect(row.last_updatedate).toBe('2024-03-15 15:00:00');
    expect(row.close_date).toBe('2024-03-15 16:00:00');
    // end_date_time is TEXT in the legacy table — passed through untouched
    expect(row.end_date_time).toBe('03/15/2024 04:00:00 PM');
  });

  it('derives month / day_of_month / month_year from Start DateTime', () => {
    expect(row.month).toBe(3);
    expect(row.day_of_month).toBe(15);
    expect(row.month_year).toBe('03-2024');
  });

  it('keeps the legacy Boolean(x) || null coercion (false -> null)', () => {
    expect(row.injury_involved).toBe(true);
    expect(row.fatality_involved).toBe(null); // Boolean(false) || null === null
    expect(row.is_highway).toBe(true);
    expect(row.secondary_event).toBe(null);   // absent -> null
  });

  it('produces a value for every insert column', () => {
    for (const col of EVENT_COLUMNS) {
      expect(row).toHaveProperty(col);
    }
  });
});
