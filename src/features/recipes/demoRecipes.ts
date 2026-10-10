import type { RecipeRequest } from '@/types/recipe';

import type { ValidatedRecipeDraft } from './validate';

/**
 * Bundled demo recipes.
 *
 * Shown ONLY when the user explicitly taps the demo button, and only when no
 * AI provider is configured. They exist so the whole flow - checklist, serving
 * adjustment, shopping list, cooking mode - can be exercised without an API
 * key.
 *
 * These are real, followable recipes, not filler. But they are NOT generated
 * from the user's request, so everything built from them carries the
 * `demo_sample` origin and provenance, and the UI labels them as demo
 * throughout. Nothing here is ever presented as AI output.
 */

/** Marks every figure in a demo recipe as demo data. */
const DEMO_PROVIDER = 'Bundled demo recipe';

interface DemoDefinition {
  /** Words in the request that make this demo the best match. */
  keywords: string[];
  draft: Omit<ValidatedRecipeDraft, 'caveats'> & { caveats: string[] };
}

const DEMOS: DemoDefinition[] = [
  {
    keywords: ['biryani', 'rice', 'chicken', 'bangladeshi', 'indian', 'pulao'],
    draft: {
      title: 'Simple chicken pulao',
      description:
        'A one-pot rice dish with chicken and whole spices. Less work than a layered biryani and close in flavour.',
      cuisine: 'bangladeshi',
      cuisineNote: null,
      servings: 4,
      prepMinutes: 20,
      cookMinutes: 35,
      equipment: ['Large heavy pot with a lid', 'Sieve'],
      ingredients: [
        {
          id: 'rice',
          name: 'Basmati rice',
          quantity: 400,
          unit: 'g',
          preparation: 'rinsed until the water runs clear, then soaked 20 minutes',
          group: null,
          substitution: 'Any long-grain rice, though the grains will be shorter',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'chicken',
          name: 'Chicken thighs, bone in',
          quantity: 700,
          unit: 'g',
          preparation: 'skin removed, cut into large pieces',
          group: null,
          substitution: 'Chicken drumsticks',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'onion',
          name: 'Onion',
          quantity: 2,
          unit: 'piece',
          preparation: 'thinly sliced',
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'ginger-garlic',
          name: 'Ginger and garlic paste',
          quantity: 2,
          unit: 'tbsp',
          preparation: null,
          group: null,
          substitution: '1 tbsp each of grated ginger and crushed garlic',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'yoghurt',
          name: 'Plain yoghurt',
          quantity: 150,
          unit: 'g',
          preparation: 'whisked smooth',
          group: null,
          substitution: 'Coconut yoghurt for a dairy-free version',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'whole-spices',
          name: 'Whole spices: 4 cardamom pods, 1 cinnamon stick, 4 cloves, 2 bay leaves',
          quantity: 1,
          unit: 'handful',
          preparation: null,
          group: null,
          substitution: '1 tbsp garam masala, added with the yoghurt instead',
          scalesWithServings: false,
          isOwned: false,
        },
        {
          id: 'oil',
          name: 'Neutral oil or ghee',
          quantity: 3,
          unit: 'tbsp',
          preparation: null,
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'water',
          name: 'Hot water',
          quantity: 650,
          unit: 'ml',
          preparation: null,
          group: null,
          substitution: 'Chicken stock, for more flavour',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'salt',
          name: 'Salt',
          quantity: null,
          unit: 'to_taste',
          preparation: null,
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
      ],
      steps: [
        {
          number: 1,
          instruction:
            'Heat the oil in the pot over medium heat. Add the whole spices and let them sizzle for about 30 seconds, until they smell fragrant.',
          durationMinutes: 2,
          temperatureC: null,
          ingredientIds: ['oil', 'whole-spices'],
        },
        {
          number: 2,
          instruction:
            'Add the sliced onion and cook, stirring now and then, until deep golden. This takes longer than you expect and it is where the flavour comes from.',
          durationMinutes: 12,
          temperatureC: null,
          ingredientIds: ['onion'],
        },
        {
          number: 3,
          instruction:
            'Stir in the ginger and garlic paste and cook for a minute, until the raw smell goes.',
          durationMinutes: 1,
          temperatureC: null,
          ingredientIds: ['ginger-garlic'],
        },
        {
          number: 4,
          instruction:
            'Add the chicken and brown it on all sides. Take the pot off the heat for a moment, stir in the yoghurt, then return it to low heat so the yoghurt does not split.',
          durationMinutes: 8,
          temperatureC: null,
          ingredientIds: ['chicken', 'yoghurt'],
        },
        {
          number: 5,
          instruction:
            'Drain the soaked rice and fold it through gently. Pour in the hot water, season with salt, and bring to a boil.',
          durationMinutes: 3,
          temperatureC: null,
          ingredientIds: ['rice', 'water', 'salt'],
        },
        {
          number: 6,
          instruction:
            'Cover, turn the heat as low as it goes, and leave undisturbed for 15 minutes. Do not lift the lid.',
          durationMinutes: 15,
          temperatureC: null,
          ingredientIds: [],
        },
        {
          number: 7,
          instruction:
            'Take it off the heat and rest, still covered, for 10 minutes. Fluff with a fork from the edges inwards.',
          durationMinutes: 10,
          temperatureC: null,
          ingredientIds: [],
        },
      ],
      tips: [
        'Soaking the rice is what keeps the grains separate rather than sticky.',
        'If the rice is still firm after resting, sprinkle over two tablespoons of hot water, cover, and give it five more minutes off the heat.',
      ],
      tags: ['one pot', 'rice'],
      nutritionPerServing: {
        caloriesKcal: 640,
        proteinG: 38,
        carbsG: 78,
        fatG: 18,
        source: 'demo_sample',
        providerLabel: DEMO_PROVIDER,
      },
      caveats: [
        'This is a bundled demo recipe, not one written for your request.',
        'The nutrition figures are rough estimates for the demo, not a measurement.',
      ],
    },
  },
  {
    keywords: ['pasta', 'egg', 'cheese', 'carbonara', 'italian', 'spaghetti'],
    draft: {
      title: 'Pasta with egg and cheese',
      description:
        'The simplest version of carbonara: pasta, eggs, hard cheese and black pepper, emulsified with the cooking water.',
      cuisine: 'italian',
      cuisineNote: null,
      servings: 2,
      prepMinutes: 5,
      cookMinutes: 12,
      equipment: ['Large pot', 'Mixing bowl'],
      ingredients: [
        {
          id: 'pasta',
          name: 'Spaghetti',
          quantity: 200,
          unit: 'g',
          preparation: null,
          group: null,
          substitution: 'Any long pasta',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'eggs',
          name: 'Eggs',
          quantity: 2,
          unit: 'piece',
          preparation: 'plus 1 extra yolk',
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'cheese',
          name: 'Pecorino or Parmesan',
          quantity: 60,
          unit: 'g',
          preparation: 'finely grated',
          group: null,
          substitution: 'Any hard, salty cheese that grates finely',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'pepper',
          name: 'Black pepper',
          quantity: 1,
          unit: 'tsp',
          preparation: 'coarsely ground',
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'water',
          name: 'Water for boiling, well salted',
          quantity: 3,
          unit: 'l',
          preparation: null,
          group: null,
          substitution: null,
          // Pasta water depends on the pot, not on how many people are eating.
          scalesWithServings: false,
          isOwned: false,
        },
      ],
      steps: [
        {
          number: 1,
          instruction:
            'Bring the salted water to a rolling boil and cook the pasta until just short of tender.',
          durationMinutes: 9,
          temperatureC: null,
          ingredientIds: ['water', 'pasta'],
        },
        {
          number: 2,
          instruction:
            'While it cooks, beat the eggs and extra yolk with the grated cheese and plenty of black pepper until it forms a thick paste.',
          durationMinutes: 3,
          temperatureC: null,
          ingredientIds: ['eggs', 'cheese', 'pepper'],
        },
        {
          number: 3,
          instruction:
            'Save a mugful of the cooking water, then drain the pasta. Let it stop steaming for about 30 seconds: added to the egg mixture while blazing hot, it scrambles.',
          durationMinutes: 1,
          temperatureC: null,
          ingredientIds: [],
        },
        {
          number: 4,
          instruction:
            'Tip the pasta into the bowl and toss hard, loosening with splashes of the reserved water until it turns glossy rather than clumpy.',
          durationMinutes: 2,
          temperatureC: null,
          ingredientIds: [],
        },
      ],
      tips: [
        'The sauce is an emulsion, not a custard. Work off the heat and add water a splash at a time.',
        'Grate the cheese as finely as you can; coarse shreds will not melt into the sauce.',
      ],
      tags: ['quick', 'vegetarian'],
      nutritionPerServing: {
        caloriesKcal: 610,
        proteinG: 29,
        carbsG: 74,
        fatG: 20,
        source: 'demo_sample',
        providerLabel: DEMO_PROVIDER,
      },
      caveats: [
        'This is a bundled demo recipe, not one written for your request.',
        'The nutrition figures are rough estimates for the demo, not a measurement.',
      ],
    },
  },
  {
    keywords: ['tomato', 'onion', 'egg', 'leftover', 'pantry', 'cupboard', 'have'],
    draft: {
      title: 'Tomato and onion eggs with rice',
      description:
        'A fast, forgiving plate built from things most kitchens already have. Soft eggs in a sharp tomato sauce over rice.',
      cuisine: 'other',
      cuisineNote: 'Everyday home cooking',
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 20,
      equipment: ['Frying pan', 'Small pot'],
      ingredients: [
        {
          id: 'rice',
          name: 'Rice',
          quantity: 180,
          unit: 'g',
          preparation: 'rinsed',
          group: null,
          substitution: 'Bread, to mop it up instead',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'eggs',
          name: 'Eggs',
          quantity: 4,
          unit: 'piece',
          preparation: 'beaten with a pinch of salt',
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'tomatoes',
          name: 'Tomatoes',
          quantity: 4,
          unit: 'piece',
          preparation: 'roughly chopped',
          group: null,
          substitution: 'A 400g tin of chopped tomatoes, drained a little',
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'onion',
          name: 'Onion',
          quantity: 1,
          unit: 'piece',
          preparation: 'finely sliced',
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'oil',
          name: 'Oil',
          quantity: 2,
          unit: 'tbsp',
          preparation: null,
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
        {
          id: 'salt',
          name: 'Salt and pepper',
          quantity: null,
          unit: 'to_taste',
          preparation: null,
          group: null,
          substitution: null,
          scalesWithServings: true,
          isOwned: false,
        },
      ],
      steps: [
        {
          number: 1,
          instruction:
            'Put the rice on to cook with twice its volume of water, covered, over low heat.',
          durationMinutes: 15,
          temperatureC: null,
          ingredientIds: ['rice'],
        },
        {
          number: 2,
          instruction:
            'Heat half the oil in the pan over medium-high heat. Pour in the beaten eggs, let them set for a few seconds, then fold them over until just barely cooked. Lift them out while they still look slightly underdone.',
          durationMinutes: 3,
          temperatureC: null,
          ingredientIds: ['oil', 'eggs'],
        },
        {
          number: 3,
          instruction:
            'Add the rest of the oil and the onion to the same pan. Cook until softened and starting to colour.',
          durationMinutes: 6,
          temperatureC: null,
          ingredientIds: ['onion'],
        },
        {
          number: 4,
          instruction:
            'Add the tomatoes and a good pinch of salt. Cook, pressing them down, until they collapse into a thick sauce.',
          durationMinutes: 8,
          temperatureC: null,
          ingredientIds: ['tomatoes', 'salt'],
        },
        {
          number: 5,
          instruction:
            'Return the eggs, break them into pieces through the sauce, and warm through for a minute. Taste, season, and spoon over the rice.',
          durationMinutes: 2,
          temperatureC: null,
          ingredientIds: ['eggs'],
        },
      ],
      tips: [
        'Taking the eggs out underdone is the whole trick: they finish in the sauce instead of turning rubbery.',
        'A spoonful of sugar fixes tomatoes that taste thin or too sharp.',
      ],
      tags: ['quick', 'cheap', 'vegetarian'],
      nutritionPerServing: {
        caloriesKcal: 520,
        proteinG: 22,
        carbsG: 62,
        fatG: 20,
        source: 'demo_sample',
        providerLabel: DEMO_PROVIDER,
      },
      caveats: [
        'This is a bundled demo recipe, not one written for your request.',
        'The nutrition figures are rough estimates for the demo, not a measurement.',
      ],
    },
  },
];

/**
 * Picks the demo recipe closest to what the user asked for.
 *
 * Keyword overlap only. This is deliberately crude: it is a demo chooser, not
 * a recommender, and pretending otherwise would misrepresent what it does.
 */
export function pickDemoRecipe(request: RecipeRequest): ValidatedRecipeDraft {
  const haystack = [
    request.prompt,
    ...request.pantryIngredients,
    request.cuisine ?? '',
    request.cuisineNote ?? '',
  ]
    .join(' ')
    .toLowerCase();

  let best = DEMOS[0];
  let bestScore = -1;

  for (const demo of DEMOS) {
    const score = demo.keywords.filter((keyword) => haystack.includes(keyword)).length;
    if (score > bestScore) {
      bestScore = score;
      best = demo;
    }
  }

  const draft = best ?? DEMOS[0];
  if (!draft) {
    throw new Error('no demo recipes are bundled');
  }

  // Deep copy, so a screen editing the returned draft cannot mutate the
  // bundled constant and affect the next demo.
  return JSON.parse(JSON.stringify(draft.draft)) as ValidatedRecipeDraft;
}

/** How many demo recipes are bundled. Used by the UI copy and by tests. */
export const DEMO_RECIPE_COUNT = DEMOS.length;
