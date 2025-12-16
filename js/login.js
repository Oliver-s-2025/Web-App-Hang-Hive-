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
async function handleLogin() {
  // Get the username they typed
  const usernameInput = document.getElementById('username-input');
  const username = usernameInput.value.trim();
  
  // Make sure they typed something
  if (username === '') {
    showToast('Please enter your name', 'error');
    return;
  }
  
  // Show loading state
  const loginButton = document.getElementById('login-button');
  const originalText = loginButton.textContent;
  loginButton.textContent = 'Logging in...';
  loginButton.disabled = true;
  
  try {
    // Login via API
    const user = await apiLogin(username);
    
    // Save to localStorage
    saveUser(user);
    
    // Update the app state
    currentUser = user;
    
    // Load groups from server
    groups = await loadGroupsFromServer();
    
    // Show welcome message
    showToast(`Welcome, ${user.username}!`, 'success');
    
    // Clear the input
    usernameInput.value = '';
    
    // Go to the groups page
    showPage('groups');
  } catch (error) {
    showToast('Could not connect to server. Please try again.', 'error');
    console.error('Login error:', error);
  } finally {
    // Reset button
    loginButton.textContent = originalText;
    loginButton.disabled = false;
  }
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
  groups = [];
  
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
