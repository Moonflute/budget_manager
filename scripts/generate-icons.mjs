import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const dir = new URL('../public/icons/', import.meta.url);
await mkdir(dir, { recursive: true });
for (const [name, width, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['apple-touch-icon.png', 180, true], ['maskable-512.png', 512, true]]) {
  const source = maskable ? svg.replace('rx="120"', 'rx="0"') : svg;
  const png = new Resvg(source, { fitTo: { mode: 'width', value: width } }).render().asPng();
  await writeFile(new URL(name, dir), png);
  console.log(`Generated ${name}`);
}
