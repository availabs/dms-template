
const identity = i => i;

const whiteSpaces = /\s+/g;
const clean = row => {
	return row.replaceAll(whiteSpaces, "");
}

const fcRegex = /^\d{1,2}$/;
const homogenizeFC = fc => {
	if (fcRegex.test(fc)) {
		if (+fc <= 9) {
			return `${ fc }R`
		}
		return `${ +fc - 10 }U`
	}
	return fc;
}

const TMAS_PRE_2020_FORMAT_141 = [
	{ name: "Record Type",
		slice: [0, 1]
	},
	{ name: "State FIPS Code",
		slice: [1, 3]
	},
	{ name: "Functional Class",
		slice: [3, 5],
		homogenize: homogenizeFC
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
		slice: [13, 15],
		homogenize: y => `20${ y }`
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
let lastSlice = TMAS_PRE_2020_FORMAT_141[TMAS_PRE_2020_FORMAT_141.length -1]["slice"][1];
for (let i = 0; i < 24; ++i) {
	TMAS_PRE_2020_FORMAT_141.push({
		name: `Traffic Volume, hour ${ i }`,
		slice: [lastSlice + i * 5, lastSlice + i * 5 + 5]
	});
}
lastSlice = TMAS_PRE_2020_FORMAT_141[TMAS_PRE_2020_FORMAT_141.length -1]["slice"][1];
TMAS_PRE_2020_FORMAT_141.push({
	name: `Restrictions`,
	slice: [lastSlice, lastSlice + 1]
});

const TMAS_PRE_2020_FORMAT_143 = [
	{ name: "Record Type",
		slice: [0, 1]
	},
	{ name: "State FIPS Code",
		slice: [1, 3]
	},
	{ name: "Functional Class",
		slice: [3, 5],
		homogenize: homogenizeFC
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
		slice: [13, 17]
	},
	{ name: "Month of Data",
		slice: [17, 19]
	},
	{ name: "Day of Data",
		slice: [19, 21]
	},
	{ name: "Day of Week",
		slice: [21, 22]
	}
]
lastSlice = TMAS_PRE_2020_FORMAT_143[TMAS_PRE_2020_FORMAT_143.length -1]["slice"][1];
for (let i = 0; i < 24; ++i) {
	TMAS_PRE_2020_FORMAT_143.push({
		name: `Traffic Volume, hour ${ i }`,
		slice: [lastSlice + i * 5, lastSlice + i * 5 + 5]
	});
}
lastSlice = TMAS_PRE_2020_FORMAT_143[TMAS_PRE_2020_FORMAT_143.length -1]["slice"][1];
TMAS_PRE_2020_FORMAT_143.push({
	name: `Restrictions`,
	slice: [lastSlice, lastSlice + 1]
});

const homogenizeTMAS_PRE_2020 = (f, c) => {
	const func = f.homogenize || identity;
	return func(c);
}

const getTMASpre2020Row = row => {
	const cleanedRow = clean(row);
	if (cleanedRow.length === 141) {
		return TMAS_PRE_2020_FORMAT_141.map(f => {
			return {
				name: f.name,
				value: homogenizeTMAS_PRE_2020(f, cleanedRow.slice(...f.slice))
			}
		})
	}
	else if (cleanedRow.length === 143) {
		return TMAS_PRE_2020_FORMAT_143.map(f => {
			return {
				name: f.name,
				value: homogenizeTMAS_PRE_2020(f, cleanedRow.slice(...f.slice))
			}
		})
	}
	console.log("CLEANED ROW:", cleanedRow);
	throw new Error(`The TMAS file does not look correct: ${ cleanedRow.length }`);
}

const TMAS_POST_2020_KEYS = [
	{ key: "Record_Type",
		name: "Record Type"
	},
	{ key: "State_Code",
		name: "State FIPS Code"
	},
	{ key: "F_System",
		name: "Functional Class",
		homogenize: homogenizeFC
	},
	{ key: "Station_Id",
		name: "Station ID"
	},
	{ key: "Travel_Dir",
		name: "Direction of Travel"
	},
	{ key: "Travel_Lane",
		name: "Lane of Travel"
	},
	{ key: "Year_Record",
		name: "Year of Data"
	},
	{ key: "Month_Record",
		name: "Month of Data"
	},
	{ key: "Day_Record",
		name: "Day of Data"
	},
	{ key: "Day_of_Week",
		name: "Day of Week"
	},
	{ key: "Restrictions",
		name: "Restrictions",
		homogenize: v => !v ? '0' : v
	},
	{ key: "Time_Increment",
		name: "Time Increment"
	}
]
for (let i = 0; i < 24; ++i) {
	TMAS_POST_2020_KEYS.push({
		key: `Hour_${ i.toString().padStart(2, '0') }`,
		name: `Traffic Volume, hour ${ i }`
	});
}

const homogenizeTMAS_POST_2020 = (i, c) => {
	const func = TMAS_POST_2020_KEYS[i].homogenize || identity;
	return func(c);
}

const getTMASpost2020Row = row => {
	return clean(row).split("|")
		.reduce((a, c, i) => {
			if (TMAS_POST_2020_KEYS[i].key === "Time_Increment") {
				return a;
			}
			a.push({
				name: TMAS_POST_2020_KEYS[i].name,
				value: homogenizeTMAS_POST_2020(i, c)
			});
			return a;
		}, []);
}

const getColumnIndex = (row, col) => {
	return row.reduce((a, c, i) => {
		if (c.name === col) {
			return i;
		}
		return a;
	}, -1);
}

const composeDate = row => {
	const yearIndex = getColumnIndex(row, "Year of Data");
	const year = row[yearIndex].value;

	const monthIndex = getColumnIndex(row, "Month of Data");
	const month = row[monthIndex].value;
	const monthPadded = Number(month).toString().padStart(2, '0');

	const dayIndex = getColumnIndex(row, "Day of Data");
	const day = row[dayIndex].value;
	const dayaPadded = Number(day).toString().padStart(2, '0');

	row.splice(yearIndex, 3, {
		name: "Date of Data",
		value: `${ year }-${ monthPadded }-${ dayaPadded }`
	});

	return row;
}

export const checkTmasFile = text => {
	const usePre2020 = text.slice(0, 141).split("|").length === 1;
	if (usePre2020) {
		return {
			usePre2020,
			rows: text.split("\n")
								.filter(r => r.length)
								.map(getTMASpre2020Row)
								.map(composeDate)
		};
	}
	return {
		usePre2020,
		rows: text.split("\n")
							.slice(1)
							.filter(r => r.length)
							.map(getTMASpost2020Row)
							.map(composeDate)
	}
}

export const PreviewColumns = [
	"Record Type",
	"State FIPS Code",
	"Functional Class",
	"Station ID",
	"Direction of Travel",
	"Lane of Travel",
	"Date of Data",
	"Day of Week",
	"Restrictions"
]
const DataColumns = [];
for (let i = 0; i < 24; ++i) {
	DataColumns.push(`Traffic Volume, hour ${ i }`);
}
export { DataColumns };