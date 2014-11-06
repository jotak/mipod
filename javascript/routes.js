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
var MpdEntries = require('./MpdEntries');
var MpdClient = require('./MpdClient');
var typeCheck = require('type-check');
function answerOnPromise(promise, httpResponse) {
    promise.then(function (answer) {
        httpResponse.send(answer);
    }).fail(function (reason) {
        console.log("Application error: " + reason.message);
        httpResponse.status(500).send(String(reason));
    }).done();
}
function check(typeDesc, obj, httpResponse) {
    if (!typeCheck.typeCheck(typeDesc, obj)) {
        httpResponse.status(400).send("Malformed json, expecting: " + typeDesc);
        return false;
    }
    return true;
}
"use strict";
function register(app, prefix, library) {
    var routes = [];
    var httpGet = function (path, clbk, description) {
        app.get(prefix + path, clbk);
        routes.push({ path: prefix + path, description: description, verb: "GET" });
    };
    var httpPost = function (path, clbk, description) {
        app.post(prefix + path, clbk);
        routes.push({ path: prefix + path, description: description, verb: "POST" });
    };
    var httpPut = function (path, clbk, description) {
        app.put(prefix + path, clbk);
        routes.push({ path: prefix + path, description: description, verb: "PUT" });
    };
    var httpDelete = function (path, clbk, description) {
        app.delete(prefix + path, clbk);
        routes.push({ path: prefix + path, description: description, verb: "DELETE" });
    };
    httpGet('/play', function (req, res) {
        answerOnPromise(MpdClient.play(), res);
    });
    httpPost('/play', function (req, res) {
        if (check("{json: String}", req.body, res)) {
            answerOnPromise(MpdClient.playEntry(req.body.json), res);
        }
    });
    httpGet('/playidx/:idx', function (req, res) {
        answerOnPromise(MpdClient.playIdx(+req.params.idx), res);
    });
    httpPost('/add', function (req, res) {
        if (check("{json: String}", req.body, res)) {
            answerOnPromise(MpdClient.add(req.body.json), res);
        }
    });
    httpGet('/clear', function (req, res) {
        answerOnPromise(MpdClient.clear(), res);
    });
    httpGet('/pause', function (req, res) {
        answerOnPromise(MpdClient.pause(), res);
    });
    httpGet('/stop', function (req, res) {
        answerOnPromise(MpdClient.stop(), res);
    });
    httpGet('/next', function (req, res) {
        answerOnPromise(MpdClient.next(), res);
    });
    httpGet('/prev', function (req, res) {
        answerOnPromise(MpdClient.prev(), res);
    });
    httpGet('/volume/:value', function (req, res) {
        answerOnPromise(MpdClient.volume(req.params.value), res);
    });
    httpGet('/repeat/:enabled', function (req, res) {
        answerOnPromise(MpdClient.repeat(req.params.enabled === "1"), res);
    });
    httpGet('/random/:enabled', function (req, res) {
        answerOnPromise(MpdClient.random(req.params.enabled === "1"), res);
    });
    httpGet('/single/:enabled', function (req, res) {
        answerOnPromise(MpdClient.single(req.params.enabled === "1"), res);
    });
    httpGet('/consume/:enabled', function (req, res) {
        answerOnPromise(MpdClient.consume(req.params.enabled === "1"), res);
    });
    httpGet('/seek/:songIdx/:posInSong', function (req, res) {
        answerOnPromise(MpdClient.seek(+req.params.songIdx, +req.params.posInSong), res);
    });
    httpGet('/rmqueue/:songIdx', function (req, res) {
        answerOnPromise(MpdClient.removeFromQueue(+req.params.songIdx), res);
    });
    httpGet('/deletelist/:name', function (req, res) {
        answerOnPromise(MpdClient.deleteList(req.params.name), res);
    });
    httpGet('/savelist/:name', function (req, res) {
        answerOnPromise(MpdClient.saveList(req.params.name), res);
    });
    httpPost('/playall', function (req, res) {
        if (check("{json: [String]}", req.body, res)) {
            answerOnPromise(MpdClient.playAll(req.body.json), res);
        }
    });
    httpPost('/addall', function (req, res) {
        if (check("{json: [String]}", req.body, res)) {
            answerOnPromise(MpdClient.addAll(req.body.json), res);
        }
    });
    httpPost('/update', function (req, res) {
        if (check("{json: String}", req.body, res)) {
            answerOnPromise(MpdClient.update(req.body.json), res);
        }
    });
    httpGet('/current', function (req, res) {
        answerOnPromise(MpdClient.current().then(MpdEntries.readEntries).then(function (entries) {
            return entries.length === 0 ? {} : entries[0];
        }), res);
    });
    httpGet('/custom/:command', function (req, res) {
        answerOnPromise(MpdClient.custom(req.params.command), res);
    });
    httpGet('/loadonce', function (req, res) {
        var status = library.loadOnce();
        res.send({ status: status });
    });
    httpGet('/reload', function (req, res) {
        var status = library.forceRefresh();
        res.send({ status: status });
    });
    httpGet('/progress', function (req, res) {
        res.send({ progress: library.progress() });
    });
    httpPost('/get/:start/:count', function (req, res) {
        if (check("{treeDesc: Maybe [String], leafDesc: Maybe [String]}", req.body, res)) {
            var treeDesc = req.body.treeDesc || ["genre", "albumArtist|artist", "album"];
            var page = library.getPage(+req.params.start, +req.params.count, treeDesc, req.body.leafDesc);
            res.send(page);
        }
    });
    httpPost('/lsinfo', function (req, res) {
        if (check("{path: String, req.body.leafDesc: Maybe [String]}", req.body, res)) {
            library.lsInfo(req.body.path, req.body.leafDesc).then(function (lstContent) {
                res.send(lstContent);
            });
        }
    });
    httpPost('/search/:mode', function (req, res) {
        if (check("{search: String, leafDesc: Maybe [String]}", req.body, res)) {
            library.search(req.params.mode, req.body.search, req.body.leafDesc).then(function (lstContent) {
                res.send(lstContent);
            });
        }
    });
    httpPost('/tag/:tagName/:tagValue?', function (req, res) {
        var tagName = req.params.tagName;
        var tagValue = req.params.tagValue;
        if (check("{targets: [{targetType: String, target: String}]}", req.body, res)) {
            if (tagValue === undefined) {
                answerOnPromise(library.readTag(tagName, req.body.targets), res);
            }
            else {
                answerOnPromise(library.writeTag(tagName, tagValue, req.body.targets), res);
            }
        }
    });
    app.get(prefix + '/', function (req, res) {
        var resp = "Available resources: <br/><ul>";
        for (var i in routes) {
            var route = routes[i];
            resp += "<li>" + route.verb + " " + route.path + (route.description ? " <i>" + route.description + "</i>" : "") + "</li>";
        }
        resp += "</ul>Check documentation on <a href='https://github.com/jotak/mipod'>https://github.com/jotak/mipod</a>";
        res.send(resp);
    });
}
exports.register = register;
