# Lilith fork notes

Self-use fork of Multica Desktop. Branch `lilith/main` tracks upstream release tags.

## Release

```powershell
git tag v0.7.X-lilith.N
cd apps/desktop
pnpm run package -- --win --x64 --publish never
gh release create v0.7.X-lilith.N --repo zjulzy/multica --prerelease --latest=false `
  dist\multica-desktop-*.exe dist\*.blockmap dist\latest.yml
```

Installed clients pick the new version up through the in-app updater
(electron-updater, GitHub provider → zjulzy/multica).

## Merge upstream

```powershell
git fetch upstream --tags
git merge v0.7.X          # next official release tag
```
