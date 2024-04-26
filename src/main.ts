// Copyright (c) 2024, NeKz
// SPDX-License-Identifier: MIT

import { Command } from "@cliffy/command";
import { Select } from "@cliffy/prompt";
import { SarUpdaterVersion } from "./constants.ts";

const cmd = await new Command()
  .name("svm")
  .version(SarUpdaterVersion)
  .description("SourceAutoRecord version manager.")
  .parse(Deno.args);

const command = await Select.prompt({
  message: "Command",
  options: [
    { name: "Download or Update", value: "download" },
    { name: "Update to Version", value: "version" },
    { name: "Exit", value: "exit" },
  ],
});

switch (command) {
  case "download": {
    break;
  }
  case "version": {
    break;
  }
  case "exit": {
    break;
  }
}
