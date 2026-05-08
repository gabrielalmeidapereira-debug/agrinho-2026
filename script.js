const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const COLORS = {
    grass: '#78ab46', grassDark: '#5c8b32', dirt: '#8b5d33', dirtDark: '#6d462a',
    playerShirt: '#3a66cf', playerSkin: '#ffdbac', playerPants: '#2d2d2d',
    houseWall: '#d3a36a', houseRoof: '#a03a3a', farmZone: 'rgba(0, 0, 0, 0.15)',
    bedWood: '#5d4037', bedSheet: '#fdfdfd', bedPillow: '#add8e6'
};

let gameActive = false;
let money = 100;
let gameState = 'EXTERIOR'; 
let selectedSlot = 0; // Controla o slot selecionado na Hotbar (0 a 5)
let invOpen = false, shopOpen = false;

let draggedItemIndex = null;
const dragIcon = document.getElementById('drag-icon');

let objectives = { plant: false, sleep: false, sell: false, rich: false };

let player = { x: 400, y: 300, w: 26, h: 40, speed: 3.5 };
const houseRect = { x: 340, y: 80, w: 120, h: 100 };
const bedRect = { x: 30, y: 30, w: 60, h: 90 };
const compRect = { x: 180, y: 40, w: 45, h: 45 }; 

const grassTufts = [];
for(let i=0; i<100; i++) grassTufts.push({x: Math.random()*800, y: Math.random()*600, s: Math.random()*3 + 2});

let inventory = [
    { id: 'hoe', icon: '⛏️', type: 'tool' },
    { id: 'water', icon: '💧', type: 'tool' },
    { id: 'seed_wheat', icon: '🌱', type: 'seed', name: 'Trigo', count: 5, cropIcon: '🌾' },
    null, null, null, null, null, null, null, null, null
];

let farmTiles = [];
for(let x=250; x<550; x+=50) {
    for(let y=250; y<450; y+=50) farmTiles.push({ x, y, state: 0, cropIcon: '' }); 
}

const keys = {};

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    document.getElementById('hotbar').classList.remove('hidden');
    document.getElementById('objectives-panel').classList.remove('hidden');
    gameActive = true;
    updateObjectives();
}

function showControls() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('controls-screen').classList.remove('hidden');
}

function showMenu() {
    document.getElementById('controls-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

function updateObjectives() {
    if (money >= 1000) objectives.rich = true;
    const list = document.getElementById('obj-list');
    const items = [
        { key: objectives.plant, text: "Arar, plantar e regar" },
        { key: objectives.sleep, text: "Dormir na cama" },
        { key: objectives.sell, text: "Colher e vender" },
        { key: objectives.rich, text: "Conseguir 1000G" }
    ];
    list.innerHTML = items.map(i => `<div class="obj-item ${i.key ? 'obj-done' : ''}">${i.key ? '✅' : '⬜'} ${i.text}</div>`).join('');
    
    if (Object.values(objectives).every(v => v === true)) {
        gameActive = false;
        document.getElementById('end-screen').classList.remove('hidden');
    }
}

// DRAG AND DROP
function onSlotMouseDown(index) {
    if (inventory[index]) {
        draggedItemIndex = index;
        dragIcon.innerText = inventory[index].icon;
        dragIcon.style.display = 'block';
        renderUI();
    }
}

window.addEventListener('mousemove', (e) => {
    if (draggedItemIndex !== null) {
        dragIcon.style.left = (e.clientX - 15) + 'px';
        dragIcon.style.top = (e.clientY - 15) + 'px';
    }
});

window.addEventListener('mouseup', (e) => {
    if (draggedItemIndex !== null) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const slot = target ? target.closest('.slot') : null;
        if (slot && slot.dataset.index !== undefined) {
            const targetIndex = parseInt(slot.dataset.index);
            const temp = inventory[targetIndex];
            inventory[targetIndex] = inventory[draggedItemIndex];
            inventory[draggedItemIndex] = temp;
        }
        draggedItemIndex = null;
        dragIcon.style.display = 'none';
        renderUI();
    }
});

// INPUT DE TECLADO
window.onkeydown = (e) => {
    if(!gameActive) return;
    keys[e.key.toLowerCase()] = true;
    
    // Seleção numérica (1-6)
    if (!isNaN(e.key) && e.key > 0 && e.key <= 6) selectedSlot = parseInt(e.key) - 1;
    
    // NOVO: Seleção por setas
    if (e.key === "ArrowLeft") {
        selectedSlot = (selectedSlot > 0) ? selectedSlot - 1 : 5;
    }
    if (e.key === "ArrowRight") {
        selectedSlot = (selectedSlot < 5) ? selectedSlot + 1 : 0;
    }

    if (e.key === 'i') { 
        invOpen = !invOpen; 
        document.getElementById('inventory-tab').classList.toggle('hidden'); 
        draggedItemIndex = null;
    }
    if (e.key === 'e') handleInteraction();
    if (e.key === 'escape') { invOpen = false; shopOpen = false; document.querySelectorAll('#inventory-tab, #shop-screen').forEach(el => el.classList.add('hidden')); }
    renderUI();
};

window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

canvas.addEventListener('mousedown', (e) => {
    if(!gameActive || invOpen || shopOpen) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (gameState === 'EXTERIOR') {
        farmTiles.forEach(tile => {
            if(mx > tile.x && mx < tile.x + 50 && my > tile.y && my < tile.y + 50) {
                const item = inventory[selectedSlot];
                if (tile.state === 4) {
                    addInventoryItem({ id: 'crop', icon: tile.cropIcon, type: 'crop' });
                    tile.state = 0; tile.cropIcon = '';
                } else if (item) {
                    if (item.id === 'hoe' && tile.state === 0) tile.state = 1;
                    else if (item.type === 'seed' && tile.state === 1) { 
                        tile.state = 2; tile.cropIcon = item.cropIcon;
                        item.count--; if(item.count <= 0) inventory[selectedSlot] = null;
                    } 
                    else if (item.id === 'water' && tile.state === 2) { 
                        tile.state = 3; objectives.plant = true; 
                    }
                }
            }
        });
    }
    updateObjectives();
    renderUI();
});

function handleInteraction() {
    if (gameState === 'EXTERIOR' && isNear(player, houseRect)) {
        gameState = 'INTERIOR'; player.x = 400; player.y = 550;
    } else if (gameState === 'INTERIOR') {
        if (isNear(player, compRect)) toggleShop();
        if (isNear(player, bedRect)) { sleep(); objectives.sleep = true; }
    }
    updateObjectives();
}

function isNear(p, obj) { return p.x < obj.x + obj.w + 20 && p.x + p.w > obj.x - 20 && p.y < obj.y + obj.h + 20 && p.y + p.h > obj.y - 20; }

function toggleShop() {
    shopOpen = !shopOpen;
    document.getElementById('shop-screen').classList.toggle('hidden');
    if(shopOpen) showShopTab('buy');
}

function showShopTab(tab) {
    const cont = document.getElementById('shop-content');
    cont.innerHTML = '';
    if(tab === 'buy') {
        const seeds = [{n:'Trigo', p:5, icon:'🌾'}, {n:'Milho', p:12, icon:'🌽'}, {n:'Melão', p:30, icon:'🍈'}];
        seeds.forEach(s => {
            cont.innerHTML += `<div class="item-row">${s.n} ${s.icon} (G$ ${s.p}) <button onclick="buyItem('${s.n}', ${s.p}, '${s.icon}')">Comprar</button></div>`;
        });
    } else {
        const crops = inventory.filter(i => i && i.type === 'crop');
        cont.innerHTML = `<button onclick="sellAllCrops()" class="close-btn" style="background:#4CAF50">Vender Tudo (${crops.length} itens)</button>`;
    }
}

window.buyItem = (n, p, icon) => {
    if(money >= p) { money -= p; addInventoryItem({id:'seed', icon:'🌱', type:'seed', name: n, count: 1, cropIcon: icon}); renderUI(); showShopTab('buy'); }
    updateObjectives();
};

window.sellAllCrops = () => {
    let sold = false;
    inventory = inventory.map(item => {
        if (item && item.type === 'crop') { money += 150; sold = true; return null; }
        return item;
    });
    if(sold) objectives.sell = true;
    updateObjectives(); renderUI(); showShopTab('sell');
};

function addInventoryItem(newItem) {
    for(let i=0; i<inventory.length; i++) { if(!inventory[i]) { inventory[i] = newItem; return; } }
}

function sleep() {
    ctx.fillStyle = 'black'; ctx.fillRect(0,0,800,600);
    setTimeout(() => { farmTiles.forEach(t => { if(t.state === 3) t.state = 4; }); renderUI(); }, 600);
}

function update() {
    if (!gameActive || invOpen || shopOpen) return;
    let nX = player.x, nY = player.y;
    if (keys['w']) nY -= player.speed; if (keys['s']) nY += player.speed;
    if (keys['a']) nX -= player.speed; if (keys['d']) nX += player.speed;

    if (gameState === 'EXTERIOR') {
        if (nX < houseRect.x + houseRect.w && nX + player.w > houseRect.x && nY < houseRect.y + houseRect.h && nY + player.h > houseRect.y) return;
        if (nX < 0 || nX + player.w > 800 || nY < 0 || nY + player.h > 600) return;
    } else {
        if (nX < 10 || nX + player.w > 790) return;
        if (nY < 60) return;
        if (nY > 585) { gameState = 'EXTERIOR'; player.x = 400; player.y = 200; return; }
    }
    player.x = nX; player.y = nY;
}

function renderUI() {
    const hb = document.getElementById('hotbar'), ig = document.getElementById('inventory-grid');
    hb.innerHTML = ig.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const item = inventory[i];
        const isDragging = draggedItemIndex === i;
        const content = (item && !isDragging) ? `${item.icon}${item.count > 1 ? `<small>${item.count}</small>` : ''}` : '';
        const html = `<div class="slot ${i === selectedSlot ? 'selected' : ''} ${isDragging ? 'dragging' : ''}" data-index="${i}" onmousedown="onSlotMouseDown(${i})" onclick="selectedSlot=${i};renderUI()">${content}</div>`;
        if(i < 6) hb.innerHTML += html;
        ig.innerHTML += html;
    }
    document.getElementById('moneyText').innerText = money;
}

function drawBed(x, y, w, h) {
    ctx.fillStyle = COLORS.bedWood;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.bedSheet;
    ctx.fillRect(x + 4, y + 20, w - 8, h - 24);
    ctx.fillStyle = COLORS.bedPillow;
    ctx.fillRect(x + 8, y + 4, w - 16, 14);
}

function drawPlayer(x, y) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 4, y + 34, 6, 6);
    ctx.fillRect(x + 16, y + 34, 6, 6);
    ctx.fillStyle = COLORS.playerPants;
    ctx.fillRect(x + 4, y + 25, 18, 10);
    ctx.fillStyle = COLORS.playerShirt;
    ctx.fillRect(x + 2, y + 12, 22, 14);
    ctx.fillStyle = COLORS.playerSkin;
    ctx.fillRect(x + 5, y, 16, 14);
    ctx.fillStyle = '#63422b';
    ctx.fillRect(x + 5, y - 2, 16, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 8, y + 5, 2, 2);
    ctx.fillRect(x + 16, y + 5, 2, 2);
}

function drawHouse(x, y, w, h) {
    ctx.fillStyle = COLORS.houseWall;
    ctx.fillRect(x, y + 30, w, h - 30);
    ctx.strokeStyle = '#8b5d33';
    ctx.strokeRect(x, y+30, w, h-30);
    ctx.fillStyle = COLORS.houseRoof;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 35);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w + 10, y + 35);
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x + w/2 - 15, y + h - 40, 30, 40);
    ctx.fillStyle = '#add8e6';
    ctx.fillRect(x + 15, y + 50, 25, 25);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x + 15, y + 50, 25, 25);
}

function draw() {
    ctx.clearRect(0,0,800,600);
    const prompt = document.getElementById('interaction-prompt');
    prompt.classList.add('hidden');

    if (gameState === 'EXTERIOR') {
        ctx.fillStyle = COLORS.grass; ctx.fillRect(0,0,800,600);
        ctx.fillStyle = COLORS.grassDark;
        grassTufts.forEach(t => ctx.fillRect(t.x, t.y, t.s, t.s));
        ctx.fillStyle = COLORS.farmZone; ctx.fillRect(245, 245, 310, 210);
        farmTiles.forEach(t => {
            ctx.fillStyle = [COLORS.grassDark, COLORS.dirt, COLORS.dirtDark, '#3a5a2a', '#ffd700'][t.state];
            ctx.fillRect(t.x, t.y, 48, 48);
            if(t.state === 4) { ctx.font = "30px Arial"; ctx.fillText(t.cropIcon, t.x + 10, t.y + 35); }
        });
        drawHouse(houseRect.x, houseRect.y, houseRect.w, houseRect.h);
        if(gameActive && isNear(player, houseRect)) { prompt.classList.remove('hidden'); prompt.innerText = "E para entrar"; }
    } else {
        ctx.fillStyle = '#5d4037'; ctx.fillRect(0,0,800,600);
        drawBed(bedRect.x, bedRect.y, bedRect.w, bedRect.h);
        ctx.fillStyle = '#333'; ctx.fillRect(compRect.x, compRect.y, compRect.w, compRect.h);
        ctx.fillStyle = '#0f0'; ctx.fillRect(compRect.x+5, compRect.y+5, 35, 20);
        if(isNear(player, compRect)) { prompt.classList.remove('hidden'); prompt.innerText = "E para o Computador"; }
        else if(isNear(player, bedRect)) { prompt.classList.remove('hidden'); prompt.innerText = "E para Dormir"; }
    }
    
    drawPlayer(player.x, player.y);
    update();
    requestAnimationFrame(draw);
}

draw(); renderUI();