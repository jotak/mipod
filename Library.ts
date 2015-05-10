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
import TagsMap = require('./libtypes/TagsMap');
import ItemTags = require('./libtypes/ItemTags');
import ThemeTags = require('./libtypes/ThemeTags');
import SongInfo = require('./libtypes/SongInfo');
import MpdEntry = require('./libtypes/MpdEntry');
import TagTarget = require('./libtypes/TagTarget');
import MpdEntries = require('./MpdEntries');
import LibCache = require('./LibCache');
import tools = require('./tools');
import q = require('q');

"use strict";

interface Tree {
    root: any;
}

interface ParserInfo {
    songs: SongInfo[];
    lines: string[];
    cursor: number;
    mpd: MpdClient;
}

class LoadingListener {
    private collected: SongInfo[];
    private hTimeout: any;
    private totalItems: number;
    private nbSent: number;
    private finished: boolean = false;

    constructor(public pushHandler: (data: Page, nbItems: number)=>void,
                public finishedHandler: (nbItems: number)=>void,
                public maxBatchSize: number,
                public treeDescriptor: string[],
                public leafDescriptor?: string[]) {
        this.collected = [];
        this.hTimeout = null;
        this.totalItems = -1;
        this.nbSent = 0;
    }

    public setTotalItems(nbItems: number) {
        this.totalItems = nbItems;
        if (this.nbSent === nbItems) {
            this.finishedHandler(nbItems);
            this.totalItems = -1;
            this.finished = true;
        }
    }

    public collect(song: SongInfo, tags: ThemeTags) {
        this.collected.push(song);
        if (this.hTimeout === null) {
            var that: LoadingListener = this;
            this.hTimeout = setTimeout(function() {
                that.pushBatches(that.collected, tags, 0);
                that.collected = [];
                that.hTimeout = null;
            }, 200);
        }
    }

    public pushBatches(data: SongInfo[], tags: ThemeTags, start: number) {
        var batchSize: number = Math.min(this.maxBatchSize, data.length - start);
        if (batchSize > 0) {
            this.nbSent += batchSize;
            this.pushHandler(organizer(data.slice(start, start+batchSize), tags, this.treeDescriptor, this.leafDescriptor).root, this.nbSent);
            start += batchSize;
            if (start < data.length) {
                var that: LoadingListener = this;
                setTimeout(function() {
                    that.pushBatches(data, tags, start);
                }, 200);
            } else if (this.nbSent === this.totalItems) {
                this.finishedHandler(this.totalItems);
                this.totalItems = -1;
                this.finished = true;
            }
        } else {
            if (this.nbSent === this.totalItems) {
                this.finishedHandler(this.totalItems);
                this.totalItems = -1;
                this.finished = true;
            }
        }
    }

    public isFinished(): boolean {
        return this.finished;
    }
}

export interface Page {
    status: string;
    finished: boolean;
    next: number;
    data: any;
}

export class Library {
    private dataPath: string = "data/";
    private useCacheFile: boolean = false;
    private allLoaded: boolean = false;
    private deferredAllLoaded: q.Deferred<void> = q.defer<void>();
    private loadingCounter: number = -1;
    private mpdContent: SongInfo[] = [];
    private tags: ThemeTags = {};
    private loadingListeners: LoadingListener[] = [];

    public setUseCacheFile(useCacheFile: boolean) {
        this.useCacheFile = useCacheFile;
    }

    public setDataPath(dataPath: string) {
        this.dataPath = dataPath;
    }

    public init(): q.Promise<void> {
        var that = this;
        this.loadingCounter = 0;
        return that.tagsLoader().then(function() {
            return that.libLoader();
        }).then(function() {
            that.allLoaded = true;
            that.deferredAllLoaded.resolve(null);
        });
    }

    private tagsLoader(): q.Promise<void> {
        var that = this;
        return LibCache.loadTags(this.tagsFile()).then(function(data: ThemeTags) {
                that.tags = data;
            }).fail(function(reason: Error) {
                console.log("Could not read tags: " + reason.message);
            });
    }

    private libLoader(): q.Promise<void> {
        var that = this;
        if (this.useCacheFile) {
            return LibCache.loadCache(that.cacheFile()).then(function(data: SongInfo[]) {
                that.mpdContent = data;
                that.loadingCounter = data.length;
                if (that.loadingCounter === 0) {
                    // Cache file is empty, so we'll try MPD anyway
                    console.log("Loading from MPD because cache is empty");
                    return that.loadAllLib();
                } else {
                    that.allLoaded = true;
                    that.deferredAllLoaded.resolve(null);
                    that.loadingListeners.forEach(function(listener: LoadingListener) {
                        listener.setTotalItems(that.mpdContent.length);
                        listener.pushBatches(data, that.tags, 0);
                    });
                    that.loadingListeners = [];
                }
            }).fail(function(reason: Error) {
                console.log("Could not read cache: " + reason.message);
            });
        } else {
            return that.loadAllLib();
        }
    }

    public notifyLoading(pushHandler: (data: Page, nbItems: number)=>void, finishedHandler: (nbItems: number)=>void, maxBatchSize: number, treeDescriptor: string[], leafDescriptor?: string[]) {
        // Lazy init if necessary
        if (this.loadingCounter < 0) {
            this.init();
        }
        var that = this;

        // Create new listener and push already loaded data
        var listener: LoadingListener = new LoadingListener(pushHandler, finishedHandler, maxBatchSize, treeDescriptor, leafDescriptor);
        listener.setTotalItems(that.mpdContent.length);
        listener.pushBatches(that.mpdContent, that.tags, 0);

        // Clean any inactive listeners, push the new one
        var stillActive: LoadingListener[] = [];
        stillActive.push(listener);
        this.loadingListeners.forEach(function(listener) {
            if (!listener.isFinished()) {
                stillActive.push(listener);
            }
        });
        this.loadingListeners = stillActive;
    }

    public clearCache(): q.Promise<void> {
        var deferred: q.Deferred<void> = q.defer<void>();
        this.allLoaded = false;
        this.deferredAllLoaded = q.defer<void>();
        this.loadingCounter = -1;
        this.mpdContent = [];
        this.tags = {};
        if (this.useCacheFile) {
            LibCache.saveCache(this.cacheFile(), this.mpdContent).then(function() {
                deferred.resolve(null);
            }).fail(function(reason: Error) {
                console.log("Cache not saved: " + reason.message);
                deferred.reject(reason);
            });
        } else {
            deferred.resolve(null);
        }
        return deferred.promise;
    }

    public getPage(start: number, count: number, treeDescriptor: string[], leafDescriptor?: string[]): q.Promise<Page> {

        if (this.loadingCounter < 0) {
            this.init();
        }

        var that = this;
        return this.deferredAllLoaded.promise.then(function() {
            var end: number = Math.min(that.mpdContent.length, start + count);
            var subTree: Tree = organizer(
                that.getSongsPage(that.mpdContent, start, end),
                    that.tags,
                    treeDescriptor,
                    leafDescriptor);
            return {
                status: "OK",
                finished: (that.allLoaded && end === that.mpdContent.length),
                next: end,
                data: subTree.root
            };
        });
    }

    public progress(): number {
        return this.loadingCounter;
    }

    public lsInfo(dir: string, leafDescriptor?: string[]): q.Promise<any[]> {
        var that = this;
        return MpdClient.lsinfo(dir)
            .then(function(response: string) {
                return q.fcall<any[]>(function() {
                    return that.parseFlatDir(response, leafDescriptor);
                });
            });
    }

    public search(mode: string, searchstr: string, leafDescriptor?: string[]): q.Promise<any[]> {
        var that = this;
        return MpdClient.search(mode, searchstr)
            .then(function(response: string) {
                return q.fcall<any[]>(function() {
                    return that.parseFlatDir(response, leafDescriptor);
                });
            });
    }

    public readTag(tagName: string, targets: TagTarget[]): q.Promise<ThemeTags> {
        var deferred: q.Deferred<ThemeTags> = q.defer<ThemeTags>();
        var that = this;
        this.deferredAllLoaded.promise.then(function() {
            var returnTags: ThemeTags = {};
            for (var i = 0; i < targets.length; i++) {
                var targetType: string = targets[i].targetType;
                var target: string = targets[i].target;
                var tag: TagsMap = {};
                var item: ItemTags = {};
                var theme: ThemeTags = {};
                if (that.tags[targetType] !== undefined
                        && that.tags[targetType][target] !== undefined
                        && that.tags[targetType][target][tagName] !== undefined) {
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
    }

    public writeTag(tagName: string, tagValue: string, targets: TagTarget[]): q.Promise<ThemeTags> {
        var deferred: q.Deferred<ThemeTags> = q.defer<ThemeTags>();
        var that = this;
        this.deferredAllLoaded.promise.then(function() {
            var returnTags: ThemeTags = {};
            for (var i = 0; i < targets.length; i++) {
                var tag: TagsMap = {};
                var item: ItemTags = {};
                var theme: ThemeTags = {};
                tag[tagName] = tagValue;
                item[targets[i].target] = tag;
                theme[targets[i].targetType] = item;
                tools.override(that.tags, theme);
                tools.override(returnTags, theme);
            }
            LibCache.saveTags(that.tagsFile(), that.tags).then(function() {
                deferred.resolve(returnTags);
            }).fail(function(reason: Error) {
                console.log("Cache not saved: " + reason.message);
                deferred.reject(reason);
            });
        });
        return deferred.promise;
    }

    public deleteTag(tagName: string, targets: TagTarget[]): q.Promise<ThemeTags> {
        var deferred: q.Deferred<ThemeTags> = q.defer<ThemeTags>();
        var that = this;
        this.deferredAllLoaded.promise.then(function() {
            var returnTags: ThemeTags = {};
            for (var i = 0; i < targets.length; i++) {
                var tag: TagsMap = {};
                var item: ItemTags = {};
                var theme: ThemeTags = {};
                tag[tagName] = null;
                item[targets[i].target] = tag;
                theme[targets[i].targetType] = item;
                tools.override(returnTags, theme);
                if (that.tags.hasOwnProperty(targets[i].targetType)
                        && that.tags[targets[i].targetType].hasOwnProperty(targets[i].target)
                        && that.tags[targets[i].targetType][targets[i].target].hasOwnProperty(tagName)) {
                    delete that.tags[targets[i].targetType][targets[i].target][tagName];
                    if (Object.keys(that.tags[targets[i].targetType][targets[i].target]).length === 0) {
                        delete that.tags[targets[i].targetType][targets[i].target];
                        if (Object.keys(that.tags[targets[i].targetType]).length === 0) {
                            delete that.tags[targets[i].targetType];
                        }
                    }
                }
            }
            LibCache.saveTags(that.tagsFile(), that.tags).then(function() {
                deferred.resolve(returnTags);
            }).fail(function(reason: Error) {
                console.log("Cache not saved: " + reason.message);
                deferred.reject(reason);
            });
        });
        return deferred.promise;
    }

    private cacheFile(): string {
        return this.dataPath + "/libcache.json";
    }

    private tagsFile(): string {
        return this.dataPath + "/libtags.json";
    }

    private loadAllLib(): q.Promise<void> {
        var start = new Date().getTime();
        var that = this;
        var mpdClient: MpdClient = new MpdClient();
        return mpdClient.connect().then(function() {
            return that.loadDirForLib(mpdClient, that.mpdContent, "");
        }).then(function() {
            var elapsed = new Date().getTime() - start;
            console.log("finished in " + elapsed / 1000 + " seconds");
            that.allLoaded = true;
            that.deferredAllLoaded.resolve(null);
            that.loadingListeners.forEach(function(listener: LoadingListener) {
                listener.setTotalItems(that.mpdContent.length);
            });
            if (that.useCacheFile) {
                LibCache.saveCache(that.cacheFile(), that.mpdContent).fail(function(reason: Error) {
                    console.log("Cache not saved: " + reason.message);
                });
            }
        }).fin(function() {
            mpdClient.close();
        });
    }

    private loadDirForLib(mpd: MpdClient, songs: SongInfo[], dir: string): q.Promise<ParserInfo> {
        var that = this;
        return mpd.lsinfo(dir)
            .then(function(response: string) {
                var lines: string[] = response.split("\n");
                return that.parseNext({ mpd: mpd, songs: songs, lines: lines, cursor: 0 });
            });
    }

    private collect(song: SongInfo) {
        var that = this;
        this.loadingListeners.forEach(function(listener: LoadingListener) {
            listener.collect(song, that.tags);
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
    private parseNext(parser: ParserInfo): q.Promise<ParserInfo> {
        var that = this;
        var currentSong: SongInfo = null;
        for (; parser.cursor < parser.lines.length; parser.cursor++) {
            var entry: tools.KeyValue = tools.splitOnce(parser.lines[parser.cursor], ": ");
            if (entry.key === "file") {
                currentSong !== null && this.collect(currentSong);
                currentSong = { "file": entry.value };
                parser.songs.push(currentSong);
                this.loadingCounter++;
            } else if (entry.key === "directory") {
                currentSong !== null && this.collect(currentSong);
                currentSong = null;
                // Load (async) the directory content, and then only continue on parsing what remains here
                return this.loadDirForLib(parser.mpd, parser.songs, entry.value)
                    .then(function(subParser: ParserInfo) {
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
        return q.fcall<ParserInfo>(function() {
            return parser;
        });
    }

    private parseFlatDir(response: string, leafDescriptor?: string[]): any[] {
        return MpdEntries.readEntries(response).map(function(inObj: MpdEntry) {
            if (inObj.dir && (leafDescriptor === undefined || leafDescriptor.indexOf("directory") >= 0)) {
                return { "directory": inObj.dir };
            } else if (inObj.playlist && (leafDescriptor === undefined || leafDescriptor.indexOf("playlist") >= 0)) {
                return { "playlist": inObj.playlist };
            } else if (inObj.song) {
                if (leafDescriptor) {
                    var outObj = {};
                    leafDescriptor.forEach(function(key: string) {
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
        }).filter(function(obj) {
            return Object.keys(obj).length > 0;
        });
    }

    private getSongsPage(allSongs: SongInfo[], start: number, end: number): SongInfo[] {
        if (end > start) {
            return allSongs.slice(start, end);
        }
        return [];
    }
}

// Returns a custom object tree corresponding to the descriptor
function organizer(flat: SongInfo[], tags: ThemeTags, treeDescriptor: string[], leafDescriptor?: string[]): Tree {
    var tree = {};
    flat.forEach(function(song: SongInfo) {
        var treePtr: any = tree;
        var depth = 1;
        // strPossibleKeys can be like "albumArtist|artist", or just "album" for instance
        treeDescriptor.forEach(function(strPossibleKeys: string) {
            var possibleKeys: string[] = strPossibleKeys.split("|");
            var valueForKey: any = undefined;
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
                    treePtr[valueForKey] = {tags: {}, mpd: []};
                } else {
                    treePtr[valueForKey] = {tags: {}, mpd: {}};
                }
                var mostCommonKey: string = possibleKeys[possibleKeys.length-1];
                if (tags[mostCommonKey] && tags[mostCommonKey][valueForKey]) {
                    treePtr[valueForKey].tags = tags[mostCommonKey][valueForKey];
                }
            }
            treePtr = treePtr[valueForKey].mpd;
            depth++;
        });
        var leaf: any = {};
        if (leafDescriptor) {
            leafDescriptor.forEach(function(key: string) {
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
    return {root: tree};
}