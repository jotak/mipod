/*
The MIT License (MIT)
Copyright (c) 2014 Joel Takvorian, https://github.com/jotak/node-restmpd
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
var LibLoader = require('./LibLoader');
var MpdClient = require('./MpdClient');

"use strict";
function register(app, mpdRoot, libRoot) {
    app.get(mpdRoot + '/configure/:host/:port', function (req, res) {
        MpdClient.configure(req.params.host, +req.params.port);
        res.send("OK");
    });

    app.get(mpdRoot + '/play/:path?', function (req, res) {
        if (req.params.path) {
            // Clear and add
            MpdClient.clear();
            MpdClient.add(req.params.path);
        }
        MpdClient.play();
        res.send("OK");
    });

    app.get(mpdRoot + '/add/:path', function (req, res) {
        MpdClient.add(req.params.path);
        res.send("OK");
    });

    app.get(mpdRoot + '/clear', function (req, res) {
        MpdClient.clear();
        res.send("OK");
    });

    app.get(mpdRoot + '/pause', function (req, res) {
        MpdClient.pause();
        res.send("OK");
    });

    app.get(mpdRoot + '/stop', function (req, res) {
        MpdClient.stop();
        res.send("OK");
    });

    app.get(mpdRoot + '/next', function (req, res) {
        MpdClient.next();
        res.send("OK");
    });

    app.get(mpdRoot + '/prev', function (req, res) {
        MpdClient.prev();
        res.send("OK");
    });

    app.get(mpdRoot + '/load/:path', function (req, res) {
        MpdClient.load(req.params.path);
        res.send("OK");
    });

    app.get(mpdRoot + '/custom/:command', function (req, res) {
        MpdClient.custom(req.params.command);
        res.send("OK");
    });

    app.get(libRoot + '/loadonce', function (req, res) {
        LibLoader.loadOnce(res);
    });

    app.get(libRoot + '/reload', function (req, res) {
        LibLoader.reload(res);
    });

    app.get(libRoot + '/progress', function (req, res) {
        LibLoader.progress(res);
    });

    app.get(libRoot + '/get/:start/:count/:treeDesc?/:leafDesc?', function (req, res) {
        var treeDesc = req.params.treeDesc || "genre,artist,album";
        var leafDesc = req.params.leafDesc || "file,track,title";
        LibLoader.getPage(res, +req.params.start, +req.params.count, treeDesc.split(","), leafDesc.split(","));
    });

    app.get(mpdRoot, function (req, res) {
        res.send("Available resources on " + mpdRoot + " are: <br/><ul>" + "<li>" + mpdRoot + "/configure/:host/:port</li>" + "<li>" + mpdRoot + "/play/:path?</li>" + "<li>" + mpdRoot + "/add/:path</li>" + "<li>" + mpdRoot + "/clear</li>" + "<li>" + mpdRoot + "/pause</li>" + "<li>" + mpdRoot + "/stop</li>" + "<li>" + mpdRoot + "/next</li>" + "<li>" + mpdRoot + "/prev</li>" + "<li>" + mpdRoot + "/load/:path</li>" + "<li>" + mpdRoot + "/custom/:command</li>" + "</ul>Check documentation on <a href='https://github.com/jotak/node-restmpd'>https://github.com/jotak/node-restmpd</a>");
    });

    app.get(libRoot, function (req, res) {
        res.send("Available resources on " + libRoot + " are: <br/><ul>" + "<li>" + libRoot + "/loadonce</li>" + "<li>" + libRoot + "/reload</li>" + "<li>" + libRoot + "/progress</li>" + "<li>" + libRoot + "/get/:start/:count/:treeDesc?</li>" + "</ul>Check documentation on <a href='https://github.com/jotak/node-restmpd'>https://github.com/jotak/node-restmpd</a>");
    });
}
exports.register = register;
