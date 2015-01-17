var Q = require('q'),
    sqlite = require('sqlite3').verbose(),
    uuid = require('node-uuid');

module.exports = function() {
    var db = new sqlite.Database('test.db');
    
    this.load = function(linkID) {
        var def = Q.defer();
        db.get('SELECT msg FROM links WHERE id = ?', linkID, function(err, row) {
            row ? def.resolve(row.msg) : def.reject();
        })
        return def.promise;
    };

    this.save = function(msg) {
        var def = Q.defer(),
            newGUID = uuid.v4().replace(/-/g, ''); 

        db.run('INSERT INTO links VALUES (?, ?)', newGUID, msg, function(err) {
           if (err) {
               def.reject(err);
           } else {
               def.resolve(newGUID);
           }
        });

        return def.promise;
    }
}
