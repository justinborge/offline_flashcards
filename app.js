// --- DOM ELEMENTS ---
const setupScreen = document.getElementById('setup-screen');
const mainApp = document.getElementById('main-app');
const recentDecksContainer = document.getElementById('recent-decks-container');
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
// --- RECENT DECKS LOGIC ---
function getRecentDecks() {
    return JSON.parse(localStorage.getItem('recentDecks')) || [];
}

function saveRecentDeck(name, url) {
    let decks = getRecentDecks();
    // Remove any existing entry with the same URL to avoid duplicates
    decks = decks.filter(deck => deck.url !== url);
    // Add the new deck to the front of the array
    decks.unshift({ name, url });
    // Keep only the 5 most recent decks
    decks = decks.slice(0, 5);
    localStorage.setItem('recentDecks', JSON.stringify(decks));
}

function renderRecentDecks() {
    const decks = getRecentDecks();
    if (decks.length > 0) {
        let html = '<h3>Recent Decks</h3><ol class="recent-decks-list">';
        decks.forEach(deck => {
            // Use data-url attribute to store the URL safely
            html += `<li><a href="#" data-url="${deck.url}">${deck.name}</a></li>`;
        });
        html += '</ol>';
        recentDecksContainer.innerHTML = html;
    } else {
        recentDecksContainer.innerHTML = ''; // Clear if no decks
    }
}

// --- URL TRANSFORMATION ---
function transformGoogleSheetUrl(url) {
    const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }
    // If it doesn't match, maybe it's already a correct export URL.
    return url;
}
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
async function loadCardData(url, deckName = null) {
    cardFrontText.textContent = "Loading...";
    restartLessonButton.style.display = 'none';
    
    // Transform the user-friendly URL to a direct CSV link
    const csvUrl = transformGoogleSheetUrl(url);

    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        // 1. Load cards into our permanent fullDeck
        fullDeck = csvText.split('\n').slice(1).map(row => {
            const columns = row.split(',');
            if (columns.length >= 2) {
                return { portuguese: columns[0].trim(), english: columns[1].trim() };
            }
            return null; // Handle potentially empty rows
        }).filter(card => card && card.portuguese && card.english);

        if (fullDeck.length === 0) throw new Error("No cards found in the sheet.");

        // 2. Save the deck to our recent list
        let nameToSave = deckName;
        if (!nameToSave) {
            // If it's a new deck, ask the user for a name
            nameToSave = prompt("What would you like to name this deck?", "My Portuguese Deck");
        }
        // Only save if the user provides a name
        if (nameToSave) {
            saveRecentDeck(nameToSave, url); // Save the original share URL, not the csv one
        }

        // 3. Start the lesson
        startLesson(); 
    } catch (error) {
        console.error('Error loading card data:', error);
        alert("Could not load cards. Please check the URL and share settings.");
        showSetupScreen();
    }
}

// --- INITIALIZATION & EVENT LISTENERS ---
function init() {
    renderRecentDecks(); // Render the list of recent decks
    const savedUrl = localStorage.getItem('spreadsheetUrl');
    if (savedUrl) {
        // We find the deck in our recent list to get its name
        const recentDecks = getRecentDecks();
        const savedDeck = recentDecks.find(deck => deck.url === savedUrl);
        loadCardData(savedUrl, savedDeck ? savedDeck.name : null);
    } else {
        showSetupScreen();
    }
}

loadDeckButton.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
        localStorage.setItem('spreadsheetUrl', url);
        loadCardData(url); // The function will now handle prompting for a name
        urlInput.value = ''; // Clear the input field
    }
});

// UPDATED: Change deck logic no longer reloads the page
changeDeckButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to change decks? This will clear your current deck.")) {
        localStorage.removeItem('spreadsheetUrl');
        urlInput.value = '';
        renderRecentDecks(); // Re-render decks when going back to setup
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

// NEW: Event listener for the recent decks list
recentDecksContainer.addEventListener('click', (event) => {
    // Check if a link inside the container was clicked
    if (event.target.tagName === 'A') {
        event.preventDefault(); // Prevent the link from navigating
        const url = event.target.dataset.url;
        const name = event.target.textContent;
        if (url) {
            localStorage.setItem('spreadsheetUrl', url);
            loadCardData(url, name);
        }
    }
});

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

// --- START THE APP ---
init();
