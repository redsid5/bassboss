/**
 * bASSboss Audio Engine
 * Handles Web Audio API routing, Equalizer (lowshelf, peaking, highshelf),
 * and the built-in test synthesizer.
 */

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.sourceNode = null;
    this.bassFilter = null;
    this.midFilter = null;
    this.trebleFilter = null;
    this.analyserNode = null;
    
    // EQ Default Gain values (in dB)
    this.eqValues = {
      bass: 6,   // Default bass boost!
      mid: 0,
      treble: 0
    };

    // Test Synthesizer state
    this.synthInterval = null;
    this.synthDestNode = null;
  }

  /**
   * Initialize Web Audio context
   */
  initContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Setup Audio graph for the receiver (phone)
   * @param {MediaStream} stream - Incoming WebRTC audio stream
   * @param {HTMLAudioElement} fallbackAudioEl - Hidden audio element for browser stream registration
   */
  setupReceiverGraph(stream, fallbackAudioEl) {
    this.initContext();

    // Attach stream to audio element to satisfy mobile browser playback engines
    if (fallbackAudioEl) {
      fallbackAudioEl.srcObject = stream;
      fallbackAudioEl.muted = true; // Mute the raw element; we route and play via Web Audio API destination
      fallbackAudioEl.play().catch(e => console.log("Direct stream play deferred:", e));
    }

    // Clean up existing source/filters if any
    this.disconnect();

    // Create source node from stream
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);

    // Create equalizer nodes
    
    // Bass filter: Low Shelf
    this.bassFilter = this.audioCtx.createBiquadFilter();
    this.bassFilter.type = 'lowshelf';
    this.bassFilter.frequency.value = 150; // Sub/mid bass cutoff
    this.bassFilter.gain.value = this.eqValues.bass;

    // Mid filter: Peaking (Bandpass-like adjustment)
    this.midFilter = this.audioCtx.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 1.0;
    this.midFilter.gain.value = this.eqValues.mid;

    // Treble filter: High Shelf
    this.trebleFilter = this.audioCtx.createBiquadFilter();
    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.frequency.value = 4000;
    this.trebleFilter.gain.value = this.eqValues.treble;

    // Analyser Node for Visualizations
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Audio Graph: Source -> Bass -> Mid -> Treble -> Analyser -> Output Speakers
    this.sourceNode.connect(this.bassFilter);
    this.bassFilter.connect(this.midFilter);
    this.midFilter.connect(this.trebleFilter);
    this.trebleFilter.connect(this.analyserNode);
    this.analyserNode.connect(this.audioCtx.destination);

    console.log("Audio Engine Graph initialized successfully.");
  }

  /**
   * Adjust Bass Gain
   * @param {number} db - Value in dB (usually 0 to 15)
   */
  setBass(db) {
    this.eqValues.bass = db;
    if (this.bassFilter) {
      // Smooth parameter transition to avoid clicks/pops
      this.bassFilter.gain.setTargetAtTime(db, this.audioCtx.currentTime, 0.05);
    }
  }

  /**
   * Adjust Mid Gain
   * @param {number} db - Value in dB (usually -10 to 10)
   */
  setMid(db) {
    this.eqValues.mid = db;
    if (this.midFilter) {
      this.midFilter.gain.setTargetAtTime(db, this.audioCtx.currentTime, 0.05);
    }
  }

  /**
   * Adjust Treble Gain
   * @param {number} db - Value in dB (usually -10 to 10)
   */
  setTreble(db) {
    this.eqValues.treble = db;
    if (this.trebleFilter) {
      this.trebleFilter.gain.setTargetAtTime(db, this.audioCtx.currentTime, 0.05);
    }
  }

  /**
   * Disconnect graph nodes
   */
  disconnect() {
    try {
      if (this.sourceNode) this.sourceNode.disconnect();
      if (this.bassFilter) this.bassFilter.disconnect();
      if (this.midFilter) this.midFilter.disconnect();
      if (this.trebleFilter) this.trebleFilter.disconnect();
      if (this.analyserNode) this.analyserNode.disconnect();
    } catch (e) {
      console.warn("Disconnection warning:", e);
    }
    
    this.sourceNode = null;
    this.bassFilter = null;
    this.midFilter = null;
    this.trebleFilter = null;
    this.analyserNode = null;
  }

  /**
   * Returns analyzer node for visualization loop
   */
  getAnalyser() {
    return this.analyserNode;
  }

  /**
   * Built-in Synthesizer loop for Laptop (Sender) testing.
   * Generates a cool, deep bassline beat programmatically.
   * @returns {MediaStream} Synthesizer audio stream to send over PeerJS connection.
   */
  startTestSynth() {
    this.initContext();
    this.stopTestSynth();

    // Create stream destination to output synth audio to WebRTC stream
    this.synthDestNode = this.audioCtx.createMediaStreamDestination();

    let step = 0;
    const tempo = 125; // BPM
    const stepDuration = 60 / tempo / 2; // Eighth notes (seconds)

    const playStep = () => {
      if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
      const now = this.audioCtx.currentTime;

      // --- SUB KICK (Deep Bass Drum) on beats 1, 3, 5, 7 ---
      if (step % 2 === 0) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        // Pitch sweep from 140Hz down to 45Hz
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);

        // Quick volume decay
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.synthDestNode);
        
        // Also play locally on laptop so sender knows it's working
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      }

      // --- BASS SYNTH PLUCK (Alternating notes for Visualizer) ---
      if (step % 4 === 1 || step % 4 === 3 || (step === 6)) {
        const osc = this.audioCtx.createOscillator();
        const filter = this.audioCtx.createBiquadFilter();
        const gain = this.audioCtx.createGain();

        // 80s Cyberpunk deep synth frequencies
        // Step 1: 55Hz (A1), Step 3: 65Hz (C2), Step 6: 73Hz (D2)
        const freqs = [55, 65, 55, 73, 55, 65, 73, 82];
        const freq = freqs[step];

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        // Lowpass filter envelope for "pluck" feel
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        filter.Q.value = 4;

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.synthDestNode);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
      }

      // --- HI-HAT TICK ---
      if (step % 2 === 1) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(10000, now);

        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.synthDestNode);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
      }

      step = (step + 1) % 8;
    };

    // Initialize schedule loop
    let nextNoteTime = this.audioCtx.currentTime;
    const scheduler = () => {
      while (nextNoteTime < this.audioCtx.currentTime + 0.1) {
        playStep();
        nextNoteTime += stepDuration;
      }
      this.synthInterval = setTimeout(scheduler, 25);
    };

    scheduler();

    return this.synthDestNode.stream;
  }

  /**
   * Stop test synthesizer
   */
  stopTestSynth() {
    if (this.synthInterval) {
      clearTimeout(this.synthInterval);
      this.synthInterval = null;
    }
    this.synthDestNode = null;
  }
}

// Export single instance
window.audioEngine = new AudioEngine();
