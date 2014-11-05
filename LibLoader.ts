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
}

class LibLoader {
    private dataPath: string = "data/";
    private useCacheFile: boolean = false;
    private allLoaded: boolean = false;
    private loadingCounter: number = 0;
    private mpdContent: SongInfo[] = [];
    private tags: ThemeTags = {};

    public setUseCacheFile(useCacheFile: boolean) {
        this.useCacheFile = useCacheFile;
    }

    public setDataPath(dataPath: string) {
        this.dataPath = dataPath;
    }

    public loadOnce(): string {
        if (this.allLoaded) {
            // Already loaded, no need to load again.
            return "Already loaded";
        } else if (this.loadingCounter > 0) {
            // Already started to load => ignore
            return "Load in progress";
        } else {
            var that = this;
            LibCache.loadTags(this.tagsFile()).then(function(data: ThemeTags) {
                that.tags = data;
            }).fail(function(reason: Error) {
                console.log("Could not read tags: " + reason.message);
            }).done();

            if (this.useCacheFile) {
                LibCache.loadCache(this.cacheFile()).then(function(data: SongInfo[]) {
                    that.mpdContent = data;
                    that.loadingCounter = data.length;
                    if (that.loadingCounter === 0) {
                        // Cache file is empty, so we'll try MPD anyway
                        console.log("Loading from MPD because cache is empty");
                        that.loadAllLib();
                    } else {
                        that.allLoaded = true;
                    }
                }).fail(function(reason: Error) {
                    console.log("Could not read cache: " + reason.message);
                    that.loadAllLib();
                }).done();
                return "Start loading from cache";
            } else {
                this.loadAllLib();
                return "Start loading from MPD";
            }
        }
    }

    public forceRefresh(): string {
        this.allLoaded = false;
        this.loadingCounter = 0;
        this.mpdContent = [];
        this.tags = {};
        this.loadAllLib();
        return "OK";
    }

    public getPage(res, start: number, count: number, treeDescriptor: string[], leafDescriptor: string[]) {
        var end: number = Math.min(this.mpdContent.length, start + count);
        var subTree: Tree = this.organizeJsonLib(
            this.getSongsPage(this.mpdContent, start, end),
                treeDescriptor,
                leafDescriptor);
        res.send({
            status: "OK",
            finished: (this.allLoaded && end === this.mpdContent.length),
            next: end,
            data: subTree.root
        });
    }

    public progress(res) {
        res.send(new String(this.loadingCounter));
    }

    public lsInfo(dir: string, leafDescriptor: string[]): q.Promise<any[]> {
        var that = this;
        return MpdClient.lsinfo(dir)
            .then(function(response: string) {
                return q.fcall<any[]>(function() {
                    return that.parseFlatDir(response, leafDescriptor);
                });
            });
    }

    public search(mode: string, searchstr: string, leafDescriptor: string[]): q.Promise<any[]> {
        var that = this;
        return MpdClient.search(mode, searchstr)
            .then(function(response: string) {
                return q.fcall<any[]>(function() {
                    return that.parseFlatDir(response, leafDescriptor);
                });
            });
    }

    public readTag(tagName: string, targets: TagTarget[]): q.Promise<ThemeTags> {
        if (!this.allLoaded) {
            throw new Error("Tag reading service is unavailable until the library is fully loaded.");
        }
        var returnTags: ThemeTags = {};
        for (var i = 0; i < targets.length; i++) {
            var targetType: string = targets[i].targetType;
            var target: string = targets[i].target;
            if (this.tags[targetType] !== undefined
                    && this.tags[targetType][target] !== undefined
                    && this.tags[targetType][target][tagName] !== undefined) {
                var tag: TagsMap = {};
                var item: ItemTags = {};
                var theme: ThemeTags = {};
                tag[tagName] = this.tags[targetType][target][tagName];
                item[target] = tag;
                theme[targetType] = item;
                tools.override(returnTags, theme);
            }
        }
        return q.fcall<ThemeTags>(function() {
            return returnTags;
        });
    }

    public writeTag(tagName: string, tagValue: string, targets: TagTarget[]): q.Promise<string> {
        if (!this.allLoaded) {
            throw new Error("Tag writing service is unavailable until the library is fully loaded.");
        }
        for (var i = 0; i < targets.length; i++) {
            var tag: TagsMap = {};
            var item: ItemTags = {};
            var theme: ThemeTags = {};
            tag[tagName] = tagValue;
            item[targets[i].target] = tag;
            theme[targets[i].targetType] = item;
            tools.override(this.tags, theme);
        }
        var deferred: q.Deferred<string> = q.defer<string>();
        LibCache.saveTags(this.tagsFile(), this.tags).then(function() {
            deferred.resolve("Tag succesfully written");
        }).fail(function(reason: Error) {
            console.log("Cache not saved: " + reason.message);
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    private cacheFile(): string {
        return this.dataPath + "/libcache.json";
    }

    private tagsFile(): string {
        return this.dataPath + "/libtags.json";
    }

    private loadAllLib() {
        var that = this;
        this.loadDirForLib(this.mpdContent, "").then(function() {
            that.allLoaded = true;
            if (that.useCacheFile) {
                LibCache.saveCache(that.cacheFile(), that.mpdContent).fail(function(reason: Error) {
                    console.log("Cache not saved: " + reason.message);
                });
            }
        }).done();
    }

    private loadDirForLib(songs: SongInfo[], dir: string): q.Promise<ParserInfo> {
        var that = this;
        return MpdClient.lsinfo(dir)
            .then(function(response: string) {
                var lines: string[] = response.split("\n");
                return that.parseNext({ songs: songs, lines: lines, cursor: 0 });
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
            var currentSong: SongInfo;
            if (entry.key == "file") {
                currentSong = { "file": entry.value };
                parser.songs.push(currentSong);
                this.loadingCounter++;
            } else if (entry.key == "directory") {
                currentSong = null;
                // Load (async) the directory content, and then only continue on parsing what remains here
                return this.loadDirForLib(parser.songs, entry.value)
                    .then(function(subParser: ParserInfo) {
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
        return q.fcall<ParserInfo>(function() {
            return parser;
        });
    }

    private parseFlatDir(response: string, leafDescriptor: string[]): any[] {
        return MpdEntries.readEntries(response).map(function(inObj: MpdEntry) {
            if (inObj.dir && leafDescriptor.indexOf("directory") >= 0) {
                return { "directory": inObj.dir };
            } else if (inObj.playlist && leafDescriptor.indexOf("playlist") >= 0) {
                return { "playlist": inObj.playlist };
            } else if (inObj.song) {
                var outObj = {};
                leafDescriptor.forEach(function(key: string) {
                    if (inObj.song.hasOwnProperty(key)) {
                        outObj[key] = inObj.song[key];
                    }
                });
                return outObj;
            } else {
                return {};
            }
        }).filter(function(obj) {
            return Object.keys(obj).length > 0;
        });
    }

    // Returns a custom object tree corresponding to the descriptor
    private organizeJsonLib(flat: SongInfo[], treeDescriptor: string[], leafDescriptor: string[]): Tree {
        var that = this;
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
                    if (that.tags[mostCommonKey] && that.tags[mostCommonKey][valueForKey]) {
                        treePtr[valueForKey].tags = that.tags[mostCommonKey][valueForKey];
                    }
                }
                treePtr = treePtr[valueForKey].mpd;
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

    private getSongsPage(allSongs: SongInfo[], start: number, end: number): SongInfo[] {
        if (end > start) {
            return allSongs.slice(start, end);
        }
        return [];
    }
}
export = LibLoader;
