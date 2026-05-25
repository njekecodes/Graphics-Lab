// setup the HTML Cavas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// Initialise game variables
let score = 0;
let gameRunning = true;
let roadOffset = 0;        // For scrolling road animation
let gameSpeed = 3;         // How fast the world scrolls toward player
let obstacles = [];        // Array of obstacle objects
let spawnTimer = 0;        // Controls when new obstacles appear
let keys = { left: false, right: false };

// Player car
const player = {
    x: CANVAS_WIDTH / 2,   // World position X (will be transformed to screen space)
    y: CANVAS_HEIGHT - 100, // World position Y
    width: 40,
    height: 70,
    color: '#e74c3c',      // Bright red - cartoonish
    
    // VERTICES in local/model space (centered around 0,0)
    // These define the geometric shape of the car body
    vertices: [
        { x: -20, y: -35 }, // top-left corner
        { x:  20, y: -35 }, // top-right corner
        { x:  20, y:  35 }, // bottom-right corner
        { x: -20, y:  35 }  // bottom-left corner
    ]
};

// Set different types of obstacles
const obstacleTypes = [
    {
        // Traffic cone (triangle)
        type: 'cone',
        color: '#ff8c00',
        vertices: [
            { x:   0, y: -25 }, // top point
            { x:  20, y:  20 }, // bottom-right
            { x: -20, y:  20 }  // bottom-left
        ]
    },
    {
        // Other car (rectangle)
        type: 'car',
        color: '#3498db',
        vertices: [
            { x: -20, y: -30 },
            { x:  20, y: -30 },
            { x:  20, y:  30 },
            { x: -20, y:  30 }
        ]
    },
    {
        // Stone (hexagon)
        type: 'stone',
        color: '#7f8c8d',
        vertices: [
            { x:   0, y: -22 },
            { x:  20, y: -11 },
            { x:  20, y:  11 },
            { x:   0, y:  22 },
            { x: -20, y:  11 },
            { x: -20, y: -11 }
        ]
    }
];

// Transformation Function
function transformVertices(vertices, translateX, translateY, rotation = 0) {
    const transformed = [];
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    for (let v of vertices) {
        // Apply rotation transformation (matrix multiplication)
        const rotatedX = v.x * cos - v.y * sin;
        const rotatedY = v.x * sin + v.y * cos;
        
        // Apply translation transformation
        // Result: vertex position in SCREEN/WORLD space
        transformed.push({
            x: rotatedX + translateX,
            y: rotatedY + translateY
        });
    }
    return transformed;
}

// Drawing Filled Polygons - convert transform 
function rasterizePolygon(vertices, fillColor, strokeColor = '#000', lineWidth = 2) {
    if (vertices.length === 0) return;
    
    ctx.beginPath();
    // Move to first vertex
    ctx.moveTo(vertices[0].x, vertices[0].y);
    
    // Connect all vertices with edges
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    
    // Fill
    ctx.fillStyle = fillColor;
    ctx.fill();
    
    // Stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

//Drawing the Road ★
function drawRoad() {
    // Road surface - large filled rectangle 
    ctx.fillStyle = '#34495e';
    ctx.fillRect(50, 0, CANVAS_WIDTH - 100, CANVAS_HEIGHT);
    
    // Road edges - white solid lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 0, 5, CANVAS_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - 55, 0, 5, CANVAS_HEIGHT);
    
    // Dashed lane markings - each dash is a small rectangle filled with pixels
    ctx.fillStyle = '#f1c40f'; // Yellow lane lines
    const dashHeight = 40;
    const gap = 30;
    const totalDashCycle = dashHeight + gap;
    
    // Two lane divider lines
    for (let lane = 1; lane <= 2; lane++) {
        const xPos = 50 + (CANVAS_WIDTH - 100) * (lane / 3) - 3;
        // Loop creates dashes with scrolling offset
        for (let y = -totalDashCycle + (roadOffset % totalDashCycle); 
             y < CANVAS_HEIGHT; 
             y += totalDashCycle) {
            ctx.fillRect(xPos, y, 6, dashHeight);
        }
    }
}

//Drawing Car Details - windows, wheels, and decorations on top of the car body.
function drawCarDetails(centerX, centerY, isPlayer = true) {
    // Windshield (small rectangle) - positioned relative to car center
    ctx.fillStyle = isPlayer ? '#85c1e9' : '#a9dfbf';
    ctx.fillRect(centerX - 14, centerY - 25, 28, 18);
    
    // Wheels (4 small black rectangles)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(centerX - 24, centerY - 25, 6, 15); // top-left wheel
    ctx.fillRect(centerX + 18, centerY - 25, 6, 15); // top-right wheel
    ctx.fillRect(centerX - 24, centerY + 10, 6, 15); // bottom-left wheel
    ctx.fillRect(centerX + 18, centerY + 10, 6, 15); // bottom-right wheel
    
    // Headlights (yellow circles) 
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(centerX - 12, centerY - 32, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + 12, centerY - 32, 4, 0, Math.PI * 2);
    ctx.fill();
}

//Create new game objects
function spawnObstacle() {
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    const laneX = 80 + Math.random() * (CANVAS_WIDTH - 160);
    obstacles.push({
        x: laneX,
        y: -50,
        type: type.type,
        color: type.color,
        vertices: type.vertices,
        rotation: type.type === 'rock' ? Math.random() * Math.PI * 2 : 0
    });
}

// Detect collisions
function checkCollision(obs) {
    const dx = Math.abs(player.x - obs.x);
    const dy = Math.abs(player.y - obs.y);
    return dx < 35 && dy < 50;
}

// Main game loop

function gameLoop() {
    if (!gameRunning) return;
    
    // Update game state and positions
    // Player movement (left/right only as requested)
    if (keys.left && player.x > 75) player.x -= 5;
    if (keys.right && player.x < CANVAS_WIDTH - 75) player.x += 5;
    
    // Scroll the road
    roadOffset += gameSpeed;
    
    // Move obstacles towards player
    for (let obs of obstacles) {
        obs.y += gameSpeed;
    }
    
    // Remove off-screen obstacles and add score
    obstacles = obstacles.filter(obs => {
        if (obs.y > CANVAS_HEIGHT + 50) {
            score += 10;
            document.getElementById('score').textContent = score;
            return false;
        }
        return true;
    });
    
    // Spawn new obstacles periodically
    spawnTimer++;
    if (spawnTimer > 45) {
        spawnObstacle();
        spawnTimer = 0;
    }
    
    // Gradually increase difficulty
    if (score > 0 && score % 100 === 0) {
        gameSpeed = Math.min(8, 3 + score / 200);
    }
    
    // Check collisions
    for (let obs of obstacles) {
        if (checkCollision(obs)) {
            endGame();
            return;
        }
    }
    
    //Clear the framebuffer ★
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw the road and lane markings
    drawRoad();
    
    // Transform vertices from model space to screen space
    // Fill the resulting polygon with pixels */
    for (let obs of obstacles) {
        // Transform the obstacle's local vertices into screen coordinates by applying translation (and rotation for rocks)
        const transformedVerts = transformVertices(
            obs.vertices, 
            obs.x,           // translate X to world position
            obs.y,           // translate Y to world position
            obs.rotation     // apply rotation (for rocks)
        );
        
        // Convert the transformed polygon vertices into pixels on canvas
        rasterizePolygon(transformedVerts, obs.color, '#2c3e50', 3);
        
        // Add details for car-type obstacles
        if (obs.type === 'car') {
            drawCarDetails(obs.x, obs.y, false);
        }
    }
    
    // Transform player car vertices from local space to screen space
    // by translating them to the player's current world position
    const playerVerts = transformVertices(
        player.vertices,
        player.x,
        player.y,
        0  // no rotation for player car
    );
    
    // Fill the transformed polygon with pixels to draw the car body
    rasterizePolygon(playerVerts, player.color, '#2c3e50', 3);
    
    // Add car details - windshield, wheels, headlights
    drawCarDetails(player.x, player.y, true);
    
    // Continue the loop
    requestAnimationFrame(gameLoop);
}

// Game controls 
function endGame() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
}

function restartGame() {
    score = 0;
    gameSpeed = 3;
    obstacles = [];
    spawnTimer = 0;
    roadOffset = 0;
    player.x = CANVAS_WIDTH / 2;
    document.getElementById('score').textContent = '0';
    document.getElementById('gameOver').style.display = 'none';
    gameRunning = true;
    gameLoop();
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
});

// Start the game
gameLoop();