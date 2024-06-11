const script = require("./canary.js");

script({
  github: {},
  context: {
    sha: "6992be6ae3b72b08918a1deb75761f587e82e32a",
    ref: "refs/heads/master",
  },
  core: {
    info: (...args) => console.log(...args),
    debug: (...args) => console.debug(...args),
  },
}).then(console.log);
