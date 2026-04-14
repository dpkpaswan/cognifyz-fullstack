# Task 3: Advanced CSS Styling and Responsive Design

> **Cognifyz Technologies - Full Stack Development Internship**

A multi-section responsive portfolio website demonstrating **advanced CSS styling**, **CSS animations and transitions**, and the **Bootstrap 5 framework** for consistent, responsive layouts. The page features a hero section, about section, animated skill progress bars, project card grid, contact form, and a footer - all with scroll-triggered animations and polished hover effects.

---

## Table of Contents

- [Objective](#objective)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Page Sections](#page-sections)
- [Advanced CSS Techniques Used](#advanced-css-techniques-used)
  - [Keyframe Animations](#keyframe-animations)
  - [CSS Transitions](#css-transitions)
  - [CSS Transforms](#css-transforms)
  - [Glassmorphism](#glassmorphism)
  - [Gradient Text](#gradient-text)
  - [Scroll-Triggered Animations](#scroll-triggered-animations)
- [Bootstrap 5 Components Used](#bootstrap-5-components-used)
- [Responsive Breakpoints](#responsive-breakpoints)
- [File Descriptions](#file-descriptions)
- [Author](#author)
- [License](#license)

---

## Objective

Enhance CSS styling and make the webpage fully responsive by:

1. Creating a more complex layout with multiple sections
2. Experimenting with CSS properties for advanced styling (transitions, animations)
3. Utilizing a CSS framework (Bootstrap 5) for a consistent and responsive UI

---

## Features

- **6 Distinct Page Sections** - Navbar, Hero, About, Skills, Projects, Contact, and Footer
- **Bootstrap 5 Grid System** - Responsive 12-column grid for all layouts
- **Responsive Navbar** - Collapses to hamburger menu on mobile, glassmorphism on scroll
- **Floating Background Shapes** - Animated gradient blurs in the hero section
- **Animated Code Block** - Floating code snippet decoration with syntax highlighting
- **Scroll Animations** - Elements fade in and slide up as the user scrolls (Intersection Observer)
- **Animated Skill Bars** - Progress bars that animate from 0% to their value when scrolled into view
- **Project Cards** - 3D hover effects with lift, shadow, and accent color transitions
- **Contact Form** - Bootstrap floating labels with custom dark theme styling
- **Back-to-Top Button** - Appears on scroll with smooth transition
- **Smooth Scrolling** - All navigation links scroll smoothly to their section
- **Fully Responsive** - Optimized for mobile (< 576px), tablet (< 992px), and desktop

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Node.js](https://nodejs.org/) | v14+ | JavaScript runtime |
| [Express.js](https://expressjs.com/) | ^4.21.2 | Web framework |
| [EJS](https://ejs.co/) | ^3.1.10 | Server-side templating |
| [Bootstrap](https://getbootstrap.com/) | 5.3.3 | CSS framework (CDN) |
| [Bootstrap Icons](https://icons.getbootstrap.com/) | 1.11.3 | Icon library (CDN) |

---

## Project Structure

```
Task-3/
├── server.js                    # Express server with portfolio data
├── package.json                 # Project dependencies
├── .gitignore                   # Excludes node_modules
├── README.md                    # This file
│
├── views/
│   └── portfolio.ejs            # Multi-section portfolio template
│
└── public/
    └── css/
        └── style.css            # Advanced custom stylesheet
```

---

## Getting Started

### Prerequisites

- Node.js (v14+) and npm

### Installation & Run

```bash
cd Task-3
npm install
npm start
```

Open **http://localhost:3000** in your browser.

---

## Page Sections

| Section | Description | Bootstrap Components |
|---------|-------------|---------------------|
| **Navbar** | Fixed-top navigation with scroll-based glassmorphism | `navbar`, `navbar-expand-lg`, `collapse` |
| **Hero** | Full-viewport landing with gradient background, floating shapes, and stats | `row`, `col-lg-7`, `d-flex`, `align-items-center` |
| **About** | Two-column layout with text and highlights card | `row`, `col-lg-6`, `mb-4` |
| **Skills** | Animated progress bars in a 2-column grid | `row`, `col-md-6` |
| **Projects** | Card grid (3 cols desktop, 2 tablet, 1 mobile) | `row`, `col-lg-4`, `col-md-6`, `g-4` |
| **Contact** | Centered form with floating labels | `row`, `col-lg-8`, `form-floating` |
| **Footer** | Social links and credits | `container`, `text-center` |

---

## Advanced CSS Techniques Used

### Keyframe Animations

| Animation | Target | Effect |
|-----------|--------|--------|
| `float-shape` | Hero background shapes | Slow floating movement with scale changes |
| `float-code` | Code block decoration | Gentle vertical bobbing |
| `pulse-dot` | Brand logo dot | Pulsing scale with opacity change |

### CSS Transitions

- **Navbar**: Background, padding, backdrop-filter, and box-shadow transition on scroll
- **Project cards**: Transform (translateY), box-shadow, and border-color on hover
- **Buttons**: Transform and box-shadow on hover for lift effect
- **Social icons**: Color, background, border, transform, and shadow on hover
- **Skill bars**: Width animates over 1.2s with staggered delay per bar
- **Nav links**: Animated underline width and position on hover

### CSS Transforms

- `translateY(-8px)` on project card hover for lift effect
- `translateY(-3px)` on buttons and social icons for subtle elevation
- `translateY(30px) -> 0` for scroll-triggered entrance animations
- `scale(1.4)` in pulse-dot animation for pulsing effect

### Glassmorphism

The navbar uses `backdrop-filter: blur(16px)` with a semi-transparent background when scrolled, creating a frosted glass effect over page content.

### Gradient Text

The hero name uses `background: linear-gradient()` with `-webkit-background-clip: text` to create a gradient that fills the text shape.

### Scroll-Triggered Animations

Using the Intersection Observer API, elements with `.animate-on-scroll` start invisible (`opacity: 0; transform: translateY(30px)`) and transition to visible when they enter the viewport.

---

## Bootstrap 5 Components Used

| Component | Usage |
|-----------|-------|
| **Grid System** | `container`, `row`, `col-*` for all section layouts |
| **Navbar** | `navbar`, `navbar-expand-lg`, `navbar-collapse`, `navbar-toggler` |
| **Cards** | Custom card styling built on Bootstrap structure |
| **Form Controls** | `form-control`, `form-floating` for contact form |
| **Alerts** | `alert-success` for form submission confirmation |
| **Buttons** | `btn`, `btn-primary`, `btn-outline-light`, `btn-lg` |
| **Spacing** | `mt-5`, `mb-3`, `g-4`, `me-3`, `px-5` utilities |
| **Display** | `d-flex`, `d-none`, `d-lg-flex` responsive visibility |
| **Alignment** | `align-items-center`, `justify-content-center`, `text-center` |

---

## Responsive Breakpoints

| Breakpoint | Viewport | Layout Changes |
|------------|----------|----------------|
| **Desktop** | > 992px | 3-column project grid, side-by-side hero layout, full navbar |
| **Tablet** | 576-991px | 2-column project grid, centered hero, collapsed navbar |
| **Mobile** | < 576px | 1-column everything, stacked buttons, smaller typography |

---

## File Descriptions

### `server.js`
Express server that defines all portfolio data (hero, stats, skills with levels, projects with colors, about highlights) as JavaScript objects and passes them to the EJS template via `res.render()`.

### `views/portfolio.ejs`
Multi-section HTML template using Bootstrap 5 for layout and custom classes for styling. Includes inline `<script>` for scroll-triggered animations (Intersection Observer), navbar scroll effect, skill bar animation, smooth scrolling, and back-to-top button.

### `public/css/style.css`
500+ lines of custom CSS layered on Bootstrap, featuring CSS custom properties, 3 keyframe animations, glassmorphism, gradient text, animated progress bars, 3D card hover effects, and responsive overrides.

---

## Author

**Deepak Paswan**
Cognifyz Technologies - Full Stack Development Intern

---

## License

ISC
