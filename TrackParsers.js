var unzip      = require('unzip'),
    path       = require('path'),
    spawn      = require('child_process').spawn,
    sax        = require('sax'),
    url        = require('url'),
    http       = require('http'),
    Q          = require('q');

//var ITrackParser = {
//    isAcceptable: function(filename, type) {},
//    parse: function(data, filename, type) {
//        return Q.([{data: '', filename: '', type: ''}]);
//    }
//}

//Accepts only GPX tracks and stores them as GeoJSON objects.
var gpxCollector = {
    isAcceptable: function (filename, type) { return type === 'gpx' || path.extname(filename) === '.gpx'; },
    parse: function (data, filename, type) {
        var coords = [],
            trkCoords = [];

        var inTrk = false;

        var parseStream = sax.createStream(true);

        var def = Q.defer();

        parseStream
            .on('opentag', function(node) {
                var name = node.name.toLowerCase();

                if (name === 'trk') {
                    inTrk = true;
                    trkCoords = [];
                } else if (inTrk && name === 'trkpt') {
                     trkCoords.push([parseFloat(node.attributes.lon), parseFloat(node.attributes.lat)]);
                }
            }).on('closetag', function(name) {
                name = name.toLowerCase();
                if (name === 'trk') {
                    inTrk = false;
                    coords.push(trkCoords);
                }
            }).on('end', function() {
                var isMulti = coords.length > 1;
                def.resolve([{
                    filename: filename,
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: isMulti ? 'MultiLineString' : 'LineString',
                            coordinates: isMulti ? coords : coords[0]
                        }
                    },
                    type: 'geojson'
                }])
            })


        parseStream.write(data);
        parseStream.end();
        return def.promise;
    }
};

//Parses several track formats using gpsbabel. Type of track is detected using file extension.
//Output is tracks in GPX format  
var gpsbabelParser = {
    _supportedTypes: {
        '.plt': 'ozi',
        '.kml': 'kml'
    },
    isAcceptable: function (filename) { return path.extname(filename) in this._supportedTypes; },
    parse: function (data, filename, type) {
        console.log('gpsbabel parse', filename);
        var def = Q.defer();
        var babelType = this._supportedTypes[path.extname(filename)]; 
        var gpsbabel = spawn('gpsbabel', ('-i ' + babelType + ' -f - -o gpx -F -').split(' '));

        var gpxdata = '';
        
        gpsbabel.stdout.on('data', function (data) {
            gpxdata += data;
        });

        gpsbabel.on('error', function () {
            console.log('gpsbabel error!');
            def.resolve([]);
        });

        gpsbabel.stdout.on('end', function (code) {
            def.resolve({data: gpxdata, filename: filename, type: 'gpx'});
        });
        
        gpsbabel.stdin.write(data);
        gpsbabel.stdin.end();

        return def.promise;
    }
};

var zipParser = {
    isAcceptable: function (filename) { return path.extname(filename) === '.zip'; },
    parse: function (data, filename) {
        console.log('zip parse', filename);
        var def = Q.defer();
        var uncompressedFiles = [];
        var unzipParse = unzip.Parse();
        unzipParse
            .on('entry', function (entry) {
                var unzipFileName = entry.path; 
                console.log('zip entry: ' + unzipFileName);
                var uncompressed = new Buffer(0);
                entry.on('data', function (data) {
                    uncompressed = Buffer.concat([uncompressed, data]);
                });
                entry.on('end', function () {
                    console.log('zip entry done: ' + unzipFileName);
                    uncompressedFiles.push({filename: filename + '/' + unzipFileName, data: uncompressed});
                }).on('error', function () {
                    console.log('zip error!');
                });
            })
            .on('close', function () {
                console.log('zip done', filename);
                def.resolve(uncompressedFiles);
            });

        unzipParse.write(data);
        unzipParse.end();

        return def.promise;
    }
};

var httpDownloader = {
    isAcceptable: function (filename, type) { return type === 'url'; },
    parse: function (fileurl) {
        var def = Q.defer();
        http.get(fileurl, function (response) {
            var fileData = new Buffer(0);
            response.on('data', function (data) {
                fileData = Buffer.concat([fileData, data]);
            }).on('end', function () {
                def.resolve({filename: url.parse(fileurl).pathname, data: fileData});
            });
        });
        return def.promise;
    }
};

module.exports = {
    gpxCollector: gpxCollector, 
    gpsbabelParser: gpsbabelParser,
    zipParser: zipParser,
    httpDownloader: httpDownloader,     
    parsers: [gpxCollector, gpsbabelParser, zipParser, httpDownloader]
};
