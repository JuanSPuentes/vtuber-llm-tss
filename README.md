# 🌌 Chronos Nexus: Asistente Holográfico 3D & LLM Companion

Chronos (クロノス) es un asistente holográfico gótico-digital y compañero virtual interactivo en 3D de última generación. Construido sobre un stack moderno que fusiona gráficos 3D en tiempo real, inteligencia artificial generativa y síntesis de voz asíncrona de latencia ultra-baja.

Este proyecto permite interactuar con un modelo avatar 3D en formato `.vrm` que escucha, piensa y responde por voz con sincronización labial automática (lip-sync), adoptando personalidades personalizadas en múltiples idiomas.

---

## 🚀 Características Clave

### 1. Sistema de Voz de Ultra-Baja Latencia (Stream-to-Stream)
* **LLM Token Streaming:** La respuesta de la IA (Gemini, OpenRouter u Ollama) se procesa asíncronamente token por token, escribiéndose en pantalla en tiempo real.
* **Segmentador de Oraciones (Sentence Splitter):** Un algoritmo corta el texto entrante en oraciones en cuanto detecta signos de puntuación finales (`.`, `?`, `!`, `\n`), enviándolas a sintetizar sin esperar a que el LLM termine el párrafo.
* **Cola de Audio Secuencial (Audio Queue):** Encola y pre-carga fragmentos de voz consecutivos de forma transparente para lograr un discurso continuo y fluido sin pausas incómodas.
* **Interrupción Activa:** Si el usuario envía un nuevo mensaje mientras el avatar habla, la voz y el stream de la IA se cancelan instantáneamente mediante un `AbortController`.

### 2. Microservicio de Síntesis Local (Python FastAPI)
* **Transmisión Binaria en Milisegundos:** Un servidor local ligero en Python que recibe texto y transmite los bytes de audio MP3 sobre la marcha (`StreamingResponse`) consumiendo la API de Edge-TTS, logrando latencias de respuesta menores a 200ms.
* **CORS Integrado:** Conexión segura y directa desde el puerto de desarrollo local de Vite.
* **Fallback Local Robusto:** Si el servidor de Python se apaga, el frontend conmuta automáticamente a la síntesis de voz nativa del navegador (`window.speechSynthesis`).

### 3. Renderizado y Animación VRM 3D Profesional
* **Carga de Avatares:** Permite arrastrar e importar tus propios archivos `.vrm` locales o restaurar el modelo gótico por defecto al instante.
* **Física de Resortes (Spring Bones):** Movimiento dinámico natural del cabello, falda y accesorios ante la inercia.
* **Idle Respiración Orgánica:** Animación suave de pose de respiración (*Standing Idle*) que hace sentir al personaje "vivo" y cálido.
* **Cámara Cinemática Centrada:** Encuadre cinemático de plano medio (cintura para arriba) ajustado para centrar el cuerpo del avatar en el viewport de forma premium.

### 4. Sincronización Labial Analítica (Frequency Lip-Sync)
* **Análisis de Frecuencia de Audio:** Utiliza la `Web Audio API` (`AnalyserNode`) para extraer la amplitud y volumen del audio reproducido en tiempo real.
* **Extracción Fonética Occidental:** Mapea frecuencias y caracteres para modelar expresiones blendshape vocálicas (`aa`, `ih`, `oh`, `ee`, `uu`) de forma fluida y natural, compatible con español, inglés y japonés.

### 5. Personalidad Dinámica y Multilingüe
* **Ajustes de Personalidad Presets:** Selector con 4 personalidades clásicas de anime listas para usar: **Original Gótica**, **Tsundere**, **Kuudere** y **Genki**.
* **Personalidad Libre Persistida:** Caja de texto con guardado automático en `localStorage` para definir la personalidad que tú quieras.
* **Soporte Multilingüe Integrado:** Selector para 5 locales de voz: **Japonés**, **Español Latino (MX)**, **Español de España (ES)**, **Inglés (US)** e **Inglés (UK)** con 10 voces premium pre-configuradas de Edge-TTS.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 18, Vite, Three.js, `@pixiv/three-vrm` (Estándar VRM 3D), Vanilla CSS (Estética Glassmorphism).
* **Backend de Voz:** Python 3.11+, FastAPI, Uvicorn, `edge-tts` (Asíncrono con `asyncio`).
* **Motores de IA:** Gemini API (`gemini-2.5-flash`), OpenRouter, Ollama (Modelos locales como `llama3`, `phi3`).

---

## 📂 Estructura del Proyecto

```text
├── Backend/                 # Servidor de Síntesis de Voz en Python
│   ├── tts_env/             # Entorno virtual de Python (aislado)
│   └── tts_server.py        # Microservicio de streaming FastAPI + edge-tts
├── public/                  # Modelos 3D (.vrm), animaciones (.fbx) y texturas
├── src/
│   ├── App.jsx              # Lógica principal, renderizador 3D, WebSocket/Streams y UI
│   ├── App.css              # Estilos góticos, animaciones y diseño Glassmorphism
│   └── main.jsx
├── package.json
└── vite.config.js
```

---

## 🔧 Guía de Instalación y Uso

### Paso 1: Clonar e Instalar dependencias del Frontend
Asegúrate de tener instalado [Node.js](https://nodejs.org/). En la raíz del proyecto, ejecuta:
```bash
npm install
```

### Paso 2: Configurar e Iniciar el Backend de Voz (Python)
El proyecto incluye un entorno virtual en `Backend/tts_env`. 

1. Abre una terminal de PowerShell o CMD en la raíz y activa el entorno:
   * **PowerShell:**
     ```powershell
     .\Backend\tts_env\Scripts\Activate.ps1
     ```
   * **CMD:**
     ```cmd
     .\Backend\tts_env\Scripts\activate.bat
     ```
2. Instala las librerías necesarias:
   ```bash
   pip install fastapi uvicorn edge-tts
   ```
3. Inicia el servidor de FastAPI:
   ```bash
   python -m uvicorn Backend.tts_server:app --port 8000 --reload
   ```
   El backend estará corriendo en `http://127.0.0.1:8000`.

### Paso 3: Iniciar el Frontend (Vite)
En otra terminal en la raíz del proyecto, ejecuta:
```bash
npm run dev
```
Abre tu navegador en `http://localhost:5173` para empezar a interactuar con Chronos.

---

## ⚙️ Configuración del Entorno de Chat

Al abrir la aplicación, despliega el panel de **Ajustes** en el lateral derecho para configurar tus credenciales de IA:
1. **Gemini:** Introduce tu API Key de Google Gemini y selecciona tu modelo favorito (ej: `gemini-2.5-flash`).
2. **OpenRouter:** Ingresa tu clave para usar modelos premium de la nube de forma transparente con streaming.
3. **Ollama:** Si prefieres total privacidad local, enciende Ollama en tu computadora y selecciona el motor local en los ajustes. El sistema se conectará de forma transparente a `http://localhost:11434`.

---

## 🔒 Reglas del Proyecto y Licencia

* **Restricción de Commits Automáticos:** Por políticas expresas del propietario del repositorio, **nunca** se realizan commits automáticos ni se suben cambios sin consentimiento y solicitud explícita del usuario.
