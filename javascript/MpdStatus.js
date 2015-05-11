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
/* MPD DATA:
volume?: number;
repeat?: boolean;
random?: boolean;
single?: boolean;
consume?: boolean;
playlist?: number;
playlistlength?: number;
xfade?: boolean;
mixrampdb?: number;
mixrampdelay?: number;
state?: string;
song?: number;
songid?: number;
time?: string;
elapsed?: number;
bitrate?: number;
audio?: string;
nextsong?: number;
nextsongid?: number;
*/
function parse(response) {
    var lines = response.split("\n");
    var asMap = {};
    for (var i = 0; i < lines.length; i++) {
        var entry = tools.splitOnce(lines[i], ": ");
        asMap[entry.key] = entry.value;
    }
    if (asMap.hasOwnProperty('time')) {
        var arr = asMap['time'].split(':');
        asMap['elapsed'] = arr[0];
        asMap['time'] = arr[1];
    }
    if (asMap.hasOwnProperty('audio')) {
        var arr = asMap['audio'].split(':');
        asMap['audioSampleRate'] = arr[0];
        asMap['audioSampleDepth'] = arr[1];
        asMap['audioChannels'] = arr[2];
    }
    ["volume", "playlist", "playlistlength", "mixrampdb", "mixrampdelay", "song", "songid", "elapsed", "bitrate", "nextsong", "nextsongid", "xfade", "time", "audioSampleRate", "audioSampleDepth", "audioChannels"].forEach(function (key) {
        var asNumber = +asMap[key];
        if (!isNaN(asNumber)) {
            asMap[key] = asNumber;
        }
        else {
            delete asMap[key];
        }
    });
    ["repeat", "random", "single", "consume"].forEach(function (key) {
        if (asMap[key] === "1") {
            asMap[key] = true;
        }
        else if (asMap[key] === "0") {
            asMap[key] = false;
        }
        else {
            delete asMap[key];
        }
    });
    if (asMap.hasOwnProperty('audioChannels')) {
        if (asMap['audioChannels'] > 2) {
            asMap['audioChannels'] = "Multichannel";
        }
        else if (asMap['audioChannels'] === 2) {
            asMap['audioChannels'] = "Stereo";
        }
        else {
            asMap['audioChannels'] = "Mono";
        }
    }
    delete asMap[""];
    return asMap;
}
exports.parse = parse;
