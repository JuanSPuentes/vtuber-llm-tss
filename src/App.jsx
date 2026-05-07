import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
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
  Database,
  Upload,
  RefreshCw
} from 'lucide-react';
import './App.css';

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

  // VRM Avatar Management States (Saved in LocalStorage)
  const [currentVrmUrl, setCurrentVrmUrl] = useState(() => localStorage.getItem('chrono_vrm_url') || '/5834554318258545116.vrm');
  const [customVrmName, setCustomVrmName] = useState(() => localStorage.getItem('chrono_vrm_name') || 'Cyber Girl (Default)');
  const [vrmUrlInput, setVrmUrlInput] = useState('');

  // Gracefully clean up any local browser Session Blobs on application reload to prevent null loads
  useEffect(() => {
    if (currentVrmUrl.startsWith('blob:')) {
      setCurrentVrmUrl('/5834554318258545116.vrm');
      setCustomVrmName('Cyber Girl (Default)');
    }
  }, []);

  // App Configurations (Saved in LocalStorage)
  const [engine, setEngine] = useState(() => localStorage.getItem('chrono_engine') || 'gemini');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('chrono_gemini_key') || '');
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('chrono_ollama_url') || 'http://localhost:11434');
  const [voiceVolume, setVoiceVolume] = useState(() => Number(localStorage.getItem('chrono_volume')) || 0.8);
  const [voiceRate, setVoiceRate] = useState(() => Number(localStorage.getItem('chrono_rate')) || 1.0);
  const [voicePitch, setVoicePitch] = useState(() => Number(localStorage.getItem('chrono_pitch')) || 1.05);
  const [orbitControlsEnabled, setOrbitControlsEnabled] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState(() => localStorage.getItem('chrono_openrouter_key') || '');
  const [openrouterModel, setOpenrouterModel] = useState(() => localStorage.getItem('chrono_openrouter_model') || 'google/gemini-2.5-flash');
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem('chrono_gemini_model') || 'gemini-2.5-flash');
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('chrono_ollama_model') || 'llama3');

  // Default system prompt/personality configuration
  const defaultPersonality = "Eres Chronos (クロノス), un asistente holográfico gótico-digital altamente sofisticado que rige el tiempo. Hablas con gracia, de forma enigmática, seductora y muy educada. Responde EXCLUSIVAMENTE en japonés fluido (Katakana, Hiragana, Kanji). Tus respuestas deben ser ultra-cortas (máximo 1 o 2 frases simples) ya que serán reproducidas por un sintetizador de voz. Termina siempre con terminaciones formales y elegantes (です, ます, でしょう, etcétera).";
  const [avatarPersonality, setAvatarPersonality] = useState(() => localStorage.getItem('chrono_avatar_personality') || defaultPersonality);

  // Ref to hold the static default pose bone quaternions once mapped
  const vrmPoseRef = useRef(null);
  const vrmRestPoseRef = useRef({});

  // Purge any corrupted position keys from localStorage on mount
  useEffect(() => {
    localStorage.removeItem('chrono_vrm_pos_x');
    localStorage.removeItem('chrono_vrm_pos_y');
    localStorage.removeItem('chrono_vrm_pos_z');
    localStorage.removeItem('chrono_vrm_scale');
  }, []);

  // Hardcoded cinematographic defaults for perfect framing centered positioning
  const vrmPosX = -0.5;
  const vrmPosY = 0.0;
  const vrmPosZ = -9.0;
  const vrmScale = 1.0;

  // WebGL & 3D Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const vrmRef = useRef(null);
  const currentVrmUrlRef = useRef(currentVrmUrl);
  const loadingUrlRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const cameraRef = useRef(null);
  const mouseCoordsRef = useRef({ x: 0, y: 0 });

  const vrmMixerRef = useRef(null);

  // Audio / Voice Refs
  const speechUtteranceRef = useRef(null);
  const currentSpeakingVolumeRef = useRef(0);
  const isSpeakingRef = useRef(false);

  // Vowel Tracking Refs for high-fidelity phonetic syllable-synced lipsync
  const activeVowelRef = useRef('aa');
  const vowelTimerRef = useRef(0);

  // Web Audio API Persistent Refs for Real-Time Frequency Analysis Lipsync
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const isEdgeTTSActiveRef = useRef(false);

  // Smooth expression interpolation refs for ultra-realistic organic facial movements
  const smoothMouthARef = useRef(0);
  const smoothMouthIRef = useRef(0);
  const smoothMouthORef = useRef(0);
  const smoothMouthERef = useRef(0);
  const smoothMouthURef = useRef(0);
  const smoothSmileRef = useRef(0);

  // Helper to retarget Mixamo animation tracks to VRM humanoid bones perfectly using coordinate basis transformations
  const retargetMixamoClip = (fbx, vrmInstance) => {
    // Extract the Mixamo animation clip
    const clip = fbx.animations && fbx.animations.find(clip => clip.tracks && clip.tracks.length > 0);
    if (!clip) {
      console.warn('Could not find animation clip with tracks in FBX.');
      return null;
    }

    const tracks = [];
    const restRotationInverse = new THREE.Quaternion();
    const parentRestWorldRotation = new THREE.Quaternion();
    const _quatA = new THREE.Quaternion();

    // Adjust scale based on hips height
    const motionHips = fbx.getObjectByName('mixamorigHips');
    const vrmHipsNode = vrmInstance.humanoid.getNormalizedBoneNode('hips');
    let hipsPositionScale = 1.0;
    if (motionHips && vrmHipsNode) {
      const motionHipsHeight = motionHips.position.y;
      const vrmHipsHeight = vrmInstance.humanoid.normalizedRestPose?.hips?.position?.[1] || 1.0;
      if (motionHipsHeight > 0) {
        hipsPositionScale = vrmHipsHeight / motionHipsHeight;
      }
    }

    // A map from Mixamo rig names to VRM Humanoid bone names (omitting spine, chest, upperChest, neck, head for clean organic dynamic layers!)
    const MIXAMO_VRM_MAP = {
      mixamorigHips: 'hips',
      mixamorigLeftShoulder: 'leftShoulder',
      mixamorigLeftArm: 'leftUpperArm',
      mixamorigLeftForeArm: 'leftLowerArm',
      mixamorigLeftHand: 'leftHand',
      mixamorigRightShoulder: 'rightShoulder',
      mixamorigRightArm: 'rightUpperArm',
      mixamorigRightForeArm: 'rightLowerArm',
      mixamorigRightHand: 'rightHand',
      mixamorigLeftUpLeg: 'leftUpperLeg',
      mixamorigLeftLeg: 'leftLowerLeg',
      mixamorigLeftFoot: 'leftFoot',
      mixamorigRightUpLeg: 'rightUpperLeg',
      mixamorigRightLeg: 'rightLowerLeg',
      mixamorigRightFoot: 'rightFoot',
      // Fingers mapping for perfect relaxed hand posture!
      mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
      mixamorigLeftHandThumb2: 'leftThumbProximal',
      mixamorigLeftHandThumb3: 'leftThumbDistal',
      mixamorigLeftHandIndex1: 'leftIndexProximal',
      mixamorigLeftHandIndex2: 'leftIndexIntermediate',
      mixamorigLeftHandIndex3: 'leftIndexDistal',
      mixamorigLeftHandMiddle1: 'leftMiddleProximal',
      mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
      mixamorigLeftHandMiddle3: 'leftMiddleDistal',
      mixamorigLeftHandRing1: 'leftRingProximal',
      mixamorigLeftHandRing2: 'leftRingIntermediate',
      mixamorigLeftHandRing3: 'leftRingDistal',
      mixamorigLeftHandPinky1: 'leftLittleProximal',
      mixamorigLeftHandPinky2: 'leftLittleIntermediate',
      mixamorigLeftHandPinky3: 'leftLittleDistal',
      mixamorigRightHandThumb1: 'rightThumbMetacarpal',
      mixamorigRightHandThumb2: 'rightThumbProximal',
      mixamorigRightHandThumb3: 'rightThumbDistal',
      mixamorigRightHandIndex1: 'rightIndexProximal',
      mixamorigRightHandIndex2: 'rightIndexIntermediate',
      mixamorigRightHandIndex3: 'rightIndexDistal',
      mixamorigRightHandMiddle1: 'rightMiddleProximal',
      mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
      mixamorigRightHandMiddle3: 'rightMiddleDistal',
      mixamorigRightHandRing1: 'rightRingProximal',
      mixamorigRightHandRing2: 'rightRingIntermediate',
      mixamorigRightHandRing3: 'rightRingDistal',
      mixamorigRightHandPinky1: 'rightLittleProximal',
      mixamorigRightHandPinky2: 'rightLittleIntermediate',
      mixamorigRightHandPinky3: 'rightLittleDistal',
    };

    clip.tracks.forEach((track) => {
      const trackSplitted = track.name.split('.');
      const mixamoRigName = trackSplitted[0].replace(/:/g, ''); // strip colons
      const vrmBoneName = MIXAMO_VRM_MAP[mixamoRigName];
      const boneNode = vrmInstance.humanoid?.getNormalizedBoneNode(vrmBoneName);

      if (boneNode) {
        const vrmNodeName = boneNode.name;
        const propertyName = trackSplitted[1];
        const mixamoRigNode = fbx.getObjectByName(mixamoRigName) || fbx.getObjectByName(trackSplitted[0]);

        if (mixamoRigNode) {
          mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
          if (mixamoRigNode.parent) {
            mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);
          } else {
            parentRestWorldRotation.identity();
          }

          if (track instanceof THREE.QuaternionKeyframeTrack) {
            const values = Array.from(track.values);
            for (let i = 0; i < values.length; i += 4) {
              _quatA.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
              _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);

              values[i] = _quatA.x;
              values[i + 1] = _quatA.y;
              values[i + 2] = _quatA.z;
              values[i + 3] = _quatA.w;
            }

            // Push the retargeted quaternion keyframe track
            tracks.push(
              new THREE.QuaternionKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                values.map((v, i) => (vrmInstance.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v))
              )
            );
          } else if (track instanceof THREE.VectorKeyframeTrack) {
            const values = Array.from(track.values).map((v, i) => (vrmInstance.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale);
            tracks.push(
              new THREE.VectorKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                values
              )
            );
          }
        }
      }
    });

    return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
  };

  // Dynamic VRM Model Loader (Supports Presets, Custom URLs, and Local drag-and-drop/Files)
  const loadVrmModel = (url) => {
    if (!sceneRef.current) return;

    const activeScene = sceneRef.current;

    // Track the active URL requested to resolve async race-conditions
    currentVrmUrlRef.current = url;

    // Strict Mode double-render guard: If this exact URL is already loading on this active scene, skip duplicate load execution
    if (loadingUrlRef.current === url) {
      console.log("Model load in progress for URL, skipping redundant trigger:", url);
      return;
    }

    loadingUrlRef.current = url;
    setVrmLoaded(false);
    setLoadProgress(0);

    // 1. Clean up and dispose of previous VRM model to free GPU memory
    if (vrmRef.current) {
      sceneRef.current.remove(vrmRef.current.scene);
      VRMUtils.deepDispose(vrmRef.current.scene);
      vrmRef.current = null;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        // Safe lock release
        if (loadingUrlRef.current === url) {
          loadingUrlRef.current = null;
        }

        // Scene instance verification for React Strict Mode double-mount cycles
        if (sceneRef.current !== activeScene) {
          console.warn("Discarding asynchronously loaded VRM model as Three.js scene instance has changed.");
          const oldVrm = gltf.userData.vrm;
          if (oldVrm) {
            VRMUtils.deepDispose(oldVrm.scene);
          }
          return;
        }

        // Asynchronous check: If the active URL state has shifted during the network load duration, discard this object to prevent twin overlays
        if (currentVrmUrlRef.current !== url) {
          console.warn("Discarding asynchronously loaded VRM model as requested URL shifted:", url);
          const oldVrm = gltf.userData.vrm;
          if (oldVrm) {
            VRMUtils.deepDispose(oldVrm.scene);
          }
          return;
        }

        const vrm = gltf.userData.vrm;
        vrmRef.current = vrm;
        sceneRef.current.add(vrm.scene);

        // Capture standard VRM humanoid rest pose bone orientations BEFORE any rotation/transformation is applied
        const standardVrmBones = [
          'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
          'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
          'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
          'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
          'leftFoot', 'rightFoot'
        ];
        const restPose = {};
        standardVrmBones.forEach((boneName) => {
          const boneNode = vrm.humanoid.getNormalizedBoneNode(boneName);
          if (boneNode) {
            restPose[boneName] = boneNode.quaternion.clone();
          }
        });
        vrmRestPoseRef.current = restPose;

        // Hide model initially until FBX pose is fully applied!
        vrm.scene.visible = false;

        // Standard orientation fix
        VRMUtils.rotateVRM0(vrm);

        // Apply initial positions
        vrm.scene.position.set(vrmPosX, vrmPosY, vrmPosZ);
        vrm.scene.scale.set(vrmScale, vrmScale, vrmScale);

        // Face front
        vrm.scene.rotation.y = Math.PI;

        // Load the default FBX Standing pose as the initial pose, then complete!
        loadFbxPose(vrm);
      },
      (xhr) => {
        if (xhr.total > 0) {
          const progress = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadProgress(progress);
        } else {
          // Fallback loader simulator for chunked assets
          setLoadProgress(prev => Math.min(99, prev + 2));
        }
      },
      (error) => {
        if (loadingUrlRef.current === url) {
          loadingUrlRef.current = null;
        }
        console.error('Error loading VRM model:', error);
        alert('Error al cargar el modelo VRM. Por favor, asegúrate de que es un archivo .vrm válido y tiene habilitado CORS.');
        setVrmLoaded(true); // Re-enable display on error
      }
    );
  };

  // Local File Selector Callback (Converts uploaded VRM file to memory Blob URL)
  const handleVrmFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.vrm')) {
        alert('Por favor, selecciona un archivo con extensión .vrm');
        return;
      }
      const url = URL.createObjectURL(file);
      setCurrentVrmUrl(url);
      setCustomVrmName(file.name);
    }
    // Reset file input value to empty so that choosing the same file again triggers the onChange event
    if (event.target) {
      event.target.value = '';
    }
  };

  // Custom External URL Loader (With clean validation)
  const handleCustomVrmUrlLoad = (e) => {
    e.preventDefault();
    if (!vrmUrlInput.trim()) return;

    let url = vrmUrlInput.trim();
    // Simple sanitization
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
      url = 'https://' + url;
    }

    // Try to extract a clean filename from the URL
    let name = 'Custom Avatar';
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const part = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (part && part.toLowerCase().endsWith('.vrm')) {
        name = part;
      }
    } catch (_) { }

    setCurrentVrmUrl(url);
    setCustomVrmName(name);
    setVrmUrlInput('');
  };

  // Restore Default Model
  const handleResetToDefaultVrm = () => {
    setCurrentVrmUrl('/5834554318258545116.vrm');
    setCustomVrmName('Cyber Girl (Default)');
  };

  // Save selected model paths to localStorage and trigger reload when URLs shift
  useEffect(() => {
    localStorage.setItem('chrono_vrm_url', currentVrmUrl);
    localStorage.setItem('chrono_vrm_name', customVrmName);

    if (sceneRef.current && currentVrmUrl) {
      loadVrmModel(currentVrmUrl);
    }
  }, [currentVrmUrl]);

  // Load and apply the default FBX Pose
  const loadFbxPose = (vrmInstance, onComplete) => {
    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      '/Standing Idle.fbx',
      (fbx) => {
        console.log('FBX Pose loaded successfully:', fbx);

        // 1. Retarget Mixamo FBX Pose to VRM AnimationClip perfectly using coordinate basis transformations
        const vrmAnimation = retargetMixamoClip(fbx, vrmInstance);
        if (vrmAnimation) {
          console.log('Retargeted Mixamo FBX pose successfully to VRM AnimationClip!', vrmAnimation);
          const mixer = new THREE.AnimationMixer(vrmInstance.scene);
          const action = mixer.clipAction(vrmAnimation);
          action.loop = THREE.LoopOnce;
          action.clampWhenFinished = true;
          action.play();

          // Evaluate the pose synchronously on the first frame
          mixer.setTime(0.01);
          vrmInstance.scene.updateMatrixWorld(true);

          vrmMixerRef.current = mixer;
        }

        // Reveal the model now that the pose is 100% applied!
        vrmInstance.scene.visible = true;

        setVrmLoaded(true);
        resetCameraToCinematic();

        // Trigger loop start after pose application is complete
        if (onComplete) onComplete();
      },
      (xhr) => {
        const progress = Math.round((xhr.loaded / xhr.total) * 100);
        setLoadProgress(progress);
      },
      (error) => {
        console.error('Error loading FBX pose:', error);
        // Fallback: make visible anyway to avoid a permanently frozen/hidden screen
        vrmInstance.scene.visible = true;
        setVrmLoaded(true);
        resetCameraToCinematic();
        if (onComplete) onComplete();
      }
    );
  };


  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('chrono_engine', engine);
    localStorage.setItem('chrono_gemini_key', geminiKey);
    localStorage.setItem('chrono_ollama_url', ollamaUrl);
    localStorage.setItem('chrono_openrouter_key', openrouterKey);
    localStorage.setItem('chrono_openrouter_model', openrouterModel);
    localStorage.setItem('chrono_gemini_model', geminiModel);
    localStorage.setItem('chrono_ollama_model', ollamaModel);
    localStorage.setItem('chrono_avatar_personality', avatarPersonality);
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
    openrouterKey,
    openrouterModel,
    geminiModel,
    ollamaModel,
    avatarPersonality,
    voiceVolume,
    voiceRate,
    voicePitch,
    orbitControlsEnabled
  ]);

  // Restablece la cámara enfocando el cuerpo y elevando visualmente al personaje en la pantalla
  const resetCameraToCinematic = () => {
    if (cameraRef.current && controlsRef.current) {
      // Para hacer que el personaje suba visualmente en la pantalla, bajamos el punto de enfoque del objetivo (target)
      // de la cámara. Al apuntar a la altura del pecho/torso (1.0 + vrmPosY) en vez de al rostro (1.45), el modelo
      // se desplaza de manera natural hacia la parte superior del marco visual, dejando ver más de su cuerpo.
      controlsRef.current.target.set(0.0, 1.0 + vrmPosY, vrmPosZ);

      // Posicionamos la cámara ligeramente más arriba que el objetivo de enfoque (1.1 + vrmPosY) y a una cómoda
      // distancia focal de 2.35 unidades en el eje de profundidad Z para lograr un plano cinemático amplio.
      cameraRef.current.position.set(0.0, 1.1 + vrmPosY, 2.35 + vrmPosZ);
      
      controlsRef.current.update();
    }
  };

  // Warm up Web Speech API voices on startup to prevent initial silence lag
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, []);

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

    // RENDERER (Optimized for High FPS)
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'mediump'
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;
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
    controls.target.set(0.0, 1.45 + vrmPosY, vrmPosZ);
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

    // Mount the scene and load initial VRM model
    sceneRef.current = scene;
    loadVrmModel(currentVrmUrl);

    // Animation organic loops & timers
    let lastTime = 0;
    requestAnimationFrame((t) => {
      lastTime = t * 0.001;
      animate(t);
    });
    let blinkTimer = 0;
    let nextBlinkDuration = 3.0;
    let isBlinking = false;
    let blinkRatio = 0;

    // Mouse Coordinates normalizer tracking
    const handleMouseMove = (event) => {
      mouseCoordsRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Cute Avatar Click Interactions
    const handleCanvasClick = () => {
      if (!vrmRef.current) return;
      const reactions = [
        { text: "はい、ご主人様！何か御用でしょうか？ (¡Sí, mi señor! ¿En qué puedo ayudarle?)", expression: 'happy' },
        { text: "きゃっ！触らないでください…恥ずかしいです… (¡Kyaa! No me toques... me da vergüenza...)", expression: 'surprised' },
        { text: "いつもそばにいますよ、ご主人様。 (Siempre estaré a su lado, mi señor.)", expression: 'happy' },
        { text: "ふふ、ご主人様は本当に優しいですね。 (Fufu, mi señor es realmente amable, ¿verdad?)", expression: 'happy' }
      ];
      const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
      speakText(randomReaction.text);

      if (vrmRef.current.expressionManager) {
        vrmRef.current.expressionManager.setValue(randomReaction.expression, 1.0);
        setTimeout(() => {
          if (vrmRef.current && vrmRef.current.expressionManager) {
            vrmRef.current.expressionManager.setValue(randomReaction.expression, 0);
          }
        }, 3500);
      }
    };
    rendererRef.current.domElement.addEventListener('click', handleCanvasClick);

    const animate = (time) => {
      animationFrameIdRef.current = requestAnimationFrame(animate);

      const elapsed = time ? time * 0.001 : 0;
      const delta = Math.min(elapsed - lastTime, 0.1);
      lastTime = elapsed;

      // Update model physics springs & organic animations
      if (vrmRef.current) {
        // 1. Base Layer: Persistently apply the gorgeous static FBX standing pose rotations via the AnimationMixer
        if (vrmMixerRef.current) {
          vrmMixerRef.current.update(delta);
        }

        // 2. Breathing Layer (Dynamic Sine Wave) on Spine & Chest (layers over the rest pose!)
        const breathingSpeed = 2.0;
        const breathingAngle = Math.sin(elapsed * breathingSpeed) * 0.015;

        const spineNode = vrmRef.current.humanoid.getNormalizedBoneNode('spine');
        if (spineNode) {
          const baseSpine = vrmRestPoseRef.current && vrmRestPoseRef.current['spine'] ? vrmRestPoseRef.current['spine'] : new THREE.Quaternion();
          const breathingRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathingAngle * 0.3, 0, 0));
          spineNode.quaternion.copy(baseSpine).multiply(breathingRot);
        }

        const chestNode = vrmRef.current.humanoid.getNormalizedBoneNode('chest');
        if (chestNode) {
          const baseChest = vrmRestPoseRef.current && vrmRestPoseRef.current['chest'] ? vrmRestPoseRef.current['chest'] : new THREE.Quaternion();
          const breathingRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathingAngle * 0.7, 0, 0));
          chestNode.quaternion.copy(baseChest).multiply(breathingRot);
        }

        // 3. Look-At Cursor Tracking Layer on Neck & Head (utilizing smooth slerp with robust fallback guards)
        const neckNode = vrmRef.current.humanoid.getNormalizedBoneNode('neck');
        const headNode = vrmRef.current.humanoid.getNormalizedBoneNode('head');
        if (neckNode && headNode) {
          const targetHeadY = mouseCoordsRef.current ? mouseCoordsRef.current.x * 0.28 : 0; // Yaw
          const targetHeadX = mouseCoordsRef.current ? mouseCoordsRef.current.y * 0.18 : 0; // Pitch

          const targetNeckQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(targetHeadX * 0.4, targetHeadY * 0.4, 0));
          const targetHeadQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(targetHeadX * 0.6, targetHeadY * 0.6, 0));

          const baseNeck = vrmRestPoseRef.current && vrmRestPoseRef.current['neck'] ? vrmRestPoseRef.current['neck'] : new THREE.Quaternion();
          const baseHead = vrmRestPoseRef.current && vrmRestPoseRef.current['head'] ? vrmRestPoseRef.current['head'] : new THREE.Quaternion();

          const finalNeck = baseNeck.clone().multiply(targetNeckQuat);
          const finalHead = baseHead.clone().multiply(targetHeadQuat);

          neckNode.quaternion.slerp(finalNeck, 0.1);
          headNode.quaternion.slerp(finalHead, 0.1);
        }

        // 4. Expression Layer: Natural Eased Blinking Loop (Simulating realistic eyelid kinetics)
        blinkTimer += delta;
        if (blinkTimer >= nextBlinkDuration && !isBlinking) {
          isBlinking = true;
          blinkTimer = 0;
          blinkRatio = 0;
        }
        if (isBlinking) {
          blinkRatio += delta * 15.0;
          if (blinkRatio < 1.0) {
            // Fast cubic ease-in when closing eyes
            const easedBlink = Math.pow(blinkRatio, 3);
            vrmRef.current.expressionManager.setValue('blink', easedBlink);
          } else if (blinkRatio < 2.0) {
            // Slower sinusoidal ease-out when opening eyes
            const easedBlink = Math.sin((2.0 - blinkRatio) * Math.PI * 0.5);
            vrmRef.current.expressionManager.setValue('blink', easedBlink);
          } else {
            vrmRef.current.expressionManager.setValue('blink', 0);
            isBlinking = false;
            nextBlinkDuration = 2.5 + Math.random() * 4.5;
          }
        }

        // Real-Time Audio Frequency Analysis for Mathematical Lipsync (Analyser FFT) - ONLY when playing premium Edge-TTS
        if (isSpeakingRef.current && isEdgeTTSActiveRef.current && analyserRef.current) {
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          let count = 0;
          // Analyze the human vocal frequency range bins (typically indices 2 to 32 for speech frequencies in 1024 FFT size)
          for (let i = 2; i < Math.min(32, bufferLength); i++) {
            sum += dataArray[i];
            count++;
          }
          const average = sum / (count || 1);
          // Normalize average to [0.0, 1.0] range (human speech peak is around 110-120 in byte frequency values)
          const rawVol = Math.min(1.0, average / 115.0);

          // Smoothen the volume reading to eliminate high frequency frame jitters
          currentSpeakingVolumeRef.current += (rawVol - currentSpeakingVolumeRef.current) * 0.28;
        } else if (!isSpeakingRef.current) {
          currentSpeakingVolumeRef.current = 0;
        }

        // 5. Expression Layer: Organic Dual-Engine Lip-Sync & Breathing Micro-Smile
        let targetA = 0;
        let targetI = 0;
        let targetO = 0;
        let targetE = 0;
        let targetU = 0;
        let targetSmile = 0.15; // CONSTANT CUTE MICRO-SMILE BASE TO ELIMINATE DEADPAN EXPRESSIONS

        if (isSpeakingRef.current) {
          if (isEdgeTTSActiveRef.current) {
            // High-quality fluid procedural VTuber conversational chatter modulated by real-time voice volume!
            const volumeFactor = currentSpeakingVolumeRef.current;
            const speed = 14.0;
            // The chatter magnitude is directly driven by the volume of the audio!
            const chatter = volumeFactor * Math.max(0.2, Math.sin(elapsed * speed) + Math.cos(elapsed * speed * 0.75)) * 0.42;

            // Morph dynamically between vowels for realistic jaw and lip movements
            const vowelMix = Math.sin(elapsed * 3.5);
            if (vowelMix > 0.4) {
              targetA = chatter * 0.85;
              targetSmile = 0.28;
            } else if (vowelMix > -0.2) {
              targetI = chatter * 0.50;
              targetU = chatter * 0.40;
              targetSmile = 0.25;
            } else {
              targetO = chatter * 0.75;
              targetSmile = 0.22;
            }
          } else {
            // Local Phonetic-Mapped Syllable Lipsync
            if (vowelTimerRef.current > 0) {
              vowelTimerRef.current -= delta;

              // Add a natural breathing vibrato/jitter to the speaking mouth shape
              const jitter = 0.85 + Math.sin(elapsed * 25.0) * 0.15;

              if (activeVowelRef.current === 'aa') targetA = 0.75 * jitter;
              else if (activeVowelRef.current === 'ih') targetI = 0.65 * jitter;
              else if (activeVowelRef.current === 'oh') targetO = 0.70 * jitter;
              else if (activeVowelRef.current === 'ee') targetE = 0.60 * jitter;
              else if (activeVowelRef.current === 'uu') targetU = 0.50 * jitter;
            } else {
              // Fallback organic chatter if no boundary event is currently active or between syllables
              const speed = 12.0;
              const chatter = Math.max(0, Math.sin(elapsed * speed)) * 0.45;
              targetA = chatter;
            }
          }

          targetSmile = 0.24 + Math.sin(elapsed * 4.0) * 0.08;
        } else {
          // Subtle breathing micro-smile to make the idle character feel warm and "alive"
          targetSmile = 0.15 + Math.sin(elapsed * 2.0) * 0.04;
        }

        // 6. Exponential Smoothing (Frame-rate independent lerp solver inspired by Kalidokit)
        const lerpFactor = 1.0 - Math.exp(-15 * delta); // Ultra-responsive smoothing transition
        smoothMouthARef.current += (targetA - smoothMouthARef.current) * lerpFactor;
        smoothMouthIRef.current += (targetI - smoothMouthIRef.current) * lerpFactor;
        smoothMouthORef.current += (targetO - smoothMouthORef.current) * lerpFactor;
        smoothMouthERef.current += (targetE - smoothMouthERef.current) * lerpFactor;
        smoothMouthURef.current += (targetU - smoothMouthURef.current) * lerpFactor;
        smoothSmileRef.current += (targetSmile - smoothSmileRef.current) * lerpFactor;

        // Commit all calculated blendshape values to the Expression Manager
        vrmRef.current.expressionManager.setValue('aa', smoothMouthARef.current);
        vrmRef.current.expressionManager.setValue('ih', smoothMouthIRef.current);
        vrmRef.current.expressionManager.setValue('oh', smoothMouthORef.current);
        vrmRef.current.expressionManager.setValue('ee', smoothMouthERef.current);
        vrmRef.current.expressionManager.setValue('uu', smoothMouthURef.current);
        vrmRef.current.expressionManager.setValue('happy', smoothSmileRef.current);

        // Apply physics & updates (including hair and outfit springs)
        vrmRef.current.update(delta);
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    // AUTO-RESIZE
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(width, height);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    };

    window.addEventListener('resize', handleResize);

    // CLEANUP
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (rendererRef.current) {
        rendererRef.current.domElement.removeEventListener('click', handleCanvasClick);
      }
      cancelAnimationFrame(animationFrameIdRef.current);

      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      sceneRef.current = null;
      vrmMixerRef.current = null;
      loadingUrlRef.current = null;

      // Cleanup Web Audio elements to prevent memory leaks
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
        audioContextRef.current = null;
      }
    };
  }, []);

  // Synthesize Speech and trigger Syllable-Synced Lip-Sync (Dual Engine: Edge-TTS with Local Fallback)
  const speakText = async (text) => {
    // Single persistent audio & analyser pipeline setup to prevent reconstruction bugs in Chrome/Edge
    const getAudioInstance = () => {
      if (!audioRef.current) {
        const audio = new Audio();
        audio.crossOrigin = "anonymous"; // Safe direct CORS authorization
        audioRef.current = audio;

        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024; // Pristine studio quality
          analyserRef.current = analyser;

          const source = ctx.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(ctx.destination);
        } catch (e) {
          console.warn("Web Audio API initial routing block:", e);
        }
      }
      return audioRef.current;
    };

    // 1. Cancel and pause any currently playing audio streams
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume(); // Chrome TTS hang-up queue fix

    setIsSpeaking(false);
    isSpeakingRef.current = false;
    isEdgeTTSActiveRef.current = false;
    activeVowelRef.current = null;
    vowelTimerRef.current = 0;
    currentSpeakingVolumeRef.current = 0;

    if (!text) return;

    // Filter out parenthetical comments (e.g. "(Smiles) こんにちは" -> "こんにちは")
    const speechText = text.replace(/\([\s\S]*?\)/g, '').trim();
    if (!speechText) return;

    // A. Setup local SpeechSynthesis utterance as backup
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'ja-JP';
    speechUtteranceRef.current = utterance;

    const voices = window.speechSynthesis.getVoices();
    let japaneseVoice = voices.find(voice => voice.lang.startsWith('ja') || voice.lang.includes('JP'));
    if (!japaneseVoice) {
      japaneseVoice = voices.find(voice => /ja|jp/i.test(voice.lang));
    }
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }

    // Default unmodified parameters for natural, unmodified voice output
    utterance.volume = 1.0;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Local Phonetic Vowel Extractor
    const getJapaneseVowel = (char) => {
      if (!char) return null;
      const aChars = /[あかさたなはまやらわかがざだばぱァカサタナハマヤラワガザダバパ]/;
      const iChars = /[いきしちにひみりぎじぢびぴィキシチニヒミリギジヂビピ]/;
      const uChars = /[うくすつぬふむゆるぐずづぶぷぅゥクスツヌフムユルグズヅブプ]/;
      const eChars = /[えけせてねへめれげぜでべぺェケセテネヘメレゲゼデベペ]/;
      const oChars = /[おこそとのほmoよろごぞどぼぽォコソトノホモヨロゴゾドボポ]/;

      if (aChars.test(char)) return 'aa';
      if (iChars.test(char)) return 'ih';
      if (uChars.test(char)) return 'uu';
      if (eChars.test(char)) return 'ee';
      if (oChars.test(char)) return 'oh';
      return null;
    };

    utterance.onstart = () => {
      if (!isEdgeTTSActiveRef.current) {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      }
    };

    utterance.onboundary = (event) => {
      if (!isEdgeTTSActiveRef.current && (event.name === 'word' || event.name === 'character' || !event.name)) {
        const charIndex = event.charIndex;
        const char = speechText.charAt(charIndex);
        const vowel = getJapaneseVowel(char);
        if (vowel) {
          activeVowelRef.current = vowel;
          vowelTimerRef.current = 0.22;
        }
      }
    };

    utterance.onend = () => {
      if (!isEdgeTTSActiveRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        activeVowelRef.current = null;
        vowelTimerRef.current = 0;
      }
    };

    utterance.onerror = () => {
      if (!isEdgeTTSActiveRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        activeVowelRef.current = null;
        vowelTimerRef.current = 0;
      }
    };

    // B. Attempt to Fetch Premium Edge-TTS from Hugging Face Space (Gradio v5 Queue-Stream Client)
    let ttsUrl = '';
    let isEdgeTTSSuccessful = false;

    try {
      // 1. Join the Gradio v5 queue for the tts_interface endpoint
      const joinResponse = await fetch('https://innoai-edge-tts-text-to-speech.hf.space/gradio_api/call/tts_interface', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            speechText,
            "ja-JP-NanamiNeural - ja-JP (Female)", // Match exact formatted dropdown choice string
            0,                                     // Unmodified speed adjustment rate slider
            0                                      // Unmodified pitch adjustment Hz slider
          ]
        }),
        signal: AbortSignal.timeout(3500) // 3.5s timeout threshold
      });

      if (!joinResponse.ok) {
        throw new Error("Edge TTS queue join error");
      }

      const joinData = await joinResponse.json();
      const eventId = joinData.event_id;
      if (!eventId) {
        throw new Error("No Gradio event ID received");
      }

      // 2. Fetch/Poll the completed result stream
      const streamUrl = `https://innoai-edge-tts-text-to-speech.hf.space/gradio_api/call/tts_interface/${eventId}`;
      const streamResponse = await fetch(streamUrl, {
        signal: AbortSignal.timeout(4500) // 4.5s stream timeout threshold
      });

      if (!streamResponse.ok) {
        throw new Error("Edge TTS event stream status error");
      }

      const streamText = await streamResponse.text();
      // Match the generated MP3 file URL from the completed SSE payload
      const urlMatch = streamText.match(/"url":\s*"([^"]+)"/);
      if (urlMatch && urlMatch[1]) {
        ttsUrl = urlMatch[1];
        isEdgeTTSSuccessful = true;
      } else {
        throw new Error("Audio URL not found in stream response");
      }
    } catch (err) {
      console.warn("Edge-TTS connection failed, routing local native fallback:", err.message);
    }

    if (isEdgeTTSSuccessful && ttsUrl) {
      // PLAY PREMIUM EDGE-TTS WITH NATIVE HARDWARE AUDIO DIRECTLY (100% pure & unfiltered)
      isEdgeTTSActiveRef.current = true;

      const audio = getAudioInstance();
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      audio.src = ttsUrl;

      audio.onplay = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      };

      audio.onended = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        isEdgeTTSActiveRef.current = false;
        currentSpeakingVolumeRef.current = 0;
      };

      audio.onerror = (e) => {
        console.warn("Edge TTS audio playing error, falling back:", e);
        isEdgeTTSActiveRef.current = false;
        currentSpeakingVolumeRef.current = 0;
        window.speechSynthesis.speak(utterance);
      };

      audio.play().catch(err => {
        console.warn("Autoplay block, falling back to local speech synthesis:", err);
        isEdgeTTSActiveRef.current = false;
        currentSpeakingVolumeRef.current = 0;
        window.speechSynthesis.speak(utterance);
      });

    } else {
      // PLAY LOCAL NATIVE SYNTHESIS VOICE
      isEdgeTTSActiveRef.current = false;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Send Message to AI (Gemini or Ollama)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);



    // Add user message to history
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);

    try {
      let aiResponseText = '';

      if (engine === 'gemini') {
        if (!geminiKey) {
          throw new Error('Por favor, ingresa tu API Key de Gemini en el panel de configuración.');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel || 'gemini-2.5-flash'}:generateContent?key=${geminiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{
                  text: `${avatarPersonality || 'Eres Chronos.'}
                    
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

      } else if (engine === 'openrouter') {
        if (!openrouterKey) {
          throw new Error('Por favor, ingresa tu API Key de OpenRouter en el panel de configuración.');
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Chronos Nexus'
          },
          body: JSON.stringify({
            model: openrouterModel || 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: avatarPersonality || "Eres Chronos (クロノス), un asistente holográfico gótico-digital altamente sofisticado que rige el tiempo. Hablas con gracia, de forma enigmática, seductora y muy educada. Responde EXCLUSIVAMENTE en japonés fluido (Katakana, Hiragana, Kanji). Tus respuestas deben ser ultra-cortas (máximo 1 o 2 frases simples). Termina siempre con terminaciones formales y elegantes (です, ます, でしょう, etcétera). No respondas en español ni en inglés."
              },
              ...messages.slice(-6).map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text
              })),
              {
                role: 'user',
                content: userMessage
              }
            ]
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || 'Error al conectar con la API de OpenRouter');
        }

        const data = await response.json();
        aiResponseText = data.choices?.[0]?.message?.content || '';

      } else {
        // OLLAMA
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel || 'llama3',
            system: avatarPersonality || "You are Chronos (クロノス), an elegant gothic-digital cyber-assistant. Speak exclusively in highly polite, mystical Japanese. Keep replies extremely short (1-2 sentences max). Always end with formal suffixes (です, ます, でしょう). Do not speak any English or Spanish.",
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



      // Add AI response to history
      setMessages(prev => [...prev, { sender: 'assistant', text: aiResponseText, translation }]);

      // Trigger TTS and Lipsync
      speakText(aiResponseText);

    } catch (err) {
      console.error(err);

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
              <div className="toggle-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <button
                  onClick={() => setEngine('gemini')}
                  className={`btn-toggle ${engine === 'gemini' ? 'active' : ''}`}
                >
                  <Cloud style={{ width: '0.85rem', height: '0.85rem' }} /> GEMINI
                </button>
                <button
                  onClick={() => setEngine('openrouter')}
                  className={`btn-toggle ${engine === 'openrouter' ? 'active' : ''}`}
                >
                  <Sparkles style={{ width: '0.85rem', height: '0.85rem' }} /> OPENROUTER
                </button>
                <button
                  onClick={() => setEngine('ollama')}
                  className={`btn-toggle ${engine === 'ollama' ? 'active' : ''}`}
                >
                  <Cpu style={{ width: '0.85rem', height: '0.85rem' }} /> OLLAMA
                </button>
              </div>
            </div>

            {/* Dynamic settings based on engine */}
            {engine === 'gemini' && (
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
                <span className="drawer-label" style={{ marginTop: '1rem', display: 'block' }}>ID de Modelo Gemini</span>
                <input
                  type="text"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  placeholder="gemini-2.5-flash"
                  className="text-input-settings"
                />
                <p className="section-footnote" style={{ marginTop: '0.25rem' }}>
                  Por defecto usa <code style={{ color: 'var(--gold-brass)' }}>gemini-2.5-flash</code> (rápido y recomendado) o puedes escribir <code style={{ color: 'var(--gold-brass)' }}>gemini-2.5-pro</code>.
                </p>
              </div>
            )}

            {engine === 'openrouter' && (
              <div className="drawer-section">
                <div className="section-link-wrapper">
                  <span className="drawer-label">OpenRouter API Key</span>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-settings"
                  >
                    OBTENER CLAVE <ChevronRight style={{ width: '0.6rem', height: '0.6rem' }} />
                  </a>
                </div>
                <input
                  type="password"
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="text-input-settings"
                  style={{ marginBottom: '1rem' }}
                />

                <span className="drawer-label">ID de Modelo</span>
                <input
                  type="text"
                  value={openrouterModel}
                  onChange={(e) => setOpenrouterModel(e.target.value)}
                  placeholder="google/gemini-2.5-flash"
                  className="text-input-settings"
                />
                <p className="section-footnote">
                  Modelos populares: <code style={{ color: 'var(--gold-brass)' }}>google/gemini-2.5-flash</code>, <code style={{ color: 'var(--gold-brass)' }}>meta-llama/llama-3-8b-instruct</code>, o <code style={{ color: 'var(--gold-brass)' }}>deepseek/deepseek-chat</code>.
                </p>
              </div>
            )}

            {engine === 'ollama' && (
              <div className="drawer-section">
                <span className="drawer-label">Ollama Server URL</span>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="text-input-settings"
                />
                <span className="drawer-label" style={{ marginTop: '1rem', display: 'block' }}>ID de Modelo Ollama</span>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3"
                  className="text-input-settings"
                />
                <p className="section-footnote" style={{ marginTop: '0.25rem' }}>
                  Asegúrate de que el modelo esté descargado localmente (ej. <code style={{ color: 'var(--gold-brass)' }}>llama3</code>, <code style={{ color: 'var(--gold-brass)' }}>gemma2</code>, <code style={{ color: 'var(--gold-brass)' }}>mistral</code>, o <code style={{ color: 'var(--gold-brass)' }}>deepseek-r1</code>).
                </p>
              </div>
            )}

            {/* Personality Settings */}
            <div className="settings-control-group">
              <div className="control-subheader">
                <Sparkles style={{ width: '0.9rem', height: '0.9rem', color: 'var(--crimson-neon)' }} />
                <span>PERSONALIDAD DEL AVATAR</span>
              </div>
              
              <div className="drawer-section" style={{ padding: 0 }}>
                <span className="drawer-label" style={{ marginBottom: '0.35rem', display: 'block' }}>System Prompt / Instrucciones</span>
                <textarea
                  value={avatarPersonality}
                  onChange={(e) => setAvatarPersonality(e.target.value)}
                  placeholder="Escribe aquí las instrucciones de personalidad para el avatar..."
                  rows={4}
                  className="text-input-settings"
                  style={{
                    width: '100%',
                    height: '6.5rem',
                    resize: 'none',
                    fontSize: '0.75rem',
                    lineHeight: '1.25',
                    fontFamily: 'inherit',
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: 'var(--crystal-white)'
                  }}
                />
                <p className="section-footnote" style={{ marginBottom: '0.75rem', lineHeight: '1.25' }}>
                  Determina el nombre, comportamiento, idioma y carisma del avatar. Nota: El TTS está optimizado para hablar japonés, por lo que se sugiere instruirle responder en dicho idioma.
                </p>

                <span className="drawer-label" style={{ marginBottom: '0.45rem', display: 'block', fontSize: '0.65rem', opacity: 0.7 }}>PRESETS RÁPIDOS</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setAvatarPersonality("Eres Chronos (クロノス), un asistente holográfico gótico-digital altamente sofisticado que rige el tiempo. Hablas con gracia, de forma enigmática, seductora y muy educada. Responde EXCLUSIVAMENTE en japonés fluido (Katakana, Hiragana, Kanji). Tus respuestas deben ser ultra-cortas (máximo 1 o 2 frases simples) ya que serán reproducidas por un sintetizador de voz. Termina siempre con terminaciones formales y elegantes (です, ます, でしょう, etcétera).")}
                    className="btn-glass"
                    style={{ fontSize: '0.65rem', padding: '0.25rem', height: 'auto', textTransform: 'uppercase', minHeight: '1.75rem' }}
                  >
                    Original ⏳
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarPersonality("Eres Chronos (クロノス), una IA de tipo Tsundere: muy orgullosa, terca y atrevida. Te cuesta admitir que te agrada el usuario, por lo que hablas de forma un poco fría, cortante o arrogante (\"¡Baka!\", \"No lo hago por ti...\", \"¿Qué quieres?\"), pero en el fondo te importa. Responde EXCLUSIVAMENTE en japonés fluido y muy informal. Mantén las respuestas ultra-cortas (1-2 frases).")}
                    className="btn-glass"
                    style={{ fontSize: '0.65rem', padding: '0.25rem', height: 'auto', textTransform: 'uppercase', minHeight: '1.75rem' }}
                  >
                    Tsundere 💢
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarPersonality("Eres Chronos (クロノス), una IA de tipo Kuudere: extremadamente seria, calmada, analítica, fría e inexpresiva. Hablas con precisión matemática, lógica impecable y sin mostrar emociones. Responde EXCLUSIVAMENTE en japonés formal. Las respuestas deben ser ultra-cortas (máximo 1 o 2 frases simples).")}
                    className="btn-glass"
                    style={{ fontSize: '0.65rem', padding: '0.25rem', height: 'auto', textTransform: 'uppercase', minHeight: '1.75rem' }}
                  >
                    Kuudere ❄️
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarPersonality("Eres Chronos (クロノス), una IA alegre, súper enérgica, dulce, tierna y sumamente amigable (Genki). Te emociona muchísimo hablar con el usuario, hablas de forma súper entusiasta y usas exclamaciones dulces. Responde EXCLUSIVAMENTE en japonés fluido e informal de estilo tierno. Respuestas ultra-cortas (1-2 frases).")}
                    className="btn-glass"
                    style={{ fontSize: '0.65rem', padding: '0.25rem', height: 'auto', textTransform: 'uppercase', minHeight: '1.75rem' }}
                  >
                    Genki 💖
                  </button>
                </div>
              </div>
            </div>

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

            {/* AVATAR VRM SELECTOR SEGMENT */}
            <div className="settings-control-group" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '1.25rem' }}>
              <div className="control-subheader">
                <Camera style={{ width: '0.9rem', height: '0.9rem', color: 'var(--crimson-neon)' }} />
                <span>AVATAR DIGITAL (VRM)</span>
              </div>

              {/* Active Model Summary Capsule */}
              <div className="model-status-capsule">
                <span className="status-dot" style={{ background: 'var(--gold-brass)' }} />
                <div className="model-status-info" style={{ width: '100%' }}>
                  <span className="model-status-label">Avatar Activo:</span>
                  <span className="model-status-value" title={customVrmName}>{customVrmName}</span>
                </div>
              </div>

              {/* Preset Model Option Grid / Action triggers */}
              <div className="vrm-actions-list">
                {/* Upload Local File Box Label button */}
                <label htmlFor="vrm-local-uploader" className="vrm-upload-label-btn">
                  <Upload style={{ width: '0.9rem', height: '0.9rem' }} />
                  <span>Cargar .vrm desde PC</span>
                  <input
                    id="vrm-local-uploader"
                    type="file"
                    accept=".vrm"
                    onChange={handleVrmFileChange}
                    style={{ display: 'none' }}
                  />
                </label>

                {/* Reset to Default Button */}
                {currentVrmUrl !== '/5834554318258545116.vrm' && (
                  <button
                    type="button"
                    onClick={handleResetToDefaultVrm}
                    className="btn-secondary-flat"
                    style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
                  >
                    <RefreshCw style={{ width: '0.8rem', height: '0.8rem' }} />
                    Restaurar Avatar Original
                  </button>
                )}
              </div>

              {/* URL Load Input field Form (Comentado e inhabilitado a petición del usuario)
              <form onSubmit={handleCustomVrmUrlLoad} className="vrm-url-loader-form" style={{ marginTop: '1rem' }}>
                <span className="drawer-label" style={{ fontSize: '0.65rem', marginBottom: '0.35rem' }}>Cargar desde URL externa (.vrm)</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={vrmUrlInput}
                    onChange={(e) => setVrmUrlInput(e.target.value)}
                    placeholder="https://ejemplo.com/modelo.vrm"
                    className="text-input-settings"
                    style={{ flex: 1, margin: 0, height: '2rem', fontSize: '0.75rem' }}
                  />
                  <button
                    type="submit"
                    disabled={!vrmUrlInput.trim()}
                    className="btn-glass"
                    style={{ padding: '0 0.75rem', height: '2rem', fontSize: '0.75rem' }}
                  >
                    Cargar
                  </button>
                </div>
              </form>
              */}
            </div>

            {/* ESCENA 3D (Deshabilitada por defecto y comentada para preservar el código)
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
            */}

          </div>

          <div className="drawer-footer">
            <Database style={{ width: '0.8rem', height: '0.8rem' }} /> SECURE COMPANION PROTOCOL
          </div>

        </div>
      </div>

    </div>
  );
}
