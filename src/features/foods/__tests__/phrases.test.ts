import { MAX_PHRASES, foodPhrases } from '../phrases';

/**
 * Pulling food names out of a sentence.
 *
 * This is all the "recognition" behind the describe-a-meal screen, which is
 * exactly why it is worth pinning: the user is shown what it found and can
 * take any of it out, but a splitter that silently swallowed half a sentence
 * would cost them calories they never noticed were missing.
 */
describe('foodPhrases', () => {
  it('splits a sentence on the words people actually list food with', () => {
    expect(
      foodPhrases('I had scrambled eggs with a fresh salad and cherry tomatoes'),
    ).toEqual(['scrambled eggs', 'fresh salad', 'cherry tomatoes']);
  });

  it('strips the filler at each end without touching the middle', () => {
    // "of" survives inside the name; the leading article does not.
    expect(foodPhrases('a cream of tomato soup')).toEqual(['cream of tomato soup']);
  });

  it('drops a phrase twice over, because eating it twice is a portion', () => {
    expect(foodPhrases('eggs and toast and eggs')).toEqual(['eggs', 'toast']);
  });

  it('ignores anything too short to look a food up with', () => {
    expect(foodPhrases('a, an, the, ok')).toEqual([]);
  });

  // Past this it is a shopping list, and each phrase costs a round trip.
  it('stops at a sensible number of foods', () => {
    const many = Array.from({ length: 20 }, (_, i) => `food${i}`).join(', ');
    expect(foodPhrases(many)).toHaveLength(MAX_PHRASES);
  });

  it('survives an empty sentence', () => {
    expect(foodPhrases('')).toEqual([]);
    expect(foodPhrases('   ')).toEqual([]);
  });
});
