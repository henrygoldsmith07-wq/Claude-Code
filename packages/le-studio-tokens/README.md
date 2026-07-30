# @le-studio/tokens

Shared CSS custom properties for **Le Studio** (French), **Chrono**, and **Forq**.

## Use

```html
<link rel="stylesheet" href="../../packages/le-studio-tokens/tokens.css" />
```

Or in app CSS:

```css
@import "../../packages/le-studio-tokens/tokens.css";

:root {
  --bg: var(--ls-bg);
  --surface: var(--ls-surface);
  --ink: var(--ls-ink);
}
```

## Rules

- Light is default; monochrome accent (ink on surface)
- Colour is for status and event rails, not chrome
- No emoji in product chrome — stroke icons only
- Honour `prefers-reduced-motion` (duration tokens collapse)

## Versioning

Breaking token renames = major version.
