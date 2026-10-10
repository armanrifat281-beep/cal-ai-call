import { Badge, type BadgeTone } from '@/components/ui';
import { SOURCE_LABELS } from '@/features/nutrition';
import type { ConfidenceLevel, NutrientSource } from '@/types/domain';

/**
 * Says where a number came from.
 *
 * This badge appears next to every nutrition figure in the app. Showing it is
 * not decoration: a looked-up value and a model's guess must never look alike.
 */

const SOURCE_TONES: Record<NutrientSource, BadgeTone> = {
  database: 'success',
  ai_estimate: 'warning',
  user_entered: 'info',
  demo_sample: 'neutral',
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'confident',
  medium: 'fairly sure',
  low: 'unsure',
};

export interface SourceBadgeProps {
  source: NutrientSource;
  /** Appended for estimates, where confidence is the whole point. */
  confidence?: ConfidenceLevel;
}

export function SourceBadge({ source, confidence }: SourceBadgeProps) {
  const base = SOURCE_LABELS[source];
  const label =
    source === 'ai_estimate' && confidence
      ? `${base} - ${CONFIDENCE_LABELS[confidence]}`
      : base;

  return <Badge label={label} tone={SOURCE_TONES[source]} />;
}

/** The strongest claim a set of items supports, for a whole-meal badge. */
export function aggregateSource(
  sources: readonly NutrientSource[],
): NutrientSource | null {
  if (sources.length === 0) return null;
  // Any estimate in the mix means the total is an estimate.
  if (sources.includes('ai_estimate')) return 'ai_estimate';
  if (sources.includes('demo_sample')) return 'demo_sample';
  if (sources.includes('user_entered')) return 'user_entered';
  return 'database';
}
