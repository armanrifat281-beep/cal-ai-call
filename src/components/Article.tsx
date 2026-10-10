import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface ArticleSection {
  heading?: string;
  /** Paragraphs, in order. */
  body?: string[];
  /** A list, rendered with a hanging marker rather than a bullet glyph. */
  points?: string[];
}

export interface ArticleProps {
  sections: readonly ArticleSection[];
  /** Shown above everything, in a quieter tone. For dates and caveats. */
  note?: string;
}

/**
 * A page of prose.
 *
 * Shared by the privacy, terms and help screens so they read as one
 * document set rather than three people's idea of a text page. Measure,
 * rhythm and heading weight are set once here; the screens supply only
 * words.
 */
export function Article({ sections, note }: ArticleProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {note ? (
        <Text variant="footnote" color="textMuted">
          {note}
        </Text>
      ) : null}

      {sections.map((section, index) => (
        <View key={section.heading ?? index} style={{ gap: theme.spacing.sm }}>
          {section.heading ? (
            <Text variant="title2">{section.heading}</Text>
          ) : null}

          {section.body?.map((paragraph) => (
            <Text key={paragraph.slice(0, 40)} variant="body" color="textMuted">
              {paragraph}
            </Text>
          ))}

          {section.points ? (
            <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.xxs }}>
              {section.points.map((point) => (
                <View
                  key={point.slice(0, 40)}
                  style={{ flexDirection: 'row', gap: theme.spacing.md }}
                >
                  {/* A short rule rather than a bullet: it lines up with the
                      first line of text at any size and does not read as an
                      emoji at large type settings. */}
                  <View
                    style={{
                      width: 10,
                      height: theme.hairline * 2,
                      marginTop: 11,
                      backgroundColor: theme.colors.border,
                    }}
                  />
                  <Text variant="body" color="textMuted" style={{ flex: 1 }}>
                    {point}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
