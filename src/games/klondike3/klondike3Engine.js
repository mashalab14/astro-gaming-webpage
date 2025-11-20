/**
 * Klondike Draw 3 Solitaire Engine
 * Implements the classic Klondike solitaire with draw-3 stock behavior
 */

class Klondike3Engine {
  constructor() {
    this.rootElement = null;
    this.callbacks = null;
    this.gameState = null;
    this.eventListeners = [];
    this.firstMoveDone = false;
    this.firstMoveTimestamp = null;
  }

  /**
   * Initialize the game inside the provided root element
   * @param {HTMLElement} rootElement - Container element from GameCanvas
   * @param {Object} callbacks - Shell callbacks { onFirstMove, onMove, onWin, onReset }
   */
  mount(rootElement, callbacks) {
    this.rootElement = rootElement;
    this.callbacks = callbacks;
    
    // Clear any existing content
    rootElement.innerHTML = '';
    
    // Initialize game state
    this.initializeGameState();
    
    // Create DOM structure
    this.createGameDOM();
    
    // Start a new deal
    this.startNewDeal();
  }

  /**
   * Initialize empty game state structure
   */
  initializeGameState() {
    this.gameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []], // Hearts, Diamonds, Clubs, Spades
      tableau: [[], [], [], [], [], [], []], // 7 columns
      moveCount: 0,
      score: 0
    };
    this.firstMoveDone = false;
    this.firstMoveTimestamp = null;
  }

  /**
   * Create the main DOM structure for the game
   */
  createGameDOM() {
    const gameRoot = document.createElement('div');
    gameRoot.className = 'klondike-root';
    
    gameRoot.innerHTML = `
      <div class="klondike-game-area">
        <!-- Top row: Stock/Waste and Foundations -->
        <div class="klondike-top-row">
          <div class="klondike-stock-waste">
            <div class="klondike-stock-pile" id="stock-pile">
              <div class="klondike-card-placeholder">Stock</div>
            </div>
            <div class="klondike-waste-pile" id="waste-pile">
              <div class="klondike-card-placeholder">Waste</div>
            </div>
          </div>
          
          <div class="klondike-foundations">
            <div class="klondike-foundation" id="foundation-0" data-suit="0">
              <div class="klondike-card-placeholder">♥</div>
            </div>
            <div class="klondike-foundation" id="foundation-1" data-suit="1">
              <div class="klondike-card-placeholder">♦</div>
            </div>
            <div class="klondike-foundation" id="foundation-2" data-suit="2">
              <div class="klondike-card-placeholder">♣</div>
            </div>
            <div class="klondike-foundation" id="foundation-3" data-suit="3">
              <div class="klondike-card-placeholder">♠</div>
            </div>
          </div>
        </div>
        
        <!-- Bottom row: Tableau -->
        <div class="klondike-tableau">
          <div class="klondike-tableau-column" id="tableau-0"></div>
          <div class="klondike-tableau-column" id="tableau-1"></div>
          <div class="klondike-tableau-column" id="tableau-2"></div>
          <div class="klondike-tableau-column" id="tableau-3"></div>
          <div class="klondike-tableau-column" id="tableau-4"></div>
          <div class="klondike-tableau-column" id="tableau-5"></div>
          <div class="klondike-tableau-column" id="tableau-6"></div>
        </div>
      </div>
    `;

    this.rootElement.appendChild(gameRoot);
    this.attachEventListeners();
  }

  /**
   * Attach event listeners for game interactions
   */
  attachEventListeners() {
    const stockPile = this.rootElement.querySelector('#stock-pile');
    
    // Stock pile click handler
    const stockClickHandler = (e) => {
      e.preventDefault();
      this.handleStockClick();
    };
    
    stockPile.addEventListener('click', stockClickHandler);
    this.eventListeners.push({ element: stockPile, event: 'click', handler: stockClickHandler });

    // Add drag and drop handlers for cards (will be added when cards are created)
    this.attachCardEventListeners();
  }

  /**
   * Attach event listeners to cards for drag and drop
   */
  attachCardEventListeners() {
    const cards = this.rootElement.querySelectorAll('.klondike-card');
    
    cards.forEach(card => {
      if (!card.dataset.hasListeners) {
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleCardClick(card);
        };
        
        card.addEventListener('click', clickHandler);
        card.dataset.hasListeners = 'true';
        this.eventListeners.push({ element: card, event: 'click', handler: clickHandler });
      }
    });
  }

  /**
   * Start a new deal - reset and shuffle cards
   */
  startNewDeal() {
    // Reset game state
    this.gameState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []], // Hearts, Diamonds, Clubs, Spades
      tableau: [[], [], [], [], [], [], []], // 7 columns
      moveCount: 0,
      score: 0
    };
    
    this.firstMoveDone = false;
    this.firstMoveTimestamp = null;

    // Create and shuffle deck
    const deck = this.createDeck();
    this.shuffleDeck(deck);

    // Deal tableau (standard Klondike layout)
    this.dealTableau(deck);

    // Remaining cards go to stock
    this.gameState.stock = deck;

    // Update DOM
    this.updateDisplay();

    // Notify shell of reset
    if (this.callbacks && this.callbacks.onReset) {
      this.callbacks.onReset();
    }
  }

  /**
   * Create a standard 52-card deck
   */
  createDeck() {
    const suits = [0, 1, 2, 3]; // Hearts, Diamonds, Clubs, Spades
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // Ace to King
    const deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          suit: suit,
          rank: rank,
          faceUp: false,
          id: `card-${suit}-${rank}`
        });
      }
    }

    return deck;
  }

  /**
   * Shuffle deck using Fisher-Yates algorithm
   */
  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  /**
   * Deal cards to tableau in standard Klondike pattern
   */
  dealTableau(deck) {
    // Deal tableau: column 0 gets 1 card, column 1 gets 2 cards, etc.
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.pop();
        if (row === col) {
          card.faceUp = true; // Top card is face up
        }
        this.gameState.tableau[col].push(card);
      }
    }
  }

  /**
   * Handle stock pile click (draw 3 cards)
   */
  handleStockClick() {
    if (this.gameState.stock.length > 0) {
      // Draw up to 3 cards from stock to waste
      const drawCount = Math.min(3, this.gameState.stock.length);
      
      for (let i = 0; i < drawCount; i++) {
        const card = this.gameState.stock.pop();
        card.faceUp = true;
        this.gameState.waste.push(card);
      }
    } else if (this.gameState.waste.length > 0) {
      // Recycle waste back to stock
      while (this.gameState.waste.length > 0) {
        const card = this.gameState.waste.pop();
        card.faceUp = false;
        this.gameState.stock.push(card);
      }
    }

    // Register as a move
    this.registerMove();
    this.updateDisplay();
  }

  /**
   * Handle card click (simplified interaction for now)
   */
  handleCardClick(cardElement) {
    const cardId = cardElement.dataset.cardId;
    const location = cardElement.dataset.location;
    
    // Simple auto-move logic: try to move to foundation if possible
    if (location === 'waste') {
      this.tryMoveWasteToFoundation();
    } else if (location.startsWith('tableau-')) {
      const colIndex = parseInt(location.split('-')[1]);
      this.tryMoveTableauToFoundation(colIndex);
    }
  }

  /**
   * Try to move top waste card to a foundation
   */
  tryMoveWasteToFoundation() {
    if (this.gameState.waste.length === 0) return false;

    const card = this.gameState.waste[this.gameState.waste.length - 1];
    const foundationIndex = this.canMoveToFoundation(card);
    
    if (foundationIndex !== -1) {
      this.gameState.waste.pop();
      this.gameState.foundations[foundationIndex].push(card);
      
      // Scoring: +10 for moving to foundation
      this.gameState.score += 10;
      
      this.registerMove();
      this.updateDisplay();
      this.checkWinCondition();
      return true;
    }
    
    return false;
  }

  /**
   * Try to move bottom face-up card from tableau to foundation
   */
  tryMoveTableauToFoundation(colIndex) {
    const column = this.gameState.tableau[colIndex];
    if (column.length === 0) return false;

    const card = column[column.length - 1];
    if (!card.faceUp) return false;

    const foundationIndex = this.canMoveToFoundation(card);
    
    if (foundationIndex !== -1) {
      column.pop();
      this.gameState.foundations[foundationIndex].push(card);
      
      // Scoring: +10 for moving to foundation
      this.gameState.score += 10;
      
      // Check if we need to flip the next card
      if (column.length > 0 && !column[column.length - 1].faceUp) {
        column[column.length - 1].faceUp = true;
        // Scoring: +5 for revealing a card
        this.gameState.score += 5;
      }
      
      this.registerMove();
      this.updateDisplay();
      this.checkWinCondition();
      return true;
    }
    
    return false;
  }

  /**
   * Check if a card can be moved to any foundation
   * Returns foundation index if valid, -1 if not
   */
  canMoveToFoundation(card) {
    const foundation = this.gameState.foundations[card.suit];
    
    if (foundation.length === 0) {
      // Can only place Ace on empty foundation
      return card.rank === 1 ? card.suit : -1;
    } else {
      // Must be next rank in sequence
      const topCard = foundation[foundation.length - 1];
      return (card.rank === topCard.rank + 1) ? card.suit : -1;
    }
  }

  /**
   * Register a move and handle callbacks
   */
  registerMove() {
    if (!this.firstMoveDone) {
      this.firstMoveDone = true;
      this.firstMoveTimestamp = Date.now();
      if (this.callbacks && this.callbacks.onFirstMove) {
        this.callbacks.onFirstMove();
      }
    }

    this.gameState.moveCount++;

    // Notify shell of move
    if (this.callbacks && this.callbacks.onMove) {
      this.callbacks.onMove({
        moves: this.gameState.moveCount,
        score: this.gameState.score,
        stockCount: this.gameState.stock.length
      });
    }
  }

  /**
   * Check if the game is won (all cards in foundations)
   */
  checkWinCondition() {
    const totalInFoundations = this.gameState.foundations.reduce((sum, pile) => sum + pile.length, 0);
    
    if (totalInFoundations === 52) {
      // Game is won!
      let timeSeconds = 0;
      if (this.firstMoveTimestamp) {
        timeSeconds = Math.floor((Date.now() - this.firstMoveTimestamp) / 1000);
      }

      if (this.callbacks && this.callbacks.onWin) {
        this.callbacks.onWin({
          moves: this.gameState.moveCount,
          score: this.gameState.score,
          timeSeconds: timeSeconds
        });
      }
    }
  }

  /**
   * Update the visual display of all game elements
   */
  updateDisplay() {
    this.updateStockAndWaste();
    this.updateFoundations();
    this.updateTableau();
    
    // Reattach event listeners to new cards
    setTimeout(() => {
      this.attachCardEventListeners();
    }, 10);
  }

  /**
   * Update stock and waste piles display
   */
  updateStockAndWaste() {
    const stockPile = this.rootElement.querySelector('#stock-pile');
    const wastePile = this.rootElement.querySelector('#waste-pile');

    // Update stock
    stockPile.innerHTML = '';
    if (this.gameState.stock.length > 0) {
      const stockCard = document.createElement('div');
      stockCard.className = 'klondike-card klondike-card-back';
      stockCard.textContent = this.gameState.stock.length;
      stockPile.appendChild(stockCard);
    } else {
      stockPile.innerHTML = '<div class="klondike-card-placeholder">↻</div>';
    }

    // Update waste (show top 3 cards)
    wastePile.innerHTML = '';
    if (this.gameState.waste.length > 0) {
      const visibleCards = this.gameState.waste.slice(-3); // Show last 3 cards
      visibleCards.forEach((card, index) => {
        const cardElement = this.createCardElement(card, 'waste');
        cardElement.style.position = 'absolute';
        cardElement.style.left = `${index * 15}px`;
        cardElement.style.zIndex = index;
        if (index === visibleCards.length - 1) {
          cardElement.classList.add('klondike-card-active');
        }
        wastePile.appendChild(cardElement);
      });
    } else {
      wastePile.innerHTML = '<div class="klondike-card-placeholder">Waste</div>';
    }
  }

  /**
   * Update foundation piles display
   */
  updateFoundations() {
    for (let i = 0; i < 4; i++) {
      const foundationElement = this.rootElement.querySelector(`#foundation-${i}`);
      const pile = this.gameState.foundations[i];
      
      foundationElement.innerHTML = '';
      
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        const cardElement = this.createCardElement(topCard, `foundation-${i}`);
        foundationElement.appendChild(cardElement);
      } else {
        const suitSymbols = ['♥', '♦', '♣', '♠'];
        foundationElement.innerHTML = `<div class="klondike-card-placeholder">${suitSymbols[i]}</div>`;
      }
    }
  }

  /**
   * Update tableau columns display
   */
  updateTableau() {
    for (let col = 0; col < 7; col++) {
      const columnElement = this.rootElement.querySelector(`#tableau-${col}`);
      const column = this.gameState.tableau[col];
      
      columnElement.innerHTML = '';
      
      if (column.length === 0) {
        columnElement.innerHTML = '<div class="klondike-card-placeholder klondike-empty-tableau">Empty</div>';
      } else {
        column.forEach((card, index) => {
          const cardElement = this.createCardElement(card, `tableau-${col}`);
          cardElement.style.position = 'absolute';
          cardElement.style.top = `${index * 20}px`;
          cardElement.style.zIndex = index;
          columnElement.appendChild(cardElement);
        });
      }
    }
  }

  /**
   * Create a visual card element
   */
  createCardElement(card, location) {
    const cardElement = document.createElement('div');
    cardElement.className = `klondike-card ${card.faceUp ? 'klondike-card-face-up' : 'klondike-card-back'}`;
    cardElement.dataset.cardId = card.id;
    cardElement.dataset.location = location;

    if (card.faceUp) {
      const suitSymbols = ['♥', '♦', '♣', '♠'];
      const suitColors = ['red', 'red', 'black', 'black'];
      const rankNames = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      
      cardElement.innerHTML = `
        <div class="klondike-card-content ${suitColors[card.suit]}">
          <div class="klondike-card-rank">${rankNames[card.rank]}</div>
          <div class="klondike-card-suit">${suitSymbols[card.suit]}</div>
        </div>
      `;
    } else {
      cardElement.innerHTML = '<div class="klondike-card-back-pattern">🂠</div>';
    }

    return cardElement;
  }

  /**
   * Clean up and remove the game
   */
  destroy() {
    // Remove all event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener(event, handler);
      }
    });
    this.eventListeners = [];

    // Clear the root element
    if (this.rootElement) {
      this.rootElement.innerHTML = '';
    }

    // Reset internal state
    this.rootElement = null;
    this.callbacks = null;
    this.gameState = null;
    this.firstMoveDone = false;
    this.firstMoveTimestamp = null;
  }
}

// Make the engine available globally
window.Klondike3Engine = Klondike3Engine;
console.log('🎮 Klondike3Engine loaded and available globally');
