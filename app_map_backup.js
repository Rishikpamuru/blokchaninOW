// ============================================================================
// Blockchain Transaction Map - Main Application
// ============================================================================

// Global state
let map;
let markersCluster;
let allTransactions = [];
let filteredTransactions = [];
let currentTransaction = null;
let liveUpdateInterval = null;
let liveUpdatesEnabled = true;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize the map
        initMap();
        
        // Load transaction data
        await loadTransactionData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initial render
        renderMarkers(allTransactions);
        
        // Start live updates
        startLiveUpdates();
        
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('Failed to load transaction data. Please ensure data/mock_transactions.json exists.');
    }
});

// ============================================================================
// Map Initialization
// ============================================================================

function initMap() {
    // Create map centered on world view
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true
    });

    // Add OpenStreetMap tile layer (free, no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Initialize marker cluster group
    markersCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count > 10) size = 'large';
            else if (count > 5) size = 'medium';
            
            return L.divIcon({
                html: `<div style="background-color: rgba(110, 204, 57, 0.6); 
                              width: ${size === 'large' ? 50 : size === 'medium' ? 40 : 30}px; 
                              height: ${size === 'large' ? 50 : size === 'medium' ? 40 : 30}px; 
                              border-radius: 50%; 
                              display: flex; 
                              align-items: center; 
                              justify-content: center; 
                              color: white; 
                              font-weight: bold; 
                              font-size: 14px;
                              border: 2px solid white;
                              box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                    ${count}
                </div>`,
                className: 'marker-cluster-custom',
                iconSize: L.point(40, 40)
            });
        }
    });

    map.addLayer(markersCluster);
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadTransactionData() {
    try {
        const response = await fetch('data/mock_transactions.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        allTransactions = data.features || [];
        filteredTransactions = [...allTransactions];
        
        // Sort by timestamp for timeline
        allTransactions.sort((a, b) => 
            a.properties.timestamp - b.properties.timestamp
        );
        
        updateTimelineLabels();
    } catch (error) {
        console.error('Error loading transaction data:', error);
        throw error;
    }
}

// ============================================================================
// Marker Rendering
// ============================================================================

function renderMarkers(transactions) {
    // Clear existing markers
    markersCluster.clearLayers();

    // Add markers for each transaction
    transactions.forEach(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        
        // Determine marker color based on transaction size
        const color = getMarkerColor(props.amount);
        
        // Create custom icon
        const icon = L.divIcon({
            className: 'transaction-marker',
            html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        // Create marker (note: GeoJSON uses [lng, lat], Leaflet uses [lat, lng])
        const marker = L.marker([coords[1], coords[0]], { icon: icon });
        
        // Add click event
        marker.on('click', () => {
            openTransactionPanel(props);
        });
        
        // Add popup for quick view
        marker.bindPopup(`
            <div style="color: #333;">
                <strong>${props.token}</strong><br/>
                Amount: ${props.amount}<br/>
                <small>${formatTimestamp(props.timestamp)}</small>
            </div>
        `);
        
        // Store transaction data with marker
        marker.transactionData = props;
        
        // Add to cluster group
        markersCluster.addLayer(marker);
    });
}

function getMarkerColor(amount) {
    if (amount < 1.0) return '#4ade80'; // green
    if (amount <= 10.0) return '#fbbf24'; // yellow
    return '#ef4444'; // red
}

// ============================================================================
// Side Panel Management
// ============================================================================

function openTransactionPanel(transaction) {
    currentTransaction = transaction;
    const panel = document.getElementById('sidePanel');
    
    // Populate transaction details
    document.getElementById('txHash').textContent = transaction.txHash;
    document.getElementById('txFrom').textContent = transaction.from;
    document.getElementById('txTo').textContent = transaction.to;
    document.getElementById('txToken').textContent = transaction.token;
    document.getElementById('txAmount').textContent = `${transaction.amount} ${transaction.token}`;
    document.getElementById('txTime').textContent = formatTimestamp(transaction.timestamp);
    
    // Generate and display summary
    document.getElementById('txSummary').textContent = generateTransactionSummary(transaction);
    
    // Render D3 chart
    renderFeeChart(transaction.feeHistory);
    
    // Open panel
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    
    // Focus close button for accessibility
    document.getElementById('closePanel').focus();
}

function closeTransactionPanel() {
    const panel = document.getElementById('sidePanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
}

// ============================================================================
// D3 Fee Chart Visualization
// ============================================================================

function renderFeeChart(feeHistory) {
    const container = document.getElementById('feeChart');
    
    // Clear previous chart
    container.innerHTML = '';
    
    // Chart dimensions
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = container.offsetWidth - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#feeChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Prepare data
    const data = feeHistory.map((fee, index) => ({
        index: index,
        fee: fee
    }));
    
    // Scales
    const xScale = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([0, width]);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.fee) * 1.1])
        .range([height, 0]);
    
    // Line generator
    const line = d3.line()
        .x(d => xScale(d.index))
        .y(d => yScale(d.fee))
        .curve(d3.curveMonotoneX);
    
    // Add gradient
    const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'line-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0)
        .attr('y1', yScale(0))
        .attr('x2', 0)
        .attr('y2', yScale(d3.max(data, d => d.fee)));
    
    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.8);
    
    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#06b6d4')
        .attr('stop-opacity', 0.8);
    
    // Add area under line
    const area = d3.area()
        .x(d => xScale(d.index))
        .y0(height)
        .y1(d => yScale(d.fee))
        .curve(d3.curveMonotoneX);
    
    svg.append('path')
        .datum(data)
        .attr('fill', 'url(#line-gradient)')
        .attr('fill-opacity', 0.2)
        .attr('d', area);
    
    // Add line
    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'url(#line-gradient)')
        .attr('stroke-width', 2)
        .attr('d', line);
    
    // Add dots
    svg.selectAll('.dot')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', d => xScale(d.index))
        .attr('cy', d => yScale(d.fee))
        .attr('r', 4)
        .attr('fill', '#3b82f6')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    
    // Add axes
    const xAxis = d3.axisBottom(xScale).ticks(data.length).tickFormat(d => `T${d + 1}`);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d.toFixed(4)}`);
    
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('font-size', '10px');
    
    svg.append('g')
        .call(yAxis)
        .style('font-size', '10px');
    
    // Add axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#666')
        .text('Transaction Sequence');
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#666')
        .text('Fee (ETH)');
}

// ============================================================================
// NLP-Style Summary Generator (Rule-Based)
// ============================================================================

function generateTransactionSummary(tx) {
    const amount = tx.amount;
    const token = tx.token;
    const fromShort = shortenAddress(tx.from);
    const toShort = shortenAddress(tx.to);
    
    // Calculate time ago
    const timeAgo = getTimeAgo(tx.timestamp);
    
    // Calculate average fee
    const avgFee = (tx.feeHistory.reduce((a, b) => a + b, 0) / tx.feeHistory.length).toFixed(4);
    
    // Determine transaction size descriptor
    let sizeDesc;
    if (amount < 1.0) sizeDesc = 'a small';
    else if (amount <= 10.0) sizeDesc = 'a moderate';
    else if (amount <= 100.0) sizeDesc = 'a substantial';
    else sizeDesc = 'a large';
    
    // Generate summary
    const summary = `${timeAgo}, ${fromShort} transferred ${sizeDesc} amount of ${amount} ${token} to ${toShort}. ` +
                   `This transaction incurred an average network fee of ${avgFee} ETH across ${tx.feeHistory.length} recent transactions. ` +
                   `The wallet shows ${tx.feeHistory.length > 3 ? 'consistent' : 'moderate'} activity patterns.`;
    
    return summary;
}

function shortenAddress(address) {
    if (!address) return 'Unknown';
    if (address.length < 12) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 7) return 'Several days ago';
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Recently';
}

// ============================================================================
// Search Functionality
// ============================================================================

function handleSearch(searchTerm) {
    if (!searchTerm.trim()) {
        // No search term, show all
        filteredTransactions = [...allTransactions];
    } else {
        const term = searchTerm.toLowerCase();
        filteredTransactions = allTransactions.filter(feature => {
            const props = feature.properties;
            return (
                props.txHash.toLowerCase().includes(term) ||
                props.from.toLowerCase().includes(term) ||
                props.to.toLowerCase().includes(term) ||
                props.token.toLowerCase().includes(term)
            );
        });
    }
    
    // Apply timeline filter as well
    applyTimelineFilter();
}

// ============================================================================
// Timeline Filter
// ============================================================================

function applyTimelineFilter() {
    const slider = document.getElementById('timelineRange');
    const percentage = slider.value / 100;
    
    // Get sorted transactions
    const sorted = [...filteredTransactions].sort((a, b) => 
        a.properties.timestamp - b.properties.timestamp
    );
    
    // Calculate cutoff index
    const cutoffIndex = Math.floor(sorted.length * percentage);
    
    // Filter transactions up to the cutoff
    const timeFiltered = sorted.slice(0, cutoffIndex === 0 ? sorted.length : cutoffIndex);
    
    // Render filtered markers
    renderMarkers(timeFiltered);
}

function updateTimelineLabels() {
    if (allTransactions.length === 0) return;
    
    const sorted = [...allTransactions].sort((a, b) => 
        a.properties.timestamp - b.properties.timestamp
    );
    
    const oldest = sorted[0].properties.timestamp;
    const newest = sorted[sorted.length - 1].properties.timestamp;
    
    document.getElementById('timelineStart').textContent = new Date(oldest).toLocaleDateString();
    document.getElementById('timelineEnd').textContent = new Date(newest).toLocaleDateString();
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

function setupEventListeners() {
    // Close panel button
    document.getElementById('closePanel').addEventListener('click', closeTransactionPanel);
    
    // Close panel on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTransactionPanel();
        }
    });
    
    // Search box
    const searchBox = document.getElementById('searchBox');
    searchBox.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });
    
    // Clear search button
    document.getElementById('clearSearch').addEventListener('click', () => {
        searchBox.value = '';
        handleSearch('');
        searchBox.focus();
    });
    
    // Timeline slider
    const timelineRange = document.getElementById('timelineRange');
    timelineRange.addEventListener('input', () => {
        applyTimelineFilter();
    });
}

// ============================================================================
// Live Updates - Blockchain.com API
// ============================================================================

function startLiveUpdates() {
    console.log('%c📡 Live updates enabled - fetching Bitcoin transactions', 'color: #10b981; font-size: 12px;');
    
    // Fetch immediately on start
    fetchLiveTransactions();
    
    // Then fetch every 15 seconds
    liveUpdateInterval = setInterval(fetchLiveTransactions, 15000);
}

async function fetchLiveTransactions() {
    try {
        const response = await fetch('https://blockchain.info/unconfirmed-transactions?format=json&limit=5');
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        
        // Process and add new transactions
        const newTransactions = data.txs.slice(0, 3).map(tx => {
            // Generate random world coordinates for visualization
            const coords = generateRandomCoordinates();
            
            // Convert BTC satoshi to BTC
            const totalOutput = tx.out.reduce((sum, output) => sum + output.value, 0) / 100000000;
            
            // Get addresses
            const fromAddr = tx.inputs[0]?.prev_out?.addr || 'Unknown';
            const toAddr = tx.out[0]?.addr || 'Unknown';
            
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: coords
                },
                properties: {
                    txHash: tx.hash,
                    from: fromAddr,
                    to: toAddr,
                    token: 'BTC',
                    amount: parseFloat(totalOutput.toFixed(8)),
                    feeHistory: [0.00001, 0.000012, 0.000011, 0.00001],
                    timestamp: tx.time * 1000,
                    isLive: true
                }
            };
        });
        
        // Add to beginning of array (newest first)
        allTransactions = [...newTransactions, ...allTransactions];
        
        // Keep only last 100 transactions to prevent memory bloat
        if (allTransactions.length > 100) {
            allTransactions = allTransactions.slice(0, 100);
        }
        
        // Re-filter and render
        handleSearch(document.getElementById('searchBox').value);
        
        console.log(`%c✅ Added ${newTransactions.length} live transactions`, 'color: #10b981; font-size: 11px;');
        
    } catch (error) {
        console.warn('Live update failed:', error.message);
    }
}

function generateRandomCoordinates() {
    // Generate random coordinates weighted toward populated areas
    const locations = [
        [-122.4194, 37.7749], // San Francisco
        [-0.1276, 51.5074],   // London
        [139.6917, 35.6895],  // Tokyo
        [2.3522, 48.8566],    // Paris
        [-74.006, 40.7128],   // New York
        [13.405, 52.52],      // Berlin
        [151.2093, -33.8688], // Sydney
        [55.2708, 25.2048],   // Dubai
        [37.6173, 55.7558],   // Moscow
        [126.978, 37.5665],   // Seoul
        [121.4737, 31.2304],  // Shanghai
        [103.8198, 1.3521],   // Singapore
        [77.2090, 28.6139],   // Delhi
        [-99.1332, 19.4326],  // Mexico City
        [114.1095, 22.3964],  // Hong Kong
        [-43.1729, -22.9068], // Rio
        [12.4964, 41.9028],   // Rome
        [144.9631, -37.8136], // Melbourne
        [-123.1207, 49.2827], // Vancouver
        [10.7522, 59.9139]    // Oslo
    ];
    
    // 70% chance to use a major city, 30% chance for random location
    if (Math.random() < 0.7) {
        const location = locations[Math.floor(Math.random() * locations.length)];
        // Add slight random offset for variety
        return [
            location[0] + (Math.random() - 0.5) * 2,
            location[1] + (Math.random() - 0.5) * 2
        ];
    } else {
        // Random location
        return [
            (Math.random() * 360) - 180, // longitude: -180 to 180
            (Math.random() * 160) - 80   // latitude: -80 to 80 (avoid poles)
        ];
    }
}

function stopLiveUpdates() {
    if (liveUpdateInterval) {
        clearInterval(liveUpdateInterval);
        liveUpdateInterval = null;
        console.log('%c⏸️ Live updates paused', 'color: #f59e0b; font-size: 12px;');
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================================================
// Console Info
// ============================================================================

console.log('%c🌍 Blockchain Transaction Map Loaded', 'color: #3b82f6; font-size: 16px; font-weight: bold;');
console.log('%cClick any marker to view transaction details', 'color: #666; font-size: 12px;');
