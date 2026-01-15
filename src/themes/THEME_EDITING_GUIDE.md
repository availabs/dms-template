# Theme Editing Guide

This guide explains how to create and edit custom themes for DMS sites.

## Theme Structure Overview

A theme file is a JSON/JS object that overrides the default theme values. Themes are merged with `defaultTheme` at runtime, so you only need to specify the keys you want to override.

```
src/themes/
├── THEME_EDITING_GUIDE.md  (this file)
├── index.js                (exports all themes)
├── catalyst/
│   └── theme.jsx
├── mny/
│   └── theme.js
└── transportny/
    └── theme.js
```

## Theme File Format

Themes can be either `.js` (JSON object) or `.jsx` (if you need React components in settings).

### Basic Structure

```javascript
{
  // Pattern-level themes (page, forms, admin, etc.)
  "pages": {
    "sectionGroup": { ... },
    "sectionArray": { ... },
    "section": { ... },
    "userMenu": { ... },
    "searchButton": { ... },
    "searchPallet": { ... }
  },

  // UI-level component themes
  "layout": { ... },
  "layoutGroup": { ... },
  "sidenav": { ... },
  "topnav": { ... },
  "logo": { ... },
  "button": { ... },
  "tabs": { ... },
  "menu": { ... },
  "input": { ... },
  "table": { ... },
  // ... etc
}
```

## Modern Theme Format (options/styles)

Components use the modern theme format with `options` and `styles` keys:

```javascript
"sidenav": {
  "options": {
    "activeStyle": 0      // Index of active style variant
  },
  "styles": [
    {
      "name": "my-theme",  // Name shown in admin UI
      "wrapper": "...",    // Tailwind classes
      "item": "...",
      // ... more keys
    },
    {
      "name": "variant-2",
      // ... alternate styling
    }
  ]
}
```

## Key Components to Theme

### 1. Logo (`logo`)

Controls the site logo in the sidebar header.

```javascript
"logo": {
  "logoWrapper": "h-16 flex px-4 py-3 items-center gap-2 bg-[#12181F]",
  "logoAltImg": "hidden",                    // Fallback when no image
  "imgWrapper": "flex-shrink-0",
  "img": "/themes/mytheme/logo.svg",         // Path to logo image
  "imgClass": "h-10 w-auto",
  "titleWrapper": "text-white font-semibold text-lg",
  "title": "My Site",
  "linkPath": "/"
}
```

**Key points:**
- `img` - Path to logo image (relative to public folder)
- `title` - Text displayed next to logo
- `titleWrapper` - Styles applied to title text
- `logoAltImg` - Shown when no `img` is set (use "hidden" to hide)

### 2. SideNav (`sidenav`)

Controls the sidebar navigation.

```javascript
"sidenav": {
  "options": { "activeStyle": 0 },
  "styles": [{
    "name": "dark-sidebar",
    // Container layout
    "layoutContainer1": "lg:ml-64",           // Main content offset
    "layoutContainer2": "fixed inset-y-0 left-0 w-64 max-lg:hidden",
    "sidenavWrapper": "flex flex-col w-64 h-full z-20 bg-[#12181F]",
    "logoWrapper": "w-64 bg-[#12181F]",

    // Navigation items
    "navitemSide": "px-4 py-2.5 text-slate-300 hover:bg-[#1e2530] border-l-[3px] border-transparent",
    "navitemSideActive": "px-4 py-2.5 text-white bg-[#1e2530] border-l-[3px] border-yellow-400",

    // Icons
    "menuIconSide": "size-5 mr-3 text-slate-400",
    "menuIconSideActive": "size-5 mr-3 text-yellow-400",
    "indicatorIcon": "ChevronRight",
    "indicatorIconOpen": "ChevronDown",
    "indicatorIconWrapper": "size-4 text-slate-500",

    // Level-specific styles
    "menuItemWrapper_level_2": "pl-4",
    "menuItemWrapper_level_3": "pl-6",
    "subMenuWrapper_1": "w-full bg-[#0d1117]",

    // Sections
    "sectionDivider": "my-3 border-t border-[#2a3545]",
    "sectionHeading": "px-4 py-2 text-xs font-semibold text-slate-500 uppercase",
    "bottomMenuWrapper": "border-t border-[#2a3545] pt-2"
  }]
}
```

**Key styling patterns:**
- Active state uses `border-l-[3px]` with accent color (e.g., yellow-400)
- Hover states use slightly lighter background
- Level indentation via `menuItemWrapper_level_N` or `subMenuWrapper_N`

### 3. User Menu (`pages.userMenu`)

Controls the user/auth section at the bottom of sidebar.

```javascript
"pages": {
  "userMenu": {
    "options": { "activeStyle": 0 },
    "styles": [{
      "name": "dark-usermenu",
      // Container
      "userMenuContainer": "flex w-full items-center rounded-lg bg-[#1a2029] mx-2 mb-2 p-2",

      // Avatar
      "avatarWrapper": "flex justify-center items-center",
      "avatar": "size-10 border-2 border-[#3a4555] rounded-full bg-[#2a3545]",
      "avatarIcon": "size-6 fill-slate-400",

      // User info
      "infoWrapper": "flex-1 px-2",
      "emailText": "text-xs text-slate-400 truncate",
      "groupText": "text-sm font-medium text-white",

      // Edit controls
      "editControlWrapper": "flex justify-center items-center",
      "iconWrapper": "size-8 flex items-center justify-center rounded-md hover:bg-[#2a3545]",
      "icon": "text-slate-400 hover:text-white size-5",

      // Login button
      "loginWrapper": "flex items-center py-2 px-3 bg-[#3b82f6] hover:bg-[#2563eb] rounded-md",
      "loginLink": "flex items-center gap-2 text-white text-sm font-medium",
      "loginIcon": "size-4 fill-white"
    }]
  }
}
```

### 4. Search Button (`pages.searchButton`)

Controls the search trigger button in the sidebar.

```javascript
"pages": {
  "searchButton": {
    "options": { "activeStyle": 0 },
    "styles": [{
      "name": "dark-search",
      "button": "flex justify-between items-center w-full h-10 py-2 px-3 bg-[#1a2029] hover:bg-[#252d3a] border border-[#3a4555] rounded-lg",
      "buttonText": "text-slate-400 font-normal text-sm",
      "iconWrapper": "bg-[#3b82f6] p-1.5 rounded-md",
      "icon": "Search",
      "iconClass": "text-white",
      "iconSize": 14
    }]
  }
}
```

### 5. Search Pallet (`pages.searchPallet`)

Controls the search modal/dialog.

```javascript
"pages": {
  "searchPallet": {
    "options": { "activeStyle": 0 },
    "styles": [{
      "name": "dark-pallet",
      // Dialog
      "backdrop": "fixed inset-0 bg-black bg-opacity-60",
      "dialogPanel": "... rounded-xl bg-[#1a2029] border border-[#3a4555]",

      // Input
      "inputWrapper": "... bg-[#12181F] rounded-lg border border-[#3a4555]",
      "input": "... text-white bg-transparent placeholder:text-slate-500",

      // Results
      "resultsWrapper": "bg-[#12181F] rounded-xl ...",
      "pageTitle": "... text-slate-200",
      "sectionTitle": "... text-slate-300",

      // Tags
      "tag": "... rounded-md border",
      "tagMatch": "border-yellow-500 bg-yellow-600",
      "tagNoMatch": "border-[#3a4555] bg-[#2a3545]"
    }]
  }
}
```

## Color Palette Guidelines

When creating a dark theme, use a consistent color palette:

```
Background layers (darkest to lightest):
- #0d1117  - Deepest background (submenu)
- #12181F  - Primary background (sidebar)
- #1a2029  - Secondary background (cards, containers)
- #1e2530  - Hover states
- #252d3a  - Active hover
- #2a3545  - Elevated elements

Border colors:
- #3a4555  - Standard borders
- #2a3545  - Subtle borders

Text colors:
- white     - Primary text, headings
- slate-200 - Secondary text
- slate-300 - Body text
- slate-400 - Muted text, placeholders
- slate-500 - Disabled, hints

Accent colors:
- yellow-400  - Active indicators, highlights
- blue-500    - Interactive elements, buttons
- blue-600    - Hover states
```

## Adding Theme Assets

Place theme assets in the public folder:

```
public/themes/mytheme/
├── logo.svg
├── logo-white.svg
├── background.png
└── references/
    ├── design.png
    └── current.png
```

Reference in theme: `"/themes/mytheme/logo.svg"`

## Testing Your Theme

1. Update the site to use your theme in `src/App.jsx`
2. Run `npm run dev` to see changes live
3. Compare against reference images
4. Check both expanded and collapsed states
5. Test with different user states (logged in/out, admin/view mode)

## Multiple Style Variants

Components can have multiple style variants in the `styles` array. Use `activeStyle` to select which one to use.

### Example: Full vs Compact Sidebar

```javascript
"sidenav": {
  "options": {
    "activeStyle": 0   // 0 = full, 1 = compact
  },
  "styles": [
    {
      "name": "transportny-dark",      // Full sidebar (w-64)
      "layoutContainer1": "lg:ml-64",
      "layoutContainer2": "fixed inset-y-0 left-0 w-64 max-lg:hidden",
      "sidenavWrapper": "flex flex-col w-64 h-full ...",
      "navitemSide": "... px-4 py-2.5 ...",
      // Text labels visible
    },
    {
      "name": "compact",               // Compact sidebar (w-16, icons only)
      "layoutContainer1": "lg:ml-16",
      "layoutContainer2": "fixed inset-y-0 left-0 w-16 max-lg:hidden",
      "sidenavWrapper": "flex flex-col w-16 h-full items-center ...",
      "navitemSide": "... justify-center py-3 ...",
      "navItemName": "hidden",         // Hide text labels
      "indicatorIcon": "hidden",       // Hide expand arrows
      "subMenuWrapper_1": "hidden",    // Hide submenus
    }
  ]
}
```

## Container Query Responsive Styles (Preferred)

Instead of maintaining multiple style variants, use **Tailwind container queries** to make components automatically adapt to their container width. This is cleaner and requires less coordination.

### How Container Queries Work

1. Mark a container with `@container`
2. Use `@[size]:` prefix to apply styles when container >= size
3. Default styles apply when container is smaller

```javascript
// Single responsive style using container queries
"userMenu": {
  "styles": [{
    "name": "responsive",
    // @container marks this as a query container
    // Default = compact (< 120px), @[120px]: = full (>= 120px)
    "userMenuContainer": "@container flex flex-col @[120px]:flex-row ...",
    "infoWrapper": "hidden @[120px]:flex ...",        // Hidden in compact, visible in full
    "loginWrapper": "rounded-full @[120px]:rounded-md ...",  // Circle in compact, pill in full
  }]
}
```

### Container Query Breakpoints

| Syntax | Container Width |
|--------|-----------------|
| `@[64px]:` | >= 64px (compact sidebar w-16) |
| `@[100px]:` | >= 100px |
| `@[120px]:` | >= 120px |
| `@[200px]:` | >= 200px |
| `@[256px]:` | >= 256px (full sidebar w-64) |

### Example: Responsive Search Button

```javascript
"searchButton": {
  "styles": [{
    "name": "responsive",
    // Compact: circular icon-only button
    // Full: pill-shaped with text
    "button": "@container flex items-center justify-center @[100px]:justify-between w-10 @[100px]:w-full h-10 rounded-full @[100px]:rounded-lg ...",
    "buttonText": "hidden @[100px]:inline ...",  // Text hidden in compact
    "iconWrapper": "p-0 @[100px]:p-1.5 @[100px]:bg-blue-500 @[100px]:rounded-md",
  }]
}
```

### Example: Responsive User Menu

```javascript
"userMenu": {
  "styles": [{
    "name": "responsive",
    // Compact: vertical, avatar only
    // Full: horizontal with name/email
    "userMenuContainer": "@container flex flex-col @[120px]:flex-row w-full items-center ...",
    "infoWrapper": "hidden @[120px]:flex flex-1 px-2",  // Name/email hidden in compact
    "authWrapper": "flex flex-col @[120px]:flex-row items-center gap-2",
    "loginWrapper": "rounded-full @[120px]:rounded-md ...",  // Shape changes
  }]
}
```

### Benefits of Container Queries

- **Single style to maintain** - No need to keep multiple variants in sync
- **Automatic adaptation** - Components respond to actual container size
- **More portable** - Same component works in different contexts
- **Less configuration** - No need to coordinate `activeStyle` across components

## Common Patterns

### Transparent Borders for Active States

```javascript
// Inactive: transparent border takes space but isn't visible
"navitem": "border-l-[3px] border-transparent ..."

// Active: colored border shows
"navitemActive": "border-l-[3px] border-yellow-400 ..."
```

### Font Families

```javascript
// Using custom fonts (ensure they're loaded in CSS)
"navitem": "font-['Proxima_Nova'] font-[400] text-[15px] ..."
"title": "font-['Oswald'] font-semibold text-lg uppercase ..."
```

### Container Queries

```javascript
// Responsive based on container size
"userMenuContainer": "... @container",
"infoWrapper": "flex-1 px-2 @max-[150px]:hidden",  // Hide when container < 150px
```

### Scrollbar Styling

```javascript
"itemsWrapper": "flex-1 overflow-y-auto scrollbar-sm"
```

## Debugging Tips

1. **Theme not applying**: Check that the key path matches exactly (e.g., `pages.userMenu` vs `userMenu`)
2. **Styles flashing**: Ensure fallback themes are imported in components
3. **Missing colors**: Verify Tailwind has the colors in its config or use arbitrary values `bg-[#hex]`
4. **Font not loading**: Check font is imported in CSS and font-family syntax is correct
5. **Flyout menus not appearing**: When using hover-based flyout submenus (with `subMenuActivate: "onHover"` and absolute positioning), ensure `layoutContainer2` has a sufficient z-index (e.g., `z-20`). Without this, the absolutely positioned flyout may render behind other page content even though it's technically visible in the DOM.

## Reference

- See `src/dms/src/ui/THEMING_GUIDE.md` for component theming details
- See `src/dms/src/ui/UI_PROGRESS.md` for component completion status
- Check existing themes in `src/themes/` for examples
