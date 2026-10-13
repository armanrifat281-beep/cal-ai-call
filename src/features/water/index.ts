export { WaterCard, GLASS_ML } from './WaterCard';
export {
  getDeviceWaterRepository,
  setWaterRepository,
  useDayWater,
  useWaterRepository,
  type DayWater,
} from './hooks';
export { clearLocalWater, createLocalWaterRepository } from './localRepository';
export { createSupabaseWaterRepository } from './supabaseRepository';
export type { WaterEntry, WaterRepository } from './repository';
