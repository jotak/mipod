/*
The MIT License (MIT)
Copyright (c) 2014 Joel Takvorian, https://github.com/jotak/mipod
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/// <reference path="node/node.d.ts" />
/// <reference path="express/express.d.ts" />
/// <reference path="socket.io/socket.io.d.ts" />
var express = require('express');
var http = require('http');
var socketio = require('socket.io');
var mipod = require('./main');
var O = require('./Options');
"use strict";
var app = express();
var httpServer = http.createServer(app);
var websock = socketio.listen(httpServer);
var opts = O.Options.default();
var port = 80;
function usage() {
    console.log("Usage: node mipod-ws [options=values]");
    console.log("");
    console.log("Options:");
    console.log("  -p=$X, --port=$X                setup server port (default 80)");
    console.log("  --prefix=$path                  setup prefix for websocket events (default empty)");
    console.log("  --mpdHost=$host                 MPD server hostname (default localhost)");
    console.log("  --mpdPort=$X                    MPD server port (default 6600)");
    console.log("  --dataPath=$path                local path where data files will be stored");
    console.log("  --dontUseLibCache               deactivate MPD caching (will be slower, but saves memory)");
    console.log("  --loadLibOnStartup              load library from MPD on startup");
    console.log("  -h, --help                      this");
    console.log("");
    console.log("Example:");
    console.log("  node mipod-ws -p=81 --root=/site/mpd");
    console.log("");
    console.log("More documentation available on https://github.com/jotak/mipod");
}
var mapParams = {
    "--port": function (val) {
        port = +val;
        if (isNaN(port)) {
            console.log("Invalid port");
            process.exit(0);
        }
    },
    "--prefix": function (val) {
        opts.prefix = val;
    },
    "--mpdHost": function (val) {
        opts.mpdHost = val;
    },
    "--mpdPort": function (val) {
        opts.mpdPort = +val;
        if (isNaN(opts.mpdPort)) {
            console.log("Invalid MPD port");
            process.exit(0);
        }
    },
    "--dataPath": function (val) {
        opts.dataPath = val;
    },
    "--dontUseLibCache": function (val) {
        opts.useLibCache = false;
    },
    "--loadLibOnStartup": function (val) {
        opts.loadLibOnStartup = true;
    },
    "--help": function (val) {
        usage();
        process.exit(0);
    }
};
mapParams["-p"] = mapParams["--port"];
mapParams["-h"] = mapParams["--help"];
process.argv.forEach(function (arg, index, array) {
    if (index > 1) {
        var key = arg;
        var value = null;
        if (arg.indexOf("=") > 0) {
            var keyVal = arg.split("=");
            key = keyVal[0];
            value = keyVal[1];
        }
        var fct = mapParams[key];
        if (fct) {
            fct(value);
        }
        else {
            console.log("Unknown option " + arg);
            usage();
            process.exit(0);
        }
    }
});
websock.on('connection', function (socket) {
    mipod.asWebSocket(socket, opts);
});
httpServer.listen(port, function () {
    console.log('Websocket listening on port ' + port);
});
