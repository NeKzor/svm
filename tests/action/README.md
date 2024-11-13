## Example

```yaml
on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      - name: Upload to dl.sar.portal2.sr
        if: github.ref == 'refs/heads/master' && github.repository_owner == 'p2sr'
        env:
          DL_SAR_API_TOKEN: ${{ secrets.DL_SAR_API_TOKEN }}
        uses: actions/github-script@v7
        with:
          script: |
            const upload = require('./.github/workflows/upload.js');
            console.log(await upload({ release: false, context, core }));
```

Note:

* Make sure tags are fetched
* Windows binaries are in `./bin` and Linux binary in `./`
