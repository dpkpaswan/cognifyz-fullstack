/**
 * server.js - Express Server for Task 3
 *
 * A simple Express server that serves a multi-section responsive
 * portfolio page. The page data (skills, projects, etc.) is defined
 * here on the server and injected into the EJS template, demonstrating
 * server-side rendering of dynamic content.
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// Page Data (Server-Side)
// ---------------------------------------------------------------------------

/**
 * Portfolio data defined on the server. This simulates how a real
 * application would fetch data from a database and pass it to the
 * template engine for rendering.
 */
const portfolioData = {
  // Hero section
  hero: {
    greeting: 'Hello, I am',
    name: 'Deepak Paswan',
    title: 'Full Stack Developer',
    tagline: 'Building modern, responsive web applications with clean code and creative design.'
  },

  // Stats displayed in the hero area
  stats: [
    { value: '10+', label: 'Projects' },
    { value: '5+', label: 'Technologies' },
    { value: '2+', label: 'Years Exp' }
  ],

  // About section
  about: {
    heading: 'About Me',
    description: 'I am a passionate Full Stack Developer currently interning at Cognifyz Technologies. I specialize in building responsive, user-friendly web applications using modern technologies like Node.js, Express, React, and various CSS frameworks. I believe in writing clean, maintainable code and creating intuitive user experiences.',
    highlights: [
      'Full Stack Development with Node.js & Express',
      'Responsive Design with Bootstrap & CSS3',
      'Database Management with MongoDB & SQL',
      'Version Control with Git & GitHub'
    ]
  },

  // Skills section
  skills: [
    { name: 'HTML5', level: 95, category: 'frontend' },
    { name: 'CSS3 / SCSS', level: 90, category: 'frontend' },
    { name: 'JavaScript', level: 88, category: 'frontend' },
    { name: 'Bootstrap', level: 85, category: 'frontend' },
    { name: 'React', level: 75, category: 'frontend' },
    { name: 'Node.js', level: 85, category: 'backend' },
    { name: 'Express.js', level: 82, category: 'backend' },
    { name: 'MongoDB', level: 70, category: 'backend' },
    { name: 'SQL', level: 72, category: 'backend' },
    { name: 'Git & GitHub', level: 80, category: 'tools' },
    { name: 'REST APIs', level: 78, category: 'backend' },
    { name: 'EJS Templates', level: 85, category: 'backend' }
  ],

  // Projects section
  projects: [
    {
      title: 'Contact Form App',
      description: 'Server-side rendered contact form with Express and EJS templating. Features form validation and dynamic page rendering.',
      tags: ['Node.js', 'Express', 'EJS'],
      color: '#6366f1'
    },
    {
      title: 'Registration System',
      description: 'Multi-field registration with client-side and server-side validation, in-memory storage, and a submissions dashboard.',
      tags: ['JavaScript', 'Express', 'Validation'],
      color: '#8b5cf6'
    },
    {
      title: 'Portfolio Website',
      description: 'Responsive multi-section portfolio with Bootstrap, CSS animations, and advanced styling techniques.',
      tags: ['Bootstrap', 'CSS3', 'Responsive'],
      color: '#06b6d4'
    },
    {
      title: 'E-Commerce Dashboard',
      description: 'Admin dashboard with dynamic charts, data tables, dark mode toggle, and responsive grid layouts.',
      tags: ['React', 'Node.js', 'MongoDB'],
      color: '#22c55e'
    },
    {
      title: 'Real-Time Chat App',
      description: 'Live messaging application with WebSocket connections, user authentication, and message history.',
      tags: ['Socket.io', 'Express', 'Supabase'],
      color: '#f59e0b'
    },
    {
      title: 'Task Management API',
      description: 'RESTful API for task management with CRUD operations, JWT authentication, and role-based access control.',
      tags: ['REST API', 'JWT', 'MongoDB'],
      color: '#ef4444'
    }
  ],

  // Contact section
  contact: {
    heading: 'Get In Touch',
    description: 'Have a project in mind or just want to say hello? Feel free to reach out!'
  }
};

// In-memory storage for contact messages
const messages = [];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET / - Render the portfolio page
 * Passes all portfolio data to the EJS template
 */
app.get('/', (req, res) => {
  res.render('portfolio', {
    pageTitle: 'Deepak Paswan - Portfolio',
    data: portfolioData,
    messageSent: false
  });
});

/**
 * POST /contact - Handle contact form submission
 */
app.post('/contact', (req, res) => {
  const { contactName, contactEmail, contactMessage } = req.body;

  if (contactName && contactEmail && contactMessage) {
    messages.push({
      name: contactName.trim(),
      email: contactEmail.trim(),
      message: contactMessage.trim(),
      date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
  }

  res.render('portfolio', {
    pageTitle: 'Deepak Paswan - Portfolio',
    data: portfolioData,
    messageSent: true
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n  Server is running at http://localhost:${PORT}\n`);
});
