# LazaiTrader Brand Guidelines

> The definitive guide to LazaiTrader's visual identity, design principles, and brand expression.

---

## Table of Contents

1. [Brand Overview](#brand-overview)
2. [Logo Usage](#logo-usage)
3. [Color Palette](#color-palette)
4. [Typography](#typography)
5. [Gradients & Effects](#gradients--effects)
6. [UI Components](#ui-components)
7. [Iconography](#iconography)
8. [Spacing & Layout](#spacing--layout)
9. [Animation & Motion](#animation--motion)
10. [Voice & Tone](#voice--tone)
11. [Do's and Don'ts](#dos-and-donts)

---

## Brand Overview

### Mission

LazaiTrader empowers traders with AI-driven intelligence, making sophisticated trading strategies accessible to everyone. We bridge the gap between complex market analysis and actionable insights through seamless Telegram integration.

### Brand Personality

| Trait | Expression |
|-------|------------|
| **Innovative** | Cutting-edge AI technology, modern design |
| **Trustworthy** | Clean interfaces, professional aesthetics |
| **Accessible** | Simple interactions, clear communication |
| **Dynamic** | Energetic accents, smooth animations |
| **Sophisticated** | Dark themes, refined typography |

### Brand Values

- **Precision** — Every pixel, every trade, every decision matters
- **Transparency** — Clear communication, honest design
- **Innovation** — Constantly pushing boundaries in AI trading
- **Community** — Building together with our users

---

## Logo Usage

### Primary Logo

The LazaiTrader logo represents the fusion of artificial intelligence and trading excellence. It should be used consistently across all brand touchpoints.

```
Primary Logo: lazaitrader.png
Dimensions: Minimum 48x48px for digital
Clear Space: Maintain padding equal to the logo height on all sides
```

### Logo Placement

| Context | Size | Notes |
|---------|------|-------|
| Navigation | 48x48px | Accompanied by brand name |
| Favicon | 32x32px | Simplified mark only |
| Social Media | 200x200px | Centered with padding |
| Print | Minimum 1 inch | Vector format required |

### Logo Variations

- **Full Color** — Primary usage on dark backgrounds
- **Monochrome White** — For solid colored backgrounds
- **Monochrome Dark** — For light backgrounds (rare usage)

### Clear Space Requirements

Always maintain a minimum clear space around the logo equal to the height of the logo icon. This ensures the logo remains visually impactful and uncluttered.

---

## Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Midnight Navy** | `#00040f` | rgb(0, 4, 15) | Primary background |
| **Electric Cyan** | `#00f6ff` | rgb(0, 246, 255) | Primary accent, CTAs |
| **Pure White** | `#ffffff` | rgb(255, 255, 255) | Primary text |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Deep Charcoal** | `#11101d` | rgb(17, 16, 29) | Card backgrounds |
| **Shadow Navy** | `#14101d` | rgb(20, 16, 29) | Overlays |
| **Ocean Teal** | `#33bbcf` | rgb(51, 187, 207) | Gradient endpoints |
| **Ice Cyan** | `#def9fa` | rgb(222, 249, 250) | Gradient highlights |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#10b981` | Positive actions, profit indicators |
| **Warning** | `#f59e0b` | Alerts, caution states |
| **Error** | `#ef4444` | Error states, loss indicators |
| **Info** | `#3b82f6` | Informational elements |

### Text Colors

| Name | Value | Usage |
|------|-------|-------|
| **Primary Text** | `#ffffff` | Headings, important content |
| **Secondary Text** | `rgba(255, 255, 255, 0.7)` | Body text, descriptions |
| **Muted Text** | `#9ca3af` (gray-400) | Captions, hints |
| **Disabled Text** | `#4b5563` (gray-600) | Inactive elements |

### Color Accessibility

All color combinations must meet WCAG 2.1 AA standards:
- Primary text on dark background: **15.8:1** contrast ratio
- Accent cyan on dark background: **13.2:1** contrast ratio
- Secondary text on dark background: **8.5:1** contrast ratio

---

## Typography

### Font Family

**Poppins** is our primary typeface, chosen for its modern geometric design and excellent readability across all screen sizes.

```css
font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Font Weights

| Weight | Name | Usage |
|--------|------|-------|
| 400 | Regular | Body text, descriptions |
| 500 | Medium | Buttons, labels |
| 600 | SemiBold | Subheadings, emphasis |
| 700 | Bold | Section headers |
| 800 | ExtraBold | Hero text, large displays |
| 900 | Black | Maximum impact headlines |

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Line Height | Weight |
|---------|---------------|---------------|-------------|--------|
| Display | 72px | 48px | 1.1 | 800 |
| Heading 1 | 48px | 40px | 1.2 | 700 |
| Heading 2 | 36px | 32px | 1.3 | 600 |
| Heading 3 | 24px | 20px | 1.4 | 600 |
| Body Large | 18px | 16px | 1.7 | 400 |
| Body | 16px | 14px | 1.6 | 400 |
| Caption | 14px | 12px | 1.5 | 400 |
| Small | 12px | 10px | 1.4 | 500 |

### Text Styles

```css
/* Heading 2 */
.heading-2 {
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 48px;
  line-height: 76.8px;
  color: #ffffff;
}

/* Body Paragraph */
.paragraph {
  font-family: 'Poppins', sans-serif;
  font-weight: 400;
  font-size: 18px;
  line-height: 30.8px;
  color: rgba(255, 255, 255, 0.7);
}
```

---

## Gradients & Effects

### Primary Gradients

#### Blue Gradient (Primary CTA)
```css
.bg-blue-gradient {
  background: linear-gradient(
    157.81deg,
    #def9fa -43.27%,
    #bef3f5 -21.24%,
    #9dedf0 12.19%,
    #7de7eb 29.82%,
    #5ce1e6 51.94%,
    #33bbcf 90.29%
  );
}
```

#### Text Gradient
```css
.text-gradient {
  background: radial-gradient(
    64.18% 64.18% at 71.16% 35.69%,
    #def9fa 0.89%,
    #bef3f5 17.23%,
    #9dedf0 42.04%,
    #7de7eb 55.12%,
    #5ce1e6 71.54%,
    #33bbcf 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

#### Dark Gradient (Cards)
```css
.bg-black-gradient {
  background: linear-gradient(
    144.39deg,
    #ffffff -278.56%,
    #6d6d6d -78.47%,
    #11101d 91.61%
  );
}
```

#### Discount/Badge Gradient
```css
.bg-discount-gradient {
  background: linear-gradient(
    125.17deg,
    #272727 0%,
    #11101d 100%
  );
}
```

### Ambient Gradients (Decorative)

#### Blue Glow
```css
.blue__gradient {
  background: linear-gradient(
    180deg,
    rgba(188, 165, 255, 0) 0%,
    #214d76 100%
  );
  filter: blur(100px);
}
```

#### Pink Glow
```css
.pink__gradient {
  background: linear-gradient(
    90deg,
    #f4c4f3 0%,
    #fc67fa 100%
  );
  filter: blur(200px);
}
```

#### White Glow
```css
.white__gradient {
  background: rgba(255, 255, 255, 0.6);
  filter: blur(300px);
}
```

### Shadow System

| Level | Value | Usage |
|-------|-------|-------|
| Small | `0 4px 6px rgba(0, 0, 0, 0.1)` | Buttons, small elements |
| Medium | `0 10px 25px rgba(0, 0, 0, 0.15)` | Cards, dropdowns |
| Large | `0 20px 50px rgba(0, 0, 0, 0.2)` | Modals, popovers |
| Card | `0 20px 100px -10px rgba(66, 71, 91, 0.1)` | Feature cards |
| Glow | `0 0 40px rgba(0, 246, 255, 0.3)` | Active/focus states |

---

## UI Components

### Buttons

#### Primary Button
```css
.btn-primary {
  background: linear-gradient(to right, #22d3ee, #3b82f6);
  color: #111827;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 40px rgba(0, 246, 255, 0.3);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: transparent;
  border: 1px solid #22d3ee;
  color: #22d3ee;
  padding: 12px 24px;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: rgba(34, 211, 238, 0.1);
}
```

### Cards

#### Feature Card
```css
.feature-card {
  background: transparent;
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: rgba(31, 41, 55, 1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
```

#### Feedback Card
```css
.feedback-card {
  background: linear-gradient(
    144.39deg,
    #ffffff -278.56%,
    #6d6d6d -78.47%,
    #11101d 91.61%
  );
  border-radius: 20px;
  padding: 32px;
}
```

### Form Elements

#### Input Field
```css
.input-field {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  color: #ffffff;
  transition: border-color 0.2s ease;
}

.input-field:focus {
  border-color: #22d3ee;
  outline: none;
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1);
}
```

---

## Iconography

### Icon Style

All icons should follow these guidelines:
- **Style**: Outlined or minimal filled
- **Stroke Width**: 1.5px - 2px
- **Corner Radius**: Rounded corners matching brand aesthetic
- **Size**: 24x24px default, scalable

### Icon Categories

| Category | Icons | Usage |
|----------|-------|-------|
| **Features** | Star, Shield, Send | Product feature highlights |
| **Navigation** | Menu, Close, Arrow | UI navigation elements |
| **Social** | Telegram, Twitter, etc. | Social media links |
| **Action** | Discount, Quote | Interactive elements |

### Icon Colors

- **Default**: `#9ca3af` (gray-400)
- **Hover**: `#22d3ee` (cyan-400)
- **Active**: `#ffffff`
- **Disabled**: `#4b5563` (gray-600)

---

## Spacing & Layout

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing, icon gaps |
| `space-2` | 8px | Compact elements |
| `space-3` | 12px | Button padding |
| `space-4` | 16px | Card internal spacing |
| `space-6` | 24px | Section padding mobile |
| `space-8` | 32px | Component gaps |
| `space-10` | 40px | Section margins |
| `space-16` | 64px | Section padding desktop |
| `space-20` | 80px | Large section breaks |

### Layout Grid

```css
/* Container */
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (min-width: 640px) {
  .container {
    padding: 0 64px;
  }
}
```

### Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| `xs` | 480px | Large phones |
| `ss` | 620px | Small tablets |
| `sm` | 768px | Tablets |
| `md` | 1060px | Small laptops |
| `lg` | 1200px | Desktops |
| `xl` | 1700px | Large displays |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Small elements, tags |
| `rounded` | 8px | Inputs, small cards |
| `rounded-lg` | 12px | Buttons |
| `rounded-xl` | 16px | Cards |
| `rounded-2xl` | 20px | Large cards, sections |
| `rounded-full` | 9999px | Pills, avatars |

---

## Animation & Motion

### Timing Functions

| Name | Value | Usage |
|------|-------|-------|
| **Ease Default** | `ease` | General transitions |
| **Ease Out** | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Enter animations |
| **Ease In Out** | `cubic-bezier(0.4, 0, 0.2, 1)` | Smooth interactions |
| **Spring** | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Bouncy effects |

### Duration

| Speed | Duration | Usage |
|-------|----------|-------|
| Fast | 150ms | Hover states, toggles |
| Normal | 300ms | Page transitions, modals |
| Slow | 500ms | Complex animations |

### Animation Patterns

#### Slide Up (Entry)
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(100px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slideUp 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
```

#### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease forwards;
}
```

#### Hover Scale
```css
.hover-scale {
  transition: transform 0.3s ease;
}

.hover-scale:hover {
  transform: scale(1.05);
}
```

### Motion Principles

1. **Purpose** — Every animation serves a function
2. **Subtlety** — Animations enhance, never distract
3. **Consistency** — Same actions, same animations
4. **Performance** — Use transform and opacity for smooth 60fps

---

## Voice & Tone

### Brand Voice Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Confident** | Assertive but not arrogant | "Trade smarter with AI" |
| **Clear** | Simple, jargon-free | "Copy winning strategies" |
| **Empowering** | Enable user success | "Take control of your trades" |
| **Innovative** | Forward-thinking | "The future of trading" |

### Writing Guidelines

#### Headlines
- Keep under 10 words
- Lead with action verbs
- Highlight the benefit

**Good**: "Master Trading with AI Intelligence"
**Avoid**: "Our AI-Powered Trading Platform Helps You Trade Better"

#### Body Copy
- Use short paragraphs (2-3 sentences)
- Break complex ideas into bullet points
- Address the user directly ("you")

#### CTAs
- Use action verbs
- Create urgency without pressure
- Be specific about the outcome

**Good**: "Start Trading Now", "Get Your Strategy"
**Avoid**: "Click Here", "Submit"

### Terminology

| Use | Avoid |
|-----|-------|
| Strategy Vault | Strategy Storage |
| AI Intelligence | Artificial Intelligence System |
| Trading Analytics | Analysis Dashboard |
| Telegram Trading | Bot Trading |

---

## Do's and Don'ts

### Logo Usage

| Do | Don't |
|----|-------|
| Use official logo files | Recreate or modify the logo |
| Maintain clear space | Crowd the logo with other elements |
| Use on dark backgrounds primarily | Place on busy backgrounds |
| Keep proportions intact | Stretch or distort |

### Color Application

| Do | Don't |
|----|-------|
| Use midnight navy as primary background | Use bright backgrounds |
| Apply cyan for key interactive elements | Overuse cyan accents |
| Maintain contrast ratios | Combine low-contrast colors |
| Use gradients for emphasis | Apply gradients everywhere |

### Typography

| Do | Don't |
|----|-------|
| Use Poppins consistently | Mix with other sans-serif fonts |
| Apply proper hierarchy | Use more than 3 weights per page |
| Maintain readable line lengths | Extend text beyond 75 characters |
| Use dim white for body text | Use pure white for everything |

### Components

| Do | Don't |
|----|-------|
| Apply consistent border-radius | Mix sharp and rounded corners |
| Use subtle shadows | Apply heavy drop shadows |
| Animate purposefully | Add animation without purpose |
| Maintain consistent spacing | Use arbitrary spacing values |

### Photography & Imagery

| Do | Don't |
|----|-------|
| Use high-quality images | Use pixelated or stretched images |
| Apply dark overlays if needed | Use images without context |
| Maintain brand color palette | Use images with clashing colors |
| Feature modern, tech aesthetics | Use dated or generic stock photos |

---

## Quick Reference

### CSS Variables

```css
:root {
  /* Colors */
  --color-primary: #00040f;
  --color-secondary: #00f6ff;
  --color-text-primary: #ffffff;
  --color-text-secondary: rgba(255, 255, 255, 0.7);
  --color-card-bg: #11101d;

  /* Gradients */
  --gradient-blue: linear-gradient(157.81deg, #def9fa -43.27%, #33bbcf 90.29%);
  --gradient-black: linear-gradient(144.39deg, #ffffff -278.56%, #11101d 91.61%);

  /* Shadows */
  --shadow-card: 0px 20px 100px -10px rgba(66, 71, 91, 0.1);
  --shadow-glow: 0 0 40px rgba(0, 246, 255, 0.3);

  /* Spacing */
  --space-base: 8px;
  --radius-base: 12px;

  /* Typography */
  --font-family: 'Poppins', sans-serif;
}
```

### Tailwind Config Reference

```javascript
// tailwind.config.cjs
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: "#00040f",
        secondary: "#00f6ff",
        dimWhite: "rgba(255, 255, 255, 0.7)",
        dimBlue: "rgba(9, 151, 124, 0.1)",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
}
```

---

## Resources

### Brand Assets

All official brand assets are located in `/src/assets/`:
- `lazaitrader.png` — Primary logo
- `logo.svg` — Vector logo
- Feature icons (Star, Shield, Send)
- Social media icons
- UI elements

### Font Resources

- [Google Fonts - Poppins](https://fonts.google.com/specimen/Poppins)
- Weights: 400, 500, 600, 700, 800, 900

### Contact

For brand-related questions or asset requests, contact the LazaiTrader team.

---

*Last Updated: December 2024*
*Version: 1.0*
