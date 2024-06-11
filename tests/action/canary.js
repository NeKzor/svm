const { readFile } = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");

const isWindows = process.platform === "win32";
const files = isWindows ? ["sar.dll", "sar.pdb"] : ["sar.so"];

// @ts-check
/** @param {import('@types/github-script').AsyncFunctionArguments} AsyncFunctionArguments */
module.exports = async ({ context, core }) => {
  const git = spawnSync("git", ["describe", "--tags"]);
  if (git.status !== 0) {
    return git.stderr.toString("utf-8");
  }

  const SAR_VERSION = git.stdout.toString("utf-8");

  core.info(`Uploading canary version ${SAR_VERSION}`);

  const body = new FormData();
  body.set("version", `${SAR_VERSION.split("-").at(0)}-canary`);
  body.set("sar_version", `${SAR_VERSION}-canary`);
  body.set("system", isWindows ? "windows" : "linux");
  body.set("commit", context.sha);
  body.set("branch", context.ref.split("/").at(-1));
  body.set("count", files.length.toString());

  for (let i = 0; i < files.length; ++i) {
    const filename = files[i];
    const file = await readFile(`./bin/${filename}`);
    body.set(`hashes[${i}]`, createHash("sha256").update(file).digest("hex"));
    body.set(`files[${i}]`, new Blob([file]), filename);
  }

  core.debug(JSON.stringify([...body.entries()]));

  const res = await fetch("https://dl.sar.portal2.sr/api/v1/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.DL_SAR_API_TOKEN}`,
      "Content-Type": "multipart/form-data",
    },
    body,
  });

  core.info(res.statusText);

  return await res.text();
};
