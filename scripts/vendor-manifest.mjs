import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const packages = [
  ['linguistic-adapters', 'packages/linguistic-adapters/src'],
  ['indexeddb', 'packages/indexeddb-data-management/src'],
];
const files = [];
const canonicalText = content => content.toString('utf8').replace(/\r\n/g, '\n');
for (const [directory, sourceDirectory] of packages) {
  const path = `docs/js/vendor/${directory}`;
  for (const filename of (await readdir(path)).filter(name => name.endsWith('.js')).sort()) {
    const localPath = `${path}/${filename}`;
    files.push({ path: localPath, sourcePath: `${sourceDirectory}/${filename}`,
      sha256: createHash('sha256').update(canonicalText(await readFile(localPath))).digest('hex') });
  }
}
await writeFile('docs/js/vendor/manifest.json', `${JSON.stringify({ sourceRepository: 'reasonlynx', files }, null, 2)}\n`);
