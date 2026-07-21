// ============================================
// FIREBASE CONFIG - Loaded from config.js
// ============================================

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
// POST TEMPLATES - PEOPLE ONLY IMAGES
// ============================================

const POST_TEMPLATES = [
    // Funny Stories - People Only
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
    
    // Inspirational - People Only
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
    
    // Kenyan News & Facts - People Only
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
    
    // Tech & Innovation - People Only
    { text: "AI is revolutionizing healthcare. New algorithms can detect diseases earlier than doctors.", category: "Tech", imageKeyword: "doctor with AI technology" },
    { text: "Your smartphone is more powerful than the computers that sent humans to the moon.", category: "Tech", imageKeyword: "person amazed by phone" },
    { text: "The world's fastest internet is in South Korea. 6G is coming soon.", category: "Tech", imageKeyword: "person on laptop excited" },
    { text: "Blockchain technology is changing how we think about money and trust.", category: "Tech", imageKeyword: "person with blockchain concept" },
    { text: "The first computer virus was created in 1983. It was called the 'Elk Cloner'.", category: "Tech", imageKeyword: "person at computer thinking" },
    { text: "Cloud computing has revolutionized how businesses operate worldwide.", category: "Tech", imageKeyword: "business person using cloud" },
    { text: "5G technology is transforming how we connect.", category: "Tech", imageKeyword: "person with 5G phone smiling" },
    { text: "The future of work is remote and digital.", category: "Tech", imageKeyword: "person working remotely" },
    
    // Lifestyle & Wellness - People Only
    { text: "A 10-minute daily meditation can reduce stress by 30%. Try it today.", category: "Wellness", imageKeyword: "person meditating peaceful" },
    { text: "Walking 30 minutes a day can add 3 years to your life. It's that simple.", category: "Wellness", imageKeyword: "person walking happy smiling" },
    { text: "The average person spends 2 hours a day on social media. Make it count.", category: "Wellness", imageKeyword: "person on phone mindful" },
    { text: "Drinking water first thing in the morning boosts your metabolism.", category: "Wellness", imageKeyword: "person drinking water morning" },
    { text: "Sleep is not a luxury, it's a necessity. Aim for 7-8 hours.", category: "Wellness", imageKeyword: "person sleeping peacefully" },
    { text: "Reading 15 minutes a day can reduce stress by 60%.", category: "Wellness", imageKeyword: "person reading book relaxed" },
    { text: "Yoga is the perfect way to start your day.", category: "Wellness", imageKeyword: "person doing yoga" },
    { text: "Mental health matters. Take a break when you need to.", category: "Wellness", imageKeyword: "person taking a break" },
    
    // Food - People Only
    { text: "The best Kenyan dish? Some say Nyama Choma, others say Ugali. Try both!", category: "Food", imageKeyword: "people eating Kenyan food" },
    { text: "Cooking is an art. Your kitchen is your canvas. Create something beautiful.", category: "Food", imageKeyword: "person cooking happy" },
    { text: "Traditional Kenyan food is some of the most flavorful in the world.", category: "Food", imageKeyword: "Kenyan person eating" },
    { text: "Chapati is life. That's a fact, not an opinion.", category: "Food", imageKeyword: "person making chapati" },
    { text: "Good food equals good mood.", category: "Food", imageKeyword: "person eating happily" },
    { text: "The best meals are shared with loved ones.", category: "Food", imageKeyword: "family eating together" },
    
    // Travel - People Only
    { text: "Kenya has 8 national parks. Each one is unique. Visit them all.", category: "Travel", imageKeyword: "person on safari smiling" },
    { text: "Travel makes you realize how beautiful the world truly is.", category: "Travel", imageKeyword: "person traveling happy" },
    { text: "The Kenyan coast is one of the most beautiful places on Earth.", category: "Travel", imageKeyword: "person on Kenyan beach" },
    { text: "Mombasa's old town is a UNESCO World Heritage site. It's worth a visit.", category: "Travel", imageKeyword: "person in Mombasa smiling" },
    { text: "Adventure awaits. Go explore!", category: "Travel", imageKeyword: "adventurous person" },
    { text: "Travel is the only thing you buy that makes you richer.", category: "Travel", imageKeyword: "happy traveler" },
    
    // Fun Facts - People Only
    { text: "Your brain is constantly changing. Every thought you have physically rewires your brain.", category: "Fun Facts", imageKeyword: "person thinking" },
    { text: "The human body has 37 trillion cells. Each one is working right now to keep you alive.", category: "Fun Facts", imageKeyword: "healthy person smiling" },
    { text: "Dolphins sleep with one eye open. Half their brain stays awake.", category: "Fun Facts", imageKeyword: "person amazed" },
    { text: "The average person walks about 100,000 miles in their lifetime.", category: "Fun Facts", imageKeyword: "person walking" },
    { text: "Your heart beats about 100,000 times per day. That's 2.5 billion times in a lifetime.", category: "Fun Facts", imageKeyword: "person with heart" },
    { text: "The Great Wall of China is not visible from space. This is a common myth.", category: "Fun Facts", imageKeyword: "person traveling" },
    { text: "Humans are the only animals that blush.", category: "Fun Facts", imageKeyword: "person blushing" },
    { text: "Your body produces enough heat in 30 minutes to boil a gallon of water.", category: "Fun Facts", imageKeyword: "person feeling warm" },
    
    // Relationship/Love - People Only
    { text: "The best relationships are built on trust, communication, and a good sense of humor.", category: "Relationships", imageKeyword: "couple laughing together" },
    { text: "A happy relationship is about understanding, not agreement.", category: "Relationships", imageKeyword: "couple talking" },
    { text: "Love is not about how many days you've been together, but how much you've grown together.", category: "Relationships", imageKeyword: "couple in love" },
    { text: "The best love story is when you fall in love with the most unexpected person.", category: "Relationships", imageKeyword: "couple happy" },
    { text: "Love is patient, love is kind. Love is everything.", category: "Relationships", imageKeyword: "couple hugging" },
    { text: "A relationship is not a 50/50 deal. It's 100/100.", category: "Relationships", imageKeyword: "couple supporting each other" },
];

// ============================================
// HARD TRIVIA QUESTIONS - KSh 3 per correct answer
// ============================================

const TRIVIA_QUESTIONS = [
    // Kenyan History & Politics
    {
        question: "In which year did Kenya become a republic?",
        options: ["1963", "1964", "1965", "1966"],
        correct: 1
    },
    {
        question: "Who was Kenya's first Vice President?",
        options: ["Jaramogi Oginga Odinga", "Daniel arap Moi", "Mwai Kibaki", "Raila Odinga"],
        correct: 0
    },
    {
        question: "Which Kenyan president served the longest?",
        options: ["Jomo Kenyatta", "Daniel arap Moi", "Mwai Kibaki", "Uhuru Kenyatta"],
        correct: 1
    },
    {
        question: "What year was the Kenyan Constitution promulgated?",
        options: ["2008", "2010", "2012", "2013"],
        correct: 1
    },
    {
        question: "Who is known as the 'Father of the Kenyan Nation'?",
        options: ["Jomo Kenyatta", "Tom Mboya", "Oginga Odinga", "Kenyatta Day"],
        correct: 0
    },
    {
        question: "Which Kenyan leader was assassinated in 1969?",
        options: ["Tom Mboya", "Jomo Kenyatta", "Oginga Odinga", "Ronald Ngala"],
        correct: 0
    },
    {
        question: "What year did Kenya join the United Nations?",
        options: ["1963", "1964", "1965", "1966"],
        correct: 0
    },
    {
        question: "Who was Kenya's first female Member of Parliament?",
        options: ["Grace Onyango", "Martha Karua", "Wangari Maathai", "Charity Ngilu"],
        correct: 0
    },
    {
        question: "Which Kenyan president introduced the 'Nyayo' philosophy?",
        options: ["Daniel arap Moi", "Jomo Kenyatta", "Mwai Kibaki", "Uhuru Kenyatta"],
        correct: 0
    },
    {
        question: "What year did Kenya hold its first multi-party elections?",
        options: ["1990", "1992", "1995", "1997"],
        correct: 1
    },
    
    // Kenyan Geography
    {
        question: "What is the highest point in Kenya?",
        options: ["Mount Kenya", "Mount Kilimanjaro", "Mount Elgon", "Mount Longonot"],
        correct: 0
    },
    {
        question: "Which lake is the largest in Kenya by surface area?",
        options: ["Lake Victoria", "Lake Turkana", "Lake Nakuru", "Lake Naivasha"],
        correct: 1
    },
    {
        question: "How many counties does Kenya have?",
        options: ["42", "47", "52", "55"],
        correct: 1
    },
    {
        question: "Which river flows through Nairobi?",
        options: ["Nairobi River", "Tana River", "Athi River", "Nzoia River"],
        correct: 0
    },
    {
        question: "What is the largest national park in Kenya?",
        options: ["Tsavo National Park", "Maasai Mara", "Amboseli", "Samburu"],
        correct: 0
    },
    {
        question: "Which city is Kenya's second largest?",
        options: ["Mombasa", "Kisumu", "Nakuru", "Eldoret"],
        correct: 0
    },
    {
        question: "What is the deepest lake in Kenya?",
        options: ["Lake Victoria", "Lake Turkana", "Lake Naivasha", "Lake Baringo"],
        correct: 1
    },
    {
        question: "Which country borders Kenya to the southeast?",
        options: ["Somalia", "Tanzania", "Uganda", "Ethiopia"],
        correct: 1
    },
    {
        question: "What is the total area of Kenya in square kilometers?",
        options: ["580,367", "582,646", "586,000", "590,000"],
        correct: 0
    },
    {
        question: "Which national park is located near Nairobi?",
        options: ["Nairobi National Park", "Maasai Mara", "Amboseli", "Tsavo"],
        correct: 0
    },
    
    // Kenyan Culture & People
    {
        question: "How many ethnic communities are officially recognized in Kenya?",
        options: ["42", "47", "50", "55"],
        correct: 0
    },
    {
        question: "What is the traditional Maasai dance called?",
        options: ["Adumu", "Ngoma", "Chakacha", "Ochung'"],
        correct: 0
    },
    {
        question: "Which ethnic group practices the 'Nyamakama' initiation?",
        options: ["Kikuyu", "Luo", "Kalenjin", "Meru"],
        correct: 2
    },
    {
        question: "What is the traditional Luo instrument called?",
        options: ["Nyatiti", "Orutu", "Kipande", "Litungu"],
        correct: 0
    },
    {
        question: "Which Kenyan community practices 'Mugithi' music?",
        options: ["Kikuyu", "Luo", "Kalenjin", "Meru"],
        correct: 0
    },
    {
        question: "What is the traditional Kalenjin initiation ceremony?",
        options: ["Tumdo", "Nyamakama", "Mugithi", "Chakacha"],
        correct: 0
    },
    {
        question: "Which Kenyan community is known for the 'Chakacha' dance?",
        options: ["Swahili", "Luo", "Kikuyu", "Kalenjin"],
        correct: 0
    },
    {
        question: "What is the traditional dress of the Maasai called?",
        options: ["Shuka", "Kanga", "Kitenge", "Khanga"],
        correct: 0
    },
    {
        question: "Which Kenyan community practices 'Dodo' music?",
        options: ["Luo", "Kikuyu", "Kalenjin", "Meru"],
        correct: 0
    },
    {
        question: "What is the traditional circumcision ceremony among the Kikuyu?",
        options: ["Ituika", "Nyamakama", "Tumdo", "Chakacha"],
        correct: 0
    },
    
    // Kenyan Wildlife
    {
        question: "How many species of birds are found in Kenya?",
        options: ["Over 1000", "Over 1100", "Over 1200", "Over 1300"],
        correct: 1
    },
    {
        question: "Which animal is found only in Kenya?",
        options: ["Hirola antelope", "Lion", "Elephant", "Giraffe"],
        correct: 0
    },
    {
        question: "How many national parks does Kenya have?",
        options: ["20", "22", "25", "28"],
        correct: 1
    },
    {
        question: "Which lake is famous for flamingos in Kenya?",
        options: ["Lake Nakuru", "Lake Victoria", "Lake Turkana", "Lake Naivasha"],
        correct: 0
    },
    {
        question: "What is the largest mammal in Kenya?",
        options: ["Elephant", "Giraffe", "Rhino", "Hippo"],
        correct: 0
    },
    {
        question: "Which Kenyan park is known for black rhino conservation?",
        options: ["Lake Nakuru", "Maasai Mara", "Amboseli", "Samburu"],
        correct: 0
    },
    {
        question: "How many species of primates are found in Kenya?",
        options: ["10", "15", "20", "25"],
        correct: 1
    },
    {
        question: "Which snake is the deadliest in Kenya?",
        options: ["Black Mamba", "Puff Adder", "Cobra", "Viper"],
        correct: 0
    },
    {
        question: "What is Kenya's national bird?",
        options: ["African Fish Eagle", "Ostrich", "Flamingo", "Lilac-breasted Roller"],
        correct: 3
    },
    {
        question: "Which national park is known for its elephants?",
        options: ["Amboseli", "Maasai Mara", "Tsavo", "Samburu"],
        correct: 0
    },
    
    // Kenyan Economy
    {
        question: "What is Kenya's GDP growth rate in 2024?",
        options: ["5.0%", "5.2%", "5.5%", "6.0%"],
        correct: 1
    },
    {
        question: "Which sector is Kenya's largest contributor to GDP?",
        options: ["Agriculture", "Services", "Industry", "Manufacturing"],
        correct: 1
    },
    {
        question: "What is Kenya's currency code?",
        options: ["KES", "KSH", "KNS", "KNY"],
        correct: 0
    },
    {
        question: "Which company is Kenya's largest mobile network operator?",
        options: ["Safaricom", "Airtel", "Telkom", "Equitel"],
        correct: 0
    },
    {
        question: "What is Kenya's unemployment rate?",
        options: ["10%", "12%", "15%", "18%"],
        correct: 0
    },
    {
        question: "Which port is Kenya's largest?",
        options: ["Mombasa", "Kilindini", "Lamu", "Malindi"],
        correct: 0
    },
    {
        question: "What is Kenya's main export?",
        options: ["Tea", "Coffee", "Flowers", "All of the above"],
        correct: 3
    },
    {
        question: "Which industry is Kenya known for in tech?",
        options: ["Mobile Money", "AI", "Cloud Computing", "Cybersecurity"],
        correct: 0
    },
    {
        question: "What is Kenya's inflation rate?",
        options: ["5%", "6%", "7%", "8%"],
        correct: 1
    },
    {
        question: "Which financial institution regulates Kenya's banking sector?",
        options: ["Central Bank of Kenya", "Kenya Revenue Authority", "CBK", "KRA"],
        correct: 0
    },
    
    // Science & General Knowledge
    {
        question: "What is the chemical symbol for gold?",
        options: ["Au", "Ag", "Fe", "Cu"],
        correct: 0
    },
    {
        question: "How many bones are in the human body?",
        options: ["206", "207", "208", "210"],
        correct: 0
    },
    {
        question: "Which planet is known as the Red Planet?",
        options: ["Mars", "Jupiter", "Saturn", "Venus"],
        correct: 0
    },
    {
        question: "What is the speed of light?",
        options: ["299,792,458 m/s", "300,000,000 m/s", "280,000,000 m/s", "310,000,000 m/s"],
        correct: 0
    },
    {
        question: "Who discovered Penicillin?",
        options: ["Alexander Fleming", "Marie Curie", "Louis Pasteur", "Joseph Lister"],
        correct: 0
    },
    {
        question: "What is the human body's largest organ?",
        options: ["Skin", "Liver", "Heart", "Brain"],
        correct: 0
    },
    {
        question: "Which blood type is the universal donor?",
        options: ["O Negative", "A Positive", "B Negative", "AB Positive"],
        correct: 0
    },
    {
        question: "How many teeth does an adult human have?",
        options: ["32", "30", "28", "34"],
        correct: 0
    },
    {
        question: "What is the chemical formula for water?",
        options: ["H2O", "CO2", "NaCl", "HCl"],
        correct: 0
    },
    {
        question: "Which scientist proposed the theory of relativity?",
        options: ["Einstein", "Newton", "Hawking", "Galileo"],
        correct: 0
    }
];

// ============================================
// MUSIC PLAYLIST - Single Declaration
// ============================================

if (typeof MUSIC_PLAYLIST === 'undefined') {
    var MUSIC_PLAYLIST = [
        'https://res.cloudinary.com/u1uilb6f/video/upload/v1740000000/chichi_music1.mp3',
        'https://res.cloudinary.com/u1uilb6f/video/upload/v1740000001/chichi_music2.mp3',
        'https://res.cloudinary.com/u1uilb6f/video/upload/v1740000002/chichi_music3.mp3',
        'https://res.cloudinary.com/u1uilb6f/video/upload/v1740000003/chichi_music4.mp3',
        'https://res.cloudinary.com/u1uilb6f/video/upload/v1740000004/chichi_music5.mp3'
    ];
}

// ============================================
// APP OBJECT - COMPLETE
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

    // ============================================
    // INITIALIZATION
    // ============================================

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
        this.initActivityTracking();
        this.initSuspiciousActivityDetection();
       
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
                self.isAdmin = u.email === 'support-chichi@gmail.com';
               
                // Check if user is banned
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
                
                db.ref('users/' + u.uid).once('value', s => {
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
                            triviaAnswered: []
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
                self.profile = { name: 'Guest', balance: 0, triviaAnswered: [] };
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
    // BANNED USER SCREEN
    // ============================================

    showBannedScreen: function(banData) {
        var html = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #0f172a;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            ">
                <div style="
                    background: white;
                    border-radius: 24px;
                    max-width: 400px;
                    width: 100%;
                    padding: 32px;
                    text-align: center;
                ">
                    <div style="font-size: 64px; margin-bottom: 16px;">🚫</div>
                    <h2 style="color: #ef4444; margin-bottom: 8px;">Account Suspended</h2>
                    <p style="color: #6b7280; margin-bottom: 16px;">
                        Your account has been permanently banned from CHICHI.
                    </p>
                    <div style="background: #fef2f2; padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: left;">
                        <div style="font-size: 13px; color: #991b1b; font-weight: 600;">Reason:</div>
                        <div style="font-size: 14px; color: #7f1d1d;">${banData.reason || 'Violation of terms of service'}</div>
                        ${banData.bannedAt ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Banned on: ${banData.bannedAt}</div>` : ''}
                        ${banData.bannedBy ? `<div style="font-size: 12px; color: #6b7280;">Banned by: ${banData.bannedBy}</div>` : ''}
                    </div>
                    <button onclick="window.location.reload()" style="
                        background: var(--primary);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                    ">OK</button>
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
    // ACTIVITY TRACKING SYSTEM
    // ============================================

    initActivityTracking: function() {
        var self = this;
        
        // Track page views
        this.trackPageView();
        
        // Track clicks
        document.addEventListener('click', function(e) {
            var target = e.target;
            var tagName = target.tagName.toLowerCase();
            var text = target.textContent ? target.textContent.substring(0, 50) : '';
            var id = target.id || '';
            var className = target.className || '';
            
            self.logUserActivity('click', {
                tag: tagName,
                text: text,
                id: id,
                className: className,
                path: window.location.pathname
            });
        });
        
        // Track scroll
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
        
        // Track time spent
        var startTime = Date.now();
        window.addEventListener('beforeunload', function() {
            var timeSpent = Math.round((Date.now() - startTime) / 1000);
            self.logUserActivity('session_end', 'Time spent: ' + timeSpent + ' seconds');
        });
        
        console.log('📊 Activity tracking initialized');
    },

    logUserActivity: function(action, details) {
        if (!this.user && !this.isGuest) return;
        
        var userId = this.user ? this.user.uid : 'guest';
        var userName = this.user ? (this.profile.name || this.user.email || 'User') : 'Guest';
        
        var safeDetails = typeof details === 'string' ? details : JSON.stringify(details);
        if (safeDetails.length > 200) {
            safeDetails = safeDetails.substring(0, 200) + '...';
        }
        
        var activityData = {
            userId: userId,
            userName: userName,
            userEmail: this.user ? this.user.email : 'guest@chichi.com',
            action: action,
            details: safeDetails,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            time: new Date().toLocaleString('en-KE'),
            userAgent: navigator.userAgent.substring(0, 200),
            screen: window.screen.width + 'x' + window.screen.height,
            page: window.location.pathname,
            isAdmin: this.isAdmin || false
        };
        
        db.ref('activityLogs').push(activityData).catch(function(err) {
            console.log('⚠️ Failed to log activity:', err.message);
        });
        
        this.checkForSuspiciousActivity(action, details);
    },

    // ============================================
    // SUSPICIOUS ACTIVITY DETECTION
    // ============================================

    initSuspiciousActivityDetection: function() {
        var self = this;
        
        this.actionTimestamps = {};
        
        console.log('🛡️ Suspicious activity detection initialized');
    },

    checkForSuspiciousActivity: function(action, details) {
        var self = this;
        var userId = this.user ? this.user.uid : 'guest';
        var now = Date.now();
        
        // Monitor rapid actions
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
        
        // Check for specific suspicious patterns
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
                    'Suspicious pattern detected: ' + pattern.pattern + ' in ' + pattern.action,
                    pattern.severity,
                    { action: action, details: details }
                );
                break;
            }
        }
        
        // Check for rapid posting (more than 5 posts in 5 minutes)
        if (action === 'create_post' || action === 'post') {
            this.checkRapidActivity('create_post', 5, 5, 'Rapid posting detected');
        }
        
        // Check for mass following (more than 20 follows in 5 minutes)
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
        console.log('   Severity:', severity);
        console.log('   Data:', data);
        
        var self = this;
        var userId = this.user ? this.user.uid : 'unknown';
        var userName = this.user ? (this.profile.name || this.user.email || 'Unknown') : 'Guest';
        
        var reportData = {
            userId: userId,
            userName: userName,
            userEmail: this.user ? this.user.email : 'guest@chichi.com',
            reason: reason,
            severity: severity || 'medium',
            data: data || {},
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            time: new Date().toLocaleString('en-KE'),
            status: 'pending'
        };
        
        db.ref('suspiciousActivity').push(reportData);
        
        if (this.isAdmin) {
            this.toast('🚨 Suspicious activity detected: ' + reason, 'error');
        }
        
        this.sendAdminNotification('🚨 Suspicious Activity: ' + reason, severity);
        
        setTimeout(function() {
            self.suspiciousActivityDetected = false;
        }, 30000);
    },

    sendAdminNotification: function(message, severity) {
        var colors = {
            low: '#22c55e',
            medium: '#f59e0b',
            high: '#ef4444',
            critical: '#dc2626'
        };
        
        var color = colors[severity] || '#ef4444';
        
        if (this.isAdmin) {
            this.toast('🚨 ' + message, 'error');
        }
        
        db.ref('adminNotifications').push({
            message: message,
            severity: severity || 'medium',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            time: new Date().toLocaleString('en-KE'),
            read: false
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
                                    ${act.status === 'resolved' ? '<span style="font-size: 0.7rem; color: #22c55e;">✅ Resolved</span>' : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            document.getElementById('suspiciousActivityList').innerHTML = html;
        }).catch(function(err) {
            document.getElementById('suspiciousActivityList').innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading suspicious activity</div>';
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
        }).catch(function(err) {
            document.getElementById('adminNotificationsList').innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading notifications</div>';
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
    // DARK MODE
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
    // HEADER MENU (3 dots)
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
    // AUTO-POST SYSTEM
    // ============================================

    loadPostedHistory: function() {
        var savedHistory = localStorage.getItem('chichi_posted_history');
        if (savedHistory) {
            try {
                this.postedHistory = JSON.parse(savedHistory);
                console.log('📚 Loaded posted history:', this.postedHistory.length, 'posts');
            } catch(e) {
                this.postedHistory = [];
            }
        }
        
        var savedTime = localStorage.getItem('chichi_last_post_time');
        if (savedTime) {
            this.lastPostTime = parseInt(savedTime);
            console.log('⏰ Last post time:', new Date(this.lastPostTime).toLocaleTimeString());
        }
        
        var today = new Date().toDateString();
        var savedDate = localStorage.getItem('chichi_last_post_date');
        if (savedDate !== today) {
            console.log('📅 New day detected! Resetting posted history...');
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
        
        var available = allTemplates.filter(function(template) {
            return !postedTexts.includes(template.text);
        });
        
        return available;
    },

    getRandomImage: function(keyword) {
        console.log('📸 Fetching image for:', keyword);
        
        return new Promise(function(resolve, reject) {
            var unsplashUrl = 'https://api.unsplash.com/photos/random?query=' + encodeURIComponent(keyword) + '&orientation=landscape';
            
            fetch(unsplashUrl, {
                headers: {
                    'Authorization': 'Client-ID 0Gsd_TnIf0UngbQD6aLSR-u6pTQf__o5W93K8Q30G7Q'
                }
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Unsplash API error');
                }
                return response.json();
            })
            .then(function(data) {
                if (data && data.urls && data.urls.regular) {
                    resolve(data.urls.regular);
                } else {
                    throw new Error('No image from Unsplash');
                }
            })
            .catch(function() {
                var width = 800 + Math.floor(Math.random() * 400);
                var height = 600 + Math.floor(Math.random() * 300);
                var seed = 'person' + Date.now() + Math.random();
                var url = 'https://picsum.photos/seed/' + seed + '/' + width + '/' + height;
                resolve(url);
            });
        });
    },

    uploadImageToCloudinary: function(imageUrl) {
        console.log('📤 Uploading image to Cloudinary...');
        
        return new Promise(function(resolve, reject) {
            fetch(imageUrl)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('Failed to fetch image');
                    }
                    return response.blob();
                })
                .then(function(blob) {
                    var formData = new FormData();
                    formData.append('file', blob);
                    formData.append('upload_preset', UPLOAD_PRESET || 'chichi_photos');
                    
                    return fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                        method: 'POST',
                        body: formData
                    });
                })
                .then(function(response) {
                    if (!response.ok) {
                        return response.json().then(function(data) {
                            throw new Error(data.error ? data.error.message : 'Upload failed');
                        });
                    }
                    return response.json();
                })
                .then(function(data) {
                    if (data.secure_url) {
                        console.log('✅ Image uploaded:', data.secure_url);
                        resolve(data.secure_url);
                    } else {
                        reject(new Error('No URL returned'));
                    }
                })
                .catch(function(err) {
                    console.error('❌ Upload error:', err);
                    reject(err);
                });
        });
    },

    performAutoPost: function() {
        var self = this;
        
        console.log('🤖 Checking for auto-post...');
        
        if (!self.user || self.user.email !== 'support-chichi@gmail.com') {
            console.log('⚠️ Support account not logged in. Skipping auto-post.');
            return;
        }
        
        var now = Date.now();
        var minutesSinceLastPost = (now - self.lastPostTime) / (1000 * 60);
        
        if (minutesSinceLastPost < 10 && self.postedHistory.length > 0) {
            var remainingMinutes = Math.round(10 - minutesSinceLastPost);
            console.log('⏳ Next post in:', remainingMinutes, 'minutes');
            return;
        }
        
        var availableTemplates = self.getAvailableTemplates();
        
        if (availableTemplates.length === 0) {
            console.log('🔄 All templates used! Resetting history...');
            self.postedHistory = [];
            self.savePostedHistory();
            availableTemplates = POST_TEMPLATES.slice();
        }
        
        var randomIndex = Math.floor(Math.random() * availableTemplates.length);
        var selected = availableTemplates[randomIndex];
        
        console.log('📝 Selected post:', selected.text.substring(0, 50) + '...');
        console.log('📂 Category:', selected.category);
        console.log('🖼️ Image keyword:', selected.imageKeyword);
        
        self.getRandomImage(selected.imageKeyword).then(function(imageUrl) {
            return self.uploadImageToCloudinary(imageUrl);
        }).then(function(finalImageUrl) {
            var postData = {
                userId: self.user.uid,
                userName: 'SUPPORT@CHICHI',
                userPhoto: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
                photoUrl: finalImageUrl,
                caption: selected.text,
                hashtags: ['#CHICHI', '#AutoPost', '#' + selected.category.replace(/\s/g, '')],
                likes: {},
                comments: [],
                commentedUsers: {},
                downloads: 0,
                isAutoPost: true,
                isSupportPost: true,
                category: selected.category,
                source: 'CHICHI AI',
                createdAt: new Date().toLocaleString('en-KE'),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            
            db.ref('posts').push(postData).then(function() {
                console.log('✅ Auto-post published!');
                self.toast('🤖 New post from SUPPORT@CHICHI!', 'success');
                
                self.postedHistory.push({
                    text: selected.text,
                    category: selected.category,
                    timestamp: Date.now()
                });
                self.lastPostTime = Date.now();
                self.savePostedHistory();
                
                setTimeout(function() {
                    self.loadPosts();
                }, 500);
                
            }).catch(function(err) {
                console.error('❌ Error publishing:', err);
            });
        }).catch(function(err) {
            console.error('❌ Image error:', err);
            setTimeout(function() {
                self.performAutoPost();
            }, 30000);
        });
    },

    startAutoPostScheduler: function() {
        var self = this;
        
        console.log('⏰ Starting auto-post scheduler (checks every 60 seconds)...');
        
        if (!self.user || self.user.email !== 'support-chichi@gmail.com') {
            console.log('⚠️ Support account not logged in. Cannot start scheduler.');
            return;
        }
        
        self.loadPostedHistory();
        
        var now = Date.now();
        var minutesSinceLastPost = (now - self.lastPostTime) / (1000 * 60);
        var hasNoPostsToday = self.postedHistory.length === 0;
        
        if (hasNoPostsToday || minutesSinceLastPost >= 10) {
            console.log('📝 Starting with an immediate post...');
            setTimeout(function() {
                self.performAutoPost();
            }, 3000);
        } else {
            console.log('⏳ Next post in:', Math.round(10 - minutesSinceLastPost), 'minutes');
        }
        
        if (self.autoPostInterval) {
            clearInterval(self.autoPostInterval);
        }
        
        self.autoPostInterval = setInterval(function() {
            console.log('⏰ Scheduler check...');
            self.performAutoPost();
        }, 60000);
        
        console.log('✅ Scheduler running! Checking every 60 seconds.');
    },

    stopAutoPostScheduler: function() {
        if (this.autoPostInterval) {
            clearInterval(this.autoPostInterval);
            this.autoPostInterval = null;
            console.log('⏹️ Auto-post scheduler stopped');
        }
    },

    triggerAutoPost: function() {
        var self = this;
        
        if (!self.user || self.user.email !== 'support-chichi@gmail.com') {
            self.toast('⚠️ Please login as support-chichi@gmail.com', 'error');
            return;
        }
        
        console.log('🚀 Manual auto-post triggered!');
        self.performAutoPost();
    },

    // ============================================
    // TRIVIA SYSTEM - KSh 3 per correct answer, 5 second timer
    // ============================================

    startTriviaTimer: function() {
        var self = this;
        
        if (this.triviaInterval) {
            clearInterval(this.triviaInterval);
        }
        
        this.checkTriviaStatus();
        
        this.triviaInterval = setInterval(function() {
            self.checkTriviaStatus();
        }, 60000);
        
        console.log('🧠 Trivia timer started - checking every minute');
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
                db.ref('users/' + userId + '/pendingTrivia').once('value', function(snap) {
                    var pending = snap.val();
                    
                    if (pending && pending.question) {
                        self.showTriviaQuestion(pending);
                    } else {
                        self.generateTriviaQuestion();
                    }
                });
            } else {
                console.log('✅ User already answered today\'s trivia');
                db.ref('users/' + userId + '/pendingTrivia').remove();
            }
        });
    },

    generateTriviaQuestion: function() {
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
            
            if (answeredToday) return;
            
            var unanswered = TRIVIA_QUESTIONS.filter(function(q, index) {
                var questionAnswered = false;
                for (var j = 0; j < answered.length; j++) {
                    if (answered[j].questionIndex === index) {
                        questionAnswered = true;
                        break;
                    }
                }
                return !questionAnswered;
            });
            
            if (unanswered.length === 0) {
                db.ref('users/' + userId + '/triviaAnswered').set([]);
                unanswered = TRIVIA_QUESTIONS.slice();
            }
            
            var randomIndex = Math.floor(Math.random() * unanswered.length);
            var question = unanswered[randomIndex];
            var questionIndex = TRIVIA_QUESTIONS.indexOf(question);
            
            var pendingData = {
                question: question.question,
                options: question.options,
                correct: question.correct,
                questionIndex: questionIndex,
                timestamp: Date.now()
            };
            
            db.ref('users/' + userId + '/pendingTrivia').set(pendingData, function() {
                self.showTriviaQuestion(pendingData);
            });
        });
    },

    showTriviaQuestion: function(questionData) {
        if (!this.user || this.isGuest) return;
        
        var self = this;
        this.currentTrivia = questionData;
        this.triviaAnswered = false;
        
        var existing = document.getElementById('triviaModal');
        if (existing) {
            existing.remove();
        }
        
        var shuffledOptions = questionData.options.slice();
        var correctIndex = questionData.correct;
        var correctValue = questionData.options[correctIndex];
        var shuffledCorrectIndex = shuffledOptions.indexOf(correctValue);
        
        var optionsHtml = '';
        shuffledOptions.forEach(function(option, index) {
            optionsHtml += `
                <button class="trivia-option" onclick="app.answerTrivia(${index})" style="
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
                    font-family: 'Sora', 'Plus Jakarta Sans', sans-serif;
                    color: #1a202c;
                " onmouseover="this.style.borderColor='#0088cc'; this.style.background='#f0f7ff'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white'">
                    ${option}
                </button>
            `;
        });
        
        this.currentTrivia.shuffledCorrectIndex = shuffledCorrectIndex;
        
        var modalHTML = `
            <div id="triviaModal" class="modal-overlay active" style="
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
                background: rgba(0,0,0,0.7);
                backdrop-filter: blur(4px);
            ">
                <div style="
                    background: white;
                    border-radius: 24px;
                    max-width: 450px;
                    width: 92%;
                    padding: 24px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    animation: smoothFadeIn 0.3s ease;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 28px;">🧠</span>
                            <h3 style="margin: 0; font-weight: 700; color: #1a202c;">Trivia Challenge</h3>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="background: #0088cc; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">KSh 3</span>
                            <span id="triviaTimer" style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">5s</span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <p style="font-size: 16px; font-weight: 600; color: #1a202c; line-height: 1.5;">${questionData.question}</p>
                        <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">Correct answer earns KSh 3</p>
                    </div>
                    
                    <div id="triviaOptions">
                        ${optionsHtml}
                    </div>
                    
                    <div id="triviaResult" style="display: none; text-align: center; padding: 12px; border-radius: 12px; margin-top: 12px;"></div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        var timeLeft = 5;
        var timerDisplay = document.getElementById('triviaTimer');
        
        if (this.triviaTimer) {
            clearInterval(this.triviaTimer);
        }
        
        this.triviaTimer = setInterval(function() {
            timeLeft--;
            if (timerDisplay) {
                timerDisplay.textContent = timeLeft + 's';
                if (timeLeft <= 2) {
                    timerDisplay.style.background = '#ef4444';
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
                        if (index === self.currentTrivia.shuffledCorrectIndex) {
                            btn.style.borderColor = '#22c55e';
                            btn.style.background = '#dcfce7';
                        }
                    });
                    
                    var resultDiv = document.getElementById('triviaResult');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = `
                        <div style="color: #ef4444; font-weight: 700; font-size: 18px;">⏰ Time\'s Up!</div>
                        <div style="color: #6b7280; font-size: 14px;">The correct answer was: ${self.currentTrivia.options[self.currentTrivia.correct]}</div>
                    `;
                    resultDiv.style.background = '#fee2e2';
                    
                    setTimeout(function() {
                        var modal = document.getElementById('triviaModal');
                        if (modal) modal.remove();
                    }, 3000);
                }
            }
        }, 1000);
    },

    answerTrivia: function(selectedIndex) {
        if (this.triviaAnswered || !this.currentTrivia) return;
        if (!this.user || this.isGuest) return;
        
        if (this.triviaTimer) {
            clearInterval(this.triviaTimer);
            this.triviaTimer = null;
        }
        
        this.triviaAnswered = true;
        var self = this;
        var userId = this.user.uid;
        var correct = this.currentTrivia.shuffledCorrectIndex === selectedIndex;
        var today = new Date().toDateString();
        
        document.querySelectorAll('.trivia-option').forEach(function(btn, index) {
            btn.disabled = true;
            btn.style.cursor = 'not-allowed';
            if (index === self.currentTrivia.shuffledCorrectIndex) {
                btn.style.borderColor = '#22c55e';
                btn.style.background = '#dcfce7';
            } else if (index === selectedIndex && !correct) {
                btn.style.borderColor = '#ef4444';
                btn.style.background = '#fee2e2';
            }
        });
        
        var resultDiv = document.getElementById('triviaResult');
        resultDiv.style.display = 'block';
        
        if (correct) {
            resultDiv.innerHTML = `
                <div style="color: #22c55e; font-weight: 700; font-size: 18px;">✅ Correct!</div>
                <div style="color: #6b7280; font-size: 14px;">You earned KSh 3!</div>
            `;
            resultDiv.style.background = '#dcfce7';
            
            self.balance += 3;
            db.ref('users/' + userId + '/balance').set(self.balance);
            
            var balanceDisplay = document.getElementById('balanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.textContent = 'KSh ' + self.balance.toFixed(2);
            }
            
            self.toast('🎉 Correct! +KSh 3 added to your balance!', 'success');
        } else {
            resultDiv.innerHTML = `
                <div style="color: #ef4444; font-weight: 700; font-size: 18px;">❌ Wrong answer</div>
                <div style="color: #6b7280; font-size: 14px;">The correct answer was: ${self.currentTrivia.options[self.currentTrivia.correct]}</div>
            `;
            resultDiv.style.background = '#fee2e2';
            self.toast('❌ Wrong answer! Try again next time.', 'error');
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
            var modal = document.getElementById('triviaModal');
            if (modal) modal.remove();
        }, 4000);
    },

    // ============================================
    // EARNING PAGE
    // ============================================

    renderEarn: function() {
        console.log('💰 Rendering earn page...');
        
        var earnContainer = document.getElementById('earnContainer');
        if (!earnContainer) {
            console.error('❌ Earn container not found!');
            return;
        }
        
        var html = `
            <div style="padding: 16px;">
                <div style="background: linear-gradient(135deg, #0088cc, #006fa3); border-radius: 16px; padding: 20px; margin-bottom: 20px; color: white; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 8px;">💰</div>
                    <div style="font-size: 24px; font-weight: 700;">Your Balance</div>
                    <div style="font-size: 36px; font-weight: 800; margin: 8px 0;" id="earnBalanceDisplay">KSh ${this.balance.toFixed(2)}</div>
                    <button onclick="app.showWithdrawModal()" style="background: white; color: #0088cc; border: none; padding: 10px 30px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px;">💳 Withdraw</button>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 16px;">
                    <h3 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                        <span>🧠</span> Trivia Challenge
                        <span style="font-size: 12px; background: #f59e0b; color: white; padding: 2px 10px; border-radius: 12px; margin-left: auto;">KSh 3</span>
                    </h3>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">Answer hard trivia questions and earn KSh 3 for each correct answer! Only 5 seconds per question.</p>
                    <button onclick="app.checkTriviaStatus()" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; width: 100%;">🎯 Start Trivia</button>
                </div>
                
                <div style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 12px 0;">📊 Your Stats</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Total Earned</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;">KSh ${this.balance.toFixed(2)}</div>
                        </div>
                        <div style="background: #f0f7ff; padding: 12px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280;">Questions Answered</div>
                            <div style="font-size: 20px; font-weight: 700; color: #0088cc;" id="triviaCount">0</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        earnContainer.innerHTML = html;
        
        if (this.user && this.user.uid) {
            db.ref('users/' + this.user.uid + '/triviaAnswered').once('value', function(snapshot) {
                var answered = snapshot.val() || [];
                var countDisplay = document.getElementById('triviaCount');
                if (countDisplay) {
                    countDisplay.textContent = answered.length;
                }
            });
        }
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
        this.onlineInterval = setInterval(() => {
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

    requireAuth: function(action) {
        if (this.isGuest || !this.user) {
            this.toast('🔐 Sign up to ' + (action || 'access this'), 'info');
            this.showLoginPage();
            return false;
        }
        return true;
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
        
        this.loadDarkModePreference();
    },

    // ============================================
    // LOAD PROFILE
    // ============================================

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
                self.renderProfile();
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
                if (viewId === 'earnView') return 'earn';
            }
        }
        return 'feed';
    },

    // ============================================
    // AUTH HANDLERS
    // ============================================

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
                self.logUserActivity('login_success', 'User logged in: ' + email);
            })
            .catch(err => {
                console.error('❌ Login error:', err.message);
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
        
        auth.createUserWithEmailAndPassword(email, pass).then(function(r) {
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
                triviaAnswered: [],
                createdAt: new Date().toLocaleString('en-KE'),
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            };
            
            db.ref('users/' + r.user.uid).set(userData).then(function() {
                self.toast('Account created! Please select your interests', 'success');
                self.logUserActivity('signup', 'New user signed up: ' + email);
                
                setTimeout(function() {
                    self.showMandatoryHashtagSelection();
                }, 500);
                
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

    signInWithGoogle: function() {
        var self = this;
        var provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).then(result => {
            var user = result.user;
            db.ref('users/' + user.uid).once('value', snap => {
                if (!snap.exists()) {
                    db.ref('users/' + user.uid).set({
                        name: user.displayName || 'User',
                        username: user.displayName.toLowerCase().replace(/\s/g, '') || 'user',
                        email: user.email,
                        bio: '',
                        profilePhoto: user.photoURL || '',
                        balance: 0,
                        followers: 0,
                        following: 0,
                        triviaAnswered: [],
                        createdAt: new Date().toLocaleString('en-KE'),
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                    self.toast('Account created with Google!', 'success');
                    self.logUserActivity('google_signup', 'New user signed up with Google: ' + user.email);
                } else {
                    self.toast('Welcome back!', 'success');
                    self.logUserActivity('google_login', 'User logged in with Google: ' + user.email);
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
            self.logUserActivity('password_reset', 'Password reset requested for: ' + email);
        }).catch(err => {
            self.toast('Error: ' + err.message, 'error');
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
        var tabMap = ['dashboard', 'users', 'posts', 'withdrawals', 'logs', 'suspicious', 'notifications'];
        var tabIndex = tabMap.indexOf(tab);
        if (tabIndex >= 0) {
            buttons[tabIndex].classList.add('active');
        }
       
        var contentMap = {
            'dashboard': 'adminDashboard',
            'users': 'adminUsers',
            'posts': 'adminPosts',
            'withdrawals': 'adminWithdrawalsTab',
            'logs': 'adminLogs',
            'suspicious': 'adminSuspiciousTab',
            'notifications': 'adminNotificationsTab'
        };
       
        var contentId = contentMap[tab];
        if (contentId) {
            document.getElementById(contentId).classList.add('active');
        }
       
        if (tab === 'users') this.loadAdminUsers();
        if (tab === 'posts') this.loadAdminPosts();
        if (tab === 'withdrawals') this.loadAdminWithdrawals();
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
       
        db.ref('withdrawals').once('value', snap => {
            var withdrawals = [];
            snap.forEach(child => {
                withdrawals.push({
                    id: child.key,
                    ...child.val()
                });
            });
           
            var pendingCount = withdrawals.filter(w => w.status === 'pending').length;
            var approvedCount = withdrawals.filter(w => w.status === 'approved').length;
           
            document.getElementById('adminPendingCount').textContent = pendingCount;
            document.getElementById('adminApprovedCount').textContent = approvedCount;
           
            var html = '';
            if (withdrawals.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No withdrawal requests</div>';
            } else {
                var recent = withdrawals.slice(0, 5);
                recent.forEach(w => {
                    var statusClass = w.status || 'pending';
                    html += `
                        <div class="withdrawal-card ${statusClass}" style="margin-bottom: 8px;">
                            <div class="withdrawal-header">
                                <div class="withdrawal-user">${w.userName || 'Unknown'}</div>
                                <div class="withdrawal-status ${statusClass}">${(w.status || 'pending').toUpperCase()}</div>
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
                
                userArray.forEach(u => {
                    var isBanned = bannedUsers[u.uid] ? true : false;
                    var banData = bannedUsers[u.uid] || {};
                    
                    html += `
                        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; ${isBanned ? 'background: #fef2f2;' : ''}">
                            <div>
                                <div style="font-weight: 600; font-size: 0.95rem;">${u.user.name} ${isBanned ? '🚫' : ''}</div>
                                <div style="font-size: 0.8rem; color: var(--text-light);">${u.user.email}</div>
                                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px;">Joined: ${u.user.createdAt}</div>
                                <div style="font-size: 0.75rem; color: var(--primary);">Balance: KSh ${(u.user.balance || 0).toFixed(2)}</div>
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
        
        if (!confirm('⚠️ Ban user "' + userName + '"?\n\nReason: ' + reason + '\n\nThis will permanently block their access.')) {
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

    // ============================================
    // ADMIN - POSTS
    // ============================================

    loadAdminPosts: function() {
        var html = '';
        if (this.posts.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No posts yet</div>';
        } else {
            this.posts.forEach(p => {
                var likes = (p.likes && Object.keys(p.likes).length) || 0;
                var comments = (p.comments || []).length;
                var isSupportPost = p.isSupportPost || p.isAutoPost || p.userName === 'SUPPORT@CHICHI';
                
                html += `
                    <div style="background: white; border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); ${isSupportPost ? 'border-left: 3px solid #0088cc;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="font-weight: 700; font-size: 0.95rem;">${p.userName} ${isSupportPost ? '🤖' : ''}</div>
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
        
        db.ref('withdrawals').once('value', snap => {
            var withdrawals = [];
            snap.forEach(child => {
                withdrawals.push({
                    id: child.key,
                    ...child.val()
                });
            });
            
            withdrawals.sort((a, b) => {
                return (b.timestamp || 0) - (a.timestamp || 0);
            });
            
            if (withdrawals.length === 0) {
                html = '<div style="text-align: center; color: #6b7280; padding: 40px 20px;">💳 No withdrawal requests</div>';
            } else {
                withdrawals.forEach(w => {
                    var statusClass = w.status || 'pending';
                    var statusText = (w.status || 'pending').toUpperCase();
                    var statusColor = statusClass === 'pending' ? '#f59e0b' : 
                                     statusClass === 'approved' ? '#22c55e' : '#ef4444';
                    
                    html += `
                        <div class="withdrawal-card ${statusClass}" style="margin-bottom: 10px;">
                            <div class="withdrawal-header">
                                <div class="withdrawal-user">👤 ${w.userName || 'Unknown User'}</div>
                                <div class="withdrawal-status ${statusClass}" style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">${statusText}</div>
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
        }).catch(err => {
            console.error('Error loading withdrawals:', err);
            document.getElementById('adminWithdrawalsList').innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading withdrawals</div>';
        });
    },

    approveWithdrawal: function(withdrawalId) {
        var self = this;
        db.ref('withdrawals/' + withdrawalId).update({
            status: 'approved'
        }).then(() => {
            self.toast('✅ Withdrawal approved', 'success');
            self.loadAdminWithdrawals();
            self.loadAdminDashboard();
            self.logUserActivity('admin_approve_withdrawal', 'Approved withdrawal: ' + withdrawalId);
        }).catch(err => {
            self.toast('❌ Error: ' + err.message, 'error');
        });
    },

    rejectWithdrawal: function(withdrawalId) {
        var self = this;
        db.ref('withdrawals/' + withdrawalId).once('value', snap => {
            if (snap.exists()) {
                var withdrawal = snap.val();
                db.ref('withdrawals/' + withdrawalId).update({
                    status: 'rejected'
                }).then(() => {
                    db.ref('users/' + withdrawal.userId + '/balance').once('value', balanceSnap => {
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
                        'login': '🔐',
                        'login_success': '✅',
                        'login_failed': '❌',
                        'signup': '📝',
                        'google_signup': '📝',
                        'google_login': '🔐',
                        'click': '👆',
                        'scroll': '📜',
                        'session_end': '⏱️',
                        'create_post': '📄',
                        'delete_post': '🗑️',
                        'like_post': '❤️',
                        'comment': '💬',
                        'follow': '👥',
                        'unfollow': '👥',
                        'admin_login': '⚙️',
                        'admin_ban': '🚫',
                        'admin_unban': '✅',
                        'admin_delete_post': '🗑️',
                        'admin_approve_withdrawal': '✅',
                        'admin_reject_withdrawal': '❌',
                        'admin_resolve_activity': '✅',
                        'password_reset': '🔑'
                    }[act.action] || '📌';
                    
                    html += `
                        <div style="padding: 10px 12px; border-bottom: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; font-size: 0.85rem;">${actionIcon} ${act.userName || 'Guest'}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-light);">${act.action} - ${act.details || 'N/A'}</div>
                                    <div style="font-size: 0.65rem; color: var(--text-light);">📧 ${act.userEmail || 'N/A'} • ${act.page || '/'}</div>
                                    ${act.isAdmin ? '<span style="font-size: 0.6rem; color: #0088cc;">👑 Admin</span>' : ''}
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.7rem; color: var(--text-light);">${act.time || 'N/A'}</div>
                                    <div style="font-size: 0.6rem; color: var(--text-light);">${act.screen || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            document.getElementById('activityLogList').innerHTML = html;
        }).catch(function(err) {
            document.getElementById('activityLogList').innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading activity log</div>';
        });
    },

    // ============================================
    // SEARCH
    // ============================================

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
                if (u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || (u.username && u.username.toLowerCase().includes(query))) {
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

    // ============================================
    // CREATE POST
    // ============================================

    showCreateModal: function() {
        console.log('📝 Opening create post modal...');
        var modal = document.getElementById('createModal');
        if (!modal) {
            console.error('❌ createModal not found!');
            modal = document.querySelector('.modal-overlay#createModal');
            if (!modal) {
                this.toast('Error opening post creator', 'error');
                return;
            }
        }
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
        console.log('✅ Create modal opened');
        
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
        
        var photoInput = document.getElementById('photoInput');
        if (photoInput) photoInput.value = '';
        
        var captionInput = document.getElementById('captionInput');
        if (captionInput) captionInput.value = '';
        
        var photoPreview = document.getElementById('photoPreview');
        if (photoPreview) {
            photoPreview.style.display = 'none';
            photoPreview.textContent = '';
        }
        console.log('✅ Create modal closed');
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
                self.logUserActivity('create_post', 'Created a new post');
                
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

    // ============================================
    // STORIES FUNCTIONS
    // ============================================

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
                            <label class="story-form-label">Story Images (Select multiple) *</label>
                            <input type="file" id="storyImageInput" accept="image/*" multiple class="story-file-input">
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">You can select multiple images at once</div>
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
                            <span class="story-btn-text">📤 Upload Stories</span>
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
                .then(r => {
                    if (!r.ok) {
                        return r.json().then(errData => {
                            throw new Error(errData.error?.message || 'Upload failed: ' + r.status);
                        });
                    }
                    return r.json();
                })
                .then(data => {
                    if (data.secure_url) {
                        resolve(data.secure_url);
                    } else {
                        reject(new Error('No image URL returned'));
                    }
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
                
                var promise = db.ref('stories/' + self.user.uid + '/' + storyId).set(storyData);
                savePromises.push(promise);
            });
            
            return Promise.all(savePromises);
        }).then(function() {
            self.toast('✅ ' + imageUrls.length + ' stories uploaded successfully!', 'success');
            self.logUserActivity('story_upload', 'Uploaded ' + imageUrls.length + ' stories');
            setTimeout(() => {
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

    viewStory: function(storyId, userId) {
        userId = userId || this.user.uid;
        
        var self = this;
        var user = this.users[userId] || { name: 'User' };
        var isOwnStory = this.user && userId === this.user.uid;
        
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
            
            var deleteBtn = isOwnStory ? `
                <button onclick="event.stopPropagation(); app.deleteStory('${storyId}', '${userId}')" style="
                    position: absolute;
                    top: 70px;
                    right: 16px;
                    z-index: 10;
                    background: rgba(239, 68, 68, 0.9);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    font-size: 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">🗑️</button>
            ` : '';
            
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
                
                ${deleteBtn}
                
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
            var duration = 10000;
            
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
                if (target.tagName === 'IMG' || target.tagName === 'BUTTON') {
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

    deleteStory: function(storyId, userId) {
        if (!confirm('Delete this story?')) return;
        
        var self = this;
        db.ref('stories/' + userId + '/' + storyId).remove().then(function() {
            self.toast('✅ Story deleted', 'success');
            self.loadStories();
            var viewer = document.querySelector('[style*="z-index: 9999;"]');
            if (viewer) viewer.remove();
        }).catch(function(err) {
            self.toast('❌ Error deleting story: ' + err.message, 'error');
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

    // ============================================
    // NOTIFICATIONS
    // ============================================

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

    // ============================================
    // MESSAGES & CHAT
    // ============================================

    loadMessages: function() {
        var self = this;
        console.log('💬 Loading messages for user:', this.user ? this.user.uid : 'guest');
        
        if (!this.user || this.isGuest || !this.user.uid) {
            console.log('⚠️ User not logged in - showing guest message');
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
            var container = document.getElementById('messageList');
            if (container) {
                container.innerHTML = html;
            }
            return;
        }
        
        console.log('✅ User logged in - loading messages for:', this.user.uid);
        this.loadBlockedUsers();
        
        var html = '';
        var conversations = [];
        
        db.ref('messages').once('value', function(snapshot) {
            console.log('📡 Messages snapshot received');
            
            if (snapshot.val()) {
                console.log('✅ Messages found:', Object.keys(snapshot.val()).length, 'conversations');
                
                Object.keys(snapshot.val()).forEach(function(chatKey) {
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
                            Object.keys(messages).forEach(function(msgId) {
                                var msg = messages[msgId];
                                
                                if (msg && !msg.deleted) {
                                    if (msg.text || msg.image) {
                                        hasTextMessages = true;
                                        lastMessage = msg.text ? msg.text.substring(0, 50) : '📷 Image';
                                        lastTimestamp = msg.timestamp || 0;
                                        
                                        if (msg.sender !== self.user.uid && !msg.read) {
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
            
            conversations.sort(function(a, b) {
                return b.lastTimestamp - a.lastTimestamp;
            });
            
            console.log('✅ Total conversations:', conversations.length);
            
            if (conversations.length > 0) {
                conversations.forEach(function(conv) {
                    var unreadBadge = conv.unreadCount > 0 ? '<div class="message-item-unread">' + conv.unreadCount + '</div>' : '<div style="width: 20px;"></div>';
                    var avatarStyle = conv.user.profilePhoto ? 'background-image: url(\'' + conv.user.profilePhoto + '\'); background-size: cover; background-position: center;' : '';
                    
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
                html = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
                        <div style="font-size: 18px; font-weight: 600; color: #1a202c; margin-bottom: 8px;">No conversations yet</div>
                        <div style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">Go find someone to chat with!</div>
                        <button onclick="app.switchView('explore')" style="background: var(--primary); color: white; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">🔍 Find Friends</button>
                    </div>
                `;
            }
            
            var container = document.getElementById('messageList');
            if (container) {
                container.innerHTML = html;
                console.log('✅ Messages rendered:', conversations.length);
            }
        }).catch(function(err) {
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
        allViews.forEach(function(view) {
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
        
        setTimeout(function() {
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
       
        if (this.chatMessagesListener) {
            db.ref('chats/' + key + '/messages').off();
        }
       
        db.ref('chats/' + key + '/messages').once('value').then(function(snapshot) {
            var messages = [];
            snapshot.forEach(function(c) {
                var m = c.val();
                if (m && (m.text || m.image)) {
                    messages.push(m);
                }
            });
           
            messages.sort(function(a, b) {
                return (a.timestamp || 0) - (b.timestamp || 0);
            });
           
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
                            if (msg && (msg.text || msg.image)) {
                                updated.push(msg);
                            }
                        });
                        updated.sort(function(a, b) {
                            return (a.timestamp || 0) - (b.timestamp || 0);
                        });
                        self.chatMessages[key] = updated;
                        self.displayChatMessages(updated, key);
                    });
                }
            });
        }).catch(function(err) {
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
                if (d.toDateString() === yesterday.toDateString()) {
                    dateStr = 'Yesterday';
                } else if (d.toDateString() !== today.toDateString()) {
                    dateStr = d.toLocaleDateString();
                }
               
                if (dateStr !== lastDate) {
                    html += '<div class="message-date-divider">' + dateStr + '</div>';
                    lastDate = dateStr;
                }
            }
           
            var content = '';
            if (m.image) {
                if (Array.isArray(m.image)) {
                    content += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">';
                    m.image.forEach(function(img, i) {
                        if (i < 4) {
                            content += '<img src="' + img + '" style="width: 100%; border-radius: 8px; cursor: pointer;" onclick="app.viewFullImage(\'' + img + '\')">';
                        }
                    });
                    content += '</div>';
                } else {
                    content += '<img src="' + m.image + '" style="max-width: 180px; border-radius: 12px; cursor: pointer;" onclick="app.viewFullImage(\'' + m.image + '\')">';
                }
            }
            if (m.text) {
                content += '<div>' + m.text + '</div>';
            }
            
            var otherUserName = self.currentChat.name || 'User';
            var otherUserInitial = otherUserName.charAt(0).toUpperCase();
            var showAvatar = side === 'other';
            var readReceipt = side === 'own' ? (m.read ? '✓✓' : '✓') : '';
            
            html += `
                <div class="message-group ${side}">
                    ${showAvatar ? '<div class="message-avatar" style="' + (self.users[self.currentChat.uid] && self.users[self.currentChat.uid].profilePhoto ? 'background-image: url(' + self.users[self.currentChat.uid].profilePhoto + '); background-size: cover; background-position: center;' : '') + '">' + (!self.users[self.currentChat.uid] || !self.users[self.currentChat.uid].profilePhoto ? otherUserInitial : '') + '</div>' : ''}
                    <div class="message-wrapper">
                        ${side === 'other' ? '<div class="message-sender">' + otherUserName + '</div>' : ''}
                        <div class="message-bubble">
                            ${m.text ? '<div>' + m.text + '</div>' : ''}
                            ${m.image ? '<img src="' + m.image + '" style="max-width: 100%; border-radius: 12px; cursor: pointer;" onclick="app.viewFullImage(\'' + m.image + '\')">' : ''}
                        </div>
                        <div class="message-meta">
                            <span>${timestamp}</span>
                            ${readReceipt ? '<span class="message-read-receipt">' + readReceipt + '</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
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
            sender: self.user.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            read: false
        }).then(function() {
            console.log('✅ Message sent');
            
            db.ref('chats/' + key + '/messages/' + messageRef.key).set({
                text: text,
                sender: self.user.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                read: false
            });
            
            tempMessage.pending = false;
            self.displayChatMessages(self.chatMessages[key], key);
        }).catch(function(err) {
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
       
        Promise.all(uploadPromises).then(function(urls) {
            self.sendChatImages(urls);
            document.getElementById('chatImageInput').value = '';
        }).catch(function(err) {
            self.toast('Image upload failed', 'error');
        });
    },

    uploadChatImage: function(file) {
        return new Promise(function(resolve, reject) {
            var formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'chichi_photos');
           
            fetch('https://api.cloudinary.com/v1_1/u1uilb6f/image/upload', {
                method: 'POST',
                body: formData
            }).then(function(r) { return r.json(); }).then(function(d) {
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
        }).then(function() {
            self.toast('Image sent! 📸', 'success');
        }).catch(function(err) {
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

    updateUnreadBadge: function() {
        var unreadCount = 0;
       
        if (this.unreadMessages) {
            Object.entries(this.unreadMessages).forEach(function([chatKey, data]) {
                if (data && data.count && data.count > 0) {
                    unreadCount += data.count;
                }
            });
        }
       
        console.log('🔄 Badge update: Total unread=' + unreadCount);
       
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

    // ============================================
    // WITHDRAWAL
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
    // CONSENT
    // ============================================

    initConsent: function() {
        var consentGiven = localStorage.getItem('userConsent');
        if (!consentGiven) {
            this.checkUserLocation();
        }
    },

    checkUserLocation: function() {
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

    // ============================================
    // NOTIFICATION PREFERENCES
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
    // GROUPS (Now Earn Page)
    // ============================================

    loadGroups: function() {
        this.renderEarn();
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
        
        this.typingTimeout = setTimeout(function() {
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
        
        db.ref('messages/' + chatKey + '/typing').on('value', function(snapshot) {
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
                    typingIndicator.innerHTML = '<div style="color: #6b7280; font-size: 13px; font-style: italic; padding: 4px 0;">' + names + ' ' + (typingUsers.length === 1 ? 'is' : 'are') + ' typing...</div>';
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
        userTypingRef.on('value', function(snapshot) {
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
                    
                    <button onclick="app.toggleDarkMode()" style="width:100%;padding:14px 16px;border:none;border-bottom:1px solid #f0f0f0;background:none;text-align:left;cursor:pointer;font-size:15px;border-radius:8px;transition:0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='none'">
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
        db.ref('users/' + this.user.uid + '/blocked/' + userId).set(true, function(err) {
            if (err) {
                self.toast('❌ Error blocking user', 'error');
            } else {
                self.toast('✅ User blocked', 'success');
                self.blockedUsers[userId] = true;
                var modal = document.querySelector('.modal-overlay.active');
                if (modal) modal.remove();
                self.closeChatView();
                self.loadMessages();
                self.logUserActivity('block_user', 'Blocked user: ' + userId);
            }
        });
    },

    unblockUser: function(userId) {
        if (!this.user) return;
        
        var self = this;
        db.ref('users/' + this.user.uid + '/blocked/' + userId).remove(function(err) {
            if (err) {
                self.toast('❌ Error unblocking user', 'error');
            } else {
                self.toast('✅ User unblocked', 'success');
                delete self.blockedUsers[userId];
                self.loadMessages();
                self.logUserActivity('unblock_user', 'Unblocked user: ' + userId);
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
        }, function(err) {
            if (err) {
                self.toast('❌ Error submitting report', 'error');
            } else {
                self.toast('✅ Report submitted to admin', 'success');
                self.logUserActivity('report_user', 'Reported user: ' + userName + ' for: ' + reason);
                var modal = document.querySelector('.modal-overlay.active');
                if (modal) modal.remove();
            }
        });
    },

    clearChat: function(userId) {
        if (!confirm('Delete all messages with this user? This cannot be undone.')) return;
        
        var self = this;
        var chatKey = [this.user.uid, userId].sort().join('_');
        
        db.ref('chats/' + chatKey + '/messages').remove(function(err) {
            if (err) {
                self.toast('❌ Error clearing chat', 'error');
            } else {
                self.toast('✅ Chat cleared', 'success');
                self.logUserActivity('clear_chat', 'Cleared chat with user: ' + userId);
                var modal = document.querySelector('.modal-overlay.active');
                if (modal) modal.remove();
                self.closeChatView();
                self.loadMessages();
            }
        });
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

    // ============================================
    // ABOUT US
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
    // MANDATORY HASHTAG SELECTION
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
        self.loadSignupHeatmap();
        self.renderTrendingInExplore();
        self.setupTrendingRefresh();
        self.showHashtagSuggestions();
    },

    // ============================================
    // HEATMAP
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
                zoomAnimation: true,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                dragging: false,
                touchZoom: false,
                boxZoom: false,
                keyboard: false,
                zoomSnap: 0.1
            }).setView([20, 0], 2);
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '',
                subdomains: 'abcd',
                maxZoom: 2,
                minZoom: 2,
                noWrap: true
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
        var self = this;
        var totalUsers = Object.keys(this.users || {}).length;
        var onlineCount = 0;
        var now = new Date().getTime();
        var fiveMinutesAgo = now - (5 * 60 * 1000);
        
        console.log('📊 Updating heatmap stats...');
        console.log('   Total users:', totalUsers);
        
        for (var uid in this.users) {
            var user = this.users[uid];
            if (user) {
                if (user.lastSeen) {
                    var lastSeen = user.lastSeen;
                    if (typeof lastSeen === 'string') {
                        lastSeen = new Date(lastSeen).getTime();
                    }
                    if (lastSeen && lastSeen > fiveMinutesAgo) {
                        onlineCount++;
                    }
                }
            }
        }
        
        console.log('   Online users:', onlineCount);
        
        var totalElement = document.getElementById('totalSignups');
        if (totalElement) {
            this.animateNumber(totalElement, totalUsers);
        }
        
        var onlineElement = document.getElementById('onlineCount');
        if (onlineElement) {
            this.animateNumber(onlineElement, onlineCount);
        }
        
        var growthElement = document.getElementById('signupGrowth');
        if (growthElement) {
            var today = new Date().toDateString();
            var yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            var yesterdayStr = yesterday.toDateString();
            
            var todayCount = 0;
            var yesterdayCount = 0;
            
            for (var uid in this.users) {
                var user = this.users[uid];
                if (user && user.createdAt) {
                    var userDate = new Date(user.createdAt).toDateString();
                    if (userDate === today) {
                        todayCount++;
                    } else if (userDate === yesterdayStr) {
                        yesterdayCount++;
                    }
                }
            }
            
            var growth = 0;
            if (yesterdayCount > 0) {
                growth = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
            } else if (todayCount > 0) {
                growth = 100;
            }
            
            growthElement.textContent = (growth > 0 ? '+' : '') + growth.toFixed(1) + '%';
        }
        
        var rateElement = document.getElementById('liveSignupRate');
        if (rateElement) {
            var today = new Date().toDateString();
            var todayCount = 0;
            for (var uid in this.users) {
                var user = this.users[uid];
                if (user && user.createdAt) {
                    var userDate = new Date(user.createdAt).toDateString();
                    if (userDate === today) {
                        todayCount++;
                    }
                }
            }
            rateElement.textContent = '+' + todayCount;
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
        var dotsContainer = document.getElementById('heatmapDots');
        if (!dotsContainer) return;
        if (!this.users) return;
        
        var usersArray = Object.keys(this.users).map(function(uid) { return { uid: uid, user: this.users[uid] }; }.bind(this));
        
        if (usersArray.length === 0) {
            dotsContainer.innerHTML = '';
            return;
        }
        
        var html = '';
        var totalUsers = usersArray.length;
        var dotSize = Math.min(4 + (totalUsers / 200), 8);
        
        var locations = [
            { lat: -1.286389, lng: 36.817223 },
            { lat: -4.043477, lng: 39.668206 },
            { lat: 0.313611, lng: 32.581111 },
            { lat: -1.9441, lng: 30.0619 },
            { lat: -3.361378, lng: 36.674448 },
            { lat: -0.091702, lng: 34.767956 },
            { lat: -0.2861, lng: 36.0711 },
            { lat: -1.3216, lng: 36.8831 },
            { lat: -0.4667, lng: 35.2833 },
            { lat: 0.0494, lng: 34.7486 },
            { lat: -0.4861, lng: 35.2972 },
            { lat: -2.2698, lng: 37.8020 },
            { lat: -1.4542, lng: 37.8098 },
            { lat: -0.1264, lng: 37.7344 },
            { lat: -1.2860, lng: 36.8140 },
            { lat: -3.3165, lng: 36.4530 },
            { lat: -0.9400, lng: 38.0660 },
            { lat: 0.4700, lng: 34.9700 },
            { lat: 34.052235, lng: -118.243683 },
            { lat: 40.712776, lng: -74.005974 },
            { lat: 51.507351, lng: -0.127758 },
            { lat: 48.856613, lng: 2.352222 },
            { lat: 35.689487, lng: 139.691711 },
            { lat: 37.566535, lng: 126.977969 },
            { lat: -33.868820, lng: 151.209296 },
            { lat: -23.550520, lng: -46.633308 },
            { lat: 19.076090, lng: 72.877426 },
            { lat: 31.230416, lng: 121.473701 },
            { lat: 6.524379, lng: 3.379206 },
            { lat: -26.204103, lng: 28.047305 }
        ];
        
        usersArray.forEach(function(u, index) {
            var loc = locations[index % locations.length];
            var baseLat = loc.lat + (Math.random() - 0.5) * 1.5;
            var baseLng = loc.lng + (Math.random() - 0.5) * 1.5;
            
            var dotColor = 'rgba(0, 136, 204, 0.7)';
            if (u.user && u.user.online) {
                dotColor = 'rgba(0, 212, 170, 0.9)';
            }
            
            var dotStyle = `
                position: absolute;
                width: ${dotSize}px;
                height: ${dotSize}px;
                background: ${dotColor};
                border-radius: 50%;
                left: ${50 + (baseLng / 30)}%;
                top: ${50 - (baseLat / 15)}%;
                box-shadow: 0 0 ${dotSize * 2}px ${dotColor};
                transition: all 0.5s ease;
                animation: pulse 2s infinite;
            `;
            
            html += '<div style="' + dotStyle + '" title="' + (u.user ? u.user.name : 'User') + '"></div>';
        });
        
        dotsContainer.innerHTML = html;
    },

    setupHeatmapListener: function() {
        console.log('🔄 Setting up heatmap listener...');
        
        db.ref('users').on('value', function(snapshot) {
            if (!this.users) this.users = {};
            this.users = {};
            
            snapshot.forEach(function(child) {
                this.users[child.key] = child.val();
            }.bind(this));
            
            console.log('📊 Users updated, re-rendering heatmap...');
            this.updateHeatmapStats();
            this.renderHeatmapDots();
            this.showHashtagSuggestions();
            
            var liveCountElement = document.getElementById('liveAccountCount');
            if (liveCountElement) {
                var totalUsers = Object.keys(this.users).length;
                this.animateNumber(liveCountElement, totalUsers);
            }
            
            var rateElement = document.getElementById('liveSignupRate');
            if (rateElement) {
                var today = new Date().toDateString();
                var todayCount = 0;
                for (var uid in this.users) {
                    var user = this.users[uid];
                    if (user && user.createdAt) {
                        var userDate = new Date(user.createdAt).toDateString();
                        if (userDate === today) {
                            todayCount++;
                        }
                    }
                }
                rateElement.textContent = '+' + todayCount;
            }
        }.bind(this));
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
                            ${match.user.profilePhoto ? '<img src="' + match.user.profilePhoto + '" style="width:100%;height:100%;object-fit:cover;">' : match.user.name.charAt(0).toUpperCase()}
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
    // TRENDING HASHTAGS
    // ============================================

    trendingHashtags: [],

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
        
        this.trendingHashtags.forEach(function(trend, index) {
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
        
        setInterval(function() {
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
       
        items.forEach(function(item) {
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
        
        document.querySelectorAll('.message-filter-tab').forEach(function(tab) {
            tab.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
        
        this.loadMessages();
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
    // RENDER FEED - NO BLUE BORDER ON SUPPORT POSTS
    // ============================================

    renderFeed: function() {
        var feedContainer = document.getElementById('feedContainer');
        if (!feedContainer) return;
       
        if (!this.posts) this.posts = [];
        
        var html = '';
        if (this.posts.length === 0) {
            html = '<div style="text-align: center; color: #6b7280; padding: 40px 16px;">No posts yet. Start creating!</div>';
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
                
                var postHtml = `
                    <div class="post" id="post-${p.id}" style="${isSupportPost ? 'border-radius: 12px;' : ''}">
                        <div class="post-header">
                            <div class="post-user">
                                <div class="post-avatar" style="background-image: url(${p.userPhoto || ''}); cursor: pointer;" onclick="app.viewUserProfile('${p.userId}')">${!p.userPhoto ? p.userName.charAt(0).toUpperCase() : ''}</div>
                                <div>
                                    <div class="post-name" onclick="app.viewUserProfile('${p.userId}')">${p.userName}</div>
                                    <div class="post-time">${p.createdAt}</div>
                                </div>
                            </div>
                            ${isOwnPost ? '<button class="post-menu" onclick="app.deletePost(\'' + p.id + '\')">🗑️</button>' : ''}
                        </div>
                        ${isSupportPost ? '<div style="background: #0088cc; color: white; padding: 4px 12px; font-size: 11px; font-weight: 700; display: inline-block; margin: 8px 16px 0; border-radius: 20px;">🤖 Generated by CHICHI AI</div>' : ''}
                        <img src="${p.photoUrl}" class="post-image" style="${isSupportPost ? 'border-radius: 0;' : ''}">
                        <div class="post-caption">${p.caption}</div>
                        ${isSupportPost ? '<div style="padding: 0 16px 8px; font-size: 11px; color: #0088cc; font-style: italic;">✨ Generated by CHICHI AI • ' + (p.category || 'Support') + '</div>' : ''}
                        <div class="post-stats">${likes} likes · ${downloads} saves · ${comments} comments</div>
                `;
                
                if (!isSupportPost) {
                    postHtml += `
                        <div class="post-actions">
                            <button class="post-action ${userLiked ? 'liked' : ''}" onclick="app.likePost('${p.id}')">
                                ${userLiked ? '❤️ Liked' : '🤍 Like'}
                            </button>
                            <button class="post-action" onclick="app.downloadPost('${p.photoUrl}', '${p.id}')">💾 Save</button>
                            <button class="post-action" onclick="app.viewComments('${p.id}')">💬 Comment</button>
                            <button class="post-action" onclick="app.sharePost('${p.id}', '${p.caption.replace(/'/g, "\\'")}')">📤 Share</button>
                        </div>
                    `;
                } else {
                    postHtml += `
                        <div style="padding: 8px 16px 16px; display: flex; gap: 12px; border-top: 1px solid #eee; margin-top: 4px;">
                            <span style="font-size: 13px; color: #6b7280;">❤️ ${likes} likes</span>
                            <span style="font-size: 13px; color: #6b7280;">💾 ${downloads} saves</span>
                            <span style="font-size: 13px; color: #6b7280;">💬 ${comments} comments</span>
                        </div>
                    `;
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

    deletePost: function(id) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = '<div class="logout-card">\n            <h3>Delete Post?</h3>\n            <p>This cannot be undone</p>\n            <div class="logout-buttons">\n                <button class="logout-cancel" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>\n                <button class="logout-confirm" onclick="app.confirmDeletePost(\'' + id + '\')">Delete</button>\n            </div>\n        </div>';
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
       
        db.ref('posts/' + id).remove().then(function() {
            setTimeout(function() {
                if (post && post.parentNode) {
                    post.remove();
                }
            }, 300);
           
            var modal = document.querySelector('.modal-overlay');
            if (modal) modal.remove();
           
            this.toast('Post deleted', 'success');
            this.logUserActivity('delete_post', 'Deleted post: ' + id);
           
            setTimeout(function() {
                self.loadPosts();
            }, 100);
        }.bind(this)).catch(function(err) {
            if (post) {
                post.style.opacity = '1';
                post.style.transform = 'translateY(0)';
            }
            this.toast('Error deleting post: ' + err.message, 'error');
        }.bind(this));
    },

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
                html = '<div style="text-align: center; color: #6b7280; padding: 20px;">No comments yet</div>';
            } else {
                comments.forEach(function(c) {
                    html += '<div style="background: var(--light); padding: 12px; border-radius: 12px; margin-bottom: 8px;">\n                        <div style="font-weight: 600; font-size: 0.9rem;">' + c.user + '</div>\n                        <div style="font-size: 0.85rem; margin: 4px 0;">' + c.text + '</div>\n                        <div style="font-size: 0.75rem; color: var(--text-light);">' + c.time + '</div>\n                    </div>';
                });
            }

            html += '<div style="border-top: 1px solid var(--border); padding-top: 12px; display: flex; gap: 8px;">\n                <input type="text" id="commentInput" placeholder="Add comment..." style="flex: 1; border: 1px solid var(--border); border-radius: 20px; padding: 10px 12px;">\n                <button onclick="app.submitComment(\'' + id + '\')" style="background: ' + (userCommented ? '#d1d5db' : 'var(--primary)') + '; color: ' + (userCommented ? 'var(--text-light)' : 'white') + '; border: none; border-radius: 20px; padding: 10px 16px; cursor: pointer; font-weight: 600; ' + (userCommented ? 'cursor: not-allowed;' : '') + '">' + (userCommented ? '✓ Earned' : 'Post') + '</button>\n            </div>';

            var modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = '<div class="modal">\n                <div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>\n                <h2 style="font-weight: 700; margin-bottom: 16px;">Comments</h2>\n                <div style="max-height: 400px; overflow-y: auto; margin-bottom: 16px;">' + html + '</div>\n            </div>';
            document.body.appendChild(modal);
        }.bind(this));
    },

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
                    var msgBadge = unreadCount > 0 ? '<span style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);">' + unreadCount + '</span>' : '';
                   
                    var html = '\n                        <div class="profile-header">\n                            <div class="profile-top">\n                                <div class="profile-avatar-large" style="background-image: url(' + (user.profilePhoto || '') + ');">' + (!user.profilePhoto ? user.name.charAt(0).toUpperCase() : '') + '</div>\n                                <div class="profile-info">\n                                    <div class="profile-name">' + (user.name || 'User') + '</div>\n                                    <div class="profile-email">' + user.email + '</div>\n                                    <div class="profile-stats">\n                                        <div class="profile-stat"><div class="profile-stat-value">-</div><div class="profile-stat-label">Posts</div></div>\n                                        <div class="profile-stat"><div class="profile-stat-value">' + (user.followers || 0) + '</div><div class="profile-stat-label">Followers</div></div>\n                                    </div>\n                                </div>\n                            </div>\n                            <div style="display: flex; gap: 8px; margin-top: 12px;">\n                                <button class="follow-btn" onclick="app.toggleFollow(\'' + uid + '\', \'' + user.name + '\')" style="background: ' + (isFollowing ? '#ff4444' : 'var(--primary)') + '; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600; transition: 0.3s; flex: 1;">' + (isFollowing ? '✕ Unfollow' : '✓ Follow') + '</button>\n                                <button class="follow-btn" onclick="app.openChatFromSearch(\'' + uid + '\', \'' + user.name + '\')" style="background: #2E5BFF; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600; transition: 0.3s; flex: 1; position: relative;">\n                                    💬 Message\n                                    ' + msgBadge + '\n                                </button>\n                            </div>\n                        </div>\n                    ';
                   
                    var modal = document.createElement('div');
                    modal.className = 'modal-overlay active';
                    modal.innerHTML = '<div class="modal">\n                        <div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>\n                        ' + html + '\n                    </div>';
                    document.body.appendChild(modal);
                }
            }.bind(this));
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
        } else {
            var anyModal = document.querySelector('.modal-overlay');
            if (anyModal) {
                anyModal.remove();
            }
        }
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
            profileContent.innerHTML = html;
            return;
        }
        
        var userPosts = this.posts.filter(function(p) { return p.userId === this.user.uid; }.bind(this)).length;

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
                    <div class="balance-label">💰 Your Balance</div>
                    <div class="balance-amount" id="balanceDisplay">KSh ${this.balance.toFixed(2)}</div>
                    <button class="btn-withdraw" onclick="app.showWithdrawModal()">Withdraw</button>
                </div>
            </div>
            
            <div style="padding: 16px;">
                <button style="width: 100%; padding: 12px; background: white; border: 1px solid var(--border); border-radius: 12px; color: var(--text); font-weight: 600; cursor: pointer; transition: 0.3s; margin-bottom: 12px;" onclick="app.showNotificationPreferences()">🔔 Notification Settings</button>
                <button style="width: 100%; padding: 12px; background: white; border: 1px solid var(--border); border-radius: 12px; color: var(--text); font-weight: 600; cursor: pointer; transition: 0.3s;" onclick="app.showLogout()">🚪 Logout</button>
            </div>

            <div style="padding: 16px;">My Posts</div>
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
        var profilePosts = document.getElementById('profilePosts');
        if (profilePosts) {
            profilePosts.innerHTML = postsHtml;
        }
    },

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
                    var msgBadge = unreadCount > 0 ? '<span style="position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; background: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);">' + unreadCount + '</span>' : '';
                   
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
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:flex-end;justify-content:center;';
       
        var modal = document.createElement('div');
        modal.style.cssText = 'width:100%;max-width:450px;max-height:85vh;background:white;border-radius:28px 28px 0 0;overflow-y:scroll;overflow-x:hidden;padding:20px;box-sizing:border-box;-webkit-overflow-scrolling:touch;';
       
        modal.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><h2 style="margin: 0; font-weight: 700;">Edit Your Profile</h2><button onclick="this.closest(\'div\').closest(\'div\').parentElement.parentElement.remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button></div>\n           \n            <div style="text-align: center; margin-bottom: 24px;">\n                <div id="editProfilePhotoPreview" style="background-image: url(' + (this.profile.profilePhoto || '') + '); background-size: cover; background-position: center; width: 120px; height: 120px; border-radius: 50%; margin: 0 auto; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: 700; color: white; background-color: var(--primary);" onclick="document.getElementById(\'editProfilePhotoInput\').click()">\n                    ' + (!this.profile.profilePhoto ? this.user.email.charAt(0).toUpperCase() : '') + '\n                    <div style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 3px solid white;">📷</div>\n                </div>\n                <input type="file" id="editProfilePhotoInput" accept="image/*" style="display: none;" onchange="app.previewEditProfilePhoto(event)">\n                <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 8px;">Tap avatar to change photo</div>\n            </div>\n           \n            <div style="margin-bottom: 16px;">\n                <label style="display: block; font-weight: 600; margin-bottom: 8px;">Name</label>\n                <input type="text" id="editProfileName" value="' + (this.profile.name || '') + '" placeholder="Your full name" style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">\n            </div>\n           \n            <div style="margin-bottom: 16px;">\n                <label style="display: block; font-weight: 600; margin-bottom: 8px;">Email</label>\n                <input type="email" id="editProfileEmail" value="' + (this.user.email || '') + '" placeholder="Your email" disabled style="background: #f3f4f6; cursor: not-allowed; width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">\n                <div style="font-size: 0.75rem; color: #999; margin-top: 4px;">Cannot change email</div>\n            </div>\n           \n            <div style="margin-bottom: 24px;">\n                <label style="display: block; font-weight: 600; margin-bottom: 8px;">Bio</label>\n                <textarea id="editProfileBio" placeholder="Tell us about yourself..." style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid #ccc; border-radius: 8px; font-family: inherit; font-size: 1rem; resize: vertical; box-sizing: border-box;">' + (this.profile.bio || '') + '</textarea>\n            </div>\n           \n            <div style="display: flex; gap: 12px; margin-top: 24px;">\n                <button onclick="this.closest(\'div\').closest(\'div\').parentElement.parentElement.remove()" style="flex: 1; padding: 12px; background: #e5e7eb; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">Cancel</button>\n                <button onclick="app.saveProfileChanges()" style="flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">Save Changes</button>\n            </div>\n        ';
       
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
                formData.append('cloud_name', 'u1uilb6f');
               
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
            modal.innerHTML = '<div class="modal" style="max-width: 400px;">\n                <div class="modal-close"><button onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>\n                <img src="' + this.profile.profilePhoto + '" style="width: 100%; border-radius: 16px;">\n            </div>';
            document.body.appendChild(modal);
        } else {
            this.toast('No profile photo yet', 'error');
        }
    },

    loadUsers: function() {
        var self = this;
        console.log('📥 loadUsers() called - Setting up listener on /users');
       
        db.ref('users').on('value', function(s) {
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
                setTimeout(function() {
                    self.trackUnreadMessages();
                }, 100);
            }
           
            if (document.getElementById('exploreView').classList.contains('active')) {
                self.loadExplore();
            }
        }, function(err) {
            console.error('❌ ERROR loading users from Firebase:', err.code, err.message);
        });
    },

    loadFollowing: function() {
        if (!this.user) {
            this.following = {};
            return;
        }
        
        var self = this;
        db.ref('users/' + this.user.uid + '/following').once('value', function(s) {
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
                if (user.name.toLowerCase().includes(searchQuery) || (user.email && user.email.toLowerCase().includes(searchQuery)) || (user.username && user.username.toLowerCase().includes(searchQuery))) {
                    results.push({ uid: uid, user: user });
                }
            }
        }
        
        results.sort(function(a, b) { return (b.user.followers || 0) - (a.user.followers || 0); });
        
        var html = '';
        if (results.length === 0) {
            html = '<div style="text-align: center; color: #999; padding: 20px;">No users found</div>';
        } else {
            results.slice(0, 10).forEach(function(u) {
                var isFollowing = this.following[u.uid] || false;
                var userTags = (u.user.hashtags || []).slice(0, 2);
                var tagsDisplay = userTags.length > 0 ? userTags.join(' ') : 'No interests';
                
                html += `
                    <div class="explore-search-user">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; flex-shrink: 0;">
                            ${u.user.profilePhoto ? '<img src="' + u.user.profilePhoto + '" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">' : u.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 15px;">${u.user.name}</div>
                            <div style="font-size: 12px; color: #2E5BFF;">🏷️ ${tagsDisplay}</div>
                            <div style="font-size: 11px; color: #999;">⭐ ${u.user.followers || 0} followers</div>
                        </div>
                        <button onclick="app.openChatFromSearch('${u.uid}', '${u.user.name}')" style="background: var(--primary); color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Message</button>
                    </div>
                `;
            }.bind(this));
        }
        
        resultsContainer.innerHTML = html;
        resultsSection.style.display = 'block';
    },

    // ============================================
    // LOGOUT FUNCTIONS
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
            db.ref('posts').orderByChild('userId').equalTo(uid).once('value', function(snapshot) {
                var deletePromises = [];
                snapshot.forEach(function(post) {
                    deletePromises.push(db.ref('posts/' + post.key).remove());
                });
                return Promise.all(deletePromises);
            })
        );
       
        deletionPromises.push(
            db.ref('chats').once('value', function(snapshot) {
                var deletePromises = [];
                snapshot.forEach(function(chat) {
                    var chatKey = chat.key;
                    if (chatKey.includes(uid)) {
                        deletePromises.push(db.ref('chats/' + chatKey).remove());
                    }
                });
                return Promise.all(deletePromises);
            })
        );
       
        deletionPromises.push(
            db.ref('stories/' + uid).remove()
        );
       
        deletionPromises.push(
            db.ref('withdrawals').orderByChild('userId').equalTo(uid).once('value', function(snapshot) {
                var deletePromises = [];
                snapshot.forEach(function(withdrawal) {
                    deletePromises.push(db.ref('withdrawals/' + withdrawal.key).remove());
                });
                return Promise.all(deletePromises);
            })
        );
       
        deletionPromises.push(
            db.ref('activityLogs').orderByChild('userId').equalTo(uid).once('value', function(snapshot) {
                var deletePromises = [];
                snapshot.forEach(function(log) {
                    deletePromises.push(db.ref('activityLogs/' + log.key).remove());
                });
                return Promise.all(deletePromises);
            })
        );
       
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
console.log('%c📱 Auto-posts every 10 minutes with unique content (never repeats)', 'color: #0088cc; font-size: 12px;');
console.log('%c🧠 Trivia: KSh 3 per correct answer - 5 second timer!', 'color: #FFC24B; font-size: 12px;');
console.log('%c🛡️ Suspicious activity detection active!', 'color: #ef4444; font-size: 12px;');
console.log('%c👨‍💻 Built by Anthony Onchari - Version V01A.01', 'color: #6b7280; font-size: 11px;');