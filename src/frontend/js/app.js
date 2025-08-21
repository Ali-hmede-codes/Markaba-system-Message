document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const connectBtn = document.getElementById('connect-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const forceReconnectBtn = document.getElementById('force-reconnect-btn');
  const clearAuthBtn = document.getElementById('clear-auth-btn');
  // Status message element removed - using nav status indicator instead
  const qrcodeContainer = document.getElementById('qrcode-container');
  const qrcodeElement = document.getElementById('qrcode');
  const groupsContainer = document.getElementById('groups-container');
  const groupsList = document.getElementById('groups-list');
  const messageContainer = document.getElementById('message-container');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const sendStatus = document.getElementById('send-status');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const saveFavoritesBtn = document.getElementById('save-favorites-btn');
  const loadFavoritesBtn = document.getElementById('load-favorites-btn');
  const toggleLinkPreviewBtn = document.getElementById('toggle-link-preview-btn');
  
  // Admin elements
  const adminTabContainer = document.getElementById('admin-tab-container');
  const adminPanelBtn = document.getElementById('admin-panel-btn');
  const logoutMainBtn = document.getElementById('logout-main-btn');

  // API Base URLs
  const API_BASE_URL = '/api/whatsapp';
  const AUTH_API_BASE_URL = '/api/auth';

  // Toast Notification System
  let toastCounter = 0;

  function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      console.error('Toast container not found');
      return;
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = `toast-${++toastCounter}`;

    // Get icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-content">${message}</span>
      <button class="toast-close" onclick="hideToast('${toast.id}')">&times;</button>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Show toast with animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        hideToast(toast.id);
      }, duration);
    }

    return toast.id;
  }

  function hideToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;

    toast.classList.remove('show');
    toast.classList.add('hide');

    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  function hideAllToasts() {
    const toasts = document.querySelectorAll('.toast');
    toasts.forEach(toast => {
      hideToast(toast.id);
    });
  }

  // Make toast functions globally available
  window.showToast = showToast;
  window.hideToast = hideToast;
  window.hideAllToasts = hideAllToasts;

  // State
  let isConnected = false;
  let authState = 'DISCONNECTED';
  let isAuthenticated = false;
   let groups = [];
   let checkInterval;
   let isSendingMessage = false; // Flag to prevent duplicate sends
   let linkPreviewEnabled = true; // Link preview state
   
   // Enhanced duplicate prevention system
   let lastMessageFingerprint = null;
   let messageSendHistory = new Map(); // Store recent message sends
   let messageTimeoutId = null;
   let currentBatchFingerprint = null; // Track current batch being sent
  // Removed authInfo - not needed with Baileys
  // Removed refreshInterval - no automatic refresh

  // Initialize the app
  init();
  
  // Initialize media upload functionality
  initializeMediaUpload();

  // Event listeners with null checks
  if (connectBtn) connectBtn.addEventListener('click', initializeWhatsApp);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (forceReconnectBtn) forceReconnectBtn.addEventListener('click', forceReconnect);
  if (clearAuthBtn) clearAuthBtn.addEventListener('click', clearAuthData);
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllGroups);
  if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAllGroups);
  if (saveFavoritesBtn) saveFavoritesBtn.addEventListener('click', saveFavoriteGroups);
  if (loadFavoritesBtn) loadFavoritesBtn.addEventListener('click', loadFavoriteGroups);
  if (toggleLinkPreviewBtn) toggleLinkPreviewBtn.addEventListener('click', toggleLinkPreview);
  
  // Admin event listeners
  if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', () => {
      window.location.href = '/admin';
    });
  }
  
  if (logoutMainBtn) {
    logoutMainBtn.addEventListener('click', handleMainLogout);
  }
  
  // Refresh groups button removed - groups will auto-refresh when needed
  
  // Add page visibility and focus event listeners for duplicate prevention
  document.addEventListener('visibilitychange', handlePageVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('beforeunload', handlePageUnload);
  
  // Handle form submission for sending messages
  const messageForm = document.getElementById('message-form');
  if (messageForm) {
    messageForm.addEventListener('submit', function(e) {
      e.preventDefault();
      e.stopPropagation();
      sendMessage();
      return false; // Extra prevention
    });
  }
  
  // Remove duplicate button click listener to prevent double sending
  // The form submit handler above will handle both Enter key and button clicks



  // Make fetchGroups globally accessible for retry buttons
  window.fetchGroups = fetchGroups;

  // Functions
  async function init() {
    try {
      // Check user authentication and role
      await checkUserRole();
      
      // Check WhatsApp status
      const response = await fetch(`${API_BASE_URL}/status`);
      const data = await response.json();
      
      // Update state with Baileys API format
      isConnected = data.connected;
      authState = data.state || 'DISCONNECTED';
      isAuthenticated = data.connected;
      
      console.log('Initial WhatsApp status:', { isConnected, authState, isAuthenticated });
      
      updateUI();
      
      // Load link preview status
      await loadLinkPreviewStatus();
      
      if (isConnected && authState === 'READY') {
        // Add delay to ensure WhatsApp Web is fully loaded
        setTimeout(() => {
          fetchGroups();
        }, 5000); // Reduced delay for Baileys
      }
    } catch (error) {
      console.error('Error checking status:', error);
      showToast('Error connecting to server', 'error');
    }
  }



  async function initializeWhatsApp() {
    try {
      connectBtn.disabled = true;
      console.log('Initializing WhatsApp client...');
      
      const response = await fetch(`${API_BASE_URL}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ forceNew: false })
      });
      
      const data = await response.json();
      
      if (data.success) {
        authState = data.state || 'CONNECTING';
        console.log(`Initialization started (${authState})`);
        showToast('WhatsApp client initialized successfully', 'success');
        
        if (authState === 'QR_REQUIRED') {
          qrcodeContainer.style.display = 'block';
        }
        
        startStatusCheck();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error initializing WhatsApp:', error);
      showToast(`Initialization error: ${error.message}`, 'error');
      connectBtn.disabled = false;
    }
  }

  function startStatusCheck() {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    
    checkInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/status`);
        const data = await response.json();
        
        // Update all state variables
        const wasConnected = isConnected;
        const oldAuthState = authState;
        
        isConnected = data.connected;
        authState = data.state || 'DISCONNECTED';
        isAuthenticated = data.connected;
        
        // Handle QR code display
        if (data.qrCode && authState === 'QR_REQUIRED') {
          qrcodeElement.innerHTML = `
            <img src="${data.qrCode}" alt="QR Code">
            <p>Scan this QR code with your WhatsApp mobile app</p>
            <p>Auth State: ${authState}</p>
          `;
          
          // Add qr-loaded class to hide placeholder
          const qrContainer = document.getElementById('qr-container');
          if (qrContainer) {
            qrContainer.classList.add('qr-loaded');
          }
          
          qrcodeContainer.style.display = 'block';
        } else if (authState !== 'QR_REQUIRED') {
          qrcodeContainer.style.display = 'none';
          
          // Remove qr-loaded class to show placeholder again
          const qrContainer = document.getElementById('qr-container');
          if (qrContainer) {
            qrContainer.classList.remove('qr-loaded');
          }
        }
        
        // Update UI if connection or auth state changed
        if (wasConnected !== isConnected || oldAuthState !== authState) {
          console.log('Status changed:', { 
            wasConnected, isConnected, 
            oldAuthState, authState, 
            isAuthenticated 
          });
          
          updateUI();
          
          // Fetch groups when ready
          if (isConnected && authState === 'READY' && !wasConnected) {
            setTimeout(() => {
              fetchGroups();
            }, 3000); // Reduced delay for Baileys
            // Keep status checking active - don't clear interval
          }
          
          // Also fetch groups if we're already ready but don't have groups loaded
          if (isConnected && authState === 'READY' && groups.length === 0) {
            console.log('WhatsApp is ready but no groups loaded, fetching groups...');
            setTimeout(() => {
              fetchGroups();
            }, 1000);
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }, 2000);
  }

  function updateUI() {
    // Update status message based on auth state
    let statusText = '';
    let statusClass = '';
    let navStatusText = '';
    let navStatusClass = '';
    
    switch (authState) {
      case 'CONNECTING':
        statusText = 'Connecting to WhatsApp...';
        statusClass = 'connecting';
        navStatusText = 'جاري الاتصال...';
        navStatusClass = 'offline';
        break;
      case 'QR_REQUIRED':
        statusText = 'Scan QR code to authenticate';
        statusClass = 'qr-required';
        navStatusText = 'في انتظار المسح';
        navStatusClass = 'offline';
        break;
      case 'AUTHENTICATED':
        statusText = 'Authenticated - Preparing WhatsApp Web...';
        statusClass = 'authenticated';
        navStatusText = 'جاري التحضير...';
        navStatusClass = 'offline';
        break;
      case 'READY':
        statusText = 'Connected to WhatsApp - Ready to send messages';
        statusClass = 'connected';
        navStatusText = 'متصل';
        navStatusClass = 'online';
        break;
      case 'DISCONNECTED':
      default:
        statusText = 'Not connected to WhatsApp';
        statusClass = 'disconnected';
        navStatusText = 'غير متصل';
        navStatusClass = 'offline';
        break;
    }
    
    // Status message now handled by navigation indicator only
    
    // Update navigation status indicator
    const navStatusDot = document.getElementById('nav-status-dot');
    const navStatusTextEl = document.getElementById('nav-status-text');
    
    if (navStatusDot && navStatusTextEl) {
      navStatusDot.className = `status-dot ${navStatusClass}`;
      navStatusTextEl.textContent = navStatusText;
    }
    
    // Show/hide connection controls section
    const connectionControls = document.querySelector('.connection-controls');
    
    // Show/hide UI elements based on connection state and user role
     if (isConnected && authState === 'READY') {
       if (connectionControls) connectionControls.style.display = 'none';
       groupsContainer.style.display = 'block';
       messageContainer.style.display = 'block';
       
       // Show loading message in groups list if not already loaded
       if (groups.length === 0) {
         groupsList.innerHTML = '<p>🔄 Loading WhatsApp groups...</p>';
       }
       
       // Check user role before showing WhatsApp control buttons
       checkUserRole();
     } else {
       if (connectionControls) connectionControls.style.display = 'block';
       connectBtn.disabled = (authState === 'CONNECTING' || authState === 'AUTHENTICATED');
       groupsContainer.style.display = 'none';
       messageContainer.style.display = 'none';
       
       // Hide WhatsApp control buttons when not connected
       logoutBtn.style.display = 'none';
       forceReconnectBtn.style.display = 'none';
       clearAuthBtn.style.display = (authState !== 'DISCONNECTED') ? 'inline-block' : 'none';
       
       // Clear groups when disconnected
       if (authState === 'DISCONNECTED') {
         groups = [];
         groupsList.innerHTML = '';
       }
     }
  }

  async function fetchGroups(force = false) {
    const groupsList = document.getElementById('groups-list');
    groupsList.innerHTML = '<div class="loading">Loading groups...</div>';
    
    console.log('Fetching groups, force:', force);
    
    try {
      const response = await fetch('/api/whatsapp/groups');
      const data = await response.json();
      
      console.log('Groups response:', data);
      
      if (data.success) {
        groups = data.groups;
        console.log('Groups loaded:', groups.length);
        renderGroups();
        
        // Auto-load favorite groups if available
        await autoLoadFavorites();

      } else {
        console.error('Groups fetch failed:', data.error);
        groupsList.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      groupsList.innerHTML = '<div class="error">Failed to load groups. Please try again.</div>';
    }
  }



  function renderGroups() {
    // Create collapsible container structure
    groupsList.innerHTML = `
      <div class="groups-list-container">
        <div class="groups-list-header" id="groups-list-header">
          <span class="groups-list-title">قائمة المجموعات (${groups.length})</span>
          <span class="groups-list-arrow" id="groups-list-arrow">▼</span>
        </div>
        <div class="groups-list-content" id="groups-list-content">
          <div class="groups-items" id="groups-items"></div>
        </div>
      </div>
    `;

    // Populate groups
    const groupsItems = document.getElementById('groups-items');
    groups.forEach(group => {
      const div = document.createElement('div');
      div.className = 'group-item';
      div.innerHTML = `
        <input type="checkbox" id="${group.id}" value="${group.id}">
        <label for="${group.id}">${group.name} (${group.participants} members)</label>
      `;
      groupsItems.appendChild(div);
    });

    // Add toggle functionality
    setupGroupsToggle();

    // Add refresh button outside groups-list
    addRefreshButton();
  }

  function setupGroupsToggle() {
    const header = document.getElementById('groups-list-header');
    const content = document.getElementById('groups-list-content');
    const arrow = document.getElementById('groups-list-arrow');
    
    if (header && content && arrow) {
      header.addEventListener('click', () => {
        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
          content.classList.remove('collapsed');
          arrow.textContent = '▼';
          arrow.style.transform = 'rotate(0deg)';
        } else {
          content.classList.add('collapsed');
          arrow.textContent = '▶';
          arrow.style.transform = 'rotate(-90deg)';
        }
      });
    }
  }

  function addRefreshButton() {
    // Remove existing refresh button if any
    const existingBtn = document.getElementById('refresh-groups-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    // Create new refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refresh-groups-btn';
    refreshBtn.className = 'btn btn-outline';
    refreshBtn.innerHTML = `
      <span class="btn-icon">🔄</span>
      تحديث المجموعات
    `;
    refreshBtn.onclick = () => fetchGroups(true);

    // Add to section-actions
    const sectionActions = document.querySelector('.groups-section .section-actions');
    if (sectionActions) {
      sectionActions.appendChild(refreshBtn);
    }
  }






  // Media preview functionality
  let selectedFile = null;

  function initializeMediaUpload() {
    const mediaInput = document.getElementById('media-input');
    const mediaPreview = document.getElementById('media-preview');
    const previewFilename = document.getElementById('preview-filename');
    const previewContent = document.getElementById('preview-content');
    const removeMediaBtn = document.getElementById('remove-media');
    
    if (mediaInput) {
      mediaInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          selectedFile = file;
          showMediaPreview(file);
        }
      });
    }
    
    if (removeMediaBtn) {
      removeMediaBtn.addEventListener('click', function() {
        selectedFile = null;
        if (mediaInput) mediaInput.value = '';
        if (mediaPreview) mediaPreview.style.display = 'none';
        if (previewContent) previewContent.innerHTML = '';
      });
    }
    
    function showMediaPreview(file) {
      if (previewFilename) previewFilename.textContent = file.name;
      if (mediaPreview) mediaPreview.style.display = 'block';
      
      const fileType = file.type;
      if (previewContent) previewContent.innerHTML = '';
      
      if (fileType.startsWith('image/')) {
        const container = document.createElement('div');
        container.className = 'media-container';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => URL.revokeObjectURL(img.src);
        container.appendChild(img);
        if (previewContent) previewContent.appendChild(container);
      } else if (fileType.startsWith('video/')) {
        const container = document.createElement('div');
        container.className = 'media-container';
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.onload = () => URL.revokeObjectURL(video.src);
        container.appendChild(video);
        if (previewContent) previewContent.appendChild(container);
      } else {
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.innerHTML = `
          <strong>File:</strong> ${file.name}<br>
          <strong>Type:</strong> ${file.type || 'Unknown'}<br>
          <strong>Size:</strong> ${(file.size / 1024 / 1024).toFixed(2)} MB
        `;
        if (previewContent) previewContent.appendChild(fileInfo);
      }
    }
  }

  async function sendMessage() {
    // Prevent duplicate sends if already in progress
    if (isSendingMessage) {
      console.log('Message sending already in progress, ignoring duplicate request');
      return;
    }
    
    try {
      // Get message details for fingerprinting
      const message = messageInput.value.trim();
      const selectedGroups = Array.from(document.querySelectorAll('#groups-list input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
      const batchSize = parseInt(document.getElementById('batch-size').value) || 5;
      const hasMedia = selectedFile !== null;
      
      // Create unique message fingerprint
      const messageFingerprint = createMessageFingerprint(message, selectedGroups, hasMedia);
      
      // Check for duplicate message attempts
      if (isDuplicateMessage(messageFingerprint)) {
        console.log('Duplicate message detected, blocking send');
        showSendStatus('Duplicate message detected. Please wait before sending the same message again.', 'warning');
        return;
      }
      
      isSendingMessage = true; // Set flag to prevent duplicates
      
      // Set current batch fingerprint to prevent duplicates during sending
      currentBatchFingerprint = messageFingerprint;
      
      // Debug: Check if groups list exists and has checkboxes
      const groupsListElement = document.getElementById('groups-list');
      const allCheckboxes = document.querySelectorAll('#groups-list input[type="checkbox"]');
      const checkedCheckboxes = document.querySelectorAll('#groups-list input[type="checkbox"]:checked');
      
      console.log('Debug - Groups list element:', groupsListElement);
      console.log('Debug - Total checkboxes found:', allCheckboxes.length);
      console.log('Debug - Checked checkboxes found:', checkedCheckboxes.length);
      console.log('Debug - Groups array length:', groups.length);
      
      console.log('Debug - Selected groups:', selectedGroups);
      
      if (selectedGroups.length === 0) {
        if (allCheckboxes.length === 0) {
          showSendStatus('No groups available. Please load groups first by clicking "Refresh Groups" or ensure WhatsApp is connected.', 'error');
        } else {
          showSendStatus('Please select at least one group by checking the boxes next to group names.', 'error');
        }
        return;
      }
      
      if (message === '') {
        showSendStatus('Please enter a message', 'error');
        return;
      }
      
      // Check for markaba.news URLs and show special loading message
      const markabaRegex = /https:\/\/www\.markaba\.news[^\s]*/gi;
      const hasMarkabaUrl = markabaRegex.test(message);
      
      sendBtn.disabled = true;
      
      if (hasMarkabaUrl) {
        showSendStatus('🔍 Markaba.news URL detected - Auto-enabling link preview and preparing enhanced message...', 'info');
        // Add extra delay for markaba.news URLs to show the special status
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      showSendStatus('Preparing to send message...', '');
      
      const totalBatches = Math.ceil(selectedGroups.length / batchSize);
      
      // Show progress bar only when batch processing starts
      const progressContainer = document.getElementById('batch-progress');
      const progressText = document.getElementById('progress-text');
      const progressFill = document.getElementById('progress-fill');
      
      // Force immediate display and DOM update
      progressContainer.style.display = 'block';
      progressContainer.offsetHeight; // Trigger reflow for mobile
      
      // Update progress bar with batch information
      progressText.textContent = `Preparing batches... (${selectedGroups.length} groups, ${totalBatches} batches)`;
      progressFill.style.width = '10%'; // Show preparation progress
      
      // Small delay to ensure progress bar is visible before starting
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Prepare form data
      const formData = new FormData();
      formData.append('groupIds', JSON.stringify(selectedGroups));
      formData.append('message', message);
      formData.append('batchSize', batchSize.toString());
      
      if (selectedFile) {
        formData.append('media', selectedFile);
        console.log(`Attaching media file: ${selectedFile.name} (${selectedFile.type})`);
      }
      
      // Send to WhatsApp Groups first
      const groupResponse = await fetch(`${API_BASE_URL}/send`, {
        method: 'POST',
        body: formData // Don't set Content-Type header, let browser set it with boundary
      });
      
      const groupData = await groupResponse.json();
      let groupSuccess = false;
      
      if (groupResponse.ok && groupData.success) {
        groupSuccess = true;
        
        // Show real-time batch progress for groups
        for (let i = 1; i <= totalBatches; i++) {
          const progress = (i / (totalBatches * 2)) * 100; // Half progress for groups
          progressText.textContent = `Processing groups batch ${i} of ${totalBatches}...`;
          progressFill.style.width = `${progress}%`;
          
          // Force immediate DOM update for mobile devices
          progressFill.offsetHeight; // Trigger reflow
          
          if (i < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 800)); // 0.8 second delay
          }
        }
      } else if (groupResponse.status === 429) {
        // Handle duplicate message detection from backend
        progressContainer.style.display = 'none';
        showSendStatus(`Duplicate Prevention: ${groupData.error || 'Please wait before sending the same message again.'}`, 'warning');
        console.log('Backend detected duplicate message');
        return;
      }
      
      // Telegram sending is now handled automatically by the backend WhatsApp route
      // No need for separate Telegram API calls from frontend
      const telegramSuccess = groupData.telegramResult?.success || false;
      const telegramError = groupData.telegramResult?.error || null;
      
      // Complete the progress bar
      progressFill.style.width = '100%';
      
      if (groupSuccess) {
        // Store the message fingerprint to prevent duplicates
        storeMessageSend(messageFingerprint);
        
        const mediaText = selectedFile ? ' with media' : '';
        progressText.textContent = 'All messages sent successfully!';
        
        let statusMessage = `Message${mediaText} sent to ${selectedGroups.length} groups successfully!`;
        let statusType = 'success';
        
        // Add Telegram status to the message
        if (telegramSuccess) {
          statusMessage += ' Also sent to Telegram.';
        } else if (telegramError) {
          statusMessage += ` Warning: Failed to send to Telegram (${telegramError}).`;
          statusType = 'warning';
        }
        
        showSendStatus(statusMessage, statusType);
        messageInput.value = '';
        
        // Clear media selection
        if (selectedFile) {
          selectedFile = null;
          const mediaInput = document.getElementById('media-input');
          const mediaPreview = document.getElementById('media-preview');
          const previewContent = document.getElementById('preview-content');
          if (mediaInput) mediaInput.value = '';
          if (mediaPreview) mediaPreview.style.display = 'none';
          if (previewContent) previewContent.innerHTML = '';
        }
        
        // Hide progress after 1.5 seconds for better mobile UX
        setTimeout(() => {
          progressContainer.style.display = 'none';
        }, 1500);
      } else {
        progressContainer.style.display = 'none';
        let errorMessage = 'Failed to send message';
        errorMessage = `Error: ${groupData.message || 'Unknown error'}`;
        showSendStatus(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      document.getElementById('batch-progress').style.display = 'none';
      showSendStatus(`Error: ${error.message}`, 'error');
    } finally {
      sendBtn.disabled = false;
      isSendingMessage = false; // Reset flag to allow future sends
      
      // Reset current batch fingerprint on error
      currentBatchFingerprint = null;
    }
  }



  function showSendStatus(message, type) {
    sendStatus.textContent = message;
    sendStatus.className = type;
  }
  
  // Enhanced duplicate prevention functions
  function createMessageFingerprint(message, groupIds, hasMedia) {
    // Create a unique fingerprint based on message content, groups, and media
    const groupsString = Array.isArray(groupIds) ? groupIds.sort().join(',') : '';
    const mediaFlag = hasMedia ? 'media' : 'text';
    const content = `${message}|${groupsString}|${mediaFlag}`;
    
    // Simple hash function for fingerprinting
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  
  function isDuplicateMessage(fingerprint) {
    // Check if this exact message is currently being sent
    if (currentBatchFingerprint === fingerprint) {
      return true; // Same batch is currently being processed
    }
    
    // Check if this exact message was the last successfully sent batch
    if (lastMessageFingerprint === fingerprint) {
      return true; // Duplicate of last successful batch
    }
    
    return false;
  }
  
  function storeMessageSend(fingerprint) {
    // Store as last successfully sent message
    lastMessageFingerprint = fingerprint;
    // Clear current batch fingerprint since batch is complete
    currentBatchFingerprint = null;
  }
   
   // Page visibility and focus event handlers
    function handlePageVisibilityChange() {
      if (document.hidden) {
        console.log('Page became hidden - preserving message send state');
        // Don't reset isSendingMessage when page becomes hidden
      } else {
        console.log('Page became visible - checking message send state');
        // When page becomes visible again, check if we should reset the sending state
        // Only reset if no batch is currently being processed
        if (!isSendingMessage && currentBatchFingerprint) {
          console.log('Resetting current batch state after page visibility change');
          currentBatchFingerprint = null;
        }
      }
    }
   
   function handleWindowFocus() {
     console.log('Window gained focus');
     // Additional check when window gains focus
     if (isSendingMessage) {
       console.log('Message sending in progress, maintaining state');
     }
   }
   
   function handleWindowBlur() {
     console.log('Window lost focus');
     // Don't reset sending state when window loses focus
   }
   
   function handlePageUnload() {
      console.log('Page unloading - cleaning up');
      // Clean up state before page unloads
      currentBatchFingerprint = null;
    }

  async function logout() {
    try {
      logoutBtn.disabled = true;
      console.log('Logging out...');
      
      const response = await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reset all state
        isConnected = false;
        authState = 'DISCONNECTED';
        isAuthenticated = false;
        // Auth info cleared
        groups = [];
        
        updateUI();
        console.log(data.message || 'Logged out successfully');
        showToast('WhatsApp logged out successfully', 'success');
      } else {
        showToast(`Logout error: ${data.message}`, 'error');
        logoutBtn.disabled = false;
      }
    } catch (error) {
      console.error('Error logging out:', error);
      showToast(`Logout error: ${error.message}`, 'error');
      logoutBtn.disabled = false;
    }
  }

  async function forceReconnect() {
    try {
      forceReconnectBtn.disabled = true;
      console.log('Force reconnecting...');
      
      const response = await fetch(`${API_BASE_URL}/auth/reconnect`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Reconnection initiated');
        showToast('Reconnection initiated successfully', 'success');
        authState = 'CONNECTING';
        updateUI();
        startStatusCheck();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error force reconnecting:', error);
      showToast(`Reconnection error: ${error.message}`, 'error');
    } finally {
      forceReconnectBtn.disabled = false;
    }
  }

  async function clearAuthData() {
    if (!confirm('Are you sure you want to clear all authentication data? This will require re-scanning the QR code.')) {
      return;
    }
    
    try {
      clearAuthBtn.disabled = true;
      console.log('Clearing authentication data...');
      
      const response = await fetch(`${API_BASE_URL}/auth/clear`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reset all state
        isConnected = false;
        authState = 'DISCONNECTED';
        isAuthenticated = false;
        // Auth info cleared
        groups = [];
        
        updateUI();
        console.log('Authentication data cleared. You can now connect again.');
        showToast('Authentication data cleared successfully', 'success');
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error clearing auth data:', error);
      showToast(`Clear auth error: ${error.message}`, 'error');
    } finally {
      clearAuthBtn.disabled = false;
    }
  }

  function selectAllGroups() {
    const checkboxes = document.querySelectorAll('#groups-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
    });
  }

  function deselectAllGroups() {
    const checkboxes = document.querySelectorAll('#groups-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
  }

  async function saveFavoriteGroups() {
    try {
      const selectedGroups = Array.from(document.querySelectorAll('#groups-list input[type="checkbox"]:checked'))
        .map(checkbox => ({
          id: checkbox.value,
          name: checkbox.dataset.name
        }));
      
      if (selectedGroups.length === 0) {
        showToast('Please select at least one group to save as favorite', 'warning');
        return;
      }
      
      saveFavoritesBtn.disabled = true;
      
      const response = await fetch(`${API_BASE_URL}/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groups: selectedGroups
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Favorite groups saved successfully!', 'success');
      } else {
        showToast(`Error: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error saving favorite groups:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      saveFavoritesBtn.disabled = false;
    }
  }

  async function loadFavoriteGroups() {
    try {
      loadFavoritesBtn.disabled = true;
      
      const response = await fetch(`${API_BASE_URL}/favorites`);
      const data = await response.json();
      
      if (data.success && data.groups.length > 0) {
        // Deselect all first
        deselectAllGroups();
        
        // Select favorites
        const favoriteIds = data.groups.map(group => group.id);
        const checkboxes = document.querySelectorAll('#groups-list input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
          if (favoriteIds.includes(checkbox.value)) {
            checkbox.checked = true;
          }
        });
        
        // Auto-collapse the groups list after loading favorites
        collapseGroupsList();
        
        showToast(`تم تحميل ${data.groups.length} مجموعة مفضلة`, 'success');
      } else if (data.success && data.groups.length === 0) {
        showToast('No favorite groups found', 'warning');
      } else {
        showToast(`Error: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error loading favorite groups:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      loadFavoritesBtn.disabled = false;
    }
  }

  function collapseGroupsList() {
    const content = document.getElementById('groups-list-content');
    const arrow = document.getElementById('groups-list-arrow');
    
    if (content && arrow && !content.classList.contains('collapsed')) {
      content.classList.add('collapsed');
      arrow.textContent = '▶';
      arrow.style.transform = 'rotate(-90deg)';
    }
  }

  // Auto-load favorite groups silently when groups are fetched
  async function autoLoadFavorites() {
    try {
      const response = await fetch(`${API_BASE_URL}/favorites`);
      const data = await response.json();
      
      if (data.success && data.groups.length > 0) {
        // Deselect all first
        deselectAllGroups();
        
        // Select favorites
        const favoriteIds = data.groups.map(group => group.id);
        const checkboxes = document.querySelectorAll('#groups-list input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
          if (favoriteIds.includes(checkbox.value)) {
            checkbox.checked = true;
          }
        });
        
        // Auto-collapse the groups list after loading favorites
        collapseGroupsList();
        
        console.log(`Auto-loaded ${data.groups.length} favorite groups and collapsed list`);
      }
    } catch (error) {
      console.log('No favorites file found or error loading favorites:', error.message);
    }
  }

  // Check user authentication and role
  async function checkUserRole() {
    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/status`);
      const data = await response.json();
      
      // Check if user is authenticated
      if (!data.success || !data.authenticated || !data.user) {
        // Redirect to login if not authenticated
        window.location.href = '/login';
        return;
      }
      
      if (data.success && data.user && data.user.role === 'admin') {
        // Show admin tab for admin users
        if (adminTabContainer) {
          adminTabContainer.style.display = 'block';
        }
        // Show admin panel link in user menu
        const adminPanelContainer = document.getElementById('admin-panel-container');
        if (adminPanelContainer) {
          adminPanelContainer.style.display = 'block';
        }
        // Hide WhatsApp control buttons from main dashboard - they should be in admin panel only
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (forceReconnectBtn) forceReconnectBtn.style.display = 'none';
        if (clearAuthBtn) clearAuthBtn.style.display = 'none';
        // Ensure account logout button is always visible for admins
        if (logoutMainBtn) logoutMainBtn.style.display = 'block';
      } else {
        // Hide admin tab for non-admin users
        if (adminTabContainer) {
          adminTabContainer.style.display = 'none';
        }
        // Hide admin panel link in user menu
        const adminPanelContainer = document.getElementById('admin-panel-container');
        if (adminPanelContainer) {
          adminPanelContainer.style.display = 'none';
        }
        // Hide WhatsApp control buttons for regular users
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (forceReconnectBtn) forceReconnectBtn.style.display = 'none';
        if (clearAuthBtn) clearAuthBtn.style.display = 'none';
        // Ensure account logout button is always visible for regular users
        if (logoutMainBtn) logoutMainBtn.style.display = 'block';
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      // Hide admin tab on error
      if (adminTabContainer) {
        adminTabContainer.style.display = 'none';
      }
      // Hide WhatsApp control buttons on error
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (forceReconnectBtn) forceReconnectBtn.style.display = 'none';
      if (clearAuthBtn) clearAuthBtn.style.display = 'none';
      // Ensure account logout button is always visible even on error
      if (logoutMainBtn) logoutMainBtn.style.display = 'block';
    }
  }

  // Handle main logout
  async function handleMainLogout() {
    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Redirect to login page
        window.location.href = '/login';
      } else {
        console.error('Logout failed');
        // Still redirect on error to ensure user is logged out
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Redirect to login even on error
      window.location.href = '/login';
    }
  }

  // Link Preview Toggle Functions
  async function toggleLinkPreview() {
    try {
      const response = await fetch(`${API_BASE_URL}/link-preview/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ enabled: !linkPreviewEnabled })
      });
      
      const data = await response.json();
      
      if (data.success) {
        linkPreviewEnabled = data.linkPreviewEnabled;
        updateLinkPreviewButton();
        console.log(data.message);
      } else {
        console.error('Failed to toggle link preview:', data.error);
      }
    } catch (error) {
      console.error('Error toggling link preview:', error);
    }
  }

  function updateLinkPreviewButton() {
    if (toggleLinkPreviewBtn) {
      if (linkPreviewEnabled) {
        toggleLinkPreviewBtn.textContent = '🔗 معاينة الروابط: تشغيل';
        toggleLinkPreviewBtn.classList.remove('disabled');
      } else {
        toggleLinkPreviewBtn.textContent = '🔗 معاينة الروابط: إيقاف';
        toggleLinkPreviewBtn.classList.add('disabled');
      }
    }
  }

  async function loadLinkPreviewStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/link-preview/status`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        linkPreviewEnabled = data.linkPreviewEnabled;
        updateLinkPreviewButton();
      }
    } catch (error) {
      console.error('Error loading link preview status:', error);
    }
  }

});