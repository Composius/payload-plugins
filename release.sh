#!/usr/bin/env bash
set -euo pipefail

log() { echo "==> $*"; }

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean — commit or stash your changes before releasing:" >&2
  git status --short >&2
  exit 1
fi

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <name> <patch|minor|major>" >&2
  exit 1
fi

name="$1"
version_type="$2"
pkg_dir="packages/payload-plugin-$name"

case "$version_type" in
  patch | minor | major) ;;
  *)
    echo "Invalid version type: $version_type (expected patch, minor, or major)" >&2
    exit 1
    ;;
esac

if [ ! -d "$pkg_dir" ]; then
  echo "Unknown package: $pkg_dir" >&2
  exit 1
fi

log "Releasing a $version_type version of $name"

(cd "$pkg_dir" && pnpm version "$version_type" --no-git-tag-version)
VERSION=$(node -p "require('./$pkg_dir/package.json').version")

# Update the version in the plugin table of the root README
log "Updating README table for $name to version $VERSION"
node - "$name" "$VERSION" <<'NODE'
const fs = require('fs');
const [name, version] = process.argv.slice(2);
const readme = 'README.md';
const content = fs.readFileSync(readme, 'utf8');
const regex = new RegExp(`^(\\|[^|]*packages/payload-plugin-${name}\\)[^|]*\\|\\s*)([0-9]+\\.[0-9]+\\.[0-9]+(?:-[^\\s|]+)?)(.*)$`, 'm');
const updated = content.replace(regex, `$1${version}$3`);
if (updated === content) {
  console.error(`Failed to update root README table entry for payload-plugin-${name}`);
  process.exit(1);
}
fs.writeFileSync(readme, updated);
NODE

log "Committing and tagging release $name@$VERSION"
git add "$pkg_dir/package.json" README.md
git commit -m "Release: $name@$VERSION"
git tag -a "$name@$VERSION" -m "Release: $name@$VERSION"
git push origin main "$name@$VERSION"

log "Release $name@$VERSION complete"
