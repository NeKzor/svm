// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

import { join } from "@std/path";
import { BinFolder } from "./constants.ts";
import { db } from "./db.ts";
import { GitHubRelease, GitRefTag } from "./github.ts";
import { logger } from "./logger.ts";
import { BinaryFile, ReleaseVersion } from "./models.ts";
import { calcCrc32, calcSha256Hash, tryMakeDir } from "./utils.ts";

const res = await fetch(
  "https://api.github.com/repos/p2sr/SourceAutoRecord/releases",
);
const releases = await res.json() as GitHubRelease[];

let insertedRelease = false;
let insertedPrerelease = false;

for (const release of releases) {
  const refTagRes = await fetch(
    `https://api.github.com/repos/p2sr/SourceAutoRecord/git/ref/tags/${release.tag_name}`,
  );
  const refTag = await refTagRes.json() as GitRefTag;

  const version = release.tag_name;
  const commit = refTag.object.sha;
  const sarVersion = `${version}-0-g${commit.slice(0, 9)}`;
  const branch = release.target_commitish;

  const channel = (() => {
    if (version.includes("-pre")) {
      return "prerelease";
    }
    return "release";
  })();

  if (
    (!insertedRelease && channel === "release") ||
    (!insertedPrerelease && channel === "prerelease")
  ) {
    if (channel === "release") {
      insertedRelease = true;
    } else {
      insertedPrerelease = true;
    }

    const releaseVersionKey = ["latest", channel];

    const releaseVersion = {
      channel,
      version,
      sar_version: sarVersion,
      commit,
      branch,
      date: new Date(Date.parse(release.created_at)),
    } satisfies ReleaseVersion;

    const { ok } = await db.set(releaseVersionKey, releaseVersion);
    if (ok) {
      logger.info(`Inserted release version ${releaseVersionKey.join(", ")}`);
    } else {
      logger.error(
        `Failed to insert release version ${JSON.stringify(releaseVersion)}`,
      );
    }
  }

  for (const asset of release.assets) {
    const download = await fetch(asset.browser_download_url);

    const name = asset.name;
    const system = name.endsWith(".so") ? "linux" : "windows";
    const file = new Uint8Array(await download.arrayBuffer());
    const hash = await calcSha256Hash(file);

    const folder = join(BinFolder, channel, sarVersion, system);
    await tryMakeDir(folder);

    const path = join(folder, name);

    await Deno.writeFile(path, file, { create: true });

    const key = ["bin", version, system, name];

    const bin = {
      version,
      system,
      name,
      hash,
      checksum: calcCrc32(file),
      path,
      size: file.byteLength,
      date: new Date(Date.parse(asset.created_at)),
      commit,
      branch,
      channel,
      sar_version: sarVersion,
    } satisfies BinaryFile;

    const { ok } = await db.set(key, bin);
    if (ok) {
      logger.info(`Inserted binary file ${key.join(", ")}`);
    } else {
      logger.error(`Failed to insert binary file ${JSON.stringify(bin)}`);
    }
  }
}
