// Firebase Configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD_tSXJCOLffm4ZMtM8gXOCH5CXFOKdqWM",
    authDomain: "chichi-001.firebaseapp.com",
    databaseURL: "https://chichi-001-default-rtdb.firebaseio.com",
    projectId: "chichi-001",
    storageBucket: "chichi-001.firebasestorage.app",
    messagingSenderId: "219736252899",
    appId: "1:219736252899:web:626efc2fe5040efb7500d6"
};

// Cloudinary Configuration
const CLOUD_NAME = 'u1uilb6f';
const UPLOAD_PRESET = 'chichi_upload';

// App Constants
const APP_NAME = 'CHICHI';
const APP_VERSION = '2.0.0';
const THEME_COLORS = {
    primary: '#2E5BFF',
    secondary: '#FFC24B',
    dark: '#1f2937',
    light: '#f3f4f6',
    text: '#374151',
    textLight: '#9ca3af',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b'
};

// Message Constants
const UNSEND_TIMEOUT = 30000; // 30 seconds
const MAX_POST_HASHTAGS = 5;
const MIN_SIGNUP_HASHTAGS = 3;
const MAX_SIGNUP_HASHTAGS = 5;

// Hashtag Categories
const HASHTAG_CATEGORIES = {
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

// Music Playlist
const MUSIC_PLAYLIST = [
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136987/TONNY_YOUNG_-_MBECA_vmjeox.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136983/KAMOKO_raa8k0.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136983/ROSELLA_kixo9g.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136979/Lord_Paper_fpcq1s.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136978/DOGGIE_IN_THE_WINDOW_senpyj.mp4',
    'https://res.cloudinary.com/u1uilb6f/video/upload/v1784136978/Rudimental_dneqjb.mp4'
];

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FIREBASE_CONFIG,
        CLOUD_NAME,
        UPLOAD_PRESET,
        APP_NAME,
        APP_VERSION,
        THEME_COLORS,
        UNSEND_TIMEOUT,
        MAX_POST_HASHTAGS,
        MIN_SIGNUP_HASHTAGS,
        MAX_SIGNUP_HASHTAGS,
        HASHTAG_CATEGORIES,
        MUSIC_PLAYLIST
    };
}
