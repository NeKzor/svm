// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

import { join } from "jsr:@std/path@0.223";
import { GitHubRelease } from "./github.ts";
import { calcSha256Hash, tryMakeDir } from "./utils.ts";
import { db } from "./db.ts";
import { logger } from "./logger.ts";
import { BinFolder } from "./constants.ts";
import { BinaryFile } from "./models.ts";

const res = await fetch(
  "https://api.github.com/repos/p2sr/SourceAutoRecord/releases",
);
const releases = await res.json() as GitHubRelease[];

for (const release of releases) {
  for (const asset of release.assets) {
    const download = await fetch(asset.browser_download_url);

    const name = asset.name;
    const version = release.tag_name;
    const system = name.endsWith(".so") ? "linux" : "windows";
    const file = new Uint8Array(await download.arrayBuffer());
    const hash = await calcSha256Hash(file);

    const folder = join(BinFolder, version, system);
    await tryMakeDir(folder);

    const path = join(folder, name);

    await Deno.writeFile(path, file, { create: true });

    const key = ["bin", version, system, name];

    const bin = {
      version,
      system,
      name,
      hash,
      path,
      date: new Date(Date.parse(asset.created_at)),
    } satisfies BinaryFile;

    const { ok } = await db.set(key, bin);
    if (ok) {
      logger.info(`Inserted ${key.join(", ")}`);
    } else {
      logger.error(`Failed to insert ${JSON.stringify(bin)}`);
    }
  }
}
