// ============================================
// CHICHI - APP.JS (COMPLETE FIXED)
// ============================================

// Get Firebase instances
var auth = null;
var db = null;

// Wait for Firebase to be ready
function initFirebase() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        auth = firebase.auth();
        db = firebase.database();
        console.log('✅ Firebase ready in app.js');
        return true;
    }
    return false;
}

// Try to init, retry if needed
if (!initFirebase()) {
    var retryCount = 0;
    var firebaseRetry = setInterval(function() {
        retryCount++;
        if (initFirebase() || retryCount > 20) {
            clearInterval(firebaseRetry);
            if (retryCount > 20) {
                console.error('❌ Firebase failed to initialize after 20 retries');
            }
        }
    }, 500);
}

// ============================================
// APP OBJECT
// ============================================

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
    currentView: 'feed',
    heatmapMap: null,
    heatmapListenerSetup: false,
    blockedUsers: {},
    onlineInterval: null,
    editProfilePhoto: null,
    triviaInterval: null,
    currentTrivia: null,
    triviaAnswered: false,
    triviaTimeout: null,
    triviaTimer: null,
    suspiciousActivityDetected: false,
    actionTimestamps: {},
    isAdmin: false,
    backPressCount: 0,
    pendingTrivia: null,
    trendingHashtags: [],
    engagementStats: {
        lastLogin: null,
        postsCount: 0,
        commentsCount: 0,
        likesCount: 0,
        totalEarned: 0,
        totalSpent: 0
    },
    _selectedRecipient: null,
    postsLoading: false,
    presenceStatus: {},
    currentFeedTab: 'forYou',

    // ============================================
    // INIT
    // ============================================

    init: function() {
        var self = this;

        // Ensure DOM is ready before proceeding
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() { self.init(); });
            return;
        }

        if (!auth || !db) {
            console.log('⏳ Waiting for Firebase...');
            // Show app skeleton to let guests browse the Feed while Firebase initializes
            if (!self._guestViewShown) {
                self._guestViewShown = true;
                self.isGuest = true;
                try { self.updateHeaderMenu(); } catch (e) {}
                try { self.showApp(); } catch (e) { console.error('Early showApp error:', e); }
                try { self.switchView('feed'); } catch (e) { console.error('Early switchView error:', e); }
            }

            // ----- FALLBACK: Force hide splash after 3 seconds as a safety net -----
            setTimeout(function() {
                var splash = document.querySelector('#splashScreen, #loadingScreen, .splash-screen, .splash');
                if (splash) {
                    splash.style.display = 'none';
                    splash.style.opacity = '0';
                    if (splash.parentNode) splash.parentNode.removeChild(splash);
                }
            }, 3000);

            setTimeout(function() { self.init(); }, 1000);
            return;
        }

        this.chatMessages = {};
        this.unreadMessages = {};
        this.notifiedMessages = {};

        var interactionHandler = function() {
            if (!self.userHasInteracted) {
                self.userHasInteracted = true;
                console.log('👆 User interaction detected');
                document.removeEventListener('click', interactionHandler);
                document.removeEventListener('touch', interactionHandler);
                document.removeEventListener('keydown', interactionHandler);
            }
        };
        document.addEventListener('click', interactionHandler, { once: false });
        document.addEventListener('touch', interactionHandler, { once: false });
        document.addEventListener('keydown', interactionHandler, { once: false });

        this.initConsent();
        this.initActivityTracking();
        this.initSuspiciousActivityDetection();
        this.loadEngagementStats();

        // ========== HANDLE GOOGLE REDIRECT RESULT ==========
        this.handleRedirectResult();

        auth.onAuthStateChanged(function(u) {
            var loadingTimeout = setTimeout(function() {
                var loading = document.getElementById('loadingScreen');
                if (loading) {
                    loading.classList.remove('active');
                    loading.style.display = 'none';
                }
            }, 5000);

            clearTimeout(loadingTimeout);

            if (u) {
                self.user = u;
                self.isGuest = false;
                self.isAdmin = u.email === 'support@chichi.buzz';

                db.ref('bannedUsers/' + u.uid).once('value', function(snapshot) {
                    if (snapshot.exists()) {
                        var banData = snapshot.val();
                        self.showBannedScreen(banData);
                        auth.signOut();
                        return;
                    }
                });

                var authPage = document.getElementById('authPage');
                if (authPage) {
                    authPage.style.display = 'none';
                    authPage.classList.remove('show');
                    authPage.classList.add('hidden');
                }

                db.ref('users/' + u.uid).once('value', function(s) {
                    if (s.exists()) {
                        self.profile = s.val();
                        self.balance = self.profile.balance || 0;
                        self.trackLogin();

                        // IMPORTANT: Always ensure email is saved (even for existing users)
                        if (!self.profile.email && u.email) {
                            db.ref('users/' + u.uid + '/email').set(u.email);
                            self.profile.email = u.email;  // Update local copy too
                        }
                    } else {
                        self.profile = {
                            name: u.displayName || 'User',
                            email: u.email || '',
                            username: (u.email || 'user').split('@')[0] || 'user',
                            bio: '',
                            profilePhoto: u.photoURL || '',
                            coverImage: '',
                            balance: 0,
                            followers: 0,
                            following: 0,
                            triviaAnswered: [],
                            tier: 'free',
                            interests: [],
                            createdAt: new Date().toLocaleString('en-KE')
                        };

                        // Save new user profile to Firebase (WITH email from Auth)
                        db.ref('users/' + u.uid).set(self.profile);
                    }

                    // ABSOLUTE SAFETY: Ensure email is ALWAYS saved when user logs in
                    if (u.email && (!self.profile.email || self.profile.email.trim() === '')) {
                        db.ref('users/' + u.uid).update({
                            email: u.email
                        });
                    }
                    self.loadProfile();
                    self.checkAndShowUsernameSetup();
                    self.showApp();
                    // CRITICAL: Always show feed as default view on login
                    setTimeout(function() {
                        self.switchView('feed');
                    }, 100);
                    self.setOnlineStatus();
                    self.startTriviaTimer();
                    self.logUserActivity('login', 'User logged in');
                    self.updateHeaderMenu(); // <-- NEW: Update menu when logged in

                    setTimeout(function() {
                        var mainApp = document.getElementById('mainApp');
                        if (mainApp) {
                            mainApp.style.display = 'flex';
                            mainApp.classList.add('active');
                        }
                        var nav = document.querySelector('.bottom-nav');
                        if (nav) nav.style.display = 'flex';
                        self.switchView('feed');
                        if (self.currentView === 'messages') {
                            self.loadMessages();
                        }
                        self.checkCoinNotifications();
                    }, 100);
                });
            } else {
                self.user = null;
                self.isGuest = true;
                self.isAdmin = false;
                self.profile = { name: 'Guest', balance: 0, triviaAnswered: [], tier: 'free' };
                self.updateHeaderMenu(); // <-- NEW: Update menu for guest
                self.showApp(); // <-- CHANGED: Show app instead of login page
                self.switchView('feed'); // ensure feed renders once Firebase is fully ready

                // Hide auth page
                var authPage = document.getElementById('authPage');
                if (authPage) {
                    authPage.style.display = 'none';
                    authPage.classList.remove('show');
                    authPage.classList.add('hidden');
                }

                if (self.onlineInterval) {
                    clearInterval(self.onlineInterval);
                    self.onlineInterval = null;
                }
                if (self.triviaInterval) {
                    clearInterval(self.triviaInterval);
                    self.triviaInterval = null;
                }
            }
        });

        document.getElementById('photoInput').addEventListener('change', function(e) { this.previewPhoto(e); }.bind(this));

        setTimeout(function() {
            var chatInput = document.getElementById('chatMessageInput');
            if (chatInput) {
                chatInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        self.sendChatMessage();
                    }
                });

                chatInput.addEventListener('focus', function() {
                    setTimeout(function() {
                        var chatMessages = document.getElementById('chatMessages');
                        if (chatMessages) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }, 100);
                });
            }
        }, 500);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                self.goBack();
            }
        });

        if (typeof window.cordova !== 'undefined') {
            document.addEventListener('backbutton', function() {
                self.goBack();
            }, false);
        }

        window.addEventListener('popstate', function() {
            history.pushState(null, null, window.location.href);
            self.goBack();
        });

        history.pushState(null, null, window.location.href);

        setTimeout(function() {
            self.setupHeatmapListener();
        }, 1000);

        this.loadDarkModePreference();
        this.setupConnectivityListeners();
        
        setTimeout(function() {
            self.checkCoinNotifications();
        }, 3000);
    },

    // ============================================
    // ENGAGEMENT TRACKING
    // ============================================

    loadEngagementStats: function() {
        var stats = localStorage.getItem('chichi_engagement_stats');
        if (stats) {
            try {
                this.engagementStats = JSON.parse(stats);
            } catch(e) { }
        }
    },

    saveEngagementStats: function() {
        localStorage.setItem('chichi_engagement_stats', JSON.stringify(this.engagementStats));
    },

    trackLogin: function() {
        var today = new Date().toDateString();
        this.engagementStats.lastLogin = today;
        this.engagementStats.totalLogins = (this.engagementStats.totalLogins || 0) + 1;
        this.saveEngagementStats();

        if (this.user) {
            db.ref('analytics/loginHistory/' + this.user.uid + '/' + Date.now()).set({
                date: today,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    },

    trackRevenue: function(type, amount, item) {
        if (!this.user) return;
        var today = new Date().toDateString();

        var revenueData = {
            userId: this.user.uid,
            userName: this.profile.name || 'User',
            type: type,
            amount: amount,
            item: item || '',
            date: today,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        db.ref('analytics/revenue').push(revenueData);

        if (type === 'earned') {
            this.engagementStats.totalEarned = (this.engagementStats.totalEarned || 0) + amount;
        } else if (type === 'spent') {
            this.engagementStats.totalSpent = (this.engagementStats.totalSpent || 0) + amount;
        }
        this.saveEngagementStats();
    },

    // ============================================
    // CONSENT FUNCTIONS
    // ============================================

    initConsent: function() {
        var consentGiven = localStorage.getItem('userConsent');
        if (!consentGiven) {
            this.checkUserLocation();
        }
    },

    checkUserLocation: function() {
        var self = this;
        fetch('https://ipapi.co/json/')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                var eaaCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
                var ukSwissCountries = ['GB', 'CH'];

                if (eaaCountries.includes(data.country_code) || ukSwissCountries.includes(data.country_code)) {
                    document.getElementById('consentBanner').classList.add('show');
                }
            })
            .catch(function() {
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
        modal.innerHTML = `<div class="modal" style="max-width:400px;">
            <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
            <h2 style="margin-bottom:16px;font-weight:700;">Cookie & Consent Settings</h2>

            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">Essential Cookies</div>
                    <input type="checkbox" checked disabled style="cursor:not-allowed;">
                </div>
                <div style="font-size:0.85rem;color:var(--text-light);margin-bottom:12px;">
                    Required for basic site functionality. Always enabled.
                </div>
            </div>

            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">Analytics Cookies</div>
                    <input type="checkbox" id="analyticsCookie" checked>
                </div>
                <div style="font-size:0.85rem;color:var(--text-light);margin-bottom:12px;">
                    Help us understand how you use our site.
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">Advertising Cookies</div>
                    <input type="checkbox" id="adsCookie" checked>
                </div>
                <div style="font-size:0.85rem;color:var(--text-light);margin-bottom:12px;">
                    Allow personalized ads and ad measurement.
                </div>
            </div>

            <div style="display:flex;gap:12px;">
                <button class="logout-cancel" onclick="app.rejectConsent(); this.closest('.modal-overlay').remove();" style="flex:1;padding:12px;">Reject All</button>
                <button class="btn-submit" onclick="app.saveConsentPreferences(); this.closest('.modal-overlay').remove();" style="flex:1;">Save Settings</button>
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

    // ============================================
    // NOTIFICATION FUNCTIONS
    // ============================================

    initNotifications: function() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(function(permission) {
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
        setTimeout(function() {
            self.trackUnreadMessages();
            console.log('✅ Notifications configured and tracking started');
        }, 500);
    },

    requestNotificationPermission: function() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    console.log('✅ Notifications enabled!');
                    this.toast('Notifications enabled! 🔔', 'success');
                }
            }.bind(this));
        }
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

        modal.innerHTML = `<div class="modal" style="max-width:400px;">
            <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
            <h2 style="margin-bottom:16px;font-weight:700;">🔔 Notification Preferences</h2>

            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">💬 New Messages</div>
                    <input type="checkbox" id="notif-messages" ${notifSettings.messages ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">👥 New Followers</div>
                    <input type="checkbox" id="notif-followers" ${notifSettings.followers ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">❤️ Likes</div>
                    <input type="checkbox" id="notif-likes" ${notifSettings.likes ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">💬 Comments</div>
                    <input type="checkbox" id="notif-comments" ${notifSettings.comments ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:600;">📝 New Posts</div>
                    <input type="checkbox" id="notif-posts" ${notifSettings.posts ? 'checked' : ''} onchange="app.updateNotificationSettings()">
                </div>
            </div>

            <div style="background:rgba(0,212,170,0.05);padding:12px;border-radius:8px;margin-bottom:16px;font-size:0.85rem;color:var(--text-light);">
                ✓ Notifications enabled! You will receive updates for your selected preferences.
            </div>

            <button class="btn-submit" style="width:100%;" onclick="this.closest('.modal-overlay').remove()">Close</button>
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

    notifyNewMessage: function(senderName, messageText, senderUid) {
    // Suppress notification if we're currently in this chat
    if (this.currentChat && this.currentChat.uid === senderUid) {
        console.log('🔕 In chat, suppressing notification');
        return;
    }

    var cleanMessage = messageText ? messageText.substring(0, 150) : '📷 Image';

    // System notification (for background)
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

    // In‑app custom notification
    this.showCustomNotification(senderName, cleanMessage);
    this.updateBrowserTitle();

    if (navigator.vibrate && this.userHasInteracted) {
        try {
            navigator.vibrate([200, 100, 200]);
        } catch (e) {
            console.log('⏸️ Vibration blocked:', e.message);
        }
    }
},

// ===== NEW: Beautiful Custom Notification =====
    showCustomNotification: function(senderName, message) {
    // Remove existing notification if any
    var existing = document.querySelector('.chichi-notification');
    if (existing) existing.remove();

    // Get sender photo if available
    var senderPhoto = '';
    var senderUid = null;
    var self = this;

    // Find the sender's UID and photo
    for (var uid in this.users) {
        if (this.users[uid] && this.users[uid].name === senderName) {
            senderUid = uid;
            senderPhoto = this.users[uid].profilePhoto || '';
            break;
        }
    }

    var notification = document.createElement('div');
    notification.className = 'chichi-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 380px;
        width: 100%;
        background: white;
        border-radius: 16px;
        padding: 16px 18px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
        z-index: 99999;
        transform: translateX(120%);
        transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        border-left: 5px solid #0088cc;
        display: flex;
        align-items: center;
        gap: 14px;
        cursor: pointer;
        backdrop-filter: blur(10px);
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-sizing: border-box;
    `;

    var avatarUrl = senderPhoto || 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png';
    var initial = senderName.charAt(0).toUpperCase();

    notification.innerHTML = `
        <div style="flex-shrink: 0; position: relative;">
            <div style="
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #0088cc, #006fa3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 700;
                font-size: 18px;
                background-image: url('${avatarUrl}');
                background-size: cover;
                background-position: center;
                border: 2px solid #0088cc;
            ">
                ${!senderPhoto ? initial : ''}
            </div>
            <div style="
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 14px;
                height: 14px;
                background: #22c55e;
                border-radius: 50%;
                border: 2px solid white;
            "></div>
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="
                font-weight: 700;
                font-size: 14px;
                color: #1a202c;
                margin-bottom: 2px;
                display: flex;
                align-items: center;
                gap: 6px;
            ">
                ${senderName}
                <span style="
                    font-size: 9px;
                    background: #0088cc;
                    color: white;
                    padding: 1px 8px;
                    border-radius: 10px;
                    font-weight: 600;
                ">NEW</span>
            </div>
            <div style="
                font-size: 13px;
                color: #4a5568;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 220px;
            ">
                ${message}
            </div>
            <div style="
                font-size: 10px;
                color: #a0aec0;
                margin-top: 2px;
            ">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
        <button onclick="event.stopPropagation(); this.closest('.chichi-notification').remove();" style="
            background: none;
            border: none;
            color: #a0aec0;
            font-size: 18px;
            cursor: pointer;
            padding: 4px;
            transition: 0.2s;
            flex-shrink: 0;
        " onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#a0aec0'">
            ✕
        </button>
    `;

    document.body.appendChild(notification);

    // Slide in animation
    setTimeout(function() {
        notification.style.transform = 'translateX(0)';
    }, 50);

    // Auto dismiss after 5 seconds
    var autoDismiss = setTimeout(function() {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(120%)';
            setTimeout(function() {
                if (notification.parentNode) notification.remove();
            }, 450);
        }
    }, 5000);

    // Click to open chat
    notification.addEventListener('click', function(e) {
        // Don't trigger if clicking the close button
        if (e.target.closest('button')) return;

        clearTimeout(autoDismiss);
        notification.style.transform = 'translateX(120%)';
        setTimeout(function() {
            if (notification.parentNode) notification.remove();
        }, 450);

        if (senderUid) {
            self.openChat(senderUid, senderName);
            self.switchView('messages');
        }
    });

    // Close on swipe (touch)
    var startX = 0;
    notification.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
    });
    notification.addEventListener('touchmove', function(e) {
        var diff = startX - e.touches[0].clientX;
        if (diff > 50) {
            notification.style.transform = 'translateX(120%)';
            setTimeout(function() {
                if (notification.parentNode) notification.remove();
            }, 450);
        }
    });
},

    playNotificationSound: function() {
        if (!this.userHasInteracted) {
            console.log('⏸️ Audio disabled (no user interaction yet)');
            return;
        }

        try {
            var audioContext = new (window.AudioContext || window.webkitAudioContext)();

            if (audioContext.state === 'suspended') {
                audioContext.resume().catch(function(e) {
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

        userIds.forEach(function(uid) {
            if (uid !== this.user.uid) {
                var chatKey = [this.user.uid, uid].sort().join('_');
                if (this.unreadMessages && this.unreadMessages[chatKey]) {
                    totalUnread += this.unreadMessages[chatKey].count || 0;
                }
            }
        }.bind(this));

        if (totalUnread > 0) {
            document.title = '💬 (' + totalUnread + ') CHICHI';
        } else {
            document.title = 'CHICHI';
        }
    },

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

    userIds.forEach(function(uid) {
        if (uid !== self.user.uid) {
            var key = [self.user.uid, uid].sort().join('_');
            var userName = (this.users[uid] || {}).name || 'User';
            var messagesRef = db.ref('chats/' + key + '/messages');

            messagesRef.orderByChild('timestamp').once('value', function(s) {
                var count = 0;
                s.forEach(function(c) {
                    var m = c.val();
                    if (m && (m.text || m.image)) {
                        count++;
                    }
                });
                self.messageCountTracker[key] = count;
                console.log('📊 ' + userName + ': ' + count + ' messages (baseline)');
                messagesRef.orderByChild('timestamp').on('child_added', function(childSnap) {
                    var m = childSnap.val();
                    if (!m) return;

                    if (m.sender !== self.user.uid && (m.text || m.image)) {
                        var notifyKey = key + '_' + childSnap.key;

                        if (!self.notifiedMessages[notifyKey]) {
                            console.log('🔔 [REAL-TIME] NEW MESSAGE from ' + userName + ': ' + (m.text || '📷 Image'));
                            self.notifiedMessages[notifyKey] = true;
                            self.notifyNewMessage(userName, m.text || '📷 Image', m.sender);
                        }
                    }
                });
            });

            messagesRef.on('value', function(s) {
                var unreadCount = 0;
                var messages = [];

                s.forEach(function(c) {
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
    }.bind(this));
},
    // ============================================
    // BANNED SCREEN
    // ============================================

    showBannedScreen: function(banData) {
        var html = `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:#0f172a;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
                <div style="background:white;border-radius:24px;max-width:400px;width:100%;padding:32px;text-align:center;">
                    <div style="font-size:64px;margin-bottom:16px;">🚫</div>
                    <h2 style="color:#ef4444;margin-bottom:8px;">Account Suspended</h2>
                    <p style="color:#6b7280;margin-bottom:16px;">Your account has been permanently banned from CHICHI.</p>
                    <div style="background:#fef2f2;padding:12px;border-radius:8px;margin-bottom:16px;text-align:left;">
                        <div style="font-size:13px;color:#991b1b;font-weight:600;">Reason:</div>
                        <div style="font-size:14px;color:#7f1d1d;">${banData.reason || 'Violation of terms of service'}</div>
                        ${banData.bannedAt ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">Banned on: ${banData.bannedAt}</div>` : ''}
                    </div>
                    <button onclick="window.location.reload()" style="background:#0088cc;color:white;border:none;padding:12px 24px;border-radius:10px;font-weight:600;cursor:pointer;width:100%;">OK</button>
                </div>
            </div>
        `;
        var existing = document.getElementById('bannedScreen');
        if (existing) existing.remove();
        var div = document.createElement('div');
        div.id = 'bannedScreen';
        div.innerHTML = html;
        document.body.appendChild(div);
    },

    // ============================================
    // ACTIVITY TRACKING
    // ============================================

    initActivityTracking: function() {
        var self = this;
        this.trackPageView();

        document.addEventListener('click', function(e) {
            var target = e.target;
            self.logUserActivity('click', {
                tag: target.tagName.toLowerCase(),
                text: target.textContent ? target.textContent.substring(0, 50) : '',
                id: target.id || '',
                className: target.className || ''
            });
        });

        var scrollTimeout;
        window.addEventListener('scroll', function() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(function() {
                var scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
                if (scrollPercent > 0 && scrollPercent % 25 === 0) {
                    self.logUserActivity('scroll', 'Scrolled to ' + scrollPercent + '%');
                }
            }, 500);
        });

        var startTime = Date.now();
        window.addEventListener('beforeunload', function() {
            var timeSpent = Math.round((Date.now() - startTime) / 1000);
            self.logUserActivity('session_end', 'Time spent: ' + timeSpent + ' seconds');
        });

        console.log('📊 Activity tracking initialized');
    },

    trackPageView: function() {
        this.logUserActivity('page_view', {
            page: window.location.pathname,
            title: document.title,
            referrer: document.referrer || 'direct'
        });
    },

    logUserActivity: function(action, details) {
        if (!this.user && !this.isGuest) return;

        var userId = this.user ? this.user.uid : 'guest';
        var userName = this.user ? (this.profile.name || this.user.email || 'User') : 'Guest';

        var safeDetails = typeof details === 'string' ? details : JSON.stringify(details);
        if (safeDetails.length > 200) {
            safeDetails = safeDetails.substring(0, 200) + '...';
        }

        db.ref('activityLogs').push({
            userId: userId,
            userName: userName,
            userEmail: this.user ? this.user.email : 'guest@chichi.com',
            action: action,
            details: safeDetails,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            time: new Date().toLocaleString('en-KE'),
            isAdmin: this.isAdmin || false
        }).catch(function(err) {
            console.log('⚠️ Failed to log activity:', err.message);
        });

        this.checkForSuspiciousActivity(action, details);
    },

    checkAndShowUsernameSetup: function() {
        if (!this.user) return;

        var hasUsername = this.profile && this.profile.username && this.profile.username.trim() !== '';
        var shownUsernamePopup = sessionStorage.getItem('shownUsernamePopup_' + this.user.uid);

        if (!hasUsername && !shownUsernamePopup) {
            sessionStorage.setItem('shownUsernamePopup_' + this.user.uid, 'true');
            this.showUsernameSetupModal();
        }
    },

    showUsernameSetupModal: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'usernameSetupModal';
        modal.style.zIndex = '10000';
        modal.style.backdropFilter = 'blur(8px)';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 32px 28px; max-width: 440px; width: 95%; text-align: center; animation: slideUp 0.4s ease; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);">
                <div style="font-size: 40px; margin-bottom: 16px;">👤</div>
                <h2 style="font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;">Create Your Username</h2>
                <p style="font-size: 14px; color: #64748b; margin: 0 0 24px 0; line-height: 1.6;">You need a unique username to connect with other users.</p>

                <div style="margin-bottom: 20px;">
                    <input type="text" id="setupUsername" placeholder="e.g. anthony_onchari" maxlength="30" style="width: 100%; padding: 13px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 14px; font-family: inherit; box-sizing: border-box; transition: 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'" onkeyup="document.getElementById('usernameHint').textContent = '@' + this.value">
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 8px; text-align: left;">
                        Your username: <span id="usernameHint" style="color: #3b82f6; font-weight: 600;">@</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; text-align: left;">
                        Use letters, numbers, and underscores only. Min 3 characters.
                    </div>
                </div>

                <button onclick="app.saveNewUsername()" style="width: 100%; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 13px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.3s; margin-bottom: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 20px rgba(59, 130, 246, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    Continue
                </button>
                <p style="font-size: 11px; color: #94a3b8; margin: 0;">You can change this later in settings</p>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('setupUsername').focus();

        document.getElementById('setupUsername').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                self.saveNewUsername();
            }
        });
    },

    saveNewUsername: function() {
        var username = document.getElementById('setupUsername').value.trim();

        if (!username || username.length < 3) {
            this.toast('Username must be at least 3 characters', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.toast('Username can only contain letters, numbers, and underscores', 'error');
            return;
        }

        var self = this;

        db.ref('users').orderByChild('username').equalTo(username).once('value')
            .then(function(snapshot) {
                if (snapshot.exists()) {
                    self.toast('This username is already taken', 'error');
                    return;
                }

                db.ref('users/' + self.user.uid + '/username').set(username);
                self.profile.username = username;
                self.toast('Username set to @' + username, 'success');
                self.logUserActivity('username_setup', 'Set username to ' + username);
                document.getElementById('usernameSetupModal').remove();
            })
            .catch(function(err) {
                console.error('Error checking username:', err);
                self.toast('Error saving username', 'error');
            });
    },

    // ============================================
    // SUSPICIOUS ACTIVITY DETECTION
    // ============================================

    initSuspiciousActivityDetection: function() {
        this.actionTimestamps = {};
        console.log('🛡️ Suspicious activity detection initialized');
    },

    checkForSuspiciousActivity: function(action, details) {
        var self = this;
        var userId = this.user ? this.user.uid : 'guest';
        var now = Date.now();

        var key = action + '_' + userId;
        if (!this.actionTimestamps[key]) {
            this.actionTimestamps[key] = [];
        }
        this.actionTimestamps[key].push(now);
        this.actionTimestamps[key] = this.actionTimestamps[key].filter(function(t) {
            return now - t < 10000;
        });

        if (this.actionTimestamps[key].length > 15) {
            this.reportSuspiciousActivity(
                'Rapid ' + action + ' - ' + this.actionTimestamps[key].length + ' times in 10 seconds',
                'medium',
                { action: action, count: this.actionTimestamps[key].length }
            );
            this.actionTimestamps[key] = [];
        }
    },

    reportSuspiciousActivity: function(reason, severity, data) {
        if (this.suspiciousActivityDetected) return;
        this.suspiciousActivityDetected = true;

        console.log('🚨 SUSPICIOUS ACTIVITY DETECTED:', reason);

        var self = this;
        var userId = this.user ? this.user.uid : 'unknown';
        var userName = this.user ? (this.profile.name || this.user.email || 'Unknown') : 'Guest';

        db.ref('suspiciousActivity').push({
            userId: userId,
            userName: userName,
            userEmail: this.user ? this.user.email : 'guest@chichi.com',
            reason: reason,
            severity: severity || 'medium',
            data: data || {},
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            time: new Date().toLocaleString('en-KE'),
            status: 'pending'
        });

        if (this.isAdmin) {
            this.toast('🚨 Suspicious activity detected: ' + reason, 'error');
        }

        setTimeout(function() {
            self.suspiciousActivityDetected = false;
        }, 30000);
    },

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

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
            this.logUserActivity('admin_login', 'Admin logged in');
        } else {
            this.toast('❌ Wrong password', 'error');
            this.logUserActivity('admin_login_failed', 'Failed admin login attempt');
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminPassword').focus();
        }
    },

    openAdminPortal: function() {
        if (!this.user || !this.isAdmin) {
            this.toast('Admin access required', 'error');
            return;
        }
        this.adminOpen = true;
        document.getElementById('mainApp').classList.remove('active');
        document.getElementById('adminPortal').classList.add('active');
        document.querySelector('.bottom-nav').style.display = 'none';
        this.loadAdminDashboard();
        this.loadAdminUsers();
        this.loadAdminPosts();
        this.loadActivityLog();
        this.loadSuspiciousActivity();
        this.loadAdminNotifications();
        this.loadAdminAnalytics();
        this.loadAdminGifts();
        if (typeof this.loadAdminAirtimeRequests === 'function') this.loadAdminAirtimeRequests();
        if (typeof this.loadAdminPostConsents === 'function') this.loadAdminPostConsents();
    },

    closeAdminPortal: function() {
        this.adminOpen = false;
        document.getElementById('adminPortal').classList.remove('active');
        document.getElementById('mainApp').classList.add('active');
        document.querySelector('.bottom-nav').style.display = 'flex';
    },


    switchAdminTab: function(tab) {
        document.querySelectorAll('.admin-tab').forEach(function(t) { if (t && t.classList) t.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-content').forEach(function(c) { if (c && c.classList) c.classList.remove('active'); });

        var buttons = document.querySelectorAll('.admin-tab');
        var tabMap = ['dashboard', 'users', 'incomplete', 'posts', 'analytics', 'gifts', 'admins', 'notifications', 'suspicious', 'logs', 'email'];
        var tabIndex = tabMap.indexOf(tab);
        if (tabIndex >= 0) {
            buttons[tabIndex].classList.add('active');
        }

        var contentMap = {
            'dashboard': 'adminDashboard',
            'users': 'adminUsers',
            'incomplete': 'adminIncomplete',
            'posts': 'adminPosts',
            'analytics': 'adminAnalytics',
            'gifts': 'adminGifts',
            'admins': 'adminAdmins',
            'notifications': 'adminNotificationsTab',
            'suspicious': 'adminSuspicious',
            'logs': 'adminLogs',
            'email': 'adminEmail'
        };

        var contentId = contentMap[tab];
        if (contentId) {
            document.getElementById(contentId).classList.add('active');
        }

        if (tab === 'users') this.loadAdminUsers();
        if (tab === 'incomplete') this.loadIncompleteUsers();
        if (tab === 'posts') this.loadAdminPosts();
        if (tab === 'analytics') this.loadAdminAnalytics();
        if (tab === 'gifts') this.loadAdminGifts();
        if (tab === 'admins') this.loadAdminList();
        if (tab === 'logs') this.loadActivityLog();
        if (tab === 'notifications') this.loadAdminNotifications();
        if (tab === 'suspicious') this.loadSuspiciousActivity();
    },
    // ============================================

    loadAdminDashboard: function() {
        var self = this;

        var userCount = Object.keys(this.users || {}).length;
        var postCount = (this.posts || []).length;

        var today = new Date().toLocaleDateString('en-KE');
        var todaySignups = 0;

        for (var uid in this.users) {
            var user = this.users[uid];
            if (user.createdAt) {
                var createdDate = user.createdAt.split(',')[0];
                if (createdDate === today) todaySignups++;
            }
        }

        document.getElementById('adminUserCount').textContent = userCount;
        document.getElementById('adminPostCount').textContent = postCount;
        document.getElementById('adminSignupCount').textContent = todaySignups;

        db.ref('analytics/revenue').once('value', function(snap) {
            var totalEarned = 0;
            var totalSpent = 0;
            var transactions = 0;

            snap.forEach(function(child) {
                var data = child.val();
                if (data.type === 'earned') {
                    totalEarned += data.amount || 0;
                } else if (data.type === 'spent') {
                    totalSpent += data.amount || 0;
                }
                transactions++;
            });

            document.getElementById('adminTotalEarned').textContent = totalEarned.toFixed(2);
            document.getElementById('adminTotalSpent').textContent = totalSpent.toFixed(2);
        });

        db.ref('bannedUsers').once('value', function(snap) {
            var bannedCount = snap.numChildren() || 0;
            document.getElementById('adminBannedCount').textContent = bannedCount;
        });
    },

    // ============================================
    // ADMIN - USERS
    // ============================================

    // Helper: Fix incomplete user records (fill in missing email/createdAt from auth)
    fixIncompleteUserRecord: function(uid, userData) {
        var self = this;
        var needsUpdate = false;
        var updateData = {};

        // Check if email is missing
        if (!userData.email || userData.email.trim() === '') {
            // If current user, use their auth email
            if (self.user && self.user.uid === uid && self.user.email) {
                updateData.email = self.user.email;
                needsUpdate = true;
            }
            // Otherwise, we can't get it from admin panel (need backend to get auth email)
            // So we'll keep the fallback display
        }

        // Check if createdAt is missing
        if (!userData.createdAt) {
            // Generate a reasonable timestamp (use now, or based on account age if available)
            updateData.createdAt = new Date().toLocaleString('en-KE');
            needsUpdate = true;
        }

        // Check if username is missing
        if (!userData.username || userData.username.trim() === '') {
            // Try to extract from email if available
            var sourceEmail = userData.email || '';
            var autoUsername = (sourceEmail.split('@')[0] || userData.name || 'user')
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');

            updateData.username = autoUsername || 'user_' + uid.substring(0, 8);
            needsUpdate = true;
        }

        // If any updates needed, save them
        if (needsUpdate && Object.keys(updateData).length > 0) {
            db.ref('users/' + uid).update(updateData);
        }

        return { ...userData, ...updateData };
    },

    // Fix missing email for specific user
    syncUserEmail: function(uid, userName) {
        var self = this;

        // If this is the current user, we can get their email
        if (self.user && self.user.uid === uid && self.user.email) {
            db.ref('users/' + uid).update({
                email: self.user.email
            }).then(function() {
                self.toast('✅ Email synced for ' + userName, 'success');
                self.loadAdminUsers();  // Refresh the list
            }).catch(function(err) {
                self.toast('❌ Error syncing email: ' + err.message, 'error');
            });
        } else {
            self.toast('ℹ️ User must login to sync their email (server limitation)', 'info');
        }
    },

    loadAdminUsers: function() {
        var self = this;
        var html = '';

        // Load directly from Firebase to get real-time data
        db.ref('users').once('value', function(snapshot) {
            var usersData = snapshot.val() || {};
            var userArray = [];
            var usersWithoutUsername = [];

            // Convert to array
            for (var uid in usersData) {
                userArray.push({ uid: uid, user: usersData[uid] });

                var user = usersData[uid];
                if (!user.username || user.username.trim() === '') {
                    usersWithoutUsername.push({
                        uid: uid,
                        name: user.name || 'Unnamed User',
                        email: user.email || '(no email)'
                    });
                }
            }

            if (usersWithoutUsername.length > 0) {
                html += `
                    <div style="background: #fef3c7; border: 1.5px solid #fbbf24; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                        <div style="display: flex; gap: 12px; align-items: flex-start;">
                            <div style="font-size: 24px;">⚠️</div>
                            <div>
                                <div style="font-weight: 700; color: #92400e; margin-bottom: 8px;">${usersWithoutUsername.length} User${usersWithoutUsername.length > 1 ? 's' : ''} Without Username</div>
                            <div id="wallpaperAppearanceSettings" style="display:${savedWallpaper && savedWallpaper !== 'small-bubbles' ? 'block' : 'none'};margin-top:16px;padding:12px;background:#f1f7f5;border-radius:10px;">
                                <div id="wallpaperLivePreview" style="height:94px;margin-bottom:14px;border-radius:8px;overflow:hidden;background:#dbe8e3;position:relative;">
                                    <div id="wallpaperPreviewImage" style="position:absolute;inset:-16px;background-size:cover;background-position:center;"></div>
                                    <div id="wallpaperPreviewDim" style="position:absolute;inset:0;background:#08201c;"></div>
                                    <span style="position:absolute;left:10px;bottom:9px;z-index:1;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.88);color:#19302b;font-size:10px;font-weight:700;">Live preview</span>
                                </div>
                                    ${usersWithoutUsername.map(u => `
                                        <div style="background: white; border-radius: 8px; padding: 8px 12px; font-size: 12px;">
                                            <span style="font-weight: 600; color: #1e293b;">${u.name || 'Unnamed'}</span>
                                            <span style="color: #6b7280; font-size: 11px;">(${u.email || 'no email'})</span>
                                            <button onclick="app.fixUserUsername('${u.uid}', '${u.name || 'Unnamed'}', '${u.email || ''}')" style="margin-left: 8px; padding: 4px 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">Fix</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            if (userArray.length === 0) {
                html += '<div style="text-align: center; color: #6b7280; padding: 20px;">No users yet</div>';
            } else {
                html += '<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">';

                db.ref('bannedUsers').once('value', function(bannedSnap) {
                    var bannedUsers = bannedSnap.val() || {};

                    userArray.forEach(function(u) {
                        // Fix incomplete user records (fill in missing email/createdAt)
                        var fixedUser = self.fixIncompleteUserRecord(u.uid, u.user);

                        var isBanned = bannedUsers[u.uid] ? true : false;
                        var banData = bannedUsers[u.uid] || {};
                        var usernameDisplay = fixedUser.username ? `<div style="font-size: 0.75rem; color: #3b82f6; margin-top: 2px;">@${fixedUser.username}</div>` : '<div style="font-size: 0.75rem; color: #ef4444; margin-top: 2px;">❌ NO USERNAME</div>';

                        // Safe data extraction with fallbacks
                        var userEmail = fixedUser.email || '(email not set)';
                        var userCreatedAt = fixedUser.createdAt || '(date not available)';
                        var userBalance = (fixedUser.balance || 0).toFixed(2);
                        var userFollowers = fixedUser.followers || 0;

                        html += `
                            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; ${isBanned ? 'background: #fef2f2;' : ''}">
                                <div>
                                    <div style="font-weight: 600; font-size: 0.95rem;">${fixedUser.name || 'Unknown User'} ${isBanned ? '🚫' : ''}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-light);">${userEmail}</div>
                                    ${usernameDisplay}
                                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">📅 ${userCreatedAt}</div>
                                    <div style="font-size: 0.75rem; color: var(--primary);">💰 ${userBalance} Coins</div>
                                    ${isBanned ? `<div style="font-size: 0.7rem; color: #ef4444;">Banned: ${banData.reason || 'No reason'}</div>` : ''}
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    <span style="background: var(--primary); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">👥 ${userFollowers}</span>
                                    ${!fixedUser.email || fixedUser.email === '(email not set)' ? `
                                        <button onclick="app.syncUserEmail('${u.uid}', '${fixedUser.name || 'User'}')" style="padding: 6px 12px; background: #8b5cf6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">📧 Sync Email</button>
                                    ` : ''}
                                    ${!fixedUser.username ? `
                                        <button onclick="app.fixUserUsername('${u.uid}', '${fixedUser.name || 'User'}', '${userEmail}')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">Fix Username</button>
                                    ` : ''}
                                    <button onclick="app.showBalanceEditor('${u.uid}', '${fixedUser.name || 'User'}')" style="padding: 6px 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">💰 Balance</button>
                                    ${isBanned ? `
                                        <button onclick="app.unbanUser('${u.uid}', '${fixedUser.name || 'User'}')" style="padding: 6px 12px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">Unban</button>
                                    ` : `
                                        <button onclick="app.banUserFromAdmin('${u.uid}', '${fixedUser.name || 'User'}')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🚫 Ban</button>
                                    `}
                                    <button onclick="app.deleteUserByAdmin('${u.uid}', '${fixedUser.name || 'User'}')" style="padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🗑️</button>
                                </div>
                            </div>
                        `;
                    });

                    html += '</div>';
                    document.getElementById('adminUsersList').innerHTML = html;
                });
            }
        });
    },

    fixUserUsername: function(uid, name, email) {
        var self = this;
        var autoUsername = (name || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (autoUsername.length < 3) {
            autoUsername = 'user_' + uid.substring(0, 8);
        }

        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'fixUsernameModal';
        modal.style.zIndex = '10000';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 28px; max-width: 440px; width: 95%; animation: slideUp 0.3s ease; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);">
                <h2 style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;">Generate Username for ${name}</h2>
                <p style="font-size: 12px; color: #64748b; margin: 0 0 16px 0;">Email: ${email}</p>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">Username</label>
                    <input type="text" id="fixUsername" value="${autoUsername}" maxlength="30" style="width: 100%; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box; transition: 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'" onkeyup="document.getElementById('fixUsernameHint').textContent = '@' + this.value">
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
                        Preview: <span id="fixUsernameHint" style="color: #3b82f6; font-weight: 600;">@${autoUsername}</span>
                    </div>
                </div>

                <button onclick="app.saveFixedUsername('${uid}', '${name}')" style="width: 100%; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; padding: 12px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; margin-bottom: 8px;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                    Save Username
                </button>
                <button onclick="document.getElementById('fixUsernameModal').remove()" style="width: 100%; background: #e2e8f0; color: #475569; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    Cancel
                </button>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('fixUsername').focus();
    },

    saveFixedUsername: function(uid, name) {
        var username = document.getElementById('fixUsername').value.trim();

        if (!username || username.length < 3) {
            this.toast('Username must be at least 3 characters', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.toast('Username can only contain letters, numbers, and underscores', 'error');
            return;
        }

        var self = this;

        db.ref('users').orderByChild('username').equalTo(username).once('value')
            .then(function(snapshot) {
                if (snapshot.exists()) {
                    var existingUid = Object.keys(snapshot.val())[0];
                    if (existingUid !== uid) {
                        self.toast('This username is already taken', 'error');
                        return;
                    }
                }

                db.ref('users/' + uid + '/username').set(username);
                self.toast('✅ Username set to @' + username + ' for ' + name, 'success');
                self.logUserActivity('admin_fix_username', 'Admin set username to ' + username + ' for user ' + name);
                document.getElementById('fixUsernameModal').remove();
                self.loadAdminUsers();
            })
            .catch(function(err) {
                console.error('Error:', err);
                self.toast('Error saving username', 'error');
            });
    },

    loadIncompleteUsers: function() {
        var self = this;
        var html = '';
        var incomplete = [];

        db.ref('users').once('value', function(snapshot) {
            var allUsers = snapshot.val() || {};

            for (var uid in allUsers) {
                var u = allUsers[uid];
                if (!u.name || !u.email || !u.username || u.username.trim() === '') {
                    incomplete.push({
                        uid: uid,
                        email: u.email || 'NO EMAIL',
                        name: u.name || 'NO NAME',
                        username: u.username || 'NO USERNAME',
                        createdAt: u.createdAt || 'Unknown',
                        missingName: !u.name,
                        missingEmail: !u.email,
                        missingUsername: !u.username || u.username.trim() === ''
                    });
                }
            }

            if (incomplete.length === 0) {
                html = '<div style="text-align: center; color: #22c55e; padding: 20px;"><div style="font-size: 30px;">✅</div>All users have complete profiles!</div>';
            } else {
                html = '<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">';

                incomplete.forEach(function(u) {
                    var missingItems = [];
                    if (u.missingName) missingItems.push('Name');
                    if (u.missingEmail) missingItems.push('Email');
                    if (u.missingUsername) missingItems.push('Username');

                    html += `
                        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #fffbeb;">
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">
                                    ${u.missingName ? '❌ NO NAME' : u.name}
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-light);">
                                    ${u.missingEmail ? '❌ NO EMAIL' : u.email}
                                </div>
                                ${u.missingUsername ? '<div style="font-size: 0.8rem; color: #ef4444; font-weight: 600;">❌ NO USERNAME</div>' : '<div style="font-size: 0.8rem; color: #3b82f6;">@' + u.username + '</div>'}
                                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">
                                    Auth UID: ${u.uid.substring(0, 12)}...
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-light);">
                                    Signed up: ${u.createdAt}
                                </div>
                                <div style="font-size: 0.7rem; color: #ef4444; margin-top: 4px;">
                                    Missing: ${missingItems.join(', ')}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                ${u.missingUsername ? `
                                    <button onclick="app.fixUserUsername('${u.uid}', '${u.name || 'User'}', '${u.email}')" style="padding: 8px 14px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem; white-space: nowrap;">Fix Username</button>
                                ` : ''}
                                <button onclick="app.sendAdminMessage('${u.uid}', '${u.email}', '${u.name || 'User'}')" style="padding: 8px 14px; background: #0088cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem; white-space: nowrap;">💬 Message</button>
                                <button onclick="app.deleteUserByAdmin('${u.uid}', '${u.name || u.email}')" style="padding: 8px 14px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🗑️ Delete</button>
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
            }

            document.getElementById('incompleteUsersList').innerHTML = html;
        });
    },

    sendAdminMessage: function(toUid, toEmail, toName) {
        var self = this;
        var message = prompt('Send message to ' + toName + ' (' + toEmail + '):', '');

        if (!message || message.trim() === '') {
            return;
        }

        if (!this.user || !this.user.uid) {
            this.toast('❌ You must be logged in as admin', 'error');
            return;
        }

        var chatKey = [this.user.uid, toUid].sort().join('_');
        var messageData = {
            senderId: this.user.uid,
            senderName: 'ADMIN',
            senderEmail: this.user.email,
            message: message.trim(),
            timestamp: Date.now(),
            isAdmin: true,
            read: false
        };

        db.ref('chats/' + chatKey + '/messages').push(messageData).then(function() {
            self.toast('✅ Message sent to ' + toName, 'success');
        }).catch(function(err) {
            self.toast('❌ Error sending message: ' + err.message, 'error');
        });
    },

    banUserFromAdmin: function(uid, userName) {
        var reason = prompt('Enter reason for banning ' + userName + ':');
        if (!reason || reason.trim() === '') {
            this.toast('⚠️ Please provide a reason', 'error');
            return;
        }

        if (!confirm('⚠️ Ban user "' + userName + '"?\n\nReason: ' + reason)) {
            return;
        }

        var self = this;
        db.ref('bannedUsers/' + uid).set({
            reason: reason.trim(),
            bannedAt: new Date().toLocaleString('en-KE'),
            bannedBy: self.user ? self.user.email : 'Admin'
        }).then(function() {
            self.toast('✅ User "' + userName + '" has been banned', 'success');
            self.loadAdminUsers();
            self.logUserActivity('admin_ban', 'Banned user: ' + userName + ' for: ' + reason);
        }).catch(function(err) {
            self.toast('❌ Error banning user: ' + err.message, 'error');
        });
    },

    unbanUser: function(uid, userName) {
        if (!confirm('Unban user "' + userName + '"?')) return;

        var self = this;
        db.ref('bannedUsers/' + uid).remove().then(function() {
            self.toast('✅ User "' + userName + '" has been unbanned', 'success');
            self.loadAdminUsers();
            self.logUserActivity('admin_unban', 'Unbanned user: ' + userName);
        }).catch(function(err) {
            self.toast('❌ Error unbanning user: ' + err.message, 'error');
        });
    },

    deleteUserByAdmin: function(uid, userName) {
        if (!confirm('⚠️ PERMANENTLY delete user "' + userName + '"? This cannot be undone!')) return;

        var self = this;
        db.ref('users/' + uid).remove().then(function() {
            self.toast('✅ User "' + userName + '" deleted', 'success');
            self.loadAdminUsers();
            self.logUserActivity('admin_delete_user', 'Deleted user: ' + userName);
        }).catch(function(err) {
            self.toast('❌ Error deleting user: ' + err.message, 'error');
        });
    },

    // ============================================
    // ADMIN - POSTS
    // ============================================

    loadAdminPosts: function() {
        var html = '';
        if (this.posts.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No posts yet</div>';
        } else {
            this.posts.forEach(function(p) {
                var likes = (p.likes && Object.keys(p.likes).length) || 0;
                var comments = (p.comments || []).length;

                html += `
                    <div style="background: white; border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="font-weight: 700; font-size: 0.95rem;">${p.userName}</div>
                            <div style="font-size: 0.75rem; color: var(--text-light);">${p.createdAt}</div>
                        </div>
                        <div style="font-size: 0.9rem; margin-bottom: 8px; color: var(--text-light);">${p.caption.substring(0, 100)}${p.caption.length > 100 ? '...' : ''}</div>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <span style="font-size: 0.75rem; color: var(--text-light);">❤️ ${likes}</span>
                            <span style="font-size: 0.75rem; color: var(--text-light);">💬 ${comments}</span>
                            <button onclick="app.adminDeletePost('${p.id}')" style="margin-left: auto; padding: 6px 12px; background: #ff4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🗑️</button>
                        </div>
                    </div>
                `;
            });
        }
        document.getElementById('adminPostsList').innerHTML = html;
    },

    adminDeletePost: function(id) {
        if (!confirm('Delete this post?')) return;

        db.ref('posts/' + id).remove();
        this.toast('✅ Post deleted', 'success');
        this.loadAdminPosts();
        this.loadPosts();
        this.logUserActivity('admin_delete_post', 'Admin deleted post: ' + id);
    },

    // ============================================
    // ADMIN - BALANCE EDITOR
    // ============================================

    showBalanceEditor: function(uid, userName) {
        var self = this;
        if (!uid) return;

        db.ref('users/' + uid + '/balance').once('value', function(snap) {
            var currentBalance = snap.val() || 0;

            var modal = document.createElement('div');
            modal.id = 'balanceEditModal';
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal" style="max-width: 450px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="font-weight: 700; margin: 0;">Edit Balance</h2>
                        <button onclick="document.getElementById('balanceEditModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
                    </div>

                    <div style="background: #f0f7ff; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                        <div style="font-size: 12px; color: #0088cc; font-weight: 600; margin-bottom: 4px;">USER</div>
                        <div style="font-weight: 700; font-size: 18px; color: #1a202c;">${userName || 'Unknown'}</div>
                        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">UID: ${uid.substring(0, 20)}...</div>
                    </div>

                    <div style="background: #fef3c7; padding: 16px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                        <div style="font-size: 12px; color: #92400e; font-weight: 600; margin-bottom: 4px;">CURRENT BALANCE</div>
                        <div style="font-size: 28px; font-weight: 700; color: #92400e;">${currentBalance.toFixed(2)} Coins</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">New Balance (Coins)</label>
                        <input type="number" id="newBalanceInput" step="0.01" value="${currentBalance}" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;" placeholder="0.00">
                        <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">💡 Enter the exact balance you want (not a change amount)</div>
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 24px;">
                        <button onclick="document.getElementById('balanceEditModal').remove()" style="flex: 1; padding: 12px; background: #e5e7eb; color: #1a202c; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Cancel</button>
                        <button onclick="app.updateUserBalance('${uid}', document.getElementById('newBalanceInput').value, '${userName}')" style="flex: 1; padding: 12px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">✅ Save Balance</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.getElementById('newBalanceInput').focus();
        });
    },

    updateUserBalance: function(uid, newBalance, userName) {
        var balance = parseFloat(newBalance);

        if (isNaN(balance) || balance < 0) {
            this.toast('❌ Invalid balance amount', 'error');
            return;
        }

        db.ref('users/' + uid + '/balance').set(balance, function(err) {
            if (err) {
                this.toast('❌ Error: ' + err.message, 'error');
            } else {
                this.toast('✅ Balance updated to ' + balance.toFixed(2) + ' Coins', 'success');
                document.getElementById('balanceEditModal').remove();
                this.loadAdminUsers();
            }
        }.bind(this));
    },

    // ============================================
    // ADMIN - ANALYTICS
    // ============================================

    loadAdminAnalytics: function() {
        var self = this;
        var html = '';

        db.ref('analytics/revenue').once('value', function(snap) {
            var earnedByType = {};
            var spentByType = {};
            var totalEarned = 0;
            var totalSpent = 0;
            var transactions = [];

            snap.forEach(function(child) {
                var data = child.val();
                if (data.type === 'earned') {
                    totalEarned += data.amount || 0;
                    var item = data.item || 'trivia';
                    earnedByType[item] = (earnedByType[item] || 0) + data.amount;
                } else if (data.type === 'spent') {
                    totalSpent += data.amount || 0;
                    var item = data.item || 'gift';
                    spentByType[item] = (spentByType[item] || 0) + data.amount;
                }
                transactions.push(data);
            });

            html += `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                    <div style="background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Total Earned</div>
                        <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${totalEarned.toFixed(2)}</div>
                        <div style="font-size: 11px; color: #6b7280;">Coins</div>
                    </div>
                    <div style="background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Total Spent</div>
                        <div style="font-size: 28px; font-weight: 700; color: #ef4444;">${totalSpent.toFixed(2)}</div>
                        <div style="font-size: 11px; color: #6b7280;">Coins</div>
                    </div>
                    <div style="background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Transactions</div>
                        <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">${transactions.length}</div>
                        <div style="font-size: 11px; color: #6b7280;">Total</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                    <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-weight: 600; margin-bottom: 12px;">📈 Earnings Breakdown</div>
                        ${Object.keys(earnedByType).length === 0 ? '<div style="color: #6b7280; font-size: 13px;">No earnings data</div>' :
                            Object.keys(earnedByType).map(function(key) {
                                return `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px;">
                                    <span>${key}</span>
                                    <span style="font-weight: 600;">${earnedByType[key].toFixed(2)} Coins</span>
                                </div>`;
                            }).join('')
                        }
                    </div>
                    <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-weight: 600; margin-bottom: 12px;">🛍️ Spending Breakdown</div>
                        ${Object.keys(spentByType).length === 0 ? '<div style="color: #6b7280; font-size: 13px;">No spending data</div>' :
                            Object.keys(spentByType).map(function(key) {
                                return `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px;">
                                    <span>${key}</span>
                                    <span style="font-weight: 600;">${spentByType[key].toFixed(2)} Coins</span>
                                </div>`;
                            }).join('')
                        }
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="font-weight: 600; margin-bottom: 12px;">📊 Recent Transactions</div>
                    ${transactions.slice(0, 10).map(function(tx) {
                        var isEarned = tx.type === 'earned';
                        return `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px;">
                            <div>
                                <span style="font-weight: 600;">${tx.userName || 'User'}</span>
                                <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">${tx.item || ''}</span>
                            </div>
                            <div>
                                <span style="color: ${isEarned ? '#22c55e' : '#ef4444'}; font-weight: 600;">
                                    ${isEarned ? '+' : '-'}${tx.amount.toFixed(2)} Coins
                                </span>
                            </div>
                        </div>`;
                    }).join('')}
                    ${transactions.length === 0 ? '<div style="color: #6b7280; text-align: center; padding: 20px;">No transactions yet</div>' : ''}
                </div>
            `;

            document.getElementById('adminAnalytics').innerHTML = html;
        });
    },

    // ============================================
    // ADMIN - GIFT CATALOG MANAGEMENT
    // ============================================

    loadAdminGifts: function() {
        var html = `
            <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 16px 0;">🎁 Gift Catalog Management</h3>
                <div style="font-size: 13px; color: #64748b; margin-bottom: 16px;">
                    Manage the gifts available for users to redeem with their Chichi Coins.
                </div>

                <div id="giftList">
                    ${window.GIFT_CATALOG ? window.GIFT_CATALOG.map(function(gift) {
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">
                                <div>
                                    <div style="font-weight: 600; font-size: 14px;">${gift.image} ${gift.name}</div>
                                    <div style="font-size: 12px; color: #6b7280;">${gift.description}</div>
                                    <div style="font-size: 12px; color: #3b82f6; font-weight: 600;">${gift.cost} Coins</div>
                                </div>
                                <div>
                                    <button onclick="app.editGift('${gift.id}')" style="padding: 4px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">✏️</button>
                                    <button onclick="app.deleteGift('${gift.id}')" style="padding: 4px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                                </div>
                            </div>
                        `;
                    }).join('') : '<div style="color: #6b7280; text-align: center; padding: 20px;">Gift catalog not loaded</div>'}
                </div>

                <div id="adminAirtimeRequests" style="margin-top:20px;"></div>
                <button onclick="app.addGift()" style="width: 100%; margin-top: 12px; padding: 12px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">+ Add New Gift</button>
            </div>
        `;

        document.getElementById('adminGifts').innerHTML = html;
    },

    addGift: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" style="max-width: 450px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="font-weight: 700; margin: 0;">Add New Gift</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
                </div>

                <div class="form-group">
                    <label class="form-label">Gift Name</label>
                    <input type="text" id="newGiftName" class="form-input" placeholder="e.g., Game Voucher">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input type="text" id="newGiftDescription" class="form-input" placeholder="e.g., $10 Gaming Gift Card">
                </div>
                <div class="form-group">
                    <label class="form-label">Emoji/Icon</label>
                    <input type="text" id="newGiftEmoji" class="form-input" placeholder="🎮" maxlength="2">
                </div>
                <div class="form-group">
                    <label class="form-label">Cost (Coins)</label>
                    <input type="number" id="newGiftCost" class="form-input" placeholder="500" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <input type="text" id="newGiftCategory" class="form-input" placeholder="gaming, food, etc.">
                </div>

                <button onclick="app.saveNewGift()" style="width: 100%; padding: 12px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Add Gift</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    saveNewGift: function() {
        var name = document.getElementById('newGiftName').value.trim();
        var description = document.getElementById('newGiftDescription').value.trim();
        var emoji = document.getElementById('newGiftEmoji').value.trim();
        var cost = parseInt(document.getElementById('newGiftCost').value);
        var category = document.getElementById('newGiftCategory').value.trim();

        if (!name || !description || !cost || !category) {
            this.toast('Please fill in all fields', 'error');
            return;
        }

        if (!window.GIFT_CATALOG) window.GIFT_CATALOG = [];

        var newGift = {
            id: 'gift_' + Date.now(),
            name: name,
            description: description,
            image: emoji || '🎁',
            cost: cost,
            category: category
        };

        window.GIFT_CATALOG.push(newGift);
        this.toast('✅ Gift added successfully!', 'success');
        document.querySelector('.modal-overlay').remove();
        this.loadAdminGifts();
    },

    editGift: function(id) {
        var gift = window.GIFT_CATALOG ? window.GIFT_CATALOG.find(function(g) { return g.id === id; }) : null;
        if (!gift) {
            this.toast('Gift not found', 'error');
            return;
        }

        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" style="max-width: 450px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="font-weight: 700; margin: 0;">Edit Gift</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
                </div>

                <div class="form-group">
                    <label class="form-label">Gift Name</label>
                    <input type="text" id="editGiftName" class="form-input" value="${gift.name}">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input type="text" id="editGiftDescription" class="form-input" value="${gift.description}">
                </div>
                <div class="form-group">
                    <label class="form-label">Emoji/Icon</label>
                    <input type="text" id="editGiftEmoji" class="form-input" value="${gift.image}" maxlength="2">
                </div>
                <div class="form-group">
                    <label class="form-label">Cost (Coins)</label>
                    <input type="number" id="editGiftCost" class="form-input" value="${gift.cost}" min="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <input type="text" id="editGiftCategory" class="form-input" value="${gift.category}">
                </div>

                <button onclick="app.saveEditedGift('${id}')" style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Save Changes</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    saveEditedGift: function(id) {
        var gift = window.GIFT_CATALOG ? window.GIFT_CATALOG.find(function(g) { return g.id === id; }) : null;
        if (!gift) {
            this.toast('Gift not found', 'error');
            return;
        }

        gift.name = document.getElementById('editGiftName').value.trim();
        gift.description = document.getElementById('editGiftDescription').value.trim();
        gift.image = document.getElementById('editGiftEmoji').value.trim() || '🎁';
        gift.cost = parseInt(document.getElementById('editGiftCost').value);
        gift.category = document.getElementById('editGiftCategory').value.trim();

        this.toast('✅ Gift updated!', 'success');
        document.querySelector('.modal-overlay').remove();
        this.loadAdminGifts();
    },

    deleteGift: function(id) {
        if (!confirm('Permanently delete this gift?')) return;

        var self = this;

        // Delete from memory
        if (window.GIFT_CATALOG) {
            var index = window.GIFT_CATALOG.findIndex(function(g) { return g.id === id; });
            if (index > -1) {
                window.GIFT_CATALOG.splice(index, 1);
            }
        }

        // Delete from Firebase permanently
        db.ref('gifts/' + id).remove().then(function() {
            self.toast('✅ Gift permanently deleted', 'success');
            self.loadAdminGifts();
        }).catch(function(err) {
            self.toast('❌ Error deleting gift: ' + err.message, 'error');
        });
    },

    // ============================================
    // ADMIN - SUSPICIOUS ACTIVITY
    // ============================================

    loadSuspiciousActivity: function() {
        var self = this;
        var html = '';

        db.ref('suspiciousActivity').orderByChild('timestamp').limitToLast(50).once('value', function(snapshot) {
            var activities = [];
            snapshot.forEach(function(child) {
                activities.push({
                    id: child.key,
                    ...child.val()
                });
            });

            activities.reverse();

            if (activities.length === 0) {
                html = '<div style="text-align: center; color: #22c55e; padding: 20px;">✅ No suspicious activity detected</div>';
            } else {
                activities.forEach(function(act) {
                    var severityColor = act.severity === 'critical' ? '#dc2626' :
                                       act.severity === 'high' ? '#ef4444' :
                                       act.severity === 'medium' ? '#f59e0b' : '#22c55e';

                    html += `
                        <div style="padding: 12px; border-bottom: 1px solid var(--border); border-left: 4px solid ${severityColor}; margin-bottom: 4px; ${act.status === 'resolved' ? 'opacity: 0.5;' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem;">${act.userName || 'Unknown'}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-light);">${act.reason || 'No reason'}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-light);">${act.time || 'N/A'} ${act.status === 'resolved' ? '✅ Resolved' : ''}</div>
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                    <span style="padding: 2px 8px; border-radius: 8px; background: ${severityColor}20; color: ${severityColor}; font-size: 0.7rem; font-weight: 600;">${(act.severity || 'medium').toUpperCase()}</span>
                                    ${act.userId && act.userId !== 'unknown' && act.status !== 'resolved' ? `
                                        <button onclick="app.banUserFromAdmin('${act.userId}', '${act.userName || 'User'}')" style="padding: 4px 10px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">🚫 Ban</button>
                                        <button onclick="app.resolveSuspiciousActivity('${act.id}')" style="padding: 4px 10px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">✅ Resolve</button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            document.getElementById('suspiciousActivityList').innerHTML = html;
        });
    },

    resolveSuspiciousActivity: function(activityId) {
        if (!confirm('Mark this suspicious activity as resolved?')) return;

        var self = this;
        db.ref('suspiciousActivity/' + activityId + '/status').set('resolved').then(function() {
            self.toast('✅ Activity marked as resolved', 'success');
            self.loadSuspiciousActivity();
            self.logUserActivity('admin_resolve_activity', 'Resolved suspicious activity: ' + activityId);
        }).catch(function(err) {
            self.toast('❌ Error: ' + err.message, 'error');
        });
    },

    // ============================================
    // ADMIN - NOTIFICATIONS
    // ============================================

    loadAdminNotifications: function() {
        var self = this;
        var html = '';
        var notifContainer = document.getElementById('adminNotificationsList');

        if (!notifContainer) {
            console.error('❌ Notifications container not found');
            return;
        }

        notifContainer.innerHTML = '<div style="padding: 20px; text-align: center;">⏳ Loading notifications...</div>';

        db.ref('adminNotifications').limitToLast(50).once('value', function(snapshot) {
            try {
                var notifications = [];
                snapshot.forEach(function(child) {
                    notifications.push({
                        id: child.key,
                        ...child.val()
                    });
                });

                notifications.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });

                if (notifications.length === 0) {
                    html = '<div style="text-align: center; color: #6b7280; padding: 32px 20px;"><div style="font-size: 40px; margin-bottom: 12px;">📬</div><div>No notifications yet</div></div>';
                } else {
                    notifications.forEach(function(notif) {
                        var severityColor = notif.severity === 'critical' ? '#dc2626' :
                                           notif.severity === 'high' ? '#ef4444' :
                                           notif.severity === 'medium' ? '#f59e0b' : '#22c55e';

                        var timestamp = new Date(notif.timestamp || 0).toLocaleString();

                        html += `
                            <div style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; border-left: 4px solid ${severityColor}; background: ${notif.read ? 'white' : '#f0f7ff'}; transition: 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='${notif.read ? 'white' : '#f0f7ff'}'">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; font-size: 0.9rem; color: #1a202c;">${notif.message || 'No message'}</div>
                                        <div style="font-size: 0.75rem; color: #6b7280; margin-top: 4px;">${timestamp}</div>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                        <span style="padding: 4px 10px; border-radius: 8px; background: ${severityColor}20; color: ${severityColor}; font-size: 0.7rem; font-weight: 600; white-space: nowrap;">${(notif.severity || 'medium').toUpperCase()}</span>
                                        ${!notif.read ? `<span style="padding: 4px 10px; border-radius: 8px; background: #dcfce7; color: #22c55e; font-size: 0.7rem; font-weight: 600;">🔔 NEW</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }

                notifContainer.innerHTML = html;
            } catch (err) {
                console.error('❌ Error loading notifications:', err);
                notifContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">❌ Error: ' + err.message + '</div>';
            }
        }, function(err) {
            console.error('❌ Firebase error:', err);
            notifContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">❌ Firebase Error: ' + err.message + '</div>';
        });
    },

    // ============================================
    // ADMIN - ACTIVITY LOGS
    // ============================================

    loadActivityLog: function() {
        var self = this;
        var html = '';
        var logContainer = document.getElementById('activityLogList');

        if (!logContainer) {
            console.error('❌ Activity log container not found');
            return;
        }

        logContainer.innerHTML = '<div style="padding: 20px; text-align: center;">⏳ Loading activity logs...</div>';

        db.ref('activityLogs').limitToLast(100).once('value', function(snapshot) {
            try {
                var activities = [];
                snapshot.forEach(function(child) {
                    activities.push({
                        id: child.key,
                        ...child.val()
                    });
                });

                activities.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });

                if (activities.length === 0) {
                    html = '<div style="text-align: center; color: #6b7280; padding: 20px;">📭 No activity logged yet</div>';
                } else {
                    activities.forEach(function(act) {
                        var actionIcon = {
                            'login': '🔐', 'login_success': '✅', 'login_failed': '❌',
                            'signup': '📝', 'google_signup': '📝', 'google_login': '🔐',
                            'click': '👆', 'scroll': '📜', 'session_end': '⏱️',
                            'create_post': '📄', 'delete_post': '🗑️', 'like_post': '❤️',
                            'comment': '💬', 'follow': '👥', 'unfollow': '👥',
                            'admin_login': '⚙️', 'admin_ban': '🚫', 'admin_unban': '✅',
                            'admin_delete_post': '🗑️', 'admin_resolve_activity': '✅',
                            'send_coins': '💰'
                        }[act.action] || '📌';

                        var timestamp = new Date(act.timestamp || 0).toLocaleString();

                        html += `
                            <div style="padding: 12px 14px; border-bottom: 1px solid #e5e7eb; background: white; transition: 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; font-size: 0.9rem; color: #1a202c;">${actionIcon} ${act.userName || 'System'}</div>
                                        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">${act.action.toUpperCase().replace(/_/g, ' ')}</div>
                                        ${act.details ? `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">📝 ${act.details}</div>` : ''}
                                        ${act.userEmail ? `<div style="font-size: 0.75rem; color: #9ca3af; margin-top: 2px;">📧 ${act.userEmail}</div>` : ''}
                                    </div>
                                    <div style="text-align: right; font-size: 0.75rem; color: #9ca3af; white-space: nowrap;">
                                        <div>${timestamp}</div>
                                        ${act.isAdmin ? '<span style="background: #0088cc; color: white; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">👑 Admin</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }

                logContainer.innerHTML = html;
            } catch (err) {
                console.error('❌ Error loading activity logs:', err);
                logContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">❌ Error loading logs: ' + err.message + '</div>';
            }
        }, function(err) {
            console.error('❌ Firebase error loading logs:', err);
            logContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">❌ Firebase error: ' + err.message + '</div>';
        });
    },

    // ============================================
    // GIFT CATALOG - User Facing
    // ============================================

    showGiftCatalog: function() {
        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to redeem gifts', 'info');
            this.showLoginPage();
            return;
        }

        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.alignItems = 'flex-start';
        modal.style.paddingTop = '40px';
        modal.style.overflowY = 'auto';

        var catalog = window.GIFT_CATALOG || [];

        var html = `
            <div style="background: white; border-radius: 24px 24px 0 0; padding: 24px 20px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; margin: 0 auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <h2 style="font-weight: 700; margin: 0; font-size: 22px;">🎁 Gift Catalog</h2>
                        <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Redeem your Chichi Coins for awesome rewards!</div>
                    </div>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
                </div>

                <div style="background: linear-gradient(135deg, #f0f7ff, #e8f0fe); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid #bfdbfe;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 13px; color: #1e293b; font-weight: 600;">Your Balance</div>
                            <div style="font-size: 28px; font-weight: 800; color: #3b82f6;">${this.balance.toFixed(2)}</div>
                            <div style="font-size: 11px; color: #6b7280;">Chichi Coins</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; color: #6b7280;">Earn more by</div>
                            <button onclick="app.switchView('earn'); document.querySelector('.modal-overlay').remove();" style="background: #3b82f6; color: white; border: none; padding: 6px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px;">Answering Trivia</button>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    ${catalog.length === 0 ? '<div style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 40px;">No gifts available</div>' :
                    catalog.map(function(gift) {
                        var canAfford = self.balance >= gift.cost;
                        return `
                            <div style="background: white; border-radius: 14px; padding: 16px; border: 2px solid ${canAfford ? '#22c55e' : '#e5e7eb'}; text-align: center; transition: 0.3s; ${canAfford ? 'box-shadow: 0 4px 12px rgba(34, 197, 94, 0.15);' : ''}">
                                <div style="font-size: 40px; margin-bottom: 8px;">${gift.image}</div>
                                <div style="font-weight: 700; font-size: 14px; color: #1e293b;">${gift.name}</div>
                                <div style="font-size: 11px; color: #6b7280; margin: 4px 0;">${gift.description}</div>
                                <div style="font-size: 13px; font-weight: 700; color: ${canAfford ? '#22c55e' : '#ef4444'}; margin: 8px 0;">
                                    ${gift.cost} Coins
                                    ${!canAfford ? '<span style="font-size: 10px; color: #ef4444; display: block;">Need ' + (gift.cost - self.balance).toFixed(0) + ' more</span>' : ''}
                                </div>
                                <button onclick="app.redeemGift('${gift.id}')" style="width: 100%; padding: 10px; background: ${canAfford ? '#22c55e' : '#e5e7eb'}; color: ${canAfford ? 'white' : '#9ca3af'}; border: none; border-radius: 8px; cursor: ${canAfford ? 'pointer' : 'not-allowed'}; font-weight: 600; font-size: 13px; transition: 0.3s;" ${!canAfford ? 'disabled' : ''} onmouseover="if(${canAfford}){this.style.transform='scale(1.02)'}" onmouseout="if(${canAfford}){this.style.transform='scale(1)'}">
                                    ${canAfford ? '🎁 Redeem' : '🔒 Locked'}
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 10px; font-size: 12px; color: #6b7280; text-align: center;">
                    💡 Gifts are digital vouchers. Contact support for redemption details.
                </div>
            </div>
        `;

        modal.innerHTML = html;
        document.body.appendChild(modal);
    },

    redeemGift: function(giftId) {
        var catalog = window.GIFT_CATALOG || [];
        var gift = catalog.find(function(g) { return g.id === giftId; });
        if (!gift) {
            this.toast('Gift not found', 'error');
            return;
        }

        if (this.balance < gift.cost) {
            this.toast('Insufficient coins! Need ' + gift.cost + ' Coins', 'error');
            return;
        }

        if (!confirm(`Redeem "${gift.name}" for ${gift.cost} Chichi Coins?`)) {
            return;
        }

        var self = this;
        this.balance -= gift.cost;
        db.ref('users/' + this.user.uid + '/balance').set(this.balance);

        db.ref('giftRedemptions').push({
            userId: this.user.uid,
            userName: this.profile.name || 'User',
            userEmail: this.user.email,
            giftId: gift.id,
            giftName: gift.name,
            giftDescription: gift.description,
            giftCost: gift.cost,
            createdAt: new Date().toLocaleString('en-KE'),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        this.trackRevenue('spent', gift.cost, 'gift_' + gift.name);

        this.updateBalanceDisplays();
        this.toast('🎉 Redeemed: ' + gift.name + '!', 'success');
        this.logUserActivity('redeem_gift', 'Redeemed ' + gift.name + ' for ' + gift.cost + ' coins');

        document.querySelector('.modal-overlay').remove();
        this.showGiftCatalog();
    },

    // ============================================
    // SEND COINS TO USER
    // ============================================

    showSendMoneyModal: function() {
        if (!this.user || this.isGuest) {
            this.toast('🔐 Please login to send coins', 'info');
            this.showLoginPage();
            return;
        }

        if (this.balance < 1) {
            this.toast('⚠️ Insufficient balance to send', 'error');
            return;
        }

        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'sendMoneyModal';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 24px; max-width: 400px; width: 95%; animation: slideUp 0.3s ease; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0;">📤 Send Coins</h2>
                    <button onclick="document.getElementById('sendMoneyModal').remove()" style="background: none; border: none; font-size: 22px; cursor: pointer; color: #64748b;">✕</button>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">Recipient Username</label>
                    <input type="text" id="recipientUsername" placeholder="@username" style="
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 10px;
                        font-size: 14px;
                        font-family: inherit;
                        box-sizing: border-box;
                        transition: 0.2s;
                    " onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'" oninput="app.searchRecipientUsers(this.value)">
                    <div id="usernameDropdown" style="display: none; margin-top: 6px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>
                </div>

                <div id="selectedRecipientBox" style="display: none; background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; flex-shrink: 0;" id="selectedRecipientAvatar">👤</div>
                    <div>
                        <div style="font-weight: 600; color: #1e293b; font-size: 14px;" id="selectedRecipientName"></div>
                        <div style="font-size: 12px; color: #64748b;" id="selectedRecipientUsername"></div>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">Amount (Coins)</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="number" id="sendAmount" placeholder="0.00" min="1" max="${this.balance}" style="
                            flex: 1;
                            padding: 12px;
                            border: 2px solid #e5e7eb;
                            border-radius: 10px;
                            font-size: 14px;
                            font-family: inherit;
                            box-sizing: border-box;
                            transition: 0.2s;
                        " onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                        <button onclick="document.getElementById('sendAmount').value = '${this.balance}'" style="
                            padding: 12px 16px;
                            background: #e5e7eb;
                            border: none;
                            border-radius: 10px;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 12px;
                            color: #475569;
                            transition: 0.2s;
                        " onmouseover="this.style.background='#d1d5db'" onmouseout="this.style.background='#e5e7eb'">Max</button>
                    </div>
                </div>

                <div style="background: #f8fafc; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                    <span>Your Balance:</span>
                    <span style="font-weight: 700; color: #1e293b;">${this.balance.toFixed(2)} Coins</span>
                </div>

                <button onclick="app.processSendCoins()" style="
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s;
                    margin-bottom: 8px;
                " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 8px 20px rgba(59,130,246,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    💸 Send Coins
                </button>
                <button onclick="document.getElementById('sendMoneyModal').remove()" style="
                    width: 100%;
                    padding: 10px;
                    background: #e5e7eb;
                    color: #475569;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 13px;
                ">
                    Cancel
                </button>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('recipientUsername').focus();
    },

    searchRecipientUsers: function(query) {
        var dropdown = document.getElementById('usernameDropdown');
        if (!query || query.length < 1) {
            dropdown.style.display = 'none';
            return;
        }

        var searchQuery = query.toLowerCase().trim();
        var self = this;
        var results = [];

        for (var uid in this.users) {
            if (!this.user || uid !== this.user.uid) {
                var user = this.users[uid];
                if (user && user.username && user.username.toLowerCase().includes(searchQuery)) {
                    results.push({ uid: uid, user: user });
                }
            }
        }

        if (results.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px; color: #9ca3af; font-size: 13px; text-align: center;">No users found</div>';
            dropdown.style.display = 'block';
            return;
        }

        var html = '';
        results.slice(0, 5).forEach(function(r) {
            html += `
                <div onclick="app.selectRecipient('${r.uid}', '${r.user.username}', '${r.user.name}')" style="
                    display: flex;
                    align-items: center;
                    padding: 10px 14px;
                    border-bottom: 1px solid #f0f0f0;
                    cursor: pointer;
                    transition: 0.2s;
                    gap: 10px;
                " onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #3b82f6, #2563eb);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: 700;
                        font-size: 13px;
                        flex-shrink: 0;
                    ">${r.user.name.charAt(0).toUpperCase()}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #1e293b; font-size: 13px;">${r.user.name}</div>
                        <div style="font-size: 11px; color: #64748b;">@${r.user.username}</div>
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.style.display = 'block';
    },

    selectRecipient: function(uid, username, name) {
        document.getElementById('recipientUsername').value = username;
        document.getElementById('usernameDropdown').style.display = 'none';

        var box = document.getElementById('selectedRecipientBox');
        var avatar = document.getElementById('selectedRecipientAvatar');
        var nameEl = document.getElementById('selectedRecipientName');
        var usernameEl = document.getElementById('selectedRecipientUsername');

        avatar.textContent = name.charAt(0).toUpperCase();
        nameEl.textContent = name;
        usernameEl.textContent = '@' + username;
        box.style.display = 'flex';

        this._selectedRecipient = { uid: uid, username: username, name: name };
    },

    processSendCoins: function() {
        var username = document.getElementById('recipientUsername').value.trim();
        var amount = parseFloat(document.getElementById('sendAmount').value);
        var self = this;

        if (!username) {
            this.toast('⚠️ Enter recipient username', 'error');
            return;
        }

        if (isNaN(amount) || amount < 1) {
            this.toast('⚠️ Enter a valid amount', 'error');
            return;
        }

        if (amount > this.balance) {
            this.toast('⚠️ Insufficient balance', 'error');
            return;
        }

        db.ref('users').orderByChild('username').equalTo(username).once('value')
            .then(function(snapshot) {
                if (!snapshot.exists()) {
                    self.toast('❌ User not found', 'error');
                    return;
                }

                var recipientUid = Object.keys(snapshot.val())[0];
                var recipientData = snapshot.val()[recipientUid];

                self.balance -= amount;
                db.ref('users/' + self.user.uid + '/balance').set(self.balance);

                var recipientBalance = (recipientData.balance || 0) + amount;
                db.ref('users/' + recipientUid + '/balance').set(recipientBalance);

                var transactionData = {
                    senderId: self.user.uid,
                    senderName: self.profile.name,
                    senderUsername: self.profile.username,
                    recipientId: recipientUid,
                    recipientName: recipientData.name,
                    recipientUsername: username,
                    amount: amount,
                    type: 'transfer',
                    createdAt: new Date().toLocaleString('en-KE'),
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    read: false
                };

                db.ref('transactions').push(transactionData);
                self.trackRevenue('spent', amount, 'send_to_' + username);

                var notificationData = {
                    type: 'coin_received',
                    from: self.profile.name,
                    fromUsername: self.profile.username,
                    amount: amount,
                    message: '💰 You received ' + amount + ' Chichi Coins from ' + self.profile.name + ' (@' + self.profile.username + ')',
                    userId: recipientUid,
                    read: false,
                    createdAt: new Date().toLocaleString('en-KE'),
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };

                db.ref('notifications/' + recipientUid).push(notificationData);

                var chatKey = [self.user.uid, recipientUid].sort().join('_');
                var chatMessage = {
                    text: '💰 Sent you ' + amount + ' Chichi Coins!',
                    sender: self.user.uid,
                    senderName: self.profile.name,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    read: false,
                    isCoinTransfer: true,
                    amount: amount
                };
                db.ref('chats/' + chatKey + '/messages').push(chatMessage);

                self.updateBalanceDisplays();
                self.toast('✅ Sent ' + amount + ' Coins to @' + username + '!', 'success');
                self.logUserActivity('send_coins', 'Sent ' + amount + ' coins to ' + username);

                document.getElementById('sendMoneyModal').remove();
            })
            .catch(function(err) {
                console.error('Error:', err);
                self.toast('❌ Error processing transfer', 'error');
            });
    },

    checkCoinNotifications: function() {
        if (!this.user || this.isGuest) return;
        if (this.coinNotificationListenerActive) return;

        var self = this;
        var userId = this.user.uid;
        var notificationsRef = db.ref('notifications/' + userId);
        this.coinNotificationListenerActive = true;

        // A reload must never replay old coin receipts. Mark every existing coin receipt as
        // acknowledged before attaching child_added, then respond only to future records.
        notificationsRef.once('value').then(function(snapshot) {
            var existingNotificationIds = {};
            var readUpdates = {};
            snapshot.forEach(function(child) {
                existingNotificationIds[child.key] = true;
                var notification = child.val();
                if (notification && notification.type === 'coin_received' && !notification.read) {
                    readUpdates[child.key + '/read'] = true;
                }
            });

            return notificationsRef.update(readUpdates).then(function() {
                notificationsRef.on('child_added', function(childSnapshot) {
                    if (existingNotificationIds[childSnapshot.key]) return;

                    var notification = childSnapshot.val();
                    if (notification && notification.type === 'coin_received') {
                        db.ref('notifications/' + userId + '/' + childSnapshot.key + '/read').set(true);
                        self.loadProfile();
                    }
                });
            });
        }).catch(function(err) {
            self.coinNotificationListenerActive = false;
            console.error('Error preparing coin notifications:', err);
        });
    },

    // ============================================
    // LOAD USERS
    // ============================================

    loadUsers: function() {
        var self = this;
        if (!db) {
            setTimeout(function() { self.loadUsers(); }, 300);
            return;
        }
        console.log('📥 loadUsers() called');
        db.ref('users').on('value', function(s) {
            var allUsers = s.val() || {};
            self.users = {};
            for (var uid in allUsers) {
                var u = allUsers[uid];
                if (u && u.name && u.email) {
                    self.users[uid] = u;
                }
            }
            console.log('✅ Users loaded: ' + Object.keys(self.users).length);
            if (!self.unreadTrackingStarted && Object.keys(self.users).length > 0) {
                self.unreadTrackingStarted = true;
                setTimeout(function() { self.trackUnreadMessages(); }, 100);
            }
            var exploreView = document.getElementById('exploreView'); if (exploreView && exploreView.classList.contains('active')) {
                self.loadExplore();
            }
        });
    },
    // ============================================
    // LOAD FOLLOWING
    // ============================================

    loadFollowing: function() {
        if (!this.user) {
            this.following = {};
            return;
        }

        var self = this;
        db.ref('users/' + this.user.uid + '/following').once('value', function(s) {
            var savedFollowing = s.val();
            self.following = savedFollowing && typeof savedFollowing === 'object' ? savedFollowing : {};
            self.loadStories();
            if (self.currentView === 'profile') self.renderProfile();
        });
    },

    // ============================================
    // SEARCH USERS
    // ============================================

    searchUsers: function(query) {
        if (!query || query === '') {
            var input = document.getElementById('userSearchInput');
            query = input ? input.value : '';
        }

        var resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        if (!query || query.trim() === '') {
            resultsContainer.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">🔍 Search by name, email, username</div>';
            return;
        }

        var searchQuery = query.toLowerCase().trim();
        console.log('🔍 Searching for:', searchQuery);

        var results = [];
        var self = this;

        for (var uid in this.users) {
            if (!this.user || uid !== this.user.uid) {
                var user = this.users[uid];
                if (user && user.name) {
                    var matches = false;

                    if (user.name.toLowerCase().includes(searchQuery)) {
                        matches = true;
                    }
                    else if (user.email && user.email.toLowerCase().includes(searchQuery)) {
                        matches = true;
                    }
                    else if (user.username && user.username.toLowerCase().includes(searchQuery)) {
                        matches = true;
                    }

                    if (matches) {
                        results.push({ uid: uid, user: user });
                    }
                }
            }
        }

        results.sort(function(a, b) {
            return (b.user.followers || 0) - (a.user.followers || 0);
        });

        console.log('✅ Found', results.length, 'results');

        var html = '';
        if (results.length === 0) {
            html = '<div style="text-align:center;color:#9ca3af;padding:32px 20px;"><div style="font-size:40px;margin-bottom:12px;">😞</div><div>No users found matching "' + query + '"</div></div>';
        } else {
            html += '<div style="padding:12px 16px;background:linear-gradient(135deg,#f0f7ff,#f5f0ff);border-radius:8px;margin-bottom:12px;font-size:13px;color:#0088cc;font-weight:600;">✅ Found ' + results.length + ' ' + (results.length === 1 ? 'user' : 'users') + '</div>';

            results.forEach(function(r) {
                var isFollowing = self.following[r.uid] || false;
                var unreadCount = self.getUnreadCountForUser(r.uid);
                var msgBadge = unreadCount > 0 ? '<span style="position:absolute;top:-8px;right:-8px;width:22px;height:22px;background:#ef4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(239,68,68,0.4);">' + unreadCount + '</span>' : '';

                html += '<div class="search-user" style="display:flex;align-items:center;padding:14px;border-bottom:1px solid #e5e7eb;gap:12px;border-radius:8px;transition:0.2s;" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'">';
                html += '<div class="search-user-avatar" style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:20px;flex-shrink:0;background-image:url(' + (r.user.profilePhoto || '') + ');background-size:cover;background-position:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.08);">' + (!r.user.profilePhoto ? r.user.name.charAt(0).toUpperCase() : '') + '</div>';
                html += '<div class="search-user-info" style="flex:1;min-width:0;" onclick="app.viewUserProfile(\'' + r.uid + '\')" style="cursor:pointer;">';
                html += '<div class="search-user-name" style="font-weight:600;font-size:15px;color:#1a202c;">' + r.user.name + '</div>';
                html += '<div class="search-user-email" style="font-size:12px;color:#6b7280;margin-top:2px;">📧 ' + r.user.email + '</div>';
                html += '<div class="search-user-followers" style="font-size:11px;color:#9ca3af;margin-top:4px;">👥 ' + (r.user.followers || 0) + ' followers</div></div>';
                html += '<div class="search-user-actions" style="display:flex;gap:6px;flex-shrink:0;">';
                html += '<button class="search-msg-btn" onclick="app.openChatFromSearch(\'' + r.uid + '\', \'' + r.user.name + '\')" style="padding:8px 12px;background:#0088cc;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;position:relative;white-space:nowrap;">💬 ' + msgBadge + '</button>';
                html += '<button class="search-view-btn" onclick="app.viewUserProfile(\'' + r.uid + '\')" style="padding:8px 12px;background:' + (isFollowing ? '#ef4444' : 'var(--primary)') + ';color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;">' + (isFollowing ? '✓ Follow' : '+ Follow') + '</button>';
                html += '</div></div>';
            });
        }

        resultsContainer.innerHTML = html;
    },

    searchExploreUsers: function(query) {
        if (!query || query === '') {
            var input = document.getElementById('exploreSearchInput');
            query = input ? input.value : '';
        }

        var resultsContainer = document.getElementById('exploreSearchResults');
        var resultsList = document.getElementById('exploreSearchResultsList');
        var quickDiscoverySection = document.getElementById('quickDiscoverySection');
        var trendingSection = document.getElementById('trendingSection');
        var postsSection = document.getElementById('postsSection');

        if (!resultsContainer || !resultsList) {
            console.error('Search containers not found');
            return;
        }

        if (!query || query.trim() === '') {
            resultsContainer.style.display = 'none';
            resultsList.innerHTML = '';
            if (quickDiscoverySection) quickDiscoverySection.style.display = 'grid';
            if (trendingSection) trendingSection.style.display = 'block';
            if (postsSection) postsSection.style.display = 'block';
            return;
        }

        if (quickDiscoverySection) quickDiscoverySection.style.display = 'none';
        if (trendingSection) trendingSection.style.display = 'none';
        if (postsSection) postsSection.style.display = 'none';

        var searchQuery = query.toLowerCase().trim();
        console.log('🔍 Explore Search for:', searchQuery);

        var results = [];
        var self = this;

        for (var uid in this.users) {
            if (!this.user || uid !== this.user.uid) {
                var user = this.users[uid];
                if (user && user.name) {
                    var matches = false;

                    if (user.name.toLowerCase().includes(searchQuery)) {
                        matches = true;
                    }
                    else if (user.email && user.email.toLowerCase().includes(searchQuery)) {
                        matches = true;
                    }
                    else if (user.username && user.username.toLowerCase().includes(searchQuery)) {
                        matches = true;
                    }

                    if (matches) {
                        results.push({ uid: uid, user: user });
                    }
                }
            }
        }

        results.sort(function(a, b) {
            return (b.user.followers || 0) - (a.user.followers || 0);
        });

        var html = '';
        if (results.length === 0) {
            html = '<div style="text-align:center;color:#9ca3af;padding:32px 20px;"><div style="font-size:18px;margin-bottom:12px;">😔 No users found</div></div>';
        } else {
            html += '<div style="padding:12px 16px;background:linear-gradient(135deg,#f0f7ff,#f5f0ff);border-radius:8px;margin-bottom:12px;font-size:13px;color:#0088cc;font-weight:600;">Found ' + results.length + ' user' + (results.length === 1 ? '' : 's') + '</div>';

            results.forEach(function(r) {
                var isFollowing = self.following[r.uid] || false;

                html += '<div style="display:flex;align-items:center;padding:12px;border-bottom:1px solid #e5e7eb;gap:12px;border-radius:8px;" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'">';
                html += '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0;background-image:url(' + (r.user.profilePhoto || '') + ');background-size:cover;background-position:center;border:2px solid white;">' + (!r.user.profilePhoto ? r.user.name.charAt(0).toUpperCase() : '') + '</div>';
                html += '<div style="flex:1;cursor:pointer;" onclick="app.viewUserProfile(\'' + r.uid + '\')">';
                html += '<div style="font-weight:600;font-size:14px;">' + r.user.name + '</div>';
                html += '<div style="font-size:11px;color:#6b7280;">📧 ' + r.user.email + ' • 👥 ' + (r.user.followers || 0) + '</div></div>';
                html += '<button onclick="app.openChatFromSearch(\'' + r.uid + '\', \'' + r.user.name + '\')" style="padding:6px 12px;background:#0088cc;color:white;border:none;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;">💬 Msg</button>';
                html += '<button onclick="app.viewUserProfile(\'' + r.uid + '\')" style="padding:6px 12px;background:' + (isFollowing ? '#ef4444' : 'var(--primary)') + ';color:white;border:none;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;">' + (isFollowing ? '✓ Follow' : '+ Follow') + '</button>';
                html += '</div>';
            });
        }

        resultsContainer.style.display = 'block';
        resultsList.innerHTML = html;
    },

    getUnreadCountForUser: function(uid) {
        if (!this.user || this.isGuest) return 0;
        if (!this.unreadMessages) return 0;
        var key = [this.user.uid, uid].sort().join('_');
        var data = this.unreadMessages[key];
        return (data && data.count) ? data.count : 0;
    },

    updateUnreadBadge: function() {
        var unreadCount = 0;

        if (this.unreadMessages) {
            Object.entries(this.unreadMessages).forEach(function([chatKey, data]) {
                if (data && data.count && data.count > 0) {
                    unreadCount += data.count;
                }
            });
        }

        var badge = document.getElementById('messagesBadge');
        var dot = document.getElementById('messagesUnreadDot');

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'flex';
                badge.style.opacity = '1';
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
        }

        return unreadCount;
    },

    clearUnreadBadge: function() {
        document.getElementById('messagesBadge').style.display = 'none';
    },

    // ============================================
    // MESSAGES FILTER FUNCTIONS
    // ============================================

    filterMessages: function(filter) {
        document.querySelectorAll('.message-filter-tab').forEach(function(tab) {
            tab.classList.remove('active');
            tab.style.background = '#f3f4f6';
            tab.style.color = '#666';
        });

        this.activeMessageFilter = filter;
        this.applyMessageListFilters();
    },

    applyMessageListFilters: function() {
        var filter = this.activeMessageFilter || 'all';
        var searchInput = document.getElementById('messageSearchInput');
        var query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        var tabs = document.querySelectorAll('.message-filter-tab');
        var tabMap = { 'all': 0, 'unread': 1, 'favorites': 2, 'archived': 3 };
        var index = tabMap[filter];
        if (index !== undefined && tabs[index]) {
            tabs[index].classList.add('active');
            tabs[index].style.background = '#0088cc';
            tabs[index].style.color = 'white';
        }

        // Filter the message items (.msg-item-wrapper)
        var items = document.querySelectorAll('.msg-item-wrapper');
        var visibleCount = 0;
        
        items.forEach(function(item) {
            var uid = item.getAttribute('data-uid');
            var unreadBadge = item.querySelector('.msg-item-unread');
            var hasUnread = unreadBadge && parseInt(unreadBadge.textContent) > 0;
            var isFavorite = localStorage.getItem('fav_' + uid) === 'true';
            var isArchived = localStorage.getItem('archived_' + uid) === 'true';
            var name = (item.querySelector('.msg-item-name') || {}).textContent || '';
            var preview = (item.querySelector('.msg-item-preview') || {}).textContent || '';
            var matchesSearch = !query || name.toLowerCase().includes(query) || preview.toLowerCase().includes(query);

            var shouldShow = false;
            
            if (filter === 'all' && !isArchived && matchesSearch) {
                shouldShow = true;
            } else if (filter === 'unread' && hasUnread && !isArchived && matchesSearch) {
                shouldShow = true;
            } else if (filter === 'favorites' && isFavorite && !isArchived && matchesSearch) {
                shouldShow = true;
            } else if (filter === 'archived' && isArchived && matchesSearch) {
                shouldShow = true;
            }

            item.style.display = shouldShow ? 'flex' : 'none';
            if (shouldShow) visibleCount++;
        });

        // Show empty state if no results
        if (visibleCount === 0 && filter !== 'all') {
            var emptyMsg = filter === 'unread' ? 'No unread messages' : 
                           filter === 'favorites' ? 'No favorite conversations' :
                           filter === 'archived' ? 'No archived conversations' : 'No messages';
            var messageList = document.getElementById('messageList');
            if (messageList) {
                var emptyHTML = '<div class="msg-empty-state" style="padding: 40px 20px; text-align: center; color: #9ca3af;">' + emptyMsg + '</div>';
                // Only show if there are no other visible items
                if (!messageList.querySelector('.msg-item-wrapper[style*="display: flex"]')) {
                    // Don't override, just let the empty check happen naturally
                }
            }
        }
    },

    showNotificationsTab: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10050';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 24px; max-width: 500px; width: 95%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="font-size: 20px; font-weight: 700; margin: 0;">🔔 Notifications</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
                </div>
                <div id="notificationsList" style="max-height: 500px; overflow-y: auto;">
                    <div style="text-align: center; color: #9ca3af; padding: 40px;">Loading notifications...</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        if (!this.user || this.isGuest) {
            document.getElementById('notificationsList').innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 40px;">Login to see notifications</div>';
            return;
        }

        var userId = this.user.uid;
        db.ref('notifications/' + userId).orderByChild('timestamp').limitToLast(50).once('value', function(snapshot) {
            var notifications = [];
            snapshot.forEach(function(child) {
                notifications.push({
                    id: child.key,
                    ...child.val()
                });
            });

            notifications.reverse();

            var html = '';
            if (notifications.length === 0) {
                html = '<div style="text-align: center; color: #9ca3af; padding: 40px;">No notifications yet</div>';
            } else {
                notifications.forEach(function(notif) {
                    var icon = notif.type === 'coin_received' ? '💰' : '🔔';
                    html += `
                        <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; background: ${notif.read ? 'white' : '#f0f7ff'}; border-radius: 8px; margin-bottom: 4px;">
                            <div style="display: flex; gap: 10px; align-items: start;">
                                <div style="font-size: 24px;">${icon}</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 14px; color: #1a202c;">${notif.message || 'New notification'}</div>
                                    <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${notif.createdAt || 'Just now'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            var list = document.getElementById('notificationsList');
            if (list) list.innerHTML = html;
        });
    },

    searchMessages: function(query) {
    var items = document.querySelectorAll('.msg-item');  // new class
    var searchQuery = query.toLowerCase().trim();

    items.forEach(function(item) {
        var name = item.querySelector('.msg-item-name');
        var preview = item.querySelector('.msg-item-preview');
        var text = (name ? name.textContent : '') + ' ' + (preview ? preview.textContent : '');

        if (!searchQuery || text.toLowerCase().includes(searchQuery)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
},
    // ============================================
    // CHECK AND SHOW HASHTAG POPUP
    // ============================================

    checkAndShowHashtagPopup: function() {
        if (!this.user) return;

        var userHashtags = this.profile.hashtags || [];
        if (userHashtags.length === 0) {
            console.log('⚠️ User has no hashtags - showing popup');
            this.showMandatoryHashtagSelection();
        }
    },

    // ============================================
    // LOAD DARK MODE PREFERENCE
    // ============================================

    loadDarkModePreference: function() {
        var darkMode = localStorage.getItem('chichi-dark-mode');
        var toggle = document.getElementById('darkModeToggle');

        if (darkMode === 'enabled') {
            document.documentElement.classList.add('dark-mode');
            if (toggle) toggle.textContent = '☀️';
        } else {
            document.documentElement.classList.remove('dark-mode');
            if (toggle) toggle.textContent = '🌙';
        }
    },

    toggleDarkMode: function() {
        var root = document.documentElement;
        var isDarkMode = root.classList.contains('dark-mode');
        var toggle = document.getElementById('darkModeToggle');

        if (isDarkMode) {
            // Switch to light mode
            root.classList.remove('dark-mode');
            localStorage.setItem('chichi-dark-mode', 'disabled');
            if (toggle) toggle.textContent = '🌙';
            this.toast('☀️ Light mode enabled', 'success');
        } else {
            // Switch to dark mode
            root.classList.add('dark-mode');
            localStorage.setItem('chichi-dark-mode', 'enabled');
            if (toggle) toggle.textContent = '☀️';
            this.toast('🌙 Dark mode enabled', 'success');
        }
    },

    // ============================================
    // TOAST
    // ============================================

    toast: function(msg, type) {
        var el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function() { el.remove(); }, 3000);
    },

    // ============================================
    // GET USER TIER
    // ============================================

    getUserTier: function() {
        return 'free';
    },

    getQuestionsRemaining: function() {
        return this.user ? Infinity : 0;
    },

    incrementQuestionCount: function() {
        // Trivia is unlimited; historical answer records are kept in Firebase.
    },

    getTriviaQuestionsForGenre: function(genre) {
        var questionSets = {
            general: window.TRIVIA_QUESTIONS || [],
            math: [
                { question: 'What is 12 × 8?', options: ['86', '96', '108', '88'], correct: 1 },
                { question: 'What is the square root of 144?', options: ['10', '11', '12', '14'], correct: 2 },
                { question: 'A triangle has angles of 50° and 60°. What is the third angle?', options: ['60°', '70°', '80°', '90°'], correct: 1 },
                { question: 'What is 25% of 200?', options: ['25', '40', '50', '75'], correct: 2 },
                { question: 'What is the next prime number after 19?', options: ['20', '21', '23', '29'], correct: 2 }
            ],
            science: [
                { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], correct: 1 },
                { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct: 2 },
                { question: 'What is H₂O commonly called?', options: ['Salt', 'Water', 'Oxygen', 'Hydrogen'], correct: 1 },
                { question: 'Which organ pumps blood around the body?', options: ['Lungs', 'Brain', 'Heart', 'Liver'], correct: 2 },
                { question: 'What force keeps us on the ground?', options: ['Magnetism', 'Gravity', 'Friction', 'Electricity'], correct: 1 }
            ]
        };
        return questionSets[genre] || questionSets.general;
    },

    // ============================================
    // UPDATE EARN STATS
    // ============================================

    updateEarnStats: function() {
        if (!this.user) return;

        var self = this;
        db.ref('users/' + this.user.uid + '/triviaAnswered').once('value', function(snapshot) {
            var answered = snapshot.val() || [];
            var countDisplay = document.getElementById('triviaCount');
            if (countDisplay) {
                countDisplay.textContent = answered.length;
            }

            var streak = 0;
            var today = new Date();
            for (var i = 0; i < 30; i++) {
                var date = new Date(today);
                date.setDate(date.getDate() - i);
                var dateStr = date.toDateString();
                var found = false;
                for (var j = 0; j < answered.length; j++) {
                    if (answered[j].date === dateStr) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    streak++;
                } else if (i > 0) {
                    break;
                }
            }

            var streakDisplay = document.getElementById('streakCount');
            if (streakDisplay) {
                streakDisplay.textContent = streak;
            }
        });
    },

    // ============================================
    // RENDER EARN PAGE
    // ============================================

    renderEarn: function() {
        var self = this;

        if (this.pendingTrivia) {
            this.currentTrivia = this.pendingTrivia;
            this.triviaAnswered = false;
            this.renderEarnWithTrivia(this.pendingTrivia);
            this.pendingTrivia = null;
            return;
        }

        if (this.user && this.user.uid) {
            db.ref('users/' + this.user.uid + '/pendingTrivia').once('value', function(snap) {
                var pending = snap.val();
                if (pending && pending.question) {
                    self.currentTrivia = pending;
                    self.triviaAnswered = false;
                    self.renderEarnWithTrivia(pending);
                } else {
                    self.renderEarnDefault();
                }
            });
        } else {
            this.renderEarnDefault();
        }
    },

    // ============================================
    // RENDER EARN DEFAULT - COMPACT CREDIT CARD
    // ============================================

    renderEarnDefault: function() {
        var earnContainer = document.getElementById('earnContainer');
        if (!earnContainer) {
            // Create container if missing (fix for error #6)
            var earnView = document.getElementById('earnView');
            if (!earnView) {
                // Create earnView if it doesn't exist
                earnView = document.createElement('div');
                earnView.id = 'earnView';
                earnView.className = 'view';
                var mainApp = document.getElementById('mainApp');
                if (mainApp) mainApp.appendChild(earnView);
            }
            earnContainer = document.createElement('div');
            earnContainer.id = 'earnContainer';
            earnView.appendChild(earnContainer);
        }

        if (this.isGuest) {
            earnContainer.innerHTML = `
                <div style="padding: 60px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #fff9e6 0%, #ffe0b3 50%, #ffd9a3 100%); position: relative; overflow: hidden;">
                    <!-- Animated coins in background -->
                    <div style="position: absolute; top: 10%; left: 8%; font-size: 40px; opacity: 0.15; animation: float 3s ease-in-out infinite;">🪙</div>
                    <div style="position: absolute; bottom: 15%; right: 10%; font-size: 50px; opacity: 0.12; animation: float 4s ease-in-out infinite 0.5s;">💰</div>
                    <div style="position: absolute; top: 25%; right: 5%; font-size: 35px; opacity: 0.1; animation: float 3.5s ease-in-out infinite 1s;">💵</div>
                    
                    <div style="position: relative; z-index: 10;">
                        <div style="font-size: 80px; margin-bottom: 20px; animation: bounce 2s infinite; filter: drop-shadow(0 4px 8px rgba(255, 152, 0, 0.3));">💎</div>
                        <h2 style="font-size: 28px; font-weight: 900; margin-bottom: 12px; color: #d97706; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Unlock Rewards</h2>
                        <p style="font-size: 15px; color: #92400e; margin-bottom: 28px; line-height: 1.6; max-width: 320px; font-weight: 500;">Answer trivia questions, complete challenges, and earn Chichi Coins to unlock exclusive rewards!</p>
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button onclick="app.showLoginPage('login')" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.4); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(217, 119, 6, 0.6)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(217, 119, 6, 0.4)'">🔐 Sign In</button>
                            <button onclick="app.showLoginPage('signup')" style="background: white; color: #d97706; border: 2px solid #f59e0b; padding: 12px 28px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.3s;" onmouseover="this.style.background='#fffbeb'" onmouseout="this.style.background='white'">✨ Create Account</button>
                        </div>
                        <p style="font-size: 12px; color: #9a6108; margin-top: 20px; font-weight: 500;">🎁 Join now and get 100 bonus coins!</p>
                    </div>
                </div>
            `;
            return;
        }

        var userTier = 'free';
        var tierData = EARNING_SETTINGS[userTier];
        var remaining = this.getQuestionsRemaining();
        var userBalance = this.balance;
        var triviaCount = this.triviaAnsweredCount || 0;
        var streakCount = this.streakCount || 0;
        var username = this.profile.username || 'user';
        var catalog = window.GIFT_CATALOG || [];

        var html = `
            <div style="padding: 12px 12px 140px 12px; background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh;">

                <!-- HERO SECTION -->
                <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                    border-radius: 20px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 12px 40px rgba(102, 126, 234, 0.25);
                    position: relative;
                    overflow: hidden;
                    color: white;
                ">
                    <div style="position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: -40px; left: -40px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%); border-radius: 50%;"></div>
                    
                    <div style="position: relative; z-index: 2;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h2 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">Welcome Back, ${this.profile.name || 'User'}! 🌟</h2>
                                <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.8);">Keep earning rewards today</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 32px; font-weight: 900; background: linear-gradient(135deg, #FFD700, #FFA500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1;">${userBalance.toFixed(2)}</div>
                                <div style="font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; margin-top: 2px;">💎 Coins</div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">
                            <div style="background: rgba(255,255,255,0.12); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.15);">
                                <div style="font-size: 11px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Today's Streak</div>
                                <div style="font-size: 24px; font-weight: 900; color: #FFD700; margin-top: 4px; display: flex; align-items: center; gap: 6px;">🔥${streakCount}</div>
                            </div>
                            <div style="background: rgba(255,255,255,0.12); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.15);">
                                <div style="font-size: 11px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Questions Left</div>
                                <div style="font-size: 24px; font-weight: 900; color: #FFA500; margin-top: 4px; display: flex; align-items: center; gap: 6px;">${remaining}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ACTION BUTTON -->
                <button onclick="app.startTrivia()" style="
                    width: 100%;
                    padding: 16px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border: none;
                    border-radius: 14px;
                    cursor: ${remaining > 0 ? 'pointer' : 'not-allowed'};
                    font-weight: 700;
                    font-size: 15px;
                    transition: all 0.3s ease;
                    opacity: ${remaining <= 0 ? '0.6' : '1'};
                    box-shadow: 0 6px 20px ${remaining <= 0 ? 'rgba(0,0,0,0.1)' : 'rgba(16,185,129,0.35)'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 24px;
                " ${remaining <= 0 ? 'disabled' : ''} onmouseover="if(${remaining > 0}) { this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(16,185,129,0.45)'; }" onmouseout="if(${remaining > 0}) { this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(16,185,129,0.35)'; }">
                    <span style="font-size: 20px;">⏱️</span>
                    ${remaining > 0 ? 'Start Daily Trivia' : 'All Questions Completed Today!'}
                </button>

                <!-- STATS CARDS -->
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">📈 Your Statistics</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 14px; border: 1px solid #fcd34d;">
                            <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Total Answered</div>
                            <div style="font-size: 26px; font-weight: 900; color: #b45309; margin-top: 4px;">${triviaCount}</div>
                            <div style="font-size: 10px; color: #92400e; margin-top: 4px; opacity: 0.8;">questions</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 12px; padding: 14px; border: 1px solid #93c5fd;">
                            <div style="font-size: 11px; color: #1e40af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">User Tier</div>
                            <div style="font-size: 26px; font-weight: 900; color: #1e40af; margin-top: 4px;">FREE</div>
                            <div style="font-size: 10px; color: #1e40af; margin-top: 4px; opacity: 0.8;">tier level</div>
                        </div>
                    </div>
                </div>

                <!-- DAILY PROGRESS -->
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">Daily Progress</h3>
                        <span style="font-size: 12px; color: #6b7280; font-weight: 600;">${tierData.questionsPerDay - remaining} / ${tierData.questionsPerDay}</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 12px;">
                        <div style="
                            width: ${((tierData.questionsPerDay - remaining) / tierData.questionsPerDay * 100)}%;
                            height: 100%;
                            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
                            border-radius: 10px;
                            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                            box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
                        "></div>
                    </div>
                    <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">Complete all ${tierData.questionsPerDay} daily questions to maximize your earnings! 🎯</p>
                </div>

                <!-- REWARDS SECTION -->
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                        <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">🎁 Redeem Rewards</h3>
                        <button onclick="app.showGiftCatalog()" style="background: none; border: none; color: #3b82f6; cursor: pointer; font-weight: 600; font-size: 11px; padding: 4px 8px;">View All →</button>
                    </div>
                    <div style="display: flex; gap: 12px; overflow-x: auto; padding: 8px 0; -webkit-overflow-scrolling: touch;">
                        ${catalog.map(function(gift) {
                            return `
                                <div style="
                                    flex: 0 0 110px;
                                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                                    border-radius: 14px;
                                    padding: 14px;
                                    text-align: center;
                                    transition: all 0.3s ease;
                                    cursor: pointer;
                                    border: 1.5px solid #e5e7eb;
                                    position: relative;
                                " onmouseover="this.style.background='linear-gradient(135deg, #f0f4f8 0%, #e8eef5 100%)'; this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)'; this.style.borderColor='#d1d5db';" onmouseout="this.style.background='linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'; this.style.borderColor='#e5e7eb';" onclick="app.showGiftCatalog()">
                                    <div style="font-size: 32px; line-height: 1;">${gift.image}</div>
                                    <div style="font-size: 11px; font-weight: 700; color: #1e293b; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${gift.name}</div>
                                    <div style="font-size: 10px; color: #6b7280; margin-top: 4px; font-weight: 600;">${gift.cost} 💎</div>
                                </div>
                            `;
                        }).join('')}
                                border-radius: 6px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 11px;
                                font-weight: 800;
                                color: #1a1a2e;
                                box-shadow: 0 2px 10px rgba(255,215,0,0.25);
                            ">💳</div>
                            <div style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.5px;">CHICHI</div>
                        </div>
                        <div style="
                            font-size: 9px;
                            color: rgba(255,255,255,0.35);
                            font-weight: 600;
                            letter-spacing: 0.3px;
                            background: rgba(255,255,255,0.05);
                            padding: 2px 10px;
                            border-radius: 10px;
                            border: 1px solid rgba(255,255,255,0.04);
                        ">${tierData.label}</div>
                    </div>

                    <div style="position: relative; z-index: 2; margin-bottom: 12px;">
                        <div style="font-size: 9px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Balance</div>
                        <div style="
                            font-size: 30px;
                            font-weight: 800;
                            letter-spacing: -0.5px;
                            background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                            line-height: 1.1;
                        ">${userBalance.toFixed(2)}</div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.35);">Chichi Coins</div>
                    </div>

                    <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 4px;">
                        <div>
                            <div style="font-size: 7px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px;">Card Holder</div>
                            <div style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.8);">${this.profile.name || 'User'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 7px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px;">@username</div>
                            <div style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.65);">@${username}</div>
                        </div>
                    </div>

                    <div style="position: relative; z-index: 2; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.04);">
                        <div style="display: flex; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.35); margin-bottom: 4px;">
                            <span>Daily Questions</span>
                            <span>${remaining} / ${tierData.questionsPerDay}</span>
                        </div>
                        <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden;">
                            <div style="
                                width: ${((tierData.questionsPerDay - remaining) / tierData.questionsPerDay * 100)}%;
                                height: 100%;
                                background: linear-gradient(90deg, #FFD700, #FF6B6B);
                                border-radius: 10px;
                                transition: width 0.5s ease;
                            "></div>
                        </div>
                    </div>

                    <div style="position: relative; z-index: 2; display: flex; gap: 8px; margin-top: 12px;">
                        <button onclick="app.showGiftCatalog()" style="
                            flex: 1;
                            padding: 8px 6px;
                            background: rgba(255,215,0,0.12);
                            color: #FFD700;
                            border: 1px solid rgba(255,215,0,0.15);
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 10px;
                            cursor: pointer;
                            transition: all 0.3s;
                            backdrop-filter: blur(4px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                        " onmouseover="this.style.background='rgba(255,215,0,0.2)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(255,215,0,0.12)'; this.style.transform='translateY(0)'">
                            🎁 Gifts
                        </button>
                        <button onclick="app.showSendMoneyModal()" style="
                            flex: 1;
                            padding: 8px 6px;
                            background: rgba(59,130,246,0.15);
                            color: #60a5fa;
                            border: 1px solid rgba(59,130,246,0.15);
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 10px;
                            cursor: pointer;
                            transition: all 0.3s;
                            backdrop-filter: blur(4px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                        " onmouseover="this.style.background='rgba(59,130,246,0.25)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(59,130,246,0.15)'; this.style.transform='translateY(0)'">
                            📤 Send
                        </button>
                        <button onclick="app.showTransactionHistory()" style="
                            flex: 1;
                            padding: 8px 6px;
                            background: rgba(255,255,255,0.05);
                            color: rgba(255,255,255,0.7);
                            border: 1px solid rgba(255,255,255,0.06);
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 10px;
                            cursor: pointer;
                            transition: all 0.3s;
                            backdrop-filter: blur(4px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                        " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.transform='translateY(0)'">
                            📋 History
                        </button>
                    </div>
                </div>

                <!-- STATS -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                    <div style="background: white; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 24px; font-weight: 700; color: #3b82f6;" id="triviaCount">${triviaCount}</div>
                        <div style="font-size: 11px; color: #64748b; font-weight: 500;">Questions</div>
                    </div>
                    <div style="background: white; border-radius: 14px; padding: 14px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 24px; font-weight: 700; color: #8b5cf6;" id="streakCount">${streakCount}</div>
                        <div style="font-size: 11px; color: #64748b; font-weight: 500;">Streak</div>
                    </div>
                </div>

                <!-- TRIVIA CARD -->
                <div style="background: white; border-radius: 14px; padding: 16px; margin-bottom: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e8ecf0;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 700; color: #15803d;">🧠 Trivia</div>
                            <div style="font-size: 11px; color: #64748b;">Earn coins answering questions</div>
                        </div>
                        <div style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap;">+${tierData.rewardPerQuestion}</div>
                    </div>

                    <div style="background: #f8fafc; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: #64748b;">
                            <span style="font-weight: 600; color: #1e293b;">${remaining}</span> left today
                        </div>
                        <div style="font-size: 10px; color: #94a3b8;">⏱️ ${tierData.timerSeconds}s</div>
                    </div>

                    <button onclick="app.showTriviaReadyScreen()" style="
                        width: 100%;
                        padding: 12px;
                        background: ${remaining > 0 ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#94a3b8'};
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: ${remaining > 0 ? 'pointer' : 'not-allowed'};
                        font-weight: 600;
                        font-size: 13px;
                        transition: all 0.3s;
                        opacity: ${remaining <= 0 ? '0.6' : '1'};
                    " ${remaining <= 0 ? 'disabled' : ''} onmouseover="if(${remaining > 0}) { this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 15px rgba(34,197,94,0.3)'; }" onmouseout="if(${remaining > 0}) { this.style.transform='translateY(0)'; this.style.boxShadow='none'; }">
                        ${remaining > 0 ? '⏱️ Start Trivia' : '⏳ Done for today'}
                    </button>
                </div>

                <!-- GIFT CATALOG PREVIEW (Horizontal Scroll) -->
                <div style="background: white; border-radius: 14px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e8ecf0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b;">🎁 Gifts</h3>
                        <button onclick="app.showGiftCatalog()" style="background: none; border: none; color: #3b82f6; cursor: pointer; font-weight: 600; font-size: 11px;">See All →</button>
                    </div>
                    <div style="display: flex; gap: 10px; overflow-x: auto; padding: 4px 0 8px 0; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;">
                        ${catalog.map(function(gift) {
                            return `
                                <div style="
                                    flex: 0 0 100px;
                                    background: #f8fafc;
                                    border-radius: 12px;
                                    padding: 12px;
                                    text-align: center;
                                    transition: 0.3s;
                                    cursor: pointer;
                                    scroll-snap-align: start;
                                    border: 1px solid #e5e7eb;
                                " onmouseover="this.style.background='#f1f5f9'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#f8fafc'; this.style.transform='translateY(0)'" onclick="app.showGiftCatalog()">
                                    <div style="font-size: 28px;">${gift.image}</div>
                                    <div style="font-size: 10px; font-weight: 600; color: #1e293b; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${gift.name}</div>
                                    <div style="font-size: 9px; color: #6b7280;">${gift.cost} Coins</div>
                                </div>
                            `;
                        }).join('')}
                        ${catalog.length === 0 ? '<div style="flex: 1; text-align: center; color: #6b7280; padding: 20px; font-size: 12px;">No gifts</div>' : ''}
                    </div>
                </div>

            </div>
        `;

        earnContainer.innerHTML = html;
        this.updateEarnStats();
    },

    // ============================================
    // RENDER EARN WITH TRIVIA
    // ============================================

    renderEarnWithTrivia: function(questionData) {
        var self = this;
        var earnContainer = document.getElementById('earnContainer');
        if (!earnContainer) {
            // Create earnContainer if missing (fix for error #6)
            var earnView = document.getElementById('earnView');
            if (!earnView) {
                earnView = document.createElement('div');
                earnView.id = 'earnView';
                earnView.className = 'view';
                var mainApp = document.getElementById('mainApp');
                if (mainApp) mainApp.appendChild(earnView);
            }
            earnContainer = document.createElement('div');
            earnContainer.id = 'earnContainer';
            earnView.appendChild(earnContainer);
        }

        if (!this.currentTrivia && questionData) {
            this.currentTrivia = questionData;
            this.triviaAnswered = false;
        }

        if (!questionData) {
            console.error('❌ No question data provided');
            return;
        }

        var userTier = 'free';
        var tierData = EARNING_SETTINGS[userTier];
        var remaining = this.getQuestionsRemaining();
        var catalog = window.GIFT_CATALOG || [];
        var username = this.profile.username || 'user';

        var optionsHtml = '';
        questionData.options.forEach(function(option, index) {
            optionsHtml += `
                <button class="trivia-option" onclick="app.answerTriviaFromEarn(${index})" style="
                    display: block;
                    width: 100%;
                    padding: 10px 14px;
                    margin: 4px 0;
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    text-align: left;
                    transition: all 0.3s;
                    color: #1a202c;
                " onmouseover="this.style.borderColor='#0088cc'; this.style.background='#f0f7ff'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white'">
                    ${option}
                </button>
            `;
        });

        var html = `
            <div style="padding: 12px 12px 140px 12px; background: #f0f2f5; min-height: 100vh;">

                <!-- CREDIT CARD -->
                <div style="
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
                    border-radius: 18px;
                    padding: 20px 20px 16px 20px;
                    margin-bottom: 16px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
                    position: relative;
                    overflow: hidden;
                    color: white;
                ">
                    <div style="position: absolute; top: -40px; right: -40px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(255,215,0,0.06) 0%, transparent 70%); border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: -50px; left: -30px; width: 130px; height: 130px; background: radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%); border-radius: 50%;"></div>

                    <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="
                                width: 36px;
                                height: 28px;
                                background: linear-gradient(135deg, #FFD700, #FFA500);
                                border-radius: 6px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 11px;
                                font-weight: 800;
                                color: #1a1a2e;
                                box-shadow: 0 2px 10px rgba(255,215,0,0.25);
                            ">💳</div>
                            <div style="font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.5px;">CHICHI</div>
                        </div>
                        <div style="
                            font-size: 9px;
                            color: rgba(255,255,255,0.35);
                            font-weight: 600;
                            letter-spacing: 0.3px;
                            background: rgba(255,255,255,0.05);
                            padding: 2px 10px;
                            border-radius: 10px;
                            border: 1px solid rgba(255,255,255,0.04);
                        ">${tierData.label}</div>
                    </div>

                    <div style="position: relative; z-index: 2; margin-bottom: 12px;">
                        <div style="font-size: 9px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Balance</div>
                        <div style="
                            font-size: 30px;
                            font-weight: 800;
                            letter-spacing: -0.5px;
                            background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                            line-height: 1.1;
                        " id="earnBalanceDisplay">${this.balance.toFixed(2)}</div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.35);">Chichi Coins</div>
                    </div>

                    <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 4px;">
                        <div>
                            <div style="font-size: 7px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px;">Card Holder</div>
                            <div style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.8);">${this.profile.name || 'User'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 7px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px;">@username</div>
                            <div style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.65);">@${username}</div>
                        </div>
                    </div>

                    <div style="position: relative; z-index: 2; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.04);">
                        <div style="display: flex; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.35); margin-bottom: 4px;">
                            <span>Daily Questions</span>
                            <span>${remaining} / ${tierData.questionsPerDay}</span>
                        </div>
                        <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden;">
                            <div style="
                                width: ${((tierData.questionsPerDay - remaining) / tierData.questionsPerDay * 100)}%;
                                height: 100%;
                                background: linear-gradient(90deg, #FFD700, #FF6B6B);
                                border-radius: 10px;
                                transition: width 0.5s ease;
                            "></div>
                        </div>
                    </div>

                    <div style="position: relative; z-index: 2; display: flex; gap: 8px; margin-top: 12px;">
                        <button onclick="app.showGiftCatalog()" style="
                            flex: 1;
                            padding: 8px 6px;
                            background: rgba(255,215,0,0.12);
                            color: #FFD700;
                            border: 1px solid rgba(255,215,0,0.15);
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 10px;
                            cursor: pointer;
                            transition: all 0.3s;
                            backdrop-filter: blur(4px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                        " onmouseover="this.style.background='rgba(255,215,0,0.2)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(255,215,0,0.12)'; this.style.transform='translateY(0)'">
                            🎁 Gifts
                        </button>
                        <button onclick="app.showSendMoneyModal()" style="
                            flex: 1;
                            padding: 8px 6px;
                            background: rgba(59,130,246,0.15);
                            color: #60a5fa;
                            border: 1px solid rgba(59,130,246,0.15);
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 10px;
                            cursor: pointer;
                            transition: all 0.3s;
                            backdrop-filter: blur(4px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                        " onmouseover="this.style.background='rgba(59,130,246,0.25)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(59,130,246,0.15)'; this.style.transform='translateY(0)'">
                            📤 Send
                        </button>
                        <button onclick="app.showTransactionHistory()" style="
                            flex: 1;
                            padding: 8px 6px;
                            background: rgba(255,255,255,0.05);
                            color: rgba(255,255,255,0.7);
                            border: 1px solid rgba(255,255,255,0.06);
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 10px;
                            cursor: pointer;
                            transition: all 0.3s;
                            backdrop-filter: blur(4px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                        " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.transform='translateY(0)'">
                            📋 History
                        </button>
                    </div>
                </div>

                <!-- TRIVIA INITIATION CARD - MINIMAL & CREATIVE -->
                <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%); border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3); position: relative; overflow: hidden;">
                    <!-- Animated background elements -->
                    <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); border-radius: 50%; animation: float 6s ease-in-out infinite;"></div>
                    <div style="position: absolute; bottom: -20px; left: -20px; width: 100px; height: 100px; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); border-radius: 50%;"></div>
                    
                    <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="font-size: 28px;">🧠</div>
                            <div>
                                <div style="font-size: 16px; font-weight: 700; color: white; letter-spacing: 0.5px;">Daily Trivia</div>
                                <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 2px;">Earn ${tierData.rewardPerQuestion} coins per question</div>
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.3); white-space: nowrap;">
                            Unlimited plays
                        </div>
                    </div>
                    
                    <div style="position: relative; z-index: 2; display: flex; gap: 12px; align-items: center;">
                        <button id="triviaStartBtn" onclick="app.chooseTriviaGenre();" style="
                            flex: 1;
                            padding: 14px 20px;
                            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-weight: 700;
                            font-size: 14px;
                            cursor: ${remaining > 0 ? 'pointer' : 'not-allowed'};
                            transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                            opacity: ${remaining > 0 ? '1' : '0.6'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        " ${remaining <= 0 ? 'disabled' : ''} onmouseover="if(${remaining > 0}) { this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.4)'; }" onmouseout="if(${remaining > 0}) { this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'; }">
                            <span>${remaining > 0 ? '▶' : '✓'}</span> ${remaining > 0 ? 'Start Quiz' : 'Done Today'}
                        </button>
                        <button onclick="app.showGiftCatalog()" style="
                            width: 50px;
                            height: 50px;
                            padding: 0;
                            background: rgba(255,255,255,0.2);
                            color: white;
                            border: 1px solid rgba(255,255,255,0.3);
                            border-radius: 12px;
                            font-size: 18px;
                            cursor: pointer;
                            transition: all 0.3s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            backdrop-filter: blur(10px);
                        " title="View Rewards" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)'">
                            🎁
                        </button>
                    </div>
                    
                    <div id="triviaQuestionArea" style="display: none;"></div>
                </div>

                <!-- GIFT CATALOG PREVIEW (Horizontal Scroll) -->
                <div style="background: white; border-radius: 14px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e8ecf0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b;">🎁 Gifts</h3>
                        <button onclick="app.showGiftCatalog()" style="background: none; border: none; color: #3b82f6; cursor: pointer; font-weight: 600; font-size: 11px;">See All →</button>
                    </div>
                    <div style="display: flex; gap: 10px; overflow-x: auto; padding: 4px 0 8px 0; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;">
                        ${catalog.map(function(gift) {
                            return `
                                <div style="flex: 0 0 100px; background: #f8fafc; border-radius: 12px; padding: 12px; text-align: center; transition: 0.3s; cursor: pointer; scroll-snap-align: start; border: 1px solid #e5e7eb;" onmouseover="this.style.background='#f1f5f9'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#f8fafc'; this.style.transform='translateY(0)'" onclick="app.showGiftCatalog()">
                                    <div style="font-size: 28px;">${gift.image}</div>
                                    <div style="font-size: 10px; font-weight: 600; color: #1e293b; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${gift.name}</div>
                                    <div style="font-size: 9px; color: #6b7280;">${gift.cost} Coins</div>
                                </div>
                            `;
                        }).join('')}
                        ${catalog.length === 0 ? '<div style="flex: 1; text-align: center; color: #6b7280; padding: 20px; font-size: 12px;">No gifts</div>' : ''}
                    </div>
                </div>


            <style>
                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                </style>

            </div>
        `;

        earnContainer.innerHTML = html;

        // Start campaign
        this.startGFDayCountdown();

        // Start timer
        var timeLeft = tierData.timerSeconds;
        var timerDisplay = document.getElementById('triviaTimeLeft');

        if (this.triviaTimer) {
            clearInterval(this.triviaTimer);
        }

        this.triviaTimer = setInterval(function() {
            timeLeft--;
            if (timerDisplay) {
                timerDisplay.textContent = timeLeft;
                if (timeLeft <= 3) {
                    timerDisplay.style.color = '#ef4444';
                }
            }

            if (timeLeft <= 0) {
                clearInterval(self.triviaTimer);
                self.triviaTimer = null;

                if (!self.triviaAnswered && self.currentTrivia) {
                    self.triviaAnswered = true;

                    document.querySelectorAll('.trivia-option').forEach(function(btn, index) {
                        btn.disabled = true;
                        btn.style.cursor = 'not-allowed';
                        if (self.currentTrivia && index === self.currentTrivia.correct) {
                            btn.style.borderColor = '#22c55e';
                            btn.style.background = '#dcfce7';
                        }
                    });

                    var resultArea = document.getElementById('triviaResultArea');
                    if (resultArea && self.currentTrivia) {
                        resultArea.style.display = 'block';
                        var correctAnswer = (self.currentTrivia.options && self.currentTrivia.correct !== undefined) ? self.currentTrivia.options[self.currentTrivia.correct] : 'Unknown';
                        resultArea.innerHTML = `
                            <div style="color: #ef4444; font-weight: 700; font-size: 18px; margin-bottom: 8px;">⏰ Time's Up!</div>
                            <div style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">The correct answer was: <strong>${correctAnswer}</strong></div>
                            <button onclick="app.loadNextTriviaQuestion();" style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">📝 Next Question</button>
                        `;
                        resultArea.style.background = '#fee2e2';
                    }
                }
            }
        }, 1000);

        this.updateEarnStats();
    },

    answerTriviaFromEarn: function(selectedIndex) {
        console.log('🎯 Answer submitted:', selectedIndex);

        if (this.triviaAnswered) {
            return;
        }

        if (!this.currentTrivia) {
            this.toast('Error: No question loaded.', 'error');
            return;
        }

        if (!this.user || this.isGuest) {
            this.toast('Please log in to answer trivia', 'error');
            return;
        }

        if (this.triviaTimer) {
            clearInterval(this.triviaTimer);
            this.triviaTimer = null;
        }

        this.triviaAnswered = true;
        var self = this;
        var userId = this.user.uid;
        var userTier = 'free';
        var tierData = EARNING_SETTINGS[userTier];
        var correct = this.currentTrivia.correct === selectedIndex;
        var today = new Date().toDateString();

        document.querySelectorAll('.trivia-option').forEach(function(btn, index) {
            btn.disabled = true;
            btn.style.cursor = 'not-allowed';
            if (index === self.currentTrivia.correct) {
                btn.style.borderColor = '#22c55e';
                btn.style.background = '#dcfce7';
            } else if (index === selectedIndex && !correct) {
                btn.style.borderColor = '#ef4444';
                btn.style.background = '#fee2e2';
            }
        });

        var resultArea = document.getElementById('triviaResultArea');
        resultArea.style.display = 'block';

        // Get user's first name for personalization
        var userName = (this.profile.name || 'Friend').split(' ')[0];

        if (correct) {
            var earnedAmount = tierData.rewardPerQuestion;
            var oldBalance = this.balance;
            var newBalance = oldBalance + earnedAmount;

            resultArea.innerHTML = `
                <div style="color: #22c55e; font-weight: 700; font-size: 20px; margin-bottom: 8px;">✅ ${userName}, Good Job!</div>
                <div style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">You've earned some Chichi Points</div>

                <!-- BALANCE ANIMATION -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">Points earned:</div>
                    <div style="font-size: 32px; font-weight: 700; color: #22c55e; text-align: center; margin-bottom: 12px;" id="earnedAmount">+${earnedAmount.toFixed(2)}</div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">New balance:</div>
                    <div style="font-size: 24px; font-weight: 700; color: #3b82f6; text-align: center;" id="animatedBalance">${oldBalance.toFixed(2)}</div>
                </div>

                <button onclick="app.loadNextTriviaQuestion();" id="nextBtn" style="width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; display: none;">📝 Next Question</button>
            `;
            resultArea.style.background = '#dcfce7';

            // Animate balance counter
            setTimeout(function() {
                var currentBalance = oldBalance;
                var increment = earnedAmount / 40;
                var counter = 0;

                var counterInterval = setInterval(function() {
                    counter++;
                    currentBalance += increment;

                    var balanceDisplay = document.getElementById('animatedBalance');
                    if (balanceDisplay) {
                        balanceDisplay.textContent = currentBalance.toFixed(2);
                    }

                    if (counter >= 40) {
                        clearInterval(counterInterval);
                        if (balanceDisplay) {
                            balanceDisplay.textContent = newBalance.toFixed(2);
                        }

                        var nextBtn = document.getElementById('nextBtn');
                        if (nextBtn) {
                            nextBtn.style.display = 'block';
                        }
                    }
                }, 25);
            }, 300);

            this.balance = newBalance;
            db.ref('users/' + userId + '/balance').set(this.balance);

            this.trackRevenue('earned', earnedAmount, 'trivia');

            var balanceDisplay = document.getElementById('earnBalanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.textContent = this.balance.toFixed(2) + ' Coins';
            }

            this.toast('🎉 Correct! +' + earnedAmount.toFixed(2) + ' Coins', 'success');
            this.incrementQuestionCount();
        } else {
            resultArea.innerHTML = `
                <div style="color: #ef4444; font-weight: 700; font-size: 18px;">❌ Wrong answer</div>
                <div style="color: #6b7280; font-size: 14px; margin-top: 8px;">The correct answer was: <strong>${this.currentTrivia.options[this.currentTrivia.correct]}</strong></div>
                <button onclick="app.loadNextTriviaQuestion();" style="width: 100%; margin-top: 12px; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">📝 Next Question</button>
            `;
            resultArea.style.background = '#fee2e2';
            this.toast('❌ Wrong answer! Try again.', 'error');
        }

        var answeredData = {
            date: today,
            questionIndex: this.currentTrivia.questionIndex,
            correct: correct
        };

        db.ref('users/' + userId + '/triviaAnswered').once('value', function(snapshot) {
            var answered = snapshot.val() || [];
            answered.push(answeredData);
            db.ref('users/' + userId + '/triviaAnswered').set(answered);
        });

        db.ref('users/' + userId + '/pendingTrivia').remove();

        setTimeout(function() {
            var remaining = self.getQuestionsRemaining();
            if (remaining > 0) {
                var resultArea = document.getElementById('triviaResultArea');
                if (resultArea) {
                    resultArea.innerHTML += `
                        <button onclick="app.loadNextTriviaQuestion();" style="margin-top: 12px; padding: 10px 24px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            📝 Next Question (${remaining} left)
                        </button>
                    `;
                }
            } else {
                var resultArea = document.getElementById('triviaResultArea');
                if (resultArea) {
                    resultArea.innerHTML += `
                        <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 8px; color: #92400e;">
                            ✅ You've answered all questions for today! Come back tomorrow.
                        </div>
                    `;
                }
            }
        }, 1500);
    },

    // ============================================
    // START TRIVIA TIMER
    // ============================================

    startTriviaTimer: function() {
        var self = this;

        if (this.triviaInterval) {
            clearInterval(this.triviaInterval);
        }

        this.triviaInterval = setInterval(function() {
            self.checkTriviaStatus();
        }, 60000);
    
    },

    checkTriviaStatus: function() {
        if (!this.user || this.isGuest) return;

        var self = this;
        var userId = this.user.uid;
        var today = new Date().toDateString();

        db.ref('users/' + userId + '/triviaAnswered').once('value', function(snapshot) {
            var answered = snapshot.val() || [];
            var answeredToday = false;

            for (var i = 0; i < answered.length; i++) {
                if (answered[i].date === today) {
                    answeredToday = true;
                    break;
                }
            }

            if (!answeredToday) {
                self.generateTriviaQuestion();
            }
        });
    },

    loadNextTriviaQuestion: function(continueQuiz) {
        var self = this;
        console.log('📝 Loading next trivia question...');

        this.triviaAnswered = false;
        this.currentTrivia = null;
        if (this.triviaTimer) {
            clearInterval(this.triviaTimer);
            this.triviaTimer = null;
        }

        this.generateTriviaQuestion(function() {
            self.renderEarn();
            if (continueQuiz) self.showTriviaQuestion();
        });
    },

    generateTriviaQuestion: function(callback) {
        if (!this.user || this.isGuest) {
            this.toast('⚠️ Please log in to answer trivia', 'error');
            return;
        }

        var remaining = this.getQuestionsRemaining();
        if (remaining <= 0) {
            this.toast('✅ All questions answered for today! Come back tomorrow.', 'info');
            return;
        }

        var self = this;
        var userId = this.user.uid;

        db.ref('users/' + userId + '/pendingTrivia').once('value', function(snap) {
            var pending = snap.val();
            if (pending && pending.question) {
                self.displayTriviaInEarn(pending);
                if (callback) callback();
                return;
            }

            db.ref('users/' + userId + '/triviaAnswered').once('value', function(snapshot) {
                var answered = snapshot.val() || [];

                var triviaPool = self.getTriviaQuestionsForGenre(self.triviaGenre || 'general');
                var unanswered = triviaPool.filter(function(q, index) {
                    for (var j = 0; j < answered.length; j++) {
                        if (answered[j].questionIndex === index) {
                            return false;
                        }
                    }
                    return true;
                });

                if (unanswered.length === 0) {
                    db.ref('users/' + userId + '/triviaAnswered').set([]);
                    unanswered = triviaPool.slice();
                }

                var randomIndex = Math.floor(Math.random() * unanswered.length);
                var question = unanswered[randomIndex];
                var questionIndex = triviaPool.indexOf(question);

                var shuffledOptions = question.options.slice();
                var correctValue = question.options[question.correct];
                var shuffledCorrectIndex = shuffledOptions.indexOf(correctValue);

                var pendingData = {
                    question: question.question,
                    options: shuffledOptions,
                    correct: shuffledCorrectIndex,
                    originalCorrect: question.correct,
                    questionIndex: questionIndex,
                    timestamp: Date.now()
                };

                db.ref('users/' + userId + '/pendingTrivia').set(pendingData, function(err) {
                    if (err) {
                        console.error('❌ Error saving trivia:', err);
                        self.toast('Error loading question. Try again.', 'error');
                    } else {
                        self.displayTriviaInEarn(pendingData);
                        if (callback) callback();
                    }
                });
            }, function(err) {
                console.error('❌ Error reading answered questions:', err);
                self.toast('Error loading trivia. Try again.', 'error');
            });
        }, function(err) {
            console.error('❌ Error reading pending trivia:', err);
            self.toast('Error loading trivia. Try again.', 'error');
        });
    },

    displayTriviaInEarn: function(questionData) {
        if (!this.user || this.isGuest) {
            console.error('❌ User not authenticated for trivia display');
            return;
        }

        if (!questionData || !questionData.question) {
            console.error('❌ Invalid question data:', questionData);
            this.toast('Error loading question. Try again.', 'error');
            return;
        }

        this.currentTrivia = questionData;
        this.triviaAnswered = false;

        var earnView = document.getElementById('earnView');
        if (!earnView) {
            console.warn('⚠️ Earn view missing, creating it...');
            var mainApp = document.getElementById('mainApp');
            if (mainApp) {
                earnView = document.createElement('div');
                earnView.id = 'earnView';
                earnView.className = 'view';
                mainApp.appendChild(earnView);
                // Also create container
                var container = document.createElement('div');
                container.id = 'earnContainer';
                earnView.appendChild(container);
            }
        }

        if (!earnView.classList.contains('active')) {
            this.pendingTrivia = questionData;
            return;
        }

        this.pendingTrivia = null;
        this.renderEarnWithTrivia(questionData);
    },

    chooseTriviaGenre: function() {
        var self = this;
        var existing = document.getElementById('triviaGenreModal');
        if (existing) existing.remove();

        var genres = [
            { id: 'general', icon: '🌍', title: 'General', subtitle: 'Culture, places and everyday knowledge', color: '#0284c7' },
            { id: 'math', icon: '∑', title: 'Math', subtitle: 'Patterns, numbers and quick thinking', color: '#7c3aed' },
            { id: 'science', icon: '⚗', title: 'Science', subtitle: 'Nature, space and the human body', color: '#059669' }
        ];
        var choices = genres.map(function(genre) {
            return '<button data-genre="' + genre.id + '" style="width:100%;display:flex;align-items:center;gap:14px;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;text-align:left;font:inherit;"><span style="width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:' + genre.color + ';color:#fff;font-size:20px;font-weight:800;">' + genre.icon + '</span><span><strong style="display:block;color:#172033;font-size:14px;">' + genre.title + '</strong><small style="color:#64748b;font-size:12px;">' + genre.subtitle + '</small></span></button>';
        }).join('');
        var modal = document.createElement('div');
        modal.id = 'triviaGenreModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10001;padding:16px;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);';
        modal.innerHTML = '<div style="width:min(100%,390px);padding:22px;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.3);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><h2 style="margin:0;color:#172033;font-size:19px;">Choose your round</h2><button type="button" aria-label="Close" style="border:0;background:none;font-size:22px;cursor:pointer;color:#64748b;">×</button></div><p style="margin:0 0 16px;color:#64748b;font-size:13px;">Pick a category, then begin when you are ready.</p><div style="display:grid;gap:9px;">' + choices + '</div></div>';
        modal.querySelector('button[aria-label="Close"]').onclick = function() { modal.remove(); };
        modal.querySelectorAll('[data-genre]').forEach(function(button) {
            button.onclick = function() {
                self.triviaGenre = this.dataset.genre;
                modal.remove();
                self.currentTrivia = null;
                db.ref('users/' + self.user.uid + '/pendingTrivia').remove().then(function() {
                    self.generateTriviaQuestion(function() { self.showTriviaQuestion(); });
                });
            };
        });
        document.body.appendChild(modal);
    },

    closeTriviaQuiz: function() {
        if (this.triviaTimer) {
            clearInterval(this.triviaTimer);
            this.triviaTimer = null;
        }

        var quizModal = document.getElementById('triviaQuizModal');
        var genreModal = document.getElementById('triviaGenreModal');
        if (quizModal) quizModal.remove();
        if (genreModal) genreModal.remove();

        this.currentTrivia = null;
        this.pendingTrivia = null;
        this.triviaAnswered = false;

        if (this.user && this.user.uid) {
            db.ref('users/' + this.user.uid + '/pendingTrivia').remove();
        }
        this.renderEarnDefault();
    },

    showTriviaQuestion: function() {
        if (!this.currentTrivia) {
            this.toast('❌ No question loaded', 'error');
            return;
        }

        var self = this;
        var tierData = EARNING_SETTINGS['free'];
        var questionData = this.currentTrivia;

        // Create modal overlay
        var overlay = document.createElement('div');
        overlay.id = 'triviaQuizModal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 16px;
            animation: fadeIn 0.3s ease;
        `;

        var optionsHtml = '';
        questionData.options.forEach(function(option, index) {
            optionsHtml += `
                <button class="trivia-quiz-option" data-index="${index}" style="
                    display: block;
                    width: 100%;
                    padding: 12px 16px;
                    margin: 8px 0;
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    text-align: left;
                    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                    color: #1a202c;
                    position: relative;
                    overflow: hidden;
                ">
                    <span style="position: relative; z-index: 2;">${String.fromCharCode(65 + index)}. ${option}</span>
                </button>
            `;
        });

        var quizContent = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 28px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.4s cubic-bezier(0.4,0,0.2,1);
                position: relative;
            ">
                <!-- Close Button -->
                <button onclick="app.closeTriviaQuiz();" style="
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #9ca3af;
                    transition: 0.3s;
                    padding: 4px;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                " onmouseover="this.style.color='#ef4444'; this.style.background='#fee2e2';" onmouseout="this.style.color='#9ca3af'; this.style.background='none';">✕</button>

                <!-- Question Header -->
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Quick Quiz</div>
                        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600;">⏱️ ${tierData.timerSeconds}s</div>
                    </div>
                    <p style="font-size: 18px; font-weight: 700; color: #1a202c; margin: 0; line-height: 1.6; margin-bottom: 16px;">${questionData.question}</p>
                    <div style="height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
                        <div style="height: 100%; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%); width: 100%; animation: slideRight 0.5s ease;"></div>
                    </div>
                </div>

                <!-- Options -->
                <div id="quizOptions" style="margin-bottom: 20px;">
                    ${optionsHtml}
                </div>

                <!-- Result Area (Hidden by default) -->
                <div id="quizResult" style="display: none; padding: 16px; border-radius: 14px; margin-bottom: 16px; text-align: center; font-weight: 600;"></div>

                <!-- Next Button (Hidden initially) -->
                <button id="quizNextBtn" onclick="app.loadNextTriviaQuestion(true);" style="
                    display: none;
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(59, 130, 246, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.3)'">
                    📝 Next Question
                </button>

                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    @keyframes slideRight {
                        from { width: 0; }
                        to { width: 100%; }
                    }
                    .trivia-quiz-option:hover {
                        border-color: #6366f1;
                        background: linear-gradient(135deg, #f0f4f8 0%, #ede9fe 100%);
                        transform: translateX(4px);
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
                    }
                    .trivia-quiz-option.disabled {
                        cursor: not-allowed;
                    }
                    .trivia-quiz-option.correct {
                        border-color: #22c55e;
                        background: #dcfce7;
                        color: #15803d;
                    }
                    .trivia-quiz-option.wrong {
                        border-color: #ef4444;
                        background: #fee2e2;
                        color: #dc2626;
                    }
                </style>
            </div>
        `;

        overlay.innerHTML = quizContent;
        document.body.appendChild(overlay);

        // Add event listeners to options
        var optionButtons = overlay.querySelectorAll('.trivia-quiz-option');
        optionButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (self.triviaAnswered) return;

                var selectedIndex = parseInt(this.dataset.index);
                self.triviaAnswered = true;

                // Disable all buttons
                optionButtons.forEach(function(b) {
                    b.classList.add('disabled');
                    b.style.pointerEvents = 'none';
                    if (parseInt(b.dataset.index) === questionData.correct) {
                        b.classList.add('correct');
                    } else if (parseInt(b.dataset.index) === selectedIndex) {
                        b.classList.add('wrong');
                    }
                });

                // Show result
                var resultArea = overlay.querySelector('#quizResult');
                var isCorrect = selectedIndex === questionData.correct;

                if (isCorrect) {
                    resultArea.innerHTML = '✅ Correct! You earned ' + tierData.rewardPerQuestion + ' coins!';
                    resultArea.style.background = '#dcfce7';
                    resultArea.style.color = '#15803d';
                    
                    // Update balance
                    self.balance += tierData.rewardPerQuestion;
                    self.updateBalanceDisplays();
                } else {
                    var correctAnswer = questionData.options[questionData.correct];
                    resultArea.innerHTML = '❌ Wrong! Correct answer: <strong>' + correctAnswer + '</strong>';
                    resultArea.style.background = '#fee2e2';
                    resultArea.style.color = '#dc2626';
                }

                resultArea.style.display = 'block';

                // Save answer to Firebase
                var userId = self.user.uid;
                var today = new Date().toDateString();
                var answeredEntry = {
                    questionIndex: questionData.questionIndex,
                    correct: isCorrect,
                    date: today,
                    timestamp: Date.now()
                };

                // Add to answered questions list
                db.ref('users/' + userId + '/triviaAnswered').once('value', function(snap) {
                    var answered = snap.val() || [];
                    answered.push(answeredEntry);
                    db.ref('users/' + userId + '/triviaAnswered').set(answered);
                });

                // Update balance if correct
                if (isCorrect) {
                    db.ref('users/' + userId + '/balance').set(self.balance).catch(function(err) {
                        console.error('❌ Error saving balance:', err);
                    });
                }

                // Clear pending trivia
                db.ref('users/' + userId + '/pendingTrivia').set(null);

                // Show next button after 2 seconds
                setTimeout(function() {
                    var nextBtn = overlay.querySelector('#quizNextBtn');
                    if (nextBtn) {
                        nextBtn.style.display = 'block';
                        nextBtn.style.animation = 'slideUp 0.4s ease';
                    }
                }, 2000);

                // Handle timer
                if (self.triviaTimer) clearInterval(self.triviaTimer);
            });
        });

        // Auto-submit if time runs out
        var timeLeft = tierData.timerSeconds;
        if (self.triviaTimer) clearInterval(self.triviaTimer);
        self.triviaTimer = setInterval(function() {
            timeLeft--;
            var timerBadge = overlay.querySelector('[style*="⏱️"]');
            if (timerBadge) {
                timerBadge.textContent = '⏱️ ' + timeLeft + 's';
                if (timeLeft <= 3) {
                    timerBadge.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                }
            }

            if (timeLeft <= 0) {
                clearInterval(self.triviaTimer);
                if (!self.triviaAnswered) {
                    self.triviaAnswered = true;
                    optionButtons.forEach(function(b) {
                        b.classList.add('disabled');
                        b.style.pointerEvents = 'none';
                        if (parseInt(b.dataset.index) === questionData.correct) {
                            b.classList.add('correct');
                        }
                    });
                    var resultArea = overlay.querySelector('#quizResult');
                    var correctAnswer = questionData.options[questionData.correct];
                    resultArea.innerHTML = '⏰ Time\'s up! Correct answer: <strong>' + correctAnswer + '</strong>';
                    resultArea.style.background = '#fef3c7';
                    resultArea.style.color = '#92400e';
                    resultArea.style.display = 'block';
                    setTimeout(function() {
                        var nextBtn = overlay.querySelector('#quizNextBtn');
                        if (nextBtn) nextBtn.style.display = 'block';
                    }, 1500);
                }
            }
        }, 1000);
    },

    // ============================================
    // SET ONLINE STATUS
    // ============================================

    setOnlineStatus: function() {
        if (!this.user || this.isGuest) return;

        var self = this;
        var presenceRef = db.ref('presence/' + this.user.uid);
        presenceRef.onDisconnect().set({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        presenceRef.set({
            online: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        db.ref('users/' + this.user.uid + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);

        if (this.onlineInterval) {
            clearInterval(this.onlineInterval);
        }
        this.onlineInterval = setInterval(function() {
            if (self.user) {
                db.ref('users/' + self.user.uid + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
            }
        }, 30000);
    },

    // ============================================
    // UPDATE HEADER MENU (Renamed from updateLogoutButton)
    // ============================================

    updateHeaderMenu: function() {
        // Control Profile button
        var menuProfile = document.getElementById('menuProfile');
        if (menuProfile) {
            menuProfile.style.display = this.isGuest ? 'none' : 'block';
        }

        // Control Admin button
        var adminBtn = document.getElementById('adminMenuBtn');
        if (adminBtn) {
            adminBtn.style.display = (this.isAdmin && !this.isGuest) ? 'block' : 'none';
        }

        // Control Login button
        var menuLogin = document.getElementById('menuLogin');
        if (menuLogin) {
            menuLogin.style.display = this.isGuest ? 'block' : 'none';
        }

        // Control Logout button
        var menuLogout = document.getElementById('menuLogout');
        if (menuLogout) {
            menuLogout.style.display = this.isGuest ? 'none' : 'block';
        }

        // Control Sign In button (if you added one)
        var signInBtn = document.getElementById('signInBtn');
        if (signInBtn) {
            signInBtn.style.display = this.isGuest ? 'block' : 'none';
        }

        // Control FAB (Create Post button)
        var fab = document.querySelector('.fab-button-nav');
        if (fab) {
            fab.style.display = this.isGuest ? 'none' : 'flex';
        }
    },

    // ============================================
    // SHOW AUTH / APP
    // ============================================

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

        document.querySelectorAll('.view').forEach(function(v) {
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

        // ----- ROBUST SPLASH REMOVAL (FIX) -----
        function removeSplash() {
            var selectors = ['#splashScreen', '#loadingScreen', '.splash-screen', '.splash'];
            var splash = null;
            for (var i = 0; i < selectors.length; i++) {
                var el = document.querySelector(selectors[i]);
                if (el && el.style.display !== 'none') {
                    splash = el;
                    break;
                }
            }
            if (splash) {
                try {
                    splash.style.transition = 'opacity 0.35s ease';
                    splash.style.opacity = '0';
                    setTimeout(function() {
                        if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
                    }, 400);
                } catch (e) {
                    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
                }
            } else {
                // Fallback: hide any fullscreen overlay with splash or loading in ID
                var overlays = document.querySelectorAll('div[style*="position:fixed"][style*="z-index"]');
                overlays.forEach(function(el) {
                    if (el.id && (el.id.includes('splash') || el.id.includes('loading'))) {
                        el.style.display = 'none';
                        el.style.opacity = '0';
                        el.style.pointerEvents = 'none';
                    }
                });
            }
        }
        removeSplash();

        if (document.documentElement.classList.contains('chichi-returning-session')) {
            var reloadOverlay = document.getElementById('loadingScreen');
            if (reloadOverlay) {
                document.documentElement.classList.add('chichi-reload-overlay-ready');
                reloadOverlay.classList.remove('hidden');
                reloadOverlay.classList.add('active');
                reloadOverlay.style.display = 'flex';
                reloadOverlay.style.visibility = 'visible';
                reloadOverlay.style.opacity = '1';
                reloadOverlay.style.zIndex = '10001';
                setTimeout(function() {
                    reloadOverlay.style.opacity = '0';
                    setTimeout(function() {
                        reloadOverlay.classList.remove('active');
                        reloadOverlay.classList.add('hidden');
                        reloadOverlay.style.display = 'none';
                        document.documentElement.classList.remove('chichi-reload-overlay-ready');
                    }, 220);
                }, 280);
            }
        }

        // Ensure header menu reflects current auth state
        try { this.updateHeaderMenu(); } catch (e) {}

        var nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'flex';

        // Hide FAB for guests
        var fab = document.querySelector('.fab-button-nav');
        if (fab) {
            fab.style.display = this.isGuest ? 'none' : 'flex';
        }

        var self = this;
        setTimeout(function() {
            self.requestNotificationPermission();
        }, 1500);

        self.loadPosts();
        self.loadStories();
        self.loadUsers();
        self.loadFollowing();
        self.loadGroups();
        self.checkAdminStatus();
        self.setupTypingCleanup();
        self.calculateTrendingHashtags();
        if (!self.isGuest && typeof self.setupPresence === 'function') {
            self.setupPresence();
            self.listenToAllPresence();
        }

        setTimeout(function() {
            if (!self.unreadTrackingActive) {
                console.log('⚠️ WARNING: Unread tracking not active yet!');
            }
        }, 100);

        if (self.messagePollingInterval) {
            clearInterval(self.messagePollingInterval);
            self.messagePollingInterval = null;
        }
    },

    // ============================================
    // LOAD PROFILE
    // ============================================

    loadProfile: function() {
        var self = this;
        db.ref('users/' + this.user.uid).on('value', function(s) {
            if (s.exists()) {
                self.profile = s.val();
                self.balance = self.profile.balance || 0;

                var balanceDisplay = document.getElementById('balanceDisplay');
                if (balanceDisplay) {
                    balanceDisplay.textContent = self.balance.toFixed(2) + ' Coins';
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
                self.renderProfile();
            }
        });
    },

    // ============================================
    // RENDER PROFILE - FIXED
    // ============================================

    renderProfile: function() {
        console.log('🔄 Rendering profile...');

        // ===== CRITICAL GUARD: Only render if profile view is active =====
        var profileView = document.getElementById('profileView');
        if (!profileView || !profileView.classList.contains('active')) {
            console.log('⚠️ Profile view not active, skipping render');
            return;
        }

        // ========== 1. ENSURE DOM ELEMENTS EXIST ==========
        if (!profileView) {
            console.warn('⚠️ profileView not found, creating...');
            profileView = document.createElement('div');
            profileView.id = 'profileView';
            profileView.className = 'view';
            var mainApp = document.getElementById('mainApp');
            if (mainApp) {
                mainApp.appendChild(profileView);
            } else {
                console.error('❌ mainApp not found!');
                return;
            }
        }

        var profileContent = document.getElementById('profileContent');
        if (!profileContent) {
            console.warn('⚠️ profileContent not found, creating...');
            profileContent = document.createElement('div');
            profileContent.id = 'profileContent';
            profileView.appendChild(profileContent);
        }

        // Make sure the view container has the correct class
        if (!profileView.classList.contains('view')) {
            profileView.classList.add('view');
        }

        // ========== 2. GUEST / NOT LOGGED IN ==========
        if (!this.user || this.isGuest) {
            profileContent.innerHTML = `
                <div class="guest-profile">
                    <div class="guest-profile-mark"><img src="icon-192.png" alt="CHICHI"></div>
                    <p class="guest-earn-kicker">YOUR SPACE</p>
                    <h2>Create your profile</h2>
                    <p>Sign in to add your photo, follow people, and make CHICHI yours.</p>
                    <button onclick="app.showLoginPage('login')">Sign in to continue</button>
                    <button class="guest-profile-secondary" onclick="app.showLoginPage('signup')">Create an account</button>
                </div>
            `;
            return;
        }

        // ========== 3. PROFILE DATA NOT READY YET ==========
        if (!this.profile || !this.profile.name) {
            profileContent.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 20px;text-align:center;">
                    <div style="font-size:40px;margin-bottom:16px;">⏳</div>
                    <div style="font-size:18px;font-weight:600;color:#1a202c;">Loading profile...</div>
                    <div style="font-size:13px;color:#6b7280;margin-top:8px;">Please wait a moment</div>
                </div>
            `;

            // Try to reload profile data
            var self = this;
            if (this.user && this.user.uid) {
                db.ref('users/' + this.user.uid).once('value', function(s) {
                    if (s.exists()) {
                        self.profile = s.val();
                        self.balance = self.profile.balance || 0;
                        // Re-render after data loads
                        setTimeout(function() { self.renderProfile(); }, 100);
                    } else {
                        // Still no profile data - show error
                        profileContent.innerHTML = `
                            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:60px 20px;text-align:center;">
                                <div style="font-size:40px;margin-bottom:16px;">😕</div>
                                <div style="font-size:18px;font-weight:600;color:#1a202c;">Could not load profile</div>
                                <div style="font-size:13px;color:#6b7280;margin-top:8px;">Please try refreshing the page</div>
                                <button onclick="location.reload()" style="margin-top:16px;background:#0088cc;color:white;border:none;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer;">Refresh</button>
                            </div>
                        `;
                    }
                });
            }
            return;
        }

        // ========== 4. BUILD PROFILE HTML ==========
        var username = this.profile.username || 'user';
        var interests = this.profile.interests || [];
        var bio = this.profile.bio || '';
        var userPosts = (this.posts || []).filter(function(p) { return p.userId === this.user.uid; }.bind(this));
        var followers = this.profile.followers || 0;
        var following = Object.keys(this.following || {}).length;
        var hasFollowedAdmin = Object.keys(this.following || {}).some(function(uid) {
            return typeof this.isAirtimeRewardAdmin === 'function' && this.isAirtimeRewardAdmin(uid);
        }.bind(this));
        var isVerified = !!this.profile.phone && hasFollowedAdmin;

        // Generate posts grid HTML
        var postsHtml = '';
        if (userPosts.length === 0) {
            postsHtml = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #9ca3af; background: white; border-radius: 8px;">
                    <div style="font-size: 40px; margin-bottom: 8px;">📸</div>
                    <div style="font-size: 14px; font-weight: 500;">No posts yet</div>
                    <div style="font-size: 12px; margin-top: 4px;">Create your first post!</div>
                </div>
            `;
        } else {
            var recentPosts = userPosts.slice(0, 9);
            postsHtml = recentPosts.map(function(p) {
                var likes = (p.likes && Object.keys(p.likes).length) || 0;
                var comments = (p.comments && p.comments.length) || 0;
                return `
                    <div style="position: relative; aspect-ratio: 1; background: #e5e7eb; overflow: hidden; cursor: pointer; border-radius: 4px;" onclick="app.viewPostDetail('${p.id}')">
                        ${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-size:24px;">📸</div>`}
                        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:white;padding:4px 8px;font-size:10px;display:flex;justify-content:space-between;align-items:center;">
                            <span>❤️ ${likes}</span>
                            <span>💬 ${comments}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        var html = `
            <div class="profile-redesign" style="padding: 0; background: #f5f5f5; min-height: 100vh;">

                <!-- BENTO HEADER -->
                <div style="display: grid; grid-template-columns: 90px 1fr; gap: 0; background: white; padding: 16px 16px 12px 16px; align-items: center; border-bottom: 1px solid #f0f0f0;">

                    <!-- Left: Profile Photo -->
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="
                            width: 80px;
                            height: 80px;
                            border-radius: 50%;
                            border: 3px solid white;
                            background: linear-gradient(135deg, #667eea, #764ba2);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 32px;
                            color: white;
                            font-weight: 700;
                            box-shadow: 0 2px 12px rgba(0,0,0,0.1);
                            background-image: ${this.profile.profilePhoto ? 'url(' + this.profile.profilePhoto + ')' : 'none'};
                            background-size: cover;
                            background-position: center;
                            cursor: pointer;
                            transition: transform 0.3s;
                            flex-shrink: 0;
                        " onclick="app.showProfilePhotoModal()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            ${!this.profile.profilePhoto ? (this.user.email ? this.user.email.charAt(0).toUpperCase() : 'U') : ''}
                        </div>
                    </div>

                    <!-- Right: Name, Username, Edit Button -->
                    <div style="padding-left: 14px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 18px; font-weight: 700; color: #1a1a1a; display: flex; align-items: center; gap: 6px;">
                            ${this.profile.name || 'User'}
                            ${isVerified ? '<span class="verified-badge" title="Phone added and admin followed">✓</span>' : ''}
                        </div>
                        <div style="font-size: 13px; color: #9ca3af; margin-bottom: 6px;">@${username}</div>

                        <!-- Edit Profile Button -->
                        <button onclick="app.showProfileSettings()" style="background: #f1f5f9; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; color: #1a1a1a; font-size: 12px; transition: all 0.3s; width: fit-content;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f1f5f9'">
                            ✏️ Edit Profile
                        </button>
                    </div>
                </div>

                <!-- STATS ROW -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; background: white; padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
                    <div style="text-align: center; padding: 4px 0; border-right: 1px solid #f0f0f0;">
                        <div style="font-weight: 700; color: #1a1a1a; font-size: 18px;">${userPosts.length}</div>
                        <div style="font-size: 11px; color: #9ca3af;">Posts</div>
                    </div>
                    <div style="text-align: center; padding: 4px 0; border-right: 1px solid #f0f0f0;">
                        <div style="font-weight: 700; color: #1a1a1a; font-size: 18px;">${followers}</div>
                        <div style="font-size: 11px; color: #9ca3af;">Followers</div>
                    </div>
                    <div style="text-align: center; padding: 4px 0; cursor: pointer;" onclick="app.showFollowing()">
                        <div style="font-weight: 700; color: #1a1a1a; font-size: 18px;">${following}</div>
                        <div style="font-size: 11px; color: #9ca3af;">Following</div>
                    </div>
                </div>

                <!-- ABOUT & BIO SECTION -->
                <div style="background: white; padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
                    <!-- Email -->
                    <div style="margin-bottom: 10px;">
                        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Contact</div>
                        <div style="font-size: 13px; color: #475569; word-break: break-all;">📧 ${this.user.email || 'No email'}</div>
                    </div>

                    <!-- Bio -->
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bio</div>
                        <div style="font-size: 13px; color: #4b5563; line-height: 1.5;">${bio || 'No bio yet. Tap edit to add one!'}</div>
                    </div>

                    <!-- Interests -->
                    ${interests && interests.length > 0 ? `
                        <div style="margin-top: 10px;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Interests</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                ${interests.map(function(interest) {
                                    var emojis = {
                                        'music': '🎵', 'sports': '⚽', 'travel': '✈️', 'art': '🎨', 'tech': '💻',
                                        'food': '🍔', 'fitness': '💪', 'books': '📚', 'movies': '🎬', 'nature': '🌿',
                                        'gaming': '🎮', 'photography': '📸', 'writing': '✍️', 'cooking': '👨‍🍳', 'yoga': '🧘'
                                    };
                                    var emoji = emojis[interest.toLowerCase()] || '✨';
                                    return `<span style="background: #f1f5f9; padding: 4px 12px; border-radius: 12px; font-size: 12px; color: #4b5563;">${emoji} ${interest}</span>`;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- POSTS GRID (3 columns) -->
                <div style="padding: 12px 12px 80px 12px;">
                    <div style="font-weight: 700; color: #1a1a1a; margin-bottom: 10px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        📸 Posts
                        <span style="font-size: 12px; color: #9ca3af; font-weight: 400;">(${userPosts.length})</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">
                        ${postsHtml}
                    </div>
                </div>

                <div style="height: 20px;"></div>
            </div>
        `;

        profileContent.innerHTML = html;
        console.log('✅ Profile rendered successfully!');
    },

    // ============================================
    // COVER IMAGE MODAL
    // ============================================

    showCoverImageModal: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10050';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.background = 'rgba(0,0,0,0.85)';

        var content = document.createElement('div');
        content.style.background = 'white';
        content.style.borderRadius = '16px';
        content.style.padding = '24px';
        content.style.maxWidth = '500px';
        content.style.width = '90%';
        content.style.textAlign = 'center';

        var html = `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 24px; margin-bottom: 8px;">🖼️</div>
                <h2 style="margin: 0; font-size: 20px; color: #1a1a1a;">Upload Cover Image</h2>
                <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">Choose a beautiful cover photo for your profile</p>
            </div>

            <div style="margin-bottom: 20px;">
                <input type="file" id="coverImageInput" accept="image/*" style="display: none;">
                <button onclick="document.getElementById('coverImageInput').click()" style="width: 100%; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-bottom: 8px;">📤 Choose Image</button>
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">JPG, PNG, or WebP • Recommended: 1200x400px</p>
            </div>

            <div style="display: flex; gap: 8px;">
                <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; background: #f3f4f6; color: #1a1a1a; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 600;">Cancel</button>
            </div>
        `;

        content.innerHTML = html;
        modal.appendChild(content);
        document.body.appendChild(modal);

        var coverInput = modal.querySelector('#coverImageInput');
        coverInput.onchange = function(e) {
            var file = e.target.files[0];
            if (file) {
                var formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', UPLOAD_PRESET);

                fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: formData
                })
                .then(res => res.json())
                .then(data => {
                    if (data.secure_url) {
                        db.ref('users/' + self.user.uid + '/coverImage').set(data.secure_url, function(err) {
                            if (!err) {
                                self.toast('✅ Cover image updated!', 'success');
                                self.profile.coverImage = data.secure_url;
                                self.renderProfile();
                                modal.remove();
                            } else {
                                self.toast('❌ Error saving cover image', 'error');
                            }
                        });
                    }
                })
                .catch(err => {
                    console.error('Upload error:', err);
                    self.toast('❌ Upload failed', 'error');
                });
            }
        };

        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        };
    },

    // ============================================
    // PROFILE PHOTO MODAL
    // ============================================

    showProfilePhotoModal: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10050';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.background = 'rgba(0,0,0,0.85)';
        modal.style.backdropFilter = 'blur(10px)';

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 24px;
                padding: 32px;
                max-width: 400px;
                width: 92%;
                text-align: center;
                animation: slideUp 0.3s ease;
                box-shadow: 0 30px 80px rgba(0,0,0,0.5);
            ">
                <div style="
                    width: 200px;
                    height: 200px;
                    border-radius: 50%;
                    margin: 0 auto 20px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    background-image: ${this.profile.profilePhoto ? 'url(' + this.profile.profilePhoto + ')' : 'none'};
                    background-size: cover;
                    background-position: center;
                    border: 4px solid #e5e7eb;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 60px;
                    color: white;
                    font-weight: 700;
                ">
                    ${!this.profile.profilePhoto ? (this.user.email ? this.user.email.charAt(0).toUpperCase() : 'U') : ''}
                </div>

                <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">${this.profile.name || 'User'}</h3>
                <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">@${this.profile.username || 'username'}</p>

                <div style="display: flex; gap: 10px;">
                    <button onclick="app.changeProfilePhoto(); document.querySelector('.modal-overlay').remove();" style="
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(135deg, #3b82f6, #2563eb);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-weight: 600;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(59,130,246,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        📷 Change Photo
                    </button>
                    <button onclick="document.querySelector('.modal-overlay').remove()" style="
                        flex: 1;
                        padding: 12px;
                        background: #e5e7eb;
                        color: #475569;
                        border: none;
                        border-radius: 12px;
                        font-weight: 600;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.3s;
                    " onmouseover="this.style.background='#d1d5db'" onmouseout="this.style.background='#e5e7eb'">
                        Close
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

    // ============================================
    // CHANGE PROFILE PHOTO
    // ============================================

    changeProfilePhoto: function() {
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (file) {
                self.toast('📤 Uploading photo...', 'info');
                var formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', UPLOAD_PRESET);
                fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    self.profile.profilePhoto = data.secure_url;
                    db.ref('users/' + self.user.uid + '/profilePhoto').set(data.secure_url);
                    self.claimAirtimeReward('profilePhoto');
                    self.toast('✅ Photo updated!', 'success');
                    self.renderProfile();
                    self.loadMessages();
                    self.logUserActivity('update_profile_photo', 'Updated profile photo');
                })
                .catch(function(err) {
                    self.toast('❌ Upload failed: ' + err.message, 'error');
                });
            }
        };
        input.click();
    },

    // ============================================
    // SHOW SIMILAR INTERESTS MODAL
    // ============================================

    showSimilarInterestsModal: function() {
        var self = this;

        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to discover similar users', 'info');
            this.showLoginPage();
            return;
        }

        var userInterests = this.profile.interests || [];

        if (userInterests.length === 0) {
            this.toast('📝 Add interests to your profile first', 'info');
            var modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div style="background: white; border-radius: 20px; padding: 32px; max-width: 400px; width: 95%; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <h2 style="font-weight: 700; color: #1e293b; margin-bottom: 8px;">Add Interests First</h2>
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">Go to your profile settings to add interests. Then you'll find people who share your passions!</p>
                    <button onclick="this.closest('.modal-overlay').remove(); app.showProfileSettings();" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: 600;">Go to Settings</button>
                </div>
            `;
            document.body.appendChild(modal);
            return;
        }

        var similarUsers = Object.keys(this.users)
            .filter(function(uid) { return uid !== self.user.uid; })
            .map(function(uid) {
                var user = self.users[uid];
                var interests = user.interests || [];
                var commonCount = interests.filter(function(i) { return userInterests.includes(i); }).length;
                return { uid: uid, ...user, commonInterests: commonCount };
            })
            .filter(function(u) { return u.commonInterests > 0; })
            .sort(function(a, b) { return b.commonInterests - a.commonInterests; })
            .slice(0, 20);

        var html = `
            <div class="modal" style="max-height: 80vh; overflow-y: auto;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                <h2 style="font-weight: 700; margin-bottom: 20px; color: #1e293b;">🤝 People with Similar Interests</h2>

                ${similarUsers.length === 0 ? `
                    <div style="text-align: center; color: #6b7280; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 12px;">😊</div>
                        <div style="font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">No matches yet</div>
                        <div style="font-size: 13px; color: #64748b;">Try adding more interests to your profile!</div>
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${similarUsers.map(function(user) {
                            var isFollowing = self.following && self.following[user.uid];
                            return `
                                <div style="background: white; border-radius: 12px; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between; border: 1px solid #e5e7eb;">
                                    <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #006fa3); background-image: url(${user.profilePhoto || ''}); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; flex-shrink: 0;">
                                            ${!user.profilePhoto ? (user.name || 'U').charAt(0).toUpperCase() : ''}
                                        </div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${user.name || 'User'}</div>
                                            <div style="font-size: 11px; color: #6b7280;">${user.commonInterests} ${user.commonInterests === 1 ? 'interest' : 'interests'} in common</div>
                                        </div>
                                    </div>
                                    <button onclick="app.followUser('${user.uid}', '${user.name || 'User'}'); setTimeout(function() { app.showSimilarInterestsModal(); }, 300);" style="background: ${isFollowing ? '#e5e7eb' : '#3b82f6'}; color: ${isFollowing ? '#1e293b' : 'white'}; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; white-space: nowrap; transition: 0.3s;" onmouseover="if(!${isFollowing}){this.style.background='#2563eb'}" onmouseout="if(!${isFollowing}){this.style.background='#3b82f6'}">
                                        ${isFollowing ? '✓ Following' : 'Follow'}
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;

        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = html;
        document.body.appendChild(modal);
    },

    // ============================================
    // FEATURED USERS MODAL
    // ============================================

    showFeaturedUsersModal: function() {
        var self = this;

        var usersArray = Object.keys(this.users)
            .filter(function(uid) { return uid !== (self.user && self.user.uid); })
            .map(function(uid) { return { uid: uid, ...self.users[uid] }; })
            .sort(function() { return Math.random() - 0.5; })
            .slice(0, 12);

        var html = `
            <div class="modal" style="max-height: 80vh; overflow-y: auto;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                <h2 style="font-weight: 700; margin-bottom: 20px; color: #1e293b;">⭐ Featured Users</h2>

                ${usersArray.length === 0 ? `
                    <div style="text-align: center; color: #6b7280; padding: 40px 20px;">No users to discover</div>
                ` : `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${usersArray.map(function(user) {
                            var isFollowing = self.following && self.following[user.uid];
                            var followers = user.followers || 0;
                            return `
                                <div style="background: white; border-radius: 12px; padding: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); cursor: pointer; transition: 0.3s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">
                                    <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #006fa3); margin: 0 auto 10px; background-image: url(${user.profilePhoto || ''}); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700;">
                                        ${!user.profilePhoto ? user.name.charAt(0).toUpperCase() : ''}
                                    </div>
                                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px; font-size: 14px;">${user.name}</div>
                                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">${followers} followers</div>
                                    <button onclick="app.followUser('${user.uid}', '${user.name}'); setTimeout(function() { app.showFeaturedUsersModal(); }, 300);" style="width: 100%; background: ${isFollowing ? '#e2e8f0' : 'var(--primary)'}; color: ${isFollowing ? '#1e293b' : 'white'}; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; transition: 0.3s;">
                                        ${isFollowing ? '✓ Following' : '+ Follow'}
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;

        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = html;
        document.body.appendChild(modal);
    },

    // ============================================
    // TOP CREATORS MODAL
    // ============================================

    showTopCreatorsModal: function() {
        var self = this;

        var creators = Object.keys(this.users)
            .filter(function(uid) { return uid !== (self.user && self.user.uid); })
            .map(function(uid) {
                return { uid: uid, ...self.users[uid] };
            })
            .sort(function(a, b) { return (b.followers || 0) - (a.followers || 0); })
            .slice(0, 15);

        var html = `
            <div class="modal" style="max-height: 80vh; overflow-y: auto;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                <h2 style="font-weight: 700; margin-bottom: 20px; color: #1e293b;">👑 Top Creators</h2>

                ${creators.length === 0 ? `
                    <div style="text-align: center; color: #6b7280; padding: 40px 20px;">No creators yet</div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${creators.map(function(creator, index) {
                            var isFollowing = self.following && self.following[creator.uid];
                            var medal = ['🥇', '🥈', '🥉'][index] || '';
                            return `
                                <div style="background: white; border-radius: 12px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: 0.3s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; this.style.transform='translateX(4px)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateX(0)'">
                                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                                        ${medal ? `<span style="font-size: 20px; margin-right: 4px;">${medal}</span>` : `<span style="width: 24px;"></span>`}
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #006fa3); background-image: url(${creator.profilePhoto || ''}); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">
                                            ${!creator.profilePhoto ? creator.name.charAt(0).toUpperCase() : ''}
                                        </div>
                                        <div>
                                            <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${creator.name}</div>
                                            <div style="font-size: 12px; color: #6b7280;">${creator.followers || 0} followers</div>
                                        </div>
                                    </div>
                                    <button onclick="app.followUser('${creator.uid}', '${creator.name}'); setTimeout(function() { app.showTopCreatorsModal(); }, 300);" style="background: ${isFollowing ? '#e2e8f0' : 'var(--primary)'}; color: ${isFollowing ? '#1e293b' : 'white'}; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px; white-space: nowrap;">
                                        ${isFollowing ? '✓ Following' : 'Follow'}
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;

        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = html;
        document.body.appendChild(modal);
    },

    // ============================================
    // RENDER TRENDING HASHTAGS IN EXPLORE
    // ============================================

    renderTrendingHashtagsExplore: function() {
        var container = document.getElementById('trendingHashtagsContainer');
        if (!container) return;

        if (this.trendingHashtags.length === 0) {
            if (this.postsLoading) {
                container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">⏳ Loading trending...</div>';
                return;
            }
            this.calculateTrendingHashtags();
            if (this.trendingHashtags.length === 0) {
                if (this.isGuest) {
                    container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">\n                        <div style="font-size:28px;margin-bottom:6px;">🔥</div>\n                        <div style="font-weight:700;margin-bottom:6px;">Sign in to see trending hashtags</div>\n                        <div style="color:#9ca3af;margin-bottom:10px;">Sign up or log in to see what people are talking about.</div>\n                        <button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;">🔐 Sign In / Sign Up</button>\n                    </div>';
                    return;
                }
                container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">No trending hashtags yet</div>';
                return;
            }
        }

        var html = '';
        this.trendingHashtags.slice(0, 6).forEach(function(trend, index) {
            html += `
                <div style="background: white; border-radius: 12px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); cursor: pointer; transition: 0.3s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; this.style.background='#f8fafc'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.background='white'">
                    <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px; font-size: 14px;">${trend.name}</div>
                    <div style="font-size: 12px; color: #6b7280;">${trend.posts} posts</div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // ============================================
    // TRENDING POSTS
    // ============================================

    renderTrendingPosts: function() {
        var self = this;
        var container = document.getElementById('trendingPostsContainer');
        if (!container) return;

        if (this.postsLoading) {
            container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">⏳ Loading posts...</div>';
            return;
        }

        var trendingPosts = (this.posts || [])
            .sort(function(a, b) {
                var aLikes = (a.likes && Object.keys(a.likes).length) || 0;
                var bLikes = (b.likes && Object.keys(b.likes).length) || 0;
                return bLikes - aLikes;
            })
            .slice(0, 9);

        if (trendingPosts.length === 0) {
            if (this.isGuest) {
                container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:40px 16px;">\n                    <div style="font-size:28px;margin-bottom:8px;">📱</div>\n                    <div style="font-weight:700;margin-bottom:6px;">Sign in to explore popular posts</div>\n                    <div style="color:#9ca3af;margin-bottom:12px;">Create an account to like, comment and follow creators.</div>\n                    <button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;">🔐 Sign In / Sign Up</button>\n                </div>';
                return;
            }
            container.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 60px 20px; grid-column: 1/-1;">No posts yet. Create one!</div>';
            return;
        }

        var html = '';
        trendingPosts.forEach(function(post) {
            var likes = (post.likes && Object.keys(post.likes).length) || 0;
            var comments = (post.comments && post.comments.length) || 0;

            html += `
                <div style="position: relative; aspect-ratio: 1/1; background: #f0f0f0; cursor: pointer; overflow: hidden;" onclick="app.viewPostDetail('${post.id}')">
                    <img src="${post.photoUrl}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0); display: flex; align-items: center; justify-content: center; gap: 16px; transition: all 0.3s ease; opacity: 0;" onmouseover="this.style.background='rgba(0,0,0,0.6)'; this.style.opacity='1';" onmouseout="this.style.background='rgba(0,0,0,0)'; this.style.opacity='0';">
                        <div style="color: white; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px;">❤️ ${likes}</div>
                        <div style="color: white; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px;">💬 ${comments}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // ============================================
    // FOLLOW USER
    // ============================================

    followUser: function(uid, name) {
        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to follow users', 'info');
            this.showLoginPage();
            return;
        }

        var self = this;

        if (!this.following) this.following = {};

        if (this.following[uid]) {
            delete this.following[uid];
            this.toast('✓ Unfollowed ' + name, 'info');
        } else {
            this.following[uid] = true;
            this.toast('✓ Followed ' + name, 'success');
        }

        db.ref('users/' + this.user.uid + '/following').set(this.following);

        db.ref('users/' + uid + '/followers').once('value', function(snapshot) {
            var count = snapshot.val() || 0;
            var isFollowing = self.following && self.following[uid];
            var newCount = isFollowing ? count + 1 : Math.max(0, count - 1);
            db.ref('users/' + uid + '/followers').set(newCount);
            if (self.users[uid]) self.users[uid].followers = newCount;
            if (self.profile && uid === self.user.uid) self.profile.followers = newCount;
            if (self.currentView === 'profile') self.renderProfile();
            if (self.currentView === 'explore') self.loadExplorePeople();
        });

        setTimeout(function() { self.renderFeaturedUsers(); self.renderTopCreators(); }, 300);
    },

    renderFeaturedUsers: function() {},
    renderTopCreators: function() {},

    // ============================================
    // LOAD STORIES
    // ============================================

    loadStories: function() {
        if (!this.user || this.isGuest) return;

        var self = this;
        var html = '';
        html += '<div class="story-item" onclick="app.showCreateStoryModal()"><div class="create-story-avatar">➕</div><div class="create-story-name">My Story</div></div>';

        db.ref('stories').once('value', function(snapshot) {
            var allStories = [];
            if (snapshot.val()) {
                Object.keys(snapshot.val()).forEach(function(userId) {
                    var userStories = snapshot.val()[userId];
                    if (userStories && typeof userStories === 'object') {
                        Object.keys(userStories).forEach(function(storyId) {
                            var story = userStories[storyId];
                            if (story && story.image) {
                                allStories.push({
                                    id: storyId,
                                    userId: userId,
                                    userName: story.userName || story.authorName || 'User',
                                    image: story.image,
                                    musicName: story.musicName || 'No music',
                                    caption: story.caption || '',
                                    createdAt: story.createdAt,
                                    userPhoto: story.userPhoto || ''
                                });
                            }
                        });
                    }
                });
            }

            allStories.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
            var seenUsers = {};
            var uniqueStories = [];
            allStories.forEach(function(story) {
                if (story && story.userId && !seenUsers[story.userId]) {
                    seenUsers[story.userId] = true;
                    uniqueStories.push(story);
                }
            });

            uniqueStories.slice(0, 8).forEach(function(story) {
                var firstLetter = (story.userName || 'U').charAt(0).toUpperCase();
                var storyPhotoStyle = story.userPhoto ? 'background-image: url(\'' + story.userPhoto + '\');' : '';
                html += '<div class="story-item" onclick="app.viewStory(\'' + story.id + '\', \'' + story.userId + '\')" title="' + story.userName + '"><div class="story-avatar" style="' + storyPhotoStyle + '">' + (story.userPhoto ? '' : firstLetter) + '</div><div class="story-name">' + story.userName + '</div></div>';
            });

            var storiesList = document.getElementById('storiesList');
            if (storiesList) {
                storiesList.innerHTML = html;
            }
        });
    },

    // ============================================
    // SHOW CREATE STORY MODAL
    // ============================================

    showCreateStoryModal: function() {
        var existing = document.getElementById('storyModalOverlay');
        if (existing) existing.remove();

        var html = '<div class="story-modal-overlay" id="storyModalOverlay"><div class="story-modal"><div class="story-modal-header"><h2>📖 Create Story</h2><button class="story-modal-close" onclick="document.getElementById(\'storyModalOverlay\').remove()">✕</button></div><div class="story-modal-content"><div class="story-form-group"><label class="story-form-label">Story Images (Select multiple) *</label><input type="file" id="storyImageInput" accept="image/*" multiple class="story-file-input"><div style="font-size:12px;color:#6b7280;margin-top:4px;">You can select multiple images at once</div></div><div class="story-form-group"><label class="story-form-label">🎵 Music Name</label><input type="text" id="storyMusicNameInput" placeholder="e.g., Jazz Background" class="story-form-input"></div><div class="story-form-group"><label class="story-form-label">Caption</label><textarea id="storyCaptionInput" placeholder="Add a caption..." class="story-form-textarea"></textarea></div></div><div class="story-modal-footer"><button class="story-btn-cancel" onclick="document.getElementById(\'storyModalOverlay\').remove()">Cancel</button><button class="story-btn-upload" id="storyUploadBtn" onclick="app.uploadStory()"><span class="story-btn-text">📤 Upload Stories</span><div class="story-spinner"></div></button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('storyModalOverlay').classList.add('active');
        document.getElementById('storyModalOverlay').addEventListener('click', function(e) {
            if (e.target === this) { this.remove(); }
        });
    },

    // ============================================
    // UPLOAD STORY
    // ============================================

    uploadStory: function() {
        var self = this;
        var imageInput = document.getElementById('storyImageInput');
        var musicNameInput = document.getElementById('storyMusicNameInput');
        var captionInput = document.getElementById('storyCaptionInput');
        var uploadBtn = document.getElementById('storyUploadBtn');

        if (!imageInput || !imageInput.files || imageInput.files.length === 0) {
            this.toast('⚠️ Please select at least one image', 'error');
            return;
        }
        if (!this.user || !this.user.uid) {
            this.toast('⚠️ Please login first', 'error');
            return;
        }

        if (uploadBtn) uploadBtn.classList.add('loading');
        this.toast('📤 Uploading stories...', 'info');

        var files = imageInput.files;
        var uploadPromises = [];
        for (var i = 0; i < files.length; i++) {
            var promise = new Promise(function(resolve, reject) {
                var formData = new FormData();
                formData.append('file', files[i]);
                formData.append('upload_preset', UPLOAD_PRESET || 'chichi_photos');
                fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.secure_url) { resolve(data.secure_url); }
                    else { reject(new Error('No image URL returned')); }
                })
                .catch(reject);
            });
            uploadPromises.push(promise);
        }

        Promise.all(uploadPromises).then(function(imageUrls) {
            var musicName = musicNameInput ? musicNameInput.value.trim() : 'Audio';
            var caption = captionInput ? captionInput.value.trim() : '';
            var savePromises = [];
            imageUrls.forEach(function(imageUrl, index) {
                var storyId = 'story_' + Date.now() + '_' + index;
                var storyData = {
                    image: imageUrl,
                    musicUrl: '',
                    musicName: musicName || 'Audio',
                    caption: caption || '',
                    createdAt: new Date().getTime() + index,
                    views: 0,
                    authorUid: self.user.uid,
                    authorName: self.user.displayName || 'Anonymous',
                    userName: self.profile ? (self.profile.name || 'User') : 'User',
                    userPhoto: self.profile ? (self.profile.profilePhoto || '') : ''
                };
                savePromises.push(db.ref('stories/' + self.user.uid + '/' + storyId).set(storyData));
            });
            return Promise.all(savePromises);
        }).then(function() {
            self.toast('✅ Stories uploaded successfully!', 'success');
            self.logUserActivity('story_upload', 'Uploaded stories');
            setTimeout(function() {
                var modal = document.getElementById('storyModalOverlay');
                if (modal) modal.remove();
                self.loadStories();
            }, 500);
        }).catch(function(err) {
            console.error('Upload error:', err);
            self.toast('❌ Upload failed: ' + err.message, 'error');
            if (uploadBtn) uploadBtn.classList.remove('loading');
        });
    },

    // ============================================
    // VIEW STORY
    // ============================================

    viewStory: function(storyId, userId) {
        userId = userId || this.user.uid;
        var self = this;
        var isOwnStory = this.user && userId === this.user.uid;

        db.ref('stories/' + userId + '/' + storyId).once('value', function(snapshot) {
            var story = snapshot.val();
            if (!story) {
                self.toast('Story not found', 'error');
                return;
            }

            var viewer = document.createElement('div');
            viewer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;animation:smoothFadeIn 0.3s ease;';

            var deleteBtn = isOwnStory ? '<button onclick="event.stopPropagation(); app.deleteStory(\'' + storyId + '\', \'' + userId + '\')" style="position:absolute;top:70px;right:16px;z-index:10;background:rgba(239,68,68,0.9);color:white;border:none;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">🗑️</button>' : '';

            viewer.innerHTML = '<div style="position:absolute;top:16px;left:16px;right:16px;z-index:10;display:flex;gap:4px;"><div style="flex:1;height:3px;background:rgba(255,255,255,0.2);border-radius:2px;overflow:hidden;"><div id="storyProgressBar" style="height:100%;width:0%;background:white;border-radius:2px;transition:width 0.1s linear;"></div></div></div><div style="position:absolute;top:24px;left:16px;right:16px;z-index:10;display:flex;align-items:center;gap:12px;"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;overflow:hidden;border:2px solid rgba(255,255,255,0.3);">' + (story.userPhoto ? '<img src="' + story.userPhoto + '" style="width:100%;height:100%;object-fit:cover;">' : (story.userName || 'U').charAt(0).toUpperCase()) + '</div><div><div style="color:white;font-weight:600;font-size:14px;">' + (story.userName || 'User') + '</div><div style="color:rgba(255,255,255,0.6);font-size:11px;">' + (story.musicName || 'No music') + '</div></div></div>' + deleteBtn + '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px;width:100%;"><img src="' + story.image + '" style="max-width:100%;max-height:70vh;border-radius:12px;object-fit:contain;box-shadow:0 8px 32px rgba(0,0,0,0.5);"></div>' + (story.caption ? '<div style="position:absolute;bottom:80px;left:16px;right:16px;z-index:10;color:white;text-align:center;font-size:14px;background:rgba(0,0,0,0.4);padding:12px 16px;border-radius:12px;">' + story.caption + '</div>' : '') + '<div style="position:absolute;bottom:30px;left:0;right:0;z-index:10;text-align:center;color:rgba(255,255,255,0.4);font-size:12px;">Tap to close</div>';

            document.body.appendChild(viewer);

            var progressBar = document.getElementById('storyProgressBar');
            var startTime = Date.now();
            var duration = 10000;
            var progressInterval = setInterval(function() {
                var elapsed = Date.now() - startTime;
                var progress = Math.min((elapsed / duration) * 100, 100);
                if (progressBar) { progressBar.style.width = progress + '%'; }
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    viewer.remove();
                    self.toast('Story viewed 📖', 'info');
                }
            }, 50);

            viewer.addEventListener('click', function(e) {
                if (e.target.tagName === 'IMG' || e.target.tagName === 'BUTTON') { return; }
                clearInterval(progressInterval);
                viewer.remove();
            });
        });
    },

    deleteStory: function(storyId, userId) {
        if (!confirm('Delete this story?')) return;
        var self = this;
        db.ref('stories/' + userId + '/' + storyId).remove().then(function() {
            self.toast('✅ Story deleted', 'success');
            self.loadStories();
        }).catch(function(err) {
            self.toast('❌ Error deleting story: ' + err.message, 'error');
        });
    },

    // ============================================
    // SHOW MANDATORY HASHTAG SELECTION
    // ============================================

    showMandatoryHashtagSelection: function() {
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
            htmlOptions += '<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:8px;font-size:13px;color:#1a202c;">' + category + '</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
            hashtagCategories[category].forEach(function(tag) {
                htmlOptions += '<label style="display:inline-flex;align-items:center;padding:4px 10px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:20px;cursor:pointer;transition:0.2s;font-size:12px;" onmouseover="this.style.borderColor=\'#0088cc\';this.style.background=\'rgba(0,136,204,0.05)\'" onmouseout="if(!this.querySelector(\'input\').checked){this.style.borderColor=\'#e5e7eb\';this.style.background=\'#f9fafb\'}"><input type="checkbox" class="hashtag-checkbox" value="' + tag + '" style="width:14px;height:14px;cursor:pointer;margin-right:5px;accent-color:#0088cc;" onchange="this.parentElement.style.borderColor=this.checked ? \'#0088cc\' : \'#e5e7eb\'; this.parentElement.style.background=this.checked ? \'rgba(0,136,204,0.1)\' : \'#f9fafb\'"><span style="font-size:11px;color:#1a202c;">' + tag + '</span></label>';
            });
            htmlOptions += '</div></div>';
        }

        var modalHTML = '<div class="modal-overlay" id="mandatoryHashtagModal" style="display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(4px);"><div style="background:white;border-radius:24px;max-width:480px;width:92%;max-height:80vh;overflow-y:auto;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:smoothFadeIn 0.3s ease;"><div style="text-align:center;margin-bottom:16px;"><div style="font-size:36px;margin-bottom:4px;">🏷️</div><h2 style="margin-bottom:2px;font-weight:700;color:#1a202c;font-size:20px;">Choose Your Interests</h2><p style="color:#6b7280;font-size:13px;margin-bottom:4px;">Select at least <strong style="color:#0088cc;">3</strong> topics you care about</p><p style="color:#ef4444;font-size:11px;font-weight:600;min-height:18px;" id="hashtagError"></p></div><div style="margin-bottom:16px;max-height:50vh;overflow-y:auto;padding-right:4px;">' + htmlOptions + '</div><div style="display:flex;gap:10px;border-top:1px solid #e5e7eb;padding-top:14px;"><button onclick="app.saveMandatoryHashtags()" id="saveHashtagBtn" style="flex:1;padding:12px;background:linear-gradient(135deg,#0088cc,#006fa3);color:white;border:none;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;transition:0.3s;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">✅ Save & Continue</button></div></div></div>';

        var existing = document.getElementById('mandatoryHashtagModal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveMandatoryHashtags: function() {
        var checkboxes = document.querySelectorAll('#mandatoryHashtagModal .hashtag-checkbox:checked');
        var selected = [];
        checkboxes.forEach(function(cb) { selected.push(cb.value); });
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

        var self = this;
        var uid = this.user ? this.user.uid : null;
        if (!uid) {
            this.toast('User not found. Please login again.', 'error');
            return;
        }

        var btn = document.getElementById('saveHashtagBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

        db.ref('users/' + uid + '/hashtags').set(selected).then(function() {
            self.profile.interests = selected;
            self.profile.hashtags = selected;
            self.toast('✅ Interests saved!', 'success');
            var modal = document.getElementById('mandatoryHashtagModal');
            if (modal) modal.remove();
            setTimeout(function() {
                self.switchView('explore');
                self.loadExplore();
            }, 500);
        }).catch(function(err) {
            self.toast('❌ Error saving interests: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = '✅ Save & Continue'; }
        });
    },

    // ============================================
    // LOAD SIGNUP HEATMAP
    // ============================================

    loadSignupHeatmap: function() {
        var mapContainer = document.getElementById('signupMapContainer');
        if (!mapContainer) { return; }

        mapContainer.innerHTML = '<div id="leafletMap" style="width:100%;height:100%;"></div><div id="heatmapDots" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;"></div>';

        if (typeof L !== 'undefined') {
            var map = L.map('leafletMap', {
                zoomControl: false, attributionControl: false,
                scrollWheelZoom: false, doubleClickZoom: false,
                dragging: false, touchZoom: false, boxZoom: false, keyboard: false
            }).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '', subdomains: 'abcd', maxZoom: 2, minZoom: 2, noWrap: true
            }).addTo(map);
            map.setZoom(2);
            this.heatmapMap = map;
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
        var now = new Date().getTime();
        var fiveMinutesAgo = now - (5 * 60 * 1000);

        for (var uid in this.users) {
            var user = this.users[uid];
            if (user && user.lastSeen) {
                var lastSeen = user.lastSeen;
                if (typeof lastSeen === 'string') { lastSeen = new Date(lastSeen).getTime(); }
                if (lastSeen && lastSeen > fiveMinutesAgo) { onlineCount++; }
            }
        }

        var totalElement = document.getElementById('totalSignups');
        if (totalElement) { this.animateNumber(totalElement, totalUsers); }
        var onlineElement = document.getElementById('onlineCount');
        if (onlineElement) { this.animateNumber(onlineElement, onlineCount); }
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
        var dotsContainer = document.getElementById('heatmapDots');
        if (!dotsContainer || !this.users) return;

        var usersArray = Object.keys(this.users).map(function(uid) { return { uid: uid, user: this.users[uid] }; }.bind(this));
        if (usersArray.length === 0) { dotsContainer.innerHTML = ''; return; }

        var html = '';
        var totalUsers = usersArray.length;
        var dotSize = Math.min(4 + (totalUsers / 200), 8);
        var locations = [
            { lat: -1.286389, lng: 36.817223 }, { lat: -4.043477, lng: 39.668206 },
            { lat: 0.313611, lng: 32.581111 }, { lat: -1.9441, lng: 30.0619 },
            { lat: -3.361378, lng: 36.674448 }, { lat: -0.091702, lng: 34.767956 },
            { lat: -0.2861, lng: 36.0711 }, { lat: -1.3216, lng: 36.8831 },
            { lat: -0.4667, lng: 35.2833 }, { lat: 0.0494, lng: 34.7486 },
            { lat: -0.4861, lng: 35.2972 }, { lat: -2.2698, lng: 37.8020 }
        ];

        usersArray.forEach(function(u, index) {
            var loc = locations[index % locations.length];
            var baseLat = loc.lat + (Math.random() - 0.5) * 1.5;
            var baseLng = loc.lng + (Math.random() - 0.5) * 1.5;
            var dotColor = 'rgba(0,136,204,0.7)';
            if (u.user && u.user.online) { dotColor = 'rgba(0,212,170,0.9)'; }
            html += '<div style="position:absolute;width:' + dotSize + 'px;height:' + dotSize + 'px;background:' + dotColor + ';border-radius:50%;left:' + (50 + (baseLng / 30)) + '%;top:' + (50 - (baseLat / 15)) + '%;box-shadow:0 0 ' + (dotSize * 2) + 'px ' + dotColor + ';transition:all 0.5s ease;animation:pulse 2s infinite;" title="' + (u.user ? u.user.name : 'User') + '"></div>';
        });
        dotsContainer.innerHTML = html;
    },

    setupHeatmapListener: function() {
        db.ref('users').on('value', function(snapshot) {
            this.users = {};
            snapshot.forEach(function(child) {
                this.users[child.key] = child.val();
            }.bind(this));
            this.updateHeatmapStats();
            this.renderHeatmapDots();
        }.bind(this));
    },

    // ============================================
    // OPEN CHAT FROM SEARCH
    // ============================================

    openChatFromSearch: function(uid, name) {
        this.openChat(uid, name);
    },

    // ============================================
    // SHOW TRANSACTION HISTORY
    // ============================================

    showTransactionHistory: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'transactionHistoryModal';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 28px; max-width: 500px; width: 95%; animation: slideUp 0.3s ease; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15); max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">📋 Transaction History</h2>
                    <button onclick="document.getElementById('transactionHistoryModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;">✕</button>
                </div>

                <div id="transactionsList" style="max-height: 600px; overflow-y: auto;">
                    <div style="text-align: center; color: #94a3b8; padding: 40px 20px;">Loading...</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        db.ref('analytics/revenue').orderByChild('userId').equalTo(this.user.uid).once('value', function(snapshot) {
            var transactions = [];
            snapshot.forEach(function(child) {
                var tx = child.val();
                transactions.push({
                    id: child.key,
                    ...tx
                });
            });

            transactions.reverse();

            var html = '';

            if (transactions.length === 0) {
                html = '<div style="text-align: center; color: #94a3b8; padding: 40px 20px;">No transactions yet</div>';
            } else {
                transactions.forEach(function(tx) {
                    var isEarned = tx.type === 'earned';
                    var icon = isEarned ? '📈' : '🛍️';
                    var color = isEarned ? '#22c55e' : '#ef4444';
                    var sign = isEarned ? '+' : '-';

                    html += `
                        <div style="background: ${isEarned ? '#f0fdf4' : '#fee2e2'}; border-left: 4px solid ${color}; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 12px; align-items: center; flex: 1;">
                                <div style="font-size: 24px;">${icon}</div>
                                <div>
                                    <div style="font-weight: 600; color: #1e293b; font-size: 14px;">${isEarned ? 'Earned' : 'Spent'} ${tx.item || ''}</div>
                                    <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${tx.date || 'N/A'}</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 16px; font-weight: 700; color: ${color};">${sign}${tx.amount.toFixed(2)} Coins</div>
                            </div>
                        </div>
                    `;
                });
            }

            var listContainer = document.getElementById('transactionsList');
            if (listContainer) {
                listContainer.innerHTML = html;
            }
        });
    },

    updateBalanceDisplays: function() {
        var balanceDisplay = document.getElementById('balanceDisplay');
        if (balanceDisplay) {
            balanceDisplay.textContent = this.balance.toFixed(2) + ' Coins';
        }
        var earnBalanceDisplay = document.getElementById('earnBalanceDisplay');
        if (earnBalanceDisplay) {
            earnBalanceDisplay.textContent = this.balance.toFixed(2) + ' Coins';
        }
    },

    // ============================================
    // PREVIEW PHOTO
    // ============================================

    previewPhoto: function(e) {
        var file = e.target.files[0];
        if (file) {
            var preview = document.getElementById('photoPreview');
            preview.textContent = '✓ ' + file.name + ' selected';
            preview.style.display = 'block';
        }
    },

    // ============================================
    // SHOW CREATE MODAL
    // ============================================

    showCreateModal: function() {
        var modal = document.getElementById('createModal');
        if (!modal) {
            this.toast('Error opening post creator', 'error');
            return;
        }
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
        var consent = document.getElementById('postSharingConsent');
        var consentStatus = document.getElementById('postConsentStatus');
        if (consent) {
            consent.checked = false;
            consent.disabled = false;
        }
        if (consentStatus) consentStatus.textContent = 'Checking your sharing permission...';
        if (this.user && db) {
            db.ref('consents/' + this.user.uid + '/postSharing').once('value').then(function(snapshot) {
                if (!consent || !document.getElementById('createModal').classList.contains('active')) return;
                if (snapshot.exists()) {
                    consent.checked = true;
                    consent.disabled = true;
                    if (consentStatus) consentStatus.textContent = 'Permission already saved for this account.';
                } else if (consentStatus) {
                    consentStatus.textContent = 'This permission is requested once.';
                }
            });
        }
        setTimeout(function() {
            var captionInput = document.getElementById('captionInput');
            if (captionInput) captionInput.focus();
        }, 300);
    },

    closeCreateModal: function() {
        var modal = document.getElementById('createModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.getElementById('photoInput').value = '';
        document.getElementById('captionInput').value = '';
        var preview = document.getElementById('photoPreview');
        if (preview) { preview.style.display = 'none'; preview.textContent = ''; }
    },

    createPost: function() {
        if (!this.requireAuth('post')) return;

        var photoFile = document.getElementById('photoInput').files[0];
        var caption = document.getElementById('captionInput').value.trim();
        var selectedHashtag = document.getElementById('dailyPostHashtag').value;
        var consent = document.getElementById('postSharingConsent');
        var sharePostBtn = document.getElementById('sharePostBtn');
        var shareSpinner = document.querySelector('.share-spinner');
        var shareText = document.querySelector('.share-btn-text');

        if (!photoFile || !caption) {
            this.toast('Add a photo and caption', 'error');
            return;
        }

        if (selectedHashtag !== 'dailypost') {
            this.toast('Choose #dailypost to participate', 'error');
            return;
        }

        if (!consent || (!consent.checked && !consent.disabled)) {
            this.toast('Please accept the sharing permission once', 'error');
            return;
        }

        var hashtagRegex = /#[\w]+/g;
        var hashtags = ['#dailypost'].concat(caption.match(hashtagRegex) || []).filter(function(tag, index, list) {
            return list.indexOf(tag) === index;
        }).slice(0, 5);

        var consentRef = db.ref('consents/' + this.user.uid + '/postSharing');
        var consentPromise = consent.disabled ? Promise.resolve() : consentRef.set({
            userId: this.user.uid,
            username: this.profile.username || '',
            userName: this.profile.name || 'User',
            permission: 'post_storage_and_sharing',
            acceptedAt: firebase.database.ServerValue.TIMESTAMP
        });

        if (shareSpinner) shareSpinner.style.display = 'inline';
        if (shareText) shareText.style.display = 'none';
        if (sharePostBtn) sharePostBtn.disabled = true;

        var formData = new FormData();
        formData.append('file', photoFile);
        formData.append('upload_preset', UPLOAD_PRESET);

        consentPromise.then(function() {
            return fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', {
            method: 'POST', body: formData
            });
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var self = this;
            db.ref('posts').push({
                userId: self.user.uid,
                userName: self.profile.name || 'User',
                userPhoto: self.profile.profilePhoto || '',
                photoUrl: data.secure_url,
                caption: caption,
                hashtags: hashtags,
                likes: {}, comments: [], commentedUsers: [], downloads: 0,
                createdAt: new Date().toLocaleString('en-KE'),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(function() {
                self.engagementStats.postsCount = (self.engagementStats.postsCount || 0) + 1;
                self.saveEngagementStats();
                self.claimDailyPostReward();
                self.toast('Post published', 'success');
                self.logUserActivity('create_post', 'Created a new post');
                if (shareSpinner) shareSpinner.style.display = 'none';
                if (shareText) shareText.style.display = 'inline';
                if (sharePostBtn) sharePostBtn.disabled = false;
                self.closeCreateModal();
                self.switchView('feed');
            });
        }.bind(this)).catch(function(err) {
            this.toast('Upload failed: ' + err.message, 'error');
            if (shareSpinner) shareSpinner.style.display = 'none';
            if (shareText) shareText.style.display = 'inline';
            if (sharePostBtn) sharePostBtn.disabled = false;
        }.bind(this));
    },

    // ============================================
    // CONVERSATION ACTIONS (ARCHIVE, DELETE, FAVORITE)
    // ============================================

    archiveConversation: function(uid) {
        var isArchived = localStorage.getItem('archived_' + uid) === 'true';
        if (isArchived) {
            localStorage.removeItem('archived_' + uid);
            this.activeMessageFilter = 'all';
            this.toast('📦 Unarchived', 'success');
        } else {
            localStorage.setItem('archived_' + uid, 'true');
            this.activeMessageFilter = 'archived';
            this.toast('📦 Archived', 'success');
        }
        this.loadMessages();
    },

    deleteConversation: function(uid) {
        if (!confirm('Delete this conversation? Messages will be permanently removed.')) return;
        
        var self = this;
        var chatKey = [this.user.uid, uid].sort().join('_');
        
        // Delete the conversation
        db.ref('chats/' + chatKey).remove().then(function() {
            self.toast('✓ Conversation deleted', 'success');
            self.loadMessages();
        }).catch(function(err) {
            self.toast('❌ Error deleting conversation', 'error');
        });
    },

    toggleFavoriteConversation: function(uid) {
        var isFavorite = localStorage.getItem('fav_' + uid) === 'true';
        if (isFavorite) {
            localStorage.removeItem('fav_' + uid);
            this.toast('❤️ Removed from favorites', 'info');
        } else {
            localStorage.setItem('fav_' + uid, 'true');
            this.toast('❤️ Added to favorites', 'info');
        }
        this.loadMessages();
    },

    // ============================================
// LOAD MESSAGES - REDESIGNED
// ============================================

loadMessages: function() {
    var self = this;
    var isGuestView = !this.user || this.isGuest || !this.user.uid;
    var container = document.getElementById('messageList');

    if (!container) return;

    // Hide/show controls based on guest status
    var messagesControls = document.getElementById('messagesControls');
    var messageSearchBar = document.getElementById('messageSearchBar');
    var messagesFilterTabs = document.getElementById('messagesFilterTabs');
    
    if (isGuestView) {
        if (messagesControls) messagesControls.style.display = 'none';
        if (messageSearchBar) messageSearchBar.style.display = 'none';
        if (messagesFilterTabs) messagesFilterTabs.style.display = 'none';
    } else {
        if (messagesControls) messagesControls.style.display = 'flex';
        if (messageSearchBar) messageSearchBar.style.display = 'block';
        if (messagesFilterTabs) messagesFilterTabs.style.display = 'flex';
    }

    // Guest View
    if (isGuestView) {
        container.innerHTML = `
            <div class="guest-messages">
                <div class="guest-messages-mark"><img src="icon-192.png" alt="CHICHI"></div>
                <p class="guest-earn-kicker">PRIVATE CONVERSATIONS</p>
                <h3>Sign in to see your messages</h3>
                <p>Connect with friends and keep every conversation in one place.</p>
                <button onclick="app.showLoginPage('login')">Sign in to continue</button>
            </div>
        `;
        return;
    }

    this.loadBlockedUsers();
    var html = '';
    var conversations = [];

    db.ref('messages').once('value', function(snapshot) {
        if (snapshot.val()) {
            Object.keys(snapshot.val()).forEach(function(chatKey) {
                if (chatKey.includes(self.user.uid)) {
                    var parts = chatKey.split('_');
                    var otherUserId = parts[0] === self.user.uid ? parts[1] : parts[0];
                    
                    if (self.blockedUsers && self.blockedUsers[otherUserId]) return;
                    if (!self.users[otherUserId]) return;

                    var messages = snapshot.val()[chatKey];
                    var hasTextMessages = false;
                    var lastMessage = 'Tap to message';
                    var lastTimestamp = 0;
                    var unreadCount = 0;
                    
                    if (messages && typeof messages === 'object') {
                        Object.keys(messages).forEach(function(msgId) {
                            var msg = messages[msgId];
                            if (msg && !msg.deleted && (msg.text || msg.image || msg.voiceUrl)) {
                                hasTextMessages = true;
                                
                                // SMART PREVIEW - Check message type
                                if (msg.voiceUrl) {
                                    lastMessage = '🎤 Voice message';
                                } else if (msg.image && !msg.text) {
                                    lastMessage = '📷 Photo';
                                } else if (msg.isCoinTransfer) {
                                    lastMessage = '💰 Sent ' + (msg.amount || '') + ' Coins';
                                } else if (msg.text) {
                                    // Truncate long messages to 35 characters
                                    var preview = msg.text.length > 35 ? msg.text.substring(0, 35) + '...' : msg.text;
                                    // If it's a reply, add a reply icon
                                    if (msg.replyTo) {
                                        preview = '↩️ ' + preview;
                                    }
                                    lastMessage = preview;
                                } else {
                                    lastMessage = '📷 Image';
                                }
                                
                                lastTimestamp = msg.timestamp || 0;
                                if (msg.sender !== self.user.uid && !msg.read) { unreadCount++; }
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
        }
        
        // Sort conversations by latest message
        conversations.sort(function(a, b) { return b.lastTimestamp - a.lastTimestamp; });

        // RENDER
        if (conversations.length === 0) {
            html = `
                <div class="msg-empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>No messages yet</h3>
                    <p>Start a new conversation and connect with someone!</p>
                    <button class="empty-btn" onclick="app.openNewChat()">✏️ New Message</button>
                </div>
            `;
        } else {
            conversations.forEach(function(conv) {
                var unreadBadge = conv.unreadCount > 0 ? '<div class="msg-item-unread">' + conv.unreadCount + '</div>' : '';
                var avatarStyle = conv.user.profilePhoto ? 'background-image: url(\'' + conv.user.profilePhoto + '\');' : '';
                var initials = conv.user.name ? conv.user.name.charAt(0).toUpperCase() : '?';
                var isFavorite = localStorage.getItem('fav_' + conv.uid) === 'true';
                var favoriteBtn = '<button class="action-btn favorite" onclick="app.toggleFavoriteConversation(\'' + conv.uid + '\')" style="color: ' + (isFavorite ? '#ef4444' : '#9ca3af') + ';">❤️</button>';
                var presence = self.presenceStatus && self.presenceStatus[conv.uid];
                var lastSeenValue = (presence && presence.lastSeen) || conv.user.lastSeen;
                var isOnline = !!(presence && presence.online);
                var presenceLabel = isOnline ? 'Online' : (lastSeenValue ? 'Not online right now 🙂 I was at ' + self.formatPresenceTime(new Date(lastSeenValue)) : 'Not online right now 🙂');
                
                // Online status (optional – you can set this dynamically)
                var onlineDot = '<div class="online-dot' + (isOnline ? ' active' : '') + '"></div>';
                
                html += `
                    <div class="msg-item-wrapper" data-uid="${conv.uid}">
                        <div class="msg-item-actions">
                            ${favoriteBtn}
                            <button class="action-btn archive" onclick="app.archiveConversation('${conv.uid}')">📦</button>
                            <button class="action-btn delete" onclick="app.deleteConversation('${conv.uid}')">🗑️</button>
                        </div>
                        <div class="msg-item" onclick="app.openChat('${conv.uid}', '${conv.user.name}')">
                            <div class="msg-item-avatar" style="${avatarStyle} background: ${!conv.user.profilePhoto ? 'linear-gradient(135deg, #667eea, #764ba2)' : ''};">
                                ${!conv.user.profilePhoto ? initials : ''}
                                ${onlineDot}
                            </div>
                            <div class="msg-item-content">
                                <div class="msg-item-name">${conv.user.name}</div>
                                <div class="msg-item-preview">${conv.lastMessage}</div>
                            </div>
                            <div class="msg-item-meta">
                                <div class="msg-item-presence">${presenceLabel}</div>
                                ${unreadBadge}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
        
        // After rendering, update badges
        self.updateUnreadBadge();
        self.applyMessageListFilters();
        
        // Initialize swipe listeners
        self.initSwipeListeners();
    });
},
    // ============================================
    // OPEN CHAT
    // ============================================

    openChat: function(uid, name) {
    if (!this.user || this.isGuest) {
        this.toast('🔐 Sign up to message users', 'info');
        this.showLoginPage();
        return;
    }

    // CRITICAL: Mark messages as read FIRST
    this.markAsRead(uid);
    var openedRow = document.querySelector('.msg-item-wrapper[data-uid="' + uid + '"]');
    if (openedRow) {
        var openedUnreadBadge = openedRow.querySelector('.msg-item-unread');
        if (openedUnreadBadge) openedUnreadBadge.remove();
    }

    document.querySelectorAll('.view').forEach(function(view) {
        view.classList.remove('active');
        view.style.display = 'none !important';
    });

    var chatView = document.getElementById('chatView');
    if (chatView) {
        chatView.classList.add('active');
        chatView.style.display = 'flex';
        chatView.style.zIndex = '2000';
        chatView.style.position = 'fixed';
    }

    this.currentChat = { uid: uid, name: name };
    document.getElementById('chatHeaderName').textContent = name;

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

    // Update online status
    this.trackPresence();

    // Apply chat wallpaper if saved
    var chatKey = [this.user.uid, uid].sort().join('_');
    var wallpaperKey = this.getChatWallpaperKey(chatKey);
    var savedWallpaper = localStorage.getItem(wallpaperKey);
    this.applyChatWallpaper(
        savedWallpaper,
        localStorage.getItem(wallpaperKey + '_blur'),
        localStorage.getItem(wallpaperKey + '_dim')
    );

    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatMessageInput').value = '';

    var self = this;
    setTimeout(function() {
        self.loadChatMessages();
        document.getElementById('chatMessageInput').focus();
    }, 100);
},

    // ============================================
    // CHAT FEATURES - TYPING INDICATOR  
    // ============================================

    showTypingIndicator: function() {
        if (!this.currentChat) return;
        var indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'flex';
            setTimeout(function() {
                if (indicator.style.display === 'flex') {
                    indicator.style.display = 'none';
                }
            }, 3000);
        }
    },

    hideTypingIndicator: function() {
        var indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    },

    // ============================================
    // CHAT FEATURES - CALL BUTTON
    // ============================================

    initiateCall: function() {
        if (!this.currentChat) {
            this.toast('No active chat', 'info');
            return;
        }
        this.toast('📞 Initiating call with ' + this.currentChat.name + '...', 'info');
        var callModal = document.getElementById('callModal');
        if (callModal) {
            callModal.style.display = 'flex';
            document.getElementById('callName').textContent = this.currentChat.name;
        }
    },

    // ============================================
    // CHAT FEATURES - EMOJI PICKER
    // ============================================

    openEmojiPicker: function() {
        var emojis = ['😊', '😂', '😍', '🔥', '👍', '🎉', '😭', '🤔', '💯', '✨', '😎', '🤣', '😘', '🙌', '🚀', '❤️'];
        var emojiMenu = document.createElement('div');
        emojiMenu.style.cssText = 'position:fixed;bottom:60px;right:10px;background:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:300;padding:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;';
        
        emojis.forEach(function(emoji) {
            var btn = document.createElement('button');
            btn.textContent = emoji;
            btn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:8px;border-radius:8px;transition:all 0.2s;';
            btn.onmouseover = function() { this.style.background = '#f0f0f0'; };
            btn.onmouseout = function() { this.style.background = 'none'; };
            btn.onclick = function() {
                var input = document.getElementById('chatMessageInput');
                input.value += emoji;
                input.focus();
                emojiMenu.remove();
            };
            emojiMenu.appendChild(btn);
        });
        
        document.body.appendChild(emojiMenu);
    },

    // ============================================
    // CHAT FEATURES - VOICE MESSAGE
    // ============================================

    recordVoiceMessage: function() {
        if (!this.currentChat) {
            this.toast('No active chat', 'info');
            return;
        }
        this.toast('🎤 Voice recording feature coming soon!', 'info');
    },

    // ============================================
    // CLOSE CHAT
    // ============================================

    closeChatView: function() {
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.remove('active');
            chatView.style.display = 'none';
        }
        if (this.currentChat && this.chatMessagesListener) {
            var key = [this.user.uid, this.currentChat.uid].sort().join('_');
            db.ref('chats/' + key + '/messages').off();
            this.chatMessagesListener = null;
        }
        this.currentChat = null;
        this.switchView('messages');
    },

    // ============================================
    // LOAD CHAT MESSAGES
    // ============================================

    loadChatMessages: function() {
        if (!this.currentChat) return;
        var self = this;
        var key = [self.user.uid, self.currentChat.uid].sort().join('_');
        if (!this.chatMessages) this.chatMessages = {};
        if (this.chatMessagesListener) {
            db.ref('chats/' + key + '/messages').off();
        }

        db.ref('chats/' + key + '/messages').once('value').then(function(snapshot) {
            var messages = [];
            snapshot.forEach(function(c) {
                var m = c.val();
                if (m && (m.text || m.image)) { messages.push(m); }
            });
            messages.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
            self.chatMessages[key] = messages;
            self.displayChatMessages(messages, key);

            self.chatMessagesListener = db.ref('chats/' + key + '/messages').on('child_added', function(snap) {
                var m = snap.val();
                if (m && (m.text || m.image) && m.sender !== self.user.uid) {
                    self.markAsRead(self.currentChat.uid);
                    db.ref('chats/' + key + '/messages').once('value').then(function(s) {
                        var updated = [];
                        s.forEach(function(c) {
                            var msg = c.val();
                            if (msg && (msg.text || msg.image)) { updated.push(msg); }
                        });
                        updated.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
                        self.chatMessages[key] = updated;
                        self.displayChatMessages(updated, key);
                    });
                }
            });
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
                chatMessagesView.innerHTML = '<div style="text-align:center;color:#999;padding:40px 16px;font-size:14px;">No messages yet. Say hello! 👋</div>';
            }
            return;
        }

        var html = '';
        var lastDate = '';
        messages.forEach(function(m, idx) {
            if (!m || (!m.text && !m.image)) return;
            var side = m.sender === self.user.uid ? 'own' : 'other';
            var timestamp = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

            if (idx === 0 || (messages[idx-1] && new Date(messages[idx-1].timestamp).toDateString() !== new Date(m.timestamp).toDateString())) {
                var d = new Date(m.timestamp);
                var today = new Date();
                var yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                var dateStr = 'Today';
                if (d.toDateString() === yesterday.toDateString()) { dateStr = 'Yesterday'; }
                else if (d.toDateString() !== today.toDateString()) { dateStr = d.toLocaleDateString(); }
                if (dateStr !== lastDate) {
                    html += '<div class="message-date-divider">' + dateStr + '</div>';
                    lastDate = dateStr;
                }
            }

            var content = '';
            if (m.image) {
                content += '<img src="' + m.image + '" style="max-width:180px;border-radius:12px;cursor:pointer;" onclick="app.viewFullImage(\'' + m.image + '\')">';
            }
            if (m.text) { content += '<div>' + m.text + '</div>'; }

            var otherUserName = self.currentChat.name || 'User';
            var otherUserInitial = otherUserName.charAt(0).toUpperCase();

            // Message actions (three dots)
            var actionMenu = '';
            if (m.sender === self.user.uid) {
                actionMenu = `<div class="msg-actions" style="display:flex;gap:4px;margin-left:8px;">
                    <button onclick="app.editMessage('${m.id || m._key || ''}','${key}')" title="Edit" style="background:none;border:none;cursor:pointer;font-size:12px;">✏️</button>
                    <button onclick="app.deleteMessage('${m.id || m._key || ''}','${key}')" title="Delete" style="background:none;border:none;cursor:pointer;font-size:12px;color:#ef4444;">🗑️</button>
                    <button onclick="app.deleteForEveryone('${m.id || m._key || ''}','${key}')" title="Delete for everyone" style="background:none;border:none;cursor:pointer;font-size:12px;color:#dc2626;">🚫</button>
                </div>`;
            }

            html += '<div class="message-group ' + side + '">';
            if (side === 'other') {
                html += '<div class="message-avatar" style="' + (self.users[self.currentChat.uid] && self.users[self.currentChat.uid].profilePhoto ? 'background-image: url(' + self.users[self.currentChat.uid].profilePhoto + '); background-size: cover; background-position: center;' : '') + '">' + (!self.users[self.currentChat.uid] || !self.users[self.currentChat.uid].profilePhoto ? otherUserInitial : '') + '</div>';
            }
            html += '<div class="message-wrapper">';
            if (side === 'other') { html += '<div class="message-sender">' + otherUserName + '</div>'; }
            html += '<div class="message-bubble">' + content + '</div>';
            html += '<div class="message-meta"><span>' + timestamp + '</span>' + actionMenu + '</div>';
            html += '</div></div>';
        });

        var chatMessagesView = document.getElementById('chatMessages');
        if (chatMessagesView) {
            chatMessagesView.innerHTML = html;
            setTimeout(function() { chatMessagesView.scrollTop = chatMessagesView.scrollHeight; }, 50);
            setTimeout(function() { chatMessagesView.scrollTop = chatMessagesView.scrollHeight; }, 150);
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
        if (!text) { if (input) input.focus(); return; }

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
            sender: self.user.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        }).then(function() {
            self.sendPushNotification(self.currentChat.uid, 'New message from ' + (self.profile.name || 'CHICHI user'), text);
            db.ref('chats/' + key + '/messages/' + messageRef.key).set({
                text: text,
                sender: self.user.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            });
            tempMessage.pending = false;
            self.displayChatMessages(self.chatMessages[key], key);
        }).catch(function(err) {
            self.toast('Error sending message', 'error');
            var idx = self.chatMessages[key].indexOf(tempMessage);
            if (idx > -1) {
                self.chatMessages[key].splice(idx, 1);
                self.displayChatMessages(self.chatMessages[key], key);
            }
        });
    },

    markAsRead: function(uid) {
    var self = this;
    var key = [this.user.uid, uid].sort().join('_');
    
    // Reset the unread count in memory
    if (this.unreadMessages && this.unreadMessages[key]) {
        this.unreadMessages[key].count = 0;
    }
    
    // Update unread badge immediately (optimistic update)
    this.updateUnreadBadge();
    
    // Mark unread records in both message stores so their counters cannot drift.
    var chatMessagesRef = db.ref('chats/' + key + '/messages');
    var messageListRef = db.ref('messages/' + key);
    Promise.all([chatMessagesRef.once('value'), messageListRef.once('value')]).then(function(snapshots) {
        var updates = {};
        snapshots.forEach(function(snapshot, index) {
            var basePath = index === 0 ? 'chats/' + key + '/messages/' : 'messages/' + key + '/';
            snapshot.forEach(function(childSnap) {
                var message = childSnap.val();
                if (message && message.sender !== self.user.uid && !message.read) {
                    updates[basePath + childSnap.key + '/read'] = true;
                }
            });
        });
        
        if (Object.keys(updates).length > 0) {
            db.ref().update(updates).then(function() {
                self.loadMessages();
                self.updateUnreadBadge();
            });
        } else {
            self.loadMessages();
            self.updateUnreadBadge();
        }
    }).catch(function(err) {
        console.error('Error marking messages as read:', err);
        // Still try to refresh the UI
        self.loadMessages();
        self.updateUnreadBadge();
    });
},
    viewFullImage: function(imageUrl) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '2000';
        modal.innerHTML = '<div style="position:relative;width:90%;max-width:500px;"><img src="' + imageUrl + '" style="width:100%;border-radius:12px;"><button onclick="this.closest(\'.modal-overlay\').remove()" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);color:white;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.2rem;font-weight:700;">✕</button></div>';
        document.body.appendChild(modal);
    },

    loadBlockedUsers: function() {
        if (!this.user) return;
        db.ref('users/' + this.user.uid + '/blocked').once('value', function(snapshot) {
            if (snapshot.val()) {
                Object.keys(snapshot.val()).forEach(function(userId) {
                    this.blockedUsers[userId] = true;
                }.bind(this));
            }
        }.bind(this));
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

    // ============================================
    // SHOW ABOUT
    // ============================================

    showAbout: function() {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML = `
            <div class="modal" style="max-width:420px;border-radius:20px;padding:24px;max-height:90vh;overflow-y:auto;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;">✕</button></div>

                <div style="text-align:center;padding:4px 0;">
                    <div style="width:100px;height:100px;border-radius:50%;margin:0 auto 12px;overflow:hidden;border:3px solid #0088cc;box-shadow:0 4px 16px rgba(0,136,204,0.3);">
                        <img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1784291624/1768467745366_1_lu01jr.jpg" alt="Anthony Onchari" style="width:100%;height:100%;object-fit:cover;">
                    </div>

                    <h2 style="margin-bottom:2px;font-weight:800;font-size:22px;color:#1a202c;">Anthony Onchari</h2>
                    <p style="color:#0088cc;font-size:13px;font-weight:600;margin-bottom:4px;">Developer & Digital Media Specialist</p>
                    <p style="color:#6b7280;font-size:11px;background:#f0f0f0;display:inline-block;padding:2px 12px;border-radius:12px;margin-bottom:16px;">
                        📱 Version V1.0
                    </p>

                    <div style="background:#f7fafc;padding:16px 18px;border-radius:16px;text-align:left;border:1px solid #e2e8f0;margin-bottom:16px;">
                        <p style="font-size:14px;line-height:1.8;color:#2d3748;margin:0;">
                            Hey there! 👋 I'm <strong style="color:#0088cc;">Anthony</strong>,
                            a Developer and Digital Media Specialist who loves building things that bring people and community together.
                            I created <strong style="color:#0088cc;">CHICHI</strong> because I believe
                            social media should feel like home — warm, real, and human.
                        </p>
                        <p style="font-size:13px;line-height:1.7;color:#4a5568;margin-top:10px;border-top:1px solid #e2e8f0;padding-top:10px;">
                            This is <strong>Version V02A.01</strong> — the beginning of something beautiful.
                            More features, more love, and more connection coming soon!
                        </p>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
                        <div style="background:#ebf8ff;padding:10px 6px;border-radius:12px;">
                            <div style="font-size:20px;">💻</div>
                            <div style="font-size:11px;color:#2b6cb0;font-weight:600;">Web Developer</div>
                        </div>
                        <div style="background:#f0fff4;padding:10px 6px;border-radius:12px;">
                            <div style="font-size:20px;">📱</div>
                            <div style="font-size:11px;color:#276749;font-weight:600;">Digital Media</div>
                        </div>
                        <div style="background:#faf5ff;padding:10px 6px;border-radius:12px;">
                            <div style="font-size:20px;">🤝</div>
                            <div style="font-size:11px;color:#6b46c1;font-weight:600;">Community Builder</div>
                        </div>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        <button onclick="window.open('https://wa.me/254701807001', '_blank')" style="padding:10px 18px;background:#25D366;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:0.3s;display:flex;align-items:center;gap:6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            💬 WhatsApp
                        </button>
                        <button onclick="window.open('https://www.facebook.com/profile.php?id=100088002065441', '_blank')" style="padding:10px 18px;background:#1877F2;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:0.3s;display:flex;align-items:center;gap:6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            📘 Facebook
                        </button>
                        <button onclick="window.open('https://www.linkedin.com/in/anthony-onchari-a3b87b270/', '_blank')" style="padding:10px 18px;background:#0A66C2;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:0.3s;display:flex;align-items:center;gap:6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            💼 LinkedIn
                        </button>
                    </div>

                    <div style="margin-top:14px;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0;padding-top:12px;">
                        <span>© 2026 Onchari Group • CHICHI V1.0</span>
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
    // SHOW HEADER MENU
    // ============================================

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

    // ============================================
    // SHOW EDIT PROFILE MODAL
    // ============================================

    showEditProfileModal: function() {
        var self = this;

        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:flex-end;justify-content:center;';

        var modal = document.createElement('div');
        modal.style.cssText = 'width:100%;max-width:450px;max-height:85vh;background:white;border-radius:28px 28px 0 0;overflow-y:scroll;overflow-x:hidden;padding:20px;box-sizing:border-box;-webkit-overflow-scrolling:touch;';

        modal.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2 style="margin:0;font-weight:700;">Edit Your Profile</h2>
                <button onclick="this.closest('div').closest('div').parentElement.parentElement.remove()" style="background:none;border:none;font-size:24px;cursor:pointer;">✕</button>
            </div>

            <div style="text-align:center;margin-bottom:24px;">
                <div id="editProfilePhotoPreview" style="background-image:url(${this.profile.profilePhoto || ''});background-size:cover;background-position:center;width:120px;height:120px;border-radius:50%;margin:0 auto;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:white;background-color:var(--primary);" onclick="document.getElementById('editProfilePhotoInput').click()">
                    ${!this.profile.profilePhoto ? this.user.email.charAt(0).toUpperCase() : ''}
                    <div style="position:absolute;bottom:0;right:0;background:var(--primary);color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;border:3px solid white;">📷</div>
                </div>
                <input type="file" id="editProfilePhotoInput" accept="image/*" style="display:none;" onchange="app.previewEditProfilePhoto(event)">
                <div style="font-size:0.8rem;color:var(--text-light);margin-top:8px;">Tap avatar to change photo</div>
            </div>

            <div style="margin-bottom:16px;">
                <label style="display:block;font-weight:600;margin-bottom:8px;">Name</label>
                <input type="text" id="editProfileName" value="${this.profile.name || ''}" placeholder="Your full name" style="width:100%;padding:12px;border:1px solid #ccc;border-radius:8px;font-size:1rem;box-sizing:border-box;">
            </div>

            <div style="margin-bottom:16px;">
                <label style="display:block;font-weight:600;margin-bottom:8px;">Username</label>
                <input type="text" id="editProfileUsername" value="${this.profile.username || ''}" placeholder="Your username" style="width:100%;padding:12px;border:1px solid #ccc;border-radius:8px;font-size:1rem;box-sizing:border-box;">
            </div>

            <div style="margin-bottom:16px;">
                <label style="display:block;font-weight:600;margin-bottom:8px;">Email</label>
                <input type="email" id="editProfileEmail" value="${this.user.email || ''}" placeholder="Your email" disabled style="background:#f3f4f6;cursor:not-allowed;width:100%;padding:12px;border:1px solid #ccc;border-radius:8px;font-size:1rem;box-sizing:border-box;">
                <div style="font-size:0.75rem;color:#999;margin-top:4px;">Cannot change email</div>
            </div>

            <div style="margin-bottom:16px;">
                <label style="display:block;font-weight:600;margin-bottom:8px;">Bio / About Me</label>
                <textarea id="editProfileBio" placeholder="Tell us about yourself..." style="width:100%;min-height:80px;padding:12px;border:1px solid #ccc;border-radius:8px;font-family:inherit;font-size:1rem;resize:vertical;box-sizing:border-box;">${this.profile.bio || ''}</textarea>
            </div>

            <div style="margin-bottom:16px; position: relative;">
                <label style="display:block;font-weight:600;margin-bottom:8px;">Interests (comma separated)</label>
                <input type="text" id="editProfileInterests" value="${(this.profile.interests || []).join(', ')}"
                       placeholder="music, sports, travel, tech..."
                       style="width:100%;padding:12px;border:1px solid #ccc;border-radius:8px;font-size:1rem;box-sizing:border-box;"
                       onkeyup="app.showInterestSuggestions(this)">
                <div id="interestSuggestionsContainer" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ccc;border-radius:8px;max-height:150px;overflow-y:auto;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.1);margin-top:4px;"></div>
                <div style="font-size:0.75rem;color:#999;margin-top:4px;">Type to see suggestions, click to add</div>
            </div>

            <div style="display:flex;gap:12px;margin-top:24px;">
                <button onclick="this.closest('div').closest('div').parentElement.parentElement.remove()" style="flex:1;padding:12px;background:#e5e7eb;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">Cancel</button>
                <button onclick="app.saveProfileChanges()" style="flex:1;padding:12px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">Save Changes</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    },

    // ============================================
    // INTEREST SUGGESTIONS
    // ============================================

    showInterestSuggestions: function(input) {
        var container = document.getElementById('interestSuggestionsContainer');
        if (!container) return;

        var query = input.value.trim().toLowerCase();

        if (query.length < 1) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        var allInterests = [
            'Music', 'Sports', 'Travel', 'Art', 'Tech', 'Food', 'Fitness', 'Books',
            'Movies', 'Nature', 'Gaming', 'Photography', 'Writing', 'Cooking', 'Yoga',
            'Dance', 'Fashion', 'Science', 'History', 'Entrepreneurship', 'Marketing',
            'Finance', 'Startups', 'Comedy', 'Animation', 'Design', 'Illustration',
            'Football', 'Basketball', 'Tennis', 'Health', 'Beauty', 'DIY', 'Programming',
            'AI', 'Web Dev', 'Apps', 'Gadgets', 'Learning', 'Language', 'Investing',
            'Environment', 'Charity', 'Community', 'Activism', 'Culture'
        ];

        var suggestions = allInterests.filter(function(interest) {
            return interest.toLowerCase().includes(query);
        });

        if (suggestions.length === 0) {
            container.innerHTML = '<div style="padding: 8px; color: #9ca3af; font-size: 12px;">No matches found</div>';
            container.style.display = 'block';
            return;
        }

        var html = '';
        suggestions.slice(0, 8).forEach(function(interest) {
            html += `
                <div style="padding: 6px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #1a202c; transition: 0.2s;"
                     onmouseover="this.style.background='#f0f7ff'"
                     onmouseout="this.style.background='white'"
                     onclick="app.addInterestSuggestion('${interest}')">
                    ${interest}
                </div>
            `;
        });

        container.innerHTML = html;
        container.style.display = 'block';
    },

    addInterestSuggestion: function(interest) {
        var input = document.getElementById('editProfileInterests');
        if (!input) return;

        var currentValue = input.value.trim();
        var interests = currentValue ? currentValue.split(',').map(function(i) { return i.trim(); }) : [];

        if (!interests.includes(interest)) {
            interests.push(interest);
            input.value = interests.join(', ');
        }

        document.getElementById('interestSuggestionsContainer').style.display = 'none';
        input.focus();
    },

    previewEditProfilePhoto: function(event) {
        var file = event.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('editProfilePhotoPreview').style.backgroundImage = 'url(' + e.target.result + ')';
            this.editProfilePhoto = e.target.result;
        }.bind(this);
        reader.readAsDataURL(file);
    },

    saveProfileChanges: function() {
        var name = document.getElementById('editProfileName').value.trim();
        var username = document.getElementById('editProfileUsername').value.trim();
        var phone = document.getElementById('editProfilePhone').value.trim();
        var bio = document.getElementById('editProfileBio').value.trim();
        var self = this;

        if (!name) {
            this.toast('Name cannot be empty', 'error');
            return;
        }

        if (!username) {
            this.toast('Username cannot be empty', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.toast('Username can only contain letters, numbers, and underscores', 'error');
            return;
        }

        if (username.length < 3) {
            this.toast('Username must be at least 3 characters', 'error');
            return;
        }

        // Keep existing interests (don't change them)
        var interests = this.profile.interests || [];

        this.toast('⏳ Saving profile...', 'info');

        if (username !== this.profile.username) {
            db.ref('users').orderByChild('username').equalTo(username).once('value', function(snapshot) {
                if (snapshot.exists()) {
                    var existingUid = Object.keys(snapshot.val())[0];
                    if (existingUid !== self.user.uid) {
                        self.toast('❌ This username is already taken', 'error');
                        return;
                    }
                }
                self._saveProfileData(name, username, phone, bio, interests);
            });
        } else {
            this._saveProfileData(name, username, phone, bio, interests);
        }
    },

    _saveProfileData: function(name, username, phone, bio, interests) {
        var self = this;
        var updateData = {
            name: name,
            username: username,
            phone: phone,
            bio: bio,
            interests: interests
        };

        if (this.editProfilePhoto && this.editProfilePhoto.startsWith('data:')) {
            var formData = new FormData();
            fetch(this.editProfilePhoto).then(function(res) { return res.blob(); }).then(function(blob) {
                formData.append('file', blob);
                formData.append('upload_preset', 'chichi_photos');

                fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                    method: 'POST',
                    body: formData
                }).then(function(res) { return res.json(); }).then(function(data) {
                    if (data.secure_url) {
                        updateData.profilePhoto = data.secure_url;
                        self._updateProfile(updateData);
                    }
                }).catch(function(err) {
                    self.toast('Photo upload failed', 'error');
                });
            });
        } else {
            this._updateProfile(updateData);
        }
    },

    _updateProfile: function(updateData) {
        var self = this;
        db.ref('users/' + this.user.uid).update(updateData, function(err) {
            if (err) {
                self.toast('❌ Error updating profile', 'error');
            } else {
                self.profile = { ...self.profile, ...updateData };
                if (updateData.profilePhoto) self.claimAirtimeReward('profilePhoto');
                self.toast('✅ Profile updated successfully!', 'success');
                self.editProfilePhoto = null;

                // Close edit profile modal
                var editModal = document.getElementById('editProfileModal');
                if (editModal) {
                    editModal.style.display = 'none';
                }

                self.renderProfile();
                self.logUserActivity('update_profile', 'Updated profile: ' + updateData.name);
            }
        });
    },

    // ============================================
    // UNFOLLOW USER
    // ============================================

    unfollowUser: function(uid, name) {
        delete this.following[uid];
        db.ref('users/' + this.user.uid + '/following').set(Object.keys(this.following).length);
        db.ref('users/' + uid + '/followers').once('value', function(s) {
            var followers = Math.max(0, (s.val() || 0) - 1);
            db.ref('users/' + uid + '/followers').set(followers);
        });
        this.renderProfile();
        this.logUserActivity('unfollow', 'Unfollowed user: ' + name);
    },

    // ============================================
    // SHOW FOLLOWING LIST
    // ============================================

    showFollowing: function() {
        var html = '<div class="modal"><div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
        html += '<h2 style="margin-bottom:16px;">Following (' + Object.keys(this.following).length + ')</h2>';
        if (Object.keys(this.following).length === 0) {
            html += '<div style="text-align:center;color:#6b7280;padding:20px;">Not following anyone yet</div>';
        } else {
            html += '<div class="following-list">';
            for (var uid in this.following) {
                if (this.users[uid]) {
                    var u = this.users[uid];
                    var unreadCount = this.getUnreadCountForUser(uid);
                    var msgBadge = unreadCount > 0 ? '<span style="position:absolute;top:-8px;right:-8px;width:22px;height:22px;background:#ef4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(239,68,68,0.4);">' + unreadCount + '</span>' : '';

                    html += `
                        <div class="following-item" style="display:flex;align-items:center;padding:10px;border-bottom:1px solid #f0f0f0;gap:12px;">
                            <div class="following-avatar" style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;background-image:url(${u.profilePhoto || ''});background-size:cover;background-position:center;">${!u.profilePhoto ? u.name.charAt(0).toUpperCase() : ''}</div>
                            <div class="following-name" style="flex:1;font-weight:600;">${u.name}</div>
                            <div style="display:flex;gap:6px;">
                                <button class="following-unfollow" onclick="app.openChatFromSearch('${uid}', '${u.name}')" style="background:var(--primary);color:white;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.75rem;font-weight:600;transition:0.3s;position:relative;">
                                    💬
                                    ${msgBadge}
                                </button>
                                <button class="following-unfollow" onclick="app.unfollowUser('${uid}', '${u.name}')" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.75rem;font-weight:600;">Unfollow</button>
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

    // ============================================
    // SHOW LOGIN PAGE
    // ============================================

    showLoginPage: function(tab) {
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

        this.switchTab(tab || 'login');
    },

    // ============================================
    // SHOW GUEST PROMPT MODAL
    // ============================================

    showGuestModal: function(context) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '99999';
        modal.innerHTML = `
            <div class="modal" style="max-width:420px;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
                <h2 style="margin-bottom:12px;font-weight:800;">🔐 Welcome to CHICHI</h2>
                <p style="color:var(--text-light);margin-bottom:18px;line-height:1.45;">You can browse the Feed as a guest, but ${context || 'this feature'} requires an account. Sign up or log in to unlock Messaging, Earn, and Profile.</p>
                <div style="display:flex;gap:10px;margin-bottom:12px;">
                    <button onclick="app.showLoginPage('login'); this.closest('.modal-overlay').remove();" style="flex:1;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;padding:12px;border-radius:10px;font-weight:700;">🔐 Log In</button>
                    <button onclick="app.showLoginPage('signup'); this.closest('.modal-overlay').remove();" style="flex:1;background:#f3f4f6;color:#1a1a1a;border:none;padding:12px;border-radius:10px;font-weight:700;">📝 Sign Up</button>
                </div>
                <button onclick="app.continueAsGuest(); this.closest('.modal-overlay').remove();" style="width:100%;background:white;border:1px solid #e5e7eb;padding:10px;border-radius:10px;font-weight:700;">Continue Browsing Feed</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    continueAsGuest: function() {
        this.user = null;
        this.isGuest = true;
        this.isAdmin = false;
        this.profile = { name: 'Guest', balance: 0, triviaAnswered: [], tier: 'free' };
        this.toast('📱 Browsing as Guest - Sign up to unlock all features!', 'info');
        this.updateHeaderMenu();
        this.showApp();
        this.switchView('feed');
        this.loadPosts();
        this.logUserActivity('guest_access', 'User browsing as guest');
    },

        // ============================================
    // OFFLINE / ONLINE HANDLING
    // ============================================

    showOfflineOverlay: function() {
        var overlay = document.getElementById('offlineOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '0';
            setTimeout(function() {
                overlay.style.transition = 'opacity 0.4s ease';
                overlay.style.opacity = '1';
            }, 50);
        }
    },

    hideOfflineOverlay: function() {
        var overlay = document.getElementById('offlineOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(function() {
                overlay.style.display = 'none';
            }, 400);
        }
    },

    checkConnectionAndRetry: function() {
        if (navigator.onLine) {
            this.hideOfflineOverlay();
            this.toast('✅ Back online!', 'success');
            // Reload critical data
            this.loadPosts();
            this.loadUsers();
            this.loadMessages();
        } else {
            this.toast('📡 Still offline. Please check your connection.', 'error');
        }
    },

    setupConnectivityListeners: function() {
        var self = this;

        // Initial check
        if (!navigator.onLine) {
            self.showOfflineOverlay();
        } else {
            self.hideOfflineOverlay();
        }

        window.addEventListener('online', function() {
            self.hideOfflineOverlay();
            self.toast('✅ Back online!', 'success');
            self.loadPosts();
            self.loadUsers();
            self.loadMessages();
        });

        window.addEventListener('offline', function() {
            self.showOfflineOverlay();
            self.toast('📡 You are offline', 'error');
        });
    },

    // ============================================
    // SWITCH TAB
    // ============================================

    switchTab: function(tab) {
        document.querySelectorAll('.tab').forEach(function(t) { if (t && t.classList) t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { if (c && c.classList) c.classList.remove('active'); });
        document.querySelector('[onclick="app.switchTab(\'' + tab + '\')"]').classList.add('active');
        document.getElementById(tab + 'Tab').classList.add('active');
    },

    // ============================================
    // SWITCH VIEW
    // ============================================

    switchView: function(view) {
        if (this.isGuest && ['messages', 'earn', 'profile'].includes(view)) {
            var guestAuthPage = document.getElementById('authPage');
            var guestMainApp = document.getElementById('mainApp');
            if (guestAuthPage) {
                guestAuthPage.classList.remove('show');
                guestAuthPage.classList.add('hidden');
                guestAuthPage.style.display = 'none';
            }
            if (guestMainApp) {
                guestMainApp.style.display = 'flex';
                guestMainApp.classList.add('active');
            }
            var guestNav = document.querySelector('.bottom-nav');
            if (guestNav) guestNav.style.display = 'flex';
        }

        if (!this.navigationHistory) this.navigationHistory = [];
        if (!this.currentView) this.currentView = 'feed';

        if (this.currentView !== view) {
            this.navigationHistory.push(this.currentView);
        }

        this.currentView = view;

        try {
            localStorage.setItem('chichiCurrentView', view);
        } catch (e) {}

        document.querySelectorAll('.view').forEach(function(v) {
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

        document.querySelectorAll('.nav-wrapper > .nav-item').forEach(function(n) { if (n && n.classList) n.classList.remove('active'); });

        var viewElement = document.getElementById(view + 'View');
        if (viewElement) {
            viewElement.classList.add('active');
        }

        if (view === 'profile') {
            // Make sure the view is active first
            var profileView = document.getElementById('profileView');
            if (profileView) {
                profileView.classList.add('active');
                profileView.style.display = 'flex';
            }
            // Render with a slight delay to ensure DOM is ready
            var self = this;
            setTimeout(function() {
                self.renderProfile();
            }, 50);
        } else if (view === 'feed') {
            this.loadPosts();
            this.loadStories();
        } else if (view === 'messages') {
            this.loadMessages();
            this.clearUnreadBadge();
        } else if (view === 'explore') {
            this.loadExplore();
        } else if (view === 'earn') {
            this.renderEarn();
            var self = this;
            setTimeout(function() {
                if (self.pendingTrivia && self.pendingTrivia.question) {
                    self.currentTrivia = self.pendingTrivia;
                    self.triviaAnswered = false;
                    self.renderEarnWithTrivia(self.pendingTrivia);
                }
            }, 100);
        }

        var navItems = document.querySelectorAll('.nav-wrapper > .nav-item');
        if (view === 'feed' && navItems[0]) navItems[0].classList.add('active');
        else if (view === 'explore' && navItems[1]) navItems[1].classList.add('active');
        else if (view === 'messages' && navItems[2]) navItems[2].classList.add('active');
        else if (view === 'earn' && navItems[3]) navItems[3].classList.add('active');
        else if (view === 'profile' && navItems[4]) navItems[4].classList.add('active');
    },
    showDeveloperInfo: function() {
        var modal = document.getElementById('developerModal');
        if (!modal) return;
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    },

    closeDeveloperInfo: function() {
        var modal = document.getElementById('developerModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    },

    // ============================================
    // SWITCH FEED TAB
    // ============================================

    switchFeedTab: function(tab) {
        var self = this;
        this.currentFeedTab = tab;
        
        // Update tab UI
        document.querySelectorAll('.feed-tab').forEach(function(t) {
            t.classList.remove('active');
        });
        document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
        
        // Re-render feed with the new filter
        this.renderFeed();
    },

    // ============================================
    // GO BACK
    // ============================================

    goBack: function() {
        if (!this.backPressCount) {
            this.backPressCount = 0;
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

            setTimeout(function() {
                if (this.backPressCount === 1) {
                    this.backPressCount = 0;
                }
            }.bind(this), 2000);

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
                if (viewId === 'earnView') return 'earn';
            }
        }
        return 'feed';
    },

    // ============================================
    // LOAD POSTS
    // ============================================

    loadPosts: function() {
        var self = this;
        this.postsLoading = true;
        this.renderFeed();
        if (!db) {
            setTimeout(function() {
                if (db) self.loadPosts();
            }, 500);
            return;
        }
        this.loadStories();
        console.log('📥 loadPosts() - attaching listener to /posts');

        db.ref('posts').orderByChild('timestamp').limitToLast(50).on('value', function(s) {
            var p = [];
            s.forEach(function(c) {
                var post = c.val();
                if (post) {
                    post.id = c.key;
                    p.unshift(post);
                }
            });
            self.posts = p;
            console.log('✅ posts loaded:', self.posts.length);
            self.postsLoading = false;
            self.renderFeed();
        }, function(err) {
            console.error('❌ Error loading posts:', err.message);
            self.posts = [];
            self.postsLoading = false;
            self.renderFeed();
        });
    },

    // ============================================
    // RENDER FEED
    // ============================================

    renderFeed: function() {
        var feedContainer = document.getElementById('feedContainer');
        if (!feedContainer) return;

        // Hide/show feed tabs based on guest status
        var feedTabsContainer = document.getElementById('feedTabsContainer');
        if (feedTabsContainer) {
            if (this.isGuest) {
                feedTabsContainer.style.display = 'none';
                this.currentFeedTab = 'forYou'; // Always show all posts for guests
            } else {
                feedTabsContainer.style.display = 'flex';
            }
        }

        if (!this.posts) this.posts = [];

        var html = '';
        if (this.postsLoading) {
            html = '<div class="feed-loading-state" aria-label="Loading posts"><div class="feed-loading-spinner"></div><div class="feed-loading-text">Loading your feed...</div><div class="feed-skeleton-post"><div class="feed-skeleton-line feed-skeleton-user"></div><div class="feed-skeleton-image"></div><div class="feed-skeleton-line feed-skeleton-caption"></div></div><div class="feed-skeleton-post"><div class="feed-skeleton-line feed-skeleton-user"></div><div class="feed-skeleton-image"></div><div class="feed-skeleton-line feed-skeleton-caption"></div></div></div>';
        } else {
            // Filter posts based on active tab
            var filteredPosts = this.posts;
            
            if (this.currentFeedTab === 'following' && this.user && !this.isGuest) {
                // Only show posts from users the current user follows
                filteredPosts = this.posts.filter(function(p) {
                    return this.following && this.following[p.userId];
                }.bind(this));
            }
            
            if (filteredPosts.length === 0) {
                if (this.isGuest) {
                    html = '<div style="text-align:center;color:#6b7280;padding:40px 16px;">\n                    <div style="font-size:36px;margin-bottom:8px;">🙋</div>\n                    <div style="font-weight:700;margin-bottom:6px;">Sign in to view the full Feed</div>\n                    <div style="color:#9ca3af;margin-bottom:12px;">Create an account to follow people and see personalized posts.</div>\n                    <button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;">🔐 Sign In / Sign Up</button>\n                </div>';
                } else if (this.currentFeedTab === 'following') {
                    html = '<div style="text-align:center;color:#6b7280;padding:40px 16px;"><div style="font-size:36px;margin-bottom:8px;">👥</div><div style="font-weight:700;margin-bottom:6px;">No posts yet</div><div style="color:#9ca3af;margin-bottom:12px;">Posts from people you follow will appear here.</div></div>';
                } else {
                    html = '<div style="text-align:center;color:#6b7280;padding:40px 16px;">No posts yet. Start creating!</div>';
                }
            } else {
                filteredPosts.forEach(function(p) {
                    var likes = (p.likes && Object.keys(p.likes).length) || 0;
                    var downloads = p.downloads || 0;
                    var comments = (p.comments && p.comments.length) || 0;
                    var userLiked = this.user && p.likes && p.likes[this.user.uid];
                    var isOwnPost = this.user && p.userId === this.user.uid;

                    var isSupportPost = false;
                    if (p.isSupportPost === true || p.isAutoPost === true) {
                        isSupportPost = true;
                    }
                    if (p.userName === 'SUPPORT@CHICHI') {
                        isSupportPost = true;
                    }
                    if (p.source === 'CHICHI AI' || p.source === 'AutoPost') {
                        isSupportPost = true;
                    }

                    var postHtml = '<div class="post" id="post-' + p.id + '" style="' + (isSupportPost ? 'border-radius:12px;' : '') + '"><div class="post-header"><div class="post-user"><div class="post-avatar" style="background-image:url(' + (p.userPhoto || '') + ');cursor:pointer;" onclick="app.viewUserProfile(\'' + p.userId + '\')">' + (!p.userPhoto ? p.userName.charAt(0).toUpperCase() : '') + '</div><div><div class="post-name" onclick="app.viewUserProfile(\'' + p.userId + '\')">' + p.userName + '</div><div class="post-time">' + p.createdAt + '</div></div></div>' + (isOwnPost ? '<button class="post-menu" onclick="app.deletePost(\'' + p.id + '\')">🗑️</button>' : '') + '</div>';

                    postHtml += '<img src="' + p.photoUrl + '" class="post-image" loading="eager" decoding="async" fetchpriority="high" onload="this.classList.add(\'post-image-loaded\')" onerror="this.classList.add(\'post-image-loaded\')" style="' + (isSupportPost ? 'border-radius:0;' : '') + '"><div class="post-caption">' + p.caption + '</div>';

                    postHtml += '<div class="post-stats">' + likes + ' likes · ' + downloads + ' saves · ' + comments + ' comments</div>';

                    // --- CHANGED: Show only Share button for guests ---
                    var actionsHtml = '';
                    if (this.isGuest) {
                        // Guest: only Share button
                        actionsHtml = '<div class="post-actions"><button class="post-action" onclick="app.sharePost(\'' + p.id + '\', \'' + p.caption.replace(/'/g, "\\'") + '\')">📤 Share</button></div>';
                    } else {
                        // Logged in: all actions
                        actionsHtml = '<div class="post-actions"><button class="post-action ' + (userLiked ? 'liked' : '') + '" onclick="app.likePost(\'' + p.id + '\')">' + (userLiked ? '❤️ Liked' : '🤍 Like') + '</button><button class="post-action" onclick="app.downloadPost(\'' + p.photoUrl + '\', \'' + p.id + '\')">💾 Save</button><button class="post-action" onclick="app.viewComments(\'' + p.id + '\')">💬 Comment</button><button class="post-action" onclick="app.sharePost(\'' + p.id + '\', \'' + p.caption.replace(/'/g, "\\'") + '\')">📤 Share</button></div>';
                    }
                    postHtml += actionsHtml;

                    postHtml += '</div>';
                    html += postHtml;
                }.bind(this));
            }
        }

        feedContainer.setAttribute('aria-busy', this.postsLoading ? 'true' : 'false');
        feedContainer.style.display = 'block';
        feedContainer.innerHTML = html;

        if (!this.postsLoading) {
            var loadingState = feedContainer.querySelector('.feed-loading-state');
            if (loadingState) loadingState.remove();
        }
    },

    // ============================================
    // LIKE POST
    // ============================================

    likePost: function(id) {
        if (!this.requireAuth('like posts')) return;

        var self = this;
        db.ref('posts/' + id).once('value', function(s) {
            var post = s.val();
            var likes = post.likes || {};

            if (likes[self.user.uid]) {
                delete likes[self.user.uid];
            } else {
                likes[self.user.uid] = true;
                self.balance += 0.2;
                db.ref('users/' + self.user.uid + '/balance').set(self.balance);
                self.trackRevenue('earned', 0.2, 'like');
                self.engagementStats.likesCount = (self.engagementStats.likesCount || 0) + 1;
                self.saveEngagementStats();
            }

            db.ref('posts/' + id + '/likes').set(likes);
            self.renderFeed();
            if (self.currentView === 'profile') {
                self.renderProfile();
            }
            self.logUserActivity('like_post', 'Liked post: ' + id);
        });
    },

    // ============================================
    // DOWNLOAD POST
    // ============================================

    downloadPost: function(url, id) {
        if (!this.requireAuth('save posts')) return;
        try {
            var link = document.createElement('a');
            link.href = url;
            link.download = 'photo.jpg';
            link.click();
            this.logUserActivity('download_post', 'Downloaded post: ' + id);
        } catch (err) {
            this.toast('Download failed', 'error');
        }
    },

    // ============================================
    // SHARE POST
    // ============================================

    sharePost: function(id, caption) {
        // Guests are allowed to share
        var shareText = caption || 'Check out this post on CHICHI!';
        var shareUrl = window.location.href;

        if (navigator.share) {
            navigator.share({
                title: 'CHICHI',
                text: shareText,
                url: shareUrl
            }).catch(function(err) { console.log('Share cancelled'); });
        } else {
            var text = shareText + '\n' + shareUrl;
            navigator.clipboard.writeText(text).then(function() {
                this.toast('Post link copied to clipboard! 📋', 'success');
                this.logUserActivity('share_post', 'Shared post: ' + id);
            }.bind(this)).catch(function(err) {
                this.toast('Share link: ' + shareUrl, 'info');
            }.bind(this));
        }
    },

    // ============================================
    // DELETE POST
    // ============================================

    deletePost: function(id) {
        if (!confirm('Delete this post?')) return;
        var self = this;
        db.ref('posts/' + id).remove().then(function() {
            self.toast('Post deleted', 'success');
            self.loadPosts();
            if (self.currentView === 'profile') {
                self.renderProfile();
            }
        });
    },

    // ============================================
    // VIEW COMMENTS
    // ============================================

    viewComments: function(id) {
        if (!this.requireAuth('comment')) return;

        var self = this;
        db.ref('posts/' + id).once('value', function(s) {
            var post = s.val();
            var comments = post.comments || [];
            var commentedUsers = post.commentedUsers || {};
            var userCommented = this.user && commentedUsers[this.user.uid];

            var html = '';
            if (comments.length === 0) {
                html = '<div style="text-align:center;color:#6b7280;padding:20px;">No comments yet</div>';
            } else {
                comments.forEach(function(c) {
                    html += '<div style="background:var(--light);padding:12px;border-radius:12px;margin-bottom:8px;"><div style="font-weight:600;font-size:0.9rem;">' + c.user + '</div><div style="font-size:0.85rem;margin:4px 0;">' + c.text + '</div><div style="font-size:0.75rem;color:var(--text-light);">' + c.time + '</div></div>';
                });
            }

            html += '<div style="border-top:1px solid var(--border);padding-top:12px;display:flex;gap:8px;"><input type="text" id="commentInput" placeholder="Add comment..." style="flex:1;border:1px solid var(--border);border-radius:20px;padding:10px 12px;"><button onclick="app.submitComment(\'' + id + '\')" style="background:' + (userCommented ? '#d1d5db' : 'var(--primary)') + ';color:' + (userCommented ? 'var(--text-light)' : 'white') + ';border:none;border-radius:20px;padding:10px 16px;cursor:pointer;font-weight:600;' + (userCommented ? 'cursor:not-allowed;' : '') + '">' + (userCommented ? '✓ Earned' : 'Post') + '</button></div>';

            var modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = '<div class="modal"><div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div><h2 style="font-weight:700;margin-bottom:16px;">Comments</h2><div style="max-height:400px;overflow-y:auto;margin-bottom:16px;">' + html + '</div></div>';
            document.body.appendChild(modal);
        }.bind(this));
    },

    // ============================================
    // SUBMIT COMMENT
    // ============================================

    submitComment: function(id) {
        var text = document.getElementById('commentInput').value.trim();
        if (!text) return;

        var self = this;
        db.ref('posts/' + id).once('value', function(s) {
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
            self.trackRevenue('earned', 0.5, 'comment');
            self.engagementStats.commentsCount = (self.engagementStats.commentsCount || 0) + 1;
            self.saveEngagementStats();

            var modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
            }
            self.toast('Comment added', 'success');
            self.renderFeed();
            self.logUserActivity('comment', 'Commented on post: ' + id);
        });
    },

    // ============================================
    // VIEW USER PROFILE
    // ============================================

    viewUserProfile: function(uid) {
        if (uid === this.user.uid) {
            this.switchView('profile');
        } else {
            var self = this;
            db.ref('users/' + uid).once('value', function(s) {
                if (s.exists()) {
                    var user = s.val();
                    var isFollowing = this.following[uid] || false;
                    var userFollowsAdmin = Object.keys(user.following || {}).some(function(adminUid) {
                        var admin = this.users && this.users[adminUid];
                        return admin && admin.email && ['support-chichi@gmail.com', 'onchari.dev@gmail.com', 'support@chichi.buzz'].indexOf(admin.email.toLowerCase()) !== -1;
                    }.bind(this));
                    var isVerified = !!user.phone && userFollowsAdmin;
                    var unreadCount = this.getUnreadCountForUser(uid);
                    var msgBadge = unreadCount > 0 ? '<span style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;background:#ef4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(239,68,68,0.4);">' + unreadCount + '</span>' : '';

                    var html = '<div class="profile-header"><div class="profile-top"><div class="profile-avatar-large" style="background-image:url(' + (user.profilePhoto || '') + ');">' + (!user.profilePhoto ? user.name.charAt(0).toUpperCase() : '') + '</div><div class="profile-info"><div class="profile-name">' + (user.name || 'User') + (isVerified ? ' <span class="verified-badge" title="Phone added and admin followed">✓</span>' : '') + '</div><div class="profile-email">' + user.email + '</div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-value">-</div><div class="profile-stat-label">Posts</div></div><div class="profile-stat"><div class="profile-stat-value">' + (user.followers || 0) + '</div><div class="profile-stat-label">Followers</div></div></div></div></div><div style="display:flex;gap:8px;margin-top:12px;"><button class="follow-btn" onclick="app.toggleFollow(\'' + uid + '\', \'' + user.name + '\')" style="background:' + (isFollowing ? '#ff4444' : 'var(--primary)') + ';color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600;transition:0.3s;flex:1;">' + (isFollowing ? '✕ Unfollow' : '✓ Follow') + '</button><button class="follow-btn" onclick="app.openChatFromSearch(\'' + uid + '\', \'' + user.name + '\')" style="background:#2E5BFF;color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600;transition:0.3s;flex:1;position:relative;">💬 Message ' + msgBadge + '</button></div></div>';

                    var modal = document.createElement('div');
                    modal.className = 'modal-overlay active';
                    modal.innerHTML = '<div class="modal"><div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' + html + '</div>';
                    document.body.appendChild(modal);
                }
            }.bind(this));
        }
    },

    // ============================================
    // TOGGLE FOLLOW
    // ============================================


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
            this.logUserActivity('unfollow', 'Unfollowed user: ' + name);
        } else {
            this.following[uid] = true;
            this.balance += 0.05;
            db.ref('users/' + this.user.uid + '/balance').set(this.balance);
            this.trackRevenue('earned', 0.05, 'follow');
            this.logUserActivity('follow', 'Followed user: ' + name);
        }

        db.ref('users/' + this.user.uid + '/following').set(this.following);
        db.ref('users/' + uid + '/followers').once('value', function(s) {
            var followers = Math.max(0, (s.val() || 0) + (isFollowing ? -1 : 1));
            db.ref('users/' + uid + '/followers').set(followers);
            if (self.users[uid]) self.users[uid].followers = followers;
            if (!isFollowing) self.sendPushNotification(uid, (self.profile.name || 'Someone') + ' followed you', 'You have a new follower on CHICHI.');
            if (!isFollowing && self.isAirtimeRewardAdmin(uid)) self.claimAirtimeReward('followAdmin');
            if (self.currentView === 'profile') self.renderProfile();
            if (self.currentView === 'explore') self.loadExplorePeople();
        });

        var modal = document.querySelector('.modal-overlay.active');
        if (modal) {
            modal.remove();
        }
    },

    // ============================================
    // SHOW LOGOUT
    // ============================================

    showLogout: function() {
        this.justLogout();
    },

    closeLogout: function() {
        return;
    },

    confirmLogout: function() {
        this.justLogout();
    },

    justLogout: function() {
        auth.signOut();
        this.showAuth();
        this.toast('Logged out successfully', 'success');
        if (this.onlineInterval) {
            clearInterval(this.onlineInterval);
            this.onlineInterval = null;
        }
        if (this.triviaInterval) {
            clearInterval(this.triviaInterval);
            this.triviaInterval = null;
        }
        this.logUserActivity('logout', 'User logged out');
    },

    // ============================================
    // DELETE ACCOUNT PERMANENTLY
    // ============================================

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

        deletionPromises.push(db.ref('users/' + uid).remove());

        deletionPromises.push(db.ref('posts').orderByChild('userId').equalTo(uid).once('value', function(snapshot) {
            var deletePromises = [];
            snapshot.forEach(function(post) {
                deletePromises.push(db.ref('posts/' + post.key).remove());
            });
            return Promise.all(deletePromises);
        }));

        deletionPromises.push(db.ref('chats').once('value', function(snapshot) {
            var deletePromises = [];
            snapshot.forEach(function(chat) {
                var chatKey = chat.key;
                if (chatKey.includes(uid)) {
                    deletePromises.push(db.ref('chats/' + chatKey).remove());
                }
            });
            return Promise.all(deletePromises);
        }));

        deletionPromises.push(db.ref('stories/' + uid).remove());

        Promise.all(deletionPromises).then(function() {
            self.toast('Data deleted successfully. Removing account...', 'success');

            setTimeout(function() {
                auth.currentUser.delete().then(function() {
                    self.toast('Account permanently deleted', 'success');
                    auth.signOut();
                    self.showAuth();
                    setTimeout(function() {
                        self.toast('Your account has been completely removed', 'success');
                    }, 500);
                }).catch(function(err) {
                    if (err.code === 'auth/requires-recent-login') {
                        self.toast('Please log in again before deleting your account', 'error');
                        auth.signOut();
                        self.showAuth();
                    } else {
                        self.toast('Error: ' + err.message, 'error');
                    }
                });
            }, 1000);
        }).catch(function(err) {
            self.toast('Error deleting data: ' + err.message, 'error');
        });
    },

    // ============================================
    // REQUIRED AUTH
    // ============================================

    requireAuth: function(action) {
        if (this.isGuest || !this.user) {
            this.toast('🔐 Sign up to ' + (action || 'access this'), 'info');
            // Show friendly guest modal instead of forcing the login page
            this.showGuestModal(action || 'access this');
            return false;
        }
        return true;
    },

    // ============================================
    // LOAD GROUPS
    // ============================================

    loadGroups: function() {
        this.renderEarn();
    },

    // ============================================
    // SETUP TYPING CLEANUP
    // ============================================

    setupTypingCleanup: function() {
        if (!this.user) return;
        var userTypingRef = db.ref('.info/connected');
        userTypingRef.on('value', function(snapshot) {
            if (snapshot.val() === false) {
                console.log('⚠️ User going offline');
            }
        });
    },

    // ============================================
    // CALCULATE TRENDING HASHTAGS
    // ============================================

    calculateTrendingHashtags: function() {
        var hashtagCount = {};
        var now = new Date();
        var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        this.posts.forEach(function(post) {
            var postDate = new Date(post.timestamp || post.createdAt);
            if (postDate >= weekAgo) {
                if (post.hashtags) {
                    post.hashtags.forEach(function(tag) {
                        hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
                    });
                }
            }
        });

        this.trendingHashtags = Object.keys(hashtagCount)
            .map(function(tag) {
                return {
                    name: tag,
                    count: hashtagCount[tag],
                    posts: this.posts.filter(function(p) { return p.hashtags && p.hashtags.includes(tag); }).length
                };
            }.bind(this))
            .sort(function(a, b) { return b.count - a.count; })
            .slice(0, 15);
    },

    // ============================================
    // LOAD EXPLORE
    // ============================================

    loadExplore: function() {
        var self = this;

        if (!this.users || Object.keys(this.users).length === 0) {
            db.ref('users').once('value', function(snapshot) {
                self.users = snapshot.val() || {};
            });
        }

        setTimeout(function() {
            self.renderTrendingHashtagsExplore();
            self.renderTrendingPosts();
            // Load people to follow
            if (typeof app.loadExplorePeople === 'function') app.loadExplorePeople();
            self.calculateTrendingHashtags();
        }, 100);
    },

    // ============================================
    // RENDER TRENDING HASHTAGS IN EXPLORE
    // ============================================

    renderTrendingHashtagsExplore: function() {
        var container = document.getElementById('trendingHashtagsContainer');
        if (!container) return;

        if (this.trendingHashtags.length === 0) {
            this.calculateTrendingHashtags();
            if (this.trendingHashtags.length === 0) {
                if (this.isGuest) {
                    container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">\n                        <div style="font-size:28px;margin-bottom:6px;">🔥</div>\n                        <div style="font-weight:700;margin-bottom:6px;">Sign in to see trending hashtags</div>\n                        <div style="color:#9ca3af;margin-bottom:10px;">Sign up or log in to see what people are talking about.</div>\n                        <button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;">🔐 Sign In / Sign Up</button>\n                    </div>';
                    return;
                }
                container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">No trending hashtags yet</div>';
                return;
            }
        }

        var html = '';
        this.trendingHashtags.slice(0, 6).forEach(function(trend, index) {
            html += `
                <div style="background: white; border-radius: 12px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); cursor: pointer; transition: 0.3s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; this.style.background='#f8fafc'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.background='white'">
                    <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px; font-size: 14px;">${trend.name}</div>
                    <div style="font-size: 12px; color: #6b7280;">${trend.posts} posts</div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // ============================================
    // TRENDING POSTS
    // ============================================

    renderTrendingPosts: function() {
        var self = this;
        var container = document.getElementById('trendingPostsContainer');
        if (!container) return;

        var trendingPosts = (this.posts || [])
            .sort(function(a, b) {
                var aLikes = (a.likes && Object.keys(a.likes).length) || 0;
                var bLikes = (b.likes && Object.keys(b.likes).length) || 0;
                return bLikes - aLikes;
            })
            .slice(0, 9);

        if (trendingPosts.length === 0) {
            if (this.isGuest) {
                container.innerHTML = '<div style="text-align:center;color:#6b7280;padding:40px 16px;">\n                    <div style="font-size:28px;margin-bottom:8px;">📱</div>\n                    <div style="font-weight:700;margin-bottom:6px;">Sign in to explore popular posts</div>\n                    <div style="color:#9ca3af;margin-bottom:12px;">Create an account to like, comment and follow creators.</div>\n                    <button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;">🔐 Sign In / Sign Up</button>\n                </div>';
                return;
            }
            container.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 60px 20px; grid-column: 1/-1;">No posts yet. Create one!</div>';
            return;
        }

        var html = '';
        trendingPosts.forEach(function(post) {
            var likes = (post.likes && Object.keys(post.likes).length) || 0;
            var comments = (post.comments && post.comments.length) || 0;

            html += `
                <div style="position: relative; aspect-ratio: 1/1; background: #f0f0f0; cursor: pointer; overflow: hidden;" onclick="app.viewPostDetail('${post.id}')">
                    <img src="${post.photoUrl}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0); display: flex; align-items: center; justify-content: center; gap: 16px; transition: all 0.3s ease; opacity: 0;" onmouseover="this.style.background='rgba(0,0,0,0.6)'; this.style.opacity='1';" onmouseout="this.style.background='rgba(0,0,0,0)'; this.style.opacity='0';">
                        <div style="color: white; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px;">❤️ ${likes}</div>
                        <div style="color: white; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px;">💬 ${comments}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // ============================================
    // FOLLOW USER
    // ============================================

    followUser: function(uid, name) {
        if (!this.user || this.isGuest) {
            this.toast('🔐 Sign up to follow users', 'info');
            this.showLoginPage();
            return;
        }

        var self = this;

        if (!this.following) this.following = {};

        if (this.following[uid]) {
            delete this.following[uid];
            this.toast('✓ Unfollowed ' + name, 'info');
        } else {
            this.following[uid] = true;
            this.toast('✓ Followed ' + name, 'success');
        }

        db.ref('users/' + this.user.uid + '/following').set(this.following);

        db.ref('users/' + uid + '/followers').once('value', function(snapshot) {
            var count = snapshot.val() || 0;
            var isFollowing = self.following && self.following[uid];
            var newCount = isFollowing ? count + 1 : Math.max(0, count - 1);
            db.ref('users/' + uid + '/followers').set(newCount);
            if (isFollowing) self.sendPushNotification(uid, (self.profile.name || 'Someone') + ' followed you', 'You have a new follower on CHICHI.');
            if (isFollowing && self.isAirtimeRewardAdmin(uid)) self.claimAirtimeReward('followAdmin');
            if (self.users[uid]) self.users[uid].followers = newCount;
            if (self.currentView === 'profile') self.renderProfile();
            if (self.currentView === 'explore') self.loadExplorePeople();
        });

        setTimeout(function() { self.renderFeaturedUsers(); self.renderTopCreators(); }, 300);
    },

    renderFeaturedUsers: function() {},
    renderTopCreators: function() {},

    // ============================================
    // LOAD STORIES
    // ============================================

    loadStories: function() {
        if (!this.user || this.isGuest) return;

        var self = this;
        var html = '';
        html += '<div class="story-item" onclick="app.showCreateStoryModal()"><div class="create-story-avatar">➕</div><div class="create-story-name">My Story</div></div>';

        db.ref('stories').once('value', function(snapshot) {
            var allStories = [];
            if (snapshot.val()) {
                Object.keys(snapshot.val()).forEach(function(userId) {
                    var userStories = snapshot.val()[userId];
                    if (userStories && typeof userStories === 'object') {
                        Object.keys(userStories).forEach(function(storyId) {
                            var story = userStories[storyId];
                            if (story && story.image) {
                                allStories.push({
                                    id: storyId,
                                    userId: userId,
                                    userName: story.userName || story.authorName || 'User',
                                    image: story.image,
                                    musicName: story.musicName || 'No music',
                                    caption: story.caption || '',
                                    createdAt: story.createdAt,
                                    userPhoto: story.userPhoto || ''
                                });
                            }
                        });
                    }
                });
            }

            allStories.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
            var seenUsers = {};
            var uniqueStories = [];
            allStories.forEach(function(story) {
                if (story && story.userId && !seenUsers[story.userId]) {
                    seenUsers[story.userId] = true;
                    uniqueStories.push(story);
                }
            });

            uniqueStories.slice(0, 8).forEach(function(story) {
                var firstLetter = (story.userName || 'U').charAt(0).toUpperCase();
                var storyPhotoStyle = story.userPhoto ? 'background-image: url(\'' + story.userPhoto + '\');' : '';
                html += '<div class="story-item" onclick="app.viewStory(\'' + story.id + '\', \'' + story.userId + '\')" title="' + story.userName + '"><div class="story-avatar" style="' + storyPhotoStyle + '">' + (story.userPhoto ? '' : firstLetter) + '</div><div class="story-name">' + story.userName + '</div></div>';
            });

            var storiesList = document.getElementById('storiesList');
            if (storiesList) {
                storiesList.innerHTML = html;
            }
        });
    },

    // ============================================
    // SHOW CREATE STORY MODAL
    // ============================================

    showCreateStoryModal: function() {
        var existing = document.getElementById('storyModalOverlay');
        if (existing) existing.remove();

        var html = '<div class="story-modal-overlay" id="storyModalOverlay"><div class="story-modal"><div class="story-modal-header"><h2>📖 Create Story</h2><button class="story-modal-close" onclick="document.getElementById(\'storyModalOverlay\').remove()">✕</button></div><div class="story-modal-content"><div class="story-form-group"><label class="story-form-label">Story Images (Select multiple) *</label><input type="file" id="storyImageInput" accept="image/*" multiple class="story-file-input"><div style="font-size:12px;color:#6b7280;margin-top:4px;">You can select multiple images at once</div></div><div class="story-form-group"><label class="story-form-label">🎵 Music Name</label><input type="text" id="storyMusicNameInput" placeholder="e.g., Jazz Background" class="story-form-input"></div><div class="story-form-group"><label class="story-form-label">Caption</label><textarea id="storyCaptionInput" placeholder="Add a caption..." class="story-form-textarea"></textarea></div></div><div class="story-modal-footer"><button class="story-btn-cancel" onclick="document.getElementById(\'storyModalOverlay\').remove()">Cancel</button><button class="story-btn-upload" id="storyUploadBtn" onclick="app.uploadStory()"><span class="story-btn-text">📤 Upload Stories</span><div class="story-spinner"></div></button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('storyModalOverlay').classList.add('active');
        document.getElementById('storyModalOverlay').addEventListener('click', function(e) {
            if (e.target === this) { this.remove(); }
        });
    },

    // ============================================
    // UPLOAD STORY
    // ============================================

    uploadStory: function() {
        var self = this;
        var imageInput = document.getElementById('storyImageInput');
        var musicNameInput = document.getElementById('storyMusicNameInput');
        var captionInput = document.getElementById('storyCaptionInput');
        var uploadBtn = document.getElementById('storyUploadBtn');

        if (!imageInput || !imageInput.files || imageInput.files.length === 0) {
            this.toast('⚠️ Please select at least one image', 'error');
            return;
        }
        if (!this.user || !this.user.uid) {
            this.toast('⚠️ Please login first', 'error');
            return;
        }

        if (uploadBtn) uploadBtn.classList.add('loading');
        this.toast('📤 Uploading stories...', 'info');

        var files = imageInput.files;
        var uploadPromises = [];
        for (var i = 0; i < files.length; i++) {
            var promise = new Promise(function(resolve, reject) {
                var formData = new FormData();
                formData.append('file', files[i]);
                formData.append('upload_preset', UPLOAD_PRESET || 'chichi_photos');
                fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.secure_url) { resolve(data.secure_url); }
                    else { reject(new Error('No image URL returned')); }
                })
                .catch(reject);
            });
            uploadPromises.push(promise);
        }

        Promise.all(uploadPromises).then(function(imageUrls) {
            var musicName = musicNameInput ? musicNameInput.value.trim() : 'Audio';
            var caption = captionInput ? captionInput.value.trim() : '';
            var savePromises = [];
            imageUrls.forEach(function(imageUrl, index) {
                var storyId = 'story_' + Date.now() + '_' + index;
                var storyData = {
                    image: imageUrl,
                    musicUrl: '',
                    musicName: musicName || 'Audio',
                    caption: caption || '',
                    createdAt: new Date().getTime() + index,
                    views: 0,
                    authorUid: self.user.uid,
                    authorName: self.user.displayName || 'Anonymous',
                    userName: self.profile ? (self.profile.name || 'User') : 'User',
                    userPhoto: self.profile ? (self.profile.profilePhoto || '') : ''
                };
                savePromises.push(db.ref('stories/' + self.user.uid + '/' + storyId).set(storyData));
            });
            return Promise.all(savePromises);
        }).then(function() {
            self.toast('✅ Stories uploaded successfully!', 'success');
            self.logUserActivity('story_upload', 'Uploaded stories');
            setTimeout(function() {
                var modal = document.getElementById('storyModalOverlay');
                if (modal) modal.remove();
                self.loadStories();
            }, 500);
        }).catch(function(err) {
            console.error('Upload error:', err);
            self.toast('❌ Upload failed: ' + err.message, 'error');
            if (uploadBtn) uploadBtn.classList.remove('loading');
        });
    },

    // ============================================
    // VIEW STORY
    // ============================================

    viewStory: function(storyId, userId) {
        userId = userId || this.user.uid;
        var self = this;
        var isOwnStory = this.user && userId === this.user.uid;

        db.ref('stories/' + userId + '/' + storyId).once('value', function(snapshot) {
            var story = snapshot.val();
            if (!story) {
                self.toast('Story not found', 'error');
                return;
            }

            var viewer = document.createElement('div');
            viewer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;animation:smoothFadeIn 0.3s ease;';

            var deleteBtn = isOwnStory ? '<button onclick="event.stopPropagation(); app.deleteStory(\'' + storyId + '\', \'' + userId + '\')" style="position:absolute;top:70px;right:16px;z-index:10;background:rgba(239,68,68,0.9);color:white;border:none;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">🗑️</button>' : '';

            viewer.innerHTML = '<div style="position:absolute;top:16px;left:16px;right:16px;z-index:10;display:flex;gap:4px;"><div style="flex:1;height:3px;background:rgba(255,255,255,0.2);border-radius:2px;overflow:hidden;"><div id="storyProgressBar" style="height:100%;width:0%;background:white;border-radius:2px;transition:width 0.1s linear;"></div></div></div><div style="position:absolute;top:24px;left:16px;right:16px;z-index:10;display:flex;align-items:center;gap:12px;"><div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;overflow:hidden;border:2px solid rgba(255,255,255,0.3);">' + (story.userPhoto ? '<img src="' + story.userPhoto + '" style="width:100%;height:100%;object-fit:cover;">' : (story.userName || 'U').charAt(0).toUpperCase()) + '</div><div><div style="color:white;font-weight:600;font-size:14px;">' + (story.userName || 'User') + '</div><div style="color:rgba(255,255,255,0.6);font-size:11px;">' + (story.musicName || 'No music') + '</div></div></div>' + deleteBtn + '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px;width:100%;"><img src="' + story.image + '" style="max-width:100%;max-height:70vh;border-radius:12px;object-fit:contain;box-shadow:0 8px 32px rgba(0,0,0,0.5);"></div>' + (story.caption ? '<div style="position:absolute;bottom:80px;left:16px;right:16px;z-index:10;color:white;text-align:center;font-size:14px;background:rgba(0,0,0,0.4);padding:12px 16px;border-radius:12px;">' + story.caption + '</div>' : '') + '<div style="position:absolute;bottom:30px;left:0;right:0;z-index:10;text-align:center;color:rgba(255,255,255,0.4);font-size:12px;">Tap to close</div>';

            document.body.appendChild(viewer);

            var progressBar = document.getElementById('storyProgressBar');
            var startTime = Date.now();
            var duration = 10000;
            var progressInterval = setInterval(function() {
                var elapsed = Date.now() - startTime;
                var progress = Math.min((elapsed / duration) * 100, 100);
                if (progressBar) { progressBar.style.width = progress + '%'; }
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    viewer.remove();
                    self.toast('Story viewed 📖', 'info');
                }
            }, 50);

            viewer.addEventListener('click', function(e) {
                if (e.target.tagName === 'IMG' || e.target.tagName === 'BUTTON') { return; }
                clearInterval(progressInterval);
                viewer.remove();
            });
        });
    },

    deleteStory: function(storyId, userId) {
        if (!confirm('Delete this story?')) return;
        var self = this;
        db.ref('stories/' + userId + '/' + storyId).remove().then(function() {
            self.toast('✅ Story deleted', 'success');
            self.loadStories();
        }).catch(function(err) {
            self.toast('❌ Error deleting story: ' + err.message, 'error');
        });
    },

    // ============================================
    // SHOW MANDATORY HASHTAG SELECTION
    // ============================================

    showMandatoryHashtagSelection: function() {
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
            htmlOptions += '<div style="margin-bottom:12px;"><div style="font-weight:600;margin-bottom:8px;font-size:13px;color:#1a202c;">' + category + '</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
            hashtagCategories[category].forEach(function(tag) {
                htmlOptions += '<label style="display:inline-flex;align-items:center;padding:4px 10px;background:#f9fafb;border:2px solid #e5e7eb;border-radius:20px;cursor:pointer;transition:0.2s;font-size:12px;" onmouseover="this.style.borderColor=\'#0088cc\';this.style.background=\'rgba(0,136,204,0.05)\'" onmouseout="if(!this.querySelector(\'input\').checked){this.style.borderColor=\'#e5e7eb\';this.style.background=\'#f9fafb\'}"><input type="checkbox" class="hashtag-checkbox" value="' + tag + '" style="width:14px;height:14px;cursor:pointer;margin-right:5px;accent-color:#0088cc;" onchange="this.parentElement.style.borderColor=this.checked ? \'#0088cc\' : \'#e5e7eb\'; this.parentElement.style.background=this.checked ? \'rgba(0,136,204,0.1)\' : \'#f9fafb\'"><span style="font-size:11px;color:#1a202c;">' + tag + '</span></label>';
            });
            htmlOptions += '</div></div>';
        }

        var modalHTML = '<div class="modal-overlay" id="mandatoryHashtagModal" style="display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(4px);"><div style="background:white;border-radius:24px;max-width:480px;width:92%;max-height:80vh;overflow-y:auto;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:smoothFadeIn 0.3s ease;"><div style="text-align:center;margin-bottom:16px;"><div style="font-size:36px;margin-bottom:4px;">🏷️</div><h2 style="margin-bottom:2px;font-weight:700;color:#1a202c;font-size:20px;">Choose Your Interests</h2><p style="color:#6b7280;font-size:13px;margin-bottom:4px;">Select at least <strong style="color:#0088cc;">3</strong> topics you care about</p><p style="color:#ef4444;font-size:11px;font-weight:600;min-height:18px;" id="hashtagError"></p></div><div style="margin-bottom:16px;max-height:50vh;overflow-y:auto;padding-right:4px;">' + htmlOptions + '</div><div style="display:flex;gap:10px;border-top:1px solid #e5e7eb;padding-top:14px;"><button onclick="app.saveMandatoryHashtags()" id="saveHashtagBtn" style="flex:1;padding:12px;background:linear-gradient(135deg,#0088cc,#006fa3);color:white;border:none;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer;transition:0.3s;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">✅ Save & Continue</button></div></div></div>';

        var existing = document.getElementById('mandatoryHashtagModal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    saveMandatoryHashtags: function() {
        var checkboxes = document.querySelectorAll('#mandatoryHashtagModal .hashtag-checkbox:checked');
        var selected = [];
        checkboxes.forEach(function(cb) { selected.push(cb.value); });
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

        var self = this;
        var uid = this.user ? this.user.uid : null;
        if (!uid) {
            this.toast('User not found. Please login again.', 'error');
            return;
        }

        var btn = document.getElementById('saveHashtagBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

        db.ref('users/' + uid + '/hashtags').set(selected).then(function() {
            self.profile.interests = selected;
            self.profile.hashtags = selected;
            self.toast('✅ Interests saved!', 'success');
            var modal = document.getElementById('mandatoryHashtagModal');
            if (modal) modal.remove();
            setTimeout(function() {
                self.switchView('explore');
                self.loadExplore();
            }, 500);
        }).catch(function(err) {
            self.toast('❌ Error saving interests: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = '✅ Save & Continue'; }
        });
    },

    // ============================================
    // LOAD SIGNUP HEATMAP
    // ============================================

    loadSignupHeatmap: function() {
        var mapContainer = document.getElementById('signupMapContainer');
        if (!mapContainer) { return; }

        mapContainer.innerHTML = '<div id="leafletMap" style="width:100%;height:100%;"></div><div id="heatmapDots" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;"></div>';

        if (typeof L !== 'undefined') {
            var map = L.map('leafletMap', {
                zoomControl: false, attributionControl: false,
                scrollWheelZoom: false, doubleClickZoom: false,
                dragging: false, touchZoom: false, boxZoom: false, keyboard: false
            }).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '', subdomains: 'abcd', maxZoom: 2, minZoom: 2, noWrap: true
            }).addTo(map);
            map.setZoom(2);
            this.heatmapMap = map;
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
        var now = new Date().getTime();
        var fiveMinutesAgo = now - (5 * 60 * 1000);

        for (var uid in this.users) {
            var user = this.users[uid];
            if (user && user.lastSeen) {
                var lastSeen = user.lastSeen;
                if (typeof lastSeen === 'string') { lastSeen = new Date(lastSeen).getTime(); }
                if (lastSeen && lastSeen > fiveMinutesAgo) { onlineCount++; }
            }
        }

        var totalElement = document.getElementById('totalSignups');
        if (totalElement) { this.animateNumber(totalElement, totalUsers); }
        var onlineElement = document.getElementById('onlineCount');
        if (onlineElement) { this.animateNumber(onlineElement, onlineCount); }
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
        var dotsContainer = document.getElementById('heatmapDots');
        if (!dotsContainer || !this.users) return;

        var usersArray = Object.keys(this.users).map(function(uid) { return { uid: uid, user: this.users[uid] }; }.bind(this));
        if (usersArray.length === 0) { dotsContainer.innerHTML = ''; return; }

        var html = '';
        var totalUsers = usersArray.length;
        var dotSize = Math.min(4 + (totalUsers / 200), 8);
        var locations = [
            { lat: -1.286389, lng: 36.817223 }, { lat: -4.043477, lng: 39.668206 },
            { lat: 0.313611, lng: 32.581111 }, { lat: -1.9441, lng: 30.0619 },
            { lat: -3.361378, lng: 36.674448 }, { lat: -0.091702, lng: 34.767956 },
            { lat: -0.2861, lng: 36.0711 }, { lat: -1.3216, lng: 36.8831 },
            { lat: -0.4667, lng: 35.2833 }, { lat: 0.0494, lng: 34.7486 },
            { lat: -0.4861, lng: 35.2972 }, { lat: -2.2698, lng: 37.8020 }
        ];

        usersArray.forEach(function(u, index) {
            var loc = locations[index % locations.length];
            var baseLat = loc.lat + (Math.random() - 0.5) * 1.5;
            var baseLng = loc.lng + (Math.random() - 0.5) * 1.5;
            var dotColor = 'rgba(0,136,204,0.7)';
            if (u.user && u.user.online) { dotColor = 'rgba(0,212,170,0.9)'; }
            html += '<div style="position:absolute;width:' + dotSize + 'px;height:' + dotSize + 'px;background:' + dotColor + ';border-radius:50%;left:' + (50 + (baseLng / 30)) + '%;top:' + (50 - (baseLat / 15)) + '%;box-shadow:0 0 ' + (dotSize * 2) + 'px ' + dotColor + ';transition:all 0.5s ease;animation:pulse 2s infinite;" title="' + (u.user ? u.user.name : 'User') + '"></div>';
        });
        dotsContainer.innerHTML = html;
    },

    setupHeatmapListener: function() {
        db.ref('users').on('value', function(snapshot) {
            this.users = {};
            snapshot.forEach(function(child) {
                this.users[child.key] = child.val();
            }.bind(this));
            this.updateHeatmapStats();
            this.renderHeatmapDots();
        }.bind(this));
    },

    // ============================================
    // OPEN CHAT FROM SEARCH
    // ============================================

    openChatFromSearch: function(uid, name) {
        this.openChat(uid, name);
    },

    // ============================================
    // SHOW TRANSACTION HISTORY
    // ============================================

    showTransactionHistory: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'transactionHistoryModal';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 28px; max-width: 500px; width: 95%; animation: slideUp 0.3s ease; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15); max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">📋 Transaction History</h2>
                    <button onclick="document.getElementById('transactionHistoryModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;">✕</button>
                </div>

                <div id="transactionsList" style="max-height: 600px; overflow-y: auto;">
                    <div style="text-align: center; color: #94a3b8; padding: 40px 20px;">Loading...</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        db.ref('analytics/revenue').orderByChild('userId').equalTo(this.user.uid).once('value', function(snapshot) {
            var transactions = [];
            snapshot.forEach(function(child) {
                var tx = child.val();
                transactions.push({
                    id: child.key,
                    ...tx
                });
            });

            transactions.reverse();

            var html = '';

            if (transactions.length === 0) {
                html = '<div style="text-align: center; color: #94a3b8; padding: 40px 20px;">No transactions yet</div>';
            } else {
                transactions.forEach(function(tx) {
                    var isEarned = tx.type === 'earned';
                    var icon = isEarned ? '📈' : '🛍️';
                    var color = isEarned ? '#22c55e' : '#ef4444';
                    var sign = isEarned ? '+' : '-';

                    html += `
                        <div style="background: ${isEarned ? '#f0fdf4' : '#fee2e2'}; border-left: 4px solid ${color}; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 12px; align-items: center; flex: 1;">
                                <div style="font-size: 24px;">${icon}</div>
                                <div>
                                    <div style="font-weight: 600; color: #1e293b; font-size: 14px;">${isEarned ? 'Earned' : 'Spent'} ${tx.item || ''}</div>
                                    <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${tx.date || 'N/A'}</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 16px; font-weight: 700; color: ${color};">${sign}${tx.amount.toFixed(2)} Coins</div>
                            </div>
                        </div>
                    `;
                });
            }

            var listContainer = document.getElementById('transactionsList');
            if (listContainer) {
                listContainer.innerHTML = html;
            }
        });
    },

    updateBalanceDisplays: function() {
        var balanceDisplay = document.getElementById('balanceDisplay');
        if (balanceDisplay) {
            balanceDisplay.textContent = this.balance.toFixed(2) + ' Coins';
        }
        var earnBalanceDisplay = document.getElementById('earnBalanceDisplay');
        if (earnBalanceDisplay) {
            earnBalanceDisplay.textContent = this.balance.toFixed(2) + ' Coins';
        }
    },

    // ============================================
    // PREVIEW PHOTO
    // ============================================

    previewPhoto: function(e) {
        var file = e.target.files[0];
        if (file) {
            var preview = document.getElementById('photoPreview');
            preview.textContent = '✓ ' + file.name + ' selected';
            preview.style.display = 'block';
        }
    },

    // ============================================
    // SHOW CREATE MODAL
    // ============================================

    showCreateModal: function() {
        var modal = document.getElementById('createModal');
        if (!modal) {
            this.toast('Error opening post creator', 'error');
            return;
        }
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
        setTimeout(function() {
            var captionInput = document.getElementById('captionInput');
            if (captionInput) captionInput.focus();
        }, 300);
    },

    closeCreateModal: function() {
        var modal = document.getElementById('createModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.getElementById('photoInput').value = '';
        document.getElementById('captionInput').value = '';
        var preview = document.getElementById('photoPreview');
        if (preview) { preview.style.display = 'none'; preview.textContent = ''; }
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

        var formData = new FormData();
        formData.append('file', photoFile);
        formData.append('upload_preset', UPLOAD_PRESET);

        fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', {
            method: 'POST', body: formData
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var self = this;
            db.ref('posts').push({
                userId: self.user.uid,
                userName: self.profile.name || 'User',
                userPhoto: self.profile.profilePhoto || '',
                photoUrl: data.secure_url,
                caption: caption,
                hashtags: hashtags,
                likes: {}, comments: [], commentedUsers: [], downloads: 0,
                createdAt: new Date().toLocaleString('en-KE'),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(function() {
                self.balance += 1;
                db.ref('users/' + self.user.uid + '/balance').set(self.balance);
                self.trackRevenue('earned', 1, 'post_creation');
                self.engagementStats.postsCount = (self.engagementStats.postsCount || 0) + 1;
                self.saveEngagementStats();
                self.toast('Post published', 'success');
                self.logUserActivity('create_post', 'Created a new post');
                if (shareSpinner) shareSpinner.style.display = 'none';
                if (shareText) shareText.style.display = 'inline';
                if (sharePostBtn) sharePostBtn.disabled = false;
                self.closeCreateModal();
                self.switchView('feed');
            });
        }.bind(this)).catch(function(err) {
            this.toast('Upload failed: ' + err.message, 'error');
            if (shareSpinner) shareSpinner.style.display = 'none';
            if (shareText) shareText.style.display = 'inline';
            if (sharePostBtn) sharePostBtn.disabled = false;
        }.bind(this));
    },

    
    // ============================================
    // CLOSE CHAT
    // ============================================

    closeChatView: function() {
        var chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.classList.remove('active');
            chatView.style.display = 'none';
        }
        if (this.currentChat && this.chatMessagesListener) {
            var key = [this.user.uid, this.currentChat.uid].sort().join('_');
            db.ref('chats/' + key + '/messages').off();
            this.chatMessagesListener = null;
        }
        this.currentChat = null;
        this.switchView('messages');
    },

    // ============================================
    // LOAD CHAT MESSAGES
    // ============================================

    loadChatMessages: function() {
        if (!this.currentChat) return;
        var self = this;
        var key = [self.user.uid, self.currentChat.uid].sort().join('_');
        if (!this.chatMessages) this.chatMessages = {};
        if (this.chatMessagesListener) {
            db.ref('chats/' + key + '/messages').off();
        }

        db.ref('chats/' + key + '/messages').once('value').then(function(snapshot) {
            var messages = [];
            snapshot.forEach(function(c) {
                var m = c.val();
                if (m && (m.text || m.image)) { messages.push(m); }
            });
            messages.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
            self.chatMessages[key] = messages;
            self.displayChatMessages(messages, key);

            self.chatMessagesListener = db.ref('chats/' + key + '/messages').on('child_added', function(snap) {
                var m = snap.val();
                if (m && (m.text || m.image) && m.sender !== self.user.uid) {
                    self.markAsRead(self.currentChat.uid);
                    db.ref('chats/' + key + '/messages').once('value').then(function(s) {
                        var updated = [];
                        s.forEach(function(c) {
                            var msg = c.val();
                            if (msg && (msg.text || msg.image)) { updated.push(msg); }
                        });
                        updated.sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
                        self.chatMessages[key] = updated;
                        self.displayChatMessages(updated, key);
                    });
                }
            });
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
                chatMessagesView.innerHTML = '<div style="text-align:center;color:#999;padding:40px 16px;font-size:14px;">No messages yet. Say hello! 👋</div>';
            }
            return;
        }

        var html = '';
        var lastDate = '';
        messages.forEach(function(m, idx) {
            if (!m || (!m.text && !m.image)) return;
            var side = m.sender === self.user.uid ? 'own' : 'other';
            var timestamp = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

            if (idx === 0 || (messages[idx-1] && new Date(messages[idx-1].timestamp).toDateString() !== new Date(m.timestamp).toDateString())) {
                var d = new Date(m.timestamp);
                var today = new Date();
                var yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                var dateStr = 'Today';
                if (d.toDateString() === yesterday.toDateString()) { dateStr = 'Yesterday'; }
                else if (d.toDateString() !== today.toDateString()) { dateStr = d.toLocaleDateString(); }
                if (dateStr !== lastDate) {
                    html += '<div class="message-date-divider">' + dateStr + '</div>';
                    lastDate = dateStr;
                }
            }

            var content = '';
            if (m.image) {
                content += '<img src="' + m.image + '" style="max-width:180px;border-radius:12px;cursor:pointer;" onclick="app.viewFullImage(\'' + m.image + '\')">';
            }
            if (m.text) { content += '<div>' + m.text + '</div>'; }

            var otherUserName = self.currentChat.name || 'User';
            var otherUserInitial = otherUserName.charAt(0).toUpperCase();

            html += '<div class="message-group ' + side + '">';
            if (side === 'other') {
                html += '<div class="message-avatar" style="' + (self.users[self.currentChat.uid] && self.users[self.currentChat.uid].profilePhoto ? 'background-image: url(' + self.users[self.currentChat.uid].profilePhoto + '); background-size: cover; background-position: center;' : '') + '">' + (!self.users[self.currentChat.uid] || !self.users[self.currentChat.uid].profilePhoto ? otherUserInitial : '') + '</div>';
            }
            html += '<div class="message-wrapper">';
            if (side === 'other') { html += '<div class="message-sender">' + otherUserName + '</div>'; }
            html += '<div class="message-bubble">' + content + '</div>';
            html += '<div class="message-meta"><span>' + timestamp + '</span></div>';
            html += '</div></div>';
        });

        var chatMessagesView = document.getElementById('chatMessages');
        if (chatMessagesView) {
            chatMessagesView.innerHTML = html;
            setTimeout(function() { chatMessagesView.scrollTop = chatMessagesView.scrollHeight; }, 50);
            setTimeout(function() { chatMessagesView.scrollTop = chatMessagesView.scrollHeight; }, 150);
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
        if (!text) { if (input) input.focus(); return; }

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
            sender: self.user.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        }).then(function() {
            db.ref('chats/' + key + '/messages/' + messageRef.key).set({
                text: text,
                sender: self.user.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            });
            tempMessage.pending = false;
            self.displayChatMessages(self.chatMessages[key], key);
        }).catch(function(err) {
            self.toast('Error sending message', 'error');
            var idx = self.chatMessages[key].indexOf(tempMessage);
            if (idx > -1) {
                self.chatMessages[key].splice(idx, 1);
                self.displayChatMessages(self.chatMessages[key], key);
            }
        });
    },

    
    viewFullImage: function(imageUrl) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '2000';
        modal.innerHTML = '<div style="position:relative;width:90%;max-width:500px;"><img src="' + imageUrl + '" style="width:100%;border-radius:12px;"><button onclick="this.closest(\'.modal-overlay\').remove()" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);color:white;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1.2rem;font-weight:700;">✕</button></div>';
        document.body.appendChild(modal);
    },

    loadBlockedUsers: function() {
        if (!this.user) return;
        db.ref('users/' + this.user.uid + '/blocked').once('value', function(snapshot) {
            if (snapshot.val()) {
                Object.keys(snapshot.val()).forEach(function(userId) {
                    this.blockedUsers[userId] = true;
                }.bind(this));
            }
        }.bind(this));
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

    // ============================================
    // SHOW ABOUT
    // ============================================

    showAbout: function() {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML = `
            <div class="modal" style="max-width:420px;border-radius:20px;padding:24px;max-height:90vh;overflow-y:auto;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;">✕</button></div>

                <div style="text-align:center;padding:4px 0;">
                    <div style="width:100px;height:100px;border-radius:50%;margin:0 auto 12px;overflow:hidden;border:3px solid #0088cc;box-shadow:0 4px 16px rgba(0,136,204,0.3);">
                        <img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1784291624/1768467745366_1_lu01jr.jpg" alt="Anthony Onchari" style="width:100%;height:100%;object-fit:cover;">
                    </div>

                    <h2 style="margin-bottom:2px;font-weight:800;font-size:22px;color:#1a202c;">Anthony Onchari</h2>
                    <p style="color:#0088cc;font-size:13px;font-weight:600;margin-bottom:4px;">👨‍💻 Developer & Digital Media Specialist</p>
                    <p style="color:#6b7280;font-size:11px;background:#f0f0f0;display:inline-block;padding:2px 12px;border-radius:12px;margin-bottom:16px;">
                        📱 Version V02A.01
                    </p>

                    <div style="background:#f7fafc;padding:16px 18px;border-radius:16px;text-align:left;border:1px solid #e2e8f0;margin-bottom:16px;">
                        <p style="font-size:14px;line-height:1.8;color:#2d3748;margin:0;">
                            Hey there! 👋 I'm <strong style="color:#0088cc;">Anthony</strong>,
                            a Developer and Digital Media Specialist who loves building things that bring people and community together.
                            I created <strong style="color:#0088cc;">CHICHI</strong> because I believe
                            social media should feel like home — warm, real, and human.
                        </p>
                        <p style="font-size:13px;line-height:1.7;color:#4a5568;margin-top:10px;border-top:1px solid #e2e8f0;padding-top:10px;">
                            This is <strong>Version V02A.01</strong> — the beginning of something beautiful.
                            More features, more love, and more connection coming soon!
                        </p>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
                        <div style="background:#ebf8ff;padding:10px 6px;border-radius:12px;">
                            <div style="font-size:20px;">💻</div>
                            <div style="font-size:11px;color:#2b6cb0;font-weight:600;">Web Developer</div>
                        </div>
                        <div style="background:#f0fff4;padding:10px 6px;border-radius:12px;">
                            <div style="font-size:20px;">📱</div>
                            <div style="font-size:11px;color:#276749;font-weight:600;">Digital Media</div>
                        </div>
                        <div style="background:#faf5ff;padding:10px 6px;border-radius:12px;">
                            <div style="font-size:20px;">🤝</div>
                            <div style="font-size:11px;color:#6b46c1;font-weight:600;">Community Builder</div>
                        </div>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                        <button onclick="window.open('https://wa.me/254701807001', '_blank')" style="padding:10px 18px;background:#25D366;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:0.3s;display:flex;align-items:center;gap:6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            💬 WhatsApp
                        </button>
                        <button onclick="window.open('https://www.facebook.com/profile.php?id=100088002065441', '_blank')" style="padding:10px 18px;background:#1877F2;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:0.3s;display:flex;align-items:center;gap:6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            📘 Facebook
                        </button>
                        <button onclick="window.open('https://www.linkedin.com/in/anthony-onchari-a3b87b270/', '_blank')" style="padding:10px 18px;background:#0A66C2;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:0.3s;display:flex;align-items:center;gap:6px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            💼 LinkedIn
                        </button>
                    </div>

                    <div style="margin-top:14px;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0;padding-top:12px;">
                        <span>© 2026 Onchari Group • CHICHI V02A.01</span>
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
    // SHOW HEADER MENU
    // ============================================

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

    // ============================================
    // PROFILE PHOTO MODAL FUNCTIONS (Legacy)
    // ============================================

    showProfilePhotoModalLegacy: function() {
        this.showProfilePhotoModal();
    },

    // ============================================
    // HANDLE LOGIN
    // ============================================

    handleLogin: function(e) {
        e.preventDefault();
        var loginInput = document.getElementById('loginEmail').value;
        var pass = document.getElementById('loginPassword').value;
        var loginBtn = document.getElementById('loginBtn');
        var loginSpinner = document.querySelector('.login-spinner');
        var loginText = document.querySelector('.login-btn-text');

        if (!loginInput || !pass) {
            this.toast('Username/Email and password required', 'error');
            return;
        }

        if (loginSpinner) loginSpinner.style.display = 'inline';
        if (loginText) loginText.style.display = 'none';
        if (loginBtn) loginBtn.disabled = true;

        var self = this;

        if (loginInput.includes('@')) {
            self._performLogin(loginInput, pass, loginBtn, loginSpinner, loginText);
        } else {
            db.ref('users').orderByChild('username').equalTo(loginInput).once('value')
                .then(function(snapshot) {
                    if (snapshot.exists()) {
                        var userObj = snapshot.val();
                        var uid = Object.keys(userObj)[0];
                        var userEmail = userObj[uid].email;
                        self._performLogin(userEmail, pass, loginBtn, loginSpinner, loginText);
                    } else {
                        if (loginSpinner) loginSpinner.style.display = 'none';
                        if (loginText) loginText.style.display = 'inline';
                        if (loginBtn) loginBtn.disabled = false;
                        self.toast('User not found', 'error');
                    }
                })
                .catch(function(err) {
                    if (loginSpinner) loginSpinner.style.display = 'none';
                    if (loginText) loginText.style.display = 'inline';
                    if (loginBtn) loginBtn.disabled = false;
                    console.error('Username lookup error:', err);
                    self.toast('Error finding user', 'error');
                });
        }
    },

    _performLogin: function(email, password, loginBtn, loginSpinner, loginText) {
        var self = this;
        auth.signInWithEmailAndPassword(email, password)
            .then(function(result) {
                self.toast('✅ Login successful!', 'success');
                self.logUserActivity('login_success', 'User logged in: ' + email);
            })
            .catch(function(err) {
                if (loginSpinner) loginSpinner.style.display = 'none';
                if (loginText) loginText.style.display = 'inline';
                if (loginBtn) loginBtn.disabled = false;
                self.toast('❌ ' + err.message, 'error');
                self.logUserActivity('login_failed', 'Failed login attempt: ' + email + ' - ' + err.message);
            });
    },


    handleSignup: function(e) {
        e.preventDefault();
        var name = document.getElementById('signupName').value;
        var username = document.getElementById('signupUsername').value;
        var email = document.getElementById('signupEmail').value;
        var pass = document.getElementById('signupPassword').value;
        var signupBtn = document.getElementById('signupBtn');
        var signupSpinner = document.querySelector('.signup-spinner');
        var signupText = document.querySelector('.signup-btn-text');

        if (pass.length < 6) {
            this.toast('Password must be 6+ characters', 'error');
            return;
        }
        if (!username || username.length < 3) {
            this.toast('Username must be at least 3 characters', 'error');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.toast('Username can only contain letters, numbers, and underscores', 'error');
            return;
        }

        if (signupSpinner) signupSpinner.style.display = 'inline';
        if (signupText) signupText.style.display = 'none';
        if (signupBtn) signupBtn.disabled = true;

        var self = this;
        auth.createUserWithEmailAndPassword(email, pass)
            .then(function(r) {
                var userData = {
                    name: name,
                    username: username,
                    email: email,
                    bio: '',
                    profilePhoto: '',
                    balance: 0,
                    followers: 0,
                    following: 0,
                    hashtags: [],
                    interests: [],
                    triviaAnswered: [],
                    tier: 'free',
                    createdAt: new Date().toLocaleString('en-KE'),
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                };
                return db.ref('users/' + r.user.uid).set(userData);
            })
            .then(function() {
                self.toast('Account created! Please select your interests', 'success');
                self.logUserActivity('signup', 'New user signed up: ' + email);
                setTimeout(function() {
                    if (self.showMandatoryHashtagSelection) {
                        self.showMandatoryHashtagSelection();
                    }
                }, 500);
                if (signupSpinner) signupSpinner.style.display = 'none';
                if (signupText) signupText.style.display = 'inline';
                if (signupBtn) signupBtn.disabled = false;
            })
            .catch(function(err) {
                if (signupSpinner) signupSpinner.style.display = 'none';
                if (signupText) signupText.style.display = 'inline';
                if (signupBtn) signupBtn.disabled = false;
                console.error('Signup error:', err);
                self.toast(err.message, 'error');
            });
    },

    // ============== EDITED: Google Sign-In (Native bridge + fallback) ==============
    signInWithGoogle: function() {
    // First, try to call the native Android bridge (if available)
    if (window.Android && typeof window.Android.signInWithGoogle === 'function') {
        console.log('📱 Using native Google Sign-In');
        window.Android.signInWithGoogle();
        return;
    }
    // Fallback: use redirect (works in browsers, sometimes in WebView)
    console.log('⚠️ Native bridge not available, using redirect fallback');
    var self = this;
    var provider = new firebase.auth.GoogleAuthProvider();
    
    // ✅ ADD THESE TWO LINES:
    provider.addScope('email');
    provider.addScope('profile');
    
    // ✅ CHANGE THESE PARAMETERS:
    provider.setCustomParameters({
        'prompt': 'select_account',
        'include_granted_scopes': 'true'
    });
    auth.signInWithRedirect(provider);
},

    // ============== NEW: Called from native Android after successful sign-in ==============
    onNativeSignIn: function(userData) {
        console.log('✅ Native sign-in success:', userData);
        // The userData is a JSON object with uid, email, displayName, photoURL, idToken, etc.
        // The Firebase auth state listener will already be triggered because the native sign-in
        // also signs in to Firebase. However, we can manually update the app state if needed.
        // Since the onAuthStateChanged listener handles everything, we can leave it as is.
        // But if the listener doesn't fire immediately, we can force a reload or call our own logic.
        // For safety, reload the user data from Firebase.
        if (userData && userData.uid) {
            // The onAuthStateChanged will catch this, but we can also manually trigger the profile load.
            this.user = userData;
            this.isGuest = false;
            // Optionally reload profile
            this.loadProfile();
        }
    },

    // ============== NEW: Called from native Android if sign-in fails ==============
    googleSignInFailed: function(error) {
        console.error('❌ Native sign-in failed:', error);
        this.toast('Google sign-in failed: ' + (error || 'Unknown error'), 'error');
        // Reset any loading states
        var signupBtn = document.getElementById('signupBtn');
        var signupSpinner = document.querySelector('.signup-spinner');
        var signupText = document.querySelector('.signup-btn-text');
        if (signupSpinner) signupSpinner.style.display = 'none';
        if (signupText) signupText.style.display = 'inline';
        if (signupBtn) signupBtn.disabled = false;
    },

    // ============== Handle redirect result (fallback) ==============
    handleRedirectResult: function() {
        var self = this;
        auth.getRedirectResult().then(function(result) {
            if (result.user) {
                console.log('✅ Google redirect sign-in successful:', result.user);
                // The onAuthStateChanged listener will handle the rest
            }
        }).catch(function(error) {
            console.error('❌ Google redirect sign-in error:', error);
            self.toast('Google sign-in failed: ' + error.message, 'error');
        });
    },

    showCustomizeUsernameModal: function() {
        var self = this;
        var currentUsername = this.profile.username || '';
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'customizeUsernameModal';
        modal.style.zIndex = '10000';
        modal.style.backdropFilter = 'blur(8px)';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 32px 28px; max-width: 440px; width: 95%; text-align: center; animation: slideUp 0.4s ease; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);">
                <div style="font-size: 40px; margin-bottom: 16px;">🎉</div>
                <h2 style="font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;">Customize Your Username</h2>
                <p style="font-size: 14px; color: #64748b; margin: 0 0 24px 0; line-height: 1.6;">You can change your auto-generated username to something you prefer.</p>

                <div style="margin-bottom: 20px;">
                    <input type="text" id="customizeUsername" placeholder="e.g. brenda_abich" maxlength="30" value="${currentUsername}" style="width: 100%; padding: 13px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 14px; font-family: inherit; box-sizing: border-box; transition: 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'" onkeyup="document.getElementById('customizeUsernameHint').textContent = '@' + this.value">
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 8px; text-align: left;">
                        Your username: <span id="customizeUsernameHint" style="color: #3b82f6; font-weight: 600;">@${currentUsername}</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; text-align: left;">
                        Use letters, numbers, and underscores only. Min 3 characters.
                    </div>
                </div>

                <button onclick="app.saveCustomizedUsername()" style="width: 100%; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; padding: 13px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.3s; margin-bottom: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 20px rgba(59, 130, 246, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    Save Username
                </button>
                <button onclick="document.getElementById('customizeUsernameModal').remove(); app.showApp();" style="width: 100%; background: #e2e8f0; color: #475569; border: none; padding: 12px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px;">
                    Keep Current
                </button>
                <p style="font-size: 11px; color: #94a3b8; margin: 12px 0 0 0;">You can always change this later in settings</p>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById('customizeUsername').focus();

        document.getElementById('customizeUsername').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                self.saveCustomizedUsername();
            }
        });
    },

    saveCustomizedUsername: function() {
        var username = document.getElementById('customizeUsername').value.trim();

        if (!username || username.length < 3) {
            this.toast('Username must be at least 3 characters', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.toast('Username can only contain letters, numbers, and underscores', 'error');
            return;
        }

        var self = this;

        db.ref('users').orderByChild('username').equalTo(username).once('value')
            .then(function(snapshot) {
                if (snapshot.exists()) {
                    var existingUid = Object.keys(snapshot.val())[0];
                    if (existingUid !== self.user.uid) {
                        self.toast('This username is already taken', 'error');
                        return;
                    }
                }

                db.ref('users/' + self.user.uid + '/username').set(username);
                self.profile.username = username;
                self.toast('Username updated to @' + username, 'success');
                self.logUserActivity('username_customized', 'Set username to ' + username + ' after Google signup');
                document.getElementById('customizeUsernameModal').remove();
                self.showApp();
            })
            .catch(function(err) {
                console.error('Error checking username:', err);
                self.toast('Error saving username', 'error');
            });
    },

    showForgotPasswordModal: function() {
        var modal = document.getElementById('forgotPasswordModal');
        if (modal) {
            modal.style.display = 'flex';
            var emailInput = document.getElementById('forgotPasswordEmail');
            if (emailInput) emailInput.focus();
        }
    },

    closeForgotPasswordModal: function() {
        var modal = document.getElementById('forgotPasswordModal');
        if (modal) modal.style.display = 'none';
        var emailInput = document.getElementById('forgotPasswordEmail');
        if (emailInput) emailInput.value = '';
    },

    sendPasswordReset: function() {
        var email = document.getElementById('forgotPasswordEmail').value.trim();
        if (!email) {
            this.toast('Please enter your email address', 'error');
            return;
        }

        var self = this;
        auth.sendPasswordResetEmail(email)
            .then(function() {
                self.toast('Password reset link sent to ' + email, 'success');
                self.closeForgotPasswordModal();
                self.logUserActivity('password_reset', 'Password reset requested for: ' + email);
            })
            .catch(function(err) {
                self.toast('Error: ' + err.message, 'error');
            });
    },

    logout: function() {
        var self = this;
        auth.signOut().then(function() {
            self.user = null;
            self.profile = { name: 'Guest', balance: 0 };
            self.logUserActivity('logout', 'User logged out');
            window.location.reload();
        }).catch(function(err) {
            self.toast('Logout error: ' + err.message, 'error');
        });
    },

    closeLogoutModal: function() {
        return;
    },

    closeLogout: function() {
        this.closeLogoutModal();
    },

    justLogout: function() {
        this.logout();
    },

    showLogout: function() {
        this.logout();
    },

    updateLogoutButton: function() {
        // Deprecated: use updateHeaderMenu instead
        this.updateHeaderMenu();
    },

    filterMessages: function(filter) {
        document.querySelectorAll('.message-filter-tab').forEach(function(tab) {
            tab.classList.remove('active');
            tab.style.background = '#f3f4f6';
            tab.style.color = '#666';
        });
        this.activeMessageFilter = filter;
        this.applyMessageListFilters();
    },

    showChatMenu: function() {
        if (typeof this.showChatMoreMenu === 'function') {
            this.showChatMoreMenu();
        }
    },
    // ============================================
    // SHOW NOTIFICATIONS TAB
    // ============================================

    showNotificationsTab: function() {
        var self = this;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '10050';

        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 24px; max-width: 500px; width: 95%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="font-size: 20px; font-weight: 700; margin: 0;">🔔 Notifications</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
                </div>
                <div id="notificationsList" style="max-height: 500px; overflow-y: auto;">
                    <div style="text-align: center; color: #9ca3af; padding: 40px;">Loading notifications...</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        if (!this.user || this.isGuest) {
            document.getElementById('notificationsList').innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 40px;">Login to see notifications</div>';
            return;
        }

        var userId = this.user.uid;
        db.ref('notifications/' + userId).orderByChild('timestamp').limitToLast(50).once('value', function(snapshot) {
            var notifications = [];
            snapshot.forEach(function(child) {
                notifications.push({
                    id: child.key,
                    ...child.val()
                });
            });

            notifications.reverse();

            var html = '';
            if (notifications.length === 0) {
                html = '<div style="text-align: center; color: #9ca3af; padding: 40px;">No notifications yet</div>';
            } else {
                notifications.forEach(function(notif) {
                    var icon = notif.type === 'coin_received' ? '💰' : '🔔';
                    html += `
                        <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; background: ${notif.read ? 'white' : '#f0f7ff'}; border-radius: 8px; margin-bottom: 4px;">
                            <div style="display: flex; gap: 10px; align-items: start;">
                                <div style="font-size: 24px;">${icon}</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 14px; color: #1a202c;">${notif.message || 'New notification'}</div>
                                    <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${notif.createdAt || 'Just now'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            var list = document.getElementById('notificationsList');
            if (list) list.innerHTML = html;
        });
    },

    // ============================================
    // SEARCH MESSAGES
    // ============================================

    searchMessages: function(query) {
        var items = document.querySelectorAll('.message-item');
        var searchQuery = query.toLowerCase().trim();

        items.forEach(function(item) {
            var name = item.querySelector('.message-item-name');
            var preview = item.querySelector('.message-item-preview');
            var text = (name ? name.textContent : '') + ' ' + (preview ? preview.textContent : '');

            if (!searchQuery || text.toLowerCase().includes(searchQuery)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    // ============================================
    // REFRESH FEED - FIXED
    // ============================================

    refreshFeed: function() {
        var btn = document.getElementById('refreshFeedBtn');
        if (btn) {
            btn.textContent = '⏳';
            btn.disabled = true;
            btn.style.opacity = '0.7';
        }

        this.loadPosts();
        this.toast('🔄 Feed refreshed!', 'success');

        setTimeout(function() {
            if (btn) {
                btn.textContent = '↻';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }, 1000);
    },

    // ============================================
    // NATIONAL GIRLFRIEND DAY CAMPAIGN FUNCTIONS
    // ============================================

    gfdayState: {
        isExpanded: false,
        referralCode: 'CHICHI-GF-ABC123'
    },

    toggleGFDayCampaign: function() {
        var content = document.getElementById('gfdayCampaignContent');
        var icon = document.getElementById('gfdayToggleIcon');

        if (content && icon) {
            this.gfdayState.isExpanded = !this.gfdayState.isExpanded;
            content.style.display = this.gfdayState.isExpanded ? 'block' : 'none';
            icon.style.transform = this.gfdayState.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
            console.log('Campaign section toggled:', this.gfdayState.isExpanded ? 'OPEN' : 'CLOSED');
        }
    },

    startGFDayCountdown: function() {
        var self = this;
        var countdownInterval = setInterval(function() {
            var now = new Date();
            var eventStart = new Date('2024-08-01T00:00:00Z');
            var timeLeft = eventStart - now;

            if (timeLeft > 0) {
                var days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                var hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                var mins = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                var daysEl = document.getElementById('gfdayDays');
                var hoursEl = document.getElementById('gfdayHours');
                var minsEl = document.getElementById('gfdayMins');

                if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
                if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
                if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
            } else {
                clearInterval(countdownInterval);
                var daysEl = document.getElementById('gfdayDays');
                if (daysEl) daysEl.textContent = '00';
            }
        }, 1000);
    },

    showGFDayUploadModal: function() {
        this.toast('📸 Photo upload feature coming August 1st!', 'info');
        console.log('Campaign: Upload modal requested');
    },

    showGFDayGallery: function() {
        this.toast('👥 Gallery view coming August 1st!', 'info');
        console.log('Campaign: Gallery view requested');
    },

    copyGFDayRefCode: function() {
        var refCode = document.getElementById('gfdayRefCode');
        if (refCode) {
            refCode.select();
            document.execCommand('copy');
            this.toast('✅ Referral code copied! Share to earn!', 'success');
            console.log('Campaign: Referral code copied');
        }
    },

    awardGFDayCoins: function(amount, reason) {
        this.balance += amount;

        var balanceEl = document.getElementById('coinBalance');
        if (balanceEl) {
            balanceEl.textContent = this.balance.toFixed(2);
        }

        if (this.user && !this.isGuest) {
            firebase.database().ref('users/' + this.user.uid + '/balance').set(this.balance);
            firebase.database().ref('users/' + this.user.uid + '/transactions').push({
                type: reason,
                amount: amount,
                timestamp: new Date().toISOString(),
                campaign: 'national_girlfriend_day'
            });
        }

        console.log(`✅ Campaign: Awarded ${amount} coins for ${reason}`);
    }
};

// ============================================
// CHICHI FEATURE MODULES EMBEDDED
// ============================================

// ===== MESSAGES MODULE =====
const messagesModule = (() => {
  let db;
  let currentUserId;
  let messageStates = {};
  let favorites = new Set();

  const init = (firebaseDB, userId) => {
    db = firebaseDB;
    currentUserId = userId;
    loadMessageStates();
    loadFavorites();
    initializeMessageListeners();
    renderUnreadBadges();
  };

  const loadMessageStates = () => {
    db.ref(`users/${currentUserId}/messageStates`).on('value', (snapshot) => {
      messageStates = snapshot.val() || {};
    });
  };

  const loadFavorites = () => {
    db.ref(`users/${currentUserId}/favorites`).on('value', (snapshot) => {
      favorites = new Set(snapshot.val() || []);
    });
  };

  const markMessageAsRead = (messageId, chatPartnerId) => {
    messageStates[messageId] = {
      read: true,
      timestamp: Date.now(),
      partnerId: chatPartnerId
    };
    db.ref(`users/${currentUserId}/messageStates/${messageId}`).set({
      read: true,
      timestamp: Date.now(),
      partnerId: chatPartnerId
    });
    removeUnreadBadge(messageId);
  };

  const getUnreadCount = (chatPartnerId) => {
    return Object.values(messageStates).filter(
      msg => !msg.read && msg.partnerId === chatPartnerId
    ).length;
  };

  const initializeMessageListeners = () => {
    document.addEventListener('click', (e) => {
      const chatItem = e.target.closest('[data-chat-partner-id]');
      if (chatItem) {
        const partnerId = chatItem.dataset.chatPartnerId;
        markChatAsRead(partnerId);
      }

      const messageEl = e.target.closest('[data-message-id]');
      if (messageEl) {
        const messageId = messageEl.dataset.messageId;
        const partnerId = messageEl.dataset.chatPartnerId;
        markMessageAsRead(messageId, partnerId);
      }

      const favoriteBtn = e.target.closest('[data-toggle-favorite]');
      if (favoriteBtn) {
        const partnerId = favoriteBtn.dataset.toggleFavorite;
        toggleFavorite(partnerId);
      }

      if (e.target.closest('[data-open-unread-modal]')) {
        showUnreadModal();
      }

      if (e.target.closest('[data-open-favorites-modal]')) {
        showFavoritesModal();
      }
    });
  };

  const markChatAsRead = (chatPartnerId) => {
    Object.keys(messageStates).forEach(msgId => {
      if (messageStates[msgId].partnerId === chatPartnerId && !messageStates[msgId].read) {
        messageStates[msgId].read = true;
        db.ref(`users/${currentUserId}/messageStates/${msgId}`).update({ read: true });
      }
    });
    renderUnreadBadges();
  };

  const renderUnreadBadges = () => {
    document.querySelectorAll('[data-chat-partner-id]').forEach(chatItem => {
      const partnerId = chatItem.dataset.chatPartnerId;
      const count = getUnreadCount(partnerId);
      let badge = chatItem.querySelector('[data-unread-badge]');

      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.setAttribute('data-unread-badge', '');
          badge.className = 'unread-badge';
          chatItem.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      } else if (badge) {
        badge.style.display = 'none';
      }
    });
  };

  const removeUnreadBadge = (messageId) => {
    const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (msgEl) {
      const badge = msgEl.querySelector('[data-unread-badge]');
      if (badge) badge.style.display = 'none';
    }
  };

  const toggleFavorite = (partnerId) => {
    if (favorites.has(partnerId)) {
      favorites.delete(partnerId);
    } else {
      favorites.add(partnerId);
    }
    db.ref(`users/${currentUserId}/favorites`).set(Array.from(favorites));
    updateFavoriteButtonState(partnerId);
  };

  const updateFavoriteButtonState = (partnerId) => {
    const favoriteBtn = document.querySelector(`[data-toggle-favorite="${partnerId}"]`);
    if (favoriteBtn) {
      if (favorites.has(partnerId)) {
        favoriteBtn.classList.add('favorite-active');
        favoriteBtn.innerHTML = '❤️';
      } else {
        favoriteBtn.classList.remove('favorite-active');
        favoriteBtn.innerHTML = '🤍';
      }
    }
  };

  const showUnreadModal = () => {
    const unreadMessages = Object.entries(messageStates)
      .filter(([_, msg]) => !msg.read)
      .map(([id, msg]) => ({ id, ...msg }));

    const modal = document.createElement('div');
    modal.className = 'modal unread-messages-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Unread Messages</h2>
          <button class="modal-close" data-close-modal>✕</button>
        </div>
        <div class="unread-list">
          ${unreadMessages.length > 0 ? unreadMessages.map(msg => `
            <div class="unread-message-item" data-message-id="${msg.id}">
              <div class="message-preview">
                <p class="message-sender">From: ${msg.partnerId}</p>
                <p class="message-text">Message preview...</p>
                <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <button class="mark-read-btn" data-mark-read="${msg.id}">Mark as Read</button>
            </div>
          `).join('') : '<p class="no-unread">All caught up!</p>'}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    modal.querySelector('[data-close-modal]').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelectorAll('[data-mark-read]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const msgId = e.target.dataset.markRead;
        const partnerId = messageStates[msgId].partnerId;
        markMessageAsRead(msgId, partnerId);
        e.target.closest('.unread-message-item').remove();
      });
    });
  };

  const showFavoritesModal = () => {
    const favoriteChats = Array.from(favorites);
    const modal = document.createElement('div');
    modal.className = 'modal favorites-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Favorites</h2>
          <button class="modal-close" data-close-modal>✕</button>
        </div>
        <div class="favorites-list">
          ${favoriteChats.length > 0 ? favoriteChats.map(partnerId => `
            <div class="favorite-chat-item" data-chat-partner-id="${partnerId}">
              <img class="chat-avatar" src="path/to/avatar/${partnerId}.jpg" alt="${partnerId}">
              <div class="chat-info">
                <p class="chat-name">${partnerId}</p>
                <p class="last-message">Last message...</p>
              </div>
              <button class="remove-favorite-btn" data-remove-favorite="${partnerId}">✕</button>
            </div>
          `).join('') : '<p class="no-favorites">No favorites yet</p>'}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    modal.querySelector('[data-close-modal]').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelectorAll('[data-remove-favorite]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const partnerId = e.target.dataset.removeFavorite;
        toggleFavorite(partnerId);
        e.target.closest('.favorite-chat-item').remove();
      });
    });
  };

  return {
    init,
    markMessageAsRead,
    markChatAsRead,
    getUnreadCount,
    toggleFavorite,
    showUnreadModal,
    showFavoritesModal,
    renderUnreadBadges
  };
})();

// ===== PROFILE UI MODULE =====
const profileModule = (() => {
  let db;
  let currentUserId;
  let userInterests = new Set();

  const INTEREST_LIBRARY = [
    'Travel', 'Photography', 'Music', 'Art', 'Technology', 'Sports', 'Fitness', 'Cooking',
    'Reading', 'Movies', 'Gaming', 'Fashion', 'Nature', 'Animals', 'Design', 'Writing',
    'Dancing', 'Yoga', 'Meditation', 'Adventure', 'Coffee', 'Wine', 'Beer', 'Hiking',
    'Camping', 'Surfing', 'Skateboarding', 'Cycling', 'Swimming', 'Running', 'Gardening',
    'Volunteering', 'Charity', 'Community', 'Environment', 'Science', 'History', 'Culture',
    'Languages', 'Education'
  ];

  const init = (firebaseDB, userId) => {
    db = firebaseDB;
    currentUserId = userId;
    loadUserInterests();
    initializeInterestsAutocomplete();
  };

  const loadUserInterests = () => {
    db.ref(`users/${currentUserId}/profile/interests`).on('value', (snapshot) => {
      userInterests = new Set(snapshot.val() || []);
      renderInterestTags();
    });
  };

  const initializeInterestsAutocomplete = () => {
    const interestsInput = document.querySelector('[data-interests-input]');
    if (!interestsInput) return;

    const autoCompleteContainer = document.createElement('div');
    autoCompleteContainer.className = 'interests-autocomplete-dropdown';
    autoCompleteContainer.setAttribute('data-interests-dropdown', '');
    interestsInput.parentElement.appendChild(autoCompleteContainer);

    interestsInput.addEventListener('input', (e) => {
      const value = e.target.value.trim().toLowerCase();

      if (!value) {
        autoCompleteContainer.style.display = 'none';
        return;
      }

      const filtered = INTEREST_LIBRARY.filter(interest =>
        interest.toLowerCase().startsWith(value) &&
        !userInterests.has(interest)
      );

      if (filtered.length === 0) {
        autoCompleteContainer.style.display = 'none';
        return;
      }

      autoCompleteContainer.innerHTML = filtered.map(interest => `
        <div class="autocomplete-item" data-suggest-interest="${interest}">
          <span class="interest-text">${interest}</span>
          <span class="add-icon">+</span>
        </div>
      `).join('');

      autoCompleteContainer.style.display = 'flex';
    });

    document.addEventListener('click', (e) => {
      const suggestItem = e.target.closest('[data-suggest-interest]');
      if (suggestItem) {
        const interest = suggestItem.dataset.suggestInterest;
        addInterest(interest);
        interestsInput.value = '';
        autoCompleteContainer.style.display = 'none';
      }
    });
  };

  const addInterest = (interest) => {
    if (userInterests.has(interest)) return;
    userInterests.add(interest);
    db.ref(`users/${currentUserId}/profile/interests`).set(Array.from(userInterests));
    renderInterestTags();
  };

  const removeInterest = (interest) => {
    userInterests.delete(interest);
    db.ref(`users/${currentUserId}/profile/interests`).set(Array.from(userInterests));
    renderInterestTags();
  };

  const renderInterestTags = () => {
    const tagsContainer = document.querySelector('[data-interests-tags]');
    if (!tagsContainer) return;

    tagsContainer.innerHTML = Array.from(userInterests).map(interest => `
      <div class="interest-tag" data-interest="${interest}">
        <span class="tag-text">${interest}</span>
        <button class="tag-remove" data-remove-interest="${interest}" type="button">✕</button>
      </div>
    `).join('');

    tagsContainer.querySelectorAll('[data-remove-interest]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const interest = btn.dataset.removeInterest;
        removeInterest(interest);
      });
    });
  };

  return {
    init,
    addInterest,
    removeInterest
  };
})();

// ===== VOICE CALL MODULE =====
const voiceCallModule = (() => {
  let db;
  let currentUserId;
  let currentUsername;
  let localStream;
  let peerConnection;
  let inCall = false;

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const init = (firebaseDB, userId, username) => {
    db = firebaseDB;
    currentUserId = userId;
    currentUsername = username;
    initializeCallUI();
  };

  const initializeCallUI = () => {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-start-voice-call]')) {
        const recipientId = e.target.closest('[data-start-voice-call]').dataset.startVoiceCall;
        initiateCall(recipientId);
      }
      if (e.target.closest('[data-hang-up-call]')) {
        hangUp();
      }
    });
  };

  const initiateCall = async (recipientId) => {
    if (inCall) return;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });

      peerConnection = new RTCPeerConnection(ICE_SERVERS);
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.ontrack = (event) => {
        const audio = document.querySelector('[data-remote-audio]') || document.createElement('audio');
        audio.setAttribute('data-remote-audio', '');
        audio.autoplay = true;
        audio.srcObject = event.streams[0];
        if (!audio.parentElement) document.body.appendChild(audio);
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage(recipientId, { type: 'ice-candidate', candidate: event.candidate });
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendSignalingMessage(recipientId, { type: 'offer', offer });

      showCallInProgress(recipientId);
      inCall = true;
    } catch (error) {
      console.error('Error initiating call:', error);
    }
  };

  const sendSignalingMessage = (recipientId, message) => {
    db.ref(`callSignaling/${recipientId}`).push({
      from: currentUserId,
      fromUsername: currentUsername,
      ...message
    });
  };

  const hangUp = () => {
    if (!inCall) return;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    inCall = false;
    const callUI = document.querySelector('[data-call-ui]');
    if (callUI) callUI.remove();
  };

  const showCallInProgress = (peerId) => {
    let callUI = document.querySelector('[data-call-ui]');
    if (!callUI) {
      callUI = document.createElement('div');
      callUI.setAttribute('data-call-ui', '');
      callUI.className = 'call-ui-container';
      document.body.appendChild(callUI);
    }

    callUI.innerHTML = `
      <div class="call-window">
        <div class="call-info">
          <p class="call-status">In call with ${peerId}</p>
          <div class="call-timer">00:00</div>
        </div>
        <div class="call-controls">
          <button class="hang-up-btn" data-hang-up-call>📵</button>
        </div>
      </div>
    `;

    let seconds = 0;
    setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timerDisplay = document.querySelector('[data-call-ui] .call-timer');
      if (timerDisplay) {
        timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }, 1000);
  };

  return {
    init,
    initiateCall,
    hangUp
  };
})();

// ===== EARN/TRIVIA MODULE =====
const earnModule = (() => {
  let db;
  let currentUserId;
  let isTrivia = false;
  let currentQuestionIndex = 0;
  let triviaQuestions = [];
  let timeRemaining = 30;
  let timerInterval = null;
  let answered = false;

  const DEFAULT_QUESTIONS = [
    { id: 1, question: 'What is the capital of France?', answers: ['Paris', 'London', 'Berlin', 'Madrid'], correct: 0 },
    { id: 2, question: 'What is 2 + 2?', answers: ['3', '4', '5', '6'], correct: 1 },
    { id: 3, question: 'Who wrote Romeo and Juliet?', answers: ['Mark Twain', 'Jane Austen', 'Shakespeare', 'Dickens'], correct: 2 }
  ];

  const init = (firebaseDB, userId) => {
    db = firebaseDB;
    currentUserId = userId;
    loadTriviaQuestions();
    initializeEarnUI();
    initializeGiftCardScroll();
  };

  const loadTriviaQuestions = () => {
    db.ref('trivia/questions').on('value', (snapshot) => {
      triviaQuestions = snapshot.val() || DEFAULT_QUESTIONS;
    });
  };

  const initializeEarnUI = () => {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-start-trivia]')) {
        startTrivia();
      }
      if (e.target.closest('[data-answer-question]')) {
        handleAnswerClick(e.target.closest('[data-answer-question]'));
      }
      if (e.target.closest('[data-next-question]')) {
        nextQuestion();
      }
    });
  };

  const startTrivia = () => {
    if (isTrivia) return;
    isTrivia = true;
    currentQuestionIndex = 0;
    answered = false;
    showTriviaModal();
    displayQuestion();
    startTimer();
  };

  const displayQuestion = () => {
    if (currentQuestionIndex >= triviaQuestions.length) {
      showTriviaComplete();
      return;
    }

    const question = triviaQuestions[currentQuestionIndex];
    const modal = document.querySelector('[data-trivia-modal]');
    if (!modal) return;

    const content = modal.querySelector('.trivia-content');
    content.innerHTML = `
      <div class="trivia-progress">
        <span>${currentQuestionIndex + 1}/${triviaQuestions.length}</span>
      </div>
      <h3>${question.question}</h3>
      <div class="trivia-timer">
        <div class="time-value">${timeRemaining}</div>s
      </div>
      <div class="trivia-answers">
        ${question.answers.map((answer, idx) => `
          <button class="answer-btn" data-answer-question data-answer-index="${idx}">
            ${String.fromCharCode(65 + idx)}. ${answer}
          </button>
        `).join('')}
      </div>
      <div class="trivia-button-group" style="display: none;">
        <button class="next-question-btn" data-next-question>Next Question</button>
      </div>
    `;

    answered = false;
    timeRemaining = 30;
  };

  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        if (!answered) timeExpired();
      }
    }, 1000);
  };

  const updateTimerDisplay = () => {
    const timeValue = document.querySelector('.time-value');
    if (timeValue) timeValue.textContent = timeRemaining;
  };

  const handleAnswerClick = (btn) => {
    if (answered) return;
    answered = true;
    clearInterval(timerInterval);

    const answerIndex = parseInt(btn.dataset.answerIndex);
    const question = triviaQuestions[currentQuestionIndex];
    const isCorrect = answerIndex === question.correct;

    const allButtons = document.querySelectorAll('[data-answer-question]');
    allButtons.forEach((b, idx) => {
      if (idx === question.correct) {
        b.classList.add('correct-answer');
      } else if (idx === answerIndex && !isCorrect) {
        b.classList.add('wrong-answer');
      }
      b.disabled = true;
    });

    setTimeout(() => {
      const buttonGroup = document.querySelector('[data-trivia-modal] .trivia-button-group');
      if (buttonGroup) buttonGroup.style.display = 'flex';
    }, 2000);
  };

  const timeExpired = () => {
    answered = true;
    const question = triviaQuestions[currentQuestionIndex];
    const allButtons = document.querySelectorAll('[data-answer-question]');
    allButtons.forEach((b, idx) => {
      if (idx === question.correct) b.classList.add('correct-answer');
      b.disabled = true;
    });

    setTimeout(() => {
      const buttonGroup = document.querySelector('[data-trivia-modal] .trivia-button-group');
      if (buttonGroup) buttonGroup.style.display = 'flex';
    }, 2000);
  };

  const nextQuestion = () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < triviaQuestions.length) {
      displayQuestion();
      startTimer();
    } else {
      showTriviaComplete();
    }
  };

  const showTriviaComplete = () => {
    const modal = document.querySelector('[data-trivia-modal]');
    if (!modal) return;
    const content = modal.querySelector('.trivia-content');
    content.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <h2>Quiz Complete! 🎉</h2>
        <p style="margin: 16px 0;">You've earned coins!</p>
        <p style="font-size: 32px; font-weight: 700; color: #667eea; margin: 20px 0;">+100 Coins</p>
        <button class="btn-primary" onclick="earnModule.closeTrivia()">Play Again</button>
      </div>
    `;
  };

  const showTriviaModal = () => {
    let modal = document.querySelector('[data-trivia-modal]');
    if (!modal) {
      modal = document.createElement('div');
      modal.setAttribute('data-trivia-modal', '');
      modal.className = 'modal trivia-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <button class="modal-close" onclick="earnModule.closeTrivia()">✕</button>
          <div class="trivia-content"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
  };

  const closeTrivia = () => {
    isTrivia = false;
    currentQuestionIndex = 0;
    answered = false;
    clearInterval(timerInterval);
    const modal = document.querySelector('[data-trivia-modal]');
    if (modal) modal.style.display = 'none';
  };

  const initializeGiftCardScroll = () => {
    const container = document.querySelector('[data-gift-cards-scroll]');
    if (!container) return;

    const cards = container.querySelectorAll('.gift-card');
    const clonedCards = Array.from(cards).map(card => card.cloneNode(true));
    clonedCards.forEach(card => container.appendChild(card));

    let scrollPos = 0;
    setInterval(() => {
      scrollPos += 2;
      if (scrollPos >= container.scrollHeight / 2) scrollPos = 0;
      container.scrollTop = scrollPos;
    }, 50);
  };

  return {
    init,
    closeTrivia,
    nextQuestion
  };
})();


// ============================================
// INITIALIZE ALL MODULES
// ============================================

firebase.auth().onAuthStateChanged(function(user) {
  if (user && typeof app !== 'undefined' && app.user) {
    const userId = user.uid;
    const db = firebase.database();

    // Initialize feature modules
    if (typeof messagesModule !== 'undefined') {
      messagesModule.init(db, userId);
      console.log('✓ Messages module initialized');
    }
    if (typeof profileModule !== 'undefined') {
      profileModule.init(db, userId);
      console.log('✓ Profile module initialized');
    }
    if (typeof voiceCallModule !== 'undefined') {
      voiceCallModule.init(db, userId, app.profile.name || user.email || 'User');
      console.log('✓ Voice call module initialized');
    }
    if (typeof earnModule !== 'undefined') {
      earnModule.init(db, userId);
      console.log('✓ Earn/Trivia module initialized');
    }
    console.log('✅ All CHICHI modules initialized!');
  }
});


// ============================================
// PHASE 1: CORE MESSAGING FEATURES
// ============================================

// PHASE 1.1: Delivery Status (✓ ✓✓ ✓✓✓)
app.trackDeliveryStatus = function(msgId, status) {
    if (!this.user) return;
    var self = this;
    db.ref('messages/' + msgId + '/status').set(status).catch(function(err) {
        console.error('Delivery status error:', err);
    });
};

app.updateMessageStatus = function(msgId, newStatus) {
    if (!this.user) return;
    var statusMap = {'sent': '✓', 'delivered': '✓✓', 'read': '✓✓✓'};
    var indicator = statusMap[newStatus] || '✓';
    var elem = document.querySelector('[data-msg-id="' + msgId + '"] .delivery-status');
    if (elem) {
        elem.textContent = indicator;
        elem.className = 'delivery-status delivery-' + newStatus;
    }
};

// PHASE 1.2: Typing Indicators
app.startTypingIndicator = function() {
    if (!this.currentChat || !this.user) return;
    var self = this;
    var key = [self.user.uid, self.currentChat.uid].sort().join('_');
    db.ref('typing/' + key + '/' + self.user.uid).set({typing: true, since: Date.now()});

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(function() {
        self.stopTypingIndicator();
    }, 3000);
};

app.stopTypingIndicator = function() {
    if (!this.currentChat || !this.user) return;
    var key = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('typing/' + key + '/' + this.user.uid).remove();
};

app.displayTypingIndicator = function(userName) {
    var chatMsgs = document.getElementById('chatMessages');
    if (!chatMsgs) return;

    var existing = chatMsgs.querySelector('.typing-indicator');
    if (existing) existing.remove();

    var typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = '<div style="font-size:13px;color:#6b7280;font-style:italic;padding:8px;"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> ' + userName + ' is typing...</div>';
    chatMsgs.appendChild(typingDiv);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
};

app.trackTyping = function() {
    if (!this.currentChat) return;
    var self = this;
    var key = [self.user.uid, self.currentChat.uid].sort().join('_');

    if (this.typingListener) db.ref('typing/' + key).off();

    this.typingListener = db.ref('typing/' + key).on('value', function(snapshot) {
        var typing = snapshot.val();
        var typingUsers = [];
        if (typing) {
            Object.keys(typing).forEach(function(uid) {
                if (uid !== self.user.uid && typing[uid].typing) {
                    typingUsers.push(self.users[uid] ? self.users[uid].name : 'User');
                }
            });
        }

        var existing = document.querySelector('.typing-indicator');
        if (typingUsers.length > 0) {
            if (!existing) self.displayTypingIndicator(typingUsers[0]);
        } else if (existing) {
            existing.remove();
        }
    });
    },

    // ============================================
    // PRESENCE / ONLINE STATUS (NEW)
    // ============================================

app.setupPresence = function() {
    if (!this.user || this.isGuest) return;

    var self = this;
    var presenceRef = db.ref('presence/' + this.user.uid);

    // Set online and onDisconnect handler
    presenceRef.onDisconnect().set({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    presenceRef.set({
        online: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    // Also update user profile lastSeen    db.ref('users/' + this.user.uid + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);

    // Periodic refresh every 30 seconds
    if (this.onlineInterval) {
        clearInterval(this.onlineInterval);
    }
    this.onlineInterval = setInterval(function() {
        if (self.user) {
            db.ref('users/' + self.user.uid + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
            db.ref('presence/' + self.user.uid + '/lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
        }
    }, 30000);
},

app.listenToAllPresence = function() {
    if (this.presenceListenerActive) return;
    this.presenceListenerActive = true;
    var self = this;
    db.ref('presence').on('value', function(snapshot) {
        var data = snapshot.val() || {};
        for (var uid in data) {
            self.presenceStatus[uid] = data[uid];
        }
        self.updatePresenceDots();
    });
},

app.updatePresenceDots = function() {
    var items = document.querySelectorAll('.msg-item');
    items.forEach(function(item) {
        var wrapper = item.closest('.msg-item-wrapper');
        var uid = wrapper ? wrapper.dataset.uid : null;
        if (!uid) return;
        var dot = item.querySelector('.online-dot');
        var presence = this.presenceStatus[uid];
        var presenceLabel = item.querySelector('.msg-item-presence');
        var user = this.users && this.users[uid];
        var lastSeenValue = (presence && presence.lastSeen) || (user && user.lastSeen);
        if (dot) dot.classList.toggle('active', !!(presence && presence.online));
        if (presenceLabel) {
            presenceLabel.textContent = presence && presence.online ? 'Online' :
                (lastSeenValue ? 'Not online right now 🙂 I was at ' + this.formatPresenceTime(new Date(lastSeenValue)) : 'Not online right now 🙂');
        }
    }.bind(this));
},

app.trackPresence = function() {
    if (!this.currentChat || !this.user) return;
    var self = this;
    var otherUserId = this.currentChat.uid;
    if (this.presenceListener) db.ref('presence/' + otherUserId).off();

    this.presenceListener = db.ref('presence/' + otherUserId).on('value', function(snapshot) {
        var presence = snapshot.val();
        var headerStatus = document.querySelector('.chat-header-status');
        if (!headerStatus) return;

        if (presence && presence.online) {
            headerStatus.innerHTML = '🟢 Online';
            headerStatus.style.color = '#10b981';
        } else {
            var lastSeen = presence && presence.lastSeen ? self.formatTimeAgo(new Date(presence.lastSeen)) : 'a long time ago';
            headerStatus.innerHTML = '⚫ Last seen ' + lastSeen;
            headerStatus.style.color = '#9ca3af';
        }
    });
},



// PHASE 1.4: Edit Messages
app.editMessage = function(msgId, chatKey) {
    if (!this.user) return;
    var self = this;

    var currentMsg = null;
    if (this.chatMessages && this.chatMessages[chatKey]) {
        this.chatMessages[chatKey].forEach(function(msg) {
            if (msg.id === msgId) currentMsg = msg;
        });
    }

    if (!currentMsg) return;

    var modal = document.createElement('div');
    modal.id = 'editMessageModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
        <div style="background:white;border-radius:12px;padding:20px;width:90%;max-width:400px;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
            <div style="font-size:18px;font-weight:700;margin-bottom:15px;">Edit Message</div>
            <textarea id="editMessageText" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit;min-height:80px;font-size:14px;">${currentMsg.text}</textarea>
            <div style="display:flex;gap:10px;margin-top:15px;">
                <button onclick="document.getElementById('editMessageModal').remove();" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                <button onclick="app.saveEditMessage('${msgId}', '${chatKey}', document.getElementById('editMessageText').value);" style="flex:1;padding:10px;background:#2e5bff;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

app.saveEditMessage = function(msgId, chatKey, newText) {
    if (!this.user || !newText.trim()) return;

    var self = this;
    newText = newText.trim();

    db.ref('messages/' + msgId).update({
        text: newText,
        edited: true,
        editedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function() {
        db.ref('chats/' + chatKey + '/messages/' + msgId).update({
            text: newText,
            edited: true,
            editedAt: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('editMessageModal').remove();
        self.displayChatMessages(self.chatMessages[chatKey], chatKey);
    }).catch(function(err) {
        self.toast('Error editing message', 'error');
    });
};

// PHASE 1.5: Delete Messages (Soft Delete)
app.deleteMessage = function(msgId, chatKey) {
    if (!this.user) return;

    var self = this;
    
    // Show modal asking to delete for me or everyone
    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal" style="max-width: 400px;">
            <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()">✕</button></div>
            <h2 style="font-weight: 700; margin: 0 0 12px 0; font-size: 18px;">Delete Message</h2>
            <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">How would you like to delete this message?</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="app.confirmDeleteMessage('${msgId}', '${chatKey}', 'me'); this.closest('.modal-overlay').remove();" style="padding: 12px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-weight: 600; color: #1a202c; font-size: 14px; transition: 0.3s;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                    👤 Delete for Me
                    <div style="font-size: 11px; color: #6b7280; font-weight: 400; margin-top: 4px;">Only you can see this message will be deleted</div>
                </button>
                
                <button onclick="app.confirmDeleteMessage('${msgId}', '${chatKey}', 'everyone'); this.closest('.modal-overlap').remove();" style="padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; cursor: pointer; font-weight: 600; color: #991b1b; font-size: 14px; transition: 0.3s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">
                    🗑️ Delete for Everyone
                    <div style="font-size: 11px; color: #991b1b; font-weight: 400; margin-top: 4px;">Message will be deleted for all participants</div>
                </button>
                
                <button onclick="this.closest('.modal-overlay').remove();" style="padding: 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-weight: 600; color: #6b7280; font-size: 14px;">
                    Cancel
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

app.confirmDeleteMessage = function(msgId, chatKey, scope) {
    if (!this.user) return;
    
    var self = this;
    var updates = {};
    
    if (scope === 'me') {
        // Delete only for current user
        updates['deleted_for'] = {};
        updates['deleted_for'][this.user.uid] = true;
    } else if (scope === 'everyone') {
        // Delete for everyone
        updates['deleted'] = true;
        updates['deletedAt'] = firebase.database.ServerValue.TIMESTAMP;
    }
    
    db.ref('messages/' + msgId).update(updates).then(function() {
        db.ref('chats/' + chatKey + '/messages/' + msgId).update(updates);
        self.displayChatMessages(self.chatMessages[chatKey], chatKey);
        var action = scope === 'me' ? 'Deleted for you' : 'Deleted for everyone';
        self.toast('✓ ' + action, 'success');
    }).catch(function(err) {
        self.toast('❌ Error deleting message', 'error');
    });
};

// PHASE 1.6: Message Search
// Search conversations (people) on messages page
app.searchMessagesPage = function(query) {
    if (typeof app.applyMessageListFilters === 'function') {
        app.applyMessageListFilters();
    }
};

// Original chat message search
app.searchMessages = function(query) {
    if (!this.currentChat || !query.trim()) {
        document.querySelectorAll('.message-highlight').forEach(function(el) {
            el.classList.remove('message-highlight');
        });
        return;
    }

    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    var results = [];

    if (this.chatMessages && this.chatMessages[chatKey]) {
        this.chatMessages[chatKey].forEach(function(msg, idx) {
            if (msg && msg.text && msg.text.toLowerCase().includes(query.toLowerCase())) {
                results.push({msg: msg, idx: idx});
            }
        });
    }

    if (results.length > 0) {
        results.forEach(function(result) {
            var msgEl = document.querySelector('[data-msg-id="' + result.msg.id + '"]');
            if (msgEl) msgEl.classList.add('message-highlight');
        });
        this.toast('Found ' + results.length + ' results', 'info');
    } else {
        this.toast('No messages found', 'info');
    }
};

// PHASE 1.7: Message Copy
app.copyMessageToClipboard = function(text) {
    var self = this;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
            self.toast('✓ Copied to clipboard', 'success');
        }).catch(function() {
            self.fallbackCopy(text);
        });
    } else {
        this.fallbackCopy(text);
    }
};

app.fallbackCopy = function(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.toast('✓ Copied', 'success');
};

// PHASE 1.8: Message Action Menu
app.showMessageActionMenu = function(msgId, event) {
    if (!this.user) return;

    event.stopPropagation();

    var existing = document.querySelector('.message-action-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.className = 'message-action-menu';
    menu.style.cssText = 'position:fixed;top:' + event.clientY + 'px;left:' + event.clientX + 'px;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;min-width:150px;overflow:hidden;';

    var msgEl = document.querySelector('[data-msg-id="' + msgId + '"]');
    var msgText = msgEl ? msgEl.querySelector('.message-bubble').textContent : '';

    menu.innerHTML = `
        <div style="padding:8px 0;">
            <div onclick="app.copyMessageToClipboard('${msgText.replace(/'/g, "\\'")}');document.querySelector('.message-action-menu').remove();" style="padding:10px 16px;cursor:pointer;hover:background:#f3f4f6;font-size:14px;">📋 Copy</div>
            <div onclick="app.editMessage('${msgId}','${[this.user.uid, this.currentChat.uid].sort().join('_')}');document.querySelector('.message-action-menu').remove();" style="padding:10px 16px;cursor:pointer;font-size:14px;">✏️ Edit</div>
            <div onclick="app.deleteMessage('${msgId}','${[this.user.uid, this.currentChat.uid].sort().join('_')}');document.querySelector('.message-action-menu').remove();" style="padding:10px 16px;cursor:pointer;font-size:14px;color:#ef4444;">🗑️ Delete</div>
            <div onclick="app.pinMessage('${msgId}');document.querySelector('.message-action-menu').remove();" style="padding:10px 16px;cursor:pointer;font-size:14px;">📌 Pin</div>
            <div onclick="app.forwardMessage('${msgId}');document.querySelector('.message-action-menu').remove();" style="padding:10px 16px;cursor:pointer;font-size:14px;">↪️ Forward</div>
        </div>
    `;

    document.body.appendChild(menu);

    document.addEventListener('click', function() {
        if (menu.parentNode) menu.remove();
    }, {once: true});
};

app.longPressMessage = function(msgId, event) {
    if (!this.user) return;

    if (event.type === 'contextmenu') {
        event.preventDefault();
        this.showMessageActionMenu(msgId, event);
    } else {
        var self = this;
        var pressTimer = setTimeout(function() {
            self.showMessageActionMenu(msgId, {clientX: event.touches[0].clientX, clientY: event.touches[0].clientY, stopPropagation: function(){}});
        }, 500);

        var clearTimer = function() { clearTimeout(pressTimer); };
        event.target.addEventListener('touchend', clearTimer, {once: true});
        event.target.addEventListener('touchmove', clearTimer, {once: true});
    }
};

// ============================================
// PHASE 2: ADVANCED MESSAGING FEATURES
// ============================================

// PHASE 2.1: Emoji Reactions
app.addReaction = function(msgId, emoji) {
    if (!this.user) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');

    db.ref('messages/' + msgId + '/reactions/' + emoji).once('value').then(function(snapshot) {
        var users = snapshot.val() || [];
        if (!Array.isArray(users)) users = [];

        if (!users.includes(self.user.uid)) {
            users.push(self.user.uid);
        }

        db.ref('messages/' + msgId + '/reactions/' + emoji).set(users).then(function() {
            db.ref('chats/' + chatKey + '/messages/' + msgId + '/reactions/' + emoji).set(users);
            self.displayChatMessages(self.chatMessages[chatKey], chatKey);
        });
    });
};

app.removeReaction = function(msgId, emoji) {
    if (!this.user) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');

    db.ref('messages/' + msgId + '/reactions/' + emoji).once('value').then(function(snapshot) {
        var users = snapshot.val() || [];
        if (!Array.isArray(users)) users = [];

        users = users.filter(function(uid) { return uid !== self.user.uid; });

        if (users.length > 0) {
            db.ref('messages/' + msgId + '/reactions/' + emoji).set(users);
            db.ref('chats/' + chatKey + '/messages/' + msgId + '/reactions/' + emoji).set(users);
        } else {
            db.ref('messages/' + msgId + '/reactions/' + emoji).remove();
            db.ref('chats/' + chatKey + '/messages/' + msgId + '/reactions/' + emoji).remove();
        }

        self.displayChatMessages(self.chatMessages[chatKey], chatKey);
    });
};

app.displayReactions = function(msgId, reactions) {
    if (!reactions || Object.keys(reactions).length === 0) return '';

    var html = '<div class="emoji-reaction-container" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">';
    var self = this;

    Object.keys(reactions).forEach(function(emoji) {
        var count = reactions[emoji].length;
        var hasReacted = reactions[emoji].includes(self.user.uid);
        html += '<div onclick="app.' + (hasReacted ? 'removeReaction' : 'addReaction') + '(\'' + msgId + '\', \'' + emoji + '\');" style="display:inline-flex;align-items:center;gap:4px;background:' + (hasReacted ? '#dbeafe' : '#f3f4f6') + ';padding:4px 8px;border-radius:12px;cursor:pointer;font-size:12px;border:1px solid ' + (hasReacted ? '#0ea5e9' : '#e5e7eb') + ';">' + emoji + ' <span>' + count + '</span></div>';
    });

    html += '<div onclick="app.showEmojiPicker(\'' + msgId + '\');" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#f3f4f6;border-radius:50%;cursor:pointer;font-size:12px;">+</div></div>';

    return html;
};

app.showEmojiPicker = function(msgId) {
    var self = this;
    var emojis = ['👍', '❤️', '😂', '😢', '🔥', '😍', '🎉', '👏', '🙏', '💯'];

    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:9999;';
    modal.innerHTML = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">' + emojis.map(function(emoji) {
        return '<div onclick="app.addReaction(\'' + msgId + '\', \'' + emoji + '\');document.querySelector(\'[data-emoji-modal=true]\').remove();" style="font-size:24px;cursor:pointer;padding:8px;border-radius:8px;text-align:center;hover:background:#f3f4f6;">' + emoji + '</div>';
    }).join('') + '</div>';
    modal.setAttribute('data-emoji-modal', 'true');

    document.body.appendChild(modal);

    document.addEventListener('click', function() {
        var m = document.querySelector('[data-emoji-modal=true]');
        if (m) m.remove();
    }, {once: true});
};

// PHASE 2.2: Voice Messages
app.startVoiceRecording = function() {
    if (!this.user) return;
    var self = this;

    var modal = document.createElement('div');
    modal.id = 'voiceRecordingModal';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:9999;text-align:center;';
    modal.innerHTML = `
        <div style="font-size:18px;font-weight:700;margin-bottom:15px;">🎤 Recording...</div>
        <div id="recordingTime" style="font-size:24px;font-weight:700;color:#2e5bff;margin-bottom:15px;">00:00</div>
        <div style="display:flex;gap:10px;justify-content:center;">
            <button onclick="app.stopVoiceRecording();" style="padding:10px 20px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Stop</button>
            <button onclick="document.getElementById('voiceRecordingModal').remove();if(app.mediaRecorder)app.mediaRecorder.stop();" style="padding:10px 20px;background:#9ca3af;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
    `;

    document.body.appendChild(modal);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {
            var mediaRecorder = new MediaRecorder(stream);
            var audioChunks = [];

            self.mediaRecorder = mediaRecorder;
            self.audioChunks = audioChunks;
            self.recordingStartTime = Date.now();

            var timeDisplay = setInterval(function() {
                var elapsed = Math.floor((Date.now() - self.recordingStartTime) / 1000);
                var mins = Math.floor(elapsed / 60);
                var secs = elapsed % 60;
                document.getElementById('recordingTime').textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;

                if (elapsed > 120) {
                    clearInterval(timeDisplay);
                    self.stopVoiceRecording();
                }
            }, 100);

            self.recordingTimeInterval = timeDisplay;

            mediaRecorder.addEventListener('dataavailable', function(event) {
                audioChunks.push(event.data);
            });

            mediaRecorder.start();
        }).catch(function(err) {
            self.toast('Microphone access denied', 'error');
            document.getElementById('voiceRecordingModal').remove();
        });
    } else {
        this.toast('Voice recording not supported', 'error');
    }
};

app.stopVoiceRecording = function() {
    if (!this.mediaRecorder) return;

    var self = this;
    this.mediaRecorder.stop();
    clearInterval(this.recordingTimeInterval);

    this.mediaRecorder.addEventListener('stop', function() {
        var audioBlob = new Blob(self.audioChunks, {type: 'audio/wav'});
        self.uploadVoiceToCloudinary(audioBlob);

        if (document.getElementById('voiceRecordingModal')) {
            document.getElementById('voiceRecordingModal').remove();
        }

        self.mediaRecorder.stream.getTracks().forEach(function(track) { track.stop(); });
    }, {once: true});
};

app.uploadVoiceToCloudinary = function(audioBlob) {
    if (!this.user) return;
    var self = this;

    var formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', 'chichi_audio');
    formData.append('resource_type', 'auto');

    fetch('https://api.cloudinary.com/v1_1/u1uilb6f/upload', {
        method: 'POST',
        body: formData
    }).then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.secure_url) {
            self.sendVoiceMessage(data.secure_url, Math.round(audioBlob.size / 8000));
        } else {
            self.toast('Upload failed', 'error');
        }
    }).catch(function(err) {
        self.toast('Upload error', 'error');
    });
};

app.sendVoiceMessage = function(voiceUrl, duration) {
    if (!this.currentChat || !this.user) return;

    var self = this;
    var key = [self.user.uid, self.currentChat.uid].sort().join('_');
    var now = Date.now();

    var voiceMsg = {
        sender: self.user.uid,
        voiceUrl: voiceUrl,
        duration: duration,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'delivered'
    };

    db.ref('messages/' + key).push().set(voiceMsg).then(function(ref) {
        db.ref('chats/' + key + '/messages/' + ref.key).set(voiceMsg);
        self.displayChatMessages(self.chatMessages[key], key);
        self.toast('🎤 Voice message sent', 'success');
    }).catch(function(err) {
        self.toast('Error sending voice message', 'error');
    });
};

app.playVoiceMessage = function(voiceUrl, duration) {
    var audio = new Audio(voiceUrl);
    audio.play().catch(function(err) {
        console.error('Play error:', err);
    });
};

app.displayVoiceMessage = function(voiceUrl, duration) {
    if (!voiceUrl) return '';
    var mins = Math.floor(duration / 60);
    var secs = duration % 60;
    var timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;

    return `<div class="voice-message" style="background:#f3f4f6;border-radius:8px;padding:10px;margin:8px 0;">
        <div style="display:flex;align-items:center;gap:10px;">
            <button onclick="app.playVoiceMessage('${voiceUrl}',${duration});" style="background:#2e5bff;color:white;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;">▶️</button>
            <div style="flex:1;">
                <div class="voice-progress" style="background:#e5e7eb;border-radius:4px;height:3px;"></div>
            </div>
            <span style="font-size:12px;color:#6b7280;">${timeStr}</span>
        </div>
    </div>`;
};

// PHASE 2.3: Link Previews
app.detectLinks = function(text) {
    var urlRegex = /(https?:\/\/[^\s]+)/g;
    var links = text.match(urlRegex);
    if (links) links.forEach(function(link) { app.fetchLinkPreview(link); });
    return links;
};

app.fetchLinkPreview = function(url) {
    var self = this;

    fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url)).then(function(res) { return res.json(); })
      .then(function(data) {
        var parser = new DOMParser();
        var html = parser.parseFromString(data.contents, 'text/html');

        var title = html.querySelector('meta[property="og:title"]')?.getAttribute('content') || html.querySelector('title')?.textContent || 'Link';
        var description = html.querySelector('meta[property="og:description"]')?.getAttribute('content') || html.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        var image = html.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

        self.displayLinkPreview(url, {title: title, description: description, image: image});
    }).catch(function(err) {
        console.error('Link preview error:', err);
    });
};

app.displayLinkPreview = function(url, metadata) {
    return `<div class="link-preview-card" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:8px 0;cursor:pointer;" onclick="window.open('${url}','_blank');">
        <div style="display:flex;gap:12px;">
            ${metadata.image ? '<img src="' + metadata.image + '" style="width:80px;height:80px;object-fit:cover;">' : ''}
            <div style="flex:1;padding:12px;overflow:hidden;">
                <div style="font-weight:600;font-size:14px;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${metadata.title}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:4px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${metadata.description}</div>
                <div style="font-size:11px;color:#9ca3af;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${new URL(url).hostname}</div>
            </div>
        </div>
    </div>`;
};

// PHASE 2.4: Scroll to Latest
app.showScrollLatestButton = function() {
    var chatMsgs = document.getElementById('chatMessages');
    if (!chatMsgs) return;

    var existing = document.querySelector('.scroll-to-latest-btn');
    if (existing) return;

    var btn = document.createElement('button');
    btn.className = 'scroll-to-latest-btn';
    btn.textContent = '↓ New messages';
    btn.style.cssText = 'position:absolute;bottom:60px;right:20px;background:#2e5bff;color:white;border:none;padding:8px 16px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.1);z-index:100;';
    btn.onclick = function() { app.scrollToLatest(); };

    chatMsgs.parentElement.style.position = 'relative';
    chatMsgs.parentElement.appendChild(btn);
};

app.scrollToLatest = function() {
    var chatMsgs = document.getElementById('chatMessages');
    if (chatMsgs) {
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
        var btn = document.querySelector('.scroll-to-latest-btn');
        if (btn) btn.remove();
    }
};

app.loadExplorePeople = function() {
    var container = document.getElementById('explorePeopleContainer');
    if (!container) return;

    var html = '';

    db.ref('users').orderByChild('followers').limitToLast(12).once('value').then(function(snapshot) {
        var users = snapshot.val() || {};
        var userArray = [];

        var currentUid = (app.user && app.user.uid) ? app.user.uid : null;

        for (var uid in users) {
            if (!currentUid || uid !== currentUid) {
                var user = users[uid];
                userArray.push({ uid: uid, name: user.name, followers: user.followers || 0, username: user.username, profilePhoto: user.profilePhoto });
            }
        }

        userArray.sort(function(a, b) { return (b.followers || 0) - (a.followers || 0); });

        userArray.slice(0, app.isGuest ? 6 : 12).forEach(function(user, index) {
            var isFollowing = app.following[user.uid] || false;
            var profilePhoto = user.profilePhoto || '';
            var initials = user.name ? user.name.charAt(0).toUpperCase() : '?';
            var displayName = app.isGuest ? 'Member ' + String(index + 1).padStart(2, '0') : (user.name || 'Unknown');

            html += '<div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 14px; text-align: center; cursor: pointer; transition: 0.3s;" onmouseover="this.style.boxShadow=\'0 4px 12px rgba(0, 136, 204, 0.15)\'; this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.boxShadow=\'none\'; this.style.transform=\'translateY(0)\'" onclick="app.viewUserProfile(\'' + user.uid + '\')">';

            if (profilePhoto) {
                html += '<img src="' + profilePhoto + '" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; margin: 0 auto 10px; display: block;">';
            } else {
                html += '<div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #006fa3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 18px; margin: 0 auto 10px;">' + initials + '</div>';
            }

            html += '<div class="' + (app.isGuest ? 'guest-explore-name' : '') + '" style="font-weight: 600; font-size: 13px; color: #1a202c; margin-bottom: 4px;">' + displayName + '</div>';
            if (app.isGuest) {
                html += '<div class="guest-explore-meta">Private member</div>';
            } else if (user.username) {
                html += '<div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">@' + user.username + '</div>';
            }
            html += '<div style="font-size: 11px; color: #9ca3af; margin-bottom: 10px;">👥 ' + (user.followers || 0) + '</div>';
            html += '<button onclick="event.stopPropagation(); app.toggleFollow(\'' + user.uid + '\');" style="width: 100%; padding: 8px 12px; background: ' + (isFollowing ? '#ef4444' : '#0088cc') + '; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px;">' + (isFollowing ? '✓ Following' : '+ Follow') + '</button>';
            html += '</div>';
        });

        if (userArray.length === 0) {
            if (app.isGuest) {
                html = '<div style="text-align:center;color:#6b7280;padding:24px;">\n                    <div style="font-size:28px;margin-bottom:6px;">👥</div>\n                    <div style="font-weight:700;margin-bottom:6px;">Sign in to discover people</div>\n                    <div style="color:#9ca3af;margin-bottom:10px;">Sign up or log in to follow creators and get recommendations.</div>\n                    <button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;">🔐 Sign In / Sign Up</button>\n                </div>';
            } else {
                html = '<div style="text-align: center; padding: 24px; color: #9ca3af; grid-column: 1 / -1;">No people yet</div>';
            }
        }

        container.innerHTML = html;
    }).catch(function(err) {
        console.error('Load explore people error:', err);
    });
};

app.searchExplorePeople = function(query) {
    var results = document.getElementById('exploreSearchResults');
    var container = document.getElementById('exploreSearchResultsContainer');
    if (!results || !container) return;

    var term = (query || '').trim().toLowerCase();
    if (!term) {
        results.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    var renderResults = function(users) {
        var matches = Object.keys(users || {}).filter(function(uid) {
            if (app.user && uid === app.user.uid) return false;
            var user = users[uid] || {};
            return [user.name, user.username, user.email].some(function(value) {
                return String(value || '').toLowerCase().indexOf(term) !== -1;
            });
        }).slice(0, 20);

        results.style.display = 'block';
        if (matches.length === 0) {
            container.innerHTML = '<div class="explore-search-empty"><div class="explore-search-empty-icon">🔎</div><div class="explore-search-empty-text">No people found</div></div>';
            return;
        }

        container.innerHTML = matches.map(function(uid) {
            var user = users[uid] || {};
            var name = user.name || 'User';
            var avatar = user.profilePhoto ? '<img src="' + user.profilePhoto + '" alt="">' : '<span>' + name.charAt(0).toUpperCase() + '</span>';
            return '<button type="button" class="explore-search-user" onclick="app.viewUserProfile(\'' + uid + '\')">' +
                '<div class="explore-search-avatar">' + avatar + '</div>' +
                '<div class="explore-search-user-copy"><strong>' + name + '</strong><span>@' + (user.username || 'user') + '</span></div>' +
                '<span class="explore-search-arrow">View</span></button>';
        }).join('');
    };

    if (app.users && Object.keys(app.users).length > 0) {
        renderResults(app.users);
        return;
    }

    if (!db) return;
    db.ref('users').once('value').then(function(snapshot) {
        app.users = snapshot.val() || {};
        renderResults(app.users);
    }).catch(function() {
        results.style.display = 'block';
        container.innerHTML = '<div class="explore-search-empty"><div class="explore-search-empty-icon">⚠️</div><div class="explore-search-empty-text">Search is unavailable right now</div></div>';
    });
};

app.sendPushNotification = function(recipientUid, title, message) {
    if (!recipientUid || !this.user || !this.user.uid) return;
    this.user.getIdToken().then(function(idToken) {
        return fetch('/api/sendPush', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
            body: JSON.stringify({
                recipientUid: recipientUid,
                senderUid: this.user.uid,
                title: title,
                message: message,
                url: '/'
            })
        });
    }.bind(this)).catch(function(error) {
        console.error('Push notification request failed:', error);
    });
};

// ============================================
// ADDITIONAL FUNCTIONS (added to app after definition)
// ============================================

// Admin Modal Toggle
app.toggleAdminModal = function() {
    if (!this.user || !this.isAdmin) {
        if (typeof this.toast === 'function') this.toast('Admin access required', 'error');
        return;
    }
    if (typeof this.openAdminPortal === 'function') {
        this.openAdminPortal();
    } else {
        if (typeof this.toast === 'function') {
            this.toast('Admin portal not ready', 'error');
        }
    }
};


// ============================================
// ADMIN ACCESS MANAGEMENT
// ============================================

app.DEFAULT_ADMINS = ['support-chichi@gmail.com', 'onchari.dev@gmail.com'];
app.isAdmin = false;

// Check if user is admin
app.checkAdminStatus = function() {
    if (!this.user || !this.user.email) {
        this.isAdmin = false;
        return;
    }

    var userEmail = this.user.email.toLowerCase();
    var encodedEmail = userEmail.replace(/\./g, '_'); // Replace dots with underscores for Firebase key
    var isDefaultAdmin = this.DEFAULT_ADMINS.indexOf(userEmail) > -1;

    var self = this;

    db.ref('adminUsers').once('value').then(function(snapshot) {
        var admins = snapshot.val() || {};
        var isCustomAdmin = admins[encodedEmail] || false;

        self.isAdmin = isDefaultAdmin || isCustomAdmin;

        // Show/hide admin button
        var adminBtn = document.getElementById('adminMenuBtn');
        if (adminBtn) {
            adminBtn.style.display = self.isAdmin ? 'block' : 'none';
        }

        console.log('Admin status:', self.isAdmin, 'Email:', userEmail);
    }).catch(function(err) {
        console.error('Error checking admin status:', err);
        // At least show if default admin
        self.isAdmin = isDefaultAdmin;
        var adminBtn = document.getElementById('adminMenuBtn');
        if (adminBtn) {
            adminBtn.style.display = self.isAdmin ? 'block' : 'none';
        }
    });
};

// Load admin list
app.loadAdminList = function() {
    var container = document.getElementById('adminAccessList');
    if (!container) return;

    var self = this;
    var html = '';

    db.ref('adminUsers').once('value').then(function(snapshot) {
        var admins = snapshot.val() || {};

        // Add default admins
        var allAdmins = {};
        self.DEFAULT_ADMINS.forEach(function(email) {
            allAdmins[email] = 'default';
        });

        // Add custom admins (decode email keys by replacing underscores back to dots)
        for (var encodedEmail in admins) {
            var decodedEmail = encodedEmail.replace(/_/g, '.'); // Replace underscores back to dots
            allAdmins[decodedEmail] = 'custom';
        }

        // Display
        for (var email in allAdmins) {
            var isDefault = allAdmins[email] === 'default';
            html += '<div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; gap: 12px;">';
            html += '<div style="flex: 1;"><div style="font-weight: 600; font-size: 14px;">' + email + '</div>';
            if (isDefault) {
                html += '<div style="font-size: 11px; color: #0088cc; font-weight: 500;">⭐ Default Admin</div>';
            }
            html += '</div>';

            // Remove button (only for non-default admins and if user is admin)
            if (!isDefault && self.isAdmin) {
                html += '<button onclick="app.removeAdmin(\'' + email + '\')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Remove</button>';
            }

            html += '</div>';
        }

        if (html === '') {
            html = '<div style="text-align: center; padding: 24px; color: #9ca3af;">No admins yet (only defaults active)</div>';
        }

        container.innerHTML = html;
    }).catch(function(err) {
        console.error('Error loading admin list:', err);
        container.innerHTML = '<div style="color: #ef4444;">Error loading admin list</div>';
    });
};

// Add admin
app.addAdmin = function() {
    if (!this.isAdmin) {
        this.toast('❌ You do not have permission to manage admins', 'error');
        return;
    }

    var emailInput = document.getElementById('newAdminEmail');
    if (!emailInput) return;

    var email = emailInput.value.toLowerCase().trim();

    if (!email || !email.includes('@')) {
        this.toast('❌ Please enter a valid email', 'error');
        return;
    }

    if (email === this.user.email) {
        this.toast('ℹ️ You are already an admin', 'info');
        return;
    }

    var self = this;

    // Encode email for Firebase (replace dots with underscores)
    var encodedEmail = email.replace(/\./g, '_');

    // Add to database
    db.ref('adminUsers/' + encodedEmail).set(true).then(function() {
        self.toast('✅ ' + email + ' is now an admin!', 'success');
        emailInput.value = '';
        self.loadAdminList();
    }).catch(function(err) {
        self.toast('❌ Error adding admin: ' + err.message, 'error');
    });
};

// Remove admin
app.removeAdmin = function(email) {
    if (!this.isAdmin) {
        this.toast('❌ You do not have permission to manage admins', 'error');
        return;
    }

    if (!confirm('Remove ' + email + ' from admin access?')) return;

    var self = this;

    // Encode email for Firebase (replace dots with underscores)
    var encodedEmail = email.replace(/\./g, '_');

    db.ref('adminUsers/' + encodedEmail).remove().then(function() {
        self.toast('✅ ' + email + ' admin access removed', 'success');
        self.loadAdminList();
    }).catch(function(err) {
        self.toast('❌ Error removing admin: ' + err.message, 'error');
    });
};


// ============================================
// PROFILE EDITING
// ============================================

// Show profile settings modal
app.showProfileSettings = function() {
    var self = this;
    if (!this.user) {
        this.toast('❌ Please log in first', 'error');
        return;
    }

    var modal = document.getElementById('editProfileModal');
    if (!modal) {
        this.toast('❌ Edit modal not found', 'error');
        return;
    }

    // Populate fields with current data
    var nameField = document.getElementById('editProfileName');
    var usernameField = document.getElementById('editProfileUsername');
    var phoneField = document.getElementById('editProfilePhone');
    var bioField = document.getElementById('editProfileBio');

    if (nameField) nameField.value = this.profile.name || '';
    if (usernameField) usernameField.value = this.profile.username || '';
    if (phoneField) phoneField.value = this.profile.phone || '';
    if (bioField) bioField.value = this.profile.bio || '';

    // Show modal
    modal.style.display = 'flex';
};

// Close profile settings modal
app.closeProfileSettings = function() {
    var modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'none';
    }
};


// Enhanced Trivia Functions
app.showTriviaReadyScreen = function() {
    var remainingQuestions = this.getQuestionsRemaining();
    if (remainingQuestions <= 0) {
        this.toast('No trivia questions remaining today', 'info');
        return;
    }

    var triviaQuestionArea = document.getElementById('triviaQuestionArea');
    if (!triviaQuestionArea) {
        console.error('triviaQuestionArea not found');
        return;
    }

    triviaQuestionArea.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 70px; margin-bottom: 20px; animation: pulse 2s infinite;">🧠</div>
            <div style="font-size: 24px; font-weight: 700; color: #1a202c; margin-bottom: 12px;">Ready for Trivia?</div>
            <div style="font-size: 15px; color: #6b7280; margin-bottom: 32px;">You have <strong>${remainingQuestions}</strong> questions left today</div>
            <button onclick="app.startTriviaGame();" style="
                padding: 16px 40px;
                background: linear-gradient(135deg, #22c55e, #16a34a);
                color: white;
                border: none;
                border-radius: 12px;
                cursor: pointer;
                font-weight: 700;
                font-size: 18px;
                transition: all 0.3s;
                box-shadow: 0 4px 12px rgba(34,197,94,0.3);
            " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 24px rgba(34,197,94,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(34,197,94,0.3)'">
                ▶️ Start Trivia
            </button>
        </div>
    `;
};

app.startTriviaGame = function() {
    this.generateTriviaQuestion();
};

app.handleTriviaTimeUp = function() {
    this.triviaAnswered = true;

    var resultArea = document.getElementById('triviaResultArea');
    if (resultArea && this.currentTrivia) {
        var correctAnswer = this.currentTrivia.options[this.currentTrivia.correct];
        resultArea.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 18px; font-weight: 700; color: #ef4444; margin-bottom: 8px;">⏰ Time's Up!</div>
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">The correct answer was: <strong>${correctAnswer}</strong></div>
                <button onclick="app.loadNextTriviaQuestion();" style="
                    width: 100%;
                    padding: 12px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                ">📝 Next Question</button>
            </div>
        `;
        resultArea.style.display = 'block';
        resultArea.style.background = '#fee2e2';
    }

    document.querySelectorAll('.trivia-option').forEach(function(btn, index) {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        if (this.currentTrivia && index === this.currentTrivia.correct) {
            btn.style.borderColor = '#22c55e';
            btn.style.background = '#dcfce7';
        }
    }.bind(this));
};

app.animateBalanceIncrease = function(oldBalance, earnedAmount) {
    var newBalance = oldBalance + earnedAmount;
    var currentBalance = oldBalance;
    var increment = earnedAmount / 40; // 40 frames for smooth animation
    var counter = 0;

    var counterInterval = setInterval(function() {
        counter++;
        currentBalance += increment;

        var balanceDisplay = document.getElementById('animatedBalance');
        if (balanceDisplay) {
            balanceDisplay.textContent = currentBalance.toFixed(2);
            balanceDisplay.style.color = '#3b82f6';
            balanceDisplay.style.fontSize = '28px';
        }

        if (counter >= 40) {
            clearInterval(counterInterval);
            if (balanceDisplay) {
                balanceDisplay.textContent = newBalance.toFixed(2);
                balanceDisplay.style.fontSize = '24px';
            }

            var nextBtn = document.getElementById('nextBtn');
            if (nextBtn) {
                nextBtn.style.display = 'block';
            }
        }
    }, 25);
};


// ============================================
// PHASE 1, 2, 3: ALL ADVANCED FEATURES
// ============================================

// PHASE 1: Delivery Status
app.trackDeliveryStatus = function(msgId, status) {
    if (!this.user) return;
    db.ref('messages/' + msgId + '/status').set(status).catch(function(err) {
        console.error('Delivery status error:', err);
    });
};

app.updateMessageStatus = function(msgId, newStatus) {
    var statusMap = {'sent': '✓', 'delivered': '✓✓', 'read': '✓✓✓'};
    var indicator = statusMap[newStatus] || '✓';
    var elem = document.querySelector('[data-msg-id="' + msgId + '"] .delivery-status');
    if (elem) {
        elem.textContent = indicator;
        elem.className = 'delivery-status delivery-' + newStatus;
    }
};

// PHASE 1: Typing Indicators
app.startTypingIndicator = function() {
    if (!this.currentChat || !this.user) return;
    var self = this;
    var key = [self.user.uid, self.currentChat.uid].sort().join('_');
    db.ref('typing/' + key + '/' + self.user.uid).set({typing: true, since: Date.now()});
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(function() { self.stopTypingIndicator(); }, 3000);
};

app.stopTypingIndicator = function() {
    if (!this.currentChat || !this.user) return;
    var key = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('typing/' + key + '/' + this.user.uid).remove();
};

app.displayTypingIndicator = function(userName) {
    var chatMsgs = document.getElementById('chatMessages');
    if (!chatMsgs) return;
    var existing = chatMsgs.querySelector('.typing-indicator');
    if (existing) existing.remove();
    var typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = '<div style="font-size:13px;color:#6b7280;font-style:italic;padding:8px;"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> ' + userName + ' is typing...</div>';
    chatMsgs.appendChild(typingDiv);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
};

app.trackTyping = function() {
    if (!this.currentChat) return;
    var self = this;
    var key = [self.user.uid, self.currentChat.uid].sort().join('_');
    if (this.typingListener) db.ref('typing/' + key).off();
    this.typingListener = db.ref('typing/' + key).on('value', function(snapshot) {
        var typing = snapshot.val();
        var typingUsers = [];
        if (typing) {
            Object.keys(typing).forEach(function(uid) {
                if (uid !== self.user.uid && typing[uid].typing) {
                    typingUsers.push(self.users[uid] ? self.users[uid].name : 'User');
                }
            });
        }
        var existing = document.querySelector('.typing-indicator');
        if (typingUsers.length > 0) {
            if (!existing) self.displayTypingIndicator(typingUsers[0]);
        } else if (existing) {
            existing.remove();
        }
    });
};

// PHASE 1: Online Status
app.updatePresence = function(online) {
    if (!this.user) return;
    db.ref('presence/' + this.user.uid).set({
        online: online,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    }).catch(function(err) { console.error('Presence error:', err); });
};

app.trackPresence = function() {
    if (!this.currentChat || !this.user) return;
    var self = this;
    var otherUserId = this.currentChat.uid;
    if (this.presenceListener) db.ref('presence/' + otherUserId).off();
    this.presenceListener = db.ref('presence/' + otherUserId).on('value', function(snapshot) {
        var presence = snapshot.val();
        var statusText = document.getElementById('statusText');
        var statusDot = document.querySelector('#chatHeaderStatus .status-dot');
        if (!statusText) return;

        if (presence && presence.online) {
            statusText.textContent = 'Online';
            statusText.style.color = '#d9f99d';
            if (statusDot) statusDot.style.background = '#a3e635';
        } else {
            var lastSeen = presence && presence.lastSeen ? self.formatTimeAgo(new Date(presence.lastSeen)) : 'Offline';
            statusText.textContent = lastSeen === 'Offline' ? 'Not online right now 🙂' : 'Not online right now 🙂 I was ' + lastSeen;
            statusText.style.color = 'rgba(255,255,255,0.78)';
            if (statusDot) statusDot.style.background = '#94a3b8';
        }
    });
};

// PHASE 1: Edit/Delete Messages
app.editMessage = function(msgId, chatKey) {
    if (!this.user) return;
    var currentMsg = null;
    if (this.chatMessages && this.chatMessages[chatKey]) {
        this.chatMessages[chatKey].forEach(function(msg) { if (msg && msg.id === msgId) currentMsg = msg; });
    }
    if (!currentMsg) return;
    var modal = document.createElement('div');
    modal.id = 'editMessageModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = '<div style="background:white;border-radius:12px;padding:20px;width:90%;max-width:400px;"><div style="font-size:18px;font-weight:700;margin-bottom:15px;">Edit Message</div><textarea id="editMessageText" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;min-height:80px;">' + (currentMsg.text || '') + '</textarea><div style="display:flex;gap:10px;margin-top:15px;"><button onclick="document.getElementById(\'editMessageModal\').remove();" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;">Cancel</button><button onclick="app.saveEditMessage(\'' + msgId + '\',\'' + chatKey + '\',document.getElementById(\'editMessageText\').value);" style="flex:1;padding:10px;background:#2e5bff;color:white;border:none;border-radius:8px;cursor:pointer;">Save</button></div></div>';
    document.body.appendChild(modal);
};

app.saveEditMessage = function(msgId, chatKey, newText) {
    if (!this.user || !newText.trim()) return;
    var self = this;
    newText = newText.trim();
    db.ref('messages/' + msgId).update({text: newText, edited: true, editedAt: firebase.database.ServerValue.TIMESTAMP}).then(function() {
        db.ref('chats/' + chatKey + '/messages/' + msgId).update({text: newText, edited: true, editedAt: firebase.database.ServerValue.TIMESTAMP});
        document.getElementById('editMessageModal').remove();
        self.displayChatMessages(self.chatMessages[chatKey], chatKey);
    }).catch(function() { self.toast('Error editing message', 'error'); });
};

// PHASE 1: Copy Message
app.copyMessageToClipboard = function(text) {
    var self = this;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() { self.toast('✓ Copied', 'success'); }).catch(function() { self.fallbackCopy(text); });
    } else {
        this.fallbackCopy(text);
    }
};

app.fallbackCopy = function(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.toast('✓ Copied', 'success');
};

// PHASE 2: Emoji Reactions
app.addReaction = function(msgId, emoji) {
    if (!this.user) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('messages/' + msgId + '/reactions/' + emoji).once('value').then(function(snapshot) {
        var users = snapshot.val() || [];
        if (!Array.isArray(users)) users = [];
        if (!users.includes(self.user.uid)) users.push(self.user.uid);
        db.ref('messages/' + msgId + '/reactions/' + emoji).set(users).then(function() {
            db.ref('chats/' + chatKey + '/messages/' + msgId + '/reactions/' + emoji).set(users);
            self.displayChatMessages(self.chatMessages[chatKey], chatKey);
        });
    });
};

app.removeReaction = function(msgId, emoji) {
    if (!this.user) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('messages/' + msgId + '/reactions/' + emoji).once('value').then(function(snapshot) {
        var users = snapshot.val() || [];
        if (!Array.isArray(users)) users = [];
        users = users.filter(function(uid) { return uid !== self.user.uid; });
        if (users.length > 0) {
            db.ref('messages/' + msgId + '/reactions/' + emoji).set(users);
            db.ref('chats/' + chatKey + '/messages/' + msgId + '/reactions/' + emoji).set(users);
        } else {
            db.ref('messages/' + msgId + '/reactions/' + emoji).remove();
            db.ref('chats/' + chatKey + '/messages/' + msgId + '/reactions/' + emoji).remove();
        }
        self.displayChatMessages(self.chatMessages[chatKey], chatKey);
    });
};

// PHASE 2: Voice Messages
app.startVoiceRecording = function() {
    if (!this.user) return;
    var self = this;
    var modal = document.createElement('div');
    modal.id = 'voiceRecordingModal';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;padding:20px;z-index:9999;text-align:center;';
    modal.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:15px;">🎤 Recording...</div><div id="recordingTime" style="font-size:24px;font-weight:700;color:#2e5bff;margin-bottom:15px;">00:00</div><div style="display:flex;gap:10px;"><button onclick="app.stopVoiceRecording();" style="flex:1;padding:10px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;">Stop</button></div>';
    document.body.appendChild(modal);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {
            var mediaRecorder = new MediaRecorder(stream);
            var audioChunks = [];
            self.mediaRecorder = mediaRecorder;
            self.audioChunks = audioChunks;
            self.recordingStartTime = Date.now();
            var timeDisplay = setInterval(function() {
                var elapsed = Math.floor((Date.now() - self.recordingStartTime) / 1000);
                var mins = Math.floor(elapsed / 60);
                var secs = elapsed % 60;
                var timeEl = document.getElementById('recordingTime');
                if (timeEl) timeEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
                if (elapsed > 120) { clearInterval(timeDisplay); self.stopVoiceRecording(); }
            }, 100);
            self.recordingTimeInterval = timeDisplay;
            mediaRecorder.addEventListener('dataavailable', function(event) { audioChunks.push(event.data); });
            mediaRecorder.start();
        }).catch(function() { self.toast('Microphone access denied', 'error'); });
    }
};

app.stopVoiceRecording = function() {
    if (!this.mediaRecorder) return;
    var self = this;
    this.mediaRecorder.stop();
    clearInterval(this.recordingTimeInterval);
    this.mediaRecorder.addEventListener('stop', function() {
        var audioBlob = new Blob(self.audioChunks, {type: 'audio/wav'});
        self.uploadVoiceToCloudinary(audioBlob);
        var modal = document.getElementById('voiceRecordingModal');
        if (modal) modal.remove();
        self.mediaRecorder.stream.getTracks().forEach(function(track) { track.stop(); });
    }, {once: true});
};

app.uploadVoiceToCloudinary = function(audioBlob) {
    if (!this.user) return;
    var self = this;
    var formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', 'chichi_audio');
    formData.append('resource_type', 'auto');
    fetch('https://api.cloudinary.com/v1_1/u1uilb6f/upload', {method: 'POST', body: formData}).then(function(res) { return res.json(); })
      .then(function(data) { if (data.secure_url) self.sendVoiceMessage(data.secure_url, Math.round(audioBlob.size / 8000)); else self.toast('Upload failed', 'error'); })
      .catch(function() { self.toast('Upload error', 'error'); });
};

app.sendVoiceMessage = function(voiceUrl, duration) {
    if (!this.currentChat || !this.user) return;
    var self = this;
    var key = [self.user.uid, self.currentChat.uid].sort().join('_');
    var voiceMsg = {sender: self.user.uid, voiceUrl: voiceUrl, duration: duration, timestamp: firebase.database.ServerValue.TIMESTAMP, status: 'delivered'};
    db.ref('messages/' + key).push().set(voiceMsg).then(function(ref) {
        db.ref('chats/' + key + '/messages/' + ref.key).set(voiceMsg);
        self.displayChatMessages(self.chatMessages[key], key);
        self.toast('🎤 Voice message sent', 'success');
    }).catch(function() { self.toast('Error sending voice message', 'error'); });
};

app.playVoiceMessage = function(voiceUrl) {
    new Audio(voiceUrl).play().catch(function(err) { console.error('Play error:', err); });
};

// PHASE 3: Voice Calls
app.initiateVoiceCall = function() {
    if (!this.currentChat || !this.user) return;
    var self = this;
    var callId = 'call_' + Date.now();
    var callData = {initiator: self.user.uid, recipient: self.currentChat.uid, initiatorName: self.profile.name, status: 'ringing', type: 'audio', startTime: firebase.database.ServerValue.TIMESTAMP};
    db.ref('calls/' + callId).set(callData);
    self.currentCallId = callId;
    self.displayCallUI('outgoing');
    var checkAnswer = setInterval(function() {
        db.ref('calls/' + callId + '/status').once('value').then(function(snapshot) {
            var status = snapshot.val();
            if (status === 'accepted') { clearInterval(checkAnswer); self.connectCall(callId); }
            else if (status === 'declined') { clearInterval(checkAnswer); self.toast('Call declined', 'info'); self.closeCallUI(); }
        });
    }, 1000);
    setTimeout(function() { if (self.currentCallId === callId) { clearInterval(checkAnswer); db.ref('calls/' + callId).update({status: 'missed'}); self.toast('Call timed out', 'info'); self.closeCallUI(); } }, 60000);
};

app.acceptVoiceCall = function() {
    if (!this.currentCallId) return;
    db.ref('calls/' + this.currentCallId).update({status: 'accepted'});
    this.connectCall(this.currentCallId);
};

app.endVoiceCall = function() {
    if (!this.currentCallId) return;
    db.ref('calls/' + this.currentCallId).update({status: 'ended', endTime: firebase.database.ServerValue.TIMESTAMP});
    this.currentCallId = null;
    this.closeCallUI();
};

app.connectCall = function(callId) {
    this.toast('📞 Call connected', 'success');
    this.displayCallUI('connected');
    var self = this;
    this.callStartTime = Date.now();
    this.callTimer = setInterval(function() {
        var duration = Math.floor((Date.now() - self.callStartTime) / 1000);
        var mins = Math.floor(duration / 60);
        var secs = duration % 60;
        var timerEl = document.querySelector('.call-duration');
        if (timerEl) timerEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    }, 1000);
};

app.displayCallUI = function(state) {
    var existing = document.getElementById('callUI');
    if (existing) existing.remove();
    var callUI = document.createElement('div');
    callUI.id = 'callUI';
    callUI.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;';
    var statusText = state === 'outgoing' ? '📞 Calling...' : state === 'connected' ? '📞 Connected' : '📞 Incoming Call';
    callUI.innerHTML = '<div style="text-align:center;color:white;"><div style="font-size:48px;margin-bottom:16px;">👤</div><div style="font-size:20px;font-weight:700;margin-bottom:8px;">' + (this.currentChat ? this.currentChat.name : 'User') + '</div><div style="font-size:14px;color:#cbd5e1;margin-bottom:16px;">' + statusText + '</div>' + (state === 'connected' ? '<div class="call-duration" style="font-size:24px;color:#10b981;font-weight:700;margin-bottom:16px;">00:00</div>' : '') + '<div style="display:flex;gap:16px;justify-content:center;">' + (state === 'outgoing' ? '<button onclick="app.endVoiceCall();" style="width:60px;height:60px;border-radius:50%;background:#ef4444;color:white;border:none;font-size:24px;cursor:pointer;">✕</button>' : state === 'connected' ? '<button onclick="app.endVoiceCall();" style="width:60px;height:60px;border-radius:50%;background:#ef4444;color:white;border:none;font-size:24px;cursor:pointer;">✕</button>' : '<button onclick="app.acceptVoiceCall();" style="width:60px;height:60px;border-radius:50%;background:#10b981;color:white;border:none;font-size:24px;cursor:pointer;">✓</button><button onclick="app.endVoiceCall();" style="width:60px;height:60px;border-radius:50%;background:#ef4444;color:white;border:none;font-size:24px;cursor:pointer;">✕</button>') + '</div></div>';
    document.body.appendChild(callUI);
};

app.closeCallUI = function() {
    var callUI = document.getElementById('callUI');
    if (callUI) callUI.remove();
    if (this.callTimer) clearInterval(this.callTimer);
};

// PHASE 3: Message Pinning
app.pinMessage = function(msgId) {
    if (!this.user || !this.currentChat) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    var msgText = '';
    if (this.chatMessages && this.chatMessages[chatKey]) {
        this.chatMessages[chatKey].forEach(function(msg) { if (msg && msg.id === msgId) msgText = msg.text || '(image)'; });
    }
    db.ref('pinned/' + chatKey + '/' + msgId).set({pinnedAt: firebase.database.ServerValue.TIMESTAMP, pinnedBy: this.user.uid, text: msgText}).then(function() {
        db.ref('messages/' + msgId).update({isPinned: true});
        self.toast('📌 Message pinned', 'success');
        self.displayPinnedMessages();
    });
};

app.unpinMessage = function(msgId) {
    if (!this.user || !this.currentChat) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('pinned/' + chatKey + '/' + msgId).remove().then(function() {
        db.ref('messages/' + msgId).update({isPinned: false});
        self.displayPinnedMessages();
    });
};

app.displayPinnedMessages = function() {
    if (!this.user || !this.currentChat) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('pinned/' + chatKey).once('value').then(function(snapshot) {
        var pinned = snapshot.val();
        var chatHeader = document.querySelector('.chat-header');
        var existing = document.querySelector('.pinned-section');
        if (existing) existing.remove();
        if (pinned && Object.keys(pinned).length > 0) {
            var pinnedHtml = '<div class="pinned-section" style="background:#f0fdf4;border-bottom:1px solid #e5e7eb;padding:12px;display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:600;font-size:12px;color:#059669;">📌 PINNED</div><div style="font-size:13px;color:#1f2937;margin-top:4px;">' + Object.values(pinned)[0].text + '</div></div></div>';
            if (chatHeader) chatHeader.insertAdjacentHTML('afterend', pinnedHtml);
        }
    });
};

// PHASE 3: Message Forwarding
app.forwardMessage = function(msgId) {
    if (!this.user) return;
    var self = this;
    var msgText = '';
    Object.keys(this.chatMessages || {}).forEach(function(key) {
        if (self.chatMessages[key]) {
            self.chatMessages[key].forEach(function(msg) { if (msg && msg.id === msgId) msgText = msg.text || '(image)'; });
        }
    });
    var conversations = [];
    db.ref('messages').once('value').then(function(snapshot) {
        if (snapshot.val()) {
            Object.keys(snapshot.val()).forEach(function(chatKey) {
                if (chatKey.includes(self.user.uid)) {
                    var parts = chatKey.split('_');
                    var otherUserId = parts[0] === self.user.uid ? parts[1] : parts[0];
                    if (self.users[otherUserId] && self.users[otherUserId].name) {
                        conversations.push({uid: otherUserId, name: self.users[otherUserId].name, chatKey: chatKey});
                    }
                }
            });
        }
        var modal = document.createElement('div');
        modal.id = 'forwardModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
        modal.innerHTML = '<div style="background:white;border-radius:12px;padding:20px;width:90%;max-width:400px;"><div style="font-size:18px;font-weight:700;margin-bottom:15px;">Forward to:</div>' + conversations.map(function(conv) {
            return '<div onclick="app.sendForwardedMessage(\'' + msgText.replace(/'/g, "\\'") + '\',\'' + conv.chatKey + '\');document.getElementById(\'forwardModal\').remove();" style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;cursor:pointer;">' + conv.name + '</div>';
        }).join('') + '</div>';
        document.body.appendChild(modal);
    });
};

app.sendForwardedMessage = function(text, targetChatKey) {
    if (!this.user) return;
    var self = this;
    var msg = {text: text, sender: this.user.uid, timestamp: firebase.database.ServerValue.TIMESTAMP, status: 'delivered', forward: {fromUserId: this.currentChat.uid, fromUserName: this.currentChat.name}};
    db.ref('messages/' + targetChatKey).push().set(msg).then(function(ref) {
        db.ref('chats/' + targetChatKey + '/messages/' + ref.key).set(msg);
        self.toast('↪️ Message forwarded', 'success');
    });
};

// PHASE 3: Media Gallery
app.loadMediaGallery = function() {
    if (!this.currentChat) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    var images = [];
    if (this.chatMessages && this.chatMessages[chatKey]) {
        this.chatMessages[chatKey].forEach(function(msg) { if (msg && msg.image) images.push(msg.image); });
    }
    this.displayMediaGallery(images);
};

app.displayMediaGallery = function(images) {
    var modal = document.createElement('div');
    modal.id = 'mediaGalleryModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;overflow-y:auto;padding:20px;';
    modal.innerHTML = '<div style="max-width:1200px;margin:0 auto;"><div style="text-align:right;margin-bottom:15px;"><button onclick="document.getElementById(\'mediaGalleryModal\').remove();" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">Close</button></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">' + images.map(function(img) {
        return '<img src="' + img + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;" onclick="app.viewMediaInFull(\'' + img + '\');"/>';
    }).join('') + '</div></div>';
    document.body.appendChild(modal);
};

app.viewMediaInFull = function(imageUrl) {
    var fullView = document.createElement('div');
    fullView.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;z-index:10000;';
    fullView.innerHTML = '<img src="' + imageUrl + '" style="max-width:90%;max-height:90%;"/><button onclick="this.parentElement.remove();" style="position:absolute;top:20px;right:20px;background:#ef4444;color:white;border:none;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;">×</button>';
    document.body.appendChild(fullView);
};

// PHASE 3: Mute Conversations
app.muteConversation = function() {
    if (!this.user || !this.currentChat) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('muted/' + this.user.uid + '/' + chatKey).set(true).then(function() {
        self.toast('🔕 Chat muted', 'success');
        self.displayMuteStatus();
    });
};

app.unmuteConversation = function() {
    if (!this.user || !this.currentChat) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('muted/' + this.user.uid + '/' + chatKey).remove().then(function() {
        self.toast('🔔 Chat unmuted', 'success');
        self.displayMuteStatus();
    });
};

app.displayMuteStatus = function() {
    if (!this.user || !this.currentChat) return;
    var self = this;
    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    db.ref('muted/' + this.user.uid + '/' + chatKey).once('value').then(function(snapshot) {
        var isMuted = snapshot.val();
        var chatHeader = document.querySelector('.chat-header-mute');
        if (chatHeader) {
            if (isMuted) {
                chatHeader.innerHTML = '🔕 Muted';
                chatHeader.style.color = '#ef4444';
            } else {
                chatHeader.innerHTML = '🔔 Unmuted';
                chatHeader.style.color = '#10b981';
            }
        }
    });
};

// PHASE 3: Call Notifications
app.showCallNotification = function(callerName) {
    var notification = document.createElement('div');
    notification.style.cssText = 'position:fixed;top:20px;right:20px;background:white;border-radius:12px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:10000;';
    notification.innerHTML = '<div style="font-weight:700;margin-bottom:8px;">📞 ' + callerName + ' is calling...</div><div style="display:flex;gap:8px;"><button onclick="app.acceptVoiceCall();this.parentElement.parentElement.remove();" style="flex:1;padding:8px 16px;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;">Accept</button><button onclick="app.endVoiceCall();this.parentElement.parentElement.remove();" style="flex:1;padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;">Decline</button></div>';
    document.body.appendChild(notification);
    this.playRingtone();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

app.showMissedCallNotification = function(callerName) {
    var notification = document.createElement('div');
    notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#fef2f2;border-radius:12px;padding:16px;z-index:10000;border:1px solid #fee2e2;';
    notification.innerHTML = '<div style="color:#991b1b;font-weight:600;">📵 Missed call from ' + callerName + '</div>';
    document.body.appendChild(notification);
    setTimeout(function() { notification.remove(); }, 5000);
};

app.playRingtone = function() {
    var context = new (window.AudioContext || window.webkitAudioContext)();
    var osc = context.createOscillator();
    var gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, context.currentTime);
    osc.start(context.currentTime);
    osc.stop(context.currentTime + 0.5);
};

// UI RESTRUCTURE
app.removeHeaderDarkMode = function() {
    var btn = document.getElementById('darkModeToggle');
    if (btn) btn.style.display = 'none';
};

app.addSettingsThemeToggle = function() {
    var settings = document.querySelector('.settings-menu');
    if (settings) {
        settings.innerHTML += '<div style="padding:16px;border-top:1px solid #e5e7eb;"><div style="font-weight:600;margin-bottom:8px;">🌙 Theme</div><label style="display:flex;gap:8px;margin-bottom:8px;"><input type="radio" name="theme" value="light" onchange="app.setTheme(\'light\');" style="cursor:pointer;"/><span>Light</span></label><label style="display:flex;gap:8px;"><input type="radio" name="theme" value="dark" onchange="app.setTheme(\'dark\');" style="cursor:pointer;"/><span>Dark</span></label></div>';
    }
};

app.setTheme = function(theme) {
    localStorage.setItem('chichi-theme', theme);
    if (theme === 'dark') {
        document.body.style.filter = 'invert(1) hue-rotate(180deg)';
    } else {
        document.body.style.filter = 'none';
    }
    this.toast('Theme: ' + theme, 'success');
};


// Video Call Functions (additional)
app.initiateVideoCall = function() {
    if (!this.currentChat || !this.user) return;
    var callId = 'call_' + Date.now();
    var callData = {initiator: this.user.uid, recipient: this.currentChat.uid, status: 'ringing', type: 'video', startTime: firebase.database.ServerValue.TIMESTAMP};
    db.ref('calls/' + callId).set(callData);
    this.currentCallId = callId;
    this.displayVideoCallUI('outgoing');
};

app.acceptVideoCall = function() {
    if (!this.currentCallId) return;
    db.ref('calls/' + this.currentCallId).update({status: 'accepted'});
    this.connectCall(this.currentCallId);
};

app.displayVideoCallUI = function(state) {
    var existing = document.getElementById('videoCallUI');
    if (existing) existing.remove();
    var callUI = document.createElement('div');
    callUI.id = 'videoCallUI';
    callUI.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;';
    callUI.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;"><video id="remoteVideo" style="width:100%;height:100%;object-fit:cover;"></video><div style="position:absolute;bottom:100px;right:20px;width:100px;height:133px;background:#1f2937;border-radius:8px;overflow:hidden;"><video id="miniLocalVideo" style="width:100%;height:100%;object-fit:cover;"></video></div></div><div style="background:rgba(0,0,0,0.7);padding:16px;display:flex;gap:12px;justify-content:center;width:100%;"><button style="width:50px;height:50px;border-radius:50%;background:#475569;color:white;border:none;font-size:20px;cursor:pointer;">📹</button><button style="width:50px;height:50px;border-radius:50%;background:#475569;color:white;border:none;font-size:20px;cursor:pointer;">🎤</button><button onclick="app.endVoiceCall();" style="width:50px;height:50px;border-radius:50%;background:#ef4444;color:white;border:none;font-size:20px;cursor:pointer;">✕</button></div>';
    document.body.appendChild(callUI);
};

// ============ ADMIN EMAIL SYSTEM ============

app.updateEmailRecipients = function() {
    const type = document.getElementById('emailRecipientType').value;
    const specificDiv = document.getElementById('emailSpecificUserDiv');

    if (type === 'specific') {
        specificDiv.style.display = 'block';
    } else {
        specificDiv.style.display = 'none';
    }
};


app.searchUsersForEmail = function(query) {
    if (!query.trim()) {
        document.getElementById('emailUserResults').style.display = 'none';
        return;
    }

    const db = firebase.database();
    db.ref('users').once('value', function(snap) {
        const users = snap.val() || {};
        const results = document.getElementById('emailUserResults');
        const searchQuery = query.toLowerCase();

        let html = '';
        Object.entries(users).forEach(function(entry) {
            const uid = entry[0];
            const user = entry[1];

            // Add null checks to prevent errors
            if (!user || !user.name || !user.email) {
                return; // Skip this user if missing data
            }

            const userName = user.name || '';
            const userEmail = user.email || '';

            if (userName.toLowerCase().includes(searchQuery) || userEmail.toLowerCase().includes(searchQuery)) {
                html += '<div style="padding:10px;border-bottom:1px solid #e5e7eb;cursor:pointer;background:white;" onclick="app.selectEmailUser(\'' + uid + '\', \'' + userName.replace(/'/g, "\\'") + '\', \'' + userEmail + '\')" onmouseover="this.style.background=\'#f3f4f6\'" onmouseout="this.style.background=\'white\'"><div style="font-weight:600;font-size:14px;color:#1a202c;">' + userName + '</div><div style="font-size:12px;color:#6b7280;">' + userEmail + '</div></div>';
            }
        });

        if (html) {
            results.innerHTML = html;
            results.style.display = 'block';
        } else {
            results.innerHTML = '<div style="padding:10px;color:#6b7280;font-size:14px;">No users found</div>';
            results.style.display = 'block';
        }
    });
};

app.selectEmailUser = function(uid, name, email) {
    document.getElementById('selectedEmailUserId').value = uid;
    document.getElementById('emailUserSearch').value = name;
    document.getElementById('emailUserResults').style.display = 'none';
};

app.previewEmail = function() {
    const subject = document.getElementById('emailSubject').value;
    const content = document.getElementById('emailContent').value;
    const ctaText = document.getElementById('emailCTAText').value;
    const ctaURL = document.getElementById('emailCTAURL').value;

    if (!subject.trim() || !content.trim()) {
        app.toast('Please fill in subject and message', 'error');
        return;
    }

    let emailHTML = '<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;"><div style="background:linear-gradient(135deg,#0A0E1F 0%,#2E5BFF 100%);padding:30px;text-align:center;border-radius:12px 12px 0 0;"><img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1785150967/53168_pz8kju.png" style="max-width:100px;height:auto;display:block;margin:0 auto;border-radius:8px;"></div><div style="background:white;padding:30px;border-radius:0 0 12px 12px;color:#1a202c;"><div style="font-size:16px;line-height:1.6;margin-bottom:20px;white-space:pre-wrap;">' + content + '</div>' + (ctaText && ctaURL ? '<div style="text-align:center;margin-top:30px;"><a href="' + ctaURL + '" style="background:#2E5BFF;color:white;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">' + ctaText + '</a></div>' : '') + '<div style="margin-top:30px;border-top:1px solid #e5e7eb;padding-top:20px;font-size:12px;color:#6b7280;text-align:center;">© 2026 Onchari Group • CHICHI</div></div></div>';

    const modal = document.getElementById('emailPreviewModal');
    const frame = document.getElementById('emailPreviewFrame');
    frame.srcdoc = emailHTML;
    modal.style.display = 'flex';
};

app.closeEmailPreview = function() {
    document.getElementById('emailPreviewModal').style.display = 'none';
};

// FIXED sendBulkEmail - Copy this into your app.js to replace the broken function

app.sendBulkEmail = function() {
    const recipientType = document.getElementById('emailRecipientType').value;
    const subject = document.getElementById('emailSubject').value;
    const content = document.getElementById('emailContent').value;
    const selectedUserId = document.getElementById('selectedEmailUserId').value;
    const ctaText = document.getElementById('emailCTAText').value;
    const ctaURL = document.getElementById('emailCTAURL').value;

    // Validation
    if (!subject.trim() || !content.trim()) {
        app.toast('Please fill in subject and message', 'error');
        return;
    }

    if (recipientType === 'specific' && !selectedUserId) {
        app.toast('Please select a user', 'error');
        return;
    }

    // FIX: Don't use event.target - it might be undefined!
    // Instead, find the button directly
    const btn = document.querySelector('button[onclick*="sendBulkEmail"]');
    if (!btn) {
        console.error('Send button not found');
        return;
    }

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '⏳ Sending...';

    const db = firebase.database();

    // FIX: Use configurable sender email
    const SENDER_EMAIL = 'support@chichi.buzz'; // CHANGE THIS TO YOUR DOMAIN!
    const SENDER_NAME = 'CHICHI Admin';

    (function() {
        var recipients = [];
        var processed = false;

        function sendEmails() {
            if (processed) return;
            processed = true;

            const batchSize = 50;
            let successCount = 0;

            function sendBatch(startIdx) {
                if (startIdx >= recipients.length) {
                    // Log to Firebase
                    db.ref('admin/emailLogs').push({
                        subject: subject,
                        recipientType: recipientType,
                        recipientCount: recipients.length,
                        successCount: successCount,
                        sentBy: app.user.email,
                        sentAt: new Date().toISOString()
                    });

                    // Show success message
                    app.toast('✅ Email sent to ' + successCount + '/' + recipients.length + ' users!', 'success');

                    // Clear form
                    document.getElementById('emailSubject').value = '';
                    document.getElementById('emailContent').value = '';
                    document.getElementById('emailRecipientType').value = 'all';
                    document.getElementById('emailAddCTA').checked = false;
                    document.getElementById('emailCTADiv').style.display = 'none';
                    document.getElementById('emailSpecificUserDiv').style.display = 'none';
                    document.getElementById('selectedEmailUserId').value = '';
                    document.getElementById('emailUserSearch').value = '';

                    // Reset button
                    btn.innerText = originalText;
                    btn.disabled = false;
                    return;
                }

                const batch = recipients.slice(startIdx, startIdx + batchSize);
                let batchComplete = 0;

                batch.forEach(function(user) {
                    // Build email body
                    const emailBody = '<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;"><div style="background:linear-gradient(135deg,#0A0E1F 0%,#2E5BFF 100%);padding:30px;text-align:center;border-radius:12px 12px 0 0;"><img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1785150967/53168_pz8kju.png" style="max-width:100px;height:auto;display:block;margin:0 auto;border-radius:8px;"></div><div style="background:white;padding:30px;border-radius:0 0 12px 12px;color:#1a202c;"><div style="font-size:16px;line-height:1.6;margin-bottom:20px;white-space:pre-wrap;">' + content.replace(/{{USER_NAME}}/g, user.name) + '</div>' + (ctaText && ctaURL ? '<div style="text-align:center;margin-top:30px;"><a href="' + ctaURL + '" style="background:#2E5BFF;color:white;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">' + ctaText + '</a></div>' : '') + '<div style="margin-top:30px;border-top:1px solid #e5e7eb;padding-top:20px;font-size:12px;color:#6b7280;text-align:center;">© 2026 Onchari Group • CHICHI</div></div></div>';

                    // Send via API
                    fetch('/api/sendEmail', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: user.email,
                            subject: subject,
                            htmlContent: emailBody,
                            senderEmail: SENDER_EMAIL,  // FIX: Use variable instead of hardcoded
                            senderName: SENDER_NAME
                        })
                    })
                    .then(function(r) {
                        return r.json();
                    })
                    .then(function(data) {
                        if (data.success) {
                            successCount++;
                        } else {
                            console.error('Failed to send to ' + user.email + ': ' + data.error);
                        }
                        batchComplete++;
                        if (batchComplete === batch.length) {
                            sendBatch(startIdx + batchSize);
                        }
                    })
                    .catch(function(err) {
                        console.error('Email error for ' + user.email + ':', err);
                        batchComplete++;
                        if (batchComplete === batch.length) {
                            sendBatch(startIdx + batchSize);
                        }
                    });
                });
            }

            sendBatch(0);
        }

        if (recipientType === 'all') {
            db.ref('users').once('value', function(snap) {
                const users = snap.val() || {};
                recipients = Object.entries(users).map(function(entry) {
                    return { uid: entry[0], name: entry[1].name, email: entry[1].email };
                });
                sendEmails();
            });
        } else if (recipientType === 'followers') {
            const uid = app.user.uid;
            db.ref('followers/' + uid).once('value', function(snap) {
                const followers = snap.val() || {};
                let followerCount = Object.keys(followers).length;
                let processed = 0;

                Object.keys(followers).forEach(function(followerUid) {
                    db.ref('users/' + followerUid).once('value', function(userSnap) {
                        const user = userSnap.val();
                        if (user) {
                            recipients.push({ uid: followerUid, name: user.name, email: user.email });
                        }
                        processed++;
                        if (processed === followerCount) {
                            sendEmails();
                        }
                    });
                });

                if (followerCount === 0) {
                    sendEmails();
                }
            });
        } else if (recipientType === 'specific') {
            db.ref('users/' + selectedUserId).once('value', function(snap) {
                const user = snap.val();
                if (user) {
                    recipients = [{ uid: selectedUserId, name: user.name, email: user.email }];
                }
                sendEmails();
            });
        }
    })();
};
// ============ END EMAIL SYSTEM ============

// ============ EMAIL TEMPLATE SYSTEM ============

const EMAIL_TEMPLATES = {
    // Template 1: Generic Newsletter
    generic: {
        name: 'Generic Newsletter',
        description: 'General message or announcement',
        subject: 'Update from CHICHI',
        template: function(userName, message, ctaText, ctaURL) {
            return `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
    <div style="background:linear-gradient(135deg,#0A0E1F 0%,#2E5BFF 100%);padding:40px 30px;text-align:center;border-radius:12px 12px 0 0;">
        <img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1785150967/53168_pz8kju.png" style="width:80px;height:80px;border-radius:12px;margin-bottom:15px;">
        <div style="color:white;font-size:24px;font-weight:700;letter-spacing:0.5px;">CHICHI</div>
    </div>
    <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;color:#1a202c;">
        <div style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:30px;">
            <p style="margin:0 0 15px 0;"><strong>Hi ${userName},</strong></p>
            <div style="white-space:pre-wrap;color:#4b5563;font-size:15px;">${message}</div>
        </div>
        ${ctaText && ctaURL ? `<div style="text-align:center;margin:30px 0;"><a href="${ctaURL}" style="background:linear-gradient(135deg,#2E5BFF 0%,#1e40af 100%);color:white;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;box-shadow:0 4px 15px rgba(46,91,255,0.3);">${ctaText}</a></div>` : ''}
        <div style="margin-top:40px;padding-top:30px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;"><p style="margin:0 0 10px 0;">© 2026 Onchari Group • CHICHI</p></div>
    </div>
</div>
            `;
        }
    },
    incomplete_profile: {
        name: 'Incomplete Profile',
        description: 'Remind users to complete their profile',
        subject: '⚠️ Complete Your CHICHI Profile',
        template: function(userName, message) {
            return `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
    <div style="background:linear-gradient(135deg,#0A0E1F 0%,#2E5BFF 100%);padding:40px 30px;text-align:center;border-radius:12px 12px 0 0;">
        <img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1785150967/53168_pz8kju.png" style="width:80px;height:80px;border-radius:12px;margin-bottom:15px;">
        <div style="color:white;font-size:24px;font-weight:700;">CHICHI</div>
    </div>
    <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;color:#1a202c;">
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:15px;border-radius:6px;margin-bottom:30px;">
            <div style="font-weight:600;color:#d97706;margin-bottom:8px;">⚠️ Action Required</div>
            <div style="font-size:14px;color:#92400e;">Your profile is incomplete. Please complete your information to unlock all features.</div>
        </div>
        <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;"><strong>Hi ${userName},</strong></p>
        <div style="background:#f0f7ff;padding:20px;border-radius:8px;margin-bottom:30px;border-left:4px solid #2E5BFF;">
            <div style="color:#1e40af;font-weight:600;margin-bottom:10px;">📝 What's Missing?</div>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;"><li style="margin-bottom:8px;">Username</li><li style="margin-bottom:8px;">Profile Photo</li><li>Bio & Interests</li></ul>
        </div>
        <p style="font-size:14px;color:#4b5563;line-height:1.8;margin-bottom:30px;white-space:pre-wrap;">${message}</p>
        <div style="text-align:center;margin:30px 0;"><a href="https://chichi.buzz/settings" style="background:linear-gradient(135deg,#2E5BFF 0%,#1e40af 100%);color:white;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;box-shadow:0 4px 15px rgba(46,91,255,0.3);">Complete Profile Now</a></div>
        <div style="margin-top:40px;padding-top:30px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;"><p style="margin:0;">© 2026 Onchari Group • CHICHI</p></div>
    </div>
</div>
            `;
        }
    },
    award: {
        name: 'Award Notification',
        description: 'Congratulate users on achievements',
        subject: '🎉 Congratulations, {{USER_NAME}}!',
        template: function(userName, message) {
            return `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
    <div style="background:linear-gradient(135deg,#0A0E1F 0%,#2E5BFF 100%);padding:40px 30px;text-align:center;border-radius:12px 12px 0 0;">
        <div style="font-size:50px;margin-bottom:15px;">🏆</div>
        <img src="https://res.cloudinary.com/u1uilb6f/image/upload/v1785150967/53168_pz8kju.png" style="width:80px;height:80px;border-radius:12px;margin-bottom:15px;">
        <div style="color:white;font-size:24px;font-weight:700;">Achievement Unlocked!</div>
    </div>
    <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;color:#1a202c;">
        <div style="background:linear-gradient(135deg,#fef3c7 0%,#fcd34d 100%);padding:20px;border-radius:8px;margin-bottom:30px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#92400e;margin-bottom:10px;">Congratulations!</div>
            <div style="color:#78350f;font-size:16px;font-weight:600;">${userName}</div>
        </div>
        <div style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:30px;white-space:pre-wrap;">${message}</div>
        <div style="background:#f0fdf4;padding:20px;border-radius:8px;margin-bottom:30px;border-left:4px solid #22c55e;">
            <div style="color:#166534;font-weight:600;margin-bottom:10px;">✨ Your Achievement</div>
            <div style="color:#374151;font-size:14px;">You've shown exceptional engagement and contribution to the CHICHI community!</div>
        </div>
        <div style="text-align:center;margin:30px 0;"><a href="https://chichi.buzz/profile" style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:white;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;box-shadow:0 4px 15px rgba(34,197,94,0.3);">View Your Achievement</a></div>
        <div style="margin-top:40px;padding-top:30px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;"><p style="margin:0;">© 2026 Onchari Group • CHICHI</p></div>
    </div>
</div>
            `;
        }
    },
    account_issue: {
        name: 'Account Issue Notice',
        description: 'Notify user of account issues that need fixing',
        subject: '⚠️ Action Needed: Account Issue',
        template: function(userName, message) {
            return `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
    <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:40px 30px;text-align:center;border-radius:12px 12px 0 0;">
        <div style="font-size:50px;margin-bottom:15px;">⚠️</div>
        <div style="color:white;font-size:24px;font-weight:700;">Action Required</div>
    </div>
    <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;color:#1a202c;">
        <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:15px;border-radius:6px;margin-bottom:30px;">
            <div style="font-weight:600;color:#991b1b;margin-bottom:8px;">⚠️ Important Notice</div>
            <div style="font-size:14px;color:#7f1d1d;">We've detected an issue with your account that needs your attention.</div>
        </div>
        <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;"><strong>Hi ${userName},</strong></p>
        <div style="background:#f8f8f8;padding:20px;border-radius:8px;margin-bottom:30px;border-left:4px solid #dc2626;">
            <div style="color:#991b1b;font-weight:600;margin-bottom:10px;">Issue Details:</div>
            <div style="color:#374151;font-size:14px;line-height:1.8;white-space:pre-wrap;">${message}</div>
        </div>
        <p style="font-size:14px;color:#4b5563;margin-bottom:30px;">Please fix this issue within <strong>48 hours</strong> to avoid account restrictions.</p>
        <div style="text-align:center;margin:30px 0;"><a href="https://chichi.buzz/settings" style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);color:white;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;box-shadow:0 4px 15px rgba(220,38,38,0.3);">Fix Issue Now</a></div>
        <div style="margin-top:40px;padding-top:30px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;"><p style="margin:0;">© 2026 Onchari Group • CHICHI</p></div>
    </div>
</div>
            `;
        }
    },
    policy_violation: {
        name: 'Policy Violation Notice',
        description: 'Notify about content violations',
        subject: '🚫 Content Violation Notice',
        template: function(userName, message) {
            return `
<div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f8fafc;">
    <div style="background:linear-gradient(135deg,#ea580c 0%,#c2410c 100%);padding:40px 30px;text-align:center;border-radius:12px 12px 0 0;">
        <div style="font-size:50px;margin-bottom:15px;">🚫</div>
        <div style="color:white;font-size:24px;font-weight:700;">Content Violation</div>
    </div>
    <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;color:#1a202c;">
        <div style="background:#fed7aa;border-left:4px solid #ea580c;padding:15px;border-radius:6px;margin-bottom:30px;">
            <div style="font-weight:600;color:#9a3412;margin-bottom:8px;">🚫 Policy Violation</div>
            <div style="font-size:14px;color:#78350f;">One or more of your posts violate our community guidelines.</div>
        </div>
        <p style="font-size:16px;line-height:1.8;color:#374151;margin-bottom:20px;"><strong>Hi ${userName},</strong></p>
        <div style="background:#f8f8f8;padding:20px;border-radius:8px;margin-bottom:30px;border-left:4px solid #ea580c;">
            <div style="color:#9a3412;font-weight:600;margin-bottom:10px;">📋 Reason for Removal:</div>
            <div style="color:#374151;font-size:14px;line-height:1.8;white-space:pre-wrap;">${message}</div>
        </div>
        <div style="background:#fef3c7;padding:15px;border-radius:8px;margin-bottom:30px;">
            <div style="font-weight:600;color:#92400e;margin-bottom:10px;">What You Should Do:</div>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;"><li>Review our Community Guidelines</li><li>Remove or edit the offending content</li><li>Resubmit your post if it complies</li></ul>
        </div>
        <div style="text-align:center;margin:30px 0;"><a href="https://chichi.buzz/guidelines" style="background:linear-gradient(135deg,#ea580c 0%,#c2410c 100%);color:white;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;box-shadow:0 4px 15px rgba(234,88,12,0.3);">View Guidelines</a></div>
        <div style="margin-top:40px;padding-top:30px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;"><p style="margin:0;">© 2026 Onchari Group • CHICHI</p></div>
    </div>
</div>
            `;
        }
    }
};

window.EMAIL_TEMPLATES = EMAIL_TEMPLATES;

// Initialize template system
app.initTemplateSystem = function() {
    const templateSelect = document.getElementById('emailTemplate');
    if (!templateSelect) return;

    templateSelect.addEventListener('change', function() {
        const selectedTemplate = EMAIL_TEMPLATES[this.value];
        if (selectedTemplate) {
            document.getElementById('emailSubject').value = selectedTemplate.subject;
            document.getElementById('emailContent').value = '';
            const templateHint = {
                'generic': '✍️ Write your announcement or message here...',
                'incomplete_profile': '✍️ Users with incomplete profiles will receive this.',
                'award': '✍️ Congratulate the user on their achievement!',
                'account_issue': '✍️ Describe the account issue that needs fixing.',
                'policy_violation': '✍️ Explain why the content violates guidelines.'
            };
            const textarea = document.getElementById('emailContent');
            textarea.placeholder = templateHint[this.value] || 'Write your message...';
            textarea.focus();
        }
    });
};

// Updated previewEmail with template support
app.previewEmail = function() {
    const templateKey = document.getElementById('emailTemplate').value;
    const selectedTemplate = EMAIL_TEMPLATES[templateKey];

    if (!selectedTemplate) {
        app.toast('Template not found', 'error');
        return;
    }

    const subject = document.getElementById('emailSubject').value;
    const message = document.getElementById('emailContent').value;
    const ctaText = document.getElementById('emailCTAText').value;
    const ctaURL = document.getElementById('emailCTAURL').value;

    if (!message.trim()) {
        app.toast('Please write a message', 'error');
        return;
    }

    const emailHTML = selectedTemplate.template('Anthony Onchari', message, ctaText, ctaURL);

    const iframe = document.getElementById('emailPreviewFrame');
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(emailHTML);
    iframeDoc.close();

    document.getElementById('emailPreviewModal').style.display = 'block';
};

// Updated sendBulkEmail with template support
app.sendBulkEmail = function() {
    const templateKey = document.getElementById('emailTemplate').value;
    const selectedTemplate = EMAIL_TEMPLATES[templateKey];

    if (!selectedTemplate) {
        app.toast('Template not found', 'error');
        return;
    }

    const recipientType = document.querySelector('input[name="emailRecipientType"]:checked').value;
    const subject = document.getElementById('emailSubject').value;
    const content = document.getElementById('emailContent').value;
    const selectedUserId = document.getElementById('selectedEmailUserId').value;
    const ctaText = document.getElementById('emailCTAText').value;
    const ctaURL = document.getElementById('emailCTAURL').value;

    if (!subject.trim() || !content.trim()) {
        app.toast('Please fill in subject and message', 'error');
        return;
    }

    if (recipientType === 'specific' && !selectedUserId) {
        app.toast('Please select a user', 'error');
        return;
    }

    const btn = document.querySelector('button[onclick*="sendBulkEmail"]');
    if (!btn) {
        console.error('Send button not found');
        return;
    }

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '⏳ Sending...';

    const db = firebase.database();
    const SENDER_EMAIL = 'support@chichi.buzz';
    const SENDER_NAME = 'CHICHI Admin';

    (function() {
        var recipients = [];
        var processed = false;

        function sendEmails() {
            if (processed) return;
            processed = true;

            const batchSize = 50;
            let successCount = 0;

            function sendBatch(startIdx) {
                if (startIdx >= recipients.length) {
                    db.ref('admin/emailLogs').push({
                        subject: subject,
                        templateUsed: templateKey,
                        recipientType: recipientType,
                        recipientCount: recipients.length,
                        successCount: successCount,
                        sentBy: app.user.email,
                        sentAt: new Date().toISOString()
                    });

                    app.toast('✅ Email sent to ' + successCount + '/' + recipients.length + ' users!', 'success');

                    document.getElementById('emailSubject').value = '';
                    document.getElementById('emailContent').value = '';
                    document.getElementById('emailTemplate').value = 'generic';
                    document.querySelector('input[name="emailRecipientType"][value="all"]').checked = true;
                    document.getElementById('emailAddCTA').checked = false;
                    document.getElementById('emailCTADiv').style.display = 'none';
                    document.getElementById('emailSpecificUserDiv').style.display = 'none';
                    document.getElementById('selectedEmailUserId').value = '';
                    document.getElementById('emailUserSearch').value = '';
                    document.getElementById('selectedUserDisplay').style.display = 'none';

                    btn.innerText = originalText;
                    btn.disabled = false;
                    return;
                }

                const batch = recipients.slice(startIdx, startIdx + batchSize);
                let batchComplete = 0;

                batch.forEach(function(user) {
                    const emailBody = selectedTemplate.template(user.name, content, ctaText, ctaURL);

                    fetch('/api/sendEmail', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: user.email,
                            subject: subject,
                            htmlContent: emailBody,
                            senderEmail: SENDER_EMAIL,
                            senderName: SENDER_NAME
                        })
                    })
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success) { successCount++; }
                        batchComplete++;
                        if (batchComplete === batch.length) { sendBatch(startIdx + batchSize); }
                    })
                    .catch(function(err) {
                        console.error('Email error:', err);
                        batchComplete++;
                        if (batchComplete === batch.length) { sendBatch(startIdx + batchSize); }
                    });
                });
            }

            sendBatch(0);
        }

        if (recipientType === 'all') {
            db.ref('users').once('value', function(snap) {
                const users = snap.val() || {};
                recipients = Object.entries(users).map(function(entry) {
                    return { uid: entry[0], name: entry[1].name, email: entry[1].email };
                });
                sendEmails();
            });
        } else if (recipientType === 'followers') {
            const uid = app.user.uid;
            db.ref('followers/' + uid).once('value', function(snap) {
                const followers = snap.val() || {};
                let followerCount = Object.keys(followers).length;
                let processed = 0;
                Object.keys(followers).forEach(function(followerUid) {
                    db.ref('users/' + followerUid).once('value', function(userSnap) {
                        const user = userSnap.val();
                        if (user) {
                            recipients.push({ uid: followerUid, name: user.name, email: user.email });
                        }
                        processed++;
                        if (processed === followerCount) { sendEmails(); }
                    });
                });
                if (followerCount === 0) { sendEmails(); }
            });
        } else if (recipientType === 'specific') {
            db.ref('users/' + selectedUserId).once('value', function(snap) {
                const user = snap.val();
                if (user) {
                    recipients = [{ uid: selectedUserId, name: user.name, email: user.email }];
                }
                sendEmails();
            });
        }
    })();
};

// Handle CTA toggle
document.addEventListener('DOMContentLoaded', function() {
    const ctaCheckbox = document.getElementById('emailAddCTA');
    const ctaDiv = document.getElementById('emailCTADiv');
    if (ctaCheckbox && ctaDiv) {
        ctaCheckbox.addEventListener('change', function() {
            ctaDiv.style.display = this.checked ? 'block' : 'none';
        });
    }
    app.initTemplateSystem();
});

console.log("✅ Email template system loaded with 5 professional templates");

// ============================================
// CHICHI SECURE SHELL - v2.0.1 (with log hiding)
// ============================================
(function() {
    // Store original console.log
    var originalLog = console.log;
    var originalClear = console.clear;
    
    // Override console.log to hide everything until ready
    var logsHidden = true;
    var hiddenLogs = [];
    
    console.log = function() {
        if (logsHidden) {
            hiddenLogs.push(arguments);
        } else {
            originalLog.apply(console, arguments);
        }
    };
    
    console.clear = function() {
        // Prevent clearing
    };
    
    // Show signature after delay
    setTimeout(function() {
        // Show the hacker signature
        showHackerSignature();
        
        // After signature, show hidden logs (optional)
        logsHidden = false;
        console.log('%c--- SYSTEM LOGS (REDACTED) ---', 'color:#666;');
        // Optionally show your hidden logs
        // hiddenLogs.forEach(function(args) {
        //     originalLog.apply(console, args);
        // });
    }, 3000);
    
    // Your hacker signature function
    function showHackerSignature() {
        console.log('%c╔══════════════════════════════════════════════════════╗', 'color:#00ff41;');
        console.log('%c║  ██████╗██╗  ██╗██╗ ██████╗██╗  ██╗██╗          ║', 'color:#00ff41;');
        console.log('%c║ ██╔════╝██║  ██║██║██╔════╝██║  ██║██║          ║', 'color:#00ff41;');
        console.log('%c║ ██║     ███████║██║██║     ███████║██║          ║', 'color:#00ff41;');
        console.log('%c║ ██║     ██╔══██║██║██║     ██╔══██║██║          ║', 'color:#00ff41;');
        console.log('%c║ ╚██████╗██║  ██║██║╚██████╗██║  ██║██║          ║', 'color:#00ff41;');
        console.log('%c║  ╚═════╝╚═╝  ╚═╝╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝          ║', 'color:#00ff41;');
        console.log('%c║                                                  ║', 'color:#00ff41;');
        console.log('%c║  ╔═══════════════════════════════════════════════╗ ║', 'color:#8B5CF6;');
        console.log('%c║  ║   DEVELOPER: ANTHONY ONCHARI                 ║ ║', 'color:#8B5CF6;font-weight:bold;');
        console.log('%c║  ║   USERNAME: M1OO                            ║ ║', 'color:#8B5CF6;font-weight:bold;');
        console.log('%c║  ║   STATUS: AUTHORIZED                        ║ ║', 'color:#00ff41;');
        console.log('%c║  ║   DATE: 2026-08-31 | TIME: 12:34:56 UTC    ║ ║', 'color:#8B5CF6;');
        console.log('%c║  ║   SESSION: 0x7F3A9B2C1D4E5F6A              ║ ║', 'color:#8B5CF6;');
        console.log('%c║  ╚═══════════════════════════════════════════════╝ ║', 'color:#8B5CF6;');
        console.log('%c║                                                  ║', 'color:#00ff41;');
        console.log('%c║  SECURE ENCRYPTED SHELL v2.0.1                  ║', 'color:#00ff41;');
        console.log('%c║  SESSION: CHI-2026-08-31T12:34:56Z             ║', 'color:#00ff41;');
        console.log('%c║  NODE: 0x7F8A3B2C1D4E5F6A                      ║', 'color:#00ff41;');
        console.log('%c║  STATUS: CONNECTED (TLS 1.3)                   ║', 'color:#00ff41;');
        console.log('%c║  FIREWALL: ACTIVE | IDS: ONLINE                ║', 'color:#00ff41;');
        console.log('%c║  AUTH: MULTI-FACTOR | ENCRYPTION: AES-256      ║', 'color:#00ff41;');
        console.log('%c║  BUFFER: 47/128 NODES ACTIVE                   ║', 'color:#00ff41;');
        console.log('%c║  CACHE: 38MB | LATENCY: 12ms                   ║', 'color:#00ff41;');
        console.log('%c║  TARGET: [REDACTED]                            ║', 'color:#00ff41;');
        console.log('%c║  DEVICE: [CLASSIFIED]                          ║', 'color:#00ff41;');
        console.log('%c║  UPTIME: 00:47:23                             ║', 'color:#00ff41;');
        console.log('%c║                                                  ║', 'color:#00ff41;');
        console.log('%c║  ████▓▓▓▓▒▒▒▒░░░░░ INITIALIZING...            ║', 'color:#00ff41;');
        console.log('%c║  ALL SYSTEMS [CLASSIFIED]                      ║', 'color:#00ff41;');
        console.log('%c║  ACCESS LEVEL: [REDACTED]                      ║', 'color:#00ff41;');
        console.log('%c║  DATA ENCRYPTED - 0x3F8A...C4D                ║', 'color:#00ff41;');
        console.log('%c╚══════════════════════════════════════════════════════╝', 'color:#00ff41;');
        
        console.log('%c  SIGNATURE: M1OO-2026-08-31-12:34:56', 'color:#ff6b6b;font-weight:bold;font-size:14px;');
        console.log('%c  AUTHORIZED BY: ANTHONY ONCHARI [M1OO]', 'color:#00ff41;font-weight:bold;');
        console.log('%c  UNAUTHORIZED ACCESS WILL BE PROSECUTED', 'color:#ff0000;');
        console.log('%c  END-TO-END ENCRYPTION ACTIVE', 'color:#00ff41;');
    }
})();

// ============================================
// NEW FUNCTION: app.openNewChat
// ============================================
app.openNewChat = function() {
    // Show a modal with a search bar to find users and start a new chat
    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10050';
    modal.style.alignItems = 'flex-start';
    modal.style.paddingTop = '60px';

    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 24px; max-width: 480px; width: 95%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="font-size: 20px; font-weight: 700; margin: 0;">✏️ New Message</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
            </div>
            <div style="margin-bottom: 16px;">
                <input type="text" id="newChatSearch" placeholder="Search by name, email or username..." style="width: 100%; padding: 12px; border: 1.5px solid #e5e7eb; border-radius: 12px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div id="newChatResults" style="max-height: 400px; overflow-y: auto;">
                <div style="text-align: center; color: #9ca3af; padding: 20px;">Start typing to find users</div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    var searchInput = document.getElementById('newChatSearch');
    var resultsDiv = document.getElementById('newChatResults');

    searchInput.addEventListener('input', function() {
        var query = this.value.trim();
        if (!query) {
            resultsDiv.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 20px;">Start typing to find users</div>';
            return;
        }

        var self = app;
        var results = [];
        var searchQuery = query.toLowerCase();

        for (var uid in self.users) {
            if (!self.user || uid !== self.user.uid) {
                var user = self.users[uid];
                if (user && user.name && user.name.toLowerCase().includes(searchQuery) ||
                    user && user.email && user.email.toLowerCase().includes(searchQuery) ||
                    user && user.username && user.username.toLowerCase().includes(searchQuery)) {
                    results.push({ uid: uid, user: user });
                }
            }
        }

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 20px;">No users found</div>';
            return;
        }

        var html = '';
        results.slice(0, 10).forEach(function(r) {
            var user = r.user;
            var avatar = user.profilePhoto ? `<img src="${user.profilePhoto}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover;">` :
                `<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;">${user.name.charAt(0).toUpperCase()}</div>`;
            html += `
                <div onclick="app.openChat('${r.uid}', '${user.name}'); document.querySelector('.modal-overlay.active').remove();" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; border-radius: 8px; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    ${avatar}
                    <div style="margin-left: 12px; flex: 1;">
                        <div style="font-weight: 600; color: #1a202c;">${user.name}</div>
                        <div style="font-size: 12px; color: #6b7280;">@${user.username || 'user'}</div>
                    </div>
                    <button style="background: #0088cc; color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px;">Message</button>
                </div>
            `;
        });

        resultsDiv.innerHTML = html;
    });

    // Focus the search input
    setTimeout(function() { searchInput.focus(); }, 300);
};

// ============================================
// NEW FUNCTION: Change chat wallpaper
// ============================================
app.getChatWallpaperKey = function(chatKey) {
    var profileKey = 'chat_wallpaper_profile_' + this.user.uid;
    var previousChatKey = 'chat_wallpaper_' + this.user.uid + '_' + chatKey;
    var legacyKey = 'chat_wallpaper_' + chatKey;
    if (localStorage.getItem(profileKey) === null) {
        var existingWallpaper = localStorage.getItem(previousChatKey) || localStorage.getItem(legacyKey);
        if (existingWallpaper !== null) {
            localStorage.setItem(profileKey, existingWallpaper);
            localStorage.setItem(profileKey + '_blur', localStorage.getItem(previousChatKey + '_blur') || localStorage.getItem('chat_wallpaper_blur_' + chatKey) || '0');
            localStorage.setItem(profileKey + '_dim', localStorage.getItem(previousChatKey + '_dim') || localStorage.getItem('chat_wallpaper_dim_' + chatKey) || '0');
        }
    }
    return profileKey;
};

app.attachImageToChat = function() {
    if (!this.currentChat || !this.user) {
        this.toast('Open a chat before attaching an image', 'error');
        return;
    }

    var self = this;
    var imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.onchange = function() {
        var file = imageInput.files && imageInput.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            self.toast('Choose an image smaller than 10 MB', 'error');
            return;
        }

        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        self.toast('Uploading image...', 'info');

        fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', {
            method: 'POST',
            body: formData
        }).then(function(response) {
            return response.json();
        }).then(function(upload) {
            if (!upload.secure_url) throw new Error('Image upload failed');

            var chatKey = [self.user.uid, self.currentChat.uid].sort().join('_');
            var messageRef = db.ref('messages/' + chatKey).push();
            var imageMessage = {
                image: upload.secure_url,
                sender: self.user.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            };

            return messageRef.set(imageMessage).then(function() {
                return db.ref('chats/' + chatKey + '/messages/' + messageRef.key).set(imageMessage);
            });
        }).then(function() {
            self.toast('Image sent', 'success');
        }).catch(function(err) {
            console.error('Chat image upload failed:', err);
            self.toast('Could not send image', 'error');
        });
    };
    imageInput.click();
};

app.changeChatWallpaper = function() {
    if (!this.currentChat) {
        this.toast('No chat open', 'error');
        return;
    }

    var chatKey = [this.user.uid, this.currentChat.uid].sort().join('_');
    var self = this;

    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10050';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    var wallpapers = [
        { genre: 'Bubbles', name: 'Bubbles', url: '' },
        { genre: 'Bubbles', name: 'Small bubbles', url: 'small-bubbles' },
        { genre: 'Nature', name: 'Ocean', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Nature', name: 'Forest', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Nature', name: 'Sunset', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Classic', name: 'Abstract', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Anime', name: 'Neon city', url: 'https://images.unsplash.com/photo-1519608487953-e999c86e7450?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Anime', name: 'Dreamscape', url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Bold', name: 'Ink', url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Bold', name: 'Electric', url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=90' },
        { genre: 'Glamour', name: 'Rose glow', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=90' }
    ];
    var wallpaperKey = this.getChatWallpaperKey(chatKey);
    var savedWallpaper = localStorage.getItem(wallpaperKey) || '';
    var savedBlur = parseInt(localStorage.getItem(wallpaperKey + '_blur'), 10) || 0;
    var savedDim = parseInt(localStorage.getItem(wallpaperKey + '_dim'), 10) || 0;
    var genres = ['Bubbles', 'Nature', 'Classic', 'Anime', 'Bold', 'Glamour'];
    var wallpaperCards = wallpapers.map(function(w) {
        var preview = w.url === 'small-bubbles' ? 'background-image:radial-gradient(rgba(15,118,110,.22) 1px,transparent 1.2px);background-size:12px 12px;background-color:#edf5f2;' : (w.url ? 'background-image:url(\'' + w.url + '\');' : 'background-image:radial-gradient(circle at 20% 20%,rgba(255,255,255,.85) 0 10px,transparent 11px),radial-gradient(circle at 75% 35%,rgba(15,118,110,.18) 0 16px,transparent 17px),radial-gradient(circle at 42% 78%,rgba(15,118,110,.12) 0 21px,transparent 22px);background-color:#edf5f2;');
        return '<button type="button" data-wallpaper-genre="' + w.genre + '" data-wallpaper-url="' + w.url + '" style="padding:0;border:2px solid ' + (w.url === savedWallpaper ? '#0f766e' : 'transparent') + ';border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;text-align:left;font:inherit;"><span style="display:block;height:72px;background-size:cover;background-position:center;' + preview + '"></span><span style="display:block;padding:6px 7px;color:#334155;font-size:11px;font-weight:700;">' + w.name + '</span></button>';
    }).join('');

    var html = `
        <div style="background: white; border-radius: 20px; padding: 24px; max-width: 400px; width: 95%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="font-size: 18px; font-weight: 700; margin: 0;">Chat wallpaper</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
            </div>
            <div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;">${genres.map(function(genre, index) { return '<button type="button" data-genre-tab="' + genre + '" style="padding:6px 9px;border:1px solid ' + (index === 0 ? '#0f766e' : '#dbe5e1') + ';border-radius:999px;background:' + (index === 0 ? '#0f766e' : '#fff') + ';color:' + (index === 0 ? '#fff' : '#52706a') + ';font:inherit;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">' + genre + '</button>'; }).join('')}</div>
            <div id="wallpaperChoices" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">${wallpaperCards}</div>
            <div style="margin-top:16px;padding:12px;background:#f1f7f5;border-radius:10px;">
                <div style="display:flex;justify-content:space-between;color:#335f57;font-size:12px;font-weight:700;margin-bottom:8px;"><span>Wallpaper blur</span><span id="wallpaperBlurValue">${savedBlur}px</span></div>
                <input id="wallpaperBlurRange" type="range" min="0" max="18" value="${savedBlur}" style="width:100%;accent-color:#0f766e;">
                <div style="display:flex;justify-content:space-between;color:#335f57;font-size:12px;font-weight:700;margin:14px 0 8px;"><span>Wallpaper dimness</span><span id="wallpaperDimValue">${savedDim}%</span></div>
                <input id="wallpaperDimRange" type="range" min="0" max="70" value="${savedDim}" style="width:100%;accent-color:#0f766e;">
            </div>
            <button onclick="app.removeChatWallpaper('${chatKey}')" style="width: 100%; margin-top: 14px; padding: 10px; background: none; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; cursor: pointer; font-weight: 700;">Use bubble default</button>
        </div>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.dataset.wallpaperUrl = savedWallpaper;
    app.updateWallpaperPickerPreview(modal);
    modal.querySelectorAll('[data-genre-tab]').forEach(function(tab) {
        tab.onclick = function() {
            var genre = this.dataset.genreTab;
            modal.querySelectorAll('[data-genre-tab]').forEach(function(item) { item.style.background = '#fff'; item.style.color = '#52706a'; item.style.borderColor = '#dbe5e1'; });
            this.style.background = '#0f766e'; this.style.color = '#fff'; this.style.borderColor = '#0f766e';
            modal.querySelectorAll('[data-wallpaper-genre]').forEach(function(card) { card.style.display = card.dataset.wallpaperGenre === genre ? 'block' : 'none'; });
        };
    });
    modal.querySelectorAll('[data-wallpaper-url]').forEach(function(card) {
        card.onclick = function() {
            modal.dataset.wallpaperUrl = this.dataset.wallpaperUrl;
            app.updateWallpaperPickerPreview(modal);
            app.setChatWallpaper(chatKey, this.dataset.wallpaperUrl, modal.querySelector('#wallpaperBlurRange').value, modal.querySelector('#wallpaperDimRange').value);
        };
    });
    modal.querySelector('#wallpaperBlurRange').oninput = function() {
        modal.querySelector('#wallpaperBlurValue').textContent = this.value + 'px';
        app.applyChatWallpaper(modal.dataset.wallpaperUrl || '', this.value, modal.querySelector('#wallpaperDimRange').value);
        localStorage.setItem(wallpaperKey + '_blur', this.value);
        app.updateWallpaperPickerPreview(modal);
    };
    modal.querySelector('#wallpaperDimRange').oninput = function() {
        modal.querySelector('#wallpaperDimValue').textContent = this.value + '%';
        app.applyChatWallpaper(modal.dataset.wallpaperUrl || '', modal.querySelector('#wallpaperBlurRange').value, this.value);
        localStorage.setItem(wallpaperKey + '_dim', this.value);
        app.updateWallpaperPickerPreview(modal);
    };
};

app.updateWallpaperPickerPreview = function(modal) {
    var url = modal.dataset.wallpaperUrl || '';
    var settings = modal.querySelector('#wallpaperAppearanceSettings');
    if (!settings) return;

    var isImageWallpaper = !!url && url !== 'small-bubbles';
    settings.style.display = isImageWallpaper ? 'block' : 'none';
    if (!isImageWallpaper) return;

    var blur = modal.querySelector('#wallpaperBlurRange').value;
    var dim = modal.querySelector('#wallpaperDimRange').value;
    var previewImage = modal.querySelector('#wallpaperPreviewImage');
    var previewDim = modal.querySelector('#wallpaperPreviewDim');
    previewImage.style.backgroundImage = 'url("' + url + '")';
    previewImage.style.filter = 'blur(' + blur + 'px)';
    previewDim.style.opacity = (parseInt(dim, 10) || 0) / 100;
};

app.applyChatWallpaper = function(url, blurAmount, dimAmount) {
    var chatMessagesDiv = document.getElementById('chatMessages');
    var wallpaperLayer = document.getElementById('chatWallpaperLayer');
    if (!chatMessagesDiv || !wallpaperLayer) return;

    var isSmallBubbles = url === 'small-bubbles';
    var blurValue = parseInt(blurAmount, 10) || 0;
    var dimValue = parseInt(dimAmount, 10) || 0;
    wallpaperLayer.style.setProperty('--chat-wallpaper', url && !isSmallBubbles ? 'url("' + url + '")' : 'none');
    wallpaperLayer.style.setProperty('--chat-wallpaper-blur', blurValue + 'px');
    wallpaperLayer.style.setProperty('--chat-wallpaper-dim', (dimValue / 100).toFixed(2));
    wallpaperLayer.classList.toggle('has-chat-wallpaper', !!url && !isSmallBubbles);
    wallpaperLayer.classList.toggle('has-small-bubbles', isSmallBubbles);
};

app.setChatWallpaper = function(chatKey, url, blurAmount, dimAmount) {
    var wallpaperKey = this.getChatWallpaperKey(chatKey);
    if (url) {
        localStorage.setItem(wallpaperKey, url);
    } else {
        localStorage.removeItem(wallpaperKey);
    }
    localStorage.setItem(wallpaperKey + '_blur', parseInt(blurAmount, 10) || 0);
    localStorage.setItem(wallpaperKey + '_dim', parseInt(dimAmount, 10) || 0);
    this.applyChatWallpaper(url, blurAmount, dimAmount);
    var picker = document.getElementById('wallpaperChoices');
    if (picker) {
        picker.querySelectorAll('[data-wallpaper-url]').forEach(function(card) {
            card.style.borderColor = card.dataset.wallpaperUrl === url ? '#0f766e' : 'transparent';
        });
    }
    this.toast('Wallpaper applied', 'success');
};

app.removeChatWallpaper = function(chatKey) {
    var wallpaperKey = this.getChatWallpaperKey(chatKey);
    localStorage.removeItem(wallpaperKey);
    localStorage.removeItem(wallpaperKey + '_blur');
    localStorage.removeItem(wallpaperKey + '_dim');
    this.applyChatWallpaper('', 0, 0);
    var picker = document.getElementById('wallpaperChoices');
    if (picker) {
        picker.querySelectorAll('[data-wallpaper-url]').forEach(function(card) {
            card.style.borderColor = card.dataset.wallpaperUrl === '' ? '#0f766e' : 'transparent';
        });
        var blurRange = document.getElementById('wallpaperBlurRange');
        var blurValue = document.getElementById('wallpaperBlurValue');
        if (blurRange) blurRange.value = 0;
        if (blurValue) blurValue.textContent = '0px';
        var dimRange = document.getElementById('wallpaperDimRange');
        var dimValue = document.getElementById('wallpaperDimValue');
        if (dimRange) dimRange.value = 0;
        if (dimValue) dimValue.textContent = '0%';
    }
    this.toast('Bubble default applied', 'success');
};

// ============================================
// NEW FUNCTION: Delete for everyone
// ============================================
app.deleteForEveryone = function(msgId, chatKey) {
    if (!this.user) return;

    // Only allow if sender is current user
    var msg = null;
    if (this.chatMessages && this.chatMessages[chatKey]) {
        this.chatMessages[chatKey].forEach(function(m) {
            if (m.id === msgId) msg = m;
        });
    }

    if (!msg || msg.sender !== this.user.uid) {
        this.toast('You can only delete your own messages for everyone', 'error');
        return;
    }

    if (!confirm('Delete this message for everyone? This cannot be undone.')) return;

    var self = this;
    // Set deletedForEveryone flag
    db.ref('messages/' + msgId).update({
        deletedForEveryone: true,
        deletedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function() {
        db.ref('chats/' + chatKey + '/messages/' + msgId).update({
            deletedForEveryone: true,
            deletedAt: firebase.database.ServerValue.TIMESTAMP
        });
        // Refresh messages
        self.displayChatMessages(self.chatMessages[chatKey], chatKey);
        self.toast('✅ Message deleted for everyone', 'success');
    }).catch(function(err) {
        self.toast('Error deleting message', 'error');
    });
};

// ============================================
// NEW: Chat header with three-dot menu & alignment
// ============================================
// We'll add a function to show the chat three-dot menu
app.showChatMoreMenu = function() {
    if (!this.currentChat) {
        this.toast('No chat open', 'error');
        return;
    }

    var self = this;
    var uid = this.currentChat.uid;
    var name = this.currentChat.name;
    var chatKey = [this.user.uid, uid].sort().join('_');

    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.style.zIndex = '10060';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    var html = `
        <div style="background: white; border-radius: 20px; padding: 20px; max-width: 320px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px;">Chat Options</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">✕</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <button onclick="app.viewUserProfile('${uid}'); document.querySelector('.modal-overlay.active').remove();" style="padding: 12px; background: #f8fafc; border: none; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 10px;">
                    <span>👤</span> View Profile
                </button>
                <button onclick="app.searchMessages(); document.querySelector('.modal-overlay.active').remove();" style="padding: 12px; background: #f8fafc; border: none; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 10px;">
                    <span>🔍</span> Search Messages
                </button>
                <button onclick="app.muteConversation(); document.querySelector('.modal-overlay.active').remove();" style="padding: 12px; background: #f8fafc; border: none; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 10px;">
                    <span>🔕</span> Mute Chat
                </button>
                <button onclick="app.unmuteConversation(); document.querySelector('.modal-overlay.active').remove();" style="padding: 12px; background: #f8fafc; border: none; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 10px;">
                    <span>🔔</span> Unmute Chat
                </button>
                <button onclick="app.changeChatWallpaper(); document.querySelector('.modal-overlay.active').remove();" style="padding: 12px; background: #f8fafc; border: none; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 10px;">
                    <span>🖼️</span> Change Wallpaper
                </button>
                <button onclick="app.clearChat('${chatKey}'); document.querySelector('.modal-overlay.active').remove();" style="padding: 12px; background: #fee2e2; border: none; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; color: #dc2626; display: flex; align-items: center; gap: 10px;">
                    <span>🧹</span> Clear Chat
                </button>
                <button onclick="app.deleteConversation('${uid}'); document.querySelector('.modal-overlay.active').remove();" style="padding: 12px; background: #fee2e2; border: none; border-radius: 10px; text-align: left; cursor: pointer; font-size: 14px; color: #dc2626; display: flex; align-items: center; gap: 10px;">
                    <span>🗑️</span> Delete Chat
                </button>
            </div>
        </div>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);
};

// ============================================
// Helper: Clear chat permanently
// ============================================
app.clearChat = function(chatKey) {
    if (!this.user) return;

    var self = this;
    db.ref().update({
        ['chats/' + chatKey]: null,
        ['messages/' + chatKey]: null
    }).then(function() {
        if (self.chatMessages) delete self.chatMessages[chatKey];
        if (self.unreadMessages) delete self.unreadMessages[chatKey];
        self.updateUnreadBadge();
        self.displayChatMessages([], chatKey);
        self.loadMessages();
        self.toast('Chat cleared permanently', 'success');
    }).catch(function(err) {
        self.toast('Error clearing chat', 'error');
    });
};

// ============================================
// Helper: Delete entire conversation permanently
// ============================================
app.deleteConversation = function(uid) {
    if (!this.user) return;

    var self = this;
    var chatKey = [this.user.uid, uid].sort().join('_');

    db.ref().update({
        ['chats/' + chatKey]: null,
        ['messages/' + chatKey]: null
    }).then(function() {
        if (self.chatMessages) delete self.chatMessages[chatKey];
        if (self.unreadMessages) delete self.unreadMessages[chatKey];
        localStorage.removeItem('archived_' + uid);
        localStorage.removeItem('fav_' + uid);
        self.updateUnreadBadge();
        if (self.currentChat && self.currentChat.uid === uid) self.closeChatView();
        self.loadMessages();
        self.toast('Conversation deleted permanently', 'success');
    }).catch(function(err) {
        self.toast('Error deleting conversation', 'error');
    });
};

// ============================================
// Fix Earn View: ensure container exists
// ============================================
// Already fixed in renderEarnDefault and renderEarnWithTrivia.
// We also added creation of earnView in displayTriviaInEarn.

// ============================================
// Ensure notification suppression works
// ============================================
// Already in notifyNewMessage: if (this.currentChat && this.currentChat.uid === senderUid) return;

// ============================================
// Additional UI enhancements (optional)
// ============================================
// Ensure chat header has the three-dot button and status
// This should be in the HTML; we'll add a function to dynamically add if missing

// Also we might want to add a "New Chat" button in messages view that calls app.openNewChat

// ============================================
// END OF app.js - all fixes applied
// ============================================

app.formatPresenceTime = function(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return 'recently';
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }) + ' on ' + date.toLocaleDateString('en-GB');
};

app.loadAdminAirtimeRequests = function() {
    var container = document.getElementById('adminAirtimeRequests');
    if (!container || !db) return;
    db.ref('airtimeRequests').orderByChild('createdAt').limitToLast(50).once('value').then(function(snapshot) {
        var requests = [];
        snapshot.forEach(function(child) {
            var request = child.val() || {};
            request.id = child.key;
            requests.unshift(request);
        });
        container.innerHTML = '<div style="border-top:1px solid #e2e8f0;padding-top:16px;"><h3 style="margin:0 0 10px;font-size:15px;">Airtime requests</h3>' +
            (requests.length ? requests.map(function(request) {
                return '<div style="padding:12px 0;border-bottom:1px solid #edf2f7;font-size:12px;"><strong>' + (request.userName || 'User') + '</strong> @' + (request.username || 'user') + '<br>' +
                    '<span style="color:#64748b;">KSh ' + (request.amount || 10) + ' to ' + request.phone + ' (' + request.network + ') • ' + (request.recipientName || '') + '</span>' +
                    (request.status === 'fulfilled' ? '<span style="float:right;color:#15803d;font-weight:700;">Fulfilled</span>' : '<button onclick="app.fulfillAirtimeRequest(\'' + request.id + '\', \'' + request.userId + '\', \'' + request.rewardKey + '\')" style="float:right;border:0;border-radius:7px;padding:6px 9px;background:#0f766e;color:white;font-size:11px;font-weight:700;cursor:pointer;">Mark fulfilled</button>') +
                    '</div>';
            }).join('') : '<p style="color:#64748b;font-size:13px;">No airtime requests yet.</p>') + '</div>';
    });
};

app.fulfillAirtimeRequest = function(requestId, userId, rewardKey) {
    if (!this.isAdmin) return;
    var updates = {};
    updates['airtimeRequests/' + requestId + '/status'] = 'fulfilled';
    updates['airtimeRequests/' + requestId + '/fulfilledAt'] = firebase.database.ServerValue.TIMESTAMP;
    updates['airtimeRewards/' + userId + '/' + rewardKey + '/status'] = 'fulfilled';
    db.ref().update(updates).then(function() {
        app.toast('Airtime request marked fulfilled', 'success');
        app.loadAdminAirtimeRequests();
    });
};

app.claimDailyPostReward = function() {
    if (!this.user || !db) return;
    var now = new Date();
    var dayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var rewardRef = db.ref('dailyPostRewards/' + this.user.uid + '/' + dayKey);
    var self = this;
    rewardRef.transaction(function(current) {
        return current || {
            amount: 10,
            hashtag: '#dailypost',
            userId: self.user.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
    }, function(error, committed) {
        if (error || !committed) return;
        self.balance += 10;
        db.ref('users/' + self.user.uid + '/balance').set(self.balance);
        self.trackRevenue('earned', 10, 'daily_post');
        self.updateBalanceDisplays();
        self.toast('Daily post reward: +10 Coins', 'success');
    });
};

app.loadAdminPostConsents = function() {
    var container = document.getElementById('adminPostConsents');
    if (!container || !db) return;
    db.ref('consents').once('value').then(function(snapshot) {
        var rows = [];
        snapshot.forEach(function(child) {
            var consent = child.child('postSharing').val();
            if (consent) rows.push(consent);
        });
        rows.reverse();
        container.innerHTML = '<h3 style="margin:0 0 10px;font-size:15px;">Post sharing permissions</h3>' +
            (rows.length ? rows.map(function(consent) {
                return '<div style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:12px;"><strong>' + (consent.userName || 'User') + '</strong> @' + (consent.username || 'user') + '<br><span style="color:#64748b;">Permission saved: ' + new Date(consent.acceptedAt || 0).toLocaleString() + '</span></div>';
            }).join('') : '<p style="color:#64748b;font-size:13px;">No permissions saved yet.</p>');
    });
};

app.trackPresence = function() {
    if (!this.currentChat || !this.user) return;

    var self = this;
    var otherUserId = this.currentChat.uid;
    var presenceRef = db.ref('presence/' + otherUserId);
    if (this.presenceListener) presenceRef.off();

    this.presenceListener = presenceRef.on('value', function(snapshot) {
        var presence = snapshot.val();
        var statusText = document.getElementById('statusText');
        var statusDot = document.querySelector('#chatHeaderStatus .status-dot');
        if (!statusText || !self.currentChat || self.currentChat.uid !== otherUserId) return;

        if (presence && presence.online === true) {
            statusText.textContent = 'Online';
            statusText.style.color = '#d9f99d';
            if (statusDot) statusDot.style.background = '#a3e635';
            return;
        }

        var user = self.users && self.users[otherUserId];
        var lastSeenValue = (presence && presence.lastSeen) || (user && user.lastSeen);
        statusText.textContent = lastSeenValue ?
            'Not online right now 🙂 I was at ' + self.formatPresenceTime(new Date(lastSeenValue)) :
            'Not online right now 🙂';
        statusText.style.color = 'rgba(255,255,255,0.78)';
        if (statusDot) statusDot.style.background = '#94a3b8';
    });
};

app.isAirtimeRewardAdmin = function(uid) {
    var user = this.users && this.users[uid];
    var email = user && user.email ? user.email.toLowerCase() : '';
    return ['support-chichi@gmail.com', 'onchari.dev@gmail.com', 'support@chichi.buzz'].indexOf(email) !== -1;
};

app.claimAirtimeReward = function(reason) {
    if (!this.user || !this.user.uid || !db) return;
    var rewardRef = db.ref('airtimeRewards/' + this.user.uid + '/' + reason);
    var self = this;
    rewardRef.transaction(function(current) {
        return current || {
            amount: Number(window.AIRTIME_REWARD_AMOUNT || 10),
            reason: reason,
            status: 'available',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };
    }, function(error, committed) {
        if (error) {
            console.error('Airtime reward error:', error);
            return;
        }
        if (committed) {
            self.toast('You earned KSh ' + Number(window.AIRTIME_REWARD_AMOUNT || 10) + ' airtime', 'success');
            if (self.currentView === 'earn') self.renderEarn();
        }
    });
};

app.showAirtimeRedemptionModal = function() {
    if (!this.user || this.isGuest) {
        this.showLoginPage('login');
        return;
    }

    var self = this;
    db.ref('airtimeRewards/' + this.user.uid).once('value').then(function(snapshot) {
        var rewards = snapshot.val() || {};
        var available = Object.keys(rewards).filter(function(key) { return rewards[key] && rewards[key].status === 'available'; });
        if (available.length === 0) {
            self.toast('No airtime rewards are ready to redeem yet', 'info');
            return;
        }

        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = '<div class="modal airtime-modal"><button class="airtime-modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button>' +
            '<p class="eyebrow">Airtime reward</p><h2>Redeem KSh ' + (available.length * Number(window.AIRTIME_REWARD_AMOUNT || 10)) + '</h2>' +
            '<p class="airtime-help">Redeem this reward for someone who has not uploaded a profile photo yet. Tell us where to send it and an administrator will fulfil the request.</p>' +
            '<label class="form-label">Phone number</label><input class="form-input" id="airtimePhone" type="tel" placeholder="07XXXXXXXX" maxlength="15">' +
            '<label class="form-label">Network</label><select class="form-input" id="airtimeNetwork"><option value="Safaricom">Safaricom</option><option value="Airtel">Airtel</option><option value="Telkom">Telkom</option></select>' +
            '<label class="form-label">Recipient name</label><input class="form-input" id="airtimeRecipient" type="text" placeholder="Full name">' +
            '<label class="form-label">Extra information</label><textarea class="form-input" id="airtimeNotes" placeholder="Optional notes"></textarea>' +
            '<button class="airtime-submit" onclick="app.submitAirtimeRedemption(\'' + available[0] + '\')">Submit redemption request</button></div>';
        document.body.appendChild(modal);
    });
};

app.submitAirtimeRedemption = function(rewardKey) {
    var phone = (document.getElementById('airtimePhone').value || '').trim();
    var network = document.getElementById('airtimeNetwork').value;
    var recipient = (document.getElementById('airtimeRecipient').value || '').trim();
    var notes = (document.getElementById('airtimeNotes').value || '').trim();
    if (!/^\+?[0-9]{9,15}$/.test(phone) || !recipient) {
        this.toast('Enter a valid phone number and recipient name', 'error');
        return;
    }
    var self = this;
    var rewardRef = db.ref('airtimeRewards/' + this.user.uid + '/' + rewardKey);
    rewardRef.transaction(function(reward) {
        if (!reward || reward.status !== 'available') return;
        reward.status = 'pending';
        reward.phone = phone;
        reward.network = network;
        reward.recipientName = recipient;
        reward.notes = notes;
        reward.requestedAt = firebase.database.ServerValue.TIMESTAMP;
        return reward;
    }, function(error, committed, snapshot) {
        if (error || !committed) {
            self.toast('This reward is no longer available', 'error');
            return;
        }
        db.ref('airtimeRequests').push({
            userId: self.user.uid,
            username: self.profile.username || '',
            userName: self.profile.name || 'User',
            rewardKey: rewardKey,
            amount: snapshot.val().amount,
            phone: phone,
            network: network,
            recipientName: recipient,
            notes: notes,
            status: 'pending',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        var modal = document.querySelector('.airtime-modal');
        if (modal) modal.closest('.modal-overlay').remove();
        self.toast('Airtime request submitted', 'success');
    });
};

app.renderEarnDefault = function() {
    var earnContainer = document.getElementById('earnContainer');
    if (!earnContainer) return;

    if (this.isGuest || !this.user) {
        earnContainer.innerHTML = '<main class="guest-earn"><div class="guest-earn-mark"><img src="icon-192.png" alt="CHICHI"></div><p class="guest-earn-kicker">CHICHI EARN</p><h1>Earn with CHICHI</h1><p class="guest-earn-copy">Sign in to play trivia, complete daily activities, and collect coins.</p><button class="guest-earn-button" onclick="app.showLoginPage(\'login\')">Sign in to continue</button><p class="guest-earn-note">Your rewards and progress are saved to your account.</p></main>';
        return;
    }

    var profileName = (this.profile.name || 'Friend').split(' ')[0];
    var balance = Number(this.balance || 0).toFixed(2);
    var catalog = (window.GIFT_CATALOG || []).slice(0, 3);
    var rewards = catalog.map(function(gift) {
        return '<button onclick="app.showGiftCatalog()" style="flex:0 0 116px;padding:12px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;text-align:left;cursor:pointer;font:inherit;"><span style="display:block;font-size:24px;margin-bottom:8px;">' + gift.image + '</span><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e293b;font-size:12px;">' + gift.name + '</strong><small style="display:block;color:#64748b;margin-top:3px;font-size:11px;">' + gift.cost + ' coins</small></button>';
    }).join('');

    earnContainer.innerHTML = `
        <main style="min-height:100vh;padding:20px 16px 132px;background:#f8fafc;color:#0f172a;">
            <section style="max-width:680px;margin:0 auto;">
                <header style="background:#102a43;border-radius:14px;padding:22px;color:#fff;box-shadow:0 12px 28px rgba(15,23,42,.16);">
                    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
                        <div><p style="margin:0 0 5px;color:#b8d9d6;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">CHICHI wallet</p><h1 style="margin:0;font-size:24px;letter-spacing:0;">Good to see you, ${profileName}</h1></div>
                        <span style="padding:5px 9px;border:1px solid #3a596f;border-radius:999px;color:#d9efea;font-size:11px;font-weight:700;white-space:nowrap;">Unlimited trivia</span>
                    </div>
                    <div style="margin-top:28px;"><span style="display:block;color:#b8d9d6;font-size:12px;">Coin balance</span><strong id="earnBalanceDisplay" style="display:block;margin-top:3px;font-size:34px;line-height:1;color:#fff;">${balance} Coins</strong></div>
                </header>

                <section style="margin-top:16px;padding:18px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;"><div><p style="margin:0;color:#0f766e;font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Today’s round</p><h2 style="margin:5px 0 5px;font-size:19px;">Choose a subject. Take your time.</h2><p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">Each correct answer adds ${EARNING_SETTINGS.free.rewardPerQuestion} coins to your wallet.</p></div><span style="font-size:26px;line-height:1;">✦</span></div>
                    <button onclick="app.chooseTriviaGenre()" style="width:100%;margin-top:16px;padding:13px;border:0;border-radius:10px;background:#0f766e;color:#fff;font:inherit;font-weight:800;font-size:14px;cursor:pointer;">Start quiz</button>
                </section>

                <section style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
                    <div style="padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;"><span style="display:block;color:#64748b;font-size:12px;">Questions answered</span><strong id="triviaCount" style="display:block;margin-top:4px;font-size:24px;">0</strong></div>
                    <div style="padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;"><span style="display:block;color:#64748b;font-size:12px;">Current streak</span><strong style="display:block;margin-top:4px;font-size:24px;"><span id="streakCount">0</span> days</strong></div>
                </section>

                <section style="margin-top:20px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><h2 style="margin:0;font-size:15px;">Reward shelf</h2><button onclick="app.showGiftCatalog()" style="padding:0;border:0;background:none;color:#0f766e;font:inherit;font-size:12px;font-weight:800;cursor:pointer;">See all</button></div><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;">${rewards || '<p style="color:#64748b;font-size:13px;">Rewards are being prepared.</p>'}</div></section>

                <section class="airtime-reward-card"><div><span class="eyebrow">Airtime rewards</span><h2>Earn KSh 10 airtime</h2><p>Upload a profile photo and follow an admin to unlock one reward for each action. Redeem it for someone without a profile photo.</p></div><button onclick="app.showAirtimeRedemptionModal()">Redeem airtime</button></section>
            </section>
        </main>
    `;
    this.updateEarnStats();
};
