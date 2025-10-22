import { Component } from '@angular/core';
import * as BABYLON from 'babylonjs';
import { Engine, Scene } from 'babylonjs';

@Component({
  selector: 'app-game',
  imports: [],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent {
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private reels: BABYLON.Mesh[] = [];
  private symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
  private reelSymbols: string[][] = [[], [], []];
  private currentSymbolIndices = [0, 0, 0];
  
  credits = 100;
  isSpinning = false;
  message = 'Good Luck!';
  isWinning = false;

  ngOnInit(): void {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    this.engine = new BABYLON.Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});
    this.scene = this.createScene();
    
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  ngOnDestroy(): void {
    if (this.engine) {
      this.engine.dispose();
    }
  }

  private createScene(): BABYLON.Scene {
    const scene = new BABYLON.Scene(this.engine);
    scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.18, 1);

    // Camera
    const camera = new BABYLON.ArcRotateCamera('camera', 0, Math.PI / 3, 15, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(document.getElementById('renderCanvas'), false);
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 20;

    // Lights
    const light1 = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
    light1.intensity = 0.6;
    const light2 = new BABYLON.PointLight('light2', new BABYLON.Vector3(0, 5, -5), scene);
    light2.intensity = 0.8;

    // Slot machine frame
    this.createSlotMachineFrame(scene);

    // Create reels
    for (let i = 0; i < 3; i++) {
      const reel = this.createReel(scene, i);
      this.reels.push(reel);
      this.reelSymbols[i] = this.shuffleSymbols();
      this.currentSymbolIndices[i] = 0;
    }

    return scene;
  }

  private createSlotMachineFrame(scene: BABYLON.Scene): void {
    // Main body
    const body = BABYLON.MeshBuilder.CreateBox('body', {width: 10, height: 8, depth: 2}, scene);
    body.position.z = -1;
    const bodyMat = new BABYLON.StandardMaterial('bodyMat', scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.8, 0.1, 0.1);
    bodyMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    body.material = bodyMat;

    // Top decoration
    const top = BABYLON.MeshBuilder.CreateBox('top', {width: 11, height: 1, depth: 2.5}, scene);
    top.position = new BABYLON.Vector3(0, 4.5, -0.5);
    const topMat = new BABYLON.StandardMaterial('topMat', scene);
    topMat.diffuseColor = new BABYLON.Color3(1, 0.84, 0);
    topMat.emissiveColor = new BABYLON.Color3(0.3, 0.25, 0);
    top.material = topMat;

    // Display window
    const window = BABYLON.MeshBuilder.CreateBox('window', {width: 9, height: 3, depth: 0.2}, scene);
    window.position = new BABYLON.Vector3(0, 0.5, 0.9);
    const windowMat = new BABYLON.StandardMaterial('windowMat', scene);
    windowMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.1);
    windowMat.alpha = 0.3;
    window.material = windowMat;
  }

  private createReel(scene: BABYLON.Scene, index: number): BABYLON.Mesh {
    const reel = BABYLON.MeshBuilder.CreateCylinder(`reel${index}`, {
      height: 4,
      diameter: 2,
      tessellation: 32
    }, scene);
    
    reel.rotation.x = Math.PI / 2;
    reel.position = new BABYLON.Vector3(-3 + index * 3, 0.5, 0);

    const mat = new BABYLON.StandardMaterial(`reelMat${index}`, scene);
    mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    reel.material = mat;

    // Create symbol texture on reel
    this.updateReelTexture(reel, index);

    return reel;
  }

  private updateReelTexture(reel: BABYLON.Mesh, reelIndex: number): void {
    const dynamicTexture = new BABYLON.DynamicTexture(`texture${reelIndex}`, 512, this.scene);
    const ctx = dynamicTexture.getContext();
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);
    
    const symbolIndex = this.currentSymbolIndices[reelIndex];
    const symbol = this.reelSymbols[reelIndex][symbolIndex];
    
    ctx.font = 'bold 180px Arial';
    //ctx.textAlign = 'center';
    //ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 256, 256);
    
    dynamicTexture.update();
    
    const mat = reel.material as BABYLON.StandardMaterial;
    mat.diffuseTexture = dynamicTexture;
  }

  private shuffleSymbols(): string[] {
    const shuffled = [...this.symbols];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async spin(): Promise<void> {
    if (this.isSpinning || this.credits < 10) return;

    this.credits -= 10;
    this.isSpinning = true;
    this.isWinning = false;
    this.message = 'Spinning...';

    // Spin each reel with different durations
    const spinPromises = this.reels.map((reel, index) => 
      this.spinReel(reel, index, 2000 + index * 500)
    );

    await Promise.all(spinPromises);

    this.checkWin();
    this.isSpinning = false;
  }

  private spinReel(reel: BABYLON.Mesh, reelIndex: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const spins = 3 + Math.random() * 2;
      const totalRotation = spins * Math.PI * 2;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        
        reel.rotation.z = eased * totalRotation;
        
        // Update symbol occasionally during spin
        if (Math.floor(eased * 10) > Math.floor((eased - 0.01) * 10)) {
          this.currentSymbolIndices[reelIndex] = 
            Math.floor(Math.random() * this.symbols.length);
          this.updateReelTexture(reel, reelIndex);
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Final symbol selection
          this.currentSymbolIndices[reelIndex] = 
            Math.floor(Math.random() * this.symbols.length);
          this.updateReelTexture(reel, reelIndex);
          reel.rotation.z = 0;
          resolve();
        }
      };
      
      animate();
    });
  }

  private checkWin(): void {
    const results = this.currentSymbolIndices.map((idx, reelIdx) => 
      this.reelSymbols[reelIdx][idx]
    );

    // Check for three matching symbols
    if (results[0] === results[1] && results[1] === results[2]) {
      const symbol = results[0];
      let winAmount = 50;
      
      if (symbol === '💎') winAmount = 200;
      else if (symbol === '7️⃣') winAmount = 150;
      else if (symbol === '⭐') winAmount = 100;
      
      this.credits += winAmount;
      this.message = `🎉 WIN ${winAmount} CREDITS! 🎉`;
      this.isWinning = true;
    } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
      this.credits += 20;
      this.message = 'Small Win! +20 credits';
      this.isWinning = true;
    } else {
      this.message = 'Try Again!';
      this.isWinning = false;
    }

    if (this.credits === 0) {
      this.message = 'Game Over! Refresh to play again';
    }
  }
}
