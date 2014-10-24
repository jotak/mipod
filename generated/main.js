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
var routes = require('./routes');
var tools = require('./tools');
var LibLoader = require('./LibLoader');
var MpdClient = require('./MpdClient');
var O = require('./Options');
var typeCheck = require('type-check');

"use strict";

function listenRestRoutes(expressApp, options) {
    var opts = options ? tools.extend(options, O.Options.default()) : O.Options.default();

    // Since this module can be imported from JS applications (non-typescript), we'll add some runtime type-check on Options
    var scheme = "{dataPath: String, useLibCache: Boolean, mpdRestPath: String, libRestPath: String, loadLibOnStartup: Boolean, mpdHost: String, mpdPort: Number}";
    if (!typeCheck.typeCheck(scheme, opts)) {
        console.log("WARNING: some options provided to mipod contain unknown or invalid properties. You should fix them.");
        console.log("Options provided: " + JSON.stringify(options));
        console.log("Expected options scheme: " + scheme);
    }

    MpdClient.configure(opts.mpdHost, opts.mpdPort);
    var lib = new LibLoader();
    lib.setDataPath(opts.dataPath);
    if (opts.useLibCache) {
        lib.setUseCacheFile(true);
    }
    if (opts.loadLibOnStartup) {
        lib.forceRefresh();
    }
    routes.register(expressApp, opts.mpdRestPath, opts.libRestPath, lib);
}
exports.listenRestRoutes = listenRestRoutes;

module.exports = exports.listenRestRoutes;
