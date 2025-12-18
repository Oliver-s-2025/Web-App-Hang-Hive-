/*
  ============================================================
  MAIN.JS - Entry Point for Vite
  ============================================================
  This file imports all the modules and makes everything work.
  Vite bundles this file and all its imports into one file.
*/

// Import Firebase
import { db } from './firebase.js';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

// ==========================================
// CONSTANTS
// ==========================================
const STORAGE_KEY_GROUPS = 'hang-hive-groups';
const STORAGE_KEY_DARK_MODE = 'hangHive-darkMode';
const STORAGE_KEY_USER = 'hangHive-user';

// ==========================================
// GLOBAL VARIABLES
// ==========================================
let currentUser = null;
let currentGroup = null;
let groups = [];
let isServerAvailable = false;
let currentFilter = 'all';
let currentReactionMessageId = null;

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
  
  if (goingCount > memberCount / 2) return 'confirmed';
  if (notGoingCount > memberCount / 2) return 'cancelled';
  return 'pending';
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function groupMatchesSearch(group, searchTerm) {
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  return (
    group.name.toLowerCase().includes(term) ||
    group.code.toLowerCase().includes(term)
  );
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

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '✕';
  else icon = 'ℹ';
  
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);
  
  setTimeout(function() {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(function() {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// ==========================================
// FIREBASE API FUNCTIONS
// ==========================================

async function apiLogin(username) {
  try {
    // Check if user exists in Firebase
    const usersRef = collection(db, 'users');
    const userDoc = doc(db, 'users', username);
    const userSnap = await getDoc(userDoc);
    
    if (!userSnap.exists()) {
      // Create new user
      await setDoc(userDoc, {
        username: username,
        createdAt: new Date().toISOString()
      });
    }
    
    return { username: username };
  } catch (error) {
    console.error('Login error:', error);
    // Fallback - just return the username
    return { username: username };
  }
}

async function loadGroupsFromServer() {
  try {
    const groupsRef = collection(db, 'groups');
    const snapshot = await getDocs(groupsRef);
    
    const serverGroups = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Only include groups where user is a member
      if (data.members && data.members.includes(currentUser.username)) {
        serverGroups.push({ id: doc.id, ...data });
      }
    });
    
    // Save locally as backup
    localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(serverGroups));
    groups = serverGroups;
    return serverGroups;
  } catch (error) {
    console.warn('Could not load from server:', error);
    return loadGroups();
  }
}

async function apiCreateGroup(name, createdBy) {
  const code = generateGroupCode();
  const newGroup = {
    name: name,
    code: code,
    members: [createdBy],
    createdBy: createdBy,
    createdAt: new Date().toISOString(),
    hangouts: [],
    messages: []
  };
  
  try {
    const groupsRef = collection(db, 'groups');
    const docRef = await addDoc(groupsRef, newGroup);
    return { id: docRef.id, ...newGroup };
  } catch (error) {
    console.error('Create group error:', error);
    // Fallback to local
    newGroup.id = generateId();
    return newGroup;
  }
}

async function apiJoinGroup(code, username) {
  try {
    const groupsRef = collection(db, 'groups');
    const snapshot = await getDocs(groupsRef);
    
    let foundGroup = null;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.code === code.toUpperCase()) {
        foundGroup = { id: docSnap.id, ...data };
      }
    });
    
    if (!foundGroup) {
      throw new Error('Group not found');
    }
    
    if (foundGroup.members.includes(username)) {
      throw new Error('Already a member');
    }
    
    // Add member
    const groupDoc = doc(db, 'groups', foundGroup.id);
    await updateDoc(groupDoc, {
      members: arrayUnion(username)
    });
    
    foundGroup.members.push(username);
    return foundGroup;
  } catch (error) {
    console.error('Join group error:', error);
    throw error;
  }
}

async function apiGetGroup(groupId) {
  try {
    const groupDoc = doc(db, 'groups', groupId);
    const snapshot = await getDoc(groupDoc);
    
    if (!snapshot.exists()) {
      throw new Error('Group not found');
    }
    
    return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error('Get group error:', error);
    throw error;
  }
}

async function apiLeaveGroup(groupId, username) {
  try {
    const groupDoc = doc(db, 'groups', groupId);
    const snapshot = await getDoc(groupDoc);
    
    if (!snapshot.exists()) {
      throw new Error('Group not found');
    }
    
    const data = snapshot.data();
    const newMembers = data.members.filter(m => m !== username);
    
    if (newMembers.length === 0) {
      // Delete group if no members left
      await deleteDoc(groupDoc);
      return { deleted: true };
    } else {
      await updateDoc(groupDoc, {
        members: arrayRemove(username)
      });
      return { deleted: false };
    }
  } catch (error) {
    console.error('Leave group error:', error);
    throw error;
  }
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
  }
  else if (pageName === 'groups') {
    document.getElementById('groups-page').classList.remove('hidden');
    updateWelcomeMessage();
    renderGroups();
  }
  else if (pageName === 'hangout') {
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
  buttons.forEach(function(button) {
    button.textContent = isDark ? '☀️' : '🌙';
  });
}

function applyDarkMode() {
  const isDark = loadDarkMode();
  if (isDark) {
    document.body.classList.add('dark-mode');
  }
  
  const buttons = document.querySelectorAll('[id^="dark-mode-toggle"]');
  buttons.forEach(function(button) {
    button.textContent = isDark ? '☀️' : '🌙';
  });
}

// ==========================================
// LOGIN FUNCTIONS
// ==========================================

async function handleLogin() {
  const usernameInput = document.getElementById('username-input');
  const username = usernameInput.value.trim();
  
  if (username === '') {
    showToast('Please enter your name', 'error');
    return;
  }
  
  const loginButton = document.getElementById('login-button');
  const originalText = loginButton.textContent;
  loginButton.textContent = 'Logging in...';
  loginButton.disabled = true;
  
  try {
    const user = await apiLogin(username);
    saveUser(user);
    currentUser = user;
    groups = await loadGroupsFromServer();
    showToast(`Welcome, ${user.username}!`, 'success');
    usernameInput.value = '';
    showPage('groups');
  } catch (error) {
    showToast('Could not connect. Please try again.', 'error');
    console.error('Login error:', error);
  } finally {
    loginButton.textContent = originalText;
    loginButton.disabled = false;
  }
}

function handleLogout() {
  saveUser(null);
  currentUser = null;
  currentGroup = null;
  groups = [];
  showToast('Logged out successfully', 'info');
  showPage('login');
}

// ==========================================
// GROUPS FUNCTIONS
// ==========================================

async function createGroup() {
  const nameInput = document.getElementById('new-group-name-input');
  const groupName = nameInput.value.trim();
  
  if (groupName === '') {
    showToast('Please enter a group name', 'error');
    return;
  }
  
  try {
    const newGroup = await apiCreateGroup(groupName, currentUser.username);
    groups.push(newGroup);
    saveGroups(groups);
    showToast(`Group created! Code: ${newGroup.code}`, 'success');
    nameInput.value = '';
    hideCreateGroupForm();
    renderGroups();
  } catch (error) {
    showToast(error.message || 'Could not create group', 'error');
  }
}

async function joinGroup() {
  const codeInput = document.getElementById('join-code-input');
  const code = codeInput.value.trim().toUpperCase();
  
  if (code === '') {
    showToast('Please enter a group code', 'error');
    return;
  }
  
  try {
    const group = await apiJoinGroup(code, currentUser.username);
    groups.push(group);
    saveGroups(groups);
    showToast(`Joined "${group.name}"!`, 'success');
    codeInput.value = '';
    renderGroups();
  } catch (error) {
    showToast(error.message || 'Could not join group', 'error');
  }
}

async function leaveGroup(groupId) {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  
  if (!confirm(`Are you sure you want to leave "${group.name}"?`)) {
    return;
  }
  
  try {
    const result = await apiLeaveGroup(groupId, currentUser.username);
    groups = groups.filter(g => g.id !== groupId);
    saveGroups(groups);
    
    if (result.deleted) {
      showToast('Group deleted (no members left)', 'info');
    } else {
      showToast(`Left "${group.name}"`, 'info');
    }
    
    currentGroup = null;
    showPage('groups');
  } catch (error) {
    showToast(error.message || 'Could not leave group', 'error');
  }
}

async function openGroup(groupId) {
  try {
    const group = await apiGetGroup(groupId);
    currentGroup = group;
    
    const index = groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      groups[index] = group;
    }
    
    showPage('hangout');
  } catch (error) {
    showToast('Could not open group', 'error');
  }
}

function renderGroups() {
  const container = document.getElementById('groups-list');
  const noGroupsMessage = document.getElementById('no-groups-message');
  
  const searchInput = document.getElementById('search-groups-input');
  const searchTerm = searchInput ? searchInput.value : '';
  
  const myGroups = groups.filter(function(group) {
    const isMember = group.members && group.members.includes(currentUser.username);
    const matchesSearch = groupMatchesSearch(group, searchTerm);
    return isMember && matchesSearch;
  });
  
  if (myGroups.length === 0) {
    if (noGroupsMessage) noGroupsMessage.classList.remove('hidden');
    if (container) container.innerHTML = '';
    return;
  }
  
  if (noGroupsMessage) noGroupsMessage.classList.add('hidden');
  
  let html = '';
  
  myGroups.forEach(function(group) {
    const memberCount = group.members ? group.members.length : 0;
    const hangoutCount = group.hangouts ? group.hangouts.length : 0;
    
    html += `
      <div class="group-card" onclick="window.openGroup('${group.id}')">
        <div class="group-card-header">
          <h3 class="group-name">${group.name}</h3>
          <span class="group-code">${group.code}</span>
        </div>
        <div class="group-card-stats">
          <span>👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
          <span>📅 ${hangoutCount} hangout${hangoutCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="group-card-actions">
          <button class="secondary-button small" onclick="event.stopPropagation(); window.copyGroupCode('${group.code}')">
            📋 Copy Code
          </button>
          <button class="danger-button small" onclick="event.stopPropagation(); window.leaveGroup('${group.id}')">
            🚪 Leave
          </button>
        </div>
      </div>
    `;
  });
  
  if (container) container.innerHTML = html;
}

function copyGroupCode(code) {
  copyToClipboard(code);
  showToast('Code copied! Share it with friends', 'success');
}

function showCreateGroupForm() {
  const form = document.getElementById('create-group-form');
  const button = document.getElementById('show-create-group-button');
  if (form) form.classList.remove('hidden');
  if (button) button.classList.add('hidden');
}

function hideCreateGroupForm() {
  const form = document.getElementById('create-group-form');
  const button = document.getElementById('show-create-group-button');
  const input = document.getElementById('new-group-name-input');
  if (form) form.classList.add('hidden');
  if (button) button.classList.remove('hidden');
  if (input) input.value = '';
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
    title: title,
    date: date,
    time: time,
    location: location,
    description: description,
    proposedBy: currentUser.username,
    createdAt: new Date().toISOString(),
    responses: {}
  };
  
  newHangout.responses[currentUser.username] = 'going';
  
  if (!currentGroup.hangouts) {
    currentGroup.hangouts = [];
  }
  currentGroup.hangouts.push(newHangout);
  
  try {
    const groupDoc = doc(db, 'groups', currentGroup.id);
    await updateDoc(groupDoc, {
      hangouts: currentGroup.hangouts
    });
  } catch (error) {
    console.error('Save hangout error:', error);
  }
  
  const groupIndex = groups.findIndex(g => g.id === currentGroup.id);
  if (groupIndex !== -1) {
    groups[groupIndex] = currentGroup;
  }
  saveGroups(groups);
  
  showToast('Hangout proposed! 🎉', 'success');
  hideHangoutForm();
  renderHangouts();
}

async function respondToHangout(hangoutId, response) {
  const hangout = currentGroup.hangouts.find(h => h.id === hangoutId);
  if (!hangout) return;
  
  hangout.responses[currentUser.username] = response;
  
  try {
    const groupDoc = doc(db, 'groups', currentGroup.id);
    await updateDoc(groupDoc, {
      hangouts: currentGroup.hangouts
    });
  } catch (error) {
    console.error('Save response error:', error);
  }
  
  saveGroups(groups);
  
  if (response === 'going') {
    showToast("You're going! 🎉", 'success');
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
  
  if (!confirm(`Delete "${hangout.title}"?`)) {
    return;
  }
  
  currentGroup.hangouts = currentGroup.hangouts.filter(h => h.id !== hangoutId);
  
  try {
    const groupDoc = doc(db, 'groups', currentGroup.id);
    await updateDoc(groupDoc, {
      hangouts: currentGroup.hangouts
    });
  } catch (error) {
    console.error('Delete hangout error:', error);
  }
  
  const groupIndex = groups.findIndex(g => g.id === currentGroup.id);
  if (groupIndex !== -1) {
    groups[groupIndex] = currentGroup;
  }
  saveGroups(groups);
  
  showToast('Hangout deleted', 'info');
  renderHangouts();
}

function setHangoutFilter(filter) {
  currentFilter = filter;
  
  const buttons = document.querySelectorAll('.filter-button');
  buttons.forEach(function(btn) {
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
  
  const filter = currentFilter;
  const now = new Date();
  
  let filteredHangouts = (currentGroup.hangouts || []).filter(function(hangout) {
    const hangoutDate = new Date(hangout.date);
    if (filter === 'upcoming' && hangoutDate < now) return false;
    if (filter === 'past' && hangoutDate >= now) return false;
    return true;
  });
  
  filteredHangouts.sort(function(a, b) {
    return new Date(a.date) - new Date(b.date);
  });
  
  const container = document.getElementById('hangouts-list');
  const noHangoutsMessage = document.getElementById('no-hangouts-message');
  
  if (filteredHangouts.length === 0) {
    if (noHangoutsMessage) noHangoutsMessage.classList.remove('hidden');
    if (container) {
      const cards = container.querySelectorAll('.hangout-card');
      cards.forEach(card => card.remove());
    }
    renderMembers();
    return;
  }
  
  if (noHangoutsMessage) noHangoutsMessage.classList.add('hidden');
  
  let html = '';
  
  filteredHangouts.forEach(function(hangout) {
    const status = getHangoutStatus(hangout, currentGroup.members.length);
    const myResponse = hangout.responses ? hangout.responses[currentUser.username] : 'none';
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
          <button 
            class="response-button going ${myResponse === 'going' ? 'selected' : ''}"
            onclick="window.respondToHangout('${hangout.id}', 'going')">
            ✓ Going
          </button>
          <button 
            class="response-button maybe ${myResponse === 'maybe' ? 'selected' : ''}"
            onclick="window.respondToHangout('${hangout.id}', 'maybe')">
            ? Maybe
          </button>
          <button 
            class="response-button not-going ${myResponse === 'notGoing' ? 'selected' : ''}"
            onclick="window.respondToHangout('${hangout.id}', 'notGoing')">
            ✕ Can't Go
          </button>
        </div>
        
        ${isCreator ? `
          <button class="danger-button small delete-hangout" onclick="window.deleteHangout('${hangout.id}')">
            🗑️ Delete
          </button>
        ` : ''}
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
  
  if (countEl) countEl.textContent = currentGroup.members ? currentGroup.members.length : 0;
  
  let html = '';
  
  (currentGroup.members || []).forEach(function(member) {
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
  
  const inputs = ['hangout-title-input', 'hangout-date-input', 'hangout-time-input', 'hangout-location-input', 'hangout-description-input'];
  inputs.forEach(function(id) {
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
    text: text,
    sender: currentUser.username,
    timestamp: new Date().toISOString(),
    reactions: {}
  };
  
  if (!currentGroup.messages) {
    currentGroup.messages = [];
  }
  currentGroup.messages.push(newMessage);
  
  try {
    const groupDoc = doc(db, 'groups', currentGroup.id);
    await updateDoc(groupDoc, {
      messages: currentGroup.messages
    });
  } catch (error) {
    console.error('Send message error:', error);
  }
  
  saveGroups(groups);
  renderMessages();
  scrollChatToBottom();
}

async function addReaction(messageId, emoji) {
  const message = currentGroup.messages.find(m => m.id === messageId);
  if (!message) return;
  
  if (!message.reactions) {
    message.reactions = {};
  }
  
  if (!message.reactions[emoji]) {
    message.reactions[emoji] = [];
  }
  
  const userReacted = message.reactions[emoji].includes(currentUser.username);
  
  if (userReacted) {
    message.reactions[emoji] = message.reactions[emoji].filter(name => name !== currentUser.username);
    if (message.reactions[emoji].length === 0) {
      delete message.reactions[emoji];
    }
  } else {
    message.reactions[emoji].push(currentUser.username);
  }
  
  try {
    const groupDoc = doc(db, 'groups', currentGroup.id);
    await updateDoc(groupDoc, {
      messages: currentGroup.messages
    });
  } catch (error) {
    console.error('Add reaction error:', error);
  }
  
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
  
  currentGroup.messages.forEach(function(message) {
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
          <span 
            class="reaction-badge ${userReacted ? 'user-reacted' : ''}"
            onclick="window.addReaction('${message.id}', '${emoji}')"
            title="${users.join(', ')}">
            ${emoji} ${count}
          </span>
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
        <button 
          class="add-reaction-button" 
          onclick="window.showEmojiPicker('${message.id}', this)"
          title="Add reaction">
          😊
        </button>
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
// EVENT SETUP FUNCTIONS
// ==========================================

function setupLoginEvents() {
  const loginButton = document.getElementById('login-button');
  if (loginButton) {
    loginButton.addEventListener('click', handleLogin);
  }
  
  const usernameInput = document.getElementById('username-input');
  if (usernameInput) {
    usernameInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        handleLogin();
      }
    });
  }
}

function setupGroupsEvents() {
  const showCreateBtn = document.getElementById('show-create-group-button');
  const cancelCreateBtn = document.getElementById('cancel-create-group-button');
  const confirmCreateBtn = document.getElementById('confirm-create-group-button');
  
  if (showCreateBtn) showCreateBtn.addEventListener('click', showCreateGroupForm);
  if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', hideCreateGroupForm);
  if (confirmCreateBtn) confirmCreateBtn.addEventListener('click', createGroup);
  
  const joinBtn = document.getElementById('join-group-button');
  if (joinBtn) joinBtn.addEventListener('click', joinGroup);
  
  const searchInput = document.getElementById('search-groups-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderGroups);
  }
  
  const logoutBtn = document.getElementById('logout-button');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
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

function setupHangoutEvents() {
  const backBtn = document.getElementById('back-to-groups-button');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      currentGroup = null;
      showPage('groups');
    });
  }
  
  const copyBtn = document.getElementById('copy-code-button');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      copyGroupCode(currentGroup.code);
    });
  }
  
  const leaveBtn = document.getElementById('leave-group-button');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', function() {
      leaveGroup(currentGroup.id);
    });
  }
  
  const proposeBtn = document.getElementById('propose-hangout-button');
  const cancelBtn = document.getElementById('cancel-hangout-button');
  const submitBtn = document.getElementById('submit-hangout-button');
  
  if (proposeBtn) proposeBtn.addEventListener('click', showHangoutForm);
  if (cancelBtn) cancelBtn.addEventListener('click', hideHangoutForm);
  if (submitBtn) submitBtn.addEventListener('click', proposeHangout);
  
  const filterButtons = document.querySelectorAll('.filter-button');
  filterButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      setHangoutFilter(btn.getAttribute('data-filter'));
    });
  });
}

function setupChatEvents() {
  const sendBtn = document.getElementById('send-message-button');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        sendMessage();
      }
    });
  }
  
  const emojiButtons = document.querySelectorAll('.emoji-option');
  emojiButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      const emoji = btn.getAttribute('data-emoji');
      handleEmojiClick(emoji);
    });
  });
  
  document.addEventListener('click', function(event) {
    const picker = document.getElementById('emoji-picker');
    if (picker && !picker.classList.contains('hidden')) {
      if (!picker.contains(event.target) && !event.target.classList.contains('add-reaction-button')) {
        hideEmojiPicker();
      }
    }
  });
}

// ==========================================
// EXPOSE FUNCTIONS TO WINDOW (for onclick handlers)
// ==========================================

window.openGroup = openGroup;
window.leaveGroup = leaveGroup;
window.copyGroupCode = copyGroupCode;
window.respondToHangout = respondToHangout;
window.deleteHangout = deleteHangout;
window.addReaction = addReaction;
window.showEmojiPicker = showEmojiPicker;

// ==========================================
// INITIALIZE APP
// ==========================================

async function initializeApp() {
  console.log('🐝 HangHive is starting up!');
  
  // Load saved data
  groups = loadGroups();
  currentUser = loadUser();
  
  // Apply dark mode
  applyDarkMode();
  
  // Set up event listeners
  setupLoginEvents();
  setupGroupsEvents();
  setupHangoutEvents();
  setupChatEvents();
  
  // Dark mode toggle buttons
  const darkModeButtons = document.querySelectorAll('[id^="dark-mode-toggle"]');
  darkModeButtons.forEach(function(button) {
    button.addEventListener('click', toggleDarkMode);
  });
  
  // If user is logged in, load groups from server
  if (currentUser) {
    try {
      groups = await loadGroupsFromServer();
      console.log('✅ Loaded groups from Firebase');
    } catch (error) {
      console.log('⚠️ Using local data');
    }
    showPage('groups');
  } else {
    showPage('login');
  }
  
  console.log('✅ HangHive is ready!');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
