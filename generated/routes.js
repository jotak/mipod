/*
The MIT License (MIT)
Copyright (c) 2014 Joel Takvorian
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
function register(app) {
    app.get('/mpd/configure/:host/:port', function (req, res) {
        MpdClient.configure(req.params.host, req.params.port);
    });

    app.get('/mpd/play/:path?', function (req, res) {
        if (req.params.path) {
            // Clear and add
            MpdClient.clear();
            MpdClient.add(req.params.path);
        }
        MpdClient.play();
        res.send("OK");
    });

    app.get('/mpd/add/:path', function (req, res) {
        MpdClient.add(req.params.path);
        res.send("OK");
    });

    app.get('/mpd/clear', function (req, res) {
        MpdClient.clear();
        res.send("OK");
    });

    app.get('/mpd/pause', function (req, res) {
        MpdClient.pause();
        res.send("OK");
    });

    app.get('/mpd/stop', function (req, res) {
        MpdClient.stop();
        res.send("OK");
    });

    app.get('/mpd/next', function (req, res) {
        MpdClient.next();
        res.send("OK");
    });

    app.get('/mpd/prev', function (req, res) {
        MpdClient.prev();
        res.send("OK");
    });

    app.get('/mpd/load/:path', function (req, res) {
        MpdClient.load(req.params.path);
        res.send("OK");
    });

    app.get('/mpd/custom/:command', function (req, res) {
        MpdClient.custom(req.params.command);
        res.send("OK");
    });

    app.get('/mpd/configure/:host/:port', function (req, res) {
        MpdClient.configure(req.params.host, req.params.port);
        res.send("OK");
    });

    app.get('/library/loadonce/:treeDesc?', function (req, res) {
        var treeDesc = req.params.treeDesc || "genre,artist,album";
        LibLoader.loadOnce(res, treeDesc.split(","));
    });

    app.get('/library/reload/:treeDesc?', function (req, res) {
        var treeDesc = req.params.treeDesc || "genre,artist,album";
        LibLoader.reload(res, treeDesc.split(","));
    });

    app.get('/library/progress', function (req, res) {
        LibLoader.progress(res);
    });

    app.get('/library/get/:start/:count', function (req, res) {
        LibLoader.getPage(res, req.params.start, req.params.count);
    });
}
exports.register = register;
