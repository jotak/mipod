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
var Statistics = require('./Statistics');
var MpdStatus = require('./MpdStatus');
var MpdEntries = require('./MpdEntries');

var MpdClient = require('./MpdClient');

var tools = require('./tools');
var q = require('q');
var typeCheck = require('type-check');

function answerOnPromise(promise, socket, word, body) {
    promise.then(function (answer) {
        socketEmit(socket, word, fillToken({ content: answer }, body));
    }).fail(function (reason) {
        console.log("Application error: " + reason.message);
        socketEmit(socket, word, fillToken({ failure: String(reason) }, body));
    }).done();
}

function fillToken(obj, body) {
    if (typeof body !== "undefined" && body.hasOwnProperty("token")) {
        obj.token = body.token;
    }
    return obj;
}

function check(typeDesc, obj, socket, word) {
    if (!typeCheck.typeCheck(typeDesc, obj)) {
        console.log("Typecheck error, expecting pattern " + typeDesc);
        console.log("But had:");
        console.log(obj);
        socketEmit(socket, word, { failure: "Malformed json, expecting: " + typeDesc });
        return false;
    }
    return true;
}

function socketEmit(emitter, word, data) {
    console.log("Emitting: " + word);
    emitter.emit(word, data);
}

"use strict";
function register(socketMngr, prefix, library, enableStats) {
    var word = function (word) {
        return prefix + word;
    };

    // Start idle loop
    idleLoop(socketMngr, word("onchange"));

    // Statistics service (notifies tags)
    if (enableStats) {
        new Statistics(library, function (tag) {
            socketEmit(socketMngr.sockets, word("ontag"), tag);
        });
    }

    socketMngr.on("connection", function (socket) {
        var socketOn = function (word, func) {
            socket.on(word, function (body) {
                console.log("Incomming on websocket: " + word);
                func(body);
            });
        };

        socketOn(word("play"), function (body) {
            answerOnPromise(MpdClient.play(), socket, word("play"), body);
        });

        socketOn(word("play-entry"), function (body) {
            if (check("{token: Maybe String, entry: String}", body, socket, word("play-entry"))) {
                answerOnPromise(MpdClient.playEntry(body.entry), socket, word("play-entry"), body);
            }
        });

        socketOn(word("play-idx"), function (body) {
            if (check("{token: Maybe String, idx: Number}", body, socket, word("play-idx"))) {
                answerOnPromise(MpdClient.playIdx(body.idx), socket, word("play-idx"), body);
            }
        });

        socketOn(word("add"), function (body) {
            if (check("{token: Maybe String, entry: String}", body, socket, word("add"))) {
                answerOnPromise(MpdClient.add(body.entry), socket, word("add"), body);
            }
        });

        socketOn(word("clear"), function (body) {
            answerOnPromise(MpdClient.clear(), socket, word("clear"), body);
        });

        socketOn(word("pause"), function (body) {
            answerOnPromise(MpdClient.pause(), socket, word("pause"), body);
        });

        socketOn(word("stop"), function (body) {
            answerOnPromise(MpdClient.stop(), socket, word("stop"), body);
        });

        socketOn(word("next"), function (body) {
            answerOnPromise(MpdClient.next(), socket, word("next"), body);
        });

        socketOn(word("prev"), function (body) {
            answerOnPromise(MpdClient.prev(), socket, word("prev"), body);
        });

        socketOn(word("volume"), function (body) {
            if (check("{token: Maybe String, value: Number}", body, socket, word("volume"))) {
                answerOnPromise(MpdClient.volume(body.value), socket, word("volume"), body);
            }
        });

        socketOn(word("repeat"), function (body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("repeat"))) {
                answerOnPromise(MpdClient.repeat(body.enabled), socket, word("repeat"), body);
            }
        });

        socketOn(word("random"), function (body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("random"))) {
                answerOnPromise(MpdClient.random(body.enabled), socket, word("random"), body);
            }
        });

        socketOn(word("single"), function (body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("single"))) {
                answerOnPromise(MpdClient.single(body.enabled), socket, word("single"), body);
            }
        });

        socketOn(word("consume"), function (body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("consume"))) {
                answerOnPromise(MpdClient.consume(body.enabled), socket, word("consume"), body);
            }
        });

        socketOn(word("seek"), function (body) {
            if (check("{token: Maybe String, songIdx: Number, posInSong: Number}", body, socket, word("seek"))) {
                answerOnPromise(MpdClient.seek(body.songIdx, body.posInSong), socket, word("seek"), body);
            }
        });

        socketOn(word("rmqueue"), function (body) {
            if (check("{token: Maybe String, songIdx: Number}", body, socket, word("rmqueue"))) {
                answerOnPromise(MpdClient.removeFromQueue(body.songIdx), socket, word("rmqueue"), body);
            }
        });

        socketOn(word("deletelist"), function (body) {
            if (check("{token: Maybe String, name: String}", body, socket, word("deletelist"))) {
                answerOnPromise(MpdClient.deleteList(body.name), socket, word("deletelist"), body);
            }
        });

        socketOn(word("savelist"), function (body) {
            if (check("{token: Maybe String, name: String}", body, socket, word("savelist"))) {
                answerOnPromise(MpdClient.saveList(body.name), socket, word("savelist"), body);
            }
        });

        socketOn(word("playall"), function (body) {
            if (check("{token: Maybe String, entries: [String]}", body, socket, word("playall"))) {
                answerOnPromise(MpdClient.playAll(body.entries), socket, word("playall"), body);
            }
        });

        socketOn(word("addall"), function (body) {
            if (check("{token: Maybe String, entries: [String]}", body, socket, word("addall"))) {
                answerOnPromise(MpdClient.addAll(body.entries), socket, word("addall"), body);
            }
        });

        socketOn(word("update"), function (body) {
            if (check("{token: Maybe String, path: String}", body, socket, word("update"))) {
                library.clearCache();
                answerOnPromise(MpdClient.update(body.path), socket, word("update"), body);
            }
        });

        socketOn(word("current"), function (body) {
            var promise = MpdClient.current().then(MpdEntries.readEntries).then(function (entries) {
                return entries.length === 0 ? {} : entries[0];
            });
            answerOnPromise(promise, socket, word("current"), body);
        });

        socketOn(word("status"), function (body) {
            answerOnPromise(MpdClient.status().then(MpdStatus.parse), socket, word("status"), body);
        });

        //        socketOn(word("idle"), function(body) {
        //            answerOnPromise(MpdClient.idle(), socket, word("idle"), body);
        //        });
        socketOn(word("custom"), function (body) {
            if (check("{token: Maybe String, command: String, stopper: Maybe String, parser: Maybe String}", body, socket, word("custom"))) {
                MpdClient.custom(body.command, body.stopper).then(function (mpdResponse) {
                    var response = { token: body.token, content: undefined };
                    response.content = mpdResponse;
                    if (body.parser === "entries") {
                        response.content = MpdEntries.readEntries(mpdResponse);
                    } else if (body.parser === "status") {
                        response.content = MpdStatus.parse(mpdResponse);
                    }
                    socketEmit(socket, word("custom"), response);
                }).fail(function (reason) {
                    console.log("Application error: " + reason.message);
                    socketEmit(socket, word("custom"), { failure: String(reason), context: body });
                }).done();
            }
        });

        socketOn(word("lib-clearcache"), function (body) {
            answerOnPromise(library.clearCache(), socket, word("lib-clearcache"), body);
        });

        socketOn(word("lib-progress"), function () {
            socketEmit(socket, word("lib-progress"), { progress: library.progress() });
        });

        socketOn(word("lib-get"), function (body) {
            if (check("{start: Number, count: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]}", body, socket, word("lib-get"))) {
                var treeDesc = body.treeDesc || ["genre", "albumArtist|artist", "album"];
                var promise = library.getPage(body.start, body.count, treeDesc, body.leafDesc);
                answerOnPromise(promise, socket, word("lib-get"), body);
            }
        });

        socketOn(word("lib-push-request"), function (body) {
            if (check("{maxBatchSize: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]}", body, socket, word("lib-push"))) {
                var treeDesc = body.treeDesc || ["genre", "albumArtist|artist", "album"];
                library.notifyLoading(function (data, nbItems) {
                    socketEmit(socket, word("lib-push"), { progress: nbItems, data: data });
                }, function (nbItems) {
                    socketEmit(socket, word("lib-finished-loading"), { nbItems: nbItems });
                }, body.maxBatchSize, treeDesc, body.leafDesc);
            }
        });

        socketOn(word("lsinfo"), function (body) {
            if (check("{token: Maybe String, path: String, leafDesc: Maybe [String]}", body, socket, word("lsinfo"))) {
                library.lsInfo(body.path, body.leafDesc).then(function (lstContent) {
                    socketEmit(socket, word("lsinfo"), { token: body.token, content: lstContent });
                });
            }
        });

        socketOn(word("search"), function (body) {
            if (check("{token: Maybe String, mode: String, search: String, leafDesc: Maybe [String]}", body, socket, word("search"))) {
                library.search(body.mode, body.search, body.leafDesc).then(function (lstContent) {
                    socketEmit(socket, word("search"), { token: body.token, content: lstContent });
                });
            }
        });

        socketOn(word("gettag"), function (body) {
            if (check("{tagName: String, targets: [{targetType: String, target: String}]}", body, socket, word("gettag"))) {
                library.readTag(body.tagName, body.targets).then(function (tags) {
                    socketEmit(socketMngr.sockets, word("ontag"), tags);
                });
            }
        });

        socketOn(word("settag"), function (body) {
            if (check("{tagName: String, tagValue: String, targets: [{targetType: String, target: String}]}", body, socket, word("settag"))) {
                library.writeTag(body.tagName, body.tagValue, body.targets).then(function (tags) {
                    socketEmit(socketMngr.sockets, word("ontag"), tags);
                });
            }
        });

        socketOn(word("deltag"), function (body) {
            if (check("{tagName: String, targets: [{targetType: String, target: String}]}", body, socket, word("deltag"))) {
                library.deleteTag(body.tagName, body.targets).then(function (tags) {
                    socketEmit(socketMngr.sockets, word("ontag"), tags);
                });
            }
        });
    });
}
exports.register = register;

function getStatusAndCurrent() {
    return q.all([
        MpdClient.status().then(MpdStatus.parse),
        MpdClient.current().then(MpdEntries.readEntries).then(function (entries) {
            return entries.length === 0 ? {} : entries[0];
        })
    ]);
}

var lastIdleSuccess = true;
var lastStatus = {};
var lastCurrent = { song: undefined, dir: undefined, playlist: undefined };
function idleOnce(args) {
    getStatusAndCurrent().then(function (results) {
        var status = results[0];
        var current = results[1];
        if (!MpdEntries.entryEquals(lastCurrent, current) || !tools.mapEquals(lastStatus, status, ["volume", "repeat", "random", "single", "consume", "state", "song", "songid"])) {
            socketEmit(args.socketMngr.sockets, args.word, { "status": status, "current": current });
            lastCurrent = current;
            lastStatus = status;
        }
        lastIdleSuccess = true;
    }).fail(function (reason) {
        console.log("Idle error: " + reason.message);
        if (lastIdleSuccess) {
            socketEmit(args.socketMngr.sockets, args.word, { failure: String(reason) });
            lastIdleSuccess = false;
        }
    });
}

function idleLoop(socketMngr, word) {
    MpdClient.idleLoop("player mixer options", idleOnce, { socketMngr: socketMngr, word: word });
}
