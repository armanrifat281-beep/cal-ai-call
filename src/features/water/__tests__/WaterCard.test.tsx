import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { setWaterRepository } from '../hooks';
import { WaterCard } from '../WaterCard';
import type { WaterEntry, WaterRepository } from '../repository';

function fakeRepository(initial: WaterEntry[] = []): WaterRepository & {
  rows: WaterEntry[];
} {
  const rows = [...initial];
  return {
    rows,
    kind: 'local',
    listForDay: async () => ({ ok: true as const, value: [...rows] }),
    add: async (amountMl: number) => {
      const entry = {
        id: `w${rows.length}`,
        consumedAt: new Date().toISOString(),
        amountMl,
      };
      rows.unshift(entry);
      return { ok: true as const, value: entry };
    },
    remove: async (id: string) => {
      const index = rows.findIndex((r) => r.id === id);
      if (index >= 0) rows.splice(index, 1);
      return { ok: true as const, value: undefined };
    },
  };
}

afterEach(() => setWaterRepository(null));

/** The one control on the card. */
function addButton() {
  return screen.getByRole('button', { name: 'Add 250 millilitres of water' });
}

describe('WaterCard', () => {
  it('reads as nothing drunk rather than as a missing card', async () => {
    setWaterRepository(fakeRepository());
    await renderWithProviders(<WaterCard />);

    expect(await screen.findByText('0.00')).toBeTruthy();
    expect(screen.getByText('L')).toBeTruthy();
  });

  it('records a glass when the button is pressed', async () => {
    const repo = fakeRepository();
    setWaterRepository(repo);
    const user = userEvent.setup();
    await renderWithProviders(<WaterCard />);

    await user.press(addButton());

    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.amountMl).toBe(250);
  });

  /*
    A long press takes the last glass back. Without a way back a mis-tap is
    permanent, which on a button people hit several times a day is the single
    most likely thing to go wrong.
  */
  it('takes the last glass back on a long press', async () => {
    const repo = fakeRepository([
      { id: 'w0', consumedAt: new Date().toISOString(), amountMl: 250 },
    ]);
    setWaterRepository(repo);
    const user = userEvent.setup();
    await renderWithProviders(<WaterCard />);

    await user.longPress(await screen.findByRole('button', {
      name: 'Add 250 millilitres of water',
    }));

    expect(repo.rows).toHaveLength(0);
  });

  it('shows the total in litres', async () => {
    setWaterRepository(
      fakeRepository([
        { id: 'a', consumedAt: new Date().toISOString(), amountMl: 500 },
        { id: 'b', consumedAt: new Date().toISOString(), amountMl: 750 },
      ]),
    );
    await renderWithProviders(<WaterCard />);

    expect(await screen.findByText('1.3')).toBeTruthy();
  });

  // The app does not tell anyone how much to drink - the same position it
  // takes on calories. Eight marks is a scale, not a goal it set.
  it('sets no target and offers no praise', async () => {
    setWaterRepository(
      fakeRepository(
        Array.from({ length: 8 }, (_, i) => ({
          id: `g${i}`,
          consumedAt: new Date().toISOString(),
          amountMl: 250,
        })),
      ),
    );
    await renderWithProviders(<WaterCard />);

    // The gauge is read against eight marks, with nothing said about them.
    expect(await screen.findByLabelText('8 of 8 glasses')).toBeTruthy();
    expect(screen.queryByText(/goal|target|well done|great/i)).toBeNull();
  });
});
