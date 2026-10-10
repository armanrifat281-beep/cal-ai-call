import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';
import type { Palette } from '@/theme';

/**
 * The app's icon set.
 *
 * These are hand-authored paths on a 24x24 grid rather than an icon font, which
 * keeps the set original, keeps the bundle small, and lets every glyph inherit
 * the current theme color and stroke weight.
 */

export type IconName =
  | 'home'
  | 'journal'
  | 'insights'
  | 'profile'
  | 'scan'
  | 'camera'
  | 'gallery'
  | 'plus'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronUp'
  | 'chevronDown'
  | 'close'
  | 'trash'
  | 'pencil'
  | 'check'
  | 'info'
  | 'warning'
  | 'clock'
  | 'sparkle'
  | 'copy'
  | 'database'
  | 'leaf'
  | 'recipes'
  | 'basket'
  | 'timer'
  | 'flame'
  | 'star'
  | 'more';

export interface IconProps {
  name: IconName;
  size?: number;
  /** Semantic palette key, or a raw color string. */
  color?: keyof Palette | (string & {});
  /** Stroke width on the 24x24 grid. */
  strokeWidth?: number;
  /** Filled variant, used for the active tab. */
  filled?: boolean;
}

export function Icon({
  name,
  size = 24,
  color = 'text',
  strokeWidth = 1.8,
  filled = false,
}: IconProps) {
  const theme = useTheme();
  const stroke =
    color in theme.colors ? theme.colors[color as keyof Palette] : (color as string);
  // `filled` shades the glyph's body behind the strokes, which is enough to
  // mark an active tab without a second hand-drawn icon per state.
  const fill = filled ? stroke : 'none';
  const fillOpacity = filled ? 0.18 : 0;

  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderGlyph(name, { ...common, fillOpacity }, fill, stroke)}
    </Svg>
  );
}

type CommonProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: 'none';
  fillOpacity: number;
};

function renderGlyph(
  name: IconName,
  common: CommonProps,
  fill: string,
  stroke: string,
): React.ReactNode {
  switch (name) {
    case 'home':
      return (
        <>
          <Path d="M5.6 9.4V20h12.8V9.4" {...common} fill={fill} />
          <Path d="M3.2 10.4 12 3.4l8.8 7" {...common} />
          <Path d="M10 20v-5h4v5" {...common} />
        </>
      );

    case 'journal':
      return (
        <>
          <Path
            d="M6 3.5h9.5A2.5 2.5 0 0 1 18 6v14.5H8.5A2.5 2.5 0 0 1 6 18V3.5Z"
            {...common}
            fill={fill}
          />
          <Path d="M9.5 7.5h5M9.5 11h5" {...common} />
        </>
      );

    case 'insights':
      return (
        <>
          <Path d="M4 20h16" {...common} />
          <Path d="M7 20v-5.5" {...common} strokeWidth={common.strokeWidth + 1.4} />
          <Path d="M12 20V8.5" {...common} strokeWidth={common.strokeWidth + 1.4} />
          <Path d="M17 20v-8.5" {...common} strokeWidth={common.strokeWidth + 1.4} />
        </>
      );

    case 'profile':
      return (
        <>
          <Circle cx={12} cy={8.5} r={3.8} {...common} fill={fill} />
          <Path d="M4.8 20.2a7.6 7.6 0 0 1 14.4 0" {...common} fill={fill} />
        </>
      );

    case 'scan':
      return (
        <>
          <Path d="M3.5 8.5V6A2.5 2.5 0 0 1 6 3.5h2.5" {...common} />
          <Path d="M15.5 3.5H18A2.5 2.5 0 0 1 20.5 6v2.5" {...common} />
          <Path d="M20.5 15.5V18A2.5 2.5 0 0 1 18 20.5h-2.5" {...common} />
          <Path d="M8.5 20.5H6A2.5 2.5 0 0 1 3.5 18v-2.5" {...common} />
          <Circle cx={12} cy={12} r={3.2} {...common} />
        </>
      );

    case 'camera':
      return (
        <>
          <Path
            d="M3.5 8.8A2.3 2.3 0 0 1 5.8 6.5h1.6l1.1-2h5l1.1 2h1.6a2.3 2.3 0 0 1 2.3 2.3v8.4a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3V8.8Z"
            {...common}
          />
          <Circle cx={12} cy={13} r={3.4} {...common} />
        </>
      );

    case 'gallery':
      return (
        <>
          <Rect x={3.5} y={5} width={17} height={14} rx={2.4} {...common} />
          <Path d="M3.9 16.2 8.6 11.6a1.6 1.6 0 0 1 2.2 0l4.2 4.1" {...common} />
          <Path d="M14.2 14.4l1.6-1.5a1.6 1.6 0 0 1 2.2 0l2.1 2" {...common} />
          <Circle cx={15.4} cy={9.2} r={1.3} {...common} />
        </>
      );

    case 'plus':
      return (
        <>
          <Path d="M12 5v14" {...common} />
          <Path d="M5 12h14" {...common} />
        </>
      );

    case 'chevronRight':
      return <Path d="M9.5 5.5 16 12l-6.5 6.5" {...common} />;

    case 'chevronLeft':
      return <Path d="M14.5 5.5 8 12l6.5 6.5" {...common} />;

    case 'chevronUp':
      return <Path d="M5.5 14.5 12 8l6.5 6.5" {...common} />;

    case 'chevronDown':
      return <Path d="M5.5 9.5 12 16l6.5-6.5" {...common} />;

    case 'close':
      return (
        <>
          <Path d="M6 6l12 12" {...common} />
          <Path d="M18 6 6 18" {...common} />
        </>
      );

    case 'trash':
      return (
        <>
          <Path d="M4.5 7h15" {...common} />
          <Path d="M9.5 7V5.2A1.7 1.7 0 0 1 11.2 3.5h1.6A1.7 1.7 0 0 1 14.5 5.2V7" {...common} />
          <Path d="M6.5 7l.9 12.1A1.9 1.9 0 0 0 9.3 21h5.4a1.9 1.9 0 0 0 1.9-1.9L17.5 7" {...common} />
          <Path d="M10.5 11v6M13.5 11v6" {...common} />
        </>
      );

    case 'pencil':
      return (
        <>
          <Path d="M4 20h4l11-11a2.1 2.1 0 0 0-3-3L5 17v3Z" {...common} />
          <Path d="M14.5 5.5 18.5 9.5" {...common} />
        </>
      );

    case 'check':
      return <Path d="M5 12.8 9.6 17.4 19 7.4" {...common} />;

    case 'info':
      return (
        <>
          <Circle cx={12} cy={12} r={8.6} {...common} />
          <Path d="M12 11v5.4" {...common} />
          <Circle cx={12} cy={8} r={0.9} fill={stroke} stroke="none" />
        </>
      );

    case 'warning':
      return (
        <>
          <Path
            d="M10.6 4.2 3.4 17.1A1.6 1.6 0 0 0 4.8 19.5h14.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4.2a1.6 1.6 0 0 0-2.8 0Z"
            {...common}
          />
          <Path d="M12 9.4v4.2" {...common} />
          <Circle cx={12} cy={16.3} r={0.9} fill={stroke} stroke="none" />
        </>
      );

    case 'clock':
      return (
        <>
          <Circle cx={12} cy={12} r={8.6} {...common} />
          <Path d="M12 7.4V12l3.4 2" {...common} />
        </>
      );

    case 'sparkle':
      return (
        <>
          <Path
            d="M12 3.5l1.7 4.9 4.8 1.8-4.8 1.8L12 17l-1.7-5-4.8-1.8 4.8-1.8L12 3.5Z"
            {...common}
            fill={fill}
          />
          <Path d="M18.6 16.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z" {...common} />
        </>
      );

    case 'copy':
      return (
        <>
          <Rect x={8.5} y={8.5} width={12} height={12} rx={2.2} {...common} />
          <Path d="M15.5 5.5A2 2 0 0 0 13.5 3.5h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2" {...common} />
        </>
      );

    case 'database':
      return (
        <>
          <Path d="M4.5 6.6c0-1.7 3.4-3.1 7.5-3.1s7.5 1.4 7.5 3.1-3.4 3.1-7.5 3.1-7.5-1.4-7.5-3.1Z" {...common} />
          <Path d="M4.5 6.6v10.8c0 1.7 3.4 3.1 7.5 3.1s7.5-1.4 7.5-3.1V6.6" {...common} />
          <Path d="M4.5 12c0 1.7 3.4 3.1 7.5 3.1s7.5-1.4 7.5-3.1" {...common} />
        </>
      );

    case 'recipes':
      // A pot with a lid and handles: the Recipes tab.
      return (
        <>
          <Path d="M4.2 9.5h15.6v5.1a4.4 4.4 0 0 1-4.4 4.4H8.6a4.4 4.4 0 0 1-4.4-4.4V9.5Z" {...common} fill={fill} />
          <Path d="M3 9.5h18" {...common} />
          <Path d="M3.2 11.6H1.9M20.8 11.6h1.3" {...common} />
          <Path d="M9.4 6.4c0-1 .9-1.6.9-2.6M14.2 6.4c0-1 .9-1.6.9-2.6" {...common} />
        </>
      );

    case 'basket':
      return (
        <>
          <Path d="M3.4 9.3h17.2l-1.5 9.1a2.2 2.2 0 0 1-2.2 1.9H7.1a2.2 2.2 0 0 1-2.2-1.9L3.4 9.3Z" {...common} fill={fill} />
          <Path d="M8.3 9.3 10.6 4M15.7 9.3 13.4 4" {...common} />
          <Path d="M9.8 13v3.4M14.2 13v3.4" {...common} />
        </>
      );

    case 'timer':
      return (
        <>
          <Circle cx={12} cy={13.4} r={7.6} {...common} />
          <Path d="M12 9.4v4l2.6 1.6" {...common} />
          <Path d="M9.4 2.8h5.2" {...common} />
          <Path d="M12 2.8v3" {...common} />
        </>
      );

    case 'flame':
      return (
        <>
          <Path
            d="M12 3.2c3.4 3 5.4 5.4 5.4 8.4a5.4 5.4 0 0 1-10.8 0c0-1.5.6-2.8 1.6-4 .2 1.2.9 2 1.9 2.2-.4-2.4.2-4.6 1.9-6.6Z"
            {...common}
            fill={fill}
          />
          <Path d="M12 20.8a2.6 2.6 0 0 1-2.6-2.6c0-1.1.7-1.9 1.4-2.6.3.6.7 1 1.2 1.1-.2-1.1.1-2.1.9-3 1 .9 1.7 1.9 1.7 3.1A2.6 2.6 0 0 1 12 20.8Z" {...common} stroke="none" fill={fill === 'none' ? stroke : fill} />
        </>
      );

    case 'star':
      return (
        <Path
          d="M12 3.6l2.5 5.3 5.8.8-4.2 4.1 1 5.8-5.1-2.8-5.1 2.8 1-5.8-4.2-4.1 5.8-.8L12 3.6Z"
          {...common}
          fill={fill === 'none' ? 'none' : stroke}
        />
      );

    case 'more':
      return (
        <>
          <Circle cx={5.5} cy={12} r={1.6} fill={stroke} stroke="none" />
          <Circle cx={12} cy={12} r={1.6} fill={stroke} stroke="none" />
          <Circle cx={18.5} cy={12} r={1.6} fill={stroke} stroke="none" />
        </>
      );

    case 'leaf':
      return (
        <>
          <Path
            d="M20 4.2c0 8.1-4.6 12.2-10 12.2a5.6 5.6 0 0 1-2.4-.5C8.9 9.3 13.6 5.3 20 4.2Z"
            {...common}
            fill={fill}
          />
          <Path d="M4.5 20.5c1-4.2 3.2-7.6 6.4-10" {...common} />
        </>
      );

    default:
      return null;
  }
}
