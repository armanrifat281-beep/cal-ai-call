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

### One button, everywhere

Every button in the app is the same shape and the same colour: a fully
rounded pill — the radius is half the height — filled with the
rose-to-crimson gradient running top-left to bottom-right, with bold white
text and white icons. There are no exceptions, and the `variant` prop no
longer changes anything visual.

This is a deliberate reversal, and it is worth knowing why so nobody
"fixes" it back. An earlier version gave the gradient only to `primary` and
`accent` on the standard argument that a call to action means nothing if
everything looks like one. The brief that replaced it was explicit: every
button is to match the reference, with none left out. Consistency won over
scarcity.

Because colour no longer carries emphasis, three other things do:

- **Size.** The primary action on a screen is `lg`; alternatives are `md`
  or `sm`.
- **Width.** The primary action is `fullWidth`; alternatives are not, or
  are narrower.
- **Order.** The primary action comes first in a footer, with alternatives
  under it.

`variant` is still accepted and still worth setting, because it says what
an action is *for* to the next person reading the code. It simply has no
effect on rendering.

**The cost, named plainly:** a destructive button now looks exactly like a
confirming one. What guards destructive actions is that every one of them
is behind a separate confirmation dialog — not the colour of the button.
If that ever stops being true, this rule needs revisiting.

Buttons are tall on purpose: roughly three and a half times the height of
their own text, which is the proportion in the reference and what makes
them read as soft, confident shapes rather than tags. The smallest size is
44 points, so even an inline button clears the minimum touch target.

The button paints its own contents. A `leading` or `trailing` icon is
cloned with the button's foreground colour, so a call site cannot leave a
dark icon on the gradient — which is exactly what happened to a dozen of
them when the treatment changed.

`src/components/ui/__tests__/ButtonAppearance.test.tsx` pins all of this:
the gradient on every variant, the pill geometry, the height-to-text ratio,
the touch target and the icon tinting.

Three stacked full-width buttons still means the screen has no primary
action. Destructive and lifecycle actions still belong in the navigation
bar or an action sheet.

### One accent, and a separate colour for data

**Crimson** is the interface accent. The buttons wear it, and so does
anything selected, active or in progress: a chosen chip, a picked goal
card, the onboarding progress bar, the ring that says which day you are
looking at. A selected control and the button you press next are the same
idea, so they are the same colour. The launcher icon is the darkest step
of the same red.

**Forest** is no longer the interface accent. It is a data colour now —
`chart` for a bar or a ring, `protein` on a macro breakdown — and that
separation is deliberate rather than tidy-minded. The accent means "you can
press this"; a chart is neither pressable nor selected. More concretely,
`warning` marks going over a target, and a chart drawn in the same red as
a warning says the ordinary case is a problem.

**Clay** remains the warm neutral: paper, not grey, because food
photography sits badly on cold grey. **Ember** is reserved for the scan
action.

Dark mode is not an inversion: surfaces step *up* in lightness, and the
accent is lifted so it stays legible without glowing.

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

## The second round: what was still generic

The first round removed what was wrong. The app still read as generated,
and the reason was what it did not have rather than what it did:

**There was no data visualisation anywhere.** The only SVG in the app was
the icon set and the brand mark. A nutrition app whose entire output is
rows of numbers looks like a form, however well set.

**It never showed any food.** The scanner validated and compressed a
photograph of the user's meal and then discarded it — `/entry/new` was
opened with no photo parameter, nothing read `photoPath`, and no screen
displayed a meal photograph. The one source of authentic food imagery the
app could honestly have was being thrown away at the last step.

**The macro colours were off-brand and barely distinguishable.** Blue,
mustard and purple, chosen as three arbitrary hues, against a warm clay
palette built from forest and ember. Protein and fat differed by 1.02:1 in
luminance, so a macro chart disappeared completely in greyscale.

**Nothing was ever rewarded.** Cooking ended by closing the screen.

### What answers it

**The day plate.** One dial that answers three questions at once: how far
through the day you are (the ring's travel against the target), how the day
broke into meals (the gaps), and what those meals were made of (the macro
bands inside each arc). It replaced four stacked widgets on Home. Past the
target the dial rescales to the day and marks where the target fell, rather
than capping and hiding the overshoot.

**The week strip.** Seven small rings as the journal's day navigation, so
the shape of the week is visible before you tap anything. Energy only — the
full dial's twelve bands are noise inside thirty points.

**The period chart** on Insights, where a day with nothing logged draws a
baseline mark rather than a bar of zero height. Those look identical and
mean opposite things.

**Two kinds of real photograph**, both the user's own: the meal photo from
the scanner, now carried into the journal, and a photo of a dish taken
after cooking it, which then replaces the stand-in on that recipe
everywhere it appears. The app does not invent a picture of a dish nobody
cooked, so these are the only food photographs it has, and they are better
than a provider's would be.

### Rules this round added

#### A chart must not be able to lie

Every chart here had at least one way to mislead, and each was closed
deliberately:

- A day with nothing logged is not a day of no energy. It never draws as
  zero; it draws as absence.
- An average covers only the days with data, and the label says so.
- A scale covers the target as well as the largest value, so an overshoot
  is never clipped flat into looking like a hit.
- A minimum bar size must never make a small day look larger. The floor is
  rescaled away when it would exceed what the day earned.
- A meal with no macro data draws one neutral arc, never a guessed split.

#### Colours are chosen for separation, not for looks

Macro colours are drawn from the forest and ember ramps so a chart still
looks like this app, and they are separated by lightness as well as hue so
they survive greyscale and the common colour-blindness types. The closest
pair is 1.6:1 in light and 1.7:1 in dark, against 1.02:1 before. Each also
clears roughly 2.7:1 against the empty track behind a chart, so a filled
arc can be told from an unfilled one.

They are fills only — bars, arcs, legend dots — never text, which is what
makes a ratio below 4.5:1 acceptable.

#### Motion asks first

Reanimated's layout animations follow the system's reduce-motion setting on
their own. Imperative animations do not, and must call `useMotion()`:
before this the press scale and the indefinitely pulsing skeleton ignored
the setting entirely. Reducing motion means going to the end state
immediately, never skipping it — a skipped animation leaves a view faded
out or scaled to nothing.

#### Verify a visual by looking at it

Tests prove arithmetic, not appearance. Every chart here was rendered to
SVG from the same functions the app uses and inspected in a browser, in
both schemes, across every state. That turned up four defects the tests had
passed:

- the gaps between meals could consume the whole arc on a barely-started
  day, leaving a dial that looked broken;
- the over-target mark was indistinguishable from an ordinary gap;
- the first macro palette was muddy and dated at a glance, whatever its
  contrast figures said;
- with the photo above the time in a meal row, the time column zigzagged
  down a list of mixed photographed and typed meals.

None of these were findable from a passing test suite.
