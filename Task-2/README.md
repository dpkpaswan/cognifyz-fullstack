# Task 2: Inline Styles, Basic Interaction, and Server-Side Validation

> **Cognifyz Technologies - Full Stack Development Internship**

A full-stack web application that extends Task 1 by introducing a complex multi-field registration form with **client-side validation** (inline JavaScript), **server-side validation** (Express), and **temporary server-side storage** (in-memory array). Includes a dashboard to view and manage all stored submissions.

---

## Table of Contents

- [Objective](#objective)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Server](#running-the-server)
- [Application Flow](#application-flow)
- [API Routes](#api-routes)
- [Key Concepts Demonstrated](#key-concepts-demonstrated)
  - [Client-Side Validation (Inline JavaScript)](#client-side-validation-inline-javascript)
  - [Server-Side Validation](#server-side-validation)
  - [Temporary Server-Side Storage](#temporary-server-side-storage)
  - [PRG Pattern](#prg-pattern)
- [Form Fields and Validation Rules](#form-fields-and-validation-rules)
- [File Descriptions](#file-descriptions)
- [Screenshots](#screenshots)
- [Future Improvements](#future-improvements)
- [Author](#author)
- [License](#license)

---

## Objective

Expand inline styles and introduce server-side validation for form submissions by:

1. Extending HTML with more complex forms and user interactions
2. Utilizing inline JavaScript for client-side form validation
3. Implementing server-side validation for submitted form data
4. Storing validated data in temporary server-side storage

---

## Features

- **Complex Multi-Field Form** - 7 fields with different input types (text, email, tel, number, select, checkboxes, textarea)
- **Client-Side Validation** - Inline JavaScript validates each field on blur (when user leaves the field) and on form submit, providing instant feedback
- **Server-Side Validation** - Comprehensive validation on the Express server as the authoritative check (client-side validation can be bypassed)
- **In-Memory Storage** - Validated submissions are stored in a server-side array, persisted across requests within the same server session
- **Submissions Dashboard** - View all stored registrations in a responsive data table
- **Delete Functionality** - Remove individual submissions from server storage
- **Character Counter** - Real-time character count for the bio textarea with visual limits
- **Error Preservation** - When validation fails, previously entered values are preserved in the form
- **POST-Redirect-GET Pattern** - Prevents duplicate submissions on page refresh
- **Responsive Design** - Adapts to mobile, tablet, and desktop viewports
- **XSS Protection** - All user data is HTML-escaped via EJS output tags

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Node.js](https://nodejs.org/) | v14+ | JavaScript runtime environment |
| [Express.js](https://expressjs.com/) | ^4.21.2 | Web framework for routing and middleware |
| [EJS](https://ejs.co/) | ^3.1.10 | Server-side templating engine |

---

## Project Structure

```
Task-2/
├── server.js                   # Express server with routes, validation, and storage
├── package.json                # Project dependencies
├── package-lock.json           # Locked dependency versions
├── .gitignore                  # Excludes node_modules from Git
├── README.md                   # This file
│
├── views/                      # EJS templates
│   ├── register.ejs            # Registration form with inline JS validation
│   ├── success.ejs             # Submission confirmation page
│   ├── dashboard.ejs           # All submissions table
│   └── error.ejs               # 404 error page
│
└── public/                     # Static assets
    └── css/
        └── style.css           # Application stylesheet
```

---

## Getting Started

### Prerequisites

- **Node.js** (version 14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes bundled with Node.js)

### Installation

```bash
cd Task-2
npm install
```

### Running the Server

```bash
npm start
```

Output:

```
  Server is running at http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

## Application Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                         APPLICATION FLOW                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. User visits http://localhost:3000                              │
│     -> GET / -> renders register.ejs                               │
│                                                                    │
│  2. User fills in the registration form                            │
│     -> Inline JS validates fields on blur (real-time)              │
│                                                                    │
│  3. User clicks "Register Now"                                     │
│     -> Inline JS runs full validation on submit                    │
│     -> If client-side errors, form is NOT submitted                │
│                                                                    │
│  4. Form data reaches server (POST /register)                      │
│     -> Server runs validateRegistration() independently            │
│     ├── FAIL:  re-render register.ejs with errors + preserved data │
│     └── PASS:  store in submissions[], redirect to /success/:id    │
│                                                                    │
│  5. Success page shows stored data (GET /success/:id)              │
│                                                                    │
│  6. Dashboard shows all submissions (GET /dashboard)               │
│     -> Delete button sends POST /delete/:id to remove entry        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Display the registration form |
| `POST` | `/register` | Validate and store form submission |
| `GET` | `/success/:id` | Show success page for a specific submission |
| `GET` | `/dashboard` | View all stored submissions |
| `POST` | `/delete/:id` | Delete a submission by ID |

---

## Key Concepts Demonstrated

### Client-Side Validation (Inline JavaScript)

The `register.ejs` template includes a `<script>` block that validates form fields **in the browser** before submission. Each field has a validator function that runs:

- **On blur** - When the user leaves a field, instant feedback appears below it
- **On submit** - All fields are re-validated; if any fail, `event.preventDefault()` stops the form from being sent

This provides a responsive user experience but does NOT replace server-side validation.

### Server-Side Validation

The `validateRegistration()` function in `server.js` performs the same checks on the server. This is necessary because:

- JavaScript can be disabled in the browser
- Users can modify form HTML using browser DevTools
- API requests can be sent directly via tools like `curl` or Postman
- **The server is the only trusted validation layer**

### Temporary Server-Side Storage

Instead of a database, validated submissions are stored in a JavaScript array (`submissions[]`) in the server's memory. Key characteristics:

- **Persists across requests** within the same server session
- **Lost on server restart** (this is temporary, not permanent storage)
- Each entry gets a unique auto-incrementing `id`
- Entries can be deleted via the dashboard

### PRG Pattern

After a successful submission, the server uses `res.redirect('/success/' + id)` instead of directly rendering the success page. This **POST-Redirect-GET** pattern prevents the browser from re-submitting the form if the user refreshes the page.

---

## Form Fields and Validation Rules

| Field | Type | Client Validation | Server Validation |
|-------|------|-------------------|-------------------|
| Full Name | `text` | Min 2 characters | Min 2 characters |
| Email | `email` | Regex pattern match | Regex pattern match |
| Phone | `tel` | Min 10 digits | Min 10 digits (strips formatting) |
| Age | `number` | 16-120 range | 16-120 range, must be a number |
| Gender | `select` | Must be selected | Must be an allowed value |
| Skills | `checkbox` | At least 1 checked | At least 1 in array |
| Bio | `textarea` | 10-500 characters | 10-500 characters |

---

## File Descriptions

### `server.js`

Main server file containing:
- Express app configuration and middleware setup
- `submissions[]` array for in-memory storage
- `validateRegistration()` function with 7 field validators
- 5 route handlers (GET /, POST /register, GET /success/:id, GET /dashboard, POST /delete/:id)

### `views/register.ejs`

Registration form template featuring:
- 7 form fields with various HTML input types
- Inline `<script>` block with client-side validation
- Real-time character counter for the bio field
- Server-side error banner for validation failures
- Preserved input values on re-render

### `views/success.ejs`

Confirmation page showing all stored submission data with skill badges and formatted display.

### `views/dashboard.ejs`

Data table displaying all submissions stored in memory, with an empty state and per-row delete buttons.

### `views/error.ejs`

Generic 404 error page for invalid submission IDs.

### `public/css/style.css`

Comprehensive stylesheet with CSS custom properties, responsive table, checkbox grid, skill badges, navigation bar, and mobile breakpoints.

---

## Screenshots

### Registration Form
> Multi-field form at `http://localhost:3000/` with real-time validation.

### Submissions Dashboard
> Table of all stored registrations at `http://localhost:3000/dashboard`.

---

## Future Improvements

- **Database Integration** - Replace in-memory array with MongoDB or PostgreSQL
- **Edit Functionality** - Allow updating existing submissions
- **Search and Filter** - Add search/filter to the dashboard table
- **Export Data** - Download submissions as CSV or JSON
- **Password Field** - Add password with strength meter and confirmation

---

## Author

**Deepak Paswan**
Cognifyz Technologies - Full Stack Development Intern

---

## License

ISC
