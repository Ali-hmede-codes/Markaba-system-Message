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
        // First check if user has rememberMe data in localStorage
        const rememberedUser = localStorage.getItem('rememberedUser');
        if (rememberedUser) {
            const userData = JSON.parse(rememberedUser);
            // Pre-fill username if remembered
            if (userData.username && usernameInput) {
                usernameInput.value = userData.username;
                document.getElementById('rememberMe').checked = true;
            }
        }
        
        const response = await fetch(`${API_BASE_URL}/auth/status`, {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.authenticated) {
            // User is already logged in, redirect to dashboard
            window.location.href = '/dashboard';
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
    const rememberMe = document.getElementById('rememberMe').checked;
    
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
                password: password,
                rememberMe: rememberMe
            })
        });
        
        // Check if response is ok before parsing JSON
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
                // Handle remember me functionality
                if (rememberMe) {
                    // Store user data in localStorage for future logins
                    const userDataToRemember = {
                        username: username,
                        fullName: data.user.full_name,
                        role: data.user.role,
                        rememberedAt: new Date().toISOString()
                    };
                    localStorage.setItem('rememberedUser', JSON.stringify(userDataToRemember));
                } else {
                    // Clear remembered user data if rememberMe is not checked
                    localStorage.removeItem('rememberedUser');
                }
                
                showMessage('تم تسجيل الدخول بنجاح! جاري التحويل...', 'success');
                
                // Redirect after a short delay
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                showMessage(data.message || 'فشل تسجيل الدخول', 'error');
                setLoadingState(false);
            }
        } else {
            // Handle HTTP error status codes
            if (response.status === 401) {
                showMessage('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
            } else if (response.status === 500) {
                showMessage('خطأ في الخادم. يرجى المحاولة لاحقاً', 'error');
            } else {
                showMessage('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى', 'error');
            }
            setLoadingState(false);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('خطأ في الاتصال. يرجى المحاولة مرة أخرى.', 'error');
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

// Clear remembered user data
function clearRememberedUser() {
    localStorage.removeItem('rememberedUser');
    usernameInput.value = '';
    passwordInput.value = '';
    document.getElementById('rememberMe').checked = false;
    showMessage('Remembered login data cleared', 'info');
}

// Make clearRememberedUser globally accessible
window.clearRememberedUser = clearRememberedUser;

// Handle network errors
window.addEventListener('online', function() {
    clearMessage();
});

window.addEventListener('offline', function() {
    showMessage('No internet connection', 'warning');
});