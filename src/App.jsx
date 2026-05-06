import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { 
  Settings, 
  Send, 
  Volume2, 
  Cpu, 
  Cloud, 
  Sparkles, 
  Camera, 
  X, 
  Mic, 
  Clock,
  ChevronRight,
  Database
} from 'lucide-react';
import './App.css';

// =========================================================================
// 🎭 VTuber-Grade Modular Animation Engine (VrmAnimationEngine)
// =========================================================================
class VrmAnimationEngine {
  constructor(vrm) {
    this.vrm = vrm;
    this.currentState = "idle";
    this.stateTime = 0;

    this.activeGesture = null;
    this.gestureTime = 0;

    this.mood = {
      relaxed: 0.15,
      happy: 0,
      surprised: 0
    };

    // Keep track of the initial position of hips to prevent bone drifting
    const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
    this.initialHipsY = hips ? hips.position.y : 0;
    this.initialHipsX = hips ? hips.position.x : 0;

    // Natural Blinking State
    this.blinkTimer = 0;
    this.nextBlinkDuration = 3.0;
    this.isBlinking = false;
    this.blinkRatio = 0;
  }

  setState(newState) {
    this.currentState = newState;
    this.stateTime = 0;
  }

  triggerGesture(name) {
    this.activeGesture = name;
    this.gestureTime = 0;
  }

  update(delta, elapsed, mouse, isSpeaking) {
    this.stateTime += delta;

    this.applyBaseIdle(delta, elapsed);
    this.applyState(delta, elapsed, mouse, isSpeaking);
    this.applyGesture(delta, elapsed);
    this.applyMood(delta, elapsed, isSpeaking);
  }

  // ---------------- 1. BASE IDLE LAYER (Continuous Sways) ----------------
  applyBaseIdle(delta, elapsed) {
    const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
    const spine = this.vrm.humanoid.getNormalizedBoneNode('spine');
    const chest = this.vrm.humanoid.getNormalizedBoneNode('chest');

    // Float whole hips slightly for organic circular bobbing
    if (hips) {
      hips.position.y = this.initialHipsY + Math.sin(elapsed * 1.5) * 0.005;
      hips.position.x = this.initialHipsX + Math.cos(elapsed * 0.75) * 0.0025;
      hips.rotation.y = Math.sin(elapsed * 0.4) * 0.04;
    }

    if (spine) {
      spine.rotation.y = Math.sin(elapsed * 0.35) * 0.022;
      spine.rotation.z = Math.cos(elapsed * 0.4) * 0.012;
    }

    if (chest) {
      chest.rotation.x = Math.sin(elapsed * 1.8) * 0.014;
      chest.rotation.y = Math.cos(elapsed * 1.3) * 0.004;
    }

    // Default arm relaxing interpolations (hangs naturally down instead of a rigid T-Pose!)
    const leftUpperArm = this.vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = this.vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm');

    let targetLeftUpperZ = 1.25;
    let targetLeftUpperY = 0.15;
    let targetRightUpperZ = -1.25;
    let targetRightUpperY = -0.15;
    let targetLeftLowerY = -0.25;
    let targetRightLowerY = 0.25;

    // Only apply the relaxed posture interpolation when NO gesture is currently driving the arms!
    if (!this.activeGesture) {
      const breathSway = Math.sin(elapsed * 1.5) * 0.02;
      if (leftUpperArm) {
        leftUpperArm.rotation.z = THREE.MathUtils.lerp(leftUpperArm.rotation.z, targetLeftUpperZ + breathSway, delta * 3.5);
        leftUpperArm.rotation.y = THREE.MathUtils.lerp(leftUpperArm.rotation.y, targetLeftUpperY, delta * 3.5);
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z = THREE.MathUtils.lerp(rightUpperArm.rotation.z, targetRightUpperZ - breathSway, delta * 3.5);
        rightUpperArm.rotation.y = THREE.MathUtils.lerp(rightUpperArm.rotation.y, targetRightUpperY, delta * 3.5);
      }
      if (leftLowerArm) {
        leftLowerArm.rotation.y = THREE.MathUtils.lerp(leftLowerArm.rotation.y, targetLeftLowerY, delta * 3.5);
      }
      if (rightLowerArm) {
        rightLowerArm.rotation.y = THREE.MathUtils.lerp(rightLowerArm.rotation.y, targetRightLowerY, delta * 3.5);
      }
    }
  }

  // ---------------- 2. STATE LAYER (Conscious Behaviors) ----------------
  applyState(delta, elapsed, mouse, isSpeaking) {
    const head = this.vrm.humanoid.getNormalizedBoneNode('head');
    const neck = this.vrm.humanoid.getNormalizedBoneNode('neck');

    // Blend cursor target coordinates with minor random eye/focus jitters (saccades)
    const saccadeX = Math.sin(elapsed * 0.65) * 0.12;
    const saccadeY = Math.cos(elapsed * 0.42) * 0.07;

    const finalX = mouse.x * 0.35 + saccadeX * 0.12;
    const finalY = mouse.y * 0.20 + saccadeY * 0.08;

    if (neck) {
      neck.rotation.y += (finalX * 0.35 - neck.rotation.y) * 0.06;
      neck.rotation.x += (-finalY * 0.35 - neck.rotation.x) * 0.06;
    }

    if (head) {
      head.rotation.y += (finalX * 0.65 - head.rotation.y) * 0.06;
      head.rotation.x += (-finalY * 0.65 - head.rotation.x) * 0.06;
      
      // Calculate dynamic lateral neck/head tilts based on current state
      let targetTilt = Math.sin(elapsed * 0.8) * 0.04;
      if (this.currentState === "thinking") {
        targetTilt += 0.08;
      } else if (this.currentState === "shy") {
        targetTilt -= 0.06;
      }
      head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetTilt, delta * 3.0);
    }

    // Dynamic blend targets for facial expressions
    let targetHappy = 0.0;
    let targetRelaxed = 0.05;

    switch (this.currentState) {
      case "talking":
        targetHappy = 0.18 + Math.sin(elapsed * 2.5) * 0.07;
        targetRelaxed = 0.1;
        break;

      case "shy":
        if (head) {
          head.rotation.x += 0.08;
          head.rotation.y += 0.05;
        }
        targetRelaxed = 0.45 + Math.sin(elapsed * 0.5) * 0.1;
        break;

      case "thinking":
        if (head) {
          head.rotation.y += Math.sin(elapsed * 0.6) * 0.1;
        }
        targetRelaxed = 0.3 + Math.sin(elapsed * 0.4) * 0.1;
        break;

      default: // idle
        targetRelaxed = 0.15 + Math.sin(elapsed * 0.3) * 0.05;
    }

    this.mood.happy = THREE.MathUtils.lerp(this.mood.happy, targetHappy, delta * 3.0);
    this.mood.relaxed = THREE.MathUtils.lerp(this.mood.relaxed, targetRelaxed, delta * 3.0);

    // Auto-state switching driven by voice speaking lifecycle
    if (isSpeaking && this.currentState !== "talking") {
      this.setState("talking");
    } else if (!isSpeaking && this.currentState === "talking") {
      this.setState("idle");
    }
  }

  // ---------------- 3. GESTURE LAYER (Temporary Limb Actions) ----------------
  applyGesture(delta, elapsed) {
    if (!this.activeGesture) return;

    this.gestureTime += delta;

    const rightUpperArm = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftUpperArm = this.vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightLowerArm = this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
    const leftLowerArm = this.vrm.humanoid.getNormalizedBoneNode('leftLowerArm');

    if (this.activeGesture === "greet") {
      // Wave hand greeting pose
      const targetZ = -0.65;
      const targetY = -0.32;
      const targetLowerY = 0.85 + Math.sin(elapsed * 12.0) * 0.1; // Waving oscillation

      if (rightUpperArm) {
        rightUpperArm.rotation.z = THREE.MathUtils.lerp(rightUpperArm.rotation.z, targetZ, delta * 4.0);
        rightUpperArm.rotation.y = THREE.MathUtils.lerp(rightUpperArm.rotation.y, targetY, delta * 4.0);
      }
      if (rightLowerArm) {
        rightLowerArm.rotation.y = THREE.MathUtils.lerp(rightLowerArm.rotation.y, targetLowerY, delta * 4.0);
      }

      // Ends and relaxes after 1.8 seconds
      if (this.gestureTime > 1.8) {
        this.activeGesture = null;
      }
    }

    if (this.activeGesture === "shy") {
      // Finger-fiddling timid posture
      const targetZ = 0.95;
      const targetY = 0.35;
      const targetLowerY = -0.45;

      if (leftUpperArm) {
        leftUpperArm.rotation.z = THREE.MathUtils.lerp(leftUpperArm.rotation.z, targetZ, delta * 4.0);
        leftUpperArm.rotation.y = THREE.MathUtils.lerp(leftUpperArm.rotation.y, targetY, delta * 4.0);
      }
      if (leftLowerArm) {
        leftLowerArm.rotation.y = THREE.MathUtils.lerp(leftLowerArm.rotation.y, targetLowerY, delta * 4.0);
      }

      // Ends and relaxes after 2.0 seconds
      if (this.gestureTime > 2.0) {
        this.activeGesture = null;
      }
    }
  }

  // ---------------- 4. EXPRESSION LAYER (Lip-Sync and Natural Blinking) ----------------
  applyMood(delta, elapsed, isSpeaking) {
    const exp = this.vrm.expressionManager;

    exp.setValue("relaxed", this.mood.relaxed);
    exp.setValue("happy", this.mood.happy);

    // Natural humanized blinking loop
    this.blinkTimer += delta;
    if (this.blinkTimer >= this.nextBlinkDuration && !this.isBlinking) {
      this.isBlinking = true;
      this.blinkTimer = 0;
      this.blinkRatio = 0;
    }

    if (this.isBlinking) {
      this.blinkRatio += delta * 12.0;
      if (this.blinkRatio < 1.0) {
        exp.setValue('blink', this.blinkRatio);
      } else if (this.blinkRatio < 2.0) {
        exp.setValue('blink', 2.0 - this.blinkRatio);
      } else {
        exp.setValue('blink', 0);
        this.isBlinking = false;
        this.nextBlinkDuration = 2.0 + Math.random() * 4.0;
      }
    }

    // Zero-latency procedurally simulated mouth lip-sync
    if (isSpeaking) {
      const talkCycle = Math.sin(elapsed * 18.0) * 0.5 + 0.5;
      const mouthOpen = talkCycle * 0.65;
      exp.setValue('aa', mouthOpen);
      exp.setValue('ih', (1.0 - talkCycle) * 0.12);
    } else {
      const currentAA = exp.getValue('aa') || 0;
      if (currentAA > 0) {
        exp.setValue('aa', Math.max(0, currentAA - delta * 5.0));
      }
      exp.setValue('ih', 0);
    }
  }
}

// =========================================================================
// ⚛️ React Main Application (App)
// =========================================================================
export default function App() {
  // UI & State Management
  const [messages, setMessages] = useState([
    { 
      sender: 'assistant', 
      text: '我がクロノス・ネクサスへようこそ。私は時を司る案内者、クロノスと申します。何について語り合いましょうか？',
      translation: 'Bienvenido a nuestro Chronos Nexus. Soy Chronos, el guía que rige el tiempo. ¿De qué hablaremos?' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [vrmLoaded, setVrmLoaded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // App Configurations (Saved in LocalStorage)
  const [engine, setEngine] = useState(() => localStorage.getItem('chrono_engine') || 'gemini');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('chrono_gemini_key') || '');
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('chrono_ollama_url') || 'http://localhost:11434');
  const [voiceVolume, setVoiceVolume] = useState(() => Number(localStorage.getItem('chrono_volume')) || 0.8);
  const [voiceRate, setVoiceRate] = useState(() => Number(localStorage.getItem('chrono_rate')) || 1.0);
  const [voicePitch, setVoicePitch] = useState(() => Number(localStorage.getItem('chrono_pitch')) || 1.05);
  const [orbitControlsEnabled, setOrbitControlsEnabled] = useState(() => localStorage.getItem('chrono_orbit_controls') === 'true');

  // Purge any corrupted position keys from localStorage on mount
  useEffect(() => {
    localStorage.removeItem('chrono_vrm_pos_x');
    localStorage.removeItem('chrono_vrm_pos_y');
    localStorage.removeItem('chrono_vrm_pos_z');
    localStorage.removeItem('chrono_vrm_scale');
  }, []);

  // Hardcoded cinematographic defaults for perfect framing centered positioning
  const vrmPosX = 0.0;
  const vrmPosY = -1.38;
  const vrmPosZ = 0.0;
  const vrmScale = 1.15;

  // WebGL & 3D Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const vrmRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // Interaction & Animation Engine Refs
  const mouseCoordsRef = useRef({ x: 0, y: 0 });
  const animationEngineRef = useRef(null);

  // Audio / Voice Refs
  const speechUtteranceRef = useRef(null);
  const currentSpeakingVolumeRef = useRef(0);

  // Sync state reference to prevent stale closures inside requestAnimationFrame
  const isSpeakingRef = useRef(false);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);


  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('chrono_engine', engine);
    localStorage.setItem('chrono_gemini_key', geminiKey);
    localStorage.setItem('chrono_ollama_url', ollamaUrl);
    localStorage.setItem('chrono_volume', voiceVolume.toString());
    localStorage.setItem('chrono_rate', voiceRate.toString());
    localStorage.setItem('chrono_pitch', voicePitch.toString());
    localStorage.setItem('chrono_orbit_controls', orbitControlsEnabled.toString());

    if (vrmRef.current) {
      vrmRef.current.scene.position.set(vrmPosX, vrmPosY, vrmPosZ);
      vrmRef.current.scene.scale.set(vrmScale, vrmScale, vrmScale);
    }

    if (controlsRef.current) {
      controlsRef.current.enabled = orbitControlsEnabled;
      if (!orbitControlsEnabled) {
        resetCameraToCinematic();
      }
    }
  }, [
    engine, 
    geminiKey, 
    ollamaUrl, 
    voiceVolume, 
    voiceRate, 
    voicePitch, 
    orbitControlsEnabled
  ]);

  // Reset Camera to focus on the facial framing center of the VRM
  const resetCameraToCinematic = () => {
    if (cameraRef.current && controlsRef.current) {
      controlsRef.current.target.set(vrmPosX, 1.45 + vrmPosY, vrmPosZ);
      cameraRef.current.position.set(vrmPosX, 1.48 + vrmPosY, 0.75 + vrmPosZ);
      controlsRef.current.update();
    }
  };

  // Initialize Three.js Scene and Load VRM Model
  useEffect(() => {
    if (!canvasRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(
      35,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      20.0
    );
    camera.position.set(0, 1.45, 0.8);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.3;
    controls.maxDistance = 3.0;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 1.8;
    controls.target.set(vrmPosX, 1.45 + vrmPosY, vrmPosZ);
    controls.enabled = orbitControlsEnabled;
    controlsRef.current = controls;

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xff002b, 1.5);
    mainLight.position.set(-1.5, 3.0, 1.5);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xdfb438, 1.8);
    rimLight.position.set(1.5, 2.0, -1.5);
    scene.add(rimLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.6);
    frontLight.position.set(0, 1.5, 1.5);
    scene.add(frontLight);

    // GLTF LOADER WITH VRM PLUGIN
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      '/5834554318258545116.vrm',
      (gltf) => {
        const vrm = gltf.userData.vrm;
        vrmRef.current = vrm;
        scene.add(vrm.scene);

        // Standard orientation fix
        VRMUtils.rotateVRM0(vrm);

        // Apply initial positions
        vrm.scene.position.set(vrmPosX, vrmPosY, vrmPosZ);
        vrm.scene.scale.set(vrmScale, vrmScale, vrmScale);

        // Face front
        vrm.scene.rotation.y = Math.PI;

        // Initialize our modular VTuber Animation Engine!
        animationEngineRef.current = new VrmAnimationEngine(vrm);

        setVrmLoaded(true);
        resetCameraToCinematic();
      },
      (xhr) => {
        const progress = Math.round((xhr.loaded / xhr.total) * 100);
        setLoadProgress(progress);
      },
      (error) => {
        console.error('Error loading VRM model:', error);
      }
    );

    // Track cursor movement coordinates
    const handleMouseMove = (event) => {
      mouseCoordsRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseCoordsRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation loops (Using RAF timestamp)
    let lastTime = 0;

    const animate = (time) => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const elapsed = time ? time * 0.001 : 0;
      const delta = Math.min(elapsed - lastTime, 0.1);
      lastTime = elapsed;

      // Update modular VTuber Animation Engine!
      if (vrmRef.current && animationEngineRef.current) {
        animationEngineRef.current.update(
          delta,
          elapsed,
          mouseCoordsRef.current,
          isSpeakingRef.current
        );

        vrmRef.current.update(delta);

        // Procedural autonomous gestures cycle (VTuber Random Life)
        if (Math.random() < 0.0012) {
          const gestures = ["greet", "shy"];
          const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
          animationEngineRef.current.triggerGesture(randomGesture);
        }
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    // Trigger first animation frame
    requestAnimationFrame((t) => {
      lastTime = t * 0.001;
      animate(t);
    });

    // AUTO-RESIZE
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(width, height);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    // CLEANUP
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameIdRef.current);

      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        VRMUtils.deepDispose(vrmRef.current.scene);
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Synthesize Speech and trigger Lip-Sync
  const speakText = (text) => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    currentSpeakingVolumeRef.current = 0;

    if (!text) return;

    const speechText = text.replace(/\([\s\S]*?\)/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(speechText);
    speechUtteranceRef.current = utterance;

    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find(voice => voice.lang.startsWith('ja') || voice.lang.includes('JP'));
    
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }

    utterance.volume = voiceVolume;
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;

    utterance.onstart = () => {
      setIsSpeaking(true);
      currentSpeakingVolumeRef.current = 1.0;
    };

    utterance.onboundary = () => {
      currentSpeakingVolumeRef.current = 0.8 + Math.random() * 0.2;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      currentSpeakingVolumeRef.current = 0;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      currentSpeakingVolumeRef.current = 0;
    };

    window.speechSynthesis.speak(utterance);
  };

  // Send Message to AI (Gemini or Ollama)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Trigger state transition: AI is "thinking" about the prompt
    animationEngineRef.current?.setState("thinking");

    // Add user message to history
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);

    try {
      let aiResponseText = '';

      if (engine === 'gemini') {
        if (!geminiKey) {
          throw new Error('Por favor, ingresa tu API Key de Gemini en el panel de configuración.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ 
                  text: `Eres Chronos (クロノス), un asistente holográfico gótico-digital altamente sofisticado que rige el tiempo. Hablas con gracia, de forma enigmática, seductora y muy educada. 
                  Responde EXCLUSIVAMENTE en japonés fluido (Katakana, Hiragana, Kanji). 
                  Tus respuestas deben ser ultra-cortas (máximo 1 o 2 frases simples) ya que serán reproducidas por un sintetizador de voz. 
                  Termina siempre con terminaciones formales y elegantes (です, ます, でしょう, etcétera).
                  
                  Historial de chat para contexto:
                  ${messages.slice(-6).map(m => `${m.sender}: ${m.text}`).join('\n')}
                  Usuario actual dice: "${userMessage}"` 
                }]
              }
            ],
            generationConfig: {
              maxOutputTokens: 150,
              temperature: 0.85
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || 'Error al conectar con la API de Gemini');
        }

        const data = await response.json();
        aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      } else {
        // OLLAMA
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3',
            system: "You are Chronos (クロノス), an elegant gothic-digital cyber-assistant. Speak exclusively in highly polite, mystical Japanese. Keep replies extremely short (1-2 sentences max). Always end with formal suffixes (です, ます, でしょう). Do not speak any English or Spanish.",
            prompt: userMessage,
            stream: false
          })
        });

        if (!response.ok) {
          throw new Error('No se pudo conectar al servidor Ollama. Asegúrate de tener Ollama activo en local.');
        }

        const data = await response.json();
        aiResponseText = data.response || '';
      }

      aiResponseText = aiResponseText.trim();
      let translation = 'Respuesta en japonés sintetizada.';

      // Trigger state transition: AI is "talking" (this is also auto-driven by TTS isSpeaking hook)
      animationEngineRef.current?.setState("talking");

      // Add AI response to history
      setMessages(prev => [...prev, { sender: 'assistant', text: aiResponseText, translation }]);

      // Trigger TTS and Lipsync
      speakText(aiResponseText);

    } catch (err) {
      console.error(err);
      animationEngineRef.current?.setState("idle");
      setMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: `エラーが発生しました: ${err.message}`, 
        translation: `Ocurrió un error: ${err.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice Recognition Fallback
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no admite reconocimiento de voz. Te recomiendo usar Google Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsLoading(true);
      setInputValue('🎤 聴いています... (Escuchando...)');
    };

    recognition.onerror = () => {
      setIsLoading(false);
      setInputValue('');
    };

    recognition.onend = () => {
      setIsLoading(false);
    };

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setInputValue(speechToText);
    };

    recognition.start();
  };

  return (
    <div className="nexus-container">
      {/* Background aesthetics */}
      <div className="cyber-bg" />
      <div className="cyber-grid" />
      <div className="scanline" />

      {/* 3D Canvas Box */}
      <div ref={containerRef} className="cyber-canvas-container">
        <canvas ref={canvasRef} />
      </div>

      {/* Model Loading Screen Overlay */}
      {!vrmLoaded && (
        <div className="loading-overlay">
          <Clock className="spinner-icon" />
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--crimson-neon)', letterSpacing: '0.2em', fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            CHRONOS NEXUS
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
            Iniciando Holograma VRM...
          </p>
          <div className="loading-progress-bar">
            <div 
              className="loading-progress-fill"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)', fontFamily: 'monospace', marginTop: '0.5rem' }}>{loadProgress}%</span>
        </div>
      )}

      {/* HUD Layer Overlay */}
      <div className="hud-overlay">
        
        {/* TOP HEADER ROW */}
        <header className="top-header">
          <div className="system-logo-group">
            <div className="logo-icon-wrapper">
              <Clock className="neon-text-gold" style={{ width: '1.75rem', height: '1.75rem' }} />
            </div>
            <div className="system-titles">
              <h1>CHRONOS <span>NEXUS</span></h1>
              <div className="system-status">
                <span className="status-dot" />
                VIRTUAL COMPANION ACTIVE
              </div>
            </div>
          </div>

          <button onClick={() => setIsPanelOpen(true)} className="btn-glass">
            <Settings style={{ width: '0.9rem', height: '0.9rem' }} className="animate-spin-slow" />
            CONFIGURAR
          </button>
        </header>

        {/* BOTTOM CHAT SECTION ALIGNMENT */}
        <div className="bottom-area-layout">
          
          {/* LEFT-HAND CONTROL DECK WIDGET */}
          <section className="control-deck-card animate-fade-in">
            <div className="chat-card-decorator" style={{ border: '1px solid var(--gold-dim)', color: 'var(--gold-brass)', right: 'auto', left: '1rem' }}>SYSTEM CTRL</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="drawer-label" style={{ color: 'var(--gold-brass)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.62rem' }}>
                <Sparkles style={{ width: '0.75rem', height: '0.75rem' }} /> ESTADOS VTUBER
              </span>
              <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Personalidad activa del motor:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button 
                  onClick={() => animationEngineRef.current?.setState("idle")}
                  className="btn-glass" 
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.68rem', justifyContent: 'flex-start', background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  🟢 Normal (Idle)
                </button>
                <button 
                  onClick={() => animationEngineRef.current?.setState("thinking")}
                  className="btn-glass" 
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.68rem', justifyContent: 'flex-start', background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  🔵 Pensativa (Thinking)
                </button>
                <button 
                  onClick={() => animationEngineRef.current?.setState("shy")}
                  className="btn-glass" 
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.68rem', justifyContent: 'flex-start', background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  🟣 Tímida (Shy State)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem' }}>
              <span className="drawer-label" style={{ color: 'var(--crimson-neon)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.62rem' }}>
                <Mic style={{ width: '0.75rem', height: '0.75rem' }} /> DISPARAR GESTOS
              </span>
              <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Acciones de brazos temporales:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button 
                  onClick={() => animationEngineRef.current?.triggerGesture("greet")}
                  className="btn-glass" 
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.68rem', justifyContent: 'flex-start', borderColor: 'rgba(255, 5, 44, 0.15)', background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  👋 Saludar (Greet Wave)
                </button>
                <button 
                  onClick={() => animationEngineRef.current?.triggerGesture("shy")}
                  className="btn-glass" 
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.68rem', justifyContent: 'flex-start', borderColor: 'rgba(255, 5, 44, 0.15)', background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  👉👈 Timidez (Finger Fiddle)
                </button>
              </div>
            </div>
          </section>

          {/* Chat Glass Card */}
          <section className="chat-box-card">
            <div className="chat-card-decorator">Term-Nexus V1.0</div>

            {/* Scrollable messages log */}
            <div className="messages-viewport">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`chat-bubble ${msg.sender === 'user' ? 'user' : 'assistant'}`}
                >
                  <span className="bubble-sender">
                    {msg.sender === 'user' ? 'USUARIO' : 'CHRONOS'}
                  </span>
                  
                  <div className="bubble-content">
                    {msg.sender === 'assistant' && index === messages.length - 1 && isSpeaking && (
                      <span className="speak-indicator" />
                    )}
                    <p>{msg.text}</p>
                    {msg.translation && (
                      <p className="bubble-translation">{msg.translation}</p>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="chat-bubble assistant">
                  <span className="bubble-sender">CHRONOS</span>
                  <div className="bubble-content">
                    <span style={{ color: 'var(--crimson-neon)', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                      PROCESANDO...
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Waveform graphic while speaking */}
            {isSpeaking && (
              <div className="waveform-container">
                <div className="waveform-label">
                  <Volume2 style={{ width: '0.8rem', height: '0.8rem' }} /> WAVE:
                </div>
                <div className="waveform-bars">
                  {[...Array(24)].map((_, i) => (
                    <div 
                      key={i} 
                      className="waveform-bar"
                      style={{ 
                        height: `${25 + Math.random() * 75}%`, 
                        animation: `pulseWave ${0.25 + Math.random() * 0.3}s infinite ease-in-out`
                      }} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Send composer row */}
            <form onSubmit={handleSendMessage} className="input-composer">
              <button
                type="button"
                onClick={startSpeechRecognition}
                className="btn-mic"
                title="Dictar por Voz (Japonés)"
              >
                <Mic style={{ width: '0.95rem', height: '0.95rem' }} />
              </button>
              
              <div className="input-wrapper">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="日本語でメッセージを入力..."
                  disabled={isLoading}
                  className="input-field"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="btn-send"
                >
                  <Send style={{ width: '0.85rem', height: '0.85rem' }} />
                </button>
              </div>
            </form>
          </section>

        </div>
      </div>

      {/* CONFIG DRAWER DRAWER PANELS */}
      <div 
        className="settings-drawer"
        style={{ transform: isPanelOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          <div className="settings-drawer-header">
            <div className="drawer-title">
              <Settings style={{ width: '1.1rem', height: '1.1rem', color: 'var(--gold-brass)' }} />
              <h2>CONFIGURACIÓN</h2>
            </div>
            <button onClick={() => setIsPanelOpen(false)} className="btn-close-drawer">
              <X style={{ width: '1.1rem', height: '1.1rem' }} />
            </button>
          </div>

          <div className="drawer-content-scrollable">
            
            {/* AI Selector */}
            <div className="drawer-section">
              <span className="drawer-label">Cerebro de Inteligencia Artificial (LLM)</span>
              <div className="toggle-grid">
                <button
                  onClick={() => setEngine('gemini')}
                  className={`btn-toggle ${engine === 'gemini' ? 'active' : ''}`}
                >
                  <Cloud style={{ width: '0.85rem', height: '0.85rem' }} /> GEMINI API
                </button>
                <button
                  onClick={() => setEngine('ollama')}
                  className={`btn-toggle ${engine === 'ollama' ? 'active' : ''}`}
                >
                  <Cpu style={{ width: '0.85rem', height: '0.85rem' }} /> OLLAMA LOCAL
                </button>
              </div>
            </div>

            {/* Dynamic settings based on engine */}
            {engine === 'gemini' ? (
              <div className="drawer-section">
                <div className="section-link-wrapper">
                  <span className="drawer-label">Gemini API Key</span>
                  <a 
                    href="https://aistudio.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="link-settings"
                  >
                    OBTENER CLAVE <ChevronRight style={{ width: '0.6rem', height: '0.6rem' }} />
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="text-input-settings"
                />
                <p className="section-footnote">
                  La API Key se guarda localmente en tu navegador de forma segura.
                </p>
              </div>
            ) : (
              <div className="drawer-section">
                <span className="drawer-label">Ollama Server URL</span>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="text-input-settings"
                />
                <p className="section-footnote">
                  Asegúrate de tener Ollama ejecutándose de fondo y configurado para permitir CORS (`OLLAMA_ORIGINS="*"`).
                </p>
              </div>
            )}

            {/* Sound sliders */}
            <div className="settings-control-group">
              <div className="control-subheader">
                <Volume2 style={{ width: '0.9rem', height: '0.9rem', color: 'var(--crimson-neon)' }} />
                <span>AJUSTES DE VOZ (TTS)</span>
              </div>

              {/* Volume */}
              <div className="slider-row">
                <div className="slider-labels">
                  <span>Volumen</span>
                  <span>{Math.round(voiceVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(Number(e.target.value))}
                  className="slider-input"
                />
              </div>

              {/* Rate */}
              <div className="slider-row">
                <div className="slider-labels">
                  <span>Velocidad de habla</span>
                  <span>{voiceRate}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.05"
                  value={voiceRate}
                  onChange={(e) => setVoiceRate(Number(e.target.value))}
                  className="slider-input"
                />
              </div>

              {/* Pitch */}
              <div className="slider-row">
                <div className="slider-labels">
                  <span>Tono (Pitch)</span>
                  <span>{voicePitch}</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.05"
                  value={voicePitch}
                  onChange={(e) => setVoicePitch(Number(e.target.value))}
                  className="slider-input"
                />
              </div>
            </div>

            {/* Scene camera controls */}
            <div className="settings-control-group" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '1rem' }}>
              <div className="control-subheader">
                <Camera style={{ width: '0.9rem', height: '0.9rem', color: 'var(--crimson-neon)' }} />
                <span>ESCENA 3D</span>
              </div>

              <div className="switch-panel">
                <div className="switch-label-group">
                  <span className="switch-title">Controles de Cámara</span>
                  <span className="switch-desc">Rotar/Hacer zoom libre con ratón</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={orbitControlsEnabled} 
                    onChange={(e) => setOrbitControlsEnabled(e.target.checked)}
                    className="sr-only peer" 
                    style={{ display: 'none' }}
                  />
                  <div 
                    style={{ 
                      width: '32px', 
                      height: '18px', 
                      background: orbitControlsEnabled ? 'var(--crimson-neon)' : 'rgba(255, 255, 255, 0.1)', 
                      borderRadius: '9px',
                      position: 'relative',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div 
                      style={{ 
                        width: '14px', 
                        height: '14px', 
                        background: '#fff', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '2px', 
                        left: orbitControlsEnabled ? '16px' : '2px',
                        transition: 'left 0.2s'
                      }} 
                    />
                  </div>
                </label>
              </div>

              {!orbitControlsEnabled && (
                <button
                  type="button"
                  onClick={resetCameraToCinematic}
                  className="btn-secondary-flat"
                >
                  Re-centrar cámara en rostro
                </button>
              )}
            </div>

          </div>

          <div className="drawer-footer">
            <Database style={{ width: '0.8rem', height: '0.8rem' }} /> SECURE COMPANION PROTOCOL
          </div>

        </div>
      </div>

    </div>
  );
}
