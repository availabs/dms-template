/**
 * TRANSCOM event normalization: raw HistoricalEventSearch getEventById payload
 * -> a row object keyed by the transcom events table column names.
 *
 * Ported 1:1 from the legacy insertEvents() row mapping in
 * avail-falcor/dama/routes/data_types/transcom/transcom.worker.mjs, including
 * its quirky-but-load-bearing coercions:
 *   - `value || null`            (0 / '' / false all collapse to NULL)
 *   - `Boolean(value) || null`   (false collapses to NULL, truthy -> TRUE)
 *   - TRANSCOM 'MM/DD/YYYY hh:mm:ss A' datetimes parsed to wall-clock
 *     'YYYY-MM-DD HH:MM:SS' strings. (The legacy code ran them through
 *     moment(...).toISOString(), shifting by the server timezone before
 *     storing into a TIMESTAMP-without-tz column; keeping the wall clock is
 *     the intended value. Documented as a deliberate deviation.)
 *   - month / day_of_month / month_year derived from 'Start DateTime'.
 */

const DT_RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2}) (AM|PM)$/;

/** 'MM/DD/YYYY hh:mm:ss A' -> 'YYYY-MM-DD HH:MM:SS' (wall clock), else null. */
function parseTranscomDateTime(value) {
  if (!value) return null;
  const m = DT_RE.exec(String(value).trim());
  if (!m) return null;
  const [, MM, DD, YYYY, hh, mm, ss, ap] = m;
  let H = Number(hh) % 12;
  if (ap === 'PM') H += 12;
  return `${YYYY}-${MM}-${DD} ${String(H).padStart(2, '0')}:${mm}:${ss}`;
}

const orNull = (v) => v || null; // legacy `value || null` — 0/''/false collapse to NULL
const boolOrNull = (v) => (Boolean(v) || null);

/** Normalize one raw API event into { column_name: value }. */
function normalizeEvent(event) {
  const e = event || {};
  const startDt = parseTranscomDateTime(e['Start DateTime']);
  // month/day_of_month/month_year come from the wall-clock Start DateTime string
  let month = null;
  let dayOfMonth = null;
  let monthYear = null;
  const sm = DT_RE.exec(String(e['Start DateTime'] || '').trim());
  if (sm) {
    month = Number(sm[1]);
    dayOfMonth = Number(sm[2]);
    monthYear = `${sm[1]}-${sm[3]}`;
  }

  return {
    event_id: e.ID,
    event_class: orNull(e['Event Class']),
    reporting_organization: orNull(e['Reporting Organization']),
    start_date_time: startDt,
    end_date_time: orNull(e['End DateTime']),
    last_updatedate: parseTranscomDateTime(e['Last Updatedate']),
    close_date: parseTranscomDateTime(e['Close Date']),
    estimated_duration_mins: orNull(e.Estimated_Duration_Mins),
    event_duration: orNull(e.eventDuration),
    facility: orNull(e.Facility),
    event_type: orNull(e['Event Type']),
    lanes_total_count: orNull(e['Lanes Total Count']),
    lanes_affected_count: orNull(e['Lanes Affected Count']),
    lanes_detail: orNull(e['Lanes Detail']),
    lanes_status: orNull(e['Lanes Status']),
    description: orNull(e.Description),
    direction: orNull(e.Direction),
    county: orNull(e.County),
    city: orNull(e.City),
    city_article: orNull(e['City Article']),
    primary_city: orNull(e['Primary City']),
    secondary_city: orNull(e['Secondary City']),
    point_lat: orNull(e.PointLAT),
    point_long: orNull(e.PointLONG),
    location_article: orNull(e['Location Article']),
    primary_marker: orNull(e['Primary Marker']),
    secondary_marker: orNull(e['Secondary Marker']),
    primary_location: orNull(e['Primary location']),
    secondary_location: orNull(e['Secondary location']),
    state: orNull(e.State),
    region_closed: orNull(e['Region Closed']),
    point_datum: orNull(e['Point Datum']),
    marker_units: orNull(e['Marker Units']),
    marker_article: orNull(e['Marker Article']),
    summary_description: orNull(e.SummaryDescription),
    eventstatus: orNull(e.Eventstatus),
    is_highway: boolOrNull(e.isHighway),
    icon_file: orNull(e.IconFile),
    start_incident_occured: parseTranscomDateTime(e.StartIncidentOccured),
    started_at_date_time_comment: orNull(e.StartedAtDateTimeComment),
    incident_reported: parseTranscomDateTime(e.IncidentReported),
    incident_reported_comment: orNull(e.IncidentReportedComment),
    incident_verified: parseTranscomDateTime(e.IncidentVerified),
    incident_verified_comment: orNull(e.IncidentVerifiedComment),
    response_identified_and_dispatched: parseTranscomDateTime(e.ResponseIdentifiedAndDispatched),
    response_identified_and_dispatched_comment: orNull(e.ResponseIdentifiedAndDispatchedComment),
    response_arrives_on_scene: parseTranscomDateTime(e.ResponseArrivesonScene),
    response_arrives_on_scene_comment: orNull(e.ResponseArrivesonSceneComment),
    end_all_lanes_open_to_traffic: parseTranscomDateTime(e.EndAllLanesOpenToTraffic),
    ended_at_date_time_comment: orNull(e.EndedAtDateTimeComment),
    response_departs_scene: parseTranscomDateTime(e.ResponseDepartsScene),
    response_departs_scene_comment: orNull(e.ResponseDepartsSceneComment),
    time_to_return_to_normal_flow: parseTranscomDateTime(e.TimeToReturnToNormalFlow),
    time_to_return_to_normal_flow_comment: orNull(e.TimeToReturnToNormalFlowComment),
    no_of_vehicle_involved: orNull(e.NoOfVehicleInvolved),
    secondary_event: boolOrNull(e.SecondaryEvent),
    secondary_event_types: orNull(e.SecondaryEventTypes),
    secondary_involvements: orNull(e.SecondaryInvolvements),
    within_work_zone: boolOrNull(e.WithinWorkZone),
    truck_commercial_vehicle_involved: boolOrNull(e.TruckCommercialVehicleInvolved),
    shoulder_available: boolOrNull(e.ShoulderAvailable),
    injury_involved: boolOrNull(e.InjuryInvolved),
    fatality_involved: boolOrNull(e.FatalityInvolved),
    maintance_crew_involved: boolOrNull(e.MaintanceCrewInvolved),
    roadway_clearance: orNull(e.RoadwayClearance),
    incident_clearance: orNull(e.IncidentClearance),
    time_to_return_to_normal_flow_duration: orNull(e.TimeToReturnToNormalFlowDuration),
    duration: orNull(e.Duration),
    associated_impact_ids: orNull(e.AssociatedImpactIds),
    secondary_event_ids: orNull(e.SecondaryEventIds),
    is_transit: boolOrNull(e.IsTransit),
    is_shoulder_lane: boolOrNull(e.IsShoulderLane),
    is_toll_lane: boolOrNull(e.IsTollLane),
    lanes_affected_detail: orNull(e.LanesAffectedDetail),
    to_facility: orNull(e.ToFacility),
    to_state: orNull(e.ToState),
    to_direction: orNull(e.ToDirection),
    fatality_involved_associated_event_id: boolOrNull(e.fatalityInvolved_associatedEventID),
    with_in_work_zone_associated_event_id: orNull(e.withInWorkZone_associatedEventID),
    to_lat: orNull(e.ToLat),
    to_lon: orNull(e.ToLon),
    primary_direction: orNull(e.PrimaryDirection),
    secondary_direction: orNull(e.SecondaryDirection),
    is_both_direction: boolOrNull(e.IsBothDirection),
    secondary_lanes_affected_count: orNull(e['Secondary Lanes Affected Count']),
    secondary_lanes_detail: orNull(e['Secondary Lanes Detail']),
    secondary_lanes_status: orNull(e['Secondary Lanes Status']),
    secondary_lanes_total_count: orNull(e['Secondary Lanes Total Count']),
    secondary_lanes_affected_detail: orNull(e.SecondaryLanesAffectedDetail),
    event_location_latitude: orNull(e.EventLocationLatitude),
    event_location_longitude: orNull(e.EventLocationLongitude),
    tripcnt: boolOrNull(e.tripcnt),
    tmclist: orNull(e.Tmclist),
    recoverytime: orNull(e.Recoverytime),
    year: orNull(e.Year),
    datasource: boolOrNull(e.Datasource),
    datasourcevalue: orNull(e.Datasourcevalue),
    day_of_week: orNull(e.DayofWeek),
    tmc_geometry: orNull(e.tmc_geometry),
    month,
    day_of_month: dayOfMonth,
    month_year: monthYear,
  };
}

module.exports = {
  parseTranscomDateTime,
  normalizeEvent,
};
