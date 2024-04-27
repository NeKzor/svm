// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

export interface BinaryFile {
  version: string;
  system: string;
  name: string;
  hash: string;
  path: string;
  date: Date;
  commit: string;
  branch: string;
  channel: string;
}

export interface ReleaseVersion {
  channel: string;
  version: string;
  sar_version: string;
  commit: string;
  branch: string;
  date: Date;
}
