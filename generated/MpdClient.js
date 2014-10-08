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

"use strict";
var MpdClient = (function () {
    function MpdClient(cmd) {
        this.ack = false;
        this.deferred = q.defer();
        this.cmd = cmd + "\n";
        this.socket = net.createConnection(MpdClient.port, MpdClient.host);
        var that = this;
        this.socket.on('data', function (data) {
            if (that.ack) {
                that.socket.destroy();
                that.deferred.resolve(String(data));
            } else {
                that.ack = true;
                that.socket.write(that.cmd);
            }
        }).on('end', function () {
            that.socket.destroy();
            that.deferred.resolve("");
        }).on('timeout', function () {
            that.socket.destroy();
            that.deferred.reject(new Error("Socket timeout"));
        }).on('error', function (err) {
            that.socket.destroy();
            that.deferred.reject(new Error(err));
        });
    }
    MpdClient.configure = function (host, port) {
        this.host = host;
        this.port = port;
    };

    MpdClient.exec = function (cmd) {
        var mpd = new MpdClient(cmd);
        return mpd.deferred.promise;
    };

    MpdClient.play = function () {
        return MpdClient.exec("play");
    };

    MpdClient.playEntry = function (path) {
        return MpdClient.clear().then(function (res) {
            return MpdClient.add(path);
        }).then(MpdClient.play);
    };

    MpdClient.playIdx = function (idx) {
        return MpdClient.exec("play " + idx);
    };

    MpdClient.pause = function () {
        return MpdClient.exec("pause");
    };

    MpdClient.stop = function () {
        return MpdClient.exec("stop");
    };

    MpdClient.prev = function () {
        return MpdClient.exec("previous");
    };

    MpdClient.next = function () {
        return MpdClient.exec("next");
    };

    MpdClient.clear = function () {
        return MpdClient.exec("clear");
    };

    MpdClient.add = function (uri) {
        return MpdClient.exec("add \"" + uri + "\"");
    };

    MpdClient.load = function (playlist) {
        return MpdClient.exec("load \"" + playlist + "\"");
    };

    MpdClient.volume = function (value) {
        return MpdClient.exec("setvol " + value);
    };

    MpdClient.repeat = function (enabled) {
        return MpdClient.exec("repeat " + (enabled ? "1" : "0"));
    };

    MpdClient.random = function (enabled) {
        return MpdClient.exec("random " + (enabled ? "1" : "0"));
    };

    MpdClient.single = function (enabled) {
        return MpdClient.exec("single " + (enabled ? "1" : "0"));
    };

    MpdClient.consume = function (enabled) {
        return MpdClient.exec("consume " + (enabled ? "1" : "0"));
    };

    MpdClient.seek = function (songIdx, posInSong) {
        return MpdClient.exec("seek " + songIdx + " " + posInSong);
    };

    MpdClient.removeFromQueue = function (songIdx) {
        return MpdClient.exec("delete " + songIdx);
    };

    MpdClient.deleteList = function (name) {
        return MpdClient.exec("rm \"" + name + "\"");
    };

    MpdClient.saveList = function (name) {
        return MpdClient.deleteList(name).then(function (res) {
            return MpdClient.exec("save \"" + name + "\"");
        });
    };

    MpdClient.lsinfo = function (dir) {
        return MpdClient.exec("lsinfo \"" + dir + "\"");
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

    MpdClient.addAll = function (allPaths) {
        if (allPaths.length == 0) {
            return q.fcall(function () {
                return "OK";
            });
        }
        return MpdClient.add(allPaths[0]).then(function (tmpResponse) {
            return MpdClient.addAll(allPaths.slice(1));
        });
    };

    MpdClient.update = function (uri) {
        return MpdClient.exec("update \"" + uri + "\"");
    };

    MpdClient.custom = function (cmd) {
        return MpdClient.exec(cmd);
    };
    MpdClient.host = "localhost";
    MpdClient.port = 6600;
    return MpdClient;
})();
module.exports = MpdClient;
