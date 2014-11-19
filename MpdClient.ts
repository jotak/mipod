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
import net = require('net');
import q = require('q');
import MpdEntry = require('./libtypes/MpdEntry');
import SongInfo = require('./libtypes/SongInfo');

"use strict";
class MpdClient {
    ack: boolean = false;
    deferred: q.Deferred<string> = q.defer<string>();
    cmd: string;
    socket;

    constructor(cmd: string, stopper?: string) {
        this.cmd = cmd + "\n";
        this.socket = net.createConnection(MpdClient.port, MpdClient.host);
        var that = this;
        var response: string = "";
        this.socket.on('data', function(data) {
            if (that.ack) {
                response += String(data);
                if (!stopper || response.indexOf(stopper, response.length - stopper.length) !== -1) {
                    that.socket.destroy();
                    that.deferred.resolve(response.trim());
                }
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

    private static exec(cmd: string, stopper?: string): q.Promise<string> {
        console.log(cmd);
        var mpd = new MpdClient(cmd, stopper);
        return mpd.deferred.promise;
    }

    static play(): q.Promise<string> {
        return MpdClient.exec("play");
    }

    static playEntry(path: string): q.Promise<string> {
        return MpdClient.clear().then(function(res: string) {
            return MpdClient.add(path);
        }).then(MpdClient.play);
    }

    static playIdx(idx: number): q.Promise<string> {
        return MpdClient.exec("play " + idx);
    }

    static pause(): q.Promise<string> {
        return MpdClient.exec("pause");
    }

    static stop(): q.Promise<string> {
        return MpdClient.exec("stop");
    }

    static prev(): q.Promise<string> {
        return MpdClient.exec("previous");
    }

    static next(): q.Promise<string> {
        return MpdClient.exec("next");
    }

    static clear(): q.Promise<string> {
        return MpdClient.exec("clear");
    }

    static add(uri: string): q.Promise<string> {
        var cmd: string = "add";
        // Playlists need to be "loaded" instead of "added"
        if (uri.indexOf(".m3u") >= 0
                || uri.indexOf(".pls") >= 0
                || uri.indexOf("/") < 0/*for MPD-created playlists*/) {
            cmd = "load";
        }
        return MpdClient.exec(cmd + " \"" + uri + "\"").then(function(response: string) {
            if (response == "OK") {
                return response;
            } else {
                throw new Error(response);
            }
        });
    }

    static volume(value: string): q.Promise<string> {
        return MpdClient.exec("setvol " + value);
    }

    static repeat(enabled: boolean): q.Promise<string> {
        return MpdClient.exec("repeat " + (enabled ? "1" : "0"));
    }

    static random(enabled: boolean): q.Promise<string> {
        return MpdClient.exec("random " + (enabled ? "1" : "0"));
    }

    static single(enabled: boolean): q.Promise<string> {
        return MpdClient.exec("single " + (enabled ? "1" : "0"));
    }

    static consume(enabled: boolean): q.Promise<string> {
        return MpdClient.exec("consume " + (enabled ? "1" : "0"));
    }

    static seek(songIdx: number, posInSong: number): q.Promise<string> {
        return MpdClient.exec("seek " + songIdx + " " + posInSong);
    }

    static removeFromQueue(songIdx: number): q.Promise<string> {
        return MpdClient.exec("delete " + songIdx);
    }

    static deleteList(name: string): q.Promise<string> {
        return MpdClient.exec("rm \"" + name + "\"");
    }

    static saveList(name: string): q.Promise<string> {
        return MpdClient.deleteList(name).then(function(res: string) {
            return MpdClient.exec("save \"" + name + "\"");
        });
    }

    static lsinfo(dir: string): q.Promise<string> {
        return MpdClient.exec("lsinfo \"" + dir + "\"", "\nOK\n");
    }

    static search(mode: string, searchstr: string): q.Promise<string> {
        return MpdClient.exec("search " + mode + " \"" + searchstr + "\"", "\nOK\n");
    }

    static playAll(allPaths: string[]): q.Promise<string> {
        if (allPaths.length == 0) {
            return q.fcall<string>(function() { return "OK"; });
        }
        // Play first entry immediately, then add remaining, to avoid latence effect
        return MpdClient.playEntry(allPaths[0]).then(function(res: string) {
            return MpdClient.addAll(allPaths.slice(1))
        });
    }

    static addAll(allPaths: string[]): q.Promise<string> {
        if (allPaths.length == 0) {
            return q.fcall<string>(function() { return "OK"; });
        }
        return MpdClient.add(allPaths[0]).then(function(tmpResponse: string) {
            return MpdClient.addAll(allPaths.slice(1));
        });
    }

    static update(uri: string): q.Promise<string> {
        return MpdClient.exec("update \"" + uri + "\"");
    }

    static rate(uri: string, rate: number): q.Promise<string> {
        return MpdClient.exec("sticker set song \"" + uri + "\" rating " + rate);
    }

    static getRate(uri: string): q.Promise<string> {
        return MpdClient.exec("sticker get song \"" + uri + "\" rating");
    }

    static current(): q.Promise<string> {
        return MpdClient.exec("currentsong");
    }

    static status(): q.Promise<string> {
        return MpdClient.exec("status");
    }

    static idle(): q.Promise<string> {
        return MpdClient.exec("idle");
    }

    static playlistInfo(): q.Promise<string> {
        return MpdClient.exec("playlistinfo");
    }

    static playlistInfoIdx(idx: number): q.Promise<string> {
        return MpdClient.exec("playlistinfo " + idx);
    }

    static custom(cmd: string): q.Promise<string> {
        return MpdClient.exec(cmd);
    }
}
export = MpdClient;
