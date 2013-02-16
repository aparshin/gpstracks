var tp = require('./TrackParsers.js'),
    Q = require('q');

module.exports = function() {
    var parsers = tp.parsers;

    var files = [];
    var def = Q.defer();

    var _process = function() {
        var _this = this;
        if (!files.length) {
            def.resolve(tp.gpxCollector.getGeoJSON());
            tp.gpxCollector.clean();
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
        return def.promise;
    }

}
