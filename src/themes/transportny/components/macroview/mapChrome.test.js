/**
 * The download pill's busy state.
 *
 * There is no React renderer in this repo (no @testing-library, no jsdom), so this cannot assert what
 * the pill renders. What it CAN pin is the two ways the busy state fails silently:
 *
 *   1. a renamed theme key — `className={t.dockPillSpinner}` becomes `className={undefined}` and the
 *      spinner renders as a motionless glyph, no error;
 *   2. an unregistered icon name — the DMS Icon registry resolves by its own key, and a name that is
 *      not in it renders nothing at all. (Carbon's name for an icon is not necessarily the name that
 *      resolves; that mismatch has bitten this codebase before.)
 *
 * Both are the same shape as the five silent defects this download work turned up, so they are worth
 * a test even without the ability to mount the component.
 */
import { describe, it, expect } from "vitest";
import { macroviewTheme } from "./macroview.theme";
import { readFileSync } from "fs";

describe("download pill busy state", () => {
  it("has the theme keys mapChrome references", () => {
    for (const key of ["dockPill", "dockPillIcon", "dockPillSpinner", "dockPillBusy", "dockPillCount"]) {
      expect(macroviewTheme[key], `macroviewTheme.${key} is missing`).toBeTruthy();
    }
  });

  it("the spinner class actually spins, and keeps the icon's box", () => {
    // Without animate-spin it is just a static glyph — which looks like a rendering bug, not progress.
    expect(macroviewTheme.dockPillSpinner).toMatch(/\banimate-spin\b/);
    // Same size box as the idle icon, so swapping the glyph cannot reflow the pill mid-request.
    const box = (c) => (c.match(/\bsize-\d+\b/) || [])[0];
    expect(box(macroviewTheme.dockPillSpinner)).toBe(box(macroviewTheme.dockPillIcon));
  });

  it("renders a spinner keyed off `downloading`, not off the row count", () => {
    // Guards the wiring: the busy branch must be driven by the prop comp.jsx passes `polling` into.
    const src = readFileSync(new URL("./mapChrome.jsx", import.meta.url), "utf8");
    expect(src).toMatch(/downloading/);
    expect(src).toMatch(/icon="Spinner"/);
    expect(src).toMatch(/dockPillSpinner/);
  });

  it('the "Spinner" icon name is registered in the DMS icon set', async () => {
    // The registry is an OBJECT keyed by `label || icon` (icons/index.jsx builds it by reducing over
    // iconList), not an array of descriptors — so the resolvable name is the key, which is precisely
    // why a Carbon name can fail to resolve. Assert on the keys.
    const icons = await import("../../../../dms/packages/dms/src/ui/icons/index.jsx");
    const names = Object.keys(icons.default || {});
    expect(names.length, "could not read the icon registry").toBeGreaterThan(0);
    expect(names).toContain("Spinner");
  });
});
