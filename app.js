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
const restartLessonButton = document.getElementById('restart-lesson-button');

// New three-button system elements
const hardButton = document.getElementById('hard-button');
const mediumButton = document.getElementById('medium-button');
const easyButton = document.getElementById('easy-button');

// --- TUTORIAL MODAL ELEMENTS ---
const tutorialLink = document.getElementById('tutorial-link');
const tutorialModal = document.getElementById('tutorial-modal');
const modalCloseButton = document.querySelector('.modal-close-button');
const tutorialImage = document.getElementById('tutorial-image');
const prevArrow = document.querySelector('.modal-arrow.prev');
const nextArrow = document.querySelector('.modal-arrow.next');
const slideCounter = document.getElementById('slide-counter');


// --- APP STATE ---
let fullDeck = [];
let sessionDeck = [];
let currentCard = null;

// --- RECENT DECKS LOGIC ---
function getRecentDecks() {
    return JSON.parse(localStorage.getItem('recentDecks')) || [];
}

function saveRecentDeck(name, url) {
    let decks = getRecentDecks();
    decks = decks.filter(deck => deck.url !== url);
    decks.unshift({ name, url });
    decks = decks.slice(0, 5);
    localStorage.setItem('recentDecks', JSON.stringify(decks));
}

function renderRecentDecks() {
    const decks = getRecentDecks();
    if (decks.length > 0) {
        let html = '<h3>Recent Decks</h3><ol class="recent-decks-list">';
        decks.forEach(deck => {
            html += `<li><a href="#" data-url="${deck.url}">${deck.name}</a><button class="delete-deck-btn" data-url="${deck.url}" title="Remove this deck">&times;</button></li>`;
        });
        html += '</ol>';
        recentDecksContainer.innerHTML = html;
    } else {
        recentDecksContainer.innerHTML = '';
    }
}

function deleteRecentDeck(urlToDelete) {
    let decks = getRecentDecks();
    decks = decks.filter(deck => deck.url !== urlToDelete);
    localStorage.setItem('recentDecks', JSON.stringify(decks));
    renderRecentDecks();
}

// --- URL TRANSFORMATION ---
function transformGoogleSheetUrl(url) {
    let match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+).*[#&?]gid=([0-9]+)/);

    if (match && match[1] && match[2]) {
        const spreadsheetId = match[1];
        const gid = match[2];
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=tsv&gid=${gid}`;
    }

    match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        const spreadsheetId = match[1];
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=tsv`;
    }

    return url;
}

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
    hardButton.style.display = '';
    mediumButton.style.display = '';
    easyButton.style.display = '';
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
    cardFrontText.textContent = card.english;
    cardBackText.textContent = card.portuguese;
    flashcard.classList.remove('is-flipped');
}

function showNextCard() {
    cardContainer.classList.add('hiding');
    setTimeout(() => {
        if (sessionDeck.length > 0) {
            const nextCard = sessionDeck.shift();
            displayCard(nextCard);
        } else {
            currentCard = null;
            cardFrontText.textContent = "Parabéns! 🎉";
            cardBackText.textContent = "You've learned all the cards!";
            hardButton.style.display = 'none';
            mediumButton.style.display = 'none';
            easyButton.style.display = 'none';
            restartLessonButton.style.display = 'block';
        }
        cardContainer.classList.remove('hiding');
    }, 200);
}

// Updated answer logic with "swipe away" animation
function handleAnswer(level) {
    if (!currentCard) return;

    if (level === 'easy') {
        // 1. Add the CSS class to trigger the swipe animation
        cardContainer.classList.add('swiped-away');
        
        // 2. Wait for the animation to finish (300ms) before showing the next card
        setTimeout(() => {
            // 3. Clean up the class so the next card appears normally
            cardContainer.classList.remove('swiped-away');
            showNextCard();
        }, 300); // This duration MUST match the animation duration in the CSS
    } else {
        // For "medium" and "hard", the logic is the same as before
        if (level === 'medium') {
            sessionDeck.push(currentCard);
        } else if (level === 'hard') {
            const insertIndex = Math.min(sessionDeck.length, 3);
            sessionDeck.splice(insertIndex, 0, currentCard);
        }
        // Use the default fade-out transition for these buttons
        showNextCard();
    }
}


function startLesson() {
    sessionDeck = [...fullDeck];
    shuffleArray(sessionDeck);
    restartLessonButton.style.display = 'none';
    showMainApp();
    showNextCard();
}

async function loadCardData(url, deckName = null) {
    cardFrontText.textContent = "Loading...";
    restartLessonButton.style.display = 'none';

    const tsvUrl = transformGoogleSheetUrl(url);

    try {
        const response = await fetch(tsvUrl);
        const tsvText = await response.text();
        const rows = tsvText.trim().split('\n');

        let dataRows = rows;
        if (rows.length > 0) {
            const normalizeText = (text) => {
                return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            };
            const firstRow = normalizeText(rows[0]);
            const headerKeywords = ['english', 'portugues', 'french', 'front', 'frente', 'back', 'verso', 'term', 'palavra', 'definition', 'traducao'];
            const hasHeader = headerKeywords.some(keyword => firstRow.includes(keyword));
            
            if (hasHeader) {
                console.log("Header detected, skipping first row.");
                dataRows = rows.slice(1);
            } else {
                console.log("No header detected, including all rows.");
            }
        }

        fullDeck = dataRows.map(row => {
            const columns = row.split('\t');
            if (columns.length >= 2) {
                const english = columns[0].trim();
                const portuguese = columns[1].trim();
                return { english, portuguese };
            }
            return null;
        }).filter(card => card && card.english && card.portuguese);

        if (fullDeck.length === 0) throw new Error("No cards found in the sheet.");

        let nameToSave = deckName;
        if (!nameToSave) {
            nameToSave = prompt("What would you like to name this deck?", "My Deck");
        }
        if (nameToSave) {
            saveRecentDeck(nameToSave, url);
        }
        
        startLesson();
    } catch (error) {
        console.error('Error loading card data:', error);
        alert("Could not load cards. Please check the URL, share settings, and data format.");
        showSetupScreen();
    }
}

// --- INITIALIZATION & EVENT LISTENERS ---
function init() {
    renderRecentDecks();
    const savedUrl = localStorage.getItem('spreadsheetUrl');
    if (savedUrl) {
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
        loadCardData(url);
        urlInput.value = '';
    }
});

changeDeckButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to change decks?")) {
        localStorage.removeItem('spreadsheetUrl');
        urlInput.value = '';
        renderRecentDecks();
        showSetupScreen();
    }
});

flashcard.addEventListener('click', () => {
    if (currentCard) {
        flashcard.classList.toggle('is-flipped');
    }
});

// New event listeners for the three-button system
hardButton.addEventListener('click', () => handleAnswer('hard'));
mediumButton.addEventListener('click', () => handleAnswer('medium'));
easyButton.addEventListener('click', () => handleAnswer('easy'));

restartLessonButton.addEventListener('click', startLesson);

recentDecksContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'A') {
        event.preventDefault();
        const url = target.dataset.url;
        const name = target.textContent;
        if (url) {
            localStorage.setItem('spreadsheetUrl', url);
            loadCardData(url, name);
        }
    }
    else if (target.classList.contains('delete-deck-btn')) {
        const urlToDelete = target.dataset.url;
        if (urlToDelete && confirm('Are you sure you want to remove this deck?')) {
            deleteRecentDeck(urlToDelete);
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
    showSlide(0);
    tutorialModal.style.display = 'flex';
}

function closeTutorial() {
    tutorialModal.style.display = 'none';
}

tutorialLink.addEventListener('click', openTutorial);
modalCloseButton.addEventListener('click', closeTutorial);
prevArrow.addEventListener('click', () => changeSlide(-1));
nextArrow.addEventListener('click', () => changeSlide(1));

tutorialModal.addEventListener('click', (event) => {
    if (event.target === tutorialModal) {
        closeTutorial();
    }
});

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
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) {
        changeSlide(1);
    }
    if (touchEndX > touchStartX + swipeThreshold) {
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