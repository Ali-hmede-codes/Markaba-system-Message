// Login page JavaScript
const API_BASE_URL = '/api';

// DOM elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.querySelector('.btn-text');
const btnLoading = document.querySelector('.btn-loading');
const loginMessage = document.getElementById('loginMessage');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already authenticated
    checkAuthStatus();
    
    // Add form submit listener
    loginForm.addEventListener('submit', handleLogin);
    
    // Add enter key listener for inputs
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            passwordInput.focus();
        }
    });
    
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
    
    // Clear message when user starts typing
    usernameInput.addEventListener('input', clearMessage);
    passwordInput.addEventListener('input', clearMessage);
});

// Check if user is already authenticated
async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/status`, {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.authenticated) {
            // User is already logged in, redirect to main page
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Auth status check error:', error);
        // Continue with login page if check fails
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    // Validate inputs
    if (!username || !password) {
        showMessage('Please enter both username and password', 'error');
        return;
    }
    
    // Show loading state
    setLoadingState(true);
    clearMessage();
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showMessage(data.message || 'Login failed', 'error');
            setLoadingState(false);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Connection error. Please try again.', 'error');
        setLoadingState(false);
    }
}

// Set loading state for login button
function setLoadingState(loading) {
    loginBtn.disabled = loading;
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
    } else {
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

// Show message to user
function showMessage(message, type = 'info') {
    loginMessage.textContent = message;
    loginMessage.className = `message ${type}`;
    loginMessage.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            clearMessage();
        }, 3000);
    }
}

// Clear message
function clearMessage() {
    loginMessage.style.display = 'none';
    loginMessage.textContent = '';
    loginMessage.className = 'message';
}

// Handle network errors
window.addEventListener('online', function() {
    clearMessage();
});

window.addEventListener('offline', function() {
    showMessage('No internet connection', 'warning');
});