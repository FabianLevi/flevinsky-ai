# Rollback

A bad release affects three surfaces — npm, Homebrew, GitHub. Roll back in this order, from least to most destructive.

## 1. Publish a fixed patch (preferred)

npm versions are immutable for 72h+ and Homebrew users have already pulled the bad bottle. The cleanest fix is almost always:

```sh
# bump patch in package.json
git commit -am "fix: <what>"
git tag v0.1.1
git push --follow-tags
```

The release workflow re-runs and updates the Homebrew formula to point at the fix.

## 2. Deprecate the bad npm version

Marks it broken on `npm install` without unpublishing:

```sh
npm deprecate flevinsky-ai@0.1.0 "broken release — use 0.1.1+"
```

## 3. Unpublish (only within 72h, only if truly broken)

npm allows unpublish within 72h of publish. After that, contact npm support.

```sh
npm unpublish flevinsky-ai@0.1.0
```

Then delete the matching tag/release and the Homebrew formula commit:

```sh
git push --delete origin v0.1.0
gh release delete v0.1.0
# in homebrew-tap:
git revert <formula-commit>
git push
```

## 4. Pin the Homebrew formula to a known-good version

If npm is fine but the formula commit is wrong, manually revert in `FabianLevi/homebrew-tap`:

```sh
cd homebrew-tap
git revert <bad-commit> && git push
```

Users run `brew update && brew reinstall flevinsky-ai`.

## Incident notes

Record in [docs/incidents/](incidents/) (create on first incident): date, symptom, root cause, fix, lessons. Keep it terse — three sentences per field.
