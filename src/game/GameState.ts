export class GameState {
  public gameStarted: boolean = false;
  public gameOver: boolean = false;
  public winner: 'player' | 'ai' | null = null;
  public currentTurn: 'player' | 'ai' = 'player';
  
  public playerUnits: number = 0;
  public aiUnits: number = 0;
  public playerTerritories: number = 0;
  public aiTerritories: number = 0;
  
  constructor() {}
}
