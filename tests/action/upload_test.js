const upload = require("./upload.js");

upload({
  release: false,
  context: {
    sha: "9da99e993d7797f6533114abc44b23583070f089",
    ref: "refs/heads/master",
  },
  core: {
    info: (...args) => console.log(...args),
    debug: (...args) => console.debug(...args),
  },
}).then(console.log);
