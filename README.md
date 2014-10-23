mipod
======

A nodejs module for exposing an MPD REST API. Written in Typescript, javascript is ready to use.
It can be used either as a nodejs dependency module or as a stand-alone server.

mipod provides basic MPD commands exposed as REST resources, such as *'GET /mpd/play'*.
It also provides more advanced library management, still through REST resources. You can control playback, save and load playlists, browse the musics files folder by folder or get all in a go. There are also some non-MPD features such as songs rating.


## Usage

1. Stand-alone
As a stand-alone server, you only need the javascript files under directory '''generated'''. Copy them to the place you want, and run mipod-rest.js with node:
  * *node mipod-rest.js*
That's all you need to start the server with default parameters. It will listen to requests on port 80 and connects to a MPD server on localhost:6600. Try out http://localhost/mpd/play or http://localhost/mpd/pause, if you have an MPD server running, you should hear immediate results.

Configurable options are:
  * -p=X, --port=X : setup server port (default 80)
  * 

WIP...
