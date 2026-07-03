/**
 * bASSboss Canvas Visualizer
 * High-performance 2D canvas renderer that displays glowing frequency bars
 * and a pulsing subwoofer reacting to bass frequencies.
 */

class Visualizer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.analyser = null;
    this.animationFrameId = null;
    this.dataArray = null;
    this.bufferLength = 0;
    
    // Smooth bass tracking
    this.bassEnergy = 0;
    
    // Handle resizing
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Set up canvas dimensions with device pixel ratio scaling for crisp rendering
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  /**
   * Start the visualization render loop
   * @param {AnalyserNode} analyserNode - Web Audio API AnalyserNode
   */
  start(analyserNode) {
    this.analyser = analyserNode;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    
    // Stop any existing animation
    this.stop();
    
    // Start drawing loop
    const render = () => {
      this.draw();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  /**
   * Stop the render loop
   */
  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clear();
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Render frame
   */
  draw() {
    if (!this.analyser) return;

    const width = this.width;
    const height = this.height;
    const ctx = this.ctx;

    // Fetch frequency data
    this.analyser.getByteFrequencyData(this.dataArray);

    // Fade effect for trails (creates a cool motion-blur look)
    ctx.fillStyle = 'rgba(5, 1, 10, 0.2)';
    ctx.fillRect(0, 0, width, height);

    // Draw background grid lines (cyberpunk matrix feel)
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.03)';
    ctx.lineWidth = 1;
    const gridSpacing = 30;
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // --- CALCULATE BASS ENERGY ---
    // Bass frequencies are in the lowest indices of the array (roughly index 0 to 6)
    let bassSum = 0;
    const bassBinsCount = 8;
    for (let i = 0; i < bassBinsCount; i++) {
      bassSum += this.dataArray[i];
    }
    const currentBass = bassSum / bassBinsCount; // 0 to 255
    
    // Interpolate for smooth scaling (low-pass filter)
    this.bassEnergy = this.bassEnergy * 0.8 + currentBass * 0.2;

    // --- DRAW CENTRAL PULSING SUBWOOFER ---
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.22;
    // Scale expansion: up to 40% larger based on bass energy
    const pulseRadius = baseRadius + (this.bassEnergy / 255) * baseRadius * 0.45;

    // Draw subwoofer glow ring
    if (this.bassEnergy > 10) {
      const glowGrad = ctx.createRadialGradient(
        centerX, centerY, pulseRadius * 0.7, 
        centerX, centerY, pulseRadius * 1.5
      );
      glowGrad.addColorStop(0, 'rgba(255, 0, 127, 0.15)');
      glowGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.05)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw subwoofer core
    const coreGrad = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, pulseRadius
    );
    coreGrad.addColorStop(0, '#100520');
    coreGrad.addColorStop(0.7, '#24083c');
    coreGrad.addColorStop(0.95, '#ff007f'); // Neon pink border
    coreGrad.addColorStop(1, '#ff007f');

    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 0, 127, 0.5)';
    
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Draw inner accent rings (sound wave lines)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)'; // Neon cyan
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseRadius * 0.6 + (this.bassEnergy / 255) * 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseRadius * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    // --- DRAW SYMMETRICAL FREQUENCY BARS (Bottom-aligned) ---
    // We only render the first 60% of bins since higher ones are usually silent
    const renderBins = Math.floor(this.bufferLength * 0.6);
    const barWidth = (width / renderBins) * 0.95;
    
    for (let i = 0; i < renderBins; i++) {
      const val = this.dataArray[i]; // 0 to 255
      const percent = val / 255;
      const barHeight = percent * height * 0.55;

      // Symmetrical index: draw outwards from center or left-to-right.
      // Left-to-right looks great, but let's make it reflect from left & right to center!
      const x = i * (width / renderBins);
      const y = height - barHeight;

      // Color gradient: cyan in middle, green on top, dark purple on bottom
      const barGrad = ctx.createLinearGradient(x, height, x, y);
      barGrad.addColorStop(0, 'rgba(20, 10, 35, 0.3)');
      barGrad.addColorStop(0.5, '#00f0ff'); // Cyan
      barGrad.addColorStop(1, '#00ff66'); // Green

      ctx.fillStyle = barGrad;
      
      // Draw rounded frequency bar
      this.drawRoundedRect(ctx, x, y, barWidth, barHeight, Math.min(barWidth / 2, 4));
    }
  }

  /**
   * Helper to draw rounded rectangles
   */
  drawRoundedRect(ctx, x, y, width, height, radius) {
    if (height < 2) return;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }
}

window.Visualizer = Visualizer;
