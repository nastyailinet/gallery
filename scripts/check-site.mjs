// No dependencies. Resolve paths from this file, not from the shell cwd.
import assert from 'node:assert/strict';
import { readFile, readdir, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const read = (name) => readFile(path.join(dist, name), 'utf8');
let checkedReferences = 0;

async function checkReference(value, from = 'index.html') {
  if (!value || value.startsWith('#') || value.startsWith('data:')) return;
  assert(!/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(value),
    `Asset must use a relative local path: ${value}`);
  const relative = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  const target = path.resolve(dist, path.dirname(from), relative);
  const inside = path.relative(dist, target);
  assert(inside && !inside.startsWith('..') && !path.isAbsolute(inside),
    `Asset escapes dist: ${value}`);
  // Pages is case-sensitive, so check exact names on Windows too.
  let current = dist;
  for (const part of inside.split(path.sep)) {
    assert((await readdir(current)).includes(part),
      `Missing asset or incorrect filename case: ${value}`);
    current = path.join(current, part);
  }
  assert((await stat(target)).isFile(), `Asset is not a file: ${value}`);
  checkedReferences++;
}

function parseAssignment(text, variable) {
  const prefix = `window.${variable} = `;
  assert(text.startsWith(prefix), `Unexpected data format: ${variable}`);
  return JSON.parse(text.slice(prefix.length).trim().replace(/;$/, ''));
}

const html = await read('index.html');
assert(!/<base\b/i.test(html), 'A base tag would make relocation ambiguous');
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  await checkReference(match[1]);
}
for (const match of (await read('style.css')).matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
  await checkReference(match[1], 'style.css');
}
const works = JSON.parse(await read('artworks.json'));
const bundled = parseAssignment(await read('artworks-data.js'), 'GALLERY_ARTWORKS');
const dimensions = parseAssignment(await read('artwork-layout.js'), 'ARTWORK_DIMENSIONS');
assert.deepEqual(bundled, works, 'JSON and browser catalog differ');
assert(works.length > 0, 'Catalog is empty');
assert.equal(new Set(works.map((work) => work.id)).size, works.length, 'Duplicate work IDs');
assert.equal(dimensions.length, works.length, 'Image dimensions do not match catalog');
for (const [index, work] of works.entries()) {
  await checkReference(work.image);
  assert(Number.isInteger(work.creation_year), `Invalid year for ${work.id}`);
  assert.equal(work.creation_year, work.publication_year, `Year source differs for ${work.id}`);
  assert(dimensions[index].length === 2 && dimensions[index].every((n) => Number.isFinite(n) && n > 0),
    `Invalid image dimensions for ${work.id}`);
}
for (const filename of ['app.js', 'artworks-data.js', 'artwork-layout.js']) {
  new Script(await read(filename), { filename });
}
await stat(path.join(dist, '.nojekyll'));

async function inspect(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const info = await lstat(file);
    assert(!info.isSymbolicLink(), `Pages artifact cannot contain symlinks: ${entry.name}`);
    if (info.isDirectory()) bytes += await inspect(file);
    else {
      assert(info.nlink <= 1, `Pages artifact cannot contain hard links: ${entry.name}`);
      assert(info.size < 100 * 1024 * 1024, `File is too large for ordinary Git upload: ${entry.name}`);
      bytes += info.size;
    }
  }
  return bytes;
}
const bytes = await inspect(dist);
assert(bytes < 1024 * 1024 * 1024, 'Published site exceeds 1 GiB');
console.log(`OK: ${works.length} artworks; ${checkedReferences} local references; ${(bytes / 1024 / 1024).toFixed(2)} MiB.`);
console.log('Catalog, JavaScript, exact filename case, relative asset paths and Pages artifact checked.');
