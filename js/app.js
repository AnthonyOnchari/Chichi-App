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
}, 3000);

var auth = firebase.auth();
var db = firebase.database();

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
    userHasInteracted: false,
    unreadTrackingStarted: false,
    unreadTrackingActive: false,
    chatMessages: {},
    notifiedMessages: {},
    navigationHistory: [],
    currentView: 'feed',
    heatmapMap: null,
    heatmapListenerSetup: false,
    blockedUsers: {},

    init: function() {
        var self = this;
       
        this.chatMessages = {};
        this.unreadMessages = {};
        this.notifiedMessages = {};
       
        var interactionHandler = function() {
            if (!self.userHasInteracted) {
                self.userHasInteracted = true;
                console.log('👆 User interaction detected - audio/vibration enabled');
                document.removeEventListener('click', interactionHandler);
                document.removeEventListener('touch', interactionHandler);
                document.removeEventListener('keydown', interactionHandler);
            }
        };
        document.addEventListener('click', interactionHandler, { once: false });
        document.addEventListener('touch', interactionHandler, { once: false });
        document.addEventListener('keydown', interactionHandler, { once: false });
       
        this.initConsent();
       
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
                self.user = null;
                self.isGuest = true;
                self.profile = { name: 'Guest', balance: 0 };
                self.updateLogoutButton();
                self.showApp();
            }
        });

        document.getElementById('photoInput').addEventListener('change', e => this.previewPhoto(e));
       
        setTimeout(() => {
            var chatInput = document.getElementById('chatMessageInput');
            if (chatInput) {
                chatInput.addEventListener('keypress', e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        self.sendChatMessage();
                    }
                });
            }
        }, 500);
       
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                self.goBack();
            }
        });
       
        if (typeof window.cordova !== 'undefined') {
            document.addEventListener('backbutton', () => {
                self.goBack();
            }, false);
        }
       
        window.addEventListener('popstate', () => {
            history.pushState(null, null, window.location.href);
            self.goBack();
        });
       
        history.pushState(null, null, window.location.href);
        
        setTimeout(() => {
            self.setupHeatmapListener();
        }, 1000);
    },

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

    requireAuth: function(action) {
        if (this.isGuest || !this.user) {
            this.toast('🔐 Sign up to ' + (action || 'access this'), 'info');
            this.showLoginPage();
            return false;
        }
        return true;
    },

    showAuth: function() {
        var loading = document.getElementById('loadingScreen');
        if (loading) {
            loading.classList.remove('active');
            loading.style.display = 'none';
        }
       
        var authPage = document.getElementById('authPage');
        if (authPage) {
            authPage.style.display = 'flex';
            authPage.style.visibility = 'visible';
            authPage.style.opacity = '1';
        }
       
        var mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.style.display = 'none';
            mainApp.classList.remove('active');
        }
       
        var admin = document.getElementById('adminPortal');
        if (admin) {
            admin.style.display = 'none';
            admin.classList.remove('active');
        }
       
        var nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'none';
       
        document.querySelectorAll('.view').forEach(v => {
            v.style.display = 'none';
        });
    },

    showApp: function() {
        if (!this.chatMessages) this.chatMessages = {};
        if (!this.unreadMessages) this.unreadMessages = {};
        if (!this.notifiedMessages) this.notifiedMessages = {};
        if (!this.navigationHistory) this.navigationHistory = [];
        if (!this.currentView) this.currentView = 'feed';
       
        var loading = document.getElementById('loadingScreen');
        if (loading) {
            loading.classList.remove('active');
            loading.classList.add('hidden');
            loading.style.display = 'none';
            loading.style.visibility = 'hidden';
            loading.style.opacity = '0';
            loading.style.zIndex = '-1';
        }
       
        var authPage = document.getElementById('authPage');
        if (authPage) {
            authPage.classList.remove('show');
            authPage.classList.add('hidden');
            authPage.style.display = 'none';
            authPage.style.visibility = 'hidden';
            authPage.style.opacity = '0';
        }
       
        var mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.style.display = 'flex';
            mainApp.classList.add('active');
        }
       
        var admin = document.getElementById('adminPortal');
        if (admin) {
            admin.classList.remove('active');
        }
       
        var nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'flex';
       
        var self = this;
        setTimeout(() => {
            self.requestNotificationPermission();
        }, 1500);
       
        console.log('🚀 Starting app initialization sequence...');
       
        self.loadPosts();
        self.loadStories();
        self.loadUsers();
        self.loadFollowing();
        self.loadGroups();
        self.setupTypingCleanup();
        self.calculateTrendingHashtags();
       
        setTimeout(() => {
            console.log('🔔 Checking if tracking is active...');
            if (!self.unreadTrackingActive) {
                console.log('⚠️ WARNING: Unread tracking not active yet! Will start when users load.');
            } else {
                console.log('✅ Unread tracking is active.');
            }
        }, 100);
       
        self.messagePollingInterval = setInterval(() => {
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
               
                var balanceDisplay = document.getElementById('balanceDisplay');
                if (balanceDisplay) {
                    balanceDisplay.textContent = 'KSh ' + self.balance.toFixed(2);
                }
               
                var avatar = document.getElementById('quickPostAvatar');
                if (avatar) {
                    if (self.profile.profilePhoto) {
                        avatar.style.backgroundImage = 'url(' + self.profile.profilePhoto + ')';
                        avatar.textContent = '';
                    } else {
                        avatar.textContent = self.user.email.charAt(0).toUpperCase();
                    }
                }
                
                self.checkAndShowHashtagPopup();
            }
        });
    },

    showLoginPage: function() {
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
        if (!this.navigationHistory) this.navigationHistory = [];
        if (!this.currentView) this.currentView = 'feed';
       
        if (this.currentView !== view) {
            this.navigationHistory.push(this.currentView);
        }
       
        this.currentView = view;
       
        try {
            localStorage.setItem('chichiCurrentView', view);
        } catch (e) {
            console.log('localStorage not available');
        }
       
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.style.display = '';
            v.style.visibility = '';
            v.style.opacity = '';
            v.style.zIndex = '';
            v.style.pointerEvents = '';
        });
       
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.remove('active');
            chatView.style.display = '';
            chatView.style.visibility = '';
            chatView.style.opacity = '';
            chatView.style.zIndex = '';
        }
       
        document.querySelectorAll('.nav-wrapper > .nav-item').forEach(n => n.classList.remove('active'));
       
        var viewElement = document.getElementById(view + 'View');
        if (viewElement) {
            viewElement.classList.add('active');
        }
       
        if (view === 'profile') {
            this.renderProfile();
        } else if (view === 'feed') {
            this.loadPosts();
            this.loadStories();
        } else if (view === 'messages') {
            this.loadMessages();
            this.clearUnreadBadge();
        } else if (view === 'explore') {
            this.loadExplore();
        } else if (view === 'groups') {
            this.renderGroups();
        }

        var navItems = document.querySelectorAll('.nav-wrapper > .nav-item');
        if (view === 'feed') navItems[0].classList.add('active');
        else if (view === 'explore') navItems[1].classList.add('active');
        else if (view === 'messages') navItems[2].classList.add('active');
        else if (view === 'groups') navItems[3].classList.add('active');
        else if (view === 'profile') navItems[4].classList.add('active');
    },

    goBack: function() {
        if (!this.backPressCount) {
            this.backPressCount = 0;
            this.lastBackPressTime = 0;
        }
       
        var currentView = this.getCurrentView();
        var isOnHome = currentView === 'feed' || !currentView;
       
        if (!isOnHome) {
            this.switchView('feed');
            this.backPressCount = 0;
            return;
        }
       
        this.backPressCount++;
       
        if (this.backPressCount === 1) {
            this.toast('Press back again to reload', 'info');
           
            setTimeout(() => {
                if (this.backPressCount === 1) {
                    this.backPressCount = 0;
                }
            }, 2000);
           
        } else if (this.backPressCount === 2) {
            this.toast('Press back once more to exit', 'info');
            location.reload();
           
        } else if (this.backPressCount === 3) {
            if (confirm('🚪 Exit CHICHI App?')) {
                if (navigator.app && navigator.app.exitApp) {
                    navigator.app.exitApp();
                } else {
                    window.history.back();
                }
            } else {
                this.backPressCount = 0;
                this.toast('Back in CHICHI', 'success');
            }
        }
    },
   
    getCurrentView: function() {
        var views = document.querySelectorAll('.view');
        for (var i = 0; i < views.length; i++) {
            if (views[i].classList.contains('active')) {
                var viewId = views[i].id;
                if (viewId === 'feedView') return 'feed';
                if (viewId === 'exploreView') return 'explore';
                if (viewId === 'messagesView') return 'messages';
                if (viewId === 'profileView') return 'profile';
                if (viewId === 'groupsView') return 'groups';
            }
        }
        return 'feed';
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
        
        if (loginSpinner) loginSpinner.style.display = 'inline';
        if (loginText) loginText.style.display = 'none';
        if (loginBtn) loginBtn.disabled = true;
        
        var self = this;
        auth.signInWithEmailAndPassword(email, pass)
            .then(result => {
                console.log('✅ Login successful:', result.user.email);
                self.toast('✅ Login successful!', 'success');
            })
            .catch(err => {
                console.error('❌ Login error:', err.message);
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

        if (signupSpinner) signupSpinner.style.display = 'inline';
        if (signupText) signupText.style.display = 'none';
        if (signupBtn) signupBtn.disabled = true;

        var self = this;
        
        // Auto-detect location in background (no prompt)
        var locationData = { city: 'Unknown', lat: 0, lng: 0 };
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    var lat = position.coords.latitude;
                    var lng = position.coords.longitude;
                    locationData.lat = lat;
                    locationData.lng = lng;
                    
                    self.reverseGeocode(lat, lng).then(function(city) {
                        locationData.city = city;
                        document.getElementById('signupLocation').value = city;
                        if (document.getElementById('locationStatus')) {
                            document.getElementById('locationStatus').innerHTML = '✅ ' + city;
                        }
                    }).catch(function() {
                        // Silent fail
                    });
                },
                function() {
                    // Silent fail - user denied
                    console.log('📍 Location not provided by user');
                },
                { timeout: 5000, enableHighAccuracy: false }
            );
        }
        
        auth.createUserWithEmailAndPassword(email, pass).then(function(r) {
            var userData = {
                name: name,
                email: email,
                bio: '',
                profilePhoto: '',
                balance: 0,
                followers: 0,
                following: 0,
                location: locationData.city || 'Unknown',
                coordinates: {
                    latitude: locationData.lat || 0,
                    longitude: locationData.lng || 0
                },
                hashtags: [],
                createdAt: new Date().toLocaleString('en-KE'),
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            };
            
            db.ref('users/' + r.user.uid).set(userData).then(function() {
                self.toast('Account created! Please select your interests', 'success');
                
                setTimeout(function() {
                    self.showMandatoryHashtagSelection();
                }, 500);
                
                setTimeout(function() {
                    self.loadSignupHeatmap();
                }, 1000);
                
                // Re-enable signup button after success
                if (signupSpinner) signupSpinner.style.display = 'none';
                if (signupText) signupText.style.display = 'inline';
                if (signupBtn) signupBtn.disabled = false;
                
            }).catch(function(err) {
                if (signupSpinner) signupSpinner.style.display = 'none';
                if (signupText) signupText.style.display = 'inline';
                if (signupBtn) signupBtn.disabled = false;
                self.toast(err.message, 'error');
            });
        }).catch(function(err) {
            if (signupSpinner) signupSpinner.style.display = 'none';
            if (signupText) signupText.style.display = 'inline';
            if (signupBtn) signupBtn.disabled = false;
            self.toast(err.message, 'error');
        });
    },
    
    detectUserLocation: function() {
        var self = this;
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.warn('Geolocation not supported');
                reject({message: 'Geolocation not supported'});
                return;
            }
            
            var statusEl = document.getElementById('locationStatus');
            if (statusEl) statusEl.innerHTML = '🔄 Detecting your location...';
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    var lat = position.coords.latitude;
                    var lng = position.coords.longitude;
                    console.log('📍 Location detected:', lat, lng);
                    
                    if (statusEl) statusEl.innerHTML = '🌐 Converting coordinates...';
                    
                    self.reverseGeocode(lat, lng).then(city => {
                        console.log('✅ City detected:', city);
                        if (statusEl) statusEl.innerHTML = '✅ ' + city;
                        
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
            db.ref('users/' + user.uid).once('value', snap => {
                if (!snap.exists()) {
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
       
        var buttons = document.querySelectorAll('.admin-tab');
        var tabMap = ['dashboard', 'users', 'posts', 'withdrawals', 'logs'];
        var tabIndex = tabMap.indexOf(tab);
        if (tabIndex >= 0) {
            buttons[tabIndex].classList.add('active');
        }
       
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
       
        if (!confirm(`⚠️ Delete user "${userName}"?\n\nAll posts, messages, and data will be removed.\nThis CANNOT be undone.`)) {
            return;
        }
       
        if (!confirm('Final confirmation: Really delete this user permanently?')) {
            return;
        }
       
        this.toast('Deleting user ' + userName + '...', 'success');
       
        var deletionPromises = [];
       
        deletionPromises.push(
            db.ref('users/' + uid).remove()
        );
       
        deletionPromises.push(
            db.ref('posts').orderByChild('userId').equalTo(uid).once('value', snapshot => {
                var deletePromises = [];
                snapshot.forEach(post => {
                    deletePromises.push(db.ref('posts/' + post.key).remove());
                });
                return Promise.all(deletePromises);
            })
        );
       
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
       
        Promise.all(deletionPromises).then(() => {
            self.toast(`User "${userName}" deleted successfully`, 'success');
           
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

    getUnreadCountForUser: function(uid) {
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
            console.error('❌ createModal not found');
            this.toast('Error opening post creator', 'error');
            return;
        }
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
        console.log('✅ Create modal opened');
    },

    closeCreateModal: function() {
        var modal = document.getElementById('createModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        
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

        var hashtagRegex = /#[\w]+/g;
        var hashtags = (caption.match(hashtagRegex) || []).slice(0, 5);

        if (shareSpinner) shareSpinner.style.display = 'inline';
        if (shareText) shareText.style.display = 'none';
        if (sharePostBtn) sharePostBtn.disabled = true;

        console.log('📤 Uploading post...');

        var formData = new FormData();
        formData.append('file', photoFile);
        formData.append('upload_preset', UPLOAD_PRESET);
       
        fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        })
        .then(r => {
            if (!r.ok) {
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
                hashtags: hashtags,
                likes: {},
                comments: [],
                commentedUsers: {},
                downloads: 0,
                createdAt: new Date().toLocaleString('en-KE'),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                console.log('✅ Post saved to Firebase');
                self.balance += 1;
                db.ref('users/' + self.user.uid + '/balance').set(self.balance);
                self.toast('Post published', 'success');
                
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

    loadStories: function() {
        if (!this.user || this.isGuest) return;
        
        var self = this;
        var html = '';
        
        html += `
            <div class="story-item" onclick="app.showCreateStoryModal()">
                <div class="create-story-avatar">➕</div>
                <div class="create-story-name">My Story</div>
            </div>
        `;
        
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
           
            allStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            var seenUsers = {};
            var uniqueStories = [];
            
            allStories.forEach(story => {
                if (story && story.userId && !seenUsers[story.userId]) {
                    seenUsers[story.userId] = true;
                    uniqueStories.push(story);
                }
            });
            
            uniqueStories.slice(0, 8).forEach(story => {
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
            
            var storiesList = document.getElementById('storiesList');
            if (storiesList) {
                storiesList.innerHTML = html;
            }
        });
    },

    showCreateStoryModal: function() {
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
                            <label class="story-form-label">🎵 Music Name</label>
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
        
        document.getElementById('storyModalOverlay').addEventListener('click', function(e) {
            if (e.target === this) {
                this.remove();
            }
        });
    },

    uploadStory: function() {
        var self = this;
        var imageInput = document.getElementById('storyImageInput');
        var musicNameInput = document.getElementById('storyMusicNameInput');
        var captionInput = document.getElementById('storyCaptionInput');
        var uploadBtn = document.getElementById('storyUploadBtn');
       
        if (!imageInput || !imageInput.files || !imageInput.files[0]) {
            this.toast('⚠️ Please select an image', 'error');
            return;
        }
        
        if (!this.user || !this.user.uid) {
            this.toast('⚠️ Please login first', 'error');
            return;
        }
       
        if (uploadBtn) uploadBtn.classList.add('loading');
        
        this.toast('📤 Uploading story...', 'info');
       
        var formData = new FormData();
        formData.append('file', imageInput.files[0]);
        formData.append('upload_preset', UPLOAD_PRESET || 'chichi_photos');
       
        fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
            method: 'POST',
            body: formData
        })
        .then(r => {
            if (!r.ok) {
                return r.json().then(errData => {
                    console.error('Cloudinary error details:', errData);
                    throw new Error(errData.error?.message || 'Upload failed: ' + r.status);
                });
            }
            return r.json();
        })
        .then(data => {
            if (!data.secure_url) {
                throw new Error('No image URL returned');
            }
            
            var musicName = musicNameInput ? musicNameInput.value.trim() : 'Audio';
            var caption = captionInput ? captionInput.value.trim() : '';
            
            var storyId = 'story_' + Date.now();
            var storyData = {
                image: data.secure_url,
                musicUrl: '',
                musicName: musicName || 'Audio',
                caption: caption || '',
                createdAt: new Date().getTime(),
                views: 0,
                authorUid: self.user.uid,
                authorName: self.user.displayName || 'Anonymous',
                userName: self.profile ? (self.profile.name || 'User') : 'User',
                userPhoto: self.profile ? (self.profile.profilePhoto || '') : ''
            };
            
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
        userId = userId || this.user.uid;
        
        var self = this;
        var user = this.users[userId] || { name: 'User' };
        
        db.ref('stories/' + userId + '/' + storyId).once('value', function(snapshot) {
            var story = snapshot.val();
            if (!story) {
                self.toast('Story not found', 'error');
                return;
            }
            
            db.ref('stories/' + userId + '/' + storyId + '/views').once('value', function(s) {
                var views = (s.val() || 0) + 1;
                db.ref('stories/' + userId + '/' + storyId + '/views').set(views);
            });
            
            var viewer = document.createElement('div');
            viewer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.95);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                animation: smoothFadeIn 0.3s ease;
            `;
            
            viewer.innerHTML = `
                <div style="position: absolute; top: 16px; left: 16px; right: 16px; z-index: 10; display: flex; gap: 4px;">
                    <div style="flex: 1; height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
                        <div id="storyProgressBar" style="height: 100%; width: 0%; background: white; border-radius: 2px; transition: width 0.1s linear;"></div>
                    </div>
                </div>
                
                <div style="position: absolute; top: 24px; left: 16px; right: 16px; z-index: 10; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #006fa3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; overflow: hidden; border: 2px solid rgba(255,255,255,0.3);">
                        ${story.userPhoto ? `<img src="${story.userPhoto}" style="width:100%;height:100%;object-fit:cover;">` : (story.userName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="color: white; font-weight: 600; font-size: 14px;">${story.userName || 'User'}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 11px;">${story.musicName || 'No music'} • ${self.formatTimeAgo(new Date(story.createdAt))}</div>
                    </div>
                </div>
                
                <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; width: 100%;">
                    <img src="${story.image}" style="max-width: 100%; max-height: 70vh; border-radius: 12px; object-fit: contain; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
                </div>
                
                ${story.caption ? `<div style="position: absolute; bottom: 80px; left: 16px; right: 16px; z-index: 10; color: white; text-align: center; font-size: 14px; background: rgba(0,0,0,0.4); padding: 12px 16px; border-radius: 12px;">${story.caption}</div>` : ''}
                
                <div style="position: absolute; bottom: 30px; left: 0; right: 0; z-index: 10; text-align: center; color: rgba(255,255,255,0.4); font-size: 12px;">
                    Tap to close
                </div>
            `;
            
            document.body.appendChild(viewer);
            
            var progressBar = document.getElementById('storyProgressBar');
            var startTime = Date.now();
            var duration = 5000;
            
            var progressInterval = setInterval(function() {
                var elapsed = Date.now() - startTime;
                var progress = Math.min((elapsed / duration) * 100, 100);
                if (progressBar) {
                    progressBar.style.width = progress + '%';
                }
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    viewer.remove();
                    self.toast('Story viewed 📖', 'info');
                }
            }, 50);
            
            viewer.addEventListener('click', function(e) {
                var target = e.target;
                if (target.tagName === 'IMG') {
                    return;
                }
                clearInterval(progressInterval);
                viewer.remove();
                self.toast('Story closed', 'info');
            });
            
            viewer.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    clearInterval(progressInterval);
                    viewer.remove();
                    self.toast('Story closed', 'info');
                }
            });
        });
    },

    formatTimeAgo: function(date) {
        var now = new Date();
        var diff = now - date;
        var seconds = Math.floor(diff / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'Just now';
        if (minutes < 60) return minutes + 'm ago';
        if (hours < 24) return hours + 'h ago';
        if (days < 7) return days + 'd ago';
        return date.toLocaleDateString();
    },

    notifyNewMessage: function(senderName, messageText) {
        var cleanMessage = messageText ? messageText.substring(0, 150) : '📷 Image';
       
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
       
        this.toast(`📬 ${senderName}: ${cleanMessage}`, 'info', 4000);
        this.playNotificationSound();
        this.updateBrowserTitle();
       
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

    playNotificationSound: function() {
        if (!this.userHasInteracted) {
            console.log('⏸️ Audio disabled (no user interaction yet)');
            return;
        }
       
        try {
            var audioContext = new (window.AudioContext || window.webkitAudioContext)();
           
            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(e => {
                    console.log('⏸️ AudioContext suspended - user must interact first');
                });
            }
           
            var oscillator = audioContext.createOscillator();
            var gainNode = audioContext.createGain();
           
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
           
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
           
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
           
            console.log('🔊 Notification sound played');
        } catch (e) {
            console.log('⏸️ Audio notification skipped:', e.message);
        }
    },

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
        
        this.loadBlockedUsers();
        
        var html = '';
        
        if (!this.chatMessages) {
            this.chatMessages = {};
        }
        
        var conversations = [];
        
        db.ref('messages').once('value', snapshot => {
            console.log('📡 Messages snapshot received');
            
            if (snapshot.val()) {
                console.log('✅ Messages found:', Object.keys(snapshot.val()).length, 'conversations');
                
                Object.keys(snapshot.val()).forEach(chatKey => {
                    if (chatKey.includes(self.user.uid)) {
                        var parts = chatKey.split('_');
                        var otherUserId = parts[0] === self.user.uid ? parts[1] : parts[0];
                        
                        if (self.blockedUsers && self.blockedUsers[otherUserId]) {
                            return;
                        }
                        
                        var messages = snapshot.val()[chatKey];
                        var hasTextMessages = false;
                        var lastMessage = 'Tap to message';
                        var lastTimestamp = 0;
                        var unreadCount = 0;
                        
                        if (messages && typeof messages === 'object') {
                            Object.keys(messages).forEach(msgId => {
                                var msg = messages[msgId];
                                
                                if (msg && !msg.deleted) {
                                    if (msg.text) {
                                        hasTextMessages = true;
                                        lastMessage = msg.text.substring(0, 50);
                                        lastTimestamp = msg.timestamp || 0;
                                        
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
            
            conversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
            
            console.log('✅ Total conversations:', conversations.length);
            
            if (conversations.length > 0) {
                conversations.forEach(conv => {
                    var unreadBadge = conv.unreadCount > 0 ? `<div class="message-item-unread">${conv.unreadCount}</div>` : '<div style="width: 20px;"></div>';
                    var avatarStyle = conv.user.profilePhoto ? `background-image: url('${conv.user.profilePhoto}'); background-size: cover; background-position: center;` : '';
                    
                    html += `
                        <div class="message-item" onclick="app.openChatFromSearch('${conv.uid}', '${conv.user.name}')">
                            <div class="message-item-avatar" style="${avatarStyle} background: ${!conv.user.profilePhoto ? 'linear-gradient(135deg, #0088cc, #006fa3)' : ''};">
                                ${!conv.user.profilePhoto ? conv.user.name.charAt(0).toUpperCase() : ''}
                            </div>
                            <div class="message-item-content">
                                <div class="message-item-name">${conv.user.name}</div>
                                <div class="message-item-preview">${conv.lastMessage}</div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                                <div class="message-item-time">${self.formatTimeAgo(new Date(conv.lastTimestamp))}</div>
                                ${unreadBadge}
                            </div>
                        </div>
                    `;
                });
            } else {
                html = '<div style="text-align: center; color: #6b7280; padding: 60px 16px; font-size: 15px;">No conversations yet<br><br>Go find someone to chat with! 💬</div>';
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
        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to message users', 'info');
            this.showLoginPage();
            return;
        }
        
        var allViews = document.querySelectorAll('.view');
        allViews.forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none !important';
            view.style.visibility = 'hidden';
            view.style.opacity = '0';
            view.style.zIndex = '1';
            view.style.pointerEvents = 'none';
        });
        
        var mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.style.overflow = 'hidden';
        }
        
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
        window.currentChatUid = uid;
        
        document.getElementById('chatHeaderName').textContent = name;
        document.getElementById('chatHeaderStatus').textContent = 'Active now';
        
        var avatar = document.getElementById('chatHeaderAvatar');
        var userPhoto = this.users[uid] && this.users[uid].profilePhoto;
        if (userPhoto) {
            avatar.style.backgroundImage = 'url(' + userPhoto + ')';
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
        } else {
            avatar.style.backgroundImage = 'none';
            avatar.textContent = name.charAt(0).toUpperCase();
        }
        
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('chatMessageInput').value = '';
        
        var self = this;
        var chatKey = [this.user.uid, uid].sort().join('_');
        
        setTimeout(() => {
            self.loadChatMessages();
            self.markAsRead(uid);
            document.getElementById('chatMessageInput').focus();
        }, 100);
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
        window.currentChatUid = null;
        this.showView('messages');
    },
    
    showView: function(viewName) {
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.remove('active');
            chatView.style.display = 'none';
            chatView.style.visibility = 'hidden';
            chatView.style.opacity = '0';
            chatView.style.zIndex = '-1';
            chatView.style.pointerEvents = 'none';
        }
        this.switchView(viewName);
    },

    loadChatMessages: function() {
        if (!this.currentChat) return;
       
        var self = this;
        var key = [self.user.uid, self.currentChat.uid].sort().join('_');
       
        if (!this.chatMessages) this.chatMessages = {};
        if (!this.lastMessageCount) this.lastMessageCount = {};
       
        if (this.chatMessagesListener) {
            db.ref('chats/' + key + '/messages').off();
        }
       
        db.ref('chats/' + key + '/messages').once('value').then(snapshot => {
            var messages = [];
            snapshot.forEach(c => {
                var m = c.val();
                if (m && (m.text || m.image)) {
                    messages.push(m);
                }
            });
           
            messages.sort((a, b) => {
                return (a.timestamp || 0) - (b.timestamp || 0);
            });
           
            self.chatMessages[key] = messages;
            self.lastMessageCount[key] = messages.length;
           
            self.displayChatMessages(messages, key);
           
            self.chatMessagesListener = db.ref('chats/' + key + '/messages').on('child_added', snap => {
                var m = snap.val();
                if (m && (m.text || m.image) && m.sender !== self.user.uid) {
                    self.notifyNewMessage(self.currentChat.name, m.text || '📷 Image');
                   
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

    displayChatMessages: function(messages, key) {
        var self = this;
       
        if (key) {
            if (!this.chatMessages) this.chatMessages = {};
            this.chatMessages[key] = messages;
        }
       
        if (!messages || messages.length === 0) {
            var chatMessagesView = document.getElementById('chatMessages');
            if (chatMessagesView) {
                chatMessagesView.innerHTML = '<div style="text-align: center; color: #999; padding: 40px 16px; font-size: 14px;">No messages yet. Say hello! 👋</div>';
            }
            return;
        }
       
        var html = '';
        var lastDate = '';
       
        messages.forEach((m, idx) => {
            if (!m || (!m.text && !m.image)) return;
           
            var side = m.sender === self.user.uid ? 'own' : 'other';
            var timestamp = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
           
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
               
                if (dateStr !== lastDate) {
                    html += `<div class="message-date-divider">${dateStr}</div>`;
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
            
            var otherUserName = self.currentChat.name || 'User';
            var otherUserInitial = otherUserName.charAt(0).toUpperCase();
            var senderName = side === 'own' ? 'You' : otherUserName;
            var showAvatar = side === 'other';
            var readReceipt = side === 'own' ? (m.read ? '✓✓' : '✓') : '';
            
            html += `
                <div class="message-group ${side}">
                    ${showAvatar ? `<div class="message-avatar" style="${self.users[self.currentChat.uid] && self.users[self.currentChat.uid].profilePhoto ? 'background-image: url(' + self.users[self.currentChat.uid].profilePhoto + '); background-size: cover; background-position: center;' : ''}">${!self.users[self.currentChat.uid] || !self.users[self.currentChat.uid].profilePhoto ? otherUserInitial : ''}</div>` : ''}
                    <div class="message-wrapper">
                        ${side === 'other' ? `<div class="message-sender">${senderName}</div>` : ''}
                        <div class="message-bubble">
                            ${m.text ? `<div>${m.text}</div>` : ''}
                            ${m.image ? `<img src="${m.image}" style="max-width: 100%; border-radius: 12px; cursor: pointer;" onclick="app.viewFullImage('${m.image}')">` : ''}
                        </div>
                        <div class="message-meta">
                            <span>${timestamp}</span>
                            ${readReceipt ? `<span class="message-read-receipt">${readReceipt}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
       
        var chatMessagesView = document.getElementById('chatMessages');
        if (chatMessagesView) {
            chatMessagesView.innerHTML = html;
            setTimeout(() => chatMessagesView.scrollTop = chatMessagesView.scrollHeight, 50);
            setTimeout(() => chatMessagesView.scrollTop = chatMessagesView.scrollHeight, 150);
        }
    },

    sendChatMessage: function() {
        if (!this.currentChat) {
            this.toast('No chat selected', 'error');
            return;
        }
       
        var input = document.getElementById('chatMessageInput');
        var text = (input && input.value) || '';
        text = text.trim();
       
        if (!text) {
            if (input) input.focus();
            return;
        }

        var self = this;
        var key = [self.user.uid, self.currentChat.uid].sort().join('_');
       
        var now = new Date().getTime();
        if (!this.chatMessages[key]) this.chatMessages[key] = [];
       
        var tempMessage = {
            sender: self.user.uid,
            text: text,
            timestamp: now,
            pending: true
        };
       
        this.chatMessages[key].push(tempMessage);
        this.displayChatMessages(this.chatMessages[key], key);
       
        if (input) input.value = '';
        if (input) input.focus();
       
        var messageRef = db.ref('messages/' + key).push();
        messageRef.set({
            text: text,
            senderId: self.user.uid,
            sender: self.user.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        }).then(() => {
            console.log('✅ Message sent');
            
            db.ref('chats/' + key + '/messages/' + messageRef.key).set({
                text: text,
                sender: self.user.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            });
            
            tempMessage.pending = false;
            self.displayChatMessages(self.chatMessages[key], key);
        }).catch(err => {
            console.error('❌ Error sending message:', err);
            self.toast('Error sending message', 'error');
            
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
        }).catch(err => {
            self.toast('Failed to send image', 'error');
        });
    },

    markAsRead: function(uid) {
        var self = this;
        var key = [this.user.uid, uid].sort().join('_');
       
        if (this.unreadMessages && this.unreadMessages[key]) {
            this.unreadMessages[key].count = 0;
        }
       
        var messagesRef = db.ref('chats/' + key + '/messages');
        messagesRef.once('value', snap => {
            snap.forEach(childSnap => {
                var m = childSnap.val();
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
        this.toast('Earning features coming soon!', 'info');
        return;
    },

    getAdsRemaining: function() {
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
       
        if (!confirm('⚠️ WARNING: This will PERMANENTLY DELETE your account and all your data!\n\nAll posts, messages, and profile info will be removed.\nThis CANNOT be undone.\n\nAre you absolutely sure?')) {
            return;
        }
       
        if (!confirm('Final confirmation: Delete everything? Click OK to proceed.')) {
            return;
        }
       
        this.toast('Deleting account... Please wait...', 'success');
       
        var uid = this.user.uid;
        var deletionPromises = [];
       
        deletionPromises.push(
            db.ref('users/' + uid).remove()
        );
       
        deletionPromises.push(
            db.ref('posts').orderByChild('userId').equalTo(uid).once('value', snapshot => {
                var deletePromises = [];
                snapshot.forEach(post => {
                    deletePromises.push(db.ref('posts/' + post.key).remove());
                });
                return Promise.all(deletePromises);
            })
        );
       
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
       
        Promise.all(deletionPromises).then(() => {
            self.toast('Data deleted successfully. Removing account...', 'success');
           
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
            this.checkUserLocation();
        }
    },

    checkUserLocation: function() {
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
       
        var self = this;
        setTimeout(() => {
            self.trackUnreadMessages();
            console.log('✅ Notifications configured and tracking started');
        }, 500);
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
    // GROUPS FEATURE
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
        
        var html = '';
        
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
                    <div class="group-card" onclick="app.openGroup('${group.id}')">
                        <div class="group-photo">${group.name.charAt(0)}</div>
                        <div class="group-info">
                            <div class="group-name">${group.name}</div>
                            <div class="group-members">${group.memberCount} members</div>
                        </div>
                        <div class="group-arrow">→</div>
                    </div>
                `;
            });
        }
        
        var groupsList = document.getElementById('groupsList');
        if (groupsList) {
            groupsList.innerHTML = html;
        }
    },

    showCreateGroupModal: function() {
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
        
        if (!this.user || !this.user.uid) {
            this.toast('You must be logged in', 'error');
            return;
        }
        
        var self = this;
        var groupId = db.ref('groups').push().key;
        
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
        
        groupData.members[self.user.uid] = true;
        
        db.ref('groups/' + groupId).set(groupData)
            .then(() => {
                console.log('✅ Group created successfully:', groupId);
                self.toast('✅ Group created! 🎉', 'success');
                
                var modal = document.getElementById('createGroupModal');
                if (modal) {
                    modal.remove();
                }
                
                self.groups[groupId] = groupData;
                self.renderGroups();
            })
            .catch(err => {
                console.error('❌ Error creating group:', err);
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
    // TYPING INDICATORS
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
                    typingIndicator.innerHTML = `<div style="color: #6b7280; font-size: 13px; font-style: italic; padding: 4px 0;">${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing...</div>`;
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
    // CHAT MENU (3-dots)
    // ============================================

    showChatMenu: function() {
        if (!this.currentChat) return;
        
        var self = this;
        var uid = this.currentChat.uid;
        var name = this.currentChat.name;
        
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML = `
            <div class="modal" style="max-width: 380px; border-radius: 20px; padding: 20px; max-height: auto;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                <h3 style="margin-bottom: 16px; font-weight: 700; text-align: center;">Chat Options</h3>
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button onclick="app.viewUserProfile('${uid}')" style="width:100%;padding:14px 16px;border:none;border-bottom:1px solid #f0f0f0;background:none;text-align:left;cursor:pointer;font-size:15px;border-radius:8px;transition:0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
                        👤 View Profile
                    </button>
                    
                    <button onclick="app.blockUser('${uid}')" style="width:100%;padding:14px 16px;border:none;border-bottom:1px solid #f0f0f0;background:none;text-align:left;cursor:pointer;font-size:15px;border-radius:8px;transition:0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
                        🚫 Block User
                    </button>
                    
                    <button onclick="app.reportUser('${uid}', '${name}')" style="width:100%;padding:14px 16px;border:none;border-bottom:1px solid #f0f0f0;background:none;text-align:left;cursor:pointer;font-size:15px;border-radius:8px;transition:0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
                        🚨 Report User
                    </button>
                    
                    <button onclick="app.toggleTheme()" style="width:100%;padding:14px 16px;border:none;border-bottom:1px solid #f0f0f0;background:none;text-align:left;cursor:pointer;font-size:15px;border-radius:8px;transition:0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
                        🌓 Toggle Theme
                    </button>
                    
                    <button onclick="app.clearChat('${uid}')" style="width:100%;padding:14px 16px;border:none;background:none;text-align:left;cursor:pointer;font-size:15px;color:#ff4444;border-radius:8px;transition:0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">
                        🗑️ Clear Chat
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.remove();
            }
        });
    },

    blockUser: function(userId) {
        if (!this.user) return;
        
        var self = this;
        db.ref('users/' + this.user.uid + '/blocked/' + userId).set(true, err => {
            if (err) {
                self.toast('❌ Error blocking user', 'error');
            } else {
                self.toast('✅ User blocked', 'success');
                self.blockedUsers[userId] = true;
                document.querySelector('.modal-overlay.active')?.remove();
                self.closeChatView();
                self.loadMessages();
            }
        });
    },

    unblockUser: function(userId) {
        if (!this.user) return;
        
        var self = this;
        db.ref('users/' + this.user.uid + '/blocked/' + userId).remove(err => {
            if (err) {
                self.toast('❌ Error unblocking user', 'error');
            } else {
                self.toast('✅ User unblocked', 'success');
                delete self.blockedUsers[userId];
                self.loadMessages();
            }
        });
    },

    reportUser: function(userId, userName) {
        var reason = prompt('Why are you reporting ' + userName + '? (Please provide details)');
        if (!reason || reason.trim() === '') {
            this.toast('⚠️ Please provide a reason', 'error');
            return;
        }
        
        var self = this;
        db.ref('reports').push({
            reportedUserId: userId,
            reportedUserName: userName,
            reportedBy: this.user.uid,
            reportedByName: this.profile.name || 'User',
            reason: reason.trim(),
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'pending'
        }, err => {
            if (err) {
                self.toast('❌ Error submitting report', 'error');
            } else {
                self.toast('✅ Report submitted to admin', 'success');
                document.querySelector('.modal-overlay.active')?.remove();
            }
        });
    },

    toggleTheme: function() {
        var root = document.documentElement;
        var currentBg = getComputedStyle(root).getPropertyValue('--bg').trim();
        
        if (currentBg === '#ffffff' || currentBg === 'white') {
            root.style.setProperty('--bg', '#1a1a2e');
            root.style.setProperty('--light', '#16213e');
            root.style.setProperty('--text', '#ffffff');
            root.style.setProperty('--text-light', '#a0aec0');
            root.style.setProperty('--border', '#2d3748');
            this.toast('🌙 Dark theme enabled', 'success');
        } else {
            root.style.setProperty('--bg', '#ffffff');
            root.style.setProperty('--light', '#f9fafb');
            root.style.setProperty('--text', '#111827');
            root.style.setProperty('--text-light', '#6b7280');
            root.style.setProperty('--border', '#e5e7eb');
            this.toast('☀️ Light theme enabled', 'success');
        }
        
        document.querySelector('.modal-overlay.active')?.remove();
    },

    clearChat: function(userId) {
        if (!confirm('Delete all messages with this user? This cannot be undone.')) return;
        
        var self = this;
        var chatKey = [this.user.uid, userId].sort().join('_');
        
        db.ref('chats/' + chatKey + '/messages').remove(err => {
            if (err) {
                self.toast('❌ Error clearing chat', 'error');
            } else {
                self.toast('✅ Chat cleared', 'success');
                document.querySelector('.modal-overlay.active')?.remove();
                self.closeChatView();
                self.loadMessages();
            }
        });
    },

    loadBlockedUsers: function() {
        if (!this.user) return;
        
        db.ref('users/' + this.user.uid + '/blocked').once('value', snapshot => {
            if (snapshot.val()) {
                Object.keys(snapshot.val()).forEach(userId => {
                    this.blockedUsers[userId] = true;
                });
            }
        });
    },

    // ============================================
    // ABOUT US - Anthony Onchari
    // ============================================

    showAbout: function() {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML = `
            <div class="modal" style="max-width: 420px; border-radius: 20px; padding: 24px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;">✕</button></div>
                
                <div style="text-align: center; padding: 4px 0;">
                    <div style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; border: 3px solid #0088cc; box-shadow: 0 4px 16px rgba(0,136,204,0.3);">
                        <img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1784291624/1768467745366_1_lu01jr.jpg" alt="Anthony Onchari" style="width:100%;height:100%;object-fit:cover;">
                    </div>
                    
                    <h2 style="margin-bottom: 2px; font-weight: 800; font-size: 22px; color: #1a202c;">Anthony Onchari</h2>
                    <p style="color: #0088cc; font-size: 13px; font-weight: 600; margin-bottom: 4px;">👨‍💻 Developer & Digital Media Specialist</p>
                    <p style="color: #6b7280; font-size: 11px; background: #f0f0f0; display: inline-block; padding: 2px 12px; border-radius: 12px; margin-bottom: 16px;">
                        📱 Version V01A.01
                    </p>
                    
                    <div style="background: #f7fafc; padding: 16px 18px; border-radius: 16px; text-align: left; border: 1px solid #e2e8f0; margin-bottom: 16px;">
                        <p style="font-size: 14px; line-height: 1.8; color: #2d3748; margin: 0;">
                            Hey there! 👋 I'm <strong style="color: #0088cc;">Anthony</strong>, 
                            a Developer and Digital Media Specialist who loves building things that bring people and community together. 
                            I created <strong style="color: #0088cc;">CHICHI</strong> because I believe 
                            social media should feel like home — warm, real, and human.
                        </p>
                        <p style="font-size: 13px; line-height: 1.7; color: #4a5568; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                            This is <strong>Version V01A.01</strong> — the beginning of something beautiful. 
                            More features, more love, and more connection coming soon!
                        </p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px;">
                        <div style="background: #ebf8ff; padding: 10px 6px; border-radius: 12px;">
                            <div style="font-size: 20px;">💻</div>
                            <div style="font-size: 11px; color: #2b6cb0; font-weight: 600;">Web Developer</div>
                        </div>
                        <div style="background: #f0fff4; padding: 10px 6px; border-radius: 12px;">
                            <div style="font-size: 20px;">📱</div>
                            <div style="font-size: 11px; color: #276749; font-weight: 600;">Digital Media</div>
                        </div>
                        <div style="background: #faf5ff; padding: 10px 6px; border-radius: 12px;">
                            <div style="font-size: 20px;">🤝</div>
                            <div style="font-size: 11px; color: #6b46c1; font-weight: 600;">Community Builder</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="window.open('https://wa.me/254701807001', '_blank')" style="padding: 10px 18px; background: #25D366; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.3s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            💬 WhatsApp
                        </button>
                        <button onclick="window.open('https://www.facebook.com/profile.php?id=100088002065441', '_blank')" style="padding: 10px 18px; background: #1877F2; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.3s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            📘 Facebook
                        </button>
                        <button onclick="window.open('https://www.linkedin.com/in/anthony-onchari-a3b87b270/', '_blank')" style="padding: 10px 18px; background: #0A66C2; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; transition: 0.3s; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            💼 LinkedIn
                        </button>
                    </div>
                    
                    <div style="margin-top: 14px; font-size: 11px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                        <span>© 2026 Onchari Group • CHICHI V01A.01</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.remove();
            }
        });
    },

    // ============================================
    // MANDATORY HASHTAG SELECTION - FIXED
    // ============================================

    showMandatoryHashtagSelection: function() {
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
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #1a202c;">${category}</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            `;
            hashtagCategories[category].forEach(function(tag) {
                htmlOptions += `
                    <label style="display: inline-flex; align-items: center; padding: 4px 10px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 20px; cursor: pointer; transition: 0.2s; font-size: 12px;" 
                           onmouseover="this.style.borderColor='#0088cc'; this.style.background='rgba(0,136,204,0.05)'" 
                           onmouseout="if(!this.querySelector('input').checked){this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb'}">
                        <input type="checkbox" class="hashtag-checkbox" value="${tag}" style="width: 14px; height: 14px; cursor: pointer; margin-right: 5px; accent-color: #0088cc;" 
                               onchange="this.parentElement.style.borderColor=this.checked ? '#0088cc' : '#e5e7eb'; this.parentElement.style.background=this.checked ? 'rgba(0,136,204,0.1)' : '#f9fafb'">
                        <span style="font-size: 11px; color: #1a202c;">${tag}</span>
                    </label>
                `;
            });
            htmlOptions += `
                    </div>
                </div>
            `;
        }
        
        var modalHTML = `
            <div class="modal-overlay" id="mandatoryHashtagModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); align-items: center; justify-content: center; z-index: 10001; backdrop-filter: blur(4px);">
                <div style="background: white; border-radius: 24px; max-width: 480px; width: 92%; max-height: 80vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: smoothFadeIn 0.3s ease;">
                    <div style="text-align: center; margin-bottom: 16px;">
                        <div style="font-size: 36px; margin-bottom: 4px;">🏷️</div>
                        <h2 style="margin-bottom: 2px; font-weight: 700; color: #1a202c; font-size: 20px;">Choose Your Interests</h2>
                        <p style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">Select at least <strong style="color: #0088cc;">3</strong> topics you care about</p>
                        <p style="color: #ef4444; font-size: 11px; font-weight: 600; min-height: 18px;" id="hashtagError"></p>
                    </div>
                    
                    <div style="margin-bottom: 16px; max-height: 50vh; overflow-y: auto; padding-right: 4px;">
                        ${htmlOptions}
                    </div>
                    
                    <div style="display: flex; gap: 10px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
                        <button onclick="app.saveMandatoryHashtags()" id="saveHashtagBtn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #0088cc, #006fa3); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 15px; cursor: pointer; transition: 0.3s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                            ✅ Save & Continue
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        var existing = document.getElementById('mandatoryHashtagModal');
        if (existing) existing.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveMandatoryHashtags: function() {
        console.log('🔥 saveMandatoryHashtags called!');
        
        var checkboxes = document.querySelectorAll('#mandatoryHashtagModal .hashtag-checkbox:checked');
        var selected = [];
        
        checkboxes.forEach(function(cb) {
            selected.push(cb.value);
        });
        
        console.log('📋 Selected hashtags:', selected);
        
        var errorEl = document.getElementById('hashtagError');
        
        if (selected.length < 3) {
            if (errorEl) errorEl.textContent = '⚠️ Please select at least 3 interests';
            this.toast('Select at least 3 interests', 'error');
            return;
        }
        
        if (selected.length > 5) {
            if (errorEl) errorEl.textContent = '⚠️ Maximum 5 interests allowed';
            this.toast('Maximum 5 interests allowed', 'error');
            return;
        }
        
        if (errorEl) errorEl.textContent = '';
        
        console.log('💾 Saving mandatory hashtags:', selected);
        
        var self = this;
        var uid = this.user ? this.user.uid : null;
        
        if (!uid) {
            this.toast('User not found. Please login again.', 'error');
            return;
        }
        
        var btn = document.getElementById('saveHashtagBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Saving...';
            btn.style.opacity = '0.6';
        }
        
        db.ref('users/' + uid + '/hashtags').set(selected).then(function() {
            console.log('✅ Hashtags saved successfully to Firebase!');
            self.profile.hashtags = selected;
            self.toast('✅ Interests saved! You\'ll now see relevant content.', 'success');
            
            var modal = document.getElementById('mandatoryHashtagModal');
            if (modal) modal.remove();
            
            setTimeout(function() {
                self.switchView('explore');
                self.toast('🔍 Discover people with similar interests!', 'info');
                self.loadExplore();
            }, 500);
            
        }).catch(function(err) {
            console.error('❌ Error saving hashtags:', err);
            self.toast('❌ Error saving interests: ' + err.message, 'error');
            
            if (btn) {
                btn.disabled = false;
                btn.textContent = '✅ Save & Continue';
                btn.style.opacity = '1';
            }
        });
    },

    // ============================================
    // LOAD EXPLORE
    // ============================================

    loadExplore: function() {
        var self = this;
        console.log('🔍 Explore: Loading heatmap and trending');
        
        var container = document.getElementById('exploreUsersList');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
        
        var resultsSection = document.getElementById('exploreSearchResults');
        if (resultsSection) {
            resultsSection.style.display = 'none';
        }
        
        var searchInput = document.getElementById('exploreSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.loadSignupHeatmap();
        this.renderTrendingInExplore();
        this.setupTrendingRefresh();
        this.showHashtagSuggestions();
    },

    // ============================================
    // GLOBAL SIGNUP HEATMAP
    // ============================================

    loadSignupHeatmap: function() {
        console.log('🗺️ Loading global signup heatmap...');
        
        var mapContainer = document.getElementById('signupMapContainer');
        if (!mapContainer) {
            console.error('Heatmap container not found!');
            return;
        }
        
        mapContainer.innerHTML = `
            <div id="leafletMap" style="width: 100%; height: 100%;"></div>
            <div id="heatmapDots" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"></div>
        `;
        
        if (typeof L !== 'undefined') {
            var map = L.map('leafletMap', {
                zoomControl: false,
                attributionControl: false,
                fadeAnimation: true,
                zoomAnimation: true
            }).setView([20, 0], 2);
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '©OpenStreetMap, ©CartoDB',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);
            
            this.heatmapMap = map;
            L.control.zoom({ position: 'topright' }).addTo(map);
        }
        
        this.updateHeatmapStats();
        this.renderHeatmapDots();
        
        if (!this.heatmapListenerSetup) {
            this.setupHeatmapListener();
            this.heatmapListenerSetup = true;
        }
    },

    updateHeatmapStats: function() {
        var totalUsers = Object.keys(this.users || {}).length;
        var onlineCount = 0;
        
        for (var uid in this.users) {
            var user = this.users[uid];
            if (user && user.lastSeen) {
                var lastSeen = new Date(user.lastSeen);
                var now = new Date();
                var diffMinutes = (now - lastSeen) / 1000 / 60;
                if (diffMinutes < 5) {
                    onlineCount++;
                }
            }
        }
        
        var totalElement = document.getElementById('totalSignups');
        if (totalElement) {
            this.animateNumber(totalElement, totalUsers);
        }
        
        var onlineElement = document.getElementById('onlineCount');
        if (onlineElement) {
            this.animateNumber(onlineElement, onlineCount || Math.floor(Math.random() * 1000) + 100);
        }
        
        var growthElement = document.getElementById('signupGrowth');
        if (growthElement) {
            var growth = (Math.random() * 10 + 2).toFixed(1);
            growthElement.textContent = '+' + growth + '%';
        }
    },

    animateNumber: function(element, target) {
        var current = parseInt(element.textContent.replace(/,/g, '')) || 0;
        var diff = target - current;
        var steps = 20;
        var step = diff / steps;
        var count = 0;
        
        var interval = setInterval(function() {
            count++;
            var value = Math.round(current + step * count);
            if (count >= steps || value >= target) {
                element.textContent = target.toLocaleString();
                clearInterval(interval);
            } else {
                element.textContent = value.toLocaleString();
            }
        }, 30);
    },

    renderHeatmapDots: function() {
        console.log('📍 Rendering heatmap dots...');
        
        var dotsContainer = document.getElementById('heatmapDots');
        var activityFeed = document.getElementById('recentActivityFeed');
        
        if (!dotsContainer) {
            console.error('Dots container not found!');
            return;
        }
        
        var locationData = {};
        var recentActivities = [];
        
        if (this.users && Object.keys(this.users).length > 0) {
            var userArray = Object.keys(this.users).map(uid => ({ uid: uid, user: this.users[uid] }));
            userArray.sort(function(a, b) {
                var dateA = new Date(a.user.createdAt || 0);
                var dateB = new Date(b.user.createdAt || 0);
                return dateB - dateA;
            });
            
            userArray.forEach(function(item) {
                var user = item.user;
                if (user && user.location && user.location !== 'Unknown' && user.coordinates) {
                    var lat = user.coordinates.latitude || 0;
                    var lng = user.coordinates.longitude || 0;
                    
                    if (lat !== 0 && lng !== 0) {
                        var key = user.location + '_' + lat + '_' + lng;
                        if (!locationData[key]) {
                            locationData[key] = {
                                location: user.location,
                                lat: lat,
                                lng: lng,
                                count: 0,
                                users: []
                            };
                        }
                        locationData[key].count++;
                        locationData[key].users.push(user.name);
                    }
                }
            });
            
            userArray.slice(0, 10).forEach(function(item) {
                var user = item.user;
                if (user && user.location && user.location !== 'Unknown') {
                    var time = user.createdAt || new Date().toLocaleString('en-KE');
                    recentActivities.push({
                        name: user.name,
                        location: user.location,
                        time: time
                    });
                }
            });
        }
        
        dotsContainer.innerHTML = '';
        var dotIndex = 0;
        
        for (var key in locationData) {
            var data = locationData[key];
            var dot = document.createElement('div');
            var lat = data.lat;
            var lng = data.lng;
            
            var x = ((lng + 180) / 360) * 100;
            var y = ((90 - lat) / 180) * 100;
            
            var size = 12 + Math.min(data.count * 2, 20);
            var brightness = Math.min(0.6 + data.count * 0.05, 1);
            
            dot.style.cssText = `
                position: absolute;
                left: ${x}%;
                top: ${y}%;
                width: ${size}px;
                height: ${size}px;
                background: rgba(0, 212, 255, ${brightness});
                border-radius: 50%;
                box-shadow: 0 0 ${size * 1.5}px rgba(0, 212, 255, ${brightness * 0.6}), 0 0 ${size * 3}px rgba(0, 212, 255, ${brightness * 0.3});
                transform: translate(-50%, -50%);
                z-index: 10;
                cursor: pointer;
                animation: heatmapBlink ${1.5 + Math.random()}s infinite;
                animation-delay: ${dotIndex * 0.1}s;
                border: 2px solid rgba(255,255,255,0.3);
                pointer-events: auto;
            `;
            
            dot.onclick = function(loc, count) {
                return function() {
                    app.toast(`📍 ${loc}: ${count} signups`, 'info');
                };
            }(data.location, data.count);
            
            dotsContainer.appendChild(dot);
            dotIndex++;
        }
        
        if (activityFeed) {
            var html = '';
            if (recentActivities.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px; font-size: 13px;">No recent activity</div>';
            } else {
                recentActivities.slice(0, 8).forEach(function(activity) {
                    var time = activity.time;
                    var formattedTime = 'Just now';
                    if (typeof time === 'string' && time.includes(' ')) {
                        var parts = time.split(' ');
                        if (parts.length >= 2) {
                            formattedTime = parts[1] + ' ' + parts[2];
                        }
                    }
                    html += `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #006fa3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 12px; flex-shrink: 0;">
                                ${activity.name.charAt(0).toUpperCase()}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 13px; font-weight: 600; color: #1a202c;">${activity.name}</div>
                                <div style="font-size: 12px; color: #6b7280;">📍 ${activity.location}</div>
                            </div>
                            <div style="font-size: 11px; color: #9ca3af;">${formattedTime}</div>
                        </div>
                    `;
                });
            }
            activityFeed.innerHTML = html;
        }
        
        console.log('✅ Heatmap rendered:', Object.keys(locationData).length, 'locations');
    },

    getLocationCoordinates: function(location) {
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
    },

    setupHeatmapListener: function() {
        console.log('🔄 Setting up heatmap listener...');
        
        db.ref('users').on('value', snapshot => {
            if (!this.users) this.users = {};
            this.users = {};
            
            snapshot.forEach(child => {
                this.users[child.key] = child.val();
            });
            
            console.log('📊 Users updated, re-rendering heatmap...');
            this.updateHeatmapStats();
            this.renderHeatmapDots();
            this.showHashtagSuggestions();
        });
    },

    showHashtagSuggestions: function() {
        if (!this.user || this.isGuest) return;
        
        var self = this;
        var userHashtags = this.profile.hashtags || [];
        
        var oldSuggestions = document.getElementById('hashtagSuggestions');
        if (oldSuggestions) oldSuggestions.remove();
        
        var exploreView = document.getElementById('exploreView');
        if (!exploreView) return;
        
        if (userHashtags.length === 0) {
            var suggestionDiv = document.createElement('div');
            suggestionDiv.id = 'hashtagSuggestions';
            suggestionDiv.style.cssText = 'padding: 16px; background: white; margin: 16px; border-radius: 12px; border: 1px solid #e5e7eb; text-align: center;';
            suggestionDiv.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 8px;">🏷️</div>
                <div style="font-weight: 600; color: #1a202c; font-size: 16px;">Set your interests</div>
                <div style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">Add hashtags to find people with similar interests</div>
                <button onclick="app.showMandatoryHashtagSelection()" style="padding: 10px 20px; background: #0088cc; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Add Interests</button>
            `;
            exploreView.insertBefore(suggestionDiv, exploreView.firstChild);
            return;
        }
        
        var matches = [];
        for (var uid in this.users) {
            if (uid === this.user.uid) continue;
            var user = this.users[uid];
            var userTags = user.hashtags || [];
            if (userTags.length === 0) continue;
            
            var matchCount = 0;
            userTags.forEach(function(tag) {
                if (userHashtags.includes(tag)) {
                    matchCount++;
                }
            });
            
            if (matchCount > 0) {
                matches.push({
                    uid: uid,
                    user: user,
                    matchCount: matchCount
                });
            }
        }
        
        matches.sort(function(a, b) {
            return b.matchCount - a.matchCount;
        });
        
        if (matches.length > 0) {
            var suggestionDiv = document.createElement('div');
            suggestionDiv.id = 'hashtagSuggestions';
            suggestionDiv.style.cssText = 'padding: 16px; background: white; margin: 16px; border-radius: 12px; border: 1px solid #e5e7eb;';
            
            var html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-weight: 700; color: #1a202c; font-size: 16px;">🤝 People with similar interests</div>
                    <span style="font-size: 12px; color: #6b7280;">${matches.length} found</span>
                </div>
            `;
            
            matches.slice(0, 5).forEach(function(match) {
                var isFollowing = self.following[match.uid] || false;
                var tagsDisplay = match.user.hashtags.slice(0, 3).join(' • ');
                html += `
                    <div style="display: flex; align-items: center; padding: 10px; background: #f7fafc; border-radius: 10px; margin-bottom: 8px; gap: 12px;">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #006fa3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden;">
                            ${match.user.profilePhoto ? `<img src="${match.user.profilePhoto}" style="width:100%;height:100%;object-fit:cover;">` : match.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 14px; color: #1a202c;">${match.user.name}</div>
                            <div style="font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🏷️ ${tagsDisplay}</div>
                            <div style="font-size: 11px; color: #0088cc;">⭐ ${match.matchCount} shared interests</div>
                        </div>
                        <button onclick="app.openChatFromSearch('${match.uid}', '${match.user.name}')" style="padding: 6px 14px; background: #0088cc; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; white-space: nowrap;">
                            💬 Message
                        </button>
                    </div>
                `;
            });
            
            suggestionDiv.innerHTML = html;
            exploreView.insertBefore(suggestionDiv, exploreView.firstChild);
        }
    },

    // ============================================
    // MUSIC SYSTEM
    // ============================================

    currentSongIndex: 0,
    isShuffleEnabled: true,

    initMusic: function() {
        var musicEnabled = localStorage.getItem('chichi-music-enabled') === 'true';
        var toggle = document.getElementById('musicToggle');
        var toggleLabel = toggle ? toggle.parentElement : null;
       
        if (musicEnabled) {
            if (toggle) toggle.checked = true;
            this.playBackgroundMusic();
            if (toggleLabel) toggleLabel.classList.add('playing');
        } else {
            if (toggle) toggle.checked = false;
            if (toggleLabel) toggleLabel.classList.remove('playing');
        }
        
        var audio = document.getElementById('themeMusic');
        if (audio) {
            audio.addEventListener('ended', () => {
                if (document.getElementById('musicToggle') && document.getElementById('musicToggle').checked) {
                    this.playNextSong();
                }
            });
        }
    },

    toggleMusic: function() {
        var toggle = document.getElementById('musicToggle');
        var isEnabled = toggle.checked;
        var toggleLabel = toggle.parentElement;
       
        localStorage.setItem('chichi-music-enabled', isEnabled ? 'true' : 'false');
       
        if (isEnabled) {
            this.isShuffleEnabled = true;
            this.currentSongIndex = 0;
            this.playBackgroundMusic();
            if (toggleLabel) toggleLabel.classList.add('playing');
            this.toast('🎵 Music ON - Shuffle Mode', 'success');
        } else {
            this.stopBackgroundMusic();
            if (toggleLabel) toggleLabel.classList.remove('playing');
            this.toast('🔇 Music OFF', 'success');
        }
    },

    playBackgroundMusic: function() {
        var audio = document.getElementById('themeMusic');
        if (!audio) return;
        
        var musicUrl = MUSIC_PLAYLIST[this.currentSongIndex];
       
        audio.src = musicUrl;
        audio.volume = 0;
        audio.loop = false;
       
        audio.play().then(() => {
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
    },

    stopBackgroundMusic: function() {
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
    },

    getRandomSongIndex: function() {
        var randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
        } while (randomIndex === this.currentSongIndex && MUSIC_PLAYLIST.length > 1);
        return randomIndex;
    },

    playNextSong: function() {
        if (this.isShuffleEnabled) {
            this.currentSongIndex = this.getRandomSongIndex();
        } else {
            this.currentSongIndex = (this.currentSongIndex + 1) % MUSIC_PLAYLIST.length;
        }
        this.playBackgroundMusic();
    },

    // ============================================
    // LOAD POSTS
    // ============================================

    loadPosts: function() {
        var self = this;
        this.loadStories();
       
        console.log('📮 Loading posts from Firebase...');
        db.ref('posts').orderByChild('timestamp').limitToLast(50).on('value', s => {
            var p = [];
            s.forEach(c => {
                var post = c.val();
                if (post) {
                    post.id = c.key;
                    p.unshift(post);
                }
            });
            self.posts = p;
            self.renderFeed();
        }, err => {
            console.error('❌ Error loading posts:', err.message);
            self.posts = [];
            self.renderFeed();
        });
    },

    renderFeed: function() {
        var feedContainer = document.getElementById('feedContainer');
        if (!feedContainer) return;
       
        if (!this.posts) this.posts = [];
        
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
       
        if (navigator.share) {
            navigator.share({
                title: 'CHICHI',
                text: shareText,
                url: shareUrl
            }).catch(err => console.log('Share cancelled'));
        } else {
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
       
        if (post) {
            post.style.opacity = '0';
            post.style.transform = 'translateY(-10px)';
            post.style.transition = 'all 0.3s ease';
        }
       
        db.ref('posts/' + id).remove().then(() => {
            setTimeout(() => {
                if (post && post.parentNode) {
                    post.remove();
                }
            }, 300);
           
            var modal = document.querySelector('.modal-overlay');
            if (modal) modal.remove();
           
            this.toast('Post deleted', 'success');
           
            setTimeout(() => {
                self.loadPosts();
            }, 100);
        }).catch(err => {
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
        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to follow users', 'info');
            this.showLoginPage();
            return;
        }
        
        var self = this;
        var isFollowing = this.following[uid] || false;
       
        if (isFollowing) {
            delete this.following[uid];
        } else {
            this.following[uid] = true;
            this.balance += 0.05;
            db.ref('users/' + this.user.uid + '/balance').set(this.balance);
        }
       
        db.ref('users/' + this.user.uid + '/following').set(Object.keys(this.following).length);
        db.ref('users/' + uid + '/followers').once('value', s => {
            var followers = (s.val() || 0) + (isFollowing ? -1 : 1);
            db.ref('users/' + uid + '/followers').set(followers);
        });
       
        var modal = document.querySelector('.modal-overlay.active');
        if (modal) {
            modal.remove();
        } else {
            var anyModal = document.querySelector('.modal-overlay');
            if (anyModal) {
                anyModal.remove();
            }
        }
    },

    renderProfile: function() {
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
       
        if (this.editProfilePhoto && this.editProfilePhoto.startsWith('data:')) {
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
            var oldUserCount = Object.keys(self.users).length;
           
            self.users = {};
           
            for (var uid in allUsers) {
                var u = allUsers[uid];
                if (u && u.name && u.email) {
                    self.users[uid] = u;
                }
            }
           
            var newUserCount = Object.keys(self.users).length;
            console.log('✅ Users loaded: ' + newUserCount + ' valid users');
           
            if (oldUserCount === 0 && newUserCount > 0 && !self.unreadTrackingStarted) {
                self.unreadTrackingStarted = true;
                console.log('🔔 Users loaded for FIRST TIME! Starting unread message tracking...');
                setTimeout(() => {
                    self.trackUnreadMessages();
                }, 100);
            }
           
            if (document.getElementById('exploreView').classList.contains('active')) {
                self.loadExplore();
            }
        }, err => {
            console.error('❌ ERROR loading users from Firebase:', err.code, err.message);
        });
    },

    loadFollowing: function() {
        if (!this.user) {
            this.following = {};
            return;
        }
        
        var self = this;
        db.ref('users/' + this.user.uid + '/following').once('value', s => {
            var following = s.val() || 0;
            self.following = following || {};
            self.loadStories();
        });
    },

    searchExploreUsers: function(query) {
        var resultsContainer = document.getElementById('exploreSearchResultsList');
        var resultsSection = document.getElementById('exploreSearchResults');
        
        if (!query || query.trim() === '') {
            resultsSection.style.display = 'none';
            return;
        }
        
        var searchQuery = query.toLowerCase().trim();
        var results = [];
        
        for (var uid in this.users) {
            var user = this.users[uid];
            if (uid !== this.user.uid && user && user.name) {
                if (user.name.toLowerCase().includes(searchQuery) || (user.email && user.email.toLowerCase().includes(searchQuery))) {
                    results.push({ uid: uid, user: user });
                }
            }
        }
        
        results.sort((a, b) => (b.user.followers || 0) - (a.user.followers || 0));
        
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
    },

    // ============================================
    // TRENDING HASHTAGS
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
    },

    // ============================================
    // TRACK UNREAD MESSAGES
    // ============================================

    trackUnreadMessages: function() {
        var self = this;
        
        if (!this.user || this.isGuest) {
            console.log('ℹ️ Guest mode - skipping message tracking');
            return;
        }
       
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
               
                messagesRef.orderByChild('timestamp').once('value', s => {
                    var count = 0;
                    s.forEach(c => {
                        var m = c.val();
                        if (m && (m.text || m.image)) {
                            count++;
                        }
                    });
                    self.messageCountTracker[key] = count;
                    console.log('📊 ' + userName + ': ' + count + ' messages (baseline)');
                });
               
                messagesRef.orderByChild('timestamp').on('child_added', childSnap => {
                    var m = childSnap.val();
                    if (!m) return;
                   
                    if (m.sender !== self.user.uid && (m.text || m.image)) {
                        var notifyKey = key + '_' + m.timestamp;
                       
                        if (!self.notifiedMessages[notifyKey]) {
                            console.log('🔔 [REAL-TIME] NEW MESSAGE from ' + userName + ': ' + (m.text || '📷 Image'));
                            self.notifyNewMessage(userName, m.text || '📷 Image');
                            self.notifiedMessages[notifyKey] = true;
                        }
                    }
                });
               
                messagesRef.on('value', s => {
                    var unreadCount = 0;
                    var messages = [];
                   
                    s.forEach(c => {
                        var m = c.val();
                        if (m && (m.text || m.image)) {
                            messages.push(m);
                            if (m.sender !== self.user.uid && !m.read) {
                                unreadCount++;
                            }
                        }
                    });
                   
                    if (!self.unreadMessages[key]) {
                        self.unreadMessages[key] = { userName: userName };
                    }
                    self.unreadMessages[key].count = unreadCount;
                    self.unreadMessages[key].messages = messages;
                   
                    self.updateUnreadBadge();
                    self.loadMessages();
                });
            }
        });
    },

    // ============================================
    // CHECK AND SHOW HASHTAG POPUP
    // ============================================

    checkAndShowHashtagPopup: function() {
        if (!this.user) return;
        
        var userHashtags = this.profile.hashtags || [];
        console.log('🏷️ User hashtags:', userHashtags);
        
        if (userHashtags.length === 0) {
            console.log('⚠️ User has no hashtags - showing popup');
            this.showMandatoryHashtagSelection();
        }
    },

    // ============================================
    // SEARCH MESSAGES
    // ============================================

    searchMessages: function(query) {
        var items = document.querySelectorAll('.message-item');
        var searchQuery = query.toLowerCase().trim();
       
        items.forEach(item => {
            var nameEl = item.querySelector('.message-item-name');
            var previewEl = item.querySelector('.message-item-preview');
            var name = (nameEl ? nameEl.textContent : '').toLowerCase();
            var preview = (previewEl ? previewEl.textContent : '').toLowerCase();
           
            if (name.includes(searchQuery) || preview.includes(searchQuery) || !searchQuery) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    filterMessages: function(filter) {
        console.log('🔍 Filtering messages:', filter);
        
        document.querySelectorAll('.message-filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
        
        this.loadMessages();
    }
};

// ============================================
// INITIALIZE APP
// ============================================

app.init();
app.initMusic();

console.log('%c✅ CHICHI App Loaded Successfully!', 'color: #00D4AA; font-size: 16px; font-weight: bold;');
console.log('%c📱 All features: Stories, Chat, Heatmap, Hashtags, Explore, Groups, Music', 'color: #0088cc; font-size: 12px;');
console.log('%c👨‍💻 Built by Anthony Onchari - Version V01A.01', 'color: #6b7280; font-size: 11px;');