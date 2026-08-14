

const TMAS_STATION_KEYS = [
	"record_type",
	"state_fips",
	"station_id",
	"travel_dir",
	"travel_lane",
	"year_record",
	"f_system",
	"num_lanes",
	"sample_type_volume",
	"num_lanes_volume",
	"method_volume",
	"sample_type_class",
	"num_lanes_class",
	"method_class",
	"algorithm_volume",
	"num_classes",
	"sample_type_truck",
	"num_lanes_truck",
	"method_truck",
	"calibration",
	"data_retrieval",
	"type_sensor_1",
	"type_sensor_2",
	"primary_purpose",
	"lrs_id",
	"lrs_point",
	"latitude",
	"longitude",
	"shrp_id",
	"prev_station_id",
	"year_established",
	"year_discontinued",
	"county_code",
	"is_sample",
	"sample_id",
	"nhs",
	"posted_route_signing",
	"posted_signed_route",
	"con_route_signing",
	"con_signed_route",
	"station_location",
]
const TMAS_STATION_KEY_INDICES = TMAS_STATION_KEYS.reduce((a, c, i) => {
	a[c] = i;
	return a;
}, {});

const PreviewColumns = TMAS_STATION_KEYS.slice(1, -1);

const fsRegex = /^\d{1,2}$/;
const homogenizeFsystem = fs => {
	if (fsRegex.test(fs)) {
		if (+fs <= 9) {
			return `${ fs }R`
		}
		return `${ +fs - 10 }U`
	}
	return fs;
}

const getitude = str => (+str).toString();

const TMAS_STATION_TRANSFORMS = {
	"latitude": lat => {
		lat = getitude(lat);
		return parseFloat(`${ lat.slice(0, 2) }.${ lat.slice(2) }`);
	},
	"longitude": lng => {
		lng = getitude(lng);
		return parseFloat(`-${ lng.slice(0, 2) }.${ lng.slice(2) }`);
	},
	"f_system": homogenizeFsystem
}
const identity = i => i;

const homogenize = (i, c) => {
	const key = TMAS_STATION_KEYS[i];
	const func = TMAS_STATION_TRANSFORMS[key] || identity;
	return func(c);
}

const getStationRow = string => {
	return string.split("|")
								.reduce((a, c, i) => {
									a.push({
										name: TMAS_STATION_KEYS[i],
										value: homogenize(i, c)
									});
									return a;
								}, []);
}
// TMAS station files use a literal NUL byte (0x00) as the blank-field filler,
// not a space — the sample NY 2025 file carries 1295 of them across 713 rows.
// String.prototype.trim() does NOT strip NUL (it isn't WhiteSpace per spec), so
// the byte survives into the COPY stream and Postgres rejects the whole load
// with `invalid byte sequence for encoding "UTF8": 0x00`. Strip NUL and any
// other C0 control byte, then trim.
const cleanValue = d =>
	(d === null || d === undefined ? "" : d.toString())
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001F]/g, "")
		.trim();

const getTableValues = row => {
	const latitudeIndex = TMAS_STATION_KEY_INDICES["latitude"];
	const latitude = row[latitudeIndex];
	const longitudeIndex = TMAS_STATION_KEY_INDICES["longitude"];
	const longitude = row[longitudeIndex];
	row.splice(latitudeIndex, 2);
	const point = {
		type: "Point",
		coordinates: [longitude, latitude]
	}
	return [
		...row.slice(1).map(di => di.value),
		JSON.stringify(point)
	].map(d => cleanValue(d));
}

const TMAScolumns = [
  { 'name': 'ogc_fid',
  	'display_name': 'ogc_fid',
  	'type': 'INTEGER',
  	'desc': "serialized ID"
  },
  { 'name': 'state_fips',
  	'display_name': 'State FIPS Code',
  	'type': 'TEXT',
  	'desc': `The state FIPS code.`
  },
  { 'name': 'station_id',
  	'display_name': 'Station ID',
  	'type': 'TEXT',
  	'desc': `Alphanumeric designation for the station where the survey data are collected.`
  },
  { 'name': 'travel_dir',
  	'display_name': 'Direction of Travel Code',
  	'type': 'TEXT',
  	'desc': `There should be a separate record for each direction of travel. Whether or not lanes are combined in each direction depends on Lane of Travel.`
  },
  { 'name': 'travel_lane',
  	'display_name': 'Lane of Travel',
  	'type': 'TEXT',
  	'desc': `Either each lane is considered a separate station or all lanes in each direction are combined.`
  },
  { 'name': 'year_record',
  	'display_name': 'Year of Data',
  	'type': 'TEXT',
  	'desc': `Year in which the data were collected.`
  },
  { 'name': 'f_system',
  	'display_name': 'Functional Classification Code',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'num_lanes',
  	'display_name': 'Number of Lanes in Direction Indicated',
  	'type': 'TEXT',
  	'desc': `The number of lanes in one direction at the site regardless of the number of lanes being monitored. Use 9 if there are more than eight lanes.`
  },
  { 'name': 'sample_type_volume',
  	'display_name': 'Sample Type for TMAS Volume data',
  	'type': 'TEXT',
  	'desc': `Y = Station used for TMAS. N = Station not used for TMAS.`
  },
  { 'name': 'num_lanes_volume',
  	'display_name': 'Number of Lanes Monitored for Traffic Volume',
  	'type': 'TEXT',
  	'desc': `The number of lanes in one direction that are monitored at this site. Use 9 if there are more than eight lanes.`
  },
  { 'name': 'method_volume',
  	'display_name': 'Method of Traffic Volume Counting',
  	'type': 'TEXT',
  	'desc': `1 = Human observation (manual). 2 = Portable traffic recording device. 3 = Permanent continuous count station.`
  },
  { 'name': 'sample_type_class',
  	'display_name': 'Sample Type for TMAS Vehicle Classification data',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'num_lanes_class',
  	'display_name': 'Number of Lanes Monitored for Vehicle Classification and/or speed',
  	'type': 'TEXT',
  	'desc': `The number of lanes in one direction that are monitored for vehicle classification and/or speed at this site. Use 9 if there are more than eight lanes in a given direction.`
  },
  { 'name': 'method_class',
  	'display_name': 'Method of Vehicle Classification',
  	'type': 'TEXT',
  	'desc': `1 = Human observation (manual) vehicle classification. 2 = Portable vehicle classification device. 3 = Permanent vehicle classification device. 4 = Speed only.`
  },
  { 'name': 'algorithm_volume',
  	'display_name': '',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'num_classes',
  	'display_name': 'Vehicle Classification Groupings',
  	'type': 'TEXT',
  	'desc': `The value in this field indicates the total number of classes in the vehicle classification system being used as well as how vehicles are grouped together in those classes in relation to the 13 FHWA categories.`
  },
  { 'name': 'sample_type_truck',
  	'display_name': '',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'num_lanes_truck',
  	'display_name': 'Number of Lanes Monitored for Truck Weight',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'method_truck',
  	'display_name': '',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'calibration',
  	'display_name': 'Calibration of Weighing System',
  	'type': 'TEXT',
  	'desc': `the method used to calibrate the weighing system.`
  },
  { 'name': 'data_retrieval',
  	'display_name': 'Method of Data Retrieval',
  	'type': 'TEXT',
  	'desc': `1 = Not automated (manual). 2 = Automated (telemetry).`
  },
  { 'name': 'type_sensor_1',
  	'display_name': 'Type of Sensor',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'type_sensor_2',
  	'display_name': 'Second Type of Sensor',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'primary_purpose',
  	'display_name': 'Primary Purpose',
  	'type': 'TEXT',
  	'desc': `The primary purpose of the sensor and which organization is responsible for it.`
  },
  { 'name': 'lrs_id',
  	'display_name': 'LRS Identification',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'lrs_point',
  	'display_name': 'LRS Location Point',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'shrp_id',
  	'display_name': '',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'prev_station_id',
  	'display_name': 'Previous Station ID',
  	'type': 'TEXT',
  	'desc': `If the station replaces another station, give the station ID that was used previously. Blank-fill this field when unused.`
  },
  { 'name': 'year_established',
  	'display_name': 'Year Station Established',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'year_discontinued',
  	'display_name': 'Year Station Discontinued',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'county_code',
  	'display_name': 'FIPS County Code',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'is_sample',
  	'display_name': 'HPMS Sample Type',
  	'type': 'TEXT',
  	'desc': `N = not on an HPMS standard sample section. Y = on an HPMS standard sample section.`
  },
  { 'name': 'sample_id',
  	'display_name': 'HPMS Sample Identifier',
  	'type': 'TEXT',
  	'desc': `If the station is on an HPMS standard sample section, the HPMS Sample Identifier.`
  },
  { 'name': 'nhs',
  	'display_name': 'National Highway System',
  	'type': 'TEXT',
  	'desc': `N = not on National Highway System. Y = on National Highway System.`
  },
  { 'name': 'posted_route_signing',
  	'display_name': 'Posted Route Signing',
  	'type': 'TEXT',
  	'desc': `This is the same as Route Signing in HPMS.`
  },
  { 'name': 'posted_signed_route',
  	'display_name': 'Posted Signed Route Number',
  	'type': 'TEXT',
  	'desc': `The route number of the principal route on which the station is located.`
  },
  { 'name': 'con_route_signing',
  	'display_name': '',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'con_signed_route',
  	'display_name': '',
  	'type': 'TEXT',
  	'desc': ``
  },
  { 'name': 'station_location',
  	'display_name': 'Station Location',
  	'type': 'TEXT',
  	'desc': `For stations located on a numbered route, enter the name of the nearest major intersecting route, State border, or landmark on State road maps and the distance and direction of the station from that landmark to the station (e.g., “12 miles south of the Kentucky border”). If the station is located on a city street, enter the city and street name. Abbreviate if necessary.`
  }
]

module.exports = {
  getStationRow,
  getTableValues,
  TMAScolumns
}