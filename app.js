const express = require('express');
const axios = require('axios');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const server = require('http').createServer(app);
const io = socketIo(server);

const API_KEY = 'ptla_aVqyG5wh3ap3mKw8zedfX2ZID8Ep40hCj0A6jJGwTdt	'; // Replace with your API key
const PANEL_URL = 'https://panel.parlagames.co.il';

let serverStatus = {};
let downtimeLog = {};
let settings = {
    refreshInterval: 60000, // 1 minute
    alertSound: true,
    popupAlerts: true
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

// Load settings from file if exists
if (fs.existsSync('settings.json')) {
    settings = JSON.parse(fs.readFileSync('settings.json'));
}

// Routes
app.get('/', (req, res) => {
    res.render('index', { serverStatus });
});

app.get('/settings', (req, res) => {
    res.render('settings', { settings });
});

app.post('/settings', (req, res) => {
    settings = req.body;
    fs.writeFileSync('settings.json', JSON.stringify(settings));
    res.json({ status: 'success' });
});

// Fetch server status
async function fetchServerStatus() {
    try {
        const response = await axios.get(`${PANEL_URL}/api/client`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        const servers = response.data.data;

        for (const server of servers) {
            const serverId = server.attributes.identifier;
            const serverDetails = await axios.get(`${PANEL_URL}/api/client/servers/${serverId}/resources`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const status = serverDetails.data.attributes.current_state;
            const lastStatus = serverStatus[serverId] ? serverStatus[serverId].status : null;

            serverStatus[serverId] = {
                name: server.attributes.name,
                status: status,
                lastChecked: new Date()
            };

            // Downtime logic
            if (status !== 'running' && lastStatus === 'running') {
                downtimeLog[serverId] = {
                    startTime: new Date(),
                    reported: false
                };
            }

            if (status === 'running' && downtimeLog[serverId]) {
                delete downtimeLog[serverId];
            }

            if (downtimeLog[serverId]) {
                const downtime = (new Date() - new Date(downtimeLog[serverId].startTime)) / 60000;
                if (downtime > 5 && !downtimeLog[serverId].reported) {
                    logDowntime(server.attributes.name, downtime);
                    downtimeLog[serverId].reported = true;
                    io.emit('alert', { server: server.attributes.name });
                }
            }
        }

        io.emit('update', serverStatus);
    } catch (error) {
        console.error('Error fetching server status:', error.message);
    }
}

// Log downtime
function logDowntime(serverName, downtime) {
    const logMessage = `${new Date().toISOString()} - Server ${serverName} has been down for ${downtime.toFixed(2)} minutes.\n`;
    fs.appendFileSync('logs/downtime.log', logMessage);
}

// Initial fetch and set interval
fetchServerStatus();
setInterval(fetchServerStatus, settings.refreshInterval);

// Socket.io connection
io.on('connection', (socket) => {
    socket.emit('update', serverStatus);
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
