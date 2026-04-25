GXX = g++
SRC = main.cpp
OUT = main
EIGEN = /usr/include/eigen3

all: clean wasm

wasm: wasm.cpp
	emcc wasm.cpp \
	-I$(EIGEN) \
	-lembind \
	-s WASM=1 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MODULARIZE=1 \
	-s EXPORT_ES6=1 \
	-s EXPORT_NAME='createGeolib' \
	-s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
	-s DISABLE_EXCEPTION_CATCHING=0 \
	-s ASSERTIONS=2 \
	-s SAFE_HEAP=1 \
	-s STACK_OVERFLOW_CHECK=2 \
	-g \
	-o geolib.js

test: test.cpp
	$(GXX) test.cpp -o test -I$(EIGEN)
	./test

clean: test geolib.wasm geolib.js
	rm ./test ./geolib.wasm ./geolib.js