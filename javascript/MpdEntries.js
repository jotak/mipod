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
var tools = require('./tools');
"use strict";
function readEntries(response) {
    var entries = [];
    var lines = response.split("\n");
    var currentSong = null;
    for (var i = 0; i < lines.length; i++) {
        var entry = tools.splitOnce(lines[i], ": ");
        if (entry.key === "file") {
            currentSong = { file: entry.value };
            entries.push({ song: currentSong });
        }
        else if (entry.key === "playlist") {
            currentSong = null;
            entries.push({ playlist: entry.value });
        }
        else if (entry.key === "directory") {
            currentSong = null;
            entries.push({ dir: entry.value });
        }
        else if (currentSong != null) {
            setSongField(currentSong, entry.key, entry.value);
        }
    }
    return entries;
}
exports.readEntries = readEntries;
function setSongField(song, key, value) {
    if (key == "Last-Modified") {
        song.lastModified = value;
    }
    else if (key == "Time") {
        song.time = +value;
    }
    else if (key == "Artist") {
        song.artist = value;
    }
    else if (key == "AlbumArtist") {
        song.albumArtist = value;
    }
    else if (key == "Title") {
        song.title = value;
    }
    else if (key == "Album") {
        song.album = value;
    }
    else if (key == "Track") {
        song.track = value;
    }
    else if (key == "Date") {
        song.date = value;
    }
    else if (key == "Genre") {
        song.genre = value;
    }
    else if (key == "Composer") {
        song.composer = value;
    }
    else if (key == "Pos") {
        song.pos = +value;
    }
    else if (key == "Id") {
        song.id = +value;
    }
}
exports.setSongField = setSongField;
