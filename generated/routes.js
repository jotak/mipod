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
var LibLoader = require('./LibLoader');
var MpdClient = require('./MpdClient');

function answerOnPromise(promise, httpResponse) {
    promise.then(function (mpdResponse) {
        httpResponse.send(mpdResponse);
    }).fail(function (reason) {
        httpResponse.send(reason);
    }).done();
}

"use strict";
function register(app, mpdRoot, libRoot) {
    app.get(mpdRoot + '/configure/:host/:port', function (req, res) {
        MpdClient.configure(req.params.host, +req.params.port);
        res.send("OK");
    });

    app.get(mpdRoot + '/play', function (req, res) {
        answerOnPromise(MpdClient.play(), res);
    });

    app.post(mpdRoot + '/play', function (req, res) {
        answerOnPromise(MpdClient.playEntry(req.body.json), res);
    });

    app.get(mpdRoot + '/playidx/:idx', function (req, res) {
        answerOnPromise(MpdClient.playIdx(+req.params.idx), res);
    });

    app.post(mpdRoot + '/add', function (req, res) {
        answerOnPromise(MpdClient.add(req.body.json), res);
    });

    app.get(mpdRoot + '/clear', function (req, res) {
        answerOnPromise(MpdClient.clear(), res);
    });

    app.get(mpdRoot + '/pause', function (req, res) {
        answerOnPromise(MpdClient.pause(), res);
    });

    app.get(mpdRoot + '/stop', function (req, res) {
        answerOnPromise(MpdClient.stop(), res);
    });

    app.get(mpdRoot + '/next', function (req, res) {
        answerOnPromise(MpdClient.next(), res);
    });

    app.get(mpdRoot + '/prev', function (req, res) {
        answerOnPromise(MpdClient.prev(), res);
    });

    app.get(mpdRoot + '/load/:path', function (req, res) {
        answerOnPromise(MpdClient.load(req.params.path), res);
    });

    app.get(mpdRoot + '/volume/:value', function (req, res) {
        answerOnPromise(MpdClient.volume(req.params.value), res);
    });

    app.get(mpdRoot + '/repeat/:enabled', function (req, res) {
        answerOnPromise(MpdClient.repeat(req.params.enabled === "1"), res);
    });

    app.get(mpdRoot + '/random/:enabled', function (req, res) {
        answerOnPromise(MpdClient.random(req.params.enabled === "1"), res);
    });

    app.get(mpdRoot + '/single/:enabled', function (req, res) {
        answerOnPromise(MpdClient.single(req.params.enabled === "1"), res);
    });

    app.get(mpdRoot + '/consume/:enabled', function (req, res) {
        answerOnPromise(MpdClient.consume(req.params.enabled === "1"), res);
    });

    app.get(mpdRoot + '/seek/:songIdx/:posInSong', function (req, res) {
        answerOnPromise(MpdClient.seek(+req.params.songIdx, +req.params.posInSong), res);
    });

    app.get(mpdRoot + '/rmqueue/:songIdx', function (req, res) {
        answerOnPromise(MpdClient.removeFromQueue(+req.params.songIdx), res);
    });

    app.get(mpdRoot + '/deletelist/:name', function (req, res) {
        answerOnPromise(MpdClient.deleteList(req.params.name), res);
    });

    app.get(mpdRoot + '/savelist/:name', function (req, res) {
        answerOnPromise(MpdClient.saveList(req.params.name), res);
    });

    app.post(mpdRoot + '/playall', function (req, res) {
        answerOnPromise(MpdClient.playAll(req.body.json), res);
    });

    app.post(mpdRoot + '/addall', function (req, res) {
        answerOnPromise(MpdClient.addAll(req.body.json), res);
    });

    app.post(mpdRoot + '/update', function (req, res) {
        answerOnPromise(MpdClient.update(req.body.json), res);
    });

    app.get(mpdRoot + '/custom/:command', function (req, res) {
        answerOnPromise(MpdClient.custom(req.params.command), res);
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

    app.post(libRoot + '/lsinfo/:leafDesc?', function (req, res) {
        var leafDesc = req.params.leafDesc || "file,directory,title,artist,album,time";
        LibLoader.lsInfo(req.body.json, leafDesc.split(",")).then(function (lstContent) {
            res.send(lstContent);
        });
    });

    app.get(mpdRoot, function (req, res) {
        res.send("Available resources on " + mpdRoot + " are: <br/><ul>" + "<li>" + mpdRoot + "/configure/:host/:port</li>" + "<li>" + mpdRoot + "/play/:path?</li>" + "<li>" + mpdRoot + "/playidx/:idx</li>" + "<li>" + mpdRoot + "/add/:path</li>" + "<li>" + mpdRoot + "/clear</li>" + "<li>" + mpdRoot + "/pause</li>" + "<li>" + mpdRoot + "/stop</li>" + "<li>" + mpdRoot + "/next</li>" + "<li>" + mpdRoot + "/prev</li>" + "<li>" + mpdRoot + "/load/:path</li>" + "<li>" + mpdRoot + "/volume/:value</li>" + "<li>" + mpdRoot + "/repeat/:enabled</li>" + "<li>" + mpdRoot + "/random/:enabled</li>" + "<li>" + mpdRoot + "/single/:enabled</li>" + "<li>" + mpdRoot + "/consume/:enabled</li>" + "<li>" + mpdRoot + "/seek/:songIdx/:posInSong</li>" + "<li>" + mpdRoot + "/custom/:command</li>" + "</ul>Check documentation on <a href='https://github.com/jotak/mipod'>https://github.com/jotak/mipod</a>");
    });

    app.get(libRoot, function (req, res) {
        res.send("Available resources on " + libRoot + " are: <br/><ul>" + "<li>" + libRoot + "/loadonce</li>" + "<li>" + libRoot + "/reload</li>" + "<li>" + libRoot + "/progress</li>" + "<li>" + libRoot + "/get/:start/:count/:treeDesc?/:leafDesc?</li>" + "</ul>Check documentation on <a href='https://github.com/jotak/mipod'>https://github.com/jotak/mipod</a>");
    });
}
exports.register = register;
