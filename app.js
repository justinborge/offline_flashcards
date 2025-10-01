// --- DOM ELEMENTS ---
const setupScreen = document.getElementById('setup-screen');
const mainApp = document.getElementById('main-app');
const urlInput = document.getElementById('sheet-url-input');
const loadDeckButton = document.getElementById('load-deck-button');
const changeDeckButton = document.getElementById('change-deck-button');

const cardContainer = document.getElementById('card-container');
const flashcard = document.getElementById('flashcard');
const cardFrontText = document.getElementById('card-front-text');
const cardBackText = document.getElementById('card-back-text');
const didNotKnowButton = document.getElementById('did-not-know-button');
const knewItButton = document.getElementById('knew-it-button');
// New restart button element
const restartLessonButton = document.getElementById('restart-lesson-button');


// --- APP STATE ---
// fullDeck holds the master copy of all cards for the current lesson
let fullDeck = [];
// sessionDeck holds the cards for the current study session
let sessionDeck = [];
let currentCard = null;

// --- FUNCTIONS ---
function showMainApp() {
    setupScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    mainApp.style.flexDirection = 'column';
    mainApp.style.alignItems = 'center';

    // FIX: Ensure the answer buttons are visible when starting/restarting a deck
    didNotKnowButton.style.display = '';
    knewItButton.style.display = '';
}

function showSetupScreen() {
    mainApp.style.display = 'none';
    setupScreen.style.display = 'flex';
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function displayCard(card) {
    currentCard = card;
    cardFrontText.textContent = card.portuguese;
    cardBackText.textContent = card.english;
    flashcard.classList.remove('is-flipped');
}

function showNextCard() {
    cardContainer.classList.add('hiding');
    setTimeout(() => {
        if (sessionDeck.length > 0) {
            const nextCard = sessionDeck.shift();
            displayCard(nextCard);
        } else {
            // End of lesson logic
            currentCard = null;
            cardFrontText.textContent = "Parabéns! 🎉";
            cardBackText.textContent = "You've learned all the cards!";
            didNotKnowButton.style.display = 'none';
            knewItButton.style.display = 'none';
            restartLessonButton.style.display = 'block'; // Show the restart button
        }
        cardContainer.classList.remove('hiding');
    }, 200);
}

function handleAnswer(knewIt) {
    if (!currentCard) return;
    if (!knewIt) {
        sessionDeck.push(currentCard);
    }
    showNextCard();
}

// NEW: Reusable function to start or restart a lesson
function startLesson() {
    // Copy the full deck into the session deck to work with
    sessionDeck = [...fullDeck];
    shuffleArray(sessionDeck);

    // Make sure the UI is in the correct state for starting
    restartLessonButton.style.display = 'none';
    showMainApp(); // This also ensures the answer buttons are visible

    // Show the first card
    showNextCard();
}

// UPDATED: Now uses fullDeck and the startLesson function
async function loadCardData(url) {
    cardFrontText.textContent = "Loading...";
    restartLessonButton.style.display = 'none';
    try {
        const response = await fetch(url);
        const csvText = await response.text();
        
        // 1. Load cards into our permanent fullDeck
        fullDeck = csvText.split('\n').slice(1).map(row => {
            const columns = row.split(',');
            return { portuguese: columns[0].trim(), english: columns[1].trim() };
        }).filter(card => card.portuguese && card.english);

        if (fullDeck.length === 0) throw new Error("No cards found in the sheet.");

        // 2. Start the lesson for the first time
        startLesson(); 
    } catch (error) {
        console.error('Error loading card data:', error);
        alert("Could not load cards. Please check the URL and make sure it's a published CSV.");
        showSetupScreen();
    }
}

// --- INITIALIZATION & EVENT LISTENERS ---
function init() {
    const savedUrl = localStorage.getItem('spreadsheetUrl');
    if (savedUrl) {
        loadCardData(savedUrl);
    } else {
        showSetupScreen();
    }
}

loadDeckButton.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
        localStorage.setItem('spreadsheetUrl', url);
        loadCardData(url);
    }
});

// UPDATED: Change deck logic no longer reloads the page
changeDeckButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to change decks? This will clear your current deck.")) {
        localStorage.removeItem('spreadsheetUrl');
        urlInput.value = '';
        showSetupScreen();
    }
});

flashcard.addEventListener('click', () => {
    if (currentCard) {
        flashcard.classList.toggle('is-flipped');
    }
});

didNotKnowButton.addEventListener('click', () => handleAnswer(false));
knewItButton.addEventListener('click', () => handleAnswer(true));
// NEW: Event listener for the restart button
restartLessonButton.addEventListener('click', startLesson);

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

// --- START THE APP ---
init();
