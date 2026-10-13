import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/renderWithProviders';

import { SocialSignIn } from '../SocialSignIn';

/*
  A build WITH Google configured. The rest of the suite covers the opposite
  case through the auth screens, which run against the real (unconfigured)
  env.
*/
jest.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabaseKey: 'sb_publishable_test',
    isSupabaseConfigured: true,
    isGoogleSignInConfigured: true,
  },
}));

jest.mock('../useGoogleSignIn', () => ({
  useGoogleSignIn: () => ({
    start: jest.fn(),
    busy: false,
    available: true,
    error: null,
    clearError: jest.fn(),
  }),
}));

/**
 * Google appears exactly when it can do something.
 *
 * The screens draw nothing for it in a build without the client ids - a
 * button that can only report its own absence is a broken button, whatever
 * it says when pressed. This is the other half of that: with the ids set, it
 * has to come back on its own, so configuring Google is the only step
 * anybody has to take.
 */
describe('the Google option, in a configured build', () => {
  it('is offered', async () => {
    await renderWithProviders(
      <SocialSignIn onSignedIn={jest.fn()} onError={jest.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeTruthy();
  });

  it('brings its separator with it, so it is not floating', async () => {
    await renderWithProviders(
      <SocialSignIn onSignedIn={jest.fn()} onError={jest.fn()} />,
    );

    // Hidden from screen readers on purpose - it is a rule, not content -
    // so it has to be asked for explicitly.
    expect(
      screen.getByText('or', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
