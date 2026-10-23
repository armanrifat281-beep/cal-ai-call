import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { Avatar } from '../Avatar';

/**
 * The circle showed initials and nothing else, because the app kept no
 * profile picture. It keeps one now, so the circle has two states and the
 * fallback still has to work: a picture is optional, and plenty of people
 * will never set one.
 */
describe('Avatar', () => {
  it('shows initials when there is no picture', async () => {
    await renderWithProviders(<Avatar name="Nasim Ahmed Rahman" />);
    expect(screen.getByText('NR')).toBeTruthy();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
  });

  it('shows the picture instead of initials once one is set', async () => {
    await renderWithProviders(
      <Avatar name="Nasim Ahmed Rahman" imageUri="file:///avatar.jpg?v=3" />,
    );

    expect(screen.queryByText('NR')).toBeNull();
    expect(screen.getByTestId('avatar-image').props.source).toEqual({
      uri: 'file:///avatar.jpg?v=3',
    });
  });

  it('falls back to initials when the picture is cleared', async () => {
    await renderWithProviders(<Avatar name="Nasim Ahmed Rahman" imageUri={null} />);
    expect(screen.getByText('NR')).toBeTruthy();
  });
});
