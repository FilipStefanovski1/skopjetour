---
name: Skopje Statues
description: Skopje's statues as an orienteering event, printed in course purple over a sprint-orienteering map of the city.
colors:
  course-purple: "#7b2cbf"
  course-purple-deep: "#5f1f97"
  course-purple-wash: "#f3eafb"
  contour-brown: "#8a5728"
  paper: "#ffffff"
  ink: "#1d1b19"
  ink-soft: "#514a44"
  rule: "#ddd5cc"
  rule-strong: "#b9aea2"
  map-paved: "#efdcbf"
  map-paved-edge: "#c7a57d"
  map-open: "#ffdf6e"
  map-wood: "#c3d38f"
  map-water: "#a3cfec"
  map-water-edge: "#3b87c0"
  map-building: "#a6a39f"
  map-building-edge: "#5f5b57"
  map-path: "#3a2c20"
  map-label: "#6b4a2b"
typography:
  display:
    fontFamily: "'Fira Sans Extra Condensed', 'Arial Narrow', sans-serif"
    fontSize: "2.1rem"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "normal"
  headline:
    fontFamily: "'Fira Sans Extra Condensed', 'Arial Narrow', sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.005em"
  numeral:
    fontFamily: "'Fira Sans Extra Condensed', 'Arial Narrow', sans-serif"
    fontSize: "1.85rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "'Fira Sans Extra Condensed', 'Arial Narrow', sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    letterSpacing: "0.03em"
  body:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  story:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "1.06rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Fira Sans', system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.1em"
rounded:
  hairline: "2px"
  sm: "4px"
  md: "6px"
  sheet: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  tap: "44px"
components:
  button-primary:
    backgroundColor: "{colors.course-purple}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.course-purple-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.course-purple}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "{spacing.tap}"
  button-secondary-hover:
    backgroundColor: "{colors.course-purple-wash}"
  button-text:
    textColor: "{colors.course-purple-deep}"
    height: "{spacing.tap}"
  course-tab:
    textColor: "{colors.ink-soft}"
    typography: "{typography.title}"
    padding: "8px 8px 6px"
    height: "{spacing.tap}"
  course-tab-active:
    textColor: "{colors.course-purple}"
  lang-switch-active:
    backgroundColor: "{colors.course-purple}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    height: "34px"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "{spacing.tap}"
  control-row:
    textColor: "{colors.ink}"
    padding: "8px 4px"
    height: "56px"
  control-row-hover:
    backgroundColor: "{colors.course-purple-wash}"
  map-tools:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "{spacing.tap}"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sheet}"
---

# Design System: Skopje Statues

## Overview

**Creative North Star: "The Orienteering Map and Legend"**

The city is the map and the statues are the event. Skopje is redrawn in sprint-orienteering inks (after ISSprOM): white runnable ground, light-brown paving, yellow open land, olive woods, blue Vardar, grey buildings. Over it, every themed route is printed as a course in one ink, course purple: a start triangle, numbered control circles joined by straight legs, a finish double circle. The interface around the map is the course's legend: a control-description sheet, ruled in hairlines, where each statue is a numbered row.

The system is flat, white and printed. Depth comes from rules and ink weight, not from layered surfaces; the only shadows sit under the things that physically float over the map (the sheet, the side panel, the map tools). Type is two cuts of one family: an extra-condensed caps face for anything a runner reads at a glance (names, numerals, course titles, actions) and a regular sans for reading. Both carry standard Cyrillic forms, because Macedonian is a first-class language beside English.

The visual stance rejects the default map app: blue pins, grey chrome, rounded filter chips.

**Key Characteristics:**
- One ink for the course: purple marks routes, controls, the selected statue and the primary action, and nothing else.
- Basemap inks follow sprint-orienteering conventions and never use purple.
- Extra-condensed caps for headings, numerals and buttons; regular sans for reading text.
- Hairline-ruled description rows; heavy 2px rules close tables and underline the masthead.
- Small, square-leaning corners (4px), flat white paper, 44px minimum tap targets.
- Control symbols are geometric strokes (triangle, circle, double circle), filled solid when punched.

## Colors

A printed-map palette: white paper, near-black ink, warm greys for rules, one saturated overprint purple, and contour brown as the quiet second voice.

### Primary
- **Course Purple** (`course-purple`): the overprint. Course legs, control circles and their numbers, the start triangle, the finish double circle, the selected-statue ring, the wordmark, active course tab, active language, the masthead and sheet top rules, focus outlines, caret and form accent, and the primary NEXT action.
- **Deep Course Purple** (`course-purple-deep`): pressed or hovered primary, inline links and text buttons, where purple must hold contrast as small text.
- **Purple Wash** (`course-purple-wash`): the faintest tint, for hover and toggled-on backgrounds of rows, tools and the secondary button.

### Secondary
- **Contour Brown** (`contour-brown`): secondary labelling. Description-table headers, course statistic labels, leg distances in rows, course counts in the tabs, section subheads, and statue-cluster markers on the map (two stacked brown rings with a ×N count). It names and counts; it never marks a control.

### Neutral
- **Paper** (`paper`): every surface. The map ground, masthead, sheet, panel and buttons all sit on the same white.
- **Ink** (`ink`): headings, statue names, body text, the map-tool border and the heavy table rules.
- **Soft Ink** (`ink-soft`): secondary prose, sub-lines, inactive tabs, captions, empty and loading states.
- **Rule** (`rule`): 1px hairlines between description rows, control rows, stat columns and tool buttons.
- **Strong Rule** (`rule-strong`): input borders, the sheet drag handle, scrollbars.

### Basemap inks
Defined in `src/map/style.ts` and used only by the map: paved (`map-paved`, edged `map-paved-edge`), open land (`map-open`), wood (`map-wood`), water (`map-water`, edged `map-water-edge`), buildings (`map-building`, edged `map-building-edge`), footpaths as dashed dark brown (`map-path`), street and quarter labels (`map-label`).

### Named Rules
**The Overprint Rule.** Course purple is reserved for courses, controls, the selected statue and the primary action. If a purple thing on screen is not part of the course or the one thing to do next, it is wrong.

**The Clean Basemap Rule.** The basemap never uses purple. A map layer that needs emphasis gets a basemap ink or brown, so the course always reads on top.

**The Cluster Is Not a Control Rule.** A group of statues is drawn in contour brown (stacked rings, ×N). Only a single statue or a course control is drawn in purple.

## Typography

**Display Font:** Fira Sans Extra Condensed 600/700/800 (with Arial Narrow, sans-serif)
**Body Font:** Fira Sans 400/500/600 (with system-ui, sans-serif)
**Map Label Font:** Noto Sans Regular / Bold / Italic, served by the OpenFreeMap glyph server (the only faces it provides)

**Character:** One family in two widths: the condensed caps read like the print on a control-description sheet and fit long Macedonian names on a phone; the regular cut carries the stories. Both are self-hosted via @fontsource and were chosen for standard Cyrillic letterforms; Sofia Sans was tried and dropped because its lowercase rendered Bulgarian-style forms that read wrong in Macedonian.

### Hierarchy
- **Display** (800, 2.1rem, 0.98, uppercase): the statue name on its card; 1.8rem below 380px wide.
- **Headline** (800, 2rem, 1, uppercase, purple): the course title in the description sheet.
- **Wordmark** (800, clamp(1.15rem, 5.3vw, 1.75rem), uppercase, purple).
- **Numeral** (700, 1.85rem, tabular): course statistics (controls, km, minutes). Control numbers on the map are 800 at 1.45rem (1.05rem in dense clusters) in purple with a white halo.
- **Title** (700, 1.05-1.2rem, 0.03-0.05em, uppercase): course tabs, buttons, language switch, section subheads (brown).
- **Body** (400, 1rem, 1.45): rows, table values (0.95rem), UI prose. Row names are 600.
- **Story** (400, 1.06rem, 1.6, max 65ch): the Wikipedia or written biography.
- **Label** (600, 0.72rem, 0.1em, uppercase, brown): description-table headers and statistic labels, always paired with the value they name.

### Named Rules
**The Two Widths Rule.** Condensed caps for anything glanced at (names, numbers, actions); regular sans for anything read. Never set a story paragraph in the condensed face.

**The Tabular Numbers Rule.** Every numeral that counts or measures (control numbers, distances, counts, stats) uses tabular figures in the condensed face.

**The Standard Cyrillic Rule.** Any new face must render standard (Russian/Macedonian) Cyrillic lowercase forms, not Bulgarian alternates, and cover both Macedonian and English.

## Layout

The map fills the viewport. On phones a white masthead sits over the top (wordmark and MK/EN switch, then a horizontally scrolling strip of course tabs) closed by a 2px purple rule; a bottom sheet peeks over the map and drags or taps up to half or full height, with the map's scale bar and attribution riding just above it. At 900px and wider the sheet becomes a fixed left column (380-440px) beside the map, closed by a 2px purple right rule, and the course tabs fall into a two-column grid.

Spacing runs on a 4px step: 4, 8, 12, 16, 24. Sheet content pads 16px on phones and 24px on the wide panel. Every interactive target is at least 44px; control rows are at least 56px. Primary and secondary actions dock in a sticky footer at the bottom of the statue card, primary first. Safe-area insets are respected top and bottom.

## Elevation & Depth

Flat by default: everything is white paper and depth is carried by ink rules (2px purple or ink, 1px warm hairlines). Shadows appear only on surfaces that float over the live map, as soft, low-opacity ink-tinted blurs.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 -6px 24px rgba(29, 27, 25, 0.16)`): the phone bottom sheet over the map.
- **Panel edge** (`box-shadow: 6px 0 22px rgba(29, 27, 25, 0.1)`): the wide-screen description column.
- **Tool float** (`box-shadow: 0 4px 14px rgba(29, 27, 25, 0.16)`): the map-tools stack.

Map control numbers carry a white text halo (as on a printed course), not a shadow.

### Named Rules
**The Ruled Not Raised Rule.** Inside the sheet nothing has a shadow; rows, tables and sections are separated by rules only.

## Shapes

Square-leaning and printed. Buttons, inputs, the language switch, photos and toasts use a 4px corner; the map-tools stack 6px; only the phone sheet's top corners round to 10px. Borders are drawn, not implied: 1.5-2px purple or ink strokes on interactive frames, 1px hairlines between rows. The control symbols are pure stroke geometry with miter joins: an equilateral start triangle, a control circle, a finish double circle; a punched control fills solid purple, and a plain (off-course) statue shows a small circle with a white tick when seen. The wordmark repeats the triangle-and-circle pair.

## Components

### Buttons
- **Shape:** gently squared (4px), 2px purple border.
- **Primary:** purple fill, white condensed caps (700, 1.2rem, 0.04em), 52px tall, label left with the next control's name as a small regular-sans sub-line and an arrow at the right. Hover deepens to deep purple. Active nudges down 1px.
- **Secondary:** white with purple border and purple caps, 44px in the card footer; hover and toggled-on (seen) fill with purple wash.
- **Text button:** deep-purple 600 sans with a leading arrow icon, no frame, 44px tall (back to list, previous control).

### Course Tabs
Condensed caps (700, 1.15rem) in soft ink with a brown tabular count; hover turns purple; the active course is purple with a 3px purple underline. Not chips: no fill, no pill.

### Language Switch
Two segments (MK / EN) in a 1.5px purple frame with a purple divider; the active language fills purple with white text.

### Inputs / Fields
- **Style:** 44px search field, 1.5px strong-rule border, 4px corner, leading icon, clear button with wash hover.
- **Focus:** border turns purple plus a 1px purple ring. Global focus-visible is a 2.5px purple outline offset 2px.

### Control Description Rows
The course list: a 34px course symbol (triangle, numbered circle, or plain circle), the statue name (600) with a soft-ink sub-line, and the leg distance in brown condensed tabular figures at right. Rows are divided by 1px hairlines and wash purple on hover.

### Statue Card
Control symbol, display-caps name and purple leg distance in a three-column head; a 4:3 photo in a 1.5px ink frame with a small caption; a description table bounded top and bottom by 2px ink rules with 1px hairlines between rows, brown caps labels in the left 38%; the story at 65ch; a sticky action footer.

### Map Tools
A vertical stack of 44px icon buttons (zoom in, zoom out, locate, fit) in a 1.5px ink frame, 6px corner, hairline-divided, tool-float shadow; hover washes purple. Icons are stroked line icons at 2.25 weight.

### Course on the Map
Purple straight legs (1.6-3px by zoom), a start triangle rotated to the first leg, control circles (seen ones filled), a finish double circle, a purple selection ring with a 12% purple fill. Control numbers are HTML markers in the condensed UI face, placed beside their circles by a collision routine so they never overlap each other or a circle. Statues not on the active course are small translucent purple-stroked circles; clusters are brown stacked rings with ×N in Noto Sans Bold.

## Do's and Don'ts

### Do:
- **Do** keep course purple for courses, controls, the selected statue and the one primary action (The Overprint Rule).
- **Do** draw statue clusters in contour brown, never purple.
- **Do** set names, numerals and actions in Fira Sans Extra Condensed caps and reading text in Fira Sans; use tabular figures for every number.
- **Do** separate content with 1px hairlines and close tables with 2px ink rules.
- **Do** keep every tap target at 44px or more and corners at 4px.
- **Do** ship every string in both Macedonian and English, and check new faces for standard Macedonian Cyrillic forms.

### Don't:
- **Don't** use blue pins, grey map chrome, or rounded filter chips; this is not the default map app.
- **Don't** put purple anywhere in the basemap style.
- **Don't** add shadows inside the sheet or panel; only surfaces floating over the map carry one.
- **Don't** set story paragraphs in the condensed face or in caps.
- **Don't** use Sofia Sans or any face that renders Bulgarian-style Cyrillic lowercase.
