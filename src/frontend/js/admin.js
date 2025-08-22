document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const backToMainBtn = document.getElementById('back-to-main');
    const logoutBtn = document.getElementById('logout-btn');
    const refreshUsersBtn = document.getElementById('refresh-users');
    const addUserForm = document.getElementById('add-user-form');
    const editUserForm = document.getElementById('edit-user-form');
    const changePasswordForm = document.getElementById('change-password-form');
    const usersTable = document.getElementById('users-table');
    const adminMessage = document.getElementById('admin-message');
    
    // Modals
    const editUserModal = document.getElementById('edit-user-modal');
    const changePasswordModal = document.getElementById('change-password-modal');
    
    // API Base URL
    const API_BASE_URL = '/api/auth';
    
    // Initialize admin panel
    init();
    
    async function init() {
        await checkAdminAuth();
        setupEventListeners();
        await loadUsers();
    }
    
    // Check if user is admin
    async function checkAdminAuth() {
        try {
            const response = await fetch(`${API_BASE_URL}/status`, {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (!data.success || !data.authenticated) {
                window.location.href = '/login';
                return;
            }
            
            if (data.user.role !== 'admin') {
                window.location.href = '/dashboard';
                return;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login';
        }
    }
    
    function setupEventListeners() {
        // Tab switching
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                btn.classList.add('active');
                const targetContent = document.getElementById(`${tabName}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Load data for specific tabs
                if (tabName === 'groups') {
                    loadGroups();
                } else if (tabName === 'messages') {
                    setupMessageForm();
                }
            });
        });
        
        // Navigation
        backToMainBtn.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });
        
        logoutBtn.addEventListener('click', handleLogout);
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                switchTab(tabName);
                if (tabName === 'settings') {
                    loadSettings();
                }
            });
        });
        
        // Users management
        refreshUsersBtn.addEventListener('click', loadUsers);
        
        // Forms
        addUserForm.addEventListener('submit', handleAddUser);
        editUserForm.addEventListener('submit', handleEditUser);
        changePasswordForm.addEventListener('submit', handleChangePassword);
        
        // WhatsApp Control buttons
        const adminWhatsAppLogoutBtn = document.getElementById('admin-whatsapp-logout');
        const adminForceReconnectBtn = document.getElementById('admin-force-reconnect');
        const adminClearAuthBtn = document.getElementById('admin-clear-auth');
        
        if (adminWhatsAppLogoutBtn) {
            adminWhatsAppLogoutBtn.addEventListener('click', handleWhatsAppLogout);
        }
        if (adminForceReconnectBtn) {
            adminForceReconnectBtn.addEventListener('click', handleForceReconnect);
        }
        if (adminClearAuthBtn) {
            adminClearAuthBtn.addEventListener('click', handleClearAuth);
        }
        
        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        });
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
                setTimeout(() => {
                    e.target.style.display = 'none';
                }, 300);
            }
        });
    }
    
    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }
    
    async function handleLogout() {
        try {
            const response = await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (response.ok) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout error:', error);
            showMessage('Logout failed', 'error');
        }
    }
    
    async function loadUsers() {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayUsers(data.users);
            } else {
                showMessage(data.message || 'Failed to load users', 'error');
            }
        } catch (error) {
            console.error('Load users error:', error);
            showMessage('Failed to load users', 'error');
        }
    }
    
    function displayUsers(users) {
        const tbody = usersTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.full_name}</td>
                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                <td><span class="status-badge status-${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                <td class="actions-cell">
                    <button class="btn btn-info" onclick="editUser(${user.id})">Edit</button>
                    <button class="btn btn-warning" onclick="changePassword(${user.id})">Password</button>
                    ${user.is_active ? 
                        `<button class="btn btn-danger" onclick="deactivateUser(${user.id})">Deactivate</button>` : 
                        `<button class="btn btn-secondary" onclick="activateUser(${user.id})">Activate</button>`
                    }
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    async function handleAddUser(e) {
        e.preventDefault();
        
        const formData = new FormData(addUserForm);
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');
        
        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }
        
        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            full_name: formData.get('full_name'),
            role: formData.get('role'),
            password: password
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('User added successfully', 'success');
                addUserForm.reset();
                await loadUsers();
                switchTab('users');
            } else {
                showMessage(data.message || 'Failed to add user', 'error');
            }
        } catch (error) {
            console.error('Add user error:', error);
            showMessage('Failed to add user', 'error');
        }
    }
    
    // Global functions for button actions
    window.editUser = async function(userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'GET',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                const user = data.users.find(u => u.id === userId);
                if (user) {
                    document.getElementById('edit-user-id').value = user.id;
                    document.getElementById('edit-username').value = user.username;
                    document.getElementById('edit-email').value = user.email;
                    document.getElementById('edit-fullname').value = user.full_name;
                    document.getElementById('edit-role').value = user.role;
                    
                    editUserModal.style.display = 'flex';
                    setTimeout(() => {
                        editUserModal.classList.add('show');
                    }, 10);
                }
            }
        } catch (error) {
            console.error('Load user error:', error);
            showMessage('Failed to load user data', 'error');
        }
    };
    
    window.changePassword = function(userId) {
        document.getElementById('password-user-id').value = userId;
        changePasswordModal.style.display = 'flex';
        setTimeout(() => {
            changePasswordModal.classList.add('show');
        }, 10);
    };
    
    window.deactivateUser = async function(userId) {
        if (!confirm('Are you sure you want to deactivate this user?')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/deactivate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ id: userId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('User deactivated successfully', 'success');
                await loadUsers();
            } else {
                showMessage(data.message || 'Failed to deactivate user', 'error');
            }
        } catch (error) {
            console.error('Deactivate user error:', error);
            showMessage('Failed to deactivate user', 'error');
        }
    };

    window.activateUser = async function(userId) {
        if (!confirm('Are you sure you want to activate this user?')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ id: userId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('User activated successfully', 'success');
                await loadUsers();
            } else {
                showMessage(data.message || 'Failed to activate user', 'error');
            }
        } catch (error) {
            console.error('Activate user error:', error);
            showMessage('Failed to activate user', 'error');
        }
    };
    
    window.closeEditModal = function() {
        editUserModal.classList.remove('show');
        setTimeout(() => {
            editUserModal.style.display = 'none';
        }, 300);
    };
    
    window.closePasswordModal = function() {
        changePasswordModal.classList.remove('show');
        setTimeout(() => {
            changePasswordModal.style.display = 'none';
        }, 300);
    };
    
    async function handleEditUser(e) {
        e.preventDefault();
        
        const formData = new FormData(editUserForm);
        const userId = document.getElementById('edit-user-id').value;
        
        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            full_name: formData.get('full_name'),
            role: formData.get('role')
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('User updated successfully', 'success');
                closeEditModal();
                await loadUsers();
            } else {
                showMessage(data.message || 'Failed to update user', 'error');
            }
        } catch (error) {
            console.error('Update user error:', error);
            showMessage('Failed to update user', 'error');
        }
    }
    
    async function handleChangePassword(e) {
        e.preventDefault();
        
        const formData = new FormData(changePasswordForm);
        const userId = document.getElementById('password-user-id').value;
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');
        
        if (password !== confirmPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    userId: parseInt(userId), 
                    newPassword: password 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('Password changed successfully', 'success');
                closePasswordModal();
                changePasswordForm.reset();
            } else {
                showMessage(data.message || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Change password error:', error);
            showMessage('Failed to change password', 'error');
        }
    }
    
    // Groups management functions
    async function loadGroups() {
        try {
            const response = await fetch('/api/whatsapp/groups');
            const data = await response.json();
            
            const groupsList = document.getElementById('groups-list');
            
            if (data.success && data.groups) {
                groupsList.innerHTML = data.groups.map(group => `
                    <div class="group-item">
                        <input type="checkbox" id="group-${group.id}" value="${group.id}" class="group-checkbox">
                        <label for="group-${group.id}" class="group-label">
                            <div class="group-info">
                                <span class="group-name">${group.name}</span>
                                <span class="group-participants">${group.participants || 0} أعضاء</span>
                            </div>
                        </label>
                    </div>
                `).join('');
                
                setupGroupsEventListeners();
            } else {
                groupsList.innerHTML = '<p class="no-groups">لا توجد مجموعات متاحة. تأكد من اتصال واتساب.</p>';
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            document.getElementById('groups-list').innerHTML = '<p class="error">خطأ في تحميل المجموعات</p>';
        }
    }
    
    function setupGroupsEventListeners() {
        // Select/Deselect all buttons
        document.getElementById('select-all-btn')?.addEventListener('click', () => {
            document.querySelectorAll('.group-checkbox').forEach(cb => cb.checked = true);
        });
        
        document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
            document.querySelectorAll('.group-checkbox').forEach(cb => cb.checked = false);
        });
        
        // Refresh groups
        document.getElementById('refresh-groups-btn')?.addEventListener('click', loadGroups);
    }
    
    // Message form setup
    function setupMessageForm() {
        const messageForm = document.getElementById('message-form');
        
        if (messageForm && !messageForm.hasAttribute('data-setup')) {
            messageForm.setAttribute('data-setup', 'true');
            
            messageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await sendMessage();
            });
        }
    }
    
    async function sendMessage() {
        const messageInput = document.getElementById('message-input');
        const mediaInput = document.getElementById('media-input');
        const batchSizeInput = document.getElementById('batch-size');
        const delayInput = document.getElementById('delay-input');
        const linkPreviewToggle = document.getElementById('link-preview-toggle');
        
        const selectedGroups = Array.from(document.querySelectorAll('.group-checkbox:checked'))
            .map(cb => cb.value);
        
        if (selectedGroups.length === 0) {
            showMessage('يرجى تحديد مجموعة واحدة على الأقل', 'error');
            return;
        }
        
        if (!messageInput.value.trim()) {
            showMessage('يرجى كتابة نص الرسالة', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('message', messageInput.value);
        formData.append('groups', JSON.stringify(selectedGroups));
        formData.append('batchSize', batchSizeInput.value || '5');
        formData.append('delay', delayInput.value || '2');
        formData.append('linkPreview', linkPreviewToggle.value === 'true');
        
        if (mediaInput.files[0]) {
            formData.append('media', mediaInput.files[0]);
        }
        
        try {
            showProgress(true);
            
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('تم إرسال الرسالة بنجاح', 'success');
                messageForm.reset();
            } else {
                showMessage(data.message || 'خطأ في إرسال الرسالة', 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showMessage('خطأ في إرسال الرسالة', 'error');
        } finally {
            showProgress(false);
        }
    }
    
    function showProgress(show) {
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.style.display = show ? 'block' : 'none';
        }
    }

    function showMessage(message, type) {
        adminMessage.textContent = message;
        adminMessage.className = `message ${type}`;
        adminMessage.style.display = 'block';
        
        setTimeout(() => {
            adminMessage.style.display = 'none';
        }, 5000);
    }
    
    // WhatsApp Control Functions
    async function handleWhatsAppLogout() {
        if (!confirm('Are you sure you want to logout from WhatsApp? This will disconnect the WhatsApp session.')) {
            return;
        }
        
        try {
            const btn = document.getElementById('admin-whatsapp-logout');
            btn.disabled = true;
            btn.textContent = 'Logging out...';
            
            const response = await fetch('/api/whatsapp/logout', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('WhatsApp logged out successfully', 'success');
                updateWhatsAppStatus();
            } else {
                showMessage(`Logout error: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error logging out from WhatsApp:', error);
            showMessage(`Logout error: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('admin-whatsapp-logout');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout from WhatsApp';
        }
    }
    
    async function handleForceReconnect() {
        if (!confirm('Are you sure you want to force reconnect WhatsApp? This will restart the connection.')) {
            return;
        }
        
        try {
            const btn = document.getElementById('admin-force-reconnect');
            btn.disabled = true;
            btn.textContent = 'Reconnecting...';
            
            const response = await fetch('/api/whatsapp/auth/reconnect', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('Reconnection initiated successfully', 'success');
                updateWhatsAppStatus();
            } else {
                showMessage(`Reconnection error: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error force reconnecting:', error);
            showMessage(`Reconnection error: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('admin-force-reconnect');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-redo-alt"></i> Force Reconnect';
        }
    }
    
    async function handleClearAuth() {
        if (!confirm('Are you sure you want to clear all WhatsApp authentication data? This will require re-scanning the QR code.')) {
            return;
        }
        
        try {
            const btn = document.getElementById('admin-clear-auth');
            btn.disabled = true;
            btn.textContent = 'Clearing...';
            
            const response = await fetch('/api/whatsapp/auth/clear', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('Authentication data cleared successfully', 'success');
                updateWhatsAppStatus();
            } else {
                showMessage(`Clear auth error: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error clearing auth data:', error);
            showMessage(`Clear auth error: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('admin-clear-auth');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-trash-alt"></i> Clear Authentication Data';
        }
    }
    
    async function updateWhatsAppStatus() {
        try {
            const response = await fetch('/api/whatsapp/status');
            const data = await response.json();
            
            const statusElement = document.getElementById('admin-whatsapp-status');
            const authElement = document.getElementById('admin-auth-status');
            
            if (statusElement) {
                if (data.success) {
                    const isConnected = data.connected || data.isConnected;
                    statusElement.innerHTML = isConnected ? 
                        '<i class="fas fa-check-circle"></i> متصل' : 
                        '<i class="fas fa-times-circle"></i> غير متصل';
                    statusElement.className = `status-value ${isConnected ? 'connected' : 'disconnected'}`;
                } else {
                    statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في الاتصال';
                    statusElement.className = 'status-value disconnected';
                }
            }
            
            if (authElement) {
                if (data.success) {
                    const isAuthenticated = data.isAuthenticated || (data.state === 'READY');
                    authElement.innerHTML = isAuthenticated ? 
                        '<i class="fas fa-shield-alt"></i> مصادق عليه' : 
                        '<i class="fas fa-shield-alt"></i> غير مصادق';
                    authElement.className = `status-value ${isAuthenticated ? 'connected' : 'disconnected'}`;
                } else {
                    authElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في المصادقة';
                    authElement.className = 'status-value disconnected';
                }
            }
        } catch (error) {
            console.error('Error updating WhatsApp status:', error);
            const statusElement = document.getElementById('admin-whatsapp-status');
            const authElement = document.getElementById('admin-auth-status');
            
            if (statusElement) {
                statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في الشبكة';
                statusElement.className = 'status-value disconnected';
            }
            if (authElement) {
                authElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في الشبكة';
                authElement.className = 'status-value disconnected';
            }
        }
    }
    
    // Update WhatsApp status when WhatsApp tab is opened
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === 'whatsapp') {
            btn.addEventListener('click', () => {
                setTimeout(updateWhatsAppStatus, 100);
            });
        }
    });

    // Settings functions
    async function loadSettings() {
        try {
            const response = await fetch('/api/settings', {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                document.getElementById('toggle-telegram').checked = data.settings.sendToTelegram;
                document.getElementById('toggle-whatsapp').checked = data.settings.sendToWhatsApp;
                document.getElementById('toggle-telegram-settings').checked = data.settings.telegramSettings;
                document.getElementById('batch-size-setting').value = data.settings.batchSize;
                
                // Load Telegram configuration if available
                if (data.settings.telegramConfig) {
                    document.getElementById('telegram-bot-token').value = data.settings.telegramConfig.botToken || '';
                    document.getElementById('telegram-channel-id').value = data.settings.telegramConfig.channelId || '';
                    document.getElementById('telegram-user-id').value = data.settings.telegramConfig.userId || '';
                }
                
                // Show/hide Telegram config based on toggle
                toggleTelegramConfig(data.settings.telegramSettings);
            } else {
                showMessage('Failed to load settings', 'error');
            }
        } catch (error) {
            console.error('Load settings error:', error);
            showMessage('Failed to load settings', 'error');
        }
    }

    async function updateSetting(key, value) {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ [key]: value })
            });
            const data = await response.json();
            if (!data.success) {
                showMessage('Failed to update setting', 'error');
            }
        } catch (error) {
            console.error('Update setting error:', error);
            showMessage('Failed to update setting', 'error');
        }
    }

    // Function to toggle Telegram config visibility
    function toggleTelegramConfig(show) {
        const configSection = document.getElementById('telegram-config');
        if (configSection) {
            configSection.style.display = show ? 'block' : 'none';
        }
    }
    
    // Function to save Telegram configuration
    async function saveTelegramConfig() {
        try {
            const botToken = document.getElementById('telegram-bot-token').value.trim();
            const channelId = document.getElementById('telegram-channel-id').value.trim();
            const userId = document.getElementById('telegram-user-id').value.trim();
            
            if (!botToken || !channelId || !userId) {
                showMessage('يرجى ملء جميع حقول إعدادات تليجرام', 'error');
                return;
            }
            
            const telegramConfig = {
                botToken: botToken,
                channelId: channelId,
                userId: userId
            };
            
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ telegramConfig: telegramConfig })
            });
            
            const data = await response.json();
            if (data.success) {
                showMessage('تم حفظ إعدادات تليجرام بنجاح', 'success');
            } else {
                showMessage('فشل في حفظ إعدادات تليجرام', 'error');
            }
        } catch (error) {
            console.error('Save Telegram config error:', error);
            showMessage('فشل في حفظ إعدادات تليجرام', 'error');
        }
    }

    // Setup settings event listeners
    document.getElementById('toggle-telegram').addEventListener('change', (e) => updateSetting('sendToTelegram', e.target.checked));
    document.getElementById('toggle-whatsapp').addEventListener('change', (e) => updateSetting('sendToWhatsApp', e.target.checked));
    document.getElementById('toggle-telegram-settings').addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        updateSetting('telegramSettings', isEnabled);
        toggleTelegramConfig(isEnabled);
    });
    document.getElementById('batch-size-setting').addEventListener('change', (e) => updateSetting('batchSize', parseInt(e.target.value)));
    
    // Setup Telegram config save button
    document.getElementById('save-telegram-config').addEventListener('click', saveTelegramConfig);
});

// Mobile Menu Functions
function toggleMobileMenu() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    if (sidebar.classList.contains('mobile-open')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Close mobile menu when tab is clicked
document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });
    
    // Initialize scheduled messages functionality
    initScheduledMessages();
    
    // Initialize notifications functionality
    initNotifications();
});

// Scheduled Messages Functionality
function initScheduledMessages() {
    const addScheduledMessageBtn = document.getElementById('add-scheduled-message');
    const scheduledMessageModal = document.getElementById('scheduled-message-modal');
    const scheduledMessageForm = document.getElementById('scheduled-message-form');
    const addTimeSlotBtn = document.getElementById('add-time-slot');
    const timesPerDayInput = document.getElementById('scheduled-message-times-per-day');
    
    if (!addScheduledMessageBtn) return;
    
    // Load scheduled messages when tab is opened
    document.querySelector('[data-tab="scheduled-messages"]').addEventListener('click', loadScheduledMessages);
    
    // Add new scheduled message
    addScheduledMessageBtn.addEventListener('click', () => {
        openScheduledMessageModal();
    });
    
    // Handle times per day change
    timesPerDayInput.addEventListener('change', updateTimeSlots);
    
    // Add time slot
    addTimeSlotBtn.addEventListener('click', addTimeSlot);
    
    // Form submission
    scheduledMessageForm.addEventListener('submit', handleScheduledMessageSubmit);
    
    // Modal close
    scheduledMessageModal.querySelector('.close').addEventListener('click', closeScheduledMessageModal);
    
    // Close modal when clicking outside
    scheduledMessageModal.addEventListener('click', (e) => {
        if (e.target === scheduledMessageModal) {
            closeScheduledMessageModal();
        }
    });
}

async function loadScheduledMessages() {
    try {
        const response = await fetch('/api/scheduled-messages');
        const data = await response.json();
        
        if (data.success) {
            displayScheduledMessages(data.messages);
        } else {
            showMessage('خطأ في تحميل الرسائل المجدولة', 'error');
        }
    } catch (error) {
        console.error('Error loading scheduled messages:', error);
        showMessage('خطأ في الاتصال بالخادم', 'error');
    }
}

function displayScheduledMessages(messages) {
    const container = document.getElementById('scheduled-messages-list');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3>لا توجد رسائل مجدولة</h3>
                <p>اضغط على "إضافة رسالة مجدولة" لإنشاء رسالة جديدة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map(message => `
        <div class="scheduled-message-card" data-id="${message.id}">
            <div class="scheduled-message-header">
                <span class="scheduled-message-status ${message.status}">
                    <i class="fas fa-${getStatusIcon(message.status)}"></i>
                    ${getStatusText(message.status)}
                </span>
                <div class="scheduled-message-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editScheduledMessage(${message.id})">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn btn-${message.status === 'active' ? 'warning' : 'success'} btn-sm" onclick="toggleScheduledMessage(${message.id})">
                        <i class="fas fa-${message.status === 'active' ? 'pause' : 'play'}"></i>
                        ${message.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteScheduledMessage(${message.id})">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
            
            <div class="scheduled-message-content">
                ${message.content}
            </div>
            
            <div class="scheduled-message-info">
                <div class="scheduled-message-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>تاريخ البداية: ${new Date(message.startDate).toLocaleDateString('ar-SA')}</span>
                </div>
                <div class="scheduled-message-info-item">
                    <i class="fas fa-repeat"></i>
                    <span>عدد المرات: ${message.timesPerDay} مرة يومياً</span>
                </div>
                <div class="scheduled-message-info-item">
                    <i class="fas fa-clock"></i>
                    <span>الأوقات:</span>
                    <div class="scheduled-message-times">
                        ${message.scheduledTimes.map(time => `<span class="scheduled-time-badge">${time}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function getStatusIcon(status) {
    switch (status) {
        case 'active': return 'play-circle';
        case 'paused': return 'pause-circle';
        case 'inactive': return 'stop-circle';
        default: return 'question-circle';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'active': return 'نشط';
        case 'paused': return 'متوقف مؤقتاً';
        case 'inactive': return 'غير نشط';
        default: return 'غير معروف';
    }
}

function openScheduledMessageModal(messageId = null) {
    const modal = document.getElementById('scheduled-message-modal');
    const form = document.getElementById('scheduled-message-form');
    const title = document.getElementById('scheduled-message-modal-title');
    
    // Reset form
    form.reset();
    document.getElementById('scheduled-message-id').value = messageId || '';
    
    // Set modal title
    title.textContent = messageId ? 'تعديل رسالة مجدولة' : 'إضافة رسالة مجدولة';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduled-message-start-date').value = today;
    
    // Reset time slots
    updateTimeSlots();
    
    // Load message data if editing
    if (messageId) {
        loadScheduledMessageData(messageId);
    }
    
    modal.style.display = 'block';
}

function closeScheduledMessageModal() {
    const modal = document.getElementById('scheduled-message-modal');
    modal.style.display = 'none';
}

async function loadScheduledMessageData(messageId) {
    try {
        const response = await fetch(`/api/scheduled-messages/${messageId}`);
        const data = await response.json();
        
        if (data.success) {
            const message = data.message;
            document.getElementById('scheduled-message-content').value = message.content;
            document.getElementById('scheduled-message-times-per-day').value = message.timesPerDay;
            document.getElementById('scheduled-message-start-date').value = message.startDate.split('T')[0];
            document.getElementById('scheduled-message-status').value = message.status;
            
            // Update time slots
            updateTimeSlots();
            
            // Set time values
            const timeInputs = document.querySelectorAll('input[name="scheduledTimes"]');
            message.scheduledTimes.forEach((time, index) => {
                if (timeInputs[index]) {
                    timeInputs[index].value = time;
                }
            });
        }
    } catch (error) {
        console.error('Error loading scheduled message:', error);
        showMessage('خطأ في تحميل بيانات الرسالة', 'error');
    }
}

function updateTimeSlots() {
    const timesPerDay = parseInt(document.getElementById('scheduled-message-times-per-day').value) || 1;
    const container = document.getElementById('scheduled-times-container');
    const currentSlots = container.querySelectorAll('.scheduled-time-item').length;
    
    // Add or remove time slots as needed
    if (timesPerDay > currentSlots) {
        for (let i = currentSlots; i < timesPerDay; i++) {
            addTimeSlot();
        }
    } else if (timesPerDay < currentSlots) {
        const slotsToRemove = currentSlots - timesPerDay;
        const slots = container.querySelectorAll('.scheduled-time-item');
        for (let i = 0; i < slotsToRemove; i++) {
            const lastSlot = slots[slots.length - 1 - i];
            if (lastSlot) {
                lastSlot.remove();
            }
        }
    }
    
    // Update remove button visibility
    updateRemoveButtonsVisibility();
}

function addTimeSlot() {
    const container = document.getElementById('scheduled-times-container');
    const timeSlot = document.createElement('div');
    timeSlot.className = 'scheduled-time-item';
    timeSlot.innerHTML = `
        <input type="time" name="scheduledTimes" required>
        <button type="button" class="btn btn-danger btn-sm remove-time">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    // Add remove event listener
    timeSlot.querySelector('.remove-time').addEventListener('click', () => {
        timeSlot.remove();
        // Update times per day input
        const currentCount = container.querySelectorAll('.scheduled-time-item').length;
        document.getElementById('scheduled-message-times-per-day').value = currentCount;
        updateRemoveButtonsVisibility();
    });
    
    container.appendChild(timeSlot);
    updateRemoveButtonsVisibility();
}

function updateRemoveButtonsVisibility() {
    const container = document.getElementById('scheduled-times-container');
    const removeButtons = container.querySelectorAll('.remove-time');
    const shouldShow = removeButtons.length > 1;
    
    removeButtons.forEach(btn => {
        btn.style.display = shouldShow ? 'block' : 'none';
    });
}

async function handleScheduledMessageSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const messageId = document.getElementById('scheduled-message-id').value;
    
    // Collect scheduled times
    const timeInputs = document.querySelectorAll('input[name="scheduledTimes"]');
    const scheduledTimes = Array.from(timeInputs).map(input => input.value).filter(time => time);
    
    const messageData = {
        content: formData.get('content'),
        timesPerDay: parseInt(formData.get('timesPerDay')),
        startDate: formData.get('startDate'),
        status: formData.get('status'),
        scheduledTimes: scheduledTimes
    };
    
    try {
        const url = messageId ? `/api/scheduled-messages/${messageId}` : '/api/scheduled-messages';
        const method = messageId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(messageId ? 'تم تحديث الرسالة المجدولة بنجاح' : 'تم إضافة الرسالة المجدولة بنجاح', 'success');
            closeScheduledMessageModal();
            loadScheduledMessages();
        } else {
            showMessage(data.message || 'خطأ في حفظ الرسالة المجدولة', 'error');
        }
    } catch (error) {
        console.error('Error saving scheduled message:', error);
        showMessage('خطأ في الاتصال بالخادم', 'error');
    }
}

async function editScheduledMessage(messageId) {
    openScheduledMessageModal(messageId);
}

async function toggleScheduledMessage(messageId) {
    try {
        const response = await fetch(`/api/scheduled-messages/${messageId}/toggle`, {
            method: 'PATCH'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('تم تغيير حالة الرسالة المجدولة بنجاح', 'success');
            loadScheduledMessages();
        } else {
            showMessage(data.message || 'خطأ في تغيير حالة الرسالة', 'error');
        }
    } catch (error) {
        console.error('Error toggling scheduled message:', error);
        showMessage('خطأ في الاتصال بالخادم', 'error');
    }
}

async function deleteScheduledMessage(messageId) {
    if (!confirm('هل أنت متأكد من حذف هذه الرسالة المجدولة؟')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/scheduled-messages/${messageId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('تم حذف الرسالة المجدولة بنجاح', 'success');
            loadScheduledMessages();
        } else {
            showMessage(data.message || 'خطأ في حذف الرسالة', 'error');
        }
    } catch (error) {
        console.error('Error deleting scheduled message:', error);
        showMessage('خطأ في الاتصال بالخادم', 'error');
    }
}

// Notification System
let notificationDropdownOpen = false;
let notificationCheckInterval;

function initNotifications() {
    // Start checking for notifications every 30 seconds
    loadNotifications();
    notificationCheckInterval = setInterval(loadNotifications, 30000);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer.contains(event.target)) {
            closeNotificationDropdown();
        }
    });
}

async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayNotifications(data.notifications);
            updateNotificationBadge(data.notifications);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function displayNotifications(notifications) {
    const notificationList = document.getElementById('notificationList');
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications">No notifications</div>';
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => {
        const timeAgo = getTimeAgo(notification.timestamp);
        const unreadClass = notification.read ? '' : 'unread';
        
        return `
            <div class="notification-item ${unreadClass}" onclick="markNotificationRead('${notification.id}')">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${timeAgo}</div>
                ${!notification.read ? '<div class="notification-actions"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); markNotificationRead(\''+notification.id+'\');">Mark as Read</button></div>' : ''}
            </div>
        `;
    }).join('');
}

function updateNotificationBadge(notifications) {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    
    if (notificationDropdownOpen) {
        closeNotificationDropdown();
    } else {
        dropdown.classList.add('show');
        notificationDropdownOpen = true;
        loadNotifications(); // Refresh notifications when opened
    }
}

function closeNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.remove('show');
    notificationDropdownOpen = false;
}

async function markNotificationRead(notificationId) {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
            method: 'PATCH',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadNotifications(); // Refresh notifications
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
            method: 'PATCH',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadNotifications(); // Refresh notifications
            showMessage('All notifications marked as read', 'success');
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showMessage('Error marking notifications as read', 'error');
    }
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}