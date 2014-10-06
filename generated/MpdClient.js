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

    MpdClient.execAndForget = function (cmd) {
        new MpdClient(cmd).deferred.promise.done();
    };

    MpdClient.play = function () {
        this.execAndForget("play");
    };

    MpdClient.playIdx = function (idx) {
        this.execAndForget("play " + idx);
    };

    MpdClient.pause = function () {
        this.execAndForget("pause");
    };

    MpdClient.stop = function () {
        this.execAndForget("stop");
    };

    MpdClient.prev = function () {
        this.execAndForget("previous");
    };

    MpdClient.next = function () {
        this.execAndForget("next");
    };

    MpdClient.clear = function () {
        this.execAndForget("clear");
    };

    MpdClient.add = function (uri) {
        this.execAndForget("add " + uri);
    };

    MpdClient.load = function (playlist) {
        this.execAndForget("load " + playlist);
    };

    MpdClient.volume = function (value) {
        this.execAndForget("setvol " + value);
    };

    MpdClient.repeat = function (enabled) {
        this.execAndForget("repeat " + (enabled ? "1" : "0"));
    };

    MpdClient.random = function (enabled) {
        this.execAndForget("random " + (enabled ? "1" : "0"));
    };

    MpdClient.single = function (enabled) {
        this.execAndForget("single " + (enabled ? "1" : "0"));
    };

    MpdClient.consume = function (enabled) {
        this.execAndForget("consume " + (enabled ? "1" : "0"));
    };

    MpdClient.seek = function (songIdx, posInSong) {
        this.execAndForget("seek " + songIdx + " " + posInSong);
    };

    MpdClient.custom = function (cmd) {
        this.execAndForget(cmd);
    };
    MpdClient.host = "localhost";
    MpdClient.port = 6600;
    return MpdClient;
})();
module.exports = MpdClient;
