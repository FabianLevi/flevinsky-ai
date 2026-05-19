# Release checklist

Triggered by pushing a `v*` tag. The `release.yml` workflow handles npm publish + Homebrew formula update.

## Pre-flight

- [ ] `main` is green on CI
- [ ] `CHANGELOG` / release notes drafted
- [ ] `package.json` `version` bumped (must match tag without `v`)
- [ ] `pnpm install` clean — no lockfile drift
- [ ] Manual smoke test:
  ```sh
  cd /tmp && mkdir fl-smoke && cd fl-smoke
  mkdir -p .flevinsky-ai && echo '{"services":{"hi":{"kind":"task","cmd":"echo hello"}}}' > .flevinsky-ai/services.json
  node ~/Desktop/personal/flevinsky-ai/bin/flevinsky-ai list
  node ~/Desktop/personal/flevinsky-ai/bin/flevinsky-ai start hi
  ```

## Required GitHub secrets

| Name                 | Where to get it                                |
|----------------------|------------------------------------------------|
| `NPM_TOKEN`          | npmjs.com → Access Tokens → Automation token   |
| `HOMEBREW_TAP_TOKEN` | GitHub PAT with `repo` scope on `FabianLevi/homebrew-tap` |

## Tag + push

```sh
git tag v0.1.0
git push origin v0.1.0
```

## What the workflow does

1. Verifies `tag` matches `package.json` version (fails fast otherwise)
2. `pnpm publish --access public --no-git-checks`
3. Fetches the freshly-published tarball, computes `sha256` (retries up to 5× while npm propagates)
4. Checks out `FabianLevi/homebrew-tap`, regenerates `Formula/flevinsky-ai.rb`, commits, pushes

## Post-release

- [ ] `brew update && brew install FabianLevi/tap/flevinsky-ai` on a clean machine
- [ ] `pnpm add -g flevinsky-ai` on a clean machine
- [ ] `curl -sL .../install.sh | bash` end-to-end
- [ ] GitHub Release created (optional, manual)
- [ ] Bump `version` on `main` to next `-dev` if you want pre-tag commits to not collide

If anything is wrong, see [rollback.md](rollback.md).
