// geocoding.geo.census.gov
const { createReadStream } = require("node:fs");
const { Readable } = require("node:stream");

const { csvFormatRows, csvFormatRow, csvParseRows, csvParse } = require("d3-dsv");

const { inBounds } = require("./checkForPoint");

const geocodeCache = new Map();
const pointsCache = new Map();

const addressRegex = /^(\d*[a-z1-9 ]+),?([a-z ]*),?(ny)?,?(\d*)$/;
const coordsRegex = /^(-?\d+[.]\d+),\s+(-?\d+[.]\d+)$/;

const batchURL = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch';
// const singleURL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

const spaces = /\s{2,}/g;
const commas = /,\s/g;
const periods = /[.]/g;
const commaAnd = /,\sand\s/g;
const ny = /new york/;
const nyAndZip = /ny\s(\d+)$/;
const cleanAddress = address => {
	if (!address) return null;
	return address.toString().trim()
								.replace(ny, "ny")
								.replace(nyAndZip, (m, c1) => `ny,${ c1 }`)
								.replaceAll(commaAnd, " and ")
								.replaceAll(spaces, " ")
								.replaceAll(commas, ",")
								.replaceAll(periods, "")
}

const cacheGeocodes = async (db, table) => {
	const sql = `
		SELECT id, LOWER(data->>'address_if_available') AS address
			FROM ${ table }
				WHERE data ? 'address_if_available'
				AND data->>'address_if_available' IS NOT NULL
	`
	const { rows } = await db.query(sql);

console.log("QUERIED", rows.length, "ROWS");

	const addresses = [];

	for (const { id, address } of (rows || [])) {

		const cleaned = cleanAddress(address);

		let match;
		if (match = coordsRegex.exec(address)) {
			const [lon, lat] = address.split(",").map(Number);
			if (inBounds(lon, lat)) {
				pointsCache.set(id, [lon, lat]);
			}
			else if (inBounds(lat, lon)) {
				pointsCache.set(id, [lat, lon]);
			}
		}
		else if (match = addressRegex.exec(cleaned)) {
			const [, road, city, state, zip] = match;
			const data = [id, road, city || null, "ny", zip || null];
			addresses.push(data);
		}
	}
	if (!addresses.length) return { ok: true, results: 0 }

console.log("RETRIEVED", addresses.length, "ADDRESSES");

	try {
		const formdata = new FormData();
		const csv = csvFormatRows(addresses);
		formdata.append('addressFile', new Blob([csv]), 'addresses.csv');
		formdata.append('benchmark', '4');

		const response = await fetch(batchURL, {
				method: "POST",
				body: formdata
			})
			.then(res => {
					if (!res.ok) {
						throw new Error(`Batch request error: ${ res.status }`);
					}
					return res.text();
			})
			.then(csvParseRows);

console.log("RETREIVED", response.length, "RESULTS")

		for (const row of response) {
			if (row[2] === "Match") {
				const id = row[0];
				const coords = row[5].split(",");
				geocodeCache.set(id, coords);
			}
		}

console.log("RETREIVED", geocodeCache.size, "COORDS")

		return { ok: true, results: geocodeCache.size };
	}
	catch (e) {
		return { ok: false, error: e.message || e };
	}
}

const checkGeocodeCache = (id, checkPointsCache = false) => {
	if (checkPointsCache) {
		return pointsCache.get(id);
	}
	return geocodeCache.get(id);
}

module.exports = {
	cacheGeocodes,
	checkGeocodeCache
};

"818 holley rd elmira ny 14905"