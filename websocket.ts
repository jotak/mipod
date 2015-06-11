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
import tools = require('./tools');
import q = require('q');
import typeCheck = require('type-check');
import socketio = require('socket.io');

function answerOnPromise(promise: q.Promise<any>, socket: socketio.Socket, word: string, body: any) {
    promise.then(function(answer: any) {
        socketEmit(socket, word, fillToken({content: answer}, body));
    }).fail(function(reason: Error) {
        console.log("Application error: " + reason.message);
        socketEmit(socket, word, fillToken({failure: String(reason)}, body));
    }).done();
}

function fillToken(obj: any, body: any): any {
    if (typeof body !== "undefined" && body.hasOwnProperty("token")) {
        obj.token = body.token;
    }
    return obj;
}

function check(typeDesc: string, obj: any, socket: socketio.Socket, word: string) {
    if (!typeCheck.typeCheck(typeDesc, obj)) {
        console.log("Typecheck error, expecting pattern " + typeDesc);
        console.log("But had:");
        console.log(obj);
        socketEmit(socket, word, {failure: "Malformed json, expecting: " + typeDesc});
        return false;
    }
    return true;
}

interface Emitter {
    emit: (word: string, data: any) => void;
}

function socketEmit(emitter: Emitter, word: string, data: any): void {
    console.log("Emitting: " + word);
    emitter.emit(word, data);
}

"use strict";
export function register(socketMngr: socketio.SocketManager, prefix: string, library: lib.Library, enableStats: boolean) {

    var word = function(word: string): string { return prefix + word; }

    // Start idle loop
    idleLoop(socketMngr, word("onchange"));

    // Statistics service (notifies tags)
    if (enableStats) {
        new Statistics(library, function(tag: ThemeTags) {
            socketEmit(socketMngr.sockets, word("ontag"), tag);
        });
    }

    socketMngr.on("connection", function(socket) {

        var socketOn = function(word: string, func: (any) => void): void {
            socket.on(word, function(body) {
                console.log("Incomming on websocket: " + word);
                func(body);
            });
        }

        socketOn(word("play"), function(body) {
            answerOnPromise(MpdClient.play(), socket, word("play"), body);
        });

        socketOn(word("play-entry"), function(body) {
            if (check("{token: Maybe String, entry: String}", body, socket, word("play-entry"))) {
                answerOnPromise(MpdClient.playEntry(body.entry), socket, word("play-entry"), body);
            }
        });

        socketOn(word("play-idx"), function(body) {
            if (check("{token: Maybe String, idx: Number}", body, socket, word("play-idx"))) {
                answerOnPromise(MpdClient.playIdx(body.idx), socket, word("play-idx"), body);
            }
        });

        socketOn(word("add"), function(body) {
            if (check("{token: Maybe String, entry: String}", body, socket, word("add"))) {
                answerOnPromise(MpdClient.add(body.entry), socket, word("add"), body);
            }
        });

        socketOn(word("clear"), function(body) {
            answerOnPromise(MpdClient.clear(), socket, word("clear"), body);
        });

        socketOn(word("pause"), function(body) {
            answerOnPromise(MpdClient.pause(), socket, word("pause"), body);
        });

        socketOn(word("stop"), function(body) {
            answerOnPromise(MpdClient.stop(), socket, word("stop"), body);
        });

        socketOn(word("next"), function(body) {
            answerOnPromise(MpdClient.next(), socket, word("next"), body);
        });

        socketOn(word("prev"), function(body) {
            answerOnPromise(MpdClient.prev(), socket, word("prev"), body);
        });

        socketOn(word("volume"), function(body) {
            if (check("{token: Maybe String, value: Number}", body, socket, word("volume"))) {
                answerOnPromise(MpdClient.volume(body.value), socket, word("volume"), body);
            }
        });

        socketOn(word("repeat"), function(body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("repeat"))) {
                answerOnPromise(MpdClient.repeat(body.enabled), socket, word("repeat"), body);
            }
        });

        socketOn(word("random"), function(body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("random"))) {
                answerOnPromise(MpdClient.random(body.enabled), socket, word("random"), body);
            }
        });

        socketOn(word("single"), function(body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("single"))) {
                answerOnPromise(MpdClient.single(body.enabled), socket, word("single"), body);
            }
        });

        socketOn(word("consume"), function(body) {
            if (check("{token: Maybe String, enabled: Boolean}", body, socket, word("consume"))) {
                answerOnPromise(MpdClient.consume(body.enabled), socket, word("consume"), body);
            }
        });

        socketOn(word("seek"), function(body) {
            if (check("{token: Maybe String, songIdx: Number, posInSong: Number}", body, socket, word("seek"))) {
                answerOnPromise(MpdClient.seek(body.songIdx, body.posInSong), socket, word("seek"), body);
            }
        });

        socketOn(word("rmqueue"), function(body) {
            if (check("{token: Maybe String, songIdx: Number}", body, socket, word("rmqueue"))) {
                answerOnPromise(MpdClient.removeFromQueue(body.songIdx), socket, word("rmqueue"), body);
            }
        });

        socketOn(word("deletelist"), function(body) {
            if (check("{token: Maybe String, name: String}", body, socket, word("deletelist"))) {
                answerOnPromise(MpdClient.deleteList(body.name), socket, word("deletelist"), body);
            }
        });

        socketOn(word("savelist"), function(body) {
            if (check("{token: Maybe String, name: String}", body, socket, word("savelist"))) {
                answerOnPromise(MpdClient.saveList(body.name), socket, word("savelist"), body);
            }
        });

        socketOn(word("playall"), function(body) {
            if (check("{token: Maybe String, entries: [String]}", body, socket, word("playall"))) {
                answerOnPromise(MpdClient.playAll(body.entries), socket, word("playall"), body);
            }
        });

        socketOn(word("addall"), function(body) {
            if (check("{token: Maybe String, entries: [String]}", body, socket, word("addall"))) {
                answerOnPromise(MpdClient.addAll(body.entries), socket, word("addall"), body);
            }
        });

        socketOn(word("update"), function(body) {
            if (check("{token: Maybe String, path: String}", body, socket, word("update"))) {
                library.clearCache();
                answerOnPromise(MpdClient.update(body.path), socket, word("update"), body);
            }
        });

        socketOn(word("current"), function(body) {
            var promise: q.Promise<MpdEntry> = MpdClient.current()
                .then(MpdEntries.readEntries)
                .then(function(entries: MpdEntry[]) {
                    return entries.length === 0 ? {} : entries[0];
                });
            answerOnPromise(promise, socket, word("current"), body);
        });

        socketOn(word("status"), function(body) {
            answerOnPromise(MpdClient.status().then(MpdStatus.parse), socket, word("status"), body);
        });

//        socketOn(word("idle"), function(body) {
//            answerOnPromise(MpdClient.idle(), socket, word("idle"), body);
//        });

        socketOn(word("custom"), function(body) {
            if (check("{token: Maybe String, command: String, stopper: Maybe String, parser: Maybe String}", body, socket, word("custom"))) {
                MpdClient.custom(body.command, body.stopper).then(function(mpdResponse: string) {
                    var response = {token: body.token, content: undefined};
                    response.content = mpdResponse;
                    if (body.parser === "entries") {
                        response.content = MpdEntries.readEntries(mpdResponse);
                    } else if (body.parser === "status") {
                        response.content = MpdStatus.parse(mpdResponse);
                    }
                    socketEmit(socket, word("custom"), response);
                }).fail(function(reason: Error) {
                    console.log("Application error: " + reason.message);
                    socketEmit(socket, word("custom"), {failure: String(reason), context: body});
                }).done();
            }
        });

        socketOn(word("lib-clearcache"), function(body) {
            answerOnPromise(library.clearCache(), socket, word("lib-clearcache"), body);
        });

        socketOn(word("lib-progress"), function() {
            socketEmit(socket, word("lib-progress"), {progress: library.progress()});
        });

        socketOn(word("lib-get"), function(body) {
            if (check("{start: Number, count: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]}", body, socket, word("lib-get"))) {
                var treeDesc: string[] = body.treeDesc || ["genre","albumArtist|artist","album"];
                var promise: q.Promise<lib.Page> = library.getPage(body.start, body.count, treeDesc, body.leafDesc);
                answerOnPromise(promise, socket, word("lib-get"), body);
            }
        });

        socketOn(word("lib-push-request"), function(body) {
            if (check("{maxBatchSize: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]}", body, socket, word("lib-push"))) {
                var treeDesc: string[] = body.treeDesc || ["genre","albumArtist|artist","album"];
                library.notifyLoading(
                    function(data: lib.Page, nbItems: number) {
                        socketEmit(socket, word("lib-push"), {progress: nbItems, data: data});
                    },
                    function(nbItems: number) {
                        socketEmit(socket, word("lib-finished-loading"), {nbItems: nbItems});
                    },
                    body.maxBatchSize, treeDesc, body.leafDesc
                );
            }
        });

        socketOn(word("lsinfo"), function(body) {
            if (check("{token: Maybe String, path: String, leafDesc: Maybe [String]}", body, socket, word("lsinfo"))) {
                library.lsInfo(body.path, body.leafDesc).then(function(lstContent: any[]) {
                    socketEmit(socket, word("lsinfo"), {token: body.token, content: lstContent});
                });
            }
        });

        socketOn(word("search"), function(body) {
            if (check("{token: Maybe String, mode: String, search: String, leafDesc: Maybe [String]}", body, socket, word("search"))) {
                library.search(body.mode, body.search, body.leafDesc).then(function(lstContent: any[]) {
                    socketEmit(socket, word("search"), {token: body.token, content: lstContent});
                });
            }
        });

        socketOn(word("gettag"), function(body) {
            if (check("{tagName: String, targets: [{targetType: String, target: String}]}", body, socket, word("gettag"))) {
                library.readTag(body.tagName, body.targets).then(function(tags: ThemeTags) {
                    socketEmit(socketMngr.sockets, word("ontag"), tags);
                });
            }
        });

        socketOn(word("settag"), function(body) {
            if (check("{tagName: String, tagValue: String, targets: [{targetType: String, target: String}]}", body, socket, word("settag"))) {
                library.writeTag(body.tagName, body.tagValue, body.targets).then(function(tags: ThemeTags) {
                    socketEmit(socketMngr.sockets, word("ontag"), tags);
                });
            }
        });

        socketOn(word("deltag"), function(body) {
            if (check("{tagName: String, targets: [{targetType: String, target: String}]}", body, socket, word("deltag"))) {
                library.deleteTag(body.tagName, body.targets).then(function(tags: ThemeTags) {
                    socketEmit(socketMngr.sockets, word("ontag"), tags);
                });
            }
        });
    });
}

function getStatusAndCurrent(): q.Promise<any[]> {
    return q.all([
        MpdClient.status()
            .then(MpdStatus.parse),
        MpdClient.current()
            .then(MpdEntries.readEntries)
            .then(function(entries: MpdEntry[]) {
                return entries.length === 0 ? {} : entries[0];
            })
    ]);
}

var lastIdleSuccess: boolean = true;
var lastStatus: {[key: string]: any} = {};
var lastCurrent: MpdEntry = {song: undefined, dir: undefined, playlist: undefined};
function idleOnce(args: any) {
    getStatusAndCurrent().then(function(results) {
        var status: {[key: string]: any} = results[0];
        var current: MpdEntry = results[1];
        if (!MpdEntries.entryEquals(lastCurrent, current) || !tools.mapEquals(lastStatus, status, ["volume", "repeat", "random", "single", "consume", "state", "song", "songid"])) {
            socketEmit(args.socketMngr.sockets, args.word, {"status": status, "current": current});
            lastCurrent = current;
            lastStatus = status;
        }
        lastIdleSuccess = true;
    }).fail(function(reason: Error) {
        console.log("Idle error: " + reason.message);
        if (lastIdleSuccess) {
            socketEmit(args.socketMngr.sockets, args.word, {failure: String(reason)});
            lastIdleSuccess = false;
        }
    });
}

function idleLoop(socketMngr: socketio.SocketManager, word: string) {
    MpdClient.idleLoop("player mixer options", idleOnce, {socketMngr: socketMngr, word: word});
}
