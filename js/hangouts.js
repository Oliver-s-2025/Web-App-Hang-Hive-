/*
  ============================================================
  HANGOUTS FUNCTIONS - hangouts.js
  ============================================================
  Handles proposing, responding to, and displaying hangouts
*/

// Track current filter
let currentFilter = 'all';

/**
 * Propose a new hangout
 */
function proposeHangout() {
  // Get form values
  const title = document.getElementById('hangout-title-input').value.trim();
  const date = document.getElementById('hangout-date-input').value;
  const time = document.getElementById('hangout-time-input').value;
  const location = document.getElementById('hangout-location-input').value.trim();
  const description = document.getElementById('hangout-description-input').value.trim();
  
  // Validate required fields
  if (!title || !date || !time || !location) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  // Create the hangout
  const newHangout = {
    id: generateId(),
    title: title,
    date: date,
    time: time,
    location: location,
    description: description,
    proposedBy: currentUser.username,
    createdAt: new Date().toISOString(),
    responses: {}
  };
  
  // Proposer is automatically "going"
  newHangout.responses[currentUser.username] = 'going';
  
  // Add to the current group
  if (!currentGroup.hangouts) {
    currentGroup.hangouts = [];
  }
  currentGroup.hangouts.push(newHangout);
  
  // Save changes
  saveGroups(groups);
  
  // Show success
  showToast('Hangout proposed! 🎉', 'success');
  
  // Clear the form and hide it
  hideHangoutForm();
  
  // Refresh the display
  renderHangouts();
}

/**
 * Respond to a hangout (going, maybe, not going)
 */
function respondToHangout(hangoutId, response) {
  // Find the hangout
  const hangout = currentGroup.hangouts.find(h => h.id === hangoutId);
  if (!hangout) return;
  
  // Update their response
  hangout.responses[currentUser.username] = response;
  
  // Save changes
  saveGroups(groups);
  
  // Show message based on response
  if (response === 'going') {
    showToast('You\'re going! 🎉', 'success');
  } else if (response === 'maybe') {
    showToast('Marked as maybe 🤔', 'info');
  } else {
    showToast('Marked as not going', 'info');
  }
  
  // Refresh display
  renderHangouts();
}

/**
 * Delete a hangout (only the creator can do this)
 */
function deleteHangout(hangoutId) {
  // Find the hangout
  const hangout = currentGroup.hangouts.find(h => h.id === hangoutId);
  if (!hangout) return;
  
  // Check if user is the creator
  if (hangout.proposedBy !== currentUser.username) {
    showToast('Only the creator can delete this hangout', 'error');
    return;
  }
  
  // Confirm deletion
  if (!confirm(`Delete "${hangout.title}"?`)) {
    return;
  }
  
  // Remove the hangout
  currentGroup.hangouts = currentGroup.hangouts.filter(h => h.id !== hangoutId);
  
  // Save changes
  saveGroups(groups);
  
  // Show message
  showToast('Hangout deleted', 'info');
  
  // Refresh display
  renderHangouts();
}

/**
 * Set the filter for hangouts
 */
function setHangoutFilter(filter) {
  currentFilter = filter;
  
  // Update button styles
  const buttons = document.querySelectorAll('.filter-button');
  buttons.forEach(function(btn) {
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Re-render hangouts
  renderHangouts();
}

/**
 * Display all hangouts for the current group
 */
function renderHangouts() {
  // Update group name in header
  const groupNameEl = document.getElementById('group-name-display');
  const groupCodeEl = document.getElementById('group-code-text');
  
  if (groupNameEl) groupNameEl.textContent = currentGroup.name;
  if (groupCodeEl) groupCodeEl.textContent = currentGroup.code;
  
  // Get filter value
  const filter = currentFilter;
  const now = new Date();
  
  // Filter hangouts
  let filteredHangouts = (currentGroup.hangouts || []).filter(function(hangout) {
    const hangoutDate = new Date(hangout.date);
    
    if (filter === 'upcoming' && hangoutDate < now) return false;
    if (filter === 'past' && hangoutDate >= now) return false;
    
    return true;
  });
  
  // Sort by date (nearest first)
  filteredHangouts.sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  });
  
  // Get the container
  const container = document.getElementById('hangouts-list');
  const noHangoutsMessage = document.getElementById('no-hangouts-message');
  
  // Show empty state if no hangouts
  if (filteredHangouts.length === 0) {
    if (noHangoutsMessage) noHangoutsMessage.classList.remove('hidden');
    if (container) {
      // Keep the no-hangouts message, clear any cards
      const cards = container.querySelectorAll('.hangout-card');
      cards.forEach(card => card.remove());
    }
    return;
  }
  
  // Hide empty message
  if (noHangoutsMessage) noHangoutsMessage.classList.add('hidden');
  
  // Build HTML for each hangout
  let html = '';
  
  filteredHangouts.forEach(function(hangout) {
    const status = getHangoutStatus(hangout, currentGroup.members.length);
    const myResponse = hangout.responses[currentUser.username] || 'none';
    const isCreator = hangout.proposedBy === currentUser.username;
    
    // Count responses
    const responses = Object.values(hangout.responses);
    const goingCount = responses.filter(r => r === 'going').length;
    const maybeCount = responses.filter(r => r === 'maybe').length;
    const notGoingCount = responses.filter(r => r === 'notGoing').length;
    
    html += `
      <div class="hangout-card">
        <div class="hangout-header">
          <h3 class="hangout-title">${hangout.title}</h3>
          <span class="status-badge ${status}">${status}</span>
        </div>
        
        <div class="hangout-details">
          <p>📅 ${formatDate(hangout.date)} at ${formatTime(hangout.time)}</p>
          <p>📍 ${hangout.location}</p>
          ${hangout.description ? `<p>📝 ${hangout.description}</p>` : ''}
          <p class="proposed-by">Proposed by ${hangout.proposedBy}</p>
        </div>
        
        <div class="response-counts">
          <span class="count going">✓ ${goingCount} going</span>
          <span class="count maybe">? ${maybeCount} maybe</span>
          <span class="count not-going">✕ ${notGoingCount} not going</span>
        </div>
        
        <div class="response-buttons">
          <button 
            class="response-button going ${myResponse === 'going' ? 'selected' : ''}"
            onclick="respondToHangout('${hangout.id}', 'going')">
            ✓ Going
          </button>
          <button 
            class="response-button maybe ${myResponse === 'maybe' ? 'selected' : ''}"
            onclick="respondToHangout('${hangout.id}', 'maybe')">
            ? Maybe
          </button>
          <button 
            class="response-button not-going ${myResponse === 'notGoing' ? 'selected' : ''}"
            onclick="respondToHangout('${hangout.id}', 'notGoing')">
            ✕ Can't Go
          </button>
        </div>
        
        ${isCreator ? `
          <button class="danger-button small delete-hangout" onclick="deleteHangout('${hangout.id}')">
            🗑️ Delete
          </button>
        ` : ''}
      </div>
    `;
  });
  
  // Clear old cards and add new ones (keeping empty state div)
  if (container) {
    const existingCards = container.querySelectorAll('.hangout-card');
    existingCards.forEach(card => card.remove());
    container.insertAdjacentHTML('beforeend', html);
  }
  
  // Also render the members list
  renderMembers();
}

/**
 * Render the list of group members
 */
function renderMembers() {
  const container = document.getElementById('members-list');
  const countEl = document.getElementById('member-count');
  
  if (countEl) countEl.textContent = currentGroup.members.length;
  
  let html = '';
  
  currentGroup.members.forEach(function(member) {
    const isCurrentUser = member === currentUser.username;
    const isCreator = member === currentGroup.createdBy;
    
    html += `
      <div class="member-item ${isCurrentUser ? 'current-user' : ''}">
        <span class="member-avatar">${member.charAt(0).toUpperCase()}</span>
        <span class="member-name">${member}${isCurrentUser ? ' (you)' : ''}</span>
        ${isCreator ? '<span class="creator-badge">👑</span>' : ''}
      </div>
    `;
  });
  
  if (container) container.innerHTML = html;
}

/**
 * Show the form to propose a new hangout
 */
function showHangoutForm() {
  const form = document.getElementById('new-hangout-form');
  if (form) form.classList.remove('hidden');
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('hangout-date-input');
  if (dateInput) dateInput.value = today;
}

/**
 * Hide the hangout proposal form
 */
function hideHangoutForm() {
  const form = document.getElementById('new-hangout-form');
  if (form) form.classList.add('hidden');
  
  // Clear the form
  const inputs = ['hangout-title-input', 'hangout-date-input', 'hangout-time-input', 'hangout-location-input', 'hangout-description-input'];
  inputs.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

/**
 * Set up event listeners for the hangout page
 */
function setupHangoutEvents() {
  // Back button
  const backBtn = document.getElementById('back-to-groups-button');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      currentGroup = null;
      showPage('groups');
    });
  }
  
  // Copy group code
  const copyBtn = document.getElementById('copy-code-button');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      copyGroupCode(currentGroup.code);
    });
  }
  
  // Leave group
  const leaveBtn = document.getElementById('leave-group-button');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', function() {
      leaveGroup(currentGroup.id);
    });
  }
  
  // Propose hangout
  const proposeBtn = document.getElementById('propose-hangout-button');
  const cancelBtn = document.getElementById('cancel-hangout-button');
  const submitBtn = document.getElementById('submit-hangout-button');
  
  if (proposeBtn) proposeBtn.addEventListener('click', showHangoutForm);
  if (cancelBtn) cancelBtn.addEventListener('click', hideHangoutForm);
  if (submitBtn) submitBtn.addEventListener('click', proposeHangout);
  
  // Filter buttons
  const filterButtons = document.querySelectorAll('.filter-button');
  filterButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      setHangoutFilter(btn.getAttribute('data-filter'));
    });
  });
}
