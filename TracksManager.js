var Q = require('q'),
    sqlite = require('sqlite3').verbose(),
    _ = require('underscore'),
    crypto = require('crypto'),
    http = require('http'),
    TrackParserManager = require('./TrackParserManager.js');

module.exports = function () {
    var db = new sqlite.Database('test.db');

    var getTracks = function (sourceId) {
        var def = Q.defer();
        db.all('SELECT * FROM track WHERE source = ?', sourceId, function (err, rows) {
            _.each(rows, function (row) {
                row.geojson = JSON.parse(row.geojson);
            });
            def.resolve(rows);
        });
        return def.promise;
    };

    this.getFromURL = function (url) {
        var _this = this;
        var defer = Q.defer();
        db.get('SELECT * FROM source WHERE name = ? and type = ?', url, 'http', function (err, row) {
            if (row) {
                defer.resolve(getTracks(row.id));
            } else {
                console.log('Downloading ' + url + '...');
                http.get(url, function (response) {
                    var fileData = new Buffer(0);
                    response.on('data', function (data) {
                        fileData = Buffer.concat([fileData, data]);
                    }).on('end', function () {
                        defer.resolve(_this.getFromSource({filename: url, type: 'http', data: fileData}));
                    });
                });
            }
        });
        return defer.promise;
    };

    this.getFromSource = function (source) {
        var defer = Q.defer();
        
        if (source.id) {
            defer.resolve(getTracks(source.id));
        } else {
            source.md5 = source.md5 || crypto.createHash('md5').update(source.data).digest('hex');
            source.type = source.type || 'user';
            console.log('md5', source.md5);

            //check md5 first
            db.get('SELECT * FROM source WHERE md5 = ?', source.md5, function (err, sourceInfo) {
                if (sourceInfo) {
                    console.log(sourceInfo);
                    defer.resolve(getTracks(sourceInfo.id));
                } else {
                    var parser = new TrackParserManager();
                    parser.addTrack(source.filename, source.data, source.type);
                    parser.process().then(function (tracks) {
                        console.log('insert source', source.filename);
                        db.run('INSERT INTO source VALUES (null, ?, ?, ?)', 
                            source.md5, source.type, source.filename, 
                            function (err) {
                                var sourceId = this.lastID;
                                console.log('source id = ', sourceId);
                                var promises = [];
                                _.each(tracks, function (track) {
                                    var def = Q.defer();
                                    promises.push(def.promise);
                                    console.log('insert track', source.filename, track.filename);
                                    db.run('INSERT INTO track VALUES (null, ?, ?, ?)', 
                                        JSON.stringify(track.geoJSON), 
                                        track.filename,
                                        sourceId,
                                        function (err) {
                                            console.log('track is inserted! ', err);
                                            def.resolve();
                                        }
                                    );
                                });
                                Q.all(promises).then(function () {
                                    defer.resolve(getTracks(sourceId));
                                });
                            }
                        );
                    });
                }
            });
        }
        return defer.promise;
    };

    this.getTrackByIDs = function(ids) {
        var def = Q.defer();

        var sql = 'SELECT * FROM track WHERE id in (' + ids.join() + ')';
        db.all(sql, function(err, rows) {
            rows.forEach(function (row) {
                row.geojson = JSON.parse(row.geojson);
            });
            def.resolve(rows);
        });

        return def.promise;
    };
};
