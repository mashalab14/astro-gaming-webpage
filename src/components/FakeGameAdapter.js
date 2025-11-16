/**
 * Fake Game Adapter - Simulates a real game engine for testing the shell
 * 
 * This adapter implements the standardized game interface that all real games will use:
 * - mount(rootElement, options, callbacks)
 * - startNewDeal()
 * - destroy()
 * 
 * It renders a simple test interface and triggers all the shell callbacks
 * to validate that the integration works properly.
 */

export class FakeGameAdapter {
  constructor() {
    this.rootElement = null;
    this.options = {};
    this.callbacks = {};
    this.gameState = {
      moves: 0,
      score: 0,
      isFirstMove: true,
      isGameWon: false
    };
    this.startTime = null;
  }

  /**
   * Mount the fake game in the provided container
   * @param {HTMLElement} rootElement - Container where game renders
   * @param {Object} options - Game configuration from shell
   * @param {Object} callbacks - Functions to call back to shell
   */
  mount(rootElement, options, callbacks) {
    this.rootElement = rootElement;
    this.options = options || {};
    this.callbacks = callbacks || {};

    console.log('🎮 Fake Game Mounted:', { options, callbacks });

    // Clear any existing content
    this.rootElement.innerHTML = '';
    
    // Render the fake game interface
    this.render();
  }

  /**
   * Start a new game deal
   */
  startNewDeal() {
    console.log('🔄 Starting new deal');
    
    // Reset game state
    this.gameState = {
      moves: 0,
      score: 0,
      isFirstMove: true,
      isGameWon: false
    };
    this.startTime = null;

    // Re-render the game
    this.render();

    // Notify shell that new deal started
    if (this.callbacks.onNewDeal) {
      this.callbacks.onNewDeal();
    }
  }

  /**
   * Clean up when switching games
   */
  destroy() {
    console.log('🗑️ Destroying fake game');
    if (this.rootElement) {
      this.rootElement.innerHTML = '';
    }
    this.rootElement = null;
    this.callbacks = {};
  }

  /**
   * Render the fake game interface
   */
  render() {
    const { soundOn = true, animations = true, animationSpeed = 'normal', autoplayMode = 'off' } = this.options;

    this.rootElement.innerHTML = `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(56, 142, 60, 0.1));
        border: 2px dashed rgba(76, 175, 80, 0.3);
        border-radius: 12px;
        padding: 40px;
        text-align: center;
      ">
        <div style="
          font-size: 24px;
          font-weight: bold;
          color: #e6e7eb;
          margin-bottom: 10px;
        ">
          🎮 Fake Game Adapter
        </div>
        
        <div style="
          font-size: 14px;
          color: #9aa3ad;
          margin-bottom: 20px;
          line-height: 1.4;
        ">
          Testing shell integration<br>
          Settings: Sound ${soundOn ? 'ON' : 'OFF'} • Animations ${animations ? animationSpeed.toUpperCase() : 'OFF'} • Autoplay ${autoplayMode.toUpperCase()}
        </div>

        <div style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        ">
          ${this.generateFakeCards()}
        </div>

        <div style="
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        ">
          <button id="fakeMove" style="
            padding: 8px 16px;
            border: 1px solid rgba(76, 175, 80, 0.5);
            border-radius: 6px;
            background: rgba(76, 175, 80, 0.2);
            color: #4CAF50;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">
            Make Move (+10 pts)
          </button>
          
          <button id="fakeWin" style="
            padding: 8px 16px;
            border: 1px solid rgba(255, 193, 7, 0.5);
            border-radius: 6px;
            background: rgba(255, 193, 7, 0.2);
            color: #FFC107;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">
            Trigger Win! 🏆
          </button>
        </div>

        <div style="
          font-size: 12px;
          color: #6aa1ff;
          margin-top: 10px;
        ">
          Moves: ${this.gameState.moves} • Score: ${this.gameState.score}
        </div>
      </div>
    `;

    // Add event listeners
    this.addEventListeners();
  }

  /**
   * Generate fake card elements for visual interest
   */
  generateFakeCards() {
    const cards = ['🂡', '🂢', '🂣', '🂤', '🂥', '🂦'];
    return cards.map(card => `
      <div style="
        width: 50px;
        height: 70px;
        background: linear-gradient(145deg, #ffffff, #f0f0f0);
        border: 1px solid rgba(0,0,0,0.1);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        transition: transform 0.2s ease;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        ${card}
      </div>
    `).join('');
  }

  /**
   * Add event listeners to fake game buttons
   */
  addEventListeners() {
    // Make Move button
    const moveBtn = this.rootElement.querySelector('#fakeMove');
    moveBtn?.addEventListener('click', () => this.handleMove());

    // Win button
    const winBtn = this.rootElement.querySelector('#fakeWin');
    winBtn?.addEventListener('click', () => this.handleWin());

    // Card clicks
    const cards = this.rootElement.querySelectorAll('div[style*="cursor: pointer"]');
    cards.forEach(card => {
      if (card.id !== 'fakeMove' && card.id !== 'fakeWin') {
        card.addEventListener('click', () => this.handleMove());
      }
    });
  }

  /**
   * Handle a game move
   */
  handleMove() {
    if (this.gameState.isGameWon) return;

    // First move triggers timer start
    if (this.gameState.isFirstMove) {
      this.gameState.isFirstMove = false;
      this.startTime = Date.now();
      
      if (this.callbacks.onFirstUserMove) {
        this.callbacks.onFirstUserMove();
      }
    }

    // Increment counters
    this.gameState.moves++;
    this.gameState.score += 10;

    // Notify shell of move
    if (this.callbacks.onMove) {
      this.callbacks.onMove({
        moves: this.gameState.moves,
        score: this.gameState.score,
        timeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
      });
    }

    // Re-render to show updated stats
    this.render();
  }

  /**
   * Handle a win condition
   */
  handleWin() {
    if (this.gameState.isGameWon) return;

    this.gameState.isGameWon = true;
    const timeSeconds = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;

    // Notify shell of win
    if (this.callbacks.onWin) {
      this.callbacks.onWin({
        moves: this.gameState.moves,
        score: this.gameState.score,
        timeSeconds
      });
    }

    console.log('🏆 Game Won!', {
      moves: this.gameState.moves,
      score: this.gameState.score,
      timeSeconds
    });
  }
}
