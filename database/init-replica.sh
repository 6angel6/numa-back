#!/bin/bash
set -e

# Wait until the primary is ready to accept connections
until pg_isready -h db -p 5432 -U "$DB_REPL_USER"; do
  echo "Waiting for primary database..."
  sleep 2
done

# Run base backup if:
#   1. Data directory is empty (first-ever start), OR
#   2. standby.signal is missing (PGDATA was initialised as a fresh standalone
#      PostgreSQL, not cloned from the primary — happens when pg_basebackup
#      failed on the first run and docker-entrypoint.sh filled the directory)
if [ ! -s "$PGDATA/PG_VERSION" ] || [ ! -f "$PGDATA/standby.signal" ]; then
    echo "Cloning data from primary (pg_basebackup)..."

    # Wipe any partial / standalone data that docker-entrypoint may have written
    rm -rf "$PGDATA"/*

    export PGPASSWORD=$DB_REPL_PASSWORD
    pg_basebackup -h db -p 5432 -U "$DB_REPL_USER" \
        -D "$PGDATA" -Fp -Xs -P -R

    # Fix permissions — pg_basebackup can write files owned by root
    chmod 700 "$PGDATA"

    echo "Base backup complete. Starting in standby mode."
else
    echo "Data directory already contains a valid replica. Starting PostgreSQL."
fi

exec docker-entrypoint.sh postgres
