find ./build/src -name "*.js.map" -exec bash -c 'mv "$1" "${1%.js.map}".mjs.map' - '{}' \;
find ./build/src -name "*.js" -exec bash -c 'mv "$1" "${1%.js}".mjs' - '{}' \;
