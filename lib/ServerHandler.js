let http    = require('http'),
    express = require('express'),
    sockjs  = require('sockjs'),

    GlobalVars = require('./GlobalVars'),
    SocketSender = require('./SocketSender'),

    WebApp = require('./Models/WebApp')
;

/**
 * ServerHandler
 * Management class for socket events
 */

class ServerHandler {
    constructor() {
        this.socketServer = null;
        this.reset();
    }

    reset() {
        GlobalVars.reset();
        this.isAppLaunched = false;
    }

    /**
     * Instantiate the Node server
     */
    initSockServer() {
        let sockjs_opts = {sockjs_url: "http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js"};
        this.socketServer = sockjs.createServer(sockjs_opts);

        this.socketServer.on('connection', (function(socket) {
            socket.on('data', (function(message) {
                this.socketMessage(socket, message);
            }).bind(this));
            socket.on('close', (function() {
                this.socketClose(socket);
            }).bind(this));
        }).bind(this));
    }


    /**
     * Instantiate the Express server
     */
    initExpressServer() {
        let app = express(); /* express.createServer will not work here */
        let server = http.createServer(app);

        this.socketServer.installHandlers(server, {prefix:'/node'});

        console.log(' [*] Listening on 0.0.0.0:9999' );
        server.listen(9999, '0.0.0.0');

        app.use(express.static('website/web'));
        app.get('/', function (req, res) {
            res.send('Socket server functionnal');
        });
    }


    /**
     * Manage the received socket messages
     * @param socket
     * @param message
     */
    socketMessage(socket, message) {
        let msg = JSON.parse(message);
        if (!msg.event) throw "Invalid message format: " + msg;

        switch(msg.event) {

            case 'connect':
                console.log(msg.type+" connected");
                switch (msg.type) {
                    case 'webApp':
                        GlobalVars.webApps[socket.id] = new WebApp(socket);
                        GlobalVars.webAppsCount++;
                        console.log("webApps total : " + GlobalVars.webAppsCount);
                        if (GlobalVars.webAppsCount == 2) {
                            this.createPeerConnection(socket);
                        }
                        break;
                }
                break;

            case 'reset':
                this.reset();
                break;

            case 'signal':
                console.log("signal received");
                SocketSender.sendMessage({
                    group: "webApps",
                    key: msg.sendTo,
                    msg: {
                        event: 'signal',
                        signal: msg.signal,
                        peerId: socket.id
                    },
                });
                break;

            case 'peerConnected':
                console.log('Peer connection OP');
                break;
        }

    }

    /**
     * Function called when the node server is closed
     * @param socket
     */
    socketClose(socket) {
        this.reset();
        this.isAppLaunched = false;

        if(GlobalVars.webApps.hasOwnProperty(socket.id)) {
            delete GlobalVars.webApps[socket.id];
            if (GlobalVars.webApps == -1) {
                GlobalVars.webApps = [];
            }
            GlobalVars.webAppsCount--;
            console.log('webApp disconnected');
        }

        SocketSender.sendMessage({
            group: "webApps",
            msg: {
                event: 'appDisconnected'
            }
        });
    }


    /**
     * Create a peer connection between two WebApps
     * @param socket
     */
    createPeerConnection(socket) {
        console.log('Creating peer connection...');

        let msg1 = null;
        let msg2 = null;
        for (let key in GlobalVars.webApps) {
            if (key != socket.id) {
                msg1 = {
                    event: 'peer',
                    peerId: key,
                    initiator: false
                };
            } else {
                msg2 = {
                    event: 'peer',
                    peerId: key,
                    initiator: true
                };
            }
        }
        if (msg1!=null && msg2!=null) {
            SocketSender.sendMessage({
                group: "webApps",
                key: msg2.peerId,
                msg: msg1
            });
            SocketSender.sendMessage({
                group: "webApps",
                key: msg1.peerId,
                msg: msg2
            });
            console.log('Peer connection requests sended...');
        } else {
            console.log('Error - PeerConnection unavailable');
        }
    }

}

module.exports = ServerHandler;