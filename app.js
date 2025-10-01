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

// --- TUTORIAL MODAL ELEMENTS ---
const tutorialLink = document.getElementById('tutorial-link');
const tutorialModal = document.getElementById('tutorial-modal');
const modalCloseButton = document.querySelector('.modal-close-button');
const tutorialImage = document.getElementById('tutorial-image');
const prevArrow = document.querySelector('.modal-arrow.prev');
const nextArrow = document.querySelector('.modal-arrow.next');
const slideCounter = document.getElementById('slide-counter');


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
    // First, try to find a URL that includes a specific tab ID ('gid')
    let match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+).*[#&?]gid=([0-9]+)/);

    if (match && match[1] && match[2]) {
        const spreadsheetId = match[1];
        const gid = match[2];
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    }

    // If no specific tab ID is found, fall back to the original logic (gets the first sheet)
    match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        const spreadsheetId = match[1];
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    }

    // If it's not a recognizable Google Sheet URL, return it as is.
    return url;
}
// sessionDeck holds the cards for the current study session
let sessionDeck = [];
let currentCard = null;

// --- TUTORIAL STATE ---
const tutorialImages = [
    'assets/tutorial-1.png',
    'assets/tutorial-2.png',
    'assets/tutorial-3.png',
    'assets/tutorial-4.png',
    'assets/tutorial-5.png',
    'assets/tutorial-6.png'
];
let currentSlideIndex = 0;

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

async function loadCardData(url, deckName = null) {
    cardFrontText.textContent = "Loading...";
    restartLessonButton.style.display = 'none';

    // Transform the user-friendly URL to a direct CSV link
    const csvUrl = transformGoogleSheetUrl(url);

    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        const rows = csvText.trim().split('\n');

        // --- NEW: More Robust Header Detection ---
        let dataRows = rows; // Assume there is no header by default
        if (rows.length > 0) {
            // Function to remove accents/diacritics for easier matching
            const normalizeText = (text) => {
                return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            };
            
            const firstRow = normalizeText(rows[0]);

            // Expanded list of keywords in English and Portuguese
            const headerKeywords = [
                'english', 'portugues', // Note: 'português' will become 'portugues'
                'front', 'frente',
                'back', 'verso',
                'term', 'palavra',
                'definition', 'traducao' // 'tradução' will become 'traducao'
            ];

            // Check if the normalized first row contains any common header words
            const hasHeader = headerKeywords.some(keyword => firstRow.includes(keyword));
            
            if (hasHeader) {
                console.log("Header detected, skipping first row.");
                dataRows = rows.slice(1); // If header is found, skip the first row
            } else {
                console.log("No header detected, including all rows.");
            }
        }
        // --- END: More Robust Header Detection ---

        // 1. Load cards into our permanent fullDeck using the potentially sliced dataRows
        fullDeck = dataRows.map(row => {
            const columns = row.split(',');
            if (columns.length >= 2) {
                const portuguese = columns[0].trim().replace(/^"|"$/g, '');
                const english = columns[1].trim().replace(/^"|"$/g, '');
                return { portuguese, english };
            }
            return null; // Handle potentially empty rows
        }).filter(card => card && card.portuguese && card.english);


        if (fullDeck.length === 0) throw new Error("No cards found in the sheet.");

        // 2. Save the deck to our recent list
        let nameToSave = deckName;
        if (!nameToSave) {
            nameToSave = prompt("What would you like to name this deck?", "My Portuguese Deck");
        }
        if (nameToSave) {
            saveRecentDeck(nameToSave, url);
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

// --- TUTORIAL MODAL LOGIC ---
function showSlide(index) {
    if (index >= tutorialImages.length) {
        currentSlideIndex = 0;
    } else if (index < 0) {
        currentSlideIndex = tutorialImages.length - 1;
    } else {
        currentSlideIndex = index;
    }
    tutorialImage.src = tutorialImages[currentSlideIndex];
    slideCounter.textContent = `${currentSlideIndex + 1} / ${tutorialImages.length}`;
}

function changeSlide(direction) {
    showSlide(currentSlideIndex + direction);
}

function openTutorial() {
    showSlide(0); // Start at the first slide
    tutorialModal.style.display = 'flex';
}

function closeTutorial() {
    tutorialModal.style.display = 'none';
}

tutorialLink.addEventListener('click', openTutorial);
modalCloseButton.addEventListener('click', closeTutorial);
prevArrow.addEventListener('click', () => changeSlide(-1));
nextArrow.addEventListener('click', () => changeSlide(1));

// Close modal if user clicks on the dark background overlay
tutorialModal.addEventListener('click', (event) => {
    if (event.target === tutorialModal) {
        closeTutorial();
    }
});

// Add keyboard navigation (left/right arrows)
document.addEventListener('keydown', (event) => {
    if (tutorialModal.style.display === 'flex') {
        if (event.key === 'ArrowLeft') {
            changeSlide(-1);
        } else if (event.key === 'ArrowRight') {
            changeSlide(1);
        } else if (event.key === 'Escape') {
            closeTutorial();
        }
    }
});

// Swipe functionality for mobile
let touchStartX = 0;
let touchEndX = 0;

tutorialModal.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
}, { passive: true });

tutorialModal.addEventListener('touchend', (event) => {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50; // Minimum distance for a swipe
    if (touchEndX < touchStartX - swipeThreshold) {
        // Swiped left
        changeSlide(1);
    }
    if (touchEndX > touchStartX + swipeThreshold) {
        // Swiped right
        changeSlide(-1);
    }
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

// --- START THE APP ---
init();
