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
  Database
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
  const vrmPosX = -0.16;
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
  const animationFrameIdRef = useRef(null);
  const cameraRef = useRef(null);
  const mouseCoordsRef = useRef({ x: 0, y: 0 });

  const vrmMixerRef = useRef(null);

  // Audio / Voice Refs
  const speechUtteranceRef = useRef(null);
  const currentSpeakingVolumeRef = useRef(0);

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

  // Load and apply the default FBX Pose
  const loadFbxPose = (vrmInstance, onComplete) => {
    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      '/Female Standing Pose.fbx',
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
    voiceVolume,
    voiceRate,
    voicePitch,
    orbitControlsEnabled
  ]);

  // Reset Camera to focus on the facial framing center of the VRM
  const resetCameraToCinematic = () => {
    if (cameraRef.current && controlsRef.current) {
      controlsRef.current.target.set(0.0, 1.45 + vrmPosY, vrmPosZ);
      cameraRef.current.position.set(0.0, 1.48 + vrmPosY, 0.75 + vrmPosZ);
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

    // GLTF LOADER WITH VRM PLUGIN
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      '/5834554318258545116.vrm',
      (gltf) => {
        const vrm = gltf.userData.vrm;
        vrmRef.current = vrm;
        scene.add(vrm.scene);

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

        // Load the default FBX Standing pose as the initial pose, then start the loop!
        loadFbxPose(vrm, () => {
          requestAnimationFrame((t) => {
            lastTime = t * 0.001;
            animate(t);
          });
        });
      },
      (xhr) => {
        const progress = Math.round((xhr.loaded / xhr.total) * 100);
        setLoadProgress(progress);
      },
      (error) => {
        console.error('Error loading VRM model:', error);
      }
    );

    // Animation organic loops & timers
    let lastTime = 0;
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

        // 5. Expression Layer: Organic Multi-Phoneme Lip-Sync & Breathing Micro-Smile
        let targetA = 0;
        let targetI = 0;
        let targetO = 0;
        let targetE = 0;
        let targetU = 0;
        let targetSmile = 0.15; // CONSTANT CUTE MICRO-SMILE BASE TO ELIMINATE DEADPAN EXPRESSIONS

        if (isSpeaking) {
          // Dynamic volume modifier with subtle natural noise/fluctuation
          const volumeFactor = currentSpeakingVolumeRef.current * (0.8 + Math.random() * 0.4);
          
          // Generate organic vowel wave phases to simulate realistic phonemic shifts
          const speed = 15.0;
          const waveA = Math.max(0, Math.sin(elapsed * speed * 0.9));
          const waveI = Math.max(0, Math.sin(elapsed * speed * 1.3 + 1.2));
          const waveO = Math.max(0, Math.cos(elapsed * speed * 0.7 + 2.5));
          const waveE = Math.max(0, Math.sin(elapsed * speed * 1.1 + 0.8));
          const waveU = Math.max(0, Math.cos(elapsed * speed * 1.6 + 3.1));

          // Set vowel targets
          targetA = waveA * volumeFactor * 0.75;
          targetI = waveI * volumeFactor * 0.50;
          targetO = waveO * volumeFactor * 0.65;
          targetE = waveE * volumeFactor * 0.55;
          targetU = waveU * volumeFactor * 0.40;
          
          // Smile slightly more when speaking cheerfully!
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
                content: "Eres Chronos (クロノス), un asistente holográfico gótico-digital altamente sofisticado que rige el tiempo. Hablas con gracia, de forma enigmática, seductora y muy educada. Responde EXCLUSIVAMENTE en japonés fluido (Katakana, Hiragana, Kanji). Tus respuestas deben ser ultra-cortas (máximo 1 o 2 frases simples). Termina siempre con terminaciones formales y elegantes (です, ます, でしょう, etcétera). No respondas en español ni en inglés."
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
                <p className="section-footnote">
                  La API Key se guarda localmente en tu navegador de forma segura.
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
