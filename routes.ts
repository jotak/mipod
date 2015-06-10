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

/// <reference path="type-check/type-check.d.ts" />

import lib = require('./Library');
import Statistics = require('./Statistics');
import MpdStatus = require('./MpdStatus');
import MpdEntries = require('./MpdEntries');
import MpdEntry = require('./libtypes/MpdEntry');
import MpdClient = require('./MpdClient');
import ThemeTags = require('./libtypes/ThemeTags');
import q = require('q');
import typeCheck = require('type-check');
import express = require('express');

function answerOnPromise(promise: q.Promise<any>, httpResponse: any) {
    promise.then(function(answer: any) {
        httpResponse.send(answer);
    }).fail(function(reason: Error) {
        console.log("Application error: " + reason.message);
        httpResponse.status(500).send(String(reason));
    }).done();
}

function check(typeDesc: string, obj: any, httpResponse: any) {
    if (!typeCheck.typeCheck(typeDesc, obj)) {
        console.log(obj);
        httpResponse.status(400).send("Malformed json, expecting: " + typeDesc);
        return false;
    }
    return true;
}

interface RouteInfo {
    path: string;
    description?: string;
    verb: string;
}

"use strict";
export function register(app: express.Application, prefix: string, library: lib.Library, enableStats: boolean) {

    var routes: RouteInfo[] = [];

    var httpGet = function(path: string, clbk, description?: string) {
        app.get(prefix + path, clbk);
        routes.push({path: prefix + path, description: description, verb: "GET"});
    }
    var httpPost = function(path: string, clbk, description?: string) {
        app.post(prefix + path, clbk);
        routes.push({path: prefix + path, description: description, verb: "POST"});
    }
    var httpPut = function(path: string, clbk, description?: string) {
        app.put(prefix + path, clbk);
        routes.push({path: prefix + path, description: description, verb: "PUT"});
    }
    var httpDelete = function(path: string, clbk, description?: string) {
        app.delete(prefix + path, clbk);
        routes.push({path: prefix + path, description: description, verb: "DELETE"});
    }

    if (enableStats) {
        new Statistics(library, function(tag: ThemeTags) {
        });
    }

    httpGet('/play', function(req, res) {
        answerOnPromise(MpdClient.play(), res);
    });

    httpPost('/play', function(req, res) {
        if (check("{entry: String}", req.body, res)) {
            answerOnPromise(MpdClient.playEntry(req.body.entry), res);
        }
    });

    httpGet('/playidx/:idx', function(req, res) {
        answerOnPromise(MpdClient.playIdx(+req.params.idx), res);
    });

    httpPost('/add', function(req, res) {
        if (check("{entry: String}", req.body, res)) {
            answerOnPromise(MpdClient.add(req.body.entry), res);
        }
    });

    httpGet('/clear', function(req, res) {
        answerOnPromise(MpdClient.clear(), res);
    });

    httpGet('/pause', function(req, res) {
        answerOnPromise(MpdClient.pause(), res);
    });

    httpGet('/stop', function(req, res) {
        answerOnPromise(MpdClient.stop(), res);
    });

    httpGet('/next', function(req, res) {
        answerOnPromise(MpdClient.next(), res);
    });

    httpGet('/prev', function(req, res) {
        answerOnPromise(MpdClient.prev(), res);
    });

    httpGet('/volume/:value', function(req, res) {
        answerOnPromise(MpdClient.volume(req.params.value), res);
    });

    httpGet('/repeat/:enabled', function(req, res) {
        answerOnPromise(MpdClient.repeat(req.params.enabled === "1"), res);
    });

    httpGet('/random/:enabled', function(req, res) {
        answerOnPromise(MpdClient.random(req.params.enabled === "1"), res);
    });

    httpGet('/single/:enabled', function(req, res) {
        answerOnPromise(MpdClient.single(req.params.enabled === "1"), res);
    });

    httpGet('/consume/:enabled', function(req, res) {
        answerOnPromise(MpdClient.consume(req.params.enabled === "1"), res);
    });

    httpGet('/seek/:songIdx/:posInSong', function(req, res) {
        answerOnPromise(MpdClient.seek(+req.params.songIdx, +req.params.posInSong), res);
    });

    httpGet('/rmqueue/:songIdx', function(req, res) {
        answerOnPromise(MpdClient.removeFromQueue(+req.params.songIdx), res);
    });

    httpGet('/deletelist/:name', function(req, res) {
        answerOnPromise(MpdClient.deleteList(req.params.name), res);
    });

    httpGet('/savelist/:name', function(req, res) {
        answerOnPromise(MpdClient.saveList(req.params.name), res);
    });

    httpPost('/playall', function(req, res) {
        if (check("{entries: [String]}", req.body, res)) {
            answerOnPromise(MpdClient.playAll(req.body.entries), res);
        }
    });

    httpPost('/addall', function(req, res) {
        if (check("{entries: [String]}", req.body, res)) {
            answerOnPromise(MpdClient.addAll(req.body.entries), res);
        }
    });

    httpPost('/update', function(req, res) {
        if (check("{path: String}", req.body, res)) {
            answerOnPromise(MpdClient.update(req.body.path), res);
        }
    });

    httpGet('/current', function(req, res) {
        answerOnPromise(
            MpdClient.current().then(MpdEntries.readEntries).then(function(entries: MpdEntry[]) {
                return entries.length === 0 ? {} : entries[0];
            }), res);
    });

    httpGet('/idle', function(req, res) {
        answerOnPromise(MpdClient.idle(), res);
    });

    httpGet('/status', function(req, res) {
        answerOnPromise(MpdClient.status().then(MpdStatus.parse), res);
    });

    httpGet('/playlistInfo/:idx?', function(req, res) {
        if (req.params.idx) {
            answerOnPromise(MpdClient.playlistInfoIdx(+req.params.idx), res);
        } else {
            answerOnPromise(MpdClient.playlistInfo(), res);
        }
    });

    httpPost('/custom', function(req, res) {
        if (check("{command: String, stopper: Maybe String, parser: Maybe String}", req.body, res)) {
            MpdClient.custom(req.body.command, req.body.stopper).then(function(mpdResponse: string) {
                var response: any = mpdResponse;
                if (req.body.parser === "entries") {
                    response = MpdEntries.readEntries(mpdResponse);
                } else if (req.body.parser === "status") {
                    response = MpdStatus.parse(mpdResponse);
                }
                res.send(response);
            }).fail(function(reason: Error) {
                console.log("Application error: " + reason.message);
                res.status(500).send(String(reason));
            }).done();
        }
    });

//    httpGet('/lib-loadonce', function(req, res) {
//        var status: string = library.loadOnce();
//        res.send({status: status});
//    });
//
//    httpGet('/lib-reload', function(req, res) {
//        var status: string = library.forceRefreshforceRefresh();
//        res.send({status: status});
//    });
//
//    httpGet('/lib-progress', function(req, res) {
//        res.send({progress: library.progress()});
//    });
//
//    httpPost('/lib-get/:start/:count', function(req, res) {
//        if (check("{treeDesc: Maybe [String], leafDesc: Maybe [String]}", req.body, res)) {
//            var treeDesc: string[] = req.body.treeDesc || ["genre","albumArtist|artist","album"];
//            var page = library.getPage(+req.params.start, +req.params.count, treeDesc, req.body.leafDesc);
//            res.send(page);
//        }
//    });

    httpPost('/lsinfo', function(req, res) {
        if (check("{path: String, leafDesc: Maybe [String]}", req.body, res)) {
            library.lsInfo(req.body.path, req.body.leafDesc).then(function(lstContent: any[]) {
                res.send(lstContent);
            });
        }
    });

    httpPost('/search/:mode', function(req, res) {
        if (check("{search: String, leafDesc: Maybe [String]}", req.body, res)) {
            library.search(req.params.mode, req.body.search, req.body.leafDesc).then(function(lstContent: any[]) {
                res.send(lstContent);
            });
        }
    });

    httpPost('/tag/:tagName/:tagValue?', function(req, res) {
        var tagName: string = req.params.tagName;
        var tagValue: string = req.params.tagValue;
        if (check("{targets: [{targetType: String, target: String}]}", req.body, res)) {
            if (tagValue === undefined) {
                answerOnPromise(library.readTag(tagName, req.body.targets), res);
            } else {
                answerOnPromise(library.writeTag(tagName, tagValue, req.body.targets), res);
            }
        }
    });

    httpDelete('/tag/:tagName', function(req, res) {
        var tagName: string = req.params.tagName;
        if (check("{targets: [{targetType: String, target: String}]}", req.body, res)) {
            answerOnPromise(library.deleteTag(tagName, req.body.targets), res);
        }
    });

    httpGet('/playlist/:idx', function(req, res) {
        var idx: number = +req.params.idx;
        answerOnPromise(
            library.lsInfo("", ["playlist"]).then(function(lstContent: any[]) {
                if (idx >= 0 && lstContent.length > idx && lstContent[idx].playlist) {
                    return MpdClient.playEntry(lstContent[idx].playlist);
                }
            }),
            res
        );
    });

    app.get(prefix + '/', function(req, res) {
        var resp: string = "Available resources: <br/><ul>";
        for (var i in routes) {
            var route: RouteInfo = routes[i];
            resp += "<li>" + route.verb + " " + route.path + (route.description ? " <i>" + route.description + "</i>" : "") + "</li>";
        }
        resp += "</ul>Check documentation on <a href='https://github.com/jotak/mipod'>https://github.com/jotak/mipod</a>";
        res.send(resp);
    });
}
