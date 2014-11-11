mipod
======

A nodejs module for exposing a REST API and Websocket for the Music Player Daemon (MPD). Written in Typescript, it generates ready-to-use Javascript.
Javascript + node package lies in folder [javascript](https://github.com/jotak/mipod/tree/master/javascript)

It can be used either as a nodejs dependency module or as a stand-alone server.

Mipod provides basic MPD commands exposed as REST resources or Websocket, such as *'GET /mipod/play'*.
It also provides more advanced library management, still through REST resources or Websocket. You can control playback, save and load playlists, browse the musics files folder by folder or get all in a go. There are also some non-MPD features such as songs rating.

## Usage

1. Stand-alone REST server
  As a stand-alone server, you only need the javascript files under directory _javascript_. Copy them to the place you want, and run mipod-rest.js with node:
  * *node mipod-rest.js*
  
  That's all you need to start the server with default parameters. It will listen to requests on port 80 and connects to a MPD server on localhost:6600. Try out http://localhost/mipod/play or http://localhost/mipod/pause, if you have an MPD server running, you should hear immediate results.

  Configurable options are:
  * **-p=$X, --port=$X** setup server port (default 80)
  * **--prefix=$path** setup root for REST requests (default empty)
  * **--mpdHost=$host** MPD server hostname (default localhost)
  * **--mpdPort=$X** MPD server port (default 6600)
  * **--dataPath=$path** local path where data files will be stored
  * **--dontUseLibCache** deactivate MPD caching (will be slower, but saves memory - see dedicated section below for more information).
  * **--loadLibOnStartup** load the whole library from MPD on startup and refresh its cache.
  * **-h, --help** help

2. Stand-alone Websocket server
    It's very similar to the REST server. Run:
  * *node mipod-ws.js*
  
  And the server will listen on default port (80) for websocket events. Options are the same than for the REST server, only **--prefix** will differ a bit since it won't prefix the REST resource obviously, but the websocket word event.

3. Node module inclusion
  You can download sources from github, or use npm (https://www.npmjs.org/package/mipod - note that only javascript is packaged with NPM, you wouldn't have access to typescript code this way). Since mipod is written in [typescript](http://www.typescriptlang.org/), you may want to benefit from this and import it in your own typescript code:
  * **import mipod = require('mipod');**

  or do the equivalent in javascript:
  * **var mipod = require('mipod');**
  
  Then, once again, you can either run it as a REST server or as a websocket server.
  
  For REST, register routes by calling:
  * **mipod.asRest(app, opts)** "app" is your own _express_ application, "opts" is a set of options equivalent to the ones described above (typescript: interface IOptions from Options.ts):

    * dataPath: string
    * useLibCache: boolean
    * prefix: string
    * loadLibOnStartup: boolean
    * mpdHost: string
    * mpdPort: number

  For websocket:
  * **mipod.asWebSocket(socket, opts)** where "socket" is a Socket object from ''socket.io''. "opts" is the same than above.

## Commands

| Command | REST | Websocket | Description
|---|---|---|---|
| Play | GET /mipod/play | play | Enter "play" mode
| Play path | POST _{entry: String}_ /mipod/play | play-entry {entry: String} | Play given file (song or playlist), replacing the current playlist
| Play index | GET /mipod/playidx/:idx | play-idx {idx: Number} | Play song from playlist at given index
| Add | POST _{entry: String}_ /mipod/add | add {entry: String} | Add given file (song or playlist) to current playlist
| Clear | GET /mipod/clear | clear | Clear current playlist
| Pause | GET /mipod/pause | pause | Pause current song
| Stop | GET /mipod/stop | stop | Stop current song
| Next | GET /mipod/next | next | Next song in playlist
| Prev | GET /mipod/prev | prev | Previous song in playlist
| Volume | GET /mipod/volume/:value | volume {value: Number} | Set the volume (from 0 to 100)
| Repeat | GET /mipod/repeat/:enabled | repeat {enabled: Boolean} | Enable or disable repeat mode (expect 0/1)
| Random | GET /mipod/random/:enabled | random {enabled: Boolean} | Enable or disable random mode (expect 0/1)
| Single | GET /mipod/single/:enabled | single {enabled: Boolean} | Enable or disable single mode (expect 0/1)
| Consume | GET /mipod/consume/:enabled | consume {enabled: Boolean} | Enable or disable consume mode (expect 0/1)
| Seek | GET /mipod/seek/:songIdx/:posInSong | seek {songIdx: Number, posInSong: Number} | Seek song position
| Rem from queue | GET /mipod/rmqueue/:songIdx | rmqueue {songIdx: Number} | Remove song from its index in current playlist
| Del playlist | GET /mipod/deletelist/:name | deletelist {name: String} | Delete saved playlist
| Save playlist | GET /mipod/savelist/:name | savelist {name: String} | Save current playlist with given file name
| Play all | POST _{entries: [String]}_ /mipod/playall | playall {entries: [String]} | Play all songs / playlists from json (replaces current playlist)
| Add all | POST _{entries: [String]}_ /mipod/addall | addall {entries: [String]} | Add all songs / playlists from json to current playlist
| Update | POST _{path: String}_ /mipod/update | update {path: String} | Update MPD database on given path (empty path = whole db)
| Current | GET /mipod/current | current | Get current song info being played
| Custom | GET /mipod/custom/:command | custom {command: String} | Run a custom MPD command
| Load once | GET /mipod/lib-loadonce | lib-loadonce | Trigger library scan, which will put result in cache and available for "get" calls
| Reload | GET /mipod/lib-reload | lib-reload | Force rescanning the library (clears cache)
| Progress | GET /mipod/lib-progress | lib-progress | Get progress information on library loading. This call will returns a number in range [0, number of songs]
| Get | POST _{treeDesc: Maybe [String], leafDesc: Maybe [String]}_ /mipod/lib-get/:start/:count | lib-get {start: Number, count: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]} | Get a map of currently loaded songs, using paginating info provided<ul><li>Returned json is _{"status":(status code as String),"finished":(boolean, false if there's still items to pick up),"next":(number, the next item id to pick up),"data":(a map representing data as requested)}_</li><li>"start" is the start item id of requested page. Note that you should use the "next" returned number as subsequent "start" call</li><li>"count" is the number of items you try to get. Note that you may receive less than "count" items when MPD scanning is still ongoing or if you've reached the total number of items</li><li>"treeDesc" is the tree descriptor (see dedicated section below). If unset, _["genre","albumArtist&#124;artist","album"]_ will be used</li><li>"leafDesc" is the leaf descriptor (see dedicated section below). If unset, all available data will be returned (which may affect performance on large libraries)</li></ul>
| Push | n/a | lib-push {maxBatchSize: Number, treeDesc: Maybe [String], leafDesc: Maybe [String]} | Configure push mode (Websocket only), and receive pushed data (similar to "lib-get") as soon as "loadonce" or "reload" is emitted.
| Finished | n/a | lib-finished-loading | This websocket event is fired as soon as the library has completely finished to load (one-way event, server to client).
| Ls info | POST _{path: String, leafDesc: Maybe [String]}_ /mipod/lsinfo | lsinfo {token: Maybe Number, path: String, leafDesc: Maybe [String]} | An equivalent method of "lib-get" that returns only a flat reprensentation of a given path. If a token was provided, it's returned in response event (Websocket only).
| Search | POST _{search: String, leafDesc: Maybe [String]}_ /mipod/search/:mode | search {token: Maybe Number, mode: String, search: String, leafDesc: Maybe [String]} | Search for an MPD entry matching posted given string. "mode" can be any type od data recognized by MPD (check MPD documentation), for instance "file" or "any". If a token was provided, it's returned in response event (Websocket only).
| Tag | POST _{targets: [{targetType: String, target: String}]}_ /mipod/tag/:tagName/:tagValue? | tag {tagName: String, tagValue: String, targets: [{targetType: String, target: String}]} | Get (if tagValue undefined) or set (if tagValue defined) a custom tag associated to a given target. Expecting POST data: <ul><li>"targetType" refers to a MPD tag (song, artist, album etc.)</li><li>"target" depends on "targetType": for a song, will be the MPD path for instance</li></ul>On websockets, the context parameters are returned in the response event.

### Tree and leaf descriptors
Some commands sent to MPD will return a list of entries, which are basically directories, playlist files and song files with metadata. **Mipod has the ability to organize them the way you want**. You would like sometimes to get them as flat lists, or as trees organized by albums, artists, etc. That's what treeDesc and leafDesc are for.

A **tree descriptor** describes the successive levels of the tree. For instance if you want to get all songs organized by genre, then inside genres organized by artists, and finally by albums, you would write the following tree descriptor (the order matters!): ["genre","artist","album"]. A special character, "|", can be used as a "if exists / else" selector. If instead of "artist" you write "albumArtist|artist", it means that mipod will first search for the album artist of a song, then if it's not found it will search for the artist. You can have more than one pipe in a tree level.

A **leaf descriptor** describes the final level of the tree (that is, leaves). For instance, if your tree is just ["album"] and your leaf is ["artist","title","track","file"], then a map of albums will be returned, and for each album an array of objects, each containing artist, title, track and file information.

The available names are:
* file
* lastModified
* time
* artist
* albumArtist
* title
* album
* track
* date
* genre
* composer

## Examples

### REST
```javascript
    // Play (with jQuery)
    $.ajax({
        type: 'GET',
        url: '/mipod/play',
        cache: false,
        success: function(data) {},
    });

    // Play a file
    $.ajax({
        type: 'POST',
        url: '/mipod/play',
        data: JSON.stringify({entry: "some/music/file.mp3"}),
        contentType: "application/json; charset=utf-8",
        success: function(data) {},
    });

    // Load library
    $.get("/mipod/loadonce", function(data) {
        loadPage({
            start: 0,
            count: 1000
        });
    }, 'json');

    function loadPage(loadingInfo) {
        $.post('/mipod/get/' + loadingInfo.start + '/' + loadingInfo.count, {},
            function(pageInfo) {
                // Process data (add "pageInfo.data" to client layout)
                if (pageInfo.finished) {
                    // Finished..
                } else {
                    loadingInfo.start = pageInfo.next;
                    setTimeout(function() {
                        loadPage(loadingInfo);
                    }, 300);
                }
            }, 'json')
        .fail(function() {
            // Report failure...
            setTimeout(function() {
                loadPage(loadingInfo);
            }, 300);
        });
    }
```

### Websocket

## License
Copyright 2014 Joël Takvorian, [MIT License](https://github.com/jotak/mipod/blob/master/LICENSE)

## Contact
Feel free to [report issues on Github](https://github.com/jotak/mipod/issues) or contact me (contact information [available on npmjs](https://www.npmjs.org/~jotak))
