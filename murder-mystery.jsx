
import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// DARK EVIDENCE — AUDIO ENGINE (Web Audio API, zero external files)
// ═══════════════════════════════════════════════════════════════════════════

// Singleton AudioContext
let _ctx = null;
function getCtx() {
  if(!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if(_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ── Master gain (mute toggle) ─────────────────────────────────────────────
let _masterGain = null;
function getMaster() {
  const ctx = getCtx();
  if(!_masterGain) {
    _masterGain = ctx.createGain();
    _masterGain.gain.value = 0.7;
    _masterGain.connect(ctx.destination);
  }
  return _masterGain;
}
function setMasterVolume(v) {
  getMaster().gain.setTargetAtTime(v, getCtx().currentTime, 0.05);
}

// ── Low-level helpers ─────────────────────────────────────────────────────
function osc(ctx, type, freq, start, dur, gainAmt=0.3, dest=null) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gainAmt, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(dest || getMaster());
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(ctx, start, dur, gainAmt=0.15, lowpass=800, dest=null) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gainAmt, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f); f.connect(g); g.connect(dest || getMaster());
  src.start(start); src.stop(start + dur + 0.05);
}

function reverb(ctx, seconds=1.5) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for(let c=0;c<2;c++){
    const d=buf.getChannelData(c);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

// ── Sound effects ─────────────────────────────────────────────────────────
const SFX = {

  // Dice roll — rattling noise burst + three quick pitched clicks
  diceRoll() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      noise(ctx, t,      0.08, 0.18, 1200);
      noise(ctx, t+0.08, 0.08, 0.15, 1400);
      noise(ctx, t+0.16, 0.10, 0.12, 1000);
      osc(ctx,"square",320,t+0.22,0.04,0.1);
      osc(ctx,"square",280,t+0.26,0.04,0.1);
    } catch(e){}
  },

  // Dice settle — single satisfying thud + pitched tone
  diceSettle(value) {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      const freqs = [261,294,330,349,392,440];
      noise(ctx, t, 0.06, 0.25, 600);
      osc(ctx,"sine", freqs[value-1]||330, t+0.04, 0.4, 0.2);
      osc(ctx,"sine", freqs[value-1]*2||660, t+0.04, 0.2, 0.06);
    } catch(e){}
  },

  // Move to room — soft footstep pair
  move() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      noise(ctx, t,    0.05, 0.12, 400);
      noise(ctx, t+0.12, 0.05, 0.10, 350);
    } catch(e){}
  },

  // Suggestion made — low investigative chord
  suggest() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      osc(ctx,"sine",220, t, 0.6, 0.15);
      osc(ctx,"sine",277, t, 0.6, 0.10);
      osc(ctx,"sine",330, t+0.1, 0.5, 0.08);
    } catch(e){}
  },

  // Card shown / disproved — soft positive chime
  cardShown() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      osc(ctx,"sine",523, t,    0.25, 0.12);
      osc(ctx,"sine",659, t+0.1,0.25, 0.10);
      osc(ctx,"sine",784, t+0.2,0.30, 0.08);
    } catch(e){}
  },

  // No disprove — tense drone
  noDisprove() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      osc(ctx,"sawtooth",110, t, 0.8, 0.12);
      osc(ctx,"sawtooth",116, t, 0.8, 0.08);
    } catch(e){}
  },

  // Accusation — dramatic low hit
  accuse() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      noise(ctx, t, 0.15, 0.3, 200);
      osc(ctx,"sawtooth",55, t, 0.8, 0.2);
      osc(ctx,"sawtooth",82, t+0.05, 0.6, 0.12);
    } catch(e){}
  },

  // Wrong accusation — buzzer sting
  wrongAccuse() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      osc(ctx,"sawtooth",180, t,    0.15, 0.25);
      osc(ctx,"sawtooth",160, t+0.15,0.15,0.20);
      osc(ctx,"sawtooth",140, t+0.30,0.20,0.15);
      noise(ctx, t, 0.45, 0.1, 300);
    } catch(e){}
  },

  // Win — triumphant ascending arpeggio
  win() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      const rv = reverb(ctx, 2);
      rv.connect(getMaster());
      [261,330,392,523,659,784].forEach((f,i)=>{
        osc(ctx,"sine",f, t+i*0.12, 0.8, 0.18, rv);
        osc(ctx,"triangle",f*2, t+i*0.12, 0.4, 0.06, rv);
      });
    } catch(e){}
  },

  // Haunting — eerie descending dissonance
  haunting() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      const rv = reverb(ctx, 3);
      rv.connect(getMaster());
      osc(ctx,"sine",220, t,    1.5, 0.12, rv);
      osc(ctx,"sine",233, t+0.1,1.2, 0.10, rv);
      osc(ctx,"sine",196, t+0.5,1.0, 0.08, rv);
      osc(ctx,"sine",185, t+0.8,0.8, 0.06, rv);
      noise(ctx, t, 0.3, 0.04, 600, rv);
    } catch(e){}
  },

  // Pass device — page turn / whoosh
  passDevice() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.4);
      g.connect(getMaster());
      noise(ctx, t, 0.4, 0.15, 2000, g);
      osc(ctx,"sine",440, t, 0.15, 0.06);
      osc(ctx,"sine",880, t+0.05, 0.1, 0.04);
    } catch(e){}
  },

  // Ability used — magical shimmer
  ability() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      const rv = reverb(ctx, 1);
      rv.connect(getMaster());
      [1046,1318,1568,2093].forEach((f,i)=>{
        osc(ctx,"sine",f, t+i*0.06, 0.35, 0.12, rv);
      });
    } catch(e){}
  },

  // UI click — subtle tick
  click() {
    try {
      const ctx = getCtx(); const t = ctx.currentTime;
      osc(ctx,"square",800, t, 0.04, 0.06);
    } catch(e){}
  },
};

// ── Ambient loops per theme ───────────────────────────────────────────────
// Each creates a looping atmospheric texture using oscillators + noise
let _ambientNodes = [];
let _ambientTheme = null;

function stopAmbient() {
  _ambientNodes.forEach(n=>{ try{n.stop();n.disconnect();}catch(e){} });
  _ambientNodes = [];
  _ambientTheme = null;
}

function startAmbient(theme) {
  if(_ambientTheme === theme) return;
  stopAmbient();
  try {
    const ctx = getCtx();
    const master = getMaster();
    _ambientTheme = theme;

    if(theme === "school") {
      // Distant fluorescent hum (120Hz) + occasional creak
      const hum = ctx.createOscillator();
      hum.frequency.value = 120;
      hum.type = "sine";
      const hg = ctx.createGain(); hg.gain.value = 0.04;
      const hum2 = ctx.createOscillator();
      hum2.frequency.value = 240; hum2.type = "sine";
      const hg2 = ctx.createGain(); hg2.gain.value = 0.02;
      // Low ventilation rumble
      const buf = ctx.createBuffer(1, ctx.sampleRate*4, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.15;
      const ns = ctx.createBufferSource(); ns.buffer=buf; ns.loop=true;
      const nf = ctx.createBiquadFilter(); nf.type="lowpass"; nf.frequency.value=80;
      const ng = ctx.createGain(); ng.gain.value=0.8;
      hum.connect(hg); hg.connect(master);
      hum2.connect(hg2); hg2.connect(master);
      ns.connect(nf); nf.connect(ng); ng.connect(master);
      hum.start(); hum2.start(); ns.start();
      _ambientNodes.push(hum, hum2, ns);

    } else if(theme === "caravan") {
      // Cricket chirps (high-freq pulsing) + distant water
      const cricket = ctx.createOscillator();
      cricket.frequency.value = 4200; cricket.type = "square";
      const cg = ctx.createGain();
      // LFO for cricket pulse
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7; lfo.type = "sine";
      const lg = ctx.createGain(); lg.gain.value = 0.015;
      lfo.connect(lg); lg.connect(cg.gain);
      cg.gain.value = 0.008;
      cricket.connect(cg); cg.connect(master);
      // Water babble — band-pass noise
      const wbuf = ctx.createBuffer(1, ctx.sampleRate*3, ctx.sampleRate);
      const wd = wbuf.getChannelData(0);
      for(let i=0;i<wd.length;i++) wd[i]=(Math.random()*2-1);
      const ws = ctx.createBufferSource(); ws.buffer=wbuf; ws.loop=true;
      const wf1 = ctx.createBiquadFilter(); wf1.type="bandpass"; wf1.frequency.value=600; wf1.Q.value=0.5;
      const wf2 = ctx.createBiquadFilter(); wf2.type="bandpass"; wf2.frequency.value=900; wf2.Q.value=0.5;
      const wg = ctx.createGain(); wg.gain.value=0.04;
      ws.connect(wf1); wf1.connect(wf2); wf2.connect(wg); wg.connect(master);
      cricket.start(); lfo.start(); ws.start();
      _ambientNodes.push(cricket, lfo, ws);

    } else if(theme === "carnival") {
      // Detuned music-box tone + low crowd rumble
      const notes = [523, 659, 784, 1047];
      const osc1 = ctx.createOscillator();
      osc1.type = "triangle"; osc1.frequency.value = 523;
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle"; osc2.frequency.value = 527; // slightly detuned
      const og = ctx.createGain(); og.gain.value = 0.025;
      // LFO tremolo
      const tlfo = ctx.createOscillator();
      tlfo.frequency.value = 4.5; tlfo.type = "sine";
      const tg = ctx.createGain(); tg.gain.value = 0.015;
      tlfo.connect(tg); tg.connect(og.gain);
      osc1.connect(og); osc2.connect(og); og.connect(master);
      // Crowd murmur
      const cbuf = ctx.createBuffer(1, ctx.sampleRate*5, ctx.sampleRate);
      const cd = cbuf.getChannelData(0);
      for(let i=0;i<cd.length;i++) cd[i]=(Math.random()*2-1);
      const cs = ctx.createBufferSource(); cs.buffer=cbuf; cs.loop=true;
      const cf = ctx.createBiquadFilter(); cf.type="bandpass"; cf.frequency.value=400; cf.Q.value=0.3;
      const cg2 = ctx.createGain(); cg2.gain.value=0.03;
      cs.connect(cf); cf.connect(cg2); cg2.connect(master);
      osc1.start(); osc2.start(); tlfo.start(); cs.start();
      _ambientNodes.push(osc1, osc2, tlfo, cs);
    }
  } catch(e){ console.warn("Audio ambient error:", e); }
}

const CHARACTER_IMAGES = {
  mustard: "data:image/jpeg;base64,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",
  plum: "data:image/jpeg;base64,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",
  white: "data:image/jpeg;base64,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",
  green: "data:image/jpeg;base64,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",
  peacock: "data:image/jpeg;base64,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",
  scarlet: "data:image/jpeg;base64,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",
};

const WEAPON_IMAGES = {
  candlestick: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAEYANwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKACvHvjZ8Z9d8KaxpPwr+Feh2viH4keKIpLiws7t2Sy0uxjbbLqd+6/MlujEKqr88r4RP4ivr7HHB4zxmvm39l1E8Z6v8TvjtqCebqPi/wAY6ho9lM3Jh0bSZWs7SBf7qlkmmYd3lb0FZ1Z+zjccVdl7SP2VfBus3UXiT48and/FrxMrCX7T4iGdMtH/ALtlpin7NboD0JV5PVyc16Va/DD4c2kKwWXw58MxRIMKkOiWwVfYAR4FYvx2+IN/8LvhTr3jXSbaCfUbOOKGySfJiFxNKkUbOBjcql95XIztxkZyPzv17xt438T6hJqniPxx4i1G6kJJkk1SeMDJzhY42VEX/ZVQB6V4GNzKGEkvaXbfRHsYLLKmMTcLJLufpf8A8K38B/8ARP8Aw/8A+Ca3/wDiKP8AhW/gP/on/h//AME1v/8AEV+YA1PW2YImva6zMQABq12SSfQeZXr+n/s4fGCTTLfVvEnjC38KRXa74I9d8V3FtK4903kqfY8juBXNRzX29/Zwk7f13OirlDoJOpUij7g/4Vv4D/6J/wCH/wDwTW//AMRR/wAK38B/9E/8P/8Agmt//iK/Prx18J/i18P7Bdb1e+1O80aT/V6rpviGe5tG5wAXWX5SewI57ZrjrEeLdTLrpl74ovDH9/7Nf30u30J2ucfjUzzdU5ck4ST7f0xwyd1I88akWj9Nv+Fb+A/+if8Ah/8A8E1v/wDEUf8ACt/Af/RP/D//AIJrf/4ivzDS98QSzi1i1nxA8zNsEaapeM5bOMBRJkn261JeyeKdNlEGo6j4ltJSu4JcajexMR0zhnBx79Kz/tyla/LL+vmX/YVS9udH6cf8K38B/wDRP/D/AP4Jrf8A+Io/4Vv4D/6J/wCH/wDwTW//AMRX5mSQ+M4mt1kuPFaG7/49w97fKZu/yAv8/BHTNTPpfxAjVmeLxmoUZJafUAB+JaqWdQe0Jf18xPI5reaP0t/4Vv4D/wCif+H/APwTW/8A8RR/wrfwH/0T/wAP/wDgmt//AIivzGs5vE+oz/ZtP1LxJdzc/uoNSvJHwOvyq5P6Uya+8QW0zW9xrPiCKVCVaOTVbtXUjsQZMg/Wp/tylvyy/r5lf2DVvbnR+nn/AArfwH/0T/w//wCCa3/+Io/4Vv4D/wCif+H/APwTW/8A8RX5oW9j47u4EurQeMJ4ZBuSWK61B0ceoYNgj6Uy8t/GmnW/2rUZ/FdnCWCCS4vb6JCxGcZZwOgJx6VX9tQtfklb+vMn+w53t7SNz9Mv+Fb+A/8Aon/h/wD8E1v/APEUf8K38B/9E/8AD/8A4Jrf/wCIr80U07x89j/aaR+Mms8bhcC41Dyivrv3bce+aisoPGepwG60y48VXsKuYzJbX19KocAEqSrkA4IOPel/bcNPcl/XzD+xJ/zo/TP/AIVv4D/6J/4f/wDBNb//ABFH/Ct/Af8A0T/w/wD+Ca3/APiK/NJ9L+IEaPJJF4zRI1Lsz3GoKqqASSSWwAACSfQVWvD4s05I5NQvvE9osozGbi/vYw465Us4z+FDzumt4y/r5j/sOo/to/Tb/hW/gP8A6J/4f/8ABNb/APxFH/Ct/Af/AET/AMP/APgmt/8A4ivzQt9P8e3lmNRs08ZXFpgt9oiudQeLA6neGx+tVrGTxVqcrwabqHiW8ljGXS31C9lZR6kK5I698U/7agrXhLX+u4LI6kr2mtD9OP8AhW/gP/on/h//AME1v/8AEUf8K38B/wDRP/D/AP4Jrf8A+Ir8yrNfF+oSyQWF34pupYuJEgvr6Vk5x8wVyRzxz3qtNfa/BK8FxrWvxSRsVdH1W7VlI7EGTIPtSeeU0ruMv6+Yf2DVeimj9Orj4ZfDueJorr4d+G5ImGGWXRLYqfrmPFec6v8AsY/ss63qEup3fwS8PQzzndL9hE1lG7d2McEiJuPc7cnA9K+FdH8XeMfD99HqeheM/ENjdxnKTR6tcMRznBV3ZWHqGBB7g1+g/wCzf8R9V+MPwvtfE2rLbx6raXU+l6gYkKxyTwkDzEX+EMpRivQFmA4FdeDzKOLbjTumjhxuW1MFFSm00z2SiiivpjyBj9vqP5185fsSf8kET/sa/E//AKeLmvo2Tt9R/OvnL9iT/kgif9jX4n/9PFzXNivgLp7l39scn/hn3X8f8/em/wDpZFXwGwwSK/TP4yfDxfir8Ndb8CC+Wyn1KFTa3LKWWG4jdZImYDkrvRQwHO0tjnkfA+tfAP43aDfyWF58K/ENy6MQJtNtxeQSAH7ySRE5B7bgreqivkc6w1WtOEqcW1a2mp9TkuKpUYyhOSTut9NCP4HX2hab8X/CN/4laJdNg1SJpnm+4jYIjZvQCQoc9sZrs/2sPDfjmP4waxq/iHTr64068dG0m58ppIPswRQERgCFIOcjg5ye+a4D/hT/AMYv+iQ+NP8AwSy/4V6L4Y8S/tk+ENNj0fRPDvxDWyhXZFDcaGbgRqOgUyKSAPTOBXJRpVHQlh68JJN3ulfpa1jtq1aftlXpVItpWs3bre6PObjwj8SNP+H7a7e6Rq9r4TOoJnzkeOBrkoQsgRsZ4yu/GMnHU19JfAfSNQ+C3gXS/FSwaK2u+Mry3nvLfU9UgsnttFUnDIJXUs7ZLAcjkA4xXinivS/2oPHN7Hf+LvBfxE1V4TmOO40iQwpzniEAR44Gfl575qr4x8KftFeP9Rh1bxh8NfGup3cEC2scr+HyhWJSSEARFGBk9q0oRlhZurCnNtKyul831t6GVecMTBQnUik3d2b+S6fM6T4ofDCP4ZfHLQpNCkSXw9rep2upaPcxNvj8tp0LRhgcHYx45OVKn6exfGU/Db4zfEXWvhP4kaHw54x0d0h8PayxzFeq8SP9mm/4E7AD8VOcqfCJrH9p640XRfD0/wAPvGsmneHZY59Kgfw0pFo6fcKEx549CSD3zWV4n8E/tBeM9cn8S+Jvhl43vtTutnnXJ0Jo2fYoVSQiqMgAc47D0rZTdNTjToycZNNprpbX8djJxhV5JVK0VKKaun5q2npue1/FHRNV8LeMv2e/Dur4jvtLFpa3ASTeokS6gU4I6jjr/Ksb46fF/wCM/h348a/ofgrxZriwWt1brZ6fBH50RJgiOwR7SGBYnj3NcLrMX7U3iDU9F1nW/A/ju8vfDrK+mTy+HwXtypBBB2fNgqp+bPIB610j/ED9t6RGQ6X8RAD3Xw5GCPofKzVzqylzKMZxu4tWWuitZ2aIpwhDlcpQk0pJ3emrvdXTPXL/AEzStP8A2ufh/qEVlb6frOq6BLda3b2+Aq3JhcZIHc/MM99oJr5J8fxXEvxA8SAQzO0ms3mPkYliZ29ue1dXpuh/tNaT4sbx5ZeBfiB/wkDb86jNozzzfMu08yKw+7x04HArsR8RP231YMdH+IDYYNg+GosH2/1XSscQvrUXGcJr3m9I33SXl1RrQksJNOM4NcqWsrbO/n3O68M+JIPDP7K/gy5vPiB4l8Jb9Wu4vtOi2QuZnPmznynUkbV4z9QBXkPiP4matrHjTRYJ/FPiT4geF9N1GwvFt9YtfLkuJs4aPZjCEklQM/NnrWj4d179sHwlo8OgeG/C3j3T9Oty7RW8XhxCql3Lty0ZJyzE8nvTPEWs/tf+LbSCy8QeGPiDdR2l3FfW7DQPKeGePOyRHjRSCMnvV1p1KlOEYwmnFL7O9u65rW+RFFQp1JSc4NO/2u//AG7e/wAz2C/+I3hPxX433aP+0J8Q/CGo3dysMGiXejE29rJkKIfJ8vbjPHzZ78968i8Z+LPi98Kvi7rHhNPHcsEl3rEF3eNparbw3JlEYDeWB8v7sIu3Jxg/WtCHx7+2vDai1GheP3KpsWaTw4jzqv8A10Me78TzXnl18Ofjzf6w3iG/+GXjy61J5xdPdXGkSyyPKCCGYsDu6DrxxRiq1aqouEJ8173s1p97/QeHp0aTftJw5bbXT/RHr37XnxM8f6J8TdV8JaT4u1G30W50iGOawSQeS6yxMJAVI5yCa6jxjpXh3xB8Rf2f9H8XFJdLuNCjEkczZSSQRqY0bPUM4jBHfp3rwbxf4T/aK8faude8YfDbxvqeoGJYTPJoBRii9AQiqDjJHIqbxNoH7SfjGLS4vEnw88c3i6LEILA/2AYzbxjGFUxopwNq4znGKJVq06lScqcmm00mn0lcqNKjCFOEakU0mm15q3zOy+NHxg+PmhfFLVdFg1vWPD9tZXrwaXp9jF5cDWytiJlAUiXcoU9+SVwMYrrv2e9Y8b61+0Rd33xD0waRqs/hd2dBZLaF4yIyszIoGWbJYnrnI4xgcbYeOP21tO01NLttB+ILQxrsR5vD4llVcY4kdC34kk1zmlW37VOi+I7jxfYeEPiJ/bN1E0E17Poz3ErRsdxTMqtgEjoAKpTqxrxq2qPW9rWVv6ZDp0nRdO9NO1rqWrZ6nqUVhovwY1PUv2W9RNwttPJB4svmiZdaaMEkOn9yH7zYQA7Tkchq+VWcysZWkLs5LFi24sTzknvXpvhDQP2lvAOqXOs+Dvh7460u9u4jDPJDoJO9C24rtZSoG4Z4HH4msW/+Fvxq1K9mv7v4ReMTPcOZJDHoDRKWJycKihV57AAc1xYynVxKi405JpWtbT5dn3R14OpSwzkpVItPW99fn38jij0r7s/YI/5I1qx/6mnUP/QYq+TNK+BPxs1m9jsLT4T+JoXkIHmXtoLSFATjLSSkAAd+px0B6V94fAT4azfBj4cWfg97yG91CSaW/wBSuIlYRPdynLiMHnYoCqpPJCgkAnFduR4erRqynUi0rHDnmJo1qUYU5Ju56xRRRX2x8oMk7fUfzr5y/Yk/5IIn/Y1+J/8A08XNfRsnb6j+dfOX7En/ACQRP+xr8T/+ni5rmxXwF09z3ik2r6ClorhZ0CbV/uj8qNq/3R+VLRSATav90flRtX+6PypaKAE2r/dH5UbV/uj8qWigBNq/3R+VG1f7o/KlpyRu/wB1SaAGbV/uj8qNq/3R+VWBat/E2PpzTvsqY+81NRbFdFXav90flRtX+6Pyq19mj9WprWrfwtn603FoXMivtX+6Pyo2r/dH5U942T7ykU2pehQm1f7o/Kjav90flS0UAJtX+6Pyo2r/AHR+VLRQAm1f7o/Kjav90flS0UAJgDoBS0UUAbFFFFewcgyTt9R/OvnL9iT/AJIIn/Y1+J//AE8XNfRsnb6j+dfOX7En/JBE/wCxr8T/APp4ua5sV8BdPc94ooorhZ0BRRRSAKKKKACgAk4AyTQAScAZJq3DCIxzy3c01HmJbsMjth96Tk+lTgADAFLRWyikQ3cKKKQHIyASD7UxC0UmT/db8jRkfTPAzTswA8jFQyWowWj4PpU9FS0nuGxnkEEg9RRVySISD0btVRgQ20rg1lKNjRSTEoooqSgooooAKKKKANiiiivYOQZJ2+o/nXzl+xJ/yQRP+xr8T/8Ap4ua+jZO31H86+cv2JP+SCJ/2Nfif/08XNc2K+Aunue8UUUVws6AooopAFHtRU1tFubew47U0mxPRXJLeHyxuP3j+lTUUVslYzeoUUUUxGd4gvr/AE3R72/0zTZNQureBpIrWPAaZgMhRnufTv0718n6h8Std/4V7Lda/ZeJ7qxhVjf6tcxGzkgkE3zhWWQsuzlcPtORzX2D149a8C+Il0t1+zf8QkWK6UXc2rSKzQMRGHvXOGHTK8gjPGDWkFe6GnZnnln4/m0608SRTWuri4jS3MrQ30881juiBDxxsQB8p3AkdcZ716t+yR4r17xd8HtNu9Zl1nUoLVmt7DXtWBFxrVvksLkhiTjLFAclWCgqSMVh6ZMHg+NKzw3AmmtdNJZEKlP+JXGEySO2AeR0Nd1+zRMk37Pfw2ZEZQPC+nIdykZKwKuR7EgkHuMHvVOPKhylfSx6ZRRRWJIVHNH5i5HUVJRRa4ygQBSVPcxYPmKPrVesGrM0TuLRRRSGFFFFAGxRRRXsHIMk7fUfzr5y/Yk/5IIn/Y1+J/8A08XNfRsnb6j+dfOX7En/ACQRP+xr8T/+ni5rmxXwF09z3iiiiuFnQFFFFIBQpYhQOtXUUKoUdqgtV5L9hwKs1rBWM5O4UUUVZIUUUUAZmv6zHoWntfvC0zblSOJWCl3PQZPAHByewrwnUZNab4dSeBvG9vYPZ+Kp71CdJmZ5kLO9yxLyBFA2g89cCvbfGXhiHxf4evdAlvp7JrlB5V1BgyW8o5WRQeCQccHgjIr5T1b4I/EDwnrVtZ+JtVk8TWfl3N3a38F3JbYkhhLMZYwwMXyjAKBx7jiri7JspWbseiRX+i22h+MU0HVLy81PxTBbCWbVUCgEQxwRklcAcMnb+HuOun+zF4nvNO8KaV8FvElokWu+DNIhtTPbvut722iCRrKndWG5AynjJJUkV4Jd+D21+4sNJ+Hfh8Sal4mSePTxc3Wy1TyEV5mlkZy6lFf5Qitnk+mPo74A/s/6d8GLW/1C81iTWvEOsBReXzBljjjU5WCFCSVQE5JJyTjOMAUcza1HOKi7Hr1FFFQQFFFFACFQw2nvVFhtYqe1X6r3S8Bx261E0VF6leiiisjQKKKKANiiiivYOQZJ2+o/nXzl+xJ/yQRP+xr8T/8Ap4ua+jZO31H86+cv2JP+SCJ/2Nfif/08XNc2K+Aunue8UUUVws6AoxRT4VDSAULcTdi3EmyML/nNOoorZGQUUUUwCkJx+PFLWX4n0+91bw7qel6bfNZ3d3ZzQQXCnBikZCFf8CRQgJb7XdG0yZLfUtVs7SWT/VpPcJGz8ZOAxGeAf1rxXX/iNoPjt9d8QeE9Uttch8N2l/ptvp1gGkm1OZ1VZCGBCGMEEKBnJVmzjFfJPi7xtrngfVde0rxt8NtPj18ITcXevvNIRFG4ISMAbJYXRMA7lBJ6npXZeDfim76fa2kA0jwxFlI4LSHTPskbRFQGAdWVSx4bIycLjvWmkTSELnd6zrsnw38MeHPinq+nvBL4M1aQPoVw/myahDcwpG1xGUJCzRoXKk5XhgcZyPqnRPGHhbxEMaHr9hesAp2RTqXAZQVyhO4ZBB5HevkXxv471GP7Hp093Z+IGFyl0iXVtHGkSdFwzHPB3fOOucGuZTxSvibX7bSpPDB1DX5rkjT4rGc/aHYlNpyMKFX5iXyMLn0pOSkhypvc++Ac0tYfgnS9b0TwppeleI9ZOrana2yRXV6Vx5zgdffAIGTycZPJrcqGZBRRRQAU103oVPenUUmrgZ54ODRUky7ZD781HWBqFFFFAzYooor2DkGSdvqP5185fsSf8kET/sa/E/8A6eLmvo2Tt9R/OvnL9iT/AJIIn/Y1+J//AE8XNc2K+Aunue8UUUVws6Aqa1XLE46CoatWylUJ7k04q7Jk7ImooorYzCiiigApCM0tFAHm3xz+GGgfEbwddDU7Gaa9023nns2t4laVm8tv3eCDuUttO31UGvjvWfhZpOl+EbjxXos2uzGO9gjlt7nTJI4v3kijImYAckn0yTj0FfoW6h1KHowK/nxXz9qtmL3wIbGZpg1vqVvExTBGFuSr5yOygkcj5gK0jqmVF62PmrxF4Pm8I+DPEfiKG4u430SZbDe9odsbmISOZD/DtBOVI9DkV9afsxeB9D0r4Y+G/GbaBb2viDXNHt5L25WIBmUjIVOTtjI2sADyNpPoPCvjpcCD4Q/EFzIZBcwalM4EYXzGKQoh4+8evJ5+bGBivrb4cafBpPw+8MaVa7zBZ6NYwRl/vbVgUDPvxRNWVwlJvQ6LHJpaKKzJCiiigAooooArXY5VgPaoKt3PMRJ6g5qpWM9GaRegUUUVJRsUUUV7ByDJO31H86+cv2JP+SCJ/wBjX4n/APTxc19GydvqP5185fsSf8kET/sa/E//AKeLmubFfAXT3PeKKKK4WdAVchH7sVT61ejGI1HtVU9yZbDqKKK1MwooooAKKKKAE6c189fECWbS7DWLOHYEHiEK6M+3908wYYB643g49BmvoU9K8P8Aipp0jT+KXtpEimt5bXUI2fPGYgDjBHJ2EfrVw2aGtzyT4vacL74bamsbxqmreINP0qN8lkAlvIEcep4/EjFfZUcUcEawQoEjjARVHQAcAfkK+R/F8Iv/AA78PfD2wI9/8QdJZiAcEJdrIck/eOIjz7V9dZzz681U9kJ7hRRRWQBRRRQAUUUUAMlGY2GO1Uqvt91vpVDOazmXDYKKKKzLNiiiivYOQZJ2+o/nXzl+xJ/yQRP+xr8T/wDp4ua+jZO31H86+cv2JP8Akgif9jX4n/8ATxc1zYr4C6e57xRRRXCzoENX0+4v0qgavp9xfpVUyJDqKKK1ICiiigAooooAK8F+OWq3Vlq2safpUsUd5PplpcfvwVUqryBtjFSpYDt717yeBXivjTxWsl/4yvbWGe7TSRFZx/ZlaTdIsQ8xSygqpHm889jnBqobjW55TYWms618RvhZYX88ZsYfEsl9GLcPIFNvBLjcSoADM2c+mK+wB0FfKeo+LU8N+H/B3ja9025sItL8a2tpLHcfJiKVjA5Dthdg87eWHHy4PrX1YMAYByBVVBPcWiiiswCiiigAooooAQ1njpWgelUO1Zz6FQCiiiszQ2KKKK9g5Bknb6j+dfOX7En/ACQRP+xr8T/+ni5r6Nk7fUfzr5y/Yk/5IIn/AGNfif8A9PFzXNivgLp7nvFFFFcLOgOlXozmNfpVGrkBzEvNVTJlsSUUUVqZhRRRQAUUUUAIfTBr5g8b2Gh+HdX1Xwf4E+JsDwWWlS6ndeHjqkb3FnMJd0flgDfhvnJRzkbM5+avQv2hLbxvJpdlc6FpWt6rocKzf2pZaHqL2d45IAR9yfPJGo3ZRDuzg4bt4no/i7TLXTEs9N0iyt9Ohnjimhv7lpriBU6xyHbuL7ucvjgjI71WyKgrsYbvwp4q1fwf4A+Jfjm3t/D/AI2GrXd3aXdyo+3SQsEjiWSUfuVkUs2ch22EDBNfYGj2dhpulWWnaSipY21vHBbKrlwIkQKgDEkkYA5yc+pr5Y1nxJot/p90/iaz0ew0WZnjCx3rwDz8gksc4l3LtXYDnJPPaup/Zs0Hxhp+rS3Ok6N4g8PeBUgeG103W52cu2F8toInG+JFIbB+VSrdD1D0ktGOcWndn0XRRRUEBRRRQAUUUUANc4Qn2qgKvSnEbfSqVZz0LhsFFFFZlmxRRRXsHIMk7fUfzr5y/Yk/5IIn/Y1+J/8A08XNfRsnb6j+dfOX7En/ACQRP+xr8T/+ni5rmxXwF09z3iiiiuFnQFWrU5Qr6GqtT2rYYj1FODsyZbFmiiitjMKKKKACiikJxQBk+JPEVl4bsftdyrSyyN5dvbx8yTyYyFX8uvavnXX/AA94n8baj4l1Y6Jo2kav4hjjhtpY7hmlWOJQoRzuRXkChiTtYYIByMCvV/HNxd3njiwggG+20mxaaUL1MkzgKoPqVTAxzlh61558UXcx2WmgRXBec29xI/RlUhplT2aTy4h2wue1VZNWNKejuc9qfwz+Idr4X02ysdPgv9S0nxHba/Zz/LIuY2LiGRMkBMAr8oBAcHO4Zr2L4RfGE/EM3GjeINBfQfElipkuLFnLpLGG2GWFiAWUMNrAjIJHUHNeSeDBJpmti2hu3jiu7xY5pEkJ3SkLJKVz2VTEi+jOOxJrUudbl0n4peFfEioiRrfQaXdzdP3NyJcKT6eZIpx6ge1VypIJa6n0nRSDpg9qWszMKKKKACiiigCG4YrHg9zVWp7piSo9qgrGbuzSKsgoooqSjYooor2DkGSdvqP5185fsSf8kET/ALGvxP8A+ni5r6Nk7fUfzr5y/Yk/5IIn/Y1+J/8A08XNc2K+Aunue8UUUVws6Ap0bbHDe9NooQGhRTIX3xg9+hp9bIxCkBBOByfasrxR4o0DwZoN74o8U6tb6ZpOnR+bc3dw2I41yBk456kAAckkAV8ba/4wuv2o/EmrS+GPiZ4isfB6XL2emxaU8kEUpjBUzS7MOdzZO1scY4q4x5gPtLUda0fSE8zVtVs7Jf71zcJEP/HiK4fxR+0B8IfDNs7y+PtGvblVLC00+7S6mxg8sIy2xeOXbAH1wK+RT/wT7TVbFdQm8Y395c7pG/02JpUbPzcqzZXnjvnOcjpVOz/4J/6dp2vHWtC1e00u7Qqpvo5JYpMqNxZTyBhhlcgHJ7YzWihFagk2fTtj410o/atRv/EGlW+rXEn2qYXU4WOGXGIoznoEHG3ruwCMg1ka14O0jxzPpFzbfEHSVtdInlmlhVj8xWNlAz0yHcOc9yfWvn2z+EPgH4da7NbRa5d6lcRx7p1u764lgEwXe25nBUsWOQBznOAK948O/EDwdBZwppUMl+7p+/8As1qTxjcRjZjkgZyB82cY4BXPE2UJJaG1b+CNF026ivotft54raOSVmKsgcSSq+4E8cAIMegFeefFvWrWTwxdxW3zxzOVjkhO4w3KfMrcZwy/u3UnqjKwySBXa69490C40ySHWLK4sLGBAsjtG3lpCUA3f6s8bht6cEevA8i8TeAtC+Kemz6H4Z1i1uIZuJjBbSi5jGXZZW+4pUbmUONw59MkiaeyBp21PYPhP+2D8L/FOhJb+PPFem+GfEFkvlXsWoyiCKVgdvmxu3y7WKngkEHOMjBPq2l/Fb4X62ofRviR4Wvgf+ffWLeT+T18MS/8E7rj7N9u0Hx2iEBgjzad5k/CAAFgR8vJHQHjp65epf8ABP8Avra8W/vPGsrWa7C8U8QjkxtJchtq5GQFwuMB+5XlyjHcxSfQ/R+3u7W8iE9pcxTxH+OJw6/mOKmr8e/EfxBH7NnjDT9Q8MfEO7XVLSdRJY2U+xHjWXlXUsdylcDaQckknFfqz8MviX4V+LHhG18Z+Drx7iwuiyFZIykkMoxvidSMhlzg/hWbWl0NprRnV0UUyV9iM3cDj61LAqTNulJHTpTaKK53qahRRRQBsUUUV7ByDJO31H86+cv2JP8Akgif9jX4n/8ATxc19GydvqP5185fsSf8kET/ALGvxP8A+ni5rmxXwF09z3iiiiuFnQFFFFICa2fDbD3q1WeCQQw6g5q8jiRd4rWD0sZyRznxA+H3hv4l+HX8MeKLZ5rNriC7UI5UrNC4kjb0OGUHBBB71yGnfAHwnpFy13Bo3h+7mfrPcaTHHMfcyRbST716pRWsZOOxJydt4UksY1ittIskVOgh1G5jx+HNWjZ6tEMDSJH4xldYkyB7bhXRUU/aSA4nVPBula+qxeIfBEeppGSUW8uopwueuN4JGaS18C+F7OH7Pb/DTTkiz9wJbYPp2zXb/gKKftGGpwtx4B8I3QK3Hwp0qUNxhxbkfrVnS/CGkaFI0+gfD+y0yRgAZLWWKFsemVXNdjk+tH4Ue0YanJXWg6hfuTNpM5Gc4k8RXKr/AN8pxXNa98D/AAx4pRl17wfol4G/gv769vIyfeNnCmvUqKXtJAeB63+xp8HdfsY9Ol8G+G9GhRgznQ9IjtZZMc4MrbnA9ga9M+Ffwp8GfBnwdb+BfAWnPZ6VbSSThJJmld5ZDl3ZmOSSf/rV2FFS5NqwbhVa6fkR+nJqd2CqWPaqTEsxY9zms5S6FRWtxKKKKyNAooooA2KKKK9g5Bknb6j+dfOX7En/ACQRP+xr8T/+ni5r6Nk7fUfzr5y/Yk/5IIn/AGNfif8A9PFzXNivgLp7nvFFFFcLOgKKKKQBUsEuw7W+6f51FRTTsJq5oUVBbzbhsY8jpU9bLUzasFFFFMQUUUUAFFFFABRRRQAUUe1Q3EpQbV+8aTdhrUjnlBbavQdfrUJOaPeisW7u5pawUUUUhhRRRQBsUUUV7ByDJO31H86+cv2JP+SCJ/2Nfif/ANPFzX0c/OPqP5184fsSH/iwqD/qavE//p4ua5sV8BdPc95ooorhZ0BRRRSAKKKKADOO+KtQzq/yOQG/nVWinF8pLVzQoqrHcleHGferCurjKnIrVSTIaaHUUUVQgooooAKKazKoyxxUElyTxH0PfvSbsO1x804QbV5b+VVSSTnJo/HNFYt3NErBRRRSGFFFFABRRRQBsUUUV7ByDHz6E/Svm79mOSPwP4i+J/wE1OTytQ8L+Lb7X9Nibg3GiavK11bTJn7ypK08DEdHi5xuFfSleR/Gv4Kal441PSPiT8OvEMPhn4keFUlj0jVJoDLa3lrJgzadfxqQ0tpKQCQDvjcCRCGGDnVh7SNhxfK7nolFeGWP7VPh/wAJSx6D+0X4b1D4Ua4pEbXGqI02g3bf37TVY1MBQ9lmMUgzgrXbQ/H74E3MSzW/xr8AyRuMqy+JrHB/OWvOdOadrHQpJ6ne0Vw3/C9vgh/0WXwH/wCFNY//AB2j/he3wQ/6LN4D/wDCmsf/AI7S5J9mO67nc0Vw3/C9vgh/0WXwH/4U1j/8do/4Xt8EP+izeA//AAprH/47RyT7MLrudzRXDf8AC9fgh/0WbwH/AOFNY/8Ax2j/AIXr8EP+izeA/wDwprH/AOO0ckuwXXc7mlDEHIOK4X/he3wQ/wCiy+A//Cmsf/jtH/C9vgh/0WXwH/4U1j/8do5J9mF13O+W4kUckH8KcLs/3P1rz/8A4Xt8EP8Aos3gP/wprH/47R/wvb4I/wDRZfAX/hTWP/x2qtU7MXus9AN23aP9aa1zI3QgVwP/AAvb4If9Fm8B/wDhTWP/AMdo/wCF7fBD/osvgP8A8Kax/wDjtHLU6oPdXU7liWOWJNFcN/wvX4If9Fm8B/8AhTWP/wAdo/4Xr8EP+izeA/8AwprH/wCO0uSfZjujuaK4b/he3wQ/6LN4D/8ACmsf/jtH/C9vgh/0WXwH/wCFNY//AB2lyT7MLrudzRXDf8L2+CH/AEWbwH/4U1j/APHaP+F6/BD/AKLN4D/8Kax/+O0ck+zC67nc0Vw3/C9vgh/0WbwH/wCFNY//AB2j/he3wQ/6LN4D/wDCmsf/AI7RyT7MLrudzRXCSfHr4GQxmWX40+AURRkk+JrLj/yLXGXv7af7MtrcyW1t8T49WEZ2tcaJpGoapbBu6+fa28kRYdwGyM80/ZyfQLo+hqKKK9U5QpMDuKKKAIpoYJ4nt54UkjkBV0ZQVYHsQeDXF3PwN+Cl9M1zd/CHwTcSucs8nh+zdifcmPNFFICL/hQPwL/6Iv4F/wDCbsv/AI1R/wAKB+Bf/RF/Av8A4Tdl/wDGqKKAD/hQPwL/AOiL+Bf/AAm7L/41R/woH4F/9EX8C/8AhN2X/wAaoooAP+FA/Av/AKIv4F/8Juy/+NUf8KB+Bf8A0RfwL/4Tdl/8aoooAP8AhQPwL/6Iv4F/8Juy/wDjVH/CgfgX/wBEX8C/+E3Zf/GqKKAD/hQPwL/6Iv4F/wDCbsv/AI1R/wAKB+Bf/RF/Av8A4Tdl/wDGqKKAD/hQPwL/AOiL+Bf/AAm7L/41R/woH4F/9EX8C/8AhN2X/wAaoooAP+FA/Av/AKIv4F/8Juy/+NUf8KB+Bf8A0RfwL/4Tdl/8aoooAP8AhQPwL/6Iv4F/8Juy/wDjVH/CgfgX/wBEX8C/+E3Zf/GqKKAD/hQPwL/6Iv4F/wDCbsv/AI1R/wAKB+Bf/RF/Av8A4Tdl/wDGqKKAD/hQPwL/AOiL+Bf/AAm7L/41R/woD4F/9EX8Cf8AhN2X/wAaoooQD4fgT8ELWUTwfB7wRFInIdPDtmpH0IjrtLWCzs7eO1srdIIIlCxxxR7EUDsAOBRRTA//2Q==",
  knife: "data:image/jpeg;base64,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",
  lead_pipe: "data:image/jpeg;base64,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",
  revolver: "data:image/jpeg;base64,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",
  rope: "data:image/jpeg;base64,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",
  wrench: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAEYANwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDs/wBrwk/tA69kk7dN0sDPYeS5x+ZP514/XuH7ZWg6tp3xvn1m6spVsdd0uyaxuNvyStArRyxg/wB9coSvXDgjIzXh+G/uN+VfmeZprFSbP0DK2nhYW7BRRhv7rflRhv7rflXBc9AK9Y/Zj+IMXgL4raYupuv9ka0w02+STBRS5xFKQeMrJjn0Zq8nw391vyo2v2Vh746Vth6zoVY1F0ZlXoqvTlTl1PrTwL8I7f4U/Gjx9498TrKvhzwRbTajZyO2ftRuVZo0BP3iF3qQc5bbU3xC+EkPxW+Mnw98d+GBKfDvjO1gvbt42IFr9mUO65H3SyEKOnzBsYNcL8Wv2mF+Inwg0jwBbwapHqy/Zv7aup4EWK88pOQpDlhmTDHI5x2pfhX+0wngD4Nar8P7qDVX1ci7GjXUUKNFZiZeAxaQNw5Zhgcbu+K+h+sYHm+r/Y+K/ne9vu0PA+r4xQ9v9v4beVrX+/U6OdvC37RP7UV74V1mGWbwzp1rdWlilpcGDDW+C0oK9dzluT1XHpUnhv4F+B/EfiePw3f/AAA+Jeg2s0ssR1e41XMMAXdiQhlwVOBjr1HBrx/4AfEbR/hR8RLfxl4gstQu7aGzuLcRWcaNI7SAAffZRjgknPUV0Pw1+PKaBeeJ/D/xAfXPEHg7xLHcLLbeYXuYmZjseNnceX8pwQGwMKe1Y0MVhalp10uaUnfRbaWu7Xt6M0rYfE0rwoN8sUravfW9rWTfqbfwj+CfgTxJ4l+J2ianZ6j4nj8HKX0s6bemCW+w0wCDb8rM3lqAemc9qzPGnhz4a+DdI+0+IPgH478PyXqy29lcalrYaMz+WSpMZA3gHBI4/lVX4M/FP4ffDF/G+m6jF4putL8T2S6faTWcMMV5DDiTLsTJtWQCQYIyMjPHSotT139njUrJreS9+L13Kiu9supXtrNAs+whGYAlgM4B284zWaqYf6ulHlUtb3t303Te3Zo1tXdduXM46Wtftrs7L7mdl4I/Z38DeP8A4I6FrVlqq6X44143Mdg13ev9nu5oJG3RiPopZEPTOOTg4Irj/Cvwfsofh/8AFS+8daFe2niPwRFbG2je4eII0u8Eso+WRflDKehB646ZGu/E3TL74L+C/h/pserW2teGdQmvpLrYqRFnZ2BjdXLhlLDBwD9K7uf9qKPxP8Gte8C+OdKu7nxNqdmLCPVra3j2zwoQ0f2g7lO4EuMqCPmzjJOaUsFJqOiko79G+X809mDjjI6q7i5fNLm6eTW5lWfw2+Fnw1+Gmg+Pfi1b6zrep+KUM+maNp1yLZEhAzvlk65wVPp8wAB5I47xfcfAzVfDc2reDNO8TeH9dgkRU0q6nS9trhCeWE3DJtAJIPXjA6kdVo3xe+H/AIs+HmkfDn4z+G9anXw9lNI1nRpEFzFGf+Wbo/DYAA75CrwCM1zHi/VfgnD4en8P/D3wd4hub24kSQ63rd2izQhSfkjhiG0qc4OcZ49KwrTpez/dOKjZbr3r9fP53saU1VVT96pc13s/dt00/wCBc9A+LP7M+r2y+GLr4S+BdYv7TUNIjvL+VLgzhbhwDsG8jaApyAPxrE+Lfwc034cfCDwV4gvtAvtM8U6vcywapFcXTOI9iuRiPJVSwCnj14ql8bfjHZfECbwy3hGXX9PTRNHTTbhJn8kSuuMSL5cjAg4/iwRVfx78VtH8W/BvwX8PoYtYk1bw1PLNdXV0imOcSB87W3l8jeB8wHTtWleWCftfZrW2m1r6baepNBYxKlzvS+u97a7u/oeVUUYb+635UYb+6fyrw7ns2CijDf3W/KjDf3G/Ki4Gv4LZo/HnhB0Yqw8S6OAQcHm+hB/ME/nX6pyDEjAdmI/U1+Xvwr8P6n4o+Kfg/QtJt3luv7bsb+QBSfKtra4SaWZsdECxkbjxuZR1OK/UBm3sXxjJJwfrX1WSRksPK66nyWeSTxEbPoeJeDkWD9t74gLCNgufhv4ZmlA/jcX+pIGPvtAH4V9C18+eE/8Ak9/xz/2TLw3/AOnLU6+g6+tpfAj56W4UUUVoScf4q8H+FvHGkPoPjDw9Yazp7sJDbXsAkTeOjDPKsPUEGvPz+yp+zyevwu03n0ubr/45XrFFeK4RlukdsZyj8La+Z5P/AMMp/s8f9Eu0/wD8Cbr/AOO0f8Mp/s8f9Eu0/wD8Cbr/AOO16xRS9lD+Vfciva1P5n97PJ/+GU/2eP8Aol2n/wDgTdf/AB2j/hlP9nj/AKJfp/8A4E3X/wAdr1iil7KH8q+5B7Wp/M/vZ5R/wyn+zyP+aYaf/wCBV1/8dpP+GUv2eOv/AAq/T/8AwKuv/jtesUUeyp/yr7kL2tT+Z/ezyf8A4ZT/AGeen/Cr9P59Lq6/+O0H9lL9nk/80w0//wACrr/47XrFFHsqf8q+4ftqn8z+9nk//DKX7PGMD4X6d/4E3P8A8do/4ZT/AGeR/wA0w0//AMCbr/47XrSxyNyqGnCCY/w/rT9lDpFEutPrJ/eeR/8ADKf7PP8A0S/T/wDwJuf/AI7R/wAMpfs8dP8AhV2n/wDgVc//AB2vW2ikH8B/OmEEcEEfUUvY0+sV9yH7Wp/M/vZ5P/wyn+zz/wBEv0//AMCrr/47R/wyn+zz/wBEw0//AMCrr/47XrFFP2cP5V9w/a1P5n97PJ/+GU/2ef8AomGn/wDgVdf/AB2j/hlP9nj/AKJfp/8A4E3X/wAdr1iik6VP+Vfche1qfzP72eT/APDKf7PH/RLtP/8AAm6/+O0f8Mp/s8f9Eu0//wACbr/47XrFFHsofyr7kP2tT+Z/ezyf/hlP9nj/AKJdp/8A4E3X/wAdo/4ZT/Z47fC/Tx/283X/AMdr1iij2UP5V9yD2tT+Z/ezmPBPwx+H3w4gnt/Avg/S9FF1jz3toAJZsdPMkOXfHoSQK6eiirSSVkZO7d2zxTwn/wAnv+Of+yZeG/8A05anX0HXz54T/wCT3/HP/ZMvDf8A6ctTr6Dr1aXwI55bhRRRWhJj0UUV451hRRRQAUUUUAFH86ACxAA5q3FCI+SMmmldibsRJalhl/lz2FWEjRB8qge+KXGOKWtkkjO7YUUUUxBSMqsMMAaWigCvJbDGUP4GoGUqcEYq/TJI1kGCOfWs3C+xSl3KVFOkjaM4P502s2rFhRRRQMKKKKACiiijoJninhP/AJPf8c/9ky8N/wDpy1OvoOvnzwn/AMnv+Of+yZeG/wD05anX0HXqUvgRzy3CiiitCTHooorxzrCiiigAoCsTheSelFWbeLaN5HJ/SnFczE3YfDEsa9Oe9SUUVslbQy3CiiimAUUySWOFGllkVEQbmZiAoHuTxXmHjX9pT4S+CC8d/wCIku5o+GS0w+D6biQPyzTSbA9Sor5hu/28vh7BIfI8PX00I6yGcKevYbDz+NesfC749fDz4sBofDepvHeoCxs7kBZWAHJXBIb8OfanyO1wPRqKQEEZFLUgNdBIMNVJ0MbFWFX6jlj8wfTpUSjfVFRdinRRz0I6UVkaBRRRQAUUUUdBM8U8J/8AJ7/jn/smXhv/ANOWp19B18+eE/8Ak9/xz/2TLw3/AOnLU6+g69Sl8COeW4UUUVoSY9FFFeOdYUUUUAPhj3yDI4HJq70qKBNic9TUtbRVkZN3YUUUVQgrP1/Vk0HQ9Q1yWJpU0+1lumjXq4RCxA/KtCo5kieNlmCFCpDBwCpXvnPGPrRewHwV8T/2lvDvjy6Fp4v8fnS9MilRX03TDI8YJCnMjIMvhXySW42sNoIxXhx+O/7PVjcm2vPBmtTxrIyPemWOX5QTtkSNyGbPB2kjAYdTX6D/ABH/AGXv2dPiFc/2/wCOfh/pH2hIfKN1DO1jmP5uG8plU/ePJGea5Kw/Z6/Yj8GO0i+CPBs00KLIWvJWvnZd+QQHZw3zD+EGt4zstENNHzl4Fs/hH8a2Og/DvWprbUTZzXkEVzp0dqJyoH7sMGbc5yflHoea4/wVaa14a8evqOmXFxYPo5M7SZ2/MhGMY75P5A17b+0LovwD8FTeDvHvwcfQNG1ZNX+x3S6FOsBFobeQM7QrjYUIGGwvUg5zXjfhDxbpXi3Ub+D7PfWl3NaS3UF1NOksdxtbDB0A+XO5TnPr6V0RlzKzFZrVbH6baHqB1bRNP1VkCG9tYrgqOil0DEfmavVxnwav/wC1PhV4Uv8AeG87SoDkHI6Y/pXZ1wyVnYEFFFFICrcx7W8wdDUNXpFDqVPeqJBHB7VlNWZpF6BRRRUFBRRRR0EzxTwn/wAnv+Of+yZeG/8A05anX0HXz54T/wCT3/HP/ZMvDf8A6ctTr6Dr1KXwI55bhRRRWhJj0UUV451hTok3uBjjPNNqxarwz/hTirsT0LFFFFbmQUUUUAFcT8aLZ7v4XeJIo7WW4IsjIYojh3VWDMB+ANdtUN5bRXlrNZzLujnjeJx6hlINNbgfnzq/9r6pdR2o1q7W180RLJLKsca5XKtljjbgrjpWhH4Qv7GyiuZw9+hBBeCXzImP1iJGc84zXGfGbxlN8K77SL22tre9EA8mwtr+MTwRA54CPkcYJ6UzTPHd78S9Ak1fVYLaw1FbgW8v9k24tYrqPaCpkiTCkg57V3ppO1iJJ79DqrzTPh1eTLc+MrHw9uKhT9pzPMRgEBdoY59+Mcis2Dw/+z1p1wLnSrW+s5mheNHt7a5XCsPmRf3mADgjpjms200nTbGPz5w6leQWTnOenNSDUtFjKr5sMYjXCBk4IxyMD37VpYnY9n8CftCS/CDw9oeg6lGt54XtZE0y3MsRS7hiJ+V2YcE5PQj8a+tdI1Wx1zTLbV9LuBPaXkSzQyDoVI4+n09c1+dWrwnxBpCWkDrdR3F1CFSM8g784xmvsn9mO51GX4V21pqQYPY3c8CDOVCEhwqnqQNxH1zXNiKSUeZFRdz1iiiiuQsKqXKbZMjvVuorhd0WR/CamSuhp2ZUooorBGoUUUU+gmeKeE/+T3/HP/ZMvDf/AKctTr6Dr588J/8AJ7/jn/smXhv/ANOWp19B16lL4Ec8twooorQkx6KKK8c6wq7CoSMD8apDlgMVfAwAPStIIibFooorQgKKKKACgdR9aKB94UAflX+07ItzqugW8sUhePVLmIcAhl8yTaV65xnoR19q1fhbqVr4c8NapqOs2huraO6WWaUqCYIEgd5G2KV3thQAoIGaq/tAW66v4k8MxqBiXULooxfZ8/myd/r/AJ71pWOj6jcfDrxbpml2zCWa1ljSKPq0ht3VRkk87mPOfbpXfBX1FJ6HT6B8ZPhp4wkt7bwb8PPEfiBrmPeJGlgtUAPcnDkD6+lZPjMeILGdrnTPg5bsmRKY21pGYqR9zGxB75zXk3wG0S4+GXh9G+I+jeIdBV1AJW0MjkjnHyk/LxiuxvPid8HtQnddM8UatIiyv55l0xkaNyBkY3E9qE/5huCvodb8ELbxh8SPFreEvDPwyv8AQbiIiW/1C+YywWMbcblYjaSRkAAknt3x+g3g3wlpfgfw7aeG9IVjBarzI/LyueXdj3LHn8vSvlf9hnVtD1PxF4tutH1aW8iuLK1PltuxAySPuVsgdfMBU4GRux0r7DrnrybfL0FawUUUVgMKRgCpB6EUtJQwKBGCQe3FFPmBWRh75plc9rGqCiiijoDPFPCf/J7/AI5/7Jl4b/8ATlqdfQdfPnhP/k9/xz/2TLw3/wCnLU6+g69Sl8COeW4UUUVoSY9FFFeOdY6MbpFHvV2qluMyj2q3WkNjOYtFFFaEhRRRQAUAcj60UDqOKNgZ+YHxRhjPjTw2J7kQL9rvCr7A5GJZM7VIOSeQBg84rrvC97cql1bwSbpLqSOOVSpyzdMYIBBwehArzz403dxF4n8PrZuplWO+dPnwSzTSLycgL1xknvXS+FNYfwx8PPEXieaJWudPG2FdoGHEZOQuSOAPU13x91iktC38XvFfgLwdCdI1Wdr3VzGsq6daN+9YHpubGIlPqeT1Ckc18w6Npv8AbGuzandCGNtYubi6uYk2rGvyE7B5nygALj5uPlyetfUE/wCyNYeHPhd4U+MXinWLvVvGXi/ULe61SWfdLaW0d3C7QRrhl2EMYlMrFhk424wD59L8GvGvhq7jm1PS0t7a3llMJWRWknDbgFUEdfm5JzwOOtS5OoXBxgrI+3v2H9G8P6f8CrG+0fTLK3ub69uWvZ4EhD3DrIVXe0ShSVXCgZbHryQPoWvFf2RNJv8AR/glpdjqKzhku7kos0/msqb+BkKFAznAQYxycsWr2quWp8RN7hRRRUAFFFIaAK10MSA+oqGp7sHcp9qgrGW5pHYKKKKnoNninhP/AJPf8c/9ky8N/wDpy1OvoOvnzwn/AMnv+Of+yZeG/wD05anX0HXqUvgRzy3CiiitCTHooorxzrJbb/WfhVuqlt/rPwq3W0NjOW4UUUVRIUUUUAFID8wpaa7bUZuoAJoA/JT4gXMd14y0X7XaNdxMt4GhL7QQZXJDfK3A69Olb0RlvfAOuxtuhSZpS0KZ2q3ltgdFBwD6d6y/F2mrcfEXR7cXKW6x2s0zyMBiMEk5wSMg59f61p2LKfB+qHcH3XcieYHyuDEcYwSMe4r0FbmKep+jfh7wroPir4SaF4Z8U6RBqOnXehWMNza3C5VwII+o6ggjII5BHFcRYfsl/Dexvopzrfiy5toeIrO41dpIkH90MV34x/tZ969c8OwfZfD+mWuAPJsoI8D2jUVoVw8zWzJKmmaVp+i6fb6TpVqltZ2qCKGJPuoo6CrdFFTuAUUUUAFFFFAEF30U+5qtVm7+6v1NVqxnuaR2Ciiip6DZ4p4T/wCT3/HP/ZMvDf8A6ctTr6Dr588J/wDJ7/jn/smXhv8A9OWp19B16lL4Ec8twooorQkx6KKK8c6yW2/1v1FW6pwHEq/jVytYPQzmFFFFWSFFFFABVe/k8qxuZf7kLt+SmrFU9YbZpF8/pbSn/wAcNNbgz8utW8yT4i2E1rdtbm100SCTcSy52kjhlPrwGHB7ZzSWVlI/g+4QhfM/tRo3O8t/yyJ6575Pr0rI1m9ST4lzW+rzbIEs4EDh1RIj8mxm3kAL/eyR9cVr2Usq+CZFaRmZdf8AL3DGCwiIP4dOR6iu1bjufqXYp5dlbx/3YUH/AI6KnqOAYhjH+wv8qkrie4gooopAFFFFABRRRQBBd/dX8arVPdE7lHoKgrGe5pHYKKKKnoNninhP/k9/xz/2TLw3/wCnLU6+g6+fPCf/ACe/45/7Jl4b/wDTlqdfQdepS+BHPLcKKKK0JMeiiivHOsdGcMD6Gr1Z4yDkVfU5UH1Ga0gzOYtFFFaEhRRRQAVn+IX2aBqb5xtspzn0/dtWhWR4ucJ4U1pzxt066Of+2TVUfiQM/LCK6eP41aoPtMlu1taR7ZFOGVgi4we2P19K6yx0tJ/A9k45aXXp2LDCliERRgDp19PbiuT1i1Sz+K/iqS5SS6uI7ZTDHHtG19oRckkFQME7sE8HjpXoOjjZ4G0RX2q76xMHG0dhCDjA5Ga7E9GOTtY/SKIYiQeijr9KfSKcqPoKWuJ7iCiiikAUUUUAFFFFAFO4OZD7VHTpG3Oxx3ptYPc1QUUUUugM8U8J/wDJ7/jn/smXhv8A9OWp19B18+eE/wDk9/xz/wBky8N/+nLU6+g69Sl8COeW4UUUVoSY9FFFeOdYVbtmzFgnpxVSpbVsSFT0IqoOzJkrluiiitjMKKKKACue+IU5tvAniKYdV0q6x9TGR/WuhrjPjFe/Yfhpr8ocoZLYW4I65lkSMY9/mqo/EgZ+Z+rT2lz8YvGVyFYRwSGLaQjkgb1x83ynnHX8OldvoZKeGfDMEylh/b7o/Q71zb5479T69K8ynnnuPiJ44udPuBCiXsoJIRnO+RlCqp+ZupyRkqOfc+kWDW8fw60TVjKnmRaxeqwz8xRRAeCMZxj2rsS0YT6H6Y4A4HSimxndGreqg/pTq4nuAUUUUgCiiigApsjBYy3tx9adUF0+AEHfrUydhpXZWooorE1CiiijoJninhP/AJPf8c/9ky8N/wDpy1OvoOvnzwn/AMnv+Of+yZeG/wD05anX0HXqUvgRzy3CiiitCTHooorxzrClUlSGHY5pKB1oQF9W3AMO4zS1BbNgbD+FT1uncye4UUUUxBXlv7R98bT4ci28yONb3VbGF3kbChFl81sn6RfrXqVeIftRSO2jaHBvASKW/vGBGeY7KQISMHjc457e3WtKKvNClsfnB4J1m1XxT4r1C5is5WkuFR1nJTCN951YfxDj+vavQ7S5nuvglbajjaltr+qRF0A728bhSevVTXgXwzvvGniz4kan4K8FQ6W/yyXl/c3sYdLaAMqkhT3JKAAc5OenNezW+pXNp+znPNGkAkj8U3UUi8/eNnyRjtuz+VdaldFTjZo/VPw/fpqug6bqkYwl5ZwXCj2eNWH86v1yXwhuRefCjwXdgk+d4e018n3to662uF7iCiiikAUUUUAHbNUpnDyFvwqxO+xDjqaqYxxWc30LiuoUUUVmWFFFFHQTPFPCf/J7/jn/ALJl4b/9OWp19B18+eE/+T3/ABz/ANky8N/+nLU6+g69Sl8COeW4UUUVoSY9FFFeOdYUUUUAKrFWDZ6VdVgyhh3qjUsEuw7W6H9KuDsyZK5booorUzCvEv2ldKvL0+GJ4ARDPJfaPKxIEaG8g8tGbJAxkdz1Fe21S1jRtL8QaZcaPrVjDeWV0hjmglXKup9f8eoqoS5ZJg1c/Fuz+FX7QnwU+Nt5rvhzwfNcOon0+6S7hZoZInIJLEFTwQrKQeCo6gmvTNR0LVNO+Dw8M6vbhNUu9alvzbhcks0WxVC8nJLYA6/XNfoBqn7PeogvF4U+MfjHRrNuEtJXhv44l/uo0ymQAdhuOKvfD/8AZt+HvgbU4/Edwt54g12NjIuoarIJGjkPV0jACK3+1gsOxFb88IrR3HzX6HXfCzQbzwt8NPCnhvUVZbvS9FsrSdWbcVkSFQy59iCPwrqaKK5hBRRRQAUdOpoqvcTZBjX8TSbshpXIpn8xj6DgCmUUVg22zRaIKKKKBhRRRR0EzxTwn/ye/wCOf+yZeG//AE5anX0HXz54T/5Pf8c/9ky8N/8Apy1OvoOvUpfAjnluFFFFaEmPRRRXjnWFFFFABRRRQBPBOB8jn6GrNZ9TQzlflfkevpWkZdGRKPYtUUgIIyDke1LWhAUUUUAFFFFABRQeOvFV5Z8DbH+ZpOSQ0mx082z5UPzH9Kq0detFYttmiVgooopDCiiigAoooo6CZ4p4T/5Pf8c/9ky8N/8Apy1OvoOvnzwn/wAnv+Of+yZeG/8A05anX0HXqUvgRzy3CiiitCTHopCcZ9R1HpS1451hRRRQAUUUUAFFFFADkdkPynH0qZbkDhx+IqvRVKTQmkXFnib+MD607zI/74/OqNFNTaFyl0yxj+MVG10o+6pP6VWoo52HKhzyPJ95uPSmk5ooqNygooooAKKKKACiiigAopMgdTivM/jH8cNH+GEdr4b0fTJPFHxA15Wj8O+ErFwbzUJegeT/AJ97VOslxJhFXOCWIBcYuTshOSjqznfhzMNc/bQ+KupWXzW+geDPC+g3TjoLtpb672fURTxk/wC9X0PXlv7Pnwk1L4U+D7n/AISrVYNX8ZeKdRn8Q+K9ThUrHdancbd6xA8rDEiRwxjskYJGSa9Sr1YR5YpHM9WFFFFUI8Dj/Zt+IfheP7N8L/2ofiBo9gvEOna9DZ+IYIF7Kkl3H9owBwA0zcUv/CnP2nv+jtYv/De6d/8AHK97oqHTi9bDuzwT/hTn7T3/AEdrF/4b3Tv/AI5R/wAKc/ae/wCjtYv/AA3unf8Axyve6KXs49guzwT/AIU5+09/0drF/wCG907/AOOUf8Kc/ae/6O1i/wDDe6d/8cr3uij2cewXZ4J/wpz9p7/o7WL/AMN7p3/xyj/hTn7T3/R2sX/hvdO/+OV73RR7OPYLs8E/4U5+09/0drF/4b3Tv/jlH/CnP2nv+jtYv/De6d/8cr3uij2cewXZ4J/wpz9p7/o7WL/w3unf/HKP+FOftPf9Haxf+G907/45XvdFHs49guzwT/hTn7T3/R2sX/hvdO/+OUf8Kc/ae/6O1i/8N7p3/wAcr3uij2cewXZ4J/wpz9p7/o7WL/w3unf/AByj/hTn7T3/AEdrF/4b3Tv/AI5XvdFHs49guzwT/hTn7T3/AEdrF/4b3Tv/AI5R/wAKc/ae/wCjtYv/AA3unf8Axyve6KPZx7Bdngn/AApz9p7/AKO1i/8ADe6d/wDHKP8AhTn7T3/R2sX/AIb3Tv8A45XvdFHs49guzwT/AIU5+09/0drF/wCG907/AOOUH4OftPY4/a1i/wDDe6d/8cr3uij2cewXZ4IfgJ8btZX7L4x/a28XvZNxJF4c0HS9GkkHp54jlkT6oVPoRXdfCz4FfDP4PxXsvgvw8Y9T1UhtU1i+uZb3U9RYd7i7mZpZPUKW2jsBXoNFWoqOyC7YmAKWiimIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9k=",
};


// ─── THEME / PALETTE ───────────────────────────────────────────────────────
const THEMES = {
  school: {
    name: "Westbrook Academy",
    bg: "#0a0a1a",
    surface: "#111128",
    accent: "#4fd1c5",
    accent2: "#f6ad55",
    text: "#e2e8f0",
    muted: "#718096",
    boardBg: "#1a1a3e",
    roomBg: "#1e1e40",
    roomBorder: "#4fd1c5",
    icon: "🏫",
    tagline: "Class is permanently dismissed.",
    atmosphere: {
      particles: ["📝","✏️","📐","🔬","📖","🧪"],
      bgGradient: "radial-gradient(ellipse at 20% 10%, #0d1a2e 0%, transparent 50%), radial-gradient(ellipse at 80% 90%, #0a1a10 0%, transparent 50%)",
      overlayColor: "#4fd1c511",
      scanlineColor: "#4fd1c508",
      vignetteColor: "#000000cc",
    },
    intro: `It was the night of the Westbrook Academy Winter Showcase — the one evening each year when teachers, students, and donors gathered beneath the gymnasium's flickering fluorescents and pretended everything was fine.\n\nIt wasn't fine. Headmaster VANCE VERMILLION had been blackmailing half the staff for years, trading silence for favours, forging records, pocketing funds meant for the scholarship programme. Tonight, someone decided the ledger needed balancing.\n\nBy the time the string quartet stopped playing, Vance was dead — and strange things had begun happening in the empty corridors. Lockers swinging open. Chalk writing itself on blackboards. The ghost of a student who died here twenty years ago, they whisper, has come back to make sure the truth is finally told.`,
    rooms: [
      { id:"sc",  name:"Science Lab",       short:"Sci Lab",  icon:"🧪", desc:"Acrid chemical smell lingers. A Bunsen burner was left on." },
      { id:"li",  name:"Library",           short:"Library",  icon:"📚", desc:"Books pulled from shelves. A reading light still burns." },
      { id:"ar",  name:"Art Room",          short:"Art Room", icon:"🎨", desc:"Paint smeared on the floor in a path toward the door." },
      { id:"gy",  name:"Gymnasium",         short:"Gym",      icon:"🏀", desc:"The showcase stage is half-collapsed. A microphone buzzes." },
      { id:"ca",  name:"Cafeteria",         short:"Cafeteria",icon:"🍽️", desc:"Trays knocked over. Something was cooked here after hours." },
      { id:"it",  name:"IT Suite",          short:"IT Suite", icon:"💻", desc:"Screens still on — someone was deleting files." },
      { id:"mu",  name:"Music Room",        short:"Music",    icon:"🎵", desc:"A piano plays a single note, over and over, by itself." },
      { id:"of",  name:"Principal's Office",short:"Office",   icon:"🗄️", desc:"Filing cabinets forced open. Documents scattered." },
      { id:"ch",  name:"Changing Rooms",    short:"Changing", icon:"🚿", desc:"The showers run cold. A shoe left behind, still wet." },
    ],
    weapons: [
      { id:"b", name:"Bunsen Burner",    icon:"🔥", img:"candlestick" },
      { id:"r", name:"Ruler (steel)",    icon:"📏", img:"lead_pipe"   },
      { id:"c", name:"Chemistry Flask",  icon:"⚗️", img:"rope"        },
      { id:"s", name:"Staple Gun",       icon:"🔫", img:"revolver"    },
      { id:"p", name:"PE Trophy",        icon:"🏆", img:"wrench"      },
      { id:"e", name:"Extension Cord",   icon:"🔌", img:"knife"       },
    ],
    hauntings: [
      "A locker at the end of the hall swings open slowly. Inside: a photo of a student who died here in 1998.",
      "The intercom crackles. A child's voice says: 'Room 4. Look under the desk.'",
      "Every clock in the building stops at 11:47 — the exact time of the original incident.",
      "Chalk scrapes across the blackboard in the empty maths room. It writes: HE KNEW.",
      "The library's card catalogue drawer slides open by itself. Inside: a name, circled in red.",
      "Footprints appear in the art room dust — small, bare feet — leading to the window.",
    ],

    motives: {
      scarlet: {
        relationship: "Drama teacher & Vance's former confidante",
        motive: "Vance had been systematically redirecting funds from the school's arts programme — Vivienne's entire department — into his own accounts. When she discovered the ledger, he threatened to expose an affair she'd had with a student's father three years ago. She'd been trapped for months.",
        alibi: "Claims she was performing in the showcase finale. Three students confirm it. But the finale ran seven minutes short.",
        suspicion: "HIGH — was seen near the principal's office at 9:40pm.",
      },
      plum: {
        relationship: "Head of Sciences, Vance's academic rival",
        motive: "Professor Plum had applied for the headmaster position twice. Both times, Vance had buried his application and forged the selection panel's notes. Plum recently discovered evidence of this — and that Vance had been plagiarising Plum's research grant proposals.",
        alibi: "Says he was setting up the science exhibit. His lab partner didn't see him for forty minutes.",
        suspicion: "MEDIUM — motive is strong but he's almost too obvious.",
      },
      mustard: {
        relationship: "Board of Governors member & school benefactor",
        motive: "Vance had been funnelling scholarship money into a private account that Mustard co-signed. If the audit went through, Mustard would be implicated too. He needed Vance silent — or the paper trail destroyed.",
        alibi: "Was at the donor reception all evening. Multiple witnesses. But he slipped out between 9:30 and 10:15.",
        suspicion: "HIGH — financial exposure gives him the clearest motive.",
      },
      green: {
        relationship: "School chaplain & student welfare officer",
        motive: "Reverend Green knew about the student who died on school grounds in 1998 — the one the school covered up. Vance had been blackmailing Green into silence, threatening to expose Green's role in the original cover-up. Green had finally reached his limit.",
        alibi: "Led the opening prayer at 7pm. Unaccounted for between 9pm and 10pm.",
        suspicion: "MEDIUM — deeply involved in the original secret Vance exploited.",
      },
      white: {
        relationship: "School nurse & Vance's personal physician",
        motive: "Dr. White had been quietly overprescribing medication to Vance for years — a dependency Vance had cultivated deliberately to maintain leverage. White recently learned Vance had been recording their private consultations as insurance.",
        alibi: "Was managing first aid at the showcase. Left post unmanned for twenty-two minutes.",
        suspicion: "MEDIUM — the most methodical suspect. Knows exactly how to cause death without leaving marks.",
      },
      peacock: {
        relationship: "Deputy Headmistress & Vance's subordinate",
        motive: "Eleanor Peacock had run the school effectively for eleven years while Vance took credit. He'd recently blocked her promotion application and threatened to have her contract reviewed. She had found his private files — and what she found went far beyond financial fraud.",
        alibi: "Hosting the parents' reception. Left at 9:50pm to 'check on arrangements.'",
        suspicion: "HIGH — knew the building better than anyone. Had a key to every room.",
      },
    },

    narratives: {
      scarlet: (room, weapon) => `Vivienne Scarlet led Vance Vermillion to the ${room} under the pretence of a private conversation about the arts programme budget. She had rehearsed this moment — as she had rehearsed everything — for three months. When he turned his back, she picked up the ${weapon}. He didn't make a sound. She walked back to the stage and delivered her curtain speech without a tremor in her voice. The police would later find the motive hiding in plain sight: a ledger, a diary, and a letter she'd drafted but never sent to the school board. She'd decided to solve the problem herself.`,
      plum: (room, weapon) => `Professor Plum had mapped the evening down to the minute. He knew which room would be empty, which route Vance would take, and how long he had before the showcase crowds dispersed. The ${weapon} was already in the ${room} — he'd placed it there two days earlier. He'd spent his career studying cause and effect. Tonight he applied it. When it was over he returned to his exhibit, straightened a display board, and waited for someone else to find the body. No one suspected the man calmly explaining the nitrogen cycle.`,
      mustard: (room, weapon) => `Colonel Mustard didn't plan it. That was the truth — the one detail the investigators would struggle to believe. He'd cornered Vance in the ${room} to demand the documents, and Vance had laughed. Actually laughed. Forty years of discipline dissolved in that moment. The ${weapon} was at hand. Three seconds of rage and forty years of trained instinct. He straightened his tie, checked the corridor, and rejoined the donor reception with a fresh glass of wine and a steady pulse. The military had taught him how to survive what he'd done.`,
      green: (room, weapon) => `Reverend Green had prayed over this decision for six weeks. He'd asked God for another way. None came. Vance had the recordings. Vance had the files. And Vance would use them — not to expose the truth, but to keep Green compliant forever. The ${room} was quiet. Green had told Vance he had something to confess. Old habits: Vance had come alone. The ${weapon} was quick. Green sat with the body for eleven minutes, praying — for the dead man's soul and for his own. Then he walked back and led the closing hymn. The congregation said it was one of his finest performances.`,
      white: (room, weapon) => `Dr. White had known for years that this was where it would end. She'd been complicit too long, signed too much, looked away too often. When she found Vance in the ${room} going through her private files — her actual medical files — the calculation was immediate and clinical. The ${weapon} was in reach. She knew exactly where to strike and what it would look like afterward. She cleaned what needed cleaning, repositioned what needed repositioning, and returned to her first-aid station. When she was asked about the time gap in her log, she said she'd stepped out for air. No one thought to press a doctor on the details of a death.`,
      peacock: (room, weapon) => `Eleanor Peacock had run this school for eleven years. She knew every room, every lock, every shortcut. She'd known about Vance's private files for months — and she'd spent those months quietly copying them. Insurance. But when she discovered the sale documents, signed and sealed, she realised insurance wasn't enough. She found him in the ${room} during the showcase's interval. She had the ${weapon} in her bag — she'd brought it deliberately, she told herself it was for protection. They argued for four minutes. Then she used it. On her way out she relocked the door, corrected a misplaced sign in the corridor, and returned to the parents' reception. Professional to the last.`,
    },
  },
  caravan: {
    name: "Silverbell Holiday Park",
    bg: "#0d1117",
    surface: "#161b22",
    accent: "#f0a500",
    accent2: "#e05c5c",
    text: "#d4d4d4",
    muted: "#6e7681",
    boardBg: "#1c2128",
    roomBg: "#1f2937",
    roomBorder: "#f0a500",
    icon: "🚐",
    tagline: "No one checks out early.",
    atmosphere: {
      particles: ["🌿","⛺","🔦","🌑","🍺","🎣"],
      bgGradient: "radial-gradient(ellipse at 50% 0%, #1a1200 0%, transparent 50%), radial-gradient(ellipse at 20% 100%, #001a0a 0%, transparent 50%)",
      overlayColor: "#f0a50008",
      scanlineColor: "#f0a50006",
      vignetteColor: "#000000dd",
    },
    intro: `Silverbell Holiday Park sits at the edge of a lake that locals avoid after dark. Every summer it fills with families, retirees, and people who seem eager to be somewhere without an address.\n\nREGINALD "REG" RAVEN was the park's owner — a loud, sun-weathered man who charged too much, fixed too little, and kept a private ledger of every guest's secrets. He'd spent three decades learning what people tried to leave behind when they came here. Eventually, someone decided they'd left enough.\n\nReg was found in the amenities block at dawn. Now the lake is glassy and still, the power keeps cutting out, and guests swear they can see lights in the water — the ghost of the girl who drowned here, the one Reg never reported, the one the park was built on top of. She is not finished.`,
    rooms: [
      { id:"of", name:"Park Office",        short:"Office",   icon:"🏢", desc:"Reg's paperwork everywhere. One drawer is locked." },
      { id:"am", name:"Amenities Block",    short:"Amenities",icon:"🚿", desc:"Crime scene. The floor drain is blocked with something dark." },
      { id:"bb", name:"BBQ Pavilion",       short:"BBQ Area", icon:"🔥", desc:"Coals still warm. A bottle of accelerant nearby." },
      { id:"lk", name:"Lakeside Dock",      short:"Dock",     icon:"⛵", desc:"A boat tied loosely. Wet boot prints lead away." },
      { id:"ca", name:"Camp Kitchen",       short:"Kitchen",  icon:"🍳", desc:"Something was cooked at 3am. The extractor fan is jammed on." },
      { id:"pl", name:"Games Room",         short:"Games Rm", icon:"🎱", desc:"A pool cue missing from the rack. Chips on the floor." },
      { id:"ln", name:"Laundry",            short:"Laundry",  icon:"👕", desc:"One machine running on a hot cycle, unattended." },
      { id:"cr", name:"Caravan Row C",      short:"Row C",    icon:"🚐", desc:"One caravan door ajar. Curtains drawn on all others." },
      { id:"pw", name:"Pump House",         short:"Pump House",icon:"⚙️", desc:"The water pump is off. It's been manually disabled." },
    ],
    weapons: [
      { id:"h", name:"Hammer",           icon:"🔨", img:"lead_pipe"   },
      { id:"r", name:"Rope",             icon:"🪢", img:"rope"        },
      { id:"p", name:"Pool Cue",         icon:"🎱", img:"candlestick" },
      { id:"g", name:"Gas Canister",     icon:"⛽", img:"revolver"    },
      { id:"k", name:"Fishing Knife",    icon:"🔪", img:"knife"       },
      { id:"w", name:"Wrench",           icon:"🔧", img:"wrench"      },
    ],
    hauntings: [
      "The lake surface ripples in a perfect circle, despite no wind. A child's sandal floats to the surface.",
      "Every radio in the park tunes itself to static. Through it, a girl counts: one, two, three...",
      "The power cuts out. When it returns, the office whiteboard reads: SHE NEVER LEFT.",
      "Guests report a small figure standing at the edge of the dock at 2am. The security camera footage is corrupted.",
      "The camp kitchen tap turns on by itself. The water runs brown, then clear, then brown again.",
      "Someone finds a child's drawing pinned to every caravan door: a lake, a girl, a man watching from the shore.",
    ],

    motives: {
      scarlet: {
        relationship: "Reg's on-again-off-again romantic partner",
        motive: "Vivienne had invested her savings into the park after Reg promised her co-ownership. The paperwork never materialised. She recently discovered he'd done this to three other women — and that he'd sold the land title to a developer six months ago without telling anyone.",
        alibi: "Says she was in her cabin all night. A neighbour heard her door close at 11pm. Then again at 1am.",
        suspicion: "HIGH — financial betrayal with a personal wound underneath.",
      },
      plum: {
        relationship: "Retired academic, long-term seasonal resident",
        motive: "Professor Plum had been coming to Silverbell for twelve years. He knew about the drowned girl — he was there that summer. Reg had been extracting annual 'donations' to keep Plum's name out of the incident report. This year Plum refused to pay.",
        alibi: "Reading in the games room. The book he claimed to be reading was still in the camp library.",
        suspicion: "MEDIUM — the blackmail motive is verified. But he seems genuinely frightened.",
      },
      mustard: {
        relationship: "Former business partner & creditor",
        motive: "Reg owed Mustard sixty thousand dollars from a development deal that collapsed in 2019. Mustard had been patient. Then he discovered Reg had been hiding assets while claiming insolvency — and had just received a large developer payout.",
        alibi: "Fishing at the dock from 10pm. The boat log shows it wasn't signed out.",
        suspicion: "HIGH — monetary motive, and he has form for intimidation.",
      },
      green: {
        relationship: "Park chaplain for seasonal community events",
        motive: "Reverend Green had been conducting informal counselling sessions with park residents. Reg had been recording these sessions and using what he learned to manipulate vulnerable guests. When a resident Green had counselled died by suicide, Green traced it back to Reg.",
        alibi: "Led evening vespers. Confirmed by six attendees. Service ended at 9:15pm.",
        suspicion: "MEDIUM — morally motivated. The only suspect who seems genuinely grief-stricken.",
      },
      white: {
        relationship: "Park medical officer, seasonal volunteer",
        motive: "Dr. White had been falsifying health and safety reports for the park at Reg's request — substandard electrical, untreated water, unsafe structures. The girl who drowned had in fact died from a seizure caused by contaminated water. White signed off on it.",
        alibi: "In the medical cabin all evening. But the visitor log has a gap from 11:30pm to 1am.",
        suspicion: "HIGH — most at risk if the truth emerges. Has the knowledge to make a death look natural.",
      },
      peacock: {
        relationship: "Park manager & Reg's employee of twelve years",
        motive: "Eleanor had effectively run Silverbell for over a decade. This year she discovered Reg had secretly arranged to sell the park to a developer — a sale that would leave every long-term resident homeless and Eleanor without a job, pension, or reference.",
        alibi: "Doing the nightly round of the cabins. No one saw her between 11pm and midnight.",
        suspicion: "MEDIUM — knows every inch of the park, every hiding place, every schedule.",
      },
    },

    narratives: {
      scarlet: (room, weapon) => `Vivienne had done the numbers a hundred times. The land was sold. The money was gone. The man who'd taken it was standing in the ${room} and smiling at her like she was still a mark. She'd driven three hours that morning to withdraw the last of her savings and discovered there was nothing left to withdraw. The ${weapon} was close. She told herself she only wanted to frighten him. She has been telling herself that ever since. She drove home in the dark, packed nothing, and was three towns away by the time the park manager found the body.`,
      plum: (room, weapon) => `For twelve years Professor Plum had paid. Quietly, promptly, without complaint — because the alternative was worse. This year he'd consulted a solicitor. The solicitor told him the statute of limitations had passed. He was free. He drove to Silverbell to tell Reg personally, to see the man's face. Reg didn't believe him. Reg laughed and named a higher figure. Plum found the ${weapon} in the ${room} and thought of the girl in the lake and of twelve years of payments and of a solicitor's letter folded in his breast pocket. Afterward he walked back to the games room, picked up his book, and read until morning.`,
      mustard: (room, weapon) => `The money was one thing. Mustard had written off worse. But the lie — the deliberate, documented, witnessed lie — that was a different matter. He'd given Reg sixty thousand on a handshake, soldier to civilian, and Reg had used it to disappear on paper while pocketing a developer's cheque. Mustard found him at the ${room} after midnight, going over the payout figures with a drink in his hand. The ${weapon} was there. He used it with the same efficiency he'd applied to every difficult problem in a forty-year career. He signed out the boat at 2am and was back before dawn. The log discrepancy was a clerical error. He was sure of it.`,
      green: (room, weapon) => `The resident's name was Margaret. She'd come to Silverbell to recover from a breakdown. Green had counselled her for three weeks. She'd trusted him completely. Reg had been listening through the wall and used what he heard to manipulate her — her finances, her decisions, her sense of self — until she had nothing left. The coroner called it misadventure. Green called it what it was. He confronted Reg in the ${room} with documentation he'd quietly gathered. Reg offered to cut him in. The ${weapon} was within reach and Green's hands moved before his conscience could intervene. He spent the rest of the night in his cabin, on his knees, asking for forgiveness he suspected would not come.`,
      white: (room, weapon) => `Dr. White had falsified seven reports. She'd told herself each time that she was protecting the park's livelihood, the staff, the families. She had believed it, mostly. When the developer's hydrologist sent her the water contamination data — data she'd suppressed four years ago — and she traced it back to a child's seizure in 2019, there was nothing left to believe. She found Reg in the ${room} at 11:30pm, alone. She had the ${weapon} in her medical bag. She told him what she knew. He told her no one would take a rural GP's word over his. He underestimated her, as men like him always had. She walked back to the medical cabin, updated her visitor log, and made herself a cup of tea.`,
      peacock: (room, weapon) => `Eleanor had given this park her best years. She'd fixed what Reg broke, covered what Reg neglected, smiled at guests while rage accumulated like sediment. The sale documents were the last straw — not because she hadn't suspected, but because he hadn't even told her. Not a word. Twelve years and she learned about it from a real estate listing. She found him doing his nightly round of the ${room} and fell into step beside him, the way she had a thousand times before. The ${weapon} was in her jacket. The conversation was brief. She completed the rest of the nightly round herself, locked the office, and went to bed. In the morning she made coffee for the police.`,
    },
  },
  carnival: {
    name: "Mirrorlight Carnival",
    bg: "#0a0508",
    surface: "#150d12",
    accent: "#e040fb",
    accent2: "#ff6b35",
    text: "#f0e6f6",
    muted: "#9e7bb5",
    boardBg: "#1a0d1f",
    roomBg: "#1f0d26",
    roomBorder: "#e040fb",
    icon: "🎪",
    tagline: "Every trick ends in blood.",
    atmosphere: {
      particles: ["🎭","⭐","🎪","🃏","🎠","✨"],
      bgGradient: "radial-gradient(ellipse at 50% 30%, #1f0028 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #1a0010 0%, transparent 50%)",
      overlayColor: "#e040fb0a",
      scanlineColor: "#e040fb06",
      vignetteColor: "#050008ee",
    },
    intro: `The Mirrorlight Carnival comes to town every seven years and stays exactly thirty days. No one knows where it comes from. No one asks.\n\nMAGISTER SCARLET — ringmaster, showman, and keeper of every secret the carnival has ever produced — was found dead between the Hall of Mirrors and the Ghost Train at midnight. The crowd heard a scream and assumed it was part of the show. It wasn't.\n\nMagister Scarlet had run the carnival like a feudal lord — binding performers to impossible contracts, skimming their earnings, and threatening anyone who tried to leave with consequences they never quite specified. Now the rides are running by themselves, the mirrors show reflections of people who aren't there, and a presence is moving through the carnival that the performers all recognise. The last ringmaster. The one Scarlet replaced. The one who was never properly laid to rest.`,
    rooms: [
      { id:"bt", name:"Big Top",             short:"Big Top",   icon:"🎪", desc:"The main ring. Sawdust disturbed in a wide circle." },
      { id:"hm", name:"Hall of Mirrors",     short:"Mirrors",   icon:"🪞", desc:"One mirror has been shattered from the inside." },
      { id:"gt", name:"Ghost Train",         short:"Ghost Train",icon:"👻", desc:"The ride is on — no operator. Something is in car #3." },
      { id:"ff", name:"Ferris Wheel",        short:"Ferris Wheel",icon:"🎡", desc:"Stopped between rotations. A gondola rocks alone." },
      { id:"fs", name:"Freak Show Tent",     short:"Freak Show", icon:"🎭", desc:"The exhibits have been disturbed. One cage is open." },
      { id:"ft", name:"Fortune Teller Booth",short:"Fortune",    icon:"🔮", desc:"Crystal ball cracked. Cards spread in a pattern: death." },
      { id:"bx", name:"Boxing Booth",        short:"Boxing",     icon:"🥊", desc:"The ring ropes are cut. A mouthguard on the canvas." },
      { id:"ck", name:"Candy Kitchen",       short:"Candy",      icon:"🍬", desc:"Toffee apple sticks sharpened to points. Sugar burned." },
      { id:"ca", name:"Carousel",            short:"Carousel",   icon:"🎠", desc:"Running in reverse. One horse has no rider but is warm." },
    ],
    weapons: [
      { id:"k", name:"Knife (throwing)",   icon:"🗡️", img:"knife"       },
      { id:"a", name:"Acrobat Silk",       icon:"🎀", img:"rope"        },
      { id:"m", name:"Mallet (strongman)", icon:"🪝", img:"lead_pipe"   },
      { id:"c", name:"Candied Apple Spike",icon:"🍎", img:"candlestick" },
      { id:"t", name:"Tightrope Wire",     icon:"〰️", img:"wrench"      },
      { id:"p", name:"Powder Cannon",      icon:"💨", img:"revolver"    },
    ],
    hauntings: [
      "The carousel plays backwards. Every horse faces rearward except one — which turns its head to watch you.",
      "The Hall of Mirrors shows a reflection that doesn't match: an older man in a top hat, watching from behind the glass.",
      "The ghost train activates on its own. Witnesses say one of the 'prop' figures inside is breathing.",
      "Every performer wakes to find their costumes rearranged — into the pattern worn by the original ringmaster.",
      "A child's voice floats over the PA: 'He took my ticket. He said I could stay forever.' Then silence.",
      "The fortune teller's booth seals itself shut. When opened, every tarot card inside reads the same: The Hanged Man.",
    ],

    motives: {
      scarlet: {
        relationship: "The Magnificent Scarlet — lead illusionist",
        motive: "Vivienne had been Magister Scarlet's star act for eight years. Last season he began taking eighty percent of her earnings under a contract she'd signed at nineteen — one she'd recently learned was legally unenforceable. She'd hired a solicitor. He'd found out.",
        alibi: "Finishing her final illusion act at 11:45pm. The act ends with her locked in a box. The box was opened at midnight — but who locked her in?",
        suspicion: "HIGH — was the last person seen speaking to Scarlet before midnight.",
      },
      plum: {
        relationship: "The Great Plumbino — mentalist and escape artist",
        motive: "Plum had discovered that Magister Scarlet was not the carnival's original founder — he'd stolen it. The real founder, an elderly woman now in a care home, had signed documents under duress in 1987. Plum had been gathering evidence. Scarlet had discovered this.",
        alibi: "Performing his mentalism set. Audience of forty. Show ran until 11:30pm — then no alibi.",
        suspicion: "MEDIUM — the most intellectually capable of planning something untraceable.",
      },
      mustard: {
        relationship: "Colonel's Carnival of Curiosities — strongman act",
        motive: "Mustard had lent Magister Scarlet money to keep the carnival running during a bad season — fifty thousand pounds, undocumented. Scarlet had since denied the loan existed. Mustard had also discovered Scarlet was planning to dissolve the carnival and disappear with the remaining assets.",
        alibi: "Closing down the strongman booth at 11pm. Claims to have been there until midnight. His assistant left at 11:20.",
        suspicion: "HIGH — physically capable, financially motivated, and visibly furious at dinner.",
      },
      green: {
        relationship: "The Reverend of the Ringside — carnival spiritualist",
        motive: "Green had been providing pastoral care to carnival performers for years. Multiple performers had confided in him about abuse — financial exploitation, withheld wages, threats. He'd been building a case to present to authorities. Scarlet had intercepted a letter.",
        alibi: "Conducting a séance for paying guests from 10pm to midnight. Seven witnesses — but séances are dark.",
        suspicion: "MEDIUM — the séance setting is suspiciously convenient.",
      },
      white: {
        relationship: "Dr. White's Elixirs — carnival doctor and pharmacist",
        motive: "Dr. White had been supplying Magister Scarlet with sedatives for years — officially for a chronic pain condition. White had recently discovered the sedatives were being used to keep a performer compliant against their will. White had threatened to go to police.",
        alibi: "In the medical tent all evening. One visitor at 10pm. No visitors after 11pm.",
        suspicion: "HIGH — the sedatives in Scarlet's system at time of death match White's supply exactly.",
      },
      peacock: {
        relationship: "Madam Peacock — fortune teller and carnival administrator",
        motive: "Eleanor had managed the carnival's books for six years. She knew every secret — including that Magister Scarlet had been slowly transferring the carnival's assets offshore in preparation for vanishing after this season. She would have been left with nothing.",
        alibi: "In her fortune teller booth until midnight. Clients until 11:15pm. Booth was locked from 11:30pm.",
        suspicion: "HIGH — the locked booth proves nothing. There's a rear exit.",
      },
    },

    narratives: {
      scarlet: (room, weapon) => `Vivienne had performed the disappearing act so many times she'd forgotten what it felt like to actually vanish. That night she made Magister Scarlet disappear instead. She led him to the ${room} after her final act, still in costume, still in character — the performance of her career. He didn't suspect her. He never suspected her. The ${weapon} was part of the staging; she'd placed it there three days earlier during a rehearsal. When it was over she locked herself back in the box and waited to be found. The audience thought her silence was part of the show. It was.`,
      plum: (room, weapon) => `The Great Plumbino had spent six months building an airtight case. Documents, witnesses, the elderly woman in the care home who'd signed under duress, the original company filing that predated Scarlet's claim of ownership. He'd been ready to go to the authorities — until Scarlet intercepted the letter and invited him to a private meeting in the ${room} to discuss terms. Plum attended with the ${weapon} and no intention of negotiating. He left with everything intact: the case, the evidence, and a clean conscience. Someone else's guilt is easier to carry when you've done the arithmetic on it long enough.`,
      mustard: (room, weapon) => `Mustard had not come to the carnival to kill anyone. He'd come to collect what was owed and leave. But Scarlet had lied to his face over dinner — denied the loan, denied the agreement, denied everything — and Mustard had watched him perform that denial with the ease of a man who'd done it his whole life. He found him at the ${room} just before midnight. The ${weapon} was part of the booth's equipment. The fight was short. Mustard had thirty years on Scarlet in every relevant discipline. He walked back to his van, changed his shirt, and was on the motorway by 1am. He told himself it was business.`,
      green: (room, weapon) => `The séance was real — or as real as Green made them. He'd been communing with the carnival's dead for years, in his way. He knew their names. He knew what had been done to them. When the performer came to him — frightened, medicated without consent, unable to leave — he'd written the letter to authorities immediately. Scarlet had found it. Their meeting in the ${room} was Green's idea. The ${weapon} was not. It was simply there, and then it was in his hand, and then the thing was done. He returned to his booth, extinguished his candles, and sat in the dark until dawn, listening to the carnival breathe around him.`,
      white: (room, weapon) => `The sedatives in Scarlet's system were hers — the formulation, the dosage, the precise combination that would look like a cardiac event to anyone but a forensic toxicologist. Dr. White had prepared it carefully, professionally, without drama. She'd delivered it in the ${room} via a mechanism so ordinary that no one would think to question it. The ${weapon} was a secondary measure she hadn't needed. She walked back to the medical tent, disposed of what needed disposing, and sat down with her notes. When the body was found she was the first person called. She pronounced the time of death with clinical accuracy. She had known it to the minute.`,
      peacock: (room, weapon) => `Eleanor had read the offshore transfer documents three times to make sure she understood them correctly. She had. Six accounts, four shell companies, every asset the carnival had generated in six years quietly redirected to a man who planned to vanish after closing night. She'd built this carnival's reputation. She'd cultivated its mystique. Her name was on nothing and his was on everything — that had been the arrangement, and she'd accepted it, and this was where it had led. She found him in the ${room} at 11:45pm. The ${weapon} was in the booth. The argument lasted four minutes. She locked the booth from the outside, walked back to her caravan, and spent the rest of the night reading the tarot. Every card she drew was the same.`,
    },
  }
};

const CHARACTERS = [
  {
    id: "scarlet",
    name: "V. Scarlet",
    fullName: "Vivienne Scarlet",
    color: "#c0392b",
    textColor: "#fff",
    icon: "💃",
    bio: "Former actress turned socialite. Knows everyone's price — and isn't above collecting.",
    img: () => CHARACTER_IMAGES.scarlet,
    ability: {
      name: "Leading Role",
      icon: "🎭",
      desc: "Make a second Suggestion this turn — in any room on the board, not just your current one.",
      flavour: "She reads a room before she enters it. Always has.",
      effect: "extra_suggestion",
    },
  },
  {
    id: "plum",
    name: "P. Plum",
    fullName: "Professor Plum",
    color: "#6c3483",
    textColor: "#fff",
    icon: "🎓",
    bio: "Academic with secrets buried in peer-reviewed obscurity. Three universities in five years.",
    img: () => CHARACTER_IMAGES.plum,
    ability: {
      name: "Academic Insight",
      icon: "🔬",
      desc: "Peek at one random card from another player's hand — without them knowing which card you saw.",
      flavour: "He has read every paper on everything. Including people.",
      effect: "peek_hand",
    },
  },
  {
    id: "mustard",
    name: "C. Mustard",
    fullName: "Col. Mustard",
    color: "#d4ac0d",
    textColor: "#000",
    icon: "⭐",
    bio: "Military man. Decorated for things he won't discuss. Owes favours to dangerous people.",
    img: () => CHARACTER_IMAGES.mustard,
    ability: {
      name: "Forced March",
      icon: "🪖",
      desc: "Roll the dice twice this turn and choose which result to use for movement.",
      flavour: "In the field, you plan two routes. Always.",
      effect: "double_roll",
    },
  },
  {
    id: "green",
    name: "R. Green",
    fullName: "Rev. Green",
    color: "#27ae60",
    textColor: "#fff",
    icon: "✝️",
    bio: "Man of the cloth with un-holy ambitions. The collar is the best disguise he ever found.",
    img: () => CHARACTER_IMAGES.green,
    ability: {
      name: "Confession",
      icon: "🕊️",
      desc: "Ask one other player if they hold a specific card. They must answer truthfully.",
      flavour: "People confess things to men of God. He's learned to use that.",
      effect: "confession",
    },
  },
  {
    id: "white",
    name: "D. White",
    fullName: "Dr. White",
    color: "#c8d6e5",
    textColor: "#222",
    icon: "🩺",
    bio: "Soft-spoken. Methodical. Has a talent for making problems — and people — disappear.",
    img: () => CHARACTER_IMAGES.white,
    ability: {
      name: "Clinical Eye",
      icon: "💉",
      desc: "Unblock any sealed room immediately — and move into it for free this turn.",
      flavour: "She goes where others won't. That's always been her advantage.",
      effect: "unblock_room",
    },
  },
  {
    id: "peacock",
    name: "E. Peacock",
    fullName: "E. Peacock",
    color: "#2471a3",
    textColor: "#fff",
    icon: "🦚",
    bio: "Old money, new grudges. Every relationship is a transaction waiting to be called in.",
    img: () => CHARACTER_IMAGES.peacock,
    ability: {
      name: "Social Capital",
      icon: "🤝",
      desc: "Force all other players to reveal whether they hold a card matching your current room — yes or no only.",
      flavour: "She's spent forty years learning what people owe her. Tonight she collects.",
      effect: "room_poll",
    },
  }
];

// ─── BOARD GEOMETRY ────────────────────────────────────────────────────────
// 9 rooms arranged around a centre room, connected by corridors.
// Secret passages: corners 0↔5, 1↔4 (diagonal opposites)
// Layout (room indices):
//   [0]──────[6]──────[1]
//    │        │        │
//   [7]──────[8]──────[2]  (centre = 8)
//    │        │        │
//   [3]──────[?]──────[4]  (no bottom-centre room — open corridor)
//    └────────────────[5]  (bottom-right)
//
// Actual positions (SVG viewport 300×300):
const ROOM_POSITIONS = [
  {x:10,  y:10,  w:80, h:70},  // 0 top-left
  {x:210, y:10,  w:80, h:70},  // 1 top-right
  {x:10,  y:120, w:80, h:70},  // 2 mid-left
  {x:210, y:120, w:80, h:70},  // 3 mid-right
  {x:10,  y:230, w:80, h:70},  // 4 bot-left
  {x:210, y:230, w:80, h:70},  // 5 bot-right
  {x:110, y:10,  w:80, h:70},  // 6 top-centre
  {x:110, y:120, w:80, h:70},  // 7 mid-centre
  {x:110, y:230, w:80, h:70},  // 8 bot-centre
];

// Corridors: pairs of room indices that are directly connected
const CORRIDORS = [
  [0,6],[6,1],         // top row
  [0,2],[2,4],         // left col
  [1,3],[3,5],         // right col
  [6,7],[7,8],         // centre col
  [2,7],[3,7],         // mid row to centre
  [4,8],[5,8],         // bot row to centre
];

// Secret passages (diagonal teleports — free move regardless of dice)
const SECRET_PASSAGES = [
  [0,5], // top-left ↔ bot-right
  [1,4], // top-right ↔ bot-left
];

// ─── HAUNTING EVENT SYSTEM ─────────────────────────────────────────────────
// Each haunting has a type that drives a gameplay effect:
//   clue       — reveals one card from the solution (room OR weapon OR suspect)
//   block      — seals a random room for 2 turns (players inside stay, no entry)
//   force_move — current player must move to a specific haunted room immediately
//   lose_turn  — current player is paralysed, loses their move this turn
//   reveal_hand— briefly shows one card from another player's hand to everyone
//   dice_curse — next dice roll is halved (rounded down, min 1)
const HAUNTING_EVENTS = [
  {
    type: "clue",
    weight: 3,
    title: "The Spirit Speaks",
    generate: (game, theme) => {
      const sol = game.solution;
      // Randomly pick room, weapon, or suspect to hint at
      const pick = ["room","weapon","suspect"][Math.floor(Math.random()*3)];
      if(pick==="room")    return { effect:"clue", category:"room",    value:sol.room.id,    text:`A cold wind blows through the ${sol.room.name}. Something terrible happened there.` };
      if(pick==="weapon")  return { effect:"clue", category:"weapon",  value:sol.weapon.id,  text:`The ghost's gaze fixes on the ${sol.weapon.name}. It trembles.` };
      return                      { effect:"clue", category:"suspect", value:sol.suspect.id, text:`A name is scratched into the wall: "${CHARACTERS.find(c=>c.id===sol.suspect.id)?.fullName}". Then it fades.` };
    },
  },
  {
    type: "block",
    weight: 2,
    title: "Room Sealed",
    generate: (game, theme) => {
      const rooms = THEMES[theme].rooms;
      // Pick a random room that isn't the current player's room
      const cp = game.players[game.currentPlayer];
      const candidates = rooms.map((_,i)=>i).filter(i=>i!==cp.roomIndex);
      const roomIdx = candidates[Math.floor(Math.random()*candidates.length)];
      const roomName = rooms[roomIdx].name;
      return {
        effect:"block", roomIndex:roomIdx, turnsLeft:2,
        text:`The door to the ${roomName} slams shut and won't budge. Something holds it from the other side.`,
      };
    },
  },
  {
    type: "force_move",
    weight: 2,
    title: "Drawn In",
    generate: (game, theme) => {
      const rooms = THEMES[theme].rooms;
      const cp = game.players[game.currentPlayer];
      const blocked = Object.keys(game.blockedRooms||{}).map(Number);
      const candidates = rooms.map((_,i)=>i).filter(i=>i!==cp.roomIndex && !blocked.includes(i));
      if(!candidates.length) return { effect:"none", text:"The presence strains to move you — but every path is sealed." };
      const roomIdx = candidates[Math.floor(Math.random()*candidates.length)];
      const roomName = rooms[roomIdx].name;
      return {
        effect:"force_move", roomIndex:roomIdx,
        text:`An unseen force compels ${cp.name} toward the ${roomName}. They cannot resist.`,
      };
    },
  },
  {
    type: "lose_turn",
    weight: 2,
    title: "Paralysed",
    generate: (game, theme) => {
      const cp = game.players[game.currentPlayer];
      return {
        effect:"lose_turn",
        text:`${cp.name} freezes — a figure stands in the doorway, not quite solid. They cannot move this turn.`,
      };
    },
  },
  {
    type: "reveal_hand",
    weight: 2,
    title: "The Ghost Exposes",
    generate: (game, theme) => {
      const cp = game.players[game.currentPlayer];
      // Pick another player with cards
      const others = game.players.filter(p=>p.id!==cp.id && !p.eliminated && p.hand.length>0);
      if(!others.length) return { effect:"none", text:"The presence flickers and vanishes without incident." };
      const target = others[Math.floor(Math.random()*others.length)];
      const card = target.hand[Math.floor(Math.random()*target.hand.length)];
      return {
        effect:"reveal_hand", targetId:target.id, cardId:card.id||card.name, cardName:card.name,
        text:`The ghost tears open ${target.name}'s coat. A card falls: ${card.name}.`,
      };
    },
  },
  {
    type: "dice_curse",
    weight: 1,
    title: "Cursed Roll",
    generate: (game, theme) => {
      const cp = game.players[game.currentPlayer];
      return {
        effect:"dice_curse",
        text:`A chill runs through ${cp.name}. Their next roll will be halved — the dead slow their steps.`,
      };
    },
  },
];

// Weighted random pick from haunting events
function pickHauntingEvent(game, theme) {
  const total = HAUNTING_EVENTS.reduce((s,e)=>s+e.weight, 0);
  let r = Math.random() * total;
  for(const ev of HAUNTING_EVENTS) {
    r -= ev.weight;
    if(r <= 0) return { ...ev.generate(game, theme), title:ev.title, type:ev.type };
  }
  return HAUNTING_EVENTS[0].generate(game, theme);
}

// Which rooms a player can reach from roomIndex given movesLeft dice roll
// Simple rule: any room reachable within movesLeft steps along corridors
function getReachableRooms(fromRoom, movesLeft) {
  // BFS over room graph
  const adj = {};
  CORRIDORS.forEach(([a,b])=>{
    if(!adj[a]) adj[a]=[];
    if(!adj[b]) adj[b]=[];
    adj[a].push(b);
    adj[b].push(a);
  });
  const visited = new Set([fromRoom]);
  let frontier = [fromRoom];
  for(let step=0; step<movesLeft; step++){
    const next=[];
    frontier.forEach(r=>{
      (adj[r]||[]).forEach(nb=>{
        if(!visited.has(nb)){ visited.add(nb); next.push(nb); }
      });
    });
    frontier=next;
    if(!frontier.length) break;
  }
  visited.delete(fromRoom);
  // Always add secret passage destinations
  SECRET_PASSAGES.forEach(([a,b])=>{
    if(a===fromRoom) visited.add(b);
    if(b===fromRoom) visited.add(a);
  });
  return visited;
}

// ─── GAME LOGIC ────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function initGame(theme, players) {
  const t = THEMES[theme];
  const rooms = [...t.rooms];
  const weapons = [...t.weapons];
  
  // Solution
  const solRoom = rooms[Math.floor(Math.random()*rooms.length)];
  const solWeapon = weapons[Math.floor(Math.random()*weapons.length)];
  // Use player's chosen character if provided, else assign in order
  const suspects = players.map((p,i) =>
    CHARACTERS.find(c=>c.id===p.characterId) || CHARACTERS[i]
  );
  const solSuspect = suspects[Math.floor(Math.random()*suspects.length)];

  // Distribute remaining cards
  const remaining = [
    ...rooms.filter(r=>r.id!==solRoom.id).map(r=>({type:"room",...r})),
    ...weapons.filter(w=>w.id!==solWeapon.id).map(w=>({type:"weapon",...w})),
    ...suspects.filter(s=>s.id!==solSuspect.id).map(s=>({type:"suspect",...s})),
  ];
  const shuffled = shuffle(remaining);
  const hands = players.map(()=>[]);
  shuffled.forEach((card,i)=>hands[i%players.length].push(card));

  // Starting positions — spread evenly around the 9 rooms
  const startRooms = [0, 1, 4, 5, 6, 2];

  const gamePlayers = players.map((p,i)=>({
    ...p,
    character: suspects[i],
    hand: hands[i],
    roomIndex: startRooms[i % startRooms.length],
    pos: i,
    notes: {},
    eliminated: false,
    abilityUsed: false,
  }));
  
  return {
    theme,
    solution: {room: solRoom, weapon: solWeapon, suspect: solSuspect},
    players: gamePlayers,
    currentPlayer: 0,
    phase: "roll", // roll | move | accuse | suggest | haunt | end
    diceResult: null,
    movesLeft: 0,
    log: [`🎲 ${THEMES[theme].name} — the investigation begins.`, `🔍 A body has been found. Who did it, where, and how?`],
    hauntingQueue: shuffle([...t.hauntings]),
    hauntingIndex: 0,
    turnCount: 0,
    winner: null,
    accusation: null,
    blockedRooms: {},   // roomIndex -> turnsRemaining
    diceCursed: false,  // next roll is halved
    activeHaunting: null, // current haunting event object awaiting resolution
  };
}

// ─── COMPONENTS ────────────────────────────────────────────────────────────

const CharacterToken = ({character, size=40}) => {
  const hasImg = CHARACTER_IMAGES[character.id];
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:character.color,
      border:`3px solid ${character.color}`,
      boxShadow:`0 0 12px ${character.color}88`,
      userSelect:"none", flexShrink:0,
      overflow:"hidden", position:"relative",
    }}>
      {hasImg ? (
        <img src={hasImg} alt={character.fullName}
          style={{width:"100%",height:"150%",objectFit:"cover",objectPosition:"center 5%",display:"block"}}
        />
      ) : (
        <div style={{
          width:"100%",height:"100%",display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:size*0.45,color:character.textColor,
        }}>{character.icon}</div>
      )}
    </div>
  );
};

const CharacterCard = ({character, theme, motives, expanded, onToggle}) => {
  const t = THEMES[theme] || THEMES.school;
  const hasImg = CHARACTER_IMAGES[character.id];
  const motive = motives && motives[character.id];
  const suspColor = motive?.suspicion?.startsWith("HIGH") ? "#e05c5c"
    : motive?.suspicion?.startsWith("MEDIUM") ? "#f6ad55" : "#4fd14a";

  return (
    <div style={{
      background:t.surface,
      border:`2px solid ${expanded ? character.color : character.color+"55"}`,
      borderRadius:12, overflow:"hidden",
      transition:"all 0.2s",
      gridColumn: expanded ? "1 / -1" : "auto",
    }}>
      {/* Portrait header — always visible */}
      <div
        onClick={onToggle}
        style={{
          height: expanded ? 140 : 110, overflow:"hidden", position:"relative",
          background:`linear-gradient(135deg,${character.color}44,#000)`,
          cursor:"pointer", transition:"height 0.3s",
        }}
      >
        {hasImg && (
          <img src={hasImg} alt={character.fullName}
            style={{width:"100%",height:"165%",objectFit:"cover",
              objectPosition:"center 5%",display:"block",
              filter: expanded ? "none" : "brightness(0.85)"}}
          />
        )}
        <div style={{
          position:"absolute",bottom:0,left:0,right:0,
          background:`linear-gradient(transparent,${character.color}ee)`,
          padding:"22px 10px 8px",
        }}>
          <div style={{
            fontFamily:"'Cinzel',serif",fontSize:10,fontWeight:700,
            color:"#fff",letterSpacing:"1px",textAlign:"center",
            textShadow:"0 1px 4px #000",
          }}>{character.fullName}</div>
          {motive && (
            <div style={{textAlign:"center",marginTop:3}}>
              <span style={{
                background:`${suspColor}33`, border:`1px solid ${suspColor}88`,
                borderRadius:4, padding:"1px 6px",
                fontFamily:"'Cinzel',serif", fontSize:7, color:suspColor,
                letterSpacing:"1px",
              }}>{motive.suspicion}</span>
            </div>
          )}
        </div>
        {/* Expand hint */}
        <div style={{
          position:"absolute",top:6,right:8,
          fontFamily:"'Cinzel',serif",fontSize:9,color:"rgba(255,255,255,0.6)",
        }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Brief bio — always visible */}
      <div style={{padding:"6px 10px", borderBottom: expanded ? `1px solid ${character.color}22` : "none"}}>
        <div style={{
          fontFamily:"'Crimson Text',serif",fontStyle:"italic",
          fontSize:10,color:"#888",lineHeight:1.4,
        }}>{character.bio}</div>
      </div>

      {/* Expanded dossier */}
      {expanded && motive && (
        <div style={{padding:"10px 12px 14px", animation:"fadein 0.25s ease-out"}}>
          {[
            {label:"RELATIONSHIP", text:motive.relationship, color:t.accent},
            {label:"MOTIVE",       text:motive.motive,       color:"#e05c5c"},
            {label:"ALIBI",        text:motive.alibi,        color:"#f6ad55"},
          ].map(({label, text, color})=>(
            <div key={label} style={{marginBottom:10}}>
              <div style={{
                fontFamily:"'Cinzel',serif",fontSize:8,color:color,
                letterSpacing:"2px",marginBottom:4,
              }}>{label}</div>
              <div style={{
                fontFamily:"'Crimson Text',serif",fontSize:12,
                color:"#ccc",lineHeight:1.65,
              }}>{text}</div>
            </div>
          ))}
          <div style={{
            background:`${suspColor}11`, border:`1px solid ${suspColor}44`,
            borderRadius:6, padding:"6px 10px", marginTop:4,
          }}>
            <span style={{
              fontFamily:"'Cinzel',serif",fontSize:8,color:suspColor,
              letterSpacing:"2px",marginRight:6,
            }}>SUSPICION</span>
            <span style={{
              fontFamily:"'Crimson Text',serif",fontSize:12,color:suspColor,
            }}>{motive.suspicion}</span>
          </div>
        </div>
      )}
    </div>
  );
};

function GameBoard({game, onMoveToRoom}) {
  const t = THEMES[game.theme];
  const rooms = t.rooms;
  const currentPlayer = game.players[game.currentPlayer];
  const canMove = game.phase === "move" && game.movesLeft > 0;

  // Compute reachable rooms for highlight (exclude blocked rooms)
  const blockedRooms = game.blockedRooms || {};
  const reachable = canMove
    ? (() => {
        const r = getReachableRooms(currentPlayer.roomIndex, game.movesLeft);
        // Remove blocked rooms
        Object.keys(blockedRooms).forEach(ri => r.delete(parseInt(ri)));
        return r;
      })()
    : new Set();

  // Secret passage partner for current player
  const secretPartner = SECRET_PASSAGES.reduce((acc,[a,b])=>{
    if(a===currentPlayer.roomIndex) return b;
    if(b===currentPlayer.roomIndex) return a;
    return acc;
  }, null);

  const W=300, H=310;

  return (
    <div style={{width:"100%",maxWidth:340,margin:"0 auto",userSelect:"none"}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:"block",overflow:"visible"}}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softglow">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Board background */}
        <rect x={0} y={0} width={W} height={H} rx={12}
          fill={t.boardBg} stroke={t.accent+"33"} strokeWidth={1}/>

        {/* Corridor lines */}
        {CORRIDORS.map(([a,b],ci)=>{
          const ra=ROOM_POSITIONS[a], rb=ROOM_POSITIONS[b];
          const ax=ra.x+ra.w/2, ay=ra.y+ra.h/2;
          const bx=rb.x+rb.w/2, by=rb.y+rb.h/2;
          return (
            <line key={ci} x1={ax} y1={ay} x2={bx} y2={by}
              stroke={t.accent+"33"} strokeWidth={2} strokeDasharray="4 4"/>
          );
        })}

        {/* Secret passage indicators */}
        {SECRET_PASSAGES.map(([a,b],si)=>{
          const ra=ROOM_POSITIONS[a], rb=ROOM_POSITIONS[b];
          const ax=ra.x+ra.w/2, ay=ra.y+ra.h/2;
          const bx=rb.x+rb.w/2, by=rb.y+rb.h/2;
          const active = currentPlayer.roomIndex===a || currentPlayer.roomIndex===b;
          return (
            <line key={"sp"+si} x1={ax} y1={ay} x2={bx} y2={by}
              stroke={active?"#da70d6":"#8b008b44"}
              strokeWidth={active?2:1}
              strokeDasharray="3 5"
              opacity={active?0.9:0.4}
            />
          );
        })}

        {/* Rooms */}
        {ROOM_POSITIONS.map((pos,ri)=>{
          const room = rooms[ri];
          if(!room) return null;
          const isCurrent = currentPlayer.roomIndex === ri;
          const isReachable = reachable.has(ri);
          const isSecret = secretPartner === ri;
          const playersHere = game.players.filter(p=>p.roomIndex===ri);

          const isBlocked = !!blockedRooms[ri];
          const borderColor = isBlocked ? "#8b000088"
            : isCurrent ? t.accent
            : isSecret ? "#da70d6"
            : isReachable ? t.accent2
            : t.roomBorder+"55";
          const bgColor = isBlocked ? "#1a000011"
            : isCurrent ? t.accent+"22"
            : isReachable ? t.accent2+"18"
            : isSecret ? "#da70d611"
            : t.roomBg;

          return (
            <g key={ri}
              onClick={()=>(isReachable||isSecret) && onMoveToRoom(ri)}
              style={{cursor:(isReachable||isSecret)?"pointer":"default"}}
            >
              {/* Glow for reachable */}
              {(isReachable||isSecret) && (
                <rect x={pos.x-2} y={pos.y-2} width={pos.w+4} height={pos.h+4} rx={9}
                  fill="none"
                  stroke={isSecret?"#da70d6":t.accent2}
                  strokeWidth={2}
                  opacity={0.6}
                  filter="url(#glow)"
                />
              )}
              {/* Room box */}
              <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx={7}
                fill={bgColor}
                stroke={borderColor}
                strokeWidth={isCurrent?2:1.5}
              />
              {/* Dashed pulse for reachable */}
              {isReachable && (
                <rect x={pos.x+2} y={pos.y+2} width={pos.w-4} height={pos.h-4} rx={5}
                  fill="none" stroke={t.accent2} strokeWidth={1}
                  strokeDasharray="3 3" opacity={0.5}
                />
              )}
              {/* Room icon */}
              <text x={pos.x+pos.w/2} y={pos.y+22} textAnchor="middle"
                fontSize={18} dominantBaseline="middle">
                {room.icon}
              </text>
              {/* Room name */}
              <text x={pos.x+pos.w/2} y={pos.y+38} textAnchor="middle"
                fontSize={7.5} fontFamily="Cinzel,serif" fontWeight="700"
                fill={isCurrent?t.accent:isReachable?t.accent2:"#aaa"}
                letterSpacing="0.3">
                {room.short.length>10?room.short.slice(0,9)+"…":room.short}
              </text>
              {/* Secret passage marker */}
              {isSecret && (
                <text x={pos.x+pos.w-8} y={pos.y+10} textAnchor="middle"
                  fontSize={9} dominantBaseline="middle" opacity={0.9}>👻</text>
              )}
              {/* Blocked room overlay */}
              {isBlocked && (
                <g>
                  <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx={7}
                    fill="#8b000033" stroke="#8b0000" strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <text x={pos.x+pos.w/2} y={pos.y+pos.h/2-4} textAnchor="middle"
                    fontSize={14} dominantBaseline="middle">🔒</text>
                  <text x={pos.x+pos.w/2} y={pos.y+pos.h/2+10} textAnchor="middle"
                    fontSize={7} fontFamily="Cinzel,serif" fill="#e05c5c"
                    dominantBaseline="middle">{blockedRooms[ri]}t</text>
                </g>
              )}
              {/* Player tokens */}
              {playersHere.map((p,ti)=>{
                const tx = pos.x + 8 + ti*14;
                const ty = pos.y + pos.h - 10;
                const hasImg = CHARACTER_IMAGES[p.character.id];
                return (
                  <g key={p.id}>
                    <circle cx={tx} cy={ty} r={7}
                      fill={p.character.color}
                      stroke="#fff" strokeWidth={1}
                      filter={p.id===currentPlayer.id?"url(#softglow)":undefined}
                    />
                    {hasImg ? (
                      <>
                        <defs>
                          <clipPath id={`clip-${p.id}-${ri}`}>
                            <circle cx={tx} cy={ty} r={6}/>
                          </clipPath>
                        </defs>
                        <image
                          href={hasImg}
                          x={tx-6} y={ty-9}
                          width={12} height={18}
                          clipPath={`url(#clip-${p.id}-${ri})`}
                          preserveAspectRatio="xMidYMin slice"
                        />
                      </>
                    ) : (
                      <text x={tx} y={ty} textAnchor="middle"
                        dominantBaseline="middle" fontSize={7}>
                        {p.character.icon}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Legend */}
        {canMove && (
          <g>
            <rect x={4} y={H-18} width={190} height={14} rx={4} fill={t.boardBg} opacity={0.8}/>
            <circle cx={14} cy={H-11} r={4} fill={t.accent2} opacity={0.8}/>
            <text x={22} y={H-11} dominantBaseline="middle"
              fontSize={7} fontFamily="Crimson Text,serif" fill="#aaa">reachable</text>
            <circle cx={72} cy={H-11} r={4} fill="#da70d6" opacity={0.8}/>
            <text x={80} y={H-11} dominantBaseline="middle"
              fontSize={7} fontFamily="Crimson Text,serif" fill="#aaa">secret passage</text>
          </g>
        )}
      </svg>
    </div>
  );
}


function HandView({cards, theme}) {
  const t = THEMES[theme];
  const colors = {room:t.accent, weapon:"#e05c5c", suspect:"#a78bfa"};
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {cards.map((card,i)=>{
        const isSuspect = card.type==="suspect";
        const isWeapon  = card.type==="weapon";
        const charImg   = isSuspect ? CHARACTER_IMAGES[card.id] : null;
        const weapImg   = isWeapon  ? (card.img ? WEAPON_IMAGES[card.img] : null) : null;
        const hasImg    = charImg || weapImg;
        return (
          <div key={i} style={{
            borderRadius:10, overflow:"hidden",
            border:`2px solid ${colors[card.type]}66`,
            width:hasImg?56:"auto",
            background: hasImg?"#0a0a15":`${colors[card.type]}11`,
          }}>
            {hasImg ? (
              <div style={{height:64,overflow:"hidden",position:"relative"}}>
                <img src={charImg||weapImg} alt={card.name}
                  style={{width:"100%",height:isSuspect?"150%":"100%",objectFit:"cover",
                    objectPosition:isSuspect?"center 5%":"center 30%"}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,
                  background:`linear-gradient(transparent,${colors[card.type]}cc)`,
                  padding:"6px 2px 3px"}}>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:6,color:"#fff",
                    textAlign:"center",textShadow:"0 1px 3px #000",lineHeight:1.2}}>{card.name}</div>
                </div>
              </div>
            ) : (
              <div style={{padding:"4px 10px",fontSize:12,color:colors[card.type],fontWeight:600}}>
                {card.icon||"🃏"} {card.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Dot positions for each face [1-6], as {top,left} percentages
const DOT_POSITIONS = {
  1: [[50,50]],
  2: [[25,25],[75,75]],
  3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[25,75],[75,25],[75,75]],
  5: [[25,25],[25,75],[50,50],[75,25],[75,75]],
  6: [[25,25],[25,75],[50,25],[50,75],[75,25],[75,75]],
};

// 3D rotation targets per face value (x,y rotations to bring that face forward)
const FACE_ROTATIONS = {
  1: "rotateX(0deg)   rotateY(0deg)",
  2: "rotateX(-90deg) rotateY(0deg)",
  3: "rotateX(0deg)   rotateY(90deg)",
  4: "rotateX(0deg)   rotateY(-90deg)",
  5: "rotateX(90deg)  rotateY(0deg)",
  6: "rotateX(180deg) rotateY(0deg)",
};

function DiceFace({dots, faceStyle, accent}) {
  return (
    <div style={{
      position:"absolute", width:"100%", height:"100%",
      background:"linear-gradient(135deg,#1e1e3a,#0d0d1f)",
      border:`1px solid ${accent}44`,
      borderRadius:10,
      display:"flex", alignItems:"center", justifyContent:"center",
      backfaceVisibility:"hidden",
      ...faceStyle,
    }}>
      <div style={{position:"relative",width:"70%",height:"70%"}}>
        {dots.map(([top,left],i)=>(
          <div key={i} style={{
            position:"absolute",
            top:`${top}%`, left:`${left}%`,
            transform:"translate(-50%,-50%)",
            width:10, height:10, borderRadius:"50%",
            background:accent,
            boxShadow:`0 0 6px ${accent}cc`,
          }}/>
        ))}
      </div>
    </div>
  );
}

function Dice({value, rolling, accent="#4fd1c5"}) {
  const sz = 72; // cube side length px
  const half = sz/2;

  // During roll: spin wildly. After roll: settle to correct face.
  const cubeTransform = rolling
    ? undefined  // handled by animation
    : value
      ? FACE_ROTATIONS[value]
      : "rotateX(-20deg) rotateY(30deg)";

  return (
    <div style={{
      width:sz, height:sz,
      perspective:300,
      margin:"0 auto",
      userSelect:"none",
    }}>
      <div style={{
        width:"100%", height:"100%",
        position:"relative",
        transformStyle:"preserve-3d",
        transform: cubeTransform,
        transition: rolling ? "none" : "transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)",
        animation: rolling ? "diceRoll 0.15s linear infinite" : "none",
      }}>
        {/* Front  = 1 */}
        <DiceFace dots={DOT_POSITIONS[1]} accent={accent}
          faceStyle={{transform:`translateZ(${half}px)`}}/>
        {/* Back   = 6 */}
        <DiceFace dots={DOT_POSITIONS[6]} accent={accent}
          faceStyle={{transform:`rotateY(180deg) translateZ(${half}px)`}}/>
        {/* Right  = 3 */}
        <DiceFace dots={DOT_POSITIONS[3]} accent={accent}
          faceStyle={{transform:`rotateY(90deg) translateZ(${half}px)`}}/>
        {/* Left   = 4 */}
        <DiceFace dots={DOT_POSITIONS[4]} accent={accent}
          faceStyle={{transform:`rotateY(-90deg) translateZ(${half}px)`}}/>
        {/* Top    = 2 */}
        <DiceFace dots={DOT_POSITIONS[2]} accent={accent}
          faceStyle={{transform:`rotateX(90deg) translateZ(${half}px)`}}/>
        {/* Bottom = 5 */}
        <DiceFace dots={DOT_POSITIONS[5]} accent={accent}
          faceStyle={{transform:`rotateX(-90deg) translateZ(${half}px)`}}/>
      </div>
    </div>
  );
}

// ─── MAIN GAME ─────────────────────────────────────────────────────────────
export default function MurderMystery() {
  const [screen, setScreen] = useState("home"); // home | setup | game | rules
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(["Player 1","Player 2"]);
  const [game, setGame] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showAccusation, setShowAccusation] = useState(false);
  const [suggWeapon, setSuggWeapon] = useState(null);
  const [suggSuspect, setSuggSuspect] = useState(null);
  const [accusRoom, setAccusRoom] = useState(null);
  const [accusWeapon, setAccusWeapon] = useState(null);
  const [accusSuspect, setAccusSuspect] = useState(null);
  const [hauntingMsg, setHauntingMsg] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  // notebook[playerId][cardKey] = "clear"|"cross"|"tick"|"maybe"
  const [notebook, setNotebook] = useState({});
  const [showAbility, setShowAbility] = useState(false);
  // passDevice: when set, shows the handoff screen before the next player's turn
  // { fromName, toName, toCharacter }
  const [passDevice, setPassDevice] = useState(null);
  const [soundOn, setSoundOn] = useState(true);

  // Keep master volume in sync with toggle
  useEffect(()=>{
    try { setMasterVolume(soundOn ? 0.7 : 0); } catch(e){}
  },[soundOn]);

  // Start ambient when game theme changes
  useEffect(()=>{
    if(!game || !soundOn) { stopAmbient(); return; }
    try { startAmbient(game.theme); } catch(e){}
    return ()=>stopAmbient();
  },[game?.theme, soundOn]);
  const [abilityResult, setAbilityResult] = useState(null);
  // For double_roll: stores both values while player chooses
  const [doubleRollValues, setDoubleRollValues] = useState(null);
  // For extra_suggestion (Scarlet): stores which room player picked
  const [abilitySuggRoom, setAbilitySuggRoom] = useState(null);
  // For confession: stores target player + card query
  const [confessionTarget, setConfessionTarget] = useState(null);
  const [confessionCard, setConfessionCard] = useState(null);

  function cycleNotebook(playerId, cardKey) {
    const states = ["clear","cross","tick","maybe"];
    setNotebook(prev => {
      const playerBook = prev[playerId] || {};
      const cur = playerBook[cardKey] || "clear";
      const next = states[(states.indexOf(cur)+1) % states.length];
      return {...prev, [playerId]: {...playerBook, [cardKey]: next}};
    });
  }

  // ── triggerPassDevice — show handoff screen before next player's turn ──
  function triggerPassDevice(updatedGame, fromName) {
    const nextPlayer = updatedGame.players[updatedGame.currentPlayer];
    // Only show handoff when phase is roll (start of a new turn) and game isn't over
    if(updatedGame.phase !== "roll" || updatedGame.phase === "end") return;
    if(updatedGame.players.length < 2) return; // single player — skip
    try{ SFX.passDevice(); } catch(e){}
    setPassDevice({
      fromName,
      toName: nextPlayer.name,
      toCharacter: nextPlayer.character,
    });
  }

  // ── useAbility: execute a character's special power ───────────────────
  function useAbility() {
    const player = game.players[game.currentPlayer];
    if(player.abilityUsed) return;
    const effect = player.character.ability?.effect;
    const newGame = {...game};
    const thm = THEMES[game.theme];

    try{ SFX.ability(); } catch(e){}
    if(effect === "double_roll") {
      // Roll two dice, let player pick
      const v1 = Math.floor(Math.random()*6)+1;
      const v2 = Math.floor(Math.random()*6)+1;
      setDoubleRollValues([v1,v2]);
      setAbilityResult({type:"double_roll", v1, v2});
      // Mark used
      newGame.players = newGame.players.map((p,i)=>
        i===game.currentPlayer ? {...p, abilityUsed:true} : p);
      newGame.log = [`🪖 ${player.name} uses FORCED MARCH — rolled ${v1} and ${v2}. Choose one.`, ...newGame.log.slice(0,14)];
      setGame(newGame);
      setShowAbility(false);
      return;
    }

    if(effect === "peek_hand") {
      const others = game.players.filter(p=>p.id!==player.id && !p.eliminated && p.hand.length>0);
      if(!others.length){ setAbilityResult({type:"peek_hand", msg:"No other players have cards to peek."}); return; }
      const target = others[Math.floor(Math.random()*others.length)];
      const card = target.hand[Math.floor(Math.random()*target.hand.length)];
      setAbilityResult({type:"peek_hand", card, targetName:target.name});
      // Auto-cross in notebook
      setNotebook(prev=>{
        const book = prev[player.id]||{};
        return {...prev, [player.id]:{...book, [card.id||card.name]:"cross"}};
      });
      newGame.players = newGame.players.map((p,i)=>
        i===game.currentPlayer ? {...p, abilityUsed:true} : p);
      newGame.log = [`🔬 ${player.name} uses ACADEMIC INSIGHT — secretly viewed a card.`, ...newGame.log.slice(0,14)];
      setGame(newGame);
      setShowAbility(false);
      return;
    }

    if(effect === "confession") {
      // Show UI to pick target + card — handled in render
      setAbilityResult({type:"confession_setup"});
      return;
    }

    if(effect === "unblock_room") {
      const blocked = Object.keys(newGame.blockedRooms||{}).map(Number);
      if(!blocked.length){ setAbilityResult({type:"unblock_room", msg:"No rooms are currently sealed."}); return; }
      const roomIdx = blocked[0];
      const roomName = thm.rooms[roomIdx].name;
      delete newGame.blockedRooms[roomIdx];
      // Move player there for free
      newGame.players = newGame.players.map((p,i)=>
        i===game.currentPlayer ? {...p, roomIndex:roomIdx, abilityUsed:true} : p);
      newGame.phase = "suggest";
      newGame.movesLeft = 0;
      newGame.log = [`💉 ${player.name} uses CLINICAL EYE — unsealed the ${roomName} and moved in.`, ...newGame.log.slice(0,14)];
      setGame(newGame);
      setAbilityResult({type:"unblock_room", roomName});
      setShowAbility(false);
      return;
    }

    if(effect === "room_poll") {
      const roomIdx = player.roomIndex;
      const roomId = thm.rooms[roomIdx].id;
      const roomName = thm.rooms[roomIdx].name;
      const results = game.players
        .filter(p=>p.id!==player.id && !p.eliminated)
        .map(p=>({
          name:p.name,
          has: p.hand.some(c=>c.type==="room" && c.id===roomId),
          character:p.character,
        }));
      setAbilityResult({type:"room_poll", roomName, results});
      newGame.players = newGame.players.map((p,i)=>
        i===game.currentPlayer ? {...p, abilityUsed:true} : p);
      newGame.log = [`🤝 ${player.name} uses SOCIAL CAPITAL — polling all players on the ${roomName}.`, ...newGame.log.slice(0,14)];
      setGame(newGame);
      setShowAbility(false);
      return;
    }

    if(effect === "extra_suggestion") {
      // Mark used then drop into suggestion UI with any-room override
      newGame.players = newGame.players.map((p,i)=>
        i===game.currentPlayer ? {...p, abilityUsed:true} : p);
      newGame.log = [`🎭 ${player.name} uses LEADING ROLE — may suggest from any room.`, ...newGame.log.slice(0,14)];
      setGame(newGame);
      setAbilityResult({type:"extra_suggestion_setup"});
      // Show suggestion panel directly
      setShowAbility(false);
      setShowSuggestion(true);
      return;
    }
  }

  function commitConfession() {
    if(!confessionTarget || !confessionCard) return;
    const player = game.players[game.currentPlayer];
    const target = game.players.find(p=>p.id===confessionTarget);
    if(!target) return;
    const cardKey = confessionCard;
    const has = target.hand.some(c=>(c.id||c.name)===cardKey);
    const cardName = [...THEMES[game.theme].rooms, ...THEMES[game.theme].weapons, ...CHARACTERS]
      .find(c=>(c.id||c.name)===cardKey)?.name || cardKey;
    if(has) {
      setNotebook(prev=>{
        const book = prev[player.id]||{};
        return {...prev,[player.id]:{...book,[cardKey]:"cross"}};
      });
    }
    setAbilityResult({type:"confession_result", targetName:target.name, cardName, has});
    const newGame = {...game};
    newGame.players = newGame.players.map((p,i)=>
      i===game.currentPlayer ? {...p, abilityUsed:true} : p);
    newGame.log = [`🕊️ ${player.name} uses CONFESSION — asked ${target.name} about ${cardName}: ${has?"YES":"NO"}.`, ...newGame.log.slice(0,14)];
    setGame(newGame);
    setConfessionTarget(null);
    setConfessionCard(null);
  }

  const t = selectedTheme ? THEMES[selectedTheme] : THEMES.school;

  function rollDice() {
    if(game.phase!=="roll") return;
    try{ SFX.diceRoll(); } catch(e){}
    setRolling(true);
    setTimeout(()=>{
      let val = Math.floor(Math.random()*6)+1;
      setRolling(false);
      try{ SFX.diceSettle(val); } catch(e){}

      const newGame = {...game};

      // Apply dice curse if active
      if(newGame.diceCursed) {
        val = Math.max(1, Math.floor(val/2));
        newGame.diceCursed = false;
        newGame.log = [`🩸 Cursed roll — halved to ${val}!`, ...newGame.log.slice(0,14)];
      }

      // Decay blocked rooms
      const updatedBlocks = {};
      Object.entries(newGame.blockedRooms||{}).forEach(([ri,turns])=>{
        if(turns-1 > 0) updatedBlocks[parseInt(ri)] = turns-1;
      });
      newGame.blockedRooms = updatedBlocks;

      newGame.diceResult = val;
      newGame.movesLeft = val;
      newGame.phase = "move";

      // Haunting chance ~30% per turn
      if(Math.random() < 0.30) {
        const haunting = pickHauntingEvent(newGame, game.theme);
        newGame.hauntingIndex++;

        // Apply immediate effects
        if(haunting.effect === "block") {
          newGame.blockedRooms = {...(newGame.blockedRooms||{}), [haunting.roomIndex]: haunting.turnsLeft};
        } else if(haunting.effect === "force_move") {
          // Force move — update position now, skip normal move phase
          const cp = {...newGame.players[game.currentPlayer]};
          cp.roomIndex = haunting.roomIndex;
          newGame.players = newGame.players.map((p,i)=>i===game.currentPlayer?cp:p);
          newGame.phase = "suggest";
          newGame.movesLeft = 0;
        } else if(haunting.effect === "lose_turn") {
          // Skip to next player
          const fromNameHaunt = game.players[game.currentPlayer].name;
          newGame.phase = "roll";
          newGame.movesLeft = 0;
          let next = (game.currentPlayer+1) % newGame.players.length;
          while(newGame.players[next].eliminated) next=(next+1)%newGame.players.length;
          newGame.currentPlayer = next;
          // passDevice will fire after setGame below
        } else if(haunting.effect === "dice_curse") {
          newGame.diceCursed = true;
          newGame.phase = "move"; // still move this turn on full roll
        } else if(haunting.effect === "reveal_hand") {
          // Auto-cross revealed card in current player's notebook
          if(haunting.cardId) {
            setNotebook(prev=>{
              const cp = game.players[game.currentPlayer];
              const book = prev[cp.id]||{};
              return {...prev, [cp.id]:{...book, [haunting.cardId]:"cross"}};
            });
          }
        } else if(haunting.effect === "clue") {
          // Auto-cross the revealed card value
          setNotebook(prev=>{
            const cp = game.players[game.currentPlayer];
            const book = prev[cp.id]||{};
            return {...prev, [cp.id]:{...book, [haunting.value]:"tick"}};
          });
        }

        try{ SFX.haunting(); } catch(e){}
        newGame.log = [`👻 ${haunting.title.toUpperCase()}: ${haunting.text}`, ...newGame.log.slice(0,14)];
        setHauntingMsg(haunting);
      }

      if(newGame.phase === "move") {
        newGame.log = [`🎲 ${game.players[game.currentPlayer].name} rolled a ${val}!`, ...newGame.log.slice(0,14)];
      }
      setGame(newGame);
      // If lose_turn haunting advanced the player, show handoff
      if(newGame.phase === "roll" && newGame.currentPlayer !== game.currentPlayer) {
        triggerPassDevice(newGame, game.players[game.currentPlayer].name);
      }
    },900);
  }

  function moveToRoom(roomIndex) {
    if(game.phase!=="move") return;
    const currentP = game.players[game.currentPlayer];
    const reachable = getReachableRooms(currentP.roomIndex, game.movesLeft);
    // Allow secret passage
    const isSecret = SECRET_PASSAGES.some(([a,b])=>
      (a===currentP.roomIndex&&b===roomIndex)||(b===currentP.roomIndex&&a===roomIndex)
    );
    if(!reachable.has(roomIndex) && !isSecret) return;

    const newGame = {...game};
    const p = {...newGame.players[game.currentPlayer]};
    const prevRoom = THEMES[game.theme].rooms[p.roomIndex].name;
    p.roomIndex = roomIndex;
    newGame.players = newGame.players.map((pl,i)=>i===game.currentPlayer?p:pl);
    const roomName = THEMES[game.theme].rooms[roomIndex].name;
    const via = isSecret ? " via secret passage 👻" : "";
    try{ SFX.move(); } catch(e){}
    newGame.log = [`🚶 ${p.name} moved from ${prevRoom} to ${roomName}${via}.`, ...newGame.log.slice(0,14)];
    newGame.phase = "suggest";
    newGame.movesLeft = 0;
    setGame(newGame);
  }

  function makeSuggestion() {
    if(!suggWeapon || !suggSuspect) return;
    const newGame = {...game};
    const player = newGame.players[game.currentPlayer];
    const suggRoomIdx = (abilitySuggRoom !== null && abilitySuggRoom !== undefined) ? abilitySuggRoom : player.roomIndex;
    const roomName = THEMES[game.theme].rooms[suggRoomIdx].name;
    const weaponName = THEMES[game.theme].weapons.find(w=>w.id===suggWeapon)?.name;
    const suspectName = CHARACTERS.find(c=>c.id===suggSuspect)?.fullName;
    
    const thm = THEMES[game.theme];
    const suggestedChar = CHARACTERS.find(c=>c.id===suggSuspect);
    const motiveSnippet = thm.motives?.[suggSuspect]?.motive?.slice(0,80) + "…" || "";
    try{ SFX.suggest(); } catch(e){}
    newGame.log = [
      `🔍 ${player.name} suggests: ${suspectName} in the ${roomName} with the ${weaponName}.`,
      motiveSnippet ? `💭 Motive reminder — ${suggestedChar?.fullName}: "${motiveSnippet}"` : "",
      ...newGame.log.slice(0,13)
    ].filter(Boolean);
    
    // Check if any other player can disprove
    let disproved = false;
    let notebookUpdates = {};  // cardKey -> "cross" for the current player's notebook
    for(let i=1;i<newGame.players.length;i++){
      const idx=(game.currentPlayer+i)%newGame.players.length;
      const otherPlayer=newGame.players[idx];
      const canDisprove = otherPlayer.hand.some(card=>
        (card.type==="room"&&THEMES[game.theme].rooms[suggRoomIdx].id===card.id)||
        (card.type==="weapon"&&card.id===suggWeapon)||
        (card.type==="suspect"&&card.id===suggSuspect)
      );
      if(canDisprove){
        const dispCard = otherPlayer.hand.find(card=>
          (card.type==="room"&&THEMES[game.theme].rooms[suggRoomIdx].id===card.id)||
          (card.type==="weapon"&&card.id===suggWeapon)||
          (card.type==="suspect"&&card.id===suggSuspect)
        );
        try{ SFX.cardShown(); } catch(e){}
        newGame.log = [`💡 ${otherPlayer.name} shows a card — ${dispCard.name} is cleared.`, ...newGame.log.slice(0,14)];
        // Auto-cross the revealed card in the current player's notebook
        const cardKey = dispCard.id || dispCard.name;
        notebookUpdates[cardKey] = "cross";
        disproved = true;
        break;
      }
    }
    if(!disproved) {
      try{ SFX.noDisprove(); } catch(e){}
      newGame.log = [`😱 No one could disprove — all three may be the solution!`, ...newGame.log.slice(0,14)];
    }
    // Apply notebook auto-updates
    if(Object.keys(notebookUpdates).length > 0) {
      setNotebook(prev => {
        const playerBook = prev[player.id] || {};
        return {...prev, [player.id]: {...playerBook, ...notebookUpdates}};
      });
    }
    
    // End turn — advance to next player
    const fromName = game.players[game.currentPlayer].name;
    newGame.currentPlayer = (game.currentPlayer+1)%newGame.players.length;
    while(newGame.players[newGame.currentPlayer].eliminated){
      newGame.currentPlayer=(newGame.currentPlayer+1)%newGame.players.length;
    }
    newGame.phase = "roll";
    newGame.turnCount++;
    setGame(newGame);
    setShowSuggestion(false);
    setShowAccusation(false);
    setShowAbility(false);
    setAbilityResult(null);
    setSuggWeapon(null);
    setSuggSuspect(null);
    setAccusRoom(null);
    setAccusWeapon(null);
    setAccusSuspect(null);
    setAbilitySuggRoom(null);
    setHauntingMsg(null);
    triggerPassDevice(newGame, fromName);
  }

  function makeAccusation() {
    if(!accusRoom||!accusWeapon||!accusSuspect) return;
    const sol = game.solution;
    const correct = accusRoom===sol.room.id && accusWeapon===sol.weapon.id && accusSuspect===sol.suspect.id;
    const player = game.players[game.currentPlayer];
    const newGame = {...game};
    try{ SFX.accuse(); } catch(e){}
    
    if(correct) {
      newGame.phase = "end";
      newGame.winner = player;
      setTimeout(()=>{ try{ SFX.win(); } catch(e){} }, 300);
      newGame.log = [
        `🎉 ${player.name} solved the murder!`,
        `✅ It was ${sol.suspect.fullName} in the ${sol.room.name} with the ${sol.weapon.name}!`,
        ...newGame.log.slice(0,13)
      ];
    } else {
      try{ SFX.wrongAccuse(); } catch(e){}
      newGame.log = [
        `❌ ${player.name}'s accusation was WRONG and they are eliminated!`,
        ...newGame.log.slice(0,14)
      ];
      newGame.players = newGame.players.map((p,i)=>
        i===game.currentPlayer?{...p,eliminated:true}:p
      );
      // Check if all players eliminated
      const alive = newGame.players.filter(p=>!p.eliminated);
      if(alive.length===0){
        newGame.phase="end";
        newGame.log = [`💀 Everyone was eliminated! The killer escapes... It was ${sol.suspect.fullName}.`, ...newGame.log.slice(0,14)];
      } else {
        const fromName2 = game.players[game.currentPlayer].name;
        newGame.currentPlayer=(game.currentPlayer+1)%newGame.players.length;
        while(newGame.players[newGame.currentPlayer].eliminated){
          newGame.currentPlayer=(newGame.currentPlayer+1)%newGame.players.length;
        }
        newGame.phase="roll";
        setGame(newGame);
        setShowAccusation(false);
        triggerPassDevice(newGame, fromName2);
        return;
      }
    }
    setGame(newGame);
    setShowAccusation(false);
  }

  function skipSuggestion() {
    const fromName = game.players[game.currentPlayer].name;
    const newGame = {...game};
    newGame.currentPlayer = (game.currentPlayer+1)%newGame.players.length;
    while(newGame.players[newGame.currentPlayer].eliminated){
      newGame.currentPlayer=(newGame.currentPlayer+1)%newGame.players.length;
    }
    newGame.phase = "roll";
    newGame.turnCount++;
    newGame.log=[`⏭ ${fromName} passes.`,...newGame.log.slice(0,14)];
    setGame(newGame);
    setShowSuggestion(false);
    setShowAccusation(false);
    setShowAbility(false);
    setAbilityResult(null);
    setHauntingMsg(null);
    setAbilitySuggRoom(null);
    triggerPassDevice(newGame, fromName);
  }

  // ─── HOME SCREEN ─────────────────────────────────────────────────────────
  if(screen==="home") return (
    <div style={{
      minHeight:"100vh", background:"#06060f",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      fontFamily:"'Georgia', serif",
      padding:"24px 16px",
      backgroundImage:"radial-gradient(ellipse at 25% 15%, #1a082e 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, #080a1a 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, #0d0810 0%, transparent 80%)",
      position:"relative", overflow:"hidden",
    }}>
      {/* Vignette */}
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center, transparent 40%, #000000cc 100%)",pointerEvents:"none",zIndex:0}}/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
        html { scroll-behavior: smooth; -webkit-text-size-adjust:100%; }
        body { -webkit-font-smoothing:antialiased; }
        @keyframes flicker  { 0%,100%{opacity:1} 45%{opacity:0.82} 55%{opacity:0.95} }
        @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes floatSlow{ 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-6px) rotate(1deg)} }
        @keyframes spin     { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes fadein   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeup   { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse    { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .theme-btn         { transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1) !important; }
        .theme-btn:hover   { transform:scale(1.05) translateY(-4px) !important; box-shadow:0 12px 40px rgba(0,0,0,0.5) !important; }
        .action-btn:hover  { opacity:0.85 !important; transform:scale(0.97) !important; }
        .btn-hover         { transition:all 0.15s !important; }
        .btn-hover:hover   { opacity:0.85 !important; transform:translateY(-2px) !important; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#0a0a15; }
        ::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
        input:focus { outline:none; }
        table { border-collapse:collapse; }
      `}</style>
      
      <div style={{position:"relative",zIndex:1,textAlign:"center",marginBottom:36}}>
        <div style={{animation:"float 4s ease-in-out infinite",fontSize:56,marginBottom:14,filter:"drop-shadow(0 0 20px #c0920066)"}}>🕯️</div>
        <h1 style={{
          fontFamily:"'Cinzel',serif", fontSize:"clamp(30px,7vw,56px)",
          color:"#e8d5b7", letterSpacing:"clamp(4px,1.5vw,8px)", textAlign:"center",
          textShadow:"0 0 40px #c0920099, 0 0 80px #c0920044, 0 2px 4px #000",
          marginBottom:6, animation:"flicker 4s ease-in-out infinite",
          lineHeight:1.1, fontWeight:900,
        }}>DARK EVIDENCE</h1>
        <div style={{
          width:60,height:1,
          background:"linear-gradient(90deg,transparent,#9a7d5a,transparent)",
          margin:"10px auto",
        }}/>
        <p style={{
          fontFamily:"'Crimson Text',serif", fontStyle:"italic",
          color:"#9a7d5a", fontSize:16, letterSpacing:"4px",
          textAlign:"center",
        }}>A Murder Mystery Game</p>
      </div>
      
      <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center",marginBottom:36,position:"relative",zIndex:1}}>
        {Object.entries(THEMES).map(([key,theme],ti)=>(
          <div key={key}
            className="theme-btn"
            onClick={()=>{ try{SFX.click();}catch(e){} setSelectedTheme(key);setScreen("setup");}}
            style={{
              background:`linear-gradient(160deg, ${theme.surface}ee, #06060fcc)`,
              border:`1.5px solid ${theme.accent}55`,
              borderRadius:18, padding:"22px 18px 20px",
              cursor:"pointer",
              width:"clamp(140px,28vw,175px)", textAlign:"center",
              boxShadow:`0 4px 30px ${theme.accent}18, inset 0 1px 0 ${theme.accent}22`,
              backdropFilter:"blur(8px)",
              animation:`fadeup 0.4s ease-out ${ti*0.1}s both`,
            }}
          >
            <div style={{fontSize:36,marginBottom:10,animation:"floatSlow 5s ease-in-out infinite"}}>{theme.icon}</div>
            <div style={{
              fontFamily:"'Cinzel',serif",fontSize:12,fontWeight:700,
              color:theme.accent,letterSpacing:"2px",marginBottom:6,lineHeight:1.3,
            }}>{theme.name}</div>
            <div style={{
              width:24,height:1,background:`${theme.accent}66`,
              margin:"0 auto 8px",
            }}/>
            <div style={{
              fontFamily:"'Crimson Text',serif",fontStyle:"italic",
              fontSize:12,color:"#777",lineHeight:1.5,
            }}>{theme.tagline}</div>
          </div>
        ))}
      </div>
      
      <div style={{display:"flex",gap:12}}>
        <button onClick={()=>setScreen("rules")} style={{
          background:"transparent",border:"1px solid #555",
          color:"#888",padding:"10px 24px",borderRadius:8,
          fontFamily:"'Cinzel',serif",fontSize:12,letterSpacing:"2px",
          cursor:"pointer",
        }}>HOW TO PLAY</button>
      </div>
    </div>
  );

  // ─── RULES SCREEN ─────────────────────────────────────────────────────────
  if(screen==="rules") return (
    <div style={{
      minHeight:"100vh",background:"#080810",
      fontFamily:"'Georgia',serif",padding:"40px 20px",
      backgroundImage:"radial-gradient(ellipse at 50% 0%, #1a0820 0%, transparent 70%)",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');`}</style>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <h1 style={{fontFamily:"'Cinzel',serif",color:"#e8d5b7",textAlign:"center",marginBottom:30}}>HOW TO PLAY</h1>
        {[
          ["🎯 Objective","Identify the murder suspect, the location, and the weapon before your opponents. Make a final Accusation when confident."],
          ["🎲 Roll & Move","On your turn, roll the dice. You must move to a room (click any highlighted room)."],
          ["🔍 Suggestions","Once in a room, make a Suggestion — name a suspect and weapon. Other players must show you a card if they have one matching."],
          ["💀 Accusations","When you're confident, make an Accusation. You must name the room, weapon, and suspect. Wrong = eliminated. Right = you win!"],
          ["👻 Hauntings","The spirit of the location's past victim occasionally intervenes. Haunting events reveal clues — pay attention to them."],
          ["🃏 Your Hand","Cards in your hand are DEFINITELY not part of the solution. Use them to eliminate possibilities."],
        ].map(([title,desc])=>(
          <div key={title} style={{
            background:"#111128",border:"1px solid #333",
            borderRadius:12,padding:"16px 20px",marginBottom:12,
          }}>
            <div style={{fontFamily:"'Cinzel',serif",color:"#c9a227",fontSize:14,marginBottom:6}}>{title}</div>
            <div style={{fontFamily:"'Crimson Text',serif",color:"#bbb",fontSize:15,lineHeight:1.6}}>{desc}</div>
          </div>
        ))}
        <div style={{textAlign:"center",marginTop:30}}>
          <button onClick={()=>setScreen("home")} style={{
            background:"#c9a22722",border:"1px solid #c9a227",color:"#c9a227",
            padding:"12px 32px",borderRadius:8,fontFamily:"'Cinzel',serif",
            fontSize:13,letterSpacing:"2px",cursor:"pointer",
          }}>BACK TO MENU</button>
        </div>
      </div>
    </div>
  );

  // ─── SETUP SCREEN ─────────────────────────────────────────────────────────
  if(screen==="setup") {
    const thm = THEMES[selectedTheme];
    const [expandedChar, setExpandedChar] = useState(null);
    // playerCharacters[i] = characterId chosen by player i
    const [playerCharacters, setPlayerCharacters] = useState(
      Array.from({length:6},(_,i)=>CHARACTERS[i].id)
    );

    function assignCharacter(playerIdx, charId) {
      setPlayerCharacters(prev => {
        const next = [...prev];
        // If another player already has this char, swap them
        const existingIdx = next.indexOf(charId);
        if(existingIdx !== -1 && existingIdx !== playerIdx) {
          next[existingIdx] = next[playerIdx]; // give them the displaced char
        }
        next[playerIdx] = charId;
        return next;
      });
    }
    return (
      <div style={{
        minHeight:"100vh",
        background:thm.bg,
        fontFamily:"'Georgia',serif",
        padding:"30px 20px",
        backgroundImage:`radial-gradient(ellipse at 50% 0%, ${thm.accent}11 0%, transparent 60%)`
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');`}</style>
        <div style={{maxWidth:500,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:24,paddingTop:8}}>
            <div style={{fontSize:44,animation:"floatSlow 6s ease-in-out infinite",filter:`drop-shadow(0 0 16px ${thm.accent}66)`,marginBottom:10}}>{thm.icon}</div>
            <h1 style={{
              fontFamily:"'Cinzel',serif",color:thm.accent,
              fontSize:"clamp(16px,5vw,24px)",letterSpacing:"clamp(2px,1vw,5px)",
              margin:"0 0 4px",textShadow:`0 0 20px ${thm.accent}66`,
            }}>{thm.name}</h1>
            <p style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",color:thm.muted,fontSize:14}}>{thm.tagline}</p>
            <div style={{width:40,height:1,background:`${thm.accent}55`,margin:"10px auto 0"}}/>
          </div>
          
          {/* Story intro */}
          <div style={{
            background:thm.surface,border:`1px solid ${thm.accent}44`,
            borderRadius:12,padding:"16px 20px",marginBottom:24,
          }}>
            <div style={{fontFamily:"'Cinzel',serif",color:thm.accent,fontSize:11,letterSpacing:"3px",marginBottom:10}}>THE STORY</div>
            <p style={{
              fontFamily:"'Crimson Text',serif",color:"#bbb",
              fontSize:14,lineHeight:1.8,margin:0,whiteSpace:"pre-line",
            }}>{thm.intro}</p>
          </div>
          
          {/* Suspect gallery */}
          <div style={{background:thm.surface,border:`1px solid ${thm.accent}44`,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontFamily:"'Cinzel',serif",color:thm.accent,fontSize:11,letterSpacing:"3px"}}>THE SUSPECTS</div>
              <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",fontSize:11,color:thm.muted}}>tap a card for their dossier</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {CHARACTERS.map(c=>(
                <CharacterCard
                  key={c.id}
                  character={c}
                  theme={selectedTheme}
                  motives={thm.motives}
                  expanded={expandedChar===c.id}
                  onToggle={()=>setExpandedChar(expandedChar===c.id ? null : c.id)}
                />
              ))}
            </div>
          </div>

          {/* Player count + character assignment */}
          <div style={{background:thm.surface,border:`1px solid ${thm.accent}44`,borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{fontFamily:"'Cinzel',serif",color:thm.accent,fontSize:11,letterSpacing:"3px",marginBottom:12}}>PLAYERS</div>

            {/* Count selector */}
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {[2,3,4,5,6].map(n=>(
                <button key={n} onClick={()=>{
                  setPlayerCount(n);
                  setPlayerNames(Array.from({length:n},(_,i)=>playerNames[i]||`Player ${i+1}`));
                }} style={{
                  flex:1,padding:"10px 0",
                  background:playerCount===n?`${thm.accent}33`:"transparent",
                  border:`1px solid ${playerCount===n?thm.accent:thm.accent+"44"}`,
                  color:playerCount===n?thm.accent:thm.muted,
                  borderRadius:8,fontFamily:"'Cinzel',serif",fontSize:14,
                  cursor:"pointer",transition:"all 0.15s",
                }}>{n}</button>
              ))}
            </div>

            {/* Per-player rows: name + character picker */}
            {Array.from({length:playerCount}).map((_,i)=>{
              const chosenId = playerCharacters[i];
              const chosenChar = CHARACTERS.find(c=>c.id===chosenId) || CHARACTERS[i];
              const takenIds = playerCharacters.slice(0,playerCount).filter((_,pi)=>pi!==i);
              return (
                <div key={i} style={{
                  marginBottom:14,
                  background:`${chosenChar.color}0d`,
                  border:`1px solid ${chosenChar.color}33`,
                  borderRadius:10,padding:"10px 12px",
                }}>
                  {/* Name input row */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <CharacterToken character={chosenChar} size={36}/>
                    <input
                      value={playerNames[i]||""}
                      onChange={e=>{
                        const n=[...playerNames];n[i]=e.target.value;setPlayerNames(n);
                      }}
                      placeholder={`Player ${i+1} name`}
                      style={{
                        flex:1,background:"#0a0a15",border:`1px solid ${chosenChar.color}44`,
                        borderRadius:6,padding:"8px 12px",color:thm.text,
                        fontFamily:"'Crimson Text',serif",fontSize:14,outline:"none",
                      }}
                    />
                    <div style={{
                      fontFamily:"'Cinzel',serif",fontSize:9,
                      color:chosenChar.color,letterSpacing:"1px",
                      minWidth:60,textAlign:"right",lineHeight:1.3,
                    }}>{chosenChar.name}</div>
                  </div>

                  {/* Character picker */}
                  <div>
                    <div style={{
                      fontFamily:"'Cinzel',serif",fontSize:8,color:thm.muted,
                      letterSpacing:"2px",marginBottom:7,
                    }}>CHOOSE CHARACTER</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {CHARACTERS.map(c=>{
                        const isChosen = chosenId === c.id;
                        const isTaken  = takenIds.includes(c.id);
                        const img = CHARACTER_IMAGES[c.id];
                        return (
                          <button
                            key={c.id}
                            onClick={()=>assignCharacter(i,c.id)}
                            title={`${c.fullName}${isTaken?" (swap)":""}`}
                            style={{
                              padding:0,borderRadius:8,cursor:"pointer",
                              border:`2px solid ${isChosen?c.color:isTaken?c.color+"55":c.color+"33"}`,
                              background:"transparent",
                              opacity: isChosen?1:isTaken?0.55:0.75,
                              transform: isChosen?"scale(1.08)":"scale(1)",
                              transition:"all 0.15s",
                              width:44,overflow:"hidden",
                              position:"relative",
                            }}
                          >
                            <div style={{height:52,overflow:"hidden",background:`${c.color}22`,position:"relative"}}>
                              {img
                                ? <img src={img} alt={c.fullName}
                                    style={{width:"100%",height:"160%",objectFit:"cover",objectPosition:"center 5%"}}/>
                                : <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c.icon}</div>
                              }
                              {/* Taken badge — show whose it is */}
                              {isTaken && !isChosen && (
                                <div style={{
                                  position:"absolute",inset:0,
                                  background:"#00000066",
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  fontSize:9,color:"#fff",fontFamily:"'Cinzel',serif",
                                  letterSpacing:"0.5px",
                                }}>
                                  {(() => {
                                    const ownerIdx = playerCharacters.slice(0,playerCount).indexOf(c.id);
                                    return ownerIdx>=0 ? `P${ownerIdx+1}` : "";
                                  })()}
                                </div>
                              )}
                              {isChosen && (
                                <div style={{
                                  position:"absolute",bottom:0,left:0,right:0,
                                  background:`${c.color}cc`,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  padding:"2px 0",
                                }}>
                                  <span style={{fontSize:8,color:"#fff",fontFamily:"'Cinzel',serif"}}>✓</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{display:"flex",gap:12}}>
            <button onClick={()=>setScreen("home")} style={{
              flex:1,padding:"14px",background:"transparent",
              border:`1px solid ${thm.muted}66`,color:thm.muted,
              borderRadius:10,fontFamily:"'Cinzel',serif",fontSize:12,
              letterSpacing:"2px",cursor:"pointer",
            }}>BACK</button>
            <button onClick={()=>{
              const players = Array.from({length:playerCount},(_,i)=>({
                id:`p${i}`,
                name:playerNames[i]||`Player ${i+1}`,
                characterId: playerCharacters[i] || CHARACTERS[i].id,
              }));
              const newG = initGame(selectedTheme,players);
              setGame(newG);
              // Pre-populate each player's notebook: cross out their own hand cards
              const initBook = {};
              newG.players.forEach(p => {
                initBook[p.id] = {};
                p.hand.forEach(card => {
                  initBook[p.id][card.id||card.name] = "cross";
                });
              });
              setNotebook(initBook);
              setScreen("game");
            try{SFX.click();}catch(e){}
            }} style={{
              flex:2,padding:"14px",
              background:`linear-gradient(135deg,${thm.accent}44,${thm.accent}22)`,
              border:`1px solid ${thm.accent}`,color:thm.accent,
              borderRadius:10,fontFamily:"'Cinzel',serif",fontSize:13,
              letterSpacing:"3px",cursor:"pointer",
            }}>BEGIN INVESTIGATION</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── GAME SCREEN ──────────────────────────────────────────────────────────
  if(screen==="game" && game) {
    const thm = THEMES[game.theme];
    const currentPlayer = game.players[game.currentPlayer];
    const rooms = thm.rooms;
    const weapons = thm.weapons;

    const atm = thm.atmosphere || {};
    return (
      <div style={{
        minHeight:"100vh", background:thm.bg, color:thm.text,
        fontFamily:"'Georgia',serif", padding:"0 0 60px",
        backgroundImage: atm.bgGradient || `radial-gradient(ellipse at 50% 0%, ${thm.accent}08 0%, transparent 60%)`,
        position:"relative",
      }}>
        {/* Atmospheric vignette */}
        <div style={{
          position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
          background:`radial-gradient(ellipse at center, transparent 30%, ${atm.vignetteColor||"#000000bb"} 100%)`,
        }}/>
        {/* Subtle colour tint overlay */}
        <div style={{
          position:"fixed",inset:0,pointerEvents:"none",zIndex:0,
          background:atm.overlayColor||"transparent",
        }}/>
        {/* Floating ambient particles */}
        {atm.particles && (
          <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
            {atm.particles.map((p,i)=>(
              <div key={i} style={{
                position:"absolute",
                left:`${12 + i*14}%`,
                top:`${110 + Math.sin(i*1.3)*5}%`,
                fontSize:10 + (i%3)*4,
                opacity:0.06 + (i%4)*0.02,
                animation:`float ${8+i*1.5}s ease-in-out ${i*0.8}s infinite`,
                filter:"blur(0.5px)",
                userSelect:"none",
              }}>{p}</div>
            ))}
          </div>
        )}
        <style>{`
          @keyframes flicker  { 0%,100%{opacity:1} 45%{opacity:0.82} 55%{opacity:0.95} }
          @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          @keyframes floatSlow{ 0%,100%{transform:translateY(0) rotate(-0.5deg)} 50%{transform:translateY(-4px) rotate(0.5deg)} }
          @keyframes fadein   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fadeup   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
          @keyframes haunted  { 0%,100%{box-shadow:0 0 20px #8b008b88} 50%{box-shadow:0 0 40px #8b008bcc} }
          @keyframes pulse    { 0%,100%{opacity:0.5} 50%{opacity:1} }
          @keyframes diceRoll {
            0%   { transform: rotateX(0deg)   rotateY(0deg)   rotateZ(0deg); }
            16%  { transform: rotateX(180deg) rotateY(90deg)  rotateZ(45deg); }
            33%  { transform: rotateX(270deg) rotateY(180deg) rotateZ(90deg); }
            50%  { transform: rotateX(90deg)  rotateY(270deg) rotateZ(135deg); }
            66%  { transform: rotateX(360deg) rotateY(360deg) rotateZ(180deg); }
            83%  { transform: rotateX(450deg) rotateY(90deg)  rotateZ(225deg); }
            100% { transform: rotateX(540deg) rotateY(180deg) rotateZ(270deg); }
          }
          @keyframes diceBounce {
            0%,100% { transform: translateY(0) scale(1); }
            25%     { transform: translateY(-18px) scale(1.1); }
            55%     { transform: translateY(-6px) scale(1.04); }
            75%     { transform: translateY(-2px) scale(1.01); }
          }
          .btn-hover         { transition:all 0.15s !important; }
          .btn-hover:hover   { opacity:0.85 !important; transform:translateY(-2px) !important; }
          ::-webkit-scrollbar { width:3px; }
          ::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
        `}</style>

        {/* Header */}
        <div style={{
          background:`${thm.bg}ee`,
          borderBottom:`1px solid ${thm.accent}22`,
          padding:"10px 14px",
          display:"flex",alignItems:"center",
          justifyContent:"space-between",
          position:"sticky",top:0,zIndex:100,
          backdropFilter:"blur(12px)",
          WebkitBackdropFilter:"blur(12px)",
        }}>
          {/* Left: setting */}
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
            <span style={{fontSize:18,flexShrink:0}}>{thm.icon}</span>
            <div style={{minWidth:0}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:thm.accent,letterSpacing:"2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{thm.name}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:8,color:thm.muted,letterSpacing:"1px"}}>TURN {game.turnCount+1}</div>
            </div>
          </div>
          {/* Centre: current player */}
          <div style={{display:"flex",gap:8,alignItems:"center",flex:"0 0 auto"}}>
            <CharacterToken character={currentPlayer.character} size={32}/>
            <div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:currentPlayer.character.color,letterSpacing:"1px"}}>{currentPlayer.name}</div>
              <div style={{
                fontFamily:"'Cinzel',serif",fontSize:8,letterSpacing:"1.5px",
                color: game.phase==="roll"?thm.accent
                  :game.phase==="move"?thm.accent2
                  :game.phase==="suggest"?"#a78bfa"
                  :game.phase==="end"?"#e05c5c":thm.muted,
              }}>
                {game.phase==="roll"?"● ROLL DICE"
                  :game.phase==="move"?"● MOVE"
                  :game.phase==="suggest"?"● INVESTIGATE"
                  :game.phase==="end"?"● CASE CLOSED":""}
              </div>
            </div>
          </div>
          {/* Right: notes toggle */}
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            <button onClick={()=>{ try{SFX.click();}catch(e){} setSoundOn(v=>!v); }} style={{
              background:soundOn?`${thm.accent}22`:"transparent",
              border:`1px solid ${soundOn?thm.accent+"55":thm.muted+"33"}`,
              color:soundOn?thm.accent:thm.muted,
              padding:"6px 8px",borderRadius:6,
              fontFamily:"'Cinzel',serif",fontSize:11,
              cursor:"pointer",transition:"all 0.15s",
              title:soundOn?"Mute":"Unmute",
            }}>{soundOn?"🔊":"🔇"}</button>
            <button onClick={()=>{ try{SFX.click();}catch(e){} setShowNotes(!showNotes); }} style={{
              background:showNotes?`${thm.accent}22`:"transparent",
              border:`1px solid ${showNotes?thm.accent:thm.accent+"44"}`,
              color:showNotes?thm.accent:thm.muted,
              padding:"6px 10px",borderRadius:6,
              fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:"2px",
              cursor:"pointer",transition:"all 0.15s",
            }}>{showNotes?"✕":"📋"}</button>
          </div>
        </div>

        <div style={{padding:"14px 14px 0",maxWidth:600,margin:"0 auto",position:"relative",zIndex:1}}>

          {/* ── PASS-DEVICE LOCKOUT SCREEN ── */}
          {passDevice && (
            <div style={{
              position:"fixed",inset:0,zIndex:9999,
              background:"#000000f0",
              display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",
              padding:24,
              animation:"fadein 0.25s ease-out",
            }}>
              <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');`}</style>

              {/* Flicker candle */}
              <div style={{fontSize:52,marginBottom:12,animation:"float 3s ease-in-out infinite"}}>🕯️</div>

              {/* "Hand the device to" */}
              <div style={{
                fontFamily:"'Crimson Text',serif",fontStyle:"italic",
                color:"#666",fontSize:14,letterSpacing:"2px",
                marginBottom:6,textAlign:"center",
              }}>
                {passDevice.fromName} has finished their turn.
              </div>
              <div style={{
                fontFamily:"'Cinzel',serif",color:"#555",
                fontSize:10,letterSpacing:"4px",marginBottom:28,
              }}>PASS THE DEVICE TO</div>

              {/* Next player portrait */}
              <div style={{
                width:100,height:120,borderRadius:12,overflow:"hidden",
                border:`3px solid ${passDevice.toCharacter.color}`,
                boxShadow:`0 0 40px ${passDevice.toCharacter.color}66`,
                marginBottom:14,
              }}>
                {CHARACTER_IMAGES[passDevice.toCharacter.id]
                  ? <img src={CHARACTER_IMAGES[passDevice.toCharacter.id]} alt=""
                      style={{width:"100%",height:"160%",objectFit:"cover",objectPosition:"center 5%"}}/>
                  : <div style={{height:"100%",background:passDevice.toCharacter.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>{passDevice.toCharacter.icon}</div>
                }
              </div>

              {/* Player name */}
              <div style={{
                fontFamily:"'Cinzel',serif",
                fontSize:22,letterSpacing:"4px",
                color:passDevice.toCharacter.color,
                textShadow:`0 0 30px ${passDevice.toCharacter.color}88`,
                marginBottom:4,textAlign:"center",
              }}>{passDevice.toName}</div>
              <div style={{
                fontFamily:"'Crimson Text',serif",fontStyle:"italic",
                color:"#555",fontSize:13,marginBottom:36,textAlign:"center",
              }}>playing as {passDevice.toCharacter.fullName}</div>

              {/* Warning */}
              <div style={{
                background:"#111",border:"1px solid #333",
                borderRadius:8,padding:"10px 18px",marginBottom:28,
                fontFamily:"'Crimson Text',serif",fontStyle:"italic",
                color:"#555",fontSize:12,textAlign:"center",maxWidth:280,lineHeight:1.6,
              }}>
                Don't peek at {passDevice.fromName}'s notes.<br/>
                The dead are watching.
              </div>

              {/* Confirm button */}
              <button
                onClick={()=>setPassDevice(null)}
                style={{
                  padding:"14px 48px",
                  background:`${passDevice.toCharacter.color}22`,
                  border:`2px solid ${passDevice.toCharacter.color}`,
                  color:passDevice.toCharacter.color,
                  borderRadius:12,fontFamily:"'Cinzel',serif",
                  fontSize:13,letterSpacing:"4px",cursor:"pointer",
                  boxShadow:`0 0 20px ${passDevice.toCharacter.color}44`,
                  transition:"all 0.15s",
                }}
              >I'M READY</button>
            </div>
          )}

          {/* End game — full case file reveal */}
          {game.phase==="end" && (() => {
            const sol = game.solution;
            const killer = sol.suspect;
            const killerImg = CHARACTER_IMAGES[killer.id];
            const weapImg = sol.weapon.img ? WEAPON_IMAGES[sol.weapon.img] : null;
            const narrative = thm.narratives?.[killer.id]?.(sol.room.name, sol.weapon.name) || "";
            const motive = thm.motives?.[killer.id];
            const solved = !!game.winner;

            return (
              <div style={{
                background:`linear-gradient(180deg, #050508 0%, ${killer.color}0a 40%, #050508 100%)`,
                borderRadius:16, overflow:"hidden",
                border:`2px solid ${killer.color}66`,
                marginBottom:16,
                animation:"fadein 0.5s ease-out",
              }}>

                {/* ── VERDICT BANNER ── */}
                <div style={{
                  background:`linear-gradient(135deg,${killer.color}44,${killer.color}11)`,
                  borderBottom:`1px solid ${killer.color}44`,
                  padding:"20px 20px 16px",
                  textAlign:"center",
                }}>
                  <div style={{fontSize:36,marginBottom:6,animation:"float 3s ease-in-out infinite"}}>
                    {solved?"🔍":"💀"}
                  </div>
                  <div style={{
                    fontFamily:"'Cinzel',serif",
                    fontSize:"clamp(13px,4vw,20px)",
                    color: solved ? "#f0e6d3" : "#e05c5c",
                    letterSpacing:"4px",
                    textShadow:`0 0 30px ${killer.color}88`,
                    marginBottom:4,
                  }}>
                    {solved ? `${game.winner.name} SOLVED THE CASE` : "CASE UNSOLVED — THE KILLER WALKS FREE"}
                  </div>
                  <div style={{
                    fontFamily:"'Crimson Text',serif",fontStyle:"italic",
                    color:"#9a7d5a",fontSize:13,letterSpacing:"2px",
                  }}>{thm.name} — {new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}</div>
                </div>

                {/* ── KILLER PORTRAIT + VERDICT ── */}
                <div style={{padding:"20px 20px 0"}}>
                  <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:20}}>
                    {/* Portrait */}
                    <div style={{
                      width:90, flexShrink:0,
                      borderRadius:10, overflow:"hidden",
                      border:`3px solid ${killer.color}`,
                      boxShadow:`0 0 24px ${killer.color}66`,
                    }}>
                      {killerImg
                        ? <img src={killerImg} alt={killer.fullName}
                            style={{width:"100%",height:120,objectFit:"cover",objectPosition:"center 5%",display:"block"}}/>
                        : <div style={{height:120,background:killer.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>{killer.icon}</div>
                      }
                      <div style={{
                        background:`${killer.color}dd`,padding:"5px 4px",textAlign:"center",
                        fontFamily:"'Cinzel',serif",fontSize:8,color:"#fff",
                        letterSpacing:"1px",lineHeight:1.3,
                      }}>
                        {killer.fullName}<br/>
                        <span style={{fontSize:7,opacity:0.8}}>THE KILLER</span>
                      </div>
                    </div>

                    {/* Verdict details */}
                    <div style={{flex:1}}>
                      <div style={{
                        fontFamily:"'Cinzel',serif",color:"#e8d5b7",
                        fontSize:"clamp(10px,3vw,15px)",letterSpacing:"1px",
                        marginBottom:10,lineHeight:1.4,
                      }}>
                        <span style={{color:killer.color}}>{killer.fullName}</span>
                        <br/>
                        <span style={{color:"#aaa",fontSize:"0.85em"}}>in the </span>
                        <span style={{color:thm.accent}}>{sol.room.name}</span>
                        <br/>
                        <span style={{color:"#aaa",fontSize:"0.85em"}}>with the </span>
                        <span style={{color:"#e05c5c"}}>{sol.weapon.name}</span>
                      </div>

                      {/* Weapon thumbnail */}
                      {weapImg && (
                        <div style={{
                          width:52, height:64, borderRadius:7, overflow:"hidden",
                          border:"2px solid #e05c5c66",
                          boxShadow:"0 0 12px #e05c5c33",
                          display:"inline-block",
                        }}>
                          <img src={weapImg} alt={sol.weapon.name}
                            style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 30%"}}/>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── DIVIDER ── */}
                  <div style={{
                    height:1,background:`linear-gradient(90deg,transparent,${killer.color}66,transparent)`,
                    marginBottom:18,
                  }}/>

                  {/* ── THE STORY ── */}
                  <div style={{marginBottom:18}}>
                    <div style={{
                      fontFamily:"'Cinzel',serif",color:killer.color,
                      fontSize:9,letterSpacing:"4px",marginBottom:10,
                    }}>THE CONFESSION</div>
                    <p style={{
                      fontFamily:"'Crimson Text',serif",fontSize:14,
                      color:"#d4c5b0",lineHeight:1.85,margin:0,
                      textIndent:"1.5em",
                    }}>{narrative}</p>
                  </div>

                  {/* ── MOTIVE CARD ── */}
                  {motive && (
                    <div style={{
                      background:`${killer.color}0d`,
                      border:`1px solid ${killer.color}33`,
                      borderRadius:10,padding:"12px 14px",marginBottom:18,
                    }}>
                      <div style={{fontFamily:"'Cinzel',serif",color:killer.color,fontSize:9,letterSpacing:"3px",marginBottom:8}}>
                        WHAT THE INVESTIGATION FOUND
                      </div>
                      {[
                        {label:"RELATIONSHIP", text:motive.relationship},
                        {label:"MOTIVE",       text:motive.motive},
                        {label:"THEIR ALIBI",  text:motive.alibi + " — it didn't hold."},
                      ].map(({label,text})=>(
                        <div key={label} style={{marginBottom:8}}>
                          <span style={{
                            fontFamily:"'Cinzel',serif",fontSize:8,color:"#888",
                            letterSpacing:"2px",marginRight:8,
                          }}>{label}</span>
                          <span style={{
                            fontFamily:"'Crimson Text',serif",fontSize:12,
                            color:"#bbb",lineHeight:1.6,
                          }}>{text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── SCOREBOARD ── */}
                  <div style={{marginBottom:18}}>
                    <div style={{fontFamily:"'Cinzel',serif",color:thm.muted,fontSize:9,letterSpacing:"3px",marginBottom:8}}>INVESTIGATORS</div>
                    {game.players.map(p=>{
                      const isWinner = game.winner?.id===p.id;
                      const isElim   = p.eliminated;
                      return (
                        <div key={p.id} style={{
                          display:"flex",alignItems:"center",gap:10,
                          padding:"7px 0",borderBottom:`1px solid ${thm.accent}11`,
                        }}>
                          <CharacterToken character={p.character} size={30}/>
                          <span style={{flex:1,fontFamily:"'Crimson Text',serif",fontSize:13,color:isWinner?"#f0e6d3":isElim?"#555":"#aaa"}}>{p.name}</span>
                          <span style={{
                            fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:"1px",padding:"2px 8px",
                            borderRadius:5,
                            background:isWinner?"#c9a22733":isElim?"#e05c5c22":"#33333388",
                            border:`1px solid ${isWinner?"#c9a227":isElim?"#e05c5c44":"#44444488"}`,
                            color:isWinner?"#c9a227":isElim?"#e05c5c":"#555",
                          }}>
                            {isWinner?"🏆 SOLVED":isElim?"ELIMINATED":"DID NOT SOLVE"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── ACTIONS ── */}
                  <div style={{display:"flex",gap:10,paddingBottom:20}}>
                    <button onClick={()=>{
                      setGame(null);setNotebook({});setScreen("home");
                      stopAmbient();
                      setShowNotes(false);setHauntingMsg(null);
                      setPassDevice(null);setDoubleRollValues(null);
                    }} style={{
                      flex:1,padding:"13px",
                      background:`${killer.color}22`,border:`1px solid ${killer.color}`,
                      color:killer.color,borderRadius:10,fontFamily:"'Cinzel',serif",
                      fontSize:11,letterSpacing:"3px",cursor:"pointer",
                    }}>NEW CASE</button>
                    <button onClick={()=>{
                      const newG = initGame(game.theme, game.players.map(p=>({id:p.id,name:p.name})));
                      setGame(newG);
                      const initBook={};
                      newG.players.forEach(p=>{initBook[p.id]={};p.hand.forEach(c=>{initBook[p.id][c.id||c.name]="cross";});});
                      setNotebook(initBook);
                      setShowNotes(false);setHauntingMsg(null);
                      setPassDevice(null);setDoubleRollValues(null);
                      setAbilityResult(null);setShowAbility(false);
                      setShowSuggestion(false);setShowAccusation(false);
                    }} style={{
                      flex:1,padding:"13px",
                      background:`${thm.accent}22`,border:`1px solid ${thm.accent}`,
                      color:thm.accent,borderRadius:10,fontFamily:"'Cinzel',serif",
                      fontSize:11,letterSpacing:"3px",cursor:"pointer",
                    }}>PLAY AGAIN</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Haunting modal */}
          {hauntingMsg && (() => {
            const hm = typeof hauntingMsg === "object" ? hauntingMsg : {text:hauntingMsg, type:"flavour", title:"A Haunting Occurs"};
            const effectLabels = {
              clue:        {icon:"🔍", color:"#4fd14a", label:"CLUE REVEALED",    hint:"Check your notebook — a clue has been marked."},
              block:       {icon:"🔒", color:"#e05c5c", label:"ROOM SEALED",      hint:`A room is sealed for ${hm.turnsLeft||2} turns.`},
              force_move:  {icon:"👻", color:"#da70d6", label:"FORCED MOVEMENT",  hint:"You have been moved against your will."},
              lose_turn:   {icon:"💀", color:"#e05c5c", label:"TURN LOST",        hint:"You cannot move this turn."},
              reveal_hand: {icon:"🃏", color:"#f6ad55", label:"CARD EXPOSED",     hint:hm.cardName ? `"${hm.cardName}" has been revealed to all.` : "A card was exposed."},
              dice_curse:  {icon:"🩸", color:"#e05c5c", label:"DICE CURSED",      hint:"Your next roll will be halved."},
              none:        {icon:"👁️", color:"#9e7bb5", label:"THE PRESENCE",     hint:"It watches, but does nothing."},
            };
            const ef = effectLabels[hm.effect||hm.type] || {icon:"👻",color:"#da70d6",label:"A HAUNTING OCCURS",hint:""};
            return (
              <div style={{
                background:"linear-gradient(135deg,#1a0a2e,#0d0520)",
                border:`2px solid ${ef.color}88`,
                borderRadius:14,padding:"16px 18px",marginBottom:16,
                animation:"fadein 0.3s ease-out",
                boxShadow:`0 0 24px ${ef.color}33`,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1}}>
                    {/* Type badge */}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{fontSize:18}}>{ef.icon}</span>
                      <div>
                        <div style={{fontFamily:"'Cinzel',serif",color:ef.color,fontSize:10,letterSpacing:"3px"}}>{ef.label}</div>
                        <div style={{fontFamily:"'Cinzel',serif",color:"#9e7bb5",fontSize:9,letterSpacing:"1px",marginTop:1}}>{hm.title||""}</div>
                      </div>
                    </div>
                    {/* Flavour text */}
                    <p style={{
                      fontFamily:"'Crimson Text',serif",fontStyle:"italic",
                      color:"#dda0dd",fontSize:14,margin:"0 0 8px",lineHeight:1.75,
                    }}>{hm.text}</p>
                    {/* Mechanical effect hint */}
                    {ef.hint && (
                      <div style={{
                        background:`${ef.color}15`,border:`1px solid ${ef.color}44`,
                        borderRadius:6,padding:"5px 10px",
                        fontFamily:"'Crimson Text',serif",fontSize:12,color:ef.color,
                      }}>{ef.hint}</div>
                    )}
                  </div>
                  <button onClick={()=>setHauntingMsg(null)} style={{
                    background:"transparent",border:`1px solid ${ef.color}66`,
                    color:ef.color,padding:"4px 10px",borderRadius:6,
                    cursor:"pointer",fontSize:12,flexShrink:0,fontFamily:"'Cinzel',serif",
                  }}>✕</button>
                </div>
              </div>
            );
          })()}

          {/* Detective's Notebook */}
          {showNotes && (() => {
            const suspects = CHARACTERS.slice(0,game.players.length);
            const playerBook = notebook[currentPlayer.id] || {};
            // Auto-mark cards in hand as cross (confirmed not solution)
            const handKeys = new Set(currentPlayer.hand.map(c=>c.id||c.name));
            const getState = (key) => {
              if(handKeys.has(key)) return "hand";
              return playerBook[key] || "clear";
            };
            const cellStyle = (state) => {
              if(state==="hand")  return {bg:"#1a1a1a", color:"#555",    symbol:"✕", title:"In your hand"};
              if(state==="cross") return {bg:"#2a0a0a", color:"#e05c5c", symbol:"✕", title:"Eliminated"};
              if(state==="tick")  return {bg:"#0a2a0a", color:"#4fd14a", symbol:"✓", title:"Confirmed"};
              if(state==="maybe") return {bg:"#1a1a0a", color:"#f6ad55", symbol:"?", title:"Possible"};
              return {bg:"transparent", color:"#555", symbol:"·", title:"Tap to mark"};
            };
            const colStyle = {
              fontFamily:"'Cinzel',serif", fontSize:8, color:thm.muted,
              letterSpacing:"0.5px", textAlign:"center", padding:"2px 1px",
              writingMode:"vertical-rl", transform:"rotate(180deg)",
              maxHeight:60, overflow:"hidden",
            };

            const Section = ({label, items, imgFn}) => (
              <div style={{marginBottom:14}}>
                <div style={{
                  fontFamily:"'Cinzel',serif",fontSize:9,color:thm.accent,
                  letterSpacing:"3px",marginBottom:6,borderBottom:`1px solid ${thm.accent}22`,
                  paddingBottom:4,
                }}>{label}</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",width:"100%",tableLayout:"fixed"}}>
                    <thead>
                      <tr>
                        <th style={{width:80,textAlign:"left",paddingBottom:4,
                          fontFamily:"'Cinzel',serif",fontSize:8,color:thm.muted,
                          letterSpacing:"1px",fontWeight:400}}>CARD</th>
                        {game.players.map(p=>(
                          <th key={p.id} style={{width:28,padding:"0 2px 4px"}}>
                            <div style={{display:"flex",justifyContent:"center"}}>
                              <div style={{
                                width:20,height:20,borderRadius:"50%",overflow:"hidden",
                                border:`1.5px solid ${p.character.color}`,
                                background:p.character.color,flexShrink:0,
                              }}>
                                {CHARACTER_IMAGES[p.character.id]
                                  ? <img src={CHARACTER_IMAGES[p.character.id]} alt="" style={{width:"100%",height:"150%",objectFit:"cover",objectPosition:"center 5%"}}/>
                                  : <span style={{fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:p.character.textColor}}>{p.character.icon}</span>
                                }
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item,ii)=>{
                        const key = item.id || item.name;
                        const isEven = ii%2===0;
                        return (
                          <tr key={key} style={{background:isEven?`${thm.accent}06`:"transparent"}}>
                            <td style={{padding:"3px 0"}}>
                              <div style={{display:"flex",alignItems:"center",gap:5}}>
                                {imgFn && imgFn(item) ? (
                                  <div style={{width:18,height:22,borderRadius:3,overflow:"hidden",flexShrink:0,border:`1px solid ${thm.accent}33`}}>
                                    <img src={imgFn(item)} alt="" style={{width:"100%",height:item.type==="suspect"?"150%":"100%",objectFit:"cover",objectPosition:"center 5%"}}/>
                                  </div>
                                ) : (
                                  <span style={{fontSize:12}}>{item.icon}</span>
                                )}
                                <span style={{fontFamily:"'Crimson Text',serif",fontSize:11,color:"#ccc",lineHeight:1.2}}>
                                  {item.fullName||item.name}
                                </span>
                              </div>
                            </td>
                            {game.players.map(p=>{
                              const state = p.id===currentPlayer.id
                                ? getState(key)
                                : (notebook[p.id]||{})[key]||"clear";
                              const cs = cellStyle(state);
                              const isMe = p.id===currentPlayer.id;
                              const isInteractive = isMe && state!=="hand";
                              return (
                                <td key={p.id} style={{textAlign:"center",padding:"2px"}}>
                                  <div
                                    onClick={()=>isInteractive && cycleNotebook(p.id, key)}
                                    title={cs.title}
                                    style={{
                                      width:22, height:22, borderRadius:5,
                                      margin:"0 auto",
                                      background:cs.bg,
                                      border:`1px solid ${isMe?(cs.color+"66"):(thm.accent+"22")}`,
                                      display:"flex",alignItems:"center",justifyContent:"center",
                                      fontSize:11, color:cs.color, fontWeight:700,
                                      cursor:isInteractive?"pointer":"default",
                                      transition:"all 0.1s",
                                      opacity: isMe?1:0.5,
                                    }}
                                  >{cs.symbol}</div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );

            return (
              <div style={{
                background:thm.surface,border:`1px solid ${thm.accent}44`,
                borderRadius:14,padding:"14px",marginBottom:16,
                animation:"fadein 0.2s ease-out",
              }}>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontFamily:"'Cinzel',serif",color:thm.accent,fontSize:11,letterSpacing:"3px"}}>
                    🗒 DETECTIVE'S NOTEBOOK
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {[
                      {s:"cross",c:"#e05c5c",sym:"✕",l:"Out"},
                      {s:"tick", c:"#4fd14a",sym:"✓",l:"In"},
                      {s:"maybe",c:"#f6ad55",sym:"?",l:"?"},
                    ].map(({s,c,sym,l})=>(
                      <div key={s} style={{display:"flex",alignItems:"center",gap:3}}>
                        <div style={{width:14,height:14,borderRadius:3,background:`${c}22`,border:`1px solid ${c}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:c,fontWeight:700}}>{sym}</div>
                        <span style={{fontFamily:"'Crimson Text',serif",fontSize:9,color:thm.muted}}>{l}</span>
                      </div>
                    ))}
                    <span style={{fontSize:9,color:thm.muted,fontFamily:"'Crimson Text',serif",marginLeft:4}}>tap to cycle</span>
                  </div>
                </div>

                {/* Your hand */}
                <div style={{marginBottom:14}}>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:thm.accent,letterSpacing:"3px",marginBottom:6,borderBottom:`1px solid ${thm.accent}22`,paddingBottom:4}}>
                    YOUR HAND — these are NOT the solution
                  </div>
                  <HandView cards={currentPlayer.hand} theme={game.theme}/>
                </div>

                <Section
                  label="SUSPECTS"
                  items={suspects}
                  imgFn={c=>CHARACTER_IMAGES[c.id]}
                />
                <Section
                  label="ROOMS"
                  items={rooms.map(r=>({...r,type:"room",id:r.id}))}
                  imgFn={null}
                />
                <Section
                  label="WEAPONS"
                  items={weapons.map(w=>({...w,type:"weapon"}))}
                  imgFn={w=>w.img?WEAPON_IMAGES[w.img]:null}
                />
              </div>
            );
          })()}

          {/* Board */}
          <div style={{
            background:`linear-gradient(180deg,${thm.boardBg},${thm.bg})`,
            border:`1px solid ${thm.accent}22`,
            borderRadius:14,padding:"10px 10px 8px",marginBottom:12,
            boxShadow:`inset 0 0 40px ${thm.accent}08`,
          }}>
            <div style={{
              display:"flex",alignItems:"center",gap:8,marginBottom:8,
            }}>
              <div style={{flex:1,height:1,background:`${thm.accent}18`}}/>
              <div style={{fontFamily:"'Cinzel',serif",color:thm.muted,fontSize:8,letterSpacing:"4px"}}>THE SCENE</div>
              <div style={{flex:1,height:1,background:`${thm.accent}18`}}/>
            </div>
            <GameBoard game={game} onMoveToRoom={moveToRoom}/>
            {game.phase==="move" && (
              <div style={{
                textAlign:"center",marginTop:8,display:"flex",
                gap:8,justifyContent:"center",alignItems:"center",flexWrap:"wrap"
              }}>
                <span style={{
                  fontFamily:"'Crimson Text',serif",fontStyle:"italic",
                  color:thm.accent2,fontSize:12,
                }}>🎲 Rolled {game.diceResult} — highlighted rooms are reachable</span>
              </div>
            )}
          </div>

          {/* Room description */}
          <div style={{
            background:`linear-gradient(135deg,${thm.surface},${thm.boardBg})`,
            border:`1px solid ${thm.accent}33`,
            borderRadius:12,padding:"10px 14px",marginBottom:12,
            display:"flex",gap:10,alignItems:"flex-start",
          }}>
            <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{rooms[currentPlayer.roomIndex].icon}</span>
            <div>
              <div style={{fontFamily:"'Cinzel',serif",color:thm.accent,fontSize:9,letterSpacing:"3px",marginBottom:3}}>
                {rooms[currentPlayer.roomIndex].name.toUpperCase()}
              </div>
              <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",color:"#aaa",fontSize:13,lineHeight:1.6}}>
                {rooms[currentPlayer.roomIndex].desc}
              </div>
            </div>
          </div>

          {/* Players */}
          <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
            {game.players.map((p,i)=>{
              const isCurrent = i===game.currentPlayer;
              return (
                <div key={p.id} style={{
                  background: isCurrent?`${p.character.color}22`:thm.surface+"cc",
                  border:`1.5px solid ${isCurrent?p.character.color:thm.accent+"1a"}`,
                  borderRadius:10,padding:"7px 10px",
                  display:"flex",alignItems:"center",gap:7,
                  opacity:p.eliminated?0.35:1,
                  flexShrink:0,
                  boxShadow:isCurrent?`0 0 12px ${p.character.color}33`:"none",
                  transition:"all 0.2s",
                }}>
                  <CharacterToken character={p.character} size={26}/>
                  <div>
                    <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:isCurrent?p.character.color:"#999",letterSpacing:"0.5px"}}>{p.name}</div>
                    <div style={{fontFamily:"'Crimson Text',serif",fontSize:10,color:thm.muted,marginTop:1}}>
                      {p.eliminated?"eliminated":rooms[p.roomIndex].short}
                    </div>
                  </div>
                  {p.abilityUsed && !p.eliminated && (
                    <div style={{fontSize:9,color:thm.muted,opacity:0.6}} title="Ability used">⚡</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action panel */}
          {game.phase!=="end" && (
            <div style={{
              background:`linear-gradient(160deg,${thm.surface},${thm.boardBg})`,
              border:`1px solid ${thm.accent}33`,
              borderRadius:14,padding:"14px",marginBottom:12,
              boxShadow:`0 4px 20px #00000044, inset 0 1px 0 ${thm.accent}11`,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
                <div style={{fontFamily:"'Cinzel',serif",color:thm.accent,fontSize:11,letterSpacing:"3px"}}>
                  {currentPlayer.name.toUpperCase()}'S TURN
                </div>
                {game.diceCursed && (
                  <div style={{
                    background:"#e05c5c22",border:"1px solid #e05c5c",
                    borderRadius:6,padding:"3px 10px",
                    fontFamily:"'Cinzel',serif",fontSize:9,color:"#e05c5c",letterSpacing:"2px",
                    animation:"fadein 0.3s ease-out",
                  }}>🩸 CURSED ROLL</div>
                )}
              </div>
              
              {game.phase==="roll" && (
                <div style={{textAlign:"center"}}>
                  {/* Double roll chooser (Mustard's ability) */}
                  {doubleRollValues ? (
                    <div style={{animation:"fadein 0.3s ease-out"}}>
                      <div style={{fontFamily:"'Cinzel',serif",color:"#d4ac0d",fontSize:10,letterSpacing:"3px",marginBottom:12}}>
                        🪖 FORCED MARCH — choose your roll
                      </div>
                      <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:12}}>
                        {doubleRollValues.map((v,i)=>(
                          <div key={i} onClick={()=>{
                            const newGame={...game};
                            newGame.diceResult=v; newGame.movesLeft=v; newGame.phase="move";
                            // Decay blocked rooms as normal turn
                            const updatedBlocks={};
                            Object.entries(newGame.blockedRooms||{}).forEach(([ri,turns])=>{
                              if(turns-1>0) updatedBlocks[parseInt(ri)]=turns-1;
                            });
                            newGame.blockedRooms=updatedBlocks;
                            newGame.log=[`🪖 ${currentPlayer.name} chose ${v} from their double roll.`,...newGame.log.slice(0,14)];
                            setGame(newGame); setDoubleRollValues(null); setAbilityResult(null);
                          }} style={{
                            cursor:"pointer", padding:"8px",
                            border:`2px solid #d4ac0d`,borderRadius:10,
                            background:"#d4ac0d22",
                            transition:"all 0.15s",
                          }}>
                            <Dice value={v} rolling={false} accent="#d4ac0d"/>
                            <div style={{fontFamily:"'Cinzel',serif",color:"#d4ac0d",fontSize:18,marginTop:4}}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display:"inline-block",
                        animation: !rolling && game.diceResult ? "diceBounce 0.5s ease-out" : "none",
                        padding:"20px 0 16px",
                      }}>
                        <Dice value={game.diceResult} rolling={rolling} accent={thm.accent}/>
                      </div>
                      {!rolling && game.diceResult && (
                        <div style={{
                          fontFamily:"'Cinzel',serif",fontSize:28,
                          color:thm.accent,letterSpacing:"4px",marginBottom:4,
                          textShadow:`0 0 20px ${thm.accent}88`,
                          animation:"fadein 0.3s ease-out",
                        }}>{game.diceResult}</div>
                      )}
                      {rolling && (
                        <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",color:thm.muted,fontSize:13,marginBottom:4,animation:"fadein 0.2s ease-out"}}>rolling…</div>
                      )}
                      <button className="btn-hover" onClick={rollDice} disabled={rolling} style={{
                        marginTop:8,padding:"12px 40px",
                        background: rolling?"#222":`linear-gradient(135deg,${thm.accent}44,${thm.accent}22)`,
                        border:`1px solid ${rolling?thm.muted:thm.accent}`,
                        color: rolling?thm.muted:thm.accent,
                        borderRadius:10,fontFamily:"'Cinzel',serif",fontSize:13,
                        letterSpacing:"3px",cursor:rolling?"not-allowed":"pointer",transition:"all 0.15s",
                      }}>{rolling?"ROLLING…":game.diceResult?"ROLL AGAIN":"ROLL THE DICE"}</button>
                    </>
                  )}
                </div>
              )}
              
              {game.phase==="move" && (
                <div style={{textAlign:"center",color:thm.muted,fontFamily:"'Crimson Text',serif",fontStyle:"italic"}}>
                  Rolled a {game.diceResult}. Click a room on the board to move.
                </div>
              )}
              
              {game.phase==="suggest" && (
                <div>
                  {!showSuggestion && !showAccusation && !showAbility && (
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <button className="btn-hover" onClick={()=>setShowSuggestion(true)} style={{
                        flex:1,minWidth:100,padding:"11px 8px",
                        background:`${thm.accent}22`,border:`1px solid ${thm.accent}`,
                        color:thm.accent,borderRadius:10,fontFamily:"'Cinzel',serif",
                        fontSize:10,letterSpacing:"2px",cursor:"pointer",transition:"all 0.15s",
                      }}>🔍 SUGGEST</button>
                      <button className="btn-hover" onClick={()=>setShowAccusation(true)} style={{
                        flex:1,minWidth:100,padding:"11px 8px",
                        background:"#e05c5c22",border:"1px solid #e05c5c",
                        color:"#e05c5c",borderRadius:10,fontFamily:"'Cinzel',serif",
                        fontSize:10,letterSpacing:"2px",cursor:"pointer",transition:"all 0.15s",
                      }}>💀 ACCUSE</button>
                      {/* Ability button */}
                      {(() => {
                        const ab = currentPlayer.character?.ability;
                        const used = currentPlayer.abilityUsed;
                        if(!ab) return null;
                        return (
                          <button className="btn-hover"
                            onClick={()=>{ setAbilityResult(null); setShowAbility(true); }}
                            disabled={used}
                            style={{
                              flex:1,minWidth:100,padding:"11px 8px",
                              background:used?"#111":`${currentPlayer.character.color}22`,
                              border:`1px solid ${used?thm.muted+"44":currentPlayer.character.color}`,
                              color:used?thm.muted:currentPlayer.character.color,
                              borderRadius:10,fontFamily:"'Cinzel',serif",
                              fontSize:10,letterSpacing:"1px",
                              cursor:used?"not-allowed":"pointer",transition:"all 0.15s",
                              position:"relative",
                            }}
                          >
                            {ab.icon} {used ? "USED" : "ABILITY"}
                            {!used && <div style={{
                              position:"absolute",top:-4,right:-4,
                              width:8,height:8,borderRadius:"50%",
                              background:currentPlayer.character.color,
                              boxShadow:`0 0 6px ${currentPlayer.character.color}`,
                            }}/>}
                          </button>
                        );
                      })()}
                      <button className="btn-hover" onClick={skipSuggestion} style={{
                        flex:"0 0 auto",padding:"11px 14px",
                        background:"transparent",border:`1px solid ${thm.muted}44`,
                        color:thm.muted,borderRadius:10,fontFamily:"'Cinzel',serif",
                        fontSize:10,letterSpacing:"2px",cursor:"pointer",transition:"all 0.15s",
                      }}>⏭</button>
                    </div>
                  )}

                  {/* Ability panel */}
                  {showAbility && (() => {
                    const ab = currentPlayer.character?.ability;
                    const thm2 = thm;
                    const charColor = currentPlayer.character.color;

                    // Confession setup
                    if(abilityResult?.type==="confession_setup") return (
                      <div style={{animation:"fadein 0.2s ease-out"}}>
                        <div style={{fontFamily:"'Cinzel',serif",color:charColor,fontSize:10,letterSpacing:"2px",marginBottom:10}}>
                          🕊️ CONFESSION — ask a player about a card
                        </div>
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:10,color:thm.muted,fontFamily:"'Cinzel',serif",letterSpacing:"1px",marginBottom:5}}>ASK WHICH PLAYER</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {game.players.filter(p=>p.id!==currentPlayer.id && !p.eliminated && p.hand.length>0).map(p=>(
                              <button key={p.id} onClick={()=>setConfessionTarget(p.id)} style={{
                                padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:11,
                                background:confessionTarget===p.id?`${p.character.color}33`:`${p.character.color}11`,
                                border:`1px solid ${confessionTarget===p.id?p.character.color:p.character.color+"44"}`,
                                color:p.character.color,fontFamily:"'Crimson Text',serif",
                              }}>{p.character.icon} {p.name}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:thm.muted,fontFamily:"'Cinzel',serif",letterSpacing:"1px",marginBottom:5}}>ABOUT WHICH CARD</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {[
                              ...CHARACTERS.slice(0,game.players.length).map(c=>({key:c.id,label:c.fullName,color:"#a78bfa",icon:c.icon})),
                              ...THEMES[game.theme].rooms.map(r=>({key:r.id,label:r.name,color:thm.accent,icon:r.icon})),
                              ...THEMES[game.theme].weapons.map(w=>({key:w.id,label:w.name,color:"#e05c5c",icon:w.icon})),
                            ].map(({key,label,color,icon})=>(
                              <button key={key} onClick={()=>setConfessionCard(key)} style={{
                                padding:"4px 8px",borderRadius:6,cursor:"pointer",fontSize:10,
                                background:confessionCard===key?`${color}33`:`${color}11`,
                                border:`1px solid ${confessionCard===key?color:color+"44"}`,
                                color,fontFamily:"'Crimson Text',serif",
                              }}>{icon} {label}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{setShowAbility(false);setAbilityResult(null);setConfessionTarget(null);setConfessionCard(null);}} style={{
                            padding:"9px 16px",background:"transparent",border:`1px solid ${thm.muted}44`,
                            color:thm.muted,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10,
                          }}>CANCEL</button>
                          <button onClick={commitConfession} disabled={!confessionTarget||!confessionCard} style={{
                            flex:1,padding:"9px",fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:"2px",
                            background:(!confessionTarget||!confessionCard)?"#222":`${charColor}33`,
                            border:`1px solid ${(!confessionTarget||!confessionCard)?thm.muted:charColor}`,
                            color:(!confessionTarget||!confessionCard)?thm.muted:charColor,
                            borderRadius:8,cursor:(!confessionTarget||!confessionCard)?"not-allowed":"pointer",
                          }}>ASK</button>
                        </div>
                      </div>
                    );

                    // Confession result / peek result / poll result / unblock confirm
                    if(abilityResult?.type==="confession_result") return (
                      <div style={{animation:"fadein 0.2s ease-out",textAlign:"center",padding:"8px 0"}}>
                        <div style={{fontSize:32,marginBottom:8}}>{abilityResult.has?"✅":"❌"}</div>
                        <div style={{fontFamily:"'Crimson Text',serif",fontSize:15,color:"#ddd",marginBottom:4}}>
                          {abilityResult.targetName} {abilityResult.has ? "HOLDS" : "does NOT hold"} <strong style={{color:charColor}}>{abilityResult.cardName}</strong>
                        </div>
                        {abilityResult.has && <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",fontSize:12,color:thm.muted}}>Auto-crossed in your notebook.</div>}
                        <button onClick={()=>{setShowAbility(false);setAbilityResult(null);}} style={{marginTop:12,padding:"8px 24px",background:`${charColor}22`,border:`1px solid ${charColor}`,color:charColor,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:"2px"}}>DONE</button>
                      </div>
                    );

                    if(abilityResult?.type==="peek_hand") return (
                      <div style={{animation:"fadein 0.2s ease-out",textAlign:"center",padding:"8px 0"}}>
                        <div style={{fontFamily:"'Cinzel',serif",color:charColor,fontSize:10,letterSpacing:"3px",marginBottom:10}}>🔬 ACADEMIC INSIGHT</div>
                        <div style={{fontFamily:"'Crimson Text',serif",fontSize:14,color:"#ddd",marginBottom:4}}>
                          You secretly viewed a card from <strong>{abilityResult.targetName}</strong>:
                        </div>
                        <div style={{
                          display:"inline-block",background:`${charColor}22`,border:`2px solid ${charColor}`,
                          borderRadius:10,padding:"8px 20px",margin:"8px 0",
                          fontFamily:"'Crimson Text',serif",fontSize:16,color:charColor,fontWeight:700,
                        }}>{abilityResult.card?.icon||"🃏"} {abilityResult.card?.name}</div>
                        <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",fontSize:11,color:thm.muted,marginBottom:10}}>Auto-crossed in your notebook.</div>
                        <button onClick={()=>{setShowAbility(false);setAbilityResult(null);}} style={{padding:"8px 24px",background:`${charColor}22`,border:`1px solid ${charColor}`,color:charColor,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:"2px"}}>DONE</button>
                      </div>
                    );

                    if(abilityResult?.type==="room_poll") return (
                      <div style={{animation:"fadein 0.2s ease-out"}}>
                        <div style={{fontFamily:"'Cinzel',serif",color:charColor,fontSize:10,letterSpacing:"3px",marginBottom:10}}>🤝 SOCIAL CAPITAL — {abilityResult.roomName}</div>
                        {abilityResult.results.map(r=>(
                          <div key={r.name} style={{
                            display:"flex",alignItems:"center",gap:10,padding:"6px 0",
                            borderBottom:`1px solid ${thm.accent}11`,
                          }}>
                            <CharacterToken character={r.character} size={26}/>
                            <span style={{fontFamily:"'Crimson Text',serif",color:"#ddd",flex:1,fontSize:13}}>{r.name}</span>
                            <span style={{
                              fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:"1px",
                              color:r.has?"#4fd14a":"#e05c5c",
                              background:r.has?"#4fd14a22":"#e05c5c22",
                              border:`1px solid ${r.has?"#4fd14a":"#e05c5c"}44`,
                              borderRadius:5,padding:"2px 8px",
                            }}>{r.has?"HAS IT":"NO"}</span>
                          </div>
                        ))}
                        <button onClick={()=>{setShowAbility(false);setAbilityResult(null);}} style={{marginTop:10,padding:"8px 24px",background:`${charColor}22`,border:`1px solid ${charColor}`,color:charColor,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:"2px"}}>DONE</button>
                      </div>
                    );

                    if(abilityResult?.type==="unblock_room") return (
                      <div style={{animation:"fadein 0.2s ease-out",textAlign:"center",padding:"8px 0"}}>
                        <div style={{fontSize:28,marginBottom:8}}>🔓</div>
                        <div style={{fontFamily:"'Crimson Text',serif",fontSize:14,color:"#ddd",marginBottom:10}}>
                          {abilityResult.msg || `The ${abilityResult.roomName} has been unsealed. You've moved in.`}
                        </div>
                        <button onClick={()=>{setShowAbility(false);setAbilityResult(null);}} style={{padding:"8px 24px",background:`${charColor}22`,border:`1px solid ${charColor}`,color:charColor,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:"2px"}}>DONE</button>
                      </div>
                    );

                    // Default: ability info card
                    return (
                      <div style={{animation:"fadein 0.2s ease-out"}}>
                        <div style={{
                          display:"flex",alignItems:"center",gap:10,marginBottom:12,
                          background:`${charColor}11`,borderRadius:8,padding:"10px 12px",
                          border:`1px solid ${charColor}33`,
                        }}>
                          <div style={{width:44,height:54,borderRadius:8,overflow:"hidden",flexShrink:0,border:`2px solid ${charColor}`}}>
                            {CHARACTER_IMAGES[currentPlayer.character.id]&&<img src={CHARACTER_IMAGES[currentPlayer.character.id]} alt="" style={{width:"100%",height:"155%",objectFit:"cover",objectPosition:"center 5%"}}/>}
                          </div>
                          <div>
                            <div style={{fontFamily:"'Cinzel',serif",color:charColor,fontSize:11,letterSpacing:"2px",marginBottom:3}}>{ab.icon} {ab.name}</div>
                            <div style={{fontFamily:"'Crimson Text',serif",fontSize:12,color:"#ccc",lineHeight:1.5,marginBottom:3}}>{ab.desc}</div>
                            <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",fontSize:11,color:thm.muted}}>{ab.flavour}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>{setShowAbility(false);setAbilityResult(null);}} style={{padding:"9px 16px",background:"transparent",border:`1px solid ${thm.muted}44`,color:thm.muted,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10}}>CANCEL</button>
                          <button onClick={useAbility} style={{flex:1,padding:"9px",background:`${charColor}33`,border:`1px solid ${charColor}`,color:charColor,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:"2px"}}>USE ABILITY</button>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Suggestion panel */}
                  {showSuggestion && (
                    <div style={{animation:"fadein 0.2s ease-out"}}>
                      {/* Scarlet ability: allow any-room suggestion */}
                      {currentPlayer.character.id==="scarlet" && currentPlayer.abilityUsed && (
                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:"#c0392b",fontFamily:"'Cinzel',serif",letterSpacing:"1px",marginBottom:5}}>🎭 LEADING ROLE — CHOOSE ROOM</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                            {rooms.map((r,ri)=>(
                              <button key={r.id} onClick={()=>setAbilitySuggRoom(ri)} style={{
                                padding:"4px 8px",borderRadius:6,cursor:"pointer",fontSize:10,
                                background:abilitySuggRoom===ri?"#c0392b33":"#c0392b11",
                                border:`1px solid ${abilitySuggRoom===ri?"#c0392b":"#c0392b44"}`,
                                color:"#c0392b",fontFamily:"'Crimson Text',serif",
                              }}>{r.icon} {r.short}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{fontFamily:"'Cinzel',serif",color:thm.accent,fontSize:11,letterSpacing:"2px",marginBottom:12}}>
                        MAKE A SUGGESTION — in the {rooms[abilitySuggRoom!==null&&abilitySuggRoom!==undefined?abilitySuggRoom:currentPlayer.roomIndex].name}
                      </div>
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:11,color:thm.muted,marginBottom:6,fontFamily:"'Cinzel',serif",letterSpacing:"1px"}}>SUSPECT</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                          {CHARACTERS.slice(0,game.players.length).map(c=>(
                            <button key={c.id} onClick={()=>setSuggSuspect(c.id)} style={{
                              padding:"0",borderRadius:10,cursor:"pointer",overflow:"hidden",
                              background:"transparent",border:`2px solid ${suggSuspect===c.id?c.color:c.color+"44"}`,
                              transform:suggSuspect===c.id?"scale(1.08)":"scale(1)",
                              transition:"all 0.15s",width:60,
                            }}>
                              <div style={{height:70,overflow:"hidden",position:"relative",background:`${c.color}22`}}>
                                {CHARACTER_IMAGES[c.id]&&<img src={CHARACTER_IMAGES[c.id]} alt={c.fullName} style={{width:"100%",height:"155%",objectFit:"cover",objectPosition:"center 5%"}}/>}
                                <div style={{position:"absolute",bottom:0,left:0,right:0,background:`linear-gradient(transparent,${c.color}cc)`,padding:"8px 2px 3px"}}>
                                  <div style={{fontFamily:"'Cinzel',serif",fontSize:7,color:"#fff",textAlign:"center",textShadow:"0 1px 3px #000",lineHeight:1.2}}>{c.name}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:thm.muted,marginBottom:6,fontFamily:"'Cinzel',serif",letterSpacing:"1px"}}>WEAPON</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                          {weapons.map(w=>(
                            <button key={w.id} onClick={()=>setSuggWeapon(w.id)} style={{
                              padding:0,borderRadius:10,cursor:"pointer",overflow:"hidden",
                              background:"transparent",
                              border:`2px solid ${suggWeapon===w.id?"#e05c5c":"#e05c5c44"}`,
                              transform:suggWeapon===w.id?"scale(1.08)":"scale(1)",
                              transition:"all 0.15s", width:60,
                            }}>
                              <div style={{height:70,overflow:"hidden",position:"relative",background:"#1a0a0a"}}>
                                {w.img&&WEAPON_IMAGES[w.img]&&<img src={WEAPON_IMAGES[w.img]} alt={w.name} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 30%"}}/>}
                                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,#c0000099)",padding:"8px 2px 3px"}}>
                                  <div style={{fontFamily:"'Cinzel',serif",fontSize:6,color:"#fff",textAlign:"center",textShadow:"0 1px 3px #000",lineHeight:1.2,padding:"0 2px"}}>{w.name}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>{setShowSuggestion(false);setSuggWeapon(null);setSuggSuspect(null);}} style={{
                          padding:"10px 20px",background:"transparent",border:`1px solid ${thm.muted}44`,
                          color:thm.muted,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:11,
                        }}>CANCEL</button>
                        <button onClick={makeSuggestion} disabled={!suggWeapon||!suggSuspect} style={{
                          flex:1,padding:"10px",
                          background:(!suggWeapon||!suggSuspect)?"#333":`${thm.accent}33`,
                          border:`1px solid ${(!suggWeapon||!suggSuspect)?thm.muted:thm.accent}`,
                          color:(!suggWeapon||!suggSuspect)?thm.muted:thm.accent,
                          borderRadius:8,cursor:(!suggWeapon||!suggSuspect)?"not-allowed":"pointer",
                          fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:"2px",
                        }}>SUBMIT SUGGESTION</button>
                      </div>
                    </div>
                  )}
                  
                  {/* Accusation panel */}
                  {showAccusation && (
                    <div style={{animation:"fadein 0.2s ease-out"}}>
                      <div style={{fontFamily:"'Cinzel',serif",color:"#e05c5c",fontSize:11,letterSpacing:"2px",marginBottom:4}}>
                        ⚠️ FINAL ACCUSATION — This cannot be undone!
                      </div>
                      <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",color:thm.muted,fontSize:13,marginBottom:12}}>
                        A wrong accusation eliminates you from the game.
                      </div>
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:11,color:thm.muted,marginBottom:6,fontFamily:"'Cinzel',serif",letterSpacing:"1px"}}>ROOM</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {rooms.map(r=>(
                            <button key={r.id} onClick={()=>setAccusRoom(r.id)} style={{
                              padding:"6px 10px",borderRadius:8,cursor:"pointer",
                              background:accusRoom===r.id?`${thm.accent}33`:`${thm.accent}11`,
                              border:`1px solid ${accusRoom===r.id?thm.accent:thm.accent+"44"}`,
                              color:thm.accent,fontSize:12,fontFamily:"'Crimson Text',serif",
                            }}>{r.icon} {r.short}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:11,color:thm.muted,marginBottom:6,fontFamily:"'Cinzel',serif",letterSpacing:"1px"}}>SUSPECT</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                          {CHARACTERS.slice(0,game.players.length).map(c=>(
                            <button key={c.id} onClick={()=>setAccusSuspect(c.id)} style={{
                              padding:"0",borderRadius:10,cursor:"pointer",overflow:"hidden",
                              background:"transparent",border:`2px solid ${accusSuspect===c.id?c.color:c.color+"44"}`,
                              transform:accusSuspect===c.id?"scale(1.08)":"scale(1)",
                              transition:"all 0.15s",width:60,
                            }}>
                              <div style={{height:70,overflow:"hidden",position:"relative",background:`${c.color}22`}}>
                                {CHARACTER_IMAGES[c.id]&&<img src={CHARACTER_IMAGES[c.id]} alt={c.fullName} style={{width:"100%",height:"155%",objectFit:"cover",objectPosition:"center 5%"}}/>}
                                <div style={{position:"absolute",bottom:0,left:0,right:0,background:`linear-gradient(transparent,${c.color}cc)`,padding:"8px 2px 3px"}}>
                                  <div style={{fontFamily:"'Cinzel',serif",fontSize:7,color:"#fff",textAlign:"center",textShadow:"0 1px 3px #000",lineHeight:1.2}}>{c.name}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:thm.muted,marginBottom:6,fontFamily:"'Cinzel',serif",letterSpacing:"1px"}}>WEAPON</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                          {weapons.map(w=>(
                            <button key={w.id} onClick={()=>setAccusWeapon(w.id)} style={{
                              padding:0,borderRadius:10,cursor:"pointer",overflow:"hidden",
                              background:"transparent",
                              border:`2px solid ${accusWeapon===w.id?"#e05c5c":"#e05c5c44"}`,
                              transform:accusWeapon===w.id?"scale(1.08)":"scale(1)",
                              transition:"all 0.15s", width:60,
                            }}>
                              <div style={{height:70,overflow:"hidden",position:"relative",background:"#1a0a0a"}}>
                                {w.img&&WEAPON_IMAGES[w.img]&&<img src={WEAPON_IMAGES[w.img]} alt={w.name} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 30%"}}/>}
                                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,#c0000099)",padding:"8px 2px 3px"}}>
                                  <div style={{fontFamily:"'Cinzel',serif",fontSize:6,color:"#fff",textAlign:"center",textShadow:"0 1px 3px #000",lineHeight:1.2,padding:"0 2px"}}>{w.name}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Motive peek for selected suspect */}
                      {accusSuspect && (() => {
                        const ch = CHARACTERS.find(c=>c.id===accusSuspect);
                        const mv = thm.motives?.[accusSuspect];
                        if(!ch||!mv) return null;
                        return (
                          <div style={{
                            background:`${ch.color}11`,border:`1px solid ${ch.color}33`,
                            borderRadius:8,padding:"8px 12px",marginBottom:12,
                            animation:"fadein 0.2s ease-out",
                          }}>
                            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                              <div style={{width:36,height:44,borderRadius:6,overflow:"hidden",flexShrink:0,border:`1px solid ${ch.color}66`}}>
                                {CHARACTER_IMAGES[ch.id] && <img src={CHARACTER_IMAGES[ch.id]} alt="" style={{width:"100%",height:"160%",objectFit:"cover",objectPosition:"center 5%"}}/>}
                              </div>
                              <div>
                                <div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:ch.color,letterSpacing:"1px",marginBottom:3}}>{ch.fullName}</div>
                                <div style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",fontSize:11,color:"#bbb",lineHeight:1.5}}>{mv.motive.slice(0,120)}…</div>
                                <div style={{marginTop:4,fontFamily:"'Crimson Text',serif",fontSize:10,color:"#888"}}>Alibi: {mv.alibi.slice(0,80)}…</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>{setShowAccusation(false);setAccusRoom(null);setAccusWeapon(null);setAccusSuspect(null);}} style={{
                          padding:"10px 20px",background:"transparent",border:`1px solid ${thm.muted}44`,
                          color:thm.muted,borderRadius:8,cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:11,
                        }}>CANCEL</button>
                        <button onClick={makeAccusation} disabled={!accusRoom||!accusWeapon||!accusSuspect} style={{
                          flex:1,padding:"10px",
                          background:(!accusRoom||!accusWeapon||!accusSuspect)?"#333":"#e05c5c33",
                          border:`1px solid ${(!accusRoom||!accusWeapon||!accusSuspect)?thm.muted:"#e05c5c"}`,
                          color:(!accusRoom||!accusWeapon||!accusSuspect)?thm.muted:"#e05c5c",
                          borderRadius:8,cursor:(!accusRoom||!accusWeapon||!accusSuspect)?"not-allowed":"pointer",
                          fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:"2px",
                        }}>MAKE ACCUSATION</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Event log */}
          <div style={{
            background:thm.surface+"99",
            border:`1px solid ${thm.accent}1a`,
            borderRadius:12,padding:"12px 14px",
            backdropFilter:"blur(4px)",
          }}>
            <div style={{
              display:"flex",alignItems:"center",gap:8,marginBottom:8,
            }}>
              <div style={{fontFamily:"'Cinzel',serif",color:thm.muted,fontSize:9,letterSpacing:"3px"}}>CASE LOG</div>
              <div style={{flex:1,height:1,background:`${thm.accent}18`}}/>
            </div>
            <div style={{maxHeight:140,overflowY:"auto"}}>
              {game.log.filter(Boolean).map((entry,i)=>(
                <div key={i} style={{
                  fontFamily:"'Crimson Text',serif",
                  fontSize:12,
                  color:i===0?"#d4c8b8":i===1?"#888":"#555",
                  padding:"4px 0",
                  borderBottom:i<game.log.length-1?`1px solid ${thm.accent}0d`:"none",
                  lineHeight:1.55,
                  display:"flex",gap:6,alignItems:"flex-start",
                }}>
                  <span style={{opacity:i===0?0.8:0.3,fontSize:10,marginTop:2,flexShrink:0}}>▸</span>
                  {entry}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return null;
}
