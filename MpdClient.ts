/*
The MIT License (MIT)
Copyright (c) 2014 Joel Takvorian, https://github.com/jotak/node-restmpd
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
import net = require('net');
import q = require('q');

"use strict";
class MpdClient {
    ack: boolean = false;
    deferred: q.Deferred<string> = q.defer<string>();
    cmd: string;
    socket;

    constructor(cmd: string) {
        this.cmd = cmd + "\n";
        this.socket = net.createConnection(MpdClient.port, MpdClient.host);
        var that = this;
        this.socket.on('data', function(data) {
            if (that.ack) {
                that.socket.destroy();
                that.deferred.resolve(String(data));
            } else {
                that.ack = true;
                that.socket.write(that.cmd);
            }
        }).on('end', function() {
            that.socket.destroy();
            that.deferred.resolve("");
        }).on('timeout', function() {
            that.socket.destroy();
            that.deferred.reject(new Error("Socket timeout"));
        }).on('error', function(err) {
            that.socket.destroy();
            that.deferred.reject(new Error(err));
        });
    }

    // Some static stuff
    private static host: string = "localhost";
    private static port: number = 6600;
    static configure(host: string, port: number) {
        this.host = host;
        this.port = port;
    }

    static exec(cmd: string): q.Promise<string> {
        var mpd = new MpdClient(cmd);
        return mpd.deferred.promise;
    }

    private static execAndForget(cmd: string) {
        new MpdClient(cmd).deferred.promise.done();
    }

    static play() {
        this.execAndForget("play");
    }

    static pause() {
        this.execAndForget("pause");
    }

    static stop() {
        this.execAndForget("stop");
    }

    static prev() {
        this.execAndForget("previous");
    }

    static next() {
        this.execAndForget("next");
    }

    static clear() {
        this.execAndForget("clear");
    }

    static add(uri: string) {
        this.execAndForget("add " + uri);
    }

    static load(playlist: string) {
        this.execAndForget("load " + playlist);
    }

    static custom(cmd: string) {
        this.execAndForget(cmd);
    }
}
export = MpdClient;
