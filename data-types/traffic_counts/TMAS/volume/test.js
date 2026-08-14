

const volumeURL = "https://nysdottrafficdata.drakewell.com/dataserver/trafficData/volume";

;(async () => {
	fetch(volumeURL, {
		method: "POST",
		headers: {
			'Accept': "*/*",
			'Content-Type': "application/json"
		},
		body: JSON.stringify({
			channelGrouping: ["total", "direction", "channel"],
			endTime: "2020-08-06",
			eventExclusion: 0,
			excludeHolidays: false,
			excludeUnchecked: true,
			includeFlags: true,
			includeZeroCoverage: false,
			interval: 3600,
			returnNumericDates: true,
			site: "70DBB755-69AF-460A-AB0A-0F3E8BE32D12",
			startTime: "2020-08-05",
		})
	}).then(res => res.json())
		.then(res => console.log("VOLUME RES:", res))
		.catch(error => console.log("VOLUME ERROR:", error))
})();

const siteURL = "https://nysdottrafficdata.drakewell.com/dataserver/sites";

;(async () => {
	fetch(siteURL, {
		method: "POST",
		headers: {
			'Accept': "*/*",
			'Content-Type': "application/json"
		},
		body: JSON.stringify({
			site: "70DBB755-69AF-460A-AB0A-0F3E8BE32D12"
		})
	}).then(res => res.json())
		.then(res => console.log("SITES RES:", res))
		.catch(error => console.log("SITES ERROR:", error))
})();

const groupsURL = "https://nysdottrafficdata.drakewell.com/dataserver/groups";

;(async () => {
	fetch(groupsURL, {
		method: "POST",
		headers: {
			'Accept': "*/*"
		}
	}).then(res => res.json())
		.then(res => console.log("GROUPS RES:", res))
		.catch(error => console.log("GROUPS ERROR:", error))
})();