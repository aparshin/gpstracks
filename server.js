var http       = require('http'),
    url        = require('url'),
    spawn      = require('child_process').spawn,
    fs         = require('fs'),
    DOMParser  = require('xmldom').DOMParser,
    path       = require('path'),
    $          = require('jquery'),
    unzip      = require('unzip'),
    formidable = require('formidable'),
    qs         = require('querystring');

var TaskManager = function() {
    var taskArr = [],
        taskHash = {};

    var genTaskID = function() {
        var res = '';
        for (var k = 0; k < 4; k++) {
            res += Math.floor(Math.random()*1000).toString();
        }
        return 't' + res;
    }

    var runningTaskID = null;
    var runNextTask = function() {
        if (runningTaskID || !taskArr.length) return;

        var curTask = taskArr.shift();
        curTask.state = 'running';
        runningTaskID = curTask.id;
        
        curTask.func().done(function(result) {
            curTask.result = result;
            curTask.state = 'done';
            runningTaskID = null;
            runNextTask();
        })
    }

    this.addTask = function(processTaskFunc) {
        var taskID = genTaskID();
        var newTask = {
            id: taskID,
            state: 'pending', //pending, running, done
            result: null,
            func: processTaskFunc
        }

        taskHash[taskID] = newTask;
        taskArr.push(newTask);
        runNextTask();

        return taskID;
    }

    this.getTaskState = function(taskID) {
        return taskID in taskHash ? taskHash[taskID].state : null;
    }

    this.getTaskResult = function(taskID) {
        return taskID in taskHash ? taskHash[taskID].result : null;
    }
}

//var ITrackParser = {
//    isAcceptable: function(filename, type) {},
//    parse: function(data, filename, type) {
//        return $.Deferred().resolve([{data: '', filename: '', type: ''}]);
//    }
//}

//Accepts only GPX tracks and stores them as GeoJSON objects.
//It doesn't produce any parse results. GeoJSON objects can be accessed using getGeoJSON() function
var gpxCollector = {
    _geoJSON: [],
    isAcceptable: function(filename, type) { return type === 'gpx' || path.extname(filename) === '.gpx'; },
    parse: function(data, filename, type) {
        var dom = new DOMParser().parseFromString(data);
        var pointElems = dom.documentElement.getElementsByTagName('trkpt');
        
        var coords = [];
        
        for (var iP = 0; iP < pointElems.length; iP++) {
            var p = pointElems[iP];
            coords.push([ parseFloat(p.getAttribute('lon')), parseFloat(p.getAttribute('lat')) ]);
        }
        
        this._geoJSON.push({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coords
            }
        });

        return $.Deferred().resolve([]);
    },

    getGeoJSON : function() { return this._geoJSON; }
};

//Parses several track formats using gpsbabel. Type of track is detected using file extension.
//Output is tracks in GPX format  
var gpsbabelParser = {
    _supportedTypes: {
        '.plt': 'ozi',
        '.kml': 'kml'
    },
    isAcceptable: function(filename) { return path.extname(filename) in this._supportedTypes; },
    parse: function(data, filename, type) {
        console.log('gpsbabel parse', filename);
        var babelType = this._supportedTypes[ path.extname(filename) ]; 
        var gpsbabel = spawn('gpsbabel', ('-i ' + babelType + ' -f - -o gpx -F -').split(' '));

        var gpxdata = '';
        
        gpsbabel.stdout.on('data', function (data) {
            gpxdata += data;
        });

        gpsbabel.on('error', function() {
            console.log('gpsbabel error!');
            def.resolve([]);
        })

        var def = $.Deferred();
        gpsbabel.stdout.on('end', function(code) {
            def.resolve({data: gpxdata, filename: filename, type: 'gpx'});
        });
        
        gpsbabel.stdin.write(data);
        gpsbabel.stdin.end();

        return def;
    }
}

var zipParser = {
    isAcceptable: function(filename) { return path.extname(filename) === '.zip'; },
    parse: function(data, filename) {
        console.log('zip parse', filename);
        var def = $.Deferred();
        var uncompressedFiles = [];
        var unzipParse = unzip.Parse();
        unzipParse
            .on('entry', function(entry) {
                var unzipFileName = entry.path; 
                //console.log('entry: ' + unzipFileName);
                var uncompressed = new Buffer(0);
                entry.on('data', function(data) {
                    uncompressed = Buffer.concat([uncompressed, data]);
                })
                entry.on('end', function() {
                    uncompressedFiles.push({filename: filename + '/' + unzipFileName, data: uncompressed});
                }).on('error', function() {
                    console.log('zip error!');
                })
            })
            .on('end', function() {
                def.resolve(uncompressedFiles);
            })

        unzipParse.write(data);
        unzipParse.end();

        return def;
    }
}

var httpDownloader = {
    isAcceptable: function(filename, type) { return type === 'url'; },
    parse: function(fileurl) {
        var def = $.Deferred();
        http.get(fileurl, function(response) {
            var fileData = new Buffer(0);
            response.on('data', function(data) {
                fileData = Buffer.concat([fileData, data]);
            }).on('end', function() {
                //trackParser.addTrack(url.parse(urlData).pathname, fileData);
                def.resolve({filename: url.parse(fileurl).pathname, data: fileData});
            })
        })
        return def;
    }
}


var TrackParserManager = function() {
    var parsers = [gpxCollector, gpsbabelParser, zipParser, httpDownloader];
    var files = [];
    var def = $.Deferred();

    var _process = function() {
        var _this = this;
        if (!files.length) {
            def.resolve(gpxCollector.getGeoJSON());
            //response.end(JSON.stringify(gpxCollector.getGeoJSON()));
            return;
        };

        var curFile = files.shift();

        //console.log('processFiles', curFile.filename);
        
        for (var p = 0; p < parsers.length; p++) {
            if (parsers[p].isAcceptable(curFile.filename, curFile.type)) {
                parsers[p].parse(curFile.data, curFile.filename, curFile.type).done(function(newFiles) {
                    files = files.concat(newFiles);
                    setTimeout(_process, 0);
                })
                return;
            }
        }
        setTimeout(_process, 0); //none of parsers accepts current file - move to the next one
    }

    this.addTrack = function(filename, data, type) {
        files.push({filename: filename, data: data, type: type});
    }

    this.process = function() {
        _process();
        return def;
    }

}

var taskManager = new TaskManager();

http.createServer(function (request, response) {
    var parsedURL = url.parse(request.url, true);
    if (parsedURL.pathname === '/uploadgps')
    {
        if (request.method.toUpperCase() === "OPTIONS"){
 
            response.writeHead(
                "204",
                "No Content",
                {
                    "Access-control-allow-origin": '*',
                    "Access-control-allow-methods": "PUT, OPTIONS",
                    "Access-control-allow-headers": "content-type, accept, X-File-Name, X-File-Size, X-File-Type",
                    "Access-control-max-age": 10, // Seconds.
                    "Content-length": 0
                }
            );
 
            response.end();
            return;
        }
        
        response.writeHead(200, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
        });

        var trackParser = new TrackParserManager();
        var form = new formidable.IncomingForm();
        form.onPart = function(part) {
            if (part.name === 'file') {
                var fileData = new Buffer(0);
                part.on('data', function(data) {
                    fileData = Buffer.concat([fileData, data]);
                }).on('end', function() {
                    trackParser.addTrack(part.filename, fileData);
                })
            } 
            else if (part.name === 'url') {
                var urlData = '';
                part.on('data', function(data) {
                    urlData += data;
                }).on('end', function() {
                    trackParser.addTrack('', urlData, 'url');
                })
            }
        }

        form.parse(request, function() {
            var taskID = taskManager.addTask(trackParser.process);
            response.end(taskID);
        });
    } 
    else if (parsedURL.pathname === '/checktask') {
        response.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        var taskID = parsedURL.query.taskid;
        var callback = parsedURL.query.callback;
        var res = {state: taskManager.getTaskState(taskID)};
        if (res.state === 'done' ) {
            res.result = taskManager.getTaskResult(taskID);
        }
        response.end( callback + '(' + JSON.stringify(res) + ')' );
    }
}).listen(1337);
