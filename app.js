// --- DOM ELEMENTS ---
const setupScreen = document.getElementById('setup-screen');
const mainApp = document.getElementById('main-app');
const recentDecksContainer = document.getElementById('recent-decks-container');
const urlInput = document.getElementById('sheet-url-input');
const changeDeckButton = document.getElementById('change-deck-button');
const cardContainer = document.getElementById('card-container');
const restartLessonButton = document.getElementById('restart-lesson-button');
const nameDeckModal = document.getElementById('name-deck-modal');
const deckNameInput = document.getElementById('deck-name-input');
const confirmDeckNameBtn = document.getElementById('confirm-deck-name-btn');
const cancelDeckNameBtn = document.getElementById('cancel-deck-name-btn');
const deckLoadForm = document.getElementById('deck-load-form');
const randomizeToggleButton = document.getElementById('randomize-toggle-btn');

// Elements for the two-card system
const cardA = document.getElementById('flashcard-a');
const cardB = document.getElementById('flashcard-b');
const cardFrontTextA = document.getElementById('card-front-text-a');
const cardBackTextA = document.getElementById('card-back-text-a');
const cardFrontTextB = document.getElementById('card-front-text-b');
const cardBackTextB = document.getElementById('card-back-text-b');

// Button elements
const hardButton = document.getElementById('hard-button');
const mediumButton = document.getElementById('medium-button');
const easyButton = document.getElementById('easy-button');
const gameControls = document.getElementById('game-controls');

// --- TUTORIAL MODAL ELEMENTS ---
const tutorialLink = document.getElementById('tutorial-link');
const sampleLink = document.getElementById('sample-link');
const tutorialModal = document.getElementById('tutorial-modal');
const modalCloseButton = document.querySelector('.modal-close-button');
const tutorialImage = document.getElementById('tutorial-image');
const prevArrow = document.querySelector('.modal-arrow.prev');
const nextArrow = document.querySelector('.modal-arrow.next');
const slideCounter = document.getElementById('slide-counter');

// --- APP STATE ---
let fullDeck = [];
let sessionDeck = [];
let currentCardData = null; // The data object for the active card
let activeCardElement = null; // The DOM element for the active card
let nextCardElement = null; // The DOM element for the card in the back
let isAnimating = false; // Prevents fast multi-clicks during animation
let isRandomizeEnabled = false; // Controls whether the deck is shuffled

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
            html += `
                <li>
                    <a href="#" data-url="${deck.url}">${deck.name}</a>
                    <span class="deck-actions">
                        <button class="sync-deck-btn" data-url="${deck.url}" title="Sync with Google Sheet">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                            </svg>
                        </button>
                        <button class="delete-deck-btn" data-url="${deck.url}" title="Remove this deck">&times;</button>
                    </span>
                </li>`;
        });
        html += '</ol>';
        recentDecksContainer.innerHTML = html;
    } else {
        recentDecksContainer.innerHTML = '';
    }
}

function deleteRecentDeck(urlToDelete) {
    posthog.capture('Deck Deleted');
    let decks = getRecentDecks();
    decks = decks.filter(deck => deck.url !== urlToDelete);
    localStorage.setItem('recentDecks', JSON.stringify(decks));
    renderRecentDecks();
}

// --- DECK SYNCING LOGIC ---
const syncIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
    </svg>`;
const successIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>`;
const errorIconSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
    </svg>`;

async function syncDeck(buttonElement) {
    const url = buttonElement.dataset.url;
    if (!url) return;
    
    posthog.capture('Deck Synced');

    // 1. Start visual feedback
    buttonElement.disabled = true;
    buttonElement.classList.add('is-syncing');

    const tsvUrl = transformGoogleSheetUrl(url);

    try {
        // 2. Fetch the new data. This request is intercepted by the service worker,
        // which will update its offline cache with the fresh data.
        const response = await fetch(tsvUrl, { cache: 'reload' }); // 'reload' bypasses HTTP cache
        if (!response.ok) throw new Error('Network response not OK');
        
        // 3. Show success feedback
        buttonElement.classList.remove('is-syncing');
        buttonElement.classList.add('sync-success');
        buttonElement.innerHTML = successIconSVG;

    } catch (error) {
        console.error('Sync failed:', error);
        // 3b. Show error feedback
        buttonElement.classList.remove('is-syncing');
        buttonElement.classList.add('sync-error');
        buttonElement.innerHTML = errorIconSVG;
    } finally {
        // 4. Revert the icon back to normal after a short delay
        setTimeout(() => {
            buttonElement.classList.remove('sync-success', 'sync-error');
            buttonElement.innerHTML = syncIconSVG;
            buttonElement.disabled = false;
        }, 2000); // Reverts after 2 seconds
    }
}

// --- URL TRANSFORMATION ---
function transformGoogleSheetUrl(url) {
    let match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+).*[#&?]gid=([0-9]+)/);
    if (match && match[1] && match[2]) return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=tsv&gid=${match[2]}`;
    match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=tsv`;
    return url;
}

// --- CORE APP LOGIC ---
function showMainApp() {
    setupScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    hardButton.style.display = 'block';
    mediumButton.style.display = 'block';
    easyButton.style.display = 'block';
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

// Helper to put card data into a card element
function populateCard(cardElement, cardData) {
    if (!cardElement) return;
    const isCardA = cardElement.id === 'flashcard-a';
    const frontText = isCardA ? cardFrontTextA : cardFrontTextB;
    const backText = isCardA ? cardBackTextA : cardBackTextB;

    if (cardData) {
        frontText.textContent = cardData.english;
        backText.textContent = cardData.portuguese;
        cardElement.style.display = 'block';
    } else {
        cardElement.style.display = 'none';
    }
}

function showCompletionScreen() {
    currentCardData = null; // No active card

    // Get the text elements for the card that's currently in front
    const frontText = activeCardElement.id === 'flashcard-a' ? cardFrontTextA : cardFrontTextB;
    const backText = activeCardElement.id === 'flashcard-a' ? cardBackTextA : cardBackTextB;

    // Set the new, multi-line HTML message on the front face
    frontText.innerHTML = `Parabéns! 🎉<br><span class="completion-subtitle">You've learned all the cards.</span>`;
    backText.textContent = ""; // Clear the back face just in case
    
    // Ensure this final card is visible, active, and not flipped
    activeCardElement.classList.remove('is-flipped', 'is-next');
    activeCardElement.classList.add('is-active');
    activeCardElement.style.display = 'block';
    
    // Hide the other card so it doesn't peek from behind
    if (nextCardElement) {
        nextCardElement.style.display = 'none';
    }

    // Hide all the game controls and show the restart button
    gameControls.style.display = 'none';
    restartLessonButton.style.display = 'block';
}

function handleAnswer(level) {
    if (!currentCardData || isAnimating) return;

    // Place the card back in the deck based on difficulty
    if (level === 'medium') {
        sessionDeck.push(currentCardData);
    } else if (level === 'hard') {
        const insertIndex = Math.min(sessionDeck.length, 3);
        sessionDeck.splice(insertIndex, 0, currentCardData);
    }
    // 'easy' cards are not put back in the deck

    // Determine the swipe direction based on the answer level
    let direction = 'right'; // Default to 'right' for hard
    if (level === 'easy') {
        direction = 'left';
    } else if (level === 'medium') {
        direction = 'down';
    }
    
    advanceCards(direction);
}

function advanceCards(direction = 'right') {
    if (isAnimating) return; // Prevent multiple clicks during animation
    isAnimating = true;

    // The card that is currently active and will swipe out
    const cardSwipingOut = activeCardElement;
    // The card that is currently 'next' and will zoom into active position
    const cardZoomingIn = nextCardElement;

    // Data for the card that will become the *new* active card
    const newDataForActive = sessionDeck.shift(); 
    // Data for the card that will become the *new* next card (peek from deck)
    const newDataForNext = sessionDeck[0];

    // *** THE FIX IS HERE ***
    // We populate the card that is about to ZOOM IN with the next card's data *before* the animation starts.
    if (newDataForActive) {
        populateCard(cardZoomingIn, newDataForActive);
    }
    
    // --- ANIMATION START ---
    // 1. Start the current active card swiping out in the correct direction
    let swipeClass;
    switch (direction) {
        case 'left':
            swipeClass = 'swiping-left';
            break;
        case 'down':
            swipeClass = 'swiping-down';
            break;
        default: // 'right' and any other case
            swipeClass = 'swiping-right';
            break;
    }
    cardSwipingOut.classList.add(swipeClass);
    cardSwipingOut.classList.remove('is-active');
    cardSwipingOut.classList.remove('is-flipped'); // Ensure it flips back if it was showing the back

    // 2. Start the next card zooming into the active position
    if (cardZoomingIn) {
        cardZoomingIn.classList.remove('is-next');
        cardZoomingIn.classList.add('is-active');
    }

    // --- ANIMATION END (after swipe-out transition) ---
    setTimeout(() => {
        // 3. Reset the swiped-out card and prepare it to be the new 'next' card
        cardSwipingOut.classList.remove('swiping-left', 'swiping-right', 'swiping-down'); // Remove all possible classes
        cardSwipingOut.classList.add('is-next');
        cardSwipingOut.style.display = 'block'; // Make sure it's visible again

        // 4. Update the references for active/next cards and current card data
        activeCardElement = cardZoomingIn; // The card that just zoomed in is now active
        nextCardElement = cardSwipingOut; // The card that swiped out is now the 'next' card in the back
        currentCardData = newDataForActive; // The data for the current active card

        // 5. Check if the deck is finished
        if (!currentCardData) {
            showCompletionScreen();
            isAnimating = false;
            return;
        }

        // 6. Populate the new 'next' card (the one in the back) with the upcoming card's data
        populateCard(nextCardElement, newDataForNext);

        isAnimating = false; // Animation finished, re-enable clicks
    }, 250); // This delay MUST match the CSS transition duration
}

function startLesson() {
    sessionDeck = [...fullDeck];
    // Only shuffle the deck if the user has enabled the option
    if (isRandomizeEnabled) {
        shuffleArray(sessionDeck);
    }
    
    // Reset all card states and visibility for both cards
    cardA.className = 'flashcard'; // Remove all classes
    cardB.className = 'flashcard'; // Remove all classes
    cardA.style.display = 'block';
    cardB.style.display = 'block';
    
    // Ensure both cards are unflipped initially
    cardA.classList.remove('is-flipped');
    cardB.classList.remove('is-flipped');

    // Get the first two cards from the shuffled deck
    const firstCardData = sessionDeck.shift(); 
    const secondCardData = sessionDeck[0]; // Peek at the next card

    if (!firstCardData) {
        alert("This deck is empty!");
        showSetupScreen();
        return;
    }
    
    // Set up the initial card stack: Card A is active, Card B is next
    activeCardElement = cardA;
    nextCardElement = cardB;
    currentCardData = firstCardData;

    populateCard(activeCardElement, firstCardData); // Populate the active card
    populateCard(nextCardElement, secondCardData);   // Populate the card that will be behind it

    activeCardElement.classList.add('is-active'); // Set Card A as the active one
    nextCardElement.classList.add('is-next');     // Set Card B as the one in the back
    
    // Make sure the game controls are visible and the restart button is hidden
    gameControls.style.display = 'block';
    restartLessonButton.style.display = 'none';
    showMainApp();
}

async function loadCardData(url, deckName = null) {
    populateCard(cardA, { english: 'Loading...', portuguese: '' });
    populateCard(cardB, null);
    cardA.classList.add('is-active');
    cardB.classList.add('is-next');
    showMainApp();
    hardButton.style.display = 'none';
    mediumButton.style.display = 'none';
    easyButton.style.display = 'none';

    const tsvUrl = transformGoogleSheetUrl(url);

    try {
        const response = await fetch(tsvUrl);
        const tsvText = await response.text();
        const rows = tsvText.trim().split('\n');

        let dataRows = rows;
        if (rows.length > 0) {
            const hasHeader = ['english', 'portugues', 'french', 'front', 'frente', 'back', 'verso', 'term'].some(kw => rows[0].toLowerCase().includes(kw));
            if (hasHeader) dataRows = rows.slice(1);
        }

        fullDeck = dataRows.map(row => {
            const columns = row.split('\t');
            return columns.length >= 2 ? { english: columns[0].trim(), portuguese: columns[1].trim() } : null;
        }).filter(card => card && card.english && card.portuguese);

        if (fullDeck.length === 0) throw new Error("No cards found in the sheet.");

        let nameToSave = deckName;
        if (!nameToSave) {
            try {
                nameToSave = await askForDeckName(); 
            } catch (error) {
                showSetupScreen();
                return;
            }
        }
        
        saveRecentDeck(nameToSave, url);
        startLesson();
    } catch (error) {
        console.error('Error loading card data:', error);
        alert("Could not load cards. Please check the URL, share settings, and data format.");
        showSetupScreen();
    }
}

// --- INITIALIZATION & EVENT LISTENERS ---
function init() {
    // Check for an identified user from the main GetViajo site
    const identifiedUserEmail = localStorage.getItem('getviajo_identified_user_email');
    if (identifiedUserEmail) {
        posthog.identify(identifiedUserEmail);
    }
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

// This function handles the logic for loading a deck
const handleDeckLoad = () => {
    const url = urlInput.value.trim();
    if (url) {
        posthog.capture('Deck Loaded');
        localStorage.setItem('spreadsheetUrl', url);
        loadCardData(url);
        urlInput.value = '';
    }
};

// Listen for the form submission (e.g., user presses Enter in the input field)
deckLoadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handleDeckLoad();
});

// We need to get the button element itself now
const loadDeckButton = document.getElementById('load-deck-button');
// Listen for clicks on the main "Load Deck" button
loadDeckButton.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent any default button behavior
    handleDeckLoad();
});
// Listen for clicks on the randomize toggle button
randomizeToggleButton.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent any default button behavior
    
    // Toggle the boolean state
    isRandomizeEnabled = !isRandomizeEnabled;
    
    // Capture the event with its current state
    posthog.capture('Randomize Toggled', { enabled: isRandomizeEnabled });

    // Toggle the visual 'is-active' class on the button
    randomizeToggleButton.classList.toggle('is-active', isRandomizeEnabled);
});

changeDeckButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to change decks?")) {
        localStorage.removeItem('spreadsheetUrl');
        urlInput.value = '';
        renderRecentDecks();
        showSetupScreen();
    }
});

cardContainer.addEventListener('click', () => {
    if (currentCardData && activeCardElement) {
        activeCardElement.classList.toggle('is-flipped');
    }
});

// Custom modal promise function
function askForDeckName() {
    return new Promise((resolve, reject) => {
        nameDeckModal.style.display = 'flex';
        deckNameInput.value = 'My Deck';
        deckNameInput.focus();
        deckNameInput.select();

        const closeModal = () => {
            nameDeckModal.style.display = 'none';
            confirmDeckNameBtn.removeEventListener('click', onConfirm);
            deckNameInput.removeEventListener('keydown', onKeydown);
            cancelDeckNameBtn.removeEventListener('click', onCancel);
        };
        const onConfirm = () => {
            const name = deckNameInput.value.trim();
            if (name) {
                closeModal();
                resolve(name);
            }
        };
        const onCancel = () => {
            closeModal();
            reject();
        };
        const onKeydown = (event) => {
            if (event.key === 'Enter') onConfirm();
            else if (event.key === 'Escape') onCancel();
        };

        confirmDeckNameBtn.addEventListener('click', onConfirm);
        cancelDeckNameBtn.addEventListener('click', onCancel);
        deckNameInput.addEventListener('keydown', onKeydown);
    });
}

hardButton.addEventListener('click', () => handleAnswer('hard'));
mediumButton.addEventListener('click', () => handleAnswer('medium'));
easyButton.addEventListener('click', () => handleAnswer('easy'));
restartLessonButton.addEventListener('click', () => {
    posthog.capture('Lesson Restarted');
    startLesson();
});

recentDecksContainer.addEventListener('click', (event) => {
    const target = event.target;
    const link = target.closest('a');
    const deleteBtn = target.closest('.delete-deck-btn');
    const syncBtn = target.closest('.sync-deck-btn');

    if (link) {
        event.preventDefault();
        const url = link.dataset.url;
        const name = link.textContent;
        if (url) {
            localStorage.setItem('spreadsheetUrl', url);
            loadCardData(url, name);
        }
    } else if (deleteBtn) {
        const urlToDelete = deleteBtn.dataset.url;
        if (urlToDelete && confirm('Are you sure you want to remove this deck?')) {
            deleteRecentDeck(urlToDelete);
        }
    } else if (syncBtn) {
        syncDeck(syncBtn);
    }
});

// --- TUTORIAL MODAL LOGIC ---
const tutorialImages = ['assets/tutorial-1.jpg', 'assets/tutorial-2.jpg', 'assets/tutorial-3.jpg', 'assets/tutorial-4.jpg', 'assets/tutorial-5.jpg'];
let currentSlideIndex = 0;

function showSlide(index) {
    currentSlideIndex = (index + tutorialImages.length) % tutorialImages.length;
    tutorialImage.src = tutorialImages[currentSlideIndex];
    slideCounter.textContent = `${currentSlideIndex + 1} / ${tutorialImages.length}`;
}

function changeSlide(direction) { showSlide(currentSlideIndex + direction); }
function openTutorial() { 
    posthog.capture('Tutorial Viewed');
    showSlide(0); 
    tutorialModal.style.display = 'flex'; 
}
function closeTutorial() { tutorialModal.style.display = 'none'; }

tutorialLink.addEventListener('click', openTutorial);
modalCloseButton.addEventListener('click', closeTutorial);
prevArrow.addEventListener('click', () => changeSlide(-1));
nextArrow.addEventListener('click', () => changeSlide(1));
// --- NEW: Event Listener for the Sample Link ---
sampleLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevents any default button/link behavior
    posthog.capture('Sample Link Clicked');
    
    const sampleUrl = 'https://docs.google.com/spreadsheets/d/1nEUPaNaBTh52DuNo0HQtUUwSiFQh2COJKexkfzB6pQQ/edit?usp=sharing';
    
    urlInput.value = sampleUrl; // Fill the input field
    
    // Add the highlight class for the flash effect
    urlInput.classList.add('is-highlighted');
    
    // Remove the class after the animation is done (1500ms = 1.5s)
    setTimeout(() => {
        urlInput.classList.remove('is-highlighted');
    }, 1500);
});
tutorialModal.addEventListener('click', (event) => { if (event.target === tutorialModal) closeTutorial(); });

document.addEventListener('keydown', (event) => {
    // --- 1. Handle Tutorial Modal Controls ---
    if (tutorialModal.style.display === 'flex') {
        if (event.key === 'ArrowLeft') {
            changeSlide(-1);
        } else if (event.key === 'ArrowRight') {
            changeSlide(1);
        } else if (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter') {
            // This prevents the spacebar from also scrolling the page or re-triggering buttons
            event.preventDefault(); 
            closeTutorial();
        }
        return; // This ensures no other keydown actions (like flipping a card) run
    }

    // --- 2. Ignore Keys While Typing ---
    if (event.target.tagName === 'INPUT' || nameDeckModal.style.display === 'flex') {
        return;
    }

    // --- 3. NEW: Handle Completion Screen Controls ---
    if (restartLessonButton.style.display === 'block' && event.key === 'Enter') {
        event.preventDefault(); // Prevent any default browser action
        restartLessonButton.click();
        return; // Stop further execution
    }

    // --- 4. Handle Main App Flashcard Controls ---
    if (mainApp.style.display === 'flex' && currentCardData) {
        // Use the Spacebar OR Up Arrow to flip the current card.
        if (event.key === ' ' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (activeCardElement) {
                activeCardElement.classList.toggle('is-flipped');
            }
            return;
        }

        // A variable to hold which button to click.
        let action = null;
        
        // Check which arrow key was pressed.
        switch (event.key) {
            case 'ArrowLeft':
                action = () => easyButton.click();
                break;
            case 'ArrowDown':
                action = () => mediumButton.click();
                break;
            case 'ArrowRight':
                action = () => hardButton.click();
                break;
        }

        // If an arrow key was pressed, perform the action immediately without flipping.
        if (action && activeCardElement && !isAnimating) {
            action();
        }
    }
});

let touchStartX = 0;
tutorialModal.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].screenX; }, { passive: true });
tutorialModal.addEventListener('touchend', (event) => {
    const touchEndX = event.changedTouches[0].screenX;
    if (touchEndX < touchStartX - 50) changeSlide(1);
    if (touchEndX > touchStartX + 50) changeSlide(-1);
});

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js');
    });
}

// --- START THE APP ---
init();