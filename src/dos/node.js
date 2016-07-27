// COPYRIGHT (c) 2016 Daniel Kneipp de Sá Vieira
//
// GNU GENERAL PUBLIC LICENSE
//    Version 3, 29 June 2007
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.


var net = require('net');
var fs = require('fs');

var executionStates = Object.freeze({
    WAITING : 0,
    RUNNING : 1,
    READY : 2
});

var nodeStates = Object.freeze({
    WAITING : 0,
    RESULT_RECEIVED : 1
});

var messagePatterns = {
    executionRequest: /RUN: (.+)/i,         //RUN: optimizer iter=300
    //R: 121.134.0.13:6969 -> NEXT_SERVER: 192.168.0.5:6969 (sock.name)
    nextServerToSendTheID: /R: ([\d.:]+) -> NEXT_SERVER: ([\d.:]+)/i,
    idFromAnotherProcess: /MY_ID: (.+)/i,    //MY_ID: 9.3421
    resetRequest: /RESET$/i
};


function parseExecutionOut(output) {
    var decisionVars;
    var result;
    var regex = /\[(.+)\] -> (.+)/;

    var match;
    if ((match = regex.exec(output)) !== null) {
        result = match[2];
        decisionVars = match[1];
    }

    return [decisionVars, result];
}


function heuristicManager (executionOutputParser) {
    this.state = executionStates.WAITING;
    var that = this;
    var result = '';
    var decisionVars = '';

    this.run = function (cmd, callback) {
        if (this.state !== executionStates.RUNNING) {
            this.state = executionStates.RUNNING;

            var exec = require('child_process').exec;
            exec(cmd, function whenExecutionFinished(error, stdout, stderr) {
                var parsedStdout = executionOutputParser(stdout);
                result = parsedStdout[1];
                decisionVars = parsedStdout[0];
                that.state = executionStates.READY;

                console.log('\n--------DONE--------\n');
                console.log(decisionVars + ' -> ' + result);
                console.log('\n--------DONE--------\n');

                if (typeof callback !== 'undefined') {
                    callback();
                }
            });
        }
    };

    this.getResul = function () {
        if (this.state === executionStates.READY) {
            return result;
        }
        return undefined;
    };

    this.getDecisionVars = function () {
        if (this.state === executionStates.READY) {
            return decisionVars;
        }
        return undefined;
    };

    this.resetState = function () {
        this.state = executionStates.WAITING;
        result = '';
        decisionVars = '';
    };
}


function Node (host, port, hostsFile) {
    var that = this;
    this.state = nodeStates.WAITING;
    var IamTheRequester = false;
    var heurManag = new heuristicManager(parseExecutionOut);

    var hrstart;
    var hrend;

    var nextServer;
    var resulReceived;
    var requesterServer;

    var clientsConnected = [];

    var serversConnected = [];

    this.resetState = function () {
        if (that.state !== nodeStates.WAITING || heurManag.state !== executionStates.WAITING) {
            that.state = nodeStates.WAITING;
            IamTheRequester = false;
            nextServer = undefined;
            requesterServer = undefined;
            heurManag.resetState();
            that.broadcastToServers('RESET'); // send RESET requisition to all connected nodes
        }
    };

    this.printConnectedClients = function () {
        console.log('\n\n-------\n');
        for (var i = 0; i < clientsConnected.length; i++) {
            console.log(clientsConnected[i].name);
        }
        console.log('\n-------\n\n');
    };

    this.printConnectedServers = function () {
        console.log('\n\n-------\n');
        for (var i = 0; i < serversConnected.length; i++) {
            console.log(serversConnected[i].name);
        }
        console.log('\n-------\n\n');
    };

    this.broadcastToClients = function (msg) {
        clientsConnected.forEach(function(client) {
            client.write(msg);
        });
    };

    this.broadcastToServers = function (msg) {
        serversConnected.forEach(function(server) {
            server.write(msg);
        });
    };

    this.close = function (callback) {
        try {
            this.server.close();
        } catch (e) {
            console.log('SERVER is already closed');
        }

        for (var i = 0; i < serversConnected.length; i++) {
            serversConnected[i].end();
        }
        if (typeof callback !== 'undefined') {
            callback();
        }
    };

    var sendResult_executionFinishedCallBack = function () {
        // RESULT_RECEIVED implies that result of this machine need to be sent.
        if (that.state !== nodeStates.RESULT_RECEIVED) {
            return;
        }
        var myResul = heurManag.getResul();
        var resulToSend;

        if (typeof myResul === 'undefined') { // if I don't have a result
            if (resulReceived === 'GO' || typeof resulReceived === 'undefined') { // if I didn't received a result.
                resulToSend = 'GO'; // send a GO forward message
            } else {
                resulToSend = resulReceived; // forward the received result
            }
        }
        else {
            if (resulReceived === 'GO' || typeof resulReceived === 'undefined') {
                resulToSend = myResul; // send my result
            } else {
                // Minimization -> send the lower value
                if (parseFloat(myResul) < parseFloat(resulReceived)) {
                    resulToSend = myResul;
                } else {
                    resulToSend = resulReceived;
                }
            }
        }

        if (IamTheRequester) {
            hrend = process.hrtime(hrstart);
            that.showExecutionTime();
            that.showResult(resulToSend);
            IamTheRequester = false;
            that.state = nodeStates.WAITING;
            return;
        }
        // Check if the nextServer reference is ok
        if (serversConnected.indexOf(nextServer) > -1 && typeof nextServer !== 'undefined') {
            nextServer.write('MY_ID: ' + resulToSend);
        } else {
            // Check if the requesterServer reference is ok
            if (serversConnected.indexOf(requesterServer) > -1 && typeof requesterServer !== 'undefined') {
                requesterServer.write('MY_ID: ' + resulToSend);
            } else {
                that.showResult(resulToSend);
            }
        }
        that.state = nodeStates.WAITING;
    };

    this.sendResult = function () {
        that.state = nodeStates.RESULT_RECEIVED;
        if (heurManag.state !== executionStates.RUNNING) {
            sendResult_executionFinishedCallBack();
        }
    };

    this.assignNextServer = function (serverName) {
        for (var i = 0; i < serversConnected.length; i++) {
            if (serversConnected[i].name === serverName) {
                nextServer = serversConnected[i];
            }
        }
    };

    this.assignRequesterServer = function (serverName) {
        for (var i = 0; i < serversConnected.length; i++) {
            if (serversConnected[i].name === serverName) {
                requesterServer = serversConnected[i];
            }
        }
    };

    this.showResult = function (resul) {
        console.log('\n--------RESULT--------\n');
        if (resul === 'GO') {
            console.log('N\\A');
        } else {
            console.log(resul);
        }
        console.log('\n--------RESULT--------\n');
    };

    this.showExecutionTime = function () {
        console.info('Execution Time: %ds %dms', hrend[0], hrend[1]/1000000);
    };

    this.executeHeuristic = function (cmd) {
        // Send execute signal to all clients
        if (heurManag.state !== executionStates.RUNNING) {
            hrstart = process.hrtime();
            heurManag.run(cmd, sendResult_executionFinishedCallBack);
            that.broadcastToClients("RUN: " + cmd); // Make the broadcast automatically
        } else {
            console.log('Optimizer is already running!');
        }
    };

    this.execute = function (cmd) {
        this.executeHeuristic(cmd);
    };

    this.getClusterResult = function () {
        // Send broadcast to other nodes informing their respective following nodes
        // and that I'am the requester.
        if (heurManag.state !== executionStates.WAITING) { // means that the execution order is
            IamTheRequester = true;                        // already sent
            // if there is connected nodes
            if (serversConnected.length > 0) {
                for (var i = 0; i < serversConnected.length - 1; i++) {
                    serversConnected[i].write('R: ' + host + ':' + port + ' -> ' +
                                              'NEXT_SERVER: ' + serversConnected[i + 1].name);
                }
                serversConnected[serversConnected.length - 1].write('R: ' + host + ':' + port + ' -> ' +
                                                                    'NEXT_SERVER: ' + host + ':' + port);
                // GO means go forward, don't wait my ID to send yours.
                serversConnected[0].write('MY_ID: GO');
            } else { // otherwise, just show the result.
                this.sendResult();
            }
        } else {
            console.log('\n--------WAITING--------\n');
        }
    };



/*=========================================================================*/
/*==============================  SERVER  =================================*/
/*=========================================================================*/



    this.server = net.createServer(function newClient (sock) {
        // When connected
        sock.name = sock.remoteAddress + ':' + sock.remotePort;
        console.log('SERVER: NEW CLIENT CONNECTED: ' + sock.name);

        var onClientDown = function () {
            console.log('SERVER: CONNECTION CLOSED: ' + sock.name);
            var idx = clientsConnected.indexOf(sock);
            if (idx > -1) {
                clientsConnected.splice(idx, 1);
            }
        };

        var onComingData = function (data) {
            console.log('SERVER: DATA: ' + data);
            var match;
            if ((match = messagePatterns.nextServerToSendTheID.exec(data)) !== null) {
                that.assignRequesterServer(match[1]);
                that.assignNextServer(match[2]);
            } if ((match = messagePatterns.idFromAnotherProcess.exec(data)) !== null) {
                resulReceived = match[1];
                that.sendResult();
            } if ((match = messagePatterns.resetRequest.exec(data)) !== null) {
                that.resetState();
            }
        };

        // When receive data
        sock.on('data', onComingData);

        // When the connection close
        sock.on('close', onClientDown);

        clientsConnected.push(sock);
    });

    this.server.listen(port, host, function () {
        console.log('SERVER INFO: Listening on ' + host + ':' + port);
    });

    this.server.on('error', function (err) {
        console.log('SERVER ERROR: ' + err);
    });

    this.server.on('close', function () {
        console.log('SERVER DOWN');
    });



/*=========================================================================*/
/*==============================  CLIENTS  ================================*/
/*=========================================================================*/



    this.connectToServers = function () {
        if (!fs.existsSync(hostsFile)) {
            console.log(hostsFile + ' does not exists');
            return;
        }
        var serversToConnect = fs.readFileSync(hostsFile, 'utf8').toString().split('\n');

        // Iterate over the servers to connect to then
        serversToConnect.forEach(function (serverHostName, index) {
            if (serverHostName === '') {
                return;
            }

            // Check if the server is connected already
            for (var i = 0; i < serversConnected.length; i++) {
                if (serversConnected[i].hname === serverHostName) {
                    console.log('Host ' + serverHostName + ' is already connected');
                    return;
                }
            }

            var sock = new net.Socket();

            var connectTo = function () {
                sock.hname = serverHostName;
                sock.name = sock.remoteAddress +':' + sock.remotePort;
                console.log('CLIENT: CONNECTED ON: '  + sock.name);
                serversConnected.push(sock);
            };

            var onComingData = function (data) {
                console.log('CLIENT: DATA: ' + data);
                // Execute the optimization program (get command text by regex)
                var match;
                if ((match = messagePatterns.executionRequest.exec(data)) !== null) {
                    that.executeHeuristic(match[1]);
                }
            };

            var onServerDown = function () {
                var idx = serversConnected.indexOf(sock);
                if (idx > -1) {
                    serversConnected.splice(idx, 1);
                    console.log('CLIENT: CONNECTION CLOSED: ' + sock.name);
                }
            };

            var onErrorHappen = function (err) {
                console.log('CLIENT: ERROR: ' + sock.name + ' -> ' + err);
            };

            sock.connect(port, serverHostName, connectTo);

            sock.on('data', onComingData);

            sock.on('close', onServerDown);

            sock.on('error', onErrorHappen);

        });
    };
}

module.exports.Node = Node;
