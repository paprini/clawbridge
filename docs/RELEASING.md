# Releasing

Audience: maintainers

ClawBridge releases are tag-driven.

The single source of truth for the installed version is [package.json](../package.json). GitHub Releases are created from pushed tags like `v0.2.0`.

## Release checklist

1. Make sure `main` is clean and up to date.
2. Update [CHANGELOG.md](../CHANGELOG.md).
3. Pick the correct SemVer bump:
   - `patch` for fixes
   - `minor` for backward-compatible features
   - `major` for breaking changes
4. Run one of:

```bash
npm run release:patch
npm run release:minor
npm run release:major
```

Those commands:
- run the full local test suite
- run `npm run verify`
- update `package.json` and `package-lock.json`
- create a release commit
- create a git tag like `v0.2.0`

5. Push the release:

```bash
git push origin main --follow-tags
```

6. Wait for the GitHub Actions `Release` workflow to finish.

That workflow:
- runs `npm ci`
- runs the full test suite
- runs `npm run verify`
- creates the GitHub Release page from the pushed tag

## Install a specific release

```bash
git clone --branch v0.2.0 --depth 1 https://github.com/paprini/clawbridge.git
```

## Notes

- Do not retag a release after publishing it.
- If a release is bad, cut a new patch release instead.
- Keep [CHANGELOG.md](../CHANGELOG.md) user-facing and concise.
