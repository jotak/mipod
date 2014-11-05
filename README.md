mipod
======

A nodejs module for exposing a REST API for the Music Player Daemon (MPD). Written in Typescript, it generates ready-to-use Javascript.
Javascript + node package lies in folder [javascript](https://github.com/jotak/mipod/tree/master/javascript)

It can be used either as a nodejs dependency module or as a stand-alone server.

mipod provides basic MPD commands exposed as REST resources, such as *'GET /mpd/play'*.
It also provides more advanced library management, still through REST resources. You can control playback, save and load playlists, browse the musics files folder by folder or get all in a go. There are also some non-MPD features such as songs rating.


## Usage

1. Stand-alone
  As a stand-alone server, you only need the javascript files under directory '''javascript'''. Copy them to the place you want, and run mipod-rest.js with node:
  * *node mipod-rest.js*
  
  That's all you need to start the server with default parameters. It will listen to requests on port 80 and connects to a MPD server on localhost:6600. Try out http://localhost/mpd/play or http://localhost/mpd/pause, if you have an MPD server running, you should hear immediate results.

  Configurable options are:
  * **-p=$X, --port=$X** setup server port (default 80)
  * **-m=$path, --mpdRoot=$path** setup MPD-related root for REST requests (default /mpd)
  * **-l=$path, --libraryRoot=$path** setup library-related root for REST requests (default /library). You can eventually choose the same as mpdRoot.
  * **--mpdHost=$host** MPD server hostname (default localhost)
  * **--mpdPort=$X** MPD server port (default 6600)
  * **--dataPath=$path** local path where data files will be stored
  * **--dontUseLibCache** deactivate MPD caching (will be slower, but saves memory - see dedicated section below for more information).
  * **--loadLibOnStartup** load the whole library from MPD on startup and refresh its cache.
  * **-h, --help** help

2. Node module inclusion
  You can download sources from github. Since mipod is written in [typescript](http://www.typescriptlang.org/), you may want to benefit from this and import it in your own typescript code:
  * **import mipod = require('path/to/mipod/main');**

  or do the equivalent in javascript:
  * **var mipod = require('path/to/mipod/main.js');**
  
  Then, register routes by calling:
  * **mipod(app, opts)** app is your own ''express'' application, opts is a set of options equivalent to the ones described above (typescript: interface IOptions from Options.ts):
    * dataPath: string
    * useLibCache: boolean
    * mpdRestPath: string
    * libRestPath: string
    * loadLibOnStartup: boolean
    * mpdHost: string
    * mpdPort: number

## Routes
* GET /mpd/**play**
    * Enter "play" mode.
* POST {json: String} /mpd/**play**
    * Play given file (song or playlist), replacing the current playlist
* GET /mpd/**playidx**/:idx
    * Play song from playlist at given index
* POST {json: String} /mpd/**add**
    * Add given file (song or playlist) to current playlist
* GET /mpd/**clear**
    * Clear current playlist
* GET /mpd/**pause**
    * Pause current song
* GET /mpd/**stop**
    * Stop current song
* GET /mpd/**next**
    * Next song in playlist
* GET /mpd/**prev**
    * Previous song in playlist
* GET /mpd/**volume**/:value
    * Set the volume (from 0 to 100)
* GET /mpd/**repeat**/:enabled
    * Enable or disable repeat mode (expect 0/1)
* GET /mpd/**random**/:enabled
    * Enable or disable random mode (expect 0/1)
* GET /mpd/**single**/:enabled
    * Enable or disable single mode (expect 0/1)
* GET /mpd/**consume**/:enabled
    * Enable or disable consume mode (expect 0/1)
* GET /mpd/**seek**/:songIdx/:posInSong
    * Seek song position
* GET /mpd/**rmqueue**/:songIdx
    * Remove song from its index in current playlist
* GET /mpd/**deletelist**/:name
    * Delete saved playlist
* GET /mpd/**savelist**/:name
    * Save current playlist with given file name
* POST {json: [String]} /mpd/**playall**
    * Play all songs / playlists from json (replaces current playlist)
* POST {json: [String]} /mpd/**addall**
    * Add all songs / playlists from json to current playlist
* POST {json: String} /mpd/**update**
    * Update MPD database on given path (empty path = whole db)
* GET /mpd/**current**
    * Get current song info being played
* GET /mpd/**custom**/:command
    * Run a custom MPD command
* GET /library/**loadonce**
    * Trigger library scan, which will put result in cache and available for "library/get" calls.
* GET /library/**reload**
    * Force rescanning the library (clears cache)
* GET /library/**progress**
    * Get progress information on library loading. This call will returns a number in range [0, number of songs].
* GET /library/**get**/:start/:count/:treeDesc?/:leafDesc?
    * Get a map of currently loaded songs, using paginating info provided.
    * Returned json is {"status":(status code as String),"finished":(boolean, false if there's still items to pick up),"next":(number, the next item id to pick up),"data":(a map representing data as requested)}
    * "start" is the start item id of requested page. Note that you should use the "next" returned number as subsequent "start" call.
    * "count" is the number of items you try to get. Note that you may receive less than "count" items when MPD scanning is still ongoing or if you've reached the total number of items.
    * "treeDesc" is a descriptor of how you would like to receive data. By default, it is "genre,albumArtist|artist,album", which means you'll get a map of {genre1:{artist1:{album1:[leaves (see below)]}, artist2: etc.}}. The "pipe" means it will look to the wanted tag (ex: albumArtist), and if not found, look for the next one (ex: artist).
    * "leafDesc" is a descriptor of tags to include in leaves, that is, most commonly, songs. By default it is "file,track,title".
* POST {json: String} /library/**lsinfo**/:leafDesc?
    * An equivalent method of the above that returns only a flat reprensentation of a given path.
* POST {json: String} /library/**search**/:mode/:leafDesc?
    * Search for an MPD entry matching posted given string. "mode" can be any type od data recognized by MPD (check MPD documentation), for instance "file" or "any".
* POST {targets: [{targetType: String, target: String}]} /library/**tag**/:tagName/:tagValue?
    * Get (if tagValue undefined) or set (if tagValue defined) a custom tag associated to a given target.
    * Expecting POST data: "targetType" refers to a MPD tag (song, artist, album etc.). "target" depends on "targetType": for a song, will be the MPD path for instance.

## License
Copyright 2014 Joël Takvorian, [MIT License](https://github.com/jotak/mipod/blob/master/LICENSE)
