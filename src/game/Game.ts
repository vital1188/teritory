import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Territory } from './Territory';
import { AIPlayer } from './AIPlayer';
import { GameState } from './GameState';

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private territories: Territory[] = [];
  private selectedTerritory: Territory | null = null;
  private gameState: GameState;
  private ai: AIPlayer;
  
  public onStateChange: (state: GameState) => void = () => {};
  public onMessage: (message: string) => void = () => {};
  
  constructor(private container: HTMLElement) {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background
    
    // Set up camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(0, 15, 15);
    
    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    // Set up controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below the ground
    
    // Set up raycaster for mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Set up game state
    this.gameState = new GameState();
    
    // Set up AI player
    this.ai = new AIPlayer(this);
    
    // Set up lighting
    this.setupLights();
    
    // Create game board
    this.createGameBoard();
    
    // Set up event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
    
    // Start animation loop
    this.animate();
  }
  
  private setupLights(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);
  }
  
  private createGameBoard(): void {
    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x228B22,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Create territories in a grid pattern
    const gridSize = 5; // 5x5 grid
    const spacing = 5;
    const offset = (gridSize - 1) * spacing / 2;
    
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const posX = x * spacing - offset;
        const posZ = z * spacing - offset;
        
        // Skip some positions to create an interesting pattern
        if ((x === 0 && z === 0) || (x === gridSize-1 && z === gridSize-1) || 
            (x === 0 && z === gridSize-1) || (x === gridSize-1 && z === 0)) {
          continue;
        }
        
        const territory = new Territory(
          posX, 
          posZ, 
          this.scene,
          `Territory (${x},${z})`
        );
        
        // Assign initial territories
        if (x < 2 && z < 2) {
          territory.setOwner('player');
          territory.setUnits(3);
        } else if (x > gridSize - 3 && z > gridSize - 3) {
          territory.setOwner('ai');
          territory.setUnits(3);
        }
        
        this.territories.push(territory);
      }
    }
    
    // Update game state
    this.updateGameState();
  }
  
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  private onMouseClick(event: MouseEvent): void {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects(
      this.territories.map(t => t.getMesh())
    );
    
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const clickedTerritory = this.territories.find(t => t.getMesh() === clickedMesh);
      
      if (clickedTerritory) {
        this.handleTerritoryClick(clickedTerritory);
      }
    }
  }
  
  private handleTerritoryClick(territory: Territory): void {
    // If it's not player's turn, do nothing
    if (this.gameState.currentTurn !== 'player') {
      return;
    }
    
    // If no territory is selected and the clicked territory belongs to the player
    if (!this.selectedTerritory && territory.getOwner() === 'player') {
      this.selectedTerritory = territory;
      territory.setSelected(true);
      this.onMessage(`Selected ${territory.getName()} with ${territory.getUnits()} units`);
    } 
    // If a territory is already selected
    else if (this.selectedTerritory) {
      // If clicking the same territory, deselect it
      if (this.selectedTerritory === territory) {
        this.selectedTerritory.setSelected(false);
        this.selectedTerritory = null;
        this.onMessage('Deselected territory');
      } 
      // If clicking an adjacent territory
      else if (this.isAdjacent(this.selectedTerritory, territory)) {
        // If the target territory is owned by the player, transfer units
        if (territory.getOwner() === 'player') {
          this.transferUnits(this.selectedTerritory, territory);
        } 
        // If the target territory is neutral or enemy, attack it
        else {
          this.attackTerritory(this.selectedTerritory, territory);
        }
        
        // Deselect after action
        this.selectedTerritory.setSelected(false);
        this.selectedTerritory = null;
        
        // Update game state
        this.updateGameState();
      } 
      // If clicking a non-adjacent territory
      else {
        this.onMessage('Territories are not adjacent');
      }
    }
  }
  
  private isAdjacent(territory1: Territory, territory2: Territory): boolean {
    const pos1 = territory1.getPosition();
    const pos2 = territory2.getPosition();
    const distance = pos1.distanceTo(pos2);
    
    // Territories are adjacent if they are within a certain distance
    return distance < 7; // Slightly more than the spacing (5) to account for territory size
  }
  
  private transferUnits(from: Territory, to: Territory): void {
    // Transfer half of the units from one territory to another
    const unitsToTransfer = Math.floor(from.getUnits() / 2);
    
    if (unitsToTransfer > 0) {
      from.setUnits(from.getUnits() - unitsToTransfer);
      to.setUnits(to.getUnits() + unitsToTransfer);
      this.onMessage(`Transferred ${unitsToTransfer} units from ${from.getName()} to ${to.getName()}`);
    } else {
      this.onMessage('Not enough units to transfer');
    }
  }
  
  private attackTerritory(attacker: Territory, defender: Territory): void {
    const attackerUnits = attacker.getUnits();
    const defenderUnits = defender.getUnits();
    
    // Need at least 2 units to attack (1 must stay behind)
    if (attackerUnits <= 1) {
      this.onMessage('Not enough units to attack');
      return;
    }
    
    // Calculate attack strength (random factor for unpredictability)
    const attackStrength = Math.floor((attackerUnits - 1) * (0.8 + Math.random() * 0.4));
    const defenseStrength = Math.floor(defenderUnits * (0.8 + Math.random() * 0.4));
    
    this.onMessage(`${attacker.getName()} (${attackStrength}) attacks ${defender.getName()} (${defenseStrength})`);
    
    // Determine outcome
    if (attackStrength > defenseStrength) {
      // Attacker wins
      const remainingUnits = Math.floor((attackerUnits - 1) * (attackStrength / (attackStrength + defenseStrength)));
      attacker.setUnits(1); // Leave 1 unit behind
      defender.setOwner('player');
      defender.setUnits(remainingUnits);
      this.onMessage(`Attack successful! Captured ${defender.getName()} with ${remainingUnits} units`);
    } else {
      // Defender wins or tie
      const attackerLosses = Math.floor(attackerUnits * 0.5); // Lose half units on failed attack
      attacker.setUnits(Math.max(1, attackerUnits - attackerLosses));
      
      // Defender also loses some units
      const defenderLosses = Math.floor(defenderUnits * 0.3);
      defender.setUnits(Math.max(1, defenderUnits - defenderLosses));
      
      this.onMessage(`Attack failed! Lost ${attackerLosses} units`);
    }
  }
  
  private updateGameState(): void {
    // Count units and territories for each player
    let playerUnits = 0;
    let aiUnits = 0;
    let playerTerritories = 0;
    let aiTerritories = 0;
    
    for (const territory of this.territories) {
      if (territory.getOwner() === 'player') {
        playerUnits += territory.getUnits();
        playerTerritories++;
      } else if (territory.getOwner() === 'ai') {
        aiUnits += territory.getUnits();
        aiTerritories++;
      }
    }
    
    // Update game state
    this.gameState.playerUnits = playerUnits;
    this.gameState.aiUnits = aiUnits;
    this.gameState.playerTerritories = playerTerritories;
    this.gameState.aiTerritories = aiTerritories;
    
    // Check for win conditions
    if (aiTerritories === 0) {
      this.gameState.gameOver = true;
      this.gameState.winner = 'player';
      this.onMessage('You win! All AI territories captured.');
    } else if (playerTerritories === 0) {
      this.gameState.gameOver = true;
      this.gameState.winner = 'ai';
      this.onMessage('AI wins! All your territories captured.');
    }
    
    // Notify listeners
    this.onStateChange(this.gameState);
  }
  
  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    
    // Update controls
    this.controls.update();
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  // Public methods
  
  public start(): void {
    this.gameState.gameStarted = true;
    this.gameState.currentTurn = 'player';
    this.updateGameState();
    this.onMessage('Game started! Your turn.');
  }
  
  public async endPlayerTurn(): Promise<void> {
    if (!this.gameState.gameStarted || this.gameState.gameOver) {
      return;
    }
    
    // Add units to player territories (1 per territory, minimum)
    for (const territory of this.territories) {
      if (territory.getOwner() === 'player') {
        territory.setUnits(territory.getUnits() + 1);
      }
    }
    
    this.onMessage('Turn ended. Adding 1 unit to each of your territories.');
    this.updateGameState();
    
    // AI turn
    this.gameState.currentTurn = 'ai';
    this.onMessage('AI is thinking...');
    
    // Small delay to show AI "thinking"
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Execute AI turn
    await this.ai.executeTurn();
    
    // Add units to AI territories
    for (const territory of this.territories) {
      if (territory.getOwner() === 'ai') {
        territory.setUnits(territory.getUnits() + 1);
      }
    }
    
    // Back to player turn
    this.gameState.currentTurn = 'player';
    this.updateGameState();
    
    return Promise.resolve();
  }
  
  // Getters for AI player
  
  public getTerritories(): Territory[] {
    return this.territories;
  }
  
  public getGameState(): GameState {
    return this.gameState;
  }
}
