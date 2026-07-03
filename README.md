# 🔊 bASSboss &mdash; Premium Wireless Tab Audio Relay

**bASSboss** is a modern, responsive web application that turns any smartphone into a wireless "Bluetooth speaker" for your laptop's browser tabs. It uses WebRTC (PeerJS) to stream high-quality audio directly across devices with near-zero latency—no installation or sign-ups required.

Perfect for watching videos, listening to music, or playing games on your laptop while streaming the sound to a phone sitting next to you, across the room, or plugged into a sound system.

To live up to the name **bASSboss**, the receiving device features a Web Audio API-powered **Equalizer (Bass Booster)** and a **Dynamic Neon Visualizer** that pulses to sub-bass frequencies.

---

## ⚡ Key Features

1. **True Wireless Relay**: Near-zero latency audio streaming from laptop tabs to a phone.
2. **Equalizer Dashboard**:
   - **BASS BOOST**: Low-shelf Biquad Filter (+0dB to +15dB) to pump up sub-bass frequencies.
   - **Mids & Treble**: Custom sliders to balance vocals and clarity.
3. **Reactive Canvas Visualizer**:
   - Glowing audio frequency bars.
   - A pulsing "subwoofer" ring in the center that dynamically scales to the strength of low frequencies.
4. **Built-in Synth Sound Check**:
   - Play programmatically synthesized beats directly on the phone (for offline testing).
   - Stream synthesized test beats from the laptop (to check connection before sharing screen/tab audio).
5. **URL Sharing Auto-Fill**:
   - Copy a link on your phone containing the pairing code, open it on the laptop, and it auto-fills the pairing form.

---

## 🚀 How to Run Locally

For the best experience (and to allow full WebRTC and Web Audio API permissions), it is recommended to run the app using a local HTTP server:

### Option A: Python (Built-in)
Open a terminal in the project directory and run:
```bash
python -m http.server 8080
```
Then visit `http://localhost:8080` in your browser.

### Option B: Node.js (npx)
Open a terminal in the project directory and run:
```bash
npx http-server -p 8080
```
Then visit `http://localhost:8080` in your browser.

---

## 🛠️ Step-by-Step Usage Guide

### Step 1: Initialize Phone (Receiver)
1. Open the website on your phone.
2. Tap the **"TAP"** button on the overlay gate to unlock the audio context.
3. You will see a 4-digit pairing code (e.g. `4562`).
4. Keep this tab open and the phone screen awake.

### Step 2: Connect Laptop (Sender)
1. Open the website on your laptop.
2. Select the **Laptop (Source)** tab.
3. Enter the 4-digit pairing code from your phone (or just click "Copy Laptop link" on your phone to copy a pre-filled URL).
4. Click **"Connect & Share Tab Audio"**.
5. A browser window sharing prompt will appear:
   - Go to the **Chrome Tab** or **Edge Tab** section.
   - Select the tab playing the music/video (e.g., YouTube, Spotify Web, Soundcloud).
   - **CRITICAL**: Check the **"Also share tab audio"** checkbox in the bottom-left corner of the dialog.
   - Click **Share**.

### Step 3: Enjoy & Boost the Bass
1. Your laptop's audio will now stream directly to your phone.
2. Use the **BASS BOOST** slider on the phone to increase low frequencies (+6dB is enabled by default to immediately showcase the effect).
3. Watch the visualizer pulse in sync with the beat!

---

## 💡 Troubleshooting

- **No sound coming through?** 
  Verify that the **"Also share tab audio"** checkbox was checked during the screen sharing prompt. This checkbox is only visible when sharing a *Tab* (not the entire screen or window).
- **Is your browser supported?**
  Capturing tab audio requires Chrome or Edge on the sending device (laptop). Safari and Firefox do not currently support tab audio capture. The receiving device (phone) can be any modern browser, including iOS Safari.
- **Visualizer is flat / EQ has no effect?**
  Ensure that you tapped the initial **"TAP"** overlay button on your phone. Browser security requires direct user interaction to enable the Web Audio API.

---

## 🏗️ Technology Stack

- **WebRTC**: PeerJS library for secure, peer-to-peer audio streams.
- **Audio Processing**: Web Audio API `AudioContext` with `BiquadFilterNode` chain.
- **Graphics**: HTML5 `<canvas>` with 2D context drawing loop synchronized via `requestAnimationFrame`.
- **Styling**: Modern, responsive CSS variables, glassmorphism card layouts, and custom range sliders.
