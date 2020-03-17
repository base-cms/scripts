# INDM Multi-site merge utility

Provides tooling around the automated data merge for INDM sites into a single database.

## Usage

1. Start up the local mongodb server
```
dc up mongodb &
```
2. Export/download the production data
```
./download.sh
```
3. Process the data using the tool
```
./index.js all
./index.js ien
./index.js cen
./index.js ddt
```
4. Export/upload the new production data
```
./upload.sh
```
