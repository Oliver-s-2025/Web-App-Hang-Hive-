/*
  ============================================================
  GROUPS FUNCTIONS - groups.js
  ============================================================
  Handles creating, joining, and displaying groups
*/

/**
 * Create a new group
 * Called when the user fills out the create group form
 */
function createGroup() {
  // Get the group name from the input
  const nameInput = document.getElementById('new-group-name-input');
  const groupName = nameInput.value.trim();
  
  // Make sure they entered a name
  if (groupName === '') {
    showToast('Please enter a group name', 'error');
    return;
  }
  
  // Create the new group object
  const newGroup = {
    id: generateId(),
    name: groupName,
    code: generateGroupCode(),
    members: [currentUser.username],  // Creator is first member
    createdBy: currentUser.username,
    createdAt: new Date().toISOString(),
    hangouts: [],
    messages: []
  };
  
  // Add to our list of groups
  groups.push(newGroup);
  
  // Save to localStorage
  saveGroups(groups);
  
  // Show success message with the code
  showToast(`Group created! Code: ${newGroup.code}`, 'success');
  
  // Clear the input
  nameInput.value = '';
  
  // Hide the create form
  hideCreateGroupForm();
  
  // Refresh the groups list
  renderGroups();
}

/**
 * Join an existing group using a code
 */
function joinGroup() {
  // Get the code they entered
  const codeInput = document.getElementById('join-code-input');
  const code = codeInput.value.trim().toUpperCase();
  
  // Make sure they entered a code
  if (code === '') {
    showToast('Please enter a group code', 'error');
    return;
  }
  
  // Find the group with this code
  const group = groups.find(function(g) {
    return g.code === code;
  });
  
  // Check if group exists
  if (!group) {
    showToast('No group found with that code', 'error');
    return;
  }
  
  // Check if already a member
  if (group.members.includes(currentUser.username)) {
    showToast('You are already in this group', 'error');
    return;
  }
  
  // Add user to the group
  group.members.push(currentUser.username);
  
  // Save changes
  saveGroups(groups);
  
  // Show success
  showToast(`Joined "${group.name}"!`, 'success');
  
  // Clear the input
  codeInput.value = '';
  
  // Refresh the list
  renderGroups();
}

/**
 * Leave a group
 */
function leaveGroup(groupId) {
  // Find the group
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  
  // Confirm they want to leave
  if (!confirm(`Are you sure you want to leave "${group.name}"?`)) {
    return;
  }
  
  // Remove user from members
  group.members = group.members.filter(function(member) {
    return member !== currentUser.username;
  });
  
  // If group is empty, delete it
  if (group.members.length === 0) {
    groups = groups.filter(g => g.id !== groupId);
    showToast('Group deleted (no members left)', 'info');
  } else {
    showToast(`Left "${group.name}"`, 'info');
  }
  
  // Save changes
  saveGroups(groups);
  
  // Go back to groups list
  currentGroup = null;
  showPage('groups');
}

/**
 * Open a group to see its hangouts
 */
function openGroup(groupId) {
  // Find the group
  const group = groups.find(g => g.id === groupId);
  if (!group) {
    showToast('Group not found', 'error');
    return;
  }
  
  // Set as current group
  currentGroup = group;
  
  // Go to the hangout page
  showPage('hangout');
}

/**
 * Display all groups the user is in
 */
function renderGroups() {
  // Get the container for group cards
  const container = document.getElementById('groups-list');
  const noGroupsMessage = document.getElementById('no-groups-message');
  
  // Find groups the user is a member of
  const searchInput = document.getElementById('search-groups-input');
  const searchTerm = searchInput ? searchInput.value : '';
  
  const myGroups = groups.filter(function(group) {
    const isMember = group.members.includes(currentUser.username);
    const matchesSearch = groupMatchesSearch(group, searchTerm);
    return isMember && matchesSearch;
  });
  
  // If no groups, show empty state
  if (myGroups.length === 0) {
    if (noGroupsMessage) noGroupsMessage.classList.remove('hidden');
    if (container) container.innerHTML = '';
    return;
  }
  
  // Hide empty state
  if (noGroupsMessage) noGroupsMessage.classList.add('hidden');
  
  // Build HTML for each group
  let html = '';
  
  myGroups.forEach(function(group) {
    const memberCount = group.members.length;
    const hangoutCount = group.hangouts ? group.hangouts.length : 0;
    
    html += `
      <div class="group-card" onclick="openGroup('${group.id}')">
        <div class="group-card-header">
          <h3 class="group-name">${group.name}</h3>
          <span class="group-code">${group.code}</span>
        </div>
        <div class="group-card-stats">
          <span>👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
          <span>📅 ${hangoutCount} hangout${hangoutCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="group-card-actions">
          <button class="secondary-button small" onclick="event.stopPropagation(); copyGroupCode('${group.code}')">
            📋 Copy Code
          </button>
          <button class="danger-button small" onclick="event.stopPropagation(); leaveGroup('${group.id}')">
            🚪 Leave
          </button>
        </div>
      </div>
    `;
  });
  
  if (container) container.innerHTML = html;
}

/**
 * Copy a group code to clipboard
 */
function copyGroupCode(code) {
  copyToClipboard(code);
  showToast('Code copied! Share it with friends', 'success');
}

/**
 * Show the create group form
 */
function showCreateGroupForm() {
  const form = document.getElementById('create-group-form');
  const button = document.getElementById('show-create-group-button');
  if (form) form.classList.remove('hidden');
  if (button) button.classList.add('hidden');
}

/**
 * Hide the create group form
 */
function hideCreateGroupForm() {
  const form = document.getElementById('create-group-form');
  const button = document.getElementById('show-create-group-button');
  const input = document.getElementById('new-group-name-input');
  if (form) form.classList.add('hidden');
  if (button) button.classList.remove('hidden');
  if (input) input.value = '';
}

/**
 * Set up event listeners for the groups page
 */
function setupGroupsEvents() {
  // Create group buttons
  const showCreateBtn = document.getElementById('show-create-group-button');
  const cancelCreateBtn = document.getElementById('cancel-create-group-button');
  const confirmCreateBtn = document.getElementById('confirm-create-group-button');
  
  if (showCreateBtn) showCreateBtn.addEventListener('click', showCreateGroupForm);
  if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', hideCreateGroupForm);
  if (confirmCreateBtn) confirmCreateBtn.addEventListener('click', createGroup);
  
  // Join group button
  const joinBtn = document.getElementById('join-group-button');
  if (joinBtn) joinBtn.addEventListener('click', joinGroup);
  
  // Search input
  const searchInput = document.getElementById('search-groups-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderGroups);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-button');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  // Allow Enter key in forms
  const groupNameInput = document.getElementById('new-group-name-input');
  if (groupNameInput) {
    groupNameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') createGroup();
    });
  }
  
  const joinCodeInput = document.getElementById('join-code-input');
  if (joinCodeInput) {
    joinCodeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') joinGroup();
    });
  }
}
