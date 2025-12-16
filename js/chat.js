/*
  ============================================================
  CHAT FUNCTIONS - chat.js
  ============================================================
  Handles the group chat feature
*/

// Track which message we're adding a reaction to
let currentReactionMessageId = null;

/**
 * Send a new message in the group chat
 */
async function sendMessage() {
  // Get the message text
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  
  // Don't send empty messages
  if (text === '') {
    return;
  }
  
  // Clear the input immediately for better UX
  input.value = '';
  
  try {
    // Try API first
    if (isServerAvailable) {
      const result = await API.sendMessage(currentGroup.id, text, currentUser.username);
      if (result.success) {
        // Update local data with server response
        currentGroup.messages = result.messages;
        // Also update in groups array
        const groupIndex = groups.findIndex(g => g.id === currentGroup.id);
        if (groupIndex !== -1) {
          groups[groupIndex].messages = result.messages;
        }
        saveGroups(groups);
        renderMessages();
        scrollChatToBottom();
        return;
      }
    }
  } catch (error) {
    console.log('Server unavailable, using local storage');
  }
  
  // Fallback: Create locally
  const newMessage = {
    id: generateId(),
    text: text,
    sender: currentUser.username,
    timestamp: new Date().toISOString(),
    reactions: {}
  };
  
  // Add to the group's messages
  if (!currentGroup.messages) {
    currentGroup.messages = [];
  }
  currentGroup.messages.push(newMessage);
  
  // Save changes
  saveGroups(groups);
  
  // Refresh the chat display
  renderMessages();
  
  // Scroll to the bottom to show new message
  scrollChatToBottom();
}

/**
 * Add a reaction to a message
 */
async function addReaction(messageId, emoji) {
  // Find the message
  const message = currentGroup.messages.find(m => m.id === messageId);
  if (!message) return;
  
  try {
    // Try API first
    if (isServerAvailable) {
      const result = await API.addReaction(currentGroup.id, messageId, emoji, currentUser.username);
      if (result.success) {
        // Update local message with server response
        message.reactions = result.message.reactions;
        saveGroups(groups);
        hideEmojiPicker();
        renderMessages();
        return;
      }
    }
  } catch (error) {
    console.log('Server unavailable, using local storage');
  }
  
  // Fallback: Handle locally
  // Make sure reactions object exists
  if (!message.reactions) {
    message.reactions = {};
  }
  
  // Make sure this emoji has an array
  if (!message.reactions[emoji]) {
    message.reactions[emoji] = [];
  }
  
  // Check if user already reacted with this emoji
  const userReacted = message.reactions[emoji].includes(currentUser.username);
  
  if (userReacted) {
    // Remove their reaction
    message.reactions[emoji] = message.reactions[emoji].filter(function(name) {
      return name !== currentUser.username;
    });
    
    // Clean up empty arrays
    if (message.reactions[emoji].length === 0) {
      delete message.reactions[emoji];
    }
  } else {
    // Add their reaction
    message.reactions[emoji].push(currentUser.username);
  }
  
  // Save changes
  saveGroups(groups);
  
  // Hide the emoji picker
  hideEmojiPicker();
  
  // Refresh display
  renderMessages();
}

/**
 * Show the emoji picker for a message
 */
function showEmojiPicker(messageId, buttonElement) {
  currentReactionMessageId = messageId;
  
  const picker = document.getElementById('emoji-picker');
  
  // Position near the button
  const rect = buttonElement.getBoundingClientRect();
  picker.style.top = (rect.bottom + 5) + 'px';
  picker.style.left = rect.left + 'px';
  
  // Show it
  picker.classList.remove('hidden');
}

/**
 * Hide the emoji picker
 */
function hideEmojiPicker() {
  document.getElementById('emoji-picker').classList.add('hidden');
  currentReactionMessageId = null;
}

/**
 * Handle clicking an emoji in the picker
 */
function handleEmojiClick(emoji) {
  if (currentReactionMessageId) {
    addReaction(currentReactionMessageId, emoji);
  }
}

/**
 * Display all messages in the chat
 */
function renderMessages() {
  const container = document.getElementById('chat-messages');
  const noMessagesEl = document.getElementById('no-messages');
  
  // Check if group has messages
  if (!currentGroup.messages || currentGroup.messages.length === 0) {
    if (noMessagesEl) noMessagesEl.classList.remove('hidden');
    // Remove any existing message elements
    const existingMessages = container.querySelectorAll('.chat-message');
    existingMessages.forEach(msg => msg.remove());
    return;
  }
  
  // Hide empty state
  if (noMessagesEl) noMessagesEl.classList.add('hidden');
  
  // Build HTML for each message
  let html = '';
  
  currentGroup.messages.forEach(function(message) {
    const isOwn = message.sender === currentUser.username;
    const messageClass = isOwn ? 'sent' : 'received';
    
    // Build reactions HTML
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
            onclick="addReaction('${message.id}', '${emoji}')"
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
          onclick="showEmojiPicker('${message.id}', this)"
          title="Add reaction">
          😊
        </button>
      </div>
    `;
  });
  
  // Keep the no-messages element, replace the rest
  if (container) {
    const existingMessages = container.querySelectorAll('.chat-message');
    existingMessages.forEach(msg => msg.remove());
    container.insertAdjacentHTML('beforeend', html);
  }
}

/**
 * Scroll the chat to the bottom to show latest message
 */
function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Set up event listeners for the chat
 */
function setupChatEvents() {
  // Send button
  const sendBtn = document.getElementById('send-message-button');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  // Enter key to send
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        sendMessage();
      }
    });
  }
  
  // Emoji picker buttons - they already exist in HTML
  const emojiButtons = document.querySelectorAll('.emoji-option');
  emojiButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      const emoji = btn.getAttribute('data-emoji');
      handleEmojiClick(emoji);
    });
  });
  
  // Close emoji picker when clicking outside
  document.addEventListener('click', function(event) {
    const picker = document.getElementById('emoji-picker');
    if (picker && !picker.classList.contains('hidden')) {
      // Check if click was outside picker and not on an add-reaction button
      if (!picker.contains(event.target) && !event.target.classList.contains('add-reaction-button')) {
        hideEmojiPicker();
      }
    }
  });
}
