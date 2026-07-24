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
    navigationHistory: [],
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

    // ============================================
    // INIT
    // ============================================

    init: function() {
        var self = this;
        
        if (!auth || !db) {
            console.log('⏳ Waiting for Firebase...');
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
                self.isAdmin = u.email === 'support-chichi@gmail.com';
               
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
                    } else {
                        self.profile = {
                            name: u.displayName || 'User',
                            email: u.email,
                            username: u.email.split('@')[0] || 'user',
                            bio: '',
                            profilePhoto: u.photoURL || '',
                            coverImage: '',
                            balance: 0,
                            followers: 0,
                            following: 0,
                            triviaAnswered: [],
                            tier: 'free',
                            interests: []
                        };
                    }
                    self.loadProfile();
                    self.checkAndShowUsernameSetup();
                    self.showApp();
                    self.setOnlineStatus();
                    self.startTriviaTimer();
                    self.logUserActivity('login', 'User logged in');
                    
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
                self.updateLogoutButton();
                self.showLoginPage();
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
       
        this.toast('📬 ' + senderName + ': ' + cleanMessage, 'info', 4000);
        this.playNotificationSound();
        this.updateBrowserTitle();
       
        if (navigator.vibrate && this.userHasInteracted) {
            try {
                navigator.vibrate([200, 100, 200]);
            } catch (e) {
                console.log('⏸️ Vibration blocked:', e.message);
            }
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
                });
               
                messagesRef.orderByChild('timestamp').on('child_added', function(childSnap) {
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
    },

    closeAdminPortal: function() {
        this.adminOpen = false;
        document.getElementById('adminPortal').classList.remove('active');
        document.getElementById('mainApp').classList.add('active');
        document.querySelector('.bottom-nav').style.display = 'flex';
    },

    switchAdminTab: function(tab) {
        document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
       
        var buttons = document.querySelectorAll('.admin-tab');
        var tabMap = ['dashboard', 'users', 'incomplete', 'posts', 'analytics', 'gifts', 'notifications', 'logs'];
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
            'notifications': 'adminNotificationsTab',
            'logs': 'adminLogs'
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
        if (tab === 'logs') this.loadActivityLog();
        if (tab === 'notifications') this.loadAdminNotifications();
    },

    // ============================================
    // ADMIN - DASHBOARD
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

    loadAdminUsers: function() {
        var self = this;
        var html = '';
        var userArray = [];
        var usersWithoutUsername = [];
       
        for (var uid in this.users) {
            userArray.push({ uid: uid, user: this.users[uid] });
            
            var user = this.users[uid];
            if (!user.username || user.username.trim() === '') {
                usersWithoutUsername.push({
                    uid: uid,
                    name: user.name,
                    email: user.email
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
                            <div style="font-size: 13px; color: #78350f; margin-bottom: 12px;">These users won't appear in searches. Click below to fix them:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${usersWithoutUsername.map(u => `
                                    <div style="background: white; border-radius: 8px; padding: 8px 12px; font-size: 12px;">
                                        <span style="font-weight: 600; color: #1e293b;">${u.name}</span>
                                        <span style="color: #6b7280; font-size: 11px;">(${u.email})</span>
                                        <button onclick="app.fixUserUsername('${u.uid}', '${u.name}', '${u.email}')" style="margin-left: 8px; padding: 4px 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px;">Fix</button>
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
                    var isBanned = bannedUsers[u.uid] ? true : false;
                    var banData = bannedUsers[u.uid] || {};
                    var usernameDisplay = u.user.username ? `<div style="font-size: 0.75rem; color: #3b82f6; margin-top: 2px;">@${u.user.username}</div>` : '<div style="font-size: 0.75rem; color: #ef4444; margin-top: 2px;">❌ NO USERNAME</div>';
                    
                    html += `
                        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; ${isBanned ? 'background: #fef2f2;' : ''}">
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${u.user.name} ${isBanned ? '🚫' : ''}</div>
                                <div style="font-size: 0.8rem; color: var(--text-light);">${u.user.email}</div>
                                ${usernameDisplay}
                                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">Joined: ${u.user.createdAt}</div>
                                <div style="font-size: 0.75rem; color: var(--primary);">💰 ${(u.user.balance || 0).toFixed(2)} Coins</div>
                                ${isBanned ? `<div style="font-size: 0.7rem; color: #ef4444;">Banned: ${banData.reason || 'No reason'}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span style="background: var(--primary); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${u.user.followers || 0} followers</span>
                                ${!u.user.username ? `
                                    <button onclick="app.fixUserUsername('${u.uid}', '${u.user.name}', '${u.user.email}')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">Fix Username</button>
                                ` : ''}
                                <button onclick="app.showBalanceEditor('${u.uid}', '${u.user.name}')" style="padding: 6px 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">💰 Balance</button>
                                ${isBanned ? `
                                    <button onclick="app.unbanUser('${u.uid}', '${u.user.name}')" style="padding: 6px 12px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">Unban</button>
                                ` : `
                                    <button onclick="app.banUserFromAdmin('${u.uid}', '${u.user.name}')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🚫 Ban</button>
                                `}
                                <button onclick="app.deleteUserByAdmin('${u.uid}', '${u.user.name}')" style="padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">🗑️</button>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
                document.getElementById('adminUsersList').innerHTML = html;
            });
        }
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
        if (!confirm('Delete this gift?')) return;
        
        if (window.GIFT_CATALOG) {
            var index = window.GIFT_CATALOG.findIndex(function(g) { return g.id === id; });
            if (index > -1) {
                window.GIFT_CATALOG.splice(index, 1);
                this.toast('✅ Gift deleted', 'success');
                this.loadAdminGifts();
            }
        }
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
        
        var self = this;
        var userId = this.user.uid;
        
        db.ref('notifications/' + userId).orderByChild('read').equalTo(false).limitToLast(5).on('child_added', function(snapshot) {
            var notification = snapshot.val();
            if (notification && notification.type === 'coin_received') {
                self.toast('💰 ' + notification.message, 'success');
                db.ref('notifications/' + userId + '/' + snapshot.key + '/read').set(true);
                self.loadProfile();
            }
        });
    },

    // ============================================
    // LOAD USERS
    // ============================================

    loadUsers: function() {
        var self = this;
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
           
            if (document.getElementById('exploreView').classList.contains('active')) {
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
            self.following = s.val() || {};
            self.loadStories();
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
                html += '<div style="flex:1;" onclick="app.viewUserProfile(\'' + r.uid + '\')" style="cursor:pointer;">';
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
        });
        
        var tabs = document.querySelectorAll('.message-filter-tab');
        var tabMap = { 'all': 0, 'unread': 1, 'favorites': 2, 'notifications': 3 };
        var index = tabMap[filter];
        if (index !== undefined && tabs[index]) {
            tabs[index].classList.add('active');
        }
        
        if (filter === 'notifications') {
            this.showNotificationsTab();
            return;
        }
        
        var items = document.querySelectorAll('.message-item');
        items.forEach(function(item) {
            var unreadBadge = item.querySelector('.message-item-unread');
            var hasUnread = unreadBadge && parseInt(unreadBadge.textContent) > 0;
            
            if (filter === 'all') {
                item.style.display = 'flex';
            } else if (filter === 'unread' && hasUnread) {
                item.style.display = 'flex';
            } else if (filter === 'favorites') {
                var isFav = item.getAttribute('data-favorite') === 'true';
                item.style.display = isFav ? 'flex' : 'none';
            } else {
                item.style.display = 'none';
            }
        });
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
            if (toggle) toggle.checked = true;
        } else {
            document.documentElement.classList.remove('dark-mode');
            if (toggle) toggle.checked = false;
        }
    },

    toggleDarkMode: function() {
        var root = document.documentElement;
        var toggle = document.getElementById('darkModeToggle');
        
        if (toggle && toggle.checked) {
            root.classList.add('dark-mode');
            localStorage.setItem('chichi-dark-mode', 'enabled');
            this.toast('🌙 Dark mode enabled', 'success');
        } else {
            root.classList.remove('dark-mode');
            localStorage.setItem('chichi-dark-mode', 'disabled');
            this.toast('☀️ Light mode enabled', 'success');
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
        if (!this.user) return 0;
        
        var userTier = 'free';
        var tierData = EARNING_SETTINGS[userTier];
        var today = new Date().toDateString();
        var key = 'chichi_trivia_count_' + this.user.uid + '_' + today;
        var count = parseInt(localStorage.getItem(key)) || 0;
        return Math.max(0, tierData.dailyQuestions - count);
    },

    incrementQuestionCount: function() {
        if (!this.user) return;
        var today = new Date().toDateString();
        var key = 'chichi_trivia_count_' + this.user.uid + '_' + today;
        var count = parseInt(localStorage.getItem(key)) || 0;
        localStorage.setItem(key, count + 1);
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
        if (!earnContainer) return;
        
        var userTier = 'free';
        var tierData = EARNING_SETTINGS[userTier];
        var remaining = this.getQuestionsRemaining();
        var userBalance = this.balance;
        var triviaCount = this.triviaAnsweredCount || 0;
        var streakCount = this.streakCount || 0;
        var username = this.profile.username || 'user';
        var catalog = window.GIFT_CATALOG || [];
        
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
                    
                    <button onclick="app.generateTriviaQuestion()" style="
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
                        ${remaining > 0 ? '🚀 Start' : '⏳ Done for today'}
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
        if (!earnContainer) return;
        
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
                
                <!-- TRIVIA QUESTION -->
                <div style="background: white; border-radius: 14px; padding: 16px; margin-bottom: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e8ecf0;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 14px; font-weight: 700; color: #15803d;">🧠 Trivia</div>
                            <div style="font-size: 11px; color: #64748b;">Answer to earn coins</div>
                        </div>
                        <div style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap;">+${tierData.rewardPerQuestion}</div>
                    </div>
                    
                    <div id="triviaQuestionArea">
                        <p style="font-size: 14px; font-weight: 600; color: #1a202c; margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 10px; border-left: 3px solid #0088cc; line-height: 1.5;">${questionData.question}</p>
                        
                        <div id="triviaOptions">
                            ${optionsHtml}
                        </div>
                        
                        <div id="triviaTimerDisplay" style="text-align: center; margin-top: 12px; font-size: 12px; color: #6b7280;">
                            ⏱️ <span id="triviaTimeLeft" style="font-weight: 700; color: #ef4444;">${tierData.timerSeconds}</span>s remaining
                        </div>
                        
                        <div id="triviaResultArea" style="display: none; text-align: center; padding: 10px; border-radius: 10px; margin-top: 10px;"></div>
                    </div>
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
                
            </div>
        `;
        
        earnContainer.innerHTML = html;
        
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
                            <div style="color: #ef4444; font-weight: 700; font-size: 16px;">⏰ Time's Up!</div>
                            <div style="color: #6b7280; font-size: 13px;">Answer: ${correctAnswer}</div>
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
        
        if (correct) {
            resultArea.innerHTML = `
                <div style="color: #22c55e; font-weight: 700; font-size: 18px;">✅ Correct!</div>
                <div style="color: #6b7280; font-size: 14px;">You earned ${tierData.rewardPerQuestion.toFixed(2)} Chichi Coins!</div>
            `;
            resultArea.style.background = '#dcfce7';
            
            this.balance += tierData.rewardPerQuestion;
            db.ref('users/' + userId + '/balance').set(this.balance);
            
            this.trackRevenue('earned', tierData.rewardPerQuestion, 'trivia');
            
            var balanceDisplay = document.getElementById('earnBalanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.textContent = this.balance.toFixed(2) + ' Coins';
            }
            
            this.toast('🎉 Correct! +' + tierData.rewardPerQuestion.toFixed(2) + ' Coins', 'success');
            this.incrementQuestionCount();
        } else {
            resultArea.innerHTML = `
                <div style="color: #ef4444; font-weight: 700; font-size: 18px;">❌ Wrong answer</div>
                <div style="color: #6b7280; font-size: 14px;">The correct answer was: ${this.currentTrivia.options[this.currentTrivia.correct]}</div>
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
        
        console.log('🧠 Trivia timer started');
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

    loadNextTriviaQuestion: function() {
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
                
                var unanswered = TRIVIA_QUESTIONS.filter(function(q, index) {
                    for (var j = 0; j < answered.length; j++) {
                        if (answered[j].questionIndex === index) {
                            return false;
                        }
                    }
                    return true;
                });
                
                if (unanswered.length === 0) {
                    db.ref('users/' + userId + '/triviaAnswered').set([]);
                    unanswered = TRIVIA_QUESTIONS.slice();
                }
                
                var randomIndex = Math.floor(Math.random() * unanswered.length);
                var question = unanswered[randomIndex];
                var questionIndex = TRIVIA_QUESTIONS.indexOf(question);
                
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
            console.error('❌ Earn view not found in DOM');
            return;
        }
        
        if (!earnView.classList.contains('active')) {
            this.pendingTrivia = questionData;
            return;
        }
        
        this.pendingTrivia = null;
        this.renderEarnWithTrivia(questionData);
    },

    // ============================================
    // SET ONLINE STATUS
    // ============================================

    setOnlineStatus: function() {
        if (!this.user || this.isGuest) return;
        
        var self = this;
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
    // UPDATE LOGOUT BUTTON
    // ============================================

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
       
        var nav = document.querySelector('.bottom-nav');
        if (nav) nav.style.display = 'flex';
       
        var self = this;
        setTimeout(function() {
            self.requestNotificationPermission();
        }, 1500);
       
        self.loadPosts();
        self.loadStories();
        self.loadUsers();
        self.loadFollowing();
        self.loadGroups();
        self.setupTypingCleanup();
        self.calculateTrendingHashtags();
       
        setTimeout(function() {
            if (!self.unreadTrackingActive) {
                console.log('⚠️ WARNING: Unread tracking not active yet!');
            }
        }, 100);
       
        self.messagePollingInterval = setInterval(function() {
            if (!self.user || self.isGuest) return;
            
            var userIds = Object.keys(self.users || {});
            userIds.forEach(function(uid) {
                if (uid !== self.user.uid) {
                    var key = [self.user.uid, uid].sort().join('_');
                    db.ref('chats/' + key + '/messages').orderByChild('timestamp').limitToLast(1).once('value', function(s) {
                        s.forEach(function(c) {
                            var m = c.val();
                            if (m && m.sender !== self.user.uid && (m.text || m.image)) {
                                var notifyKey = key + '_' + m.timestamp;
                                if (!self.notifiedMessages[notifyKey]) {
                                    var userName = (self.users[uid] || {}).name || 'User';
                                    self.notifyNewMessage(userName, m.text || '📷 Image');
                                    self.notifiedMessages[notifyKey] = true;
                                }
                            }
                        });
                    });
                }
            });
        }, 5000);
        
        this.loadDarkModePreference();
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
    // RENDER PROFILE - BENTO STYLE
    // ============================================

    renderProfile: function() {
        var profileContent = document.getElementById('profileContent');
        if (!profileContent) {
            var profileView = document.getElementById('profileView');
            if (profileView) {
                var content = document.createElement('div');
                content.id = 'profileContent';
                profileView.appendChild(content);
                profileContent = content;
            } else {
                return;
            }
        }
        
        if (!this.user || this.isGuest) {
            var html = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">👤</div>
                    <div style="font-size:20px;font-weight:600;margin-bottom:8px;color:var(--text);">No Profile Yet</div>
                    <div style="font-size:14px;color:var(--text-light);margin-bottom:24px;line-height:1.5;">
                        Sign up or log in to create your profile, earn rewards, and connect with others.
                    </div>
                    <button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:14px 32px;border-radius:8px;font-weight:600;cursor:pointer;font-size:16px;margin-bottom:12px;">📝 Sign Up / Login</button>
                    <button onclick="app.switchView('feed')" style="background:white;color:var(--primary);border:2px solid var(--primary);padding:12px 32px;border-radius:8px;font-weight:600;cursor:pointer;font-size:16px;">Back to Feed</button>
                </div>
            `;
            profileContent.innerHTML = html;
            return;
        }
        
        var username = this.profile.username || 'user';
        var interests = this.profile.interests || [];
        var bio = this.profile.bio || '';
        var userPosts = this.posts.filter(function(p) { return p.userId === this.user.uid; }.bind(this));
        var followers = this.profile.followers || 0;
        var following = Object.keys(this.following).length;

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
            <div style="padding: 0; background: #f5f5f5; min-height: 100vh;">
                
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
                            ${!this.profile.profilePhoto ? this.user.email.charAt(0).toUpperCase() : ''}
                        </div>
                    </div>
                    
                    <!-- Right: Name, Username, Edit Button -->
                    <div style="padding-left: 14px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 18px; font-weight: 700; color: #1a1a1a; display: flex; align-items: center; gap: 6px;">
                            ${this.profile.name || 'User'}
                            <span style="color: #3b82f6; font-size: 16px;">✓</span>
                        </div>
                        <div style="font-size: 13px; color: #9ca3af; margin-bottom: 6px;">@${username}</div>
                        
                        <!-- Edit Profile Button (right below username) -->
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
                        <div style="font-size: 13px; color: #475569; word-break: break-all;">📧 ${this.user.email}</div>
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
                    ${!this.profile.profilePhoto ? this.user.email.charAt(0).toUpperCase() : ''}
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
            this.calculateTrendingHashtags();
            return;
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
    // MESSAGES
    // ============================================

    loadMessages: function() {
        var self = this;
        if (!this.user || this.isGuest || !this.user.uid) {
            var html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;text-align:center;"><div style="font-size:64px;margin-bottom:16px;">💬</div><div style="font-size:22px;font-weight:700;margin-bottom:12px;color:var(--text);">Connect & Chat Now</div><div style="font-size:15px;color:var(--text-light);margin-bottom:12px;line-height:1.6;max-width:280px;">Join our community to message friends, share ideas, and build real connections!</div><button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:14px 40px;border-radius:8px;font-weight:600;cursor:pointer;font-size:16px;">🚀 Sign Up / Login</button></div>';
            var container = document.getElementById('messageList');
            if (container) { container.innerHTML = html; }
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
                        if (self.blockedUsers && self.blockedUsers[otherUserId]) { return; }
                        var messages = snapshot.val()[chatKey];
                        var hasTextMessages = false;
                        var lastMessage = 'Tap to message';
                        var lastTimestamp = 0;
                        var unreadCount = 0;
                        if (messages && typeof messages === 'object') {
                            Object.keys(messages).forEach(function(msgId) {
                                var msg = messages[msgId];
                                if (msg && !msg.deleted && (msg.text || msg.image)) {
                                    hasTextMessages = true;
                                    lastMessage = msg.text ? msg.text.substring(0, 50) : '📷 Image';
                                    lastTimestamp = msg.timestamp || 0;
                                    if (msg.sender !== self.user.uid && !msg.read) { unreadCount++; }
                                }
                            });
                            if (hasTextMessages && otherUserId && self.users[otherUserId]) {
                                conversations.push({
                                    uid: otherUserId, chatKey: chatKey, lastMessage: lastMessage,
                                    lastTimestamp: lastTimestamp, unreadCount: unreadCount,
                                    user: self.users[otherUserId]
                                });
                            }
                        }
                    }
                });
            }
            conversations.sort(function(a, b) { return b.lastTimestamp - a.lastTimestamp; });
            
            if (conversations.length > 0) {
                conversations.forEach(function(conv) {
                    var unreadBadge = conv.unreadCount > 0 ? '<div class="message-item-unread">' + conv.unreadCount + '</div>' : '';
                    var avatarStyle = conv.user.profilePhoto ? 'background-image: url(\'' + conv.user.profilePhoto + '\'); background-size: cover; background-position: center;' : '';
                    html += '<div class="message-item" onclick="app.openChatFromSearch(\'' + conv.uid + '\', \'' + conv.user.name + '\')"><div class="message-item-avatar" style="' + avatarStyle + ' background: ' + (!conv.user.profilePhoto ? 'linear-gradient(135deg, #0088cc, #006fa3)' : '') + ';">' + (!conv.user.profilePhoto ? conv.user.name.charAt(0).toUpperCase() : '') + '</div><div class="message-item-content"><div class="message-item-name">' + conv.user.name + '</div><div class="message-item-preview">' + conv.lastMessage + '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;"><div class="message-item-time">' + self.formatTimeAgo(new Date(conv.lastTimestamp)) + '</div>' + unreadBadge + '</div></div>';
                });
            } else {
                html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">💬</div><div style="font-size:18px;font-weight:600;color:#1a202c;margin-bottom:8px;">No conversations yet</div><div style="font-size:14px;color:#6b7280;margin-bottom:16px;">Go find someone to chat with!</div><button onclick="app.switchView(\'explore\')" style="background:var(--primary);color:white;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:600;">🔍 Find Friends</button></div>';
            }
            var container = document.getElementById('messageList');
            if (container) { container.innerHTML = html; }
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
        
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('chatMessageInput').value = '';
        
        var self = this;
        setTimeout(function() {
            self.loadChatMessages();
            self.markAsRead(uid);
            document.getElementById('chatMessageInput').focus();
        }, 100);
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
                    self.notifyNewMessage(self.currentChat.name, m.text || '📷 Image');
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

    markAsRead: function(uid) {
        var self = this;
        var key = [this.user.uid, uid].sort().join('_');
        if (this.unreadMessages && this.unreadMessages[key]) {
            this.unreadMessages[key].count = 0;
        }
        var messagesRef = db.ref('chats/' + key + '/messages');
        messagesRef.once('value', function(snap) {
            snap.forEach(function(childSnap) {
                var m = childSnap.val();
                if (m && m.sender !== self.user.uid && !m.read) {
                    childSnap.ref.update({ read: true });
                }
            });
        });
        this.updateUnreadBadge();
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
        var bio = document.getElementById('editProfileBio').value.trim();
        var interestsInput = document.getElementById('editProfileInterests').value.trim();
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
       
        var interests = interestsInput ? interestsInput.split(',').map(function(i) { return i.trim(); }).filter(function(i) { return i; }) : [];
        if (interests.length > 10) {
            this.toast('Maximum 10 interests allowed', 'error');
            return;
        }
       
        this.toast('Saving profile...', 'info');
       
        if (username !== this.profile.username) {
            db.ref('users').orderByChild('username').equalTo(username).once('value', function(snapshot) {
                if (snapshot.exists()) {
                    var existingUid = Object.keys(snapshot.val())[0];
                    if (existingUid !== self.user.uid) {
                        self.toast('This username is already taken', 'error');
                        return;
                    }
                }
                self._saveProfileData(name, username, bio, interests);
            });
        } else {
            this._saveProfileData(name, username, bio, interests);
        }
    },

    _saveProfileData: function(name, username, bio, interests) {
        var self = this;
        var updateData = {
            name: name,
            username: username,
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
                self.toast('Error updating profile', 'error');
            } else {
                self.profile = { ...self.profile, ...updateData };
                self.toast('✅ Profile updated!', 'success');
                self.editProfilePhoto = null;
                var modal = document.querySelector('.modal-overlay');
                if (modal) {
                    modal.remove();
                }
                self.renderProfile();
                self.logUserActivity('update_profile', 'Updated profile');
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

    continueAsGuest: function() {
        this.user = null;
        this.isGuest = true;
        this.isAdmin = false;
        this.profile = { name: 'Guest', balance: 0, triviaAnswered: [], tier: 'free' };
        this.toast('📱 Browsing as Guest - Sign up to unlock all features!', 'info');
        this.showApp();
        this.switchView('feed');
        this.loadPosts();
        this.logUserActivity('guest_access', 'User browsing as guest');
    },

    // ============================================
    // SWITCH TAB
    // ============================================

    switchTab: function(tab) {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        document.querySelector('[onclick="app.switchTab(\'' + tab + '\')"]').classList.add('active');
        document.getElementById(tab + 'Tab').classList.add('active');
    },

    // ============================================
    // SWITCH VIEW
    // ============================================

    switchView: function(view) {
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
       
        document.querySelectorAll('.nav-wrapper > .nav-item').forEach(function(n) { n.classList.remove('active'); });
       
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
        if (view === 'feed') navItems[0].classList.add('active');
        else if (view === 'explore') navItems[1].classList.add('active');
        else if (view === 'messages') navItems[2].classList.add('active');
        else if (view === 'earn') navItems[3].classList.add('active');
        else if (view === 'profile') navItems[4].classList.add('active');
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
        this.loadStories();
       
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
            self.renderFeed();
        }, function(err) {
            console.error('❌ Error loading posts:', err.message);
            self.posts = [];
            self.renderFeed();
        });
    },

    // ============================================
    // RENDER FEED
    // ============================================

    renderFeed: function() {
        var feedContainer = document.getElementById('feedContainer');
        if (!feedContainer) return;
       
        if (!this.posts) this.posts = [];
        
        var html = '';
        if (this.posts.length === 0) {
            html = '<div style="text-align:center;color:#6b7280;padding:40px 16px;">No posts yet. Start creating!</div>';
        } else {
            this.posts.forEach(function(p) {
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
                
                // REMOVED: Generated by CHICHI AI labels
                
                postHtml += '<img src="' + p.photoUrl + '" class="post-image" style="' + (isSupportPost ? 'border-radius:0;' : '') + '"><div class="post-caption">' + p.caption + '</div>';
                
                postHtml += '<div class="post-stats">' + likes + ' likes · ' + downloads + ' saves · ' + comments + ' comments</div>';
                
                // Show actions for all posts (including support posts)
                postHtml += '<div class="post-actions"><button class="post-action ' + (userLiked ? 'liked' : '') + '" onclick="app.likePost(\'' + p.id + '\')">' + (userLiked ? '❤️ Liked' : '🤍 Like') + '</button><button class="post-action" onclick="app.downloadPost(\'' + p.photoUrl + '\', \'' + p.id + '\')">💾 Save</button><button class="post-action" onclick="app.viewComments(\'' + p.id + '\')">💬 Comment</button><button class="post-action" onclick="app.sharePost(\'' + p.id + '\', \'' + p.caption.replace(/'/g, "\\'") + '\')">📤 Share</button></div>';
                
                postHtml += '</div>';
                html += postHtml;
            }.bind(this));
        }
       
        feedContainer.style.display = 'block';
        feedContainer.innerHTML = html;
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
        if (!this.requireAuth('share posts')) return;
        
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
                    var unreadCount = this.getUnreadCountForUser(uid);
                    var msgBadge = unreadCount > 0 ? '<span style="position:absolute;top:-8px;right:-8px;width:24px;height:24px;background:#ef4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(239,68,68,0.4);">' + unreadCount + '</span>' : '';
                   
                    var html = '<div class="profile-header"><div class="profile-top"><div class="profile-avatar-large" style="background-image:url(' + (user.profilePhoto || '') + ');">' + (!user.profilePhoto ? user.name.charAt(0).toUpperCase() : '') + '</div><div class="profile-info"><div class="profile-name">' + (user.name || 'User') + '</div><div class="profile-email">' + user.email + '</div><div class="profile-stats"><div class="profile-stat"><div class="profile-stat-value">-</div><div class="profile-stat-label">Posts</div></div><div class="profile-stat"><div class="profile-stat-value">' + (user.followers || 0) + '</div><div class="profile-stat-label">Followers</div></div></div></div></div><div style="display:flex;gap:8px;margin-top:12px;"><button class="follow-btn" onclick="app.toggleFollow(\'' + uid + '\', \'' + user.name + '\')" style="background:' + (isFollowing ? '#ff4444' : 'var(--primary)') + ';color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600;transition:0.3s;flex:1;">' + (isFollowing ? '✕ Unfollow' : '✓ Follow') + '</button><button class="follow-btn" onclick="app.openChatFromSearch(\'' + uid + '\', \'' + user.name + '\')" style="background:#2E5BFF;color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-weight:600;transition:0.3s;flex:1;position:relative;">💬 Message ' + msgBadge + '</button></div></div>';
                   
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
       
        db.ref('users/' + this.user.uid + '/following').set(Object.keys(this.following).length);
        db.ref('users/' + uid + '/followers').once('value', function(s) {
            var followers = (s.val() || 0) + (isFollowing ? -1 : 1);
            db.ref('users/' + uid + '/followers').set(followers);
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
                    document.getElementById('logoutModal').classList.remove('active');
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
            this.showLoginPage();
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
            return;
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
    // MESSAGES
    // ============================================

    loadMessages: function() {
        var self = this;
        if (!this.user || this.isGuest || !this.user.uid) {
            var html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;text-align:center;"><div style="font-size:64px;margin-bottom:16px;">💬</div><div style="font-size:22px;font-weight:700;margin-bottom:12px;color:var(--text);">Connect & Chat Now</div><div style="font-size:15px;color:var(--text-light);margin-bottom:12px;line-height:1.6;max-width:280px;">Join our community to message friends, share ideas, and build real connections!</div><button onclick="app.showLoginPage()" style="background:var(--primary);color:white;border:none;padding:14px 40px;border-radius:8px;font-weight:600;cursor:pointer;font-size:16px;">🚀 Sign Up / Login</button></div>';
            var container = document.getElementById('messageList');
            if (container) { container.innerHTML = html; }
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
                        if (self.blockedUsers && self.blockedUsers[otherUserId]) { return; }
                        var messages = snapshot.val()[chatKey];
                        var hasTextMessages = false;
                        var lastMessage = 'Tap to message';
                        var lastTimestamp = 0;
                        var unreadCount = 0;
                        if (messages && typeof messages === 'object') {
                            Object.keys(messages).forEach(function(msgId) {
                                var msg = messages[msgId];
                                if (msg && !msg.deleted && (msg.text || msg.image)) {
                                    hasTextMessages = true;
                                    lastMessage = msg.text ? msg.text.substring(0, 50) : '📷 Image';
                                    lastTimestamp = msg.timestamp || 0;
                                    if (msg.sender !== self.user.uid && !msg.read) { unreadCount++; }
                                }
                            });
                            if (hasTextMessages && otherUserId && self.users[otherUserId]) {
                                conversations.push({
                                    uid: otherUserId, chatKey: chatKey, lastMessage: lastMessage,
                                    lastTimestamp: lastTimestamp, unreadCount: unreadCount,
                                    user: self.users[otherUserId]
                                });
                            }
                        }
                    }
                });
            }
            conversations.sort(function(a, b) { return b.lastTimestamp - a.lastTimestamp; });
            
            if (conversations.length > 0) {
                conversations.forEach(function(conv) {
                    var unreadBadge = conv.unreadCount > 0 ? '<div class="message-item-unread">' + conv.unreadCount + '</div>' : '';
                    var avatarStyle = conv.user.profilePhoto ? 'background-image: url(\'' + conv.user.profilePhoto + '\'); background-size: cover; background-position: center;' : '';
                    html += '<div class="message-item" onclick="app.openChatFromSearch(\'' + conv.uid + '\', \'' + conv.user.name + '\')"><div class="message-item-avatar" style="' + avatarStyle + ' background: ' + (!conv.user.profilePhoto ? 'linear-gradient(135deg, #0088cc, #006fa3)' : '') + ';">' + (!conv.user.profilePhoto ? conv.user.name.charAt(0).toUpperCase() : '') + '</div><div class="message-item-content"><div class="message-item-name">' + conv.user.name + '</div><div class="message-item-preview">' + conv.lastMessage + '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;"><div class="message-item-time">' + self.formatTimeAgo(new Date(conv.lastTimestamp)) + '</div>' + unreadBadge + '</div></div>';
                });
            } else {
                html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">💬</div><div style="font-size:18px;font-weight:600;color:#1a202c;margin-bottom:8px;">No conversations yet</div><div style="font-size:14px;color:#6b7280;margin-bottom:16px;">Go find someone to chat with!</div><button onclick="app.switchView(\'explore\')" style="background:var(--primary);color:white;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:600;">🔍 Find Friends</button></div>';
            }
            var container = document.getElementById('messageList');
            if (container) { container.innerHTML = html; }
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
        
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('chatMessageInput').value = '';
        
        var self = this;
        setTimeout(function() {
            self.loadChatMessages();
            self.markAsRead(uid);
            document.getElementById('chatMessageInput').focus();
        }, 100);
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
                    self.notifyNewMessage(self.currentChat.name, m.text || '📷 Image');
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

    markAsRead: function(uid) {
        var self = this;
        var key = [this.user.uid, uid].sort().join('_');
        if (this.unreadMessages && this.unreadMessages[key]) {
            this.unreadMessages[key].count = 0;
        }
        var messagesRef = db.ref('chats/' + key + '/messages');
        messagesRef.once('value', function(snap) {
            snap.forEach(function(childSnap) {
                var m = childSnap.val();
                if (m && m.sender !== self.user.uid && !m.read) {
                    childSnap.ref.update({ read: true });
                }
            });
        });
        this.updateUnreadBadge();
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

    signInWithGoogle: function() {
        var self = this;
        var provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then(function(result) {
                var user = result.user;
                return db.ref('users/' + user.uid).once('value').then(function(snap) {
                    if (!snap.exists()) {
                        var autoUsername = (user.displayName || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                        
                        return db.ref('users/' + user.uid).set({
                            name: user.displayName || 'User',
                            username: autoUsername || 'user_' + user.uid.substring(0, 8),
                            email: user.email,
                            bio: '',
                            profilePhoto: user.photoURL || '',
                            balance: 0,
                            followers: 0,
                            following: 0,
                            hashtags: [],
                            interests: [],
                            triviaAnswered: [],
                            tier: 'free',
                            createdAt: new Date().toLocaleString('en-KE'),
                            lastSeen: firebase.database.ServerValue.TIMESTAMP
                        }).then(function() {
                            self.user = user;
                            self.profile = {
                                name: user.displayName || 'User',
                                username: autoUsername || 'user_' + user.uid.substring(0, 8),
                                email: user.email,
                                bio: '',
                                profilePhoto: user.photoURL || '',
                                balance: 0,
                                followers: 0,
                                following: 0,
                                hashtags: [],
                                interests: [],
                                triviaAnswered: [],
                                tier: 'free'
                            };
                            
                            self.toast('Account created with Google!', 'success');
                            self.logUserActivity('google_signup', 'New user signed up with Google: ' + user.email);
                            
                            setTimeout(function() {
                                self.showCustomizeUsernameModal();
                            }, 500);
                        });
                    } else {
                        self.toast('Welcome back!', 'success');
                        self.logUserActivity('google_login', 'User logged in with Google: ' + user.email);
                    }
                });
            })
            .catch(function(err) {
                console.error('Google sign-in error:', err);
                self.toast('Google sign-in failed: ' + err.message, 'error');
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
        if (!confirm('Are you sure you want to logout?')) return;
        
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
        var modal = document.getElementById('logoutModal');
        if (modal) modal.style.display = 'none';
    },

    closeLogout: function() {
        this.closeLogoutModal();
    },

    justLogout: function() {
        this.logout();
    },

    showLogout: function() {
        var modal = document.getElementById('logoutModal');
        if (modal) modal.style.display = 'flex';
    },

    updateLogoutButton: function() {
        var logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            if (this.user && !this.isGuest) {
                logoutBtn.style.display = 'block';
                logoutBtn.textContent = '🚪 Logout (' + (this.user.email || 'User') + ')';
            } else {
                logoutBtn.style.display = 'none';
            }
        }
    },

    filterMessages: function(filter) {
        var filterBtns = document.querySelectorAll('.message-filter-btn');
        if (filterBtns) {
            filterBtns.forEach(function(btn) { btn.classList.remove('active'); });
            if (event && event.target) event.target.classList.add('active');
        }
        
        var conversationList = document.querySelector('.conversation-list');
        if (!conversationList) return;
        
        var items = conversationList.querySelectorAll('.conversation-item');
        items.forEach(function(item) {
            var unreadBadge = item.querySelector('.unread-badge');
            var hasUnread = unreadBadge && unreadBadge.textContent !== '0';
            
            if (filter === 'all') {
                item.style.display = 'flex';
            } else if (filter === 'unread' && hasUnread) {
                item.style.display = 'flex';
            } else if (filter === 'favorites') {
                var isFav = item.getAttribute('data-favorite') === 'true';
                item.style.display = isFav ? 'flex' : 'none';
            } else {
                item.style.display = 'none';
            }
        });
    },

    showChatMenu: function() {
        var menu = document.querySelector('.chat-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
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
    }
};

// ============================================
// INITIALIZE APP
// ============================================

app.init();

console.log('%c✅ CHICHI App Loaded Successfully!', 'color: #00D4AA; font-size: 16px; font-weight: bold;');
console.log('%c💰 Chichi Coins - Earn by answering trivia!', 'color: #FFC24B; font-size: 12px;');
console.log('%c🎁 Gift Catalog - Redeem coins for awesome rewards!', 'color: #8b5cf6; font-size: 12px;');
console.log('%c📊 User engagement & revenue tracking active!', 'color: #3b82f6; font-size: 12px;');
console.log('%c👨‍💻 Built by Anthony Onchari - Version V02A.01', 'color: #6b7280; font-size: 11px;');
