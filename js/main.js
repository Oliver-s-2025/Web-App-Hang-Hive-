/*
  ============================================================
  MAIN ENTRY POINT - main.js
  ============================================================
  This is the main file that Vite uses to bundle the app.
  It imports all modules and initializes everything.
*/

// Import Firebase
import { db } from './firebase.js';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc
} from 'firebase/firestore';

// ==========================================
// GLOBAL VARIABLES
// ==========================================
let currentUser = null;
let currentGroup = null;
let groups = [];
let isFirebaseAvailable = true;
let currentFilter = 'all';
let currentReactionMessageId = null;

// Storage keys for localStorage backup
const STORAGE_KEY_GROUPS = 'hang-hive-groups';
const STORAGE_KEY_DARK_MODE = 'hangHive-darkMode';
const STORAGE_KEY_USER = 'hangHive-user';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function generateGroupCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return code;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getHangoutStatus(hangout, memberCount) {
  const responses = Object.values(hangout.responses || {});
  const goingCount = responses.filter(r => r === 'going').length;
  const notGoingCount = responses.filter(r => r === 'notGoing').length;
  
  if (goingCount >= Math.ceil(memberCount / 2)) return 'confirmed';
  if (notGoingCount >= Math.ceil(memberCount / 2)) return 'cancelled';
  return 'pending';
}

// ==========================================
// LOCAL STORAGE FUNCTIONS
// ==========================================

function loadUser() {
  const saved = localStorage.getItem(STORAGE_KEY_USER);
  return saved ? JSON.parse(saved) : null;
}

function saveUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_USER);
  }
}

function loadDarkMode() {
  return localStorage.getItem(STORAGE_KEY_DARK_MODE) === 'true';
}

function saveDarkMode(enabled) {
  localStorage.setItem(STORAGE_KEY_DARK_MODE, enabled.toString());
}

function loadGroups() {
  const saved = localStorage.getItem(STORAGE_KEY_GROUPS);
  return saved ? JSON.parse(saved) : [];
}

function saveGroups(groupsData) {
  localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groupsData));
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// PAGE NAVIGATION
// ==========================================

function showPage(pageName) {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('groups-page').classList.add('hidden');
  document.getElementById('hangout-page').classList.add('hidden');
  
  if (pageName === 'login') {
    document.getElementById('login-page').classList.remove('hidden');
  } else if (pageName === 'groups') {
    document.getElementById('groups-page').classList.remove('hidden');
    updateWelcomeMessage();
    renderGroups();
  } else if (pageName === 'hangout') {
    document.getElementById('hangout-page').classList.remove('hidden');
    renderHangouts();
    renderMessages();
    scrollChatToBottom();
  }
}

function updateWelcomeMessage() {
  const usernameSpan = document.getElementById('current-username');
  if (usernameSpan && currentUser) {
    usernameSpan.textContent = currentUser.username;
  }
}

// ==========================================
// DARK MODE
// ==========================================

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  saveDarkMode(isDark);
  
  const buttons = document.querySelectorAll('[id^="dark-mode-toggle"]');
  buttons.forEach(button => {
    button.textContent = isDark ? '☀️' : '🌙';
  });
}

function applyDarkMode() {
  const isDark = loadDarkMode();
  if (isDark) {
    document.body.classList.add('dark-mode');
  }
  
  const buttons = document.querySelectorAll('[id^="dark-mode-toggle"]');
  buttons.forEach(button => {
    button.textContent = isDark ? '☀️' : '🌙';
  });
}

// ==========================================
// FIREBASE FUNCTIONS
// ==========================================

async function loadGroupsFromFirebase() {
  try {
    // Simple query - get all groups, filter locally
    // This avoids needing Firebase indexes
    const groupsRef = collection(db, 'groups');
    const snapshot = await getDocs(groupsRef);
    
    groups = [];
    snapshot.forEach(docSnap => {
      const groupData = { id: docSnap.id, ...docSnap.data() };
      // Only include groups the user is a member of
      if (groupData.members && groupData.members.includes(currentUser.username)) {
        groups.push(groupData);
      }
    });
    
    saveGroups(groups);
    return groups;
  } catch (error) {
    console.error('Error loading groups from Firebase:', error);
    isFirebaseAvailable = false;
    // Fall back to local storage
    return loadGroups();
  }
}

async function saveGroupToFirebase(group) {
  if (!isFirebaseAvailable) {
    return false;
  }
  try {
    const groupRef = doc(db, 'groups', group.id);
    await setDoc(groupRef, group);
    return true;
  } catch (error) {
    console.error('Error saving group to Firebase:', error);
    isFirebaseAvailable = false;
    return false;
  }
}

// ==========================================
// LOGIN FUNCTIONS
// ==========================================

async function handleLogin() {
  const usernameInput = document.getElementById('username-input');
  const loginButton = document.getElementById('login-button');
  const username = usernameInput.value.trim();
  
  if (username === '') {
    showToast('Please enter a username', 'error');
    return;
  }
  
  if (username.length < 2) {
    showToast('Username must be at least 2 characters', 'error');
    return;
  }
  
  // Show loading state
  if (loginButton) {
    loginButton.textContent = 'Loading...';
    loginButton.disabled = true;
  }
  
  currentUser = {
    username: username,
    id: generateId(),
    createdAt: new Date().toISOString()
  };
  
  saveUser(currentUser);
  
  // Show the groups page immediately with local data
  groups = loadGroups();
  showToast(`Welcome, ${username}! 🐝`, 'success');
  showPage('groups');
  
  // Reset button
  if (loginButton) {
    loginButton.textContent = 'Enter the Hive 🐝';
    loginButton.disabled = false;
  }
  
  // Load from Firebase in background (non-blocking)
  loadGroupsFromFirebase().then(() => {
    renderGroups(); // Re-render with fresh data
  }).catch(err => {
    console.log('Firebase sync failed, using local data');
  });
}

function handleLogout() {
  currentUser = null;
  currentGroup = null;
  groups = [];
  saveUser(null);
  showToast('Logged out successfully', 'info');
  showPage('login');
}

// ==========================================
// GROUPS FUNCTIONS
// ==========================================

async function createGroup() {
  console.log('createGroup called');
  const nameInput = document.getElementById('new-group-name-input');
  const groupName = nameInput ? nameInput.value.trim() : '';
  console.log('groupName:', groupName);
  
  if (groupName === '') {
    showToast('Please enter a group name', 'error');
    return;
  }
  
  const newGroup = {
    id: generateId(),
    name: groupName,
    code: generateGroupCode(),
    members: [currentUser.username],
    createdBy: currentUser.username,
    createdAt: new Date().toISOString(),
    hangouts: [],
    messages: []
  };
  
  // Save to Firebase
  const saved = await saveGroupToFirebase(newGroup);
  
  if (saved) {
    groups.push(newGroup);
    saveGroups(groups);
    showToast(`Group "${groupName}" created! 🎉`, 'success');
    if (nameInput) nameInput.value = '';
    hideCreateGroupForm();
    renderGroups();
  } else {
    // Fallback to local only
    groups.push(newGroup);
    saveGroups(groups);
    showToast(`Group created (offline mode)`, 'info');
    if (nameInput) nameInput.value = '';
    hideCreateGroupForm();
    renderGroups();
  }
}

async function joinGroup() {
  console.log('joinGroup called');
  const codeInput = document.getElementById('join-code-input');
  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
  console.log('code:', code);
  
  if (code === '') {
    showToast('Please enter a group code', 'error');
    return;
  }
  
  showToast('Searching for group...', 'info');
  
  try {
    // Search for group by code in Firebase
    const groupsRef = collection(db, 'groups');
    const snapshot = await getDocs(groupsRef);
    
    let foundGroup = null;
    snapshot.forEach(docSnap => {
      const group = { id: docSnap.id, ...docSnap.data() };
      if (group.code === code) {
        foundGroup = group;
      }
    });
    
    if (!foundGroup) {
      showToast('No group found with that code', 'error');
      return;
    }
    
    if (foundGroup.members && foundGroup.members.includes(currentUser.username)) {
      showToast('You are already in this group', 'error');
      return;
    }
    
    // Add member to group
    if (!foundGroup.members) foundGroup.members = [];
    foundGroup.members.push(currentUser.username);
    await saveGroupToFirebase(foundGroup);
    
    groups.push(foundGroup);
    saveGroups(groups);
    
    showToast(`Joined "${foundGroup.name}"! 🎉`, 'success');
    clearJoinInput();
    renderGroups();
    
  } catch (error) {
    console.error('Error joining group:', error);
    showToast('Error joining group - check your connection', 'error');
  }
}

async function leaveGroup(groupId) {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  
  if (!confirm(`Leave "${group.name}"?`)) return;
  
  group.members = group.members.filter(m => m !== currentUser.username);
  
  if (group.members.length === 0) {
    // Delete group if empty
    try {
      await deleteDoc(doc(db, 'groups', groupId));
    } catch (error) {
      console.error('Error deleting group:', error);
    }
    groups = groups.filter(g => g.id !== groupId);
  } else {
    await saveGroupToFirebase(group);
    groups = groups.filter(g => g.id !== groupId);
  }
  
  saveGroups(groups);
  
  if (currentGroup && currentGroup.id === groupId) {
    currentGroup = null;
    showPage('groups');
  }
  
  showToast('Left the group', 'info');
  renderGroups();
}

function openGroup(groupId) {
  const group = groups.find(g => g.id === groupId);
  if (group) {
    currentGroup = group;
    showPage('hangout');
  }
}

function renderGroups() {
  const container = document.getElementById('groups-list');
  const noGroupsMessage = document.getElementById('no-groups-message');
  
  if (groups.length === 0) {
    if (noGroupsMessage) noGroupsMessage.classList.remove('hidden');
    if (container) container.innerHTML = '';
    return;
  }
  
  if (noGroupsMessage) noGroupsMessage.classList.add('hidden');
  
  let html = '';
  groups.forEach(group => {
    const memberCount = group.members.length;
    const hangoutCount = (group.hangouts || []).length;
    
    html += `
      <div class="group-card" onclick="window.openGroup('${group.id}')">
        <div class="group-card-header">
          <h3 class="group-name">${group.name}</h3>
          <span class="group-code">${group.code}</span>
        </div>
        <div class="group-card-info">
          <span>👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
          <span>📅 ${hangoutCount} hangout${hangoutCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
  });
  
  if (container) container.innerHTML = html;
}

function showCreateGroupForm() {
  console.log('showCreateGroupForm called');
  const form = document.getElementById('create-group-form');
  const btn = document.getElementById('show-create-group-button');
  console.log('form:', form, 'btn:', btn);
  if (form) form.classList.remove('hidden');
  if (btn) btn.classList.add('hidden');
}

function hideCreateGroupForm() {
  const form = document.getElementById('create-group-form');
  const btn = document.getElementById('show-create-group-button');
  const input = document.getElementById('new-group-name-input');
  if (form) form.classList.add('hidden');
  if (btn) btn.classList.remove('hidden');
  if (input) input.value = '';
}

function clearJoinInput() {
  const input = document.getElementById('join-code-input');
  if (input) input.value = '';
}

function copyGroupCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('Code copied! 📋', 'success');
  }).catch(() => {
    showToast('Could not copy code', 'error');
  });
}

// ==========================================
// HANGOUTS FUNCTIONS
// ==========================================

async function proposeHangout() {
  const title = document.getElementById('hangout-title-input').value.trim();
  const date = document.getElementById('hangout-date-input').value;
  const time = document.getElementById('hangout-time-input').value;
  const location = document.getElementById('hangout-location-input').value.trim();
  const description = document.getElementById('hangout-description-input').value.trim();
  
  if (!title || !date || !time || !location) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  const newHangout = {
    id: generateId(),
    title,
    date,
    time,
    location,
    description,
    proposedBy: currentUser.username,
    createdAt: new Date().toISOString(),
    responses: { [currentUser.username]: 'going' }
  };
  
  if (!currentGroup.hangouts) currentGroup.hangouts = [];
  currentGroup.hangouts.push(newHangout);
  
  await saveGroupToFirebase(currentGroup);
  saveGroups(groups);
  
  showToast('Hangout proposed! 🎉', 'success');
  hideHangoutForm();
  renderHangouts();
}

async function respondToHangout(hangoutId, response) {
  const hangout = currentGroup.hangouts.find(h => h.id === hangoutId);
  if (!hangout) return;
  
  hangout.responses[currentUser.username] = response;
  
  await saveGroupToFirebase(currentGroup);
  saveGroups(groups);
  
  if (response === 'going') {
    showToast('You\'re going! 🎉', 'success');
  } else if (response === 'maybe') {
    showToast('Marked as maybe 🤔', 'info');
  } else {
    showToast('Marked as not going', 'info');
  }
  
  renderHangouts();
}

async function deleteHangout(hangoutId) {
  const hangout = currentGroup.hangouts.find(h => h.id === hangoutId);
  if (!hangout) return;
  
  if (hangout.proposedBy !== currentUser.username) {
    showToast('Only the creator can delete this hangout', 'error');
    return;
  }
  
  if (!confirm(`Delete "${hangout.title}"?`)) return;
  
  currentGroup.hangouts = currentGroup.hangouts.filter(h => h.id !== hangoutId);
  
  await saveGroupToFirebase(currentGroup);
  saveGroups(groups);
  
  showToast('Hangout deleted', 'info');
  renderHangouts();
}

function setHangoutFilter(filter) {
  currentFilter = filter;
  
  const buttons = document.querySelectorAll('.filter-button');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  renderHangouts();
}

function renderHangouts() {
  const groupNameEl = document.getElementById('group-name-display');
  const groupCodeEl = document.getElementById('group-code-text');
  
  if (groupNameEl) groupNameEl.textContent = currentGroup.name;
  if (groupCodeEl) groupCodeEl.textContent = currentGroup.code;
  
  const now = new Date();
  let filteredHangouts = (currentGroup.hangouts || []).filter(hangout => {
    const hangoutDate = new Date(hangout.date);
    if (currentFilter === 'upcoming' && hangoutDate < now) return false;
    if (currentFilter === 'past' && hangoutDate >= now) return false;
    return true;
  });
  
  filteredHangouts.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const container = document.getElementById('hangouts-list');
  const noHangoutsMessage = document.getElementById('no-hangouts-message');
  
  if (filteredHangouts.length === 0) {
    if (noHangoutsMessage) noHangoutsMessage.classList.remove('hidden');
    if (container) {
      const cards = container.querySelectorAll('.hangout-card');
      cards.forEach(card => card.remove());
    }
    return;
  }
  
  if (noHangoutsMessage) noHangoutsMessage.classList.add('hidden');
  
  let html = '';
  filteredHangouts.forEach(hangout => {
    const status = getHangoutStatus(hangout, currentGroup.members.length);
    const myResponse = hangout.responses[currentUser.username] || 'none';
    const isCreator = hangout.proposedBy === currentUser.username;
    
    const responses = Object.values(hangout.responses || {});
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
          <button class="response-button going ${myResponse === 'going' ? 'selected' : ''}"
            onclick="window.respondToHangout('${hangout.id}', 'going')">✓ Going</button>
          <button class="response-button maybe ${myResponse === 'maybe' ? 'selected' : ''}"
            onclick="window.respondToHangout('${hangout.id}', 'maybe')">? Maybe</button>
          <button class="response-button not-going ${myResponse === 'notGoing' ? 'selected' : ''}"
            onclick="window.respondToHangout('${hangout.id}', 'notGoing')">✕ Can't Go</button>
        </div>
        ${isCreator ? `<button class="danger-button small delete-hangout" onclick="window.deleteHangout('${hangout.id}')">🗑️ Delete</button>` : ''}
      </div>
    `;
  });
  
  if (container) {
    const existingCards = container.querySelectorAll('.hangout-card');
    existingCards.forEach(card => card.remove());
    container.insertAdjacentHTML('beforeend', html);
  }
  
  renderMembers();
}

function renderMembers() {
  const container = document.getElementById('members-list');
  const countEl = document.getElementById('member-count');
  
  if (countEl) countEl.textContent = currentGroup.members.length;
  
  let html = '';
  currentGroup.members.forEach(member => {
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

function showHangoutForm() {
  const form = document.getElementById('new-hangout-form');
  if (form) form.classList.remove('hidden');
  
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('hangout-date-input');
  if (dateInput) dateInput.value = today;
}

function hideHangoutForm() {
  const form = document.getElementById('new-hangout-form');
  if (form) form.classList.add('hidden');
  
  ['hangout-title-input', 'hangout-date-input', 'hangout-time-input', 'hangout-location-input', 'hangout-description-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ==========================================
// CHAT FUNCTIONS
// ==========================================

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  
  if (text === '') return;
  
  input.value = '';
  
  const newMessage = {
    id: generateId(),
    text,
    sender: currentUser.username,
    timestamp: new Date().toISOString(),
    reactions: {}
  };
  
  if (!currentGroup.messages) currentGroup.messages = [];
  currentGroup.messages.push(newMessage);
  
  await saveGroupToFirebase(currentGroup);
  saveGroups(groups);
  
  renderMessages();
  scrollChatToBottom();
}

async function addReaction(messageId, emoji) {
  const message = currentGroup.messages.find(m => m.id === messageId);
  if (!message) return;
  
  if (!message.reactions) message.reactions = {};
  if (!message.reactions[emoji]) message.reactions[emoji] = [];
  
  const userIndex = message.reactions[emoji].indexOf(currentUser.username);
  
  if (userIndex === -1) {
    message.reactions[emoji].push(currentUser.username);
  } else {
    message.reactions[emoji].splice(userIndex, 1);
    if (message.reactions[emoji].length === 0) {
      delete message.reactions[emoji];
    }
  }
  
  await saveGroupToFirebase(currentGroup);
  saveGroups(groups);
  
  hideEmojiPicker();
  renderMessages();
}

function showEmojiPicker(messageId, buttonElement) {
  currentReactionMessageId = messageId;
  
  const picker = document.getElementById('emoji-picker');
  const rect = buttonElement.getBoundingClientRect();
  picker.style.top = (rect.bottom + 5) + 'px';
  picker.style.left = rect.left + 'px';
  picker.classList.remove('hidden');
}

function hideEmojiPicker() {
  document.getElementById('emoji-picker').classList.add('hidden');
  currentReactionMessageId = null;
}

function handleEmojiClick(emoji) {
  if (currentReactionMessageId) {
    addReaction(currentReactionMessageId, emoji);
  }
}

function renderMessages() {
  const container = document.getElementById('chat-messages');
  const noMessagesEl = document.getElementById('no-messages');
  
  if (!currentGroup.messages || currentGroup.messages.length === 0) {
    if (noMessagesEl) noMessagesEl.classList.remove('hidden');
    const existingMessages = container.querySelectorAll('.chat-message');
    existingMessages.forEach(msg => msg.remove());
    return;
  }
  
  if (noMessagesEl) noMessagesEl.classList.add('hidden');
  
  let html = '';
  currentGroup.messages.forEach(message => {
    const isOwn = message.sender === currentUser.username;
    const messageClass = isOwn ? 'sent' : 'received';
    
    let reactionsHtml = '';
    if (message.reactions && Object.keys(message.reactions).length > 0) {
      reactionsHtml = '<div class="message-reactions">';
      for (const emoji in message.reactions) {
        const users = message.reactions[emoji];
        const count = users.length;
        const userReacted = users.includes(currentUser.username);
        reactionsHtml += `
          <span class="reaction-badge ${userReacted ? 'user-reacted' : ''}"
            onclick="window.addReaction('${message.id}', '${emoji}')"
            title="${users.join(', ')}">${emoji} ${count}</span>
        `;
      }
      reactionsHtml += '</div>';
    }
    
    html += `
      <div class="chat-message ${messageClass}">
        <div class="message-bubble">
          ${!isOwn ? `<div class="message-sender">${message.sender}</div>` : ''}
          <div class="message-text">${message.text}</div>
          <div class="message-time">${formatTimestamp(message.timestamp)}</div>
          ${reactionsHtml}
        </div>
        <button class="add-reaction-button" onclick="window.showEmojiPicker('${message.id}', this)" title="Add reaction">😊</button>
      </div>
    `;
  });
  
  if (container) {
    const existingMessages = container.querySelectorAll('.chat-message');
    existingMessages.forEach(msg => msg.remove());
    container.insertAdjacentHTML('beforeend', html);
  }
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ==========================================
// EVENT SETUP
// ==========================================

function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Login
  const loginBtn = document.getElementById('login-button');
  const usernameInput = document.getElementById('username-input');
  console.log('login-button:', loginBtn, 'username-input:', usernameInput);
  
  loginBtn?.addEventListener('click', handleLogin);
  usernameInput?.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleLogin();
  });
  
  // Logout
  document.getElementById('logout-button')?.addEventListener('click', handleLogout);
  
  // Groups - matching HTML IDs
  const showCreateBtn = document.getElementById('show-create-group-button');
  const joinBtn = document.getElementById('join-group-button');
  const confirmCreateBtn = document.getElementById('confirm-create-group-button');
  const cancelCreateBtn = document.getElementById('cancel-create-group-button');
  
  console.log('show-create-group-button:', showCreateBtn);
  console.log('join-group-button:', joinBtn);
  console.log('confirm-create-group-button:', confirmCreateBtn);
  console.log('cancel-create-group-button:', cancelCreateBtn);
  
  showCreateBtn?.addEventListener('click', showCreateGroupForm);
  joinBtn?.addEventListener('click', joinGroup);
  confirmCreateBtn?.addEventListener('click', createGroup);
  cancelCreateBtn?.addEventListener('click', hideCreateGroupForm);
  
  console.log('Event listeners attached!');
  
  // Hangouts
  document.getElementById('back-to-groups-button')?.addEventListener('click', () => {
    currentGroup = null;
    showPage('groups');
  });
  document.getElementById('copy-code-button')?.addEventListener('click', () => copyGroupCode(currentGroup.code));
  document.getElementById('leave-group-button')?.addEventListener('click', () => leaveGroup(currentGroup.id));
  document.getElementById('propose-hangout-button')?.addEventListener('click', showHangoutForm);
  document.getElementById('cancel-hangout-button')?.addEventListener('click', hideHangoutForm);
  document.getElementById('submit-hangout-button')?.addEventListener('click', proposeHangout);
  
  // Filter buttons
  document.querySelectorAll('.filter-button').forEach(btn => {
    btn.addEventListener('click', () => setHangoutFilter(btn.getAttribute('data-filter')));
  });
  
  // Chat
  document.getElementById('send-message-button')?.addEventListener('click', sendMessage);
  document.getElementById('chat-input')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Emoji picker
  document.querySelectorAll('.emoji-option').forEach(btn => {
    btn.addEventListener('click', () => handleEmojiClick(btn.getAttribute('data-emoji')));
  });
  
  document.addEventListener('click', e => {
    const picker = document.getElementById('emoji-picker');
    if (picker && !picker.classList.contains('hidden')) {
      if (!picker.contains(e.target) && !e.target.classList.contains('add-reaction-button')) {
        hideEmojiPicker();
      }
    }
  });
  
  // Dark mode
  document.querySelectorAll('[id^="dark-mode-toggle"]').forEach(btn => {
    btn.addEventListener('click', toggleDarkMode);
  });
}

// ==========================================
// EXPOSE FUNCTIONS TO WINDOW (for onclick handlers)
// ==========================================

window.openGroup = openGroup;
window.respondToHangout = respondToHangout;
window.deleteHangout = deleteHangout;
window.addReaction = addReaction;
window.showEmojiPicker = showEmojiPicker;

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeApp() {
  console.log('🐝 HangHive is starting up!');
  
  // Load from localStorage first (fast)
  groups = loadGroups();
  currentUser = loadUser();
  
  // Apply dark mode
  applyDarkMode();
  
  // Setup event listeners
  setupEventListeners();
  
  // Show appropriate page immediately (don't wait for Firebase)
  if (currentUser) {
    showPage('groups');
    
    // Load from Firebase in background (non-blocking)
    loadGroupsFromFirebase().then(() => {
      renderGroups(); // Re-render with fresh data
      console.log('✅ Synced with Firebase');
    }).catch(err => {
      console.log('⚠️ Firebase unavailable, using local data');
    });
  } else {
    showPage('login');
  }
  
  console.log('✅ HangHive is ready!');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
