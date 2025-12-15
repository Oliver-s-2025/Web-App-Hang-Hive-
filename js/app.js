/*
  ============================================================
  MAIN APP - app.js
  ============================================================
  This is the main file that starts everything!
  It loads when the page opens and sets up the whole app.
*/

// ==========================================
// GLOBAL VARIABLES
// ==========================================

// These store the current state of the app
let currentUser = null;    // Who is logged in
let currentGroup = null;   // Which group we're looking at
let groups = [];           // All groups from storage

// ==========================================
// PAGE NAVIGATION
// ==========================================

/**
 * Switch between pages
 * @param {string} pageName - "login", "groups", or "hangout"
 */
function showPage(pageName) {
  // Hide all pages first
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('groups-page').classList.add('hidden');
  document.getElementById('hangout-page').classList.add('hidden');
  
  // Show the requested page
  if (pageName === 'login') {
    document.getElementById('login-page').classList.remove('hidden');
  }
  else if (pageName === 'groups') {
    document.getElementById('groups-page').classList.remove('hidden');
    // Update the display
    updateWelcomeMessage();
    renderGroups();
  }
  else if (pageName === 'hangout') {
    document.getElementById('hangout-page').classList.remove('hidden');
    // Update the display
    renderHangouts();
    renderMessages();
    scrollChatToBottom();
  }
}

/**
 * Update the welcome message with the user's name
 */
function updateWelcomeMessage() {
  const usernameSpan = document.getElementById('current-username');
  if (usernameSpan && currentUser) {
    usernameSpan.textContent = currentUser.username;
  }
}

// ==========================================
// DARK MODE
// ==========================================

/**
 * Toggle dark mode on/off
 */
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  saveDarkMode(isDark);
  
  // Update all dark mode toggle buttons
  const buttons = document.querySelectorAll('[id^="dark-mode-toggle"]');
  buttons.forEach(function(button) {
    button.textContent = isDark ? '☀️' : '🌙';
  });
}

/**
 * Apply dark mode if it was saved
 */
function applyDarkMode() {
  const isDark = loadDarkMode();
  if (isDark) {
    document.body.classList.add('dark-mode');
  }
  
  // Set button text on all dark mode buttons
  const buttons = document.querySelectorAll('[id^="dark-mode-toggle"]');
  buttons.forEach(function(button) {
    button.textContent = isDark ? '☀️' : '🌙';
  });
}

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * This function runs when the page first loads
 * It sets everything up!
 */
function initializeApp() {
  console.log('🐝 HangHive is starting up!');
  
  // Load saved data from localStorage
  groups = loadGroups();
  currentUser = loadUser();
  
  // Apply dark mode if saved
  applyDarkMode();
  
  // Set up all event listeners
  setupLoginEvents();
  setupGroupsEvents();
  setupHangoutEvents();
  setupChatEvents();
  
  // Dark mode toggle buttons (there are multiple)
  const darkModeButtons = document.querySelectorAll('[id^="dark-mode-toggle"]');
  darkModeButtons.forEach(function(button) {
    button.addEventListener('click', toggleDarkMode);
  });
  
  // Show the right page
  if (currentUser) {
    // User is already logged in
    showPage('groups');
  } else {
    // User needs to log in
    showPage('login');
  }
  
  console.log('✅ HangHive is ready!');
}

// ==========================================
// START THE APP!
// ==========================================

// Wait for the page to fully load, then start
document.addEventListener('DOMContentLoaded', initializeApp);
