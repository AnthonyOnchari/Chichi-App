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
    postedHistory: [],
    lastPostTime: 0,
    autoPostInterval: null,
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
    _spinnerData: null,
    isSpinning: false,
    currentSongIndex: 0,
    isShuffleEnabled: true,
    trendingHashtags: [],

    // ============================================
    // INIT
    // ============================================

    init: function() {
        var self = this;
       
        this.chatMessages = {};
        this.unreadMessages = {};
        this.notifiedMessages = {};
        this.trendingHashtags = []; // Pre-initialize for fast loading
       
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
        this.loadSpinnerSettings();
       
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
                .then(function(reg) {
                    console.log('✅ Service Worker registered');
                    self.initNotifications();
                })
                .catch(function(err) {
                    console.error('⚠️ SW failed:', err);
                    self.initNotifications();
                });
        }
       
        auth.onAuthStateChanged(function(u) {
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
                    } else {
                        self.profile = {
                            name: u.displayName || 'User',
                            email: u.email,
                            username: u.email.split('@')[0] || 'user',
                            bio: '',
                            profilePhoto: u.photoURL || '',
                            balance: 0,
                            followers: 0,
                            following: 0,
                            triviaAnswered: [],
                            tier: 'free'
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
                if (self.autoPostInterval) {
                    clearInterval(self.autoPostInterval);
                    self.autoPostInterval = null;
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
                
                // Auto-scroll to latest message when input is focused
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
    // MUSIC FUNCTIONS
    // ============================================

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
            audio.addEventListener('ended', function() {
                if (document.getElementById('musicToggle') && document.getElementById('musicToggle').checked) {
                    this.playNextSong();
                }
            }.bind(this));
        }
    },

    showMusicPlayer: function() {
        var self = this;
        
        // Close any open menu dropdown
        var headerMenu = document.getElementById('headerMenu');
        if (headerMenu) headerMenu.style.display = 'none';
        
        // Auto-play music when opening modal
        var toggle = document.getElementById('musicToggle');
        if (!toggle.checked) {
            toggle.checked = true;
            this.playBackgroundMusic();
        }
        
        // Create modal
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.zIndex = '9999';
        
        var isPlaying = toggle.checked;
        var currentTrack = MUSIC_PLAYLIST[this.currentSongIndex] || '';
        var trackName = currentTrack.split('/').pop().replace(/[0-9_]/g, '').replace('.m4a', '') || 'Unknown';
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; padding: 28px; max-width: 400px; width: 95%; animation: slideUp 0.3s ease; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0;">Music Player</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;">✕</button>
                </div>
                
                <!-- Now Playing -->
                <div style="background: #f0f4f8; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">Now Playing</div>
                    <div style="font-weight: 600; color: #1e293b; font-size: 14px;">${trackName}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Playing</div>
                </div>
                
                <!-- Music Controls -->
                <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 20px;">
                    <button onclick="app.previousTrack()" style="background: #e2e8f0; color: #1e293b; border: none; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">← Previous</button>
                    <button onclick="app.toggleMusic()" style="background: var(--primary); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">Pause</button>
                    <button onclick="app.nextTrack()" style="background: #e2e8f0; color: #1e293b; border: none; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">Next →</button>
                </div>
                
                <!-- Upload Music -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0;">Upload Your Music</h3>
                    <input type="file" id="musicUploadInput" accept="audio/*" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px;">
                    <div style="font-size: 11px; color: #6b7280; margin-top: 8px;">Max size: 5MB</div>
                    <button onclick="app.uploadCustomMusic()" style="width: 100%; background: #0088cc; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 10px;">Upload</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
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
            this.toast('Music ON', 'success');
        } else {
            this.stopBackgroundMusic();
            if (toggleLabel) toggleLabel.classList.remove('playing');
            this.toast('Music OFF', 'success');
        }
    },

    nextTrack: function() {
        this.currentSongIndex = this.getRandomSongIndex();
        if (document.getElementById('musicToggle').checked) {
            this.playBackgroundMusic();
        }
    },

    previousTrack: function() {
        this.currentSongIndex = (this.currentSongIndex - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
        if (document.getElementById('musicToggle').checked) {
            this.playBackgroundMusic();
        }
    },

    uploadCustomMusic: function() {
        var input = document.getElementById('musicUploadInput');
        var file = input.files[0];
        
        if (!file) {
            this.toast('Please select a file', 'error');
            return;
        }
        
        // Check file size (5MB max)
        var maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.toast('File too large. Max 5MB allowed', 'error');
            return;
        }
        
        // Show upload progress
        this.toast('Uploading music...', 'info');
        
        // Upload to Cloudinary
        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        
        fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/auto/upload', {
            method: 'POST',
            body: formData
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.secure_url) {
                // Save to user profile
                app.profile.customMusic = data.secure_url;
                db.ref('users/' + app.user.uid).update({ customMusic: data.secure_url });
                app.toast('Music uploaded successfully!', 'success');
                input.value = '';
            }
        })
        .catch(function(err) {
            console.error('Upload error:', err);
            app.toast('Upload failed', 'error');
        });
    },

    playBackgroundMusic: function() {
        var audio = document.getElementById('themeMusic');
        if (!audio) return;
        
        var musicUrl = MUSIC_PLAYLIST[this.currentSongIndex];
       
        audio.src = musicUrl;
        audio.volume = 0;
        audio.loop = false;
       
        audio.play().then(function() {
            var fadeIn = setInterval(function() {
                if (audio.volume < 0.3) {
                    audio.volume += 0.05;
                } else {
                    clearInterval(fadeIn);
                }
            }, 200);
        }).catch(function(err) {
            console.log('Could not play audio:', err);
        });
    },

    stopBackgroundMusic: function() {
        var audio = document.getElementById('themeMusic');
        if (!audio) return;
        
        audio.volume = Math.max(0, audio.volume - 0.05);
        
        var fadeOut = setInterval(function() {
            if (!audio) {
                clearInterval(fadeOut);
                return;
            }
            
            if (audio.volume > 0.05) {
                audio.volume = Math.max(0, audio.volume - 0.05);
            } else {
                audio.volume = 0;
                audio.pause();
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
    // LOAD SPINNER SETTINGS
    // ============================================

    loadSpinnerSettings: function() {
        var self = this;
        db.ref('adminSettings/spinner').once('value', function(snapshot) {
            var settings = snapshot.val();
            if (settings) {
                if (settings.maxWin) SPINNER_CONFIG.maxWin = settings.maxWin;
                if (settings.spinCost) SPINNER_CONFIG.spinCost = settings.spinCost;
                console.log('🎰 Spinner settings loaded:', settings);
            }
        });
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
        // Show username setup popup once for users without username
        if (!this.user) return;
        
        var hasUsername = this.profile && this.profile.username && this.profile.username.trim() !== '';
        
        // Check if we've already shown this in this session
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
                <p style="font-size: 14px; color: #64748b; margin: 0 0 24px 0; line-height: 1.6;">You need a unique username to send and receive money, and be found by other users.</p>
                
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
        
        // Allow Enter key to submit
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
        
        // Check if username is already taken
        db.ref('users').orderByChild('username').equalTo(username).once('value')
            .then(function(snapshot) {
                if (snapshot.exists()) {
                    self.toast('This username is already taken', 'error');
                    return;
                }
                
                // Save username
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
        // ✅ DISABLED: This feature was too noisy
        return;
        
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
        
        if (this.actionTimestamps[key].length > 10) {
            this.reportSuspiciousActivity(
                'Rapid ' + action + ' - ' + this.actionTimestamps[key].length + ' times in 10 seconds',
                'high',
                { action: action, count: this.actionTimestamps[key].length }
            );
            this.actionTimestamps[key] = [];
        }
        
        var detailsStr = typeof details === 'string' ? details.toLowerCase() : JSON.stringify(details).toLowerCase();
        var suspiciousPatterns = [
            { pattern: 'delete', action: 'post', severity: 'high' },
            { pattern: 'block', action: 'user', severity: 'high' },
            { pattern: 'spam', action: 'post', severity: 'high' },
            { pattern: 'hack', action: 'attempt', severity: 'critical' },
            { pattern: 'inappropriate', action: 'content', severity: 'high' },
            { pattern: 'malicious', action: 'script', severity: 'critical' },
            { pattern: 'phishing', action: 'link', severity: 'critical' },
            { pattern: 'abuse', action: 'report', severity: 'high' },
            { pattern: 'fraud', action: 'payment', severity: 'critical' }
        ];
        
        for (var i = 0; i < suspiciousPatterns.length; i++) {
            var pattern = suspiciousPatterns[i];
            if (detailsStr.includes(pattern.pattern) || detailsStr.includes(pattern.action)) {
                this.reportSuspiciousActivity(
                    'Suspicious pattern detected: ' + pattern.pattern,
                    pattern.severity,
                    { action: action, details: details }
                );
                break;
            }
        }
        
        if (action === 'create_post' || action === 'post') {
            this.checkRapidActivity('create_post', 5, 5, 'Rapid posting detected');
        }
        if (action === 'follow') {
            this.checkRapidActivity('follow', 20, 5, 'Mass following detected');
        }
    },

    checkRapidActivity: function(action, threshold, minutes, message) {
        var self = this;
        var userId = this.user ? this.user.uid : null;
        if (!userId) return;
        
        var timeWindow = minutes * 60 * 1000;
        var cutoffTime = Date.now() - timeWindow;
        
        db.ref('activityLogs').orderByChild('userId').equalTo(userId).once('value', function(snapshot) {
            var count = 0;
            snapshot.forEach(function(child) {
                var activity = child.val();
                if (activity.action === action && activity.timestamp > cutoffTime) {
                    count++;
                }
            });
            
            if (count > threshold) {
                self.reportSuspiciousActivity(
                    message + ': ' + count + ' ' + action + 's in ' + minutes + ' minutes',
                    'medium',
                    { action: action, count: count, minutes: minutes }
                );
            }
        });
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
        
        this.sendAdminNotification('🚨 Suspicious Activity: ' + reason, severity);
        
        setTimeout(function() {
            self.suspiciousActivityDetected = false;
        }, 30000);
    },

    sendAdminNotification: function(message, severity) {
        db.ref('adminNotifications').push({
            message: message,
            severity: severity || 'medium',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            time: new Date().toLocaleString('en-KE'),
            read: false
        });
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
        this.loadAdminWithdrawals();
        this.loadActivityLog();
        this.loadSuspiciousActivity();
        this.loadAdminNotifications();
        this.loadPaymentVerifications();
        this.loadAdminSpinnerControls();
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
        var tabMap = ['dashboard', 'users', 'incomplete', 'posts', 'withdrawals', 'payments', 'spinner', 'triviaplans', 'notifications', 'logs'];
        var tabIndex = tabMap.indexOf(tab);
        if (tabIndex >= 0) {
            buttons[tabIndex].classList.add('active');
        }
       
        var contentMap = {
            'dashboard': 'adminDashboard',
            'users': 'adminUsers',
            'incomplete': 'adminIncomplete',
            'posts': 'adminPosts',
            'withdrawals': 'adminWithdrawalsTab',
            'payments': 'adminPaymentsTab',
            'spinner': 'adminSpinnerTab',
            'triviaplans': 'adminTriviaPlansTab',
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
        if (tab === 'withdrawals') this.loadAdminWithdrawals();
        if (tab === 'payments') this.loadPaymentVerifications();
        if (tab === 'spinner') this.loadAdminSpinnerControls();
        if (tab === 'triviaplans') this.loadAdminTriviaPlans();
        if (tab === 'logs') this.loadActivityLog();
        if (tab === 'suspicious') this.loadSuspiciousActivity();
        if (tab === 'notifications') this.loadAdminNotifications();
    },

    // ============================================
    // ADMIN - DASHBOARD
    // ============================================

    loadAdminDashboard: function() {
        var self = this;
       
        var userCount = Object.keys(this.users || {}).length;
        var postCount = (this.posts || []).length;
        
        // Calculate today's signups vs yesterday's
        var today = new Date().toLocaleDateString('en-KE');
        var yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('en-KE');
        var todaySignups = 0;
        var yesterdaySignups = 0;
        
        for (var uid in this.users) {
            var user = this.users[uid];
            if (user.createdAt) {
                var createdDate = user.createdAt.split(',')[0]; // Get date part only
                if (createdDate === today) todaySignups++;
                else if (createdDate === yesterday) yesterdaySignups++;
            }
        }
        
        var signupChange = yesterdaySignups > 0 ? Math.round(((todaySignups - yesterdaySignups) / yesterdaySignups) * 100) : (todaySignups > 0 ? 100 : 0);
       
        document.getElementById('adminUserCount').textContent = userCount;
        document.getElementById('adminPostCount').textContent = postCount;
        document.getElementById('adminSignupCount').textContent = todaySignups;
        document.getElementById('adminSignupChange').textContent = (signupChange >= 0 ? '↑' : '↓') + Math.abs(signupChange) + '%';
        document.getElementById('adminSignupChange').style.color = signupChange >= 0 ? '#22c55e' : '#ef4444';
       
        db.ref('bannedUsers').once('value', function(snap) {
            var bannedCount = snap.numChildren() || 0;
            document.getElementById('adminBannedCount').textContent = bannedCount;
        });
       
        db.ref('withdrawals').once('value', function(snap) {
            var withdrawals = [];
            snap.forEach(function(child) {
                withdrawals.push({
                    id: child.key,
                    ...child.val()
                });
            });
           
            var pendingCount = withdrawals.filter(function(w) { return w.status === 'pending'; }).length;
            var approvedCount = withdrawals.filter(function(w) { return w.status === 'approved'; }).length;
           
            document.getElementById('adminPendingCount').textContent = pendingCount;
            document.getElementById('adminApprovedCount').textContent = approvedCount;
           
            var html = '';
            if (withdrawals.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No withdrawal requests</div>';
            } else {
                var recent = withdrawals.slice(0, 5);
                recent.forEach(function(w) {
                    html += `
                        <div class="withdrawal-card ${w.status || 'pending'}" style="margin-bottom: 8px;">
                            <div class="withdrawal-header">
                                <div class="withdrawal-user">${w.userName || 'Unknown'}</div>
                                <div class="withdrawal-status ${w.status || 'pending'}">${(w.status || 'pending').toUpperCase()}</div>
                            </div>
                            <div class="withdrawal-details">
                                <div>KSh ${w.amount || 0} • ${w.method || 'M-Pesa'}</div>
                                <div style="font-size: 0.75rem; margin-top: 4px;">${w.createdAt || 'N/A'}</div>
                            </div>
                        </div>
                    `;
                });
            }
           
            document.getElementById('adminWithdrawals').innerHTML = html;
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
            
            // Find users without username
            var user = this.users[uid];
            if (!user.username || user.username.trim() === '') {
                usersWithoutUsername.push({
                    uid: uid,
                    name: user.name,
                    email: user.email,
                    displayName: user.displayName
                });
            }
        }

        // Show warning for users without username
        if (usersWithoutUsername.length > 0) {
            html += `
                <div style="background: #fef3c7; border: 1.5px solid #fbbf24; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <div style="font-size: 24px;">⚠️</div>
                        <div>
                            <div style="font-weight: 700; color: #92400e; margin-bottom: 8px;">⚠️ ${usersWithoutUsername.length} User${usersWithoutUsername.length > 1 ? 's' : ''} Without Username</div>
                            <div style="font-size: 13px; color: #78350f; margin-bottom: 12px;">These users won't appear in searches or transfers. Click below to fix them:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${usersWithoutUsername.map(u => `
                                    <div style="background: white; border-radius: 8px; padding: 8px 12px; font-size: 12px;">
                                        <span style="font-weight: 600; color: #1e293b;">${u.name}</span>
                                        <span style="color: #6b7280; font-size: 11px;">(${u.email})</span>
                                        <button onclick="app.fixUserUsername('${u.uid}', '${u.name}', '${u.email}')" style="margin-left: 8px; padding: 4px 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 11px; transition: 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">Fix</button>
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
                    var userTier = u.user.tier || 'free';
                    var tierData = EARNING_SETTINGS[userTier];
                    var badgeDisplay = tierData && tierData.badge ? `<span style="margin-left: 4px;">${tierData.badge}</span>` : '';
                    var usernameDisplay = u.user.username ? `<div style="font-size: 0.75rem; color: #3b82f6; margin-top: 2px;">@${u.user.username}</div>` : '<div style="font-size: 0.75rem; color: #ef4444; margin-top: 2px;">❌ NO USERNAME</div>';
                    
                    html += `
                        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; ${isBanned ? 'background: #fef2f2;' : ''}">
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${u.user.name} ${badgeDisplay} ${isBanned ? '🚫' : ''}</div>
                                <div style="font-size: 0.8rem; color: var(--text-light);">${u.user.email}</div>
                                ${usernameDisplay}
                                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">Joined: ${u.user.createdAt}</div>
                                <div style="font-size: 0.75rem; color: var(--primary);">Balance: KSh ${(u.user.balance || 0).toFixed(2)}</div>
                                <div style="font-size: 0.75rem; color: var(--primary);">Tier: ${tierData ? tierData.label : 'Free'}</div>
                                ${isBanned ? `<div style="font-size: 0.7rem; color: #ef4444;">Banned: ${banData.reason || 'No reason'}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span style="background: var(--primary); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${u.user.followers || 0} followers</span>
                                ${!u.user.username ? `
                                    <button onclick="app.fixUserUsername('${u.uid}', '${u.user.name}', '${u.user.email}')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">Fix Username</button>
                                ` : ''}
                                <button onclick="app.showBalanceEditor('${u.uid}', '${u.user.name}')" style="padding: 6px 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">💰 Balance</button>
                                <button onclick="app.viewUserActivity('${u.uid}')" style="padding: 6px 12px; background: var(--border); border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.75rem;">View</button>
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
        
        // Check if username is taken
        db.ref('users').orderByChild('username').equalTo(username).once('value')
            .then(function(snapshot) {
                if (snapshot.exists()) {
                    var existingUid = Object.keys(snapshot.val())[0];
                    if (existingUid !== uid) {
                        self.toast('This username is already taken', 'error');
                        return;
                    }
                }
                
                // Save username
                db.ref('users/' + uid + '/username').set(username);
                self.toast('✅ Username set to @' + username + ' for ' + name, 'success');
                self.logUserActivity('admin_fix_username', 'Admin set username to ' + username + ' for user ' + name);
                document.getElementById('fixUsernameModal').remove();
                self.loadAdminUsers(); // Reload users list
            })
            .catch(function(err) {
                console.error('Error:', err);
                self.toast('Error saving username', 'error');
            });
    },

    loadIncompleteUsers: function() {
        var self = this;
        console.log('📥 Loading incomplete user profiles...');
        
        var html = '';
        var incomplete = [];
        
        db.ref('users').once('value', function(snapshot) {
            var allUsers = snapshot.val() || {};
            
            // Find users missing name, email, or username
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
            
            console.log('⚠️ Incomplete profiles found:', incomplete.length);
            
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
            console.log('💬 Admin message sent to', toName);
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
    // ADMIN - WITHDRAWALS
    // ============================================

    loadAdminWithdrawals: function() {
        var self = this;
        var html = '';
        
        db.ref('withdrawals').once('value', function(snap) {
            var withdrawals = [];
            snap.forEach(function(child) {
                withdrawals.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            withdrawals.sort(function(a, b) {
                return (b.timestamp || 0) - (a.timestamp || 0);
            });
            
            if (withdrawals.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 40px 20px;">💳 No withdrawal requests</div>';
            } else {
                withdrawals.forEach(function(w) {
                    var statusClass = w.status || 'pending';
                    var statusColor = statusClass === 'pending' ? '#f59e0b' : 
                                     statusClass === 'approved' ? '#22c55e' : '#ef4444';
                    
                    html += `
                        <div class="withdrawal-card ${statusClass}" style="margin-bottom: 10px;">
                            <div class="withdrawal-header">
                                <div class="withdrawal-user">👤 ${w.userName || 'Unknown User'}</div>
                                <div class="withdrawal-status ${statusClass}" style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">${(w.status || 'pending').toUpperCase()}</div>
                            </div>
                            <div class="withdrawal-details" style="margin: 8px 0;">
                                <div style="font-size: 0.9rem; font-weight: 600;">💰 KSh ${(w.amount || 0).toFixed(2)}</div>
                                <div style="font-size: 0.8rem; color: var(--text-light);">📱 ${w.method || 'M-Pesa'} • ${w.account || 'N/A'}</div>
                                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 2px;">📧 ${w.userEmail || 'No email'}</div>
                                <div style="font-size: 0.7rem; color: var(--text-light); margin-top: 2px;">📅 ${w.createdAt || 'N/A'}</div>
                            </div>
                            ${statusClass === 'pending' ? `
                                <div class="withdrawal-actions" style="display: flex; gap: 8px; margin-top: 8px;">
                                    <button class="admin-approve" onclick="app.approveWithdrawal('${w.id}')" style="flex: 1; padding: 8px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">✅ Approve</button>
                                    <button class="admin-reject" onclick="app.rejectWithdrawal('${w.id}')" style="flex: 1; padding: 8px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">❌ Reject</button>
                                </div>
                            ` : `
                                <div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-light);">
                                    ${statusClass === 'approved' ? '✅ Approved' : '❌ Rejected'}
                                </div>
                            `}
                        </div>
                    `;
                });
            }
            
            document.getElementById('adminWithdrawalsList').innerHTML = html;
        });
    },

    approveWithdrawal: function(withdrawalId) {
        var self = this;
        db.ref('withdrawals/' + withdrawalId).update({
            status: 'approved'
        }).then(function() {
            self.toast('✅ Withdrawal approved', 'success');
            self.loadAdminWithdrawals();
            self.loadAdminDashboard();
            self.logUserActivity('admin_approve_withdrawal', 'Approved withdrawal: ' + withdrawalId);
        }).catch(function(err) {
            self.toast('❌ Error: ' + err.message, 'error');
        });
    },

    rejectWithdrawal: function(withdrawalId) {
        var self = this;
        db.ref('withdrawals/' + withdrawalId).once('value', function(snap) {
            if (snap.exists()) {
                var withdrawal = snap.val();
                db.ref('withdrawals/' + withdrawalId).update({
                    status: 'rejected'
                }).then(function() {
                    db.ref('users/' + withdrawal.userId + '/balance').once('value', function(balanceSnap) {
                        var currentBalance = balanceSnap.val() || 0;
                        db.ref('users/' + withdrawal.userId + '/balance').set(currentBalance + (withdrawal.amount || 0));
                    });
                    self.toast('✅ Withdrawal rejected and refunded', 'success');
                    self.loadAdminWithdrawals();
                    self.loadAdminDashboard();
                    self.logUserActivity('admin_reject_withdrawal', 'Rejected withdrawal: ' + withdrawalId);
                });
            }
        });
    },

    // ============================================
    // ADMIN - PAYMENT VERIFICATIONS
    // ============================================

    loadPaymentVerifications: function() {
        var self = this;
        var html = '';
        var paymentsContainer = document.getElementById('paymentVerificationsList');
        
        if (!paymentsContainer) {
            console.error('❌ Payments container not found');
            return;
        }
        
        paymentsContainer.innerHTML = '<div style="padding: 20px; text-align: center;">⏳ Loading upgrade requests...</div>';
        
        console.log('💳 Loading payment verifications...');
        
        db.ref('paymentVerifications').limitToLast(100).once('value', function(snapshot) {
            try {
                var verifications = [];
                snapshot.forEach(function(child) {
                    verifications.push({
                        id: child.key,
                        ...child.val()
                    });
                });
                
                // Sort by timestamp descending (newest first)
                verifications.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });
                
                console.log('✅ Payment verifications loaded:', verifications.length);
                
                if (verifications.length === 0) {
                    html = '<div style="text-align: center; color: #6b7280; padding: 32px 20px;"><div style="font-size: 40px; margin-bottom: 12px;">✅</div><div>No pending upgrade requests</div></div>';
                } else {
                    verifications.forEach(function(v) {
                        var statusColor = v.status === 'pending' ? '#f59e0b' : 
                                         v.status === 'approved' ? '#22c55e' : '#ef4444';
                        var timestamp = new Date(v.timestamp || 0).toLocaleString();
                        
                        html += `
                            <div style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; border-left: 4px solid ${statusColor}; background: ${v.status === 'pending' ? '#fffbeb' : 'white'}; transition: 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='${v.status === 'pending' ? '#fffbeb' : 'white'}'">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; font-size: 0.95rem; color: #1a202c;">${v.userName || 'Unknown User'}</div>
                                        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 4px;">📧 ${v.userEmail || 'N/A'}</div>
                                        <div style="font-size: 0.85rem; color: #0088cc; margin-top: 4px; font-weight: 600;">⭐ Upgrading to: ${v.tierName || 'Unknown tier'}</div>
                                        <div style="font-size: 0.85rem; color: #1a202c; margin-top: 4px; font-weight: 700;">💳 Amount: KSh ${(v.amount || 0).toFixed(2)}</div>
                                        <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 6px;">📝 ${v.confirmation || 'No verification message'}</div>
                                        <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px;">🕐 ${timestamp}</div>
                                    </div>
                                    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex-shrink: 0;">
                                        <span style="padding: 4px 12px; border-radius: 8px; background: ${statusColor}20; color: ${statusColor}; font-size: 0.75rem; font-weight: 700; white-space: nowrap;">${(v.status || 'pending').toUpperCase()}</span>
                                        ${v.status === 'pending' ? `
                                            <button onclick="app.approvePayment('${v.id}', '${v.userId}', '${v.tier}')" style="padding: 6px 14px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; white-space: nowrap; transition: 0.2s;" onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'">✅ Approve</button>
                                            <button onclick="app.rejectPayment('${v.id}')" style="padding: 6px 14px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; white-space: nowrap; transition: 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">❌ Reject</button>
                                        ` : '<span style="padding: 4px 12px; font-size: 0.75rem; font-weight: 600; color: #6b7280;">' + v.status.toUpperCase() + '</span>'}
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }
                
                paymentsContainer.innerHTML = html;
            } catch (err) {
                console.error('❌ Error loading payments:', err);
                paymentsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">❌ Error: ' + err.message + '</div>';
            }
        }, function(err) {
            console.error('❌ Firebase error:', err);
            paymentsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">❌ Firebase Error: ' + err.message + '</div>';
        });
    },

    approvePayment: function(paymentId, userId, tier) {
        var self = this;
        
        if (!confirm('Approve this payment and upgrade user to ' + tier + '?')) {
            return;
        }
        
        db.ref('paymentVerifications/' + paymentId + '/status').set('approved').then(function() {
            db.ref('users/' + userId + '/tier').set(tier);
            localStorage.setItem('chichi_user_tier_' + userId, tier);
            
            self.toast('✅ Payment approved and user upgraded!', 'success');
            self.loadPaymentVerifications();
            self.loadAdminUsers();
            self.logUserActivity('admin_approve_payment', 'Approved payment for ' + userId + ' to ' + tier);
        }).catch(function(err) {
            self.toast('❌ Error: ' + err.message, 'error');
        });
    },

    rejectPayment: function(paymentId) {
        var self = this;
        
        if (!confirm('Reject this payment?')) {
            return;
        }
        
        db.ref('paymentVerifications/' + paymentId + '/status').set('rejected').then(function() {
            self.toast('✅ Payment rejected', 'success');
            self.loadPaymentVerifications();
            self.logUserActivity('admin_reject_payment', 'Rejected payment');
        }).catch(function(err) {
            self.toast('❌ Error: ' + err.message, 'error');
        });
    },

    // ============================================
    // ADMIN - SPINNER CONTROLS
    // ============================================

    loadAdminSpinnerControls: function() {
        var self = this;
        var html = '';
        
        html = `
            <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 12px 0;">🎰 Spinner Controls</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="font-size: 13px; font-weight: 600;">Max Win (KSh)</label>
                        <input type="number" id="adminMaxWin" value="${SPINNER_CONFIG.maxWin}" class="form-input" style="margin-top: 4px; width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div>
                        <label style="font-size: 13px; font-weight: 600;">Spin Cost (KSh)</label>
                        <input type="number" id="adminSpinCost" value="${SPINNER_CONFIG.spinCost}" class="form-input" style="margin-top: 4px; width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                </div>
                
                <button onclick="app.saveSpinnerSettings()" style="background: var(--primary); color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%; margin-bottom: 12px;">
                    💾 Save Settings
                </button>
                
                <div style="border-top: 1px solid var(--border); padding-top: 12px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Force Win</div>
                    <div style="display: flex; gap: 8px;">
                        <input type="number" id="adminForceAmount" placeholder="Amount" class="form-input" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 8px;">
                        <button onclick="app.adminForceWin()" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">⚡ Force Win</button>
                    </div>
                </div>
                
                <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Game Controls</div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="app.adminToggleSpins()" style="flex: 1; padding: 8px; background: ${window.ADMIN_SPINNER_OVERRIDES && window.ADMIN_SPINNER_OVERRIDES.disableSpins ? '#22c55e' : '#ef4444'}; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            ${window.ADMIN_SPINNER_OVERRIDES && window.ADMIN_SPINNER_OVERRIDES.disableSpins ? '✅ Enable Spins' : '❌ Disable Spins'}
                        </button>
                    </div>
                </div>
                
                <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Win Odds Control</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                        <button onclick="app.setOdds('high')" style="padding: 6px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">🎯 High Wins</button>
                        <button onclick="app.setOdds('normal')" style="padding: 6px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">⚖️ Normal</button>
                        <button onclick="app.setOdds('low')" style="padding: 6px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">💀 Low Wins</button>
                    </div>
                </div>
            </div>
            
            <div style="background: white; border-radius: 12px; padding: 16px;">
                <h3 style="margin: 0 0 12px 0;">📊 Spinner Stats</h3>
                <div id="spinnerStats"></div>
            </div>
        `;
        
        document.getElementById('adminSpinnerControls').innerHTML = html;
        this.loadSpinnerStats();
    },

    saveSpinnerSettings: function() {
        var maxWin = parseInt(document.getElementById('adminMaxWin').value);
        var spinCost = parseInt(document.getElementById('adminSpinCost').value);
        
        if (isNaN(maxWin) || maxWin < 1) {
            this.toast('⚠️ Invalid max win amount', 'error');
            return;
        }
        if (isNaN(spinCost) || spinCost < 1) {
            this.toast('⚠️ Invalid spin cost', 'error');
            return;
        }
        
        SPINNER_CONFIG.maxWin = maxWin;
        SPINNER_CONFIG.spinCost = spinCost;
        
        db.ref('adminSettings/spinner').set({
            maxWin: maxWin,
            spinCost: spinCost,
            updatedAt: new Date().toLocaleString('en-KE')
        });
        
        this.toast('✅ Spinner settings saved!', 'success');
        this.logUserActivity('admin_spinner_settings', 'Updated spinner settings');
    },

    adminForceWin: function() {
        var amount = parseInt(document.getElementById('adminForceAmount').value);
        
        if (isNaN(amount) || amount < 1) {
            this.toast('⚠️ Enter a valid amount', 'error');
            return;
        }
        
        if (amount > SPINNER_CONFIG.maxWin) {
            this.toast('⚠️ Amount exceeds max win (' + SPINNER_CONFIG.maxWin + ')', 'error');
            return;
        }
        
        if (!window.ADMIN_SPINNER_OVERRIDES) {
            window.ADMIN_SPINNER_OVERRIDES = {};
        }
        window.ADMIN_SPINNER_OVERRIDES.forceWin = true;
        window.ADMIN_SPINNER_OVERRIDES.forceAmount = amount;
        
        this.toast('✅ Next spin will force win KSh ' + amount, 'success');
        this.logUserActivity('admin_force_win', 'Forced win of KSh ' + amount);
        document.getElementById('adminForceAmount').value = '';
    },

    adminToggleSpins: function() {
        if (!window.ADMIN_SPINNER_OVERRIDES) {
            window.ADMIN_SPINNER_OVERRIDES = {};
        }
        window.ADMIN_SPINNER_OVERRIDES.disableSpins = !window.ADMIN_SPINNER_OVERRIDES.disableSpins;
        this.loadAdminSpinnerControls();
        this.toast(window.ADMIN_SPINNER_OVERRIDES.disableSpins ? '❌ Spins disabled' : '✅ Spins enabled', 'success');
    },

    setOdds: function(level) {
        var oddsMap = {
            'high': { winWeight: 15, loseWeight: 10 },
            'normal': { winWeight: 10, loseWeight: 10 },
            'low': { winWeight: 5, loseWeight: 20 }
        };
        
        var odds = oddsMap[level];
        if (!odds) return;
        
        SPINNER_CONFIG.segments.forEach(function(seg) {
            if (seg.value === 0) {
                seg.weight = odds.loseWeight;
            } else {
                seg.weight = odds.winWeight / (SPINNER_CONFIG.segments.length - 1);
            }
        });
        
        this.toast('✅ Odds set to: ' + level.toUpperCase(), 'success');
        this.logUserActivity('admin_set_odds', 'Set odds to ' + level);
    },

    loadSpinnerStats: function() {
        var self = this;
        
        db.ref('activityLogs').orderByChild('action').once('value', function(snapshot) {
            var wins = [];
            var spins = [];
            
            snapshot.forEach(function(child) {
                var activity = child.val();
                if (activity.action === 'spinner_win') {
                    wins.push(activity);
                }
                if (activity.action === 'spinner_lose') {
                    spins.push(activity);
                }
            });
            
            var totalWins = wins.length;
            var totalSpins = wins.length + spins.length;
            var totalAmount = 0;
            wins.forEach(function(w) {
                var details = w.details || '';
                var match = details.match(/KSh (\d+)/);
                if (match) {
                    totalAmount += parseInt(match[1]);
                }
            });
            
            var winRate = totalSpins > 0 ? Math.round((totalWins / totalSpins) * 100) : 0;
            var avgWin = totalWins > 0 ? Math.round(totalAmount / totalWins) : 0;
            
            var html = `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                    <div style="background: #f0f7ff; padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 11px; color: #6b7280;">Total Wins</div>
                        <div style="font-size: 24px; font-weight: 700; color: #0088cc;">${totalWins}</div>
                    </div>
                    <div style="background: #f0f7ff; padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 11px; color: #6b7280;">Win Rate</div>
                        <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${winRate}%</div>
                    </div>
                    <div style="background: #f0f7ff; padding: 12px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 11px; color: #6b7280;">Avg Win</div>
                        <div style="font-size: 24px; font-weight: 700; color: #22c55e;">KSh ${avgWin}</div>
                    </div>
                </div>
                <div style="margin-top: 12px; text-align: center; font-size: 12px; color: #6b7280;">
                    Total paid out: KSh ${totalAmount} from ${totalSpins} spins
                </div>
            `;
            
            var statsContainer = document.getElementById('spinnerStats');
            if (statsContainer) {
                statsContainer.innerHTML = html;
            }
        });
    },

    // ============================================
    // ADMIN - TRIVIA PLANS EDITOR
    // ============================================

    loadAdminTriviaPlans: function() {
        var self = this;
        var html = '';
        
        html = `
            <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 16px 0;">📚 Manage Trivia Plans (Daily)</h3>
                <div style="font-size: 13px; color: #64748b; margin-bottom: 16px; line-height: 1.6;">
                    Edit daily question limits, rewards per question, and other settings for each plan tier.
                </div>
        `;
        
        // Iterate through each tier
        ['free', 'premium', 'vip'].forEach(function(tier) {
            var plan = EARNING_SETTINGS[tier];
            var tierLabelMap = { 'free': 'Free', 'premium': 'Premium', 'vip': 'VIP' };
            var tierColorMap = { 'free': '#6b7280', 'premium': '#3b82f6', 'vip': '#a855f7' };
            
            html += `
                <div style="background: linear-gradient(135deg, ${tierColorMap[tier]}15, ${tierColorMap[tier]}08); border: 1.5px solid ${tierColorMap[tier]}40; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                    <h4 style="margin: 0 0 14px 0; color: ${tierColorMap[tier]}; font-weight: 700;">${tierLabelMap[tier]} Plan (Daily)</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div>
                            <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 6px;">Questions Per Day</label>
                            <input type="number" id="${tier}QuestionsPerDay" value="${plan.questionsPerDay}" min="1" max="100" class="form-input" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 6px;">Reward Per Question (KSh)</label>
                            <input type="number" id="${tier}RewardPerQuestion" value="${plan.rewardPerQuestion}" min="0.1" step="0.1" class="form-input" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;">
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div>
                            <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 6px;">Timer (Seconds)</label>
                            <input type="number" id="${tier}TimerSeconds" value="${plan.timerSeconds}" min="5" max="60" class="form-input" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;">
                        </div>
                        <div>
                            <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 6px;">Ads Per Question</label>
                            <input type="number" id="${tier}AdsPerQuestion" value="${plan.adsPerQuestion}" min="0" max="10" class="form-input" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px;">
                        </div>
                    </div>
                    
                    <button onclick="app.saveTriviaPlanSettings('${tier}')" style="width: 100%; background: ${tierColorMap[tier]}; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        💾 Save ${tierLabelMap[tier]} Plan
                    </button>
                </div>
            `;
        });
        
        html += `</div>`;
        
        document.getElementById('adminTriviaPlansList').innerHTML = html;
    },
    
    saveTriviaPlanSettings: function(tier) {
        var questionsPerDay = parseInt(document.getElementById(tier + 'QuestionsPerDay').value);
        var rewardPerQuestion = parseFloat(document.getElementById(tier + 'RewardPerQuestion').value);
        var timerSeconds = parseInt(document.getElementById(tier + 'TimerSeconds').value);
        var adsPerQuestion = parseInt(document.getElementById(tier + 'AdsPerQuestion').value);
        
        // Validation
        if (isNaN(questionsPerDay) || questionsPerDay < 1) {
            this.toast('Questions per day must be at least 1', 'error');
            return;
        }
        if (isNaN(rewardPerQuestion) || rewardPerQuestion < 0) {
            this.toast('Reward must be 0 or higher', 'error');
            return;
        }
        if (isNaN(timerSeconds) || timerSeconds < 5) {
            this.toast('Timer must be at least 5 seconds', 'error');
            return;
        }
        if (isNaN(adsPerQuestion) || adsPerQuestion < 0) {
            this.toast('Ads per question must be 0 or higher', 'error');
            return;
        }
        
        // Update local settings
        EARNING_SETTINGS[tier].questionsPerDay = questionsPerDay;
        EARNING_SETTINGS[tier].rewardPerQuestion = rewardPerQuestion;
        EARNING_SETTINGS[tier].timerSeconds = timerSeconds;
        EARNING_SETTINGS[tier].adsPerQuestion = adsPerQuestion;
        
        // Save to localStorage for persistence
        localStorage.setItem('EARNING_SETTINGS_' + tier, JSON.stringify({
            questionsPerDay: questionsPerDay,
            rewardPerQuestion: rewardPerQuestion,
            timerSeconds: timerSeconds,
            adsPerQuestion: adsPerQuestion
        }));
        
        this.toast('✅ ' + tier.charAt(0).toUpperCase() + tier.slice(1) + ' plan updated!', 'success');
        this.logUserActivity('trivia_plan_update', 'Updated ' + tier + ' plan - ' + questionsPerDay + ' questions, KSh ' + rewardPerQuestion + ' reward');
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
        
        console.log('📊 Loading activity logs...');
        
        db.ref('activityLogs').limitToLast(100).once('value', function(snapshot) {
            try {
                var activities = [];
                snapshot.forEach(function(child) {
                    activities.push({
                        id: child.key,
                        ...child.val()
                    });
                });
                
                // Sort by timestamp descending (newest first)
                activities.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });
                
                console.log('✅ Activity logs loaded:', activities.length);
                
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
                            'admin_delete_post': '🗑️', 'admin_approve_withdrawal': '✅',
                            'admin_reject_withdrawal': '❌', 'admin_resolve_activity': '✅',
                            'admin_approve_payment': '✅', 'admin_reject_payment': '❌',
                            'admin_spinner_settings': '🎰', 'admin_force_win': '⚡',
                            'admin_toggle_spins': '🔀', 'admin_set_odds': '🎯',
                            'spinner_win': '🎉', 'spinner_lose': '😔',
                            'payment_submit': '💳', 'password_reset': '🔑'
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
        
        console.log('📬 Loading admin notifications...');
        
        db.ref('adminNotifications').limitToLast(50).once('value', function(snapshot) {
            try {
                var notifications = [];
                snapshot.forEach(function(child) {
                    notifications.push({
                        id: child.key,
                        ...child.val()
                    });
                });
                
                // Sort by timestamp descending
                notifications.sort(function(a, b) {
                    return (b.timestamp || 0) - (a.timestamp || 0);
                });
                
                console.log('✅ Notifications loaded:', notifications.length);
                
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
                                        ${notif.details ? `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 4px;">📝 ${notif.details}</div>` : ''}
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

    markNotificationRead: function(notificationId) {
        var self = this;
        db.ref('adminNotifications/' + notificationId + '/read').set(true).then(function() {
            self.loadAdminNotifications();
        }).catch(function(err) {
            self.toast('❌ Error: ' + err.message, 'error');
        });
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
                        <div style="font-size: 28px; font-weight: 700; color: #92400e;">KSh ${currentBalance.toFixed(2)}</div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">New Balance (KSh)</label>
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
        
        console.log('💰 Updating balance for', userName, 'to KSh', balance.toFixed(2));
        
        db.ref('users/' + uid + '/balance').set(balance, function(err) {
            if (err) {
                this.toast('❌ Error: ' + err.message, 'error');
            } else {
                this.toast('✅ Balance updated to KSh ' + balance.toFixed(2), 'success');
                document.getElementById('balanceEditModal').remove();
                this.loadAdminUsers();
            }
        }.bind(this));
    },

    // ============================================
    // PREMIUM PAYMENT FUNCTIONS
    // ============================================

    showUpgradeTierSelector: function() {
        var self = this;
        if (!this.user) {
            this.toast('⚠️ Please login first', 'error');
            return;
        }
        
        var currentTier = this.getUserTier();
        var premiumData = EARNING_SETTINGS['premium'];
        var vipData = EARNING_SETTINGS['vip'];
        
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" style="max-width: 500px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="font-weight: 700; margin: 0;">⭐ Choose Your Tier</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">✕</button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                    <!-- PREMIUM OPTION -->
                    <div style="border: 2px solid #667eea; border-radius: 14px; padding: 16px; text-align: center; cursor: pointer; background: ${currentTier === 'premium' ? '#f0f7ff' : 'white'}; transition: 0.3s;" onclick="app.showPremiumPayment('premium'); document.querySelector('.modal-overlay').remove();" onmouseover="this.style.background='#f0f7ff';this.style.boxShadow='0 8px 16px rgba(102,126,234,0.2)'" onmouseout="this.style.background='${currentTier === 'premium' ? '#f0f7ff' : 'white'}';this.style.boxShadow='none'">
                        <div style="font-size: 32px; margin-bottom: 8px;">⭐</div>
                        <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">Premium</div>
                        <div style="color: #6b7280; font-size: 12px; margin-bottom: 12px;">Better rewards</div>
                        <div style="background: #f0f7ff; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
                            <div style="font-size: 18px; font-weight: 800; color: #667eea;">KSh ${premiumData.price}</div>
                            <div style="font-size: 11px; color: #6b7280;">/month</div>
                        </div>
                        <div style="font-size: 11px; color: #1a202c; text-align: left; line-height: 1.6; background: #fafafa; padding: 10px; border-radius: 8px;">
                            ✅ +KSh ${premiumData.rewardPerQuestion}/question<br>
                            ✅ ${premiumData.questionsPerDay} daily questions<br>
                            ✅ ${premiumData.adsPerQuestion === 0 ? 'No ads' : premiumData.adsPerQuestion + ' ads'}<br>
                            ✅ ${premiumData.bonus}
                        </div>
                    </div>
                    
                    <!-- VIP OPTION -->
                    <div style="border: 3px solid #f59e0b; border-radius: 14px; padding: 16px; text-align: center; cursor: pointer; background: ${currentTier === 'vip' ? '#fffbeb' : 'white'}; position: relative; transition: 0.3s;" onclick="app.showPremiumPayment('vip'); document.querySelector('.modal-overlay').remove();" onmouseover="this.style.background='#fffbeb';this.style.boxShadow='0 8px 16px rgba(245,158,11,0.3)'" onmouseout="this.style.background='${currentTier === 'vip' ? '#fffbeb' : 'white'}';this.style.boxShadow='none'">
                        <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700;">BEST VALUE</div>
                        <div style="font-size: 32px; margin-bottom: 8px;">👑</div>
                        <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">VIP</div>
                        <div style="color: #6b7280; font-size: 12px; margin-bottom: 12px;">Maximum rewards</div>
                        <div style="background: linear-gradient(135deg, #fffbeb, #fee2e2); padding: 10px; border-radius: 8px; margin-bottom: 12px;">
                            <div style="font-size: 18px; font-weight: 800; color: #f59e0b;">KSh ${vipData.price}</div>
                            <div style="font-size: 11px; color: #6b7280;">/month</div>
                        </div>
                        <div style="font-size: 11px; color: #1a202c; text-align: left; line-height: 1.6; background: #fafafa; padding: 10px; border-radius: 8px;">
              