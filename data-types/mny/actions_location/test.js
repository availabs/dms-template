const Worker = require("./worker.js")
const { getDb } = require('@availabs/dms-server/src/db');

const fakeCTX = {
	dispatchEvent: (e, d) => console.log(e, d),
	updateProgress: p => console.log("PROGRESS:", p),
	db: getDb("hazmit_dama"),
	pgEnv: "hazmit_dama",
	task: {
		descriptor: {
			actionsSource: 1029065,
			jurisdictionsView: 2297,
			countiesView: 2157,
			pgEnv: "hazmit_dama"
		}
	}
}

;(async () => {
	await Worker(fakeCTX);
})()