#include <iostream>
#include <iomanip>
#include <Eigen/Dense>
#include <thread>
#include <cmath>

using namespace std;
using namespace Eigen;

#define MAX_N 6
#define EPS 1e-6
#define CAM_DIST 3

const string AXIS_IDS = "xyzwvu";

typedef VectorXf PointND;

PointND origin(int n) {
    if(n > MAX_N) throw out_of_range("'n' is out of range.");
    PointND p = PointND::Zero(n);
    return p;
}

PointND projectPoint(const PointND p, int n) {
    if (p.size() < n) throw invalid_argument("'p' has fewer coordinates than required, it can't be projected.");
    if (p.size() == n) return p;
    return p.head(n);
}

PointND projectPoint(const PointND p, int n, float cam_dist) {
    if (p.size() < n) throw invalid_argument("'p' has fewer coordinates than required, it can't be projected.");
    if (p.size() == n) return p;
   
    float last = p(p.size() - 1);
    float fact = 1 / (cam_dist + last);

    PointND proj(n);
    for (int i = 0; i < n; ++i) {
        proj(i) = p(i) * fact;
    }
    return proj;
}

PointND extendPoint(PointND p, int n) {
    if (n < p.size()) throw new invalid_argument("Cannot extend a Point in fewer dimensions. Try to project it.");
    if (n == p.size()) throw invalid_argument("'p' has the same dimensions than required. It's unnecessary to be extended.");
    PointND q = PointND::Zero(n);
    q.head(p.size()) = p;
    return q;
}

float distance(PointND p, PointND q) {
    if (p.size() != q.size()) throw invalid_argument("Points must have the same number of dimensions.");
    return (p-q).norm();
}

void print_point(const PointND p, string label = "", int digs = 2) {
    if (label.empty()) {
        label = "Point" + to_string(p.size()) + "D";
    }

    cout << fixed << setprecision(digs);
    cout << label << ": " << p.transpose() << endl;
}

PointND barFromPoints(vector<PointND>& points){
    int k = points[0].size();
    for(auto& p : points){
        if(p.size()!=k) throw invalid_argument("Every point must have the same number of dimensions.");
    }
    PointND g = PointND::Zero(k);
    for(auto& p : points) g += p;
    int n = points.size();
    return g / (float)n;
}

int rotationScope(vector<string> planes){
    int r = 0;

    for(int i=0; i<planes.size(); i++){
        if (planes[i].length() != 2)
            throw invalid_argument("Invalid length of a plane.");
        if (planes[i][0] == planes[i][1])
            throw invalid_argument("Indexes can't be equal.");
        
        int weight1 = ((int)AXIS_IDS.find(planes[i][0]));
        int weight2 = ((int)AXIS_IDS.find(planes[i][1]));

        if(weight1 > r) r = weight1;
        if(weight2 > r) r = weight2;
    }
    return r ? r+1 : 0;
}

MatrixXf createRotationMatrix(int n, vector<string> planes, vector<float> angles){
    if(planes.size()!=angles.size()) throw invalid_argument("Number of planes and angles must be the same.");
    
    MatrixXf R = MatrixXf::Identity(n, n);
    
    for(int k=0; k<planes.size(); k++){
        MatrixXf partialR = MatrixXf::Identity(n,n);

        if((int)AXIS_IDS.find(planes[k][0]) >= n || (int)AXIS_IDS.find(planes[k][1]) >= n){
            int idx = ((int)AXIS_IDS.find(planes[k][0]) > k-1) ? 0 : 1;
            throw invalid_argument("Cannot operate with dimension '"+string(1, planes[k][idx])+"' in "+to_string(n)+" dimensions.");
        }

        int i = (int)AXIS_IDS.find(planes[k][0]);
        int j = (int)AXIS_IDS.find(planes[k][1]);
        float cos_a = abs(cos(angles[k])) < EPS ? 0 : cos(angles[k]);
        float sin_a = abs(sin(angles[k])) < EPS ? 0 : sin(angles[k]);

        partialR(i,i) = cos_a;
        partialR(i,j) = -sin_a;
        partialR(j,i) = sin_a;
        partialR(j,j) = cos_a;

        R = partialR * R;
    }
    return R;
}

class SegmentND {
    public:
        PointND start;
        PointND end;
        int n;

        SegmentND(PointND _start, PointND _end) {
            if (_start.size() != _end.size())
                throw invalid_argument("Start and End sizes must be equal.");
            if (_start == _end)
                throw invalid_argument("Start and End can't be the same.");
            start = _start;
            end = _end;
            n = start.size();
        }

        float length() {
            return distance(start, end);
        }

        PointND midpoint() {
            return (start + end) / 2.0f;
        }

        void extendIn(int n){
            this->start = extendPoint(this->start, n);
            this->end = extendPoint(this->end, n);
            this->n = n;
        }

        /* void print() {
            int dim = start.size();
            cout << "Segment" << dim << "D: " << endl;
            setw(10); print_point(start);
            setw(10); print_point(end);
        } */

        void transform(const MatrixXf& mat) {
            start = mat * start;
            end = mat * end;
        }

        void translate(const PointND& t){
            start += t;
            end += t;
        }

        void scale(const PointND& s){
            if(s.size() != n) throw invalid_argument("Scale vector must have the same number of dimensions as the segment.");
            start = start.cwiseProduct(s);
            end = end.cwiseProduct(s);
        }

        bool coincident(const SegmentND s){
            return this->start.isApprox(s.start) && this->end.isApprox(s.end) || this->start.isApprox(s.end) && this->end.isApprox(s.start);
        }

        bool operator==(SegmentND s) {
            return this->length()==s.length();
        }

        bool operator!=(SegmentND s) {
            return !(*this == s);
        }

        void project(int n)
        {
            start = projectPoint(start, n);
            end = projectPoint(end, n);
            this->n = n;
        }
        void project(int n, float cam_dist)
        {
            start = projectPoint(start, n, cam_dist);
            end = projectPoint(end, n, cam_dist);
            this->n = n;
        }
};

class FaceND {
    public:
        vector<PointND> verts;
        vector<SegmentND> edges;
        int n;

        // L'insieme di segmenti che deve formare una figura piana chiusa. E' importante l'ordine dei segmenti nel vettore.
        // Per dimensioni superiori alla seconda, tutti i vertici devono appartenere allo stesso piano.
        // Tuttavia, queste condizioni sono bypassate negli algoritmi di generazioni delle geometrie e pertanto non sono necessarie.
        FaceND(vector<SegmentND> _edges) : edges(_edges){
            int temp_n = _edges[0].n;
            for(SegmentND& e : _edges) if(e.n != temp_n) invalid_argument("There are different edge sizes in the same face. They must be equal.");
            verts = vertsFromLoop(_edges);
            n = temp_n;
        }

        // Dato un insieme di vertici i segmenti vengono costruiti nell'ordine in cui si trovano nel vettore.
        FaceND(vector<PointND> _verts) : FaceND(loopFromVerts(_verts)) {}

        // Calcola il baricentro della faccia.
        PointND bar(){
            return barFromPoints(this->verts);
        }

        void transform(const MatrixXf& mat){
            for(SegmentND& s : this->edges) s.transform(mat);
            for(PointND& p : this->verts) p = mat * p;
        }

        void translate(const PointND& t){
            for(SegmentND& s : this->edges) s.translate(t);
            for(PointND& p : this->verts) p += t;
        }

        void scale(const PointND& s){
            if(s.size() != n) throw invalid_argument("Scale vector must have the same number of dimensions as the face.");
            for(SegmentND& seg : this->edges) seg.scale(s);
            for(PointND& p : this->verts) p = p.cwiseProduct(s);
        }

        // Restituisce un vettore dei singoli prodotti scalari tra edges consecutivi.
        vector<float> scalars(){
            vector<float> v;
            for(int i=0; i<this->edges.size(); i++){
                PointND dir_i = this->edges[i].end - this->edges[i].start;
                PointND dir_ii = this->edges[(i+1) % edges.size()].end - this->edges[(i+1) % edges.size()].start;
                v.push_back(dir_i.dot(dir_ii));
            }
            return v;
        }

        // Due facce si dicono coincidenti se rispettivamente ogni edge è coincidente.
        bool coincident(FaceND f){
            // CN: le facce devono avere = num di edges
            if(this->edges.size() != f.edges.size()) return false;
            bool found;
            for(int i=0; i<this->edges.size(); i++){
                found=false;
                for(int j=0; j<f.edges.size() && !found; j++){
                    if(this->edges[i].coincident(f.edges[j])) found=true;
                }
                if(!found) return false;
            }
            return true;
        }

        void extendIn(int n){
            for(SegmentND& s : edges) s.extendIn(n);
            for(PointND& v : verts) v = extendPoint(v, n);
            this->n = n;
        }

        void project(int n){
            for (SegmentND &s : edges) s.project(n);
            for (PointND &v : verts) v = projectPoint(v, n);
            this->n = n;
        }

        void project(int n, float cam_dist){
            for (PointND &v : verts) v = projectPoint(v, n, cam_dist);
            for (SegmentND &s : edges) s.project(n, cam_dist);
            this->n = n;
        }

        // Una faccia è uguale/congruente ad un'altra faccia 'f' se essa è sovrapponibile mediante isometrie, trasformazioni che conservano distanze e angoli.
        // CN: le facce devono avere = num di edges.
        bool operator==(FaceND f){
            if(this->edges.size() != f.edges.size()) return false;
            if(this->coincident(f)) return true;
            bool len_found, ang_found;
            vector<float> s1 = this->scalars();
            vector<float> s2 = f.scalars();
            for(int i=0; i<this->edges.size(); i++){
                len_found=ang_found=false;
                for(int j=0; j<f.edges.size() && !len_found; j++){
                    if(this->edges[i]==f.edges[j]) len_found=true;
                }
                for(int j=0; j<s2.size() && !ang_found; j++){
                    if(s1[i]==s2[j]) ang_found=true;
                }
                if(!len_found || !ang_found) return false;
            }
            return true;
        }

        bool operator!=(FaceND f){
            return !(*this==f);
        }

    private:
        vector<SegmentND> loopFromVerts(vector<PointND> verts){
            vector<SegmentND> edges;
            int i;
            for(i=1; i<verts.size(); i++){
                edges.push_back(SegmentND(verts[i-1], verts[i]));
            }
            edges.push_back(SegmentND(verts[i-1], verts[0]));
            return edges;
        }

        vector<PointND> vertsFromLoop(vector<SegmentND> loop){
            vector<PointND> verts;
            for(int i=0; i<loop.size(); i++) verts.push_back(loop[i].start);
            return verts;
        }
};

void combine(const vector<PointND>& array, size_t comboSize, size_t start, vector<PointND>& combo, vector<vector<PointND>>& result) {
    if(combo.size() == comboSize) {
        result.push_back(combo);
        return;
    }
    for(size_t i = start; i < array.size(); i++) {
        combo.push_back(array[i]);
        combine(array, comboSize, i + 1, combo, result);
        combo.pop_back();
    }
}

vector<vector<PointND>> combinations(const vector<PointND>& array, size_t comboSize) {
    vector<vector<PointND>> result;
    vector<PointND> combo;
    combine(array, comboSize, 0, combo, result);
    return result;
}

class GeometryND {
    public:
        vector<PointND> verts;
        vector<SegmentND> edges;
        vector<int> edgeIndices;
        vector<FaceND> faces;
        int n;

        GeometryND(int _n, vector<FaceND> _faces) {
            for(FaceND f : _faces) if(f.n != _n) invalid_argument("Face sizes must be equal.");
            verts = vertsFromFaces(_faces);
            edges = edgesFromFaces(_faces);
            n = _n;
        }

        GeometryND(int _n, vector<PointND> _verts={}, vector<SegmentND> _edges={}, vector<FaceND> _faces={}){
            n = _n;
            verts = _verts;
            edges = _edges;
            faces = _faces;
        }

        PointND bar() {
            return barFromPoints(this->verts);
        }

        virtual GeometryND* clone(){
            return new GeometryND(*this);
        }

        void transform(const MatrixXf& mat) {
            for(FaceND& f : this->faces) f.transform(mat);
            for(SegmentND& s : this->edges) s.transform(mat);
            for(PointND& p : this->verts) p = mat * p;
        }

        void translate(const PointND& t){
            for(FaceND& f : this->faces) f.translate(t);
            for(SegmentND& s : this->edges) s.translate(t);
            for(PointND& p : this->verts) p += t;
        }

        void scale(const PointND& s){
            for(FaceND& f : this->faces) f.scale(s);
            for(SegmentND& seg : this->edges) seg.scale(s);
            for(PointND& p : this->verts) p = p.cwiseProduct(s);
        }

        void extendIn(int n){
            for(FaceND& f : faces) f.extendIn(n);
            for(SegmentND& s : edges) s.extendIn(n);
            for(PointND& v : verts) v = extendPoint(v, n);
            this->n = n;
        }

        void project(int n){
            for(FaceND& f : this->faces) f.project(n);
            for(SegmentND& s : this->edges) s.project(n);
            for(PointND& v : this->verts) v = projectPoint(v, n);
            this->n = n;
        }

        void project(int n, float cam_dist){
            for(FaceND& f : this->faces) f.project(n, cam_dist);
            for(SegmentND& s : this->edges) s.project(n, cam_dist);
            for(PointND& v : this->verts) v = projectPoint(v, n, cam_dist);
            this->n = n;
        }

        vector<float> getBufferVerts(){
            vector<float> result = {};
            for(int j=0; j<this->verts.size(); j++){
                for(int k=0; k<this->n; k++){
                    result.push_back(verts[j](k));
                }
            }
            return result;
        }

        virtual vector<int> getBufferEdgeIndices(){
            vector<int> result = {};
            return result;
        }

    private:
        vector<PointND> vertsFromFaces(vector<FaceND> _faces){
            vector<PointND> res;
            for(FaceND f : _faces){
                for(SegmentND s : f.edges){
                    res.push_back(s.start);
                    res.push_back(s.end);
                }
            }
            return res;
        }

        vector<SegmentND> edgesFromFaces(vector<FaceND> _faces){
            vector<SegmentND> res;
            for(FaceND f : _faces){
                for(SegmentND s : f.edges){
                    res.push_back(s);
                }
            }
            return res;
        }
};

class Hypercube : public GeometryND {
    public:
        Hypercube(int n, float edge_len) : GeometryND(
            n,
            hypercubeVerts(n, edge_len),
            hypercubeEdges(n, hypercubeVerts(n, edge_len)),
            hypercubeFaces(n, hypercubeVerts(n, edge_len))
        ) {}

        Hypercube* clone() override {
            return new Hypercube(*this);
        }

        vector<int> getBufferEdgeIndices() override {
            vector<int> indices = {};
            vector<int> vertsUsed;
            for(int i=0; i<n; i++){
                vertsUsed = {};
                for(int j=0; j<verts.size(); j++){
                    if(found(j, vertsUsed)) continue;
                    indices.push_back(j);
                    indices.push_back(j + pow(2, i));
                    vertsUsed.push_back(j);
                    vertsUsed.push_back(j + pow(2, i));
                }
            }
            return indices;
        }
    
    private:

        bool found(int el, vector<int> arr){
            for(int i=0; i<arr.size(); i++){
                if(arr[i] == el) return true;
            }
            return false;
        }

        vector<PointND> hypercubeVerts(int n, float edge_len){
            /** Si assuma i scritto in binario e l'ipercubo centrato nell'origine.
             * Ogni vertice in forma cartesiana è una permutazione con ripetizione di +edge_len/2 e -edge_len/2.
             * Pertanto, un vertice è esprimibile con un numero binario poiché anche quest'ultimo è una permutazione con ripetizione (di 0 e 1).
             * Tramite j si "naviga" i per mezzo di una mask e si effettua la seguente traduzione:
             * - 0 --> -edge_len/2
             * - 1 --> +edge_len/2
             */ 
            vector<PointND> verts = {};
            for(int i=0; i<1<<n; i++){
                PointND v(n);
                for(int j=0; j<n; j++){
                    int msk = 1 << j;
                    v(j) = (i & msk) ? edge_len/2 : -edge_len/2;
                }
                verts.push_back(v);
            }
            return verts;
        }

        vector<SegmentND> hypercubeEdges(int n, vector<PointND> verts){
            vector<SegmentND> edges;
            bool found;
            for(int i=0; i<n; i++){
                for(int j=0; j+(1<<i)<verts.size(); j++){
                    found = false;
                    SegmentND new_edge(verts[j], verts[j+(1<<i)]);
                    for(SegmentND s : edges){
                        if(s.coincident(new_edge)){
                            found = true;
                            break;
                        }
                    }
                    if(!found) edges.push_back(new_edge);
                }
            }
            return edges;
        }

        vector<FaceND> hypercubeFaces(int n, vector<PointND> verts){
            vector<FaceND> faces;

            for(int i=0; i<n-1; i++){
                for(int j=i+1; j<n; j++){
                    for(int k=0; k<verts.size(); k++){
                        if( !(k & (1<<i)) && !(k & (1<<j)) ){
                            vector<PointND> quartet = {
                                verts[k],
                                verts[k + (1<<i)],
                                verts[k + (1<<j)],
                                verts[k + (1<<i) + (1<<j)]
                            };

                            FaceND f_new = FaceND(quartet);
                            bool found = false;

                            for(FaceND& f : faces){
                                if(f.coincident(f_new)){
                                    found = true;
                                    break;
                                }
                            }
                            if(!found) faces.push_back(f_new);
                        }
                    }
                }
            }
            return faces;
        }

        /* vector<FaceND> hypercubeFaces(int n, vector<PointND> verts){
            if(n==2) return {verts};
            vector<FaceND> faces;
            const vector<vector<PointND>> QRTS = combinations(verts, 4);

            for(vector<PointND> qrt : QRTS){
                if(validSquare(qrt)){
                    vector<SegmentND> edges = hypercubeEdges(2, qrt);
                    faces.push_back(FaceND(qrt));
                }
            }
            return faces;
        }

        bool validSquare(vector<PointND> qrt){
            int shared_idxs = 0;
            int n = qrt[0].size();
            bool all_shared;

            for(int i=0; i<n; i++){
                all_shared = true;
                for(int j=0; j<qrt.size()-1 && all_shared; j++){
                    if(qrt[j](i)!=qrt[j+1](i)) all_shared = false;
                }
                if(all_shared) shared_idxs++;
            }
            return shared_idxs==n-2;
        }
        */
};

class Simplex : public GeometryND{
    public:
        Simplex(int n, float edge_len) : GeometryND(
            n,
            simplexVerts(n, edge_len),
            simplexEdges(n, simplexVerts(n, edge_len)),
            simplexFaces(simplexVerts(n, edge_len))
        ) {}

        Simplex* clone() override {
            return new Simplex(*this);
        }

        vector<int> getBufferEdgeIndices() override {
            vector<int> indices;
            int k = this->verts.size();
            for(int i=0; i<k-1; i++){
                for(int j=i+1; j<k; j++){
                    indices.push_back(i);
                    indices.push_back(j);
                }
            }
            return indices;
        }

    private:
        vector<PointND> simplexVerts(int n, float edge_len) {
            PointND start = PointND::Zero(n);
            PointND end = PointND::Zero(n);
            start(0) = -.5 * edge_len;
            end(0) = .5 * edge_len;
            vector<PointND> simplex = {start, end};
            
            for(int i=2; i<=n; i++){
                PointND bar = barFromPoints(simplex);
                PointND next = PointND::Zero(n);

                for(int k=0; k<i-1; k++){
                    next(k) = bar(k);
                }
                
                float dist_v0_bar = distance(start, bar);
                next(i-1) = sqrt(edge_len * edge_len - dist_v0_bar * dist_v0_bar);
                simplex.push_back(next);
                bar = barFromPoints(simplex);
                
                for(PointND& v : simplex){
                    v -= bar;
                }
            }
            return simplex;
        }

        vector<SegmentND> simplexEdges(int dimensions, const vector<PointND> &vertices) {
            vector<SegmentND> edges;
            vector<int> verticesUsed;

            for (int i=0; i < dimensions; i++) {
                for (int j = 0; j < (int)vertices.size(); j++) {
                    if (i == j) continue;
                    if (find(verticesUsed.begin(), verticesUsed.end(), j) != verticesUsed.end()) continue;

                    edges.emplace_back(vertices[i], vertices[j]);
                    verticesUsed.push_back(i);
                }
            }
            return edges;
        }

        vector<FaceND> simplexFaces(const vector<PointND> &vertices) {
            vector<FaceND> faces;
            vector<vector<PointND>> tris = combinations(vertices, 3);

            for (auto &face_verts : tris) {
                vector<SegmentND> face_edges = simplexEdges(2, face_verts);
                faces.emplace_back(face_verts);
            }
            return faces;
        }
};

class Orthoplex : public GeometryND {
    public:
        Orthoplex(int n, float edge_len) : GeometryND(
            n,
            orthoplexVerts(n, edge_len),
            orthoplexEdges(n, orthoplexVerts(n, edge_len)),
            orthoplexFaces(n, orthoplexVerts(n, edge_len))
        ) {}

        Orthoplex* clone() override {
            return new Orthoplex(*this);
        }

        vector<int> getBufferEdgeIndices() override {
            vector<int> indices;
            int k = this->verts.size();
            for(int i=0; i<k-1; i++){
                for(int j=i+1; j<k; j++){
                    if(this->verts[i] != -this->verts[j]){
                        indices.push_back(i);
                        indices.push_back(j);
                    }
                }
            }
            return indices;
        }

    private:
        vector<PointND> orthoplexVerts(int n, float edge_len){
            float r = edge_len * sqrt(2.0f)/ 2.0f;
            vector<PointND> verts;
            verts.reserve(2*n);

            for(int axis = 0; axis < n; axis++){
                for(int sign = -1; sign <= 1; sign += 2){
                    PointND v(n);
                    for(int j = 0; j < n; j++) v(j) = 0.0f;
                    v(axis) = sign * r;
                    verts.push_back(v);
                }
            }
            return verts;
        }

        
    vector<SegmentND> orthoplexEdges(int n, const vector<PointND>& verts){
        vector<SegmentND> edges;
        const int V = verts.size();

        for(int i=0; i<V; i++){
            for(int j=i+1; j<V; j++){
            int axis_i = -1;
            int axis_j = -1;
            float val_i = 0, val_j = 0;

            for(int k=0; k<n; k++){
                if(verts[i](k) != 0){ axis_i = k; val_i = verts[i](k); }
                if(verts[j](k) != 0){ axis_j = k; val_j = verts[j](k); }
            }
            if(axis_i == -1 || axis_j == -1) continue;
            if(axis_i == axis_j) continue;

            edges.push_back(SegmentND(verts[i], verts[j]));
            }
        }
        return edges;
    }

    vector<FaceND> orthoplexFaces(int n, const vector<PointND>& verts){
        vector<FaceND> faces;
        const auto TRIS = combinations(verts, 3);

        for(const auto& tri : TRIS){
            vector<int> axes;
            bool ok = true;

            for(const auto& p : tri){
                int axis = -1;
                for(int k=0; k<n; k++){
                    if(p(k) != 0) { axis = k; break; }
                }
                if(axis == -1) { ok = false; break; }
                if(find(axes.begin(), axes.end(), axis) != axes.end()){
                    ok = false; break;
                }
                axes.push_back(axis);
            }
            if(ok) faces.push_back(FaceND(tri));
        }
        return faces;
    }
};

class Hypersphere : public GeometryND {
    public:
        Hypersphere(int n, float radius, int subdivisions) : GeometryND(
            n,
            hypersphere(n, radius, subdivisions).verts,
            hypersphere(n, radius, subdivisions).edges
        ) {}

        Hypersphere* clone() override {
            return new Hypersphere(*this);
        }

    private:
        static GeometryND hypersphere(int n, float radius, int subdivs, std::vector<float> pointstamp = {}) {
            const float MIN_PHI = -M_PI/2;
            const float MAX_PHI = M_PI/2;
            const float PHI_RANGE = MAX_PHI - MIN_PHI;
            float d_phi = PHI_RANGE / static_cast<float>(subdivs+1);

            if(n==1) {
                Hypercube hc(1, radius);
                GeometryND sec(n, hc.verts);
                return sec;
            }
            else if(n==2 && radius!=0) {
                return circle(radius, d_phi, pointstamp);
            }
            else if (n == 2 && radius == 0) {
                int dim = 2+pointstamp.size();
                GeometryND sec(dim);
                PointND v(dim);

                v(0) = 0.0f;
                v(1) = 0.0f;

                for (size_t i = 0; i < pointstamp.size(); ++i) {
                    v(2+i) = pointstamp[i];
                }

                sec.verts.push_back(v);
                return sec;
            }

            GeometryND result(n);
            GeometryND previousSection(n-1);
            bool hasPrevious = false;

            for(int i=0;i<=subdivs+1;i++) {
                float h = radius * sin(MIN_PHI + i*d_phi);
                float sectionRadius = sqrt(radius * radius - h * h);

                // nuovo pointstamp per la ricorsione (w aggiunto in coda)
                vector<float> newPointstamp = pointstamp;
                newPointstamp.push_back(h);
                GeometryND section = hypersphere(n-1, sectionRadius, subdivs, newPointstamp);
                result.verts.insert(result.verts.end(), section.verts.begin(), section.verts.end());
                result.edges.insert(result.edges.end(), section.edges.begin(), section.edges.end());

                if (hasPrevious) {
                    auto connectors = connectAdjacentHsSections(&previousSection, section);
                    result.edges.insert(result.edges.end(), connectors.begin(), connectors.end());
                }

                previousSection = move(section);
                hasPrevious = true;
            }
            return result;
        }

        static GeometryND circle(float radius, float d_theta, const vector<float> &pointstamp) {
            GeometryND circle(2);
            circle.verts = circleVerts(radius, d_theta, pointstamp);
            circle.edges = circleEdges(circle.verts);
            return circle;
        }

        static vector<PointND> circleVerts(float radius, float d_theta, const vector<float> &pointstamp){
            std::vector<PointND> points;

            for (float theta = 0; theta < 2.0 * M_PI; theta += d_theta) {
                float x = radius * std::cos(theta);
                float y = radius * std::sin(theta);

                int dim = 2+pointstamp.size();
                PointND newPoint(dim);
                newPoint(0)=x;
                newPoint(1)=y;

                for(size_t i=0;i<pointstamp.size();i++)
                    newPoint(2 + i) = pointstamp[i];

                points.push_back(newPoint);
            }
            return points;
        }

        static vector<SegmentND> circleEdges(const vector<PointND> &verts) {
            vector<SegmentND> edges;
            int circle_size = verts.size();
            for (int v = 0; v < circle_size; v++) {
                if (v == circle_size - 1) edges.push_back(SegmentND(verts[v], verts[0]));
                else edges.push_back(SegmentND(verts[v], verts[v + 1]));
            }
            return edges;
        }

        static vector<SegmentND> connectAdjacentHsSections(const GeometryND *previousHypersphereSection, const GeometryND &hypersphereSection) {
            vector<SegmentND> edges;

            if (previousHypersphereSection == nullptr) return edges;

            int prevSize = previousHypersphereSection->verts.size();
            int currSize = hypersphereSection.verts.size();

            if (prevSize == 1) {
                for (int v = 0; v < currSize; v++) edges.push_back(SegmentND(previousHypersphereSection->verts[0], hypersphereSection.verts[v]));  
            }
            else if (currSize == 1) {
                for (int v = 0; v < prevSize; v++)
                    edges.push_back(SegmentND(previousHypersphereSection->verts[v], hypersphereSection.verts[0]));
            }
            else for (int v = 0; v < currSize; v++)
                edges.push_back(SegmentND(previousHypersphereSection->verts[v], hypersphereSection.verts[v]));
            return edges;
        }
};

class LowHypersphere : public GeometryND {
    public:
        int subdivs;

        LowHypersphere(int n, float radius, int subdivs) : GeometryND(
            n,
            lowHypersphereVerts(n, radius, subdivs),
            lowHypersphereEdges(lowHypersphereVerts(n, radius, subdivs), subdivs)
        ) {
            this->subdivs = subdivs;
        }
    
        LowHypersphere* clone() override {
            return new LowHypersphere(*this);
        }

        vector<int> getBufferEdgeIndices() override {
            vector<int> indices;
            int geo_size = this->verts.size();
            for(int c=0; c + this->subdivs <= geo_size; c+=this->subdivs) {
                for(int v=c; v < this->subdivs - 1 + c; v++) {
                    indices.push_back(v);
                    indices.push_back(v + 1);
                }
                indices.push_back(c + this->subdivs - 1);
                indices.push_back(c);
            }
            return indices;
        }

        static vector<PointND> lowHypersphereVerts(int n, float radius, int subdivs) {
            vector<PointND> verts;
            for(int i=0; i<n-1; i++) {
                for(int j=i+1; j<n; j++) {
                    char x_i = AXIS_IDS[i];
                    char x_j = AXIS_IDS[j];
                    string plane = string(1,x_i) + string(1,x_j);
                    vector<PointND> c = circleVerts(n, radius, plane, subdivs);
                    verts.insert(verts.end(), c.begin(), c.end());
                }
            }
            return verts;
        }

        static vector<PointND> circleVerts(int n, float radius, string plane, int subdivs){
            std::vector<PointND> points;
            int i = AXIS_IDS.find(plane[0]);
            int j = AXIS_IDS.find(plane[1]);

            for (int k=0; k<subdivs; k++) {
                float theta = k * (2.0 * M_PI / subdivs);
                PointND newPoint = PointND::Zero(n);
                newPoint(i) = radius * std::cos(theta);
                newPoint(j) = radius * std::sin(theta);
                points.push_back(newPoint);
            }
            return points;
        }

        static vector<SegmentND> lowHypersphereEdges(const vector<PointND> &lhs_verts, int subdivs) {
            vector<SegmentND> edges;
            int lhs_size = lhs_verts.size();

            for(int c_i=0; c_i + subdivs <= lhs_size; c_i+=subdivs) {
                vector<PointND> c = vector<PointND>(lhs_verts.begin() + c_i, lhs_verts.begin() + c_i + subdivs);
                vector<SegmentND> c_edges = circleEdges(c);
                edges.insert(edges.end(), c_edges.begin(), c_edges.end());
            }
            return edges;
        }

        static vector<SegmentND> circleEdges(const vector<PointND> &circle) {
            vector<SegmentND> edges;
            int c_size = circle.size();

            for (int v = 0; v < c_size; v++) {
                if (v == c_size - 1) edges.push_back(SegmentND(circle[v], circle[0]));
                else edges.push_back(SegmentND(circle[v], circle[v + 1]));
            }
            return edges;
        }
};

class Hypertorus : public GeometryND {
    public:
        Hypertorus(int n, float radius, float distanceFromCenter, int subdivs) : GeometryND(
            n,
            hypertorus(n, radius, distanceFromCenter, subdivs).verts,
            hypertorus(n, radius, distanceFromCenter, subdivs).edges
        ) {}

        Hypertorus *clone() override {
            printf("Hypertorus::clone() called.");
            return new Hypertorus(*this);
        }

    private:
        GeometryND hypertorus(int n, float radius, float distanceFromCenter, int subdivs){
            vector<PointND> verts;
            vector<SegmentND> edges;

            Hypersphere slice(n-1, radius, subdivs/2);
            slice.extendIn(n);
            VectorXf zerosToAppend = VectorXf::Zero(n-1);
            VectorXf vector(n);
            vector(0) = radius + distanceFromCenter;

            for(int i=1;i<n;i++){
                vector(i) = zerosToAppend(i-1);
            }
            for(PointND& v : slice.verts){
                for(int i=0;i<v.size();i++){
                    v(i) += vector(i);
                }
            }

            string stamp;
            stamp.push_back('x');
            stamp.push_back(AXIS_IDS[n-1]);
            float stepAngle = M_PI / subdivs;
            for(int i=0;i<2*subdivs;i++){
                MatrixXf R(n,n);
                // set_rotation(&R,{stamp},{stepAngle});
                slice.transform(R);
                
                for(PointND& v : slice.verts) verts.push_back(v);
                for(SegmentND& s : slice.edges) edges.push_back(s);
            }

            connectAdiacentTorusSections(slice, verts, edges);
            return GeometryND(n, verts, edges);
        }

        void connectAdiacentTorusSections(GeometryND slice, vector<PointND> verts, vector<SegmentND>& edges){
            vector<SegmentND> connectors;

            for(int i=slice.verts.size(); i<verts.size(); i++){
                if(i > verts.size() - 1 - slice.verts.size()){
                    SegmentND edge1(verts[i], verts[(i+slice.verts.size()) % verts.size()]);
                    SegmentND edge2(verts[(i-slice.verts.size()) % verts.size()], verts[i]);

                    connectors.push_back(edge1);
                    connectors.push_back(edge2);
                }
            }
            for (SegmentND &s : connectors) edges.push_back(s);
        }
};

class LowHypertorus : public GeometryND {
    public:
        int subdivs_R;
        int subdivs_r;

        LowHypertorus(int n, float Radius, float r_tube, int subdivs_R, int subdivs_r) : GeometryND(
            n,
            lowHypertorusVerts(n, Radius, r_tube, subdivs_R, subdivs_r),
            lowHypertorusEdges(lowHypertorusVerts(n, Radius, r_tube, subdivs_R, subdivs_r), subdivs_R, subdivs_r)
        ) {
            this->subdivs_R = subdivs_R;
            this->subdivs_r = subdivs_r;
        }

        LowHypertorus *clone() override {
            printf("LowHypertorus::clone() called.");
            return new LowHypertorus(*this);
        }

        vector<int> getBufferEdgeIndices() override {
            vector<int> indices;
            int section_size = (this->n-1) * (this->n-2) / 2 * this->subdivs_r;
            int t = this->subdivs_R * section_size;
            
            for(int s=0; s<t; s+=section_size) {
                for(int c=s; c <= s + section_size - this->subdivs_r; c+=this->subdivs_r) {
                    for(int v=c; v < c - 1 + this->subdivs_r; v++) {
                        indices.push_back(v);
                        indices.push_back(v + 1);
                    }
                    indices.push_back(c + this->subdivs_r - 1);
                    indices.push_back(c);
                }
            }

            for(int c=t; c<=verts.size() - this->subdivs_R; c+=this->subdivs_R){
                for(int v=c; v < c - 1 + this->subdivs_R; v++) {
                    indices.push_back(v);
                    indices.push_back(v + 1);
                }
                indices.push_back(c + this->subdivs_R - 1);
                indices.push_back(c);
            }
            return indices;
        }
    
    private:
        vector<PointND> lowHypertorusVerts(int n, float Radius, float r_tube, int subdivs_R, int subdivs_r){
            vector<PointND> verts;
            LowHypersphere slice(n-1, r_tube, subdivs_r);
            slice.extendIn(n);
            string plane = string(1, 'y') + string(1, AXIS_IDS[n-1]);
            MatrixXf R1 = createRotationMatrix(n, {plane}, {M_PI/2});
            slice.transform(R1);
            PointND t = PointND::Zero(n);
            t(0) = Radius;
            slice.translate(t);
            float d_theta = 2.0 * M_PI / static_cast<float>(subdivs_R);
            MatrixXf R2 = createRotationMatrix(n, {"xy"}, {d_theta});

            for(int i=0; i<subdivs_R; i++){
                verts.insert(verts.end(), slice.verts.begin(), slice.verts.end());
                slice.transform(R2);
            }

            for(int axis = 0; axis < n-1; axis++){
                for(int sign = -1; sign <= 1; sign += 2){
                    PointND r = PointND::Zero(n);
                    r(axis) = sign * r_tube;
                    r = R1 * r;
                    PointND uR = t / Radius;
                    vector<PointND> c = LowHypersphere::circleVerts(n, Radius + r.dot(uR), "xy", subdivs_R);
                    if(r.dot(t) < EPS && r.dot(t) > -EPS)
                        for(PointND& v : c) v += r;
                    verts.insert(verts.end(), c.begin(), c.end());
                }
            }

            return verts;
        }

        static vector<SegmentND> lowHypertorusEdges(const vector<PointND> &verts, int subdivs_R, int subdivs_r) {
            vector<SegmentND> edges;
            int n = verts[0].size();
            int k = verts.size();
            int section_size = (n-1) * (n-2) / 2 * subdivs_r;

            for(int i=0; i+section_size <= subdivs_R * section_size; i+=section_size) {
                vector<SegmentND> section_edges = LowHypersphere::lowHypersphereEdges(
                    vector<PointND>(verts.begin() + i, verts.begin() + i + section_size),
                    subdivs_r
                );
                edges.insert(edges.end(), section_edges.begin(), section_edges.end());
            }

            for(int i = subdivs_R * section_size; i+subdivs_R<k; i+=subdivs_R) {
                vector<PointND> c = vector<PointND>(verts.begin() + i, verts.begin() + i + subdivs_R);
                vector<SegmentND> c_edges = LowHypersphere::circleEdges(c);
                edges.insert(edges.end(), c_edges.begin(), c_edges.end());
            }
            return edges;
        }
};

class LowHyperspherinder : public GeometryND {
    public:
        int subdivs_r;
        int subdivs_h;
        LowHyperspherinder(int n, float radius, float height, int subdivs_r, int subdivs_h) : GeometryND(
            n,
            lowHyperspherinderVerts(n, radius, height, subdivs_r, subdivs_h),
            lowHyperspherinderEdges(lowHyperspherinderVerts(n, radius, height, subdivs_r, subdivs_h), subdivs_r, subdivs_h)
        ) {
            this->subdivs_r = subdivs_r;
            this->subdivs_h = subdivs_h;
        }

        LowHyperspherinder *clone() override {
            return new LowHyperspherinder(*this);
        }

        vector<int> getBufferEdgeIndices() override {
            vector<int> indices;
            int section_size = (this->n-1) * (this->n-2) / 2 * this->subdivs_r;

            for(int s=0; s<this->subdivs_h; s++) {
                for(int c=s*section_size; c <= (s+2)*section_size - this->subdivs_r; c+=this->subdivs_r) {
                    for(int v=c; v < c - 1 + this->subdivs_r; v++) {
                        indices.push_back(v);
                        indices.push_back(v + 1);
                    }
                    indices.push_back(c + this->subdivs_r - 1);
                    indices.push_back(c);
                }
            }

            for(int h=0; h<section_size; h++){
                for(int v=h; v < this->verts.size() - section_size; v+=section_size){
                    indices.push_back(v);
                    indices.push_back(v + section_size);
                }
            }
            return indices;
        }

    private:
        vector<PointND> lowHyperspherinderVerts(int n, float radius, float height, int subdivs_r, int subdivs_h){
            vector<PointND> verts;
            LowHypersphere slice(n-1, radius, subdivs_r);
            slice.extendIn(n);
            PointND t0 = PointND::Zero(n);
            t0(n-1) = -height/2;
            slice.translate(t0);
            PointND t = PointND::Zero(n);
            t(n-1) = height / static_cast<float>(subdivs_h);

            for(int i=0; i<=subdivs_h; i++){
                verts.insert(verts.end(), slice.verts.begin(), slice.verts.end());
                slice.translate(t);
            }
            return verts;
        }

        vector<SegmentND> lowHyperspherinderEdges(const vector<PointND> &verts, int subdivs_r, int subdivs_h){
            vector<SegmentND> edges;
            return edges;
        }
};

class LowHypercone : public GeometryND {
    public:
        int subdivs_r;
        int subdivs_h;
        LowHypercone(int n, float radius, float height, int subdivs_r, int subdivs_h) : GeometryND(
            n,
            lowHyperconeVerts(n, radius, height, subdivs_r, subdivs_h),
            lowHyperconeEdges(lowHyperconeVerts(n, radius, height, subdivs_r, subdivs_h), subdivs_r, subdivs_h)
        ) {
            this->subdivs_r = subdivs_r;
            this->subdivs_h = subdivs_h;
        }

        LowHypercone *clone() override {
            return new LowHypercone(*this);
        }

        vector<int> getBufferEdgeIndices() override {
            vector<int> indices;
            int section_size = (this->n-1) * (this->n-2) / 2 * this->subdivs_r;

            for(int s=0; s<this->subdivs_h; s++) {
                for(int c=s*section_size; c <= (s+1)*section_size - this->subdivs_r; c+=this->subdivs_r) {
                    for(int v=c; v < c - 1 + this->subdivs_r; v++) {
                        indices.push_back(v);
                        indices.push_back(v + 1);
                    }
                    indices.push_back(c + this->subdivs_r - 1);
                    indices.push_back(c);
                }
            }

            for(int h=0; h<section_size; h++){
                for(int v=h; v < this->verts.size() - section_size; v+=section_size){
                    indices.push_back(v);
                    indices.push_back(v + section_size);
                }
            }
            return indices;
        }

    private:
        vector<PointND> lowHyperconeVerts(int n, float radius, float height, int subdivs_r, int subdivs_h){
            vector<PointND> verts;
            LowHypersphere slice0(n-1, radius, subdivs_r);
            slice0.extendIn(n);
            LowHypersphere slice = *(slice0.clone());
            PointND hpcone_bar = PointND::Zero(n);
            hpcone_bar(n-1) = height/3;
            slice.translate(-hpcone_bar);
            PointND t = PointND::Zero(n);

            for(int i=0; i<=subdivs_h; i++){
                float x = i / static_cast<float>(subdivs_h);
                PointND s = PointND::Ones(n) * (1 - x);
                slice.scale(s);
                t(n-1) = height * i / static_cast<float>(subdivs_h);
                slice.translate(t);
                verts.insert(verts.end(), slice.verts.begin(), slice.verts.end());
                slice = *(slice0.clone());
                slice.translate(-hpcone_bar);
            }
            return verts;
        }

        vector<SegmentND> lowHyperconeEdges(const vector<PointND> &verts, int subdivs_r, int subdivs_h){
            vector<SegmentND> edges;
            return edges;
        }
};