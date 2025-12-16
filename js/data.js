/*
  ============================================================
  DATA MANAGEMENT - data.js
  ============================================================
  Handles saving and loading data.
  
  This file now works with the backend server (api.js).
  It also keeps a local copy in localStorage as a fallback.
*/

// The "keys" we use to store data locally (like folder names)
const STORAGE_KEY_GROUPS = 'hang-hive-groups';
const STORAGE_KEY_DARK_MODE = 'hangHive-darkMode';
const STORAGE_KEY_USER = 'hangHive-user';

// ==========================================
// LOCAL STORAGE FUNCTIONS (for dark mode and user session)
// ==========================================

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
 * Check if dark mode is enabled
 */
function loadDarkMode() {
  return localStorage.getItem(STORAGE_KEY_DARK_MODE) === 'true';
}

/**
 * Save dark mode preference
 */
function saveDarkMode(enabled) {
  localStorage.setItem(STORAGE_KEY_DARK_MODE, enabled.toString());
}

// ==========================================
// GROUPS - Now loaded from server
// ==========================================

/**
 * Load all groups from localStorage (synchronous, fast)
 * Used for initial load before server check
 */
function loadGroups() {
  const saved = localStorage.getItem(STORAGE_KEY_GROUPS);
  return saved ? JSON.parse(saved) : [];
}

/**
 * Save groups to localStorage
 */
function saveGroups(groupsData) {
  localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groupsData));
}

/**
 * Load all groups from the server
 * Falls back to localStorage if server is unavailable
 */
async function loadGroupsFromServer() {
  try {
    const serverGroups = await API.getGroups(currentUser.username);
    // Also save locally as backup
    localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(serverGroups));
    // Update the global groups variable
    groups = serverGroups;
    return serverGroups;
  } catch (error) {
    console.warn('Could not load from server, using local data:', error);
    const saved = localStorage.getItem(STORAGE_KEY_GROUPS);
    return saved ? JSON.parse(saved) : [];
  }
}

/**
 * Refresh the current group from the server
 */
async function refreshCurrentGroup() {
  if (!currentGroup) return;
  
  try {
    const group = await API.getGroup(currentGroup.id);
    currentGroup = group;
    
    // Update in the groups array too
    const index = groups.findIndex(g => g.id === group.id);
    if (index !== -1) {
      groups[index] = group;
    }
  } catch (error) {
    console.warn('Could not refresh group:', error);
  }
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
