/*
  ============================================================
  LOGIN FUNCTIONS - login.js
  ============================================================
  Handles user login and logout
*/

/**
 * Handle when someone clicks the login button
 * Gets the username from the input and logs them in
 */
function handleLogin() {
  // Get the username they typed
  const usernameInput = document.getElementById('username-input');
  const username = usernameInput.value.trim();
  
  // Make sure they typed something
  if (username === '') {
    showToast('Please enter your name', 'error');
    return;
  }
  
  // Create the user object
  const user = {
    username: username,
    id: generateId()
  };
  
  // Save to localStorage
  saveUser(user);
  
  // Update the app state
  currentUser = user;
  
  // Show welcome message
  showToast(`Welcome, ${username}!`, 'success');
  
  // Clear the input
  usernameInput.value = '';
  
  // Go to the groups page
  showPage('groups');
}

/**
 * Handle when someone clicks logout
 */
function handleLogout() {
  // Clear the user from storage
  saveUser(null);
  
  // Clear the app state
  currentUser = null;
  currentGroup = null;
  
  // Show message
  showToast('Logged out successfully', 'info');
  
  // Go back to login page
  showPage('login');
}

/**
 * Set up the login page events
 * Called once when the app starts
 */
function setupLoginEvents() {
  // Login button click
  const loginButton = document.getElementById('login-button');
  if (loginButton) {
    loginButton.addEventListener('click', handleLogin);
  }
  
  // Also allow pressing Enter to login
  const usernameInput = document.getElementById('username-input');
  if (usernameInput) {
    usernameInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        handleLogin();
      }
    });
  }
}
