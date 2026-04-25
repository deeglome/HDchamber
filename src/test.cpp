#include "geolib.cpp"

int main(){
    Hypercube hc(2, 1.0);
    int j=0;
    for( int i : hc.getBufferEdgeIndices() ){
        cout << i << (!(j%2) ? "-" : " ");
        j++;
    }
    return 0;
}