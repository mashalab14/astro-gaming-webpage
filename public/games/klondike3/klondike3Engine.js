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
    this.selectedCard = null;
    this.dragData = null;
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
    
    if (!stockPile) {
      console.error('Stock pile not found!');
      return;
    }
    
    // Stock pile click handler
    const stockClickHandler = (e) => {
      console.log('Stock pile clicked!');
      e.preventDefault();
      e.stopPropagation();
      this.handleStockClick();
    };
    
    stockPile.addEventListener('click', stockClickHandler);
    this.eventListeners.push({ element: stockPile, event: 'click', handler: stockClickHandler });
    
    // Add visual feedback on click
    stockPile.addEventListener('mousedown', () => {
      stockPile.style.transform = 'scale(0.95)';
    });
    
    stockPile.addEventListener('mouseup', () => {
      stockPile.style.transform = 'scale(1)';
    });
    
    console.log('Stock pile click listener attached');

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
        // Skip attaching generic listeners to the stock pile card.
        // Stock interaction is handled by the #stock-pile click listener.
        const parentPile = card.parentElement;
        if (parentPile && parentPile.id === 'stock-pile') {
          card.dataset.hasListeners = 'true';
          return;
        }
        // Single click handler
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const location = card.dataset.location;

          // Waste has its own behaviour: foundation first, then first valid tableau from left
          if (location === 'waste') {
            this.handleWasteClick();
            return;
          }

          // If this is a tableau card and it is face down, do nothing on click
          if (location && location.startsWith('tableau-') && !card.classList.contains('klondike-card-face-up')) {
            return;
          }

          // Generic path: select card and try auto-move to foundation for tableau cards
          this.handleCardClick(card);

          if (location && location.startsWith('tableau-')) {
            const colIndex = parseInt(location.split('-')[1]);
            this.tryMoveTableauToFoundation(colIndex);
          }
        };
        
        // Drag start handler
        const dragStartHandler = (e) => {
          this.handleDragStart(e, card);
        };
        
        // Drag end handler - always clean up dragging state
        const dragEndHandler = () => {
          card.classList.remove('dragging');
          if (this.dragData && this.dragData.element === card) {
            this.dragData = null;
          }
        };

        // Make card draggable if it's face up and not in foundation (or top foundation card)
        const location = card.dataset.location;
        const isFaceUp = card.classList.contains('klondike-card-face-up');
        
        if (isFaceUp && this.isCardDraggable(card)) {
          card.draggable = true;
          card.addEventListener('dragstart', dragStartHandler);
          this.eventListeners.push({ element: card, event: 'dragstart', handler: dragStartHandler });
          
          // Ensure dragging state is always cleaned up, even on invalid drops
          card.addEventListener('dragend', dragEndHandler);
          this.eventListeners.push({ element: card, event: 'dragend', handler: dragEndHandler });
        }
        
        // Always attach single-click
        card.addEventListener('click', clickHandler);
        this.eventListeners.push({ element: card, event: 'click', handler: clickHandler });
        
        card.dataset.hasListeners = 'true';
      }
    });
    
    // Attach drop zone listeners to piles
    this.attachDropZoneListeners();
  }

  /**
   * Check if a card is draggable
   */
  isCardDraggable(cardElement) {
    const location = cardElement.dataset.location;
    const cardId = cardElement.dataset.cardId;
    
    if (location === 'waste') {
      // Only top waste card is draggable
      return this.gameState.waste.length > 0 && 
             this.gameState.waste[this.gameState.waste.length - 1].id === cardId;
    } else if (location.startsWith('foundation-')) {
      // Foundation cards are draggable
      return true;
    } else if (location.startsWith('tableau-')) {
      const colIndex = parseInt(location.split('-')[1]);
      const column = this.gameState.tableau[colIndex];
      
      // Find the card's position in the column
      const cardIndex = column.findIndex(card => card.id === cardId);
      if (cardIndex === -1) return false;
      
      // Card is draggable if it's face up and all cards below it are also face up
      for (let i = cardIndex; i < column.length; i++) {
        if (!column[i].faceUp) return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Attach drop zone listeners for drag and drop
   */
  attachDropZoneListeners() {
    // Tableau columns as drop zones
    for (let i = 0; i < 7; i++) {
      const column = this.rootElement.querySelector(`#tableau-${i}`);
      if (column && !column.dataset.hasDropListeners) {
        this.attachDropListeners(column, `tableau-${i}`);
        column.dataset.hasDropListeners = 'true';
      }
    }
    
    // Foundation piles as drop zones
    for (let i = 0; i < 4; i++) {
      const foundation = this.rootElement.querySelector(`#foundation-${i}`);
      if (foundation && !foundation.dataset.hasDropListeners) {
        this.attachDropListeners(foundation, `foundation-${i}`);
        foundation.dataset.hasDropListeners = 'true';
      }
    }
  }

  /**
   * Attach drop event listeners to an element
   */
  attachDropListeners(element, dropZoneId) {
    const dragOverHandler = (e) => {
      e.preventDefault();
      element.classList.add('drag-over');
    };
    
    const dragLeaveHandler = (e) => {
      element.classList.remove('drag-over');
    };
    
    const dropHandler = (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      this.handleDrop(e, dropZoneId);
    };
    
    element.addEventListener('dragover', dragOverHandler);
    element.addEventListener('dragleave', dragLeaveHandler);
    element.addEventListener('drop', dropHandler);
    
    this.eventListeners.push({ element, event: 'dragover', handler: dragOverHandler });
    this.eventListeners.push({ element, event: 'dragleave', handler: dragLeaveHandler });
    this.eventListeners.push({ element, event: 'drop', handler: dropHandler });
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
    console.log('handleStockClick called - Stock:', this.gameState.stock.length, 'Waste:', this.gameState.waste.length);
    
    let moved = false;

    if (this.gameState.stock.length > 0) {
      // Draw up to 3 cards from stock to waste
      const drawCount = Math.min(3, this.gameState.stock.length);
      console.log('Drawing', drawCount, 'cards from stock');
      
      for (let i = 0; i < drawCount; i++) {
        const card = this.gameState.stock.pop();
        card.faceUp = true;
        this.gameState.waste.push(card);
      }
      moved = true;
    } else if (this.gameState.waste.length > 0) {
      // Recycle waste back to stock
      console.log('Recycling waste back to stock');
      while (this.gameState.waste.length > 0) {
        const card = this.gameState.waste.pop();
        card.faceUp = false;
        this.gameState.stock.push(card);
      }
      moved = true;
    }

    // Only register as a move if something actually changed
    if (moved) {
      this.registerMove();
      this.updateDisplay();
    }
  }

  /**
   * Handle card click (for selection/highlighting)
   */
  handleCardClick(cardElement) {
    // Remove previous selections
    this.rootElement.querySelectorAll('.klondike-card-selected').forEach(card => {
      card.classList.remove('klondike-card-selected');
    });
    
    // Select this card if it's draggable
    if (this.isCardDraggable(cardElement)) {
      cardElement.classList.add('klondike-card-selected');
      this.selectedCard = {
        element: cardElement,
        cardId: cardElement.dataset.cardId,
        location: cardElement.dataset.location
      };
    }
  }

  /**
   * Handle card double-click (auto-move to foundation)
   */
  handleCardDoubleClick(cardElement) {
    const location = cardElement.dataset.location;
    
    if (location === 'waste') {
      this.tryMoveWasteToFoundation();
    } else if (location.startsWith('tableau-')) {
      const colIndex = parseInt(location.split('-')[1]);
      this.tryMoveTableauToFoundation(colIndex);
    } else if (location.startsWith('foundation-')) {
      const foundationIndex = parseInt(location.split('-')[1]);
      this.tryMoveFoundationToTableau(foundationIndex);
    }
  }

  /**
   * Handle single click on the waste pile:
   * 1) Move top waste card to foundation if possible.
   * 2) Otherwise move it to the first valid tableau column from the left.
   * 3) If no move is possible, give a small "no move" feedback.
   *
   * This method does not directly modify score or register moves;
   * all scoring and move counting is handled in moveCardToFoundation/moveCardsToTableau.
   */
  handleWasteClick() {
    if (!this.gameState || this.gameState.waste.length === 0) return;

    const topCard = this.gameState.waste[this.gameState.waste.length - 1];

    // 1) Try to move to foundation
    const foundationIndex = this.canMoveToFoundation(topCard);
    if (foundationIndex !== -1) {
      const movedToFoundation = this.moveCardToFoundation('waste', foundationIndex, topCard);
      if (movedToFoundation) {
        // moveCardToFoundation already updates score, registers move, and checks win
        this.updateDisplay();
      }
      return;
    }

    // 2) Try to move to the first valid tableau column from the left
    for (let col = 0; col < this.gameState.tableau.length; col++) {
      if (this.canMoveToTableau([topCard], col)) {
        const movedToTableau = this.moveCardsToTableau('waste', col, [topCard]);
        if (movedToTableau) {
          // moveCardsToTableau already updates score and registers move
          this.updateDisplay();
        }
        return;
      }
    }

    // 3) No legal move from waste: give a small "no move" feedback on the waste pile
    const wastePile = this.rootElement.querySelector('#waste-pile');
    if (wastePile) {
      wastePile.classList.add('klondike-no-move');
      setTimeout(() => {
        wastePile.classList.remove('klondike-no-move');
      }, 150);
    }
  }

  /**
   * Handle drag start
   */
  handleDragStart(e, cardElement) {
    const cardId = cardElement.dataset.cardId;
    const location = cardElement.dataset.location;
    
    // Store drag data
    this.dragData = {
      cardId: cardId,
      location: location,
      element: cardElement
    };
    
    // Set drag effect
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
    
    // Add visual feedback
    cardElement.classList.add('dragging');
    
    // If dragging from tableau, we might be dragging multiple cards
    if (location.startsWith('tableau-')) {
      const colIndex = parseInt(location.split('-')[1]);
      const column = this.gameState.tableau[colIndex];
      const cardIndex = column.findIndex(card => card.id === cardId);
      
      if (cardIndex !== -1) {
        this.dragData.draggedCards = column.slice(cardIndex);
      }
    } else {
      // Single card from waste or foundation
      const card = this.findCardById(cardId);
      this.dragData.draggedCards = card ? [card] : [];
    }
  }

  /**
   * Handle drop
   */
  handleDrop(e, dropZoneId) {
    if (!this.dragData) return;
    
    const success = this.attemptMove(this.dragData.location, dropZoneId, this.dragData.draggedCards);
    
    // Clean up drag state
    if (this.dragData.element) {
      this.dragData.element.classList.remove('dragging');
    }
    this.dragData = null;
    
    if (success) {
      this.updateDisplay();
    }
  }

  /**
   * Find a card by its ID
   */
  findCardById(cardId) {
    // Check waste
    const wasteCard = this.gameState.waste.find(card => card.id === cardId);
    if (wasteCard) return wasteCard;
    
    // Check foundations
    for (const foundation of this.gameState.foundations) {
      const foundCard = foundation.find(card => card.id === cardId);
      if (foundCard) return foundCard;
    }
    
    // Check tableau
    for (const column of this.gameState.tableau) {
      const foundCard = column.find(card => card.id === cardId);
      if (foundCard) return foundCard;
    }
    
    return null;
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
 * Try to auto-move bottom face-up card from tableau:
 * 1) First try to move it to its foundation.
 * 2) If no foundation move is available, try to move it to the first valid tableau column from the left.
 */
tryMoveTableauToFoundation(colIndex) {
  const column = this.gameState.tableau[colIndex];
  if (!column || column.length === 0) return false;

  const card = column[column.length - 1];
  if (!card.faceUp) return false;

  // 1) Try to move to foundation
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

  // 2) If no foundation move, try to move to the first valid tableau column from the left
  const fromLocation = `tableau-${colIndex}`;
  for (let targetCol = 0; targetCol < this.gameState.tableau.length; targetCol++) {
    if (targetCol === colIndex) continue; // don't move into the same column

    if (this.canMoveToTableau([card], targetCol)) {
      const movedToTableau = this.moveCardsToTableau(fromLocation, targetCol, [card]);
      if (movedToTableau) {
        // moveCardsToTableau already updates score and registers move
        this.updateDisplay();
        return true;
      }
    }
  }

  // No auto-move possible
  return false;
}
  /**
   * Try to move top foundation card to tableau
   */
  tryMoveFoundationToTableau(foundationIndex) {
    const foundation = this.gameState.foundations[foundationIndex];
    if (foundation.length === 0) return false;

    const card = foundation[foundation.length - 1];
    
    // Try to find a valid tableau position
    for (let col = 0; col < 7; col++) {
      if (this.canMoveToTableau([card], col)) {
        // Remove from foundation
        foundation.pop();
        
        // Add to tableau
        this.gameState.tableau[col].push(card);
        
        // Scoring: -15 for moving from foundation to tableau
        this.gameState.score -= 15;
        
        this.registerMove();
        this.updateDisplay();
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if cards can be moved to a tableau column
   */
  canMoveToTableau(cards, colIndex) {
    if (!cards || cards.length === 0) return false;
    
    const column = this.gameState.tableau[colIndex];
    const bottomCard = cards[0]; // The card that will be placed on the column
    
    if (column.length === 0) {
      // Empty column - only Kings can be placed
      return bottomCard.rank === 13;
    } else {
      const topCard = column[column.length - 1];
      if (!topCard.faceUp) return false;
      
      // Must be opposite color and one rank lower
      // Suits: 0=Hearts (red), 1=Diamonds (red), 2=Clubs (black), 3=Spades (black)
      const topIsRed = topCard.suit === 0 || topCard.suit === 1;
      const bottomIsRed = bottomCard.suit === 0 || bottomCard.suit === 1;
      const isOppositeColor = topIsRed !== bottomIsRed;
      const isOneRankLower = bottomCard.rank === topCard.rank - 1;
      
      return isOppositeColor && isOneRankLower;
    }
  }

  /**
   * Attempt to move cards from one location to another
   */
  attemptMove(fromLocation, toLocation, cards) {
    if (!cards || cards.length === 0) return false;
    
    if (toLocation.startsWith('tableau-')) {
      const colIndex = parseInt(toLocation.split('-')[1]);
      return this.moveCardsToTableau(fromLocation, colIndex, cards);
    } else if (toLocation.startsWith('foundation-')) {
      const foundationIndex = parseInt(toLocation.split('-')[1]);
      return this.moveCardToFoundation(fromLocation, foundationIndex, cards[0]);
    }
    
    return false;
  }

  /**
   * Move cards to tableau column
   */
  moveCardsToTableau(fromLocation, toColIndex, cards) {
    if (!this.canMoveToTableau(cards, toColIndex)) return false;
    
    // Remove cards from source
    if (fromLocation === 'waste') {
      if (cards.length === 1 && this.gameState.waste.length > 0) {
        this.gameState.waste.pop();
        // Scoring: +5 for waste to tableau
        this.gameState.score += 5;
      }
    } else if (fromLocation.startsWith('foundation-')) {
      const foundationIndex = parseInt(fromLocation.split('-')[1]);
      if (cards.length === 1 && this.gameState.foundations[foundationIndex].length > 0) {
        this.gameState.foundations[foundationIndex].pop();
        // Scoring: -15 for foundation to tableau
        this.gameState.score -= 15;
      }
    } else if (fromLocation.startsWith('tableau-')) {
      const fromColIndex = parseInt(fromLocation.split('-')[1]);
      const fromColumn = this.gameState.tableau[fromColIndex];
      
      // Remove the dragged cards
      fromColumn.splice(-cards.length, cards.length);
      
      // Reveal top card if it became face down
      if (fromColumn.length > 0 && !fromColumn[fromColumn.length - 1].faceUp) {
        fromColumn[fromColumn.length - 1].faceUp = true;
        // Scoring: +5 for revealing a card
        this.gameState.score += 5;
      }
    }
    
    // Add cards to destination
    this.gameState.tableau[toColIndex].push(...cards);
    
    this.registerMove();
    return true;
  }

  /**
   * Move single card to foundation
   */
  moveCardToFoundation(fromLocation, foundationIndex, card) {
    const canMove = this.canMoveToFoundation(card);
    if (canMove !== foundationIndex) return false;
    
    // Remove card from source
    if (fromLocation === 'waste') {
      if (this.gameState.waste.length > 0) {
        this.gameState.waste.pop();
      }
    } else if (fromLocation.startsWith('tableau-')) {
      const colIndex = parseInt(fromLocation.split('-')[1]);
      const column = this.gameState.tableau[colIndex];
      if (column.length > 0) {
        column.pop();
        
        // Reveal top card if it became face down
        if (column.length > 0 && !column[column.length - 1].faceUp) {
          column[column.length - 1].faceUp = true;
          // Scoring: +5 for revealing a card
          this.gameState.score += 5;
        }
      }
    }
    
    // Add to foundation
    this.gameState.foundations[foundationIndex].push(card);
    
    // Scoring: +10 for moving to foundation
    this.gameState.score += 10;
    
    this.registerMove();
    this.checkWinCondition();
    return true;
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
      stockCard.innerHTML = '<div class="klondike-card-back-pattern">🂠</div>';
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
        columnElement.innerHTML = '<div class="klondike-card-placeholder klondike-empty-tableau"></div>';
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
