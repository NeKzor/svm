// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

import { assert, assertEquals } from "@std/assert";
import { encodeHex } from "@std/encoding/hex";

Deno.test(async function uploadCanaryWindows() {
  const file = await Deno.readFile("./tests/data/sar.dll");
  const fileHash = encodeHex(await crypto.subtle.digest("SHA-256", file));
  const file2 = await Deno.readFile("./tests/data/sar.pdb");
  const fileHash2 = encodeHex(await crypto.subtle.digest("SHA-256", file2));

  const body = new FormData();
  body.append("version", "0.0.0-canary");
  body.append("sar_version", "0.0.0-canary-0-g0b4c5d07");
  body.append("system", "windows");
  body.append("commit", "0b4c5d07376ed288fe1d2f18d36065c393474480");
  body.append("branch", "master");
  body.append("count", "2");
  body.append("hashes[0]", fileHash);
  body.append("hashes[1]", fileHash2);
  body.append(
    "files[0]",
    new Blob([file]),
    "sar.dll",
  );
  body.append(
    "files[1]",
    new Blob([file2]),
    "sar.pdb",
  );

  const res = await fetch("http://127.0.0.1:8080/api/v1/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + Deno.env.get("API_TOKEN"),
    },
    body,
  });

  const upload = await res.json();
  assert(upload);
  assertEquals(upload.inserted, 2);

  const res2 = await fetch("http://127.0.0.1:8080/api/v1/list/canary/windows");

  const list = await res2.json();
  assert(Array.isArray(list));
  assertEquals(list.length, 2);

  const [pdb, dll] = list;

  assert(dll);
  assertEquals(dll.name, "sar.dll");
  assertEquals(dll.hash, fileHash);
  assert(dll.date);

  assert(pdb);
  assertEquals(pdb.name, "sar.pdb");
  assertEquals(pdb.hash, fileHash2);
  assert(pdb.date);

  const res3 = await fetch("http://127.0.0.1:8080/api/v1/latest/canary");

  const latest = await res3.json();
  assert(latest);
  assertEquals(latest.version, "0.0.0-canary");
  assertEquals(latest.commit, "0b4c5d07376ed288fe1d2f18d36065c393474480");
  assertEquals(latest.branch, "master");
  assert(latest.date);
});

Deno.test(async function uploadCanaryLinux() {
  const file = await Deno.readFile("./tests/data/sar.so");
  const fileHash = encodeHex(await crypto.subtle.digest("SHA-256", file));

  const body = new FormData();
  body.append("version", "0.0.0-canary");
  body.append("sar_version", "0.0.0-canary-0-g0b4c5d07");
  body.append("system", "linux");
  body.append("commit", "0b4c5d07376ed288fe1d2f18d36065c393474480");
  body.append("branch", "master");
  body.append("count", "1");
  body.append("hashes[0]", fileHash);
  body.append(
    "files[0]",
    new Blob([file]),
    "sar.so",
  );

  const res = await fetch("http://127.0.0.1:8080/api/v1/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + Deno.env.get("API_TOKEN"),
    },
    body,
  });

  const upload = await res.json();
  assert(upload);
  assertEquals(upload.inserted, 1);

  const res2 = await fetch("http://127.0.0.1:8080/api/v1/list/canary/linux");

  const list = await res2.json();
  assert(Array.isArray(list));
  assertEquals(list.length, 1);

  const [so] = list;

  assert(so);
  assertEquals(so.name, "sar.so");
  assertEquals(so.hash, fileHash);
  assert(so.date);

  const res3 = await fetch("http://127.0.0.1:8080/api/v1/latest/canary");

  const latest = await res3.json();
  assert(latest);
  assertEquals(latest.version, "0.0.0-canary");
  assertEquals(latest.commit, "0b4c5d07376ed288fe1d2f18d36065c393474480");
  assertEquals(latest.branch, "master");
  assert(latest.date);
});

Deno.test(async function uploadSemVerWindows() {
  const file = await Deno.readFile("./tests/data/sar.dll");
  const fileHash = encodeHex(await crypto.subtle.digest("SHA-256", file));
  const file2 = await Deno.readFile("./tests/data/sar.pdb");
  const fileHash2 = encodeHex(await crypto.subtle.digest("SHA-256", file2));

  const body = new FormData();
  body.append("version", "0.0.0");
  body.append("sar_version", "0.0.0-0-g0b4c5d07");
  body.append("system", "windows");
  body.append("commit", "0b4c5d07376ed288fe1d2f18d36065c393474480");
  body.append("branch", "master");
  body.append("count", "2");
  body.append("hashes[0]", fileHash);
  body.append("hashes[1]", fileHash2);
  body.append(
    "files[0]",
    new Blob([file]),
    "sar.dll",
  );
  body.append(
    "files[1]",
    new Blob([file2]),
    "sar.pdb",
  );

  const res = await fetch("http://127.0.0.1:8080/api/v1/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + Deno.env.get("API_TOKEN"),
    },
    body,
  });

  const upload = await res.json();
  assert(upload);
  assertEquals(upload.inserted, 2);

  const res2 = await fetch("http://127.0.0.1:8080/api/v1/list/0.0.0/windows");

  const list = await res2.json();
  assert(Array.isArray(list));
  assertEquals(list.length, 2);

  const [pdb, dll] = list;

  assert(dll);
  assertEquals(dll.name, "sar.dll");
  assertEquals(dll.hash, fileHash);
  assert(dll.date);

  assert(pdb);
  assertEquals(pdb.name, "sar.pdb");
  assertEquals(pdb.hash, fileHash2);
  assert(pdb.date);

  const res3 = await fetch("http://127.0.0.1:8080/api/v1/latest");

  const latest = await res3.json();
  assert(latest);
  assertEquals(latest.version, "0.0.0");
  assertEquals(latest.commit, "0b4c5d07376ed288fe1d2f18d36065c393474480");
  assertEquals(latest.branch, "master");
  assert(latest.date);
});

Deno.test(async function uploadSemVerLinux() {
  const file = await Deno.readFile("./tests/data/sar.so");
  const fileHash = encodeHex(await crypto.subtle.digest("SHA-256", file));

  const body = new FormData();
  body.append("version", "0.0.0");
  body.append("sar_version", "0.0.0-0-g0b4c5d07");
  body.append("system", "linux");
  body.append("commit", "0b4c5d07376ed288fe1d2f18d36065c393474480");
  body.append("branch", "master");
  body.append("count", "1");
  body.append("hashes[0]", fileHash);
  body.append(
    "files[0]",
    new Blob([file]),
    "sar.so",
  );

  const res = await fetch("http://127.0.0.1:8080/api/v1/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + Deno.env.get("API_TOKEN"),
    },
    body,
  });

  const upload = await res.json();
  assert(upload);
  assertEquals(upload.inserted, 1);

  const res2 = await fetch("http://127.0.0.1:8080/api/v1/list/0.0.0/linux");

  const list = await res2.json();
  assert(Array.isArray(list));
  assertEquals(list.length, 1);

  const [so] = list;

  assert(so);
  assertEquals(so.name, "sar.so");
  assertEquals(so.hash, fileHash);
  assert(so.date);

  const res3 = await fetch("http://127.0.0.1:8080/api/v1/latest");

  const latest = await res3.json();
  assert(latest);
  assertEquals(latest.version, "0.0.0");
  assertEquals(latest.commit, "0b4c5d07376ed288fe1d2f18d36065c393474480");
  assertEquals(latest.branch, "master");
  assert(latest.date);
});
