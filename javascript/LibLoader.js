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

var MpdEntries = require('./MpdEntries');
var LibCache = require('./LibCache');
var tools = require('./tools');
var q = require('q');

"use strict";

var LibLoader = (function () {
    function LibLoader() {
        this.dataPath = "data/";
        this.useCacheFile = false;
        this.allLoaded = false;
        this.loadingCounter = 0;
        this.mpdContent = [];
        this.tags = {};
    }
    LibLoader.prototype.setUseCacheFile = function (useCacheFile) {
        this.useCacheFile = useCacheFile;
    };

    LibLoader.prototype.setDataPath = function (dataPath) {
        this.dataPath = dataPath;
    };

    LibLoader.prototype.loadOnce = function () {
        if (this.allLoaded) {
            // Already loaded, no need to load again.
            return "Already loaded";
        } else if (this.loadingCounter > 0) {
            // Already started to load => ignore
            return "Load in progress";
        } else {
            var that = this;
            LibCache.loadTags(this.tagsFile()).then(function (data) {
                that.tags = data;
            }).fail(function (reason) {
                console.log("Could not read tags: " + reason.message);
            }).done();

            if (this.useCacheFile) {
                LibCache.loadCache(this.cacheFile()).then(function (data) {
                    that.mpdContent = data;
                    that.loadingCounter = data.length;
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
        }
    };

    LibLoader.prototype.forceRefresh = function () {
        this.allLoaded = false;
        this.loadingCounter = 0;
        this.mpdContent = [];
        this.tags = {};
        this.loadAllLib();
        return "OK";
    };

    LibLoader.prototype.getPage = function (start, count, treeDescriptor, leafDescriptor) {
        var end = Math.min(this.mpdContent.length, start + count);
        var subTree = this.organizeJsonLib(this.getSongsPage(this.mpdContent, start, end), treeDescriptor, leafDescriptor);
        return {
            status: "OK",
            finished: (this.allLoaded && end === this.mpdContent.length),
            next: end,
            data: subTree.root
        };
    };

    LibLoader.prototype.progress = function () {
        return String(this.loadingCounter);
    };

    LibLoader.prototype.lsInfo = function (dir, leafDescriptor) {
        var that = this;
        return MpdClient.lsinfo(dir).then(function (response) {
            return q.fcall(function () {
                return that.parseFlatDir(response, leafDescriptor);
            });
        });
    };

    LibLoader.prototype.search = function (mode, searchstr, leafDescriptor) {
        var that = this;
        return MpdClient.search(mode, searchstr).then(function (response) {
            return q.fcall(function () {
                return that.parseFlatDir(response, leafDescriptor);
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
            if (this.tags[targetType] !== undefined && this.tags[targetType][target] !== undefined && this.tags[targetType][target][tagName] !== undefined) {
                var tag = {};
                var item = {};
                var theme = {};
                tag[tagName] = this.tags[targetType][target][tagName];
                item[target] = tag;
                theme[targetType] = item;
                tools.override(returnTags, theme);
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
            tools.override(this.tags, theme);
        }
        var deferred = q.defer();
        LibCache.saveTags(this.tagsFile(), this.tags).then(function () {
            deferred.resolve("Tag succesfully written");
        }).fail(function (reason) {
            console.log("Cache not saved: " + reason.message);
            deferred.reject(reason);
        });
        return deferred.promise;
    };

    LibLoader.prototype.cacheFile = function () {
        return this.dataPath + "/libcache.json";
    };

    LibLoader.prototype.tagsFile = function () {
        return this.dataPath + "/libtags.json";
    };

    LibLoader.prototype.loadAllLib = function () {
        var that = this;
        this.loadDirForLib(this.mpdContent, "").then(function () {
            that.allLoaded = true;
            if (that.useCacheFile) {
                LibCache.saveCache(that.cacheFile(), that.mpdContent).fail(function (reason) {
                    console.log("Cache not saved: " + reason.message);
                });
            }
        }).done();
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
            var entry = tools.splitOnce(parser.lines[parser.cursor], ": ");
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
                MpdEntries.setSongField(currentSong, entry.key, entry.value);
            }
        }

        // Did not find any sub-directory, return directly this data
        return q.fcall(function () {
            return parser;
        });
    };

    LibLoader.prototype.parseFlatDir = function (response, leafDescriptor) {
        return MpdEntries.readEntries(response).map(function (inObj) {
            if (inObj.dir && (leafDescriptor === undefined || leafDescriptor.indexOf("directory") >= 0)) {
                return { "directory": inObj.dir };
            } else if (inObj.playlist && (leafDescriptor === undefined || leafDescriptor.indexOf("playlist") >= 0)) {
                return { "playlist": inObj.playlist };
            } else if (inObj.song) {
                if (leafDescriptor) {
                    var outObj = {};
                    leafDescriptor.forEach(function (key) {
                        if (inObj.song.hasOwnProperty(key)) {
                            outObj[key] = inObj.song[key];
                        }
                    });
                    return outObj;
                } else {
                    return inObj.song;
                }
            } else {
                return {};
            }
        }).filter(function (obj) {
            return Object.keys(obj).length > 0;
        });
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
                    if (that.tags[mostCommonKey] && that.tags[mostCommonKey][valueForKey]) {
                        treePtr[valueForKey].tags = that.tags[mostCommonKey][valueForKey];
                    }
                }
                treePtr = treePtr[valueForKey].mpd;
                depth++;
            });
            if (leafDescriptor) {
                var leaf = {};
                leafDescriptor.forEach(function (key) {
                    leaf[key] = song[key];
                });
                treePtr.push(leaf);
            } else {
                treePtr.push(song);
            }
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
