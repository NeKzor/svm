// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

import { Application } from "@oak/oak/application";
import { Router } from "@oak/oak/router";
import { Status } from "@oak/commons/status";
import { Context } from "@oak/oak/context";
import { ResponseBody, ResponseBodyFunction } from "@oak/oak/response";
import { timingSafeEqual } from "@std/crypto/timing-safe-equal";
import { join } from "@std/path";
import { tryParse } from "@std/semver";
import { format } from "@std/fmt/bytes";
import { BinFolder } from "./constants.ts";
import { db } from "./db.ts";
import { installLogger, logger } from "./logger.ts";
import { BinaryFile, ReleaseVersion } from "./models.ts";
import { calcCrc32, calcSha256Hash, tryMakeDir } from "./utils.ts";

installLogger("server.log");

await tryMakeDir(BinFolder);

const Ok = (
  ctx: Context,
  body?: ResponseBody | ResponseBodyFunction,
  type?: string,
) => {
  ctx.response.status = Status.OK;
  ctx.response.type = type ?? "application/json";
  ctx.response.body = body ?? {};
};

const Err = (ctx: Context, status: Status, message: string) => {
  ctx.response.status = status;
  ctx.response.type = "application/json";
  ctx.response.body = {
    status,
    message,
  };

  status !== Status.NotFound && logger.error(message);
};

const router = new Router();

router.get("/", async (ctx) => {
  const latest = (await Array.fromAsync(
    db.list<ReleaseVersion>({ prefix: ["latest"] }),
    ({ value }) => value,
  )).sort((a, b) => {
    return b.date.getTime() - a.date.getTime();
  });

  const binaries = (await Array.fromAsync(
    db.list<Partial<BinaryFile>>({ prefix: ["bin"] }),
    ({ value }) => {
      delete value.path;
      return value as Omit<BinaryFile, "path">;
    },
  )).sort((a, b) => {
    return b.date.getTime() - a.date.getTime();
  });

  const releases = Object.entries(
    Object.groupBy(binaries, ({ version }) => version),
  );

  const latestHtml = latest.map((version) =>
    `<tr><td>${version.version}</td><td>${
      version.date.toISOString().slice(0, 16).replace("T", " ")
    }</td><td><a href="https://github.com/p2sr/SourceAutoRecord/commit/${version.commit}">${version.commit}</a></td></tr>`
  ).join("");

  const binariesHtml = releases.map(([release, bins]) => {
    return `<tr><td colspan="5">${release}</td></tr><tr>${
      bins!.map((bin) => {
        return `<tr><td><a href="/${bin.version}/${bin.system}/${bin.name}">${bin.name}</a></td><td class="date">${
          bin.date.toISOString().slice(0, 16).replace("T", " ")
        }</td><td>${bin.hash}</td><td>${bin.checksum ?? "?"}</td><td>${
          bin.size ? format(bin.size) : "?"
        }</td></tr>`;
      }).join("")
    }</tr>`;
  }).join("");

  ctx.response.body = `<!DOCTYPE html>
    <html lang='en' dir='ltr' class="theme-dark">
      <head>
        <meta charSet="utf-8"/>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no"/>
        <meta name="referrer" content="no-referrer"/>
        <meta name="theme-color" content="#14161a"/>
        <meta name="title" content="Latest SAR"/>
        <title>Latest SAR | dl.sar.portal2.sr</title>
        <meta name="description" content="Download SAR binaries"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..600&amp;display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css" integrity="sha384-tl5h4XuWmVzPeVWU0x8bx0j/5iMwCBduLEgZ+2lH4Wjda+4+q3mpCww74dgAB3OX" crossorigin="anonymous">
        <style>
          footer {
            padding: 10px !important;
          }
          table {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
          }
        </style>
      <head>
      <body>
        <main class="py-4 px-4">
          <div class="columns mt-2">
            <div class="column is-narrow"></div>
            <div class="column auto">
              <h1 class="title">SAR Downloads</h1>
              <h4 class="subtitle mt-6 mb-2">Latest</h4>
              <div>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Date</th>
                      <th>Commit</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${latestHtml}
                  </tbody>
                </table>
              </div>
              <h4 class="subtitle mt-6 mb-2">Binaries</h4>
              <div>
                <table class="table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Date</th>
                      <th>SHA-256</th>
                      <th>CRC-32</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${binariesHtml}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
        <footer class="footer">
          <div class="content has-text-centered">
            <p>
              © 2024 <a href="https://portal2.sr">portal2.sr</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  `;
});

router.get("/:version/:system(windows|linux)/:name", async (ctx) => {
  const { value: bin } = await db.get<BinaryFile>([
    "bin",
    ctx.params.version,
    ctx.params.system,
    ctx.params.name,
  ]);
  if (!bin) {
    return Err(ctx, Status.NotFound, "File not found.");
  }

  await ctx.send({
    root: ".",
    path: bin.path,
    contentTypes: {
      ".dll": "application/octet-stream",
      ".so": "application/octet-stream",
      ".pdb": "application/octet-stream",
    },
  });

  ctx.response.headers.set("X-File-Size", bin.size.toString());
  ctx.response.headers.set("X-File-Hash", bin.hash);
});

const textEncoder = new TextEncoder();
const apiToken = textEncoder.encode(Deno.env.get("API_TOKEN"));

const apiV1 = new Router({ prefix: "/api/v1" });

apiV1.get("/latest/:channel(release|prerelease|canary)?", async (ctx) => {
  Ok(
    ctx,
    (await db.get<ReleaseVersion>(["latest", ctx.params.channel ?? "release"]))
      .value,
  );
});

apiV1.get("/list/:version?/:system?", async (ctx) => {
  Ok(
    ctx,
    (await Array.fromAsync(
      db.list<Partial<BinaryFile>>({
        prefix: ["bin", ctx.params.version, ctx.params.system].filter((x) =>
          x
        ) as string[],
      }),
      ({ value }) => {
        delete value.path;
        return value as Omit<BinaryFile, "path">;
      },
    )).sort((a, b) => {
      return b.date.getTime() - a.date.getTime();
    }),
  );
});

apiV1.post("/upload", async (ctx) => {
  const [authorization, token] =
    (ctx.request.headers.get("Authorization") ?? "").split(" ");

  if (authorization !== "Bearer") {
    return Err(ctx, Status.BadRequest, "Authorization must be Bearer.");
  }

  if (!timingSafeEqual(textEncoder.encode(token), apiToken)) {
    return Err(ctx, Status.Unauthorized, "Invalid token.");
  }

  if (!ctx.request.hasBody) {
    return Err(ctx, Status.UnsupportedMediaType, "Invalid request body.");
  }

  const data = await ctx.request.body.formData();

  const version = data.get("version")?.toString();
  if (typeof version !== "string") {
    return Err(ctx, Status.BadRequest, "Missing version.");
  }
  if (version !== "canary" && !tryParse(version)) {
    return Err(ctx, Status.BadRequest, "Invalid semver version.");
  }

  const sarVersion = data.get("sar_version")?.toString();
  if (!sarVersion) {
    return Err(ctx, Status.BadRequest, "Missing SAR version.");
  }

  const system = data.get("system")?.toString();
  if (system !== "windows" && system !== "linux") {
    return Err(ctx, Status.BadRequest, "Invalid system.");
  }

  const commit = data.get("commit")?.toString();
  if (!commit) {
    return Err(ctx, Status.BadRequest, "Missing commit hash.");
  }

  const branch = data.get("branch")?.toString();
  if (!branch) {
    return Err(ctx, Status.BadRequest, "Missing branch name.");
  }

  const count = Number(data.get("count"));
  if (isNaN(count) || count <= 0 || count >= 5) {
    return Err(ctx, Status.BadRequest, "Invalid count.");
  }

  const channel = (() => {
    if (version.endsWith("-canary")) {
      return "canary";
    }
    if (version.includes("-pre")) {
      return "prerelease";
    }
    return "release";
  })();

  let inserted = 0;

  for (let i = 0; i < count; ++i) {
    const fileContent = data.get(`files[${i}]`);
    if (!(fileContent instanceof File)) {
      return Err(ctx, Status.UnsupportedMediaType, "Invalid file.");
    }

    const name = fileContent.name;

    logger.info(
      `Received file ${name} for version ${version} (${system})`,
    );

    const file = new Uint8Array(await fileContent.arrayBuffer());
    const hash = await calcSha256Hash(file);

    if (hash !== data.get(`hashes[${i}]`)) {
      return Err(ctx, Status.BadRequest, "File hash mismatch.");
    }

    const folder = join(BinFolder, channel, sarVersion, system);
    await tryMakeDir(folder);

    const path = join(folder, name);
    await Deno.writeFile(path, file, { create: true });

    const bin = {
      version,
      system,
      name,
      hash,
      checksum: calcCrc32(file),
      path,
      size: file.byteLength,
      date: new Date(),
      commit,
      branch,
      channel,
      sar_version: sarVersion,
    } satisfies BinaryFile;

    logger.info(bin);

    const { ok } = await db.set(["bin", version, system, name], bin);
    if (ok) {
      ++inserted;
    }
  }

  const { ok } = await db.set(
    ["latest", channel],
    {
      channel,
      version,
      sar_version: sarVersion,
      commit,
      branch,
      date: new Date(),
    } satisfies ReleaseVersion,
  );

  Ok(ctx, { inserted, ok });
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());
app.use(apiV1.routes());
app.use(apiV1.allowedMethods());

const hostname = Deno.env.get("SERVER_HOST") ?? "127.0.0.1";
const port = Number(Deno.env.get("SERVER_PORT") ?? "8080");

console.log(`listening on http://${hostname}:${port}`);

app.listen({ hostname, port });
