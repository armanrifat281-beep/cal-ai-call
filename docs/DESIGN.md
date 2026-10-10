# Design system

What the rules are, and why. Written so a second person can extend the app
without it drifting.

## The audit that prompted this

The app had been built feature-first and read as generated. Measured across
23 screens:

| | before | after |
| --- | --- | --- |
| Outlined `Card` wrappers | 33 | 0 |
| Tinted callout panels | 29 | 0 |
| Badge pills | 30 | 5 |
| Shouted ALL-CAPS labels | 9 | 0 |
| Shadows / elevation | 1 | 3 |
| Animated components | 1 | 4 |
| Virtualized lists | 0 | 1 |

The single biggest cause: **content was grouped by drawing a box around it**.
That is what you reach for when you do not trust your spacing, and a screen of
identical rounded rectangles has no hierarchy — the eye has nowhere to land.
The second: **the app explained itself constantly**, in two or three stacked
warning panels per screen.

## Rules

### Group with space, not outlines

Default to `Surface variant="plain"`: a fill, no border. Grouping comes from
the vertical rhythm (`theme.blockGap`) and from alignment.

- `raised` — exactly one per screen, for the thing the eye should hit first.
- `grouped` — a native list group. Separators go *between* rows, inset past
  the leading icon, never around the block.
- `sunken` — secondary content inside a surface.

If you are reaching for a fourth variant, the layout is probably wrong.

### One disclosure, not a wall of warnings

The honesty requirements are not negotiable: an estimate must say it is an
estimate, an allergen filter must say it is not a safety check, a demo recipe
must say it is a demo. But a stack of tinted panels gets skipped, so it is
*worse* at the job it exists for.

Use `Disclosure`: one quiet line, always visible, with the full explanation one
tap away. At most one or two per screen. If a screen needs three, the screen is
doing too much.

### Numbers are typography

Every `metric*` style locks digit width (`fontVariant: ['tabular-nums']`). This
app shows changing numbers constantly; with proportional figures a calorie total
shifts sideways as it updates, which reads as cheap. Use `Metric` so the unit is
set a step down from the figure — "412 kcal" should read as one value, not two
words.

Right-align numbers in lists. A column of aligned figures is doing the work an
outline used to do.

### Sentence case

Section headings are `title2`. Form labels are `label`. Neither is uppercase —
rows of SHOUTING MICRO LABELS were a large part of the generated look.

### Press feedback is physical

Use `Button`, `Row` or `PressableScale`. They scale 2.5% over 90ms on the UI
thread, so the response cannot be delayed by JavaScript work. Flipping a
background colour is the cheapest possible feedback and it reads as a web page.

Haptics are on by default for filled buttons, off for list rows.

### Actions have a hierarchy

Every button is a pill — the radius is half the height, so the ends are true
semicircles at every size and the shapes agree across the app.

Only `primary` and `accent` carry the **call-to-action gradient**: a
rose-to-crimson fill running top-left to bottom-right, with bold white text.
That treatment is scarce on purpose. If every button were the call to action
there would be no call to action.

| variant | treatment | use |
| --- | --- | --- |
| `primary` | gradient pill | the one commitment on a screen |
| `accent` | gradient pill | a hero action that is not the main commitment (the camera) |
| `tonal` | brand-tinted fill | a secondary commitment |
| `secondary` | neutral fill | cancel, dismiss, choose another |
| `ghost` | text only | tertiary |
| `danger` | flat, darker red | destructive — deliberately *not* a gradient, so it cannot be mistaken for the thing you are being invited to press |

One CTA per screen. `scripts/` has no linter for this, but
`src/components/ui/__tests__/ButtonAppearance.test.tsx` pins the treatment, and
the placement audit in the commit history shows how to re-check it: static
analysis flags screens with two CTAs, and each flag then needs reading, because
most are mutually exclusive branches rather than real duplicates.

Three stacked full-width buttons means the screen has no primary action.
Destructive and lifecycle actions belong in the navigation bar or an action
sheet.

### Colour is scarce

Two ramps: **clay** (warm neutral — food photography sits badly on cold grey)
and **forest** (the one brand colour). **Ember** is reserved for a single job,
the scan action. Keeping the accent scarce is what makes it mean anything.

Dark mode is not an inversion: surfaces step *up* in lightness, and the brand
green is lifted so it stays legible without glowing.

## The mark

A vesica — the overlap of two circles — tilted, with one vein. It reads as a
lens and as a leaf at once.

The geometry is solved from the proportions, not from the circles:

```
halfWidth  = R - d
halfHeight = sqrt(R² - d²)
```

so `R = (halfWidth² + halfHeight²) / (2·halfWidth)`. Specifying the radius
directly is how the first attempt produced a sliver — a vesica is always taller
than it is wide.

The same numbers drive `src/components/BrandMark.tsx` and
`scripts/generate-icons.mjs`, so the icon cannot drift from the in-app mark.
Regenerate with `node scripts/generate-icons.mjs`; it writes PNGs with zlib
directly and needs no image library.

## Typeface

The platform UI font: San Francisco on iOS, Roboto on Android. Deliberate — it
is what users read everything else in, it ships with the OS so there is no
font-loading flash, and it honours their own text-size setting.

Identity comes from how it is set: the weight ladder, negative tracking on
large sizes (both faces are set loose for small text, so a 33pt headline looks
spindly without it), and tabular figures. A bundled display face is a
reasonable future addition; it is not what was missing.

## Performance

Virtualize a list when it is a *pure* list and its data is genuinely unbounded.
Today that is one screen — saved recipes, capped at 200. The journal is capped
near 20 rows a day and shopping lists near 50, where a mapped render inside a
scroll view costs nothing and a `FlatList` would fight the mixed content above
it.

`RecipeImage` is memoized and caches to memory and disk: it rasterizes an SVG
for its stand-in, and a list of thumbnails would otherwise redo that on every
parent render.

## States

Every screen handles loading, empty and error. Beyond that:

- **Permission denied** gets its own copy and its own way out, not a generic
  failure. See the camera path in `app/(tabs)/scan.tsx`.
- **Offline** is scoped. Most of the app is local-first and keeps working, so a
  blanket banner would be noise. `OfflineNotice` goes on the screens whose
  primary action needs the network, and it names the affected action.
