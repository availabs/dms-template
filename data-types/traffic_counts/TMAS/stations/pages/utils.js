

const TMAS_STATION_KEYS = [
	"record_type",
	"state_code",
	"station_id",
	"travel_dir",
	"travel_lane",
	"year_recorded",
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
const TMAS_STATION_KEYS_MAP = TMAS_STATION_KEYS.reduce((a, c, i) => {
	a[c] = i;
	return a;
}, {});

const TMAS_2025_STATION_KEYS = [
	"record_type",
	"state_code",
	"station_id",
	"travel_dir",
	"travel_lane",
	"year_recorded",
	"f_system",
	"num_lanes",
	"num_classes",
	"calibration",
	"type_sensor_1",
	"type_sensor_2",
	"latitude",
	"longitude",
	"prev_station_id",
	"year_established",
	"year_discontinued",
	"county_code",
	"nhs",
	"posted_route_signing",
	"posted_signed_route",
	"station_location"
]
const TMAS_2025_STATION_KEYS_MAP = TMAS_2025_STATION_KEYS.reduce((a, c, i) => {
	a[c] = i;
	return a;
}, {});

const get2025value = (row, key) => {
	if (key in TMAS_2025_STATION_KEYS_MAP) {
		const index = TMAS_2025_STATION_KEYS_MAP[key];
		return row[index];
	}
	return null;
}

export const PreviewColumns = TMAS_STATION_KEYS.slice(1, -1);

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

const TMAS_2025_STATION_TRANSFORMS = {
	"f_system": homogenizeFsystem
}

const identity = i => i;

const homogenize = (i, c, use2025transform = false) => {
	const key = TMAS_STATION_KEYS[i];
	const func = (use2025transform ? TMAS_2025_STATION_TRANSFORMS[key] : TMAS_STATION_TRANSFORMS[key]) || identity;
	return func(c);
}

const cleanValue = v => {
	switch (typeof v) {
	case "string":
		return v.trim() ? v.trim() : null;
		break;
	case "number":
		return isNaN(v) ? null : v;
		break;
	}
}

const getRow = textRow => {
	const row = textRow.trim().split("|");

	if (row.length < TMAS_STATION_KEYS.length) {
		return TMAS_STATION_KEYS.reduce((a, c, i) => {
			const value = get2025value(row, c);
			if (value !== null) {
				a.push({
					name: c,
					value: cleanValue(homogenize(i, value, true))
				});
			}
			else {
				a.push({
					name: c,
					value: null
				});
			}
			return a;
		}, []);
	}

	return row.reduce((a, c, i) => {
		a.push({
			name: TMAS_STATION_KEYS[i],
			value: cleanValue(homogenize(i, c))
		});
		return a;
	}, []);
}

export const getFileContent = text => {
	return text.replace(/\u0000/g, "")
							.split("\n")
							.slice(1)
							.filter(r => r.length)
							.map(getRow)
							.filter(row => {
								return +row[1].value === 36;
							})
}