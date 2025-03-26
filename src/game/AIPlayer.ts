import axios from 'axios';
import { Game } from './Game';
import { Territory } from './Territory';

interface AIAction {
  type: 'attack' | 'transfer';
  from: Territory;
  to: Territory;
  confidence: number;
}

export class AIPlayer {
  private apiKey: string = 'sk-8f2e34d2ed004ee68f2ed8cb305d5d0a'; // DeepSeek API key
  
  constructor(private game: Game) {}
  
  public async executeTurn(): Promise<void> {
    // Get all territories
    const territories = this.game.getTerritories();
    const aiTerritories = territories.filter(t => t.getOwner() === 'ai');
    const playerTerritories = territories.filter(t => t.getOwner() === 'player');
    const neutralTerritories = territories.filter(t => t.getOwner() === 'neutral');
    
    // If no AI territories, can't do anything
    if (aiTerritories.length === 0) {
      return;
    }
    
    // Get AI strategy from DeepSeek
    let aiStrategy = "";
    try {
      aiStrategy = await this.getAIStrategy();
      this.game.onMessage(`AI Strategy: ${aiStrategy}`);
    } catch (error) {
      console.error('Error getting AI strategy:', error);
      this.game.onMessage('AI is making decisions based on basic strategy (DeepSeek API error)');
    }
    
    // Determine possible actions
    const possibleActions: AIAction[] = [];
    
    // For each AI territory, find possible attacks or transfers
    for (const territory of aiTerritories) {
      // Skip territories with only 1 unit (can't attack)
      if (territory.getUnits() <= 1) {
        continue;
      }
      
      // Find adjacent territories
      const adjacentTerritories = this.findAdjacentTerritories(territory, territories);
      
      // For each adjacent territory
      for (const adjacent of adjacentTerritories) {
        if (adjacent.getOwner() === 'ai') {
          // Can transfer units to friendly territory
          possibleActions.push({
            type: 'transfer',
            from: territory,
            to: adjacent,
            confidence: this.evaluateTransfer(territory, adjacent, aiStrategy)
          });
        } else {
          // Can attack enemy or neutral territory
          possibleActions.push({
            type: 'attack',
            from: territory,
            to: adjacent,
            confidence: this.evaluateAttack(territory, adjacent, aiStrategy)
          });
        }
      }
    }
    
    // Sort actions by confidence (highest first)
    possibleActions.sort((a, b) => b.confidence - a.confidence);
    
    // Execute up to 3 actions with highest confidence
    const actionsToExecute = possibleActions.slice(0, 3);
    
    for (const action of actionsToExecute) {
      if (action.type === 'attack') {
        await this.executeAttack(action.from, action.to);
      } else {
        await this.executeTransfer(action.from, action.to);
      }
      
      // Small delay between actions for visual clarity
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  private findAdjacentTerritories(territory: Territory, allTerritories: Territory[]): Territory[] {
    const position = territory.getPosition();
    
    return allTerritories.filter(t => {
      if (t === territory) return false;
      
      const otherPosition = t.getPosition();
      const distance = position.distanceTo(otherPosition);
      
      // Territories are adjacent if they are within a certain distance
      return distance < 7; // Slightly more than the spacing (5) to account for territory size
    });
  }
  
  private evaluateAttack(from: Territory, to: Territory, aiStrategy: string): number {
    const attackerUnits = from.getUnits();
    const defenderUnits = to.getUnits();
    
    // Base confidence on unit advantage
    let confidence = (attackerUnits - 1) / Math.max(1, defenderUnits);
    
    // Adjust confidence based on target owner
    if (to.getOwner() === 'player') {
      confidence *= 1.5; // Prefer attacking player over neutral
    }
    
    // Adjust confidence based on strategic value
    const adjacentToTarget = this.findAdjacentTerritories(to, this.game.getTerritories());
    const adjacentPlayerTerritories = adjacentToTarget.filter(t => t.getOwner() === 'player').length;
    
    // Prefer territories that border multiple player territories
    confidence += adjacentPlayerTerritories * 0.2;
    
    // Adjust based on AI strategy from DeepSeek
    if (aiStrategy.toLowerCase().includes(to.getName().toLowerCase())) {
      confidence *= 1.5; // Boost confidence if this territory was mentioned in the strategy
    }
    
    if (aiStrategy.toLowerCase().includes("attack") && 
        aiStrategy.toLowerCase().includes("player")) {
      confidence *= 1.2; // Boost confidence if strategy suggests attacking player
    }
    
    if (aiStrategy.toLowerCase().includes("defensive") || 
        aiStrategy.toLowerCase().includes("defend")) {
      confidence *= 0.8; // Reduce confidence if strategy suggests being defensive
    }
    
    return confidence;
  }
  
  private evaluateTransfer(from: Territory, to: Territory, aiStrategy: string): number {
    const fromUnits = from.getUnits();
    const toUnits = to.getUnits();
    
    // Base confidence on unit imbalance
    let confidence = (fromUnits - toUnits) / Math.max(1, fromUnits + toUnits);
    
    // Only transfer if the source has significantly more units
    if (fromUnits <= toUnits + 2) {
      return 0;
    }
    
    // Adjust confidence based on strategic value
    const adjacentToTarget = this.findAdjacentTerritories(to, this.game.getTerritories());
    const adjacentPlayerTerritories = adjacentToTarget.filter(t => t.getOwner() === 'player').length;
    
    // Prefer reinforcing territories that border player territories
    confidence += adjacentPlayerTerritories * 0.3;
    
    // Adjust based on AI strategy from DeepSeek
    if (aiStrategy.toLowerCase().includes(to.getName().toLowerCase())) {
      confidence *= 1.5; // Boost confidence if this territory was mentioned in the strategy
    }
    
    if (aiStrategy.toLowerCase().includes("reinforce") || 
        aiStrategy.toLowerCase().includes("strengthen")) {
      confidence *= 1.3; // Boost confidence if strategy suggests reinforcing
    }
    
    return confidence;
  }
  
  private async executeAttack(from: Territory, to: Territory): Promise<void> {
    const attackerUnits = from.getUnits();
    const defenderUnits = to.getUnits();
    
    // Need at least 2 units to attack (1 must stay behind)
    if (attackerUnits <= 1) {
      return;
    }
    
    // Calculate attack strength (random factor for unpredictability)
    const attackStrength = Math.floor((attackerUnits - 1) * (0.8 + Math.random() * 0.4));
    const defenseStrength = Math.floor(defenderUnits * (0.8 + Math.random() * 0.4));
    
    const message = `AI ${from.getName()} (${attackStrength}) attacks ${to.getName()} (${defenseStrength})`;
    this.game.onMessage(message);
    
    // Determine outcome
    if (attackStrength > defenseStrength) {
      // Attacker wins
      const remainingUnits = Math.floor((attackerUnits - 1) * (attackStrength / (attackStrength + defenseStrength)));
      from.setUnits(1); // Leave 1 unit behind
      to.setOwner('ai');
      to.setUnits(remainingUnits);
      this.game.onMessage(`AI captured ${to.getName()} with ${remainingUnits} units`);
    } else {
      // Defender wins or tie
      const attackerLosses = Math.floor(attackerUnits * 0.5); // Lose half units on failed attack
      from.setUnits(Math.max(1, attackerUnits - attackerLosses));
      
      // Defender also loses some units
      const defenderLosses = Math.floor(defenderUnits * 0.3);
      to.setUnits(Math.max(1, defenderUnits - defenderLosses));
      
      this.game.onMessage(`AI attack failed! Lost ${attackerLosses} units`);
    }
  }
  
  private async executeTransfer(from: Territory, to: Territory): Promise<void> {
    // Transfer half of the units from one territory to another
    const unitsToTransfer = Math.floor((from.getUnits() - 1) / 2); // Leave at least 1 unit behind
    
    if (unitsToTransfer > 0) {
      from.setUnits(from.getUnits() - unitsToTransfer);
      to.setUnits(to.getUnits() + unitsToTransfer);
      this.game.onMessage(`AI transferred ${unitsToTransfer} units from ${from.getName()} to ${to.getName()}`);
    }
  }
  
  private async getAIStrategy(): Promise<string> {
    // Get game state information
    const gameState = this.game.getGameState();
    const territories = this.game.getTerritories();
    
    // Prepare a simplified game state to send to the API
    const aiTerritories = territories
      .filter(t => t.getOwner() === 'ai')
      .map(t => ({
        name: t.getName(),
        units: t.getUnits(),
        position: {
          x: t.getPosition().x,
          z: t.getPosition().z
        }
      }));
    
    const playerTerritories = territories
      .filter(t => t.getOwner() === 'player')
      .map(t => ({
        name: t.getName(),
        units: t.getUnits(),
        position: {
          x: t.getPosition().x,
          z: t.getPosition().z
        }
      }));
    
    const neutralTerritories = territories
      .filter(t => t.getOwner() === 'neutral')
      .map(t => ({
        name: t.getName(),
        units: t.getUnits(),
        position: {
          x: t.getPosition().x,
          z: t.getPosition().z
        }
      }));
    
    // Create a prompt for the AI
    const prompt = `
      You are an AI strategic advisor for a territory control game. 
      
      Current game state:
      - AI controls ${gameState.aiTerritories} territories with ${gameState.aiUnits} total units
      - Player controls ${gameState.playerTerritories} territories with ${gameState.playerUnits} total units
      - There are ${neutralTerritories.length} neutral territories
      
      AI territories: ${JSON.stringify(aiTerritories)}
      Player territories: ${JSON.stringify(playerTerritories)}
      Neutral territories: ${JSON.stringify(neutralTerritories)}
      
      Based on this information, provide a short strategic recommendation for the AI's next moves.
      Focus on which territories to attack or reinforce, and why.
      Keep your response under 100 words and be specific.
    `;
    
    try {
      // Make API call to DeepSeek
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a strategic AI advisor for a territory control game.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 150
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      // Extract the AI's response
      if (response.data && 
          response.data.choices && 
          response.data.choices.length > 0 && 
          response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      } else {
        console.error('Unexpected API response format:', response.data);
        return "Focus on expanding territory and reinforcing borders with player territories.";
      }
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      return "Focus on expanding territory and reinforcing borders with player territories.";
    }
  }
}
