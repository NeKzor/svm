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
import { BinFolder } from "./constants.ts";
import { db } from "./db.ts";
import { logger } from "./logger.ts";
import { BinaryFile, ReleaseVersion } from "./models.ts";
import { calcSha256Hash, tryMakeDir } from "./utils.ts";

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

  ctx.response.body = `<!DOCTYPE html>
    <html>
      <body>
      <h3>Latest</h3>
      <ul>${
    latest.map((version) =>
      `<li>${version.version} | ${
        version.date.toISOString().slice(0, 16).replace("T", " ")
      } | ${version.commit}</li>`
    ).join("")
  }</ul>
      <h3>All</h3>
        <ul>
            ${
    releases.map(([release, bins]) => {
      return `<li>${release}<ul>${
        bins!.map((bin) => {
          return `<li><a href="/${bin.version}/${bin.system}/${bin.name}">${bin.name}</a> | ${
            bin.date.toISOString().slice(0, 16).replace("T", " ")
          } | ${bin.hash}</li>`;
        }).join("")
      }</ul></li>`;
    }).join("")
  }
        </ul>
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
    root: BinFolder,
    path: join(bin.version, bin.system, bin.name),
  });

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
    if (version.includes("-pre")) {
      return "prerelease";
    }
    if (version.includes("-canary")) {
      return "canary";
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
      path,
      date: new Date(),
      commit,
      branch,
      channel,
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

const hostname = Deno.env.get("SERVER_HOST")!;
const port = Number(Deno.env.get("SERVER_PORT")!);

console.log(`listening on http://${hostname}:${port}`);

app.listen({ hostname, port });
