import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { Disclosure } from '../Disclosure';
import { OfflineNotice } from '../OfflineNotice';

/**
 * Disclosure replaced 29 tinted callout panels. The honesty requirements did
 * not move, so these tests pin the behaviour that matters: the summary is
 * always visible, and the full explanation is reachable.
 */
describe('Disclosure', () => {
  it('always shows the summary, so a caveat is never hidden behind a tap', async () => {
    await renderWithProviders(
      <Disclosure summary="These are estimates" detail="The long explanation." />,
    );
    expect(screen.getByText('These are estimates')).toBeTruthy();
  });

  it('keeps the detail collapsed until asked', async () => {
    await renderWithProviders(
      <Disclosure summary="These are estimates" detail="The long explanation." />,
    );
    expect(screen.queryByText('The long explanation.')).toBeNull();
  });

  it('reveals the detail on tap and hides it again', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <Disclosure summary="These are estimates" detail="The long explanation." />,
    );

    await user.press(screen.getByRole('button', { name: 'These are estimates' }));
    expect(screen.getByText('The long explanation.')).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'These are estimates' }));
    expect(screen.queryByText('The long explanation.')).toBeNull();
  });

  it('reports its expanded state to assistive technology', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <Disclosure summary="These are estimates" detail="The long explanation." />,
    );

    const trigger = screen.getByRole('button', { name: 'These are estimates' });
    expect(trigger).not.toBeExpanded();

    await user.press(trigger);
    expect(screen.getByRole('button', { name: 'These are estimates' })).toBeExpanded();
  });

  it('renders a summary with no detail as plain text, not a dead button', async () => {
    await renderWithProviders(<Disclosure summary="Just the one line" />);

    expect(screen.getByText('Just the one line')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('OfflineNotice', () => {
  it('renders nothing while the device is online', async () => {
    // jest.setup mocks expo-network as online.
    await renderWithProviders(<OfflineNotice message="Signing in needs one." />);
    expect(screen.queryByText(/No connection/)).toBeNull();
  });
});
