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

interface ISocketListeners {
    dataListener: (data)=>void;
    endListener: ()=>void;
    timeoutListener: ()=>void;
    errorListener: (err)=>void;
}

class SocketListeners {
    private callbacks: ISocketListeners;
    constructor(socket: net.Socket, callbacks: ISocketListeners) {
        this.callbacks = callbacks;
        SocketListeners.connect(socket, callbacks);
    }

    public reconnect(socket: net.Socket, callbacks: ISocketListeners) {
        SocketListeners.disconnect(socket, this.callbacks);
        this.callbacks = callbacks;
        SocketListeners.connect(socket, callbacks);
    }

    private static connect(socket: net.Socket, callbacks: ISocketListeners) {
        socket.on('data', callbacks.dataListener);
        socket.on('end', callbacks.endListener);
        socket.on('timeout', callbacks.timeoutListener);
        socket.on('error', callbacks.errorListener);
    }

    private static disconnect(socket: net.Socket, callbacks: ISocketListeners) {
        socket.removeListener('data', callbacks.dataListener);
        socket.removeListener('end', callbacks.endListener);
        socket.removeListener('timeout', callbacks.timeoutListener);
        socket.removeListener('error', callbacks.errorListener);
    }
}

"use strict";
class MpdClient {
    private socket: net.Socket;
    private listeners: SocketListeners;

    // Some static stuff
    private static host: string = "localhost";
    private static port: number = 6600;
    static configure(host: string, port: number) {
        this.host = host;
        this.port = port;
    }

    public connect(): q.Promise<void> {
        var deferred: q.Deferred<void> = q.defer<void>();
        this.socket = net.createConnection(MpdClient.port, MpdClient.host);
        var that = this;
        this.listeners = new SocketListeners(this.socket, {
            dataListener: function(data) {
                deferred.resolve(null);
            },
            endListener: function() {
                that.close();
                deferred.reject(new Error("Unexpected ending"));
            },
            timeoutListener: function() {
                that.close();
                deferred.reject(new Error("Socket timeout"));
            },
            errorListener: function(err) {
                that.close();
                deferred.reject(new Error(err));
            }
        });
        return deferred.promise;
    }

    public close() {
        this.socket.destroy();
    }

    private exec(cmd: string, stopper?: string): q.Promise<string> {
        var deferred: q.Deferred<string> = q.defer<string>();
        var response: string = "";
        this.listeners.reconnect(this.socket, {
            dataListener: function(data) {
                response += String(data);
                if (!stopper || response.indexOf(stopper, response.length - stopper.length) !== -1) {
                    deferred.resolve(response.trim());
                }
            },
            endListener: function() {
                deferred.resolve("");
            },
            timeoutListener: function() {
                deferred.reject(new Error("Socket timeout"));
            },
            errorListener: function(err) {
                deferred.reject(new Error(err));
            }
        });
        this.socket.write(cmd + "\n");
        return deferred.promise;
    }

    private static execAndClose(cmd: string, stopper?: string): q.Promise<string> {
        var mpdClient: MpdClient = new MpdClient();
        return mpdClient.connect().then(function() {
            return mpdClient.exec(cmd, stopper);
        }).fin(function() {
            mpdClient.close();
        });
    }

    static play(): q.Promise<string> {
        return MpdClient.execAndClose("play");
    }

    static playEntry(path: string): q.Promise<string> {
        return MpdClient.clear().then(function(res: string) {
            return MpdClient.add(path);
        }).then(MpdClient.play);
    }

    static playIdx(idx: number): q.Promise<string> {
        return MpdClient.execAndClose("play " + idx);
    }

    static pause(): q.Promise<string> {
        return MpdClient.execAndClose("pause");
    }

    static stop(): q.Promise<string> {
        return MpdClient.execAndClose("stop");
    }

    static prev(): q.Promise<string> {
        return MpdClient.execAndClose("previous");
    }

    static next(): q.Promise<string> {
        return MpdClient.execAndClose("next");
    }

    static clear(): q.Promise<string> {
        return MpdClient.execAndClose("clear");
    }

    private static getAddCommand(uri: string): string {
        var cmd: string = "add";
        // Playlists need to be "loaded" instead of "added"
        if (uri.indexOf(".m3u") >= 0
                || uri.indexOf(".pls") >= 0
                || uri.indexOf("/") < 0/*for MPD-created playlists*/) {
            cmd = "load";
        }
        return cmd;
    }

    static add(uri: string): q.Promise<string> {
        var cmd: string = MpdClient.getAddCommand(uri);
        return MpdClient.execAndClose(cmd + " \"" + uri + "\"").then(function(response: string) {
            if (response == "OK") {
                return response;
            } else {
                throw new Error(response);
            }
        });
    }

    /**
     * Non-static version; use the existing connection to MPD for adding
     */
    public add(uri: string): q.Promise<string> {
        var cmd: string = MpdClient.getAddCommand(uri);
        return this.exec(cmd + " \"" + uri + "\"").then(function(response: string) {
            if (response == "OK") {
                return response;
            } else {
                throw new Error(response);
            }
        });
    }

    static volume(value: string): q.Promise<string> {
        return MpdClient.execAndClose("setvol " + value);
    }

    static repeat(enabled: boolean): q.Promise<string> {
        return MpdClient.execAndClose("repeat " + (enabled ? "1" : "0"));
    }

    static random(enabled: boolean): q.Promise<string> {
        return MpdClient.execAndClose("random " + (enabled ? "1" : "0"));
    }

    static single(enabled: boolean): q.Promise<string> {
        return MpdClient.execAndClose("single " + (enabled ? "1" : "0"));
    }

    static consume(enabled: boolean): q.Promise<string> {
        return MpdClient.execAndClose("consume " + (enabled ? "1" : "0"));
    }

    static seek(songIdx: number, posInSong: number): q.Promise<string> {
        return MpdClient.execAndClose("seek " + songIdx + " " + posInSong);
    }

    static removeFromQueue(songIdx: number): q.Promise<string> {
        return MpdClient.execAndClose("delete " + songIdx);
    }

    static deleteList(name: string): q.Promise<string> {
        return MpdClient.execAndClose("rm \"" + name + "\"");
    }

    static saveList(name: string): q.Promise<string> {
        return MpdClient.deleteList(name).then(function(res: string) {
            return MpdClient.execAndClose("save \"" + name + "\"");
        });
    }

    static lsinfo(dir: string): q.Promise<string> {
        return MpdClient.execAndClose("lsinfo \"" + dir + "\"", "\nOK\n");
    }

    public lsinfo(dir: string): q.Promise<string> {
        return this.exec("lsinfo \"" + dir + "\"", "\nOK\n");
    }

    static search(mode: string, searchstr: string): q.Promise<string> {
        return MpdClient.execAndClose("search " + mode + " \"" + searchstr + "\"", "\nOK\n");
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

    /**
     * Static version; create and use a single connection to MPD for all elements to add
     */
    static addAll(allPaths: string[]): q.Promise<string> {
        if (allPaths.length == 0) {
            return q.fcall<string>(function() { return "OK"; });
        }
        var mpdClient: MpdClient = new MpdClient();
        return mpdClient.connect().then(function() {
            return mpdClient.addAll(allPaths);
        }).fin(function() {
            mpdClient.close();
        });
    }

    /**
     * Non-static version; use an existing single connection to MPD for all elements to add
     */
    public addAll(allPaths: string[]): q.Promise<string> {
        if (allPaths.length == 0) {
            return q.fcall<string>(function() { return "OK"; });
        }
        var that = this;
        return this.add(allPaths[0]).then(function(whatever: string) {
            return that.addAll(allPaths.slice(1));
        });
    }

    static update(uri: string): q.Promise<string> {
        return MpdClient.execAndClose("update \"" + uri + "\"");
    }

    static rate(uri: string, rate: number): q.Promise<string> {
        return MpdClient.execAndClose("sticker set song \"" + uri + "\" rating " + rate);
    }

    static getRate(uri: string): q.Promise<string> {
        return MpdClient.execAndClose("sticker get song \"" + uri + "\" rating");
    }

    static current(): q.Promise<string> {
        return MpdClient.execAndClose("currentsong");
    }

    static status(): q.Promise<string> {
        return MpdClient.execAndClose("status");
    }

    static idle(): q.Promise<string> {
        return MpdClient.execAndClose("idle");
    }

    static playlistInfo(): q.Promise<string> {
        return MpdClient.execAndClose("playlistinfo");
    }

    static playlistInfoIdx(idx: number): q.Promise<string> {
        return MpdClient.execAndClose("playlistinfo " + idx);
    }

    static custom(cmd: string, stopper?: string): q.Promise<string> {
        return MpdClient.execAndClose(cmd, stopper);
    }
}
export = MpdClient;
