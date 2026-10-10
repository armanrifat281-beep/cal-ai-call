/**
 * An in-memory stand-in for expo-file-system.
 *
 * The real module is native, so these tests exercise the module's own logic -
 * path safety, overwrite, failure handling - against a filesystem that
 * behaves like the real one for the handful of operations used.
 */
const mockFs = {
  files: new Set<string>(),
  directories: new Set<string>(),
  copyFailure: null as string | null,
  reset() {
    mockFs.files.clear();
    mockFs.directories.clear();
    mockFs.copyFailure = null;
  },
};

jest.mock('expo-file-system', () => {
  // Collapse repeated slashes in the path, leaving the scheme's own "//"
  // alone, so "file:///documents" survives being joined with a folder name.
  const join = (...parts: string[]) => {
    const joined = parts.filter((part) => part.length > 0).join('/');
    const scheme = /^([a-z][a-z0-9+.-]*:\/\/)(.*)$/i.exec(joined);
    if (!scheme) return joined.replace(/\/{2,}/g, '/');
    return `${scheme[1]}${(scheme[2] ?? '').replace(/\/{2,}/g, '/')}`;
  };

  class Directory {
    uri: string;
    constructor(...uris: (string | { uri: string })[]) {
      this.uri = join(...uris.map((u) => (typeof u === 'string' ? u : u.uri)));
    }
    get exists() {
      return mockFs.directories.has(this.uri);
    }
    create() {
      mockFs.directories.add(this.uri);
    }
    delete() {
      mockFs.directories.delete(this.uri);
      for (const file of [...mockFs.files]) {
        if (file.startsWith(`${this.uri}/`)) mockFs.files.delete(file);
      }
    }
  }

  class File {
    uri: string;
    constructor(...uris: (string | { uri: string })[]) {
      this.uri = join(...uris.map((u) => (typeof u === 'string' ? u : u.uri)));
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    delete() {
      mockFs.files.delete(this.uri);
    }
    async copy(destination: { uri: string }) {
      if (mockFs.copyFailure) throw new Error(mockFs.copyFailure);
      if (!mockFs.files.has(this.uri)) throw new Error(`No such file: ${this.uri}`);
      mockFs.files.add(destination.uri);
    }
  }

  return { Directory, File, Paths: { document: 'file:///documents' } };
});

/* eslint-disable import/first -- the jest.mock factory above has to be
   evaluated before the module under test is imported. */
import {
  deleteAllMealPhotos,
  deleteAllPhotos,
  deleteDishPhoto,
  deleteMealPhoto,
  dishPhotoUri,
  mealPhotoPath,
  mealPhotoUri,
  saveDishPhoto,
  saveMealPhoto,
} from '../store';

const ENTRY = 'a1b2c3d4-0000-4000-8000-000000000001';
const SOURCE = 'file:///cache/capture-1.jpg';

beforeEach(() => {
  mockFs.reset();
  // The presence cache is module state and outlives a single test, so it is
  // cleared through the same call the app uses when photo keeping is
  // switched off.
  deleteAllPhotos();
  mockFs.files.add(SOURCE);
});

describe('saveMealPhoto', () => {
  it('copies the capture somewhere durable and returns where it went', async () => {
    const result = await saveMealPhoto(ENTRY, SOURCE);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(`file:///documents/meal-photos/${ENTRY}.jpg`);
    expect(mealPhotoUri(ENTRY)).toBe(`file:///documents/meal-photos/${ENTRY}.jpg`);
  });

  it('creates the photos folder the first time, rather than failing', async () => {
    expect(mockFs.directories.has('file:///documents/meal-photos')).toBe(false);
    await saveMealPhoto(ENTRY, SOURCE);
    expect(mockFs.directories.has('file:///documents/meal-photos')).toBe(true);
  });

  it('replaces an existing photo, so re-attaching works', async () => {
    await saveMealPhoto(ENTRY, SOURCE);
    mockFs.files.add('file:///cache/capture-2.jpg');

    const second = await saveMealPhoto(ENTRY, 'file:///cache/capture-2.jpg');
    expect(second.ok).toBe(true);
    // One photo per entry, not an accumulating pile.
    const stored = [...mockFs.files].filter((f) => f.includes('meal-photos'));
    expect(stored).toHaveLength(1);
  });

  it('reports a copy failure instead of throwing into the save path', async () => {
    mockFs.copyFailure = 'Disk full';
    const result = await saveMealPhoto(ENTRY, SOURCE);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.retryable).toBe(true);
    expect(result.ok === false && result.error.detail).toContain('Disk full');
  });

  it('refuses an id that could escape the photos folder', async () => {
    for (const unsafe of ['../../etc/passwd', 'a/b', 'a.b', '', '..']) {
      const result = await saveMealPhoto(unsafe, SOURCE);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error.code).toBe('validation');
    }
    expect([...mockFs.files].some((f) => f.includes('meal-photos'))).toBe(false);
  });
});

describe('mealPhotoUri', () => {
  it('returns null when the entry has no photo', () => {
    expect(mealPhotoUri(ENTRY)).toBeNull();
  });

  it('returns null for an unsafe id rather than probing the path', () => {
    expect(mealPhotoUri('../secrets')).toBeNull();
  });

  it('reports no photo when the filesystem throws, so the journal still renders', () => {
    const file = jest.requireMock('expo-file-system').File as {
      prototype: { exists: boolean };
    };
    const spy = jest
      .spyOn(file.prototype, 'exists', 'get')
      .mockImplementation(() => {
        throw new Error('Permission denied');
      });

    expect(mealPhotoUri(ENTRY)).toBeNull();
    spy.mockRestore();
  });
});

describe('mealPhotoPath', () => {
  it('gives the path a photo would take, whether or not it is there', () => {
    expect(mealPhotoPath(ENTRY)).toBe(`file:///documents/meal-photos/${ENTRY}.jpg`);
  });

  it('is null for an unsafe id', () => {
    expect(mealPhotoPath('../x')).toBeNull();
  });
});

describe('deleteMealPhoto', () => {
  it('removes the entry photo', async () => {
    await saveMealPhoto(ENTRY, SOURCE);
    deleteMealPhoto(ENTRY);
    expect(mealPhotoUri(ENTRY)).toBeNull();
  });

  it('is silent when there is nothing to delete', () => {
    expect(() => deleteMealPhoto(ENTRY)).not.toThrow();
  });

  it('ignores an unsafe id instead of deleting something else', async () => {
    await saveMealPhoto(ENTRY, SOURCE);
    deleteMealPhoto('../../documents');
    expect(mealPhotoUri(ENTRY)).not.toBeNull();
  });
});

describe('deleteAllMealPhotos', () => {
  it('clears what was already kept, not just future photos', async () => {
    await saveMealPhoto(ENTRY, SOURCE);
    mockFs.files.add('file:///cache/other.jpg');
    await saveMealPhoto('b1b2c3d4-0000-4000-8000-000000000002', 'file:///cache/other.jpg');

    deleteAllMealPhotos();

    expect([...mockFs.files].some((f) => f.includes('meal-photos'))).toBe(false);
  });

  it('leaves everything else on the device alone', async () => {
    await saveMealPhoto(ENTRY, SOURCE);
    deleteAllMealPhotos();
    expect(mockFs.files.has(SOURCE)).toBe(true);
  });
});

describe('the presence cache', () => {
  it('does not ask the filesystem twice for the same entry', async () => {
    await saveMealPhoto(ENTRY, SOURCE);

    const file = jest.requireMock('expo-file-system').File as {
      prototype: { exists: boolean };
    };
    const spy = jest.spyOn(file.prototype, 'exists', 'get');

    mealPhotoUri(ENTRY);
    mealPhotoUri(ENTRY);
    mealPhotoUri(ENTRY);

    // The save already recorded the answer, so none of these touch disk.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('notices a photo added after an earlier miss', async () => {
    expect(mealPhotoUri(ENTRY)).toBeNull();
    await saveMealPhoto(ENTRY, SOURCE);
    expect(mealPhotoUri(ENTRY)).not.toBeNull();
  });

  it('notices a deletion', async () => {
    await saveMealPhoto(ENTRY, SOURCE);
    expect(mealPhotoUri(ENTRY)).not.toBeNull();
    deleteMealPhoto(ENTRY);
    expect(mealPhotoUri(ENTRY)).toBeNull();
  });

  it('forgets everything when all photos are deleted', async () => {
    await saveMealPhoto(ENTRY, SOURCE);
    deleteAllMealPhotos();
    expect(mealPhotoUri(ENTRY)).toBeNull();
  });

  it('does not cache a failed save as if a photo were there', async () => {
    mockFs.copyFailure = 'Disk full';
    await saveMealPhoto(ENTRY, SOURCE);
    expect(mealPhotoUri(ENTRY)).toBeNull();
  });
});


describe('the two collections', () => {
  it('keeps a meal photo and a dish photo apart under the same id', async () => {
    // A journal entry and a recipe can share an id without colliding.
    mockFs.files.add('file:///cache/dish.jpg');
    await saveMealPhoto(ENTRY, SOURCE);
    await saveDishPhoto(ENTRY, 'file:///cache/dish.jpg');

    expect(mealPhotoUri(ENTRY)).toContain('meal-photos');
    expect(dishPhotoUri(ENTRY)).toContain('dish-photos');
    expect(mealPhotoUri(ENTRY)).not.toBe(dishPhotoUri(ENTRY));
  });

  it('leaves dish photos alone when meal photo keeping is switched off', async () => {
    // Turning off "Keep my meal photos" is a promise about the journal. A
    // photo the user deliberately attached to their own recipe is not part
    // of it.
    mockFs.files.add('file:///cache/dish.jpg');
    await saveMealPhoto(ENTRY, SOURCE);
    await saveDishPhoto(ENTRY, 'file:///cache/dish.jpg');

    deleteAllMealPhotos();

    expect(mealPhotoUri(ENTRY)).toBeNull();
    expect(dishPhotoUri(ENTRY)).not.toBeNull();
  });

  it('clears both when everything is erased', async () => {
    mockFs.files.add('file:///cache/dish.jpg');
    await saveMealPhoto(ENTRY, SOURCE);
    await saveDishPhoto(ENTRY, 'file:///cache/dish.jpg');

    deleteAllPhotos();

    expect(mealPhotoUri(ENTRY)).toBeNull();
    expect(dishPhotoUri(ENTRY)).toBeNull();
  });

  it('deletes one dish photo without touching the meal photo', async () => {
    mockFs.files.add('file:///cache/dish.jpg');
    await saveMealPhoto(ENTRY, SOURCE);
    await saveDishPhoto(ENTRY, 'file:///cache/dish.jpg');

    deleteDishPhoto(ENTRY);

    expect(dishPhotoUri(ENTRY)).toBeNull();
    expect(mealPhotoUri(ENTRY)).not.toBeNull();
  });

  it('refuses an unsafe id in either collection', async () => {
    const meal = await saveMealPhoto('../escape', SOURCE);
    const dish = await saveDishPhoto('../escape', SOURCE);
    expect(meal.ok).toBe(false);
    expect(dish.ok).toBe(false);
  });
});
