# PostgreSQL setup

See [V2_SETUP.md](V2_SETUP.md) for the current Development configuration, persistence model, migration boundaries and restart checks. V2 no longer uses the legacy write-only `persistence.js` module. Legacy tables remain untouched; live state and results use account-owned V2 tables.
