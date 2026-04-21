// ============================================================================
// Blockchain Transaction Network - 3D Force-Directed Graph with Particle Flow
// ============================================================================

// Global state
let scene, camera, renderer;
let nodes = [];
let links = [];
let particles = [];
let allTransactions = [];
let filteredTransactions = [];
let autoRotate = true;
let nodeObjects = new Map();
let linkObjects = [];
let generateInterval = null;

// Three.js groups
let nodeGroup, linkGroup, particleGroup;

// D3 force simulation
let simulation;

// Mouse
let previousMousePosition = { x: 0, y: 0 };
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// Camera zoom animation
let isZooming = false;
let zoomStartPos = null;
let zoomTargetPos = null;
let zoomProgress = 0;
let previousCameraPos = null;

// Token & address pools for random generation
const TOKENS = ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'MATIC', 'BNB', 'DOGE', 'ADA', 'LINK', 'AVAX', 'XRP', 'DAI'];
let addressPool = [];

// ============================================================================
// Anomaly Detection Engine — global state
// ============================================================================
let anomalyScores = new Map(); // address -> { score, flags }
let anomalyAlerts = [];
let riskRingGroup = null;

// ============================================================================
// Initialization
// ============================================================================

function updateLoadingStatus(msg) {
    const el = document.getElementById('loadingStatus');
    if (el) el.textContent = msg;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        updateLoadingStatus('Initializing 3D scene...');
        init3DScene();

        updateLoadingStatus('Loading transaction data...');
        await loadTransactionData();

        updateLoadingStatus('Building network (' + allTransactions.length + ' transactions)...');
        buildNetwork();

        setupEventListeners();

        updateLoadingStatus('Rendering...');
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
        }, 400);

        animate();
        startGeneratingTransactions();
    } catch (err) {
        console.error('Init error:', err);
        updateLoadingStatus('Error — check console');
    }
});

// ============================================================================
// 3D Scene
// ============================================================================

function init3DScene() {
    const container = document.getElementById('network');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 800, 2500);

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 5000);
    camera.position.set(0, 0, 800);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const p1 = new THREE.PointLight(0x3b82f6, 1, 1500);
    p1.position.set(300, 300, 300);
    scene.add(p1);
    const p2 = new THREE.PointLight(0x10b981, 0.8, 1500);
    p2.position.set(-300, -300, -300);
    scene.add(p2);

    nodeGroup = new THREE.Group();
    linkGroup = new THREE.Group();
    particleGroup = new THREE.Group();
    scene.add(linkGroup);
    scene.add(nodeGroup);
    scene.add(particleGroup);

    // Wireframe sphere reference
    const wireGeo = new THREE.SphereGeometry(600, 32, 32);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, wireframe: true, transparent: true, opacity: 0.08 });
    scene.add(new THREE.Mesh(wireGeo, wireMat));

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    setupManualControls();
    setupMouseInteraction();
}

// ============================================================================
// Data Loading — mock_transactions.json first
// ============================================================================

async function loadTransactionData() {
    try {
        const resp = await fetch('data/mock_transactions.json');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        allTransactions = (data.features || []).map(f => ({ ...f }));
    } catch (e) {
        console.warn('Could not load mock data, generating samples:', e.message);
        allTransactions = [];
        generateSampleBatch(60);
    }

    // Build address pool from loaded data
    allTransactions.forEach(tx => {
        if (!addressPool.includes(tx.properties.from)) addressPool.push(tx.properties.from);
        if (!addressPool.includes(tx.properties.to)) addressPool.push(tx.properties.to);
    });

    // Sort by time
    allTransactions.sort((a, b) => a.properties.timestamp - b.properties.timestamp);
    filteredTransactions = [...allTransactions];
}

function generateSampleBatch(count) {
    for (let i = 0; i < count; i++) {
        allTransactions.push(createRandomTransaction());
    }
}

function randomHex(len) {
    let s = '';
    for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
}

function createRandomTransaction() {
    // Reuse existing addresses 70% of the time, create new ones 30%
    let from, to;
    if (addressPool.length > 2 && Math.random() < 0.7) {
        from = addressPool[Math.floor(Math.random() * addressPool.length)];
    } else {
        from = '0x' + randomHex(40);
        addressPool.push(from);
    }
    if (addressPool.length > 2 && Math.random() < 0.7) {
        to = addressPool[Math.floor(Math.random() * addressPool.length)];
    } else {
        to = '0x' + randomHex(40);
        addressPool.push(to);
    }
    // Ensure from !== to
    if (from === to) {
        to = '0x' + randomHex(40);
        addressPool.push(to);
    }

    const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    const amount = parseFloat((Math.random() * 50).toFixed(4));
    const feeCount = 2 + Math.floor(Math.random() * 4);
    const feeHistory = Array.from({ length: feeCount }, () => parseFloat((Math.random() * 0.002).toFixed(6)));

    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {
            txHash: '0x' + randomHex(64),
            from,
            to,
            token,
            amount,
            feeHistory,
            timestamp: Date.now() - Math.floor(Math.random() * 86400000 * 7)
        }
    };
}

// ============================================================================
// Network Building
// ============================================================================

function buildNetwork() {
    clearNetwork();

    const addressSet = new Set();
    const addressStats = new Map();

    filteredTransactions.forEach(tx => {
        const p = tx.properties;
        [p.from, p.to].forEach(addr => {
            addressSet.add(addr);
            if (!addressStats.has(addr)) addressStats.set(addr, { count: 0, total: 0 });
            const s = addressStats.get(addr);
            s.count++;
            s.total += p.amount;
        });
    });

    const sorted = Array.from(addressSet).map(addr => {
        const s = addressStats.get(addr);
        return { addr, count: s.count, total: s.total };
    }).sort((a, b) => b.count - a.count);

    // Place nodes on a sphere
    const SPHERE_R = 500;
    nodes = sorted.map((item, i) => {
        const phi = Math.acos(1 - 2 * (i + 0.5) / sorted.length);   // Fibonacci-ish
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const r = SPHERE_R * (0.4 + 0.6 * Math.random());

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        return {
            id: item.addr,
            x, y, z,
            fx: x, fy: y, fz: z,
            transactions: item.count,
            totalAmount: item.total
        };
    });

    links = filteredTransactions.map(tx => ({
        source: tx.properties.from,
        target: tx.properties.to,
        transaction: tx.properties
    }));

    // D3 simulation (2D only — we keep z fixed)
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.02))
        .alphaDecay(0.05)
        .on('tick', syncPositions);

    createNodeMeshes();
    createLinkLines();
    updateTimelineLabels();
    detectAnomalies();
}

function clearNetwork() {
    nodes = [];
    links = [];
    linkObjects = [];
    nodeObjects.clear();
    particles.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
    particles = [];
    [nodeGroup, linkGroup, particleGroup].forEach(g => {
        while (g && g.children.length) {
            const c = g.children[0];
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
            g.remove(c);
        }
    });
    if (simulation) simulation.stop();
}

function colorByAmount(amt) {
    if (amt === 0) return 0x6b7280;
    if (amt < 1) return 0x10b981;
    if (amt < 10) return 0xfbbf24;
    if (amt < 100) return 0xf97316;
    return 0xef4444;
}

function createNodeMeshes() {
    const maxTx = Math.max(1, ...nodes.map(n => n.transactions));
    nodes.forEach(node => {
        const size = 3 + 35 * (node.transactions / maxTx);
        const color = colorByAmount(node.totalAmount);
        const geo = new THREE.SphereGeometry(size, 16, 16);
        const mat = new THREE.MeshPhongMaterial({
            color, emissive: color, emissiveIntensity: 0.35,
            shininess: 80, transparent: true, opacity: 0.9
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(node.x, node.y, node.z);
        mesh.userData = { node };
        nodeGroup.add(mesh);
        nodeObjects.set(node.id, mesh);
    });
}

function createLinkLines() {
    links.forEach(link => {
        const src = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
        const tgt = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
        if (!src || !tgt) return;

        const mat = new THREE.LineBasicMaterial({ color: 0x3b82f6, opacity: 0.2, transparent: true });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            src.x, src.y, src.z, tgt.x, tgt.y, tgt.z
        ]), 3));
        const line = new THREE.Line(geo, mat);
        line.userData = { sourceNode: src, targetNode: tgt };
        linkGroup.add(line);
        linkObjects.push(line);
    });
}

function syncPositions() {
    nodes.forEach(node => {
        const mesh = nodeObjects.get(node.id);
        if (mesh) mesh.position.set(node.fx, node.fy, node.fz);
    });
    linkObjects.forEach(line => {
        const { sourceNode: s, targetNode: t } = line.userData;
        const pos = line.geometry.attributes.position.array;
        pos[0] = s.fx ?? s.x; pos[1] = s.fy ?? s.y; pos[2] = s.fz ?? s.z;
        pos[3] = t.fx ?? t.x; pos[4] = t.fy ?? t.y; pos[5] = t.fz ?? t.z;
        line.geometry.attributes.position.needsUpdate = true;
    });
}

// ============================================================================
// Random Transaction Generation (after initial load)
// ============================================================================

function startGeneratingTransactions() {
    console.log('%c⚡ Auto-generating new transactions every 3s', 'color: #f59e0b; font-size: 12px;');
    generateInterval = setInterval(() => {
        const count = 1 + Math.floor(Math.random() * 3); // 1-3 per tick
        for (let i = 0; i < count; i++) {
            const tx = createRandomTransaction();
            tx.properties.timestamp = Date.now();
            allTransactions.push(tx);
            // Only add to filtered if timeline slider is at max
            const slider = document.getElementById('timelineRange');
            if (slider && parseInt(slider.value, 10) >= 100) {
                filteredTransactions.push(tx);
                addSingleTransaction(tx.properties);
            }
        }
        // Cap at 300 to avoid slowdown
        while (allTransactions.length > 300) {
            allTransactions.shift();
        }
        while (filteredTransactions.length > 300) {
            filteredTransactions.shift();
        }
        // Keep timeline labels current
        updateTimelineLabels();
    }, 3000);
}

function addSingleTransaction(tx) {
    // Ensure nodes exist
    [tx.from, tx.to].forEach(addr => {
        if (!nodeObjects.has(addr)) {
            const r = 500 * (0.4 + 0.6 * Math.random());
            const phi = Math.random() * Math.PI;
            const theta = Math.random() * 2 * Math.PI;
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            const node = { id: addr, x, y, z, fx: x, fy: y, fz: z, transactions: 1, totalAmount: tx.amount };
            nodes.push(node);

            const size = 5 + Math.log1p(tx.amount) * 2;
            const color = colorByAmount(tx.amount);
            const geo = new THREE.SphereGeometry(Math.min(size, 20), 16, 16);
            const mat = new THREE.MeshPhongMaterial({
                color, emissive: color, emissiveIntensity: 0.5,
                transparent: true, opacity: 0.9
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.userData = { node };
            nodeGroup.add(mesh);
            nodeObjects.set(addr, mesh);
        } else {
            const node = nodes.find(n => n.id === addr);
            if (node) {
                node.transactions++;
                node.totalAmount += tx.amount;
            }
        }
    });

    // Add link
    const src = nodes.find(n => n.id === tx.from);
    const tgt = nodes.find(n => n.id === tx.to);
    if (src && tgt) {
        const link = { source: tx.from, target: tx.to, transaction: tx };
        links.push(link);

        const mat = new THREE.LineBasicMaterial({ color: 0x10b981, opacity: 0.6, transparent: true });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            src.fx, src.fy, src.fz, tgt.fx, tgt.fy, tgt.fz
        ]), 3));
        const line = new THREE.Line(geo, mat);
        line.userData = { sourceNode: src, targetNode: tgt };
        linkGroup.add(line);
        linkObjects.push(line);

        // Spawn particle
        spawnParticle(src, tgt);

        // Fade link to default after 2s
        setTimeout(() => {
            mat.color.setHex(0x3b82f6);
            mat.opacity = 0.2;
        }, 2000);
    }

    // Update simulation
    if (simulation) {
        simulation.nodes(nodes);
        simulation.force('link').links(links);
        simulation.alpha(0.15).restart();
    }
}

// ============================================================================
// Particle System
// ============================================================================

function spawnParticle(src, tgt) {
    const geo = new THREE.SphereGeometry(2, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.9 });
    const p = new THREE.Mesh(geo, mat);
    p.userData = { src, tgt, progress: 0, speed: 0.015 + Math.random() * 0.02 };
    particleGroup.add(p);
    particles.push(p);

    setTimeout(() => {
        particleGroup.remove(p);
        particles = particles.filter(x => x !== p);
        geo.dispose();
        mat.dispose();
    }, 4000);
}

function updateParticles() {
    particles.forEach(p => {
        const d = p.userData;
        d.progress = Math.min(d.progress + d.speed, 1);
        const t = d.progress;
        p.position.x = d.src.fx + (d.tgt.fx - d.src.fx) * t;
        p.position.y = d.src.fy + (d.tgt.fy - d.src.fy) * t;
        p.position.z = d.src.fz + (d.tgt.fz - d.src.fz) * t;
        if (t > 0.75) p.material.opacity = (1 - t) * 4;
    });
}

// ============================================================================
// Animation Loop
// ============================================================================

let frame = 0;
function animate() {
    requestAnimationFrame(animate);

    if (isZooming) {
        zoomProgress += 0.016;
        if (zoomProgress >= 1) { zoomProgress = 1; isZooming = false; }
        const t = zoomProgress < 0.5 ? 2 * zoomProgress * zoomProgress : 1 - Math.pow(-2 * zoomProgress + 2, 2) / 2;
        camera.position.x = zoomStartPos.x + (zoomTargetPos.x - zoomStartPos.x) * t;
        camera.position.y = zoomStartPos.y + (zoomTargetPos.y - zoomStartPos.y) * t;
        camera.position.z = zoomStartPos.z + (zoomTargetPos.z - zoomStartPos.z) * t;
        camera.lookAt(0, 0, 0);
    } else if (autoRotate) {
        const r = camera.position.length();
        const speed = 0.0005;
        camera.position.x = Math.sin(frame * speed) * r;
        camera.position.z = Math.cos(frame * speed) * r;
        camera.lookAt(0, 0, 0);
    }

    updateParticles();
    updateRiskRings();

    // Random particles on existing links
    if (frame % 90 === 0 && linkObjects.length > 0) {
        const l = linkObjects[Math.floor(Math.random() * linkObjects.length)];
        if (l) spawnParticle(l.userData.sourceNode, l.userData.targetNode);
    }

    frame++;
    renderer.render(scene, camera);
}

// ============================================================================
// Camera Controls
// ============================================================================

function setupManualControls() {
    const el = document.getElementById('network');
    let panning = false;

    el.addEventListener('mousedown', e => {
        if (e.button === 0) { panning = true; previousMousePosition = { x: e.clientX, y: e.clientY }; autoRotate = false; }
    });

    el.addEventListener('mousemove', e => {
        if (!panning) return;
        const dx = e.clientX - previousMousePosition.x;
        const dy = e.clientY - previousMousePosition.y;
        const angle = dx * 0.005;
        const cx = camera.position.x, cz = camera.position.z;
        camera.position.x = cx * Math.cos(angle) - cz * Math.sin(angle);
        camera.position.z = cx * Math.sin(angle) + cz * Math.cos(angle);
        camera.position.y = Math.max(-600, Math.min(600, camera.position.y + dy * 0.25));
        camera.lookAt(0, 0, 0);
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    el.addEventListener('mouseup', () => { panning = false; });
    el.addEventListener('mouseleave', () => { panning = false; });

    el.addEventListener('wheel', e => {
        e.preventDefault();
        const dir = new THREE.Vector3(0, 0, 0).sub(camera.position).normalize();
        camera.position.add(dir.multiplyScalar(e.deltaY * 0.1));
        const d = camera.position.length();
        if (d < 100) camera.position.normalize().multiplyScalar(100);
        if (d > 3000) camera.position.normalize().multiplyScalar(3000);
    }, { passive: false });
}

// ============================================================================
// Node Click Interaction
// ============================================================================

function setupMouseInteraction() {
    const el = document.getElementById('network');
    let downPos = { x: 0, y: 0 };

    el.addEventListener('mousedown', e => { downPos = { x: e.clientX, y: e.clientY }; });

    el.addEventListener('click', e => {
        if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 5) return;
        const rect = el.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(nodeGroup.children, false);
        if (hits.length > 0) {
            const node = hits[0].object.userData.node;
            openNodePanel(node);
            highlightNode(hits[0].object);
        }
    });
}

function highlightNode(mesh) {
    nodeObjects.forEach(m => { m.material.opacity = 0.9; m.material.emissiveIntensity = 0.35; });
    mesh.material.opacity = 1;
    mesh.material.emissiveIntensity = 0.8;
}

function openNodePanel(node) {
    const tx = allTransactions.find(t => t.properties.from === node.id || t.properties.to === node.id);
    if (!tx) return;

    const p = tx.properties;
    document.getElementById('txHash').textContent = p.txHash;
    document.getElementById('txFrom').textContent = p.from;
    document.getElementById('txTo').textContent = p.to;
    document.getElementById('txToken').textContent = p.token;
    document.getElementById('txAmount').textContent = p.amount + ' ' + p.token;
    document.getElementById('txTime').textContent = formatTimestamp(p.timestamp);
    document.getElementById('txSummary').textContent = generateSummary(p);
    renderFeeChart(p.feeHistory);

    // Risk score
    const risk = anomalyScores.get(node.id) || { score: 0, flags: [] };
    const riskEl = document.getElementById('txRiskScore');
    const riskLabelEl = document.getElementById('txRiskLabel');
    const riskFlagsEl = document.getElementById('txRiskFlags');
    if (riskEl) riskEl.textContent = risk.score + '/100';
    if (riskLabelEl) {
        riskLabelEl.textContent = getRiskLabel(risk.score);
        riskLabelEl.className = 'risk-label risk-' + (risk.score >= 70 ? 'high' : risk.score >= 40 ? 'med' : risk.score >= 20 ? 'low' : 'safe');
    }
    if (riskFlagsEl) {
        riskFlagsEl.innerHTML = risk.flags.length
            ? risk.flags.map(f => '<li>' + f + '</li>').join('')
            : '<li>No suspicious indicators found</li>';
    }

    const panel = document.getElementById('sidePanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');

    zoomToNode(node);
}

function zoomToNode(node) {
    previousCameraPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const dir = new THREE.Vector3(node.fx, node.fy, node.fz).normalize();
    zoomStartPos = { ...camera.position };
    zoomTargetPos = { x: node.fx + dir.x * 150, y: node.fy + dir.y * 150, z: node.fz + dir.z * 150 };
    autoRotate = false;
    isZooming = true;
    zoomProgress = 0;
}

function closeTransactionPanel() {
    const panel = document.getElementById('sidePanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    if (previousCameraPos) {
        zoomStartPos = { ...camera.position };
        zoomTargetPos = { ...previousCameraPos };
        isZooming = true;
        zoomProgress = 0;
    }
}

// ============================================================================
// D3 Fee Chart
// ============================================================================

function renderFeeChart(feeHistory) {
    const container = document.getElementById('feeChart');
    container.innerHTML = '';
    const margin = { top: 15, right: 15, bottom: 30, left: 45 };
    const width = container.offsetWidth - margin.left - margin.right;
    const height = 180 - margin.top - margin.bottom;

    const svg = d3.select('#feeChart').append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const data = feeHistory.map((fee, i) => ({ i, fee }));
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.fee) * 1.2 || 0.001]).range([height, 0]);

    const line = d3.line().x(d => x(d.i)).y(d => y(d.fee)).curve(d3.curveMonotoneX);
    const area = d3.area().x(d => x(d.i)).y0(height).y1(d => y(d.fee)).curve(d3.curveMonotoneX);

    svg.append('path').datum(data).attr('fill', '#3b82f6').attr('fill-opacity', 0.15).attr('d', area);
    svg.append('path').datum(data).attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2).attr('d', line);

    svg.selectAll('.dot').data(data).enter().append('circle')
        .attr('cx', d => x(d.i)).attr('cy', d => y(d.fee))
        .attr('r', 4).attr('fill', '#3b82f6').attr('stroke', '#fff').attr('stroke-width', 2);

    svg.append('g').attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(data.length).tickFormat(d => 'T' + (d + 1))).style('font-size', '10px');
    svg.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d => d.toFixed(4))).style('font-size', '10px');
}

// ============================================================================
// Search & Timeline
// ============================================================================

function handleSearch(term) {
    if (!term.trim()) {
        filteredTransactions = [...allTransactions];
    } else {
        const t = term.toLowerCase();
        filteredTransactions = allTransactions.filter(f => {
            const p = f.properties;
            return p.txHash.toLowerCase().includes(t) || p.from.toLowerCase().includes(t) ||
                   p.to.toLowerCase().includes(t) || p.token.toLowerCase().includes(t);
        });
    }
    buildNetwork();
}

function formatShortDateTime(ts) {
    const d = new Date(ts);
    const mon = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${mon} ${day}, ${h}:${m}`;
}

function handleTimelineChange(val) {
    if (allTransactions.length === 0) return;
    const sorted = [...allTransactions].sort((a, b) => a.properties.timestamp - b.properties.timestamp);
    const minT = sorted[0].properties.timestamp;
    const maxT = sorted[sorted.length - 1].properties.timestamp;

    if (val >= 100) {
        // Show everything
        filteredTransactions = [...allTransactions];
    } else {
        const cutoff = minT + (maxT - minT) * (val / 100);
        filteredTransactions = allTransactions.filter(tx => tx.properties.timestamp <= cutoff);
        // Update current position label
        const curEl = document.getElementById('timelineCurrent');
        if (curEl) curEl.textContent = '— ' + formatShortDateTime(cutoff);
    }

    // Update count
    const countEl = document.getElementById('timelineCount');
    if (countEl) countEl.textContent = `Showing ${filteredTransactions.length} of ${allTransactions.length} transactions`;

    if (val >= 100) {
        const curEl = document.getElementById('timelineCurrent');
        if (curEl) curEl.textContent = '— All';
    }

    buildNetwork();
}

function updateTimelineLabels() {
    if (allTransactions.length === 0) return;
    const sorted = [...allTransactions].sort((a, b) => a.properties.timestamp - b.properties.timestamp);
    const startEl = document.getElementById('timelineStart');
    const endEl = document.getElementById('timelineEnd');
    const countEl = document.getElementById('timelineCount');
    const curEl = document.getElementById('timelineCurrent');
    if (startEl) startEl.textContent = formatShortDateTime(sorted[0].properties.timestamp);
    if (endEl) endEl.textContent = formatShortDateTime(sorted[sorted.length - 1].properties.timestamp);
    if (countEl) countEl.textContent = `Showing ${filteredTransactions.length} of ${allTransactions.length} transactions`;
    if (curEl) curEl.textContent = '— All';
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
    document.getElementById('closePanel').addEventListener('click', closeTransactionPanel);
    const anomalyBtn = document.getElementById('anomalyBtn');
    if (anomalyBtn) anomalyBtn.addEventListener('click', toggleAnomalyPanel);
    const closeAnomalyBtn = document.getElementById('closeAnomalyPanel');
    if (closeAnomalyBtn) closeAnomalyBtn.addEventListener('click', toggleAnomalyPanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTransactionPanel(); });

    document.getElementById('timelineRange').addEventListener('input', e => {
        handleTimelineChange(parseInt(e.target.value, 10));
    });

    document.getElementById('rotateBtn').addEventListener('click', () => {
        autoRotate = !autoRotate;
        document.getElementById('rotateBtn').textContent = autoRotate ? '⏸ Pause' : '🔄 Rotate';
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        camera.position.set(0, 0, 800);
        camera.lookAt(0, 0, 0);
        autoRotate = true;
        document.getElementById('rotateBtn').textContent = '⏸ Pause';
    });
}

// ============================================================================
// Utilities
// ============================================================================

function generateSummary(tx) {
    const fromS = shortenAddress(tx.from);
    const toS = shortenAddress(tx.to);
    const time = getTimeAgo(tx.timestamp);
    const avgFee = (tx.feeHistory.reduce((a, b) => a + b, 0) / tx.feeHistory.length).toFixed(6);
    const size = tx.amount < 1 ? 'a small' : tx.amount < 10 ? 'a moderate' : 'a substantial';
    return `${time}, ${fromS} transferred ${size} amount of ${tx.amount} ${tx.token} to ${toS}. Average fee: ${avgFee}.`;
}

function shortenAddress(addr) {
    if (!addr || addr.length < 12) return addr || 'Unknown';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function getTimeAgo(ts) {
    const diff = Date.now() - ts;
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(hrs / 24);
    if (days > 7) return 'Several days ago';
    if (days > 0) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
    if (hrs > 0) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
    return 'Just now';
}

function formatTimestamp(ts) {
    return new Date(ts).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// ============================================================================
// Anomaly Detection Engine
// ============================================================================

function detectAnomalies() {
    anomalyScores.clear();
    anomalyAlerts = [];
    if (allTransactions.length === 0) { updateAnomalyUI(); return; }

    // Compute mean & std dev of amounts for outlier detection
    const amounts = allTransactions.map(tx => tx.properties.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const outlierThreshold = mean + 2 * stdDev;

    // Build per-address stats
    const addressStats = new Map();
    const addressTimestamps = new Map(); // for rapid-fire detection

    allTransactions.forEach(tx => {
        const p = tx.properties;
        [p.from, p.to].forEach(addr => {
            if (!addressStats.has(addr)) {
                addressStats.set(addr, { txCount: 0, sentCount: 0, receivedCount: 0, totalAmount: 0, partners: new Set() });
            }
            const s = addressStats.get(addr);
            s.txCount++;
            s.totalAmount += p.amount;
        });
        addressStats.get(p.from).sentCount++;
        addressStats.get(p.to).receivedCount++;
        addressStats.get(p.from).partners.add(p.to);
        addressStats.get(p.to).partners.add(p.from);

        if (!addressTimestamps.has(p.from)) addressTimestamps.set(p.from, []);
        addressTimestamps.get(p.from).push(p.timestamp);
    });

    // Build tx-pair set for circular trading detection
    const txPairs = new Set();
    allTransactions.forEach(tx => txPairs.add(tx.properties.from + '→' + tx.properties.to));

    // Score each address
    addressStats.forEach((stats, addr) => {
        let score = 0;
        const flags = [];

        // Rule 1: High-frequency (bot-like behaviour)
        if (stats.txCount >= 10) {
            score += 35; flags.push('Bot-like activity: ' + stats.txCount + ' transactions');
        } else if (stats.txCount >= 6) {
            score += 20; flags.push('Elevated activity: ' + stats.txCount + ' transactions');
        }

        // Rule 2: Circular / wash trading (A→B AND B→A)
        let circularCount = 0;
        stats.partners.forEach(partner => {
            if (txPairs.has(addr + '→' + partner) && txPairs.has(partner + '→' + addr)) circularCount++;
        });
        if (circularCount > 0) {
            score += 30;
            flags.push('Circular trading with ' + circularCount + ' wallet' + (circularCount > 1 ? 's' : ''));
        }

        // Rule 3: Rapid-fire transactions (multiple sends within 60 s)
        const timestamps = addressTimestamps.get(addr) || [];
        if (timestamps.length >= 2) {
            const sorted = [...timestamps].sort((a, b) => a - b);
            let rapidCount = 0;
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] - sorted[i - 1] < 60000) rapidCount++;
            }
            if (rapidCount >= 2) { score += 20; flags.push('Rapid-fire sends detected'); }
        }

        anomalyScores.set(addr, { score: Math.min(score, 100), flags });
    });

    // Rule 4: Outlier transaction amounts — add to sender's score
    allTransactions.forEach(tx => {
        const p = tx.properties;
        if (p.amount > outlierThreshold) {
            const d = anomalyScores.get(p.from);
            if (d) {
                d.score = Math.min(d.score + 25, 100);
                d.flags.push('Outlier transfer: ' + p.amount.toFixed(2) + ' ' + p.token + ' (avg ' + mean.toFixed(2) + ')');
            }
        }
    });

    // Build sorted alert list (top 10 flagged)
    anomalyAlerts = Array.from(anomalyScores.entries())
        .filter(([, d]) => d.score >= 20)
        .sort(([, a], [, b]) => b.score - a.score)
        .slice(0, 10)
        .map(([addr, d]) => ({ addr, score: d.score, flags: d.flags }));

    updateAnomalyUI();
    addRiskRings();
}

function getRiskColor(score) {
    if (score >= 70) return 0xef4444;   // red — high risk
    if (score >= 40) return 0xf97316;   // orange — suspicious
    if (score >= 20) return 0xfbbf24;   // yellow — watch
    return 0x10b981;                    // green — safe
}

function getRiskLabel(score) {
    if (score >= 70) return 'HIGH RISK';
    if (score >= 40) return 'SUSPICIOUS';
    if (score >= 20) return 'WATCH';
    return 'SAFE';
}

function addRiskRings() {
    // Remove previous rings
    if (riskRingGroup) { scene.remove(riskRingGroup); riskRingGroup = null; }
    riskRingGroup = new THREE.Group();
    riskRingGroup.name = 'riskRings';

    nodes.forEach(node => {
        const d = anomalyScores.get(node.id);
        if (!d || d.score < 20) return;
        const mesh = nodeObjects.get(node.id);
        if (!mesh) return;
        const r = (mesh.geometry.parameters.radius || 8) + 6;
        const geo = new THREE.RingGeometry(r, r + 5, 32);
        const mat = new THREE.MeshBasicMaterial({ color: getRiskColor(d.score), side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const ring = new THREE.Mesh(geo, mat);
        ring.position.copy(mesh.position);
        ring.userData = { isRisk: true };
        riskRingGroup.add(ring);
    });
    scene.add(riskRingGroup);
}

function updateAnomalyUI() {
    const count = anomalyAlerts.length;
    const badge = document.getElementById('anomalyBadge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }

    const list = document.getElementById('anomalyList');
    if (!list) return;
    if (count === 0) {
        list.innerHTML = '<p class="no-alerts">✅ No suspicious activity detected</p>';
        return;
    }
    list.innerHTML = anomalyAlerts.map(a => `
        <div class="alert-item risk-${a.score >= 70 ? 'high' : a.score >= 40 ? 'med' : 'low'}">
            <div class="alert-top">
                <span class="risk-tag">${getRiskLabel(a.score)}</span>
                <span class="risk-num">${a.score}/100</span>
            </div>
            <div class="alert-addr">${shortenAddress(a.addr)}</div>
            <ul class="alert-flags">${a.flags.map(f => '<li>' + f + '</li>').join('')}</ul>
        </div>`).join('');
}

function toggleAnomalyPanel() {
    const p = document.getElementById('anomalyPanel');
    if (p) p.classList.toggle('open');
}

// Keep risk rings facing the camera each frame
function updateRiskRings() {
    if (!riskRingGroup) return;
    riskRingGroup.children.forEach(ring => ring.lookAt(camera.position));
}

console.log('%c🌐 Blockchain Transaction Network', 'color: #3b82f6; font-size: 16px; font-weight: bold;');
console.log('%cLoads mock data then auto-generates new transactions', 'color: #666; font-size: 12px;');
