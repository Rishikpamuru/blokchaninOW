# � Blockchain Transaction Network

An interactive 3D force-directed network graph that visualizes blockchain transactions as a living web of wallet nodes and flowing particles. Click nodes to explore transaction details, manually rotate and zoom the view, and watch live Bitcoin transactions spawn new connections in real-time.

## 📋 Features

- **3D Force-Directed Network**: Wallet addresses as nodes connected by transaction links
- **Interactive Rotation & Zoom**: Click and drag to rotate, scroll to zoom in/out
- **Particle Flow Animation**: Green particles flowing along edges showing active transactions
- **Smart Node Sizing**: Node size and color based on total transaction amount
- **Seamless Navigation**: Click between nodes without closing the detail panel
- **Live Bitcoin Feed**: Real transactions from blockchain.info appear every 15 seconds
- **D3 Force Physics**: Network self-organizes using realistic physics simulation
- **Beautiful 3D Rendering**: Three.js powered graphics with dynamic lighting
- **Transaction Details**: Comprehensive information including hash, addresses, amounts, and timestamps
- **D3 Visualizations**: Beautiful fee history charts
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Python 3.x (or any other simple HTTP server)

### Installation & Running

1. **Download/Clone the project** to your computer

2. **Navigate to the project directory**:
   ```bash
   cd path/to/ISM_OW
   ```

3. **Start a local web server**:
   
   **Option A - Python 3:**
   ```bash
   python -m http.server 8000
   ```
   
   **Option B - Python 2:**
   ```bash
   python -m SimpleHTTPServer 8000
   ```
   
   **Option C - Node.js (if installed):**
   ```bash
   npx http-server -p 8000
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:8000
   ```

5. **Start exploring!** The map will load with 27 transaction markers spread across the globe.

## 📁 Project Structure

```
ISM_OW/
│
├── index.html                  # Main HTML structure
├── styles.css                  # All styling and responsive design
├── app.js                      # Core application logic and interactivity
├── data/
│   └── mock_transactions.json  # 27 sample blockchain transactions (GeoJSON format)
└── README.md                   # This file
```

## 🧪 Testing Guide

### Basic Functionality Tests

1. **Network Loading**:
   - Verify 3D network loads with wallet nodes as spheres
   - Check that nodes are connected by blue lines (edges)
   - Ensure network self-organizes with force simulation

2. **Camera Controls**:
   - **Rotate**: Click and drag anywhere to rotate the camera view
   - **Zoom**: Scroll mouse wheel to zoom in/out (limits: 50-800 units)
   - **Reset**: Click "Reset View" button to return to default position
   - **Auto-rotate**: Toggle with "Rotate/Pause" button

3. **Node Interactions**:
   - Click any node (sphere) to open the side panel
   - Click another node - panel updates WITHOUT closing
   - Selected node glows brighter than others
   - Verify transaction details populate correctly

4. **Node Appearance**:
   - Larger nodes = higher transaction amounts
   - Colors indicate value: Gray (none) → Green (< 1) → Yellow (< 10) → Orange (< 100) → Red (> 100)
   - Nodes glow with emissive lighting

5. **Particle Flow**:
   - Watch green particles flow along edges
   - Particles spawn randomly every second
   - New live transactions create bright green particles

6. **Live Updates**:
   - New Bitcoin transactions appear every 15 seconds
   - New nodes/edges spawn with bright green color
   - Network expands organically
   - Check console for "✅ Added X transactions" messages

7. **Search & Panel**:
   - Search by wallet address to filter nodes
   - Close panel with X button or ESC key
   - Panel displays fee chart and transaction summary

### Specific Test Cases

| Test | Action | Expected Result |
|------|--------|----------------|
| Large Transaction | Search "0x333333iiiiiiiijjjjjjjjkkkkkkkkllllllll" | Find Dubai transaction (45.6 ETH) with red marker |
| Small Transaction | Search "0x555555ppppppppqqqqqqqqrrrrrrrrssssssss" | Find Moscow transaction (18.9 BNB) with green marker |
| Token Filter | Search "USDC" | Show only USDC transactions |
| Clustering | Zoom to Asia | See clustered markers group together |
| Chart Rendering | Click any marker | D3 line chart with 4-5 data points |
| Summary Generation | Click Tokyo marker | Read AI-generated summary about the transaction |

## 🎨 Visual Legend

- **🔴 Red Nodes**: Huge transactions (> 100 tokens)
- **🟠 Orange Nodes**: Large transactions (10-100 tokens)
- **🟡 Yellow Nodes**: Medium transactions (1-10 tokens)
- **🟢 Green Nodes**: Small transactions (< 1 token)
- **⚫ Gray Nodes**: No transaction data
- **🔵 Blue Lines**: Transaction connections between wallets
- **💚 Green Particles**: Active transaction flow
- **✨ Glow Effect**: Currently selected node

## 🔧 Technology Stack

### Core Technologies (All Free & No API Keys Required)
- **Three.js r160**: 3D rendering and graphics
- **D3.js v7**: Force simulation physics and data visualization charts
- **Blockchain.info API**: Free live Bitcoin transaction feed
- **Vanilla JavaScript**: No framework dependencies

### Why These Choices?
- ✅ Zero build tools required
- ✅ No API keys or registrations needed
- ✅ Works directly from filesystem
- ✅ All resources loaded via CDN
- ✅ Fully open-source stack

## 🎮 Controls

| Action | Control |
|--------|---------|
| Rotate View | Click + Drag |
| Zoom In/Out | Mouse Wheel |
| Select Node | Click on Sphere |
| Close Panel | ESC or X Button |
| Toggle Auto-Rotate | 🔄 Rotate Button |
| Reset Camera | 🎯 Reset View Button |
| Search Nodes | Type in Search Box |

## 📊 Data Format

The project uses GeoJSON format for transaction data:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { 
        "type": "Point", 
        "coordinates": [longitude, latitude]
      },
      "properties": {
        "txHash": "0xabc123...",
        "from": "0xFromAddress",
        "to": "0xToAddress",
        "token": "ETH",
        "amount": 2.5,
        "feeHistory": [0.001, 0.0009, 0.0012, 0.001],
        "timestamp": 1702000000000
      }
    }
  ]
}
```

### Adding Your Own Data

1. Open `data/mock_transactions.json`
2. Add new transaction objects following the format above
3. Use valid coordinates: `[longitude, latitude]`
4. Timestamp should be in milliseconds (Unix epoch)
5. Save and refresh the browser

## 🐛 Troubleshooting

### Map doesn't load
- Check browser console (F12) for errors
- Ensure you're using an HTTP server (not `file://`)
- Verify internet connection (CDN resources need to load)

### Transactions not appearing
- Check `data/mock_transactions.json` exists
- Verify JSON syntax is valid (use JSONLint.com)
- Check browser console for fetch errors

### Charts not rendering
- Ensure D3.js CDN loaded successfully
- Check browser console for JavaScript errors
- Verify transaction has `feeHistory` array

### Search not working
- Try shorter search terms
- Search is case-insensitive
- Partial matches are supported

## 🎓 How It Works (Explained Like You're 12)

Imagine you have a giant world map on your wall, and you want to put sticky notes on every place where someone sent cryptocurrency to someone else.

**Here's what happens:**

1. **The Map**: When you open the page, we draw a big interactive map of the world using Leaflet (it's like Google Maps but free).

2. **The Sticky Notes (Markers)**: Each transaction is a colored dot on the map. We read all the transaction data from a file (`mock_transactions.json`) and put a dot at the exact location where each transaction happened. Big transactions get red dots, medium ones get yellow, and small ones get green.

3. **Clustering Magic**: When dots are too close together, they automatically merge into a blue circle with a number showing how many transactions are squished together. When you zoom in, they split apart again!

4. **Clicking a Dot**: When you click any dot, a side panel slides in from the right. This panel shows you everything about that transaction - who sent it, who received it, how much money moved, and when it happened.

5. **The Cool Chart**: Inside the panel, there's a mini graph made with D3.js (a drawing tool for data). It shows how much the "gas fees" (transaction costs) changed over time for that wallet - like a line graph you'd make in math class, but prettier!

6. **The Robot Summary**: A simple computer program reads the transaction details and writes a sentence explaining what happened in plain English, like "2 days ago, someone sent a big pile of Ethereum to another person."

7. **Search & Filter**: The search box lets you type an address or coin name, and the map only shows matching transactions. The timeline slider at the bottom lets you travel through time - slide it left to see older transactions, right for newer ones!

**The Secret Sauce**: All of this happens right in your web browser using JavaScript. The map updates instantly because everything is already loaded - no waiting for servers or databases!

## 📝 License

This project uses open-source technologies and is provided as-is for educational and demonstration purposes.

## 🤝 Contributing

Feel free to modify and extend this project:
- Add real blockchain API integration
- Connect to live transaction feeds
- Implement additional chart types
- Add more filtering options
- Enhance the NLP summary generator

## 📧 Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Open browser DevTools (F12) and check Console tab
3. Verify all files are in correct locations
4. Ensure you're using a modern browser

---

**Built with ❤️ using Leaflet, D3.js, and vanilla JavaScript**

*No API keys, no build tools, no hassle - just open and run!*
