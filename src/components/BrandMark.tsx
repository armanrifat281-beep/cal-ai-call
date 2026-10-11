import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { ramps, useTheme } from '@/theme';

export interface BrandMarkProps {
  size?: number;
  /** Draws the enclosing tile, as the app icon does. */
  tile?: boolean;
}

/**
 * The FoodLens mark.
 *
 * A vesica - the shape where two circles overlap - tilted, with a single
 * vein. It reads as a lens and as a leaf at the same time, which is the
 * whole idea in one form.
 *
 * The geometry is solved from the proportions we want rather than from the
 * circles: a vesica is always taller than it is wide, so specifying the
 * radius directly produces a sliver.
 *
 *   halfWidth  = R - d
 *   halfHeight = sqrt(R^2 - d^2)
 *
 * The same numbers drive scripts/generate-icons.mjs, so the app icon and this
 * component cannot drift apart. Deliberately flat: two colours, no gradient.
 */

const HALF_WIDTH = 30;
const HALF_HEIGHT = 40;
const TILT = -18;

const RADIUS = (HALF_WIDTH ** 2 + HALF_HEIGHT ** 2) / (2 * HALF_WIDTH);
const OFFSET = RADIUS - HALF_WIDTH;

export function BrandMark({ size = 48, tile = false }: BrandMarkProps) {
  const theme = useTheme();

  // The mark keeps its colour while the interface around it does not.
  const ink = tile
    ? ramps.brand.mark
    : theme.scheme === 'dark'
      ? ramps.brand.markDark
      : ramps.brand.mark;
  const light = tile ? ramps.neutral[25] : theme.colors.background;
  // Inside a tile the mark sits in the safe area; standalone it fills the box.
  const scale = tile ? 0.8 : 1;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="brandLens">
          <Circle cx={50 - OFFSET} cy={50} r={RADIUS} />
        </ClipPath>
      </Defs>

      {tile ? <Rect x={0} y={0} width={100} height={100} rx={22} fill={ink} /> : null}

      <G transform={`translate(50 50) rotate(${TILT}) scale(${scale}) translate(-50 -50)`}>
        {/* The lens: one circle clipped to the other. */}
        <G clipPath="url(#brandLens)">
          <Circle cx={50 + OFFSET} cy={50} r={RADIUS} fill={tile ? light : ink} />
        </G>

        {/* The vein, which is what tips it from an eye to a leaf. */}
        <Path
          d={`M 50 ${50 - HALF_HEIGHT + 7} L 50 ${50 + HALF_HEIGHT - 7}`}
          stroke={tile ? ink : light}
          strokeWidth={5.5}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
