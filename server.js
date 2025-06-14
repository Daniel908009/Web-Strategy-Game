const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const lobbies = {}; // In-memory: lobbyId => [WebSocket, ...]

app.post('/api/create-lobby', (req, res) => {
    const { lobbyId } = req.body;

    if (lobbies[lobbyId]) {
        return res.status(400).send("Lobby ID already exists.");
    }

    lobbies[lobbyId] = [];
    console.log(`Created lobby: ${lobbyId}`);
    res.status(200).send("Lobby created");
});

app.get('/api/check-lobby/:lobbyId', (req, res) => {
    const lobbyId = req.params.lobbyId;
    if (lobbies[lobbyId]) {
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

app.get('/map/:lobbyId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'map.html'));
});

// WebSocket logic...
wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.type === 'join') {
            console.log("joined")
            //console.log(`Player ${data.playerName} joined lobby ${data.lobbyId}`);
            //console.log(lobbies[data.lobbyId].length)
            const { lobbyId, playerName } = data;
            if (!lobbies[lobbyId]) lobbies[lobbyId] = [];
            ws.lobbyId = lobbyId;
            ws.playerName = playerName;
            ws.isMain = lobbies[lobbyId].length === 0;
            //console.log(`Players in lobby ${lobbies[lobbyId]}`)
            //console.log(`${lobbies[lobbyId]}`)
            lobbies[lobbyId].push(ws);

            ws.send(JSON.stringify({ type: 'role', role: ws.isMain ? 'main' : 'client', number: lobbies[lobbyId].length, lobbyInfo: lobbies[lobbyId] }));

            // Broadcast join message
            /*lobbies[lobbyId].forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'player-joined', name: playerName }));
                }
            });*/
        }else if (data.type === "request-players") {
            const { lobbyId } = data;
            //asking the main player for the list of players
            if (lobbies[lobbyId]) {
                const mainPlayer = lobbies[lobbyId].find(client => client.isMain);
                if (mainPlayer && mainPlayer.readyState === WebSocket.OPEN) {
                    mainPlayer.send(JSON.stringify({ type: "player-list-request" }));
                }
            }
        }else if (data.type === "player-list-response") {
            const { lobbyId, playerList } = data;
            console.log(`Received player list for lobby ${lobbyId}:`, playerList);
            if (lobbies[lobbyId]) {
                lobbies[lobbyId].forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: "player-list", players: playerList }));
                    }
                });
            }
        }else if (data.type === "next-turn") {
            const { lobbyId, turn, globalPlayer } = data;
            if (lobbies[lobbyId]) {
                lobbies[lobbyId].forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: "next-turn", turn: turn, globalPlayer: globalPlayer }));
                    }
                });
            }
        } else if (data.type === "map-data") {
            const { lobbyId, mapData } = data;
            //console.log(`Received map data for lobby ${data.mapData}`);
            if (lobbies[lobbyId]) {
                lobbies[lobbyId].forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: "map-data", mapData: mapData }));
                    }
                });
            }
        } else if (data.type === "map-request") {
            const { lobbyId } = data;
            if (lobbies[lobbyId]) {
                // asking the main player for the map data
                const mainPlayer = lobbies[lobbyId].find(client => client.isMain);
                if (mainPlayer && mainPlayer.readyState === WebSocket.OPEN) {
                    mainPlayer.send(JSON.stringify({ type: "request-map" }));
                }
            }
        }
    });

    ws.on('close', () => {
        const { lobbyId, playerName } = ws;
        if (lobbyId && lobbies[lobbyId]) {
            lobbies[lobbyId] = lobbies[lobbyId].filter(client => client !== ws);
            // Reassign main if needed
            if (ws.isMain && lobbies[lobbyId][0]) {
                lobbies[lobbyId][0].isMain = true;
                lobbies[lobbyId][0].send(JSON.stringify({ type: 'role', role: 'main' }));
                console.log(`New main player: ${lobbies[lobbyId][0].playerName}`);
            }
            if (lobbies[lobbyId].length === 0) {
                delete lobbies[lobbyId]; // Remove lobby if empty
                console.log(`Lobby ${lobbyId} deleted`);
            }
            /*lobbies[lobbyId].forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'player-left', name: playerName }));
                }
            });*/
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
