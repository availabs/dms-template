/**
 * Pure parsing helpers for npmrds_raw. No I/O.
 */

/**
 * Pull the `rawDataSourcesFromServer` array out of the RITIS download page HTML.
 * The page embeds `window.PDA_APP_STORE = { ... }` with single-quoted JSON; we
 * locate the array by bracket-matching (the object is too large/loose to JSON.parse whole).
 * Returns the parsed array, or null if not found.
 */
function extractPDAAppStore(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const jsonRegex = /window\.PDA_APP_STORE\s*=\s*({[\s\S]*?});/;

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const jsonMatch = match[1].match(jsonRegex);
    if (!jsonMatch) continue;
    try {
      const jsonString = jsonMatch[1].replace(/'/g, '"');
      const key = 'rawDataSourcesFromServer';
      const keyStart = jsonString.indexOf(key);
      if (keyStart === -1) continue;

      const arrayStart = jsonString.indexOf('[', keyStart);
      if (arrayStart === -1) continue;

      let bracketCount = 1;
      let i = arrayStart + 1;
      while (bracketCount > 0 && i < jsonString.length) {
        if (jsonString[i] === '[') bracketCount++;
        else if (jsonString[i] === ']') bracketCount--;
        i++;
      }
      return JSON.parse(jsonString.substring(arrayStart, i));
    } catch (e) {
      // fall through to try the next script tag
    }
  }
  return null;
}

/**
 * Filename from a content-disposition header. Handles quoted, unquoted, and the
 * legacy curly-quote variant. Returns null if absent.
 */
function getFileName(header) {
  if (!header) return null;
  const m = header.match(/filename\s*=\s*["“]?([^"“;]+)["”]?/i);
  return m ? m[1].trim() : null;
}

module.exports = { extractPDAAppStore, getFileName };
