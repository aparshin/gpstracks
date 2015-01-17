DROP TABLE IF EXISTS source;
CREATE TABLE source (
    id INTEGER PRIMARY KEY,
    md5 TEXT,
    type TEXT,
    name TEXT
);

CREATE INDEX nameIdx ON source (name);
CREATE UNIQUE INDEX md5Idx ON source (md5);

DROP TABLE IF EXISTS track;
CREATE TABLE track (
    id INTEGER PRIMARY KEY,
    geojson TEXT,
    name TEXT,
    source INTEGER,
    FOREIGN KEY(source) REFERENCES source(id)
);

CREATE INDEX sourceIdx ON track (source);

DROP TABLE IF EXISTS links;
CREATE TABLE links (
    id TEXT PRIMARY KEY,
    msg TEXT
);
