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
        document.querySelectorAll('.admin-tab').forEach(function(t) { if (t && t.classList) t.classList.remove('active'); });
        document.querySelectorAll('.admin-tab-content').forEach(function(c) { if (c && c.classList) c.classList.remove('active'); });
       
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
                html += '<button onclick="app.viewUserProfile(\'' + r.uid + '\')" style="padding:6px 12px;background:' + (isFollowing ? '#ef4444' : 'var(--primary)') + ';color:white;border:none;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;white-space: