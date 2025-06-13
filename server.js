const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const lobbies = {}; // lobbyId [ws, ws, ...]

app.use(express.static(path.join(__dirname, 'public')));

// Serve the menu page
app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the map page (game view)
app.get('/map/:lobbyId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'map.html'));
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error('Invalid message:', message);
            return;
        }

        if (data.type === 'join') {
            const { lobbyId, playerName } = data;

            ws.lobbyId = lobbyId;
            ws.playerName = playerName || 'Anonymous';

            if (!lobbies[lobbyId]) lobbies[lobbyId] = [];
            lobbies[lobbyId].push(ws);

            console.log(`${ws.playerName} joined lobby ${lobbyId}`);

            // Notify everyone in the lobby
            lobbies[lobbyId].forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'player-joined',
                        name: ws.playerName
                    }));
                }
            });
        }

        // Handle other message types (e.g., chat, move, etc.)
    });

    ws.on('close', () => {
        const lobbyId = ws.lobbyId;
        if (lobbyId && lobbies[lobbyId]) {
            lobbies[lobbyId] = lobbies[lobbyId].filter(client => client !== ws);
            console.log(`${ws.playerName} left lobby ${lobbyId}`);

            // Optionally notify others
            lobbies[lobbyId].forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'player-left',
                        name: ws.playerName
                    }));
                }
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
