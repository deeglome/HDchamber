GXX = g++
SRC = main.cpp
OUT = main
EIGEN = /usr/include/eigen3

all:
	$(GXX) $(SRC) -o $(OUT) -I$(EIGEN)
	./$(OUT)

test: test.cpp
	$(GXX) test.cpp -o test -I$(EIGEN)
	./test