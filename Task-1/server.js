/**
 * server.js - Main Express Server
 * 
 * This file sets up the Express web server, configures EJS as the
 * templating engine, and defines routes for displaying and processing
 * a contact form. It demonstrates server-side rendering (SSR) where
 * HTML is generated on the server before being sent to the client.
 */

const express = require('express');
const path = require('path');

// Initialize the Express application instance
const app = express();

// Define the port the server will listen on
const PORT = 3000;

// ---------------------------------------------------------------------------
// Middleware Configuration
// ---------------------------------------------------------------------------

/**
 * express.urlencoded() parses incoming request bodies that use the
 * "application/x-www-form-urlencoded" encoding — which is the default
 * encoding for HTML form submissions. The { extended: true } option
 * allows parsing of nested objects if needed.
 */
app.use(express.urlencoded({ extended: true }));

/**
 * express.static() serves files from the "public" directory as-is,
 * without any server-side processing. This is used for CSS stylesheets,
 * client-side JavaScript, images, and other static assets.
 */
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// View Engine Setup
// ---------------------------------------------------------------------------

/**
 * Setting the view engine to EJS tells Express to use EJS for rendering
 * templates. When res.render('form') is called, Express will look for
 * a file named "form.ejs" inside the "views" directory.
 */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// Route Definitions
// ---------------------------------------------------------------------------

/**
 * GET / — Display the contact form
 * 
 * This route serves the form page. The render() method processes the
 * EJS template and sends the resulting HTML to the client. We pass
 * a "pageTitle" variable that the template can use, demonstrating
 * how data flows from the server into the rendered HTML.
 */
app.get('/', (req, res) => {
  res.render('form', {
    pageTitle: 'Contact Form'
  });
});

/**
 * POST /submit — Handle form submission
 * 
 * When the user submits the form, the browser sends a POST request
 * to this endpoint. The form data is available in req.body because
 * of the urlencoded middleware configured above.
 * 
 * We perform basic server-side validation, then render the result
 * page with the submitted data. This is a key SSR concept: the
 * server constructs the complete HTML response using the submitted
 * data before sending it to the client.
 */
app.post('/submit', (req, res) => {
  // Destructure the submitted form fields from the request body
  const { userName, userEmail, userMessage } = req.body;

  // --- Server-Side Validation ---
  // Check that all required fields have non-empty values.
  // trim() removes leading/trailing whitespace so blank entries are caught.
  const validationErrors = [];

  if (!userName || userName.trim() === '') {
    validationErrors.push('Name is required.');
  }

  if (!userEmail || userEmail.trim() === '') {
    validationErrors.push('Email is required.');
  }

  if (!userMessage || userMessage.trim() === '') {
    validationErrors.push('Message is required.');
  }

  // If validation fails, re-render the form with error messages and
  // the previously entered values so the user doesn't have to retype.
  if (validationErrors.length > 0) {
    return res.render('form', {
      pageTitle: 'Contact Form',
      errors: validationErrors,
      previousInput: { userName, userEmail, userMessage }
    });
  }

  // Capture the timestamp of submission on the server.
  // This shows that server-side logic can enrich data before rendering.
  const submittedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata'
  });

  // Build a clean data object to pass into the result template
  const submissionData = {
    name: userName.trim(),
    email: userEmail.trim(),
    message: userMessage.trim(),
    submittedAt
  };

  // Render the result page, injecting the submission data into the template
  res.render('result', {
    pageTitle: 'Submission Received',
    submission: submissionData
  });
});

// ---------------------------------------------------------------------------
// Start the Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n  ✅  Server is running at http://localhost:${PORT}\n`);
});
