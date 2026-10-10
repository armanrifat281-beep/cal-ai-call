import { screen, userEvent } from '@testing-library/react-native';

import { addDaysToKey, lastSevenDayKeys, todayKey } from '@/lib/date';
import { renderWithProviders } from '@/test/renderWithProviders';

import { WeekStrip, type WeekStripDay } from '../WeekStrip';

const TODAY = todayKey();
const KEYS = lastSevenDayKeys(TODAY);

function week(overrides: Partial<Record<string, Partial<WeekStripDay>>> = {}): WeekStripDay[] {
  return KEYS.map((dateKey) => ({
    dateKey,
    caloriesKcal: 1500,
    entryCount: 3,
    ...overrides[dateKey],
  }));
}

/** Counts nodes of a type in the rendered tree. */
function countOfType(type: string): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const element = node as { type?: unknown; children?: unknown };
    if (element.type === type) count += 1;
    if (element.children) walk(element.children);
  };
  walk(screen.toJSON());
  return count;
}

describe('WeekStrip', () => {
  it('shows seven days', async () => {
    await renderWithProviders(
      <WeekStrip days={week()} selectedKey={TODAY} onSelect={jest.fn()} targetKcal={2000} />,
    );
    expect(screen.getAllByRole('tab')).toHaveLength(7);
  });

  it('marks the selected day', async () => {
    const yesterday = addDaysToKey(TODAY, -1);
    await renderWithProviders(
      <WeekStrip
        days={week()}
        selectedKey={yesterday}
        onSelect={jest.fn()}
        targetKcal={2000}
      />,
    );
    const selected = screen.getAllByRole('tab').filter((tab) =>
      tab.props.accessibilityState?.selected === true,
    );
    expect(selected).toHaveLength(1);
  });

  it('reports the day and its energy to a screen reader', async () => {
    await renderWithProviders(
      <WeekStrip days={week()} selectedKey={TODAY} onSelect={jest.fn()} targetKcal={2000} />,
    );
    expect(screen.getAllByLabelText(/1500 kilocalories/).length).toBeGreaterThan(0);
  });

  it('says a day is empty rather than reading it as zero energy', async () => {
    const empty = week({ [KEYS[2]!]: { caloriesKcal: 0, entryCount: 0 } });
    await renderWithProviders(
      <WeekStrip days={empty} selectedKey={TODAY} onSelect={jest.fn()} targetKcal={2000} />,
    );
    expect(screen.getByLabelText(/nothing logged/)).toBeTruthy();
  });

  it('selects the day that was tapped', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <WeekStrip days={week()} selectedKey={TODAY} onSelect={onSelect} targetKcal={2000} />,
    );

    const tabs = screen.getAllByRole('tab');
    await user.press(tabs[0]!);
    expect(onSelect).toHaveBeenCalledWith(KEYS[0]);
  });

  it('draws no arc for a day with nothing logged', async () => {
    const nothing = KEYS.reduce<Record<string, Partial<WeekStripDay>>>((all, key) => {
      all[key] = { caloriesKcal: 0, entryCount: 0 };
      return all;
    }, {});
    await renderWithProviders(
      <WeekStrip
        days={week(nothing)}
        selectedKey={TODAY}
        onSelect={jest.fn()}
        targetKcal={2000}
      />,
    );
    // Seven tracks, no progress arcs.
    expect(countOfType('RNSVGCircle')).toBe(7);
    expect(countOfType('RNSVGPath')).toBe(0);
  });

  it('draws an arc for every day that has something logged', async () => {
    await renderWithProviders(
      <WeekStrip days={week()} selectedKey={TODAY} onSelect={jest.fn()} targetKcal={2000} />,
    );
    expect(countOfType('RNSVGPath')).toBe(7);
  });

  it('draws a full ring for a logged day when no target is set', async () => {
    // With no target there is nothing to be a fraction of, so the ring shows
    // presence rather than claiming a proportion.
    const mixed = week({ [KEYS[1]!]: { caloriesKcal: 0, entryCount: 0 } });
    await renderWithProviders(
      <WeekStrip days={mixed} selectedKey={TODAY} onSelect={jest.fn()} targetKcal={null} />,
    );
    expect(countOfType('RNSVGPath')).toBe(6);
  });

  it('shows the day of the month in each ring', async () => {
    await renderWithProviders(
      <WeekStrip days={week()} selectedKey={TODAY} onSelect={jest.fn()} targetKcal={2000} />,
    );
    const todayNumber = String(new Date().getDate());
    expect(screen.getAllByText(todayNumber).length).toBeGreaterThan(0);
  });
});
