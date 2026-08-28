import { describe, it, expect } from "vitest";
import { buildTicketRow, TICKETS_SOURCE, SEVERITIES, DEFAULT_SEVERITY, surfaceFromHost, surfaceFromLocation, slugFromPathname } from "./ticketRow";

describe("ticketRow constants", () => {
  it("pins the npmrdsv5 sitemgmt_tickets source", () => {
    expect(TICKETS_SOURCE.source_id).toBe(2184923);
    expect(TICKETS_SOURCE.view_id).toBe(2184924);
    expect(TICKETS_SOURCE.type).toBe("sitemgmt_tickets|2184924:data");
    expect(TICKETS_SOURCE.app).toBe("npmrdsv5");
    expect(TICKETS_SOURCE.isDms).toBe(true);
  });
  it("offers the three severities, default Minor", () => {
    expect(SEVERITIES).toEqual(["Blocker", "Major", "Minor"]);
    expect(DEFAULT_SEVERITY).toBe("Minor");
  });
});

describe("buildTicketRow (Phase 1)", () => {
  it("builds a complete, coherent row from the authored fields", () => {
    const row = buildTicketRow({
      title: "  Broken chart  ",
      severity: "Major",
      description: "  the y-axis is wrong  ",
      asOf: "2026-07-15",
    });
    expect(row).toEqual({
      title: "Broken chart",
      severity: "Major",
      description: "the y-axis is wrong",
      status: "Triage",
      source: "client",
      opened: "2026-07-15",
      updated: "2026-07-15",
    });
  });
  it("defaults severity to Minor when omitted", () => {
    expect(buildTicketRow({ title: "t", description: "d", asOf: "2026-07-15" }).severity).toBe("Minor");
  });
});

describe("surfaceFromHost", () => {
  it("maps known subdomains to control-room surfaces", () => {
    expect(surfaceFromHost("freightatlas.devtny.org")).toBe("freightatlas2");
    expect(surfaceFromHost("freightatlas2.devtny.org")).toBe("freightatlas2");
    expect(surfaceFromHost("tsmo2.devtny.org")).toBe("tsmo2");
    expect(surfaceFromHost("npmrds2.localhost:5173")).toBe("npmrds2");
  });
  it("returns '' for unknown hosts", () => {
    expect(surfaceFromHost("example.com")).toBe("");
    expect(surfaceFromHost("")).toBe("");
  });
});

describe("surfaceFromLocation — products mounted at paths on one origin", () => {
  it("reads the surface off the path, whatever the host", () => {
    expect(surfaceFromLocation("www.devtny.org", "/tsmo/home"))
      .toEqual({ surface: "tsmo2", slug: "home" });
    expect(surfaceFromLocation("www.transportny.org", "/npmrds/macro"))
      .toEqual({ surface: "npmrds2", slug: "macro" });
    expect(surfaceFromLocation("devtny.org", "/freightatlas/maps_gallery"))
      .toEqual({ surface: "freightatlas2", slug: "maps_gallery" });
  });

  it("resolves the slug RELATIVE to the mount, so a nested page keeps its own slug", () => {
    expect(surfaceFromLocation("www.devtny.org", "/npmrds/map_21/level_of_travel_time_reliability"))
      .toEqual({ surface: "npmrds2", slug: "level_of_travel_time_reliability" });
  });

  it("gives no slug for the bare mount root — not a bogus `tsmo2:tsmo` key", () => {
    expect(surfaceFromLocation("www.devtny.org", "/tsmo")).toEqual({ surface: "tsmo2", slug: "" });
    expect(surfaceFromLocation("www.devtny.org", "/tsmo/")).toEqual({ surface: "tsmo2", slug: "" });
  });

  it("does not match a path that merely starts with the mount name", () => {
    expect(surfaceFromLocation("www.devtny.org", "/tsmometrics/home").surface).toBe("");
  });

  it("still falls back to the host while the retired subdomains resolve", () => {
    expect(surfaceFromLocation("tsmo2.devtny.org", "/home"))
      .toEqual({ surface: "tsmo2", slug: "home" });
    expect(surfaceFromLocation("example.com", "/home"))
      .toEqual({ surface: "", slug: "home" });
  });

  it("does not claim the landing/shared pages served at the same origin", () => {
    expect(surfaceFromLocation("www.devtny.org", "/landing").surface).toBe("");
    expect(surfaceFromLocation("www.devtny.org", "/datasources").surface).toBe("");
  });
});

describe("slugFromPathname", () => {
  it("takes the last non-empty segment", () => {
    expect(slugFromPathname("/a/b/home")).toBe("home");
    expect(slugFromPathname("/home")).toBe("home");
    expect(slugFromPathname("/")).toBe("");
  });
});

describe("buildTicketRow (Phase 2 — page attribution)", () => {
  it("adds page_route/page_name/surface/page_key from a known host", () => {
    const row = buildTicketRow({
      title: "t", description: "d", asOf: "2026-07-15",
      pathname: "/home", pageName: "Home", host: "tsmo2.devtny.org",
    });
    expect(row.page_route).toBe("/home");
    expect(row.page_name).toBe("Home");
    expect(row.surface).toBe("tsmo2");
    expect(row.page_key).toBe("tsmo2:home");
  });
  it("produces the SAME page_key from the new path mount as from the old host", () => {
    const fromHost = buildTicketRow({
      title: "t", description: "d", asOf: "2026-07-15",
      pathname: "/home", pageName: "Home", host: "tsmo2.devtny.org",
    });
    const fromPath = buildTicketRow({
      title: "t", description: "d", asOf: "2026-07-15",
      pathname: "/tsmo/home", pageName: "Home", host: "www.devtny.org",
    });
    expect(fromPath.page_key).toBe(fromHost.page_key);
    expect(fromPath.surface).toBe("tsmo2");
    // page_route stays verbatim — it records where the reporter actually was
    expect(fromPath.page_route).toBe("/tsmo/home");
  });
  it("omits page_key/surface for an unknown host but keeps route+name", () => {
    const row = buildTicketRow({
      title: "t", description: "d", asOf: "2026-07-15",
      pathname: "/home", pageName: "Home", host: "example.com",
    });
    expect(row.page_route).toBe("/home");
    expect(row.page_name).toBe("Home");
    expect(row.page_key).toBeUndefined();
    expect(row.surface).toBeUndefined();
  });
});

describe("buildTicketRow (Phase 3 — reporter)", () => {
  it("adds reporter when an email is supplied", () => {
    const row = buildTicketRow({ title: "t", description: "d", asOf: "2026-07-15", reporterEmail: "am3081@gmail.com" });
    expect(row.reporter).toBe("am3081@gmail.com");
  });
  it("omits reporter when no email", () => {
    expect(buildTicketRow({ title: "t", description: "d", asOf: "2026-07-15" }).reporter).toBeUndefined();
  });
});

describe("buildTicketRow (source)", () => {
  it("tags widget-reported tickets with source 'client'", () => {
    expect(buildTicketRow({ title: "t", description: "d", asOf: "2026-07-15" }).source).toBe("client");
  });
});

describe("timestamp sort (fix: new tickets float to the top of the list)", () => {
  it("echoes a full datetime asOf to opened/updated", () => {
    const row = buildTicketRow({ title: "t", description: "d", asOf: "2026-07-15 13:45:23" });
    expect(row.updated).toBe("2026-07-15 13:45:23");
    expect(row.opened).toBe("2026-07-15 13:45:23");
  });
  it("a datetime string sorts above a same-day date-only string (why new tickets float up)", () => {
    // the tickets list sorts `updated` desc as strings; a datetime beats that day's date-only rows
    expect("2026-07-15 13:45:23" > "2026-07-15").toBe(true);
    // ...but a genuinely later date still wins over an earlier datetime
    expect("2026-07-16" > "2026-07-15 13:45:23").toBe(true);
  });
});
