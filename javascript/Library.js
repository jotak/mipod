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

var LoadingListener = (function () {
    function LoadingListener(pushHandler, finishedHandler, maxBatchSize, treeDescriptor, leafDescriptor) {
        this.pushHandler = pushHandler;
        this.finishedHandler = finishedHandler;
        this.maxBatchSize = maxBatchSize;
        this.treeDescriptor = treeDescriptor;
        this.leafDescriptor = leafDescriptor;
        this.collected = [];
        this.hTimeout = null;
        this.totalItems = -1;
        this.nbSent = 0;
    }
    LoadingListener.prototype.setTotalItems = function (nbItems) {
        this.totalItems = nbItems;
        if (this.nbSent === nbItems) {
            this.finishedHandler(nbItems);
            this.totalItems = -1;
        }
    };

    LoadingListener.prototype.collect = function (song, tags) {
        this.collected.push(song);
        if (this.hTimeout === null) {
            var that = this;
            this.hTimeout = setTimeout(function () {
                that.pushBatches(that.collected, tags, 0);
                that.collected = [];
                that.hTimeout = null;
            }, 200);
        }
    };

    LoadingListener.prototype.pushBatches = function (data, tags, start) {
        var batchSize = Math.min(this.maxBatchSize, data.length - start);
        if (batchSize > 0) {
            this.nbSent += batchSize;
            this.pushHandler(organizer(data.slice(start, start + batchSize), tags, this.treeDescriptor, this.leafDescriptor).root, this.nbSent);
            start += batchSize;
            if (start < data.length) {
                var that = this;
                setTimeout(function () {
                    that.pushBatches(data, tags, start);
                }, 200);
            } else if (this.nbSent === this.totalItems) {
                this.finishedHandler(this.totalItems);
                this.totalItems = -1;
            }
        } else {
            if (this.nbSent === this.totalItems) {
                this.finishedHandler(this.totalItems);
                this.totalItems = -1;
            }
        }
    };
    return LoadingListener;
})();

var Loader = (function () {
    function Loader() {
        this.dataPath = "data/";
        this.useCacheFile = false;
        this.allLoaded = false;
        this.deferredAllLoaded = q.defer();
        this.loadingCounter = 0;
        this.mpdContent = [];
        this.tags = {};
        this.loadingListener = undefined;
    }
    Loader.prototype.setUseCacheFile = function (useCacheFile) {
        this.useCacheFile = useCacheFile;
    };

    Loader.prototype.setDataPath = function (dataPath) {
        this.dataPath = dataPath;
    };

    Loader.prototype.onLoadingProgress = function (pushHandler, finishedHandler, maxBatchSize, treeDescriptor, leafDescriptor) {
        this.loadingListener = new LoadingListener(pushHandler, finishedHandler, maxBatchSize, treeDescriptor, leafDescriptor);
    };

    Loader.prototype.loadOnce = function () {
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
                        that.deferredAllLoaded.resolve(null);
                        if (that.loadingListener) {
                            that.loadingListener.setTotalItems(that.mpdContent.length);
                            that.loadingListener.pushBatches(data, that.tags, 0);
                        }
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

    Loader.prototype.clearCache = function () {
        var deferred = q.defer();
        this.allLoaded = false;
        this.deferredAllLoaded = q.defer();
        this.loadingCounter = 0;
        this.mpdContent = [];
        this.tags = {};
        if (this.useCacheFile) {
            LibCache.saveCache(this.cacheFile(), this.mpdContent).then(function () {
                deferred.resolve(null);
            }).fail(function (reason) {
                console.log("Cache not saved: " + reason.message);
                deferred.reject(reason);
            });
        } else {
            deferred.resolve(null);
        }
        return deferred.promise;
    };

    Loader.prototype.forceRefresh = function () {
        var that = this;
        this.clearCache().then(function () {
            that.loadAllLib();
        }).done();
        return "OK";
    };

    Loader.prototype.getPage = function (start, count, treeDescriptor, leafDescriptor) {
        var end = Math.min(this.mpdContent.length, start + count);
        var subTree = organizer(this.getSongsPage(this.mpdContent, start, end), this.tags, treeDescriptor, leafDescriptor);
        return {
            status: "OK",
            finished: (this.allLoaded && end === this.mpdContent.length),
            next: end,
            data: subTree.root
        };
    };

    Loader.prototype.progress = function () {
        return this.loadingCounter;
    };

    Loader.prototype.lsInfo = function (dir, leafDescriptor) {
        var that = this;
        return MpdClient.lsinfo(dir).then(function (response) {
            return q.fcall(function () {
                return that.parseFlatDir(response, leafDescriptor);
            });
        });
    };

    Loader.prototype.search = function (mode, searchstr, leafDescriptor) {
        var that = this;
        return MpdClient.search(mode, searchstr).then(function (response) {
            return q.fcall(function () {
                return that.parseFlatDir(response, leafDescriptor);
            });
        });
    };

    Loader.prototype.readTag = function (tagName, targets) {
        var deferred = q.defer();
        var that = this;
        this.deferredAllLoaded.promise.then(function () {
            var returnTags = {};
            for (var i = 0; i < targets.length; i++) {
                var targetType = targets[i].targetType;
                var target = targets[i].target;
                var tag = {};
                var item = {};
                var theme = {};
                if (that.tags[targetType] !== undefined && that.tags[targetType][target] !== undefined && that.tags[targetType][target][tagName] !== undefined) {
                    tag[tagName] = that.tags[targetType][target][tagName];
                } else {
                    // Tag not found
                    tag[tagName] = null;
                }
                item[target] = tag;
                theme[targetType] = item;
                tools.override(returnTags, theme);
            }
            deferred.resolve(returnTags);
        });
        return deferred.promise;
    };

    Loader.prototype.writeTag = function (tagName, tagValue, targets) {
        var deferred = q.defer();
        var that = this;
        this.deferredAllLoaded.promise.then(function () {
            var returnTags = {};
            for (var i = 0; i < targets.length; i++) {
                var tag = {};
                var item = {};
                var theme = {};
                tag[tagName] = tagValue;
                item[targets[i].target] = tag;
                theme[targets[i].targetType] = item;
                tools.override(that.tags, theme);
                tools.override(returnTags, theme);
            }
            LibCache.saveTags(that.tagsFile(), that.tags).then(function () {
                deferred.resolve(returnTags);
            }).fail(function (reason) {
                console.log("Cache not saved: " + reason.message);
                deferred.reject(reason);
            });
        });
        return deferred.promise;
    };

    Loader.prototype.deleteTag = function (tagName, targets) {
        var deferred = q.defer();
        var that = this;
        this.deferredAllLoaded.promise.then(function () {
            var returnTags = {};
            for (var i = 0; i < targets.length; i++) {
                var tag = {};
                var item = {};
                var theme = {};
                tag[tagName] = null;
                item[targets[i].target] = tag;
                theme[targets[i].targetType] = item;
                tools.override(returnTags, theme);
                if (that.tags.hasOwnProperty(targets[i].targetType) && that.tags[targets[i].targetType].hasOwnProperty(targets[i].target) && that.tags[targets[i].targetType][targets[i].target].hasOwnProperty(tagName)) {
                    delete that.tags[targets[i].targetType][targets[i].target][tagName];
                    if (Object.keys(that.tags[targets[i].targetType][targets[i].target]).length === 0) {
                        delete that.tags[targets[i].targetType][targets[i].target];
                        if (Object.keys(that.tags[targets[i].targetType]).length === 0) {
                            delete that.tags[targets[i].targetType];
                        }
                    }
                }
            }
            LibCache.saveTags(that.tagsFile(), that.tags).then(function () {
                deferred.resolve(returnTags);
            }).fail(function (reason) {
                console.log("Cache not saved: " + reason.message);
                deferred.reject(reason);
            });
        });
        return deferred.promise;
    };

    Loader.prototype.cacheFile = function () {
        return this.dataPath + "/libcache.json";
    };

    Loader.prototype.tagsFile = function () {
        return this.dataPath + "/libtags.json";
    };

    Loader.prototype.loadAllLib = function () {
        var start = new Date().getTime();
        var that = this;
        var mpdClient = new MpdClient();
        mpdClient.connect().then(function () {
            return that.loadDirForLib(mpdClient, that.mpdContent, "");
        }).then(function () {
            var elapsed = new Date().getTime() - start;
            console.log("finished in " + elapsed / 1000 + " seconds");
            that.allLoaded = true;
            that.deferredAllLoaded.resolve(null);
            if (that.loadingListener) {
                that.loadingListener.setTotalItems(that.mpdContent.length);
            }
            if (that.useCacheFile) {
                LibCache.saveCache(that.cacheFile(), that.mpdContent).fail(function (reason) {
                    console.log("Cache not saved: " + reason.message);
                });
            }
        }).fin(function () {
            mpdClient.close();
        }).done();
    };

    Loader.prototype.loadDirForLib = function (mpd, songs, dir) {
        var that = this;
        return mpd.lsinfo(dir).then(function (response) {
            var lines = response.split("\n");
            return that.parseNext({ mpd: mpd, songs: songs, lines: lines, cursor: 0 });
        });
    };

    Loader.prototype.collect = function (song) {
        if (this.loadingListener) {
            this.loadingListener.collect(song, this.tags);
        }
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
    Loader.prototype.parseNext = function (parser) {
        var that = this;
        var currentSong = null;
        for (; parser.cursor < parser.lines.length; parser.cursor++) {
            var entry = tools.splitOnce(parser.lines[parser.cursor], ": ");
            if (entry.key === "file") {
                currentSong !== null && this.collect(currentSong);
                currentSong = { "file": entry.value };
                parser.songs.push(currentSong);
                this.loadingCounter++;
            } else if (entry.key === "directory") {
                currentSong !== null && this.collect(currentSong);
                currentSong = null;

                // Load (async) the directory content, and then only continue on parsing what remains here
                return this.loadDirForLib(parser.mpd, parser.songs, entry.value).then(function (subParser) {
                    // this "subParser" contains gathered songs, whereas the existing "parser" contains previous cursor information that we need to continue on this folder
                    return that.parseNext({ mpd: subParser.mpd, songs: subParser.songs, lines: parser.lines, cursor: parser.cursor + 1 });
                });
            } else if (entry.key === "playlist") {
                // skip
                currentSong !== null && this.collect(currentSong);
                currentSong = null;
            } else if (currentSong != null) {
                MpdEntries.setSongField(currentSong, entry.key, entry.value);
            }
        }
        currentSong !== null && this.collect(currentSong);

        // Did not find any sub-directory, return directly this data
        return q.fcall(function () {
            return parser;
        });
    };

    Loader.prototype.parseFlatDir = function (response, leafDescriptor) {
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

    Loader.prototype.getSongsPage = function (allSongs, start, end) {
        if (end > start) {
            return allSongs.slice(start, end);
        }
        return [];
    };
    return Loader;
})();
exports.Loader = Loader;

// Returns a custom object tree corresponding to the descriptor
function organizer(flat, tags, treeDescriptor, leafDescriptor) {
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
                if (tags[mostCommonKey] && tags[mostCommonKey][valueForKey]) {
                    treePtr[valueForKey].tags = tags[mostCommonKey][valueForKey];
                }
            }
            treePtr = treePtr[valueForKey].mpd;
            depth++;
        });
        var leaf = {};
        if (leafDescriptor) {
            leafDescriptor.forEach(function (key) {
                leaf[key] = song[key];
            });
        } else {
            leaf = song;
        }
        if (tags["song"] && tags["song"][song.file]) {
            leaf.tags = tags["song"][song.file];
        }
        treePtr.push(leaf);
    });
    return { root: tree };
}
