/**
 * Unit tests for npmrds_raw HTML/header parsing helpers. Pure functions.
 */
import { describe, it, expect } from 'vitest';
import * as parse from '../parse.js';

describe('extractPDAAppStore', () => {
  it('extracts the rawDataSourcesFromServer array from the download page HTML', () => {
    const html = `
      <html><head></head><body>
      <script>
        window.PDA_APP_STORE = {'rawDataSourcesFromServer': [
          {'datasource_id': 'npmrds2_passenger', 'metadata_versions': [{'id': 1, 'display_name': '2023'}]},
          {'datasource_id': 'npmrds2_truck', 'metadata_versions': []}
        ]};
      </script>
      </body></html>`;
    const result = parse.extractPDAAppStore(html);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].datasource_id).toBe('npmrds2_passenger');
    expect(result[0].metadata_versions[0].display_name).toBe('2023');
  });

  it('returns null when the store is absent', () => {
    expect(parse.extractPDAAppStore('<html><body>nothing here</body></html>')).toBeNull();
  });
});

describe('getFileName', () => {
  it('reads the filename from a content-disposition header (straight quotes)', () => {
    expect(parse.getFileName('attachment; filename="NPMRDS_export.zip"')).toBe('NPMRDS_export.zip');
  });
  it('reads an unquoted filename', () => {
    expect(parse.getFileName('attachment; filename=data.csv')).toBe('data.csv');
  });
  it('returns null when no filename present', () => {
    expect(parse.getFileName('attachment')).toBeNull();
  });
});
