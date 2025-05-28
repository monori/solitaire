// =============== CONSTANTS AND GLOBALS ===============
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RED_SUITS = ['hearts', 'diamonds'];
const BLACK_SUITS = ['clubs', 'spades'];

// Game state
let gameState = {
    deck: [],           // Cards in the stock pile
    waste: [],          // Cards in the waste pile
    foundations: [      // The 4 foundation piles (by suit)
        [], [], [], []
    ],
    tableau: [          // The 7 tableau piles
        [], [], [], [], [], [], []
    ],
    moves: [],          // History of moves for undo
    startTime: null,    // When the current game started
    elapsedTime: 0,     // Time elapsed in seconds
    drawThree: false    // Whether to draw three cards at a time
};

// Game statistics
let gameStats = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    fastestTimes: []    // Array of fastest completion times in seconds
};

// Subtle ad management - non-intrusive
let adState = {
    refreshInterval: 300000, // 5 minutes - much less frequent
    lastRefresh: Date.now(),
    refreshCount: 0
};

// Bookmark reminder system
let bookmarkState = {
    lastReminder: 0,
    reminderCount: 0,
    gamesSinceReminder: 0,
    hasShownWelcome: false,
    sessionStartTime: Date.now()
};

// Offline mode management
let offlineState = {
    isOffline: false,
    lastOnlineSync: Date.now(),
    pendingSync: false
};

// DOM elements
const stockElement = document.getElementById('stock');
const wasteElement = document.getElementById('waste');
const foundationElements = Array.from({ length: 4 }, (_, i) => document.getElementById(`foundation-${i}`));
const tableauElements = Array.from({ length: 7 }, (_, i) => document.getElementById(`tableau-${i}`));
const newGameButton = document.getElementById('new-game-btn');
const undoButton = document.getElementById('undo-btn');
const bookmarkButton = document.getElementById('bookmark-btn');
const toastContainer = document.getElementById('toast-container');
const drawThreeToggle = document.getElementById('draw-three-toggle');

// Stats elements
const gamesPlayedElement = document.getElementById('games-played');
const winsElement = document.getElementById('wins');
const lossesElement = document.getElementById('losses');
const fastestTimeElement = document.getElementById('fastest-time');

// Drag and drop variables
let draggedElement = null;
let draggedCards = [];
let dragSourceElement = null;
let dragSourcePile = null;
let offsetX, offsetY;

// Timer variables
let timerInterval = null;
let adRefreshInterval = null;

// =============== PWA INSTALLATION PROMPT ===============

// PWA installation state
let deferredPrompt = null;
let installButton = null;

// Initialize PWA installation functionality
function initializePWAInstall() {
    // Create install button
    createInstallButton();
    
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('PWA: beforeinstallprompt event fired');
        
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show the install button
        showInstallButton();
    });
    
    // Listen for the app being installed
    window.addEventListener('appinstalled', (e) => {
        console.log('PWA: App was installed');
        hideInstallButton();
        showToast('🎉 Solitaire installed successfully! You can now play offline anytime.', 6000);
        
        // Clear the deferredPrompt
        deferredPrompt = null;
    });
    
    // Check if app is already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        console.log('PWA: App is running in standalone mode');
        hideInstallButton();
    }
    
    // iOS Safari detection for manual install instructions
    if (isIOSSafari()) {
        createIOSInstallInstructions();
    }
}

// Create the install button
function createInstallButton() {
    installButton = document.createElement('button');
    installButton.id = 'install-app-btn';
    installButton.className = 'install-btn';
    installButton.innerHTML = '📱 Install App';
    installButton.title = 'Install Solitaire as a desktop/mobile app';
    installButton.style.display = 'none';
    
    // Add click handler
    installButton.addEventListener('click', handleInstallClick);
    
    // Add to game controls
    const gameControls = document.querySelector('.game-controls');
    if (gameControls) {
        gameControls.appendChild(installButton);
    }
}

// Show the install button
function showInstallButton() {
    if (installButton) {
        installButton.style.display = 'inline-block';
        
        // Show a subtle notification about the install option
        setTimeout(() => {
            showToast('💡 You can install this game as an app! Look for the "Install App" button.', 5000);
        }, 3000);
    }
}

// Hide the install button
function hideInstallButton() {
    if (installButton) {
        installButton.style.display = 'none';
    }
}

// Handle install button click
async function handleInstallClick() {
    if (!deferredPrompt) {
        // Fallback for browsers that don't support the prompt
        showManualInstallInstructions();
        return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`PWA: User response to install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
        showToast('🎉 Installing Solitaire app...', 3000);
    } else {
        showToast('📱 You can install the app anytime using the Install button!', 4000);
    }
    
    // Clear the deferredPrompt
    deferredPrompt = null;
    hideInstallButton();
}

// Show manual install instructions for unsupported browsers
function showManualInstallInstructions() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isChrome || isEdge) {
        instructions = 'To install: Click the ⋮ menu → "Install Solitaire" or look for the install icon in the address bar.';
    } else if (isFirefox) {
        instructions = 'To install: Click the ☰ menu → "Install this site as an app" or look for the install icon in the address bar.';
    } else if (isSafari) {
        instructions = 'To install on iOS: Tap the Share button → "Add to Home Screen". On Mac: File menu → "Add to Dock".';
    } else {
        instructions = 'To install: Look for "Install" or "Add to Home Screen" option in your browser menu.';
    }
    
    showToast(instructions, 8000);
}

// Detect iOS Safari
function isIOSSafari() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    return isIOS && isSafari;
}

// Create iOS-specific install instructions
function createIOSInstallInstructions() {
    // Only show if not already installed
    if (!window.navigator.standalone) {
        setTimeout(() => {
            showToast('📱 iOS Tip: Tap Share → "Add to Home Screen" to install as an app!', 6000);
        }, 5000);
    }
}

// Check if PWA features are supported
function isPWASupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
}

// =============== LANGUAGE DETECTION FOR SEO CONTENT ===============

// Initialize language detection and SEO content
function initializeLanguageDetection() {
    const hostname = window.location.hostname.toLowerCase();
    const isDanishDomain = hostname.includes('.dk') || 
                          hostname.includes('kabale') || 
                          hostname.includes('danish') ||
                          hostname.includes('danmark');
    
    const englishContent = document.getElementById('english-content');
    const danishContent = document.getElementById('danish-content');
    
    if (isDanishDomain) {
        // Show Danish content
        if (englishContent) englishContent.style.display = 'none';
        if (danishContent) danishContent.style.display = 'block';
        
        // Update page title and meta description for Danish
        document.title = 'Gratis Online Kabale - Klassisk Klondike Kortspil';
        
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.content = 'Spil klassisk Klondike Kabale online eller offline. Gem dit fremskridt med bogmærker og følg dine statistikker. Ikke-påtrængende annoncer, mobil-venligt design.';
        }
        
        // Update Open Graph tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.content = 'Gratis Online Kabale - Klassisk Klondike Kortspil';
        }
        
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            ogDescription.content = 'Spil klassisk Klondike Kabale online eller offline. Gem dit fremskridt og følg dine statistikker!';
        }
        
        console.log('Danish language detected - showing Danish SEO content');
    } else {
        // Show English content (default)
        if (englishContent) englishContent.style.display = 'block';
        if (danishContent) danishContent.style.display = 'none';
        
        console.log('English language detected - showing English SEO content');
    }
}

// =============== BOOKMARK REMINDER SYSTEM ===============

// Initialize bookmark reminder system
function initializeBookmarkSystem() {
    // Show welcome message for new users
    if (!bookmarkState.hasShownWelcome && !hasExistingGameState()) {
        setTimeout(() => {
            showBookmarkWelcome();
            bookmarkState.hasShownWelcome = true;
        }, 3000); // Show after 3 seconds of play
    }
    
    // Set up page visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set up beforeunload listener for leaving page
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Set up periodic gentle reminders
    setInterval(checkForPeriodicReminder, 120000); // Check every 2 minutes
}

// Check if user has existing game state (returning user)
function hasExistingGameState() {
    const url = new URL(window.location.href);
    return url.searchParams.has('state') || url.searchParams.has('stats');
}

// Show welcome message for new users
function showBookmarkWelcome() {
    showToast("💡 Tip: Bookmark this page to save your progress and stats!", 6000);
}

// Handle page visibility change (tab switching, minimizing)
function handleVisibilityChange() {
    if (document.hidden) {
        // User is leaving/switching tabs
        const sessionTime = Date.now() - bookmarkState.sessionStartTime;
        
        // Only remind if they've been playing for a while
        if (sessionTime > 300000 && shouldShowBookmarkReminder()) { // 5+ minutes
            // Save state before they potentially leave
            saveToURL();
        }
    }
}

// Handle before page unload
function handleBeforeUnload(e) {
    const sessionTime = Date.now() - bookmarkState.sessionStartTime;
    
    // Only show if they've been playing for a reasonable time
    if (sessionTime > 180000 && shouldShowBookmarkReminder()) { // 3+ minutes
        saveToURL();
        
        // Modern browsers ignore custom messages, but we still set it
        const message = "Don't forget to update your bookmark to save your progress!";
        e.returnValue = message;
        return message;
    }
}

// Check if we should show a periodic reminder
function checkForPeriodicReminder() {
    const sessionTime = Date.now() - bookmarkState.sessionStartTime;
    const timeSinceLastReminder = Date.now() - bookmarkState.lastReminder;
    
    // Show reminder if:
    // - Been playing for 10+ minutes
    // - Haven't shown reminder in last 15 minutes
    // - Have played multiple games
    if (sessionTime > 600000 && // 10+ minutes
        timeSinceLastReminder > 900000 && // 15+ minutes since last
        bookmarkState.gamesSinceReminder >= 2) { // 2+ games since last
        
        showPeriodicBookmarkReminder();
    }
}

// Show periodic bookmark reminder
function showPeriodicBookmarkReminder() {
    const messages = [
        "💾 Remember to update your bookmark to save your progress!",
        "🔖 Keep your stats safe - update your bookmark!",
        "📌 Don't lose your progress - bookmark this page!",
        "💡 Pro tip: Update your bookmark to save your game stats!"
    ];
    
    const message = messages[bookmarkState.reminderCount % messages.length];
    showToast(message, 5000);
    
    bookmarkState.lastReminder = Date.now();
    bookmarkState.reminderCount++;
    bookmarkState.gamesSinceReminder = 0;
}

// Show bookmark reminder after game completion
function showGameCompletionBookmarkReminder(isWin) {
    if (shouldShowBookmarkReminder()) {
        const winMessage = "🎉 Great win! Update your bookmark to save your achievement!";
        const lossMessage = "💪 Good game! Update your bookmark to keep your stats!";
        
        setTimeout(() => {
            showToast(isWin ? winMessage : lossMessage, 6000);
        }, 2000); // Show 2 seconds after game end message
    }
}

// Check if we should show a bookmark reminder
function shouldShowBookmarkReminder() {
    const timeSinceLastReminder = Date.now() - bookmarkState.lastReminder;
    return timeSinceLastReminder > 600000; // At least 10 minutes since last reminder
}

// Show contextual bookmark reminder based on user action
function showContextualBookmarkReminder(context) {
    if (!shouldShowBookmarkReminder()) return;
    
    const messages = {
        newGame: "🎮 Starting fresh? Update your bookmark to save your new stats!",
        longSession: "⏰ You've been playing a while - don't forget to bookmark your progress!",
        goodStreak: "🔥 Nice winning streak! Save it with a bookmark update!",
        milestone: "🏆 Milestone reached! Update your bookmark to preserve this moment!"
    };
    
    if (messages[context]) {
        showToast(messages[context], 5000);
        bookmarkState.lastReminder = Date.now();
    }
}

// =============== SUBTLE AD MANAGEMENT ===============

// Initialize subtle ad system
function initializeAdSystem() {
    // Start very infrequent ad refresh timer
    adRefreshInterval = setInterval(refreshAdsSubtly, adState.refreshInterval);
    
    console.log('Subtle ad system initialized with refresh interval:', adState.refreshInterval / 1000, 'seconds');
}

// Subtly refresh ads - very infrequent and non-disruptive
function refreshAdsSubtly() {
    if (typeof window.adsbygoogle !== 'undefined') {
        try {
            // Only refresh if user has been playing for a while
            if (gameState.elapsedTime > 600) { // 10+ minutes
                // Get only the bottom ad (most subtle)
                const bottomAd = document.querySelector('.ad-subtle-bottom .adsbygoogle');
                
                if (bottomAd && !isElementInViewport(bottomAd)) {
                    // Very subtle refresh - only when not visible
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                    adState.refreshCount++;
                    adState.lastRefresh = Date.now();
                    
                    console.log('Subtle ad refresh. Count:', adState.refreshCount);
                }
            }
            
        } catch (error) {
            console.log('Ad refresh error (normal if AdSense not loaded):', error.message);
        }
    }
}

// Check if element is in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// =============== INITIALIZATION ===============

// Initialize the game
function init() {
    // Initialize PWA installation functionality
    initializePWAInstall();
    
    // Initialize offline mode detection
    initializeOfflineMode();
    
    // Initialize subtle ad system
    initializeAdSystem();
    
    // Initialize bookmark reminder system
    initializeBookmarkSystem();
    
    // Check for URL parameters (PWA shortcuts)
    handleURLParameters();
    
    // Load game state and stats from URL if available (online) or localStorage (offline)
    if (navigator.onLine) {
        loadFromURL();
    } else {
        loadFromLocalStorage();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // If no game in progress, start a new one
    if (gameState.deck.length === 0 && gameState.tableau.every(pile => pile.length === 0)) {
        newGame();
    } else {
        // Render existing game state
        renderGameState();
        
        // Resume timer if game was in progress
        if (gameState.startTime !== null) {
            startTimer();
        }
    }
    
    // Update stats display
    updateStatsDisplay();
    
    // Set the draw three toggle to match the game state
    drawThreeToggle.checked = gameState.drawThree;
}

// Handle URL parameters for PWA shortcuts
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'new') {
        // Force a new game if coming from "New Game" shortcut
        setTimeout(() => {
            newGame();
            showToast('🎮 New game started from app shortcut!', 3000);
        }, 500);
        
        // Clean up the URL parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        window.history.replaceState({}, '', url);
    }
}

// Set up event listeners
function setupEventListeners() {
    // New game button
    newGameButton.addEventListener('click', newGame);
    
    // Undo button
    undoButton.addEventListener('click', undoMove);
    
    // Bookmark button
    bookmarkButton.addEventListener('click', handleBookmarkClick);
    
    // Stock pile click
    stockElement.addEventListener('click', handleStockClick);
    
    // Draw three toggle
    drawThreeToggle.addEventListener('change', (e) => {
        gameState.drawThree = e.target.checked;
        saveToURL();
        showToast(`Draw ${gameState.drawThree ? 'Three' : 'One'} mode activated`);
    });
    
    // Set up drop targets
    setupDropTargets();
    
    // Window beforeunload event to remind about bookmarking
    window.addEventListener('beforeunload', () => {
        saveToURL();
    });
    
    // Add global dragover handler to ensure dragging works properly
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
}

// Set up drop targets for drag and drop
function setupDropTargets() {
    // Set up tableau piles as drop targets
    tableauElements.forEach((element, index) => {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedCards.length > 0) {
                const isValid = isValidMove(draggedCards, 'tableau', index);
                e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
            }
        });
        
        element.addEventListener('drop', (e) => handleDrop(e, 'tableau', index));
    });
    
    // Set up foundation piles as drop targets
    foundationElements.forEach((element, index) => {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedCards.length > 0) {
                const isValid = isValidMove(draggedCards, 'foundation', index);
                e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
            }
        });
        
        element.addEventListener('drop', (e) => handleDrop(e, 'foundation', index));
    });
}

// Set up drag and drop for a card
function setupDragAndDrop(cardElement, sourceType, pileIndex, cardIndex) {
    cardElement.draggable = true;
    
    cardElement.addEventListener('mousedown', (e) => {
        // Store the initial mouse position relative to the card
        const rect = cardElement.getBoundingClientRect();
        window.dragOffsetX = e.clientX - rect.left;
        window.dragOffsetY = e.clientY - rect.top;
    });
    
    cardElement.addEventListener('dragstart', (e) => {
        // Required for Firefox
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.effectAllowed = 'move';
        
        // Calculate the offset of the mouse from the top-left corner of the card
        // if not already set by mousedown
        if (window.dragOffsetX === undefined || window.dragOffsetY === undefined) {
            const rect = cardElement.getBoundingClientRect();
            window.dragOffsetX = e.clientX - rect.left;
            window.dragOffsetY = e.clientY - rect.top;
        }
        
        // Store the original z-index before modifying it
        cardElement.dataset.originalZIndex = cardElement.style.zIndex || getComputedStyle(cardElement).zIndex || '30';
        
        // Set drag source information
        draggedElement = cardElement;
        dragSourcePile = { type: sourceType, index: pileIndex, cardIndex };
        
        console.log('Drag start:', {
            type: sourceType,
            pileIndex,
            cardIndex,
            originalZIndex: cardElement.dataset.originalZIndex
        });
        
        // If dragging from tableau, get all cards below this one
        if (sourceType === 'tableau') {
            const pile = gameState.tableau[pileIndex];
            draggedCards = pile.slice(cardIndex);
            
            // Only create visual stack preview for multiple cards
            if (draggedCards.length > 1) {
                createStackPreview(cardElement, draggedCards, cardIndex);
            } else {
                // For single cards, just set a high z-index
                cardElement.style.zIndex = '1000';
            }
        } else if (sourceType === 'waste' && cardIndex === gameState.waste.length - 1) {
            draggedCards = [gameState.waste[cardIndex]];
            
            // Set a high z-index for the dragged card
            cardElement.style.zIndex = '1000';
        } else if (sourceType === 'foundation' && cardIndex === gameState.foundations[pileIndex].length - 1) {
            draggedCards = [gameState.foundations[pileIndex][cardIndex]];
            
            // Set a high z-index for the dragged card
            cardElement.style.zIndex = '1000';
        }
        
        console.log('Dragged cards:', draggedCards.map(card => `${card.rank} of ${card.suit}`));
        
        // Add dragging class
        setTimeout(() => {
            cardElement.classList.add('dragging');
        }, 0);
    });
    
    cardElement.addEventListener('drag', (e) => {
        // Update stack preview position if it exists
        if (e.clientX > 0 && e.clientY > 0) { // Only update if we have valid coordinates
            updateStackPreviewPosition(e);
        }
    });
    
    cardElement.addEventListener('dragend', () => {
        cardElement.classList.remove('dragging');
        
        // Restore the original z-index that was stored at drag start
        if (cardElement.dataset.originalZIndex) {
            cardElement.style.zIndex = cardElement.dataset.originalZIndex;
            // Clean up the stored value
            delete cardElement.dataset.originalZIndex;
        } else {
            // Fallback - restore to CSS default
            cardElement.style.zIndex = '';
        }
        
        // Remove stack preview
        removeStackPreview();
        
        // Check if this was an invalid move that needs a re-render
        // We need to wait a frame for the browser's drag behavior to complete
        const needsRerender = draggedCards.length > 0 && dragSourcePile !== null;
        
        // Reset drag state
        draggedElement = null;
        draggedCards = [];
        dragSourcePile = null;
        
        // Reset drag offset
        window.dragOffsetX = undefined;
        window.dragOffsetY = undefined;
        
        // Force a re-render after invalid drags to ensure proper positioning
        if (needsRerender) {
            setTimeout(() => {
                renderGameState();
            }, 10);
        }
    });
    
    // Add click handler for double-click auto-move to foundation
    cardElement.addEventListener('dblclick', () => {
        if (sourceType === 'tableau' && cardIndex === gameState.tableau[pileIndex].length - 1) {
            tryMoveToFoundation(sourceType, pileIndex, cardIndex);
        } else if (sourceType === 'waste' && cardIndex === gameState.waste.length - 1) {
            tryMoveToFoundation(sourceType, pileIndex, cardIndex);
        }
    });
}

// Create a visual preview of the stack being dragged
function createStackPreview(sourceCard, cards, startIndex) {
    // Remove any existing preview first (safety check)
    removeStackPreview();
    
    // Only create preview if there are multiple cards
    if (cards.length <= 1) return;
    
    // Additional safety check - don't create if one already exists
    if (document.getElementById('stack-preview-container')) {
        console.warn('Stack preview container already exists, skipping creation');
        return;
    }
    
    // Get initial position for the preview container
    const rect = sourceCard.getBoundingClientRect();
    
    // Create a container for the preview
    const previewContainer = document.createElement('div');
    previewContainer.id = 'stack-preview-container';
    previewContainer.style.position = 'fixed';
    previewContainer.style.pointerEvents = 'none';
    previewContainer.style.zIndex = '2000';
    previewContainer.style.left = `${rect.left}px`;
    previewContainer.style.top = `${rect.top}px`;
    
    document.body.appendChild(previewContainer);
    
    // Create card elements for all cards in the stack
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const cardElement = createCardElement(card, 0); // No offset here, we'll position manually
        cardElement.classList.add('stack-preview');
        
        // Position each card relative to the container
        cardElement.style.position = 'absolute';
        cardElement.style.left = '0px';
        cardElement.style.top = `${i * 20}px`; // 20px offset for each card
        cardElement.style.zIndex = (2000 + i).toString();
        cardElement.style.pointerEvents = 'none';
        cardElement.style.transform = 'none'; // Reset any transforms
        
        previewContainer.appendChild(cardElement);
    }
    
    // Store the original cards that need to be hidden
    window.hiddenCards = [];
    
    // Hide all the original cards in the stack
    if (dragSourcePile && dragSourcePile.type === 'tableau') {
        const tableauElement = tableauElements[dragSourcePile.index];
        const cardElements = tableauElement.querySelectorAll('.card');
        
        // Hide all cards from the dragged card to the end of the pile
        for (let i = dragSourcePile.cardIndex; i < cardElements.length; i++) {
            // Store the card and its original properties
            window.hiddenCards.push({
                element: cardElements[i],
                originalOpacity: cardElements[i].style.opacity || '1',
                originalZIndex: cardElements[i].style.zIndex || ''
            });
            
            // Hide the card by setting opacity to 0
            cardElements[i].style.opacity = '0';
        }
    }
    
    // Store the source card's dimensions and position for positioning
    window.dragSourceRect = rect;
    window.dragOffsetX = window.dragOffsetX || 0;
    window.dragOffsetY = window.dragOffsetY || 0;
}

// Update the position of the stack preview during drag
function updateStackPreviewPosition(e) {
    const previewContainer = document.getElementById('stack-preview-container');
    if (!previewContainer) return;
    
    // Position the preview container relative to the mouse, accounting for the initial click offset
    const left = e.clientX - window.dragOffsetX;
    const top = e.clientY - window.dragOffsetY;
    
    // Position the preview container at the same position as the dragged card
    previewContainer.style.left = `${left}px`;
    previewContainer.style.top = `${top}px`;
}

// Remove the stack preview
function removeStackPreview() {
    const previewContainer = document.getElementById('stack-preview-container');
    if (previewContainer) {
        previewContainer.remove();
    }
    
    // Restore opacity and z-index of any hidden cards
    if (window.hiddenCards && window.hiddenCards.length > 0) {
        window.hiddenCards.forEach((cardInfo, index) => {
            if (cardInfo.element && cardInfo.element.style) {
                // Restore opacity
                cardInfo.element.style.opacity = cardInfo.originalOpacity || '1';
                
                // Restore original z-index or calculate proper z-index based on card position
                if (cardInfo.originalZIndex) {
                    cardInfo.element.style.zIndex = cardInfo.originalZIndex;
                } else if (dragSourcePile && dragSourcePile.type === 'tableau') {
                    const cardIndex = dragSourcePile.cardIndex + index;
                    cardInfo.element.style.zIndex = (30 + cardIndex).toString();
                }
            }
        });
        
        // Clear the hidden cards array
        window.hiddenCards = [];
    }
    
    // Clean up any orphaned preview elements
    const orphanedPreviews = document.querySelectorAll('.stack-preview');
    orphanedPreviews.forEach(element => {
        if (element.parentNode && element.parentNode.id !== 'stack-preview-container') {
            element.remove();
        }
    });
    
    // Reset global drag variables
    window.dragSourceRect = null;
}

// =============== GAME SETUP ===============

// Start a new game
function newGame() {
    // If there's an existing game in progress, count it as a loss
    if (gameState.startTime !== null) {
        gameStats.gamesPlayed++;
        gameStats.losses++;
        updateStatsDisplay();
    }
    
    // Track games for bookmark reminders
    bookmarkState.gamesSinceReminder++;
    
    // Clear any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Reset game state
    gameState = {
        deck: [],
        waste: [],
        foundations: [[], [], [], []],
        tableau: [[], [], [], [], [], [], []],
        moves: [],
        startTime: Date.now(),
        elapsedTime: 0,
        drawThree: gameState.drawThree // Preserve draw mode setting
    };
    
    // Create and shuffle a new deck
    createDeck();
    shuffleDeck();
    
    // Deal cards to tableau
    dealCards();
    
    // Start the timer
    startTimer();
    
    // Render the game state
    renderGameState();
    
    // Save state to URL
    saveToURL();
    
    // Show contextual bookmark reminder for new games
    if (gameStats.gamesPlayed > 0) {
        setTimeout(() => {
            showContextualBookmarkReminder('newGame');
        }, 5000); // Show after 5 seconds of new game
    }
    
    // Check for milestone reminders
    checkForMilestoneReminders();
}

// Create a new deck of cards
function createDeck() {
    gameState.deck = [];
    
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            gameState.deck.push({
                suit,
                rank,
                faceUp: false
            });
        }
    }
    
    console.log('Deck created with', gameState.deck.length, 'cards');
}

// Shuffle the deck using Fisher-Yates algorithm
function shuffleDeck() {
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
}

// Deal cards to tableau piles
function dealCards() {
    // Deal cards to tableau piles
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j <= i; j++) {
            const card = gameState.deck.pop();
            // Only the top card is face up
            card.faceUp = (j === i);
            gameState.tableau[i].push(card);
        }
    }
    
    console.log('Cards dealt to tableau');
    gameState.tableau.forEach((pile, i) => {
        console.log(`Tableau ${i}:`, pile.map(card => `${card.rank} of ${card.suit} (${card.faceUp ? 'face up' : 'face down'})`));
    });
}

// =============== GAME RENDERING ===============

// Render the current game state
function renderGameState() {
    // Clear all piles
    clearAllPiles();
    
    // Render stock pile
    renderStock();
    
    // Render waste pile
    renderWaste();
    
    // Render foundation piles
    renderFoundations();
    
    // Render tableau piles
    renderTableau();
}

// Clear all piles on the board
function clearAllPiles() {
    stockElement.innerHTML = '';
    wasteElement.innerHTML = '';
    foundationElements.forEach(el => el.innerHTML = '');
    tableauElements.forEach(el => el.innerHTML = '');
}

// Render the stock pile
function renderStock() {
    if (gameState.deck.length > 0) {
        const cardElement = createCardElement({ faceUp: false }, 0);
        stockElement.appendChild(cardElement);
    }
}

// Render the waste pile
function renderWaste() {
    wasteElement.innerHTML = ''; // Clear the waste pile first
    
    if (gameState.waste.length > 0) {
        // In draw three mode, show up to 3 cards with slight offset
        if (gameState.drawThree) {
            // Calculate how many cards to show (up to 3)
            const cardsToShow = Math.min(3, gameState.waste.length);
            const startIndex = gameState.waste.length - cardsToShow;
            
            // Create and position each visible waste card with a slight offset
            for (let i = 0; i < cardsToShow; i++) {
                const cardIndex = startIndex + i;
                const card = gameState.waste[cardIndex];
                const offset = i * 15; // 15px offset for each card
                
                const cardElement = createCardElement(card, 0);
                cardElement.style.left = `${offset}px`; // Offset cards horizontally
                cardElement.style.zIndex = i + 1; // Stack cards properly
                wasteElement.appendChild(cardElement);
                
                // Only the top card is draggable
                if (i === cardsToShow - 1) {
                    setupDragAndDrop(cardElement, 'waste', 0, gameState.waste.length - 1);
                }
            }
        } else {
            // In draw one mode, just show the top card
            const topCard = gameState.waste[gameState.waste.length - 1];
            const cardElement = createCardElement(topCard, 0);
            wasteElement.appendChild(cardElement);
            
            // Add drag functionality to the top waste card
            setupDragAndDrop(cardElement, 'waste', 0, gameState.waste.length - 1);
        }
    }
}

// Render foundation piles
function renderFoundations() {
    foundationElements.forEach((element, index) => {
        const pile = gameState.foundations[index];
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            const cardElement = createCardElement(topCard, 0);
            element.appendChild(cardElement);
            
            // Add drag functionality to the top foundation card
            setupDragAndDrop(cardElement, 'foundation', index, pile.length - 1);
        }
    });
}

// Render tableau piles
function renderTableau() {
    tableauElements.forEach((element, pileIndex) => {
        const pile = gameState.tableau[pileIndex];
        
        // Clear any existing cards
        element.innerHTML = '';
        
        pile.forEach((card, cardIndex) => {
            const cardElement = createCardElement(card, cardIndex * 20); // Offset each card by 20px
            
            // Set z-index to ensure proper stacking order
            // Use values in the 30-100 range to stay above pile (20) but below dragged cards (1000)
            cardElement.style.zIndex = (30 + cardIndex).toString();
            
            // Add data attributes for easier identification
            cardElement.dataset.pileType = 'tableau';
            cardElement.dataset.pileIndex = pileIndex;
            cardElement.dataset.cardIndex = cardIndex;
            
            element.appendChild(cardElement);
            
            // Add drag functionality to face-up cards
            if (card.faceUp) {
                // Explicitly set draggable attribute
                cardElement.setAttribute('draggable', 'true');
                
                // Set up drag and drop
                setupDragAndDrop(cardElement, 'tableau', pileIndex, cardIndex);
                
                // Make sure cards can receive drop events
                cardElement.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Find the tableau pile this card belongs to
                    const targetPileIndex = parseInt(cardElement.dataset.pileIndex);
                    
                    if (draggedCards.length > 0) {
                        const isValid = isValidMove(draggedCards, 'tableau', targetPileIndex);
                        e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
                    }
                });
                
                cardElement.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Find the tableau pile this card belongs to
                    const targetPileIndex = parseInt(cardElement.dataset.pileIndex);
                    
                    // Use the handleDrop function
                    handleDrop(e, 'tableau', targetPileIndex);
                });
            }
        });
    });
}

// Create a card element
function createCardElement(card, topOffset) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.style.top = `${topOffset}px`;
    
    // Store card data in the element for easier access
    cardElement.dataset.suit = card.suit;
    cardElement.dataset.rank = card.rank;
    
    if (!card.faceUp) {
        cardElement.classList.add('face-down');
        return cardElement;
    }
    
    // Add color class
    if (RED_SUITS.includes(card.suit)) {
        cardElement.classList.add('red');
    } else {
        cardElement.classList.add('black');
    }
    
    // Create card content
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';
    
    // Top part (rank and suit)
    const cardTop = document.createElement('div');
    cardTop.className = 'card-top';
    cardTop.textContent = `${card.rank}${getSuitSymbol(card.suit)}`;
    
    // Center part (suit symbol)
    const cardCenter = document.createElement('div');
    cardCenter.className = 'card-center';
    cardCenter.textContent = getSuitSymbol(card.suit);
    
    // Bottom part (rank and suit, upside down)
    const cardBottom = document.createElement('div');
    cardBottom.className = 'card-bottom';
    cardBottom.textContent = `${card.rank}${getSuitSymbol(card.suit)}`;
    
    // Append parts to card content
    cardContent.appendChild(cardTop);
    cardContent.appendChild(cardCenter);
    cardContent.appendChild(cardBottom);
    
    // Append content to card
    cardElement.appendChild(cardContent);
    
    return cardElement;
}

// Get suit symbol
function getSuitSymbol(suit) {
    switch (suit) {
        case 'hearts': return '♥';
        case 'diamonds': return '♦';
        case 'clubs': return '♣';
        case 'spades': return '♠';
        default: return '';
    }
}

// =============== GAME MECHANICS ===============

// Handle click on stock pile
function handleStockClick() {
    if (gameState.deck.length > 0) {
        // Record move for undo
        recordMove('drawCard', { drawThree: gameState.drawThree });
        
        // Draw cards from stock to waste
        if (gameState.drawThree) {
            // Draw up to three cards
            const cardsToDraw = Math.min(3, gameState.deck.length);
            for (let i = 0; i < cardsToDraw; i++) {
                const card = gameState.deck.pop();
                card.faceUp = true;
                gameState.waste.push(card);
            }
        } else {
            // Draw just one card
            const card = gameState.deck.pop();
            card.faceUp = true;
            gameState.waste.push(card);
        }
    } else if (gameState.waste.length > 0) {
        // Record move for undo
        recordMove('resetStock');
        
        // Reset stock from waste
        gameState.deck = gameState.waste.reverse().map(card => {
            return { ...card, faceUp: false };
        });
        gameState.waste = [];
    }
    
    // Render updated state
    renderGameState();
    
    // Save state to URL
    saveToURL();
    
    // Check for win/loss
    checkGameStatus();
}

// Get a card from a source pile
function getCardFromSource(sourceType, pileIndex, cardIndex) {
    if (sourceType === 'tableau') {
        return gameState.tableau[pileIndex][cardIndex];
    } else if (sourceType === 'waste') {
        return gameState.waste[cardIndex];
    } else if (sourceType === 'foundation') {
        return gameState.foundations[pileIndex][cardIndex];
    }
    return null;
}

// Handle drop event
function handleDrop(e, targetType, targetIndex) {
    // Prevent default behavior
    e.preventDefault();
    
    // Ensure we have dragged cards and source information
    if (draggedCards.length === 0 || !dragSourcePile) return;
    
    // Check if the move is valid
    if (isValidMove(draggedCards, targetType, targetIndex)) {
        // Record move for undo
        recordMove('moveCards', {
            sourceType: dragSourcePile.type,
            sourcePileIndex: dragSourcePile.index,
            sourceCardIndex: dragSourcePile.cardIndex,
            targetType,
            targetPileIndex: targetIndex
        });
        
        // Move the cards
        moveCards(dragSourcePile.type, dragSourcePile.index, dragSourcePile.cardIndex, targetType, targetIndex);
        
        // Render updated state
        renderGameState();
        
        // Save state to URL
        saveToURL();
        
        // Check for win/loss
        checkGameStatus();
    }
    
    // Reset drag state
    draggedCards = [];
    dragSourcePile = null;
}

// Try to move a card to a foundation pile
function tryMoveToFoundation(sourceType, pileIndex, cardIndex) {
    const card = getCardFromSource(sourceType, pileIndex, cardIndex);
    if (!card || !card.faceUp) return false;
    
    // Find a suitable foundation pile
    for (let i = 0; i < 4; i++) {
        if (isValidFoundationMove(card, i)) {
            // Record move for undo
            recordMove('moveToFoundation', { 
                sourceType, 
                sourcePileIndex: pileIndex, 
                sourceCardIndex: cardIndex, 
                targetFoundationIndex: i 
            });
            
            // Move the card
            moveCardToFoundation(sourceType, pileIndex, cardIndex, i);
            
            // Render updated state
            renderGameState();
            
            // Save state to URL
            saveToURL();
            
            // Check for win/loss
            checkGameStatus();
            
            return true;
        }
    }
    
    return false;
}

// Check if a card can be moved to a foundation pile
function isValidFoundationMove(card, foundationIndex) {
    const foundation = gameState.foundations[foundationIndex];
    const foundationSuit = SUITS[foundationIndex];
    
    // Card must match the foundation suit
    if (card.suit !== foundationSuit) {
        return false;
    }
    
    // If foundation is empty, only Ace can be placed
    if (foundation.length === 0) {
        return card.rank === 'A';
    }
    
    // Otherwise, check if card is next rank
    const topCard = foundation[foundation.length - 1];
    
    // Ensure the foundation only contains cards of the same suit
    if (card.suit !== topCard.suit) {
        return false;
    }
    
    return getNextRank(topCard.rank) === card.rank;
}

// Move a card to a foundation pile
function moveCardToFoundation(sourceType, sourcePileIndex, sourceCardIndex, targetFoundationIndex) {
    let card;
    
    // Remove card from source
    if (sourceType === 'tableau') {
        card = gameState.tableau[sourcePileIndex].pop();
        
        // Flip the new top card if needed
        if (gameState.tableau[sourcePileIndex].length > 0) {
            const newTopCard = gameState.tableau[sourcePileIndex][gameState.tableau[sourcePileIndex].length - 1];
            if (!newTopCard.faceUp) {
                newTopCard.faceUp = true;
            }
        }
    } else if (sourceType === 'waste') {
        card = gameState.waste.pop();
    }
    
    // Add card to foundation
    gameState.foundations[targetFoundationIndex].push(card);
}

// Get the next rank in sequence
function getNextRank(rank) {
    const rankIndex = RANKS.indexOf(rank);
    if (rankIndex < RANKS.length - 1) {
        return RANKS[rankIndex + 1];
    }
    return null;
}

// Record a move for undo
function recordMove(type, details = {}) {
    gameState.moves.push({
        type,
        details,
        state: JSON.parse(JSON.stringify({
            deck: gameState.deck,
            waste: gameState.waste,
            foundations: gameState.foundations,
            tableau: gameState.tableau,
            drawThree: gameState.drawThree
        }))
    });
}

// Undo the last move
function undoMove() {
    if (gameState.moves.length === 0) return;
    
    // Get the last move
    const lastMove = gameState.moves.pop();
    
    // Restore the state before the move
    gameState.deck = lastMove.state.deck;
    gameState.waste = lastMove.state.waste;
    gameState.foundations = lastMove.state.foundations;
    gameState.tableau = lastMove.state.tableau;
    gameState.drawThree = lastMove.state.drawThree;
    
    // Render updated state
    renderGameState();
    
    // Save state to URL
    saveToURL();
    
    // Update the draw three toggle to match the game state
    drawThreeToggle.checked = gameState.drawThree;
}

// Check if the game is won or lost
function checkGameStatus() {
    // Check for win: all foundations have 13 cards (A through K)
    const isWin = gameState.foundations.every(foundation => foundation.length === 13);
    
    if (isWin) {
        // Stop the timer
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Update stats
        gameStats.gamesPlayed++;
        gameStats.wins++;
        
        // Record completion time
        const completionTime = gameState.elapsedTime;
        gameStats.fastestTimes.push(completionTime);
        gameStats.fastestTimes.sort((a, b) => a - b);
        gameStats.fastestTimes = gameStats.fastestTimes.slice(0, 10); // Keep only top 10
        
        // Update stats display
        updateStatsDisplay();
        
        // Show win message
        showToast(`You won in ${formatTime(completionTime)}! Update your bookmark (Ctrl+D / Cmd+D) to save your progress.`);
        
        // Show bookmark reminder for wins
        showGameCompletionBookmarkReminder(true);
        
        // Reset game state
        gameState.startTime = null;
        
        // Save state and stats to URL
        saveToURL();
        
        // Check for winning streak reminders
        checkForWinningStreakReminder();
        
    } else if (isGameLost()) {
        // Stop the timer
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Update stats
        gameStats.gamesPlayed++;
        gameStats.losses++;
        
        // Update stats display
        updateStatsDisplay();
        
        // Show loss message
        showToast("No more valid moves! Game over. Update your bookmark (Ctrl+D / Cmd+D) to save your progress.");
        
        // Show bookmark reminder for losses
        showGameCompletionBookmarkReminder(false);
        
        // Reset game state
        gameState.startTime = null;
        
        // Save state and stats to URL
        saveToURL();
    }
}

// Check if the game is lost (no valid moves left)
function isGameLost() {
    console.log("Checking for game loss condition...");
    
    // If there are still cards in the deck, we can draw
    if (gameState.deck.length > 0) {
        console.log("Game is not lost: Cards remain in the deck");
        return false;
    }
    
    // Check if any waste card can be moved
    if (gameState.waste.length > 0) {
        const wasteCard = gameState.waste[gameState.waste.length - 1];
        
        // Check if waste card can be moved to any foundation
        for (let i = 0; i < 4; i++) {
            if (isValidFoundationMove(wasteCard, i)) {
                console.log(`Game is not lost: Can move ${wasteCard.rank} of ${wasteCard.suit} from waste to foundation ${i}`);
                return false;
            }
        }
        
        // Check if waste card can be moved to any tableau pile
        for (let i = 0; i < 7; i++) {
            if (canMoveToTableau(wasteCard, i)) {
                console.log(`Game is not lost: Can move ${wasteCard.rank} of ${wasteCard.suit} from waste to tableau ${i}`);
                return false;
            }
        }
    }
    
    // Check for tableau to tableau moves
    for (let sourceIndex = 0; sourceIndex < 7; sourceIndex++) {
        const sourcePile = gameState.tableau[sourceIndex];
        
        // Skip empty piles
        if (sourcePile.length === 0) continue;
        
        // Find the first face-up card
        let faceUpIndex = -1;
        for (let j = 0; j < sourcePile.length; j++) {
            if (sourcePile[j].faceUp) {
                faceUpIndex = j;
                break;
            }
        }
        
        if (faceUpIndex === -1) continue;
        
        // Check each face-up card for possible moves
        for (let cardIndex = faceUpIndex; cardIndex < sourcePile.length; cardIndex++) {
            const card = sourcePile[cardIndex];
            
            // Check if card can be moved to any foundation
            for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
                if (isValidFoundationMove(card, foundationIndex)) {
                    console.log(`Game is not lost: Can move ${card.rank} of ${card.suit} from tableau ${sourceIndex} to foundation ${foundationIndex}`);
                    return false;
                }
            }
            
            // Check if card can be moved to any other tableau pile
            for (let targetIndex = 0; targetIndex < 7; targetIndex++) {
                if (targetIndex !== sourceIndex) {
                    if (canMoveToTableau(card, targetIndex)) {
                        console.log(`Game is not lost: Can move ${card.rank} of ${card.suit} from tableau ${sourceIndex} to tableau ${targetIndex}`);
                        return false;
                    }
                }
            }
        }
    }
    
    // Check if any foundation card can be moved to tableau
    for (let i = 0; i < 4; i++) {
        const foundation = gameState.foundations[i];
        
        // Skip empty foundations
        if (foundation.length === 0) continue;
        
        const topCard = foundation[foundation.length - 1];
        
        // Check if foundation card can be moved to any tableau pile
        for (let j = 0; j < 7; j++) {
            if (canMoveToTableau(topCard, j)) {
                console.log(`Game is not lost: Can move ${topCard.rank} of ${topCard.suit} from foundation ${i} to tableau ${j}`);
                return false;
            }
        }
    }
    
    // If we get here, no valid moves were found
    console.log("Game is lost: No valid moves detected");
    return true;
}

// Check if a card can be moved to a tableau pile
function canMoveToTableau(card, tableauIndex) {
    const targetPile = gameState.tableau[tableauIndex];
    
    // If target pile is empty, only Kings can be placed
    if (targetPile.length === 0) {
        return card.rank === 'K';
    }
    
    // Otherwise, check if card can be placed on the top card of the target pile
    const targetTopCard = targetPile[targetPile.length - 1];
    
    // Target card must be face up
    if (!targetTopCard.faceUp) {
        return false;
    }
    
    // Card must be opposite color and one rank lower
    const isOppositeColor = (RED_SUITS.includes(card.suit) && BLACK_SUITS.includes(targetTopCard.suit)) ||
                           (BLACK_SUITS.includes(card.suit) && RED_SUITS.includes(targetTopCard.suit));
    
    // Check if the card's rank is one lower than the target card
    const cardRankIndex = RANKS.indexOf(card.rank);
    const targetRankIndex = RANKS.indexOf(targetTopCard.rank);
    
    const isOneLower = cardRankIndex === targetRankIndex - 1;
    
    if (!isOppositeColor || !isOneLower) {
        return false;
    }
    
    return true;
}

// =============== TIMER FUNCTIONS ===============

// Start the game timer
function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        if (gameState.startTime) {
            gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
            
            // Check for long session reminders every 5 minutes
            if (gameState.elapsedTime > 0 && gameState.elapsedTime % 300 === 0) {
                checkForLongSessionReminder();
            }
        }
    }, 1000);
}

// Format time in MM:SS format
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// =============== STATS FUNCTIONS ===============

// Update the stats display
function updateStatsDisplay() {
    gamesPlayedElement.textContent = gameStats.gamesPlayed;
    winsElement.textContent = gameStats.wins;
    lossesElement.textContent = gameStats.losses;
    
    // Display fastest time if available
    if (gameStats.fastestTimes.length > 0) {
        fastestTimeElement.textContent = formatTime(gameStats.fastestTimes[0]);
    } else {
        fastestTimeElement.textContent = '--:--';
    }
}

// =============== URL STATE MANAGEMENT ===============

// Save game state and stats to URL
function saveToURL() {
    // Always save to localStorage as backup
    if (navigator.onLine) {
        // Online: Save to URL (primary) and localStorage (backup)
        try {
            // Create a simplified state object for encoding
            const stateToSave = {
                d: gameState.deck.map(card => encodeCard(card)),
                w: gameState.waste.map(card => encodeCard(card)),
                f: gameState.foundations.map(pile => pile.map(card => encodeCard(card))),
                t: gameState.tableau.map(pile => pile.map(card => encodeCard(card))),
                time: gameState.elapsedTime,
                start: gameState.startTime ? true : false,
                draw3: gameState.drawThree
            };
            
            // Create a simplified stats object for encoding
            const statsToSave = {
                g: gameStats.gamesPlayed,
                w: gameStats.wins,
                l: gameStats.losses,
                t: gameStats.fastestTimes
            };
            
            // Encode state and stats as base64 strings
            const stateStr = btoa(JSON.stringify(stateToSave));
            const statsStr = btoa(JSON.stringify(statsToSave));
            
            // Update URL without reloading the page
            const url = new URL(window.location.href);
            url.searchParams.set('state', stateStr);
            url.searchParams.set('stats', statsStr);
            window.history.pushState({}, '', url);
            
            // Also save to localStorage as backup
            saveToLocalStorage();
        } catch (error) {
            console.error('Error saving to URL:', error);
            // Fallback to localStorage only
            saveToLocalStorage();
        }
    } else {
        // Offline: Save to localStorage only
        saveToLocalStorage();
    }
}

// Load game state and stats from URL
function loadFromURL() {
    const url = new URL(window.location.href);
    const stateStr = url.searchParams.get('state');
    const statsStr = url.searchParams.get('stats');
    
    // Load stats if available
    if (statsStr) {
        try {
            const loadedStats = JSON.parse(atob(statsStr));
            gameStats.gamesPlayed = loadedStats.g || 0;
            gameStats.wins = loadedStats.w || 0;
            gameStats.losses = loadedStats.l || 0;
            gameStats.fastestTimes = loadedStats.t || [];
        } catch (e) {
            console.error('Error loading stats from URL:', e);
        }
    }
    
    // Load game state if available
    if (stateStr) {
        try {
            const loadedState = JSON.parse(atob(stateStr));
            
            // Decode cards
            gameState.deck = (loadedState.d || []).map(code => decodeCard(code));
            gameState.waste = (loadedState.w || []).map(code => decodeCard(code));
            gameState.foundations = (loadedState.f || [[], [], [], []]).map(pile => 
                pile.map(code => decodeCard(code))
            );
            gameState.tableau = (loadedState.t || [[], [], [], [], [], [], []]).map(pile => 
                pile.map(code => decodeCard(code))
            );
            
            // Validate the loaded state
            validateGameState();
            
            // Load time info
            gameState.elapsedTime = loadedState.time || 0;
            gameState.startTime = loadedState.start ? Date.now() - (gameState.elapsedTime * 1000) : null;
            
            // Load draw three setting
            gameState.drawThree = loadedState.draw3 || false;
        } catch (e) {
            console.error('Error loading game state from URL:', e);
            // If error, start a new game
            newGame();
        }
    }
}

// Encode a card to a compact string representation
function encodeCard(card) {
    // Encode rank (0-12), suit (0-3), and face-up status (0-1) into a single string
    const rankIndex = RANKS.indexOf(card.rank);
    const suitIndex = SUITS.indexOf(card.suit);
    const faceUp = card.faceUp ? 1 : 0;
    
    // Format: RSUF (Rank, Suit, Up/Face-down)
    // Use two digits for rank to handle 10 (index 9)
    return `${rankIndex.toString().padStart(2, '0')}${suitIndex}${faceUp}`;
}

// Decode a card from its compact string representation
function decodeCard(code) {
    // Extract rank, suit, and face-up status
    const rankIndex = parseInt(code.substring(0, 2), 10);
    const suitIndex = parseInt(code.charAt(2), 10);
    const faceUp = code.charAt(3) === '1';
    
    // Validate indices to prevent errors
    if (rankIndex < 0 || rankIndex >= RANKS.length || suitIndex < 0 || suitIndex >= SUITS.length) {
        console.error('Invalid card code:', code);
        // Return a default card if the indices are invalid
        return {
            rank: 'A',
            suit: 'spades',
            faceUp: false
        };
    }
    
    return {
        rank: RANKS[rankIndex],
        suit: SUITS[suitIndex],
        faceUp
    };
}

// Validate the game state to ensure all cards are valid
function validateGameState() {
    // Check deck
    gameState.deck = gameState.deck.filter(card => 
        card && RANKS.includes(card.rank) && SUITS.includes(card.suit)
    );
    
    // Check waste
    gameState.waste = gameState.waste.filter(card => 
        card && RANKS.includes(card.rank) && SUITS.includes(card.suit)
    );
    
    // Check foundations
    gameState.foundations = gameState.foundations.map(pile => 
        pile.filter(card => card && RANKS.includes(card.rank) && SUITS.includes(card.suit))
    );
    
    // Check tableau
    gameState.tableau = gameState.tableau.map(pile => 
        pile.filter(card => card && RANKS.includes(card.rank) && SUITS.includes(card.suit))
    );
    
    // Ensure all cards have the required properties
    const ensureCardProperties = (card) => {
        if (!card.hasOwnProperty('faceUp')) {
            card.faceUp = false;
        }
        return card;
    };
    
    gameState.deck = gameState.deck.map(ensureCardProperties);
    gameState.waste = gameState.waste.map(ensureCardProperties);
    gameState.foundations = gameState.foundations.map(pile => pile.map(ensureCardProperties));
    gameState.tableau = gameState.tableau.map(pile => pile.map(ensureCardProperties));
}

// =============== UI HELPERS ===============

// Show a toast notification
function showToast(message, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after animation completes
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// =============== INITIALIZE GAME ===============
document.addEventListener('DOMContentLoaded', init);

// Check if a move is valid
function isValidMove(cards, targetType, targetIndex) {
    const firstCard = cards[0];
    
    if (targetType === 'foundation') {
        // Only single cards can be moved to foundation
        if (cards.length !== 1) return false;
        
        return isValidFoundationMove(firstCard, targetIndex);
    } else if (targetType === 'tableau') {
        const targetPile = gameState.tableau[targetIndex];
        
        // If target pile is empty, only Kings can be placed
        if (targetPile.length === 0) {
            return firstCard.rank === 'K';
        }
        
        // Otherwise, check if card can be placed on the top card of the target pile
        const targetTopCard = targetPile[targetPile.length - 1];
        
        // Target card must be face up
        if (!targetTopCard.faceUp) {
            return false;
        }
        
        // Card must be opposite color and one rank lower than the target card
        // (e.g., red 5 can be placed on black 6)
        const isOppositeColor = (RED_SUITS.includes(firstCard.suit) && BLACK_SUITS.includes(targetTopCard.suit)) ||
                               (BLACK_SUITS.includes(firstCard.suit) && RED_SUITS.includes(targetTopCard.suit));
        
        // The dragged card should be one rank LOWER than the target card
        const isCorrectRank = getNextRank(firstCard.rank) === targetTopCard.rank;
        
        console.log('Move validation:', {
            firstCard: `${firstCard.rank} of ${firstCard.suit}`,
            targetCard: `${targetTopCard.rank} of ${targetTopCard.suit}`,
            isOppositeColor,
            isCorrectRank,
            valid: isOppositeColor && isCorrectRank
        });
        
        return isOppositeColor && isCorrectRank;
    }
    
    return false;
}

// Move cards from one pile to another
function moveCards(sourceType, sourcePileIndex, sourceCardIndex, targetType, targetPileIndex) {
    let cardsToMove = [];
    
    // Get cards to move from source
    if (sourceType === 'tableau') {
        const sourcePile = gameState.tableau[sourcePileIndex];
        cardsToMove = sourcePile.splice(sourceCardIndex);
        
        // Flip the new top card if needed
        if (sourcePile.length > 0) {
            const newTopCard = sourcePile[sourcePile.length - 1];
            if (!newTopCard.faceUp) {
                newTopCard.faceUp = true;
            }
        }
    } else if (sourceType === 'waste') {
        // In draw three mode, we need to be careful about which card to remove
        if (gameState.drawThree) {
            // Remove only the specific card that was dragged (the top card)
            cardsToMove = [gameState.waste.pop()];
        } else {
            // In draw one mode, just pop the top card
            cardsToMove = [gameState.waste.pop()];
        }
    } else if (sourceType === 'foundation') {
        cardsToMove = [gameState.foundations[sourcePileIndex].pop()];
    }
    
    // Add cards to target
    if (targetType === 'tableau') {
        gameState.tableau[targetPileIndex].push(...cardsToMove);
    } else if (targetType === 'foundation') {
        gameState.foundations[targetPileIndex].push(...cardsToMove);
    }
}

// Get the previous rank in sequence
function getPrevRank(rank) {
    const rankIndex = RANKS.indexOf(rank);
    if (rankIndex > 0) {
        return RANKS[rankIndex - 1];
    }
    return null;
}

// Check for milestone reminders
function checkForMilestoneReminders() {
    const milestones = [5, 10, 25, 50, 100];
    
    if (milestones.includes(gameStats.gamesPlayed)) {
        setTimeout(() => {
            showContextualBookmarkReminder('milestone');
        }, 3000);
    }
}

// Check for winning streak reminders
function checkForWinningStreakReminder() {
    // Calculate recent wins (simple check for consecutive wins)
    if (gameStats.wins >= 3 && gameStats.wins % 3 === 0) {
        setTimeout(() => {
            showContextualBookmarkReminder('goodStreak');
        }, 4000);
    }
}

// Check for long session reminders
function checkForLongSessionReminder() {
    const sessionTime = Date.now() - bookmarkState.sessionStartTime;
    
    // Show reminder after 20 minutes of continuous play
    if (sessionTime > 1200000 && shouldShowBookmarkReminder()) {
        showContextualBookmarkReminder('longSession');
    }
}

// Handle bookmark button click
function handleBookmarkClick() {
    // Save current state first
    saveToURL();
    
    if (offlineState.isOffline) {
        // Offline mode - save to localStorage
        bookmarkButton.classList.add('saved');
        bookmarkButton.textContent = '✅ Saved Locally!';
        
        setTimeout(() => {
            bookmarkButton.classList.remove('saved');
            bookmarkButton.textContent = '💾 Save Locally';
        }, 2000);
        
        showToast('💾 Progress saved to local storage! Will sync when back online.', 5000);
    } else {
        // Online mode - bookmark instructions
        bookmarkButton.classList.add('saved');
        bookmarkButton.textContent = '✅ Ready to Save!';
        
        setTimeout(() => {
            bookmarkButton.classList.remove('saved');
            bookmarkButton.textContent = '📌 Save Progress';
        }, 2000);
        
        // Show helpful instructions
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const shortcut = isMac ? 'Cmd+D' : 'Ctrl+D';
        
        showToast(`Press ${shortcut} now to bookmark this page and save your progress!`, 6000);
        
        // Try to trigger browser bookmark dialog (limited browser support)
        if (window.sidebar && window.sidebar.addPanel) {
            // Firefox
            window.sidebar.addPanel(document.title, window.location.href, '');
        } else if (window.external && ('AddFavorite' in window.external)) {
            // Internet Explorer
            window.external.AddFavorite(window.location.href, document.title);
        }
    }
    
    // Update bookmark reminder state
    bookmarkState.lastReminder = Date.now();
}

// =============== OFFLINE MODE MANAGEMENT ===============

// Initialize offline mode detection
function initializeOfflineMode() {
    // Set initial offline state
    updateOfflineStatus();
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);
    
    // Load from localStorage as backup when offline
    if (!navigator.onLine) {
        loadFromLocalStorage();
    }
    
    console.log('Offline mode initialized. Current status:', navigator.onLine ? 'Online' : 'Offline');
}

// Handle going online
function handleOnlineEvent() {
    console.log('Back online! Syncing data...');
    updateOfflineStatus();
    
    // Sync localStorage data to URL if needed
    if (offlineState.pendingSync) {
        syncOfflineData();
    }
    
    showToast('🌐 Back online! Your progress has been synced.', 4000);
}

// Handle going offline
function handleOfflineEvent() {
    console.log('Gone offline. Switching to local storage...');
    updateOfflineStatus();
    
    // Save current state to localStorage
    saveToLocalStorage();
    
    showToast('🔌 Offline mode activated. Your progress is saved locally.', 5000);
}

// Update offline status
function updateOfflineStatus() {
    const wasOffline = offlineState.isOffline;
    offlineState.isOffline = !navigator.onLine;
    
    // Update UI if status changed
    if (wasOffline !== offlineState.isOffline) {
        updateOfflineUI();
    }
}

// Update UI for offline mode
function updateOfflineUI() {
    const body = document.body;
    
    if (offlineState.isOffline) {
        body.classList.add('offline');
        
        // Update bookmark button text for offline
        if (bookmarkButton) {
            bookmarkButton.textContent = '💾 Save Locally';
            bookmarkButton.title = 'Save your progress to local storage (offline mode)';
        }
    } else {
        body.classList.remove('offline');
        
        // Restore bookmark button text for online
        if (bookmarkButton) {
            bookmarkButton.textContent = '📌 Save Progress';
            bookmarkButton.title = 'Save your progress by bookmarking this page';
        }
    }
}

// Sync offline data when back online
function syncOfflineData() {
    try {
        const localData = localStorage.getItem('solitaire-offline-state');
        const localStats = localStorage.getItem('solitaire-offline-stats');
        
        if (localData || localStats) {
            // Update URL with offline data
            saveToURL();
            
            // Clear offline sync flag
            offlineState.pendingSync = false;
            offlineState.lastOnlineSync = Date.now();
            
            console.log('Offline data synced to URL');
        }
    } catch (error) {
        console.error('Error syncing offline data:', error);
    }
}

// Save to localStorage (offline backup)
function saveToLocalStorage() {
    try {
        const stateToSave = {
            d: gameState.deck.map(card => encodeCard(card)),
            w: gameState.waste.map(card => encodeCard(card)),
            f: gameState.foundations.map(pile => pile.map(card => encodeCard(card))),
            t: gameState.tableau.map(pile => pile.map(card => encodeCard(card))),
            time: gameState.elapsedTime,
            start: gameState.startTime ? true : false,
            draw3: gameState.drawThree,
            timestamp: Date.now()
        };
        
        const statsToSave = {
            g: gameStats.gamesPlayed,
            w: gameStats.wins,
            l: gameStats.losses,
            t: gameStats.fastestTimes,
            timestamp: Date.now()
        };
        
        localStorage.setItem('solitaire-offline-state', JSON.stringify(stateToSave));
        localStorage.setItem('solitaire-offline-stats', JSON.stringify(statsToSave));
        
        // Mark as needing sync when back online
        offlineState.pendingSync = true;
        
        console.log('Game state saved to localStorage');
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showToast('⚠️ Could not save locally. Storage may be full.', 4000);
    }
}

// Load from localStorage (offline backup)
function loadFromLocalStorage() {
    try {
        const localState = localStorage.getItem('solitaire-offline-state');
        const localStats = localStorage.getItem('solitaire-offline-stats');
        
        // Load stats if available
        if (localStats) {
            const loadedStats = JSON.parse(localStats);
            gameStats.gamesPlayed = loadedStats.g || 0;
            gameStats.wins = loadedStats.w || 0;
            gameStats.losses = loadedStats.l || 0;
            gameStats.fastestTimes = loadedStats.t || [];
            
            console.log('Stats loaded from localStorage');
        }
        
        // Load game state if available
        if (localState) {
            const loadedState = JSON.parse(localState);
            
            // Decode cards
            gameState.deck = (loadedState.d || []).map(code => decodeCard(code));
            gameState.waste = (loadedState.w || []).map(code => decodeCard(code));
            gameState.foundations = (loadedState.f || [[], [], [], []]).map(pile => 
                pile.map(code => decodeCard(code))
            );
            gameState.tableau = (loadedState.t || [[], [], [], [], [], [], []]).map(pile => 
                pile.map(code => decodeCard(code))
            );
            
            // Validate the loaded state
            validateGameState();
            
            // Load time info
            gameState.elapsedTime = loadedState.time || 0;
            gameState.startTime = loadedState.start ? Date.now() - (gameState.elapsedTime * 1000) : null;
            gameState.drawThree = loadedState.draw3 || false;
            
            console.log('Game state loaded from localStorage');
            showToast('📱 Offline game loaded from local storage', 3000);
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

// =============== HELPER FUNCTIONS FOR TESTING ===============

// Generate a game state that's one move away from winning
function generateNearWinState() {
    // Create foundations with almost all cards (missing one King of Spades)
    const foundations = [
        // Hearts foundation (complete A-K)
        [
            {suit: 'hearts', rank: 'A', faceUp: true},
            {suit: 'hearts', rank: '2', faceUp: true},
            {suit: 'hearts', rank: '3', faceUp: true},
            {suit: 'hearts', rank: '4', faceUp: true},
            {suit: 'hearts', rank: '5', faceUp: true},
            {suit: 'hearts', rank: '6', faceUp: true},
            {suit: 'hearts', rank: '7', faceUp: true},
            {suit: 'hearts', rank: '8', faceUp: true},
            {suit: 'hearts', rank: '9', faceUp: true},
            {suit: 'hearts', rank: '10', faceUp: true},
            {suit: 'hearts', rank: 'J', faceUp: true},
            {suit: 'hearts', rank: 'Q', faceUp: true},
            {suit: 'hearts', rank: 'K', faceUp: true}
        ],
        // Diamonds foundation (complete A-K)
        [
            {suit: 'diamonds', rank: 'A', faceUp: true},
            {suit: 'diamonds', rank: '2', faceUp: true},
            {suit: 'diamonds', rank: '3', faceUp: true},
            {suit: 'diamonds', rank: '4', faceUp: true},
            {suit: 'diamonds', rank: '5', faceUp: true},
            {suit: 'diamonds', rank: '6', faceUp: true},
            {suit: 'diamonds', rank: '7', faceUp: true},
            {suit: 'diamonds', rank: '8', faceUp: true},
            {suit: 'diamonds', rank: '9', faceUp: true},
            {suit: 'diamonds', rank: '10', faceUp: true},
            {suit: 'diamonds', rank: 'J', faceUp: true},
            {suit: 'diamonds', rank: 'Q', faceUp: true},
            {suit: 'diamonds', rank: 'K', faceUp: true}
        ],
        // Clubs foundation (complete A-K)
        [
            {suit: 'clubs', rank: 'A', faceUp: true},
            {suit: 'clubs', rank: '2', faceUp: true},
            {suit: 'clubs', rank: '3', faceUp: true},
            {suit: 'clubs', rank: '4', faceUp: true},
            {suit: 'clubs', rank: '5', faceUp: true},
            {suit: 'clubs', rank: '6', faceUp: true},
            {suit: 'clubs', rank: '7', faceUp: true},
            {suit: 'clubs', rank: '8', faceUp: true},
            {suit: 'clubs', rank: '9', faceUp: true},
            {suit: 'clubs', rank: '10', faceUp: true},
            {suit: 'clubs', rank: 'J', faceUp: true},
            {suit: 'clubs', rank: 'Q', faceUp: true},
            {suit: 'clubs', rank: 'K', faceUp: true}
        ],
        // Spades foundation (missing only the King)
        [
            {suit: 'spades', rank: 'A', faceUp: true},
            {suit: 'spades', rank: '2', faceUp: true},
            {suit: 'spades', rank: '3', faceUp: true},
            {suit: 'spades', rank: '4', faceUp: true},
            {suit: 'spades', rank: '5', faceUp: true},
            {suit: 'spades', rank: '6', faceUp: true},
            {suit: 'spades', rank: '7', faceUp: true},
            {suit: 'spades', rank: '8', faceUp: true},
            {suit: 'spades', rank: '9', faceUp: true},
            {suit: 'spades', rank: '10', faceUp: true},
            {suit: 'spades', rank: 'J', faceUp: true},
            {suit: 'spades', rank: 'Q', faceUp: true}
        ]
    ];
    
    // Create tableau with only the King of Spades in the first pile
    const tableau = [
        [{suit: 'spades', rank: 'K', faceUp: true}], // The winning card
        [], [], [], [], [], [] // All other piles empty
    ];
    
    // Set the game state
    gameState = {
        deck: [], // Empty deck
        waste: [], // Empty waste
        foundations: foundations,
        tableau: tableau,
        moves: [],
        startTime: Date.now(),
        elapsedTime: 30, // 30 seconds elapsed
        drawThree: false
    };
    
    // Set some stats to make it look like a real game
    gameStats = {
        gamesPlayed: 5,
        wins: 2,
        losses: 2,
        fastestTimes: [180, 240, 300]
    };
    
    // Save to URL and return the URL
    saveToURL();
    return window.location.href;
} 