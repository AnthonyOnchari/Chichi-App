// ============================================
// SPINNER CONFIGURATION
// ============================================


// ============================================
// PREMIUM/VIP TIERS
// ============================================



// ============================================
// FIREBASE CONFIG
// ============================================

if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log('✅ Firebase initialized');
} else {
    console.log('⚠️ Firebase already initialized');
}

var auth = firebase.auth();
var db = firebase.database();

db.ref('.info/connected').on('value', function(snapshot) {
    if (snapshot.val() === true) {
        console.log('🌐 Connected to Firebase');
    } else {
        console.log('📡 Disconnected from Firebase');
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

// ============================================
// POST TEMPLATES
// ============================================

const POST_TEMPLATES = [
    { text: "I told my boss I needed a raise because I'm the best worker here. He said 'You're also the only worker here.' I got the raise.", category: "Funny", imageKeyword: "happy person laughing portrait" },
    { text: "My phone has more storage than my brain. I can remember 1000 songs but not what I ate for breakfast.", category: "Funny", imageKeyword: "confused person thinking" },
    { text: "The best part about working from home is that my commute is 10 seconds. The worst part? My boss is always in my kitchen.", category: "Funny", imageKeyword: "person working on laptop smiling" },
    { text: "I asked Google 'Why am I so tired?' It said 'Because you're always on your phone at 2 AM.'", category: "Funny", imageKeyword: "tired person in bed with phone" },
    { text: "My dog thinks I'm a superhero. He gets excited every time I come home from the bathroom.", category: "Funny", imageKeyword: "person with dog happy" },
    { text: "I'm not saying I'm old, but my back goes out more than I do.", category: "Funny", imageKeyword: "elderly person smiling" },
    { text: "The best way to remember your wife's birthday is to forget it once.", category: "Funny", imageKeyword: "couple laughing together" },
    { text: "I don't need a hair stylist, my pillow gives me a new style every morning.", category: "Funny", imageKeyword: "person with messy hair laughing" },
    { text: "My brain has two modes: 'I can do anything' and 'What was I doing again?'", category: "Funny", imageKeyword: "confused person scratching head" },
    { text: "The best exercise for losing weight is running out of patience.", category: "Funny", imageKeyword: "person exercising frustrated" },
    { text: "My boss told me to have a good day. I went home.", category: "Funny", imageKeyword: "person leaving office happy" },
    { text: "I'm not lazy, I'm on energy saving mode.", category: "Funny", imageKeyword: "person lying on couch relaxing" },
    { text: "The only thing I'm good at is making bad decisions look good.", category: "Funny", imageKeyword: "person laughing at themselves" },
    { text: "I need a 6-month vacation, twice a year.", category: "Funny", imageKeyword: "person on beach relaxing" },
    { text: "My life is a series of naps interrupted by food.", category: "Funny", imageKeyword: "person sleeping peacefully" },
    { text: "Your greatest strength is your ability to keep going when others give up. Keep pushing.", category: "Inspiration", imageKeyword: "determined person sunrise" },
    { text: "The only person you should try to be better than is the person you were yesterday.", category: "Inspiration", imageKeyword: "person looking forward determined" },
    { text: "Success is not about how many times you fall, but how many times you get back up.", category: "Inspiration", imageKeyword: "person getting up determined" },
    { text: "Every morning is a new beginning. Make it count.", category: "Inspiration", imageKeyword: "person morning coffee smiling" },
    { text: "Your potential is endless. Don't limit yourself.", category: "Inspiration", imageKeyword: "person with arms open confident" },
    { text: "The best time to start was yesterday. The next best time is now.", category: "Inspiration", imageKeyword: "person starting journey determined" },
    { text: "Believe you can and you're halfway there.", category: "Inspiration", imageKeyword: "confident person smiling" },
    { text: "Your only limit is the one you set for yourself.", category: "Inspiration", imageKeyword: "person breaking through barrier" },
    { text: "Dream big. Work hard. Stay focused.", category: "Inspiration", imageKeyword: "focused person working" },
    { text: "You are stronger than you think.", category: "Inspiration", imageKeyword: "strong person confident" },
    { text: "Success starts with self-belief.", category: "Inspiration", imageKeyword: "person believing in themselves" },
    { text: "Be the energy you want to attract.", category: "Inspiration", imageKeyword: "happy positive person" },
    { text: "Kenya's economy grew by 5.6% in 2023. The tech sector is leading the growth.", category: "Kenya News", imageKeyword: "Kenyan person in tech office" },
    { text: "The Maasai Mara is considered the 7th wonder of the world. Over 1.5 million wildebeest migrate annually.", category: "Kenya News", imageKeyword: "Maasai person smiling" },
    { text: "Kenyan youth are leading Africa's tech revolution. Over 200 startups launched this year.", category: "Kenya News", imageKeyword: "Kenyan youth coding smiling" },
    { text: "Kenya is home to the world's largest refugee camp at Dadaab.", category: "Kenya News", imageKeyword: "Kenyan community together" },
    { text: "Lake Victoria, the largest lake in Africa, is shared by Kenya, Uganda, and Tanzania.", category: "Kenya News", imageKeyword: "people at lake smiling" },
    { text: "Kenya has 42 different ethnic communities, each with its own unique culture.", category: "Kenya News", imageKeyword: "Kenyan cultural dancers" },
    { text: "The Kenyan shilling is one of the most stable currencies in East Africa.", category: "Kenya News", imageKeyword: "Kenyan business person" },
    { text: "Kenya produces some of the world's best marathon runners.", category: "Kenya News", imageKeyword: "Kenyan runner smiling" },
    { text: "Nairobi is the only capital city with a national park.", category: "Kenya News", imageKeyword: "person in Nairobi smiling" },
    { text: "Kenyan coffee is among the best in the world.", category: "Kenya News", imageKeyword: "Kenyan coffee farmer smiling" },
    { text: "AI is revolutionizing healthcare. New algorithms can detect diseases earlier than doctors.", category: "Tech", imageKeyword: "doctor with AI technology" },
    { text: "Your smartphone is more powerful than the computers that sent humans to the moon.", category: "Tech", imageKeyword: "person amazed by phone" },
    { text: "The world's fastest internet is in South Korea. 6G is coming soon.", category: "Tech", imageKeyword: "person on laptop excited" },
    { text: "Blockchain technology is changing how we think about money and trust.", category: "Tech", imageKeyword: "person with blockchain concept" },
    { text: "The first computer virus was created in 1983. It was called the 'Elk Cloner'.", category: "Tech", imageKeyword: "person at computer thinking" },
    { text: "Cloud computing has revolutionized how businesses operate worldwide.", category: "Tech", imageKeyword: "business person using cloud" },
    { text: "5G technology is transforming how we connect.", category: "Tech", imageKeyword: "person with 5G phone smiling" },
    { text: "The future of work is remote and digital.", category: "Tech", imageKeyword: "person working remotely" },
    { text: "A 10-minute daily meditation can reduce stress by 30%. Try it today.", category: "Wellness", imageKeyword: "person meditating peaceful" },
    { text: "Walking 30 minutes a day can add 3 years to your life. It's that simple.", category: "Wellness", imageKeyword: "person walking happy smiling" },
    { text: "The average person spends 2 hours a day on social media. Make it count.", category: "Wellness", imageKeyword: "person on phone mindful" },
    { text: "Drinking water first thing in the morning boosts your metabolism.", category: "Wellness", imageKeyword: "person drinking water morning" },
    { text: "Sleep is not a luxury, it's a necessity. Aim for 7-8 hours.", category: "Wellness", imageKeyword: "person sleeping peacefully" },
    { text: "Reading 15 minutes a day can reduce stress by 60%.", category: "Wellness", imageKeyword: "person reading book relaxed" },
    { text: "Yoga is the perfect way to start your day.", category: "Wellness", imageKeyword: "person doing yoga" },
    { text: "Mental health matters. Take a break when you need to.", category: "Wellness", imageKeyword: "person taking a break" },
    { text: "The best Kenyan dish? Some say Nyama Choma, others say Ugali. Try both!", category: "Food", imageKeyword: "people eating Kenyan food" },
    { text: "Cooking is an art. Your kitchen is your canvas. Create something beautiful.", category: "Food", imageKeyword: "person cooking happy" },
    { text: "Traditional Kenyan food is some of the most flavorful in the world.", category: "Food", imageKeyword: "Kenyan person eating" },
    { text: "Chapati is life. That's a fact, not an opinion.", category: "Food", imageKeyword: "person making chapati" },
    { text: "Good food equals good mood.", category: "Food", imageKeyword: "person eating happily" },
    { text: "The best meals are shared with loved ones.", category: "Food", imageKeyword: "family eating together" },
    { text: "Kenya has 8 national parks. Each one is unique. Visit them all.", category: "Travel", imageKeyword: "person on safari smiling" },
    { text: "Travel makes you realize how beautiful the world truly is.", category: "Travel", imageKeyword: "person traveling happy" },
    { text: "The Kenyan coast is one of the most beautiful places on Earth.", category: "Travel", imageKeyword: "person on Kenyan beach" },
    { text: "Mombasa's old town is a UNESCO World Heritage site. It's worth a visit.", category: "Travel", imageKeyword: "person in Mombasa smiling" },
    { text: "Adventure awaits. Go explore!", category: "Travel", imageKeyword: "adventurous person" },
    { text: "Travel is the only thing you buy that makes you richer.", category: "Travel", imageKeyword: "happy traveler" },
    { text: "Your brain is constantly changing. Every thought you have physically rewires your brain.", category: "Fun Facts", imageKeyword: "person thinking" },
    { text: "The human body has 37 trillion cells. Each one is working right now to keep you alive.", category: "Fun Facts", imageKeyword: "healthy person smiling" },
    { text: "Dolphins sleep with one eye open. Half their brain stays awake.", category: "Fun Facts", imageKeyword: "person amazed" },
    { text: "The average person walks about 100,000 miles in their lifetime.", category: "Fun Facts", imageKeyword: "person walking" },
    { text: "Your heart beats about 100,000 times per day. That's 2.5 billion times in a lifetime.", category: "Fun Facts", imageKeyword: "person with heart" },
    { text: "The Great Wall of China is not visible from space. This is a common myth.", category: "Fun Facts", imageKeyword: "person traveling" },
    { text: "Humans are the only animals that blush.", category: "Fun Facts", imageKeyword: "person blushing" },
    { text: "Your body produces enough heat in 30 minutes to boil a gallon of water.", category: "Fun Facts", imageKeyword: "person feeling warm" },
    { text: "The best relationships are built on trust, communication, and a good sense of humor.", category: "Relationships", imageKeyword: "couple laughing together" },
    { text: "A happy relationship is about understanding, not agreement.", category: "Relationships", imageKeyword: "couple talking" },
    { text: "Love is not about how many days you've been together, but how much you've grown together.", category: "Relationships", imageKeyword: "couple in love" },
    { text: "The best love story is when you fall in love with the most unexpected person.", category: "Relationships", imageKeyword: "couple happy" },
    { text: "Love is patient, love is kind. Love is everything.", category: "Relationships", imageKeyword: "couple hugging" },
    { text: "A relationship is not a 50/50 deal. It's 100/100.", category: "Relationships", imageKeyword: "couple supporting each other" },
];

// ============================================
// EARNING SETTINGS
// ============================================


// ============================================
// TRIVIA QUESTIONS
// ============================================




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
                self.showApp();
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
        
        this.loadPostedHistory();
        this.loadDarkModePreference();
        
        setTimeout(function() {
            if (self.user && self.user.email === 'support-chichi@gmail.com') {
                console.log('🤖 Support account detected! Starting auto-post scheduler...');
                self.startAutoPostScheduler();
            }
        }, 5000);
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
        var fadeOut = setInterval(function() {
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
        var tabMap = ['dashboard', 'users', 'posts', 'withdrawals', 'payments', 'spinner', 'suspicious', 'notifications', 'logs'];
        var tabIndex = tabMap.indexOf(tab);
        if (tabIndex >= 0) {
            buttons[tabIndex].classList.add('active');
        }
       
        var contentMap = {
            'dashboard': 'adminDashboard',
            'users': 'adminUsers',
            'posts': 'adminPosts',
            'withdrawals': 'adminWithdrawalsTab',
            'payments': 'adminPaymentsTab',
            'spinner': 'adminSpinnerTab',
            'suspicious': 'adminSuspiciousTab',
            'notifications': 'adminNotificationsTab',
            'logs': 'adminLogs'
        };
       
        var contentId = contentMap[tab];
        if (contentId) {
            document.getElementById(contentId).classList.add('active');
        }
       
        if (tab === 'users') this.loadAdminUsers();
        if (tab === 'posts') this.loadAdminPosts();
        if (tab === 'withdrawals') this.loadAdminWithdrawals();
        if (tab === 'payments') this.loadPaymentVerifications();
        if (tab === 'spinner') this.loadAdminSpinnerControls();
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
       
        document.getElementById('adminUserCount').textContent = userCount;
        document.getElementById('adminPostCount').textContent = postCount;
       
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
       
        for (var uid in this.users) {
            userArray.push({ uid: uid, user: this.users[uid] });
        }

        if (userArray.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No users yet</div>';
        } else {
            html = '<div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">';
            
            db.ref('bannedUsers').once('value', function(bannedSnap) {
                var bannedUsers = bannedSnap.val() || {};
                
                userArray.forEach(function(u) {
                    var isBanned = bannedUsers[u.uid] ? true : false;
                    var banData = bannedUsers[u.uid] || {};
                    var userTier = u.user.tier || 'free';
                    var tierData = EARNING_SETTINGS[userTier];
                    var badgeDisplay = tierData && tierData.badge ? `<span style="margin-left: 4px;">${tierData.badge}</span>` : '';
                    
                    html += `
                        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; ${isBanned ? 'background: #fef2f2;' : ''}">
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${u.user.name} ${badgeDisplay} ${isBanned ? '🚫' : ''}</div>
                                <div style="font-size: 0.8rem; color: var(--text-light);">${u.user.email}</div>
                                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">Joined: ${u.user.createdAt}</div>
                                <div style="font-size: 0.75rem; color: var(--primary);">Balance: KSh ${(u.user.balance || 0).toFixed(2)}</div>
                                <div style="font-size: 0.75rem; color: var(--primary);">Tier: ${tierData ? tierData.label : 'Free'}</div>
                                ${isBanned ? `<div style="font-size: 0.7rem; color: #ef4444;">Banned: ${banData.reason || 'No reason'}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span style="background: var(--primary); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${u.user.followers || 0} followers</span>
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
        
        db.ref('paymentVerifications').orderByChild('timestamp').limitToLast(50).once('value', function(snapshot) {
            var verifications = [];
            snapshot.forEach(function(child) {
                verifications.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            verifications.reverse();
            
            if (verifications.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No payment verifications</div>';
            } else {
                verifications.forEach(function(v) {
                    var statusColor = v.status === 'pending' ? '#f59e0b' : 
                                     v.status === 'approved' ? '#22c55e' : '#ef4444';
                    
                    html += `
                        <div style="padding: 12px; border-bottom: 1px solid var(--border); border-left: 4px solid ${statusColor}; margin-bottom: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem;">${v.userName || 'Unknown'}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-light);">${v.tierName || 'Unknown tier'} - KSh ${v.amount || 0}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-light);">${v.time || 'N/A'}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-light); margin-top: 4px; max-height: 60px; overflow-y: auto;">${v.confirmation || 'No message'}</div>
                                </div>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <span style="padding: 2px 8px; border-radius: 8px; background: ${statusColor}20; color: ${statusColor}; font-size: 0.7rem; font-weight: 600;">${(v.status || 'pending').toUpperCase()}</span>
                                    ${v.status === 'pending' ? `
                                        <button onclick="app.approvePayment('${v.id}', '${v.userId}', '${v.tier}')" style="padding: 4px 10px; background: #22c55e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">✅ Approve</button>
                                        <button onclick="app.rejectPayment('${v.id}')" style="padding: 4px 10px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 600;">❌ Reject</button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            document.getElementById('paymentVerificationsList').innerHTML = html;
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
    // ADMIN - ACTIVITY LOGS
    // ============================================

    loadActivityLog: function() {
        var self = this;
        var html = '';
        
        db.ref('activityLogs').orderByChild('timestamp').limitToLast(100).once('value', function(snapshot) {
            var activities = [];
            snapshot.forEach(function(child) {
                activities.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            activities.reverse();
            
            if (activities.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No activity logged yet</div>';
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
                    
                    html += `
                        <div style="padding: 10px 12px; border-bottom: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; font-size: 0.85rem;">${actionIcon} ${act.userName || 'Guest'}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-light);">${act.action} - ${act.details || 'N/A'}</div>
                                    <div style="font-size: 0.65rem; color: var(--text-light);">📧 ${act.userEmail || 'N/A'}</div>
                                    ${act.isAdmin ? '<span style="font-size: 0.6rem; color: #0088cc;">👑 Admin</span>' : ''}
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.7rem; color: var(--text-light);">${act.time || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            document.getElementById('activityLogList').innerHTML = html;
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
        
        db.ref('adminNotifications').orderByChild('timestamp').limitToLast(20).once('value', function(snapshot) {
            var notifications = [];
            snapshot.forEach(function(child) {
                notifications.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            notifications.reverse();
            
            if (notifications.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No notifications</div>';
            } else {
                notifications.forEach(function(notif) {
                    var severityColor = notif.severity === 'critical' ? '#dc2626' :
                                       notif.severity === 'high' ? '#ef4444' :
                                       notif.severity === 'medium' ? '#f59e0b' : '#22c55e';
                    
                    html += `
                        <div style="padding: 12px; border-bottom: 1px solid var(--border); border-left: 4px solid ${severityColor}; margin-bottom: 4px; ${notif.read ? 'opacity: 0.6;' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem;">${notif.message || 'No message'}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-light);">${notif.time || 'N/A'} • ${notif.read ? '✅ Read' : '📩 Unread'}</div>
                                </div>
                                <div style="display: flex; gap: 4px; align-items: center;">
                                    <span style="padding: 2px 8px; border-radius: 8px; background: ${severityColor}20; color: ${severityColor}; font-size: 0.7rem; font-weight: 600;">${(notif.severity || 'medium').toUpperCase()}</span>
                                    ${!notif.read ? `<button onclick="app.markNotificationRead('${notif.id}')" style="padding: 4px 8px; background: #0088cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.7rem;">Mark Read</button>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            document.getElementById('adminNotificationsList').innerHTML = html;
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
    // PREMIUM PAYMENT FUNCTIONS
    // ============================================

    showPremiumPayment: function(tier) {
        if (!this.user) {
            this.toast('⚠️ Please login first', 'error');
            return;
        }
        
        var tierData = EARNING_SETTINGS[tier];
        if (!tierData) {
            this.toast('⚠️ Invalid tier', 'error');
            return;
        }
        
        var price = tierData.price;
        var tierName = tierData.label;
        
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML = `
            <div class="modal" style="max-width: 420px; border-radius: 20px; padding: 24px;">
                <div class="modal-close"><button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;">✕</button></div>
                <h2 style="font-weight: 700; margin-bottom: 16px; text-align: center;">${tierName} Upgrade</h2>
                
                <div style="background: linear-gradient(135deg, ${tierData.badgeColor || '#0088cc'}, ${tierData.badgeColor || '#006fa3'}); padding: 20px; border-radius: 12px; margin-bottom: 16px; color: white; text-align: center;">
                    <div style="font-size: 48px;">${tierData.badge || '⭐'}</div>
                    <div style="font-size: 24px; font-weight: 700;">${tierName}</div>
                    <div style="font-size: 14px; opacity: 0.9;">${tierData.bonus || ''}</div>
                    <div style="font-size: 28px; font-weight: 800; margin-top: 8px;">KSh ${price}/month</div>
                </div>
                
                <div style="background: #fef3c7; padding: 16px; border-radius: 12px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
                    <div style="font-size: 13px; color: #78350f; line-height: 1.6;">
                        💳 Premium is purchased through Google Play In-App Purchase.<br>
                        <br>
                        Click below to proceed with secure payment.
                    </div>
                </div>
                
                <button onclick="this.closest('.modal-overlay').remove(); app.toast('✅ Redirecting to Google Play Store...', 'success');" style="background: ${tierData.badgeColor || 'var(--primary)'}; color: white; border: none; padding: 12px; border-radius: 10px; cursor: pointer; font-weight: 600; width: 100%;">
                    💳 Upgrade Now
                </button>
                
                <div style="margin-top: 12px; font-size: 12px; color: #6b7280; text-align: center;">
                    ✅ Secure payment through Google Play Store
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },


    updateBalanceDisplays: function() {
        var balanceDisplay = document.getElementById('balanceDisplay');
        if (balanceDisplay) {
            balanceDisplay.textContent = 'KSh ' + this.balance.toFixed(2);
        }
        var earnBalanceDisplay = document.getElementById('earnBalanceDisplay');
        if (earnBalanceDisplay) {
            earnBalanceDisplay.textContent = 'KSh ' + this.balance.toFixed(2);
        }
        var withdrawBalanceDisplay = document.getElementById('withdrawBalanceDisplay');
        if (withdrawBalanceDisplay) {
            withdrawBalanceDisplay.textContent = 'KSh ' + this.balance.toFixed(2);
        }
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
    // VIEW USER ACTIVITY
    // ============================================

    viewUserActivity: function(uid) {
        var self = this;
        db.ref('activityLogs').orderByChild('userId').equalTo(uid).limitToLast(20).once('value', function(snapshot) {
            var activities = [];
            snapshot.forEach(function(child) { activities.push(child.val()); });
            activities.reverse();
            
            var user = self.users[uid] || { name: 'Unknown User' };
            var html = '<div class="modal"><div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>';
            html += '<h2 style="font-weight:700;margin-bottom:16px;">👤 ' + user.name + ' - Activity</h2>';
            
            if (activities.length === 0) {
                html += '<div style="text-align:center;color:#6b7280;padding:20px;">No activity found</div>';
            } else {
                activities.forEach(function(act) {
                    html += '<div style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">';
                    html += '<div style="font-weight:600;">' + act.action + '</div>';
                    html += '<div style="color:#6b7280;font-size:12px;">' + act.details + '</div>';
                    html += '<div style="color:#999;font-size:11px;">' + act.time + '</div>';
                    html += '</div>';
                });
            }
            
            html += '</div>';
            var modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = html;
            document.body.appendChild(modal);
        });
    },

    // ============================================
    // SEARCH USERS
    // ============================================

    searchUsers: function(query) {
        var resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (!query || query.trim() === '') {
            resultsContainer.innerHTML = '<div style="text-align:center;color:#6b7280;padding:20px;">Start typing to search...</div>';
            return;
        }
        
        var searchQuery = query.toLowerCase().trim();
        var results = [];
        
        for (var uid in this.users) {
            if (!this.user || uid !== this.user.uid) {
                var user = this.users[uid];
                if (user && user.name) {
                    if (user.name.toLowerCase().includes(searchQuery) || 
                        (user.email && user.email.toLowerCase().includes(searchQuery)) || 
                        (user.username && user.username.toLowerCase().includes(searchQuery))) {
                        results.push({ uid: uid, user: user });
                    }
                }
            }
        }
        
        results.sort(function(a, b) { return (b.user.followers || 0) - (a.user.followers || 0); });
        
        var html = '';
        if (results.length === 0) {
            html = '<div style="text-align:center;color:#6b7280;padding:20px;">No users found</div>';
        } else {
            results.slice(0, 10).forEach(function(r) {
                var isFollowing = this.following[r.uid] || false;
                var unreadCount = this.getUnreadCountForUser(r.uid);
                var msgBadge = unreadCount > 0 ? '<span style="position:absolute;top:-8px;right:-8px;width:22px;height:22px;background:#ef4444;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:800;border:2px solid white;box-shadow:0 2px 6px rgba(239,68,68,0.4);">' + unreadCount + '</span>' : '';
                
                html += '<div class="search-user" style="display:flex;align-items:center;padding:10px;border-bottom:1px solid #f0f0f0;gap:12px;">';
                html += '<div class="search-user-avatar" style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0;background-image:url(' + (r.user.profilePhoto || '') + ');background-size:cover;background-position:center;">' + (!r.user.profilePhoto ? r.user.name.charAt(0).toUpperCase() : '') + '</div>';
                html += '<div class="search-user-info" style="flex:1;"><div class="search-user-name" style="font-weight:600;font-size:15px;">' + r.user.name + '</div>';
                html += '<div class="search-user-email" style="font-size:12px;color:#6b7280;">' + r.user.email + '</div>';
                html += '<div class="search-user-followers" style="font-size:11px;color:#6b7280;">' + (r.user.followers || 0) + ' followers</div></div>';
                html += '<div class="search-user-actions" style="display:flex;gap:8px;">';
                html += '<button class="search-msg-btn" onclick="app.openChatFromSearch(\'' + r.uid + '\', \'' + r.user.name + '\')" style="padding:6px 12px;background:#0088cc;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;position:relative;">💬 ' + msgBadge + '</button>';
                html += '<button class="search-view-btn" onclick="app.viewUserProfile(\'' + r.uid + '\')" style="padding:6px 12px;background:' + (isFollowing ? '#ef4444' : 'var(--primary)') + ';color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">' + (isFollowing ? 'Following' : 'Follow') + '</button>';
                html += '</div></div>';
            }.bind(this));
        }
        
        resultsContainer.innerHTML = html;
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
        if (!this.user || !this.user.uid) return 'free';
        
        var tier = localStorage.getItem('chichi_user_tier_' + this.user.uid);
        if (tier && tier in EARNING_SETTINGS) {
            return tier;
        }
        
        db.ref('users/' + this.user.uid + '/tier').once('value', function(snap) {
            var tier = snap.val() || 'free';
            if (tier in EARNING_SETTINGS) {
                localStorage.setItem('chichi_user_tier_' + this.user.uid, tier);
            }
        }.bind(this));
        
        return 'free';
    },

    getQuestionsRemaining: function() {
        if (!this.user) return 0;
        
        var userTier = this.getUserTier();
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
            this.renderEarnWithTrivia(this.pendingTrivia);
            this.pendingTrivia = null;
            return;
        }
        
        if (this.user && this.user.uid) {
            db.ref('users/' + this.user.uid + '/pendingTrivia').once('value', function(snap) {
                var pending = snap.val();
                if (pending && pending.question) {
                    self.renderEarnWithTrivia(pending);
                } else {
                    self.renderEarnDefault();
                }
            });
        } else {
            this.renderEarnDefault();
        }
    },

    renderEarnDefault: function() {
        var earnContainer = document.getElementById('earnContainer');
        if (!earnContainer) return;
        
        var userTier = this.getUserTier();
        var tierData = EARNING_SETTINGS[userTier];
        var remaining = this.getQuestionsRemaining();
        var userBalance = this.balance;
        
        var html = `
            <div style="padding: 16px;">
                <div style="background: linear-gradient(135deg, #0088cc, #006fa3); border-radius: 16px; padding: 20px; margin-bottom: 20px; color: white; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 8px;">💰</div>
                    <div style="font-size: 24px; font-weight: 700;">Your Balance</div>
                    <div style="font-size: 36px; font-weight: 800; margin: 8px 0;" id="earnBalanceDisplay">KSh ${userBalance.toFixed(2)}</div>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="app.showWithdrawModal()" style="background: white; color: #0088cc; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px;">💳 Withdraw</button>
                        ${userTier !== 'vip' ? `<button onclick="app.showPremiumPayment('premium')" style="background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px;">⭐ Upgrade</button>` : ''}
                    </div>
                    <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
                        ${tierData.label} - ${remaining} questions remaining today
                        ${tierData.badge ? ` ${tierData.badge}` : ''}
                    </div>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 16px;">
                    <h3 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                        <span>🧠</span> Trivia Challenge
                        <span style="font-size: 12px; background: #f59e0b; color: white; padding: 2px 10px; border-radius: 12px; margin-left: auto;">KSh ${tierData.rewardPerQuestion}</span>
                    </h3>
                    <div style="color: #6b7280; font-size: 13px; margin-bottom: 12px;">
                        <div>📝 Questions remaining: ${remaining}</div>
                        <div>⏱️ Timer: ${tierData.timerSeconds} seconds</div>
                        <div>💰 Reward: KSh ${tierData.rewardPerQuestion} per correct answer</div>
                        ${tierData.adsPerQuestion > 0 ? `<div>📺 Ads: ${tierData.adsPerQuestion} per question</div>` : '<div>✨ No ads!</div>'}
                        ${tierData.bonus ? `<div>🎁 ${tierData.bonus}</div>` : ''}
                    </div>
                    <button onclick="app.generateTriviaQuestion()" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; width: 100%; ${remaining <= 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${remaining <= 0 ? 'disabled' : ''}>
                        🎯 ${remaining > 0 ? 'Start Trivia' : '⏳ All Done For Today'}
                    </button>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 16px;">
                    <h3 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <span>🎰</span> Spin & Win
                        <span style="font-size: 12px; background: #8b5cf6; color: white; padding: 2px 10px; border-radius: 12px; margin-left: auto;">Max ${SPINNER_CONFIG.maxWin}</span>
                    </h3>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
                        Cost: KSh ${SPINNER_CONFIG.spinCost} per spin • Max Win: KSh ${SPINNER_CONFIG.maxWin}
                    </div>
                        🎯 Spin Now
                    </button>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 12px 0;">📊 Your Stats</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Total Earned</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;">KSh ${userBalance.toFixed(2)}</div>
                        </div>
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Questions</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;" id="triviaCount">0</div>
                        </div>
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Streak</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;" id="streakCount">0</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        earnContainer.innerHTML = html;
        this.updateEarnStats();
    },

    renderEarnWithTrivia: function(questionData) {
        var self = this;
        var earnContainer = document.getElementById('earnContainer');
        if (!earnContainer) return;
        
        var userTier = this.getUserTier();
        var tierData = EARNING_SETTINGS[userTier];
        var remaining = this.getQuestionsRemaining();
        
        var optionsHtml = '';
        questionData.options.forEach(function(option, index) {
            optionsHtml += `
                <button class="trivia-option" onclick="app.answerTriviaFromEarn(${index})" style="
                    display: block;
                    width: 100%;
                    padding: 12px 16px;
                    margin: 6px 0;
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 14px;
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
            <div style="padding: 16px;">
                <div style="background: linear-gradient(135deg, #0088cc, #006fa3); border-radius: 16px; padding: 20px; margin-bottom: 20px; color: white; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 8px;">💰</div>
                    <div style="font-size: 24px; font-weight: 700;">Your Balance</div>
                    <div style="font-size: 36px; font-weight: 800; margin: 8px 0;" id="earnBalanceDisplay">KSh ${this.balance.toFixed(2)}</div>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="app.showWithdrawModal()" style="background: white; color: #0088cc; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px;">💳 Withdraw</button>
                        ${userTier !== 'vip' ? `<button onclick="app.showPremiumPayment('premium')" style="background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px;">⭐ Upgrade</button>` : ''}
                    </div>
                    <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
                        ${tierData.label} - ${remaining} questions remaining today
                    </div>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 16px;">
                    <h3 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <span>🧠</span> Trivia Challenge
                        <span style="font-size: 12px; background: #f59e0b; color: white; padding: 2px 10px; border-radius: 12px; margin-left: auto;">KSh ${tierData.rewardPerQuestion}</span>
                    </h3>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">
                        ⏱️ ${tierData.timerSeconds} seconds • ${remaining} questions left today
                    </div>
                    
                    <div id="triviaQuestionArea">
                        <p style="font-size: 16px; font-weight: 600; color: #1a202c; margin-bottom: 12px;">${questionData.question}</p>
                        <div id="triviaOptions">
                            ${optionsHtml}
                        </div>
                        <div id="triviaTimerDisplay" style="text-align: center; margin-top: 12px; font-size: 14px; color: #6b7280;">
                            ⏱️ Time remaining: <span id="triviaTimeLeft" style="font-weight: 700; color: #ef4444;">${tierData.timerSeconds}</span>s
                        </div>
                        <div id="triviaResultArea" style="display: none; text-align: center; padding: 12px; border-radius: 12px; margin-top: 12px;"></div>
                    </div>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 16px;">
                    <h3 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <span>🎰</span> Spin & Win
                        <span style="font-size: 12px; background: #8b5cf6; color: white; padding: 2px 10px; border-radius: 12px; margin-left: auto;">Max ${SPINNER_CONFIG.maxWin}</span>
                    </h3>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
                        Cost: KSh ${SPINNER_CONFIG.spinCost} per spin • Max Win: KSh ${SPINNER_CONFIG.maxWin}
                    </div>
                        🎯 Spin Now
                    </button>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 12px 0;">📊 Your Stats</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Total Earned</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;">KSh ${this.balance.toFixed(2)}</div>
                        </div>
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Questions</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;" id="triviaCount">0</div>
                        </div>
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Streak</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;" id="streakCount">0</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        earnContainer.innerHTML = html;
        
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
                
                if (!self.triviaAnswered) {
                    self.triviaAnswered = true;
                    
                    document.querySelectorAll('.trivia-option').forEach(function(btn, index) {
                        btn.disabled = true;
                        btn.style.cursor = 'not-allowed';
                        if (index === self.currentTrivia.correct) {
                            btn.style.borderColor = '#22c55e';
                            btn.style.background = '#dcfce7';
                        }
                    });
                    
                    var resultArea = document.getElementById('triviaResultArea');
                    resultArea.style.display = 'block';
                    resultArea.innerHTML = `
                        <div style="color: #ef4444; font-weight: 700; font-size: 18px;">⏰ Time's Up!</div>
                        <div style="color: #6b7280; font-size: 14px;">The correct answer was: ${self.currentTrivia.options[self.currentTrivia.correct]}</div>
                    `;
                    resultArea.style.background = '#fee2e2';
                }
            }
        }, 1000);
        
        this.updateEarnStats();
    },

    answerTriviaFromEarn: function(selectedIndex) {
        if (this.triviaAnswered || !this.currentTrivia) return;
        if (!this.user || this.isGuest) return;
        
        if (this.triviaTimer) {
            clearInterval(this.triviaTimer);
            this.triviaTimer = null;
        }
        
        this.triviaAnswered = true;
        var self = this;
        var userId = this.user.uid;
        var userTier = this.getUserTier();
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
                <div style="color: #6b7280; font-size: 14px;">You earned KSh ${tierData.rewardPerQuestion.toFixed(2)}!</div>
            `;
            resultArea.style.background = '#dcfce7';
            
            self.balance += tierData.rewardPerQuestion;
            db.ref('users/' + userId + '/balance').set(self.balance);
            
            var balanceDisplay = document.getElementById('earnBalanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.textContent = 'KSh ' + self.balance.toFixed(2);
            }
            
            self.toast('🎉 Correct! +KSh ' + tierData.rewardPerQuestion.toFixed(2), 'success');
            self.incrementQuestionCount();
        } else {
            resultArea.innerHTML = `
                <div style="color: #ef4444; font-weight: 700; font-size: 18px;">❌ Wrong answer</div>
                <div style="color: #6b7280; font-size: 14px;">The correct answer was: ${self.currentTrivia.options[self.currentTrivia.correct]}</div>
            `;
            resultArea.style.background = '#fee2e2';
            self.toast('❌ Wrong answer! Try again.', 'error');
        }
        
        var answeredData = {
            date: today,
            questionIndex: self.currentTrivia.questionIndex,
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
                        <button onclick="app.generateTriviaQuestion(); app.renderEarn();" style="margin-top: 12px; padding: 8px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
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
    // UPGRADE USER
    // ============================================

    upgradeUser: function(tier) {
        if (!this.user) {
            this.toast('⚠️ Please login first', 'error');
            return;
        }
        
        if (!EARNING_SETTINGS[tier]) {
            this.toast('⚠️ Invalid tier', 'error');
            return;
        }
        
        var price = EARNING_SETTINGS[tier].price;
        var tierName = EARNING_SETTINGS[tier].label;
        
        if (!confirm(`Upgrade to ${tierName} for KSh ${price}/month?`)) {
            return;
        }
        
        var self = this;
        this.toast('⏳ Processing payment...', 'info');
        
        setTimeout(function() {
            if (self.balance < price) {
                self.toast('❌ Insufficient balance. You need KSh ' + price, 'error');
                return;
            }
            
            self.balance -= price;
            db.ref('users/' + self.user.uid + '/balance').set(self.balance);
            db.ref('users/' + self.user.uid + '/tier').set(tier);
            localStorage.setItem('chichi_user_tier_' + self.user.uid, tier);
            
            self.toast('✅ Upgraded to ' + tierName + '! 🎉', 'success');
            self.renderEarn();
            self.loadProfile();
            self.logUserActivity('upgrade_tier', 'Upgraded to ' + tierName + ' for KSh ' + price);
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

    generateTriviaQuestion: function() {
        if (!this.user || this.isGuest) return;
        
        var remaining = this.getQuestionsRemaining();
        if (remaining <= 0) {
            console.log('📊 No questions remaining today');
            return;
        }
        
        var self = this;
        var userId = this.user.uid;
        
        db.ref('users/' + userId + '/pendingTrivia').once('value', function(snap) {
            var pending = snap.val();
            if (pending && pending.question) {
                self.displayTriviaInEarn(pending);
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
                
                db.ref('users/' + userId + '/pendingTrivia').set(pendingData, function() {
                    self.displayTriviaInEarn(pendingData);
                });
            });
        });
    },

    displayTriviaInEarn: function(questionData) {
        if (!this.user || this.isGuest) return;
        
        this.currentTrivia = questionData;
        this.triviaAnswered = false;
        
        var earnView = document.getElementById('earnView');
        if (!earnView || !earnView.classList.contains('active')) {
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
       
        console.log('🚀 Starting app initialization sequence...');
       
        self.loadPosts();
        self.loadStories();
        self.loadUsers();
        self.loadFollowing();
        self.loadGroups();
        self.setupTypingCleanup();
        self.calculateTrendingHashtags();
       
        setTimeout(function() {
            console.log('🔔 Checking if tracking is active...');
            if (!self.unreadTrackingActive) {
                console.log('⚠️ WARNING: Unread tracking not active yet!');
            } else {
                console.log('✅ Unread tracking is active.');
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
                self.renderProfile();
            }
        });
    },

    // ============================================
    // RENDER PROFILE
    // ============================================

    renderProfile: function() {
        var profileContent = document.getElementById('profileContent');
        if (!profileContent) {
            console.error('❌ profileContent element not found!');
            var profileView = document.getElementById('profileView');
            if (profileView) {
                var content = document.createElement('div');
                content.id = 'profileContent';
                profileView.appendChild(content);
                profileContent = content;
            } else {
                console.error('❌ profileView also not found!');
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
        
        var userTier = this.getUserTier();
        var tierData = EARNING_SETTINGS[userTier];
        var badgeDisplay = tierData && tierData.badge ? `<span style="margin-left:6px;font-size:20px;">${tierData.badge}</span>` : '';
        var badgeColor = tierData && tierData.badgeColor ? tierData.badgeColor : 'var(--primary)';
        var tierLabel = tierData ? tierData.label : 'Free';
        
        var userPosts = this.posts.filter(function(p) { return p.userId === this.user.uid; }.bind(this)).length;

        var html = `
            <div class="profile-header">
                <div class="profile-top">
                    <div class="profile-avatar-large" onclick="app.showProfilePhotoModal()" style="background-image:url(${this.profile.profilePhoto || ''});">${!this.profile.profilePhoto ? this.user.email.charAt(0).toUpperCase() : ''}</div>
                    <div class="profile-info">
                        <div class="profile-name">
                            ${this.profile.name || 'User'}
                            ${badgeDisplay}
                            ${userTier !== 'free' ? `<span style="font-size:11px;background:${badgeColor};color:white;padding:2px 10px;border-radius:12px;margin-left:4px;">${tierLabel}</span>` : ''}
                        </div>
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
            <div style="padding:16px;background:white;border-radius:16px;margin:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <div style="font-weight:600;margin-bottom:8px;">Bio</div>
                <div style="color:var(--text-light);font-size:0.9rem;">${this.profile.bio || 'No bio yet'}</div>
            </div>
            <div style="margin:16px;">
                <div class="balance-card">
                    <div class="balance-label">💰 Your Balance</div>
                    <div class="balance-amount" id="balanceDisplay">KSh ${this.balance.toFixed(2)}</div>
                    <button class="btn-withdraw" onclick="app.showWithdrawModal()">Withdraw</button>
                </div>
            </div>
            
            <div style="padding:16px;">
                <button style="width:100%;padding:12px;background:white;border:1px solid var(--border);border-radius:12px;color:var(--text);font-weight:600;cursor:pointer;transition:0.3s;margin-bottom:12px;" onclick="app.showNotificationPreferences()">🔔 Notification Settings</button>
                <button style="width:100%;padding:12px;background:white;border:1px solid var(--border);border-radius:12px;color:var(--text);font-weight:600;cursor:pointer;transition:0.3s;" onclick="app.showLogout()">🚪 Logout</button>
            </div>

            <div style="padding:16px;">My Posts</div>
            <div id="profilePosts"></div>
        `;

        profileContent.innerHTML = html;

        var postsHtml = '';
        this.posts.filter(function(p) { return p.userId === this.user.uid; }.bind(this)).forEach(function(p) {
            var likes = (p.likes && Object.keys(p.likes).length) || 0;
            postsHtml += `
                <div class="post" id="post-${p.id}">
                    <div class="post-header">
                        <div class="post-user">
                            <div class="post-avatar" style="background-image:url(${p.userPhoto || ''});">${!p.userPhoto ? p.userName.charAt(0).toUpperCase() : ''}</div>
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

        if (postsHtml === '') postsHtml = '<div style="text-align:center;color:#6b7280;padding:20px;">No posts yet</div>';
        var profilePosts = document.getElementById('profilePosts');
        if (profilePosts) {
            profilePosts.innerHTML = postsHtml;
        }
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
        } catch (e) {
            console.log('localStorage not available');
        }
       
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
       
        console.log('📮 Loading posts from Firebase...');
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
                
                if (isSupportPost) {
                    postHtml += '<div style="background:#0088cc;color:white;padding:4px 12px;font-size:11px;font-weight:700;display:inline-block;margin:8px 16px 0;border-radius:20px;">🤖 Generated by CHICHI AI</div>';
                }
                
                postHtml += '<img src="' + p.photoUrl + '" class="post-image" style="' + (isSupportPost ? 'border-radius:0;' : '') + '"><div class="post-caption">' + p.caption + '</div>';
                
                if (isSupportPost) {
                    postHtml += '<div style="padding:0 16px 8px;font-size:11px;color:#0088cc;font-style:italic;">✨ Generated by CHICHI AI • ' + (p.category || 'Support') + '</div>';
                }
                
                postHtml += '<div class="post-stats">' + likes + ' likes · ' + downloads + ' saves · ' + comments + ' comments</div>';
                
                if (!isSupportPost) {
                    postHtml += '<div class="post-actions"><button class="post-action ' + (userLiked ? 'liked' : '') + '" onclick="app.likePost(\'' + p.id + '\')">' + (userLiked ? '❤️ Liked' : '🤍 Like') + '</button><button class="post-action" onclick="app.downloadPost(\'' + p.photoUrl + '\', \'' + p.id + '\')">💾 Save</button><button class="post-action" onclick="app.viewComments(\'' + p.id + '\')">💬 Comment</button><button class="post-action" onclick="app.sharePost(\'' + p.id + '\', \'' + p.caption.replace(/'/g, "\\'") + '\')">📤 Share</button></div>';
                } else {
                    postHtml += '<div style="padding:8px 16px 16px;display:flex;gap:12px;border-top:1px solid #eee;margin-top:4px;"><span style="font-size:13px;color:#6b7280;">❤️ ' + likes + ' likes</span><span style="font-size:13px;color:#6b7280;">💾 ' + downloads + ' saves</span><span style="font-size:13px;color:#6b7280;">💬 ' + comments + ' comments</span></div>';
                }
                
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
            }
           
            db.ref('posts/' + id + '/likes').set(likes);
            self.renderFeed();
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
        db.ref('posts/' + id).remove();
        this.toast('Post deleted', 'success');
        this.loadPosts();
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
        if (this.autoPostInterval) {
            clearInterval(this.autoPostInterval);
            this.autoPostInterval = null;
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
       
        deletionPromises.push(db.ref('withdrawals').orderByChild('userId').equalTo(uid).once('value', function(snapshot) {
            var deletePromises = [];
            snapshot.forEach(function(withdrawal) {
                deletePromises.push(db.ref('withdrawals/' + withdrawal.key).remove());
            });
            return Promise.all(deletePromises);
        }));
       
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
        console.log('📈 Calculating trending hashtags...');
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
        console.log('🔍 Explore: Loading heatmap and trending');
        self.loadSignupHeatmap();
        self.renderTrendingInExplore();
        self.setupTrendingRefresh();
        self.showHashtagSuggestions();
    },

    // ============================================
    // RENDER TRENDING IN EXPLORE
    // ============================================

    renderTrendingInExplore: function() {
        if (this.trendingHashtags.length === 0) {
            this.calculateTrendingHashtags();
        }
        
        if (document.getElementById('trendingSection')) {
            this.renderTrendingList();
            return;
        }
        
        var html = '<div id="trendingSection" style="padding:16px;border-bottom:1px solid #f0f0f0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="margin:0;font-size:18px;font-weight:700;">🔥 Trending Now</h3><button onclick="app.calculateTrendingHashtags(); app.renderTrendingList();" style="background:var(--primary);color:white;border:none;padding:6px 14px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:600;">Refresh</button></div><div id="trendingList" style="display:grid;gap:12px;"></div></div>';
        
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
        this.trendingHashtags.forEach(function(trend, index) {
            var rankEmoji = ['🥇', '🥈', '🥉'][index] || '•';
            html += '<div style="display:flex;align-items:center;padding:12px;background:white;border-radius:12px;cursor:pointer;transition:0.2s;border:1px solid #eee;" onclick="app.toast(\'View hashtag posts coming soon\', \'info\')" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'"><div style="font-size:20px;margin-right:12px;width:30px;text-align:center;">' + rankEmoji + '</div><div style="flex:1;"><div style="font-weight:600;color:var(--primary);">' + trend.name + '</div><div style="font-size:12px;color:#6b7280;">' + trend.posts + ' posts • ' + trend.count + ' mentions</div></div><div style="color:#9ca3af;font-size:18px;">→</div></div>';
        });
        
        var trendingList = document.getElementById('trendingList');
        if (trendingList) {
            trendingList.innerHTML = html;
        }
    },

    setupTrendingRefresh: function() {
        var self = this;
        this.calculateTrendingHashtags();
        setInterval(function() {
            self.calculateTrendingHashtags();
            if (document.getElementById('trendingList')) {
                self.renderTrendingList();
            }
        }, 60 * 60 * 1000);
    },

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
        console.log('🗺️ Loading global signup heatmap...');
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
            this.showHashtagSuggestions();
        }.bind(this));
    },

    showHashtagSuggestions: function() {
        if (!this.user || this.isGuest) return;
        var userHashtags = this.profile.hashtags || [];
        var oldSuggestions = document.getElementById('hashtagSuggestions');
        if (oldSuggestions) oldSuggestions.remove();
        var exploreView = document.getElementById('exploreView');
        if (!exploreView) return;
        
        if (userHashtags.length === 0) {
            var suggestionDiv = document.createElement('div');
            suggestionDiv.id = 'hashtagSuggestions';
            suggestionDiv.style.cssText = 'padding:16px;background:white;margin:16px;border-radius:12px;border:1px solid #e5e7eb;text-align:center;';
            suggestionDiv.innerHTML = '<div style="font-size:32px;margin-bottom:8px;">🏷️</div><div style="font-weight:600;color:#1a202c;font-size:16px;">Set your interests</div><div style="color:#6b7280;font-size:14px;margin-bottom:12px;">Add hashtags to find people with similar interests</div><button onclick="app.showMandatoryHashtagSelection()" style="padding:10px 20px;background:#0088cc;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Add Interests</button>';
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
                if (userHashtags.includes(tag)) { matchCount++; }
            });
            if (matchCount > 0) { matches.push({ uid: uid, user: user, matchCount: matchCount }); }
        }
        matches.sort(function(a, b) { return b.matchCount - a.matchCount; });
        
        if (matches.length > 0) {
            var suggestionDiv = document.createElement('div');
            suggestionDiv.id = 'hashtagSuggestions';
            suggestionDiv.style.cssText = 'padding:16px;background:white;margin:16px;border-radius:12px;border:1px solid #e5e7eb;';
            var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div style="font-weight:700;color:#1a202c;font-size:16px;">🤝 People with similar interests</div><span style="font-size:12px;color:#6b7280;">' + matches.length + ' found</span></div>';
            matches.slice(0, 5).forEach(function(match) {
                var tagsDisplay = match.user.hashtags.slice(0, 3).join(' • ');
                html += '<div style="display:flex;align-items:center;padding:10px;background:#f7fafc;border-radius:10px;margin-bottom:8px;gap:12px;"><div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0088cc,#006fa3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0;overflow:hidden;">' + (match.user.profilePhoto ? '<img src="' + match.user.profilePhoto + '" style="width:100%;height:100%;object-fit:cover;">' : match.user.name.charAt(0).toUpperCase()) + '</div><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;color:#1a202c;">' + match.user.name + '</div><div style="font-size:11px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏷️ ' + tagsDisplay + '</div><div style="font-size:11px;color:#0088cc;">⭐ ' + match.matchCount + ' shared interests</div></div><button onclick="app.openChatFromSearch(\'' + match.uid + '\', \'' + match.user.name + '\')" style="padding:6px 14px;background:#0088cc;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;white-space:nowrap;">💬 Message</button></div>';
            });
            suggestionDiv.innerHTML = html;
            exploreView.insertBefore(suggestionDiv, exploreView.firstChild);
        }
    },

    // ============================================
    // OPEN CHAT FROM SEARCH
    // ============================================

    openChatFromSearch: function(uid, name) {
        this.openChat(uid, name);
    },

    // ============================================
    // SHOW WITHDRAW MODAL
    // ============================================

    showWithdrawModal: function() {
        if (this.balance < 1) {
            this.toast('❌ You have no balance to withdraw', 'error');
            return;
        }
        document.getElementById('withdrawModal').classList.add('active');
        document.getElementById('withdrawAmount').value = this.balance;
        document.getElementById('withdrawAmount').max = this.balance;
        document.getElementById('withdrawAmount').min = 1;
        var balanceDisplay = document.getElementById('withdrawBalanceDisplay');
        if (balanceDisplay) {
            balanceDisplay.textContent = 'KSh ' + this.balance.toFixed(2);
        }
    },

    closeWithdrawModal: function() {
        document.getElementById('withdrawModal').classList.remove('active');
    },

    processWithdrawal: function() {
        var amount = parseFloat(document.getElementById('withdrawAmount').value);
        var minAmount = 1;
        
        if (isNaN(amount) || amount < minAmount) {
            this.toast('❌ Minimum withdrawal is KSh ' + minAmount, 'error');
            return;
        }
        if (amount > this.balance) {
            this.toast('❌ Insufficient balance. You have KSh ' + this.balance.toFixed(2), 'error');
            return;
        }
        
        var method = document.getElementById('paymentMethod').value;
        var account = document.getElementById('accountNumber').value.trim();
        if (!account) {
            this.toast('❌ Please enter your account details', 'error');
            return;
        }

        var self = this;
        db.ref('withdrawals').push({
            userId: this.user.uid,
            userName: this.profile.name,
            userEmail: this.user.email,
            amount: amount,
            method: method,
            account: account,
            status: 'pending',
            createdAt: new Date().toLocaleString('en-KE'),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        this.balance -= amount;
        db.ref('users/' + this.user.uid + '/balance').set(this.balance);
        
        var balanceDisplay = document.getElementById('balanceDisplay');
        if (balanceDisplay) {
            balanceDisplay.textContent = 'KSh ' + this.balance.toFixed(2);
        }
        
        this.toast('✅ Withdrawal request submitted! KSh ' + amount.toFixed(2), 'success');
        this.closeWithdrawModal();
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('accountNumber').value = '';
        this.renderProfile();
        this.logUserActivity('withdrawal_request', 'Requested withdrawal of KSh ' + amount);
    },

    // ============================================
    // AUTO-POST SYSTEM
    // ============================================

    loadPostedHistory: function() {
        var savedHistory = localStorage.getItem('chichi_posted_history');
        if (savedHistory) {
            try {
                this.postedHistory = JSON.parse(savedHistory);
            } catch(e) { this.postedHistory = []; }
        }
        var savedTime = localStorage.getItem('chichi_last_post_time');
        if (savedTime) { this.lastPostTime = parseInt(savedTime); }
        var today = new Date().toDateString();
        var savedDate = localStorage.getItem('chichi_last_post_date');
        if (savedDate !== today) {
            this.postedHistory = [];
            localStorage.setItem('chichi_last_post_date', today);
            this.savePostedHistory();
        }
    },

    savePostedHistory: function() {
        localStorage.setItem('chichi_posted_history', JSON.stringify(this.postedHistory));
        localStorage.setItem('chichi_last_post_time', this.lastPostTime.toString());
        localStorage.setItem('chichi_last_post_date', new Date().toDateString());
    },

    getAvailableTemplates: function() {
        var allTemplates = POST_TEMPLATES.slice();
        var postedTexts = this.postedHistory.map(function(item) { return item.text; });
        return allTemplates.filter(function(template) {
            return !postedTexts.includes(template.text);
        });
    },

    getRandomImage: function(keyword) {
        return new Promise(function(resolve, reject) {
            var unsplashUrl = 'https://api.unsplash.com/photos/random?query=' + encodeURIComponent(keyword) + '&orientation=landscape';
            fetch(unsplashUrl, {
                headers: { 'Authorization': 'Client-ID 0Gsd_TnIf0UngbQD6aLSR-u6pTQf__o5W93K8Q30G7Q' }
            })
            .then(function(response) {
                if (!response.ok) throw new Error('Unsplash API error');
                return response.json();
            })
            .then(function(data) {
                if (data && data.urls && data.urls.regular) { resolve(data.urls.regular); }
                else { throw new Error('No image from Unsplash'); }
            })
            .catch(function() {
                var width = 800 + Math.floor(Math.random() * 400);
                var height = 600 + Math.floor(Math.random() * 300);
                var seed = 'person' + Date.now() + Math.random();
                resolve('https://picsum.photos/seed/' + seed + '/' + width + '/' + height);
            });
        });
    },

    uploadImageToCloudinary: function(imageUrl) {
        return new Promise(function(resolve, reject) {
            fetch(imageUrl)
                .then(function(response) { return response.blob(); })
                .then(function(blob) {
                    var formData = new FormData();
                    formData.append('file', blob);
                    formData.append('upload_preset', UPLOAD_PRESET || 'chichi_photos');
                    return fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                        method: 'POST', body: formData
                    });
                })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.secure_url) { resolve(data.secure_url); }
                    else { reject(new Error('No URL returned')); }
                })
                .catch(reject);
        });
    },

    performAutoPost: function() {
        var self = this;
        if (!self.user || self.user.email !== 'support-chichi@gmail.com') { return; }
        
        var now = Date.now();
        var minutesSinceLastPost = (now - self.lastPostTime) / (1000 * 60);
        if (minutesSinceLastPost < 10 && self.postedHistory.length > 0) { return; }
        
        var availableTemplates = self.getAvailableTemplates();
        if (availableTemplates.length === 0) {
            self.postedHistory = [];
            self.savePostedHistory();
            availableTemplates = POST_TEMPLATES.slice();
        }
        
        var randomIndex = Math.floor(Math.random() * availableTemplates.length);
        var selected = availableTemplates[randomIndex];
        
        self.getRandomImage(selected.imageKeyword)
            .then(function(imageUrl) { return self.uploadImageToCloudinary(imageUrl); })
            .then(function(finalImageUrl) {
                var postData = {
                    userId: self.user.uid,
                    userName: 'SUPPORT@CHICHI',
                    userPhoto: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
                    photoUrl: finalImageUrl,
                    caption: selected.text,
                    hashtags: ['#CHICHI', '#AutoPost', '#' + selected.category.replace(/\s/g, '')],
                    likes: {}, comments: [], commentedUsers: {}, downloads: 0,
                    isAutoPost: true, isSupportPost: true, category: selected.category,
                    source: 'CHICHI AI',
                    createdAt: new Date().toLocaleString('en-KE'),
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
                db.ref('posts').push(postData).then(function() {
                    self.toast('🤖 New post from SUPPORT@CHICHI!', 'success');
                    self.postedHistory.push({
                        text: selected.text,
                        category: selected.category,
                        timestamp: Date.now()
                    });
                    self.lastPostTime = Date.now();
                    self.savePostedHistory();
                    setTimeout(function() { self.loadPosts(); }, 500);
                });
            }).catch(function(err) {
                console.error('❌ Image error:', err);
                setTimeout(function() { self.performAutoPost(); }, 30000);
            });
    },

    startAutoPostScheduler: function() {
        var self = this;
        if (!self.user || self.user.email !== 'support-chichi@gmail.com') { return; }
        
        self.loadPostedHistory();
        var now = Date.now();
        var minutesSinceLastPost = (now - self.lastPostTime) / (1000 * 60);
        if (self.postedHistory.length === 0 || minutesSinceLastPost >= 10) {
            setTimeout(function() { self.performAutoPost(); }, 3000);
        }
        
        if (self.autoPostInterval) { clearInterval(self.autoPostInterval); }
        self.autoPostInterval = setInterval(function() { self.performAutoPost(); }, 60000);
        console.log('✅ Auto-post scheduler running!');
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
                        📱 Version V01A.01
                    </p>
                    
                    <div style="background:#f7fafc;padding:16px 18px;border-radius:16px;text-align:left;border:1px solid #e2e8f0;margin-bottom:16px;">
                        <p style="font-size:14px;line-height:1.8;color:#2d3748;margin:0;">
                            Hey there! 👋 I'm <strong style="color:#0088cc;">Anthony</strong>, 
                            a Developer and Digital Media Specialist who loves building things that bring people and community together. 
                            I created <strong style="color:#0088cc;">CHICHI</strong> because I believe 
                            social media should feel like home — warm, real, and human.
                        </p>
                        <p style="font-size:13px;line-height:1.7;color:#4a5568;margin-top:10px;border-top:1px solid #e2e8f0;padding-top:10px;">
                            This is <strong>Version V01A.01</strong> — the beginning of something beautiful. 
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
    // PROFILE PHOTO MODAL FUNCTIONS
    // ============================================

    showProfilePhotoModal: function() {
        var modal = document.getElementById('profilePhotoModal');
        if (modal) {
            modal.classList.add('active');
        }
    },

    closeProfilePhotoModal: function() {
        var modal = document.getElementById('profilePhotoModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    changeProfilePhoto: function() {
        this.closeProfilePhotoModal();
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (file) {
                self.toast('Uploading photo...', 'success');
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
                    self.toast('Photo updated!', 'success');
                    self.renderProfile();
                    self.loadMessages();
                    self.logUserActivity('update_profile_photo', 'Updated profile photo');
                })
                .catch(function(err) { self.toast('Upload failed', 'error'); });
            }
        };
        input.click();
    },

    viewProfilePhoto: function() {
        this.closeProfilePhotoModal();
        if (this.profile.profilePhoto) {
            var modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = '<div class="modal" style="max-width:400px;"><div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div><img src="' + this.profile.profilePhoto + '" style="width:100%;border-radius:16px;"></div>';
            document.body.appendChild(modal);
        } else {
            this.toast('No profile photo yet', 'error');
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
                <label style="display:block;font-weight:600;margin-bottom:8px;">Email</label>
                <input type="email" id="editProfileEmail" value="${this.user.email || ''}" placeholder="Your email" disabled style="background:#f3f4f6;cursor:not-allowed;width:100%;padding:12px;border:1px solid #ccc;border-radius:8px;font-size:1rem;box-sizing:border-box;">
                <div style="font-size:0.75rem;color:#999;margin-top:4px;">Cannot change email</div>
            </div>
           
            <div style="margin-bottom:24px;">
                <label style="display:block;font-weight:600;margin-bottom:8px;">Bio</label>
                <textarea id="editProfileBio" placeholder="Tell us about yourself..." style="width:100%;min-height:100px;padding:12px;border:1px solid #ccc;border-radius:8px;font-family:inherit;font-size:1rem;resize:vertical;box-sizing:border-box;">${this.profile.bio || ''}</textarea>
            </div>
           
            <div style="display:flex;gap:12px;margin-top:24px;">
                <button onclick="this.closest('div').closest('div').parentElement.parentElement.remove()" style="flex:1;padding:12px;background:#e5e7eb;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">Cancel</button>
                <button onclick="app.saveProfileChanges()" style="flex:1;padding:12px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:1rem;">Save Changes</button>
            </div>
        `;
       
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
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
        var bio = document.getElementById('editProfileBio').value.trim();
        var self = this;
       
        if (!name) {
            this.toast('Name cannot be empty', 'error');
            return;
        }
       
        this.toast('Saving profile...', 'success');
       
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
                        self.logUserActivity('update_profile', 'Updated profile');
                    }
                }).catch(function(err) {
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
            this.logUserActivity('update_profile', 'Updated profile');
        }
    }
};

// ============================================
// INITIALIZE APP
// ============================================

app.init();
app.initMusic();

setTimeout(function() {
    if (app.user && app.user.email === 'support-chichi@gmail.com') {
        console.log('🤖 Support account detected! Starting auto-post scheduler...');
        app.startAutoPostScheduler();
    }
}, 3000);

console.log('%c✅ CHICHI App Loaded Successfully!', 'color: #00D4AA; font-size: 16px; font-weight: bold;');
console.log('%c📱 Auto-posts every 10 minutes with unique content', 'color: #0088cc; font-size: 12px;');
console.log('%c🧠 Trivia: KSh 0.50 per correct answer - 20 second timer!', 'color: #FFC24B; font-size: 12px;');
console.log('%c🎰 Spin & Win: KSh 5 per spin - Max KSh 40!', 'color: #8b5cf6; font-size: 12px;');
console.log('%c🛡️ Suspicious activity detection active!', 'color: #ef4444; font-size: 12px;');
console.log('%c👨‍💻 Built by Anthony Onchari - Version V01A.01', 'color: #6b7280; font-size: 11px;');