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

import Library = require('./Library');
import MpdEntries = require('./MpdEntries');
import MpdEntry = require('./libtypes/MpdEntry');
import MpdClient = require('./MpdClient');
import q = require('q');
import typeCheck = require('type-check');
import socketio = require('socket.io');

function answerOnPromise(promise: q.Promise<any>, socket: socketio.Socket, word: string, context?: any) {
    promise.then(function(answer: any) {
        socket.emit(word, {success: answer, context: context});
    }).fail(function(reason: Error) {
        console.log("Application error: " + reason.message);
        socket.emit(word, {failure: String(reason), context: context});
    }).done();
}

function check(typeDesc: string, obj: any, socket: socketio.Socket, word: string) {
    if (!typeCheck.typeCheck(typeDesc, obj)) {
        socket.emit(word, {failure: "Malformed json, expecting: " + typeDesc});
        return false;
    }
    return true;
}

"use strict";
export function register(socket: socketio.Socket, prefix: string, library: Library.Loader) {

    var word = function(word: string): string { return prefix + word; }

    socket.on(word("play"), function() {
        answerOnPromise(MpdClient.play(), socket, word("play"));
    });

    socket.on(word("play-entry"), function(body) {
        if (check("{entry: String}", body, socket, word("play-entry"))) {
            answerOnPromise(MpdClient.playEntry(body.entry), socket, word("play-entry"));
        }
    });

    socket.on(word("play-idx"), function(body) {
        if (check("{idx: Number}", body, socket, word("play-idx"))) {
            answerOnPromise(MpdClient.playIdx(body.idx), socket, word("play-idx"));
        }
    });

    socket.on(word("add-entry"), function(body) {
        if (check("{entry: String}", body, socket, word("add-entry"))) {
            answerOnPromise(MpdClient.add(body.entry), socket, word("add-entry"));
        }
    });

    socket.on(word("clear"), function() {
        answerOnPromise(MpdClient.clear(), socket, word("clear"));
    });

    socket.on(word("pause"), function() {
        answerOnPromise(MpdClient.pause(), socket, word("pause"));
    });

    socket.on(word("stop"), function() {
        answerOnPromise(MpdClient.stop(), socket, word("stop"));
    });

    socket.on(word("next"), function() {
        answerOnPromise(MpdClient.next(), socket, word("next"));
    });

    socket.on(word("prev"), function() {
        answerOnPromise(MpdClient.prev(), socket, word("prev"));
    });

    socket.on(word("volume"), function(body) {
        if (check("{value: Number}", body, socket, word("volume"))) {
            answerOnPromise(MpdClient.volume(body.value), socket, word("volume"));
        }
    });

    socket.on(word("repeat"), function(body) {
        if (check("{enabled: Boolean}", body, socket, word("repeat"))) {
            answerOnPromise(MpdClient.repeat(body.enabled), socket, word("repeat"));
        }
    });

    socket.on(word("random"), function(body) {
        if (check("{enabled: Boolean}", body, socket, word("random"))) {
            answerOnPromise(MpdClient.random(body.enabled), socket, word("random"));
        }
    });

    socket.on(word("single"), function(body) {
        if (check("{enabled: Boolean}", body, socket, word("single"))) {
            answerOnPromise(MpdClient.single(body.enabled), socket, word("single"));
        }
    });

    socket.on(word("consume"), function(body) {
        if (check("{enabled: Boolean}", body, socket, word("consume"))) {
            answerOnPromise(MpdClient.consume(body.enabled), socket, word("consume"));
        }
    });

    socket.on(word("seek"), function(body) {
        if (check("{songIdx: Number, posInSong: Number}", body, socket, word("seek"))) {
            answerOnPromise(MpdClient.seek(body.songIdx, body.posInSong), socket, word("seek"));
        }
    });

    socket.on(word("rmqueue"), function(body) {
        if (check("{songIdx: Number}", body, socket, word("rmqueue"))) {
            answerOnPromise(MpdClient.removeFromQueue(body.songIdx), socket, word("rmqueue"));
        }
    });

    socket.on(word("deletelist"), function(body) {
        if (check("{name: String}", body, socket, word("deletelist"))) {
            answerOnPromise(MpdClient.deleteList(body.name), socket, word("deletelist"));
        }
    });

    socket.on(word("savelist"), function(body) {
        if (check("{name: String}", body, socket, word("savelist"))) {
            answerOnPromise(MpdClient.saveList(body.name), socket, word("savelist"));
        }
    });

    socket.on(word("playall"), function(body) {
        if (check("{entries: [String]}", body, socket, word("playall"))) {
            answerOnPromise(MpdClient.playAll(body.entries), socket, word("playall"));
        }
    });

    socket.on(word("addall"), function(body) {
        if (check("{entries: [String]}", body, socket, word("addall"))) {
            answerOnPromise(MpdClient.addAll(body.entries), socket, word("addall"));
        }
    });

    socket.on(word("update"), function(body) {
        if (check("{path: String}", body, socket, word("update"))) {
            answerOnPromise(MpdClient.update(body.path), socket, word("update"));
        }
    });

    socket.on(word("current"), function() {
        answerOnPromise(MpdClient.current().then(MpdEntries.readEntries).then(function(entries: MpdEntry[]) {
                return entries.length === 0 ? {} : entries[0];
            }), socket, word("current"));
    });

    socket.on(word("custom"), function(body) {
        if (check("{command: String}", body, socket, word("custom"))) {
            answerOnPromise(MpdClient.custom(body.command), socket, word("custom"));
        }
    });

    socket.on(word("lib-loadonce"), function() {
        var status: string = library.loadOnce();
        socket.emit(word("lib-loadonce"), {status: status});
    });

    socket.on(word("lib-reload"), function() {
        var status: string = library.forceRefresh();
        socket.emit(word("lib-reload"), {status: status});
    });

    socket.on(word("lib-progress"), function() {
        socket.emit(word("lib-progress"), {progress: library.progress()});
    });

    socket.on(word("lib-get"), function(body) {
        if (check("{start: Number, count: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]}", body, socket, word("lib-get"))) {
            var treeDesc: string[] = body.treeDesc || ["genre","albumArtist|artist","album"];
            var page = library.getPage(body.start, body.count, treeDesc, body.leafDesc);
            socket.emit(word("lib-get"), page);
        }
    });

    socket.on(word("lib-push"), function(body) {
        if (check("{maxBatchSize: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]}", body, socket, word("lib-push"))) {
            var treeDesc: string[] = body.treeDesc || ["genre","albumArtist|artist","album"];
            library.onLoadingProgress(
                function(data: Library.LoadingData, nbItems: number) {
                    socket.emit(word("lib-push"), {progress: nbItems, data: data});
                },
                function(nbItems: number) {
                    socket.emit(word("lib-finished-loading"), {nbItems: nbItems});
                },
                body.maxBatchSize, treeDesc, body.leafDesc
            );
        }
    });

    socket.on(word("lsinfo"), function(body) {
        if (check("{token: Maybe Number, path: String, leafDesc: Maybe [String]}", body, socket, word("lsinfo"))) {
            library.lsInfo(body.path, body.leafDesc).then(function(lstContent: any[]) {
                socket.emit(word("lsinfo"), {token: body.token, content: lstContent});
            });
        }
    });

    socket.on(word("search"), function(body) {
        if (check("{token: Maybe Number, mode: String, search: String, leafDesc: Maybe [String]}", body, socket, word("search"))) {
            library.search(body.mode, body.search, body.leafDesc).then(function(lstContent: any[]) {
                socket.emit(word("search"), {token: body.token, content: lstContent});
            });
        }
    });

    socket.on(word("tag"), function(body) {
        if (check("{tagName: String, tagValue: String, targets: [{targetType: String, target: String}]}", body, socket, word("tag"))) {
            if (body.tagValue === undefined) {
                answerOnPromise(library.readTag(body.tagName, body.targets), socket, word("tag"), body);
            } else {
                answerOnPromise(library.writeTag(body.tagName, body.tagValue, body.targets), socket, word("tag"), body);
            }
        }
    });
}
