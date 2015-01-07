var tp = require('./TrackParsers.js'),
    Q = require('q');

module.exports = function () {
    var parsers = tp.parsers;

    var files = [];
    var def = Q.defer();

    var tracks = [];

    var _process = function () {
        var _this = this;
        if (!files.length) {
            //def.resolve(tp.gpxCollector.getTracks());
            //tp.gpxCollector.clean();
            //response.end(JSON.stringify(gpxCollector.getGeoJSON()));
            def.resolve(tracks);
            return;
        }

        var curFile = files.shift();

        if (curFile.type === 'geojson') {
            console.log('+++++++geoJSON', curFile.filename);
            tracks.push({filename: curFile.filename, geoJSON: curFile.data});
            setTimeout(_process, 0); 
            return;
        }

        console.log('processFiles', curFile.filename);

        var processNewFiles = function (newFiles) {
            console.log('ParserManager: new files', newFiles.length);
            files = files.concat(newFiles);
            setTimeout(_process, 0);
        }; 
        
        for (var p = 0; p < parsers.length; p++) {
            if (parsers[p].isAcceptable(curFile.filename, curFile.type)) {
                parsers[p].parse(curFile.data, curFile.filename, curFile.type).done(processNewFiles);
                return;
            }
        }
        //TODO: add error logging
        setTimeout(_process, 0); //none of parsers accepts current file - move to the next one
    };

    this.addTrack = function (filename, data, type) {
        files.push({filename: filename, data: data, type: type});
    };

    this.process = function () {
        _process();
        return def.promise;
    };
};
