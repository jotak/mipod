echo "Copying README.md"
cp -f README.md javascript/README.md
echo "Copying LICENSE"
cp -f LICENSE javascript/LICENSE
echo "Transpiling"
tsc mipod-ws.ts mipod-rest.ts --outDir javascript --module commonjs

