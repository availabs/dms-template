

const notNumbers = [false, true, null, "", []]
const strictNaN = v => {
  if (notNumbers.includes(v)) return true;
  return isNaN(v);
}

const getLongitude = di => {
	if (di.longitude) return +di.longitude;
	if (di.lon) return +di.lon;
	if (di.lng) return +di.lng;
	return false;
}
const getLatitude = di => {
	if (di.latitude) return +di.latitude;
	if (di.lat) return +di.lat;
	return false;
}

const coordsRegex = /^\[?(-?\d+.\d+)[wWnN]?\s*,\s*(-?\d+.\d+)[wWnN]?\]?$/;

const getCoords = di => {
	const coords = di.coordinates || di.coords;
	if (coords) {
	 	if (Array.isArray(coords)) {
	 		return coords.map(Number);
	 	}
	 	else if (typeof coords === "string") {
  		const match = coordsRegex.exec(coords);
  		if (match) {
  			const [lon, lat] = match;
  			if (!strictNaN(lon) && !strictNaN(lat)) {
	  			return [+lon, +lat];
	  		}
  		}
	 	}
	}
	const lon = getLongitude(di);
	const lat = getLatitude(di);
	if (!strictNaN(lon) && !strictNaN(lat)) {
		return [+lon, +lat];
	}
	return null;
}

const nyBounds = [
	[-79.77, 45.02], // left, top
	[-71.85, 40.50]  // right, bottom
]
const inBounds = (lon, lat) => {
	if (lon < nyBounds[0][0]) return false;
	if (lon > nyBounds[1][0]) return false;
	if (lat > nyBounds[0][1]) return false;
	if (lat < nyBounds[1][1]) return false;
	return true;
}

const makeGeoJSON = coordinatess => {
	return {
		type: "Point",
		coordinates
	}
}

const checkForPoint = di => {
	const coords = getCoords(di);
	if (!coords) {
		return null;
	}
	const [lon, lat] = coords;
	if (inBounds(lon, lat)) {
		return makeGeoJSON([lon, lat]);
	}
	if (inBounds(lat, lon)) {
		return makeGeoJSON([lat, lon]);
	}
	return null;
}

module.exports = {
	checkForPoint,
	inBounds
};