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

var LibCache = require('./LibCache');
var tools = require('./tools');
var q = require('q');

"use strict";

var LibLoader = (function () {
    function LibLoader() {
        this.cacheFile = null;
        this.allLoaded = false;
        this.loadingCounter = 0;
        this.libCache = {
            mpdContent: [],
            tags: {}
        };
    }
    LibLoader.prototype.useCacheFile = function (cacheFile) {
        this.cacheFile = cacheFile;
    };

    LibLoader.prototype.loadOnce = function () {
        if (this.allLoaded) {
            // Already loaded, no need to load again.
            return "Already loaded";
        } else if (this.loadingCounter > 0) {
            // Already started to load => ignore
            return "Load in progress";
        } else if (this.cacheFile !== null) {
            var that = this;
            LibCache.load(this.cacheFile).then(function (data) {
                that.libCache = data;
                that.loadingCounter = data.mpdContent.length;
                if (that.loadingCounter === 0) {
                    // Cache file is empty, so we'll try MPD anyway
                    console.log("Loading from MPD because cache is empty");
                    that.loadAllLib();
                } else {
                    that.allLoaded = true;
                }
            }).fail(function (reason) {
                console.log("Could not read cache: " + reason.message);
                that.loadAllLib();
            }).done();
            return "Start loading from cache";
        } else {
            this.loadAllLib();
            return "Start loading from MPD";
        }
    };

    LibLoader.prototype.forceRefresh = function () {
        this.allLoaded = false;
        this.loadingCounter = 0;
        this.libCache.mpdContent = [];
        this.loadAllLib();
        return "OK";
    };

    LibLoader.prototype.getPage = function (res, start, count, treeDescriptor, leafDescriptor) {
        var end = Math.min(this.libCache.mpdContent.length, start + count);
        var subTree = this.organizeJsonLib(this.getSongsPage(this.libCache.mpdContent, start, end), treeDescriptor, leafDescriptor);
        res.send({
            status: "OK",
            finished: (this.allLoaded && end === this.libCache.mpdContent.length),
            next: end,
            data: subTree.root
        });
    };

    LibLoader.prototype.progress = function (res) {
        res.send(new String(this.loadingCounter));
    };

    LibLoader.prototype.lsInfo = function (dir, leafDescriptor) {
        var that = this;
        return MpdClient.lsinfo(dir).then(function (response) {
            var lines = response.split("\n");
            return q.fcall(function () {
                return that.parseFlatDir(lines, leafDescriptor);
            });
        });
    };

    LibLoader.prototype.readTag = function (tagName, targets) {
        if (!this.allLoaded) {
            throw new Error("Tag reading service is unavailable until the library is fully loaded.");
        }
        var returnTags = {};
        for (var i = 0; i < targets.length; i++) {
            var targetType = targets[i].targetType;
            var target = targets[i].target;
            if (this.libCache.tags[targetType] !== undefined && this.libCache.tags[targetType][target] !== undefined && this.libCache.tags[targetType][target][tagName] !== undefined) {
                var tag = {};
                var item = {};
                var theme = {};
                tag[tagName] = this.libCache.tags[targetType][target][tagName];
                item[target] = tag;
                theme[targetType] = item;
                tools.recursiveMerge(returnTags, theme);
            }
        }
        return q.fcall(function () {
            return returnTags;
        });
    };

    LibLoader.prototype.writeTag = function (tagName, tagValue, targets) {
        if (!this.allLoaded) {
            throw new Error("Tag writing service is unavailable until the library is fully loaded.");
        }
        for (var i = 0; i < targets.length; i++) {
            var tag = {};
            var item = {};
            var theme = {};
            tag[tagName] = tagValue;
            item[targets[i].target] = tag;
            theme[targets[i].targetType] = item;
            tools.recursiveMerge(this.libCache.tags, theme);
        }
        if (this.cacheFile !== null) {
            var deferred = q.defer();
            LibCache.save(this.cacheFile, this.libCache).then(function () {
                deferred.resolve("Tag succesfully written");
            }).fail(function (reason) {
                console.log("Cache not saved: " + reason.message);
                deferred.reject(reason);
            });
            return deferred.promise;
        } else {
            return q.fcall(function () {
                return "Tag written in current instance only. You should provide a cache file in order to persist it.";
            });
        }
    };

    LibLoader.prototype.loadAllLib = function () {
        var that = this;
        this.loadDirForLib(this.libCache.mpdContent, "").then(function () {
            that.allLoaded = true;
            if (that.cacheFile !== null) {
                LibCache.save(that.cacheFile, that.libCache).fail(function (reason) {
                    console.log("Cache not saved: " + reason.message);
                });
            }
        }).done();
    };

    LibLoader.prototype.splitOnce = function (str, separator) {
        var i = str.indexOf(separator);
        if (i >= 0) {
            return { key: str.slice(0, i), value: str.slice(i + separator.length) };
        } else {
            return { key: "", value: str.slice(i + separator.length) };
        }
    };

    LibLoader.prototype.loadDirForLib = function (songs, dir) {
        var that = this;
        return MpdClient.lsinfo(dir).then(function (response) {
            var lines = response.split("\n");
            return that.parseNext({ songs: songs, lines: lines, cursor: 0 });
        });
    };

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
    LibLoader.prototype.parseNext = function (parser) {
        var that = this;
        var currentSong = null;
        for (; parser.cursor < parser.lines.length; parser.cursor++) {
            var entry = this.splitOnce(parser.lines[parser.cursor], ": ");
            var currentSong;
            if (entry.key == "file") {
                currentSong = { "file": entry.value };
                parser.songs.push(currentSong);
                this.loadingCounter++;
            } else if (entry.key == "directory") {
                currentSong = null;

                // Load (async) the directory content, and then only continue on parsing what remains here
                return this.loadDirForLib(parser.songs, entry.value).then(function (subParser) {
                    // this "subParser" contains gathered songs, whereas the existing "parser" contains previous cursor information that we need to continue on this folder
                    return that.parseNext({ songs: subParser.songs, lines: parser.lines, cursor: parser.cursor + 1 });
                });
            } else if (entry.key == "playlist") {
                // skip
                currentSong = null;
            } else if (currentSong != null) {
                this.fillSongData(currentSong, entry.key, entry.value);
            }
        }

        // Did not find any sub-directory, return directly this data
        return q.fcall(function () {
            return parser;
        });
    };

    LibLoader.prototype.parseFlatDir = function (lines, leafDescriptor) {
        var currentSong = null;
        var dirContent = [];
        for (var i = 0; i < lines.length; i++) {
            var entry = this.splitOnce(lines[i], ": ");
            var currentSong;
            if (entry.key == "file" || entry.key == "playlist") {
                currentSong = { "file": entry.value };
                dirContent.push(currentSong);
            } else if (entry.key == "directory") {
                currentSong = null;
                dirContent.push({ directory: entry.value });
            } else if (currentSong != null) {
                this.fillSongData(currentSong, entry.key, entry.value);
            }
        }
        return dirContent.map(function (inObj) {
            var outObj = {};
            leafDescriptor.forEach(function (key) {
                outObj[key] = inObj[key];
            });
            return outObj;
        });
    };

    LibLoader.prototype.fillSongData = function (song, key, value) {
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
    };

    // Returns a custom object tree corresponding to the descriptor
    LibLoader.prototype.organizeJsonLib = function (flat, treeDescriptor, leafDescriptor) {
        var that = this;
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
                    if (depth === treeDescriptor.length) {
                        treePtr[valueForKey] = { tags: {}, mpd: [] };
                    } else {
                        treePtr[valueForKey] = { tags: {}, mpd: {} };
                    }
                    var mostCommonKey = possibleKeys[possibleKeys.length - 1];
                    if (that.libCache.tags[mostCommonKey] && that.libCache.tags[mostCommonKey][valueForKey]) {
                        treePtr[valueForKey].tags = that.libCache.tags[mostCommonKey][valueForKey];
                    }
                }
                treePtr = treePtr[valueForKey].mpd;
                depth++;
            });
            var leaf = {};
            leafDescriptor.forEach(function (key) {
                leaf[key] = song[key];
            });
            treePtr.push(leaf);
        });
        return { root: tree };
    };

    LibLoader.prototype.getSongsPage = function (allSongs, start, end) {
        if (end > start) {
            return allSongs.slice(start, end);
        }
        return [];
    };
    return LibLoader;
})();
module.exports = LibLoader;
