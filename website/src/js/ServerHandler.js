import SockJS from 'sockjs-client';
import Peer from 'simple-peer';

import GlobalVars from './GlobalVars';
import SocketSender from './libs/SocketSender';

import ViewHandler from './ViewHandler';

let useTrickle = true;
let peerId;
let peer;
let stream = null;

/**
 * ServerHandler
 * Management class for socket events
 */

export default class ServerHandler {
    constructor() {
        this.viewHandler = new ViewHandler();
    }

    reset() {
        this.isSockOpen = false;
        this.viewHandler.reset();
    }

    /**
     * Listen socket events
     */
    initServer() {
        GlobalVars.sock.onopen = (function () {
            console.log('sock open');
            this.isSockOpen = true;
            this.sendPeerSignal();

            GlobalVars.sock.onmessage = (function (message) {
                this.socketMessage(message);
            }).bind(this);

            GlobalVars.sock.onclose = (function () {
                this.socketClose();
            }).bind(this);
        }).bind(this);
    }

    /**
     * Send the signal through socket, allowing peer-to-peer connection
     */
    sendPeerSignal() {
        navigator.getUserMedia({video: true, audio: false}, (function(str) {
            stream = str;
            SocketSender.sendMessage({
                event: 'connect',
                type: 'webApp'
            });
        }).bind(this), function(err) {
            console.log('Failed to get local stream', err);
        });
    }

    /**
     * Execute an action when a socket event is received
     * @param message
     */
    socketMessage(message) {

        let msg = JSON.parse(message.data);
        if (!msg.event) throw "Invalid message format: " + msg;

        switch (msg.event) {
            case 'peer':
                peerId = msg.peerId;
                peer = new Peer({ initiator: msg.initiator, stream: stream, trickle: useTrickle });
                console.log('Peer created' );
                this.peerMessage(msg);
                break;

            case 'signal':
                if (msg.peerId == peerId) {
                    console.log('Received signalling data' + msg + 'from Peer ID:' + peerId);
                    peer.signal(msg.signal);
                }
                break;

            case 'startApp':
                console.log('Application launched')
                this.viewHandler.onStartApplication();
                break;

            case 'appDisconnected':
                console.log('app disconnected');

                GlobalVars.reset();
                this.reset();
                break;
        }
    }


    /**
     * Execute an action when a peer-to-peer event is received
     * @param msg
     */
    peerMessage(msg) {
        peer.on('signal', (function(signal) {
            //console.log(signal);
            SocketSender.sendMessage({
                event: 'signal',
                signal: signal,
                sendTo: peerId
            });
            console.log('Advertising signalling data' + msg + 'to Peer ID:' + peerId);
        }).bind(this));
        peer.on('connect', (function() {
            console.log('Peer connection established');
            SocketSender.sendMessage({
                event: 'peerConnected'
            });
            //peer.send("hey peer");
        }).bind(this));
        peer.on('error', (function(e) {
            console.log('Error sending connection to peer '+ peerId+' : '+e);
        }).bind(this));
        peer.on('data', (function(data) {
            console.log('Received data from peer:' + data);
        }).bind(this));
        peer.on('stream', (function (stream) {
            this.viewHandler.onStream(stream);
        }).bind(this));
        peer.on('close', (function () {
            console.log('Destroy peer connection');
            peer.destroy();
        }).bind(this));
    }

    /**
     * Action executed when the socket server is closed
     */
    socketClose() {
        console.log('sock close');

        GlobalVars.reset();
        this.reset();

        this.reconnect();
    }

    reconnect() {
        GlobalVars.sock = new SockJS(GlobalVars.sock.url);
        let timeout = setTimeout(function(){
            if (!this.isSockOpen) {
                this.reconnect()
            }
        }.bind(this), 3000);
        clearTimeout(timeout);
    }

}