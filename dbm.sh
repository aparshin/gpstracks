#!/bin/sh -fu

if [ "$1" = "new" ]; then
    [ -f test.db ] || rm test.db
    sqlite3 test.db < sqlitecreate.sql
fi
