import { screen } from '@testing-library/react-native';

import { dishPhotoUri } from '@/features/photos';
import { renderWithProviders } from '@/test/renderWithProviders';

import { RecipeImage } from '../RecipeImage';

// Babel hoists this above the imports, so the module under test picks up the
// mock even though it is written below them.
jest.mock('@/features/photos', () => ({
  dishPhotoUri: jest.fn<string | null, [string]>(() => null),
}));

const mockedDishPhoto = dishPhotoUri as jest.MockedFunction<typeof dishPhotoUri>;

beforeEach(() => {
  mockedDishPhoto.mockReset();
  mockedDishPhoto.mockReturnValue(null);
});

describe('RecipeImage', () => {
  it('shows the stand-in when there is no image at all', async () => {
    await renderWithProviders(<RecipeImage image={null} title="Dal" />);
    expect(screen.queryByLabelText(/Photo of Dal/)).toBeNull();
    expect(screen.queryByText(/Illustration/)).toBeNull();
  });

  it('labels an AI illustration as one', async () => {
    await renderWithProviders(
      <RecipeImage
        image={{ uri: 'https://example.test/a.jpg', kind: 'ai_generated', attribution: null }}
        title="Dal"
      />,
    );
    expect(screen.getByText('Illustration, not your dish')).toBeTruthy();
  });

  it('labels a stock photo as one', async () => {
    await renderWithProviders(
      <RecipeImage
        image={{ uri: 'https://example.test/a.jpg', kind: 'stock_library', attribution: 'Someone' }}
        title="Dal"
      />,
    );
    expect(screen.getByText('Stock photo of a similar dish')).toBeTruthy();
    expect(screen.getByText('Someone')).toBeTruthy();
  });

  it('prefers the cook’s own photo over a stored illustration', async () => {
    mockedDishPhoto.mockReturnValue('file:///documents/dish-photos/r1.jpg');

    await renderWithProviders(
      <RecipeImage
        image={{ uri: 'https://example.test/ai.jpg', kind: 'ai_generated', attribution: null }}
        recipeId="r1"
        title="Dal"
      />,
    );

    // Their own plate, and no disclaimer, because it is a real photo of it.
    expect(screen.queryByText('Illustration, not your dish')).toBeNull();
    expect(screen.getByLabelText('Photo of Dal')).toBeTruthy();
  });

  it('does not look for a photo when given no recipe id', async () => {
    await renderWithProviders(<RecipeImage image={null} title="Dal" />);
    expect(mockedDishPhoto).not.toHaveBeenCalled();
  });

  it('falls back to the stored image when the cook took no photo', async () => {
    mockedDishPhoto.mockReturnValue(null);
    await renderWithProviders(
      <RecipeImage
        image={{ uri: 'https://example.test/ai.jpg', kind: 'ai_generated', attribution: null }}
        recipeId="r1"
        title="Dal"
      />,
    );
    expect(screen.getByText('Illustration, not your dish')).toBeTruthy();
  });
});
