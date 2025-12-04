/**
 * Klondike Draw 3 Solitaire Engine
 * Implements the classic Klondike solitaire with draw-3 stock behavior
 */

class Klondike3Engine {
  constructor() {
    this.rootElement = null;
    this.callbacks = null;
    this.gameState = null;
    this.eventListeners = []; // Only for global/long-lived listeners
    this.firstMoveDone = false;
    this.firstMoveTimestamp = null;
    this.selectedCard = null;
    this.dragData = null;
    // Stores the last computed hint move so we can reapply or clear visuals.
    this.currentHint = null;
    
    // Animation state flags
    this.isMoveAnimating = false;
    this.isFlipAnimating = false;
    
    // Track cards revealed in the last move for flip animation
    this.revealedCardIds = new Set();
    
    // Central animation speed system (single source of truth)
    this.animationSpeedPreset = "normal"; // "slow" | "normal" | "fast"
    this.animationBaseMs = 80; // Base unit for normal preset
    this.animationsEnabled = true; // Default: animations on
    
    // Other game options
    this.autoplayMode = "obvious"; // "off" | "obvious" | "won"
    this.soundEnabled = true; // Default: sound on
  }
  
  /**
   * Get combined animation state
   */
  get isAnimating() {
    return this.isMoveAnimating || this.isFlipAnimating;
  }
  
  /**
   * Update engine options from shell settings
   * @param {Object} options - Configuration options
   * @param {string} options.animationSpeedPreset - "slow" | "normal" | "fast"
   * @param {boolean} options.animationsEnabled - Enable/disable animations
   * @param {string} options.autoplayMode - "off" | "obvious" | "won"
   * @param {boolean} options.soundEnabled - Enable/disable sound effects
   */
  updateOptions(options = {}) {
    console.log('🎮 Engine: updateOptions called with:', options);
    
    let presetChanged = false;
    let animationsToggled = false;
    
    // Update animation speed preset
    if (options.animationSpeedPreset && 
        ['slow', 'normal', 'fast'].includes(options.animationSpeedPreset)) {
      if (this.animationSpeedPreset !== options.animationSpeedPreset) {
        this.animationSpeedPreset = options.animationSpeedPreset;
        presetChanged = true;
        console.log(`🎮 Engine: Animation speed preset set to "${this.animationSpeedPreset}"`);
      }
    }
    
    // Update animations enabled/disabled
    if (typeof options.animationsEnabled === 'boolean') {
      if (this.animationsEnabled !== options.animationsEnabled) {
        this.animationsEnabled = options.animationsEnabled;
        animationsToggled = true;
        console.log(`🎮 Engine: Animations ${this.animationsEnabled ? 'enabled' : 'disabled'}`);
      }
    }
    
    // Recompute animationBaseMs based on current state
    // This is the ONLY place that sets animationBaseMs
    if (presetChanged || animationsToggled) {
      if (!this.animationsEnabled) {
        // Animations disabled: use 0 for truly instant jumps
        this.animationBaseMs = 0;
        console.log('🎮 Engine: animationBaseMs set to 0 (animations disabled)');
      } else {
        // Animations enabled: use preset value
        const presetMap = { fast: 40, normal: 80, slow: 400 };
        this.animationBaseMs = presetMap[this.animationSpeedPreset] || 80;
        console.log(`🎮 Engine: animationBaseMs set to ${this.animationBaseMs} (${this.animationSpeedPreset} preset)`);
      }
    }
    
    // Store other options for future use (placeholders for future features)
    if (options.autoplayMode) {
      this.autoplayMode = options.autoplayMode;
      console.log(`🎮 Engine: Autoplay mode set to "${this.autoplayMode}" (not yet implemented)`);
    }
    
    if (typeof options.soundEnabled === 'boolean') {
      this.soundEnabled = options.soundEnabled;
      console.log(`🎮 Engine: Sound ${this.soundEnabled ? 'enabled' : 'disabled'} (not yet implemented)`);
    }
  }
  
  /**
   * Calculate animation durations based on current animationBaseMs
   * When animations are disabled, animationBaseMs will be 0 or 1 (near instant)
   * When animations are enabled, animationBaseMs reflects the preset (40/80/160)
   */
  getAnimationDurations() {
    // Use animationBaseMs as the single source of truth
    // All durations scale proportionally from this base
    return {
      moveDurationMs: 2 * this.animationBaseMs,      // Normal: 160ms, Fast: 80ms, Slow: 320ms, Off: 0-2ms
      flipTotalMs: 2.5 * this.animationBaseMs,       // Normal: 200ms, Fast: 100ms, Slow: 400ms, Off: 0-2.5ms
      flipMidpointMs: 1.25 * this.animationBaseMs,   // Normal: 100ms, Fast: 50ms, Slow: 200ms, Off: 0-1.25ms
      stockDelayMs: 1 * this.animationBaseMs         // Normal: 80ms, Fast: 40ms, Slow: 160ms, Off: 0-1ms
    };
  }

  /**
   * Internal helper: get a reference to the shared global UndoManager, if available.
   *
   * We keep this in one place so that if the integration changes (for example,
   * different global name or no Undo support on some pages), we only have to
   * adjust this method.
   */
  getUndoManager() {
    // Defensive: in a browser environment, UndoManager is attached to window
    // by src/scripts/undoManager.js. If it is not available, we return null
    // and the calling code should simply skip Undo integration.
    if (typeof window === 'undefined') {
      return null;
    }
    const maybeManager = window.UndoManager;
    if (!maybeManager) {
      return null;
    }
    return maybeManager;
  }

  /**
   * Internal helper: capture a snapshot of the current game state for Undo.
   *
   * Important:
   * - We always push the full `this.gameState` object.
   * - Call this exactly once for each logical move, and always BEFORE you
   *   mutate `this.gameState` for that move.
   */
  captureUndoSnapshot() {
    const undoManager = this.getUndoManager();
    if (!undoManager || typeof undoManager.pushSnapshot !== 'function') {
      return;
    }
    // We rely on UndoManager to deep-clone this object so future mutations
    // do not affect history.
    undoManager.pushSnapshot(this.gameState);
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
    // Reset any active hint when a fresh state is created.
    this.currentHint = null;
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
      // Ignore clicks during animations
      if (this.isAnimating) return;
      this.handleStockClick();
    };
    
    stockPile.addEventListener('click', stockClickHandler);
    this.eventListeners.push({ element: stockPile, event: 'click', handler: stockClickHandler });
    
    // Add visual feedback on click (these listeners are tied to DOM element lifecycle)
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
          // Ignore clicks during animations
          if (this.isAnimating) return;
          const location = card.dataset.location;

          // Waste has its own behaviour: foundation first, then first valid tableau from left
          if (location === 'waste') {
            this.handleWasteClick();
            return;
          }

          // Tableau-specific behaviour
          if (location && location.startsWith('tableau-')) {
            // If this is a tableau card and it is face down, do nothing on click
            if (!card.classList.contains('is-face-up')) {
              return;
            }

            const colIndex = parseInt(location.split('-')[1]);
            const column = this.gameState && this.gameState.tableau
              ? this.gameState.tableau[colIndex]
              : null;

            if (!column || column.length === 0) {
              return;
            }

            const cardId = card.dataset.cardId;
            const cardIndex = column.findIndex(c => c.id === cardId);

            // If we cannot resolve the card index safely, fall back to old behaviour:
            // select card and try bottom-card auto-move.
            if (cardIndex === -1) {
              this.handleCardClick(card);
              this.tryMoveTableauToFoundation(colIndex);
              return;
            }

            // If this is the bottom card in the column, use the standard auto behaviour:
            // 1) Try foundation, 2) then auto tableau move for that single card.
            if (cardIndex === column.length - 1) {
              this.handleCardClick(card);
              this.tryMoveTableauToFoundation(colIndex);
              return;
            }

            // Mid-stack card: this card + all below it are the stack head.
            // If draggable, auto-move the stack to the first valid tableau column from the left.
            if (this.isCardDraggable(card)) {
              // Visual selection to show which stack is in focus
              this.handleCardClick(card);

              const stack = column.slice(cardIndex);
              const fromLocation = `tableau-${colIndex}`;

              for (let targetCol = 0; targetCol < this.gameState.tableau.length; targetCol++) {
                if (targetCol === colIndex) continue; // do not move into the same column

                if (this.canMoveToTableau(stack, targetCol)) {
                  const moved = this.moveCardsToTableau(fromLocation, targetCol, stack);
                  if (moved) {
                    // Animate the card movement before updating display
                    const tableauCard = this.rootElement.querySelector(
                      `.klondike-card[data-location="tableau-${colIndex}"][data-card-id="${card.id}"]`
                    );
                    const targetElement = this.rootElement.querySelector(`#tableau-${targetCol}`);
                    
                    this.animateCardMovement(tableauCard, targetElement).then(() => {
                      this.updateDisplay(0);
                    });
                  }
                  return;
                }
              }

              // No valid tableau target for this stack: do nothing further.
              return;
            }

            // Not draggable for some reason: just update selection and do nothing else.
            this.handleCardClick(card);
            return;
          }

          // For non-waste, non-tableau locations (e.g. foundation), keep generic selection only.
          this.handleCardClick(card);
        };
        
        // Drag start handler
        const dragStartHandler = (e) => {
          // Ignore drags during animations
          if (this.isAnimating) {
            e.preventDefault();
            return;
          }
          this.handleDragStart(e, card);
        };
        
        // Drag end handler - always clean up dragging state
        const dragEndHandler = () => {
          // Clean up drag visuals on unsuccessful drops
          if (this.dragData && this.dragData.element === card) {
            this.cleanupDragVisuals(false);
          }
        };

        // Make card draggable if it's face up and not in foundation (or top foundation card)
        const location = card.dataset.location;
        const isFaceUp = card.classList.contains('is-face-up');
        
        if (isFaceUp && this.isCardDraggable(card)) {
          card.draggable = true;
          card.addEventListener('dragstart', dragStartHandler);
          
          // Ensure dragging state is always cleaned up, even on invalid drops
          card.addEventListener('dragend', dragEndHandler);
        }
        
        // Always attach single-click (rely on DOM teardown for cleanup)
        card.addEventListener('click', clickHandler);
        
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
      // Ignore drops during animations
      if (this.isAnimating) return;
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
    // Reset Undo history for this new deal so old moves from the previous
    // game do not leak into the new one.
    const undoManager = this.getUndoManager();
    if (undoManager && typeof undoManager.reset === 'function') {
      undoManager.reset();
    }
    // Clear any stale hint visuals before setting up a fresh deal.
    this.clearHintHighlight();
    this.currentHint = null;
    // Clear any revealed cards from previous game
    this.revealedCardIds.clear();

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
    // New deal means any previous hint is no longer relevant.
    this.currentHint = null;

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
      // This click will change the layout of stock/waste, so capture the
      // current state once before we mutate it.
      this.captureUndoSnapshot();

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
      // Recycling waste back to stock also counts as one logical move from
      // the player's perspective.
      this.captureUndoSnapshot();

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
      // Update display with animation delay for stock/waste transition
      const durations = this.getAnimationDurations();
      this.updateDisplay(durations.stockDelayMs);
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
        // Animate the card movement before updating display
        const wasteCard = this.rootElement.querySelector('.klondike-card[data-location="waste"]');
        const foundationElement = this.rootElement.querySelector(`#foundation-${foundationIndex}`);
        
        this.animateCardMovement(wasteCard, foundationElement).then(() => {
          this.updateDisplay(0);
        });
      }
      return;
    }

    // 2) Try to move to the first valid tableau column from the left
    for (let col = 0; col < this.gameState.tableau.length; col++) {
      if (this.canMoveToTableau([topCard], col)) {
        const movedToTableau = this.moveCardsToTableau('waste', col, [topCard]);
        if (movedToTableau) {
          // Animate the card movement before updating display
          const wasteCard = this.rootElement.querySelector('.klondike-card[data-location="waste"]');
          const tableauElement = this.rootElement.querySelector(`#tableau-${col}`);
          
          this.animateCardMovement(wasteCard, tableauElement).then(() => {
            this.updateDisplay(0);
          });
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
   * Public API: compute and show a hint for the current position.
   *
   * The hint:
   * - Uses only visible move information.
   * - Does not flip any cards or modify score or move counters.
   * - Only adds temporary highlight classes to the source and destination.
   *
   * This method is intended to be called by the shell when the user presses
   * the global "Hint" button.
   */
  requestHint() {
    if (!this.rootElement || !this.gameState) {
      return;
    }

    // Clear any previous hint visual before computing a new one.
    this.clearHintHighlight();
    this.currentHint = null;

    const move = this.computeHintMove();
    if (!move) {
      // No legal moves found - nothing to highlight.
      return;
    }

    this.currentHint = move;
    this.applyHintHighlight(move);
  }

  /**
   * Internal helper: compute the best hint move according to this priority:
   * 1) Any move from tableau that will flip a face-down card underneath.
   * 2) Tableau to foundation moves.
   * 3) Waste to tableau moves.
   * 4) Other tableau to tableau moves.
   *
   * Only visible moves are considered. The hint itself never flips cards
   * or changes the game state; it just returns a structured description.
   *
   * Returns:
   * - An object describing the move, or
   * - null if no legal moves exist.
   */
  computeHintMove() {
    if (!this.gameState) {
      return null;
    }

    const priority1 = [];
    const priority2 = [];
    const priority3 = [];
    const priority4 = [];

    // 1 + 2 + 4: tableau-based moves using the top face-up card in each column.
    for (let colIndex = 0; colIndex < this.gameState.tableau.length; colIndex++) {
      const column = this.gameState.tableau[colIndex];
      if (!column || column.length === 0) continue;

      const topIndex = column.length - 1;
      const card = column[topIndex];
      if (!card.faceUp) {
        // If the top card is face down, the column has no direct visible moves.
        continue;
      }

      const from = { zone: 'tableau', colIndex, cardId: card.id };

      // 2) Try tableau -> foundation.
      const foundationIndex = this.canMoveToFoundation(card);
      if (foundationIndex !== -1) {
        const moveToFoundation = {
          type: 'tableau-to-foundation',
          from,
          to: { zone: 'foundation', foundationIndex },
          willFlip: this.willTableauMoveFlip(colIndex, 1)
        };
        if (moveToFoundation.willFlip) {
          priority1.push(moveToFoundation);
        } else {
          priority2.push(moveToFoundation);
        }
      }

      // 1 + 4) Try tableau -> tableau using the same top card.
      for (let targetCol = 0; targetCol < this.gameState.tableau.length; targetCol++) {
        if (targetCol === colIndex) continue;

        if (this.canMoveToTableau([card], targetCol)) {
          const moveToTableau = {
            type: 'tableau-to-tableau',
            from,
            to: { zone: 'tableau', colIndex: targetCol },
            willFlip: this.willTableauMoveFlip(colIndex, 1)
          };

          if (moveToTableau.willFlip) {
            priority1.push(moveToTableau);
          } else {
            priority4.push(moveToTableau);
          }

          // Use the first valid tableau destination from the left for this source.
          break;
        }
      }
    }

    // 3) Waste -> tableau moves using the top waste card.
    if (this.gameState.waste && this.gameState.waste.length > 0) {
      const topWaste = this.gameState.waste[this.gameState.waste.length - 1];
      const fromWaste = { zone: 'waste', cardId: topWaste.id };

      for (let colIndex = 0; colIndex < this.gameState.tableau.length; colIndex++) {
        if (this.canMoveToTableau([topWaste], colIndex)) {
          const wasteMove = {
            type: 'waste-to-tableau',
            from: fromWaste,
            to: { zone: 'tableau', colIndex },
            willFlip: false // Waste moves never flip a tableau card on their own.
          };
          priority3.push(wasteMove);
          // First valid tableau column from the left is enough.
          break;
        }
      }
    }

    if (priority1.length > 0) return priority1[0];
    if (priority2.length > 0) return priority2[0];
    if (priority3.length > 0) return priority3[0];
    if (priority4.length > 0) return priority4[0];

    return null;
  }

  /**
   * Internal helper: determine if moving `count` cards from the top of a
   * tableau column will immediately flip a face-down card.
   *
   * This mirrors the logic in `moveCardsToTableau` and `moveCardToFoundation`:
   * after removing `count` cards from the top, if the new top card exists
   * and is face down, it will be flipped as part of that move.
   *
   * Note: The hint system uses this information only to prioritise moves.
   * It never reveals or shows the hidden card itself.
   */
  willTableauMoveFlip(colIndex, count) {
    if (!this.gameState || !this.gameState.tableau) {
      return false;
    }
    const column = this.gameState.tableau[colIndex];
    if (!column || column.length <= count) {
      return false;
    }

    const newTop = column[column.length - 1 - count];
    return !!newTop && !newTop.faceUp;
  }

  /**
   * Internal helper: remove hint highlight classes from all elements.
   * This does not change any game state; it only touches DOM classes.
   */
  clearHintHighlight() {
    if (!this.rootElement) return;

    this.rootElement.querySelectorAll('.klondike-hint-source').forEach(el => {
      el.classList.remove('klondike-hint-source');
    });
    this.rootElement.querySelectorAll('.klondike-hint-dest').forEach(el => {
      el.classList.remove('klondike-hint-dest');
    });
  }

  /**
   * Internal helper: apply hint highlight classes to the source card and
   * destination pile for the given move.
   *
   * - Source highlight goes on the concrete card element (waste or tableau).
   * - Destination highlight goes on the pile container (tableau column or
   *   foundation pile), so it is obvious where the card should be moved.
   */
  applyHintHighlight(move) {
    if (!this.rootElement || !move) return;

    // Highlight the source card.
    let sourceElement = null;
    if (move.from.zone === 'waste') {
      sourceElement = this.rootElement.querySelector(
        `.klondike-card[data-location="waste"][data-card-id="${move.from.cardId}"]`
      );
    } else if (move.from.zone === 'tableau') {
      sourceElement = this.rootElement.querySelector(
        `.klondike-card[data-location="tableau-${move.from.colIndex}"][data-card-id="${move.from.cardId}"]`
      );
    }

    if (sourceElement) {
      sourceElement.classList.add('klondike-hint-source');
    }

    // Highlight the destination pile.
    let destElement = null;
    if (move.to.zone === 'tableau') {
      destElement = this.rootElement.querySelector(`#tableau-${move.to.colIndex}`);
    } else if (move.to.zone === 'foundation') {
      destElement = this.rootElement.querySelector(`#foundation-${move.to.foundationIndex}`);
    }

    if (destElement) {
      destElement.classList.add('klondike-hint-dest');
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
    
    // If dragging from tableau, create visual stack and hide original cards
    if (location.startsWith('tableau-')) {
      const colIndex = parseInt(location.split('-')[1]);
      const column = this.gameState.tableau[colIndex];
      const cardIndex = column.findIndex(card => card.id === cardId);
      
      if (cardIndex !== -1) {
        this.dragData.draggedCards = column.slice(cardIndex);
        this.dragData.colIndex = colIndex;
        this.dragData.cardIndex = cardIndex;
        
        // Create floating drag stack
        this.createFloatingDragStack(e, this.dragData.draggedCards);
        
        // Hide original cards in the tableau column
        this.hideTableauCards(colIndex, cardIndex);
      }
    } else {
      // Single card from waste or foundation - use existing behavior
      cardElement.classList.add('dragging');
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
    this.cleanupDragVisuals(success);
    
    if (success) {
      // Animate the card movement from source to destination before updating display
      const destElement = this.getDestinationElement(dropZoneId);
      const sourceElement = this.dragData.element;
      
      this.animateCardMovement(sourceElement, destElement).then(() => {
        this.updateDisplay(0); // Update display immediately after animation
      });
    }
  }

  /**
   * Create a floating visual stack that follows the cursor during drag
   */
  createFloatingDragStack(e, cards) {
    // Remove any existing floating stack
    this.removeFloatingDragStack();
    
    // Create container for floating stack
    const floatingStack = document.createElement('div');
    floatingStack.className = 'klondike-floating-drag-stack';
    floatingStack.style.position = 'fixed';
    floatingStack.style.pointerEvents = 'none';
    floatingStack.style.zIndex = '10000';
    floatingStack.style.transform = 'translate(-50%, -50%)';
    
    // Add cards to floating stack
    cards.forEach((card, index) => {
      const cardElement = this.createCardElement(card, 'floating');
      cardElement.style.position = 'absolute';
      cardElement.style.top = `${index * 20}px`;
      cardElement.style.left = '0';
      cardElement.classList.add('klondike-drag-stack-card');
      floatingStack.appendChild(cardElement);
    });
    
    // Position at cursor
    floatingStack.style.left = `${e.clientX}px`;
    floatingStack.style.top = `${e.clientY}px`;
    
    // Add to document
    document.body.appendChild(floatingStack);
    this.dragData.floatingStack = floatingStack;
    
    // Track mouse movement to update position
    this.dragData.mouseMoveHandler = (moveE) => {
      if (this.dragData.floatingStack) {
        this.dragData.floatingStack.style.left = `${moveE.clientX}px`;
        this.dragData.floatingStack.style.top = `${moveE.clientY}px`;
      }
    };
    
    // Listen to both dragover and mousemove for better tracking
    document.addEventListener('dragover', this.dragData.mouseMoveHandler);
    document.addEventListener('mousemove', this.dragData.mouseMoveHandler);
  }

  /**
   * Remove the floating drag stack
   */
  removeFloatingDragStack() {
    if (this.dragData && this.dragData.floatingStack) {
      this.dragData.floatingStack.remove();
      this.dragData.floatingStack = null;
    }
    
    if (this.dragData && this.dragData.mouseMoveHandler) {
      document.removeEventListener('dragover', this.dragData.mouseMoveHandler);
      document.removeEventListener('mousemove', this.dragData.mouseMoveHandler);
      this.dragData.mouseMoveHandler = null;
    }
  }

  /**
   * Hide tableau cards at specified positions during drag
   */
  hideTableauCards(colIndex, startIndex) {
    const columnElement = this.rootElement.querySelector(`#tableau-${colIndex}`);
    if (!columnElement) return;
    
    const cardElements = columnElement.querySelectorAll('.klondike-card');
    for (let i = startIndex; i < cardElements.length; i++) {
      if (cardElements[i]) {
        cardElements[i].style.opacity = '0';
        cardElements[i].classList.add('klondike-card-hidden-for-drag');
      }
    }
  }

  /**
   * Restore visibility of hidden tableau cards
   */
  restoreTableauCards(colIndex, startIndex) {
    const columnElement = this.rootElement.querySelector(`#tableau-${colIndex}`);
    if (!columnElement) return;
    
    const cardElements = columnElement.querySelectorAll('.klondike-card-hidden-for-drag');
    cardElements.forEach(cardElement => {
      cardElement.style.opacity = '';
      cardElement.classList.remove('klondike-card-hidden-for-drag');
    });
  }

  /**
   * Clean up all drag-related visuals
   */
  cleanupDragVisuals(success) {
    if (!this.dragData) return;
    
    // Clean up floating stack
    this.removeFloatingDragStack();
    
    // Handle tableau drag cleanup
    if (this.dragData.location && this.dragData.location.startsWith('tableau-')) {
      if (!success) {
        // Failed drop - restore original cards visibility
        this.restoreTableauCards(this.dragData.colIndex, this.dragData.cardIndex);
      }
      // On successful drop, updateDisplay() will recreate the DOM properly
    } else {
      // Non-tableau drag - clean up dragging class
      if (this.dragData.element) {
        this.dragData.element.classList.remove('dragging');
      }
    }
    
    this.dragData = null;
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
   *
   * Delegates the actual move to `moveCardToFoundation` so scoring, move
   * counting, win checks, and Undo snapshot all behave consistently.
   */
  tryMoveWasteToFoundation() {
    if (this.gameState.waste.length === 0) return false;

    const card = this.gameState.waste[this.gameState.waste.length - 1];
    const foundationIndex = this.canMoveToFoundation(card);
    
    if (foundationIndex === -1) {
      return false;
    }

    // Delegate the actual move to the generic helper so scoring, move
    // counting, win checks and Undo snapshot all behave consistently.
    const moved = this.moveCardToFoundation('waste', foundationIndex, card);
    if (moved) {
      // moveCardToFoundation already calls registerMove and checkWinCondition.
      // Here we only need to update the visual layout.
      this.updateDisplay();
    }
    return moved;
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
    const fromLocation = `tableau-${colIndex}`;

    // Delegate to the generic helper so that Undo, scoring, card flipping and
    // move counting all behave exactly the same as for other foundation moves.
    const movedToFoundation = this.moveCardToFoundation(fromLocation, foundationIndex, card);
    if (movedToFoundation) {
      // Animate the card movement before updating display
      const tableauCard = this.rootElement.querySelector(
        `.klondike-card[data-location="tableau-${colIndex}"][data-card-id="${card.id}"]`
      );
      const foundationElement = this.rootElement.querySelector(`#foundation-${foundationIndex}`);
      
      this.animateCardMovement(tableauCard, foundationElement).then(() => {
        this.updateDisplay(0);
      });
      return true;
    }
  }

  // 2) If no foundation move, try to move to the first valid tableau column from the left
  const fromLocation = `tableau-${colIndex}`;
  for (let targetCol = 0; targetCol < this.gameState.tableau.length; targetCol++) {
    if (targetCol === colIndex) continue; // don't move into the same column

    if (this.canMoveToTableau([card], targetCol)) {
      const movedToTableau = this.moveCardsToTableau(fromLocation, targetCol, [card]);
      if (movedToTableau) {
        // Animate the card movement before updating display
        const tableauCard = this.rootElement.querySelector(
          `.klondike-card[data-location="tableau-${colIndex}"][data-card-id="${card.id}"]`
        );
        const targetElement = this.rootElement.querySelector(`#tableau-${targetCol}`);
        
        this.animateCardMovement(tableauCard, targetElement).then(() => {
          this.updateDisplay(0);
        });
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
        // This is a legal move from foundation back to tableau. From the
        // player's perspective this is one logical move, so we capture a
        // snapshot once before we mutate any piles.
        this.captureUndoSnapshot();

        // Remove from foundation
        foundation.pop();
        
        // Add to tableau
        this.gameState.tableau[col].push(card);
        
        // Scoring: -15 for moving from foundation to tableau
        this.gameState.score -= 15;
        
        this.registerMove();
        // Animate the card movement before updating display
        const foundationCard = this.rootElement.querySelector(`#foundation-${foundationIndex} .klondike-card`);
        const tableauElement = this.rootElement.querySelector(`#tableau-${col}`);
        
        this.animateCardMovement(foundationCard, tableauElement).then(() => {
          this.updateDisplay(0);
        });
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
    
    // At this point we know the move is legal and will change the game
    // state. Capture a single snapshot so one Undo step will revert this
    // entire move (even if it moves a whole stack).
    this.captureUndoSnapshot();
    
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
        const revealedCard = fromColumn[fromColumn.length - 1];
        revealedCard.faceUp = true;
        // Track this card for flip animation
        this.revealedCardIds.add(revealedCard.id);
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
    
    // This is a legal move of a single card into a foundation. Capture the
    // current state so one Undo step will roll back this entire move,
    // including score changes and any card flips.
    this.captureUndoSnapshot();
    
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
          const revealedCard = column[column.length - 1];
          revealedCard.faceUp = true;
          // Track this card for flip animation
          this.revealedCardIds.add(revealedCard.id);
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
    // Any real move changes the layout, so the previous hint is no longer valid.
    // Clear both the visual highlight and the stored hint description.
    this.clearHintHighlight();
    this.currentHint = null;
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
   * Undo the last logical move, if any, using the shared UndoManager.
   *
   * This is intended to be called by the shell when the user clicks the
   * global Undo button in the footer. It restores the previous snapshot of
   * `gameState`, re-renders the board, and notifies the shell via `onMove`
   * so HUD elements (moves, score, stock count) stay in sync.
   *
   * Returns true if a move was undone, false if there was nothing to undo or
   * UndoManager is not available.
   */
  undoLastMove() {
    const undoManager = this.getUndoManager();
    if (!undoManager ||
        typeof undoManager.canUndo !== 'function' ||
        typeof undoManager.undo !== 'function') {
      return false;
    }

    if (!undoManager.canUndo()) {
      return false;
    }

    const previousState = undoManager.undo();
    if (!previousState) {
      return false;
    }

    // Replace the current game state with the restored snapshot.
    this.gameState = previousState;

    // Undo changes the board to a prior snapshot, so any previous hint is invalid.
    // Clear hint visuals and reset the stored hint move before re-rendering.
    this.clearHintHighlight();
    this.currentHint = null;

    // Re-render all piles so the UI matches the restored data.
    this.updateDisplay(0);

    // Keep the shell HUD in sync. We reuse the existing onMove callback,
    // using the restored state's counters.
    if (this.callbacks && typeof this.callbacks.onMove === 'function') {
      this.callbacks.onMove({
        moves: this.gameState.moveCount,
        score: this.gameState.score,
        stockCount: this.gameState.stock.length
      });
    }

    return true;
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
   * Update the visual display of all game elements with optional animation delay
   * @param {number} delayMs - Optional delay before updating display (for animations)
   */
  updateDisplay(delayMs = 0) {
    if (delayMs > 0) {
      setTimeout(() => {
        this._performDisplayUpdate();
      }, delayMs);
    } else {
      this._performDisplayUpdate();
    }
  }

  /**
   * Internal: perform the actual display update
   */
  _performDisplayUpdate() {
    this.updateStockAndWaste();
    this.updateFoundations();
    this.updateTableau();
    
    // Reattach event listeners to new cards on next frame
    requestAnimationFrame(() => {
      this.attachCardEventListeners();
      
      // Animate any newly revealed cards
      this.animateRevealedCards();
      
      // Clear the revealed cards set for the next move
      this.revealedCardIds.clear();
    });
  }

  /**
   * Animate newly revealed cards with a flip effect
   * With two-face structure, we simply add .is-face-up class and CSS handles the rotation
   */
  animateRevealedCards() {
    if (!this.rootElement || this.revealedCardIds.size === 0) {
      return;
    }

    const durations = this.getAnimationDurations();
    
    // Short-circuit: if animations are disabled, just add .is-face-up immediately
    if (!this.animationsEnabled || durations.flipTotalMs === 0) {
      this.revealedCardIds.forEach(cardId => {
        const cardElement = this.rootElement.querySelector(
          `.klondike-card[data-card-id="${cardId}"][data-location^="tableau-"]`
        );
        if (cardElement) {
          cardElement.classList.add('is-face-up');
        }
      });
      return;
    }
    
    // Set animation flag to prevent user interactions during flip animations
    // Track number of pending flips for proper state management
    let pendingFlips = this.revealedCardIds.size;
    this.isFlipAnimating = true;

    this.revealedCardIds.forEach(cardId => {
      // Find the card element in the DOM
      const cardElement = this.rootElement.querySelector(
        `.klondike-card[data-card-id="${cardId}"][data-location^="tableau-"]`
      );
      
      if (cardElement) {
        // Set the transition duration dynamically on the inner wrapper
        const innerElement = cardElement.querySelector('.klondike-card-inner');
        if (innerElement) {
          innerElement.style.transition = `transform ${durations.flipTotalMs}ms ease-in-out`;
        }
        
        // Add .is-face-up class to trigger CSS rotation from back (180deg) to front (0deg)
        cardElement.classList.add('is-face-up');
        
        // Clear animation flag after flip completes
        setTimeout(() => {
          pendingFlips--;
          if (pendingFlips === 0) {
            this.isFlipAnimating = false;
          }
        }, durations.flipTotalMs);
      } else {
        // Card element not found, decrement counter immediately
        pendingFlips--;
        if (pendingFlips === 0) {
          this.isFlipAnimating = false;
        }
      }
    });
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
      stockCard.className = 'klondike-card'; // No .is-face-up = shows back
      stockCard.innerHTML = `
        <div class="klondike-card-inner">
          <div class="klondike-card-face klondike-card-face-back">
            <div class="klondike-card-back-pattern">🂠</div>
          </div>
          <div class="klondike-card-face klondike-card-face-front">
            <div class="klondike-card-content">
              <div class="klondike-card-rank"></div>
              <div class="klondike-card-suit"></div>
            </div>
          </div>
        </div>
      `;
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
          // If this card was just revealed, render it as face-down initially
          // The flip animation will change it to face-up
          let cardToRender = card;
          if (this.revealedCardIds.has(card.id) && card.faceUp) {
            // Create a temporary face-down version for rendering
            cardToRender = { ...card, faceUp: false };
          }
          
          const cardElement = this.createCardElement(cardToRender, `tableau-${col}`);
          cardElement.style.position = 'absolute';
          cardElement.style.top = `${index * 20}px`;
          cardElement.style.zIndex = index;
          columnElement.appendChild(cardElement);
        });
      }
    }
  }

  /**
   * Create a visual card element with two-face 3D structure
   * Both faces are always present; rotation controlled by .is-face-up class
   */
  createCardElement(card, location) {
    const suitSymbols = ['♥', '♦', '♣', '♠'];
    const suitColors = ['red', 'red', 'black', 'black'];
    const rankNames = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    const cardElement = document.createElement('div');
    // Add .is-face-up class if card is face up in game state
    cardElement.className = `klondike-card${card.faceUp ? ' is-face-up' : ''}`;
    cardElement.dataset.cardId = card.id;
    cardElement.dataset.location = location;

    // Two-face structure: both back and front always present
    cardElement.innerHTML = `
      <div class="klondike-card-inner">
        <div class="klondike-card-face klondike-card-face-back">
          <div class="klondike-card-back-pattern">🂠</div>
        </div>
        <div class="klondike-card-face klondike-card-face-front">
          <div class="klondike-card-content ${suitColors[card.suit]}">
            <div class="klondike-card-rank">${rankNames[card.rank]}</div>
            <div class="klondike-card-suit">${suitSymbols[card.suit]}</div>
          </div>
        </div>
      </div>
    `;

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
    this.currentHint = null;
  }

  /**
   * Animate a card from source element to destination element
   * @param {HTMLElement} sourceElement - The card element at its current position
   * @param {HTMLElement} destElement - The destination pile/column element
   * @returns {Promise} Resolves when animation is logically complete (may be before visual finish for overlap)
   */
  animateCardMovement(sourceElement, destElement) {
    if (!sourceElement || !destElement) return Promise.resolve();

    return new Promise((resolve) => {
      const durations = this.getAnimationDurations();
      
      // Short-circuit: if animations are disabled, resolve immediately without visual animation
      if (!this.animationsEnabled || durations.moveDurationMs === 0) {
        resolve();
        return;
      }
      
      // Set animation flag to prevent user interactions during animation
      this.isMoveAnimating = true;

      // Get bounding rectangles
      const sourceRect = sourceElement.getBoundingClientRect();
      const destRect = destElement.getBoundingClientRect();

      // Calculate the offset needed to move from source to dest
      const offsetX = destRect.left - sourceRect.left;
      const offsetY = destRect.top - sourceRect.top;

      // Hide the source element immediately - it's being moved
      sourceElement.style.opacity = '0';
      sourceElement.style.visibility = 'hidden';

      // Clone the card element to animate it
      const animatedCard = sourceElement.cloneNode(true);
      animatedCard.className = `klondike-card ${sourceElement.className}`;
      animatedCard.style.position = 'fixed';
      animatedCard.style.left = sourceRect.left + 'px';
      animatedCard.style.top = sourceRect.top + 'px';
      animatedCard.style.width = sourceRect.width + 'px';
      animatedCard.style.height = sourceRect.height + 'px';
      animatedCard.style.zIndex = '9999';
      animatedCard.style.pointerEvents = 'none';
      animatedCard.style.transition = `all ${durations.moveDurationMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      // Make sure animated card is fully visible
      animatedCard.style.opacity = '1';
      animatedCard.style.visibility = 'visible';

      // Append to document body
      document.body.appendChild(animatedCard);

      // Trigger animation on next frame
      requestAnimationFrame(() => {
        animatedCard.style.left = (sourceRect.left + offsetX) + 'px';
        animatedCard.style.top = (sourceRect.top + offsetY) + 'px';
        animatedCard.style.transform = 'scale(0.95)';

        // Resolve promise at 75% of movement to allow flip to start while card is still moving
        // This creates visual overlap between movement and flip for smoother perceived action
        const resolveTime = Math.floor(durations.moveDurationMs * 0.75);
        
        setTimeout(() => {
          // Logical completion: flip animation can start now
          resolve();
        }, resolveTime);
        
        // Remove animated card after full animation completes
        setTimeout(() => {
          animatedCard.remove();
          // Clear animation flag to allow user interactions
          this.isMoveAnimating = false;
        }, durations.moveDurationMs);
      });
    });
  }

  /**
   * Get the destination element for a card move
   * @param {string} toLocation - The destination location (e.g., 'foundation-0', 'tableau-3')
   */
  getDestinationElement(toLocation) {
    if (toLocation.startsWith('foundation-')) {
      return this.rootElement.querySelector(`#${toLocation}`);
    } else if (toLocation.startsWith('tableau-')) {
      return this.rootElement.querySelector(`#${toLocation}`);
    }
    return null;
  }
}

// Make the engine available globally
window.Klondike3Engine = Klondike3Engine;
console.log('🎮 Klondike3Engine loaded and available globally');
