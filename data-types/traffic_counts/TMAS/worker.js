const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { createWriteStream } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

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

		bufferedFile
  } = task.descriptor;

  const url = join(tmpdir(), "test_file.txt");
  console.log("##################################");
  console.log("##################################");
  console.log("URL", url);
  console.log("##################################");
  console.log("##################################");

  await pipeline(
  	Readable.from([bufferedFile]),
  	createWriteStream(url)
  );

  result.completedAt = new Date().toLocaleString();

	return result;
}

module.exports = Worker;