import type {
  ActivityLevel,
  BiologicalSex,
  BodyBasics,
  NutritionGoalKind,
} from '@/types/domain';

/**
 * A daily calorie and macro target, worked out from the usual arithmetic.
 *
 * Why this exists: the app used to ask people to type a calorie number in
 * themselves, and almost nobody knows theirs. They left it blank, so Home had
 * no target, the ring had nothing to fill, and the screen read as broken -
 * "280 kcal eaten" above a dial pointing at nothing.
 *
 * This is the Mifflin-St Jeor equation, the same one printed in textbooks and
 * used by every calorie app. It is arithmetic on height, weight, age and sex,
 * not a judgement about anybody's health, and the app says so wherever the
 * number is shown. It is a starting point the user can overwrite in one tap.
 *
 * What it is NOT: medical or dietary advice, and not accurate for an
 * individual. The equation's own error is around ±10% for most people, and
 * more for anyone pregnant, very muscular, very young, or managing a
 * condition that changes energy use. The UI carries that warning; this
 * module only has to be honest arithmetic.
 */

export const EMPTY_BODY_BASICS: BodyBasics = {
  sex: 'unspecified',
  ageYears: null,
  heightCm: null,
  weightKg: null,
  activity: 'light',
};

/**
 * How much more than resting a day costs.
 *
 * The familiar Harris-Benedict multipliers. The top of the usual scale
 * (1.9, "athlete training twice a day") is left out: it is chosen far more
 * often than it is true, and a target 700 kcal too high is worse than one
 * slightly too low.
 */
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting',
  light: 'Light - a walk most days',
  moderate: 'Active - exercise 3-5 days',
  very: 'Very active - hard exercise most days',
};

/** Floors below which a target stops being food and starts being a problem. */
const FLOOR_BY_SEX: Record<BiologicalSex, number> = {
  female: 1200,
  male: 1500,
  unspecified: 1200,
};

const CEILING_KCAL = 5000;

/** Plausible inputs. Outside these the arithmetic stops meaning anything. */
const LIMITS = {
  age: { min: 13, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
} as const;

export function isCompleteBodyBasics(basics: BodyBasics): boolean {
  const { ageYears, heightCm, weightKg } = basics;
  return (
    ageYears !== null &&
    heightCm !== null &&
    weightKg !== null &&
    ageYears >= LIMITS.age.min &&
    ageYears <= LIMITS.age.max &&
    heightCm >= LIMITS.heightCm.min &&
    heightCm <= LIMITS.heightCm.max &&
    weightKg >= LIMITS.weightKg.min &&
    weightKg <= LIMITS.weightKg.max
  );
}

/**
 * Resting energy: what the body spends doing nothing at all.
 *
 * Mifflin-St Jeor. "Unspecified" takes the midpoint of the two constants
 * rather than defaulting to either, so nobody is asked to pick a sex they
 * do not want to give in order to get a number.
 */
export function restingEnergyKcal(basics: BodyBasics): number | null {
  if (!isCompleteBodyBasics(basics)) return null;
  const { heightCm, weightKg, ageYears, sex } = basics;

  const base = 10 * (weightKg ?? 0) + 6.25 * (heightCm ?? 0) - 5 * (ageYears ?? 0);
  const constant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return base + constant;
}

/** What a day costs, resting energy times how much the user moves. */
export function maintenanceKcal(basics: BodyBasics): number | null {
  const resting = restingEnergyKcal(basics);
  if (resting === null) return null;
  return resting * ACTIVITY_MULTIPLIER[basics.activity];
}

/**
 * The change a goal makes to maintenance.
 *
 * 500 kcal is the familiar "about half a kilo a week" deficit. It is
 * deliberately not offered faster: the app has no way to supervise anyone,
 * and a bigger deficit is where calorie counting starts doing harm.
 */
function goalDeltaKcal(goal: NutritionGoalKind): number {
  switch (goal) {
    case 'manage_weight':
      return -500;
    default:
      return 0;
  }
}

/**
 * Grams of protein a day.
 *
 * 1.6 g per kg of body weight, the figure protein research settles around
 * for someone active, raised slightly when protein is the stated goal and
 * when eating at a deficit, where it protects muscle.
 */
function proteinGrams(weightKg: number, goal: NutritionGoalKind): number {
  const perKg = goal === 'more_protein' ? 2 : goal === 'manage_weight' ? 1.8 : 1.6;
  return Math.round(weightKg * perKg);
}

/**
 * Every field is a number, not `number | null`.
 *
 * `DailyTargets` is nullable because a user may have no target at all; a
 * suggestion that exists has all four, and saying so here keeps every
 * caller from re-checking what this function already guaranteed.
 */
export interface SuggestedTargets {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Maintenance, before the goal was applied. Shown as context. */
  maintenanceKcal: number;
}

/**
 * A full set of daily targets, or null when the basics are incomplete.
 *
 * Fat is set at 27% of calories - the middle of the usual 20-35% band - and
 * carbohydrate takes whatever is left, which is how a macro split is
 * normally built: protein by body weight, fat by proportion, carbohydrate
 * as the remainder.
 */
export function suggestDailyTargets(
  basics: BodyBasics,
  goal: NutritionGoalKind,
): SuggestedTargets | null {
  const maintenance = maintenanceKcal(basics);
  const weightKg = basics.weightKg;
  if (maintenance === null || weightKg === null) return null;

  const floor = FLOOR_BY_SEX[basics.sex];
  const calories = Math.round(
    Math.min(CEILING_KCAL, Math.max(floor, maintenance + goalDeltaKcal(goal))),
  );

  const protein = proteinGrams(weightKg, goal);
  const fat = Math.round((calories * 0.27) / 9);
  // Whatever the other two leave. Clamped at zero: a very low target with a
  // high protein figure can in principle spend the whole budget, and a
  // negative carbohydrate target would be nonsense on the screen.
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    caloriesKcal: calories,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    maintenanceKcal: Math.round(maintenance),
  };
}
