import * as THREE from 'three';

export type Owner = 'player' | 'ai' | 'neutral';

export class Territory {
  private mesh: THREE.Mesh;
  private textMesh: THREE.Mesh;
  private owner: Owner = 'neutral';
  private units: number = 0;
  private selected: boolean = false;
  private position: THREE.Vector3;
  
  constructor(x: number, z: number, private scene: THREE.Scene, private name: string) {
    // Create hexagonal territory
    const geometry = new THREE.CylinderGeometry(1, 1, 0.5, 6);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xcccccc,
      roughness: 0.7,
      metalness: 0.2
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x, 0.25, z);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    
    // Store position for distance calculations
    this.position = new THREE.Vector3(x, 0, z);
    
    // Create text for unit count using a simple plane with texture
    const textGeometry = new THREE.PlaneGeometry(1, 0.5);
    const textMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.textMesh = new THREE.Mesh(textGeometry, textMaterial);
    this.textMesh.position.set(x, 1, z);
    this.textMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.textMesh);
    
    // Update the text with units
    this.updateText();
  }
  
  public getMesh(): THREE.Mesh {
    return this.mesh;
  }
  
  public getPosition(): THREE.Vector3 {
    return this.position;
  }
  
  public getName(): string {
    return this.name;
  }
  
  public getOwner(): Owner {
    return this.owner;
  }
  
  public getUnits(): number {
    return this.units;
  }
  
  public setOwner(owner: Owner): void {
    this.owner = owner;
    
    // Update color based on owner
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    
    if (owner === 'player') {
      material.color.set(0x4169E1); // Royal blue
    } else if (owner === 'ai') {
      material.color.set(0xDC143C); // Crimson
    } else {
      material.color.set(0xcccccc); // Gray
    }
  }
  
  public setUnits(units: number): void {
    this.units = Math.max(0, units);
    this.updateText();
  }
  
  public setSelected(selected: boolean): void {
    this.selected = selected;
    
    // Highlight selected territory
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    
    if (selected) {
      material.emissive.set(0xffff00);
      material.emissiveIntensity = 0.5;
    } else {
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
    }
  }
  
  private updateText(): void {
    // Update the text position to be above the territory
    const x = this.mesh.position.x;
    const y = this.mesh.position.y + 0.5;
    const z = this.mesh.position.z;
    
    this.textMesh.position.set(x, y, z);
    
    // Create a canvas to render the text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = 128;
    canvas.height = 64;
    
    context.fillStyle = 'white';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.units.toString(), canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Update the text mesh material
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    // Replace the material
    this.textMesh.material = material;
  }
}
