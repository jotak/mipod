'use strict';

var Library = require('../Library');
var MpdClient = require('../MpdClient');
var q = require('q');

function mock2Files() {
    MpdClient.lsinfo = function() {
        return q.fcall(function () {
            return "file: USB\/Musics\/myFile.mp3\nLast-Modified: 2013-09-15T07:33:08Z\nTime: 202\nArtist: An artist\nAlbumArtist: An artist\nTitle: My song\nAlbum: An album\nTrack: 1\nDate: 2004\nGenre: Rock\nfile: USB\/Musics\/anotherFile.mp3\nLast-Modified: 2013-09-15T07:33:14Z\nTime: 242\nArtist: An artist\nAlbumArtist: An artist\nTitle: Another song\nAlbum: An album\nTrack: 1\nDate: 2004\nGenre: Rock";
        });
    }
}

function mock2FilesIn2Dirs() {
    MpdClient.lsinfo = function(path) {
        return q.fcall(function () {
            if (path === "") {
                return "directory: dir1\ndirectory: dir2";
            } else if (path === "dir1") {
                return "file: USB\/Musics\/myFile.mp3\nLast-Modified: 2013-09-15T07:33:08Z\nTime: 202\nArtist: An artist\nAlbumArtist: An artist\nTitle: My song\nAlbum: An album\nTrack: 1\nDate: 2004\nGenre: Rock";
            } else if (path === "dir2") {
                return "file: USB\/Musics\/anotherFile.mp3\nLast-Modified: 2013-09-15T07:33:14Z\nTime: 242\nArtist: An artist\nAlbumArtist: An artist\nTitle: Another song\nAlbum: An album\nTrack: 1\nDate: 2004\nGenre: Rock";
            } else {
                return "";
            }
        });
    }
}

function mock1RootFile1FileInDir() {
    MpdClient.lsinfo = function(path) {
        return q.fcall(function () {
            if (path === "") {
                return "directory: dir1\nfile: USB\/Musics\/anotherFile.mp3\nLast-Modified: 2013-09-15T07:33:14Z\nTime: 242\nArtist: An artist\nAlbumArtist: An artist\nTitle: Another song\nAlbum: An album\nTrack: 1\nDate: 2004\nGenre: Rock";
            } else if (path === "dir1") {
                return "file: USB\/Musics\/myFile.mp3\nLast-Modified: 2013-09-15T07:33:08Z\nTime: 202\nArtist: An artist\nAlbumArtist: An artist\nTitle: My song\nAlbum: An album\nTrack: 1\nDate: 2004\nGenre: Rock";
            } else {
                return "";
            }
        });
    }
}

describe('Library', function () {
    it('should load 2 songs', function (done) {
        var lib = new Library.Loader();
        mock2Files();
        lib.loadDirForLib([], "").then(function(data) {
            data.should.have.property('songs').with.lengthOf(2);
            done();
        });
    });

    it('should load 2 songs from 2 dirs', function (done) {
        var lib = new Library.Loader();
        mock2FilesIn2Dirs();
        lib.loadDirForLib([], "").then(function(data) {
            data.should.have.property('songs').with.lengthOf(2);
            done();
        });
    });

    it('should load 1 song from 2 dirs', function (done) {
        var lib = new Library.Loader();
        mock2FilesIn2Dirs();
        lib.loadDirForLib([], "dir1").then(function(data) {
            data.should.have.property('songs').with.lengthOf(1);
            done();
        });
    });

    it('should load 1 song from root and 1 from dir', function (done) {
        var lib = new Library.Loader();
        mock1RootFile1FileInDir();
        lib.loadDirForLib([], "").then(function(data) {
            data.should.have.property('songs').with.lengthOf(2);
            done();
        });
    });
});
