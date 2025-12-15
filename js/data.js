/*
  ============================================================
  DATA MANAGEMENT - data.js
  ============================================================
  Handles saving and loading data from localStorage
  
  localStorage is like a small database in your browser
  that saves data even after you close the browser.
*/

// The "keys" we use to store data (like folder names)
const STORAGE_KEY_GROUPS = 'hang-hive-groups';
const STORAGE_KEY_DARK_MODE = 'hangHive-darkMode';
const STORAGE_KEY_USER = 'hangHive-user';

// ==========================================
// LOAD DATA FROM STORAGE
// ==========================================

/**
 * Load all groups from localStorage
 * Returns an empty array if nothing is saved yet
 */
function loadGroups() {
  const saved = localStorage.getItem(STORAGE_KEY_GROUPS);
  if (saved) {
    return JSON.parse(saved);
  }
  return [];
}

/**
 * Load the current user from localStorage
 * Returns null if no one is logged in
 */
function loadUser() {
  const saved = localStorage.getItem(STORAGE_KEY_USER);
  if (saved) {
    return JSON.parse(saved);
  }
  return null;
}

/**
 * Check if dark mode is enabled
 */
function loadDarkMode() {
  return localStorage.getItem(STORAGE_KEY_DARK_MODE) === 'true';
}

// ==========================================
// SAVE DATA TO STORAGE
// ==========================================

/**
 * Save all groups to localStorage
 */
function saveGroups(groups) {
  localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
}

/**
 * Save the current user to localStorage
 */
function saveUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_USER);
  }
}

/**
 * Save dark mode preference
 */
function saveDarkMode(enabled) {
  localStorage.setItem(STORAGE_KEY_DARK_MODE, enabled.toString());
}

// ==========================================
// DATA STRUCTURE INFO (for reference)
// ==========================================

/*
  A GROUP looks like this:
  {
    id: "abc123",          - unique identifier
    name: "Friday Gamers", - name of the group
    code: "FRI-789",       - code to share with friends
    members: ["Alice", "Bob"], - list of member names
    createdBy: "Alice",    - who made the group
    createdAt: "2024-...", - when it was made
    hangouts: [...],       - list of hangouts (see below)
    messages: [...]        - list of chat messages (see below)
  }
  
  A HANGOUT looks like this:
  {
    id: "xyz789",
    title: "Movie Night",
    date: "2024-03-15",
    time: "7:00 PM",
    location: "Jake's house",
    description: "Bring snacks!",
    proposedBy: "Alice",
    createdAt: "2024-...",
    responses: {           - who responded and how
      "Alice": "going",
      "Bob": "maybe",
      "Carol": "notGoing"
    }
  }
  
  A MESSAGE looks like this:
  {
    id: "msg123",
    text: "Hey everyone!",
    sender: "Alice",
    timestamp: "2024-...",
    reactions: {           - emoji reactions
      "👍": ["Bob"],
      "❤️": ["Carol", "Dave"]
    }
  }
*/
