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
var MpdClient = require('./MpdClient');
var q = require('q');

"use strict";

var LibLoader = (function () {
    function LibLoader() {
    }
    LibLoader.loadOnce = function (res) {
        if (this.allLoaded) {
            // Already loaded, no need to load again.
            res.send({ status: "OK", numberOfItems: this.loadingCounter });
        } else if (this.loadingCounter > 0) {
            // Already started to load => forbidden
            res.status(403).send({ status: "Already processing", numberOfItems: this.loadingCounter });
        } else {
            var that = this;
            loadAllLib(this.allSongs).then(function () {
                that.allLoaded = true;
            }).done();
            res.send({ status: "OK" });
        }
    };

    LibLoader.reload = function (res) {
        this.allLoaded = false;
        this.loadingCounter = 0;
        this.allSongs = [];
        this.loadOnce(res);
    };

    LibLoader.getPage = function (res, start, count, treeDescriptor, leafDescriptor) {
        var end = Math.min(this.allSongs.length, start + count);
        var subTree = organizeJsonLib(getSongsPage(this.allSongs, start, end), treeDescriptor, leafDescriptor);
        res.send({
            status: "OK",
            finished: (this.allLoaded && end === this.allSongs.length),
            next: end,
            data: subTree.root
        });
    };

    LibLoader.progress = function (res) {
        res.send(new String(this.loadingCounter));
    };

    LibLoader.lsInfo = function (dir, leafDescriptor) {
        return MpdClient.lsinfo(dir).then(function (response) {
            var lines = response.split("\n");
            return q.fcall(function () {
                return parseFlatDir(lines, leafDescriptor);
            });
        });
    };
    LibLoader.allLoaded = false;
    LibLoader.loadingCounter = 0;
    LibLoader.allSongs = [];
    return LibLoader;
})();

function splitOnce(str, separator) {
    var i = str.indexOf(separator);
    if (i >= 0) {
        return { key: str.slice(0, i), value: str.slice(i + separator.length) };
    } else {
        return { key: "", value: str.slice(i + separator.length) };
    }
}

function loadAllLib(songs) {
    return loadDirForLib(songs, "");
}

function loadDirForLib(songs, dir) {
    return MpdClient.lsinfo(dir).then(function (response) {
        var lines = response.split("\n");
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
function parseNext(parser) {
    var currentSong = null;
    for (; parser.cursor < parser.lines.length; parser.cursor++) {
        var entry = splitOnce(parser.lines[parser.cursor], ": ");
        var currentSong;
        if (entry.key == "file") {
            currentSong = { "file": entry.value };
            parser.songs.push(currentSong);
            LibLoader.loadingCounter++;
        } else if (entry.key == "directory") {
            currentSong = null;

            // Load (async) the directory content, and then only continue on parsing what remains here
            return loadDirForLib(parser.songs, entry.value).then(function (subParser) {
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
    return q.fcall(function () {
        return parser;
    });
}

function parseFlatDir(lines, leafDescriptor) {
    var currentSong = null;
    var dirContent = [];
    for (var i = 0; i < lines.length; i++) {
        var entry = splitOnce(lines[i], ": ");
        var currentSong;
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
    return dirContent.map(function (inObj) {
        var outObj = {};
        leafDescriptor.forEach(function (key) {
            outObj[key] = inObj[key];
        });
        return outObj;
    });
}

function fillSongData(song, key, value) {
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
function organizeJsonLib(flat, treeDescriptor, leafDescriptor) {
    var tree = {};
    flat.forEach(function (song) {
        var treePtr = tree;
        var depth = 1;

        // strPossibleKeys can be like "albumArtist|artist", or just "album" for instance
        treeDescriptor.forEach(function (strPossibleKeys) {
            var possibleKeys = strPossibleKeys.split("|");
            var valueForKey = undefined;
            for (var key in possibleKeys) {
                valueForKey = song[possibleKeys[key]];
                if (valueForKey !== undefined && valueForKey !== "") {
                    break;
                }
            }
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
        leafDescriptor.forEach(function (key) {
            leaf[key] = song[key];
        });
        treePtr.push(leaf);
    });
    return { root: tree };
}

function getSongsPage(allSongs, start, end) {
    if (end > start) {
        return allSongs.slice(start, end);
    }
    return [];
}
module.exports = LibLoader;
