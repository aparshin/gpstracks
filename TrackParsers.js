var unzip      = require('unzip'),
    path       = require('path'),
    spawn      = require('child_process').spawn,
    DOMParser  = require('xmldom').DOMParser,
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

        return Q.resolve([]);
    },

    getGeoJSON : function() { return this._geoJSON; },
    clean: function() { this._geoJSON = []; }
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
        var def = Q.defer();
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

        gpsbabel.stdout.on('end', function(code) {
            def.resolve({data: gpxdata, filename: filename, type: 'gpx'});
        });
        
        gpsbabel.stdin.write(data);
        gpsbabel.stdin.end();

        return def.promise;
    }
}

var zipParser = {
    isAcceptable: function(filename) { return path.extname(filename) === '.zip'; },
    parse: function(data, filename) {
        console.log('zip parse', filename);
        var def = Q.defer();
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

        return def.promise;
    }
}

var httpDownloader = {
    isAcceptable: function(filename, type) { return type === 'url'; },
    parse: function(fileurl) {
        var def = Q.defer();
        http.get(fileurl, function(response) {
            var fileData = new Buffer(0);
            response.on('data', function(data) {
                fileData = Buffer.concat([fileData, data]);
            }).on('end', function() {
                //trackParser.addTrack(url.parse(urlData).pathname, fileData);
                def.resolve({filename: url.parse(fileurl).pathname, data: fileData});
            })
        })
        return def.promise;
    }
}

module.exports = {
    gpxCollector: gpxCollector, 
    gpsbabelParser: gpsbabelParser,
    zipParser: zipParser,
    httpDownloader: httpDownloader,     
    parsers: [gpxCollector, gpsbabelParser, zipParser, httpDownloader]
}
