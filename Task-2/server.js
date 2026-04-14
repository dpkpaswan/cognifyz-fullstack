/**
 * server.js - Express Server for Task 2
 *
 * This server extends upon Task 1 by introducing:
 *  - A more complex registration form with multiple field types
 *  - Comprehensive server-side validation with detailed error messages
 *  - Temporary in-memory storage to persist submissions across requests
 *  - A dashboard route to view all stored submissions
 *  - A delete endpoint to remove individual submissions
 */

const express = require('express');
const path = require('path');

// Initialize the Express application
const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// In-Memory Storage
// ---------------------------------------------------------------------------

/**
 * This array acts as temporary server-side storage. Each validated
 * submission is pushed here as an object. The data lives only in
 * the Node.js process memory and is lost when the server restarts.
 *
 * In a production app this would be replaced by a database (e.g.
 * MongoDB, PostgreSQL) but for this task it demonstrates how the
 * server can hold state between requests.
 */
const submissions = [];

/**
 * Auto-incrementing ID counter so every submission gets a unique
 * identifier, which is needed for the delete functionality.
 */
let nextId = 1;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Parse URL-encoded form bodies (the default encoding for HTML forms)
app.use(express.urlencoded({ extended: true }));

// Serve static assets (CSS, client-side JS) from the public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// View Engine Configuration
// ---------------------------------------------------------------------------

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * validateRegistration(data)
 *
 * Performs comprehensive server-side validation on the registration
 * form data. Returns an array of error objects, each containing
 * the field name and an error message.
 *
 * Why validate on the server even if we validate on the client?
 * Client-side validation can be bypassed (e.g. by disabling JS or
 * using curl). Server-side validation is the authoritative check.
 */
function validateRegistration(data) {
  const errors = [];

  // --- Full Name ---
  // Must be non-empty and contain at least 2 characters
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push({
      field: 'fullName',
      message: 'Full name must be at least 2 characters long.'
    });
  }

  // --- Email ---
  // Must match a basic email pattern: something@something.something
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailPattern.test(data.email.trim())) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid email address.'
    });
  }

  // --- Phone ---
  // Must be 10 digits (allowing optional spaces, dashes, and parentheses)
  const digitsOnly = (data.phone || '').replace(/[\s\-()]/g, '');
  if (digitsOnly.length < 10) {
    errors.push({
      field: 'phone',
      message: 'Phone number must contain at least 10 digits.'
    });
  }

  // --- Age ---
  // Must be a number between 16 and 120
  const age = parseInt(data.age, 10);
  if (isNaN(age) || age < 16 || age > 120) {
    errors.push({
      field: 'age',
      message: 'Age must be a number between 16 and 120.'
    });
  }

  // --- Gender ---
  // Must be one of the allowed values
  const allowedGenders = ['male', 'female', 'other', 'prefer-not-to-say'];
  if (!data.gender || !allowedGenders.includes(data.gender)) {
    errors.push({
      field: 'gender',
      message: 'Please select a valid gender option.'
    });
  }

  // --- Skills ---
  // At least one skill must be selected (checkboxes send an array)
  const skills = Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : []);
  if (skills.length === 0) {
    errors.push({
      field: 'skills',
      message: 'Please select at least one skill.'
    });
  }

  // --- Bio ---
  // Must be between 10 and 500 characters
  if (!data.bio || data.bio.trim().length < 10) {
    errors.push({
      field: 'bio',
      message: 'Bio must be at least 10 characters long.'
    });
  } else if (data.bio.trim().length > 500) {
    errors.push({
      field: 'bio',
      message: 'Bio must not exceed 500 characters.'
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET / - Display the registration form
 *
 * Renders the form with no errors and no previous input.
 */
app.get('/', (req, res) => {
  res.render('register', {
    pageTitle: 'Registration Form',
    errors: [],
    previousInput: {},
    submissionCount: submissions.length
  });
});

/**
 * POST /register - Handle form submission
 *
 * 1. Extract all fields from req.body
 * 2. Run server-side validation
 * 3. If validation fails  -> re-render form with errors + preserved input
 * 4. If validation passes -> store data, redirect to success page
 */
app.post('/register', (req, res) => {
  const { fullName, email, phone, age, gender, skills, bio } = req.body;

  // Build a flat data object for validation and storage
  const formData = { fullName, email, phone, age, gender, skills, bio };

  // Run server-side validation
  const errors = validateRegistration(formData);

  if (errors.length > 0) {
    // Validation failed - re-render form with errors and preserve input
    return res.render('register', {
      pageTitle: 'Registration Form',
      errors,
      previousInput: formData,
      submissionCount: submissions.length
    });
  }

  // Normalize the skills field into an array
  const normalizedSkills = Array.isArray(skills) ? skills : (skills ? [skills] : []);

  // Build the submission record with a unique ID and timestamp
  const submission = {
    id: nextId++,
    fullName: fullName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    age: parseInt(age, 10),
    gender,
    skills: normalizedSkills,
    bio: bio.trim(),
    submittedAt: new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    })
  };

  // Store in temporary server-side storage
  submissions.push(submission);

  // Redirect to success page (POST-Redirect-GET pattern prevents duplicate submissions)
  res.redirect('/success/' + submission.id);
});

/**
 * GET /success/:id - Show submission success page
 *
 * Retrieves the submission by ID from storage and displays it.
 */
app.get('/success/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const submission = submissions.find(s => s.id === id);

  if (!submission) {
    return res.status(404).render('error', {
      pageTitle: 'Not Found',
      errorMessage: 'Submission not found.'
    });
  }

  res.render('success', {
    pageTitle: 'Registration Successful',
    submission,
    submissionCount: submissions.length
  });
});

/**
 * GET /dashboard - View all stored submissions
 *
 * Renders a table of all submissions stored in memory.
 * Demonstrates reading from server-side storage.
 */
app.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    pageTitle: 'Submissions Dashboard',
    submissions,
    submissionCount: submissions.length
  });
});

/**
 * POST /delete/:id - Delete a submission from storage
 *
 * Removes the submission with the given ID and redirects
 * back to the dashboard.
 */
app.post('/delete/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = submissions.findIndex(s => s.id === id);

  if (index !== -1) {
    submissions.splice(index, 1);
  }

  res.redirect('/dashboard');
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n  Server is running at http://localhost:${PORT}\n`);
});
