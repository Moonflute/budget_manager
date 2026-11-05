import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { readData, writeData } from '../src/storage';
import { demoData } from '../src/model';

describe('transactional device storage', () => {
  it('persists a complete validated state and rejects stale-tab overwrite', async () => {
    const original = await readData();
    const data = demoData();
    const revision = await writeData(data, original.revision);
    expect(await readData()).toEqual({ data, revision });
    await expect(writeData({ ...data, assets: [] }, original.revision)).rejects.toThrow('다른 창');
    expect((await readData()).data.assets).toEqual(data.assets);
  });
  it('rejects corrupt data before changing the saved record', async () => {
    const before = await readData();
    await expect(writeData({ ...before.data, assumptions: { ...before.data.assumptions, target: -1 } }, before.revision)).rejects.toThrow();
    expect(await readData()).toEqual(before);
  });
});
