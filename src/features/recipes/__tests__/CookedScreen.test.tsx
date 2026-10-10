import { screen, userEvent } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { saveDishPhoto } from '@/features/photos';
import { prepareImageForUpload } from '@/features/scanner/image';
import { ok } from '@/lib/result';
import { renderWithProviders } from '@/test/renderWithProviders';

import { CookedScreen } from '../CookedScreen';

// Babel hoists these above the imports above, so the component under test
// picks them up.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock('@/features/photos', () => ({
  saveDishPhoto: jest.fn(async () => ({
    ok: true,
    value: 'file:///documents/dish-photos/r1.jpg',
  })),
}));

jest.mock('@/features/scanner/image', () => ({
  prepareImageForUpload: jest.fn(async () => ({
    ok: true,
    value: { uri: 'file:///cache/prepared.jpg', width: 800, height: 600, byteSize: 1000 },
  })),
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockedSave = saveDishPhoto as jest.MockedFunction<typeof saveDishPhoto>;
const mockedPrepare = prepareImageForUpload as jest.MockedFunction<
  typeof prepareImageForUpload
>;

function captured() {
  return {
    canceled: false as const,
    assets: [{ uri: 'file:///cache/shot.jpg', mimeType: 'image/jpeg' }],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  picker.requestCameraPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  picker.launchCameraAsync.mockResolvedValue({ canceled: true } as never);
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true } as never);
  mockedPrepare.mockResolvedValue(
    ok({ uri: 'file:///cache/prepared.jpg', width: 800, height: 600, byteSize: 1000 }) as never,
  );
  mockedSave.mockResolvedValue(ok('file:///documents/dish-photos/r1.jpg'));
});

function render() {
  return renderWithProviders(
    <CookedScreen recipeId="r1" recipeTitle="Masoor dal" onDone={jest.fn()} />,
  );
}

describe('CookedScreen', () => {
  it('marks the cooking as finished rather than just closing', async () => {
    await render();
    expect(screen.getByText('You cooked it.')).toBeTruthy();
    expect(screen.getByText(/Masoor dal is marked as cooked/)).toBeTruthy();
  });

  it('offers a photo without demanding one', async () => {
    await render();
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeTruthy();
    // Skipping is a plain, equal option, not a buried link.
    expect(screen.getByRole('button', { name: 'Finish without a photo' })).toBeTruthy();
  });

  it('saves a captured photo against the recipe', async () => {
    picker.launchCameraAsync.mockResolvedValue(captured() as never);
    const user = userEvent.setup();
    await render();

    await user.press(screen.getByRole('button', { name: 'Take a photo' }));

    expect(mockedSave).toHaveBeenCalledWith('r1', 'file:///cache/prepared.jpg');
    expect(screen.getByText('Saved to this recipe, on this device')).toBeTruthy();
  });

  it('compresses the photo before storing it', async () => {
    picker.launchCameraAsync.mockResolvedValue(captured() as never);
    const user = userEvent.setup();
    await render();

    await user.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(mockedPrepare).toHaveBeenCalledWith('file:///cache/shot.jpg', 'image/jpeg');
  });

  it('changes the finish button once a photo is attached', async () => {
    picker.launchCameraAsync.mockResolvedValue(captured() as never);
    const user = userEvent.setup();
    await render();

    await user.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finish without a photo' })).toBeNull();
  });

  it('falls back to the library when camera access is refused', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const user = userEvent.setup();
    await render();

    await user.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(picker.launchImageLibraryAsync).toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('saves nothing when the camera is dismissed', async () => {
    const user = userEvent.setup();
    await render();

    await user.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(mockedSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Finish without a photo' })).toBeTruthy();
  });

  it('says so when the photo cannot be saved, and still lets them finish', async () => {
    picker.launchCameraAsync.mockResolvedValue(captured() as never);
    mockedSave.mockResolvedValue({
      ok: false,
      error: { code: 'unknown', message: 'nope', retryable: true },
    });
    const user = userEvent.setup();
    await render();

    await user.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(screen.getByText(/could not be saved/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish without a photo' })).toBeTruthy();
  });

  it('calls back when the user is done', async () => {
    const onDone = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(
      <CookedScreen recipeId="r1" recipeTitle="Masoor dal" onDone={onDone} />,
    );

    await user.press(screen.getByRole('button', { name: 'Finish without a photo' }));
    expect(onDone).toHaveBeenCalled();
  });
});
