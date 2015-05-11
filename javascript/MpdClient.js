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
/// <reference path="q/Q.d.ts" />
var net = require('net');
var q = require('q');
var SocketListeners = (function () {
    function SocketListeners(socket, callbacks) {
        this.callbacks = callbacks;
        SocketListeners.connect(socket, callbacks);
    }
    SocketListeners.prototype.reconnect = function (socket, callbacks) {
        SocketListeners.disconnect(socket, this.callbacks);
        this.callbacks = callbacks;
        SocketListeners.connect(socket, callbacks);
    };
    SocketListeners.connect = function (socket, callbacks) {
        socket.on('data', callbacks.dataListener);
        socket.on('end', callbacks.endListener);
        socket.on('timeout', callbacks.timeoutListener);
        socket.on('error', callbacks.errorListener);
    };
    SocketListeners.disconnect = function (socket, callbacks) {
        socket.removeListener('data', callbacks.dataListener);
        socket.removeListener('end', callbacks.endListener);
        socket.removeListener('timeout', callbacks.timeoutListener);
        socket.removeListener('error', callbacks.errorListener);
    };
    return SocketListeners;
})();
"use strict";
var MpdClient = (function () {
    function MpdClient() {
    }
    MpdClient.configure = function (host, port) {
        this.host = host;
        this.port = port;
    };
    MpdClient.prototype.connect = function () {
        var deferred = q.defer();
        this.socket = net.createConnection(MpdClient.port, MpdClient.host);
        var that = this;
        this.listeners = new SocketListeners(this.socket, {
            dataListener: function (data) {
                deferred.resolve(null);
            },
            endListener: function () {
                that.close();
                deferred.reject(new Error("Unexpected ending"));
            },
            timeoutListener: function () {
                that.close();
                deferred.reject(new Error("Socket timeout"));
            },
            errorListener: function (err) {
                that.close();
                deferred.reject(new Error(err));
            }
        });
        return deferred.promise;
    };
    MpdClient.prototype.close = function () {
        this.socket.destroy();
    };
    MpdClient.prototype.exec = function (cmd, stopper) {
        var deferred = q.defer();
        var response = "";
        this.listeners.reconnect(this.socket, {
            dataListener: function (data) {
                response += String(data);
                if (!stopper || response.indexOf(stopper, response.length - stopper.length) !== -1) {
                    deferred.resolve(response.trim());
                }
            },
            endListener: function () {
                deferred.resolve("");
            },
            timeoutListener: function () {
                deferred.reject(new Error("Socket timeout"));
            },
            errorListener: function (err) {
                deferred.reject(new Error(err));
            }
        });
        this.socket.write(cmd + "\n");
        return deferred.promise;
    };
    MpdClient.execAndClose = function (cmd, stopper) {
        var mpdClient = new MpdClient();
        return mpdClient.connect().then(function () {
            return mpdClient.exec(cmd, stopper);
        }).fin(function () {
            mpdClient.close();
        });
    };
    MpdClient.play = function () {
        return MpdClient.execAndClose("play");
    };
    MpdClient.playEntry = function (path) {
        return MpdClient.clear().then(function (res) {
            return MpdClient.add(path);
        }).then(MpdClient.play);
    };
    MpdClient.playIdx = function (idx) {
        return MpdClient.execAndClose("play " + idx);
    };
    MpdClient.pause = function () {
        return MpdClient.execAndClose("pause");
    };
    MpdClient.stop = function () {
        return MpdClient.execAndClose("stop");
    };
    MpdClient.prev = function () {
        return MpdClient.execAndClose("previous");
    };
    MpdClient.next = function () {
        return MpdClient.execAndClose("next");
    };
    MpdClient.clear = function () {
        return MpdClient.execAndClose("clear");
    };
    MpdClient.add = function (uri) {
        var mpdClient = new MpdClient();
        return mpdClient.connect().then(function () {
            return mpdClient.add(uri);
        }).fin(function () {
            mpdClient.close();
        });
    };
    /**
     * Non-static version; use the existing connection to MPD for adding
     */
    MpdClient.prototype.add = function (uri) {
        var cmd = "add";
        // Playlists need to be "loaded" instead of "added"
        if (uri.indexOf(".m3u") >= 0 || uri.indexOf(".pls") >= 0 || uri.indexOf("/") < 0) {
            cmd = "load";
        }
        return this.exec(cmd + " \"" + uri + "\"").then(function (response) {
            if (response == "OK") {
                return response;
            }
            else {
                throw new Error(response);
            }
        });
    };
    MpdClient.volume = function (value) {
        return MpdClient.execAndClose("setvol " + value);
    };
    MpdClient.repeat = function (enabled) {
        return MpdClient.execAndClose("repeat " + (enabled ? "1" : "0"));
    };
    MpdClient.random = function (enabled) {
        return MpdClient.execAndClose("random " + (enabled ? "1" : "0"));
    };
    MpdClient.single = function (enabled) {
        return MpdClient.execAndClose("single " + (enabled ? "1" : "0"));
    };
    MpdClient.consume = function (enabled) {
        return MpdClient.execAndClose("consume " + (enabled ? "1" : "0"));
    };
    MpdClient.seek = function (songIdx, posInSong) {
        return MpdClient.execAndClose("seek " + songIdx + " " + posInSong);
    };
    MpdClient.removeFromQueue = function (songIdx) {
        return MpdClient.execAndClose("delete " + songIdx);
    };
    MpdClient.deleteList = function (name) {
        return MpdClient.execAndClose("rm \"" + name + "\"");
    };
    MpdClient.saveList = function (name) {
        return MpdClient.deleteList(name).then(function (res) {
            return MpdClient.execAndClose("save \"" + name + "\"");
        });
    };
    MpdClient.lsinfo = function (dir) {
        return MpdClient.execAndClose("lsinfo \"" + dir + "\"", "\nOK\n");
    };
    MpdClient.prototype.lsinfo = function (dir) {
        return this.exec("lsinfo \"" + dir + "\"", "\nOK\n");
    };
    MpdClient.search = function (mode, searchstr) {
        return MpdClient.execAndClose("search " + mode + " \"" + searchstr + "\"", "\nOK\n");
    };
    MpdClient.playAll = function (allPaths) {
        if (allPaths.length == 0) {
            return q.fcall(function () {
                return "OK";
            });
        }
        // Play first entry immediately, then add remaining, to avoid latence effect
        return MpdClient.playEntry(allPaths[0]).then(function (res) {
            return MpdClient.addAll(allPaths.slice(1));
        });
    };
    /**
     * Static version; create and use a single connection to MPD for all elements to add
     */
    MpdClient.addAll = function (allPaths) {
        if (allPaths.length == 0) {
            return q.fcall(function () {
                return "OK";
            });
        }
        var mpdClient = new MpdClient();
        return mpdClient.connect().then(function () {
            return mpdClient.addAll(allPaths);
        }).fin(function () {
            mpdClient.close();
        });
    };
    /**
     * Non-static version; use an existing single connection to MPD for all elements to add
     */
    MpdClient.prototype.addAll = function (allPaths) {
        if (allPaths.length == 0) {
            return q.fcall(function () {
                return "OK";
            });
        }
        var that = this;
        return this.add(allPaths[0]).then(function (whatever) {
            return that.addAll(allPaths.slice(1));
        });
    };
    MpdClient.update = function (uri) {
        return MpdClient.execAndClose("update \"" + uri + "\"");
    };
    MpdClient.rate = function (uri, rate) {
        return MpdClient.execAndClose("sticker set song \"" + uri + "\" rating " + rate);
    };
    MpdClient.getRate = function (uri) {
        return MpdClient.execAndClose("sticker get song \"" + uri + "\" rating");
    };
    MpdClient.current = function () {
        return MpdClient.execAndClose("currentsong");
    };
    MpdClient.status = function () {
        return MpdClient.execAndClose("status");
    };
    MpdClient.idle = function () {
        return MpdClient.execAndClose("idle");
    };
    MpdClient.playlistInfo = function () {
        return MpdClient.execAndClose("playlistinfo");
    };
    MpdClient.playlistInfoIdx = function (idx) {
        return MpdClient.execAndClose("playlistinfo " + idx);
    };
    MpdClient.custom = function (cmd, stopper) {
        return MpdClient.execAndClose(cmd, stopper);
    };
    // Some static stuff
    MpdClient.host = "localhost";
    MpdClient.port = 6600;
    return MpdClient;
})();
module.exports = MpdClient;
