# Task 1: HTML Structure and Basic Server Interaction

> **Cognifyz Technologies - Full Stack Development Internship**

A full-stack web application that demonstrates **server-side rendering (SSR)** and **form handling** using Node.js, Express.js, and EJS templating. The application collects user data through an HTML contact form, processes the submission on the server, validates input, and dynamically renders the results using EJS.

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
  - [Server-Side Rendering (SSR)](#server-side-rendering-ssr)
  - [Form Handling](#form-handling)
  - [EJS Templating](#ejs-templating)
  - [Middleware](#middleware)
  - [Server-Side Validation](#server-side-validation)
- [File Descriptions](#file-descriptions)
- [Screenshots](#screenshots)
- [Future Improvements](#future-improvements)
- [Author](#author)
- [License](#license)

---

## Objective

Introduce the concept of server-side rendering and basic form submissions by:

1. Creating an HTML structure with forms for user input
2. Setting up a simple Node.js server using Express
3. Creating server-side endpoints to handle form submissions
4. Using server-side rendering (EJS) to dynamically generate HTML pages

---

## Features

- **Contact Form** - Collects user name, email address, and a message
- **Server-Side Validation** - Validates that all required fields are filled before processing
- **Error Handling** - Re-renders the form with error messages and preserves previously entered values on validation failure
- **Dynamic Rendering** - EJS templates inject server-side data into HTML before sending to the client
- **Data Enrichment** - Server adds a submission timestamp, demonstrating that SSR can enrich data beyond what the user submitted
- **XSS Protection** - EJS `<%= %>` output tags automatically escape HTML entities to prevent cross-site scripting attacks
- **Responsive Design** - Modern dark-themed UI that works across desktop and mobile devices
- **Accessible** - Semantic HTML with proper ARIA labels, form labels, and role attributes

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Node.js](https://nodejs.org/) | v14+ | JavaScript runtime environment |
| [Express.js](https://expressjs.com/) | ^4.21.2 | Web application framework for routing and middleware |
| [EJS](https://ejs.co/) | ^3.1.10 | Embedded JavaScript templating engine for SSR |

---

## Project Structure

```
Task-1/
├── server.js                 # Main Express server - routes, middleware, config
├── package.json              # Project metadata and dependency declarations
├── package-lock.json         # Locked dependency versions for reproducibility
├── README.md                 # Project documentation (this file)
│
├── views/                    # EJS templates (server-side rendered)
│   ├── form.ejs              # Contact form page template
│   └── result.ejs            # Submission result page template
│
└── public/                   # Static assets (served directly by Express)
    └── css/
        └── style.css         # Application stylesheet
```

---

## Getting Started

### Prerequisites

Make sure you have the following installed on your machine:

- **Node.js** (version 14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes bundled with Node.js)

Verify installation:

```bash
node --version    # Should output v14.x.x or higher
npm --version     # Should output 6.x.x or higher
```

### Installation

1. **Clone or navigate to the project directory:**

   ```bash
   cd Task-1
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   This installs Express.js and EJS as defined in `package.json`.

### Running the Server

Start the application:

```bash
npm start
```

You should see:

```
  ✅  Server is running at http://localhost:3000
```

Open your browser and navigate to **http://localhost:3000** to use the application.

To stop the server, press `Ctrl + C` in the terminal.

---

## Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User visits http://localhost:3000                           │
│     │                                                           │
│     ▼                                                           │
│  2. Express handles GET / route                                 │
│     │                                                           │
│     ▼                                                           │
│  3. Server renders form.ejs template with pageTitle variable    │
│     │                                                           │
│     ▼                                                           │
│  4. Browser displays the contact form                           │
│     │                                                           │
│     ▼                                                           │
│  5. User fills in name, email, message and clicks "Send"        │
│     │                                                           │
│     ▼                                                           │
│  6. Browser sends POST /submit with form data in request body   │
│     │                                                           │
│     ├──── Validation FAILS ──► Re-render form.ejs with errors   │
│     │                          and previously entered values     │
│     │                                                           │
│     ├──── Validation PASSES                                     │
│     │     │                                                     │
│     │     ▼                                                     │
│     │  7. Server enriches data (adds timestamp)                 │
│     │     │                                                     │
│     │     ▼                                                     │
│     │  8. Server renders result.ejs with submission data        │
│     │     │                                                     │
│     │     ▼                                                     │
│     │  9. Browser displays the result page                      │
│     │                                                           │
│     └──── User clicks "Submit another response"                 │
│           │                                                     │
│           ▼                                                     │
│        Back to Step 1                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Routes

| Method | Endpoint | Description | Template Rendered |
|--------|----------|-------------|-------------------|
| `GET`  | `/`      | Displays the contact form | `views/form.ejs` |
| `POST` | `/submit`| Processes form submission, validates data, and shows result | `views/result.ejs` (success) or `views/form.ejs` (validation error) |

### GET /

Serves the contact form page. Passes `pageTitle` to the EJS template.

**Example:**
```
Request:  GET http://localhost:3000/
Response: HTML page with the contact form
```

### POST /submit

Receives form data, validates it, and returns the result page.

**Request body fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userName` | string | Yes | User's full name |
| `userEmail` | string | Yes | User's email address |
| `userMessage` | string | Yes | User's message |

**Success Response:** Renders `result.ejs` with the submitted data and a server-generated timestamp.

**Validation Error Response:** Re-renders `form.ejs` with an `errors` array and a `previousInput` object so the user can correct their input without retyping.

---

## Key Concepts Demonstrated

### Server-Side Rendering (SSR)

Server-Side Rendering means the HTML is **generated on the server** before being sent to the browser. Unlike client-side rendering (where JavaScript builds the page in the browser), with SSR:

- The server receives a request
- It processes data and injects it into a template
- It sends the **fully constructed HTML** to the client
- The browser simply displays the received HTML

In this project, when `res.render('result', { submission: submissionData })` is called, Express uses EJS to compile the template with the data and sends the finished HTML string as the response.

### Form Handling

HTML forms use the `action` and `method` attributes to determine where and how data is sent:

```html
<form action="/submit" method="POST">
```

- `action="/submit"` - The URL the form data is sent to
- `method="POST"` - Data is sent in the request body (not visible in the URL)
- Each `<input>` and `<textarea>` has a `name` attribute that becomes the key in `req.body`

### EJS Templating

EJS (Embedded JavaScript) allows embedding JavaScript logic directly in HTML files:

- `<%= variable %>` - Outputs a value with HTML escaping (safe from XSS)
- `<% code %>` - Executes JavaScript without outputting (used for loops, conditionals)

Example from this project:
```ejs
<h1><%= pageTitle %></h1>
```
When the server calls `res.render('form', { pageTitle: 'Contact Form' })`, EJS replaces `<%= pageTitle %>` with `Contact Form` in the final HTML.

### Middleware

Express middleware functions process requests before they reach route handlers:

1. **`express.urlencoded({ extended: true })`** - Parses form data from `POST` requests and makes it available in `req.body`
2. **`express.static('public')`** - Serves static files (CSS, images) directly from the `public/` directory without any server-side processing

### Server-Side Validation

Before accepting a form submission, the server checks that all required fields contain non-empty values. This is important because:

- Client-side validation (HTML `required` attribute) can be bypassed
- Server-side validation is the **last line of defence** before data is processed
- It provides a better user experience by preserving entered values on error

---

## File Descriptions

### `server.js`

The main entry point of the application. It:
- Creates an Express application instance
- Configures middleware for body parsing and static file serving
- Sets EJS as the view engine
- Defines two routes: `GET /` and `POST /submit`
- Implements server-side validation with error feedback
- Starts the HTTP server on port 3000

### `views/form.ejs`

The EJS template for the contact form page. It:
- Renders an HTML form with three fields: name, email, and message
- Conditionally displays validation errors when they exist
- Preserves previously entered values when re-rendered after a validation failure
- Uses semantic HTML with proper labels and accessibility attributes

### `views/result.ejs`

The EJS template for the submission result page. It:
- Displays all submitted data (name, email, message)
- Shows the server-generated submission timestamp
- Includes a link to submit another response
- Uses `<%= %>` tags for automatic XSS protection

### `public/css/style.css`

The application stylesheet featuring:
- CSS custom properties (variables) for consistent theming
- A dark colour scheme with gradient accents
- Responsive card layout using flexbox
- Smooth animations and hover transitions
- Mobile-responsive design with a media query breakpoint

### `package.json`

Defines project metadata and dependencies:
- `express` - Web framework
- `ejs` - Templating engine
- `start` script mapped to `node server.js`

---

## Screenshots

### Contact Form Page
> The main form page at `http://localhost:3000/` with fields for name, email, and message.

### Submission Result Page
> After submitting the form, the result page displays the submitted data along with a server-generated timestamp.

---

## Future Improvements

- **Database Integration** - Store submissions in MongoDB or PostgreSQL
- **Email Validation** - Add regex-based email format validation
- **Rate Limiting** - Prevent spam submissions
- **Flash Messages** - Show success/error messages using session-based flash
- **Partial Templates** - Extract shared HTML (head, footer) into EJS partials

---

## Author

**Deepak Paswan**
Cognifyz Technologies - Full Stack Development Intern

---

## License

ISC
