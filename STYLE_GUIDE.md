# Onlifit Design System & Style Guide

## Typography Hierarchy

### Font Sizes (Standard 16px base)
- **h1 (Page Titles)**: `text-3xl lg:text-4xl` (30px/48px mobile, 36px/56px desktop)
- **h2 (Section Headings)**: `text-2xl lg:text-3xl` (24px, 30px desktop)
- **h3 (Card Headings)**: `text-xl` (20px)
- **h4 (Small Headings)**: `text-lg` (18px)
- **Body Text**: `text-base` (16px) - DEFAULT
- **Small Text**: `text-sm` (14px)
- **Tiny Text**: `text-xs` (12px)

### Font Weights
- **Black**: `font-black` (900) - Main headings, numbers
- **Bold**: `font-bold` (700) - Subheadings, buttons
- **Semibold**: `font-semibold` (600) - Links, emphasis
- **Medium**: `font-medium` (500) - Body text emphasis
- **Regular**: `font-normal` (400) - Body text

### Font Families
- **Headlines**: `font-headline` (Poppins)
- **Body**: `font-body` (Inter) - DEFAULT
- **Labels**: `font-label` (Inter)

## Color System

### Primary Colors
- **Primary**: `#FF5A5F` (Coral/Pink) - CTAs, highlights
- **Primary Container**: `#FFE8E9` (Light pink) - Backgrounds
- **On Primary**: `#FFFFFF` (White) - Text on primary

### Secondary Colors
- **Secondary**: `#222222` (Near black) - Dark elements, text
- **Secondary Container**: `#F5F5F5` (Light gray)
- **On Secondary**: `#FFFFFF`

### Tertiary Colors
- **Tertiary**: `#00A699` (Teal) - Accents, verified badges
- **Tertiary Container**: `#E0F5F4` (Light teal)
- **On Tertiary**: `#FFFFFF`

### Surface Colors
- **Surface**: `#FFFFFF` (White) - Cards, modals
- **Surface Container Lowest**: `#FFFFFF`
- **Surface Container Low**: `#F7F7F9` (Light gray) - Page backgrounds
- **Surface Container**: `#EBEBEB` (Medium gray)
- **Surface Container High**: `#DDDDDD` (Darker gray)

### Text Colors
- **On Surface**: `#111111` (Near black) - **PRIMARY TEXT COLOR**
- **On Surface Variant**: `#4A4A4A` (Dark gray) - **SECONDARY TEXT COLOR**

### Border Colors
- **Outline**: `#DDDDDD` - Borders
- **Outline Variant**: `#EBEBEB` - Subtle borders

### State Colors
- **Error**: `#E54343` (Red)
- **Error Container**: `#FFDEDE` (Light red)

## Component Patterns

### Cards
```html
<div class="bg-surface rounded-2xl p-6 lg:p-8 shadow-ambient border border-outline-variant/20">
```

### Buttons

**Primary CTA:**
```html
<button class="px-8 py-4 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
```

**Secondary:**
```html
<button class="px-8 py-4 border-2 border-primary text-primary rounded-xl font-bold hover:bg-primary-container transition-all">
```

**Text Button:**
```html
<button class="text-sm font-bold text-primary hover:underline">
```

### Badges
```html
<span class="px-3 py-1 bg-tertiary-container text-tertiary text-xs font-bold rounded-full">Badge</span>
```

### Input Fields
```html
<input class="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20">
```

## Spacing Scale

- `gap-2` = 0.5rem (8px)
- `gap-3` = 0.75rem (12px)
- `gap-4` = 1rem (16px)
- `gap-6` = 1.5rem (24px)
- `gap-8` = 2rem (32px)

## Border Radius

- **Default**: `rounded` (16px)
- **Large**: `rounded-lg` (32px)
- **XL**: `rounded-xl` (48px)
- **Full**: `rounded-full` (9999px)

## Shadows

- **Ambient**: `shadow-ambient` (subtle)
- **Ambient Medium**: `shadow-ambient-medium`
- **Elevated**: `shadow-elevated`
- **XL**: `shadow-xl`
- **2XL**: `shadow-2xl`

## Usage Rules

### ✅ DO:
- Use `text-on-surface` for ALL primary headings (h1, h2, h3)
- Use `text-on-surface-variant` for ALL body text and descriptions
- Use `text-xs` or `text-sm` for labels and small text
- Keep font sizes consistent: h1=text-3xl/4xl, h2=text-2xl/3xl, h3=text-xl
- Use `font-headline` for all headings
- Use `font-body` for all body text (default)

### ❌ DON'T:
- Don't use arbitrary text sizes like `text-[14px]`
- Don't use colors other than the design system
- Don't mix font families randomly
- Don't use multiple heading sizes for the same level

## Page Templates

### Standard Page Structure
```html
<body class="bg-surface-container-low font-body text-on-surface">
    <nav class="fixed top-0 w-full z-50 glass-effect border-b border-outline-variant/30">
        <!-- Nav content -->
    </nav>
    
    <main class="pt-24 pb-16">
        <h1 class="text-3xl lg:text-4xl font-black font-headline mb-8">Page Title</h1>
        <!-- Content -->
    </main>
    
    <footer class="bg-secondary text-white py-12">
        <!-- Footer -->
    </footer>
</body>
```
