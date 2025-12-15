/*
  ============================================================
  HELPER FUNCTIONS - helpers.js
  ============================================================
  Small utility functions used throughout the app
*/

/**
 * Generate a random ID for new items
 * Example: "k8j2m9"
 */
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Generate a group code for sharing
 * Example: "ABC-1234"
 */
function generateGroupCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  // Pick 3 random letters
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  code += '-';
  
  // Pick 4 random numbers
  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return code;
}

/**
 * Format a date nicely
 * Input: "2024-03-15"
 * Output: "March 15, 2024"
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format a time nicely
 * Input: "14:30"
 * Output: "2:30 PM"
 */
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Format a timestamp for chat messages
 * Shows time like "2:30 PM" or "Yesterday" or "Mar 15"
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  
  // Check if it's today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  }
  
  // Check if it's yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  // Otherwise show the date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Figure out the status of a hangout based on responses
 * Returns: "confirmed", "pending", or "cancelled"
 */
function getHangoutStatus(hangout, memberCount) {
  const responses = Object.values(hangout.responses);
  const goingCount = responses.filter(r => r === 'going').length;
  const notGoingCount = responses.filter(r => r === 'notGoing').length;
  
  // If more than half are going, it's confirmed!
  if (goingCount > memberCount / 2) {
    return 'confirmed';
  }
  
  // If more than half said no, it's cancelled
  if (notGoingCount > memberCount / 2) {
    return 'cancelled';
  }
  
  // Otherwise, still waiting for responses
  return 'pending';
}

/**
 * Copy text to the clipboard
 * Used for copying group codes
 */
function copyToClipboard(text) {
  // Modern way
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    return;
  }
  
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/**
 * Check if a hangout matches the search term
 * Used for filtering hangouts
 */
function hangoutMatchesSearch(hangout, searchTerm) {
  const term = searchTerm.toLowerCase();
  return (
    hangout.title.toLowerCase().includes(term) ||
    hangout.location.toLowerCase().includes(term) ||
    hangout.description.toLowerCase().includes(term)
  );
}

/**
 * Check if a group matches the search term
 * Used for filtering groups
 */
function groupMatchesSearch(group, searchTerm) {
  const term = searchTerm.toLowerCase();
  return (
    group.name.toLowerCase().includes(term) ||
    group.code.toLowerCase().includes(term)
  );
}

/**
 * Get all emojis available for reactions
 */
function getReactionEmojis() {
  return ['👍', '❤️', '😂', '🎉', '🔥', '👀'];
}
