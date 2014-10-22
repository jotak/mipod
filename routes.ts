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

import LibLoader = require('./LibLoader');
import MpdClient = require('./MpdClient');
import q = require('q');

function answerOnPromise(promise: q.Promise<string>, httpResponse: any) {
    promise.then(function(mpdResponse: string) {
        httpResponse.send(mpdResponse);
    }).fail(function(reason: Error) {
        console.log("Application error: " + reason.message);
        httpResponse.status(500).send(String(reason));
    }).done();
}

interface RouteInfo {
    path: string;
    description?: string;
    verb: string;
}

"use strict";
export function register(app, mpdRoot: string, libRoot: string, library: LibLoader) {

    var routes: RouteInfo[] = [];

    var httpGet = function(path: string, clbk, description?: string) {
        app.get(path, clbk);
        routes.push({path: path, description: description, verb: "GET"});
    }
    var httpPost = function(path: string, clbk, description?: string) {
        app.post(path, clbk);
        routes.push({path: path, description: description, verb: "POST"});
    }
    var httpPut = function(path: string, clbk, description?: string) {
        app.put(path, clbk);
        routes.push({path: path, description: description, verb: "PUT"});
    }
    var httpDelete = function(path: string, clbk, description?: string) {
        app.delete(path, clbk);
        routes.push({path: path, description: description, verb: "DELETE"});
    }

    httpGet(mpdRoot + '/configure/:host/:port', function(req, res) {
        MpdClient.configure(req.params.host, +req.params.port);
        res.send("OK");
    });

    httpGet(mpdRoot + '/play', function(req, res) {
        answerOnPromise(MpdClient.play(), res);
    });

    httpPost(mpdRoot + '/play', function(req, res) {
        answerOnPromise(MpdClient.playEntry(req.body.json), res);
    });

    httpGet(mpdRoot + '/playidx/:idx', function(req, res) {
        answerOnPromise(MpdClient.playIdx(+req.params.idx), res);
    });

    httpPost(mpdRoot + '/add', function(req, res) {
        answerOnPromise(MpdClient.add(req.body.json), res);
    });

    httpGet(mpdRoot + '/clear', function(req, res) {
        answerOnPromise(MpdClient.clear(), res);
    });

    httpGet(mpdRoot + '/pause', function(req, res) {
        answerOnPromise(MpdClient.pause(), res);
    });

    httpGet(mpdRoot + '/stop', function(req, res) {
        answerOnPromise(MpdClient.stop(), res);
    });

    httpGet(mpdRoot + '/next', function(req, res) {
        answerOnPromise(MpdClient.next(), res);
    });

    httpGet(mpdRoot + '/prev', function(req, res) {
        answerOnPromise(MpdClient.prev(), res);
    });

    httpGet(mpdRoot + '/load/:path', function(req, res) {
        answerOnPromise(MpdClient.load(req.params.path), res);
    });

    httpGet(mpdRoot + '/volume/:value', function(req, res) {
        answerOnPromise(MpdClient.volume(req.params.value), res);
    });

    httpGet(mpdRoot + '/repeat/:enabled', function(req, res) {
        answerOnPromise(MpdClient.repeat(req.params.enabled === "1"), res);
    });

    httpGet(mpdRoot + '/random/:enabled', function(req, res) {
        answerOnPromise(MpdClient.random(req.params.enabled === "1"), res);
    });

    httpGet(mpdRoot + '/single/:enabled', function(req, res) {
        answerOnPromise(MpdClient.single(req.params.enabled === "1"), res);
    });

    httpGet(mpdRoot + '/consume/:enabled', function(req, res) {
        answerOnPromise(MpdClient.consume(req.params.enabled === "1"), res);
    });

    httpGet(mpdRoot + '/seek/:songIdx/:posInSong', function(req, res) {
        answerOnPromise(MpdClient.seek(+req.params.songIdx, +req.params.posInSong), res);
    });

    httpGet(mpdRoot + '/rmqueue/:songIdx', function(req, res) {
        answerOnPromise(MpdClient.removeFromQueue(+req.params.songIdx), res);
    });

    httpGet(mpdRoot + '/deletelist/:name', function(req, res) {
        answerOnPromise(MpdClient.deleteList(req.params.name), res);
    });

    httpGet(mpdRoot + '/savelist/:name', function(req, res) {
        answerOnPromise(MpdClient.saveList(req.params.name), res);
    });

    httpPost(mpdRoot + '/playall', function(req, res) {
        answerOnPromise(MpdClient.playAll(req.body.json), res);
    });

    httpPost(mpdRoot + '/addall', function(req, res) {
        answerOnPromise(MpdClient.addAll(req.body.json), res);
    });

    httpPost(mpdRoot + '/update', function(req, res) {
        answerOnPromise(MpdClient.update(req.body.json), res);
    });

    httpPost(mpdRoot + '/rate/:value?', function(req, res) {
        if (req.params.value === undefined) {
            answerOnPromise(MpdClient.getRate(req.body.json), res);
        } else {
            answerOnPromise(MpdClient.rate(req.body.json, req.params.value), res);
        }
    });

    httpGet(mpdRoot + '/custom/:command', function(req, res) {
        answerOnPromise(MpdClient.custom(req.params.command), res);
    });

    httpGet(libRoot + '/loadonce', function(req, res) {
        var status: string = library.loadOnce();
        res.send({status: status});
    });

    httpGet(libRoot + '/reload', function(req, res) {
        var status: string = library.forceRefresh();
        res.send({status: status});
    });

    httpGet(libRoot + '/progress', function(req, res) {
        library.progress(res);
    });

    httpGet(libRoot + '/get/:start/:count/:treeDesc?/:leafDesc?', function(req, res) {
        var treeDesc: string = req.params.treeDesc || "genre,albumArtist|artist,album";
        var leafDesc: string = req.params.leafDesc || "file,track,title";
        library.getPage(res, +req.params.start, +req.params.count, treeDesc.split(","), leafDesc.split(","));
    });

    httpPost(libRoot + '/lsinfo/:leafDesc?', function(req, res) {
        var leafDesc: string = req.params.leafDesc || "file,directory,title,artist,album,time";
        library.lsInfo(req.body.json, leafDesc.split(",")).then(function(lstContent: any[]) {
            res.send(lstContent);
        });
    });

    httpPost(libRoot + '/tag/:tagName/:tagValue', function(req, res) {
        var tagName: string = req.params.tagName;
        var tagValue: string = req.params.tagValue;
        answerOnPromise(library.writeTag(tagName, tagValue, req.body.targetType, req.body.target), res);
    });

    app.get("/", function(req, res) {
        var resp: string = "Available resources: <br/><ul>";
        for (var i in routes) {
            var route: RouteInfo = routes[i];
            resp += "<li>" + route.verb + " " + route.path + (route.description ? " <i>" + route.description + "</i>" : "") + "</li>";
        }
        resp += "</ul>Check documentation on <a href='https://github.com/jotak/mipod'>https://github.com/jotak/mipod</a>";
        res.send(resp);
    });
}
