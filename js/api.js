/*
  ============================================================
  API FUNCTIONS - api.js
  ============================================================
  Functions to communicate with the backend server.
  
  All data is now stored on the server, not in localStorage.
  This means multiple people can use the app together!
*/

// The URL of our backend server
const API_URL = '/api';

// Track if server is available (set during initialization)
let isServerAvailable = false;

// ==========================================
// HELPER FUNCTION
// ==========================================

/**
 * Make an API request
 * This is used by all the other functions below
 */
async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Something went wrong');
    }
    
    return result;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ==========================================
// USER API FUNCTIONS
// ==========================================

/**
 * Login or create a user
 */
async function apiLogin(username) {
  const result = await apiRequest('/users/login', 'POST', { username });
  return result.user;
}

// ==========================================
// GROUPS API FUNCTIONS
// ==========================================

/**
 * Get all groups for a user
 */
async function apiGetGroups(username) {
  const result = await apiRequest(`/groups?username=${encodeURIComponent(username)}`);
  return result.groups;
}

/**
 * Get a single group by ID
 */
async function apiGetGroup(groupId) {
  const result = await apiRequest(`/groups/${groupId}`);
  return result.group;
}

/**
 * Create a new group
 */
async function apiCreateGroup(name, createdBy) {
  const result = await apiRequest('/groups', 'POST', { name, createdBy });
  return result.group;
}

/**
 * Join a group using a code
 */
async function apiJoinGroup(code, username) {
  const result = await apiRequest('/groups/join', 'POST', { code, username });
  return result.group;
}

/**
 * Leave a group
 */
async function apiLeaveGroup(groupId, username) {
  const result = await apiRequest(`/groups/${groupId}/leave`, 'POST', { username });
  return result;
}

// ==========================================
// HANGOUTS API FUNCTIONS
// ==========================================

/**
 * Create a new hangout
 */
async function apiCreateHangout(groupId, hangoutData) {
  const result = await apiRequest(`/groups/${groupId}/hangouts`, 'POST', hangoutData);
  return result;
}

/**
 * Respond to a hangout (going, maybe, notGoing)
 */
async function apiRespondToHangout(groupId, hangoutId, username, response) {
  const result = await apiRequest(
    `/groups/${groupId}/hangouts/${hangoutId}/respond`,
    'POST',
    { username, response }
  );
  return result;
}

/**
 * Delete a hangout
 */
async function apiDeleteHangout(groupId, hangoutId, username) {
  const result = await apiRequest(
    `/groups/${groupId}/hangouts/${hangoutId}`,
    'DELETE',
    { username }
  );
  return result;
}

// ==========================================
// MESSAGES API FUNCTIONS
// ==========================================

/**
 * Get all messages for a group
 */
async function apiGetMessages(groupId) {
  const result = await apiRequest(`/groups/${groupId}/messages`);
  return result.messages;
}

/**
 * Send a message
 */
async function apiSendMessage(groupId, text, sender) {
  const result = await apiRequest(`/groups/${groupId}/messages`, 'POST', { text, sender });
  return result;
}

/**
 * Add or remove a reaction to a message
 */
async function apiReactToMessage(groupId, messageId, username, emoji) {
  const result = await apiRequest(
    `/groups/${groupId}/messages/${messageId}/react`,
    'POST',
    { username, emoji }
  );
  return result;
}

// ==========================================
// API OBJECT - Clean interface for the rest of the app
// ==========================================

/**
 * The API object provides a clean way to call server functions.
 * Instead of: apiCreateGroup(name, user)
 * You can use: API.createGroup(name, user)
 */
const API = {
  // User functions
  login: async function(username) {
    const result = await apiRequest('/users/login', 'POST', { username });
    return result;
  },
  
  // Group functions
  getGroups: apiGetGroups,
  getGroup: apiGetGroup,
  createGroup: async function(name, createdBy) {
    const result = await apiRequest('/groups', 'POST', { name, createdBy });
    return result;
  },
  joinGroupByCode: async function(code, username) {
    const result = await apiRequest('/groups/join', 'POST', { code, username });
    return result;
  },
  leaveGroup: async function(groupId, username) {
    const result = await apiRequest(`/groups/${groupId}/leave`, 'POST', { username });
    return result;
  },
  
  // Hangout functions
  createHangout: async function(groupId, hangoutData) {
    const result = await apiRequest(`/groups/${groupId}/hangouts`, 'POST', hangoutData);
    return result;
  },
  respondToHangout: async function(groupId, hangoutId, username, response) {
    const result = await apiRequest(
      `/groups/${groupId}/hangouts/${hangoutId}/respond`,
      'POST',
      { username, response }
    );
    return result;
  },
  deleteHangout: async function(groupId, hangoutId) {
    const result = await apiRequest(`/groups/${groupId}/hangouts/${hangoutId}`, 'DELETE');
    return result;
  },
  
  // Message functions
  sendMessage: async function(groupId, text, sender) {
    const result = await apiRequest(`/groups/${groupId}/messages`, 'POST', { text, sender });
    return result;
  },
  addReaction: async function(groupId, messageId, emoji, username) {
    const result = await apiRequest(
      `/groups/${groupId}/messages/${messageId}/react`,
      'POST',
      { username, emoji }
    );
    return result;
  }
};
