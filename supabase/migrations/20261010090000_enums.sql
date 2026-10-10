-- FoodLens AI: shared enumerated types.
--
-- These mirror the TypeScript unions in src/types/domain.ts. Using real enums
-- rather than free text means a typo in the app is rejected by the database
-- instead of becoming a row nobody can query.

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');

create type public.portion_unit as enum (
  'g', 'ml', 'oz', 'piece', 'slice', 'cup', 'tbsp', 'tsp', 'serving'
);

-- Where a nutrient value came from. Stored per item so the app can always
-- show a looked-up value differently from a model's estimate.
create type public.nutrient_source as enum (
  'database', 'ai_estimate', 'user_entered', 'demo_sample'
);

create type public.confidence_level as enum ('high', 'medium', 'low');

create type public.measurement_system as enum ('metric', 'imperial');

create type public.nutrition_goal as enum (
  'none',
  'understand_eating',
  'more_protein',
  'more_vegetables',
  'manage_weight',
  'steady_energy'
);

create type public.dietary_pattern as enum (
  'no_restriction',
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
  'low_carb',
  'high_protein'
);

create type public.insight_kind as enum (
  'weekly_summary', 'repeat_meal', 'macro_balance', 'logging_streak', 'variety'
);

create type public.subscription_tier as enum ('free', 'premium');

create type public.entitlement_status as enum (
  'active', 'expired', 'in_grace_period', 'in_billing_retry', 'revoked', 'none'
);

create type public.purchase_store as enum ('app_store', 'play_store', 'none');
