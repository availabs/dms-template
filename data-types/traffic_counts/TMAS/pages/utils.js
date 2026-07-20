
const TMAS_PRE_2020_FORMAT = [
	{ name: "Record Type",
		slice: [0, 1]
	},
	{ name: "FIPS State Code",
		slice: [1, 3]
	},
	{ name: "Functional Class",
		slice: [3, 5]
	},
	{ name: "Station ID",
		slice: [5, 11]
	},
	{ name: "Direction of Travel",
		slice: [11, 12]
	},
	{ name: "Lane of Travel",
		slice: [12, 13]
	},
	{ name: "Year of Data",
		slice: [13, 15]
	},
	{ name: "Month of Data",
		slice: [15, 17]
	},
	{ name: "Day of Data",
		slice: [17, 19]
	},
	{ name: "Day of Week",
		slice: [19, 20]
	}
]

for (let i = 0; i < 24; ++i) {
	TMAS_PRE_2020_FORMAT.push({
		name: `Traffic Volume, hour ${ i }`,
		slice: [20 + i * 5, 20 + i * 5 + 5]
	});
}
TMAS_PRE_2020_FORMAT.push({
	name: `Restrictions`,
	slice: [140, 141]
});

const getTMASpre2020Row = row => {
	return TMAS_PRE_2020_FORMAT.map(f => {
		return {
			name: f.name,
			value: row.slice(...f.slice)
		}
	})
}

export const checkTmasFile = text => {
	const usePre2020 = text.slice(0, 141).split("|").length === 1;
	const rows = text.split("\n").slice(0, 5).map(getTMASpre2020Row);
	return { usePre2020, rows }
}