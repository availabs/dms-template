/**
 * Congestion machinery for the transcom plugin — ported from the canonical
 * legacy implementation in avail-falcor/dama/routes/data_types/transcom/
 * processIncidents.js (NOT the npmrds/processIncidents2.js variant; see the
 * migration report for the differences).
 *
 * Design changes vs legacy (behavior preserved):
 *   - no external deps: d3-rollup/d3-scale/turf/ngraph/bluebird/moment are
 *     replaced with small vanilla ports (rollup map, piecewise-linear
 *     interpolation, haversine distance, a minimal graph, plain loops).
 *   - ALL I/O is injected:
 *       fetchDelayRows(incident, tmcs)  — the npmrds ClickHouse reads
 *                                         (legacy hoursOfDelay chQuery)
 *       upsertCongestion(eventId, data) — the temp-table upsert
 *     so tests never touch ClickHouse or Postgres.
 *
 * The per-event congestion_data JSON shape is ported EXACTLY:
 *   { dates, delay, rawDelay, vehicleDelay, rawVehicleDelay, eventTmcs,
 *     tmcDelayData, rawTmcDelayData, branches, startTime, endTime, node_id,
 *     way_id, tmcBounds }
 */

const distributions = require('./aadt_distributions.js');
const { votEff } = require('../_shared/vot_rates.js');

// ── small vanilla ports ──────────────────────────────────────────────────────

/** d3.rollup(rows, sort-by-epoch, r.tmc, r.date) replacement. */
function rollupByTmcDate(rows) {
  const byTmc = new Map();
  for (const r of rows || []) {
    if (!byTmc.has(r.tmc)) byTmc.set(r.tmc, new Map());
    const byDate = byTmc.get(r.tmc);
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  for (const byDate of byTmc.values()) {
    for (const arr of byDate.values()) arr.sort((a, b) => a.epoch - b.epoch);
  }
  return byTmc;
}

/** d3 scaleLinear replacement: piecewise-linear over (domain, range) points. */
function piecewiseLinear(domain, range) {
  return (x) => {
    if (domain.length === 0) return undefined;
    if (domain.length === 1) return range[0];
    let i = 1;
    while (i < domain.length - 1 && x > domain[i]) i++;
    const x0 = domain[i - 1];
    const x1 = domain[i];
    const y0 = range[i - 1];
    const y1 = range[i];
    if (x1 === x0) return y0;
    return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  };
}

/** turf.distance replacement — haversine, kilometers (legacy default unit). */
function haversineKm(a, b) {
  if (!a || !b) return 0;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371.0088;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const getPath = (obj, path, dflt = null) => {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return dflt;
    cur = cur[k];
  }
  return cur == null ? dflt : cur;
};

/** Minimal ngraph.graph replacement: nodes carry every incident link. */
function makeGraph() {
  const nodes = new Map();
  function addNode(nodeId, data) {
    let node = nodes.get(nodeId);
    if (!node) {
      node = { id: nodeId, data, links: new Set() };
      nodes.set(nodeId, node);
    } else if (data !== undefined) {
      node.data = data;
    }
    return node;
  }
  function addLink(fromId, toId, data) {
    const from = addNode(fromId, nodes.get(fromId) && nodes.get(fromId).data);
    const to = addNode(toId, nodes.get(toId) && nodes.get(toId).data);
    const link = { fromId, toId, data };
    from.links.add(link);
    to.links.add(link);
    return link;
  }
  return { addNode, addLink, getNode: (id) => nodes.get(id) };
}

// ── epochs / times ───────────────────────────────────────────────────────────

const ONE_FIFTH = 1.0 / 5.0;

function timeStringToEpoch(string, round = 'down') {
  const [hours, minutes] = String(string).split(':');
  return (
    +hours * 12
    + (round === 'down' ? Math.floor(+minutes * ONE_FIFTH) : Math.ceil(+minutes * ONE_FIFTH))
  );
}

/** Build the padded [date, epoch] timeline for an incident (legacy worker loop). */
function buildEventTimes({ dates, startTime, endTime }) {
  const times = [];
  let eventStart;
  let eventEnd;
  let start = Math.max(0, startTime - 30);
  const end = Math.min(288, endTime + 30);
  let i = 0;
  while (i < dates.length) {
    if (i === 0 && start === startTime) {
      eventStart = times.length;
    } else if (i === dates.length - 1 && start === endTime) {
      eventEnd = times.length;
    }
    times.push([dates[i], start++]);
    if (start === 288 || (i === dates.length - 1 && start > end)) {
      start %= 288;
      ++i;
    }
  }
  return { times, eventStart, eventEnd };
}

// ── incident row post-processing (legacy getIncidents tail) ─────────────────

const DURATION_REGEX = /^(\d+) - (.+)$/;

function parseWallClock(str) {
  // 'YYYY-MM-DD HH:MM:SS[.ms]' (Postgres ::TEXT) -> { ms (UTC-based wall clock) }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(str));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}
const wallDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const wallHHMM = (ms) => new Date(ms).toISOString().slice(11, 16);

function setTimesFromDurationOrJustFudgeIt(incident) {
  incident.bad_dates = true;
  const match = DURATION_REGEX.exec(incident.duration);
  const openMs = parseWallClock(incident.open_time);
  if (Number.isNaN(openMs)) return; // stays bad
  let closeMs;
  if (match) {
    const days = +match[1];
    const [hours, minutes] = match[2].split(':');
    closeMs = openMs + ((days * 24 + +hours) * 60 + +(minutes || 0)) * 60 * 1000;
    if (closeMs <= openMs) closeMs = openMs + 15 * 60 * 1000;
  } else {
    closeMs = openMs + 15 * 60 * 1000;
  }
  incident.startMs = openMs;
  incident.endMs = closeMs;
  incident.startTime = timeStringToEpoch(wallHHMM(openMs));
  incident.endTime = timeStringToEpoch(wallHHMM(closeMs), 'up');
  incident.bad_dates = false;
}

/** Derive startTime/endTime epochs + per-day dates for each incident row. */
function postProcessIncidentRows(rows) {
  const incidents = (rows || []).map((r) => ({ ...r }));
  incidents.forEach((incident) => {
    if (incident.bad_dates) {
      setTimesFromDurationOrJustFudgeIt(incident);
    } else {
      const openMs = parseWallClock(incident.open_time);
      const closeMs = parseWallClock(incident.close_time);
      incident.startMs = openMs;
      incident.endMs = closeMs;
      incident.startTime = timeStringToEpoch(wallHHMM(openMs));
      incident.endTime = timeStringToEpoch(wallHHMM(closeMs), 'up');
      if ((closeMs - openMs) / 60000 < 15) {
        setTimesFromDurationOrJustFudgeIt(incident);
      }
    }
    incident.dates = [];
    if (!incident.bad_dates) {
      let cur = Date.UTC(
        new Date(incident.startMs).getUTCFullYear(),
        new Date(incident.startMs).getUTCMonth(),
        new Date(incident.startMs).getUTCDate()
      );
      const endDay = Date.UTC(
        new Date(incident.endMs).getUTCFullYear(),
        new Date(incident.endMs).getUTCMonth(),
        new Date(incident.endMs).getUTCDate()
      );
      while (cur <= endDay) {
        incident.dates.push(wallDate(cur));
        cur += 24 * 60 * 60 * 1000;
      }
    }
  });
  return incidents.filter((i) => !i.bad_dates);
}

// ── delay calculation (legacy hoursOfDelay tail) ─────────────────────────────

function getDist(attributes, dow) {
  const weekdayType = dow === 0 || dow === 6 ? 'WEEKEND' : 'WEEKDAY';
  const congestionLevel = attributes.congestion_level;
  const peakType = attributes.directionality;
  const f_system = attributes.f_system;
  const roadType = f_system < 3 ? 'FREEWAY' : 'NONFREEWAY';
  return (weekdayType === 'WEEKEND'
    ? [weekdayType, roadType]
    : [weekdayType, congestionLevel, peakType, roadType]
  ).join('_');
}

function calcDelay(row, attributes, avgTtMap) {
  if (!attributes) return 0;
  const dist = getDist(attributes, row.dow);
  const avg_tt = getPath(avgTtMap, [row.year, row.tmc, row.epoch], 0);
  const tt = row.tt == null ? -1 : row.tt;

  if (dist in distributions) {
    const aadt = attributes.aadt || 0;
    const facil = +(attributes.faciltype == null ? 1 : attributes.faciltype) > 1 ? 2 : 1;
    const d = distributions[dist][row.epoch];
    const delay = Math.max(0, row.tt - Math.max(avg_tt, attributes.threshold)) / 3600;
    const localSpeed = tt > 0 ? (attributes.miles / tt) * 3600 : -1;
    const avgSpeed = avg_tt > 0 ? (attributes.miles / avg_tt) * 3600 : -1;
    const speed = localSpeed > 0 && avgSpeed > 0
      ? Math.abs((avgSpeed - localSpeed) / avgSpeed)
      : 0;
    return {
      delay,
      vehicleDelay: delay * ((aadt / facil) * d),
      speed,
    };
  }
  return 0;
}

/** Fill all 288 epochs per (date, tmc), interpolating synthetic travel times. */
function expandEpochs(rows, dates, tmcs, tmcAttributes, ffDataMap) {
  const dataMap = (rows || []).reduce((a, c) => {
    const { date, tmc, epoch } = c;
    if (!a[date]) a[date] = {};
    if (!a[date][tmc]) a[date][tmc] = {};
    a[date][tmc][epoch] = c;
    return a;
  }, {});

  (dates || []).forEach((date) => {
    const jsDate = new Date(`${date}T00:00:00Z`);
    const month = jsDate.getUTCMonth() + 1;
    const dow = jsDate.getUTCDay();

    (tmcs || []).forEach((tmc) => {
      const forTmc = getPath(dataMap, [date, tmc], {});
      const domain = [];
      const range = [];
      for (let e = 0; e < 288; ++e) {
        if (e in forTmc) {
          domain.push(e);
          range.push(forTmc[e].tt);
        } else if (e === 0 || e === 287) {
          const ff = getPath(ffDataMap, [tmc], getPath(tmcAttributes, [tmc, 'avg_tt'], null));
          if (ff) {
            domain.push(e);
            range.push(ff);
          }
        }
      }
      const scale = piecewiseLinear(domain, range);
      for (let e = 0; e < 288; ++e) {
        if (!(e in forTmc)) {
          rows.push({ tmc, dow, month, date, epoch: e, tt: scale(e), synthetic: true });
        }
      }
    });
  });

  return rows;
}

// ── checkTmc (legacy edge-expansion accumulator) ─────────────────────────────

function checkTmc(tmcData, low, high, times, tmc, tmcAttributes) {
  const f_system = getPath(tmcAttributes, [tmc, 'f_system'], null);
  const pctThreshold = (Number(f_system) === 1 || Number(f_system) === 2) ? 0.25 : 0.45;

  const delay = [0, 0]; // [delay, vehicleDelay]
  const rawDelay = [0, 0]; // [rawDelay, rawVehicleDelay]

  const accumulate = (idx) => {
    const [date, e] = times[idx];
    const entry = tmcData.get(date) && tmcData.get(date)[e];
    if (!entry || !entry.delayData) return false;
    const { delayData, synthetic = false } = entry;
    delay[0] += delayData.delay;
    delay[1] += delayData.vehicleDelay;
    if (!synthetic) {
      rawDelay[0] += delayData.delay;
      rawDelay[1] += delayData.vehicleDelay;
    }
    return delayData.delay > 0 && delayData.speed >= pctThreshold;
  };

  let left = low;
  while (left >= 0) {
    if (accumulate(left)) low = left;
    if (Math.abs(low - left) >= 3 || left < 1) break;
    left--;
  }

  let right = high;
  while (right < times.length) {
    if (accumulate(right)) high = right;
    if (Math.abs(high - right) >= 3 || right > 287) break;
    right++;
  }

  return [...delay, ...rawDelay, low, high];
}

// ── graph walk ───────────────────────────────────────────────────────────────

const getDirection = (nodeId, link) => (link.toId === nodeId ? 'fromId' : 'toId');
const FilterKeys = { toId: 'fromId', fromId: 'toId' };
const StreamDirection = { toId: 'down-stream', fromId: 'up-stream' };

const completeBranch = (branch, ways, direction, length, completed) => {
  completed.set(branch.join('-'), {
    branch,
    ways,
    direction: StreamDirection[direction],
    length,
  });
};

const getTmcMetaInfo = (tmcAttributes, tmc, args) => args.reduce((a, c) => {
  a[c] = getPath(tmcAttributes, [tmc, c], null);
  return a;
}, {});

/**
 * Walk the conflation graph outward from the incident node, collecting the
 * tmcs on the event node and the up/down-stream branches with delay.
 * res: { times, eventStart, eventEnd, eventMid, incident, fetchDelayRows }
 * fetchDelayRows(incident, tmcs) -> rows with delayData (the CH seam).
 */
// Prefetch budget for the walk's reachable-TMC neighborhood (BFS over links).
// Walks rarely exceed a few dozen TMCs; 300 covers the tail while keeping one
// batched fetch reasonable.
const PREFETCH_TMC_BUDGET = 300;
const PREFETCH_NODE_BUDGET = 4000;

// BFS the conflation graph from nodeId collecting link TMCs, so the walk's
// per-TMC fetchDelayRows calls hit the batch-filled cache (perf: the per-TMC
// round-trips were ~10x the per-event cost — bench 2026-06-10).
function collectReachableTmcs(graph, nodeId) {
  const tmcs = new Set();
  const seen = new Set([nodeId]);
  const queue = [nodeId];
  while (queue.length && tmcs.size < PREFETCH_TMC_BUDGET && seen.size < PREFETCH_NODE_BUDGET) {
    const id = queue.shift();
    const node = graph.getNode(id);
    if (!node) continue;
    for (const link of Array.from(node.links) || []) {
      const tmc = getPath(link, ['data', 'tmc'], null);
      if (tmc) tmcs.add(tmc);
      const next = link.toId === id ? link.fromId : link.toId;
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return [...tmcs];
}

async function walkGraph(nodeId, graph, tmcAttributes, res) {
  const { times, eventEnd, eventStart, incident, fetchDelayRows } = res;

  const startNode = graph.getNode(nodeId);
  if (!startNode) return [[], [], new Map()];

  // Batched neighborhood prefetch — fills the fetchDelayRows cache in one
  // round-trip pair; the walk's single-TMC calls below become cache hits.
  const reachable = collectReachableTmcs(graph, nodeId);
  if (reachable.length) {
    await (fetchDelayRows.prefetchRaw || fetchDelayRows)(incident, reachable);
  }

  const eventTmcs = new Set();
  const nodeSet = new Set([nodeId]);
  const waySet = new Set();
  const branchSet = new Set();

  const linearMap = new Map(); // tmclinear -> direction
  const delayMap = new Map(); // tmc -> delay
  const vehicleMap = new Map(); // tmc -> vehicle delay
  const tmcToDelayMap = new Map(); // cache of fetched delay rows
  const completed = new Map();
  const metaCache = new Map();

  const requests = [];
  for (const link of Array.from(startNode.links) || []) {
    const tmc = getPath(link, ['data', 'tmc'], null);
    const wayId = getPath(link, ['data', 'wayId'], null);
    const direction = getDirection(nodeId, link);
    waySet.add(wayId);

    if (tmc) {
      eventTmcs.add(tmc);
      branchSet.add(tmc);
      if (!metaCache.has(tmc)) {
        metaCache.set(tmc, getTmcMetaInfo(tmcAttributes, tmc, ['tmclinear', 'direction']));
      }
      const { tmclinear, direction: dir } = metaCache.get(tmc);
      linearMap.set(tmclinear, dir);
    }

    requests.push({
      nodeId: link[direction],
      nodes: [nodeId],
      ways: [wayId],
      branch: tmc ? [tmc] : [],
      direction,
      length: 0,
      nonTmcDistance: 0,
    });
  }

  while (requests.length) {
    const req = requests.shift();
    const { nodes, ways, branch, direction, length, isTraversed } = req;
    let { nonTmcDistance } = req;
    const curNodeId = req.nodeId;

    if (isTraversed) {
      completeBranch(branch, ways, direction, length, completed);
      continue;
    }

    const node = graph.getNode(curNodeId);
    if (!node || nodeSet.has(curNodeId)) {
      completeBranch(branch, ways, direction, length, completed);
      continue;
    }

    const filterKey = FilterKeys[direction];
    const links = filterKey
      ? Array.from(node.links).filter((link) => link[filterKey] == curNodeId) // eslint-disable-line eqeqeq
      : Array.from(node.links);

    for (const link of links) {
      const tmc = getPath(link, ['data', 'tmc'], null);
      const wayId = getPath(link, ['data', 'wayId'], null);
      const nextNodeId = link[direction];
      const nextNode = graph.getNode(nextNodeId);
      const miles = nextNode && nextNode.data && node.data
        ? haversineKm(node.data.coords, nextNode.data.coords)
        : 0;

      let traversed = false;
      if (tmc) {
        let delay;
        let vDelay;

        if (delayMap.has(tmc)) {
          delay = delayMap.get(tmc);
          vDelay = vehicleMap.get(tmc);
        } else {
          let result = tmcToDelayMap.get(tmc);
          if (!result) {
            result = await fetchDelayRows(incident, [tmc]);
            tmcToDelayMap.set(tmc, result);
          }

          const rolledup = rollupByTmcDate(result);
          const tmcData = rolledup.get(tmc) || new Map();
          const low = Math.max(0, eventStart - 1);
          const high = Math.min(times.length - 1, eventEnd + 1);

          const [, , tmcDelay, vehicleDelay] = checkTmc(tmcData, low, high, times, tmc, tmcAttributes);
          delay = tmcDelay;
          vDelay = vehicleDelay;
          delayMap.set(tmc, tmcDelay);
          vehicleMap.set(tmc, vehicleDelay);
        }

        if (!metaCache.has(tmc)) {
          metaCache.set(tmc, getTmcMetaInfo(tmcAttributes, tmc, ['tmclinear', 'direction']));
        }
        const { tmclinear, direction: dir } = metaCache.get(tmc);

        if (linearMap.has(tmclinear) && linearMap.get(tmclinear) !== dir) {
          break;
        }

        if (!delay || (vDelay * 60) < 5) traversed = true;

        linearMap.set(tmclinear, dir);
        nonTmcDistance = 0;
      } else {
        nonTmcDistance += miles;
        if (nonTmcDistance > 0.5) {
          completeBranch(branch, ways, direction, length, completed);
          break;
        }
      }

      const newNodes = [...nodes, curNodeId];
      const newWays = waySet.has(wayId) ? ways : [...ways, wayId];
      const newBranch = (tmc && !branchSet.has(tmc)) ? [...branch, tmc] : branch;

      requests.push({
        nodeId: nextNodeId,
        nodes: newNodes,
        ways: newWays,
        branch: newBranch,
        direction,
        length: length + miles,
        nonTmcDistance,
        isTraversed: traversed,
      });

      nodeSet.add(curNodeId);
      waySet.add(wayId);
      if (tmc) branchSet.add(tmc);
    }
  }

  return [[...eventTmcs], [...completed.values()], tmcToDelayMap];
}

// ── congestion_data assembly (legacy processData) ────────────────────────────

/**
 * Assemble the per-event congestion_data object — the EXACT legacy shape.
 * tmcDelayData rows carry { tmc, date, epoch, synthetic, delayData }.
 */
function assembleCongestionData({
  incident, isConstruction, tmcDelayData, branches, eventTmcs,
  times, eventStart, eventEnd, tmcAttributes,
}) {
  const { dates, startTime, endTime, node_id, way_id } = incident;

  // M6: probe coverage — how much of the speed data behind this event's delay
  // was actually observed vs synthesized by interpolation (expandEpochs marks
  // synthetic rows). Additive key; downstream readers of tmcDelayData unaffected.
  const totalCells = (tmcDelayData || []).length;
  const observedCells = (tmcDelayData || []).reduce((a, r) => a + (r && r.synthetic ? 0 : 1), 0);

  const incidentData = {
    startTime,
    endTime,
    dates,
    node_id,
    way_id,
    eventTmcs,
    branches,
    probe: {
      observedCells,
      totalCells,
      coverage: totalCells ? observedCells / totalCells : 0,
    },

    delay: 0,
    vehicleDelay: 0,

    rawDelay: 0,
    rawVehicleDelay: 0,

    tmcDelayData: Object.create(null),
    rawTmcDelayData: Object.create(null),

    tmcBounds: Object.create(null),
  };

  if (isConstruction) {
    for (const d of tmcDelayData) {
      const { tmc, synthetic, delayData: { delay, vehicleDelay } } = d;
      if (!(tmc in incidentData.tmcDelayData)) {
        incidentData.tmcDelayData[tmc] = 0;
        incidentData.rawTmcDelayData[tmc] = 0;
        incidentData.tmcBounds[tmc] = [
          [dates[0], startTime],
          [dates[dates.length - 1], endTime],
        ];
      }
      incidentData.delay += delay;
      incidentData.vehicleDelay += vehicleDelay;
      incidentData.tmcDelayData[tmc] += vehicleDelay;
      if (!synthetic) {
        incidentData.rawDelay += delay;
        incidentData.rawVehicleDelay += vehicleDelay;
        incidentData.rawTmcDelayData[tmc] += vehicleDelay;
      }
    }
  } else {
    const rolledup = rollupByTmcDate(tmcDelayData);
    const processedTMCs = new Map();

    for (const { branch } of branches) {
      let hasDelay = 3;

      for (const tmc of branch) {
        if (!processedTMCs.has(tmc)) {
          const tmcData = rolledup.get(tmc);
          incidentData.tmcDelayData[tmc] = 0;
          incidentData.rawTmcDelayData[tmc] = 0;

          if (!tmcData) {
            processedTMCs.set(tmc, { delay: null });
            --hasDelay;
          } else {
            const [delay, vehicleDelay, rawDelay, rawVehicleDelay, b1, b2] = checkTmc(
              tmcData,
              Math.max(0, eventStart - 1),
              Math.min(times.length - 1, eventEnd + 1),
              times,
              tmc,
              tmcAttributes
            );

            if (delay > 0 || rawDelay > 0) {
              incidentData.delay += delay;
              incidentData.vehicleDelay += vehicleDelay;
              incidentData.tmcDelayData[tmc] += vehicleDelay;

              incidentData.rawDelay += rawDelay;
              incidentData.rawVehicleDelay += rawVehicleDelay;
              incidentData.rawTmcDelayData[tmc] += rawVehicleDelay;

              incidentData.tmcBounds[tmc] = [times[b1], times[b2]];
              processedTMCs.set(tmc, { delay, vehicleDelay });
              hasDelay = 3;
            } else {
              processedTMCs.set(tmc, { delay: null });
              --hasDelay;
            }
          }
        } else if (processedTMCs.get(tmc).delay) {
          hasDelay = 3;
        } else {
          --hasDelay;
        }

        if (hasDelay <= 0) break;
      }
    }
  }

  // Class-weighted monetization (2026-06-22): weight each TMC's RAW vehicle-delay
  // by its own effective value of time from the AADT split, replacing the flat
  // $20/veh-hr that used to be applied at writeback. Per-vehicle rates with
  // occupancy bundled in. Σ rawTmcDelayData[tmc] == rawVehicleDelay, so this is
  // the class-weighted analogue of the old 20×rawVehicleDelay.
  // See planning/transportny/tasks/current/class-weighted-vot-cost.md.
  let cost = 0;
  for (const tmc in incidentData.rawTmcDelayData) {
    const attrs = tmcAttributes && tmcAttributes[tmc];
    cost += incidentData.rawTmcDelayData[tmc] * votEff({
      aadt: attrs && attrs.aadt,
      aadt_singl: attrs && attrs.aadt_singl,
      aadt_combi: attrs && attrs.aadt_combi,
    });
  }
  incidentData.cost = cost;

  return incidentData;
}

// ── orchestration (legacy processIncidents) ──────────────────────────────────

const branchSort = (a, b) => b.branch.length - a.branch.length;

/**
 * Process incidents grouped by node, walking the graph and writing one
 * congestion_data row per event via the injected upsertCongestion(eventId, data).
 * deps: { fetchDelayRows(incident, tmcs), upsertCongestion(eventId, data) }
 */
async function processIncidents(deps, incidents, graph, tmcAttributes) {
  const { fetchDelayRows, upsertCongestion } = deps;

  const incidentsByNodeIdMap = {};
  for (const c of incidents || []) {
    const node_id = c.is_construction ? `${c.node_id}|construction` : c.node_id;
    if (!incidentsByNodeIdMap[node_id]) {
      incidentsByNodeIdMap[node_id] = {
        node_id: +c.node_id,
        events: [],
        is_construction: c.is_construction,
      };
    }
    incidentsByNodeIdMap[node_id].events.push(c);
  }

  // Day-group batching (the CH "push-down": ship arrays once, run the JS
  // semantics from memory). Flatten to (cluster, incident) pairs, group by the
  // incident's exact date set, warm the fetch cache with ONE batched query pair
  // per group (union of the clusters' BFS neighborhoods), process the group,
  // then reset the cache to bound memory. Bench 2026-06-10: the arithmetic is
  // ~3ms/event in JS — the cost was round-trip count, so batching is the win.
  const WARM_CHUNK = 4000; // tmcs per warm query (IN-list size guard)
  const pairs = [];
  for (const cluster of Object.values(incidentsByNodeIdMap)) {
    for (const incident of cluster.events) pairs.push({ cluster, incident });
  }
  const groups = new Map(); // dateSig -> pairs
  for (const pair of pairs) {
    const sig = (pair.incident.dates || []).join(',');
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(pair);
  }

  for (const [sig, groupPairs] of groups) {
    if (sig && typeof fetchDelayRows.resetCache === 'function') {
      const dates = sig.split(',');
      const union = new Set();
      for (const { cluster } of groupPairs) {
        for (const tmc of collectReachableTmcs(graph, cluster.node_id)) union.add(tmc);
      }
      const warmTmcs = [...union];
      const warm = fetchDelayRows.prefetchRaw || fetchDelayRows;
      for (let i = 0; i < warmTmcs.length; i += WARM_CHUNK) {
        await warm({ dates }, warmTmcs.slice(i, i + WARM_CHUNK));
      }
    }

    for (const { cluster, incident } of groupPairs) {
      const { times, eventStart, eventEnd } = buildEventTimes(incident);

      const [eventTmcs, branches, tmcToDelay] = await walkGraph(
        cluster.node_id,
        graph,
        tmcAttributes,
        {
          times,
          eventEnd,
          eventStart,
          eventMid: Math.floor((eventStart + eventEnd) * 0.5),
          incident,
          fetchDelayRows,
        }
      );

      if (branches.length > 1) branches.sort(branchSort);

      // Deduplicate branch prefixes
      const branchKeys = new Set();
      const filtered = [];
      for (const b of branches) {
        const key = b.branch.join('-');
        if (!branchKeys.has(key)) {
          for (let i = 1; i <= b.branch.length; ++i) {
            branchKeys.add(b.branch.slice(0, i).join('-'));
          }
          filtered.push(b);
        }
      }

      const tmcs = Array.from(new Set(filtered.flatMap((b) => b.branch)));

      // Collect delay rows (cached from the walk, fetch the rest)
      const rows = [];
      const missingTmcs = [];
      for (const tmc of tmcs) {
        if (tmcToDelay.has(tmc)) rows.push(...(tmcToDelay.get(tmc) || []));
        else missingTmcs.push(tmc);
      }
      if (missingTmcs.length > 0) {
        rows.push(...(await fetchDelayRows(incident, missingTmcs)));
      }

      const congestionData = assembleCongestionData({
        incident,
        isConstruction: cluster.is_construction,
        tmcDelayData: rows,
        branches: filtered,
        eventTmcs,
        times,
        eventStart,
        eventEnd,
        tmcAttributes,
      });

      if (incident.event_id) {
        await upsertCongestion(incident.event_id, congestionData);
      }
    }

    // group processed — drop its cached rows before the next date-group
    if (typeof fetchDelayRows.resetCache === 'function') fetchDelayRows.resetCache();
  }
}

// ── ClickHouse delay-row fetch (legacy hoursOfDelay) ─────────────────────────

/**
 * Build the fetchDelayRows seam from a ClickHouse handle + the npmrds
 * production table name. chDb must expose .query({ query, format }) -> { json() }
 * (the dms-server getChDb contract, same as npmrds_raw).
 *
 * P1 perf (see references/tsmo/06_congestion_delay_methodology.md): when
 * `baselineTable` is supplied (the materialized weekday-average table the
 * excessive_delay plugin also uses), the per-incident yearly query becomes a
 * cheap indexed lookup instead of a full-table GROUP BY per incident.
 */
function makeFetchDelayRows({ chDb, prodTableName, tmcAttributes, ffDataMap, baselineTable }) {
  // Lazy three-store pipeline (2026-06-10 refinement):
  //   rawCache      (dates|tmc) -> observed CH rows (pristine; bulk-fetched)
  //   baselineCache (tmc)       -> baseline rows (year-scoped per fetcher)
  //   expandedCache (dates|tmc) -> expandEpochs + calcDelay output, built ON
  //                                FIRST WALK ACCESS only (bench: ~80-90% of
  //                                warmed TMCs are never walked — eager
  //                                expansion was the dominant JS cost).
  // prefetchRaw() warms raw+baseline only; fetchDelayRows() keeps its original
  // contract (expanded rows with delayData) and materializes lazily.
  let rawCache = new Map();
  let baselineCache = new Map();
  let expandedCache = new Map();
  const cacheKey = (incident, tmc) => `${(incident.dates || []).join(',')}|${tmc}`;

  async function ensureRaw(incident, tmcs) {
    if (!tmcs || tmcs.length === 0 || !incident.dates || incident.dates.length === 0) return;
    const [year] = (incident.dates || []).reduce(
      (a, c) => {
        const [yr, month] = c.split('-');
        if (a[0] === null) a[0] = +yr;
        if (!a[1].includes(+month)) a[1].push(+month);
        return a;
      },
      [null, []]
    );

    const wanted = [...new Set(tmcs)];
    const rawMisses = wanted.filter((tmc) => !rawCache.has(cacheKey(incident, tmc)));
    const baselineMisses = wanted.filter((tmc) => !baselineCache.has(tmc));
    if (rawMisses.length === 0 && baselineMisses.length === 0) return;

    if (rawMisses.length > 0) {
      const inDates = incident.dates.map((d) => `'${d}'`).join(', ');
      const inTmcs = rawMisses.map((t) => `'${t}'`).join(', ');
      const incidentRes = await chDb.query({
        query: `
        SELECT
            toString(date) AS date,
            tmc,
            toInt16(epoch) AS epoch,
            toInt16(toMonth(parseDateTimeBestEffort(date))) AS month,
            toInt16(toYear(parseDateTimeBestEffort(date))) AS year,
            toInt16(toDayOfWeek(parseDateTimeBestEffort(date)) - 1) AS dow,
            travel_time_all_vehicles AS tt
        FROM ${prodTableName}
        WHERE date IN (${inDates})
            AND tmc IN (${inTmcs})
            AND epoch >= 0
            AND epoch < 288
        SETTINGS max_memory_usage = 0, max_execution_time = 0;`,
        format: 'JSONEachRow',
      });
      const incidentTT = await incidentRes.json();
      const byKey = new Map(rawMisses.map((tmc) => [cacheKey(incident, tmc), []]));
      for (const row of incidentTT || []) {
        const k = cacheKey(incident, row.tmc);
        if (byKey.has(k)) byKey.get(k).push(row);
      }
      for (const [k, rows] of byKey) rawCache.set(k, rows);
    }

    if (baselineMisses.length > 0) {
      const inTmcs = baselineMisses.map((t) => `'${t}'`).join(', ');
      const yearlyRes = await chDb.query({
        query: baselineTable
          ? `
        SELECT tmc, epoch, avg_tt, ${Number(year)} AS year
        FROM ${baselineTable}
        WHERE tmc IN (${inTmcs})
        SETTINGS max_memory_usage = 0, max_execution_time = 0;`
          : `
        SELECT tmc, epoch, avg_tt, year
        FROM (
          SELECT toYear(date) AS year, tmc, epoch,
                 AVG(travel_time_all_vehicles) AS avg_tt
          FROM ${prodTableName}
          WHERE toDayOfWeek(date) IN (1, 2, 3, 4, 5)
            AND epoch >= 0
            AND epoch < 288
          GROUP BY year, tmc, epoch
        )
        WHERE year = ${year}
          AND tmc IN (${inTmcs})
        SETTINGS max_memory_usage = 0, max_execution_time = 0;`,
        format: 'JSONEachRow',
      });
      const yearlyTT = await yearlyRes.json();
      const byTmc = new Map(baselineMisses.map((tmc) => [tmc, []]));
      for (const row of yearlyTT || []) {
        if (byTmc.has(row.tmc)) byTmc.get(row.tmc).push(row);
      }
      for (const [tmc, rows] of byTmc) baselineCache.set(tmc, rows);
    }
  }

  function materialize(incident, tmc) {
    const k = cacheKey(incident, tmc);
    if (expandedCache.has(k)) return expandedCache.get(k);

    // COPY raw rows — expandEpochs pushes synthetics into the array and
    // delayData is assigned onto row objects; the raw cache must stay pristine.
    const copies = (rawCache.get(k) || []).map((r) => ({ ...r }));

    const avgYTtMap = (baselineCache.get(tmc) || []).reduce((a, c) => {
      if (!(c.year in a)) a[c.year] = {};
      if (!(c.tmc in a[c.year])) a[c.year][c.tmc] = {};
      a[c.year][c.tmc][c.epoch] = c.avg_tt;
      return a;
    }, {});

    const rows = expandEpochs(copies, incident.dates, [tmc], tmcAttributes, ffDataMap);
    rows.forEach((row) => {
      row.delayData = calcDelay(row, tmcAttributes[row.tmc], avgYTtMap);
    });
    expandedCache.set(k, rows);
    return rows;
  }

  async function fetchDelayRows(incident, tmcs) {
    if (!tmcs || tmcs.length === 0 || !incident.dates || incident.dates.length === 0) return [];
    const wanted = [...new Set(tmcs)];
    await ensureRaw(incident, wanted);
    return wanted.flatMap((tmc) => materialize(incident, tmc));
  }

  fetchDelayRows.prefetchRaw = (incident, tmcs) => ensureRaw(incident, [...new Set(tmcs || [])]);
  fetchDelayRows.stats = () => ({ rawTmcs: rawCache.size, expandedTmcs: expandedCache.size });
  fetchDelayRows.resetCache = () => { rawCache = new Map(); baselineCache = new Map(); expandedCache = new Map(); };
  return fetchDelayRows;
}

// ── conflation tables / graph build ─────────────────────────────────────────

/**
 * Pure version of getYearToConflationTableNames: rows are
 * data_manager.views rows ({ data_table, version }) for the three conflation
 * sources; returns { [year]: { nodes, ways, v0 } } with fallback fill for
 * 2016..currentYear.
 */
function getYearToConflationTableNamesFromViews(rows, currentYear = new Date().getFullYear()) {
  const tablesByYear = {};

  (rows || []).forEach(({ data_table, version }) => {
    const match = String(version || '').match(/conflation_map_(\d{4})_(nodes|ways|v0)/);
    if (!match) return;
    const [, year, type] = match;
    if (String(version).includes('_nodes_to_ways_')) return;

    tablesByYear[Number(year)] = tablesByYear[Number(year)] || {};
    if (type === 'nodes') tablesByYear[Number(year)].nodes = data_table;
    else if (type === 'ways') tablesByYear[Number(year)].ways = data_table;
    else if (type === 'v0') tablesByYear[Number(year)].v0 = data_table;
  });

  for (let year = 2016; year <= currentYear; year++) {
    if (!tablesByYear[year]) tablesByYear[year] = { nodes: null, ways: null, v0: null };
    ['nodes', 'ways', 'v0'].forEach((type) => {
      if (!tablesByYear[year][type]) {
        let fb = year - 1;
        while (fb >= 2016 && !(tablesByYear[fb] && tablesByYear[fb][type])) fb--;
        if (fb >= 2016) {
          tablesByYear[year][type] = tablesByYear[fb][type];
        } else {
          let ff = year + 1;
          while (ff <= currentYear && !(tablesByYear[ff] && tablesByYear[ff][type])) ff++;
          if (ff <= currentYear) tablesByYear[year][type] = tablesByYear[ff][type];
        }
      }
    });
  }
  return tablesByYear;
}

/**
 * Build the conflation road graph for a year from plain SELECT row sets
 * (the legacy used COPY-to-stdout streams; same rows, simpler transport).
 *   nodeRows: [{ id, geom (GeoJSON string or object) }]
 *   wayRows:  [{ id, osm_fwd, tmc, node_ids (JSON string or array) }]
 */
function buildGraphFromRows(nodeRows, wayRows) {
  const graph = makeGraph();

  for (const { id, geom } of nodeRows || []) {
    const g = typeof geom === 'string' ? JSON.parse(geom) : geom;
    graph.addNode(+id, { coords: g.coordinates });
    graph.addNode(-id, { coords: g.coordinates });
  }

  const tempGraph = makeGraph();
  const ways = [];
  for (const row of wayRows || []) {
    const id = row.id;
    const osm_fwd = +row.osm_fwd;
    const tmc = row.tmc;
    const nodes = (typeof row.node_ids === 'string' ? JSON.parse(row.node_ids) : row.node_ids)
      .map((n) => +n);
    ways.push([id, osm_fwd, tmc, nodes]);
    for (let i = 1; i < nodes.length; ++i) {
      if (nodes[i - 1] !== nodes[i]) {
        tempGraph.addLink(nodes[i - 1], nodes[i], { wayId: id, tmc, osm_fwd });
      }
    }
  }

  for (const [id, osm_fwd, tmc, nodes] of ways) {
    const dir = osm_fwd === 0 ? -1 : 1;
    for (let i = 1; i < nodes.length; ++i) {
      if (nodes[i - 1] !== nodes[i]) {
        graph.addLink(nodes[i - 1] * dir, nodes[i] * dir, { wayId: id, tmc, osm_fwd });
      }
    }
    const lastNode = nodes[nodes.length - 1];
    const tempNode = tempGraph.getNode(lastNode);
    if (tempNode) {
      Array.from(tempNode.links)
        .filter(({ fromId, data }) => fromId == lastNode && data.osm_fwd != osm_fwd) // eslint-disable-line eqeqeq
        .forEach(({ toId, data }) => {
          if (!nodes.includes(+toId)) {
            graph.addLink(lastNode * dir, +toId, data);
          }
        });
    }
  }

  return graph;
}

module.exports = {
  // pure helpers
  rollupByTmcDate,
  piecewiseLinear,
  haversineKm,
  makeGraph,
  timeStringToEpoch,
  buildEventTimes,
  postProcessIncidentRows,
  getDist,
  calcDelay,
  expandEpochs,
  checkTmc,
  walkGraph,
  assembleCongestionData,
  processIncidents,
  makeFetchDelayRows,
  collectReachableTmcs,
  getYearToConflationTableNamesFromViews,
  buildGraphFromRows,
};
