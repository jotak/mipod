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
import MpdClient = require('./MpdClient');
import q = require('q');

"use strict";

class LibLoader {
    static loaded: boolean = false;
    static loadingCounter: number = 0;
    static allSongs: SongInfo[];

    static loadOnce(res) {
        if (this.loaded) {
            // Already loaded, no need to load again.
            res.send({status: "OK", numberOfItems: this.loadingCounter});
        } else {
            var that = this;
            loadAllLib().then(function(json: SongInfo[]) {
                that.allSongs = json;
                that.loaded = true;
                res.send({status: "OK", numberOfItems: that.loadingCounter});
            }).done();
        }
    }

    static reload(res) {
        this.loaded = false;
        this.loadingCounter = 0;
        this.allSongs = undefined;
        this.loadOnce(res);
    }

    static getPage(res, start: number, count: number, treeDescriptor: string[], leafDescriptor: string[]) {
        if (this.loaded) {
            var subTree: Tree = organizeJsonLib(
                getSongsPage(this.allSongs, start, count),
                treeDescriptor,
                leafDescriptor);
            res.send({status: "OK", data: subTree.root});
        } else {
            res.send({status: "Error: loading still in progress"}).end();
        }
    }

    static progress(res) {
        res.send(new String(this.loadingCounter));
    }

    static lsInfo(dir: string, leafDescriptor: string[]): q.Promise<any[]> {
        return MpdClient.lsinfo(dir)
            .then(function(response: string) {
                var lines: string[] = response.split("\n");
                return q.fcall<any[]>(function() {
                    return parseFlatDir(lines, leafDescriptor);
                });
            });
    }
}
export = LibLoader;

interface Tree {
    root: any;
}

interface SongInfo {
    file: string;
    lastModified?: string;
    time?: number;
    artist?: string;
    albumArtist?: string;
    title?: string;
    album?: string;
    track?: string;
    date?: string;
    genre?: string;
    composer?: string;
}

interface ParserInfo {
    songs: SongInfo[];
    lines: string[];
    cursor: number;
}

interface KeyValue {
    key: string;
    value: string;
}

function splitOnce(str: string, separator: string): KeyValue {
    var i = str.indexOf(separator);
    if (i >= 0) {
        return {key: str.slice(0, i), value: str.slice(i+separator.length)};
    } else {
        return {key: "", value: str.slice(i+separator.length)};
    }
}

function loadAllLib(): q.Promise<SongInfo[]> {
    return loadDirForLib([], "")
        .then(function(parser: ParserInfo) {
            return parser.songs;
        });
}

function loadDirForLib(songs: SongInfo[], dir: string): q.Promise<ParserInfo> {
    return MpdClient.lsinfo(dir)
        .then(function(response: string) {
            var lines: string[] = response.split("\n");
            return parseNext({ songs: songs, lines: lines, cursor: 0 });
        });
}

/*
    EXAMPLE OF DATA returned by MPD
    directory: USB
    directory: WEBRADIO
    playlist: rock
    Last-Modified: 2014-07-06T12:05:51Z

    OTHER EXAMPLE
    file: USB\/Musics\/myFile.mp3
    Last-Modified: 2013-09-15T07:33:08Z
    Time: 202
    Artist: An artist
    AlbumArtist: An artist
    Title: My song
    Album: An album
    Track: 1
    Date: 2004
    Genre: Rock
    file: USB\/Musics\/anotherFile.mp3
    Last-Modified: 2013-09-15T07:33:14Z
    Time: 242
    Artist: An artist
    AlbumArtist: An artist
    Title: Another song
    Album: An album
    Track: 1
    Date: 2004
    Genre: Rock
*/
function parseNext(parser: ParserInfo): q.Promise<ParserInfo> {
    var currentSong: SongInfo = null;
    for (; parser.cursor < parser.lines.length; parser.cursor++) {
        var entry: KeyValue = splitOnce(parser.lines[parser.cursor], ": ");
        var currentSong: SongInfo;
        if (entry.key == "file") {
            currentSong = { "file": entry.value };
            parser.songs.push(currentSong);
            LibLoader.loadingCounter++;
        } else if (entry.key == "directory") {
            currentSong = null;
            // Load (async) the directory content, and then only continue on parsing what remains here
            return loadDirForLib(parser.songs, entry.value)
                .then(function(subParser: ParserInfo) {
                    // this "subParser" contains gathered songs, whereas the existing "parser" contains previous cursor information that we need to continue on this folder
                    return parseNext({ songs: subParser.songs, lines: parser.lines, cursor: parser.cursor + 1 });
                });
        } else if (entry.key == "playlist") {
            // skip
            currentSong = null;
        } else if (currentSong != null) {
            fillSongData(currentSong, entry.key, entry.value);
        }
    }
    // Did not find any sub-directory, return directly this data
    return q.fcall<ParserInfo>(function() {
        return parser;
    });
}

function parseFlatDir(lines: string[], leafDescriptor: string[]): any[] {
    var currentSong: SongInfo = null;
    var dirContent: any[] = [];
    for (var i = 0; i < lines.length; i++) {
        var entry: KeyValue = splitOnce(lines[i], ": ");
        var currentSong: SongInfo;
        if (entry.key == "file" || entry.key == "playlist") {
            currentSong = { "file": entry.value };
            dirContent.push(currentSong);
        } else if (entry.key == "directory") {
            currentSong = null;
            dirContent.push({ directory: entry.value });
        } else if (currentSong != null) {
            fillSongData(currentSong, entry.key, entry.value);
        }
    }
    return dirContent.map(function(inObj) {
        var outObj = {};
        leafDescriptor.forEach(function(key: string) {
            outObj[key] = inObj[key];
        });
        return outObj;
    });
}

function fillSongData(song: SongInfo, key: string, value: string) {
    if (key == "Last-Modified") {
        song.lastModified = value;
    } else if (key == "Time") {
        song.time = +value;
    } else if (key == "Artist") {
        song.artist = value;
    } else if (key == "AlbumArtist") {
        song.albumArtist = value;
    } else if (key == "Title") {
        song.title = value;
    } else if (key == "Album") {
        song.album = value;
    } else if (key == "Track") {
        song.track = value;
    } else if (key == "Date") {
        song.date = value;
    } else if (key == "Genre") {
        song.genre = value;
    } else if (key == "Composer") {
        song.composer = value;
    }
}

// Returns a custom object tree corresponding to the descriptor
function organizeJsonLib(flat: SongInfo[], treeDescriptor: string[], leafDescriptor: string[]): Tree {
    var tree = {};
    flat.forEach(function(song: SongInfo) {
        var treePtr: any = tree;
        var depth = 1;
        treeDescriptor.forEach(function(key: string) {
            var valueForKey: any = song[key];
            if (valueForKey === undefined) {
                valueForKey = "";
            }
            if (!treePtr[valueForKey]) {
                if (depth == treeDescriptor.length) {
                    treePtr[valueForKey] = [];
                } else {
                    treePtr[valueForKey] = {};
                }
            }
            treePtr = treePtr[valueForKey];
            depth++;
        });
        var leaf = {};
        leafDescriptor.forEach(function(key: string) {
            leaf[key] = song[key];
        });
        treePtr.push(leaf);
    });
    return {root: tree};
}

function getSongsPage(allSongs: SongInfo[], start: number, count: number): SongInfo[] {
    var end: number = Math.min(allSongs.length, start + count);
    if (end > start) {
        return allSongs.slice(start, end);
    }
    return [];
}
