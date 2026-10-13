import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { Text } from '../Text';
import { TextField } from '../TextField';

describe('TextField', () => {
  it('labels the input, so a screen reader announces what it is for', async () => {
    await renderWithProviders(<TextField label="Email" value="" onChangeText={() => {}} />);

    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('shows help text, and replaces it with the error when there is one', async () => {
    const view = await renderWithProviders(
      <TextField label="Calories" value="" onChangeText={() => {}} help="Leave empty to skip." />,
    );
    expect(screen.getByText('Leave empty to skip.')).toBeTruthy();

    await view.rerender(
      <TextField
        label="Calories"
        value="x"
        onChangeText={() => {}}
        help="Leave empty to skip."
        error="Enter a whole number."
      />,
    );
    expect(screen.getByText('Enter a whole number.')).toBeTruthy();
    // Two messages under one field is noise; the error is the one that matters.
    expect(screen.queryByText('Leave empty to skip.')).toBeNull();
  });

  it('puts an accessory on the label row, keeping a field pair together', async () => {
    await renderWithProviders(
      <TextField
        label="Password"
        value=""
        onChangeText={() => {}}
        secureTextEntry
        labelAccessory={<Text>Forgot?</Text>}
      />,
    );

    expect(screen.getByText('Forgot?')).toBeTruthy();
  });

  describe('revealing a password', () => {
    // A password you cannot see is a password you cannot check: a typo is
    // invisible, and the only feedback is "those details do not match".
    it('offers a reveal control on a masked field', async () => {
      await renderWithProviders(
        <TextField label="Password" value="hunter22" onChangeText={() => {}} secureTextEntry />,
      );

      expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
    });

    it('starts masked, so nothing is exposed without being asked for', async () => {
      await renderWithProviders(
        <TextField label="Password" value="hunter22" onChangeText={() => {}} secureTextEntry />,
      );

      expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    });

    it('unmasks on press, and names the action it will do next', async () => {
      const user = userEvent.setup();
      await renderWithProviders(
        <TextField label="Password" value="hunter22" onChangeText={() => {}} secureTextEntry />,
      );

      await user.press(screen.getByRole('button', { name: 'Show password' }));

      expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
      expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
    });

    it('masks again on a second press', async () => {
      const user = userEvent.setup();
      await renderWithProviders(
        <TextField label="Password" value="hunter22" onChangeText={() => {}} secureTextEntry />,
      );

      await user.press(screen.getByRole('button', { name: 'Show password' }));
      await user.press(screen.getByRole('button', { name: 'Hide password' }));

      expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    });

    it('offers nothing on a field that was never masked', async () => {
      await renderWithProviders(
        <TextField label="Email" value="a@b.com" onChangeText={() => {}} />,
      );

      expect(screen.queryByRole('button', { name: 'Show password' })).toBeNull();
    });

    it('can be suppressed for a value that must not be shown', async () => {
      await renderWithProviders(
        <TextField
          label="Password"
          value="hunter22"
          onChangeText={() => {}}
          secureTextEntry
          hideRevealToggle
        />,
      );

      expect(screen.queryByRole('button', { name: 'Show password' })).toBeNull();
      expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    });
  });
});
