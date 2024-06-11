## Example

```yaml
on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Upload to dl.sar.portal2.sr
        if: github.ref == 'refs/heads/master' && github.repository_owner == 'p2sr'
        env:
          DL_SAR_API_TOKEN: ${{ secrets.DL_SAR_API_TOKEN }}
        uses: actions/github-script@v7
        with:
          script: |
            const script = require('./.github/workflows/canary.js');
            console.log(await script({ github, context, core }));
```
