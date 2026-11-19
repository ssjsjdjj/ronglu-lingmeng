// Only this adapter knows about wx. Gameplay and rendering are shared with preview.
function createPlatform() {
  const canvas = wx.createCanvas();
  let audio;
  const tones = new Set();
  return {
    canvas,
    getWindow() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      let top = info.safeArea ? info.safeArea.top : 0;
      if (wx.getMenuButtonBoundingClientRect) {
        try { const menu = wx.getMenuButtonBoundingClientRect(); if (menu.bottom > 0) top = Math.max(top, menu.bottom + 8); } catch (_) {}
      }
      return {
        width: info.windowWidth,
        height: info.windowHeight,
        pixelRatio: Math.min(info.pixelRatio || 1, 3),
        top,
        bottom: info.safeArea ? Math.max(0, info.screenHeight - info.safeArea.bottom) : 0
      };
    },
    createImage: () => wx.createImage(),
    read: key => wx.getStorageSync(key),
    write: (key, value) => wx.setStorageSync(key, value),
    requestFrame: cb => requestAnimationFrame(cb),
    cancelFrame: id => cancelAnimationFrame(id),
    now: () => Date.now(),
    bind(handlers) {
      const point = e => {
        const t = e.changedTouches && e.changedTouches[0];
        return t ? { x: t.clientX, y: t.clientY, id: t.identifier } : null;
      };
      const start = e => { const p = point(e); if (p) handlers.start(p); };
      const end = e => { const p = point(e); if (p) handlers.end(p); };
      const cancel = () => handlers.cancel();
      wx.onTouchStart(start); wx.onTouchEnd(end); wx.onTouchCancel(cancel);
      const hide = () => { this.pauseAudio(); handlers.hide(); };
      const show = () => handlers.show();
      wx.onHide(hide); wx.onShow(show);
      const resize = () => handlers.resize();
      if (wx.onWindowResize) wx.onWindowResize(resize);
      return () => {
        wx.offTouchStart(start); wx.offTouchEnd(end); wx.offTouchCancel(cancel);
        wx.offHide(hide); wx.offShow(show);
        if (wx.offWindowResize) wx.offWindowResize(resize);
        this.pauseAudio();
        if (audio) { try { audio.close(); } catch (_) {} }
      };
    },
    enableAudio() {
      if (!audio && wx.createWebAudioContext) {
        try { audio = wx.createWebAudioContext(); } catch (_) {}
      }
      if (audio && audio.resume) { try { const p = audio.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
    },
    tone(freq, duration) {
      if (!audio) return;
      try {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0.025, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
        oscillator.connect(gain); gain.connect(audio.destination);
        tones.add(oscillator);
        oscillator.onended = () => { tones.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(); oscillator.stop(audio.currentTime + duration);
      } catch (_) {}
    },
    pauseAudio() {
      for (const oscillator of tones) { try { oscillator.stop(); } catch (_) {} }
      tones.clear();
      if (audio && audio.suspend) { try { const p = audio.suspend(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
    }
  };
}
module.exports = { createPlatform };
