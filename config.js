// ============================================
// CHICHI - COMPLETE CONFIGURATION FILE
// ============================================

// ============================================
// FIREBASE CONFIGURATION
// ============================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD_tSXJCOLffm4ZMtM8gXOCH5CXFOKdqWM",
    authDomain: "chichi-001.firebaseapp.com",
    projectId: "chichi-001",
    storageBucket: "chichi-001.firebasestorage.app",
    messagingSenderId: "219736252899",
    appId: "1:219736252899:web:626efc2fe5040efb7500d6",
    databaseURL: "https://chichi-001-default-rtdb.firebaseio.com"
};

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================

const CLOUD_NAME = 'u1uilb6f';
const UPLOAD_PRESET = 'chichi_photos';

// ============================================
// ADMIN CONFIGURATION
// ============================================

const ADMIN_PASSWORD = 'CHICHI26303@Admin';
const MPESA_TILL = '8941840';

// ============================================
// MUSIC PLAYLIST
// ============================================

const MUSIC_PLAYLIST = [
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136978/Rudimental_dneqjb.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136987/TONNY_YOUNG_-_MBECA_vmjeox.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136983/KAMOKO_raa8k0.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136983/ROSELLA_kixo9g.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136979/Lord_Paper_fpcq1s.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136978/DOGGIE_IN_THE_WINDOW_senpyj.mp4'
];

// ============================================
// SPINNER CONFIGURATION
// ============================================

const SPINNER_CONFIG = {
    spinCost: 5,
    maxWin: 500,
    minWin: 1,
    segments: [
        { value: 0, label: 'Loss', weight: 30, color: '#ef4444' },
        { value: 20, label: 'KSh 20', weight: 20, color: '#f59e0b' },
        { value: 50, label: 'KSh 50', weight: 18, color: '#22c55e' },
        { value: 100, label: 'KSh 100', weight: 16, color: '#3b82f6' },
        { value: 200, label: 'KSh 200', weight: 12, color: '#8b5cf6' },
        { value: 500, label: 'KSh 500', weight: 4, color: '#ec4899' }
    ]
};

// ============================================
// EARNING SETTINGS - TIER CONFIGURATION
// ============================================

const EARNING_SETTINGS = {
    free: {
        label: 'Free',
        badge: '✨',
        badgeColor: '#6b7280',
        price: 0,
        dailyQuestions: 5,
        rewardPerQuestion: 0.50,
        timerSeconds: 20,
        adsPerQuestion: 0,
        maxQuestions: 5,
        bonus: '5 trivia questions/day'
    },
    premium: {
        label: '⭐ Premium',
        badge: '⭐',
        badgeColor: '#f59e0b',
        price: 50,
        dailyQuestions: 15,
        rewardPerQuestion: 10.50,
        timerSeconds: 30,
        adsPerQuestion: 0,
        maxQuestions: 15,
        bonus: 'No ads + 5 extra questions/day'
    },
    vip: {
        label: '👑 VIP',
        badge: '👑',
        badgeColor: '#8b5cf6',
        price: 100,
        dailyQuestions: 150,
        rewardPerQuestion: 20.50,
        timerSeconds: 45,
        adsPerQuestion: 0,
        maxQuestions: 150,
        bonus: 'No ads + 15 extra questions/day + Exclusive content'
    }
};

// ============================================
// TRIVIA QUESTIONS (49 Kenya-focused questions)
// ============================================

const TRIVIA_QUESTIONS = [
    { question: "What is the capital of Kenya?", options: ["Nairobi", "Mombasa", "Kisumu", "Nakuru"], correct: 0 },
    { question: "Which is Africa's largest economy?", options: ["South Africa", "Nigeria", "Egypt", "Kenya"], correct: 1 },
    { question: "How many ethnic groups are there in Kenya?", options: ["42", "35", "50", "28"], correct: 0 },
    { question: "What is Kenya's currency?", options: ["Kenyan Shilling", "Tanzanian Shilling", "Ugandan Shilling", "East African Pound"], correct: 0 },
    { question: "Which lake is shared by Kenya, Uganda, and Tanzania?", options: ["Lake Victoria", "Lake Tanganyika", "Lake Malawi", "Lake Turkana"], correct: 0 },
    { question: "What is the largest national park in Kenya?", options: ["Tsavo East", "Amboseli", "Maasai Mara", "Lake Nakuru"], correct: 0 },
    { question: "Which mountain is the second highest in Africa?", options: ["Mount Kilimanjaro", "Mount Kenya", "Mount Elgon", "Mount Speke"], correct: 1 },
    { question: "What year did Kenya gain independence?", options: ["1960", "1963", "1965", "1961"], correct: 1 },
    { question: "Which is the oldest university in Kenya?", options: ["University of Nairobi", "Kenyatta University", "JKUAT", "Moi University"], correct: 0 },
    { question: "How many counties does Kenya have?", options: ["41", "42", "47", "50"], correct: 2 },
    { question: "What is the main export of Kenya?", options: ["Coffee", "Tea", "Flowers", "Oil"], correct: 2 },
    { question: "Which president is known for ending colonial rule in Kenya?", options: ["Daniel arap Moi", "Jomo Kenyatta", "Uhuru Kenyatta", "Raila Odinga"], correct: 1 },
    { question: "What is Kenya's official language?", options: ["Swahili", "English", "Kikuyu", "Both Swahili and English"], correct: 3 },
    { question: "Which wildlife reserve is famous for the wildebeest migration?", options: ["Amboseli", "Maasai Mara", "Tsavo", "Samburu"], correct: 1 },
    { question: "How many species of animals are found in the Maasai Mara?", options: ["Over 1000", "Over 500", "Over 1500", "Over 2000"], correct: 2 },
    { question: "What is the Great Rift Valley known for?", options: ["Geological formation", "Wildlife", "Agriculture", "Mining"], correct: 0 },
    { question: "Which Kenyan athlete won Olympic gold in running?", options: ["Julius Yego", "David Rudisha", "Faith Kipchoge", "Kipchoge Keino"], correct: 3 },
    { question: "What is the largest desert in Kenya?", options: ["Chalbi Desert", "Shai Hills", "Simpson Desert", "Tana River Desert"], correct: 0 },
    { question: "How many national parks are there in Kenya?", options: ["7", "9", "11", "15"], correct: 2 },
    { question: "Which city is known as 'Silicon Savanna'?", options: ["Mombasa", "Nairobi", "Kisumu", "Nakuru"], correct: 1 },
    { question: "What is the largest forest in Kenya?", options: ["Mau Forest", "Arabuko Sokoke", "Kakamega Forest", "Mount Kenya Forest"], correct: 0 },
    { question: "Which island is a UNESCO World Heritage Site in Kenya?", options: ["Lamu", "Pemba", "Unguja", "Mafia"], correct: 0 },
    { question: "What percentage of Kenya's land is arable?", options: ["15%", "25%", "35%", "45%"], correct: 1 },
    { question: "Which Kenyan river is the longest?", options: ["Tana River", "Athi River", "Ewaso Nyiro", "Turkwel River"], correct: 0 },
    { question: "What is the Kenyan national bird?", options: ["Fish Eagle", "Crowned Eagle", "Secretary Bird", "Marabou Stork"], correct: 0 },
    { question: "How many languages are spoken in Kenya?", options: ["Over 40", "Over 60", "Over 80", "Over 100"], correct: 2 },
    { question: "What is M-Pesa?", options: ["A bank", "A mobile money service", "A restaurant chain", "A car brand"], correct: 1 },
    { question: "Which Kenyan company pioneered mobile money?", options: ["Safaricom", "Airtel", "Equity Bank", "Cooperative Bank"], correct: 0 },
    { question: "What is the population of Kenya (approximately)?", options: ["30 million", "40 million", "50 million", "60 million"], correct: 1 },
    { question: "Which is the only capital city with a national park?", options: ["Nairobi", "Mombasa", "Nairobi", "Dar es Salaam"], correct: 0 },
    { question: "What is Kenya's GDP per capita (approximately)?", options: ["$800", "$1200", "$1800", "$2500"], correct: 2 },
    { question: "Which ethnic group is the largest in Kenya?", options: ["Kikuyu", "Luhya", "Kalenjin", "Luo"], correct: 0 },
    { question: "What year was the Mombasa Port established?", options: ["1200s", "1400s", "1600s", "1800s"], correct: 0 },
    { question: "Which university has the largest enrollment in Kenya?", options: ["University of Nairobi", "Kenyatta University", "JKUAT", "Mount Kenya University"], correct: 1 },
    { question: "What is the highest point in Kenya?", options: ["Peak 1", "Batian", "Point Lenana", "Both 2 and 3"], correct: 3 },
    { question: "How much of Kenya is covered by forest?", options: ["5%", "7%", "10%", "15%"], correct: 1 },
    { question: "Which sector employs the most people in Kenya?", options: ["Agriculture", "Manufacturing", "Services", "Mining"], correct: 0 },
    { question: "What is the main religion in Kenya?", options: ["Christianity", "Islam", "Hinduism", "Buddhism"], correct: 0 },
    { question: "How many Olympic medals has Kenya won?", options: ["Over 50", "Over 80", "Over 120", "Over 150"], correct: 2 },
    { question: "What is Kenya known for producing (besides coffee)?", options: ["Tea", "Flowers", "Macadamia nuts", "All of the above"], correct: 3 },
    { question: "Which national reserve is home to the Big Five?", options: ["Amboseli", "Samburu", "Maasai Mara", "Tsavo East"], correct: 2 },
    { question: "What is the Mara River crossing known as?", options: ["River Jump", "Great Migration", "Wildlife Crossing", "Predator's Path"], correct: 1 },
    { question: "How many rhinos are left in Kenya?", options: ["Around 500", "Around 1000", "Around 1500", "Around 2000"], correct: 1 },
    { question: "What is Lake Turkana also known as?", options: ["Jade Sea", "Emerald Lake", "Sapphire Sea", "Ruby Lake"], correct: 0 },
    { question: "Which Kenyan city is known for its tourism industry?", options: ["Nairobi", "Mombasa", "Kisumu", "Nakuru"], correct: 1 },
    { question: "What percentage of Kenya is national parks and reserves?", options: ["5%", "8%", "12%", "15%"], correct: 2 },
    { question: "Which is the oldest capital city of Kenya?", options: ["Nairobi", "Mombasa", "Fort Hall", "Kisumu"], correct: 1 },
    { question: "What is the Kenyan national dance called?", options: ["Adumu", "Benga", "Taarab", "Mbalax"], correct: 0 },
    { question: "How many UNESCO World Heritage Sites does Kenya have?", options: ["3", "5", "7", "9"], correct: 1 }
];

// ============================================
// AUTO-POST TEMPLATES (Support Account)
// ============================================

const POST_TEMPLATES = [
    { text: "I told my boss I needed a raise because I'm the best worker here. He said 'You're also the only worker here.' I got the raise.", category: "Funny", imageKeyword: "happy person laughing portrait" },
    { text: "My phone has more storage than my brain. I can remember 1000 songs but not what I ate for breakfast.", category: "Funny", imageKeyword: "confused person thinking" },
    { text: "The best part about working from home is that my commute is 10 seconds. The worst part? My boss is always in my kitchen.", category: "Funny", imageKeyword: "person working on laptop smiling" },
    { text: "I asked Google 'Why am I so tired?' It said 'Because you're always on your phone at 2 AM.'", category: "Funny", imageKeyword: "tired person in bed with phone" },
    { text: "My dog thinks I'm a superhero. He gets excited every time I come home from the bathroom.", category: "Funny", imageKeyword: "person with dog happy" },
    { text: "I'm not saying I'm old, but my back goes out more than I do.", category: "Funny", imageKeyword: "elderly person smiling" },
    { text: "Your greatest strength is your ability to keep going when others give up. Keep pushing.", category: "Inspiration", imageKeyword: "determined person sunrise" },
    { text: "The only person you should try to be better than is the person you were yesterday.", category: "Inspiration", imageKeyword: "person looking forward determined" },
    { text: "Success is not about how many times you fall, but how many times you get back up.", category: "Inspiration", imageKeyword: "person getting up determined" },
    { text: "Every morning is a new beginning. Make it count.", category: "Inspiration", imageKeyword: "person morning coffee smiling" },
    { text: "Kenya's economy grew by 5.6% in 2023. The tech sector is leading the growth.", category: "Kenya News", imageKeyword: "Kenyan person in tech office" },
    { text: "The Maasai Mara is considered the 7th wonder of the world. Over 1.5 million wildebeest migrate annually.", category: "Kenya News", imageKeyword: "Maasai person smiling" },
    { text: "Kenyan youth are leading Africa's tech revolution. Over 200 startups launched this year.", category: "Kenya News", imageKeyword: "Kenyan youth coding smiling" },
    { text: "AI is revolutionizing healthcare. New algorithms can detect diseases earlier than doctors.", category: "Tech", imageKeyword: "doctor with AI technology" },
    { text: "Your smartphone is more powerful than the computers that sent humans to the moon.", category: "Tech", imageKeyword: "person amazed by phone" },
    { text: "A 10-minute daily meditation can reduce stress by 30%. Try it today.", category: "Wellness", imageKeyword: "person meditating peaceful" },
    { text: "Walking 30 minutes a day can add 3 years to your life. It's that simple.", category: "Wellness", imageKeyword: "person walking happy smiling" },
    { text: "Pizza was invented in Naples, Italy in the 1700s. Before that, it was called 'focaccia'.", category: "Food", imageKeyword: "delicious pizza close up" },
    { text: "Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that was still edible.", category: "Food", imageKeyword: "honey in bowl golden" },
    { text: "Traveling to a new place changes your perspective and creativity. Adventure awaits!", category: "Travel", imageKeyword: "person on beach with sunset" },
    { text: "The Great Wall of China is visible from space. It's one of humanity's greatest achievements.", category: "Travel", imageKeyword: "person at great wall excited" },
    { text: "A group of flamingos is called a 'flamboyance'. Nature has the best names!", category: "Fun Facts", imageKeyword: "flamingos in water pink" },
    { text: "Octopuses have three hearts. Two pump blood to the gills, and one pumps it to the rest of the body.", category: "Fun Facts", imageKeyword: "octopus underwater fascinating" },
    { text: "Real love isn't just about attraction, it's about growing together and supporting each other's dreams.", category: "Relationships", imageKeyword: "couple holding hands sunset" },
    { text: "The best relationships are built on trust, honesty, and genuine laughter together.", category: "Relationships", imageKeyword: "couple laughing together happy" }
];

// ============================================
// FIREBASE INITIALIZATION
// ============================================

if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    console.log('✅ Firebase initialized');
} else {
    console.log('⚠️ Firebase already initialized');
}

var auth = firebase.auth();
var db = firebase.database();

// Check Firebase connection
db.ref('.info/connected').on('value', function(snapshot) {
    if (snapshot.val() === true) {
        console.log('🌐 Connected to Firebase');
    } else {
        console.log('📡 Disconnected from Firebase');
    }
});

// Loading screen timeout
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

console.log('✅ Configuration loaded successfully');