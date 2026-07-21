const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { createReadStream, createWriteStream } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const split2 = require("split2");

const { getTMASrowProcessor } = require("./utils.js");

const Worker = async ctx => {

  const result = {
    ok: true,
    startedAt: new Date().toLocaleString(),
    completedAt: null,
  };

  const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
  const {
		source_id,
		source_name,

		user_id,

		format,

		tempFilePath
  } = task.descriptor.args;

  let i = 0;

  async function* test(source) {
  	for await (const row of source) {
  		if (i++ < 5) {
	  		console.log("test::row", row);
	  	}
  	}
  }

  await pipeline(
  	createReadStream(tempFilePath),
  	split2(getTMASrowProcessor(format)),
  	test
  );

  result.completedAt = new Date().toLocaleString();

	return result;
}

module.exports = Worker;