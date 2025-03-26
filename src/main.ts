import './style.css';
import { Game } from './game/Game';

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const gameContainer = document.getElementById('game-container') as HTMLElement;
  const game = new Game(gameContainer);
  
  // Set up UI event listeners
  const startButton = document.getElementById('start-game') as HTMLButtonElement;
  const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement;
  
  startButton.addEventListener('click', () => {
    game.start();
    startButton.disabled = true;
    endTurnButton.disabled = false;
    updateStatus('Game started! Your turn.');
  });
  
  endTurnButton.addEventListener('click', () => {
    endTurnButton.disabled = true;
    updateStatus('AI is thinking...');
    game.endPlayerTurn().then(() => {
      endTurnButton.disabled = false;
      updateStatus('Your turn.');
    });
  });
  
  // Update UI with game state
  game.onStateChange = (state) => {
    updateScore(state.playerUnits, state.aiUnits);
  };
  
  game.onMessage = (message) => {
    addMessage(message);
  };
});

function updateStatus(message: string) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function updateScore(playerUnits: number, aiUnits: number) {
  const scoreElement = document.getElementById('score');
  if (scoreElement) {
    scoreElement.textContent = `Your Units: ${playerUnits} | AI Units: ${aiUnits}`;
  }
}

function addMessage(message: string) {
  const logElement = document.getElementById('message-log');
  if (logElement) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    logElement.appendChild(messageElement);
    logElement.scrollTop = logElement.scrollHeight;
  }
}
