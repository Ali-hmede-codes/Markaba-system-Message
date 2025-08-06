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
            
            if (!data.success || !data.authenticated || data.user.role !== 'admin') {
                window.location.href = '/dashboard';
                return;
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login';
        }
    }
    
    function setupEventListeners() {
        // Navigation
        backToMainBtn.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });
        
        logoutBtn.addEventListener('click', handleLogout);
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchTab(e.target.dataset.tab);
            });
        });
        
        // Users management
        refreshUsersBtn.addEventListener('click', loadUsers);
        
        // Forms
        addUserForm.addEventListener('submit', handleAddUser);
        editUserForm.addEventListener('submit', handleEditUser);
        changePasswordForm.addEventListener('submit', handleChangePassword);
        
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
            id: parseInt(userId),
            username: formData.get('username'),
            email: formData.get('email'),
            full_name: formData.get('full_name'),
            role: formData.get('role')
        };
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/update`, {
                method: 'POST',
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
    
    function showMessage(message, type) {
        adminMessage.textContent = message;
        adminMessage.className = `message ${type}`;
        adminMessage.style.display = 'block';
        
        setTimeout(() => {
            adminMessage.style.display = 'none';
        }, 5000);
    }
});