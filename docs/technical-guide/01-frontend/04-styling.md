# Styling with Tailwind CSS

## Configuration

### tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
        caveat: ['var(--font-caveat)'],  // Handwritten signature font
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

---

## CSS Variables

### globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* HTA Brand Colors */
    --primary: 187 100% 24%;        /* #00687a - HTA Teal */
    --primary-foreground: 0 0% 100%;

    /* Neutral Colors */
    --background: 180 20% 97%;      /* #f5f8f8 - Light background */
    --foreground: 222 47% 11%;      /* Dark text */
    --card: 0 0% 100%;              /* White cards */
    --card-foreground: 222 47% 11%;

    /* UI Colors */
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 187 100% 24%;           /* Focus ring = primary */

    /* Secondary */
    --secondary: 210 40% 96%;       /* #f1f5f9 - Slate 100 */
    --secondary-foreground: 222 47% 11%;

    /* Muted */
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;

    /* Destructive */
    --destructive: 0 84% 60%;       /* Red */
    --destructive-foreground: 0 0% 100%;

    /* Accent */
    --accent: 210 40% 96%;
    --accent-foreground: 222 47% 11%;

    /* Chart Colors */
    --chart-1: 187 100% 24%;        /* Primary */
    --chart-2: 199 89% 48%;         /* Sky blue */
    --chart-3: 142 71% 45%;         /* Green */
    --chart-4: 38 92% 50%;          /* Amber */
    --chart-5: 0 84% 60%;           /* Red */

    /* Radius */
    --radius: 0.5rem;
  }
}
```

---

## Common Patterns

### Card Containers

```tsx
// Standard card
<div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
  {/* Content */}
</div>

// Card with hover effect
<div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6
                hover:shadow-md transition-shadow">
  {/* Content */}
</div>

// Colored section
<div className="bg-slate-50/50 rounded-xl p-4">
  {/* Light gray background */}
</div>

<div className="bg-primary/5 rounded-xl p-4">
  {/* Primary color tint */}
</div>
```

### Grid Layouts

```tsx
// Two columns on desktop, one on mobile
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div>Column 1</div>
  <div>Column 2</div>
</div>

// Three columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Items */}
</div>

// Fixed sidebar + fluid content
<div className="grid grid-cols-[250px_1fr] gap-6">
  <aside>Sidebar</aside>
  <main>Content</main>
</div>
```

### Typography

```tsx
// Page title
<h1 className="text-2xl font-bold text-slate-900">Title</h1>

// Section header
<h2 className="text-lg font-semibold text-slate-800">Section</h2>

// Form label
<label className="text-sm font-medium text-slate-700">Label</label>

// Helper text
<p className="text-sm text-slate-500">Helper text</p>

// Uppercase label
<span className="text-xs font-bold uppercase tracking-wider text-slate-500">
  CATEGORY
</span>

// Signature font
<span className="font-caveat text-3xl text-primary">John Doe</span>
```

### Spacing

```tsx
// Consistent section spacing
<div className="space-y-6">
  <section>Section 1</section>
  <section>Section 2</section>
</div>

// Form group
<div className="space-y-2">
  <Label>Field</Label>
  <Input />
  <p className="text-sm text-slate-500">Description</p>
</div>

// Horizontal items
<div className="flex items-center gap-4">
  <Icon />
  <span>Label</span>
</div>
```

---

## Status Colors

```tsx
// Status badge classes
const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  SENT_TO_CUSTOMER: 'bg-purple-100 text-purple-700',
  CUSTOMER_APPROVED: 'bg-teal-100 text-teal-700',
  ADMIN_AUTHORIZED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
}

// Category colors (environmental conditions)
const categoryColors = {
  electrical: 'bg-purple-50/50 border-purple-200',
  dimensional: 'bg-blue-50/50 border-blue-200',
  thermal: 'bg-orange-50/50 border-orange-200',
  mechanical: 'bg-green-50/50 border-green-200',
}
```

---

## Interactive States

```tsx
// Button hover
<button className="bg-primary text-white hover:bg-primary/90
                   transition-colors">
  Click
</button>

// Focus ring
<input className="focus:outline-none focus:ring-2 focus:ring-primary
                  focus:ring-offset-2" />

// Active/selected
<button className={cn(
  "px-4 py-2 rounded-lg",
  isActive
    ? "bg-primary text-white"
    : "bg-gray-100 hover:bg-gray-200"
)}>
  Tab
</button>

// Disabled
<button className="disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading}>
  Submit
</button>
```

---

## Form Styling

### Radio Buttons (Sticker Status)

```css
/* Custom radio styling */
.sticker-radio-btn:checked + .sticker-label-yes {
  @apply bg-green-100 border-green-500 text-green-700;
}

.sticker-radio-btn:checked + .sticker-label-no {
  @apply bg-red-100 border-red-500 text-red-700;
}

.sticker-radio-btn:checked + .sticker-label-na {
  @apply bg-gray-100 border-gray-500 text-gray-700;
}
```

```tsx
// Usage
<label className="sticker-label-yes cursor-pointer px-4 py-2 rounded-lg
                  border-2 border-transparent">
  <input type="radio" className="sticker-radio-btn sr-only" value="YES" />
  Yes
</label>
```

### Input Fields

```tsx
// Standard input
<Input
  className="h-10 rounded-lg border-slate-200 focus:border-primary"
/>

// Error state
<Input
  className={cn(
    "h-10 rounded-lg",
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-200 focus:ring-primary"
  )}
/>

// Read-only
<Input
  readOnly
  className="bg-slate-50 cursor-not-allowed"
/>
```

---

## Responsive Design

### Breakpoints

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### Examples

```tsx
// Hide on mobile
<div className="hidden md:block">
  Desktop only sidebar
</div>

// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Different text sizes
<h1 className="text-xl md:text-2xl lg:text-3xl">
  Responsive Title
</h1>

// Different padding
<div className="p-4 md:p-6 lg:p-8">
  Content
</div>
```

---

## Animations

### Using tailwindcss-animate

```tsx
// Fade in
<div className="animate-in fade-in duration-300">
  Content
</div>

// Slide in
<div className="animate-in slide-in-from-bottom-4 duration-300">
  Content
</div>

// Exit animation
<div className="animate-out fade-out duration-200">
  Exiting
</div>
```

### Custom Animations

```css
/* globals.css */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin 3s linear infinite;
}
```

```tsx
<div className="animate-spin-slow">
  <LoadingIcon />
</div>
```

---

## Utility Classes

### Scrollbar Styling

```css
/* globals.css */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* Hide scrollbar but keep functionality */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

### Sticky Header

```css
.sticky-mini-header {
  @apply sticky top-0 z-10 bg-white/95 backdrop-blur-sm
         border-b border-transparent transition-all;
}

.scrolled .sticky-mini-header {
  @apply border-slate-200 shadow-sm;
}
```

---

## Class Merging with cn()

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<div className={cn(
  // Base classes
  "px-4 py-2 rounded-lg",
  // Conditional classes
  isActive && "bg-primary text-white",
  isDisabled && "opacity-50 cursor-not-allowed",
  // Prop-based classes
  className
)}>
  Content
</div>
```

---

## Best Practices

### 1. Use Semantic Colors

```tsx
// Good: Semantic
<button className="bg-primary">Submit</button>
<button className="bg-destructive">Delete</button>

// Avoid: Hardcoded colors
<button className="bg-[#00687a]">Submit</button>
```

### 2. Extract Repeated Patterns

```tsx
// components/ui/card.tsx
export const cardStyles = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6"

// Usage
<div className={cn(cardStyles, "hover:shadow-md")}>
```

### 3. Use Variants with CVA

```typescript
import { cva } from 'class-variance-authority'

const badge = cva(
  "px-2 py-1 rounded-full text-xs font-medium",
  {
    variants: {
      status: {
        draft: "bg-gray-100 text-gray-700",
        review: "bg-blue-100 text-blue-700",
        approved: "bg-green-100 text-green-700",
      }
    }
  }
)

// Usage
<span className={badge({ status: 'approved' })}>Approved</span>
```

### 4. Mobile-First

```tsx
// Start with mobile, add breakpoints for larger
<div className="p-4 md:p-6 lg:p-8">
  {/* p-4 is default (mobile), md:p-6 adds tablet, lg:p-8 adds desktop */}
</div>
```
