// DOM elements
const videoElement = document.getElementById('video_input');
const canvasElement = document.getElementById('output_canvas');
const snapButton = document.getElementById('snap_button');
const resetButton = document.getElementById('reset_button');
const statusElement = document.getElementById('status');

// Canvas context
const canvasCtx = canvasElement.getContext('2d');
canvasElement.width = 640;
canvasElement.height = 480;

// Variables for hand tracking
let handLandmarks = null;
let previousFingerDistance = 0;
let snapCooldown = false;
let dustMode = false;

// Variables for particles
let particles = [];
let silhouetteImage = null;

// Status updates
function updateStatus(message) {
    statusElement.textContent = message;
    console.log(message);
}

// Initialize MediaPipe Hands
updateStatus("Setting up hand tracking...");
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Process results from MediaPipe
hands.onResults((results) => {
    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (!dustMode) {
        // Draw camera feed
        canvasCtx.drawImage(
            results.image, 0, 0, canvasElement.width, canvasElement.height
        );
        
        // Check if hands are detected
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            updateStatus("Hand detected");
            handLandmarks = results.multiHandLandmarks;
            
            // Draw hands
            for (const landmarks of results.multiHandLandmarks) {
                // Draw connections
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, 
                    {color: '#00FF00', lineWidth: 5});
                
                // Draw landmarks
                drawLandmarks(canvasCtx, landmarks, 
                    {color: '#FF0000', lineWidth: 2});
                
                // Create silhouette
                createSilhouette(landmarks);
            }
            
            // Detect snap gesture
            if (results.multiHandLandmarks[0]) {
                detectSnapGesture(results.multiHandLandmarks[0]);
            }
        } else {
            updateStatus("No hand detected");
            handLandmarks = null;
        }
    } else {
        // We're in dust mode, update particles
        updateParticles();
    }
});

// Setup camera
updateStatus("Starting camera...");
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});

camera.start()
    .then(() => {
        updateStatus("Camera started. Show your hand and make a snap gesture.");
    })
    .catch(error => {
        updateStatus("Camera error: " + error.message);
    });

// Create silhouette from hand landmarks
function createSilhouette(landmarks) {
    // Make a copy of the canvas with just the hand
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasElement.width;
    tempCanvas.height = canvasElement.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw hand as black silhouette
    tempCtx.fillStyle = 'black';
    tempCtx.strokeStyle = 'black';
    tempCtx.lineWidth = 15;
    
    // Connect landmarks to form a hand shape
    const connections = [
        // Thumb
        [0, 1], [1, 2], [2, 3], [3, 4],
        // Index finger
        [0, 5], [5, 6], [6, 7], [7, 8],
        // Middle finger
        [0, 9], [9, 10], [10, 11], [11, 12],
        // Ring finger
        [0, 13], [13, 14], [14, 15], [15, 16],
        // Pinky finger
        [0, 17], [17, 18], [18, 19], [19, 20],
        // Palm connections
        [0, 5], [5, 9], [9, 13], [13, 17]
    ];
    
    // Draw each connection
    tempCtx.beginPath();
    for (const [i, j] of connections) {
        const start = landmarks[i];
        const end = landmarks[j];
        
        tempCtx.moveTo(
            start.x * canvasElement.width,
            start.y * canvasElement.height
        );
        tempCtx.lineTo(
            end.x * canvasElement.width,
            end.y * canvasElement.height
        );
    }
    tempCtx.stroke();
    
    // Fill palm area
    tempCtx.beginPath();
    const palmPoints = [0, 5, 9, 13, 17].map(i => landmarks[i]);
    tempCtx.moveTo(
        palmPoints[0].x * canvasElement.width,
        palmPoints[0].y * canvasElement.height
    );
    for (let i = 1; i < palmPoints.length; i++) {
        tempCtx.lineTo(
            palmPoints[i].x * canvasElement.width,
            palmPoints[i].y * canvasElement.height
        );
    }
    tempCtx.fill();
    
    // Draw circles at each landmark
    for (const landmark of landmarks) {
        tempCtx.beginPath();
        tempCtx.arc(
            landmark.x * canvasElement.width,
            landmark.y * canvasElement.height,
            10, 0, 2 * Math.PI);
        tempCtx.fill();
    }
    
    // Store the silhouette image
    silhouetteImage = tempCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
}

// Detect snap gesture
function detectSnapGesture(landmarks) {
    if (snapCooldown || dustMode) return;
    
    // Get thumb tip and index finger tip
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    // Calculate distance between thumb and index finger
    const distance = Math.hypot(
        (thumbTip.x - indexTip.x) * canvasElement.width,
        (thumbTip.y - indexTip.y) * canvasElement.height
    );
    
    // Log distances for debugging
    updateStatus(`Finger distance: ${distance.toFixed(1)}, Previous: ${previousFingerDistance.toFixed(1)}`);
    
    // Detect snap (finger distance suddenly becomes small)
    if (previousFingerDistance > 0) {
        if (previousFingerDistance > 50 && distance < 20) {
            updateStatus("SNAP DETECTED!");
            triggerDustEffect();
            
            // Set cooldown
            snapCooldown = true;
            setTimeout(() => {
                snapCooldown = false;
            }, 1000);
        }
    }
    
    // Store current distance for next frame
    previousFingerDistance = distance;
}

// Trigger dust effect 
function triggerDustEffect() {
    if (!silhouetteImage) {
        updateStatus("No silhouette to turn to dust!");
        return;
    }
    
    dustMode = true;
    updateStatus("Dust effect triggered!");
    
    // Initialize physics engine (Matter.js)
    // This is where you'll implement the physics engine setup
    
    // Create particles from silhouette
    createParticlesFromSilhouette();
}

// Create particles from silhouette
function createParticlesFromSilhouette() {
    // TODO: Implement particle creation from silhouette
    // This is where you'll implement the particle creation
    
    // Placeholder for now - just draw a black rectangle
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Reset after 3 seconds for testing
    setTimeout(resetEffect, 3000);
}

// Update particles
function updateParticles() {
    // TODO: Implement particle updating with physics
    // This is where you'll implement the particle physics updates
}

// Reset effect
function resetEffect() {
    dustMode = false;
    particles = [];
    updateStatus("Effect reset. Show your hand and make a snap gesture.");
}

// Manual snap button
snapButton.addEventListener('click', () => {
    triggerDustEffect();
});

// Reset button
resetButton.addEventListener('click', () => {
    resetEffect();
});