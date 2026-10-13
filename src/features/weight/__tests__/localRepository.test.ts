import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearLocalWeight, createLocalWeightRepository } from '../localRepository';

const repository = createLocalWeightRepository();

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('the device weight store', () => {
  it('records a reading and reads it back', async () => {
    await repository.add(74.5);

    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.weightKg).toBe(74.5);
  });

  // Newest first is what the card reads, and what undo takes back.
  it('returns the newest reading first', async () => {
    await repository.add(75, new Date('2026-09-01T07:00:00Z').toISOString());
    await repository.add(74, new Date('2026-10-01T07:00:00Z').toISOString());

    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.weightKg).toBe(74);
  });

  it('keeps every reading rather than replacing one current value', async () => {
    await repository.add(75);
    await repository.add(74);

    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Two rows: one stored number could not answer what they weighed a
    // month ago, which is the only reason to keep this at all.
    expect(result.value).toHaveLength(2);
  });

  it('takes a mistyped reading back', async () => {
    const added = await repository.add(740);
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    await repository.remove(added.value.id);
    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('keeps every reading when several are saved at once', async () => {
    await Promise.all([repository.add(74), repository.add(75), repository.add(76)]);

    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
  });

  it('starts fresh rather than throwing on a corrupt stored value', async () => {
    await AsyncStorage.setItem('foodlens.weight.v1', '{not an array}');

    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('is emptied by clearing local data', async () => {
    await repository.add(74);
    await clearLocalWeight();

    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });
});
