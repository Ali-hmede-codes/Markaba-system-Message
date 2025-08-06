document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const connectBtn = document.getElementById('connect-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const forceReconnectBtn = document.getElementById('force-reconnect-btn');
  const clearAuthBtn = document.getElementById('clear-auth-btn');
  const statusMessage = document.getElementById('status-message');
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
  
  // Admin elements
  const adminTabContainer = document.getElementById('admin-tab-container');
  const adminPanelBtn = document.getElementById('admin-panel-btn');
  const logoutMainBtn = document.getElementById('logout-main-btn');

  // API Base URLs
  const API_BASE_URL = '/api/whatsapp';
  const AUTH_API_BASE_URL = '/api/auth';

  // State
  let isConnected = false;
  let authState = 'DISCONNECTED';
  let isAuthenticated = false;
  let groups = [];
  let checkInterval;
  // Removed authInfo - not needed with Baileys
  // Removed refreshInterval - no automatic refresh

  // Initialize the app
  init();
  
  // Initialize media upload functionality
  initializeMediaUpload();

  // Event listeners
  connectBtn.addEventListener('click', initializeWhatsApp);
  logoutBtn.addEventListener('click', logout);
  forceReconnectBtn.addEventListener('click', forceReconnect);
  clearAuthBtn.addEventListener('click', clearAuthData);
  selectAllBtn.addEventListener('click', selectAllGroups);
  deselectAllBtn.addEventListener('click', deselectAllGroups);
  saveFavoritesBtn.addEventListener('click', saveFavoriteGroups);
  loadFavoritesBtn.addEventListener('click', loadFavoriteGroups);
  
  // Admin event listeners
  if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', () => {
      window.location.href = '/admin.html';
    });
  }
  
  if (logoutMainBtn) {
    logoutMainBtn.addEventListener('click', handleMainLogout);
  }
  
  // Add refresh groups button listener
  document.getElementById('refresh-groups-btn').addEventListener('click', () => {
    console.log('Manual refresh groups clicked');
    fetchGroups(true);
  });
  
  // Handle form submission for sending messages
  document.getElementById('message-form').addEventListener('submit', function(e) {
    e.preventDefault();
    sendMessage();
  });
  
  // Keep the button click for backward compatibility
  sendBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendMessage();
  });



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
      
      if (isConnected && authState === 'READY') {
        // Add delay to ensure WhatsApp Web is fully loaded
        setTimeout(() => {
          fetchGroups();
        }, 5000); // Reduced delay for Baileys
      }
    } catch (error) {
      console.error('Error checking status:', error);
      statusMessage.textContent = 'Error connecting to server';
    }
  }



  async function initializeWhatsApp() {
    try {
      connectBtn.disabled = true;
      statusMessage.textContent = 'Initializing WhatsApp client...';
      
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
        statusMessage.textContent = `Initialization started (${authState})`;
        
        if (authState === 'QR_REQUIRED') {
          qrcodeContainer.style.display = 'block';
        }
        
        startStatusCheck();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error initializing WhatsApp:', error);
      statusMessage.textContent = `Error: ${error.message}`;
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
          qrcodeContainer.style.display = 'block';
        } else if (authState !== 'QR_REQUIRED') {
          qrcodeContainer.style.display = 'none';
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
            clearInterval(checkInterval);
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
    
    switch (authState) {
      case 'CONNECTING':
        statusText = 'Connecting to WhatsApp...';
        statusClass = 'connecting';
        break;
      case 'QR_REQUIRED':
        statusText = 'Scan QR code to authenticate';
        statusClass = 'qr-required';
        break;
      case 'AUTHENTICATED':
        statusText = 'Authenticated - Preparing WhatsApp Web...';
        statusClass = 'authenticated';
        break;
      case 'READY':
        statusText = 'Connected to WhatsApp - Ready to send messages';
        statusClass = 'connected';
        break;
      case 'DISCONNECTED':
      default:
        statusText = 'Not connected to WhatsApp';
        statusClass = 'disconnected';
        break;
    }
    
    statusMessage.textContent = statusText;
    statusMessage.className = statusClass;
    
    // Show/hide UI elements based on connection state and user role
     if (isConnected && authState === 'READY') {
       connectBtn.style.display = 'none';
       groupsContainer.style.display = 'block';
       messageContainer.style.display = 'block';
       
       // Show loading message in groups list if not already loaded
       if (groups.length === 0) {
         groupsList.innerHTML = '<p>🔄 Loading WhatsApp groups...</p>';
       }
       
       // Check user role before showing WhatsApp control buttons
       checkUserRole();
     } else {
       connectBtn.style.display = 'inline-block';
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
    groupsList.innerHTML = '';
    groups.forEach(group => {
      const div = document.createElement('div');
      div.className = 'group-item';
      div.innerHTML = `
        <input type="checkbox" id="${group.id}" value="${group.id}">
        <label for="${group.id}">${group.name} (${group.participants} members)</label>
      `;
      groupsList.appendChild(div);
    });

    // Add refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh Groups';
    refreshBtn.onclick = () => fetchGroups(true);
    groupsList.appendChild(refreshBtn);
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
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => URL.revokeObjectURL(img.src);
        if (previewContent) previewContent.appendChild(img);
      } else if (fileType.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.onload = () => URL.revokeObjectURL(video.src);
        if (previewContent) previewContent.appendChild(video);
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
    try {
      // Debug: Check if groups list exists and has checkboxes
      const groupsListElement = document.getElementById('groups-list');
      const allCheckboxes = document.querySelectorAll('#groups-list input[type="checkbox"]');
      const checkedCheckboxes = document.querySelectorAll('#groups-list input[type="checkbox"]:checked');
      
      console.log('Debug - Groups list element:', groupsListElement);
      console.log('Debug - Total checkboxes found:', allCheckboxes.length);
      console.log('Debug - Checked checkboxes found:', checkedCheckboxes.length);
      console.log('Debug - Groups array length:', groups.length);
      
      const selectedGroups = Array.from(checkedCheckboxes)
        .map(checkbox => checkbox.value);
      
      console.log('Debug - Selected groups:', selectedGroups);
      
      const message = messageInput.value.trim();
      const batchSize = parseInt(document.getElementById('batch-size').value) || 5;
      
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
      
      sendBtn.disabled = true;
      showSendStatus('Preparing to send message...', '');
      
      // Show progress bar
      const progressContainer = document.getElementById('batch-progress');
      const progressText = document.getElementById('progress-text');
      const progressFill = document.getElementById('progress-fill');
      
      const totalBatches = Math.ceil(selectedGroups.length / batchSize);
      progressContainer.style.display = 'block';
      progressText.textContent = `Preparing batches... (${selectedGroups.length} groups, ${totalBatches} batches)`;
      progressFill.style.width = '0%';
      
      // Prepare form data
      const formData = new FormData();
      formData.append('groupIds', JSON.stringify(selectedGroups));
      formData.append('message', message);
      formData.append('batchSize', batchSize.toString());
      
      if (selectedFile) {
        formData.append('media', selectedFile);
        console.log(`Attaching media file: ${selectedFile.name} (${selectedFile.type})`);
      }
      
      const response = await fetch(`${API_BASE_URL}/send`, {
        method: 'POST',
        body: formData // Don't set Content-Type header, let browser set it with boundary
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Simulate batch progress (since we don't have real-time updates yet)
        for (let i = 1; i <= totalBatches; i++) {
          const progress = (i / totalBatches) * 100;
          progressText.textContent = `Processing batch ${i} of ${totalBatches}...`;
          progressFill.style.width = `${progress}%`;
          
          if (i < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
          }
        }
        
        const mediaText = selectedFile ? ' with media' : '';
        progressText.textContent = 'All messages sent successfully!';
        
        // Show status for WhatsApp only
        let statusMessage = `Message${mediaText} sent to WhatsApp successfully!`;
        let statusType = 'success';
        
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
        
        // Hide progress after 2 seconds
        setTimeout(() => {
          progressContainer.style.display = 'none';
        }, 3000);
      } else {
        progressContainer.style.display = 'none';
        showSendStatus(`Error: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      document.getElementById('batch-progress').style.display = 'none';
      showSendStatus(`Error: ${error.message}`, 'error');
    } finally {
      sendBtn.disabled = false;
    }
  }



  function showSendStatus(message, type) {
    sendStatus.textContent = message;
    sendStatus.className = type;
  }

  async function logout() {
    try {
      logoutBtn.disabled = true;
      statusMessage.textContent = 'Logging out...';
      
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
        statusMessage.textContent = data.message || 'Logged out successfully';
      } else {
        statusMessage.textContent = `Error: ${data.message}`;
        logoutBtn.disabled = false;
      }
    } catch (error) {
      console.error('Error logging out:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      logoutBtn.disabled = false;
    }
  }

  async function forceReconnect() {
    try {
      forceReconnectBtn.disabled = true;
      statusMessage.textContent = 'Force reconnecting...';
      
      const response = await fetch(`${API_BASE_URL}/auth/reconnect`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        statusMessage.textContent = 'Reconnection initiated';
        authState = 'CONNECTING';
        updateUI();
        startStatusCheck();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error force reconnecting:', error);
      statusMessage.textContent = `Reconnection error: ${error.message}`;
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
      statusMessage.textContent = 'Clearing authentication data...';
      
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
        statusMessage.textContent = 'Authentication data cleared. You can now connect again.';
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error clearing auth data:', error);
      statusMessage.textContent = `Clear auth error: ${error.message}`;
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
        showSendStatus('Please select at least one group to save as favorite', 'error');
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
        showSendStatus('Favorite groups saved successfully!', 'success');
      } else {
        showSendStatus(`Error: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error saving favorite groups:', error);
      showSendStatus(`Error: ${error.message}`, 'error');
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
        
        showSendStatus('Favorite groups loaded!', 'success');
      } else if (data.success && data.groups.length === 0) {
        showSendStatus('No favorite groups found', 'error');
      } else {
        showSendStatus(`Error: ${data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error loading favorite groups:', error);
      showSendStatus(`Error: ${error.message}`, 'error');
    } finally {
      loadFavoritesBtn.disabled = false;
    }
  }

  // Check user role and show admin tab if admin
  async function checkUserRole() {
    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/status`);
      const data = await response.json();
      
      if (data.success && data.user && data.user.role === 'admin') {
        // Show admin tab for admin users
        if (adminTabContainer) {
          adminTabContainer.style.display = 'block';
        }
        // Show WhatsApp control buttons for admin users
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (forceReconnectBtn) forceReconnectBtn.style.display = 'inline-block';
        if (clearAuthBtn) clearAuthBtn.style.display = 'inline-block';
      } else {
        // Hide admin tab for non-admin users
        if (adminTabContainer) {
          adminTabContainer.style.display = 'none';
        }
        // Hide WhatsApp control buttons for regular users
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (forceReconnectBtn) forceReconnectBtn.style.display = 'none';
        if (clearAuthBtn) clearAuthBtn.style.display = 'none';
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
});