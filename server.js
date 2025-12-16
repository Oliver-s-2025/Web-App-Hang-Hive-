/*
  ============================================================
  HANG HIVE BACKEND SERVER - server.js
  ============================================================
  This is the backend that handles all data for the app.
  It saves data to a JSON file so it persists between restarts.
  
  To run: node server.js
  Then open http://localhost:3000 in your browser
*/

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Where we store all the data
const DATA_FILE = path.join(__dirname, 'data', 'database.json');

// ==========================================
// MIDDLEWARE (runs on every request)
// ==========================================

// Allow requests from any origin (for development)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Serve the frontend files (html, css, js)
app.use(express.static(__dirname));

// ==========================================
// DATABASE FUNCTIONS
// ==========================================

/**
 * Load all data from the JSON file
 */
function loadDatabase() {
  try {
    // Create data folder if it doesn't exist
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create file with empty data if it doesn't exist
    if (!fs.existsSync(DATA_FILE)) {
      const emptyData = { users: [], groups: [] };
      fs.writeFileSync(DATA_FILE, JSON.stringify(emptyData, null, 2));
      return emptyData;
    }
    
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading database:', error);
    return { users: [], groups: [] };
  }
}

/**
 * Save all data to the JSON file
 */
function saveDatabase(data) {
  try {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

/**
 * Generate a random ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Generate a group code (ABC-1234 format)
 */
function generateGroupCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return code;
}

// ==========================================
// API ROUTES - USERS
// ==========================================

/**
 * POST /api/users/login
 * Login or create a user
 */
app.post('/api/users/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  const db = loadDatabase();
  
  // Check if user exists
  let user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    // Create new user
    user = {
      id: generateId(),
      username: username.trim(),
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    saveDatabase(db);
    console.log(`New user created: ${user.username}`);
  } else {
    console.log(`User logged in: ${user.username}`);
  }
  
  res.json({ success: true, user });
});

// ==========================================
// API ROUTES - GROUPS
// ==========================================

/**
 * GET /api/groups
 * Get all groups (optionally filter by user)
 */
app.get('/api/groups', (req, res) => {
  const { username } = req.query;
  const db = loadDatabase();
  
  let groups = db.groups;
  
  // If username provided, only return groups they're a member of
  if (username) {
    groups = groups.filter(g => g.members.includes(username));
  }
  
  res.json({ groups });
});

/**
 * GET /api/groups/:id
 * Get a specific group by ID
 */
app.get('/api/groups/:id', (req, res) => {
  const db = loadDatabase();
  const group = db.groups.find(g => g.id === req.params.id);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  res.json({ group });
});

/**
 * POST /api/groups
 * Create a new group
 */
app.post('/api/groups', (req, res) => {
  const { name, createdBy } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Group name is required' });
  }
  
  if (!createdBy) {
    return res.status(400).json({ error: 'Creator username is required' });
  }
  
  const db = loadDatabase();
  
  const newGroup = {
    id: generateId(),
    name: name.trim(),
    code: generateGroupCode(),
    members: [createdBy],
    createdBy: createdBy,
    createdAt: new Date().toISOString(),
    hangouts: [],
    messages: []
  };
  
  db.groups.push(newGroup);
  saveDatabase(db);
  
  console.log(`Group created: ${newGroup.name} (${newGroup.code})`);
  res.json({ success: true, group: newGroup });
});

/**
 * POST /api/groups/join
 * Join a group using a code
 */
app.post('/api/groups/join', (req, res) => {
  const { code, username } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Group code is required' });
  }
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  const db = loadDatabase();
  const group = db.groups.find(g => g.code.toUpperCase() === code.toUpperCase());
  
  if (!group) {
    return res.status(404).json({ error: 'No group found with that code' });
  }
  
  if (group.members.includes(username)) {
    return res.status(400).json({ error: 'You are already in this group' });
  }
  
  group.members.push(username);
  saveDatabase(db);
  
  console.log(`${username} joined group: ${group.name}`);
  res.json({ success: true, group });
});

/**
 * POST /api/groups/:id/leave
 * Leave a group
 */
app.post('/api/groups/:id/leave', (req, res) => {
  const { username } = req.body;
  const db = loadDatabase();
  const groupIndex = db.groups.findIndex(g => g.id === req.params.id);
  
  if (groupIndex === -1) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  const group = db.groups[groupIndex];
  group.members = group.members.filter(m => m !== username);
  
  // Delete group if no members left
  if (group.members.length === 0) {
    db.groups.splice(groupIndex, 1);
    console.log(`Group deleted (no members): ${group.name}`);
  } else {
    console.log(`${username} left group: ${group.name}`);
  }
  
  saveDatabase(db);
  res.json({ success: true, deleted: group.members.length === 0 });
});

// ==========================================
// API ROUTES - HANGOUTS
// ==========================================

/**
 * POST /api/groups/:id/hangouts
 * Create a new hangout in a group
 */
app.post('/api/groups/:id/hangouts', (req, res) => {
  const { title, date, time, location, description, proposedBy } = req.body;
  
  if (!title || !date || !time || !location) {
    return res.status(400).json({ error: 'Title, date, time, and location are required' });
  }
  
  const db = loadDatabase();
  const group = db.groups.find(g => g.id === req.params.id);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  const newHangout = {
    id: generateId(),
    title: title.trim(),
    date,
    time,
    location: location.trim(),
    description: description ? description.trim() : '',
    proposedBy,
    createdAt: new Date().toISOString(),
    responses: { [proposedBy]: 'going' }
  };
  
  group.hangouts.push(newHangout);
  saveDatabase(db);
  
  console.log(`Hangout created in ${group.name}: ${newHangout.title}`);
  res.json({ success: true, hangout: newHangout, hangouts: group.hangouts });
});

/**
 * POST /api/groups/:groupId/hangouts/:hangoutId/respond
 * Respond to a hangout (going, maybe, notGoing)
 */
app.post('/api/groups/:groupId/hangouts/:hangoutId/respond', (req, res) => {
  const { username, response } = req.body;
  
  if (!['going', 'maybe', 'notGoing'].includes(response)) {
    return res.status(400).json({ error: 'Invalid response. Must be: going, maybe, or notGoing' });
  }
  
  const db = loadDatabase();
  const group = db.groups.find(g => g.id === req.params.groupId);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  const hangout = group.hangouts.find(h => h.id === req.params.hangoutId);
  
  if (!hangout) {
    return res.status(404).json({ error: 'Hangout not found' });
  }
  
  hangout.responses[username] = response;
  saveDatabase(db);
  
  console.log(`${username} responded "${response}" to: ${hangout.title}`);
  res.json({ success: true, hangout });
});

/**
 * DELETE /api/groups/:groupId/hangouts/:hangoutId
 * Delete a hangout
 */
app.delete('/api/groups/:groupId/hangouts/:hangoutId', (req, res) => {
  const db = loadDatabase();
  const group = db.groups.find(g => g.id === req.params.groupId);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  const hangoutIndex = group.hangouts.findIndex(h => h.id === req.params.hangoutId);
  
  if (hangoutIndex === -1) {
    return res.status(404).json({ error: 'Hangout not found' });
  }
  
  const hangout = group.hangouts[hangoutIndex];
  
  group.hangouts.splice(hangoutIndex, 1);
  saveDatabase(db);
  
  console.log(`Hangout deleted: ${hangout.title}`);
  res.json({ success: true });
});

// ==========================================
// API ROUTES - MESSAGES (Chat)
// ==========================================

/**
 * GET /api/groups/:id/messages
 * Get all messages for a group
 */
app.get('/api/groups/:id/messages', (req, res) => {
  const db = loadDatabase();
  const group = db.groups.find(g => g.id === req.params.id);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  res.json({ messages: group.messages || [] });
});

/**
 * POST /api/groups/:id/messages
 * Send a message in a group
 */
app.post('/api/groups/:id/messages', (req, res) => {
  const { text, sender } = req.body;
  
  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Message text is required' });
  }
  
  const db = loadDatabase();
  const group = db.groups.find(g => g.id === req.params.id);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  if (!group.messages) {
    group.messages = [];
  }
  
  const newMessage = {
    id: generateId(),
    text: text.trim(),
    sender,
    timestamp: new Date().toISOString(),
    reactions: {}
  };
  
  group.messages.push(newMessage);
  saveDatabase(db);
  
  // Return success flag and all messages so frontend can sync
  res.json({ success: true, message: newMessage, messages: group.messages });
});

/**
 * POST /api/groups/:groupId/messages/:messageId/react
 * Add or remove a reaction to a message
 */
app.post('/api/groups/:groupId/messages/:messageId/react', (req, res) => {
  const { username, emoji } = req.body;
  
  const db = loadDatabase();
  const group = db.groups.find(g => g.id === req.params.groupId);
  
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  const message = group.messages.find(m => m.id === req.params.messageId);
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  if (!message.reactions) {
    message.reactions = {};
  }
  
  if (!message.reactions[emoji]) {
    message.reactions[emoji] = [];
  }
  
  const userIndex = message.reactions[emoji].indexOf(username);
  
  if (userIndex === -1) {
    // Add reaction
    message.reactions[emoji].push(username);
  } else {
    // Remove reaction
    message.reactions[emoji].splice(userIndex, 1);
    if (message.reactions[emoji].length === 0) {
      delete message.reactions[emoji];
    }
  }
  
  saveDatabase(db);
  res.json({ success: true, message });
});

// ==========================================
// START THE SERVER
// ==========================================

app.listen(PORT, () => {
  console.log('');
  console.log('🐝 ================================== 🐝');
  console.log('   HANG HIVE SERVER IS RUNNING!');
  console.log('🐝 ================================== 🐝');
  console.log('');
  console.log(`   Open your browser to:`);
  console.log(`   http://localhost:${PORT}`);
  console.log('');
  console.log('   Press Ctrl+C to stop the server');
  console.log('');
});
