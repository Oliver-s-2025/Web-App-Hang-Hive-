/*
  ============================================================
  TOAST NOTIFICATIONS - toast.js
  ============================================================
  Shows little popup messages at the bottom of the screen
  
  Example: When you copy a code, a toast says "Code copied!"
*/

/**
 * Show a toast notification
 * 
 * @param {string} message - What to say
 * @param {string} type - "success", "error", or "info"
 */
function showToast(message, type = 'success') {
  // Find the toast container
  const container = document.getElementById('toast-container');
  
  // Create a new toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Choose icon based on type
  let icon = '';
  if (type === 'success') {
    icon = '✓';
  } else if (type === 'error') {
    icon = '✕';
  } else {
    icon = 'ℹ';
  }
  
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  
  // Add it to the container
  container.appendChild(toast);
  
  // Remove it after 3 seconds
  setTimeout(function() {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(function() {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
