import AsyncStorage from '@react-native-async-storage/async-storage';

import { todayKey, addDaysToKey } from '@/lib/date';

import { clearLocalWater, createLocalWaterRepository } from '../localRepository';

const repository = createLocalWaterRepository();

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('the device water store', () => {
  it('records a drink and reads it back for today', async () => {
    await repository.add(250);

    const result = await repository.listForDay(todayKey());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.amountMl).toBe(250);
  });

  it('keeps drinks separate, rather than adding to one total', async () => {
    await repository.add(250);
    await repository.add(500);

    const result = await repository.listForDay(todayKey());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Two rows, not one row of 750: a total could not be partly undone.
    expect(result.value).toHaveLength(2);
    expect(result.value.map((e) => e.amountMl).sort()).toEqual([250, 500]);
  });

  it('returns the newest first, which is what undo takes back', async () => {
    await repository.add(250, new Date('2026-10-12T08:00:00Z').toISOString());
    await repository.add(500, new Date('2026-10-12T15:00:00Z').toISOString());

    const result = await repository.listForDay('2026-10-12');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.amountMl).toBe(500);
  });

  it('takes a drink back', async () => {
    const added = await repository.add(250);
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    await repository.remove(added.value.id);
    const result = await repository.listForDay(todayKey());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('removing something already gone is not an error', async () => {
    const result = await repository.remove('no-such-id');
    expect(result.ok).toBe(true);
  });

  it("does not mix in another day's drinks", async () => {
    await repository.add(250);

    const yesterday = await repository.listForDay(addDaysToKey(todayKey(), -1));

    expect(yesterday.ok).toBe(true);
    if (!yesterday.ok) return;
    expect(yesterday.value).toHaveLength(0);
  });

  // Two taps in the same moment each read the old list; without serialising
  // the writes, the second would overwrite the first and a glass would
  // vanish. On a button people tap repeatedly this is not theoretical.
  it('keeps every drink when several are added at once', async () => {
    await Promise.all([
      repository.add(250),
      repository.add(250),
      repository.add(250),
    ]);

    const result = await repository.listForDay(todayKey());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
  });

  it('starts fresh rather than throwing when the stored value is corrupt', async () => {
    await AsyncStorage.setItem('foodlens.water.v1', 'not json');

    const result = await repository.listForDay(todayKey());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('is emptied by clearing local data', async () => {
    await repository.add(250);
    await clearLocalWater();

    const result = await repository.listForDay(todayKey());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });
});
