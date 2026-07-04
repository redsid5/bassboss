/**
 * bASSboss Main App Controller
 * Orchestrates PeerJS communication, layout tabs, canvas visualizer,
 * and user UI events.
 */

(function() {
  const PREFIX = "bassboss-";

  const PEER_CONFIG = {
    debug: 2,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      sdpSemantics: 'unified-plan'
    }
  };

  // --- DOM Elements ---
  const tabPhone = document.getElementById('tabPhone');
  const tabLaptop = document.getElementById('tabLaptop');
  const panelPhone = document.getElementById('panelPhone');
  const panelLaptop = document.getElementById('panelLaptop');
  
  const phoneCodeEl = document.getElementById('phoneCode');
  const phoneStatusEl = document.getElementById('phoneStatus');
  const phoneAudioEl = document.getElementById('phoneAudio');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const btnBassboss = document.getElementById('btnBassboss');
  const btnBackground = document.getElementById('btnBackground');
  
  const codeInput = document.getElementById('codeInput');
  const connectBtn = document.getElementById('connectBtn');
  const stopBtn = document.getElementById('stopBtn');
  const laptopStatusEl = document.getElementById('laptopStatus');
  const laptopShareGuide = document.getElementById('laptopShareGuide');

  const unlockOverlay = document.getElementById('unlockOverlay');
  const unlockBtn = document.getElementById('unlockBtn');
  
  const canvasEl = document.getElementById('visualizerCanvas');

  // Sound Check Buttons
  const phoneTestBtn = document.getElementById('phoneTestBtn');
  const laptopTestBtn = document.getElementById('laptopTestBtn');

  // EQ Sliders
  const bassSlider = document.getElementById('bassSlider');
  const midSlider = document.getElementById('midSlider');
  const trebleSlider = document.getElementById('trebleSlider');
  
  const bassVal = document.getElementById('bassVal');
  const midVal = document.getElementById('midVal');
  const trebleVal = document.getElementById('trebleVal');

  // --- App State ---
  let phonePeer = null;
  let laptopPeer = null;
  let activeCall = null;
  let captureStream = null;
  let visualizer = null;
  
  let isPhoneTesting = false;
  let isLaptopTesting = false;
  let audioUnlocked = false;
  let activeStream = null;
  let playbackMode = 'bassboss'; // 'bassboss' or 'background'

  // Initialize visualizer shell
  if (canvasEl) {
    visualizer = new Visualizer(canvasEl);
  }

  // --- Tab Navigation ---
  tabPhone.onclick = () => {
    switchTab('phone');
  };
  
  tabLaptop.onclick = () => {
    switchTab('laptop');
  };

  function switchTab(mode) {
    if (mode === 'phone') {
      tabPhone.dataset.active = "true";
      tabLaptop.dataset.active = "false";
      panelPhone.dataset.show = "true";
      panelLaptop.dataset.show = "false";
      if (!audioUnlocked) {
        unlockOverlay.style.display = 'flex';
      }
      // Trigger canvas resize
      if (visualizer) visualizer.resize();
    } else {
      tabLaptop.dataset.active = "true";
      tabPhone.dataset.active = "false";
      panelLaptop.dataset.show = "true";
      panelPhone.dataset.show = "false";
      unlockOverlay.style.display = 'none';
      
      // Stop phone side listeners/tests if switching away
      stopPhoneLocalTest();
    }
  }

  // --- Status Helpers ---
  function setStatus(el, msg, tone) {
    el.innerHTML = `<span class="status-indicator"></span> ${msg}`;
    el.dataset.tone = tone || "";
  }

  // --- Unlocking Audio (Browser Security Requirement) ---
  unlockBtn.onclick = () => {
    // Resume/Start AudioContext
    window.audioEngine.initContext();
    
    // Play hidden audio element (needs direct user interaction trigger)
    phoneAudioEl.muted = false;
    phoneAudioEl.play().catch(() => {});
    
    audioUnlocked = true;
    unlockOverlay.style.display = 'none';
  };

  // --- RECEIVER (PHONE) LOGIC ---
  
  // Generate random 4-digit code
  const code = String(Math.floor(1000 + Math.random() * 9000));
  if (phoneCodeEl) {
    phoneCodeEl.textContent = code;
  }

  // Build Share URL
  if (copyLinkBtn) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?code=${code}`;
    copyLinkBtn.onclick = () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        const originalText = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = '⚡ Link Copied!';
        setTimeout(() => {
          copyLinkBtn.innerHTML = originalText;
        }, 2000);
      }).catch(e => {
        alert(`Copy URL manually: ${shareUrl}`);
      });
    };
  }

  // Setup Equalizer Slider Listeners
  function updateSliderBackground(slider, val, min, max) {
    const percentage = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--percent', `${percentage}%`);
  }

  if (bassSlider) {
    updateSliderBackground(bassSlider, bassSlider.value, 0, 15);
    bassSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      bassVal.textContent = `+${val}dB`;
      if (val > 0) {
        bassVal.className = 'val boosted';
      } else {
        bassVal.className = 'val';
      }
      updateSliderBackground(bassSlider, val, 0, 15);
      window.audioEngine.setBass(val);
    };
  }

  if (midSlider) {
    midSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      midVal.textContent = val >= 0 ? `+${val}dB` : `${val}dB`;
      window.audioEngine.setMid(val);
    };
  }

  if (trebleSlider) {
    trebleSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      trebleVal.textContent = val >= 0 ? `+${val}dB` : `${val}dB`;
      window.audioEngine.setTreble(val);
    };
  }

  // Local Sound Check on Phone (Offline Test)
  if (phoneTestBtn) {
    phoneTestBtn.onclick = () => {
      if (isPhoneTesting) {
        stopPhoneLocalTest();
      } else {
        startPhoneLocalTest();
      }
    };
  }

  function startPhoneLocalTest() {
    isPhoneTesting = true;
    phoneTestBtn.textContent = "⏹ Stop Sound Check";
    phoneTestBtn.className = "btn btn-danger";
    setStatus(phoneStatusEl, "Playing built-in offline test beat...", "ok");
    
    // Play local loop directly through the receiver graph
    const synthStream = window.audioEngine.startTestSynth();
    window.audioEngine.setupReceiverGraph(synthStream, phoneAudioEl);
    
    // Connect visualizer
    if (visualizer) {
      visualizer.start(window.audioEngine.getAnalyser());
    }
  }

  function stopPhoneLocalTest() {
    if (!isPhoneTesting) return;
    isPhoneTesting = false;
    phoneTestBtn.textContent = "🔊 Offline Sound Check";
    phoneTestBtn.className = "btn btn-secondary";
    
    window.audioEngine.stopTestSynth();
    window.audioEngine.disconnect();
    if (visualizer) visualizer.stop();
    setStatus(phoneStatusEl, "Waiting for your laptop to connect...", "");
  }

  // Initialize Phone PeerJS Receiver
  function initPhonePeer() {
    if (!panelPhone) return; // only execute on page load if receiver elements exist
    
    phonePeer = new Peer(PREFIX + code, PEER_CONFIG);
    
    phonePeer.on('open', () => {
      setStatus(phoneStatusEl, 'Ready. Waiting for your laptop to connect...', '');
    });

    phonePeer.on('error', (err) => {
      console.error("PeerJS error:", err);
      if (err.type === 'unavailable-id') {
        setStatus(phoneStatusEl, 'Code already in use. Refreshing...', 'err');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus(phoneStatusEl, `Connection error: ${err.type}. Refresh to get a new code.`, 'err');
      }
    });

    phonePeer.on('call', (call) => {
      // If we are currently running a local test, turn it off first
      stopPhoneLocalTest();

      call.answer();
      
      call.on('stream', (remoteStream) => {
        activeStream = remoteStream;
        applyPlaybackMode();
      });

      call.on('close', () => {
        setStatus(phoneStatusEl, 'Laptop disconnected.', 'err');
        window.audioEngine.disconnect();
        if (visualizer) visualizer.stop();
        activeStream = null;
      });
      
      activeCall = call;
    });
  }

  function applyPlaybackMode() {
    if (!activeStream) return;
    
    if (playbackMode === 'bassboss') {
      if (btnBassboss) btnBassboss.dataset.active = "true";
      if (btnBackground) btnBackground.dataset.active = "false";
      
      // Route through equalizer (matches working version 1 exactly)
      window.audioEngine.setupReceiverGraph(activeStream, phoneAudioEl);
      if (visualizer) {
        visualizer.start(window.audioEngine.getAnalyser());
      }
      setStatus(phoneStatusEl, 'Connected — Playing laptop audio (EQ Active)', 'ok');
    } else {
      if (btnBassboss) btnBassboss.dataset.active = "false";
      if (btnBackground) btnBackground.dataset.active = "true";
      
      // Disconnect Web Audio graph
      window.audioEngine.disconnect();
      if (visualizer) {
        visualizer.stop();
      }
      
      // Route stream directly to speakers at full volume
      phoneAudioEl.srcObject = activeStream;
      phoneAudioEl.muted = false;
      phoneAudioEl.volume = 1.0;
      phoneAudioEl.play().catch(e => console.log("Play background failed:", e));
      
      setStatus(phoneStatusEl, 'Connected — Playing background audio (Natively)', 'ok');
    }
  }

  if (btnBassboss) {
    btnBassboss.onclick = () => {
      playbackMode = 'bassboss';
      applyPlaybackMode();
    };
  }
  if (btnBackground) {
    btnBackground.onclick = () => {
      playbackMode = 'background';
      applyPlaybackMode();
    };
  }


  // --- SENDER (LAPTOP) LOGIC ---
  
  if (connectBtn) {
    connectBtn.onclick = async () => {
      const enteredCode = codeInput.value.trim();
      if (!/^\d{4}$/.test(enteredCode)) {
        setStatus(laptopStatusEl, 'Please enter the 4-digit code shown on your phone.', 'err');
        return;
      }

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setStatus(laptopStatusEl, 'This browser does not support capturing tab audio. Please use Google Chrome or Microsoft Edge.', 'err');
        return;
      }

      // Stop test synth if it is running
      stopLaptopTestSynth();

      connectBtn.disabled = true;
      setStatus(laptopStatusEl, 'Select the browser tab you are watching, then check "Share tab audio".', 'ok');
      laptopShareGuide.style.display = 'block';

      try {
        // Prompt for tab sharing
        captureStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (e) {
        console.warn(e);
        setStatus(laptopStatusEl, 'Screen share cancelled or blocked.', 'err');
        connectBtn.disabled = false;
        return;
      }

      // Extract audio track
      const audioTracks = captureStream.getAudioTracks();
      if (audioTracks.length === 0) {
        setStatus(laptopStatusEl, 'Error: "Share tab audio" was NOT checked. Please disconnect and try again.', 'err');
        captureStream.getTracks().forEach(t => t.stop());
        connectBtn.disabled = false;
        return;
      }

      // Drop video tracks to save processing and network bandwidth
      captureStream.getVideoTracks().forEach(t => t.stop());
      const audioOnlyStream = new MediaStream(audioTracks);

      // Create new Peer for Laptop
      laptopPeer = new Peer(PEER_CONFIG);

      laptopPeer.on('open', () => {
        activeCall = laptopPeer.call(PREFIX + enteredCode, audioOnlyStream);
        
        setStatus(laptopStatusEl, 'Connected — Audio is streaming to your phone!', 'ok');
        connectBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        laptopShareGuide.style.display = 'none';

        // Listen for user stopping stream via browser button ("Stop sharing")
        audioTracks[0].onended = () => {
          setStatus(laptopStatusEl, 'Sharing stopped (tab was unshared).');
          cleanupLaptop();
        };
      });

      laptopPeer.on('error', (err) => {
        console.error("Laptop Peer Error:", err);
        setStatus(laptopStatusEl, 'Failed to connect. Make sure the code is correct and the phone tab is open.', 'err');
        cleanupLaptop();
      });
    };
  }

  // Stop sharing audio
  if (stopBtn) {
    stopBtn.onclick = () => {
      setStatus(laptopStatusEl, 'Sharing stopped.');
      cleanupLaptop();
    };
  }

  function cleanupLaptop() {
    stopLaptopTestSynth();
    if (captureStream) captureStream.getTracks().forEach(t => t.stop());
    if (activeCall) activeCall.close();
    if (laptopPeer) laptopPeer.destroy();
    
    captureStream = null; 
    activeCall = null; 
    laptopPeer = null;

    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.style.display = 'block';
    }
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
  }

  // Laptop test synthesizer stream connection (no screen sharing needed)
  if (laptopTestBtn) {
    laptopTestBtn.onclick = async () => {
      if (isLaptopTesting) {
        stopLaptopTestSynth();
      } else {
        await startLaptopTestSynth();
      }
    };
  }

  async function startLaptopTestSynth() {
    const enteredCode = codeInput.value.trim();
    if (!/^\d{4}$/.test(enteredCode)) {
      setStatus(laptopStatusEl, 'Please enter the 4-digit code shown on your phone first.', 'err');
      return;
    }

    isLaptopTesting = true;
    laptopTestBtn.textContent = "⏹ Stop Synth Test";
    laptopTestBtn.className = "btn btn-danger";
    setStatus(laptopStatusEl, "Connecting with built-in synth beat...", "ok");

    try {
      // Start local synth loop and get stream
      const synthStream = window.audioEngine.startTestSynth();
      
      laptopPeer = new Peer(PEER_CONFIG);
      laptopPeer.on('open', () => {
        activeCall = laptopPeer.call(PREFIX + enteredCode, synthStream);
        
        setStatus(laptopStatusEl, 'Streaming synth beat. Check your phone!', 'ok');
        connectBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      });

      laptopPeer.on('error', (err) => {
        setStatus(laptopStatusEl, 'Failed to reach phone. Check code.', 'err');
        stopLaptopTestSynth();
      });
    } catch(e) {
      console.error(e);
      stopLaptopTestSynth();
    }
  }

  function stopLaptopTestSynth() {
    if (!isLaptopTesting) return;
    isLaptopTesting = false;
    if (laptopTestBtn) {
      laptopTestBtn.textContent = "🎹 Test with Built-in Synth";
      laptopTestBtn.className = "btn btn-secondary";
    }
    window.audioEngine.stopTestSynth();
    
    if (activeCall) activeCall.close();
    if (laptopPeer) laptopPeer.destroy();
    activeCall = null;
    laptopPeer = null;

    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.style.display = 'block';
    }
    if (stopBtn) {
      stopBtn.style.display = 'none';
    }
    setStatus(laptopStatusEl, 'Synth stopped.', '');
  }

  // --- QUERY STRING CHECK (Auto-fill code) ---
  function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    if (urlCode && /^\d{4}$/.test(urlCode)) {
      // Auto switch to laptop view and fill code
      switchTab('laptop');
      if (codeInput) {
        codeInput.value = urlCode;
        // Visual indicator that it was auto-filled
        codeInput.style.borderColor = 'var(--neon-cyan)';
      }
      setStatus(laptopStatusEl, 'Code auto-filled from URL. Click connect to stream!', 'ok');
    } else {
      // Default to phone/receiver view on loading
      switchTab('phone');
      initPhonePeer();
    }
  }

  // Run URL checks on load
  window.addEventListener('DOMContentLoaded', checkUrlParams);
})();
