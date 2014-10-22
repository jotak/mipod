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
/// <reference path="body-parser/body-parser.d.ts" />
var express = require('express');
var bodyParser = require('body-parser');
var routes = require('./routes');
var LibLoader = require('./LibLoader');

"use strict";
var app = express();
app.use(bodyParser.json());
var port = 80;
var mpdRestRoot = "/mpd";
var libraryRestRoot = "/library";
var library = new LibLoader();

function usage() {
    console.log("Usage: node mipod-rest [options=values]");
    console.log("");
    console.log("Options:");
    console.log("  -p, --port          setup server port (default 80)");
    console.log("  -m, --mpdRoot       setup MPD-related root for REST requests (default /mpd)");
    console.log("  -l, --libraryRoot   setup library-related root for REST requests (default /library)");
    console.log("  -c, --useLibCache   use given file for library cache");
    console.log("  -h, --help          this");
    console.log("");
    console.log("Example:");
    console.log("  node mipod-rest -p=81 -m=/some/resource -l=/another/resource");
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
    "--mpdRoot": function (val) {
        mpdRestRoot = val;
    },
    "--libraryRoot": function (val) {
        libraryRestRoot = val;
    },
    "--useLibCache": function (val) {
        library.useCacheFile(val);
    },
    "--help": function (val) {
        usage();
        process.exit(0);
    }
};

mapParams["-p"] = mapParams["--port"];
mapParams["-m"] = mapParams["--mpdRoot"];
mapParams["-l"] = mapParams["--libraryRoot"];
mapParams["-c"] = mapParams["--useLibCache"];
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
        } else {
            console.log("Unknown option " + arg);
            usage();
            process.exit(0);
        }
    }
});

routes.register(app, mpdRestRoot, libraryRestRoot, library);

app.listen(port);

console.log('Server running on port ' + port);
