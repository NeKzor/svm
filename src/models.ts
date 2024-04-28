// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

export interface BinaryFile {
  version: string;
  system: string;
  name: string;
  hash: string;
  checksum: string;
  path: string;
  size: number;
  date: Date;
  commit: string;
  branch: string;
  channel: string;
  sar_version: string;
}

export interface ReleaseVersion {
  channel: string;
  version: string;
  sar_version: string;
  commit: string;
  branch: string;
  date: Date;
}
