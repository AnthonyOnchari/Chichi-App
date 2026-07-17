// Firebase config loaded from config.js
// Safety check: only initialize if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log('✅ Firebase initialized');
} else {
    console.log('⚠️ Firebase already initialized, skipping init');
}

// Initialize Firebase variables AFTER firebase.initializeApp()
var auth = firebase.auth();
var db = firebase.database();

db.ref('.info/connected').on('value', function(snapshot) {
  if (snapshot.val() === true) {
  } else {
  }
});

var loadingTimeout = setTimeout(() => {
  var loading = document.getElementById('loadingScreen');
  if (loading) {
    loading.classList.remove('active');
    loading.style.display = 'none';
  }
  var authPage = document.getElementById('authPage');
  if (authPage) {
    authPage.style.display = 'flex';
  }
}, 3000);  // 3 second fallback

// Firebase references (using FIREBASE_CONFIG from config.js)
var auth = firebase.auth();
var db = firebase.database();

// Constants loaded from config.js
// CLOUD_NAME, UPLOAD_PRESET, ADMIN_PASSWORD, MUSIC_PLAYLIST, HASHTAG_CATEGORIES

var app = {
    user: null,
    profile: {},
    posts: [],
    users: {},
    balance: 0,
    currentChat: null,
    following: {},
    unreadMessages: {},
    likedPosts: {},
    adminOpen: false,
    userHasInteracted: false,  // Track if user has interacted (for audio/vibration)
    unreadTrackingStarted: false,  // Track if unread tracking has started
    unreadTrackingActive: false,   // Track if unread tracking is currently running

    init: function() {
        var self = this;
       
        // Initialize data structures
        this.chatMessages = {};
        this.unreadMessages = {};
        this.notifiedMessages = {};
       
        // Track user interaction (needed for audio/vibration in modern browsers)
        var interactionHandler = function() {
            if (!self.userHasInteracted) {
                self.userHasInteracted = true;
                console.log('👆 User interaction detected - audio/vibration enabled');
                // Remove listeners after first interaction
                document.removeEventListener('click', interactionHandler);
                document.removeEventListener('touch', interactionHandler);
                document.removeEventListener('keydown', interactionHandler);
            }
        };
        document.addEventListener('click', interactionHandler, { once: false });
        document.addEventListener('touch', interactionHandler, { once: false });
        document.addEventListener('keydown', interactionHandler, { once: false });
       
        // Initialize consent management
        this.initConsent();
       
        // Register Service Worker for push notifications
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
                .then(reg => {
                    console.log('✅ Service Worker registered');
                    self.initNotifications();
                })
                .catch(err => {
                    console.error('⚠️ SW failed:', err);
                    self.initNotifications();
                });
        }
       
        auth.onAuthStateChanged(u => {
            clearTimeout(loadingTimeout);
            if (u) {
                // LOGGED IN USER
                self.user = u;
                self.isGuest = false;
               
                db.ref('users/' + u.uid).once('value', s => {
                    if (s.exists()) {
                        self.profile = s.val();
                        self.balance = self.profile.balance || 0;
                    } else {
                        self.profile = {
                            name: u.displayName || 'User',
                            email: u.email,
                            bio: '',
                            profilePhoto: u.photoURL || '',
                            balance: 0,
                            followers: 0,
                            following: 0
                        };
                    }
                    self.loadProfile();
                    self.showApp();
                });
            } else {
                // GUEST MODE - show app without auth
                self.user = null;
                self.isGuest = true;
                self.profile = { name: 'Guest', balance: 0 };
                self.updateLogoutButton();
                self.showApp();
            }
        });

        document.getElementById('photoInput').addEventListener('change', e => this.previewPhoto(e));
       
        setTimeout(() => {
            var chatInput = document.getElementById('chatModalInput');
            if (chatInput) {
                chatInput.addEventListener('keypress', e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        self.sendChatMessage();
                    }
                });
            }
        }, 500);
       
        // Handle ESC key and hardware back button (Android)
        document.addEventListener('keydown', e => {
            // Only ESC key triggers back navigation
            // Backspace should work normally in text inputs
            if (e.key === 'Escape') {
                e.preventDefault();
                self.goBack();
            }
        });
       
        // Handle hardware back button (Android/Cordova)
        if (typeof window.cordova !== 'undefined') {
            document.addEventListener('backbutton', () => {
                self.goBack();
            }, false);
        }
       
        // Handle browser back button (Web)
        window.addEventListener('popstate', () => {
            // Push state again to prevent browser back
            history.pushState(null, null, window.location.href);
            self.goBack();
        });
       
        // Initialize with a state for browser back handling
        history.pushState(null, null, window.location.href);
        
        // Setup real-time signup heatmap updates
        setTimeout(() => {
            self.setupHeatmapListener();
        }, 1000);
    },

    // Hide/show logout button and post creation UI based on auth state
    updateLogoutButton: function() {
        var logoutBtn = document.querySelector('[onclick="app.showLogout()"]');
        var adminBtn = document.querySelector('[onclick="app.openAdminModal()"]');
        var createStoryBtn = document.getElementById('createStoryBtn');
        var quickPostBox = document.getElementById('quickPostBox');
        
        if (logoutBtn) {
            logoutBtn.style.display = this.isGuest ? 'none' : 'block';
        }
        if (adminBtn) {
            adminBtn.style.display = this.isGuest ? 'none' : 'block';
        }
        if (createStoryBtn) {
            createStoryBtn.style.display = this.isGuest ? 'none' : 'block';
        }
        if (quickPostBox) {
            quickPostBox.style.display = this.isGuest ? 'none' : 'flex';
            quickPostBox.style.pointerEvents = this.isGuest ? 'none' : 'auto';
        }
    },

    // Check if user is authenticated before action
    requireAuth: function(action) {
        if (this.isGuest || !this.user) {
            this.toast('🔐 Sign up to ' + (action || 'access this'), 'info');
            this.showLoginPage();
            return false;
        }
        return true;
    },

    showAuth: function() {
        // Hide loading screen completely
        var loading = document.getElementById('loadingScreen');
        if (loading) {
            loading.classList.remove('active');
            loading.style.display = 'none';
        }
       
        // Show auth page
        var authPage = document.getElementById('authPage');
        if (authPage) {
            authPage.style.display = 'flex';
            authPage.style.visibility = 'visible';
            authPage.style.opacity = '1';
        }
       
        // Hide main app
        var mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.style.display = 'none';
            mainApp.classList.remove('active');
        }
       
        // Hide admin portal
        var admin = document.getElementById('adminPortal');
        if (admin) {
            admin.style.display = 'none';
            admin.classList.remove('active');
        }
       
        // Hide bottom nav
        var nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'none';
       
        // Hide all views
        document.querySelectorAll('.view').forEach(v => {
            v.style.display = 'none';
        });
    },

    showApp: function() {
        // Initialize data structures
        if (!this.chatMessages) this.chatMessages = {};
        if (!this.unreadMessages) this.unreadMessages = {};
        if (!this.notifiedMessages) this.notifiedMessages = {};
        if (!this.navigationHistory) this.navigationHistory = [];
        if (!this.currentView) this.currentView = 'feed';
       
        // Hide loading screen COMPLETELY
        var loading = document.getElementById('loadingScreen');
        if (loading) {
            loading.classList.remove('active');
            loading.classList.add('hidden');
            loading.style.display = 'none';
            loading.style.visibility = 'hidden';
            loading.style.opacity = '0';
            loading.style.zIndex = '-1';
        }
       
        // Hide auth page COMPLETELY
        var authPage = document.getElementById('authPage');
        if (authPage) {
            authPage.classList.remove('show');
            authPage.classList.add('hidden');
            authPage.style.display = 'none';
            authPage.style.visibility = 'hidden';
            authPage.style.opacity = '0';
        }
       
        // Show main app
        var mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.style.display = 'block';
            mainApp.classList.add('active');
        }
       
        // Hide admin portal
        var admin = document.getElementById('adminPortal');
        if (admin) {
            admin.classList.remove('active');
        }
       
        // Show bottom nav
        var nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'flex';
       
        // Request notification permission
        var self = this;
        setTimeout(() => {
            self.requestNotificationPermission();
        }, 1500);
       
        // CRITICAL: Proper initialization sequence with guaranteed ordering
        console.log('🚀 Starting app initialization sequence...');
       
        // Step 1: Load posts
        console.log('📮 Step 1: Loading posts...');
        self.loadPosts();
        self.loadStories();  // Load Telegram-style stories
       
        // Step 2: Load users FIRST, then wait for completion before notifications
        console.log('📥 Step 2: Loading users...');
        self.loadUsers();
       
        // Step 3: Load following
        console.log('👥 Step 3: Loading following...');
        self.loadFollowing();
        
        // [PHASE 2] Step 3.5: Load Phase 2 Features
        console.log('👥 Step 3.5: Loading Phase 2 features...');
        self.loadGroups();
        self.setupTypingCleanup();
        self.calculateTrendingHashtags();
       
        // Step 4: START NOTIFICATIONS IMMEDIATELY
        // Don't wait - set up listeners now so they catch messages in real-time
        setTimeout(() => {
            console.log('🔔 Step 4: Checking if tracking is active...');
            if (!self.unreadTrackingActive) {
                console.log('⚠️ WARNING: Unread tracking not active yet! Will start when users load.');
            } else {
                console.log('✅ Unread tracking is active.');
            }
        }, 100);
       
        // Step 5: Start polling to catch any messages we might have missed
        // This is a safety net - fires every 5 seconds to check for new messages
        self.messagePollingInterval = setInterval(() => {
            // Skip polling if guest
            if (!self.user || self.isGuest) return;
            
            var userIds = Object.keys(self.users || {});
            userIds.forEach(uid => {
                if (uid !== self.user.uid) {
                    var key = [self.user.uid, uid].sort().join('_');
                    db.ref('chats/' + key + '/messages').orderByChild('timestamp').limitToLast(1).once('value', s => {
                        s.forEach(c => {
                            var m = c.val();
                            if (m && m.sender !== self.user.uid && (m.text || m.image)) {
                                var notifyKey = key + '_' + m.timestamp;
                                if (!self.notifiedMessages[notifyKey]) {
                                    var userName = (self.users[uid] || {}).name || 'User';
                                    console.log('🔔 [POLL] NEW MESSAGE from ' + userName);
                                    self.notifyNewMessage(userName, m.text || '📷 Image');
                                    self.notifiedMessages[notifyKey] = true;
                                }
                            }
                        });
                    });
                }
            });
        }, 5000);
       
        // Toggle music
        var musicEnabled = localStorage.getItem('chichi-music-enabled') === 'true';
        var toggle = document.getElementById('musicToggle');
       
        if (musicEnabled) {
            if (toggle) toggle.checked = true;
        } else {
            if (toggle) toggle.checked = false;
        }
    },

    loadProfile: function() {
        var self = this;
        db.ref('users/' + this.user.uid).on('value', s => {
            if (s.exists()) {
                self.profile = s.val();
                self.balance = self.profile.balance || 0;
               
                // Update balance display if it exists in profile view
                var balanceDisplay = document.getElementById('balanceDisplay');
                if (balanceDisplay) {
                    balanceDisplay.textContent = 'KSh ' + self.balance.toFixed(2);
                }
               
                // Update avatar
                var avatar = document.getElementById('quickPostAvatar');
                if (avatar) {
                    if (self.profile.profilePhoto) {
                        avatar.style.backgroundImage = 'url(' + self.profile.profilePhoto + ')';
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = self.user.email.charAt(0).toUpperCase();
                    }
                }
                
                // Check if user needs to add hashtags
                self.checkAndShowHashtagPopup();
            }
        });
    },

    // Show auth page for guest users to login/signup
    showLoginPage: function() {
        // Hide loading screen
        var loading = document.getElementById('loadingScreen');
        if (loading) {
            loading.classList.remove('active');
            loading.classList.add('hidden');
            loading.style.visibility = 'hidden';
            loading.style.zIndex = '-1';
        }
        
        var authPage = document.getElementById('authPage');
        var mainApp = document.getElementById('mainApp');
        if (authPage && mainApp) {
            mainApp.style.display = 'none';
            authPage.classList.add('show');
            authPage.classList.remove('hidden');
            authPage.style.display = 'flex';
            authPage.style.visibility = 'visible';
            authPage.style.opacity = '1';
            authPage.style.zIndex = '9998';
        }
        
        // Hide bottom nav
        var nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'none';
        
        this.switchTab('login');
    },

    switchTab: function(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[onclick="app.switchTab(\'' + tab + '\')"]').classList.add('active');
        document.getElementById(tab + 'Tab').classList.add('active');
    },

    switchView: function(view) {
        // Initialize navigation history
        if (!this.navigationHistory) this.navigationHistory = [];
        if (!this.currentView) this.currentView = 'feed';
       
        // Add current view to history before switching
        if (this.currentView !== view) {
            this.navigationHistory.push(this.currentView);
        }
       
        // Update current view
        this.currentView = view;
       
        // Save to localStorage for refresh persistence
        try {
            localStorage.setItem('chichiCurrentView', view);
        } catch (e) {
            console.log('localStorage not available');
        }
       
        // Hide ALL other views COMPLETELY using CSS classes
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            // Remove inline styles to let CSS handle it
            v.style.display = '';
            v.style.visibility = '';
            v.style.opacity = '';
            v.style.zIndex = '';
            v.style.pointerEvents = '';
        });
       
        // Close any open chat
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.remove('active');
            chatView.style.display = '';
            chatView.style.visibility = '';
            chatView.style.opacity = '';
            chatView.style.zIndex = '';
        }
       
        // Remove active from nav items
        document.querySelectorAll('.nav-wrapper > .nav-item').forEach(n => n.classList.remove('active'));
       
        // Show ONLY selected view using CSS class
        var viewElement = document.getElementById(view + 'View');
        if (viewElement) {
            viewElement.classList.add('active');
            // Let CSS handle all positioning
        }
       
        // Load view-specific data
        if (view === 'profile') {
            this.renderProfile();
        } else if (view === 'feed') {
            this.loadPosts();
            this.loadStories();  // Reload stories when viewing feed
        } else if (view === 'messages') {
            this.loadMessages();
            this.clearUnreadBadge();
        } else if (view === 'explore') {
            this.loadExplore();
        } else if (view === 'groups') {
            // [PHASE 2] Load groups view
            this.renderGroups();
        }

        // Highlight nav item
        var navItems = document.querySelectorAll('.nav-wrapper > .nav-item');
        if (view === 'feed') navItems[0].classList.add('active');
        else if (view === 'explore') navItems[1].classList.add('active');
        else if (view === 'messages') navItems[2].classList.add('active');
        else if (view === 'groups') navItems[3].classList.add('active');  // [PHASE 2] Groups nav position
        else if (view === 'profile') navItems[4].classList.add('active');
    },

    // New: Go back navigation function
    goBack: function() {
        var self = this;
       
        // Initialize back press counter if needed
        if (!this.backPressCount) {
            this.backPressCount = 0;
            this.lastBackPressTime = 0;
        }
       
        var currentTime = Date.now();
        var currentView = this.getCurrentView();
       
        // Check if we're on Home feed
        var isOnHome = currentView === 'feed' || !currentView;
       
        if (!isOnHome) {
            // Not on home - go to home first
            this.switchView('feed');
            this.backPressCount = 0;
            return;
        }
       
        // We're on home - implement 3-step exit
        this.backPressCount++;
       
        if (this.backPressCount === 1) {
            // First tap - show message
            this.toast('Press back again to reload', 'info');
           
            // Reset counter after 2 seconds if no second tap
            setTimeout(() => {
                if (this.backPressCount === 1) {
                    this.backPressCount = 0;
                }
            }, 2000);
           
        } else if (this.backPressCount === 2) {
            // Second tap - reload page
            this.toast('Press back once more to exit', 'info');
            location.reload();
           
        } else if (this.backPressCount === 3) {
            // Third tap - confirm exit
            if (confirm('🚪 Exit CHICHI App?')) {
                // Exit app (back to browser)
                if (navigator.app && navigator.app.exitApp) {
                    navigator.app.exitApp();
                } else {
                    // Web fallback
                    window.history.back();
                }
            } else {
                // Cancel exit, reset counter
                this.backPressCount = 0;
                this.toast('Back in CHICHI', 'success');
            }
        }
    },
   
    // Helper to get current view
    getCurrentView: function() {
        var views = document.querySelectorAll('.view');
        for (var i = 0; i < views.length; i++) {
            if (views[i].classList.contains('active')) {
                var viewId = views[i].id;
                if (viewId === 'feedView') return 'feed';
                if (viewId === 'exploreView') return 'explore';
                if (viewId === 'messagesView') return 'messages';
                if (viewId === 'profileView') return 'profile';
            }
        }
        return 'feed';  // Default to feed
    },

    // Restore view on page refresh
    restoreViewOnRefresh: function() {
        try {
            var savedView = localStorage.getItem('chichiCurrentView');
            if (savedView && (savedView === 'feed' || savedView === 'messages' || savedView === 'explore' || savedView === 'profile')) {
                // Use the saved view after app loads
                var self = this;
                setTimeout(() => {
                    self.switchView(savedView);
                }, 500);
            }
        } catch (e) {
            console.log('localStorage not available');
        }
    },

    handleLogin: function(e) {
        e.preventDefault();
        var email = document.getElementById('loginEmail').value;
        var pass = document.getElementById('loginPassword').value;
        var loginBtn = document.getElementById('loginBtn');
        var loginSpinner = document.querySelector('.login-spinner');
        var loginText = document.querySelector('.login-btn-text');
        
        if (!email || !pass) {
            this.toast('Email and password required', 'error');
            return;
        }
        
        // Show spinner
        if (loginSpinner) loginSpinner.style.display = 'inline';
        if (loginText) loginText.style.display = 'none';
        if (loginBtn) loginBtn.disabled = true;
        
        var self = this;
        auth.signInWithEmailAndPassword(email, pass)
            .then(result => {
                console.log('✅ Login successful:', result.user.email);
                self.toast('✅ Login successful!', 'success');
                // Login will trigger auth state change, which calls init()
            })
            .catch(err => {
                console.error('❌ Login error:', err.message);
                // Hide spinner on error
                if (loginSpinner) loginSpinner.style.display = 'none';
                if (loginText) loginText.style.display = 'inline';
                if (loginBtn) loginBtn.disabled = false;
                self.toast('❌ ' + err.message, 'error');
            });
    },

    handleSignup: function(e) {
        e.preventDefault();
        var name = document.getElementById('signupName').value;
        var email = document.getElementById('signupEmail').value;
        var pass = document.getElementById('signupPassword').value;
        var signupBtn = document.getElementById('signupBtn');
        var signupSpinner = document.querySelector('.signup-spinner');
        var signupText = document.querySelector('.signup-btn-text');
       
        if (pass.length < 6) {
            this.toast('Password must be 6+ characters', 'error');
            return;
        }

        // ADDED: Show spinner
        if (signupSpinner) signupSpinner.style.display = 'inline';
        if (signupText) signupText.style.display = 'none';
        if (signupBtn) signupBtn.disabled = true;

        var self = this;
        
        // GET LOCATION FIRST (Geolocation + Reverse Geocoding)
        this.detectUserLocation().then(location => {
            auth.createUserWithEmailAndPassword(email, pass).then(r => {
                db.ref('users/' + r.user.uid).set({
                    name: name,
                    email: email,
                    bio: '',
                    profilePhoto: '',
                    balance: 0,
                    followers: 0,
                    following: 0,
                    location: location.city || 'Unknown',
                    coordinates: {
                        latitude: location.lat,
                        longitude: location.lng
                    },
                    createdAt: new Date().toLocaleString('en-KE')
                });
                self.toast('Account created!', 'success');
                // Update map after new signup
                setTimeout(() => self.loadSignupHeatmap(), 1000);
            }).catch(err => {
                // ADDED: Hide spinner on error
                if (signupSpinner) signupSpinner.style.display = 'none';
                if (signupText) signupText.style.display = 'inline';
                if (signupBtn) signupBtn.disabled = false;
                self.toast(err.message, 'error');
            });
        }).catch(err => {
            // Location detection failed, but allow signup anyway
            console.warn('Location detection failed:', err);
            auth.createUserWithEmailAndPassword(email, pass).then(r => {
                db.ref('users/' + r.user.uid).set({
                    name: name,
                    email: email,
                    bio: '',
                    profilePhoto: '',
                    balance: 0,
                    followers: 0,
                    following: 0,
                    location: 'Unknown',
                    coordinates: { latitude: 0, longitude: 0 },
                    createdAt: new Date().toLocaleString('en-KE')
                });
                self.toast('Account created! (Location not available)', 'success');
                setTimeout(() => self.loadSignupHeatmap(), 1000);
            }).catch(err2 => {
                if (signupSpinner) signupSpinner.style.display = 'none';
                if (signupText) signupText.style.display = 'inline';
                if (signupBtn) signupBtn.disabled = false;
                self.toast(err2.message, 'error');
            });
        });
    },
    
    // DETECT USER LOCATION (Geolocation + Reverse Geocoding)
    detectUserLocation: function() {
        var self = this;
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.warn('Geolocation not supported');
                reject({message: 'Geolocation not supported'});
                return;
            }
            
            // Update status
            var statusEl = document.getElementById('locationStatus');
            if (statusEl) statusEl.innerHTML = '🔄 Detecting your location...';
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    var lat = position.coords.latitude;
                    var lng = position.coords.longitude;
                    console.log('📍 Location detected:', lat, lng);
                    
                    // Update status
                    if (statusEl) statusEl.innerHTML = '🌐 Converting coordinates...';
                    
                    // Reverse geocoding using Nominatim (FREE, no API key needed)
                    self.reverseGeocode(lat, lng).then(city => {
                        console.log('✅ City detected:', city);
                        if (statusEl) statusEl.innerHTML = '✅ ' + city;
                        
                        // Store in hidden input
                        document.getElementById('signupLocation').value = city;
                        
                        resolve({
                            city: city,
                            lat: lat,
                            lng: lng
                        });
                    }).catch(err => {
                        console.error('Reverse geocoding failed:', err);
                        if (statusEl) statusEl.innerHTML = '⚠️ Location not available';
                        reject(err);
                    });
                },
                error => {
                    console.error('❌ Geolocation error:', error.message);
                    if (statusEl) statusEl.innerHTML = '❌ ' + error.message;
                    reject(error);
                },
                {
                    timeout: 5000,
                    enableHighAccuracy: false
                }
            );
        });
    },
    
    // REVERSE GEOCODING (Convert Coordinates to City Name)
    reverseGeocode: function(lat, lng) {
        return new Promise((resolve, reject) => {
            var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng;
            
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    var city = data.address.city || 
                               data.address.town || 
                               data.address.village || 
                               data.address.county ||
                               'Unknown';
                    console.log('🌍 Reverse geocoded address:', data.address);
                    resolve(city);
                })
                .catch(err => {
                    console.error('Nominatim error:', err);
                    reject(err);
                });
        });
    },

    signInWithGoogle: function() {
        var self = this;
        var provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).then(result => {
            var user = result.user;
            // Check if new user
            db.ref('users/' + user.uid).once('value', snap => {
                if (!snap.exists()) {
                    // New user - create profile
                    db.ref('users/' + user.uid).set({
                        name: user.displayName || 'User',
                        email: user.email,
                        bio: '',
                        profilePhoto: user.photoURL || '',
                        balance: 0,
                        followers: 0,
                        following: 0,
                        createdAt: new Date().toLocaleString('en-KE')
                    });
                    self.toast('Account created with Google!', 'success');
                } else {
                    self.toast('Welcome back!', 'success');
                }
            });
        }).catch(err => this.toast('Google sign-in failed: ' + err.message, 'error'));
    },

    showForgotPasswordModal: function() {
        document.getElementById('forgotPasswordModal').classList.add('active');
        document.getElementById('forgotPasswordEmail').focus();
    },

    closeForgotPasswordModal: function() {
        document.getElementById('forgotPasswordModal').classList.remove('active');
        document.getElementById('forgotPasswordEmail').value = '';
    },

    sendPasswordReset: function() {
        var email = document.getElementById('forgotPasswordEmail').value.trim();
       
        if (!email) {
            this.toast('Please enter your email address', 'error');
            return;
        }

        var self = this;
        auth.sendPasswordResetEmail(email).then(() => {
            self.toast('Password reset link sent to ' + email, 'success');
            self.closeForgotPasswordModal();
        }).catch(err => {
            self.toast('Error: ' + err.message, 'error');
        });
    },

    openAdminModal: function() {
        document.getElementById('adminModal').classList.add('active');
        document.getElementById('adminPassword').focus();
    },

    closeAdminModal: function() {
        document.getElementById('adminModal').classList.remove('active');
        document.getElementById('adminPassword').value = '';
    },

    verifyAdminPassword: function() {
        var pass = document.getElementById('adminPassword').value;
        if (pass === ADMIN_PASSWORD) {
            this.closeAdminModal();
            this.openAdminPortal();
        } else {
            this.toast('Wrong password', 'error');
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminPassword').focus();
        }
    },

    openAdminPortal: function() {
        this.adminOpen = true;
        document.getElementById('mainApp').classList.remove('active');
        document.getElementById('adminPortal').classList.add('active');
        document.querySelector('.bottom-nav').style.display = 'none';
        this.loadAdminDashboard();
        this.loadAdminUsers();
        this.loadAdminPosts();
        this.loadActivityLog();
    },

    closeAdminPortal: function() {
        this.adminOpen = false;
        document.getElementById('adminPortal').classList.remove('active');
        document.getElementById('mainApp').classList.add('active');
        document.querySelector('.bottom-nav').style.display = 'flex';
    },

    switchAdminTab: function(tab) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
       
        // Find and activate the clicked tab button
        var buttons = document.querySelectorAll('.admin-tab');
        var tabMap = ['dashboard', 'users', 'posts', 'withdrawals', 'logs'];
        var tabIndex = tabMap.indexOf(tab);
        if (tabIndex >= 0) {
            buttons[tabIndex].classList.add('active');
        }
       
        // Map tab names to content IDs
        var contentMap = {
            'dashboard': 'adminDashboard',
            'users': 'adminUsers',
            'posts': 'adminPosts',
            'withdrawals': 'adminWithdrawalsTab',
            'logs': 'adminLogs'
        };
       
        var contentId = contentMap[tab];
        if (contentId) {
            document.getElementById(contentId).classList.add('active');
        }
       
        if (tab === 'users') this.loadAdminUsers();
        if (tab === 'posts') this.loadAdminPosts();
        if (tab === 'logs') this.loadActivityLog();
    },

    loadAdminUsers: function() {
        var self = this;
        var html = '';
        var userArray = [];
       
        for (var uid in this.users) {
            userArray.push({ uid: uid, user: this.users[uid] });
        }

        if (userArray.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No users yet</div>';
        } else {
            html = '<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">';
            userArray.forEach(u => {
                html += `
                    <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${u.user.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-light);">${u.user.email}</div>
                            <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">Joined: ${u.user.createdAt}</div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span style="background: var(--primary); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${u.user.followers || 0} followers</span>
                            <button onclick="app.viewUserActivity('${u.uid}')" style="padding: 6px 12px; background: var(--border); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">View</button>
                            <button onclick="app.deleteUserByAdmin('${u.uid}', '${u.user.name}')" style="padding: 6px 12px; background: #ff4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🗑️ Delete</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
       
        document.getElementById('adminUsersList').innerHTML = html;
    },

    searchUsers: function() {
        var query = document.getElementById('userSearchInput').value.toLowerCase().trim();
        if (!query) {
            this.loadAdminUsers();
            return;
        }

        var html = '';
        var results = [];
       
        for (var uid in this.users) {
            var u = this.users[uid];
            if (u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)) {
                results.push({ uid: uid, user: u });
            }
        }

        if (results.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No users found</div>';
        } else {
            html = '<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">';
            results.forEach(u => {
                html += `
                    <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; font-size: 0.95rem;">${u.user.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-light);">${u.user.email}</div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="app.viewUserActivity('${u.uid}')" style="padding: 6px 12px; background: var(--border); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">View</button>
                            <button onclick="app.deleteUserByAdmin('${u.uid}', '${u.user.name}')" style="padding: 6px 12px; background: #ff4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🗑️ Delete</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
       
        document.getElementById('adminUsersList').innerHTML = html;
    },

    viewUserActivity: function(uid) {
        var user = this.users[uid];
        if (!user) return;
       
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `<div class="modal">
            <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
            <h2 style="margin-bottom: 16px;">${user.name}</h2>
            <div style="background: var(--light); padding: 12px; border-radius: 10px; margin-bottom: 16px;">
                <div style="font-size: 0.8rem; color: var(--text-light); line-height: 1.6;">
                    <div>Email: ${user.email}</div>
                    <div>Balance: KSh ${(user.balance || 0).toFixed(2)}</div>
                    <div>Followers: ${user.followers || 0}</div>
                    <div>Following: ${user.following || 0}</div>
                    <div>Joined: ${user.createdAt}</div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
    },

    deleteUserByAdmin: function(uid, userName) {
        var self = this;
       
        // Confirm deletion
        if (!confirm(`⚠️ Delete user "${userName}"?\n\nAll posts, messages, and data will be removed.\nThis CANNOT be undone.`)) {
            return;
        }
       
        // Double confirm
        if (!confirm('Final confirmation: Really delete this user permanently?')) {
            return;
        }
       
        this.toast('Deleting user ' + userName + '...', 'success');
       
        var deletionPromises = [];
       
        // 1. Delete user profile
        deletionPromises.push(
            db.ref('users/' + uid).remove()
        );
       
        // 2. Delete all user's posts
        deletionPromises.push(
            db.ref('posts').orderByChild('userId').equalTo(uid).once('value', snapshot => {
                var deletePromises = [];
                snapshot.forEach(post => {
                    deletePromises.push(db.ref('posts/' + post.key).remove());
                });
                return Promise.all(deletePromises);
            })
        );
       
        // 3. Delete all user's chats/messages
        deletionPromises.push(
            db.ref('chats').once('value', snapshot => {
                var deletePromises = [];
                snapshot.forEach(chat => {
                    var chatKey = chat.key;
                    if (chatKey.includes(uid)) {
                        deletePromises.push(db.ref('chats/' + chatKey).remove());
                    }
                });
                return Promise.all(deletePromises);
            })
        );
       
        // Execute all deletions
        Promise.all(deletionPromises).then(() => {
            self.toast(`User "${userName}" deleted successfully`, 'success');
           
            // Refresh admin users list
            setTimeout(() => {
                self.loadAdminUsers();
                self.loadExplore();
                self.loadMessages();
            }, 500);
           
        }).catch(err => {
            self.toast('Error deleting user: ' + err.message, 'error');
        });
    },

    loadAdminPosts: function() {
        var html = '';
        if (this.posts.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No posts yet</div>';
        } else {
            this.posts.forEach(p => {
                html += `
                    <div style="background: white; border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="font-weight: 700; font-size: 0.95rem;">${p.userName}</div>
                            <div style="font-size: 0.75rem; color: var(--text-light);">${p.createdAt}</div>
                        </div>
                        <div style="font-size: 0.9rem; margin-bottom: 8px; color: var(--text-light); font-family: 'Poppins', sans-serif;">${p.caption.substring(0, 100)}...</div>
                        <div style="display: flex; gap: 8px;">
                            <span style="font-size: 0.75rem; color: var(--text-light);">Likes: ${Object.keys(p.likes || {}).length}</span>
                            <span style="font-size: 0.75rem; color: var(--text-light);">Comments: ${(p.comments || []).length}</span>
                            <button onclick="app.adminDeletePost('${p.id}')" style="margin-left: auto; padding: 6px 12px; background: #ff4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">Delete</button>
                        </div>
                    </div>
                `;
            });
        }
        document.getElementById('adminPostsList').innerHTML = html;
    },

    adminDeletePost: function(id) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `<div class="logout-card">
            <h3>Delete Post?</h3>
            <p>Permanent action</p>
            <div class="logout-buttons">
                <button class="logout-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="logout-confirm" onclick="app.confirmAdminDeletePost('${id}')">Delete</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    },

    confirmAdminDeletePost: function(id) {
        db.ref('posts/' + id).remove();
        var modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
        this.toast('Post deleted', 'success');
        this.loadAdminPosts();
    },

    loadActivityLog: function() {
        var html = '';
        var activities = [];
       
        // Create activity log from posts and withdrawals
        this.posts.forEach(p => {
            activities.push({
                time: p.createdAt,
                type: 'Post',
                user: p.userName,
                action: 'Created a post'
            });
        });

        activities.sort((a, b) => new Date(b.time) - new Date(a.time));

        if (activities.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No activity yet</div>';
        } else {
            activities.slice(0, 20).forEach(act => {
                html += `
                    <div style="padding: 12px; border-bottom: 1px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 600; font-size: 0.9rem;">${act.user}</div>
                                <div style="font-size: 0.8rem; color: var(--text-light);">${act.action}</div>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-light);">${act.time}</div>
                        </div>
                    </div>
                `;
            });
        }
       
        document.getElementById('activityLogList').innerHTML = html;
    },

    loadAdminDashboard: function() {
        var self = this;
       
        var userCount = Object.keys(this.users || {}).length;
        var postCount = (this.posts || []).length;
       
        document.getElementById('adminUserCount').textContent = userCount;
        document.getElementById('adminPostCount').textContent = postCount;
       
        db.ref('withdrawals').once('value', snap => {
            var withdrawals = [];
            snap.forEach(child => {
                withdrawals.push({
                    id: child.key,
                    ...child.val()
                });
            });
           
            withdrawals.sort((a, b) => {
                var dateA = new Date(b.createdAt || 0);
                var dateB = new Date(a.createdAt || 0);
                return dateA - dateB;
            });
           
            var pendingCount = withdrawals.filter(w => w.status === 'pending').length;
            var approvedCount = withdrawals.filter(w => w.status === 'approved').length;
           
            document.getElementById('adminPendingCount').textContent = pendingCount;
            document.getElementById('adminApprovedCount').textContent = approvedCount;
           
            var html = '';
            if (withdrawals.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No withdrawal requests</div>';
            } else {
                withdrawals.forEach(w => {
                    html += `
                        <div class="withdrawal-card ${w.status}">
                            <div class="withdrawal-header">
                                <div class="withdrawal-user">${w.userName}</div>
                                <div class="withdrawal-status ${w.status}">${w.status.toUpperCase()}</div>
                            </div>
                            <div class="withdrawal-details">
                                <div>KSh ${w.amount} • ${w.method} • ${w.account}</div>
                                <div style="font-size: 0.75rem; margin-top: 4px;">${w.createdAt}</div>
                            </div>
                            ${w.status === 'pending' ? `
                                <div class="withdrawal-actions">
                                    <button class="admin-approve" onclick="app.approveWithdrawal('${w.id}')">Approve</button>
                                    <button class="admin-reject" onclick="app.rejectWithdrawal('${w.id}')">Reject</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
            }
           
            document.getElementById('adminWithdrawals').innerHTML = html;
        });
    },

    approveWithdrawal: function(withdrawalId) {
        var self = this;
        db.ref('withdrawals/' + withdrawalId).update({
            status: 'approved'
        });
        self.toast('Approved', 'success');
        self.loadAdminDashboard();
    },

    rejectWithdrawal: function(withdrawalId) {
        var self = this;
        db.ref('withdrawals/' + withdrawalId).once('value', snap => {
            if (snap.exists()) {
                var withdrawal = snap.val();
                db.ref('withdrawals/' + withdrawalId).update({
                    status: 'rejected'
                });
                db.ref('users/' + withdrawal.userId + '/balance').once('value', balanceSnap => {
                    var currentBalance = balanceSnap.val() || 0;
                    db.ref('users/' + withdrawal.userId + '/balance').set(currentBalance + withdrawal.amount);
                });
                self.toast('Rejected & refunded', 'success');
                self.loadAdminDashboard();
            }
        });
    },

    openSearchModal: function() {
        document.getElementById('searchModalOverlay').classList.add('active');
        document.getElementById('searchInput').focus();
        document.getElementById('searchResults').innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">Start typing to search...</div>';
    },

    closeSearchModal: function() {
        document.getElementById('searchModalOverlay').classList.remove('active');
        document.getElementById('searchInput').value = '';
    },

    handleSearch: function() {
        var query = document.getElementById('searchInput').value.toLowerCase().trim();
       
        if (!query) {
            document.getElementById('searchResults').innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">Start typing to search...</div>';
            return;
        }

        var results = [];
        for (var uid in this.users) {
            // Allow guests to see all users
            if (!this.user || uid !== this.user.uid) {
                var u = this.users[uid];
                if (u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)) {
                    results.push({ uid: uid, user: u });
                }
            }
        }

        results.sort((a, b) => (b.user.followers || 0) - (a.user.followers || 0));

        var html = '';
        if (results.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No users found</div>';
        } else {
            results.forEach(r => {
                var isFollowing = this.following[r.uid] || false;
                var unreadCount = this.getUnreadCountForUser(r.uid);
                var msgButtonBadge = unreadCount > 0 ? `<span style="position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; background: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);">${unreadCount}</span>` : '';
               
                html += `
                    <div class="search-user">
                        <div class="search-user-avatar" style="background-image: url(${r.user.profilePhoto || ''});">${!r.user.profilePhoto ? r.user.name.charAt(0).toUpperCase() : ''}</div>
                        <div class="search-user-info">
                            <div class="search-user-name">${r.user.name}</div>
                            <div class="search-user-email">${r.user.email}</div>
                            <div class="search-user-followers">${r.user.followers || 0} followers</div>
                        </div>
                        <div class="search-user-actions">
                            <button class="search-msg-btn" onclick="app.openChatFromSearch('${r.uid}', '${r.user.name}')" style="position: relative;">
                                💬
                                ${msgButtonBadge}
                            </button>
                            <button class="search-view-btn" onclick="app.viewUserProfile('${r.uid}')">${isFollowing ? 'Following' : 'Follow'}</button>
                        </div>
                    </div>
                `;
            });
        }
       
        document.getElementById('searchResults').innerHTML = html;
    },

    // Helper function to get unread count for a specific user
    getUnreadCountForUser: function(uid) {
        // Guests have no messages
        if (!this.user || this.isGuest) return 0;
        
        if (!this.unreadMessages) return 0;
        var key = [this.user.uid, uid].sort().join('_');
        var data = this.unreadMessages[key];
        return (data && data.count) ? data.count : 0;
    },

    openChatFromSearch: function(uid, name) {
        this.openChat(uid, name);
    },

    showCreateModal: function() {
        var modal = document.getElementById('createModal');
        if (!modal) {
            console.error('❌ createModal not found - checking fallback');
            return;
        }
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
    },

    closeCreateModal: function() {
        var modal = document.getElementById('createModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';  // ADDED: Hide modal completely
        
        var photoInput = document.getElementById('photoInput');
        if (photoInput) photoInput.value = '';
        
        var captionInput = document.getElementById('captionInput');
        if (captionInput) captionInput.value = '';
        
        var photoPreview = document.getElementById('photoPreview');
        if (photoPreview) {
            photoPreview.style.display = 'none';
            photoPreview.textContent = '';
        }
        console.log('✅ Modal closed');
    },

    previewPhoto: function(e) {
        var file = e.target.files[0];
        if (file) {
            var preview = document.getElementById('photoPreview');
            preview.textContent = '✓ ' + file.name + ' selected';
            preview.style.display = 'block';
        }
    },

    createPost: function() {
        if (!this.requireAuth('post')) return;
        
        var photoFile = document.getElementById('photoInput').files[0];
        var caption = document.getElementById('captionInput').value.trim();
        var sharePostBtn = document.getElementById('sharePostBtn');
        var shareSpinner = document.querySelector('.share-spinner');
        var shareText = document.querySelector('.share-btn-text');

        if (!photoFile || !caption) {
            this.toast('Add photo and caption', 'error');
            return;
        }

        // ADDED: Extract hashtags from caption (max 5)
        var hashtagRegex = /#[\w]+/g;
        var hashtags = (caption.match(hashtagRegex) || []).slice(0, 5);

        // ADDED: Show spinner
        if (shareSpinner) shareSpinner.style.display = 'inline';
        if (shareText) shareText.style.display = 'none';
        if (sharePostBtn) sharePostBtn.disabled = true;

        console.log('📤 Uploading post...');
        console.log('   File:', photoFile.name, '|', photoFile.size, 'bytes');
        console.log('   Cloud:', CLOUD_NAME, '| Preset:', UPLOAD_PRESET);

        var formData = new FormData();
        formData.append('file', photoFile);
        formData.append('upload_preset', UPLOAD_PRESET);

        console.log('🚀 Sending to Cloudinary...');
        
        fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        })
        .then(r => {
            console.log('📡 Cloudinary response status:', r.status);
            if (!r.ok) {
                console.error('❌ Cloudinary error status:', r.status);
                return r.json().then(data => {
                    throw new Error(data.error ? data.error.message : 'Upload failed');
                });
            }
            return r.json();
        })
        .then(data => {
            console.log('✅ Cloudinary success! URL:', data.secure_url);
            var self = this;
            db.ref('posts').push({
                userId: self.user.uid,
                userName: self.profile.name || 'User',
                userPhoto: self.profile.profilePhoto || '',
                photoUrl: data.secure_url,
                caption: caption,
                hashtags: hashtags,  // ADDED: Store hashtags
                likes: {},
                comments: [],
                commentedUsers: {},
                downloads: 0,
                createdAt: new Date().toLocaleString('en-KE'),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                console.log('✅ Post saved to Firebase');
                // Earn silently for posting
                self.balance += 1;
                db.ref('users/' + self.user.uid + '/balance').set(self.balance);
                self.toast('Post published', 'success');
                
                // ADDED: Hide spinner
                if (shareSpinner) shareSpinner.style.display = 'none';
                if (shareText) shareText.style.display = 'inline';
                if (sharePostBtn) sharePostBtn.disabled = false;
                
                self.closeCreateModal();
                self.switchView('feed');
            }).catch(err => {
                console.error('❌ Firebase error:', err);
                self.toast('Error publishing post: ' + err.message, 'error');
                if (shareSpinner) shareSpinner.style.display = 'none';
                if (shareText) shareText.style.display = 'inline';
                if (sharePostBtn) sharePostBtn.disabled = false;
            });
        }).catch(err => {
            console.error('❌ Cloudinary error:', err);
            this.toast('Upload failed: ' + err.message, 'error');
            if (shareSpinner) shareSpinner.style.display = 'none';
            if (shareText) shareText.style.display = 'inline';
            if (sharePostBtn) sharePostBtn.disabled = false;
        });
    },

    // ===== STORIES (TELEGRAM STYLE - OVERLAPPED) =====
    loadStories: function() {
        if (!this.user || this.isGuest) return;
        
        var self = this;
        var html = '';
        
        // Add "My Story" first (+ icon)
        html += `
            <div class="story-item" onclick="app.toast('Create story coming soon', 'info')" 
                 style="position: absolute; left: 0; top: 0; display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: 2px solid white; cursor: pointer; font-size: 20px; z-index: 10;">
                ➕
            </div>
        `;
        
        var storyIndex = 1;
        // Add followed users' stories (overlapped)
        for (var uid in this.following) {
            if (this.following[uid] && storyIndex < 4) {  // Show max 3 overlapping stories
                var user = this.users[uid];
                if (user) {
                    var leftPos = (30 * storyIndex) + 'px';  // Overlap by 30px
                    var hasStory = Math.random() > 0.5;
                    var borderStyle = hasStory ? '2px solid var(--primary)' : '2px solid #ddd';
                    
                    html += `
                        <div class="story-item" onclick="app.openStory('${uid}')" 
                             style="position: absolute; left: ${leftPos}; top: 0; width: 50px; height: 50px; border-radius: 50%; background: url('${user.profilePhoto || ''}'); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; border: ${borderStyle}; cursor: pointer; z-index: ${11 - storyIndex}; ${!user.profilePhoto ? 'background: var(--primary); color: white; font-weight: 700;' : ''}">
                            ${!user.profilePhoto ? user.name.charAt(0).toUpperCase() : ''}
                        </div>
                    `;
                    storyIndex++;
                }
            }
        }
        
        var storiesList = document.getElementById('storiesList');
        if (storiesList) {
            storiesList.innerHTML = html;
        }
    },

    openStory: function(uid) {
        var user = this.users[uid];
        if (!user) return;
        
        this.toast(`📖 Story from ${user.name}`, 'info');
        console.log('Opening story from:', user.name);
    },

    // Check and show hashtag popup for users without hashtags
    checkAndShowHashtagPopup: function() {
        if (!this.user) return;
        
        var userHashtags = this.profile.hashtags || [];
        console.log('🏷️ User hashtags:', userHashtags);
        
        // Only show if user has NO hashtags and has been around for a bit
        if (userHashtags.length === 0) {
            console.log('⚠️ User has no hashtags - showing popup');
            this.showHashtagSelectionPopup();
        }
    },

    showHashtagSelectionPopup: function() {
        var self = this;
        var hashtagCategories = {
            '🎬 Entertainment': ['Movies', 'Music', 'Comedy', 'Gaming', 'Animation'],
            '🎨 Creative': ['Photography', 'Art', 'Design', 'Fashion', 'Illustration'],
            '⚽ Sports': ['Football', 'Basketball', 'Tennis', 'Fitness', 'Yoga'],
            '🍔 Lifestyle': ['Food', 'Travel', 'Health', 'Beauty', 'DIY'],
            '💻 Tech': ['Programming', 'AI', 'Web Dev', 'Apps', 'Gadgets'],
            '📚 Education': ['Learning', 'Science', 'History', 'Language', 'Books'],
            '💰 Business': ['Entrepreneurship', 'Marketing', 'Investing', 'Startups', 'Finance'],
            '🌍 Social': ['Environment', 'Charity', 'Community', 'Activism', 'Culture']
        };
        
        var htmlOptions = '';
        for (var category in hashtagCategories) {
            htmlOptions += `
                <div style="margin-bottom: 20px;">
                    <div style="font-weight: 600; margin-bottom: 12px; font-size: 16px;">${category}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            `;
            hashtagCategories[category].forEach(tag => {
                htmlOptions += `
                    <label style="display: flex; align-items: center; padding: 10px 12px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='var(--primary)'; this.style.background='rgba(46,91,255,0.05)'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb'">
                        <input type="checkbox" class="hashtag-checkbox" value="${tag}" style="width: 18px; height: 18px; cursor: pointer; margin-right: 10px; accent-color: var(--primary);">
                        <span style="font-size: 14px;">${tag}</span>
                    </label>
                `;
            });
            htmlOptions += `
                    </div>
                </div>
            `;
        }
        
        // Create modal using professional system
        var modalHTML = `
            <div class="modal-overlay" id="hashtagModal">
                <div class="modal-box">
                    <div class="modal-header">
                        <h2>🏷️ Choose Your Interests</h2>
                        <p>Select topics you care about to see relevant creators and content</p>
                    </div>
                    
                    <div class="modal-body">
                        ${htmlOptions}
                    </div>
                    
                    <div class="modal-footer">
                        <button class="modal-footer btn-cancel" onclick="document.getElementById('hashtagModal').remove(); return false;">Skip for Now</button>
                        <button class="modal-footer btn-primary" onclick="app.saveSelectedHashtags(); return false;">Save My Interests</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing hashtag modal
        var existing = document.getElementById('hashtagModal');
        if (existing) existing.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveSelectedHashtags: function() {
        var checkboxes = document.querySelectorAll('.hashtag-checkbox:checked');
        var selected = [];
        
        checkboxes.forEach(cb => {
            selected.push(cb.value);
        });
        
        if (selected.length === 0) {
            this.toast('Select at least one interest', 'error');
            return;
        }
        
        console.log('💾 Saving hashtags:', selected);
        
        var self = this;
        
        // Save to Firebase using update() to merge with existing data
        var updateData = {};
        updateData['hashtags'] = selected;
        
        db.ref('users/' + this.user.uid).update(updateData).then(() => {
            console.log('✅ Hashtags saved successfully:', selected);
            
            // UPDATE LOCAL PROFILE IMMEDIATELY
            self.profile.hashtags = selected;
            if (!self.userHashtags) self.userHashtags = {};
            self.userHashtags[self.user.uid] = selected;
            
            self.toast('✅ Interests saved!', 'success');
            
            // Remove modal
            var modal = document.getElementById('hashtagModal');
            if (modal) modal.remove();
            
            // Refresh explore to show matches
            setTimeout(() => {
                self.loadExplore();
            }, 500);
            
        }).catch(err => {
            console.error('❌ Error saving hashtags:', err);
            self.toast('Error saving interests', 'error');
        });
    },

    loadPosts: function() {
        var self = this;
        // Load stories first
        this.loadStories();
       
        console.log('📮 Loading posts from Firebase...');
        db.ref('posts').orderByChild('timestamp').limitToLast(50).on('value', s => {
            console.log('📮 Posts data received:', s.val() ? Object.keys(s.val()).length + ' posts' : '0 posts');
            var p = [];
            s.forEach(c => {
                var post = c.val();
                if (post) {
                    post.id = c.key;
                    p.unshift(post);
                }
            });
            self.posts = p;
            console.log('✅ Posts loaded:', self.posts.length);
            // Ensure feed is displayed
            var feedView = document.getElementById('feedView');
            if (feedView) {
                feedView.classList.add('active');
                feedView.style.display = 'flex';
            }
            self.renderFeed();
        }, err => {
            console.error('❌ Error loading posts:', err.message);
            self.posts = [];
            self.renderFeed();
        });
    },

    renderFeed: function() {
        var feedContainer = document.getElementById('feedContainer');
        if (!feedContainer) {
            console.error('Feed container not found!');
            return;
        }
       
        // Initialize posts if not set
        if (!this.posts) {
            this.posts = [];
        }
        
        var html = '';
        if (this.posts.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 40px 16px;">No posts yet. Start creating!</div>';
        } else {
            this.posts.forEach(p => {
                var likes = (p.likes && Object.keys(p.likes).length) || 0;
                var downloads = p.downloads || 0;
                var comments = (p.comments && p.comments.length) || 0;
                var userLiked = this.user && p.likes && p.likes[this.user.uid];
                var isOwnPost = this.user && p.userId === this.user.uid;
               
                html += `
                    <div class="post" id="post-${p.id}">
                        <div class="post-header">
                            <div class="post-user">
                                <div class="post-avatar" style="background-image: url(${p.userPhoto || ''}); cursor: pointer;" onclick="app.viewUserProfile('${p.userId}')">${!p.userPhoto ? p.userName.charAt(0).toUpperCase() : ''}</div>
                                <div>
                                    <div class="post-name" onclick="app.viewUserProfile('${p.userId}')">${p.userName}</div>
                                    <div class="post-time">${p.createdAt}</div>
                                </div>
                            </div>
                            ${isOwnPost ? `<button class="post-menu" onclick="app.deletePost('${p.id}')">🗑️</button>` : ''}
                        </div>
                        <img src="${p.photoUrl}" class="post-image">
                        <div class="post-caption">${p.caption}</div>
                        <div class="post-stats">${likes} likes · ${downloads} saves · ${comments} comments</div>
                        <div class="post-actions">
                            <button class="post-action ${userLiked ? 'liked' : ''}" onclick="app.likePost('${p.id}')">
                                ${userLiked ? '❤️ Liked' : '🤍 Like'}
                            </button>
                            <button class="post-action" onclick="app.downloadPost('${p.photoUrl}', '${p.id}')">💾 Save</button>
                            <button class="post-action" onclick="app.viewComments('${p.id}')">💬 Comment</button>
                            <button class="post-action" onclick="app.sharePost('${p.id}', '${p.caption.replace(/'/g, "\\'")}')">📤 Share</button>
                        </div>
                    </div>
                `;
            });
        }
       
        // Ensure feedContainer is visible
        feedContainer.style.display = 'block';
        feedContainer.innerHTML = html;
    },

    likePost: function(id) {
        if (!this.requireAuth('like posts')) return;
        
        var self = this;
        db.ref('posts/' + id).once('value', s => {
            var post = s.val();
            var likes = post.likes || {};
           
            if (likes[self.user.uid]) {
                delete likes[self.user.uid];
            } else {
                likes[self.user.uid] = true;
                self.balance += 0.2;
                db.ref('users/' + self.user.uid + '/balance').set(self.balance);
            }
           
            db.ref('posts/' + id + '/likes').set(likes);
            self.renderFeed();
        });
    },

    downloadPost: function(url, id) {
        try {
            var link = document.createElement('a');
            link.href = url;
            link.download = 'photo.jpg';
            link.click();
        } catch (err) {
            this.toast('Download failed', 'error');
        }
    },

    sharePost: function(id, caption) {
        if (!this.requireAuth('share posts')) return;
        
        var shareText = caption || 'Check out this post on CHICHI!';
        var shareUrl = window.location.href;
       
        // Try native share API first (mobile)
        if (navigator.share) {
            navigator.share({
                title: 'CHICHI',
                text: shareText,
                url: shareUrl
            }).catch(err => console.log('Share cancelled'));
        } else {
            // Fallback: Copy to clipboard
            var text = shareText + '\n' + shareUrl;
            navigator.clipboard.writeText(text).then(() => {
                this.toast('Post link copied to clipboard! 📋', 'success');
            }).catch(err => {
                this.toast('Share link: ' + shareUrl, 'info');
            });
        }
    },

    deletePost: function(id) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `<div class="logout-card">
            <h3>Delete Post?</h3>
            <p>This cannot be undone</p>
            <div class="logout-buttons">
                <button class="logout-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="logout-confirm" onclick="app.confirmDeletePost('${id}')">Delete</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    },

    confirmDeletePost: function(id) {
        var self = this;
        var post = document.getElementById('post-' + id);
       
        // Animate removal
        if (post) {
            post.style.opacity = '0';
            post.style.transform = 'translateY(-10px)';
            post.style.transition = 'all 0.3s ease';
        }
       
        // Remove from database (triggers real-time listener)
        db.ref('posts/' + id).remove().then(() => {
            // Remove from DOM after animation
            setTimeout(() => {
                if (post && post.parentNode) {
                    post.remove();
                }
            }, 300);
           
            // Close modal
            var modal = document.querySelector('.modal-overlay');
            if (modal) modal.remove();
           
            this.toast('Post deleted', 'success');
           
            // Trigger feed refresh to ensure consistency
            setTimeout(() => {
                self.loadPosts();
            }, 100);
        }).catch(err => {
            // Restore UI on error
            if (post) {
                post.style.opacity = '1';
                post.style.transform = 'translateY(0)';
            }
            this.toast('Error deleting post: ' + err.message, 'error');
        });
    },

    viewComments: function(id) {
        if (!this.requireAuth('comment')) return;
        
        var self = this;
        db.ref('posts/' + id).once('value', s => {
            var post = s.val();
            var comments = post.comments || [];
            var commentedUsers = post.commentedUsers || {};
            var userCommented = this.user && commentedUsers[this.user.uid];

            var html = '';
            if (comments.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No comments yet</div>';
            } else {
                comments.forEach(c => {
                    html += `<div style="background: var(--light); padding: 12px; border-radius: 12px; margin-bottom: 8px;">
                        <div style="font-weight: 600; font-size: 0.9rem;">${c.user}</div>
                        <div style="font-size: 0.85rem; margin: 4px 0;">${c.text}</div>
                        <div style="font-size: 0.75rem; color: var(--text-light);">${c.time}</div>
                    </div>`;
                });
            }

            html += `<div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; gap: 8px;">
                <input type="text" id="commentInput" placeholder="Add comment..." style="flex: 1; border: 1px solid var(--border); border-radius: 20px; padding: 10px 12px;">
                <button onclick="app.submitComment('${id}')" style="background: ${userCommented ? '#d1d5db' : 'var(--primary)'}; color: ${userCommented ? 'var(--text-light)' : 'white'}; border: none; border-radius: 20px; padding: 10px 16px; cursor: pointer; font-weight: 600; ${userCommented ? 'cursor: not-allowed;' : ''}">${userCommented ? '✓ Earned' : 'Post'}</button>
            </div>`;

            var modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = `<div class="modal">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                <h2 style="font-weight: 700; margin-bottom: 16px;">Comments</h2>
                <div style="max-height: 400px; overflow-y: auto; margin-bottom: 16px;">${html}</div>
            </div>`;
            document.body.appendChild(modal);
        });
    },

    submitComment: function(id) {
        var text = document.getElementById('commentInput').value.trim();
        if (!text) return;

        var self = this;
        db.ref('posts/' + id).once('value', s => {
            var post = s.val();
            var comments = post.comments || [];
            var commentedUsers = post.commentedUsers || {};
           
            if (commentedUsers[self.user.uid]) {
                self.toast('Already commented on this post', 'error');
                return;
            }

            if (!Array.isArray(comments)) comments = [];
            comments.push({
                user: self.profile.name,
                text: text,
                time: new Date().toLocaleString('en-KE')
            });
           
            commentedUsers[self.user.uid] = true;
           
            db.ref('posts/' + id + '/comments').set(comments);
            db.ref('posts/' + id + '/commentedUsers').set(commentedUsers);
           
            // Earn silently
            self.balance += 0.5;
            db.ref('users/' + self.user.uid + '/balance').set(self.balance);
           
            var modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
            }
            self.toast('Comment added', 'success');
            self.renderFeed();
        });
    },

    viewUserProfile: function(uid) {
        if (uid === this.user.uid) {
            this.switchView('profile');
        } else {
            var self = this;
            db.ref('users/' + uid).once('value', s => {
                if (s.exists()) {
                    var user = s.val();
                    var isFollowing = this.following[uid] || false;
                    var unreadCount = this.getUnreadCountForUser(uid);
                    var msgBadge = unreadCount > 0 ? `<span style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);">${unreadCount}</span>` : '';
                   
                    var html = `
                        <div class="profile-header">
                            <div class="profile-top">
                                <div class="profile-avatar-large" style="background-image: url(${user.profilePhoto || ''});">${!user.profilePhoto ? user.name.charAt(0).toUpperCase() : ''}</div>
                                <div class="profile-info">
                                    <div class="profile-name">${user.name || 'User'}</div>
                                    <div class="profile-email">${user.email}</div>
                                    <div class="profile-stats">
                                        <div class="profile-stat"><div class="profile-stat-value">-</div><div class="profile-stat-label">Posts</div></div>
                                        <div class="profile-stat"><div class="profile-stat-value">${user.followers || 0}</div><div class="profile-stat-label">Followers</div></div>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; margin-top: 12px;">
                                <button class="follow-btn" onclick="app.toggleFollow('${uid}', '${user.name}')" style="background: ${isFollowing ? '#ff4444' : 'var(--primary)'}; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600; transition: 0.3s; flex: 1;">${isFollowing ? '✕ Unfollow' : '✓ Follow'}</button>
                                <button class="follow-btn" onclick="app.openChatFromSearch('${uid}', '${user.name}')" style="background: #2E5BFF; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600; transition: 0.3s; flex: 1; position: relative;">
                                    💬 Message
                                    ${msgBadge}
                                </button>
                            </div>
                        </div>
                    `;
                   
                    var modal = document.createElement('div');
                    modal.className = 'modal-overlay active';
                    modal.innerHTML = `<div class="modal">
                        <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                        ${html}
                    </div>`;
                    document.body.appendChild(modal);
                }
            });
        }
    },

    toggleFollow: function(uid, name) {
        // Block guests from following
        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to follow users', 'info');
            this.showLoginPage();
            return;
        }
        
        var self = this;
        var isFollowing = this.following[uid] || false;
       
        if (isFollowing) {
            // Unfollow
            delete this.following[uid];
        } else {
            // Follow - earn silently and notify
            this.following[uid] = true;
            this.balance += 0.05;
            db.ref('users/' + this.user.uid + '/balance').set(this.balance);
           
            // Trigger notification to the followed user
            db.ref('users/' + uid + '/fcmToken').once('value', snap => {
                if (snap.val()) {
                    // In a real app, you'd call a Cloud Function to send the notification
                }
            });
        }
       
        db.ref('users/' + this.user.uid + '/following').set(Object.keys(this.following).length);
        db.ref('users/' + uid + '/followers').once('value', s => {
            var followers = (s.val() || 0) + (isFollowing ? -1 : 1);
            db.ref('users/' + uid + '/followers').set(followers);
        });
       
        // Close modal safely
        var modal = document.querySelector('.modal-overlay.active');
        if (modal) {
            modal.remove();
        } else {
            // Fallback: try to close any modal
            var anyModal = document.querySelector('.modal-overlay');
            if (anyModal) {
                anyModal.remove();
            }
        }
    },

    renderProfile: function() {
        // Check if guest - show sign-up prompt instead
        if (!this.user || this.isGuest) {
            var html = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px 20px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">👤</div>
                    <div style="font-size: 20px; font-weight: 600; margin-bottom: 8px; color: var(--text);">No Profile Yet</div>
                    <div style="font-size: 14px; color: var(--text-light); margin-bottom: 24px; line-height: 1.5;">
                        Sign up or log in to create your profile, earn rewards, and connect with others.
                    </div>
                    <button onclick="app.showLoginPage()" style="background: var(--primary); color: white; border: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px; margin-bottom: 12px;">📝 Sign Up / Login</button>
                    <button onclick="app.switchView('feed')" style="background: white; color: var(--primary); border: 2px solid var(--primary); padding: 12px 32px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">Back to Feed</button>
                </div>
            `;
            document.getElementById('profileView').innerHTML = html;
            return;
        }
        
        var userPosts = this.posts.filter(p => p.userId === this.user.uid).length;

        var html = `
            <div class="profile-header">
                <div class="profile-top">
                    <div class="profile-avatar-large" onclick="app.showProfilePhotoModal()" style="background-image: url(${this.profile.profilePhoto || ''});">${!this.profile.profilePhoto ? this.user.email.charAt(0).toUpperCase() : ''}</div>
                    <div class="profile-info">
                        <div class="profile-name">${this.profile.name || 'User'}</div>
                        <div class="profile-email">${this.user.email}</div>
                        <div class="profile-stats">
                            <div class="profile-stat"><div class="profile-stat-value">${userPosts}</div><div class="profile-stat-label">Posts</div></div>
                            <div class="profile-stat"><div class="profile-stat-value">${this.profile.followers || 0}</div><div class="profile-stat-label">Followers</div></div>
                            <div class="profile-stat"><div class="profile-stat-value" onclick="app.showFollowing()">${Object.keys(this.following).length}</div><div class="profile-stat-label">Following</div></div>
                        </div>
                    </div>
                </div>
                <button class="btn-edit" onclick="app.showEditProfileModal()">Edit Profile</button>
            </div>
            <div style="padding: 16px; background: white; border-radius: 16px; margin: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="font-weight: 600; margin-bottom: 8px;">Bio</div>
                <div style="color: var(--text-light); font-size: 0.9rem;">${this.profile.bio || 'No bio yet'}</div>
            </div>
            <div style="margin: 16px;">
                <div class="balance-card">
                    <div class="balance-label">Your Balance</div>
                    <div class="balance-amount" id="balanceDisplay">KSh ${this.balance.toFixed(2)}</div>
                    <button class="btn-withdraw" onclick="app.showWithdrawModal()">Withdraw</button>
                </div>
                <div style="padding: 16px; text-align: center; color: var(--text-light); font-size: 0.85rem;">
                    <div style="font-weight: 600; color: var(--primary); margin-bottom: 8px;">💰 Earn Money</div>
                    <div style="line-height: 1.6; margin-bottom: 12px;">
                        Exciting earning features coming soon! We're designing the best way for you to earn.
                    </div>
                </div>
                <button class="btn-submit" style="width: 100%; margin-bottom: 12px; background: #ccc; cursor: not-allowed; opacity: 0.6;" disabled>⏳ Coming Soon</button>
                <div style="text-align: center; font-size: 0.75rem; color: var(--text-light);">
                    Check back soon for new earning opportunities!
                </div>
            </div>
            </div>

            <div style="padding: 16px;">
                <button style="width: 100%; padding: 12px; background: white; border: 1px solid var(--border); border-radius: 12px; color: var(--text); font-weight: 600; cursor: pointer; transition: 0.3s; margin-bottom: 12px;" onclick="app.showNotificationPreferences()">🔔 Notification Settings</button>
                <button style="width: 100%; padding: 12px; background: white; border: 1px solid var(--border); border-radius: 12px; color: var(--text); font-weight: 600; cursor: pointer; transition: 0.3s;" onclick="app.showLogout()">🚪 Logout</button>
            </div>

            <div style="padding: 16px;">My Posts</div>
            <div id="profilePosts"></div>
        `;

        document.getElementById('profileContent').innerHTML = html;

        var postsHtml = '';
        this.posts.filter(p => p.userId === this.user.uid).forEach(p => {
            var likes = (p.likes && Object.keys(p.likes).length) || 0;
            postsHtml += `
                <div class="post" id="post-${p.id}">
                    <div class="post-header">
                        <div class="post-user">
                            <div class="post-avatar" style="background-image: url(${p.userPhoto || ''});">${!p.userPhoto ? p.userName.charAt(0).toUpperCase() : ''}</div>
                            <div>
                                <div class="post-name">${p.userName}</div>
                                <div class="post-time">${p.createdAt}</div>
                            </div>
                        </div>
                        <button class="post-menu" onclick="app.deletePost('${p.id}')">🗑️</button>
                    </div>
                    <img src="${p.photoUrl}" class="post-image">
                    <div class="post-caption">${p.caption}</div>
                    <div class="post-stats">${likes} likes</div>
                    <div class="post-actions">
                        <button class="post-action" onclick="app.likePost('${p.id}')">Like</button>
                        <button class="post-action" onclick="app.downloadPost('${p.photoUrl}', '${p.id}')">Save</button>
                    </div>
                </div>
            `;
        });

        if (postsHtml === '') postsHtml = '<div style="text-align: center; color: #6b7280; padding: 20px;">No posts yet</div>';
        document.getElementById('profilePosts').innerHTML = postsHtml;
    },

    unfollowUser: function(uid, name) {
        delete this.following[uid];
        db.ref('users/' + this.user.uid + '/following').set(Object.keys(this.following).length);
        db.ref('users/' + uid + '/followers').once('value', s => {
            var followers = Math.max(0, (s.val() || 0) - 1);
            db.ref('users/' + uid + '/followers').set(followers);
        });
        this.renderProfile();
    },

    showFollowing: function() {
        var html = '<div class="modal"><div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
        html += '<h2 style="margin-bottom: 16px;">Following (' + Object.keys(this.following).length + ')</h2>';
        if (Object.keys(this.following).length === 0) {
            html += '<div style="text-align: center; color: #6b7280; padding: 20px;">Not following anyone yet</div>';
        } else {
            html += '<div class="following-list">';
            for (var uid in this.following) {
                if (this.users[uid]) {
                    var u = this.users[uid];
                    var unreadCount = this.getUnreadCountForUser(uid);
                    var msgBadge = unreadCount > 0 ? `<span style="position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; background: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);">${unreadCount}</span>` : '';
                   
                    html += `
                        <div class="following-item">
                            <div class="following-avatar" style="background-image: url(${u.profilePhoto || ''});">${!u.profilePhoto ? u.name.charAt(0).toUpperCase() : ''}</div>
                            <div class="following-name">${u.name}</div>
                            <div style="display: flex; gap: 6px;">
                                <button class="following-unfollow" onclick="app.openChatFromSearch('${uid}', '${u.name}')" style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: 0.3s; position: relative;">
                                    💬
                                    ${msgBadge}
                                </button>
                                <button class="following-unfollow" onclick="app.unfollowUser('${uid}', '${u.name}')">Unfollow</button>
                            </div>
                        </div>
                    `;
                }
            }
            html += '</div>';
        }
        html += '</div>';
       
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = html;
        document.body.appendChild(modal);
    },

    showEditProfileModal: function() {
        var self = this;
       
        var overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:flex-end;justify-content:center;`;
       
        var modal = document.createElement('div');
        modal.style.cssText = `width:100%;max-width:450px;max-height:85vh;background:white;border-radius:28px 28px 0 0;overflow-y:scroll;overflow-x:hidden;padding:20px;box-sizing:border-box;-webkit-overflow-scrolling:touch;`;
       
        modal.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><h2 style="margin: 0; font-weight: 700;">Edit Your Profile</h2><button onclick="this.closest('div').closest('div').parentElement.parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button></div>
           
            <div style="text-align: center; margin-bottom: 24px;">
                <div id="editProfilePhotoPreview" style="background-image: url(${this.profile.profilePhoto || ''}); background-size: cover; background-position: center; width: 120px; height: 120px; border-radius: 50%; margin: 0 auto; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: 700; color: white; background-color: var(--primary);" onclick="document.getElementById('editProfilePhotoInput').click()">
                    ${!this.profile.profilePhoto ? this.user.email.charAt(0).toUpperCase() : ''}
                    <div style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 3px solid white;">📷</div>
                </div>
                <input type="file" id="editProfilePhotoInput" accept="image/*" style="display: none;" onchange="app.previewEditProfilePhoto(event)">
                <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 8px;">Tap avatar to change photo</div>
            </div>
           
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px;">Name</label>
                <input type="text" id="editProfileName" value="${this.profile.name || ''}" placeholder="Your full name" style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">
            </div>
           
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px;">Email</label>
                <input type="email" id="editProfileEmail" value="${this.user.email || ''}" placeholder="Your email" disabled style="background: #f3f4f6; cursor: not-allowed; width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">
                <div style="font-size: 0.75rem; color: #999; margin-top: 4px;">Cannot change email</div>
            </div>
           
            <div style="margin-bottom: 24px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px;">Bio</label>
                <textarea id="editProfileBio" placeholder="Tell us about yourself..." style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-family: inherit; font-size: 1rem; resize: vertical; box-sizing: border-box;">${this.profile.bio || ''}</textarea>
            </div>
           
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button onclick="this.closest('div').closest('div').parentElement.parentElement.remove()" style="flex: 1; padding: 12px; background: #e5e7eb; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">Cancel</button>
                <button onclick="app.saveProfileChanges()" style="flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">Save Changes</button>
            </div>
        `;
       
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
       
        // Auto-log modal info for debugging
        setTimeout(() => {
            console.log('%c🎯 Edit Profile Modal Opened', 'color: #00D4AA; font-size: 14px; font-weight: bold;');
            console.log('Modal Height:', modal.offsetHeight + 'px');
            console.log('Modal Scroll Height:', modal.scrollHeight + 'px');
            console.log('Overflow-Y:', window.getComputedStyle(modal).overflowY);
            console.log('Position:', window.getComputedStyle(modal).position);
            if (modal.scrollHeight > modal.offsetHeight) {
                console.log('%c✅ Modal is scrollable!', 'color: #22c55e; font-weight: bold;');
            } else {
                console.log('%c❌ Content fits - no scroll needed', 'color: #ff9800;');
            }
        }, 200);
    },

    previewEditProfilePhoto: function(event) {
        var file = event.target.files[0];
        if (!file) return;
       
        var reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('editProfilePhotoPreview').style.backgroundImage = 'url(' + e.target.result + ')';
            this.editProfilePhoto = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    saveProfileChanges: function() {
        var name = document.getElementById('editProfileName').value.trim();
        var bio = document.getElementById('editProfileBio').value.trim();
        var self = this;
       
        if (!name) {
            this.toast('Name cannot be empty', 'error');
            return;
        }
       
        this.toast('Saving profile...', 'success');
       
        // If photo was changed, upload it
        if (this.editProfilePhoto && this.editProfilePhoto.startsWith('data:')) {
            // Upload to Cloudinary
            var formData = new FormData();
            fetch(this.editProfilePhoto).then(res => res.blob()).then(blob => {
                formData.append('file', blob);
                formData.append('upload_preset', 'chichi_photos');
                formData.append('cloud_name', 'u1uilb6f');
               
                fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                    method: 'POST',
                    body: formData
                }).then(res => res.json()).then(data => {
                    if (data.secure_url) {
                        // Save profile with new photo
                        self.profile.name = name;
                        self.profile.bio = bio;
                        self.profile.profilePhoto = data.secure_url;
                        db.ref('users/' + self.user.uid).update({
                            name: name,
                            bio: bio,
                            profilePhoto: data.secure_url
                        });
                        self.toast('Profile updated!', 'success');
                        self.editProfilePhoto = null;
                        var modal = document.querySelector('.modal-overlay');
                        if (modal) {
                            modal.remove();
                        }
                        self.renderProfile();
                    }
                }).catch(err => {
                    self.toast('Photo upload failed', 'error');
                });
            });
        } else {
            // Save without photo change
            this.profile.name = name;
            this.profile.bio = bio;
            db.ref('users/' + this.user.uid).update({
                name: name,
                bio: bio
            });
            this.toast('Profile updated!', 'success');
            var modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
            }
            this.renderProfile();
        }
    },

    showProfilePhotoModal: function() {
        document.getElementById('profilePhotoModal').classList.add('active');
    },

    closeProfilePhotoModal: function() {
        document.getElementById('profilePhotoModal').classList.remove('active');
    },

    changeProfilePhoto: function() {
        this.closeProfilePhotoModal();
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => {
            var file = e.target.files[0];
            if (file) {
                self.toast('Uploading photo...', 'success');
                var formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', UPLOAD_PRESET);
                fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: formData
                })
                .then(r => r.json())
                .then(data => {
                    self.profile.profilePhoto = data.secure_url;
                    db.ref('users/' + self.user.uid + '/profilePhoto').set(data.secure_url);
                    self.toast('Photo updated!', 'success');
                    self.renderProfile();
                    self.loadMessages();
                })
                .catch(err => self.toast('Upload failed', 'error'));
            }
        };
        input.click();
    },

    viewProfilePhoto: function() {
        this.closeProfilePhotoModal();
        if (this.profile.profilePhoto) {
            var modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = `<div class="modal" style="max-width: 400px;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                <img src="${this.profile.profilePhoto}" style="width: 100%; border-radius: 16px;">
            </div>`;
            document.body.appendChild(modal);
        } else {
            this.toast('No profile photo yet', 'error');
        }
    },

    loadUsers: function() {
        var self = this;
        console.log('📥 loadUsers() called - Setting up listener on /users');
       
        db.ref('users').on('value', s => {
            console.log('📥 Firebase /users callback fired!');
            var allUsers = s.val() || {};
            var rawCount = Object.keys(allUsers).length;
            console.log('   Raw users from Firebase:', rawCount);
            console.log('   Raw data:', allUsers);
           
            var oldUserCount = Object.keys(self.users).length;
            console.log('   Old user count:', oldUserCount);
           
            self.users = {};
           
            // Filter out null, deleted, or invalid users
            for (var uid in allUsers) {
                var u = allUsers[uid];
                if (u && u.name && u.email) {
                    self.users[uid] = u;
                    console.log('   ✅ Added user:', u.name);
                } else {
                    console.log('   ❌ Filtered out uid ' + uid + ' - missing name/email. Data:', u);
                }
            }
           
            var newUserCount = Object.keys(self.users).length;
            console.log('✅ Users loaded: ' + newUserCount + ' valid users');
            if (newUserCount > 0) {
                console.log('   User list:', Object.keys(self.users).map(uid => self.users[uid].name).join(', '));
            }
           
            // First time users are loaded - start tracking unread messages
            if (oldUserCount === 0 && newUserCount > 0 && !self.unreadTrackingStarted) {
                self.unreadTrackingStarted = true;
                console.log('🔔 Users loaded for FIRST TIME! Starting unread message tracking...');
                setTimeout(() => {
                    self.trackUnreadMessages();
                }, 100);
            }
           
            // Re-render explore view if it's active
            if (document.getElementById('exploreView').classList.contains('active')) {
                self.loadExplore();
            }
        }, err => {
            console.error('❌ ERROR loading users from Firebase:', err.code, err.message);
            console.error('   Full error:', err);
        });
    },

    loadFollowing: function() {
        // Skip if guest/no user
        if (!this.user) {
            this.following = {};
            return;
        }
        
        var self = this;
        db.ref('users/' + this.user.uid + '/following').once('value', s => {
            var following = s.val() || 0;
            self.following = following || {};
            self.loadStories();  // Reload stories when following changes
        });
    },

    loadExplore: function() {
        var self = this;
        console.log('🔍 Explore: Loading heatmap and trending');
        
        // HIDE user list container
        var container = document.getElementById('exploreUsersList');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
        
        // Hide search results by default
        var resultsSection = document.getElementById('exploreSearchResults');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
        
        // Clear search input
        var searchInput = document.getElementById('exploreSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Load map
        this.loadSignupHeatmap();
        
        // Load trending hashtags
        this.renderTrendingInExplore();
        this.setupTrendingRefresh();
        
        // [PHASE 3] Load signup heatmap
        this.loadSignupHeatmap();
    },

    // Format time for messages
    formatMessageTime: function(timestamp) {
        if (!timestamp) return 'Now';
        var msgDate = new Date(timestamp);
        var now = new Date();
        var diff = now - msgDate;
        var minutes = Math.floor(diff / 60000);
        var hours = Math.floor(diff / 3600000);
        var days = Math.floor(diff / 86400000);
       
        if (minutes < 1) return 'Now';
        if (minutes < 60) return minutes + 'm ago';
        if (hours < 24) return hours + 'h ago';
        if (days < 7) return days + 'd ago';
        if (days < 30) return Math.floor(days / 7) + 'w ago';
        return msgDate.toLocaleDateString();
    },

    // Search messages
    searchMessages: function(query) {
        var items = document.querySelectorAll('.message-item');
        var searchQuery = query.toLowerCase().trim();
       
        items.forEach(item => {
            var nameEl = item.querySelector('.message-name');
            var previewEl = item.querySelector('.message-preview');
            var name = (nameEl ? nameEl.textContent : '').toLowerCase();
            var preview = (previewEl ? previewEl.textContent : '').toLowerCase();
           
            if (name.includes(searchQuery) || preview.includes(searchQuery) || !searchQuery) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    // Clear search
    clearMessagesSearch: function() {
        document.getElementById('messagesSearchInput').value = '';
        this.searchMessages('');
    },

    // Delete conversation
    deleteConversation: function(uid, event) {
        event.stopPropagation();
        if (!confirm('Delete this conversation?')) return;
       
        var chatKey = [this.user.uid, uid].sort().join('_');
        // Mark as deleted (optional - you can implement actual deletion)
        console.log('Conversation deleted:', chatKey);
        this.loadMessages();
    },

    // Mute conversation
    muteConversation: function(uid, event) {
        event.stopPropagation();
        console.log('Conversation muted:', uid);
        alert('Conversation muted!');
    },

    // ========== STORIES FEATURE ==========
    loadStories: function() {
        var self = this;
        
        // Skip if guest/no user
        if (!this.user) {
            return;
        }
        
        // ADDED: Load all stories from all users for circular display
        db.ref('stories').once('value', snapshot => {
            var allStories = [];
            
            if (snapshot.val()) {
                Object.keys(snapshot.val()).forEach(userId => {
                    var userStories = snapshot.val()[userId];
                    if (userStories && typeof userStories === 'object') {
                        Object.keys(userStories).forEach(storyId => {
                            var story = userStories[storyId];
                            if (story && story.image) {
                                allStories.push({
                                    id: storyId,
                                    userId: userId,
                                    userName: story.userName || story.authorName || 'User',
                                    image: story.image,
                                    musicUrl: story.musicUrl || null,
                                    musicName: story.musicName || 'No music',
                                    caption: story.caption || '',
                                    createdAt: story.createdAt,
                                    views: story.views || 0,
                                    userPhoto: story.userPhoto || ''
                                });
                            }
                        });
                    }
                });
            }
           
            // ADDED: Sort by newest first
            allStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // ADDED: Build HTML with circular stories
            var html = '';
            
            // ADDED: Add "Create Story" circle first
            html += `
                <div class="create-story-circle">
                    <div class="create-story-avatar" onclick="app.showCreateStoryModal()" title="Create Story">➕</div>
                    <div class="create-story-name">My Story</div>
                </div>
            `;
            
            if (allStories && allStories.length > 0) {
                // ADDED: Get unique users (only show latest story per user)
                var seenUsers = {};
                var uniqueStories = [];
                
                allStories.forEach(story => {
                    if (story && story.userId && !seenUsers[story.userId]) {
                        seenUsers[story.userId] = true;
                        uniqueStories.push(story);
                    }
                });
                
                // ADDED: Render circular story avatars
                uniqueStories.forEach(story => {
                    if (story) {
                        var firstLetter = (story.userName || 'U').charAt(0).toUpperCase();
                        var storyPhotoStyle = story.userPhoto ? `background-image: url('${story.userPhoto}');` : '';
                        
                        html += `
                            <div class="story-item" onclick="app.viewStory('${story.id}', '${story.userId}')" title="${story.userName}">
                                <div class="story-avatar" style="${storyPhotoStyle}">
                                    ${story.userPhoto ? '' : firstLetter}
                                </div>
                                <div class="story-name">${story.userName}</div>
                            </div>
                        `;
                    }
                });
            }
            
            var storiesList = document.getElementById('storiesList');
            if (storiesList) {
                storiesList.innerHTML = html;
            }
        });
        
        // KEPT: Load user's own stories from Firebase (ORIGINAL CODE - NOT REMOVED)
        db.ref('stories/' + this.user.uid).once('value', snapshot => {
            var stories = [];
            if (snapshot.val()) {
                Object.keys(snapshot.val()).forEach(storyId => {
                    var story = snapshot.val()[storyId];
                    stories.push({
                        id: storyId,
                        image: story.image,
                        musicUrl: story.musicUrl || null,
                        musicName: story.musicName || 'No music',
                        caption: story.caption || '',
                        createdAt: story.createdAt,
                        views: story.views || 0
                    });
                });
            }
           
            var html = '';
            if (stories.length === 0) {
                // KEPT: Original message
            } else {
                stories.forEach(story => {
                    var createdDate = new Date(story.createdAt);
                    var timeAgo = self.formatTimeAgo(createdDate);
                    html += `
                        <div style="position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 9/16; background: #f3f4f6; cursor: pointer;" onclick="app.viewStory('${story.id}')">
                            <img src="${story.image}" style="width: 100%; height: 100%; object-fit: cover;">
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding: 16px; color: white;">
                                <div style="font-size: 0.875rem; margin-bottom: 4px;">🎵 ${story.musicName}</div>
                                <div style="font-size: 0.75rem; opacity: 0.8;">${timeAgo}</div>
                                <div style="font-size: 0.75rem; margin-top: 4px;">👁️ ${story.views} views</div>
                            </div>
                        </div>
                    `;
                });
            }
           
            // KEPT: Original functionality (can be used separately if needed)
        });
    },

    showCreateStoryModal: function() {
        // Remove any existing modals first
        var existing = document.getElementById('storyModalOverlay');
        if (existing) existing.remove();
        
        var html = `
            <div class="story-modal-overlay" id="storyModalOverlay">
                <div class="story-modal">
                    <div class="story-modal-header">
                        <h2>📖 Create Story</h2>
                        <button class="story-modal-close" onclick="document.getElementById('storyModalOverlay').remove()">✕</button>
                    </div>
                    <div class="story-modal-content">
                        <div class="story-form-group">
                            <label class="story-form-label">Story Image *</label>
                            <input type="file" id="storyImageInput" accept="image/*" class="story-file-input">
                        </div>
                        <div class="story-form-group">
                            <label class="story-form-label">Music URL (Cloudinary)</label>
                            <input type="text" id="storyMusicInput" placeholder="https://res.cloudinary.com/..." class="story-form-input">
                        </div>
                        <div class="story-form-group">
                            <label class="story-form-label">Music Name</label>
                            <input type="text" id="storyMusicNameInput" placeholder="e.g., Jazz Background" class="story-form-input">
                        </div>
                        <div class="story-form-group">
                            <label class="story-form-label">Caption</label>
                            <textarea id="storyCaptionInput" placeholder="Add a caption..." class="story-form-textarea"></textarea>
                        </div>
                    </div>
                    <div class="story-modal-footer">
                        <button class="story-btn-cancel" onclick="document.getElementById('storyModalOverlay').remove()">Cancel</button>
                        <button class="story-btn-upload" id="storyUploadBtn" onclick="app.uploadStory()">
                            <span class="story-btn-text">📤 Upload Story</span>
                            <div class="story-spinner"></div>
                        </button>
                    </div>
                </div>
            </div>
        `;
       
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('storyModalOverlay').classList.add('active');
        
        // Close on background click
        document.getElementById('storyModalOverlay').addEventListener('click', function(e) {
            if (e.target === this) {
                this.remove();
            }
        });
    },

    uploadStory: function() {
        var self = this;
        var imageInput = document.getElementById('storyImageInput');
        var musicInput = document.getElementById('storyMusicInput');
        var musicNameInput = document.getElementById('storyMusicNameInput');
        var captionInput = document.getElementById('storyCaptionInput');
        var uploadBtn = document.getElementById('storyUploadBtn');
       
        // Validate image
        if (!imageInput || !imageInput.files || !imageInput.files[0]) {
            this.toast('⚠️ Please select an image', 'error');
            return;
        }
        
        // Validate user is logged in
        if (!this.user || !this.user.uid) {
            this.toast('⚠️ Please login first', 'error');
            return;
        }
       
        // Show spinner
        if (uploadBtn) uploadBtn.classList.add('loading');
        
        this.toast('📤 Uploading story...', 'info');
       
        // Upload image to Cloudinary
        var formData = new FormData();
        formData.append('file', imageInput.files[0]);
        formData.append('upload_preset', 'chichi_upload');
       
        fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
            method: 'POST',
            body: formData
        })
        .then(r => {
            if (!r.ok) throw new Error('Upload failed: ' + r.status);
            return r.json();
        })
        .then(data => {
            if (!data.secure_url) {
                throw new Error('No image URL returned');
            }
            
            // Get safe values
            var musicUrl = musicInput ? musicInput.value.trim() : '';
            var musicName = musicNameInput ? musicNameInput.value.trim() : 'Audio';
            var caption = captionInput ? captionInput.value.trim() : '';
            
            // Save story to Firebase
            var storyId = 'story_' + Date.now();
            var storyData = {
                image: data.secure_url,
                musicUrl: musicUrl || '',
                musicName: musicName || 'Audio',
                caption: caption || '',
                createdAt: new Date().getTime(),
                views: 0,
                authorUid: self.user.uid,
                authorName: self.user.displayName || 'Anonymous',
                userName: self.profile ? (self.profile.name || 'User') : 'User',
                userPhoto: self.profile ? (self.profile.profilePhoto || '') : ''
            };
            
            // Save to Firebase
            if (!db) throw new Error('Database not initialized');
            
            db.ref('stories/' + self.user.uid + '/' + storyId).set(storyData, function(err) {
                if (err) {
                    console.error('Firebase error:', err);
                    self.toast('❌ Error saving story: ' + err.message, 'error');
                    if (uploadBtn) uploadBtn.classList.remove('loading');
                } else {
                    self.toast('✅ Story uploaded successfully!', 'success');
                    setTimeout(() => {
                        var modal = document.getElementById('storyModalOverlay');
                        if (modal) modal.remove();
                        self.loadStories();
                    }, 500);
                }
            });
        })
        .catch(err => {
            console.error('Upload error:', err);
            this.toast('❌ Upload failed: ' + err.message, 'error');
            if (uploadBtn) uploadBtn.classList.remove('loading');
        });
    },

    viewStory: function(storyId, userId) {
        // ADDED: Use provided userId or fall back to current user
        userId = userId || this.user.uid;
        
        this.toast('👁️ Story view recorded', 'info');
        // KEPT: Increment view count (updated to use userId parameter)
        db.ref('stories/' + userId + '/' + storyId + '/views').once('value', s => {
            var views = (s.val() || 0) + 1;
            db.ref('stories/' + userId + '/' + storyId + '/views').set(views);
        });
    },

    // ========== NOTIFICATION SYSTEM ==========
    // Notify user of new incoming message
    notifyNewMessage: function(senderName, messageText) {
        // Clean message text
        var cleanMessage = messageText ? messageText.substring(0, 150) : '📷 Image';
       
        // 1. Browser notification (with preview)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('💬 ' + senderName.toUpperCase(), {
                body: cleanMessage,
                icon: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
                tag: 'chichi-message-' + senderName,
                badge: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
                requireInteraction: false,
                vibrate: [200, 100, 200]
            });
        }
       
        // 2. In-app toast notification (with preview)
        this.toast(`📬 ${senderName}: ${cleanMessage}`, 'info', 4000);
       
        // 3. Play notification sound
        this.playNotificationSound();
       
        // 4. Update browser title
        this.updateBrowserTitle();
       
        // 5. Vibrate (mobile) - only if user has interacted
        if (navigator.vibrate && this.userHasInteracted) {
            try {
                navigator.vibrate([200, 100, 200]);
                console.log('📳 Vibration triggered');
            } catch (e) {
                console.log('⏸️ Vibration blocked:', e.message);
            }
        } else if (navigator.vibrate && !this.userHasInteracted) {
            console.log('📳 Vibration disabled (no user interaction yet)');
        }
       
        console.log('🔔 Notification: ' + senderName + ' - ' + cleanMessage);
    },

    // Request browser notification permission
    requestNotificationPermission: function() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ Notifications enabled!');
                    this.toast('Notifications enabled! 🔔', 'success');
                }
            });
        }
    },

    // Play notification sound
    playNotificationSound: function() {
        // Audio requires user gesture in modern browsers
        // Only try to play if user has interacted with the page
        if (!this.userHasInteracted) {
            console.log('⏸️ Audio disabled (no user interaction yet)');
            return;
        }
       
        try {
            var audioContext = new (window.AudioContext || window.webkitAudioContext)();
           
            // Resume if suspended
            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(e => {
                    console.log('⏸️ AudioContext suspended - user must interact first');
                });
            }
           
            var oscillator = audioContext.createOscillator();
            var gainNode = audioContext.createGain();
           
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
           
            // Pleasant notification sound (ding)
            oscillator.frequency.value = 800; // Hz
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
           
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
           
            console.log('🔊 Notification sound played');
        } catch (e) {
            console.log('⏸️ Audio notification skipped:', e.message);
        }
    },

    // Update browser title with unread count
    updateBrowserTitle: function() {
        var totalUnread = 0;
        var userIds = Object.keys(this.users);
       
        userIds.forEach(uid => {
            if (uid !== this.user.uid) {
                var chatKey = [this.user.uid, uid].sort().join('_');
                if (this.unreadMessages && this.unreadMessages[chatKey]) {
                    totalUnread += this.unreadMessages[chatKey].count || 0;
                }
            }
        });
       
        if (totalUnread > 0) {
            document.title = `💬 (${totalUnread}) CHICHI`;
        } else {
            document.title = 'CHICHI';
        }
    },

    loadMessages: function() {
        var self = this;
        console.log('💬 Loading messages for user:', this.user ? this.user.uid : 'guest');
        
        // Check if guest - show sign-up prompt
        if (!this.user || this.isGuest) {
            var html = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px 20px; text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 16px;">💬</div>
                    <div style="font-size: 22px; font-weight: 700; margin-bottom: 12px; color: var(--text);">Connect & Chat Now</div>
                    <div style="font-size: 15px; color: var(--text-light); margin-bottom: 12px; line-height: 1.6; max-width: 280px;">
                        Join our community to message friends, share ideas, and build real connections!
                    </div>
                    <button onclick="app.showLoginPage()" style="background: var(--primary); color: white; border: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">🚀 Sign Up / Login</button>
                </div>
            `;
            document.getElementById('messagesView').innerHTML = html;
            return;
        }
        
        // ADDED: Load blocked users first
        this.loadBlockedUsers();
        
        var html = '';
        
        // Initialize chatMessages if missing
        if (!this.chatMessages) {
            this.chatMessages = {};
        }
        
        var conversations = [];
        var messagesLoaded = false;
        
        console.log('🔍 Searching for message conversations...');
        
        // ADDED: Load message history to get only users with text messages
        db.ref('messages').once('value', snapshot => {
            messagesLoaded = true;
            console.log('📡 Messages snapshot received');
            
            if (snapshot.val()) {
                console.log('✅ Messages found:', Object.keys(snapshot.val()).length, 'conversations');
                
                Object.keys(snapshot.val()).forEach(chatKey => {
                    // Check if this chatKey involves current user
                    if (chatKey.includes(self.user.uid)) {
                        // Extract the other user's ID
                        var parts = chatKey.split('_');
                        var otherUserId = parts[0] === self.user.uid ? parts[1] : parts[0];
                        
                        // ADDED: Skip if user is blocked
                        if (self.blockedUsers && self.blockedUsers[otherUserId]) {
                            return;
                        }
                        
                        var messages = snapshot.val()[chatKey];
                        var hasTextMessages = false;
                        var lastMessage = 'Tap to message';
                        var lastTime = 'Now';
                        var lastTimestamp = 0;
                        var unreadCount = 0;
                        
                        // Filter for text messages only and count unread
                        if (messages && typeof messages === 'object') {
                            Object.keys(messages).forEach(msgId => {
                                var msg = messages[msgId];
                                
                                // Only count non-deleted messages
                                if (msg && !msg.deleted) {
                                    if (msg.text) {
                                        hasTextMessages = true;
                                        lastMessage = msg.text.substring(0, 50);
                                        lastTimestamp = msg.timestamp || 0;
                                        
                                        // Count unread from other user
                                        if (msg.senderId !== self.user.uid && !msg.read) {
                                            unreadCount++;
                                        }
                                    }
                                }
                            });
                            
                            if (hasTextMessages && otherUserId && self.users[otherUserId]) {
                                conversations.push({
                                    uid: otherUserId,
                                    chatKey: chatKey,
                                    lastMessage: lastMessage,
                                    lastTime: lastTime,
                                    lastTimestamp: lastTimestamp,
                                    unreadCount: unreadCount,
                                    user: self.users[otherUserId]
                                });
                            }
                        }
                    }
                });
            } else {
                console.log('📭 No messages found in database');
            }
            
            // Sort by most recent first
            conversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
            
            console.log('✅ Total conversations:', conversations.length);
            
            // Render conversations
            if (conversations.length > 0) {
                conversations.forEach(conv => {
                    var unreadBadge = conv.unreadCount > 0 ? `<span style="background: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${conv.unreadCount}</span>` : '';
                    
                    html += `
                        <div onclick="app.openChatFromSearch('${conv.uid}', '${conv.user.name}')" style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                            <div style="width: 50px; height: 50px; border-radius: 50%; background: ${conv.user.profilePhoto ? `url('${conv.user.profilePhoto}')` : 'var(--primary)'}; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; margin-right: 12px;">
                                ${!conv.user.profilePhoto ? conv.user.name.charAt(0) : ''}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; margin-bottom: 4px;">${conv.user.name}</div>
                                <div style="font-size: 14px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${conv.lastMessage}</div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                <div style="font-size: 12px; color: #9ca3af;">${conv.lastTime}</div>
                                ${unreadBadge}
                            </div>
                        </div>
                    `;
                });
            } else {
                html = '<div style="text-align: center; color: #6b7280; padding: 40px 16px;">No messages yet. Go to someone\'s profile to start a chat!</div>';
            }
            
            var container = document.getElementById('messageList');
            if (container) {
                container.innerHTML = html;
                console.log('✅ Messages rendered:', conversations.length);
            }
        }).catch(err => {
            console.error('❌ Error loading messages:', err);
            self.toast('Error loading messages', 'error');
        });
    },

    openChatFromExplore: function(uid, name) {
        this.openChat(uid, name);
    },

    openChat: function(uid, name) {
        // Block guests from messaging
        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to message users', 'info');
            this.showLoginPage();
            return;
        }
        
        // HIDE ALL OTHER VIEWS COMPLETELY
        var allViews = document.querySelectorAll('.view');
        allViews.forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none !important';
            view.style.visibility = 'hidden';
            view.style.opacity = '0';
            view.style.zIndex = '1';
            view.style.pointerEvents = 'none';
        });
        
        // Hide main app background
        var mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.style.overflow = 'hidden';
        }
        
        // Show chat view with full CSS properties
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.add('active');
            chatView.style.display = 'flex';
            chatView.style.visibility = 'visible';
            chatView.style.opacity = '1';
            chatView.style.zIndex = '2000';
            chatView.style.position = 'fixed';
            chatView.style.pointerEvents = 'auto';
        }
        
        this.currentChat = { uid: uid, name: name };
        
        // Update header for new chat view
        document.getElementById('chatHeaderName').textContent = name;
        document.getElementById('chatHeaderStatus').textContent = 'Active now';
        document.getElementById('chatHeaderAvatar').textContent = name.charAt(0).toUpperCase();
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('chatMessageInput').value = '';
        
        // Show ONLY chat view - FULL SCREEN
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.add('active');
            chatView.style.display = 'flex';
            chatView.style.position = 'fixed';
            chatView.style.top = '0';
            chatView.style.left = '0';
            chatView.style.right = '0';
            chatView.style.bottom = '0';
            chatView.style.width = '100%';
            chatView.style.height = '100%';
            chatView.style.zIndex = '2000';
            chatView.style.backgroundColor = 'white';
        }
        
        // Also keep modal for compatibility
        document.getElementById('chatModalUserName').textContent = name;
        document.getElementById('chatModalMessages').innerHTML = '';
        document.getElementById('chatModalInput').value = '';
       
        var avatar = document.getElementById('chatModalAvatar');
        var userPhoto = this.users[uid] && this.users[uid].profilePhoto;
        if (userPhoto) {
            avatar.style.backgroundImage = 'url(' + userPhoto + ')';
            avatar.textContent = '';
        } else {
            avatar.style.backgroundImage = 'none';
            avatar.textContent = name.charAt(0).toUpperCase();
        }
       
        var self = this;
        var chatKey = [this.user.uid, uid].sort().join('_');
        
        setTimeout(() => {
            self.loadChatMessages();
            self.markAsRead(uid);
            document.getElementById('chatMessageInput').focus();
        }, 100);
    },

    closeChatModal: function() {
        // Clean up Firebase listener
        if (this.currentChat && this.chatMessagesListener) {
            var key = [this.user.uid, this.currentChat.uid].sort().join('_');
            db.ref('chats/' + key + '/messages').off();
            this.chatMessagesListener = null;
        }
        this.currentChat = null;
        document.getElementById('chatModalOverlay').classList.remove('active');
    },

    loadChatMessages: function() {
        if (!this.currentChat) return;
       
        var self = this;
        var key = [self.user.uid, self.currentChat.uid].sort().join('_');
       
        // Initialize chat messages storage
        if (!this.chatMessages) this.chatMessages = {};
        if (!this.lastMessageCount) this.lastMessageCount = {};
       
        // Remove previous listener to avoid duplicates
        if (this.chatMessagesListener) {
            db.ref('chats/' + key + '/messages').off();
        }
       
        // Step 1: Load ALL existing messages first (this is critical for mobile!)
        db.ref('chats/' + key + '/messages').once('value').then(snapshot => {
            var messages = [];
            snapshot.forEach(c => {
                var m = c.val();
                if (m && (m.text || m.image)) {
                    messages.push(m);
                }
            });
           
            // Sort by timestamp (oldest first)
            messages.sort((a, b) => {
                return (a.timestamp || 0) - (b.timestamp || 0);
            });
           
            // Store messages
            self.chatMessages[key] = messages;
            self.lastMessageCount[key] = messages.length;
           
            // Display messages
            self.displayChatMessages(messages, key);
           
            // Step 2: Set up real-time listener for new incoming messages
            self.chatMessagesListener = db.ref('chats/' + key + '/messages').on('child_added', snap => {
                var m = snap.val();
                if (m && (m.text || m.image) && m.sender !== self.user.uid) {
                    // Notify of new message from other person
                    self.notifyNewMessage(self.currentChat.name, m.text || '📷 Image');
                   
                    // Reload all messages to show new one
                    db.ref('chats/' + key + '/messages').once('value').then(s => {
                        var updated = [];
                        s.forEach(c => {
                            var msg = c.val();
                            if (msg && (msg.text || msg.image)) {
                                updated.push(msg);
                            }
                        });
                        updated.sort((a, b) => {
                            return (a.timestamp || 0) - (b.timestamp || 0);
                        });
                        self.chatMessages[key] = updated;
                        self.displayChatMessages(updated, key);
                    });
                }
            });
        }).catch(err => {
            console.error('❌ Error loading messages:', err);
            self.toast('Error: ' + err.message, 'error');
        });
    },

    // Display messages in chat modal
    displayChatMessages: function(messages, key) {
        var self = this;
       
        // Store messages in cache
        if (key) {
            if (!this.chatMessages) this.chatMessages = {};
            this.chatMessages[key] = messages;
        }
       
        if (!messages || messages.length === 0) {
            var chatMessagesDiv = document.getElementById('chatModalMessages');
            if (chatMessagesDiv) {
                chatMessagesDiv.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px 16px;">Start a conversation!</div>';
            }
            
            var chatMessagesView = document.getElementById('chatMessages');
            if (chatMessagesView) {
                chatMessagesView.innerHTML = '<div style="text-align: center; color: #999; padding: 40px 16px; font-size: 14px;">No messages yet. Say hello! 👋</div>';
            }
            return;
        }
       
        var html = '';
        var htmlWhatsApp = '';
        var lastDate = '';
       
        messages.forEach((m, idx) => {
            if (!m || (!m.text && !m.image)) return;
           
            var side = m.sender === self.user.uid ? 'sent' : 'received';
            var timestamp = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
           
            // Add date separator
            if (idx === 0 || (messages[idx-1] && new Date(messages[idx-1].timestamp).toDateString() !== new Date(m.timestamp).toDateString())) {
                var d = new Date(m.timestamp);
                var today = new Date();
                var yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
               
                var dateStr = 'Today';
                if (d.toDateString() === yesterday.toDateString()) {
                    dateStr = 'Yesterday';
                } else if (d.toDateString() !== today.toDateString()) {
                    dateStr = d.toLocaleDateString();
                }
               
                html += `<div style="text-align: center; margin: 16px 0; color: var(--text-light); font-size: 0.75rem; font-weight: 600;">${dateStr}</div>`;
                
                // WhatsApp date divider
                if (dateStr !== lastDate) {
                    htmlWhatsApp += `<div class="message-date-divider">${dateStr}</div>`;
                    lastDate = dateStr;
                }
            }
           
            var content = '';
            if (m.image) {
                if (Array.isArray(m.image)) {
                    content += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">';
                    m.image.forEach((img, i) => {
                        if (i < 4) {
                            content += `<img src="${img}" style="width: 100%; border-radius: 8px; cursor: pointer;" onclick="app.viewFullImage('${img}')">`;
                        }
                    });
                    content += '</div>';
                } else {
                    content += `<img src="${m.image}" style="max-width: 180px; border-radius: 12px; cursor: pointer;" onclick="app.viewFullImage('${m.image}')">`;
                }
            }
            if (m.text) {
                content += `<div>${m.text}</div>`;
            }
           
            // Old modal style
            var bubbleStyle = side === 'sent' ?
                'background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; border-radius: 18px 18px 4px 18px;' :
                'background: linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 100%); color: var(--text); border-radius: 18px 18px 18px 4px;';
           
            html += `
                <div class="chat-message ${side}">
                    <div class="chat-message-bubble" style="${bubbleStyle} padding: 12px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); max-width: 280px;">
                        ${content}
                        <div style="font-size: 0.7rem; margin-top: 4px; opacity: 0.7;">${timestamp}</div>
                    </div>
                </div>
            `;
            
            // WhatsApp light theme style
            var whatsAppBubbleClass = side === 'sent' ? 'own' : 'other';
            htmlWhatsApp += `
                <div class="message-bubble ${whatsAppBubbleClass}">
                    <div>
                        <div class="message-content">
                            ${m.text || (m.image ? '📷' : '')}
                        </div>
                        <div class="message-time">${timestamp}</div>
                    </div>
                </div>
            `;
        });
       
        // Render in modal
        var chatMessagesDiv = document.getElementById('chatModalMessages');
        if (chatMessagesDiv) {
            chatMessagesDiv.innerHTML = html;
            setTimeout(() => chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight, 50);
            setTimeout(() => chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight, 150);
            setTimeout(() => chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight, 300);
        }
        
        // Render in WhatsApp chat view
        var chatMessagesView = document.getElementById('chatMessages');
        if (chatMessagesView) {
            chatMessagesView.innerHTML = htmlWhatsApp;
            setTimeout(() => chatMessagesView.scrollTop = chatMessagesView.scrollHeight, 50);
            setTimeout(() => chatMessagesView.scrollTop = chatMessagesView.scrollHeight, 150);
        }
    },

    closeChatView: function() {
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.remove('active');
            chatView.style.display = 'none';
            chatView.style.visibility = 'hidden';
            chatView.style.opacity = '0';
            chatView.style.zIndex = '-1';
            chatView.style.pointerEvents = 'none';
        }
        if (this.currentChat && this.chatMessagesListener) {
            var key = [this.user.uid, this.currentChat.uid].sort().join('_');
            db.ref('chats/' + key + '/messages').off();
            this.chatMessagesListener = null;
        }
        this.currentChat = null;
        
        // Show messages view again
        this.showView('messages');
    },
    
    showView: function(viewName) {
        // Hide chat view COMPLETELY
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.remove('active');
            chatView.style.display = 'none';
            chatView.style.visibility = 'hidden';
            chatView.style.opacity = '0';
            chatView.style.zIndex = '-1';
            chatView.style.pointerEvents = 'none';
        }
        
        // Use switchView for the actual view switching
        this.switchView(viewName);
    },

    filterMessages: function(filter) {
        console.log('🔍 Filtering messages:', filter);
        
        // Update active tab
        document.querySelectorAll('.message-filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Re-render messages with filter
        this.loadMessages();
    },

    renderWhatsAppMessages: function(conversations) {
        var html = '';
        
        if (conversations.length === 0) {
            html = '<div style="text-align: center; color: #999; padding: 40px 16px;">No conversations yet</div>';
        } else {
            conversations.forEach(conv => {
                var unreadBadge = conv.unreadCount > 0 ? `<div class="whatsapp-unread-badge">${conv.unreadCount}</div>` : '';
                var avatarStyle = conv.user.profilePhoto ? `background-image: url('${conv.user.profilePhoto}');` : '';
                var avatarText = !conv.user.profilePhoto ? conv.user.name.charAt(0).toUpperCase() : '';
                
                html += `
                    <div class="whatsapp-conversation" onclick="app.openChatFromSearch('${conv.uid}', '${conv.user.name}')">
                        <div class="whatsapp-conv-avatar" style="${avatarStyle}">
                            ${avatarText}
                        </div>
                        <div class="whatsapp-conv-info">
                            <div class="whatsapp-conv-name">${conv.user.name}</div>
                            <div class="whatsapp-conv-message">${conv.lastMessage}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <div class="whatsapp-conv-time">${conv.lastTime}</div>
                            ${unreadBadge}
                        </div>
                    </div>
                `;
            });
        }
        
        var container = document.getElementById('messageList');
        if (container) {
            container.innerHTML = html;
        }
    },

    renderChatMessagesWhatsApp: function(messages) {
        var html = '';
        var lastDate = '';
        
        for (var msgId in messages) {
            var msg = messages[msgId];
            if (msg && !msg.deleted) {
                var isOwn = msg.sender === this.user.uid;
                var msgDate = new Date(msg.timestamp).toLocaleDateString('en-KE');
                
                // Show date divider if date changed
                if (msgDate !== lastDate) {
                    html += `<div class="message-date-divider">${msgDate}</div>`;
                    lastDate = msgDate;
                }
                
                var msgTime = new Date(msg.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
                var readReceipt = isOwn && msg.read ? '✓✓' : '✓';
                var readMarkup = isOwn ? ` ${readReceipt}` : '';
                
                html += `
                    <div class="message-bubble ${isOwn ? 'own' : 'other'}">
                        <div>
                            <div class="message-content">
                                ${msg.text || (msg.image ? '📷' : '')}
                            </div>
                            <div class="message-time">${msgTime}${readMarkup}</div>
                        </div>
                    </div>
                `;
            }
        }
        
        var container = document.getElementById('chatMessages');
        if (container) {
            container.innerHTML = html;
            // Auto-scroll to bottom
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    },

    sendChatMessage: function() {
        if (!this.currentChat) {
            this.toast('No chat selected', 'error');
            return;
        }
       
        // Try both input fields (modal and new view)
        var input = document.getElementById('chatModalInput');
        var inputWhatsApp = document.getElementById('chatMessageInput');
        var text = (input && input.value) || (inputWhatsApp && inputWhatsApp.value) || '';
        text = text.trim();
       
        if (!text) {
            if (input) input.focus();
            if (inputWhatsApp) inputWhatsApp.focus();
            return;
        }

        var self = this;
        var key = [self.user.uid, self.currentChat.uid].sort().join('_');
       
        // IMMEDIATELY add message to display (optimistic update)
        var now = new Date().getTime();
        if (!this.chatMessages[key]) this.chatMessages[key] = [];
       
        var tempMessage = {
            sender: self.user.uid,
            text: text,
            timestamp: now,
            pending: true
        };
       
        // Add to display immediately
        this.chatMessages[key].push(tempMessage);
        this.displayChatMessages(this.chatMessages[key], key);
       
        // Clear both input fields
        if (input) input.value = '';
        if (inputWhatsApp) inputWhatsApp.value = '';
        
        if (inputWhatsApp) inputWhatsApp.focus();
        if (input) input.focus();
       
        // Save to Firebase (with retry)
        var messageRef = db.ref('messages/' + key).push();
        messageRef.set({
            text: text,
            senderId: self.user.uid,
            sender: self.user.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        }).then(() => {
            console.log('✅ Message sent');
            
            // Update last message in chats/{key}/lastMessage
            db.ref('chats/' + key + '/messages/' + messageRef.key).set({
                text: text,
                sender: self.user.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            });
            
            // Mark message as confirmed
            tempMessage.pending = false;
            self.displayChatMessages(self.chatMessages[key], key);
        }).catch(err => {
            console.error('❌ Error sending message:', err);
            self.toast('Error sending message', 'error');
            
            // Remove the temporary message on error
            var idx = self.chatMessages[key].indexOf(tempMessage);
            if (idx > -1) {
                self.chatMessages[key].splice(idx, 1);
                self.displayChatMessages(self.chatMessages[key], key);
            }
        });
    },

    handleChatImageUpload: function(e) {
        var files = e.target.files;
        if (!files || files.length === 0) return;
       
        var self = this;
        var uploadPromises = [];
       
        for (var i = 0; i < files.length; i++) {
            uploadPromises.push(self.uploadChatImage(files[i]));
        }
       
        Promise.all(uploadPromises).then(urls => {
            self.sendChatImages(urls);
            // Reset input
            document.getElementById('chatImageInput').value = '';
        }).catch(err => {
            self.toast('Image upload failed', 'error');
        });
    },

    uploadChatImage: function(file) {
        return new Promise((resolve, reject) => {
            var formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'chichi_photos');
           
            fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                method: 'POST',
                body: formData
            }).then(r => r.json()).then(d => {
                if (d.secure_url) {
                    resolve(d.secure_url);
                } else {
                    reject('Upload failed');
                }
            }).catch(reject);
        });
    },

    sendChatImages: function(imageUrls) {
        if (!this.currentChat) {
            this.toast('No chat selected', 'error');
            return;
        }
       
        var self = this;
        var key = [self.user.uid, self.currentChat.uid].sort().join('_');
       
        db.ref('chats/' + key + '/messages').push({
            sender: self.user.uid,
            image: imageUrls.length === 1 ? imageUrls[0] : imageUrls,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            self.toast('Image sent! 📸', 'success');
            var messagesDiv = document.getElementById('chatModalMessages');
            if (messagesDiv) {
                setTimeout(() => {
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }, 50);
            }
        }).catch(err => {
            self.toast('Failed to send image', 'error');
        });
    },

    trackUnreadMessages: function() {
        var self = this;
        
        // Skip if guest - no messages for non-users
        if (!this.user || this.isGuest) {
            console.log('ℹ️ Guest mode - skipping message tracking');
            return;
        }
       
        // Prevent double tracking
        if (self.unreadTrackingActive) {
            console.log('ℹ️ Unread tracking already running - skipping');
            return;
        }
        self.unreadTrackingActive = true;
       
        var userIds = Object.keys(this.users || {});
       
        if (!this.unreadMessages) this.unreadMessages = {};
        if (!this.notifiedMessages) this.notifiedMessages = {};
        if (!this.messageCountTracker) this.messageCountTracker = {};
       
        console.log('📊 Setting up message tracking for ' + userIds.length + ' users');
       
        if (userIds.length === 0) {
            console.log('⚠️ No users to track! Skipping setup...');
            self.unreadTrackingActive = false;
            return;
        }
       
        userIds.forEach(uid => {
            if (uid !== self.user.uid) {
                var key = [self.user.uid, uid].sort().join('_');
                var userName = (this.users[uid] || {}).name || 'User';
                var messagesRef = db.ref('chats/' + key + '/messages');
               
                // Fetch initial state to establish baseline
                messagesRef.orderByChild('timestamp').once('value', s => {
                    var count = 0;
                    var lastMessage = null;
                    s.forEach(c => {
                        var m = c.val();
                        if (m && (m.text || m.image)) {
                            count++;
                            lastMessage = m;
                        }
                    });
                    self.messageCountTracker[key] = count;
                    console.log('📊 ' + userName + ': ' + count + ' messages (baseline)');
                });
               
                // Listen for every single new message (child_added fires for each new child)
                messagesRef.orderByChild('timestamp').on('child_added', childSnap => {
                    var m = childSnap.val();
                    if (!m) return;
                   
                    // Only notify if message is from the other person
                    if (m.sender !== self.user.uid && (m.text || m.image)) {
                        var notifyKey = key + '_' + m.timestamp;
                       
                        // Make absolutely sure we don't duplicate notifications
                        if (!self.notifiedMessages[notifyKey]) {
                            console.log('🔔 [REAL-TIME] NEW MESSAGE from ' + userName + ': ' + (m.text || '📷 Image'));
                            self.notifyNewMessage(userName, m.text || '📷 Image');
                            self.notifiedMessages[notifyKey] = true;
                        }
                    }
                });
               
                // SIMPLIFIED: Count unread messages
                messagesRef.on('value', s => {
                    var unreadCount = 0;
                    var messages = [];
                   
                    s.forEach(c => {
                        var m = c.val();
                        if (m && (m.text || m.image)) {
                            messages.push(m);
                            // Count as unread: from other person AND not read yet
                            if (m.sender !== self.user.uid && !m.read) {
                                unreadCount++;
                            }
                        }
                    });
                   
                    // Store in unreadMessages object
                    if (!self.unreadMessages[key]) {
                        self.unreadMessages[key] = { userName: userName };
                    }
                    self.unreadMessages[key].count = unreadCount;
                    self.unreadMessages[key].messages = messages;
                   
                    // Update UI
                    self.updateUnreadBadge();
                    self.loadMessages();
                });
            }
        });
    },

    markAsRead: function(uid) {
        var self = this;
        var key = [this.user.uid, uid].sort().join('_');
       
        // Clear local count
        if (this.unreadMessages && this.unreadMessages[key]) {
            this.unreadMessages[key].count = 0;
        }
       
        // Mark messages as read in Firebase
        var messagesRef = db.ref('chats/' + key + '/messages');
        messagesRef.once('value', snap => {
            snap.forEach(childSnap => {
                var m = childSnap.val();
                // Mark unread messages from other person as read
                if (m && m.sender !== self.user.uid && !m.read) {
                    childSnap.ref.update({ read: true });
                }
            });
        });
       
        this.updateUnreadBadge();
    },

    updateUnreadBadge: function() {
        var self = this;
        var unreadCount = 0;
        var unrepliedUsers = [];
       
        if (this.unreadMessages) {
            Object.entries(this.unreadMessages).forEach(([chatKey, data]) => {
                if (data && data.count && data.count > 0) {
                    unreadCount += data.count;
                    if (data.userName) {
                        unrepliedUsers.push(data.userName + ' (' + data.count + ')');
                    }
                }
            });
        }
       
        // Log who's waiting for a reply
        if (unrepliedUsers.length > 0) {
            console.log('%c🔴 PEOPLE WAITING FOR YOUR REPLY:', 'color: #ff4444; font-weight: bold;');
            unrepliedUsers.forEach(user => console.log('   👤 ' + user));
        }
       
        console.log('🔄 Badge update: Total unread=' + unreadCount);
       
        var badge = document.getElementById('messagesBadge');
        var dot = document.getElementById('messagesUnreadDot');
       
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'flex';
                badge.style.opacity = '1';
                console.log('✅ Badge SHOWN with count:', unreadCount);
                if (dot) {
                    dot.style.display = 'block';
                    dot.style.opacity = '1';
                }
            } else {
                badge.style.display = 'none';
                badge.style.opacity = '0';
                if (dot) {
                    dot.style.display = 'none';
                    dot.style.opacity = '0';
                }
            }
        } else {
            console.warn('⚠️ Badge element not found in DOM!');
        }
       
        return unreadCount;
    },

    clearUnreadBadge: function() {
        document.getElementById('messagesBadge').style.display = 'none';
    },

    viewFullImage: function(imageUrl) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '2000';
        modal.innerHTML = `
            <div style="position: relative; width: 90%; max-width: 500px;">
                <img src="${imageUrl}" style="width: 100%; border-radius: 12px;">
                <button onclick="this.closest('.modal-overlay').remove()" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; font-weight: 700;">✕</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    viewAllImages: function(images) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '2000';
        var html = '<div style="width: 90%; max-width: 600px;"><div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">';
        images.forEach(img => {
            html += `<img src="${img}" style="width: 100%; border-radius: 8px; cursor: pointer;" onclick="app.viewFullImage('${img}')">`;
        });
        html += '</div><button onclick="this.closest(\'.modal-overlay\').remove()" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; margin-top: 12px; cursor: pointer; font-weight: 600;">Close</button></div>';
        modal.innerHTML = html;
        document.body.appendChild(modal);
    },

    showWithdrawModal: function() {
        if (this.balance < 20) {
            this.toast('Minimum 20 KSh', 'error');
            return;
        }
        document.getElementById('withdrawModal').classList.add('active');
    },

    closeWithdrawModal: function() {
        document.getElementById('withdrawModal').classList.remove('active');
    },

    processWithdrawal: function() {
        var amount = parseFloat(document.getElementById('withdrawAmount').value);
        if (amount < 20 || amount > this.balance) {
            this.toast('Invalid amount', 'error');
            return;
        }

        var self = this;
        db.ref('withdrawals').push({
            userId: this.user.uid,
            userName: this.profile.name,
            userEmail: this.user.email,
            amount: amount,
            method: document.getElementById('paymentMethod').value,
            account: document.getElementById('accountNumber').value,
            status: 'pending',
            createdAt: new Date().toLocaleString('en-KE')
        });

        this.balance -= amount;
        db.ref('users/' + this.user.uid + '/balance').set(this.balance);
        this.toast('Withdrawal requested!', 'success');
        this.closeWithdrawModal();
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('accountNumber').value = '';
    },

    watchAd: function() {
        // Earning features disabled until new earning system is implemented
        this.toast('Earning features coming soon!', 'info');
        return;
    },

    getAdsRemaining: function() {
        // Earning features disabled
        return 0;
    },

    showHeaderMenu: function() {
        var menu = document.getElementById('headerMenu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },
    
    closeHeaderMenu: function() {
        var menu = document.getElementById('headerMenu');
        if (menu) {
            menu.style.display = 'none';
        }
    },

    showLogout: function() {
        document.getElementById('logoutModal').classList.add('active');
    },

    closeLogout: function() {
        document.getElementById('logoutModal').classList.remove('active');
    },

    confirmLogout: function() {
        // Legacy function - redirect to justLogout
        this.justLogout();
    },

    justLogout: function() {
        auth.signOut();
        document.getElementById('logoutModal').classList.remove('active');
        this.showAuth();
        this.toast('Logged out successfully', 'success');
    },

    deleteAccountPermanently: function() {
        var self = this;
       
        // Confirm deletion
        if (!confirm('⚠️ WARNING: This will PERMANENTLY DELETE your account and all your data!\n\nAll posts, messages, and profile info will be removed.\nThis CANNOT be undone.\n\nAre you absolutely sure?')) {
            return;
        }
       
        if (!confirm('Final confirmation: Delete everything? Click OK to proceed.')) {
            return;
        }
       
        this.toast('Deleting account... Please wait...', 'success');
       
        // Delete user data from database FIRST
        var uid = this.user.uid;
        var deletionPromises = [];
       
        // 1. Delete user profile
        deletionPromises.push(
            db.ref('users/' + uid).remove()
        );
       
        // 2. Delete all user's posts
        deletionPromises.push(
            db.ref('posts').orderByChild('userId').equalTo(uid).once('value', snapshot => {
                var deletePromises = [];
                snapshot.forEach(post => {
                    deletePromises.push(db.ref('posts/' + post.key).remove());
                });
                return Promise.all(deletePromises);
            })
        );
       
        // 3. Delete all user's chats
        deletionPromises.push(
            db.ref('chats').once('value', snapshot => {
                var deletePromises = [];
                snapshot.forEach(chat => {
                    var chatKey = chat.key;
                    // If chat involves this user, delete it
                    if (chatKey.includes(uid)) {
                        deletePromises.push(db.ref('chats/' + chatKey).remove());
                    }
                });
                return Promise.all(deletePromises);
            })
        );
       
        // 4. Remove user from other users' following lists
        deletionPromises.push(
            db.ref('users').once('value', snapshot => {
                var updatePromises = [];
                snapshot.forEach(otherUser => {
                    var otherUid = otherUser.key;
                    // TODO: Remove uid from followers/following if needed
                });
                return Promise.all(updatePromises);
            })
        );
       
        // Execute all deletions
        Promise.all(deletionPromises).then(() => {
            self.toast('Data deleted successfully. Removing account...', 'success');
           
            // Then delete Firebase auth account
            setTimeout(() => {
                auth.currentUser.delete().then(() => {
                    self.toast('Account permanently deleted', 'success');
                    auth.signOut();
                    document.getElementById('logoutModal').classList.remove('active');
                    self.showAuth();
                    setTimeout(() => {
                        self.toast('Your account has been completely removed', 'success');
                    }, 500);
                }).catch(err => {
                    if (err.code === 'auth/requires-recent-login') {
                        self.toast('Please log in again before deleting your account', 'error');
                        // Sign out and ask to re-login
                        auth.signOut();
                        self.showAuth();
                    } else {
                        self.toast('Error: ' + err.message, 'error');
                    }
                });
            }, 1000);
           
        }).catch(err => {
            self.toast('Error deleting data: ' + err.message, 'error');
        });
    },

    cleanupDeletedUsers: function() {
        // Admin function to remove ghost/deleted users from database
        var self = this;
       
        if (!prompt('Admin: Enter password to cleanup deleted users:') === self.adminPassword) {
            // Simple check - in production use proper auth
        }
       
        this.toast('Scanning for deleted/ghost users...', 'success');
       
        var deletedCount = 0;
        db.ref('users').once('value', snapshot => {
            snapshot.forEach(userSnapshot => {
                var uid = userSnapshot.key;
                var user = userSnapshot.val();
               
                // Check if user is "deleted" (missing required fields)
                if (!user ||
                    !user.name ||
                    !user.email ||
                    user.name.trim() === '' ||
                    user.email.trim() === '') {
                   
                    console.log('Removing deleted user:', uid);
                    db.ref('users/' + uid).remove();
                    deletedCount++;
                }
            });
           
            self.toast(`Removed ${deletedCount} deleted user records`, 'success');
           
            // Reload users and refresh view
            setTimeout(() => {
                self.loadUsers();
                self.loadExplore();
                self.loadMessages();
            }, 500);
        }).catch(err => {
            self.toast('Error during cleanup: ' + err.message, 'error');
        });
    },

    toast: function(msg, type) {
        var el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },

    initConsent: function() {
        var consentGiven = localStorage.getItem('userConsent');
        if (!consentGiven) {
            // Check if user is in EEA, UK, or Switzerland
            this.checkUserLocation();
        }
    },

    checkUserLocation: function() {
        // Try to detect user location via IP
        fetch('https://ipapi.co/json/')
            .then(response => response.json())
            .then(data => {
                var eaaCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
                var ukSwissCountries = ['GB', 'CH'];
               
                if (eaaCountries.includes(data.country_code) || ukSwissCountries.includes(data.country_code)) {
                    document.getElementById('consentBanner').classList.add('show');
                }
            })
            .catch(() => {
                // Fallback: show consent banner anyway
                document.getElementById('consentBanner').classList.add('show');
            });
    },

    acceptConsent: function() {
        localStorage.setItem('userConsent', 'accepted');
        localStorage.setItem('userConsentDate', new Date().toISOString());
        document.getElementById('consentBanner').classList.remove('show');
        this.toast('Thank you for your consent', 'success');
    },

    rejectConsent: function() {
        localStorage.setItem('userConsent', 'rejected');
        localStorage.setItem('userConsentDate', new Date().toISOString());
        document.getElementById('consentBanner').classList.remove('show');
        this.toast('Consent rejected', 'success');
    },

    showConsentOptions: function() {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `<div class="modal" style="max-width: 400px;">
            <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
            <h2 style="margin-bottom: 16px; font-weight: 700;">Cookie & Consent Settings</h2>
           
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">Essential Cookies</div>
                    <input type="checkbox" checked disabled style="cursor: not-allowed;">
                </div>
                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 12px;">
                    Required for basic site functionality. Always enabled.
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">Analytics Cookies</div>
                    <input type="checkbox" id="analyticsCookie" checked>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 12px;">
                    Help us understand how you use our site.
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">Advertising Cookies</div>
                    <input type="checkbox" id="adsCookie" checked>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 12px;">
                    Allow personalized ads and ad measurement.
                </div>
            </div>

            <div style="display: flex; gap: 12px;">
                <button class="logout-cancel" onclick="app.rejectConsent(); this.closest('.modal-overlay').remove();" style="flex: 1; padding: 12px;">Reject All</button>
                <button class="btn-submit" onclick="app.saveConsentPreferences(); this.closest('.modal-overlay').remove();" style="flex: 1;">Save Settings</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    },

    saveConsentPreferences: function() {
        var preferences = {
            essential: true,
            analytics: document.getElementById('analyticsCookie').checked,
            advertising: document.getElementById('adsCookie').checked
        };
        localStorage.setItem('userConsentPreferences', JSON.stringify(preferences));
        localStorage.setItem('userConsent', 'accepted');
        localStorage.setItem('userConsentDate', new Date().toISOString());
        document.getElementById('consentBanner').classList.remove('show');
        this.toast('Consent preferences saved', 'success');
    },

    initNotifications: function() {
        // Request notification permission from user
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ Notification permission granted');
                } else {
                    console.log('⚠️ Notification permission denied by user');
                }
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            console.log('✅ Notifications already have permission');
        }
       
        // Start tracking unread messages immediately
        var self = this;
        setTimeout(() => {
            self.trackUnreadMessages();
            console.log('✅ Notifications configured and tracking started');
        }, 500);
    },

    showNotificationToast: function(title, body) {
        var notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            max-width: 300px;
            animation: slideIn 0.3s ease;
            cursor: pointer;
        `;
        notification.innerHTML = `
            <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${title}</div>
            <div style="font-size: 0.9rem; color: var(--text);">${body}</div>
        `;
        document.body.appendChild(notification);
       
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    },

    sendNotification: function(userId, title, body, data) {
        // This would typically be called from a Cloud Function
        // For now, we're just logging it
    },

    showNotificationPreferences: function() {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        var notifSettings = localStorage.getItem('notificationSettings') ? JSON.parse(localStorage.getItem('notificationSettings')) : {
            messages: true,
            followers: true,
            likes: true,
            comments: true,
            posts: true
        };
       
        modal.innerHTML = `<div class="modal" style="max-width: 400px;">
            <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
            <h2 style="margin-bottom: 16px; font-weight: 700;">🔔 Notification Preferences</h2>
           
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">💬 New Messages</div>
                    <input type="checkbox" id="notif-messages" ${notifSettings.messages ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">👥 New Followers</div>
                    <input type="checkbox" id="notif-followers" ${notifSettings.followers ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">❤️ Likes</div>
                    <input type="checkbox" id="notif-likes" ${notifSettings.likes ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">💬 Comments</div>
                    <input type="checkbox" id="notif-comments" ${notifSettings.comments ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 600;">📝 New Posts</div>
                    <input type="checkbox" id="notif-posts" ${notifSettings.posts ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
            </div>

            <div style="background: rgba(0, 212, 170, 0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.85rem; color: var(--text-light);">
                ✓ Notifications enabled! You will receive updates for your selected preferences.
            </div>

            <button class="btn-submit" style="width: 100%;" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>`;
        document.body.appendChild(modal);
    },

    updateNotificationSettings: function() {
        var settings = {
            messages: document.getElementById('notif-messages').checked,
            followers: document.getElementById('notif-followers').checked,
            likes: document.getElementById('notif-likes').checked,
            comments: document.getElementById('notif-comments').checked,
            posts: document.getElementById('notif-posts').checked
        };
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
        this.toast('Notification preferences updated ✓', 'success');
    },

    // ============================================
    // PHASE 2: GROUPS FEATURE
    // ============================================

    groups: {},
    userGroups: [],
    currentGroup: null,

    loadGroups: function() {
        if (!this.user || this.isGuest) return;
        
        var self = this;
        console.log('📁 Loading groups...');
        
        db.ref('groups').on('value', snapshot => {
            self.groups = snapshot.val() || {};
            console.log('✅ Groups loaded:', Object.keys(self.groups).length);
            
            self.userGroups = [];
            for (var groupId in self.groups) {
                var group = self.groups[groupId];
                if (group.members && group.members[self.user.uid]) {
                    self.userGroups.push({
                        id: groupId,
                        name: group.name,
                        photo: group.photo,
                        memberCount: Object.keys(group.members || {}).length
                    });
                }
            }
            
            console.log('👥 User is in', self.userGroups.length, 'groups');
            
            if (document.getElementById('groupsView') && 
                document.getElementById('groupsView').classList.contains('active')) {
                self.renderGroups();
            }
        });
    },

    renderGroups: function() {
        console.log('🎨 Rendering groups view...');
        
        var html = `
            <div class="groups-header" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: white; border-bottom: 1px solid #eee;">
                <h2 style="margin: 0;">My Groups</h2>
                <button class="btn-primary" onclick="app.showCreateGroupModal()" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">+ Create Group</button>
            </div>
            
            <div class="groups-list" style="padding: 16px;">
        `;
        
        if (this.userGroups.length === 0) {
            html += `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 12px;">👥</div>
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--text);">No Groups Yet</div>
                    <div style="color: #6b7280; margin-bottom: 20px;">Join or create a group to connect</div>
                    <button class="btn-primary" onclick="app.showCreateGroupModal()" style="padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Create Your First Group</button>
                </div>
            `;
        } else {
            this.userGroups.forEach(group => {
                html += `
                    <div class="group-card" onclick="app.openGroup('${group.id}')" style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 12px; margin-bottom: 12px; cursor: pointer; border: 1px solid #eee; transition: 0.2s;">
                        <div class="group-photo" style="width: 50px; height: 50px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px; font-size: 20px;">
                            ${group.name.charAt(0)}
                        </div>
                        <div class="group-info" style="flex: 1;">
                            <div class="group-name" style="font-weight: 600;">${group.name}</div>
                            <div class="group-members" style="font-size: 12px; color: #6b7280;">${group.memberCount} members</div>
                        </div>
                        <div class="group-arrow" style="color: #9ca3af;">→</div>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        
        var groupsView = document.getElementById('groupsView');
        if (groupsView) {
            groupsView.innerHTML = html;
        }
    },

    showCreateGroupModal: function() {
        console.log('📝 Opening create group modal...');
        
        var modalHTML = `
            <div class="modal-overlay" id="createGroupModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); align-items: center; justify-content: center; z-index: 9999;">
                <div class="modal-box" style="max-width: 500px; width: 90%; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #eee;">
                        <h3 style="margin: 0;">Create Group</h3>
                        <button onclick="document.getElementById('createGroupModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
                    </div>
                    
                    <div style="padding: 16px;">
                        <input type="text" id="groupName" placeholder="Group name" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; font-size: 16px; box-sizing: border-box;">
                        
                        <textarea id="groupDescription" placeholder="Group description" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; font-size: 16px; min-height: 80px; box-sizing: border-box;"></textarea>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Group Type</label>
                            <label style="display: flex; align-items: center; margin-bottom: 8px;">
                                <input type="radio" name="groupType" value="public" checked style="margin-right: 8px;"> Public (Anyone can join)
                            </label>
                            <label style="display: flex; align-items: center;">
                                <input type="radio" name="groupType" value="private" style="margin-right: 8px;"> Private (Invite only)
                            </label>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: flex-end; padding: 16px; border-top: 1px solid #eee;">
                        <button onclick="document.getElementById('createGroupModal').remove()" style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; background: white;">Cancel</button>
                        <button onclick="app.createGroup()" style="padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Create</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    createGroup: function() {
        var name = document.getElementById('groupName').value.trim();
        var description = document.getElementById('groupDescription').value.trim();
        var typeRadio = document.querySelector('input[name="groupType"]:checked');
        
        if (!name) {
            this.toast('Enter group name', 'error');
            return;
        }
        
        if (!typeRadio) {
            this.toast('Select group type', 'error');
            return;
        }
        
        var type = typeRadio.value;
        
        console.log('📝 Creating group:', name, type);
        console.log('✅ User UID:', this.user.uid);
        console.log('✅ Firebase DB:', typeof db !== 'undefined');
        
        if (!this.user || !this.user.uid) {
            this.toast('You must be logged in', 'error');
            return;
        }
        
        var self = this;
        var groupId = db.ref('groups').push().key;
        console.log('📝 Group ID:', groupId);
        
        var groupData = {
            name: name,
            description: description,
            type: type,
            photo: '',
            createdBy: self.user.uid,
            members: {},
            posts: {},
            createdAt: new Date().toLocaleString('en-KE'),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        // Add current user as member
        groupData.members[self.user.uid] = true;
        
        console.log('📤 Sending group data:', groupData);
        
        db.ref('groups/' + groupId).set(groupData)
            .then(() => {
                console.log('✅ Group created successfully:', groupId);
                self.toast('✅ Group created! 🎉', 'success');
                
                // Close modal
                var modal = document.getElementById('createGroupModal');
                if (modal) {
                    modal.remove();
                }
                
                // Reload groups
                self.groups[groupId] = groupData;
                self.renderGroups();
            })
            .catch(err => {
                console.error('❌ Error creating group:', err);
                console.error('Error code:', err.code);
                console.error('Error message:', err.message);
                self.toast('❌ Error: ' + err.message, 'error');
            });
    },

    openGroup: function(groupId) {
        console.log('📂 Opening group:', groupId);
        
        this.currentGroup = this.groups[groupId];
        if (!this.currentGroup) {
            this.toast('Group not found', 'error');
            return;
        }
        
        var memberCount = Object.keys(this.currentGroup.members || {}).length;
        
        var html = `
            <div style="padding: 16px; background: white; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 12px;">
                <button onclick="app.renderGroups(); app.switchView('groups')" style="background: none; border: none; font-size: 24px; cursor: pointer;">←</button>
                <div>
                    <h2 style="margin: 0;">${this.currentGroup.name}</h2>
                    <div style="color: #6b7280; font-size: 14px;">👥 ${memberCount} members</div>
                </div>
            </div>
            
            <div style="padding: 16px; background: white; margin-bottom: 16px;">
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="font-size: 48px; margin-bottom: 12px;">👥</div>
                    <div style="font-size: 18px; font-weight: 600;">${this.currentGroup.name}</div>
                    <div style="color: #6b7280; margin-bottom: 12px;">${this.currentGroup.description || 'No description'}</div>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button onclick="app.toast('Coming soon', 'info')" class="btn-primary" style="flex: 1; padding: 10px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">📧 Invite</button>
                    <button onclick="app.showGroupMembers('${groupId}')" class="btn-secondary" style="flex: 1; padding: 10px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">👥 Members</button>
                </div>
            </div>
            
            <div class="group-posts" id="groupPosts">
                <!-- Group posts will load here -->
            </div>
        `;
        
        var groupView = document.getElementById('groupsView');
        if (groupView) {
            groupView.innerHTML = html;
            this.loadGroupPosts(groupId);
        }
    },

    loadGroupPosts: function(groupId) {
        var self = this;
        db.ref('posts').orderByChild('timestamp').on('value', snapshot => {
            var postsHtml = '';
            
            snapshot.forEach(postSnapshot => {
                var post = postSnapshot.val();
                post.id = postSnapshot.key;
                
                if (post.groupId === groupId) {
                    var likes = (post.likes && Object.keys(post.likes).length) || 0;
                    postsHtml += `
                        <div class="post" id="post-${post.id}" style="background: white; border-radius: 12px; margin-bottom: 16px; overflow: hidden; border: 1px solid #eee;">
                            <div class="post-header" style="padding: 12px 16px; border-bottom: 1px solid #eee;">
                                <div style="display: flex; align-items: center;">
                                    <div class="post-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px;">${!post.userPhoto ? post.userName.charAt(0) : ''}</div>
                                    <div>
                                        <div class="post-name" style="font-weight: 600;">${post.userName}</div>
                                        <div class="post-time" style="font-size: 12px; color: #6b7280;">${post.createdAt}</div>
                                    </div>
                                </div>
                            </div>
                            <img src="${post.photoUrl}" class="post-image" style="width: 100%; display: block;">
                            <div style="padding: 12px 16px;">
                                <div class="post-caption" style="margin-bottom: 8px;">${post.caption}</div>
                                <div class="post-stats" style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">${likes} likes</div>
                                <div class="post-actions" style="display: flex; gap: 12px;">
                                    <button class="post-action" onclick="app.likePost('${post.id}')" style="flex: 1; padding: 8px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer;">❤️ Like</button>
                                    <button class="post-action" onclick="app.toast('Coming soon', 'info')" style="flex: 1; padding: 8px; background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer;">💬 Comment</button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });
            
            if (postsHtml === '') {
                postsHtml = '<div style="text-align: center; padding: 40px; color: #6b7280;">No posts yet. Be the first to post!</div>';
            }
            
            var groupPosts = document.getElementById('groupPosts');
            if (groupPosts) {
                groupPosts.innerHTML = postsHtml;
            }
        });
    },

    showGroupMembers: function(groupId) {
        console.log('👥 Showing group members...');
        
        var group = this.groups[groupId];
        if (!group || !group.members) return;
        
        var membersHtml = '<div style="padding: 20px;"><h3>Group Members</h3><div style="margin-top: 16px;">';
        
        for (var uid in group.members) {
            var member = this.users[uid];
            if (member) {
                membersHtml += `
                    <div style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px;">
                            ${member.name.charAt(0)}
                        </div>
                        <div>
                            <div style="font-weight: 600;">${member.name}</div>
                            <div style="font-size: 12px; color: #6b7280;">${member.email}</div>
                        </div>
                    </div>
                `;
            }
        }
        
        membersHtml += '</div></div>';
        
        var modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); align-items: center; justify-content: center; z-index: 9999;';
        modal.innerHTML = `
            <div class="modal-box" style="max-width: 500px; width: 90%; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); position: relative; max-height: 80vh; overflow-y: auto;">
                <button onclick="this.closest('.modal-overlay').remove()" style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 24px; cursor: pointer; z-index: 10;">✕</button>
                ${membersHtml}
            </div>
        `;
        document.body.appendChild(modal);
    },

    // ============================================
    // PHASE 2: TYPING INDICATORS
    // ============================================

    typingTimeout: null,
    isTyping: false,
    currentChatUid: null,

    startTyping: function(chatUid) {
        if (!this.user || !chatUid) return;
        
        var self = this;
        var chatKey = [this.user.uid, chatUid].sort().join('_');
        
        if (this.isTyping) return;
        
        this.isTyping = true;
        console.log('✏️ User started typing...');
        
        db.ref('messages/' + chatKey + '/typing/' + this.user.uid).set({
            typing: true,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.typingTimeout = setTimeout(() => {
            self.stopTyping(chatUid);
        }, 2000);
    },

    stopTyping: function(chatUid) {
        if (!this.user || !chatUid) return;
        
        var chatKey = [this.user.uid, chatUid].sort().join('_');
        
        console.log('⏸️ User stopped typing');
        
        db.ref('messages/' + chatKey + '/typing/' + this.user.uid).remove();
        this.isTyping = false;
    },

    listenForTyping: function(chatUid) {
        if (!this.user || !chatUid) return;
        
        var self = this;
        var chatKey = [this.user.uid, chatUid].sort().join('_');
        
        db.ref('messages/' + chatKey + '/typing').on('value', snapshot => {
            var typingUsers = [];
            
            if (snapshot.val()) {
                for (var uid in snapshot.val()) {
                    if (uid !== self.user.uid) {
                        var typingData = snapshot.val()[uid];
                        var timeSinceTyping = Date.now() - (typingData.timestamp || 0);
                        
                        if (timeSinceTyping < 3000) {
                            var user = self.users[uid];
                            if (user) {
                                typingUsers.push(user.name);
                            }
                        }
                    }
                }
            }
            
            var typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                if (typingUsers.length > 0) {
                    var names = typingUsers.slice(0, 2).join(', ');
                    if (typingUsers.length > 2) {
                        names += ' +' + (typingUsers.length - 2);
                    }
                    typingIndicator.innerHTML = `<div style="color: #6b7280; font-size: 14px; font-style: italic; padding: 8px;">${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing...</div>`;
                    typingIndicator.style.display = 'block';
                } else {
                    typingIndicator.style.display = 'none';
                }
            }
        });
    },

    stopListeningForTyping: function(chatUid) {
        if (!this.user || !chatUid) return;
        
        var chatKey = [this.user.uid, chatUid].sort().join('_');
        db.ref('messages/' + chatKey + '/typing').off();
    },

    onChatInputChange: function(event, chatUid) {
        if (event.target.value.length > 0) {
            this.startTyping(chatUid);
        } else {
            this.stopTyping(chatUid);
        }
    },

    setupTypingCleanup: function() {
        if (!this.user) return;
        var userTypingRef = db.ref('.info/connected');
        userTypingRef.on('value', snapshot => {
            if (snapshot.val() === false) {
                console.log('⚠️ User going offline');
            }
        });
    },

    // ============================================
    // PHASE 2: ADVANCED SEARCH
    // ============================================

    searchHistory: [],
    searchResults: [],

    showAdvancedSearch: function() {
        console.log('🔍 Opening advanced search...');
        
        var modalHTML = `
            <div class="search-modal-overlay" id="advancedSearchModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); align-items: center; justify-content: center; z-index: 9999;">
                <div class="search-modal-box" style="max-width: 600px; width: 90%; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-height: 80vh; overflow-y: auto;">
                    <div class="search-modal-header" style="padding: 12px 16px; border-bottom: 1px solid #eee; display: flex; gap: 8px;">
                        <input 
                            type="text" 
                            class="search-box-input" 
                            id="advSearchQuery" 
                            placeholder="Search users, hashtags, locations..." 
                            oninput="app.performAdvancedSearch()"
                            autofocus
                            style="flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;"
                        >
                        <button class="search-modal-close" onclick="document.getElementById('advancedSearchModal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6b7280;">✕</button>
                    </div>
                    
                    <div style="padding: 16px;">
                        <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                            <button onclick="app.performAdvancedSearch()" class="search-filter-btn active" data-filter="all" style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 12px;">All</button>
                            <button onclick="app.performAdvancedSearch()" class="search-filter-btn" data-filter="users" style="background: #f3f4f6; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 12px;">Users</button>
                            <button onclick="app.performAdvancedSearch()" class="search-filter-btn" data-filter="hashtags" style="background: #f3f4f6; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 12px;">Hashtags</button>
                        </div>
                        
                        <div id="searchHistorySection" style="margin-bottom: 16px; display: none;">
                            <div style="font-weight: 600; margin-bottom: 8px;">🕐 Recent Searches</div>
                            <div id="searchHistoryList" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
                        </div>
                        
                        <div id="searchResults" style="min-height: 200px;">
                            <div style="text-align: center; color: #6b7280; padding: 20px;">Start searching...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.renderSearchHistory();
    },

    performAdvancedSearch: function() {
        var query = document.getElementById('advSearchQuery').value.trim().toLowerCase();
        
        if (!query || query.length < 2) {
            document.getElementById('searchResults').innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">Type to search...</div>';
            return;
        }
        
        console.log('🔎 Searching for:', query);
        
        var results = [];
        
        for (var uid in this.users) {
            var user = this.users[uid];
            var userPosts = this.posts.filter(p => p.userId === uid).length;
            var followers = user.followers || 0;
            
            if (user.name.toLowerCase().includes(query) || 
                user.email.toLowerCase().includes(query) ||
                (user.bio && user.bio.toLowerCase().includes(query))) {
                
                results.push({
                    type: 'user',
                    id: uid,
                    name: user.name,
                    email: user.email,
                    photo: user.profilePhoto,
                    followers: followers,
                    posts: userPosts,
                    isFollowing: this.following[uid] || false
                });
            }
        }
        
        var hashtagMatches = new Set();
        this.posts.forEach(post => {
            if (post.hashtags) {
                post.hashtags.forEach(tag => {
                    if (tag.toLowerCase().includes(query)) {
                        hashtagMatches.add(tag);
                    }
                });
            }
        });
        
        hashtagMatches.forEach(tag => {
            var count = this.posts.filter(p => p.hashtags && p.hashtags.includes(tag)).length;
            results.push({
                type: 'hashtag',
                name: tag,
                count: count
            });
        });
        
        this.searchResults = results;
        this.renderSearchResults(results);
        this.addSearchHistory(query);
    },

    renderSearchResults: function(results) {
        if (results.length === 0) {
            document.getElementById('searchResults').innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">No results found</div>';
            return;
        }
        
        var html = '';
        
        results.forEach(result => {
            if (result.type === 'user') {
                html += `
                    <div style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="app.switchView('feed')">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px;">
                            ${result.name.charAt(0)}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${result.name}</div>
                            <div style="font-size: 12px; color: #6b7280;">${result.followers} followers • ${result.posts} posts</div>
                        </div>
                        <button onclick="event.stopPropagation(); app.followUser('${result.id}')" style="background: ${result.isFollowing ? '#e5e7eb' : 'var(--primary)'}; color: ${result.isFollowing ? '#374151' : 'white'}; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 600;">
                            ${result.isFollowing ? 'Following' : 'Follow'}
                        </button>
                    </div>
                `;
            } else if (result.type === 'hashtag') {
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="app.toast('View hashtag posts coming soon', 'info')">
                        <div>
                            <div style="font-weight: 600;">${result.name}</div>
                            <div style="font-size: 12px; color: #6b7280;">${result.count} posts</div>
                        </div>
                        <div style="color: #9ca3af;">→</div>
                    </div>
                `;
            }
        });
        
        document.getElementById('searchResults').innerHTML = html;
    },

    addSearchHistory: function(query) {
        this.searchHistory = this.searchHistory.filter(q => q !== query);
        this.searchHistory.unshift(query);
        this.searchHistory = this.searchHistory.slice(0, 10);
        localStorage.setItem('chichi-search-history', JSON.stringify(this.searchHistory));
    },

    renderSearchHistory: function() {
        var history = JSON.parse(localStorage.getItem('chichi-search-history')) || [];
        
        if (history.length === 0) {
            document.getElementById('searchHistorySection').style.display = 'none';
            return;
        }
        
        document.getElementById('searchHistorySection').style.display = 'block';
        
        var html = '';
        history.slice(0, 5).forEach(query => {
            html += `
                <button onclick="document.getElementById('advSearchQuery').value='${query}'; app.performAdvancedSearch()" style="background: #f3f4f6; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-size: 12px;">
                    ${query}
                </button>
            `;
        });
        
        document.getElementById('searchHistoryList').innerHTML = html;
    },

    // ============================================
    // PHASE 2: TRENDING HASHTAGS
    // ============================================

    trendingHashtags: [],

    calculateTrendingHashtags: function() {
        console.log('📈 Calculating trending hashtags...');
        
        var hashtagCount = {};
        var now = new Date();
        var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        this.posts.forEach(post => {
            var postDate = new Date(post.timestamp || post.createdAt);
            if (postDate >= weekAgo) {
                if (post.hashtags) {
                    post.hashtags.forEach(tag => {
                        hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
                    });
                }
            }
        });
        
        this.trendingHashtags = Object.keys(hashtagCount)
            .map(tag => ({
                name: tag,
                count: hashtagCount[tag],
                posts: this.posts.filter(p => p.hashtags && p.hashtags.includes(tag)).length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);
        
        console.log('✅ Trending hashtags calculated:', this.trendingHashtags.length);
    },

    renderTrendingInExplore: function() {
        if (this.trendingHashtags.length === 0) {
            this.calculateTrendingHashtags();
        }
        
        // CHECK: If trending section already exists, don't add duplicate
        if (document.getElementById('trendingSection')) {
            this.renderTrendingList();
            return;
        }
        
        var html = `
            <div id="trendingSection" style="padding: 16px; border-bottom: 1px solid #f0f0f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 700;">🔥 Trending Now</h3>
                    <button onclick="app.calculateTrendingHashtags(); app.renderTrendingList();" style="background: var(--primary); color: white; border: none; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 600;">Refresh</button>
                </div>
                
                <div id="trendingList" style="display: grid; gap: 12px;"></div>
            </div>
        `;
        
        var exploreView = document.getElementById('exploreView');
        if (exploreView) {
            exploreView.insertAdjacentHTML('afterbegin', html);
            this.renderTrendingList();
        }
    },

    renderTrendingList: function() {
        if (this.trendingHashtags.length === 0) {
            this.calculateTrendingHashtags();
            return;
        }
        
        var html = '';
        
        this.trendingHashtags.forEach((trend, index) => {
            var rankEmoji = ['🥇', '🥈', '🥉'][index] || '•';
            
            html += `
                <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 12px; cursor: pointer; transition: 0.2s; border: 1px solid #eee;" onclick="app.toast('View hashtag posts coming soon', 'info')" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                    <div style="font-size: 20px; margin-right: 12px; width: 30px; text-align: center;">
                        ${rankEmoji}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--primary);">${trend.name}</div>
                        <div style="font-size: 12px; color: #6b7280;">${trend.posts} posts • ${trend.count} mentions</div>
                    </div>
                    <div style="color: #9ca3af; font-size: 18px;">→</div>
                </div>
            `;
        });
        
        var trendingList = document.getElementById('trendingList');
        if (trendingList) {
            trendingList.innerHTML = html;
        }
    },

    setupTrendingRefresh: function() {
        var self = this;
        
        this.calculateTrendingHashtags();
        
        setInterval(() => {
            console.log('🔄 Auto-refreshing trending hashtags...');
            self.calculateTrendingHashtags();
            if (document.getElementById('trendingList')) {
                self.renderTrendingList();
            }
        }, 60 * 60 * 1000);
    }

};

app.init();

// Ensure auth page is visible initially (fallback if auth state is slow)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        var authPage = document.getElementById('authPage');
        var mainApp = document.getElementById('mainApp');
        if (authPage && mainApp.style.display === 'none' && authPage.style.display === 'none') {
            authPage.style.display = 'flex';
            var loading = document.getElementById('loadingScreen');
            if (loading) loading.style.display = 'none';
        }
    }, 2000);
});

// DEBUG CONSOLE - Check modal scrolling issues
window.debugModal = function() {
    console.clear();
    console.log('%c=== CHICHI MODAL DEBUG CONSOLE ===', 'color: #00D4AA; font-size: 16px; font-weight: bold;');
   
    // Check all modals
    var modals = document.querySelectorAll('.modal');
    var overlays = document.querySelectorAll('.modal-overlay.active');
   
    console.log('%c📊 MODAL COUNT:', 'color: #0099ff; font-weight: bold;');
    console.log('Total modals found:', modals.length);
    console.log('Active overlays:', overlays.length);
   
    // Check each modal
    modals.forEach((modal, index) => {
        var overlay = modal.closest('.modal-overlay');
        var isActive = overlay && overlay.classList.contains('active');
       
        console.log(`%c📍 Modal ${index + 1} (${isActive ? '✅ ACTIVE' : '❌ INACTIVE'})`, 'color: ' + (isActive ? '#22c55e' : '#ff4444') + '; font-weight: bold;');
        console.log('Height:', modal.offsetHeight + 'px');
        console.log('Scroll Height:', modal.scrollHeight + 'px');
        console.log('Scroll Top:', modal.scrollTop);
        console.log('Max Height:', window.getComputedStyle(modal).maxHeight);
        console.log('Overflow-Y:', window.getComputedStyle(modal).overflowY);
        console.log('Overflow-X:', window.getComputedStyle(modal).overflowX);
       
        if (modal.scrollHeight > modal.offsetHeight) {
            console.log('%c✅ SCROLLABLE (Content taller than container)', 'color: #22c55e; font-weight: bold;');
        } else {
            console.log('%c❌ NOT SCROLLABLE (Content fits in container)', 'color: #ff4444; font-weight: bold;');
        }
       
        console.group('Styles:');
        console.log('Display:', window.getComputedStyle(modal).display);
        console.log('Position:', window.getComputedStyle(modal).position);
        console.log('Width:', window.getComputedStyle(modal).width);
        console.groupEnd();
    });
   
    // Check create-modal
    var createModals = document.querySelectorAll('.create-modal');
    if (createModals.length > 0) {
        console.log('%c📝 CREATE-MODAL', 'color: #fbbf24; font-weight: bold;');
        createModals.forEach((modal, index) => {
            console.log(`Modal ${index + 1}:`);
            console.log('Height:', modal.offsetHeight + 'px');
            console.log('Scroll Height:', modal.scrollHeight + 'px');
            console.log('Overflow-Y:', window.getComputedStyle(modal).overflowY);
        });
    }
   
    console.log('%c💡 TIP: If content is NOT taller than container, it won\'t scroll!', 'color: #ff9800; font-weight: bold;');
    console.log('%c🔧 SOLUTIONS:', 'color: #00D4AA; font-weight: bold;');
    console.log('1. Make sure modal has max-height (85vh)');
    console.log('2. Make sure content is taller than modal');
    console.log('3. Check overflow-y is "scroll" or "auto"');
    console.log('4. Run debugModal() after opening a modal');
};

// Debug panel - Shows info in UI
window.showDebugPanel = function() {
    var panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        max-height: 400px;
        background: #1f2937;
        color: #fff;
        border: 2px solid #00D4AA;
        border-radius: 12px;
        padding: 16px;
        font-size: 12px;
        font-family: monospace;
        z-index: 9999;
        overflow-y: auto;
        line-height: 1.6;
    `;
   
    var modals = document.querySelectorAll('.modal');
    var info = '<strong>🔍 MODAL DEBUG INFO</strong><br>';
   
    modals.forEach((m, i) => {
        var overlay = m.closest('.modal-overlay');
        var isActive = overlay && overlay.classList.contains('active');
        info += `<br>📍 Modal ${i + 1} (${isActive ? '✅' : '❌'})<br>`;
        info += `Height: ${m.offsetHeight}px<br>`;
        info += `Scroll Height: ${m.scrollHeight}px<br>`;
        info += `Overflow-Y: ${window.getComputedStyle(m).overflowY}<br>`;
        info += `Scrollable: ${m.scrollHeight > m.offsetHeight ? '✅ YES' : '❌ NO'}<br>`;
    });
   
    info += '<br><button onclick="debugModal()" style="width:100%;padding:8px;background:#00D4AA;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Run debugModal()</button>';
    info += '<button onclick="document.getElementById(\'debugPanel\').remove()" style="width:100%;padding:8px;background:#ff4444;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-top:8px;">Close</button>';
   
    panel.innerHTML = info;
    document.body.appendChild(panel);
};

// Test modal scrolling
window.testScrolling = function() {
    console.clear();
    console.log('%c🧪 TESTING SCROLLING...', 'color: #00D4AA; font-size: 16px; font-weight: bold;');
   
    // Try scrolling on active modal
    var activeModal = document.querySelector('.modal-overlay.active .modal');
    if (!activeModal) {
        console.log('%c❌ No active modal found!', 'color: #ff4444; font-weight: bold;');
        console.log('Open a modal first, then run testScrolling()');
        return;
    }
   
    console.log('%c✅ Found active modal', 'color: #22c55e; font-weight: bold;');
    console.log('Testing scroll...');
   
    // Try to scroll
    activeModal.scrollTop = 10;
    var scrolled = activeModal.scrollTop > 0;
   
    console.log(scrolled ? '%c✅ SCROLL WORKS!' : '%c❌ Scroll not working', scrolled ? 'color: #22c55e;' : 'color: #ff4444;', 'font-weight: bold;');
   
    console.log('%cDEBUG INFO:', 'color: #00D4AA; font-weight: bold;');
    console.log('offsetHeight:', activeModal.offsetHeight + 'px');
    console.log('scrollHeight:', activeModal.scrollHeight + 'px');
    console.log('Max Height:', window.getComputedStyle(activeModal).maxHeight);
    console.log('Overflow-Y:', window.getComputedStyle(activeModal).overflowY);
    console.log('Display:', window.getComputedStyle(activeModal).display);
   
    if (activeModal.scrollHeight <= activeModal.offsetHeight) {
        console.warn('%c⚠️ Content is NOT taller than container - nothing to scroll!', 'color: #ff9800; font-weight: bold;');
    }
};

// Debug commands available in console (hidden from startup)
// Uncomment to enable startup messages
// console.log('%c🎯 DEBUG COMMANDS:', 'color: #00D4AA; font-size: 14px; font-weight: bold;');
// console.log('testModal() - Create test modal with scroll content');
// console.log('simpleScrollTest() - ⭐ Ultra-simple scroll test (NO CSS classes!)');
// console.log('testActualScroll() - Test if scroll actually works');
// console.log('inspectDOM() - 🔍 Inspect modal in DOM (detailed)');
// console.log('forceShowModal() - 💪 Force show modal (last resort)');
// console.log('debugModal() - Log all modal info');
// console.log('');
// console.log('%cKeyboard Shortcuts:', 'color: #00D4AA; font-weight: bold;');
// console.log('Ctrl+Shift+D - Open debug panel');

// Keyboard shortcut: Ctrl+Shift+D to open debug panel
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        window.showDebugPanel();
        console.log('%c🎯 Debug panel opened! Press Ctrl+Shift+D again to close', 'color: #00D4AA; font-weight: bold;');
    }
});

// Test modal - Creates a test modal to verify styling works
window.testModal = function() {
    console.log('%c🧪 Creating test modal...', 'color: #00D4AA; font-weight: bold;');
   
    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
   
    modal.innerHTML = `<div style="
        background: white;
        width: 100%;
        max-width: 500px;
        border-radius: 28px 28px 0 0;
        padding: 20px;
        max-height: 85vh;
        overflow-y: scroll !important;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
    ">
        <h2 style="text-align: center; margin-bottom: 20px;">🧪 TEST MODAL</h2>
        <p style="margin-bottom: 16px;">This is a test modal to verify scrolling works!</p>
        <p style="margin-bottom: 16px;">If you can see this modal, the CSS is working!</p>
        <p style="margin-bottom: 16px;">Try scrolling down...</p>
       
        <div style="height: 200px; background: #f3f4f6; border-radius: 10px; padding: 16px; margin-bottom: 16px; text-align: center; display: flex; align-items: center; justify-content: center;">
            Content Block 1
        </div>
       
        <div style="height: 200px; background: #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; text-align: center; display: flex; align-items: center; justify-content: center;">
            Content Block 2
        </div>
       
        <div style="height: 200px; background: #d1d5db; border-radius: 10px; padding: 16px; margin-bottom: 16px; text-align: center; display: flex; align-items: center; justify-content: center;">
            Content Block 3
        </div>
       
        <div style="height: 200px; background: #9ca3af; border-radius: 10px; padding: 16px; margin-bottom: 16px; text-align: center; display: flex; align-items: center; justify-content: center; color: white;">
            Content Block 4
        </div>
       
        <button onclick="this.closest('.modal-overlay').remove(); console.log('%c✅ Test modal closed', 'color: #22c55e; font-weight: bold;');" style="
            width: 100%;
            padding: 12px;
            background: #00D4AA;
            color: white;
            border: none;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
            font-size: 1rem;
        ">Close Test Modal</button>
    </div>`;
   
    document.body.appendChild(modal);
   
    // Force inline styles AFTER DOM insertion
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '9999';
    modal.style.alignItems = 'flex-end';
    modal.style.justifyContent = 'center';
    modal.style.overflow = 'hidden';
   
    setTimeout(() => {
        console.log('%c✅ Test modal created and visible!', 'color: #22c55e; font-weight: bold;');
        var testModal = document.querySelector('.modal-overlay.active');
        if (testModal) {
            console.log('✅ Modal-overlay found and ACTIVE');
            console.log('Display:', window.getComputedStyle(testModal).display);
            console.log('Position:', window.getComputedStyle(testModal).position);
           
            var innerModal = testModal.querySelector('div');
            if (innerModal) {
                console.log('Inner modal found');
                console.log('Height:', innerModal.offsetHeight + 'px');
                console.log('Scroll Height:', innerModal.scrollHeight + 'px');
                if (innerModal.scrollHeight > innerModal.offsetHeight) {
                    console.log('%c✅ TEST MODAL IS SCROLLABLE!', 'color: #22c55e; font-weight: bold;');
                }
            }
        }
    }, 100);
};

// Ultra-simple scroll modal - NO CSS classes, pure inline styles
window.simpleScrollTest = function() {
    console.log('%c🚀 CREATING ULTRA-SIMPLE SCROLL TEST', 'color: #00D4AA; font-size: 16px; font-weight: bold; background: #e0f7f6; padding: 8px;');
   
    var overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 99999;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        font-family: Arial, sans-serif;
    `;
   
    var modal = document.createElement('div');
    modal.style.cssText = `
        width: 100%;
        max-width: 500px;
        height: 80vh;
        background: white;
        border-radius: 20px 20px 0 0;
        overflow-y: scroll;
        padding: 20px;
        box-sizing: border-box;
    `;
   
    // Add lots of content
    var content = '<h2 style="margin: 0 0 20px 0; text-align: center;">🧪 SCROLL TEST</h2>';
    for (let i = 1; i <= 20; i++) {
        content += `
            <div style="
                background: ${i % 2 === 0 ? '#f0f0f0' : '#e0e0e0'};
                padding: 20px;
                margin-bottom: 15px;
                border-radius: 10px;
                text-align: center;
                font-weight: bold;
                font-size: 18px;
            ">
                Content Block ${i}
            </div>
        `;
    }
    content += '<button onclick="this.closest(\'div\').parentElement.remove();" style="width: 100%; padding: 15px; background: #00D4AA; color: white; border: none; border-radius: 10px; font-weight: bold; font-size: 16px; cursor: pointer;">Close</button>';
   
    modal.innerHTML = content;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
   
    // Detailed logging
    setTimeout(() => {
        console.log('%c✅ SCROLL TEST MODAL CREATED', 'color: #22c55e; font-weight: bold;');
        console.log('Modal Height (viewport):', modal.offsetHeight + 'px');
        console.log('Modal Scroll Height (content):', modal.scrollHeight + 'px');
        console.log('Overflow-Y style:', modal.style.overflowY);
        console.log('Can scroll?', modal.scrollHeight > modal.offsetHeight ? '✅ YES' : '❌ NO');
        console.log('');
        console.log('%cNOW TRY SCROLLING THE MODAL!', 'color: #ff4444; font-weight: bold; font-size: 14px;');
        console.log('If you can scroll the content blocks up/down, scrolling works! ✓');
       
        // Add scroll listener to test
        modal.addEventListener('scroll', (e) => {
            console.log('%c📜 SCROLL EVENT DETECTED!', 'color: #ff9800; font-weight: bold;');
            console.log('Current scroll position:', e.target.scrollTop + 'px');
        });
    }, 100);
};

// Simple scroll test with actual scroll
window.testActualScroll = function() {
    console.log('%c🧪 TESTING ACTUAL SCROLL MOVEMENT', 'color: #00D4AA; font-weight: bold;');
   
    var modal = document.querySelector('.modal-overlay.active .modal');
    if (!modal) {
        console.log('%c❌ No active modal found!', 'color: #ff4444; font-weight: bold;');
        return;
    }
   
    console.log('Current scroll position:', modal.scrollTop);
   
    // Try to scroll
    modal.scrollTop = 100;
   
    setTimeout(() => {
        if (modal.scrollTop === 100) {
            console.log('%c✅ SCROLL WORKS! Modal scrolled to 100px', 'color: #22c55e; font-weight: bold; font-size: 16px;');
        } else {
            console.log('%c❌ Scroll NOT working. scrollTop is still:', modal.scrollTop, 'color: #ff4444; font-weight: bold;');
        }
    }, 50);
};
window.inspectDOM = function() {
    console.clear();
    console.log('%c🔍 DOM INSPECTION - CHECKING MODAL VISIBILITY', 'color: #ff4444; font-size: 16px; font-weight: bold; background: #ffe0e0; padding: 8px;');
   
    console.log('%cStep 1: Check if modal is in DOM', 'color: #00D4AA; font-weight: bold;');
    var allDivs = document.querySelectorAll('div');
    console.log('Total divs on page:', allDivs.length);
   
    var modalOverlays = document.querySelectorAll('.modal-overlay');
    console.log('Modals with class "modal-overlay":', modalOverlays.length);
   
    var activeOverlays = document.querySelectorAll('.modal-overlay.active');
    console.log('Modals with class "modal-overlay.active":', activeOverlays.length);
   
    console.log('%cStep 2: Check computed styles', 'color: #00D4AA; font-weight: bold;');
    activeOverlays.forEach((overlay, idx) => {
        console.group(`Active Overlay ${idx + 1}:`);
        var style = window.getComputedStyle(overlay);
        console.log('Display:', style.display, '(Expected: flex)');
        console.log('Position:', style.position, '(Expected: fixed)');
        console.log('Top:', style.top);
        console.log('Z-index:', style.zIndex);
        console.log('Visibility:', style.visibility);
        console.log('Opacity:', style.opacity);
        console.log('Width:', style.width);
        console.log('Height:', style.height);
        console.log('Background:', style.background);
        console.groupEnd();
       
        // Check inner modal
        var innerModal = overlay.querySelector('div');
        if (innerModal) {
            console.group(`Inner Modal Content:`);
            console.log('Height:', innerModal.offsetHeight + 'px');
            console.log('Scroll Height:', innerModal.scrollHeight + 'px');
            console.log('Overflow-Y:', window.getComputedStyle(innerModal).overflowY);
            console.log('Is Scrollable:', innerModal.scrollHeight > innerModal.offsetHeight);
            console.groupEnd();
        }
    });
   
    console.log('%cStep 3: Test visibility', 'color: #00D4AA; font-weight: bold;');
    if (activeOverlays.length > 0) {
        console.log('%c✅ Modal found in DOM!', 'color: #22c55e; font-weight: bold;');
        var overlay = activeOverlays[0];
        console.log('Is visible on page?', overlay.offsetHeight > 0 ? '✅ YES' : '❌ NO');
    } else {
        console.log('%c❌ NO ACTIVE MODAL FOUND IN DOM', 'color: #ff4444; font-weight: bold;');
        console.log('Try opening Edit Profile first, then run inspectDOM()');
    }
   
    console.log('%cStep 4: CSS Rules Check', 'color: #00D4AA; font-weight: bold;');
    var stylesheet = document.styleSheets[0];
    var foundRule = false;
    for (let i = 0; i < stylesheet.cssRules.length; i++) {
        if (stylesheet.cssRules[i].selectorText && stylesheet.cssRules[i].selectorText.includes('modal-overlay')) {
            console.log('Found CSS rule:', stylesheet.cssRules[i].selectorText);
            foundRule = true;
        }
    }
    if (!foundRule) console.log('Warning: Could not find modal-overlay CSS rules');
};

// Force show modal - Last resort
window.forceShowModal = function() {
    console.log('%c💪 FORCE SHOWING MODAL', 'color: #ff4444; font-weight: bold;');
    var overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach((overlay, idx) => {
        overlay.style.display = 'flex';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = '9999';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.alignItems = 'flex-end';
        overlay.style.justifyContent = 'center';
        overlay.style.overflow = 'hidden';
       
        var inner = overlay.querySelector('div');
        if (inner) {
            inner.style.display = 'block';
            inner.style.maxHeight = '85vh';
            inner.style.overflowY = 'scroll';
        }
       
        console.log(`✅ Modal ${idx + 1} forced visible!`);
    });
};

// Make it easy to access from browser console
console.log('%c✅ Type debugModal() in console to check modal scrolling!', 'color: #00D4AA; font-size: 14px; font-weight: bold;');

// Initialize theme on load
// ADDED: Hashtag Categories System
app.hashtagCategories = {
    interests: [
        '#Gaming', '#Photography', '#Music', '#Art', '#Writing', '#Sports',
        '#Fitness', '#Cooking', '#Travel', '#Fashion', '#Tech', '#Business',
        '#Entrepreneurship', '#Marketing', '#Design', '#Animation'
    ],
    location: [
        '#Nairobi', '#Mombasa', '#Kisumu', '#Nakuru', '#Eldoret', '#Kericho',
        '#Nyeri', '#Thika', '#Machakos', '#Kakamega', '#Bungoma', '#Isiolo'
    ],
    hobbies: [
        '#Fitness', '#Cooking', '#Travel', '#Fashion', '#Reading', '#Gaming',
        '#Photography', '#Gardening', '#DIY', '#Crafts', '#Pets', '#Hiking'
    ],
    contentTypes: [
        '#Vlog', '#Comedy', '#Tutorial', '#Podcast', '#Blog', '#News',
        '#Review', '#Motivation', '#Education', '#Entertainment', '#Lifestyle', '#Behind-the-scenes'
    ]
};

// ADDED: User hashtags storage
app.userHashtags = {};
app.userFollowNotifications = [];

// ADDED: Messaging system state
app.messageStates = {}; // Track message read/delete status
app.onlineUsers = {}; // Track online status
app.unreadCounts = {}; // Count unread per conversation
app.blockedUsers = {}; // Track blocked users
app.messageHistory = {}; // Cache message history

// Music system (loaded from config.js)
app.currentSongIndex = 0;
app.isShuffleEnabled = false;

// ADDED: Get random song index
app.getRandomSongIndex = function() {
    var randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * this.musicPlaylist.length);
    } while (randomIndex === this.currentSongIndex && this.musicPlaylist.length > 1);
    return randomIndex;
};

// ADDED: Play next song in shuffle mode
app.playNextSong = function() {
    if (this.isShuffleEnabled) {
        this.currentSongIndex = this.getRandomSongIndex();
    } else {
        this.currentSongIndex = (this.currentSongIndex + 1) % this.musicPlaylist.length;
    }
    this.playBackgroundMusic();
};

// Initialize music on startup
app.initMusic = function() {
    var musicEnabled = localStorage.getItem('chichi-music-enabled') === 'true';
    var toggle = document.getElementById('musicToggle');
    var toggleLabel = toggle ? toggle.parentElement : null;
   
    if (musicEnabled) {
        if (toggle) toggle.checked = true;
        this.playBackgroundMusic();
        // ADDED: Show playing animation on startup
        if (toggleLabel) toggleLabel.classList.add('playing');
    } else {
        if (toggle) toggle.checked = false;
        // ADDED: Remove animation if not playing
        if (toggleLabel) toggleLabel.classList.remove('playing');
    }
    
    // ADDED: Setup audio event listeners for song switching
    var audio = document.getElementById('themeMusic');
    if (audio) {
        audio.addEventListener('ended', () => {
            if (document.getElementById('musicToggle') && document.getElementById('musicToggle').checked) {
                this.playNextSong();
            }
        });
    }
};

// Toggle music on/off
app.toggleMusic = function() {
    var toggle = document.getElementById('musicToggle');
    var isEnabled = toggle.checked;
    var toggleLabel = toggle.parentElement; // Get the label element
   
    localStorage.setItem('chichi-music-enabled', isEnabled ? 'true' : 'false');
   
    if (isEnabled) {
        // ADDED: Enable shuffle mode
        this.isShuffleEnabled = true;
        this.currentSongIndex = 0;
        this.playBackgroundMusic();
        // ADDED: Add playing animation
        if (toggleLabel) toggleLabel.classList.add('playing');
        this.toast('🎵 Music ON - Shuffle Mode', 'success');
    } else {
        this.stopBackgroundMusic();
        // ADDED: Remove playing animation
        if (toggleLabel) toggleLabel.classList.remove('playing');
        this.toast('🔇 Music OFF', 'success');
    }
};

// Play background music with fade-in
app.playBackgroundMusic = function() {
    var audio = document.getElementById('themeMusic');
    if (!audio) return;
    
    // ADDED: Use playlist instead of stored URL
    var musicUrl = this.musicPlaylist[this.currentSongIndex];
   
    audio.src = musicUrl;
    audio.volume = 0;
    audio.loop = false; // ADDED: Don't loop, let ended event handle next song
   
    audio.play().then(() => {
        // Fade in effect
        var fadeIn = setInterval(() => {
            if (audio.volume < 0.3) {
                audio.volume += 0.05;
            } else {
                clearInterval(fadeIn);
            }
        }, 200);
    }).catch(err => {
        console.log('Could not play audio:', err);
    });
};

// Stop background music with fade-out
app.stopBackgroundMusic = function() {
    var audio = document.getElementById('themeMusic');
    var fadeOut = setInterval(() => {
        if (audio.volume > 0) {
            audio.volume -= 0.05;
        } else {
            audio.pause();
            audio.volume = 0;
            clearInterval(fadeOut);
        }
    }, 200);
};

// ADDED: Send message with metadata
app.sendMessage = function(recipientId, messageText) {
    if (!this.user || !messageText.trim()) return;
    
    var self = this;
    var chatKey = [this.user.uid, recipientId].sort().join('_');
    var messageId = 'msg_' + Date.now();
    var messageData = {
        id: messageId,
        senderId: this.user.uid,
        senderName: this.profile.name || 'User',
        senderPhoto: this.profile.profilePhoto || '',
        text: messageText,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        delivered: false,
        read: false,
        deleted: false,
        edited: false,
        editedAt: null
    };
    
    // Save message
    db.ref('messages/' + chatKey + '/' + messageId).set(messageData, err => {
        if (err) {
            self.toast('❌ Failed to send message', 'error');
        } else {
            self.toast('✓ Message sent', 'success');
            // Mark as delivered
            setTimeout(() => {
                db.ref('messages/' + chatKey + '/' + messageId + '/delivered').set(true);
            }, 500);
        }
    });
};

// ADDED: Mark message as read
app.markMessageAsRead = function(chatKey, messageId) {
    db.ref('messages/' + chatKey + '/' + messageId + '/read').set(true);
};

// ADDED: Delete message (only for me)
app.deleteMessage = function(chatKey, messageId) {
    if (!confirm('Delete this message?')) return;
    
    db.ref('messages/' + chatKey + '/' + messageId + '/deleted').set(true, err => {
        if (err) {
            app.toast('❌ Error deleting message', 'error');
        } else {
            app.toast('✅ Message deleted', 'success');
            app.loadMessages();
        }
    });
};

// ADDED: Edit message (within 30 seconds)
app.editMessage = function(chatKey, messageId, oldText, newText) {
    if (!newText.trim() || newText === oldText) return;
    
    db.ref('messages/' + chatKey + '/' + messageId).update({
        text: newText,
        edited: true,
        editedAt: firebase.database.ServerValue.TIMESTAMP
    }, err => {
        if (err) {
            app.toast('❌ Error editing message', 'error');
        } else {
            app.toast('✅ Message edited', 'success');
            app.loadMessages();
        }
    });
};

// ADDED: Block user
app.blockUser = function(userId) {
    if (!this.user) return;
    
    db.ref('users/' + this.user.uid + '/blocked/' + userId).set(true, err => {
        if (err) {
            app.toast('❌ Error blocking user', 'error');
        } else {
            app.toast('✅ User blocked', 'success');
            app.blockedUsers[userId] = true;
            app.loadMessages();
        }
    });
};

// ADDED: Unblock user
app.unblockUser = function(userId) {
    if (!this.user) return;
    
    db.ref('users/' + this.user.uid + '/blocked/' + userId).remove(err => {
        if (err) {
            app.toast('❌ Error unblocking user', 'error');
        } else {
            app.toast('✅ User unblocked', 'success');
            delete app.blockedUsers[userId];
            app.loadMessages();
        }
    });
};

// ADDED: Report user
app.reportUser = function(userId, userName, reason) {
    if (!this.user || !reason.trim()) {
        app.toast('⚠️ Please provide a reason', 'error');
        return;
    }
    
    db.ref('reports').push({
        reportedUserId: userId,
        reportedUserName: userName,
        reportedBy: this.user.uid,
        reportedByName: this.profile.name || 'User',
        reason: reason,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'pending'
    }, err => {
        if (err) {
            app.toast('❌ Error submitting report', 'error');
        } else {
            app.toast('✅ Report submitted to admin', 'success');
        }
    });
};

// ADDED: Load blocked users
app.loadBlockedUsers = function() {
    if (!this.user) return;
    
    db.ref('users/' + this.user.uid + '/blocked').once('value', snapshot => {
        if (snapshot.val()) {
            Object.keys(snapshot.val()).forEach(userId => {
                app.blockedUsers[userId] = true;
            });
        }
    });
};

// ADDED: Set online status
app.setOnlineStatus = function(isOnline) {
    if (!this.user) return;
    
    var statusData = {
        online: isOnline,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
    
    db.ref('userStatus/' + this.user.uid).set(statusData);
};

// ADDED: Load online status for user
app.loadOnlineStatus = function(userId, callback) {
    db.ref('userStatus/' + userId).once('value', snapshot => {
        if (snapshot.val()) {
            callback(snapshot.val());
        } else {
            callback({ online: false, lastSeen: null });
        }
    });
};

// ADDED: Send follow notification
app.sendFollowNotification = function(userId) {
    if (!this.user) return;
    
    db.ref('notifications/' + userId).push({
        type: 'follow',
        fromUserId: this.user.uid,
        fromUserName: this.profile.name || 'User',
        fromUserPhoto: this.profile.profilePhoto || '',
        message: this.profile.name + ' followed you',
        accepted: false,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
};

// ADDED: Accept follow notification
app.acceptFollowNotification = function(notificationId, fromUserId) {
    if (!this.user) return;
    
    // Add to followers
    db.ref('users/' + this.user.uid + '/followers/' + fromUserId).set(true);
    
    // Mark notification as accepted
    db.ref('notifications/' + this.user.uid + '/' + notificationId + '/accepted').set(true);
    
    app.toast('✅ Followed back!', 'success');
};

// ADDED: Show hashtag selection modal
app.showHashtagModal = function() {
    var modal = document.getElementById('hashtagModal');
    if (!modal) return;
    
    var container = document.getElementById('hashtagContainer');
    if (!container) return;
    
    var html = '';
    
    // Build hashtag selection HTML
    Object.keys(app.hashtagCategories).forEach(category => {
        html += `<div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 12px 0; text-transform: capitalize; color: #2E5BFF; font-size: 14px;">${category.replace(/([A-Z])/g, ' $1').trim()}</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px;">`;
        
        app.hashtagCategories[category].forEach(hashtag => {
            var isSelected = app.userHashtags[app.user.uid] && app.userHashtags[app.user.uid].includes(hashtag);
            html += `
                <label style="display: flex; align-items: center; padding: 8px 12px; background: ${isSelected ? 'linear-gradient(135deg, #2E5BFF, #0088cc)' : '#f3f4f6'}; color: ${isSelected ? 'white' : '#374151'}; border-radius: 8px; cursor: pointer; transition: all 0.3s; font-size: 14px; font-weight: 500;">
                    <input type="checkbox" value="${hashtag}" class="hashtag-checkbox" style="margin-right: 8px;" ${isSelected ? 'checked' : ''}>
                    ${hashtag}
                </label>
            `;
        });
        
        html += `</div></div>`;
    });
    
    container.innerHTML = html;
    modal.style.display = 'flex';
};

// ADDED: Save selected hashtags
app.saveHashtags = function() {
    var checkboxes = document.querySelectorAll('.hashtag-checkbox:checked');
    var selectedHashtags = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedHashtags.length < 3) {
        app.toast('⚠️ Please select at least 3 interests', 'error');
        return;
    }
    
    if (selectedHashtags.length > 5) {
        app.toast('⚠️ Maximum 5 interests allowed', 'error');
        return;
    }
    
    // Save to Firebase
    if (!this.user) return;
    
    db.ref('users/' + this.user.uid + '/hashtags').set(selectedHashtags, err => {
        if (err) {
            app.toast('❌ Error saving interests', 'error');
        } else {
            // Save locally
            app.userHashtags[this.user.uid] = selectedHashtags;
            app.toast('✅ Interests saved!', 'success');
            setTimeout(() => {
                var modal = document.getElementById('hashtagModal');
                if (modal) modal.style.display = 'none';
            }, 500);
        }
    });
};

// ADDED: Skip hashtag selection
app.skipHashtags = function() {
    var modal = document.getElementById('hashtagModal');
    if (modal) modal.style.display = 'none';
};

// ADDED: Load user hashtags from Firebase
app.loadUserHashtags = function(uid) {
    db.ref('users/' + uid + '/hashtags').once('value', snapshot => {
        if (snapshot.val()) {
            app.userHashtags[uid] = snapshot.val();
        }
    });
};

// ADDED: Update user hashtags
app.updateUserHashtags = function(hashtags) {
    if (!this.user) return;
    
    db.ref('users/' + this.user.uid + '/hashtags').set(hashtags, err => {
        if (err) {
            app.toast('❌ Error updating interests', 'error');
        } else {
            app.userHashtags[this.user.uid] = hashtags;
            app.toast('✅ Interests updated!', 'success');
        }
    });
};

// ═════════════════════════════════════════════════════════════════════════
// SIGNUP HEATMAP - World Map with Blinking Lights
// ═════════════════════════════════════════════════════════════════════════

app.loadSignupHeatmap = function() {
    console.log('🗺️ Loading signup heatmap...');
    
    var mapContainer = document.getElementById('signupMapContainer');
    if (!mapContainer) {
        console.error('Heatmap container not found!');
        return;
    }
    
    // CRITICAL: Simple working HTML structure
    mapContainer.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; background: linear-gradient(135deg, #0f1419 0%, #1a202c 100%); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
            
            <!-- Map area (70% of height) -->
            <div style="position: relative; flex: 1; overflow: hidden;">
                <!-- World Map Background SVG -->
                <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.1;" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice">
                    <rect width="1000" height="500" fill="none"/>
                    <g stroke="#00D4FF" stroke-width="1" fill="none">
                        <circle cx="80" cy="150" r="50"/>
                        <circle cx="350" cy="120" r="45"/>
                        <circle cx="650" cy="100" r="60"/>
                        <circle cx="850" cy="150" r="50"/>
                        <circle cx="900" cy="380" r="40"/>
                    </g>
                </svg>
                
                <!-- Dots Layer -->
                <div id="heatmapDots" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
            </div>
            
            <!-- Signups List (30% of height) -->
            <div style="background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.4)); padding: 12px 16px; border-top: 1px solid rgba(0,212,255,0.2); max-height: 30%; overflow-y: auto;">
                <div style="color: #00D4FF; font-size: 11px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">📍 Recent Signups</div>
                <div id="heatmapSignups" style="display: flex; flex-direction: column; gap: 6px;"></div>
            </div>
        </div>
    `;
    
    // Render immediately
    setTimeout(() => {
        app.renderHeatmapDots();
    }, 100);
    
    // Setup real-time listener
    if (!app.heatmapListenerSetup) {
        app.setupHeatmapListener();
        app.heatmapListenerSetup = true;
    }
};

app.getLocationCoordinates = function(location) {
    var locations = {
        'New York': { x: 12, y: 25 },
        'London': { x: 42, y: 18 },
        'Paris': { x: 43, y: 17 },
        'Berlin': { x: 48, y: 16 },
        'Moscow': { x: 58, y: 12 },
        'Istanbul': { x: 52, y: 28 },
        'Dubai': { x: 62, y: 35 },
        'Mumbai': { x: 68, y: 38 },
        'Bangkok': { x: 75, y: 42 },
        'Singapore': { x: 78, y: 48 },
        'Hong Kong': { x: 82, y: 38 },
        'Tokyo': { x: 88, y: 28 },
        'Sydney': { x: 85, y: 72 },
        'Nairobi': { x: 58, y: 55 },
        'Lagos': { x: 48, y: 58 },
        'Cairo': { x: 55, y: 42 },
        'São Paulo': { x: 28, y: 62 },
        'Mexico City': { x: 18, y: 48 },
        'Los Angeles': { x: 8, y: 32 },
        'Toronto': { x: 18, y: 20 }
    };
    
    return locations[location] || { x: 50 + (Math.random() - 0.5) * 60, y: 40 + (Math.random() - 0.5) * 40 };
};

app.renderHeatmapDots = function() {
    console.log('📍 Rendering heatmap dots...');
    
    var dotsContainer = document.getElementById('heatmapDots');
    var signupsContainer = document.getElementById('heatmapSignups');
    
    if (!dotsContainer || !signupsContainer) {
        console.error('Containers not found!');
        return;
    }
    
    // Count signups
    var locationCounts = {};
    var locationTimes = {};
    
    if (app.users && Object.keys(app.users).length > 0) {
        for (var uid in app.users) {
            var user = app.users[uid];
            if (user && user.location && user.location !== 'Unknown') {
                var location = user.location;
                locationCounts[location] = (locationCounts[location] || 0) + 1;
                locationTimes[location] = Math.max(locationTimes[location] || 0, user.createdAt || Date.now());
            }
        }
    }
    
    console.log('📊 Locations found:', Object.keys(locationCounts).length, locationCounts);
    
    // Clear and render dots
    dotsContainer.innerHTML = '';
    var dotIndex = 0;
    
    for (var location in locationCounts) {
        var coords = app.getLocationCoordinates(location);
        var dot = document.createElement('div');
        dot.style.cssText = `
            position: absolute;
            left: ${coords.x}%;
            top: ${coords.y}%;
            width: 16px;
            height: 16px;
            background: #00D4FF;
            border-radius: 50%;
            box-shadow: 0 0 12px #00D4FF, 0 0 24px rgba(0, 212, 255, 0.6);
            transform: translate(-50%, -50%);
            z-index: 10;
            cursor: pointer;
            animation: heatmapBlink 2s infinite;
            animation-delay: ${dotIndex * 0.15}s;
        `;
        
        dot.onclick = () => {
            app.toast(`🌍 ${location}: ${locationCounts[location]} signup${locationCounts[location] !== 1 ? 's' : ''}`, 'info');
        };
        
        dotsContainer.appendChild(dot);
        dotIndex++;
    }
    
    // Render signup list
    var html = '';
    var sortedLocations = Object.keys(locationCounts).sort((a, b) => locationCounts[b] - locationCounts[a]);
    
    if (sortedLocations.length === 0) {
        html = '<div style="text-align: center; color: #00D4FF; padding: 10px; font-size: 11px;">⏳ Waiting for signups...</div>';
    } else {
        sortedLocations.slice(0, 5).forEach((location, idx) => {
            var count = locationCounts[location];
            var timeAgo = app.getTimeAgo(locationTimes[location]);
            
            html += `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: rgba(0, 212, 255, 0.08); border-left: 3px solid #00D4FF; border-radius: 6px; cursor: pointer; font-size: 11px;" onclick="app.toast('${location}: ${count} signups', 'info')">
                    <div style="width: 6px; height: 6px; background: #00D4FF; border-radius: 50%; flex-shrink: 0; animation: heatmapBlink 2s infinite;"></div>
                    <div style="flex: 1;">
                        <div style="color: white; font-weight: 600;">${location}</div>
                        <div style="color: #00D4FF; opacity: 0.8;">Active: ${timeAgo}</div>
                    </div>
                    <div style="background: #00D4FF; color: #1a202c; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 10px;">${count}</div>
                </div>
            `;
        });
    }
    
    signupsContainer.innerHTML = html;
    console.log('✅ Heatmap rendered:', sortedLocations.length, 'locations');
};

app.getTimeAgo = function(timestamp) {
    if (!timestamp) return 'Just now';
    
    var date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    var now = new Date();
    var diff = now - date;
    
    if (diff < 0) return 'Just now';
    
    var ms = diff;
    var seconds = Math.floor(ms / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return minutes + 'm';
    if (hours < 24) return hours + 'h';
    if (days < 7) return days + 'd';
    return 'Long ago';
};

app.setupHeatmapListener = function() {
    console.log('🔄 Setting up heatmap listener...');
    
    db.ref('users').on('value', snapshot => {
        if (!app.users) app.users = {};
        app.users = {};
        
        snapshot.forEach(child => {
            app.users[child.key] = child.val();
        });
        
        console.log('📊 Users updated, re-rendering heatmap...');
        app.renderHeatmapDots();
    });
};

// Google Funding Choices Consent Popup
function consentPopup() {
}

// Note: Google AdSense should initialize automatically with the script tag


// ═════════════════════════════════════════════════════════════════════════════
// EXPLORE SEARCH - Find users without showing everyone
// ═════════════════════════════════════════════════════════════════════════════

app.searchExploreUsers = function(query) {
    var resultsContainer = document.getElementById('exploreSearchResultsList');
    var resultsSection = document.getElementById('exploreSearchResults');
    
    if (!query || query.trim() === '') {
        resultsSection.style.display = 'none';
        return;
    }
    
    var searchQuery = query.toLowerCase().trim();
    var results = [];
    
    // Search through all users
    for (var uid in this.users) {
        var user = this.users[uid];
        if (uid !== this.user.uid && user && user.name) {
            // Match by name or email
            if (user.name.toLowerCase().includes(searchQuery) || (user.email && user.email.toLowerCase().includes(searchQuery))) {
                results.push({ uid: uid, user: user });
            }
        }
    }
    
    // Sort by followers
    results.sort((a, b) => (b.user.followers || 0) - (a.user.followers || 0));
    
    // Render results
    var html = '';
    if (results.length === 0) {
        html = '<div style="text-align: center; color: #999; padding: 20px;">No users found</div>';
    } else {
        results.slice(0, 10).forEach(u => {
            var isFollowing = this.following[u.uid] || false;
            var userTags = (u.user.hashtags || []).slice(0, 2);
            var tagsDisplay = userTags.length > 0 ? userTags.join(' ') : '📝 No interests';
            
            html += `
                <div class="explore-search-user">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; flex-shrink: 0;">
                        ${u.user.profilePhoto ? `<img src="${u.user.profilePhoto}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : u.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 15px;">${u.user.name}</div>
                        <div style="font-size: 12px; color: #2E5BFF;">🏷️ ${tagsDisplay}</div>
                        <div style="font-size: 11px; color: #999;">⭐ ${u.user.followers || 0} followers</div>
                    </div>
                    <button onclick="app.openChatFromSearch('${u.uid}', '${u.user.name}')" style="background: var(--primary); color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Message</button>
                </div>
            `;
        });
    }
    
    resultsContainer.innerHTML = html;
    resultsSection.style.display = 'block';
};