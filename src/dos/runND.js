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

var sys = require('sys');
var fs = require('fs');
var repl = require("repl");
var node = require('./node');

var myHostNameFileName = 'myHostName.json';
var hostsFileFileName = 'otherHosts.txt';

var executeMessagePattern = /run (.+)/i;
var inputPattern = /\(((.|\n)*)\)$/i;
var stdin = process.openStdin();

var errorTypes = {
    error1_configuration: 'Especify the host ip in the execution command' +
            ' (nodejs runND.js <hostToListen>) or configure myHostName.txt file properly.',

    error2_missingFile: function (missingFile) {
        return missingFile + ' does not exists';
    }
};

var host = process.argv[2];
if (!host) {
    if (!fs.existsSync(myHostNameFileName)) {
        console.log(errorTypes.error2_missingFile(myHostNameFileName));
        process.exit(2);
    }

    var jsDataObj = JSON.parse(fs.readFileSync(myHostNameFileName, 'utf8'));
    if (typeof jsDataObj.myHostName === 'undefined') {
        console.log(errorTypes.error1_configuration);
        process.exit(1);
    }
    host = jsDataObj.myHostName;
}

var nd = new node.Node(host, 6969, hostsFileFileName);

console.log('\n\n' +
            '=======================================\n' +
            '============= WELCOME TO ==============\n' +
            '=== DISTRIBUTED OPTIMIZATION SYSTEM ===\n' +
            '======================================= \n\n');

var replServer = repl.start({
  prompt: "DOS > ",
  ignoreUndefined: true,
  eval: interpreter
});

function interpreter(cmd, context, filename, callback) {
    var match;
    var input;

    if ((match = inputPattern.exec(cmd)) !== null) {
        input = match[1];
        input = input.replace('\n', '');
    } else {
        console.log("Input error");
        callback();
        return;
    }

    switch(input) {
        case 'printServers':
            nd.printConnectedServers();
            break;
        case 'printClients':
            nd.printConnectedClients();
            break;
        case 'connect':
            nd.connectToServers();
            break;
        case 'getResult':
            nd.getClusterResult();
            break;
        case 'reset':
            nd.resetState();
            break;
        case 'exit':
            console.log('\nBye!\n');
            nd.close(function () {
                setTimeout(finish, 1000);
            });
            break;
        case '':
            break;
        default:
            if ((match = executeMessagePattern.exec(input)) !== null) {
                nd.execute(match[1]);
            } else {
                console.log('< ' + input + ' > is not a statement');
            }
            break;
    }

    callback();
}

function finish () {
    process.exit(0);
}
