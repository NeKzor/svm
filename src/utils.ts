// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

import { encodeHex } from "jsr:@std/encoding/hex";

export const tryMakeDir = async (path: string) => {
  try {
    await Deno.mkdir(path, { recursive: true });
    // deno-lint-ignore no-empty
  } catch {
  }
};

export const calcSha256Hash = async (array: Uint8Array) => {
  return encodeHex(await crypto.subtle.digest("SHA-256", array));
};
