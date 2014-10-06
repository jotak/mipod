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
        return this.exec("play");
    };

    MpdClient.playEntry = function (path) {
        return this.clear().then(function (res) {
            return this.add(path);
        }).then(this.play);
    };

    MpdClient.playIdx = function (idx) {
        return this.exec("play " + idx);
    };

    MpdClient.pause = function () {
        return this.exec("pause");
    };

    MpdClient.stop = function () {
        return this.exec("stop");
    };

    MpdClient.prev = function () {
        return this.exec("previous");
    };

    MpdClient.next = function () {
        return this.exec("next");
    };

    MpdClient.clear = function () {
        return this.exec("clear");
    };

    MpdClient.add = function (uri) {
        return this.exec("add " + uri);
    };

    MpdClient.load = function (playlist) {
        return this.exec("load " + playlist);
    };

    MpdClient.volume = function (value) {
        return this.exec("setvol " + value);
    };

    MpdClient.repeat = function (enabled) {
        return this.exec("repeat " + (enabled ? "1" : "0"));
    };

    MpdClient.random = function (enabled) {
        return this.exec("random " + (enabled ? "1" : "0"));
    };

    MpdClient.single = function (enabled) {
        return this.exec("single " + (enabled ? "1" : "0"));
    };

    MpdClient.consume = function (enabled) {
        return this.exec("consume " + (enabled ? "1" : "0"));
    };

    MpdClient.seek = function (songIdx, posInSong) {
        return this.exec("seek " + songIdx + " " + posInSong);
    };

    MpdClient.removeFromQueue = function (songIdx) {
        return this.exec("delete " + songIdx);
    };

    MpdClient.deleteList = function (name) {
        return this.exec("rm \"" + name + "\"");
    };

    MpdClient.saveList = function (name) {
        return this.deleteList(name).then(function (res) {
            return this.exec("save \"" + name + "\"");
        });
    };

    MpdClient.lsinfo = function (dir) {
        return this.exec("lsinfo \"" + dir + "\"");
    };

    MpdClient.custom = function (cmd) {
        return this.exec(cmd);
    };
    MpdClient.host = "localhost";
    MpdClient.port = 6600;
    return MpdClient;
})();
module.exports = MpdClient;
