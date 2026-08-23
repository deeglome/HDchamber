#include <iostream>
#include <iomanip>
#include <Eigen/Dense>
#include <vector>
#include <thread>
#include <cmath>

using namespace std;
using namespace Eigen;

#define MAXDIM 6
#define EPS 1e-6
#define CAMRHO 3

const string AXIS_IDS = "xyzwvu";

typedef VectorXf PointND;

PointND origin(const int ambient_dim) {
    if(ambient_dim > MAXDIM || ambient_dim < 0) throw out_of_range("'ambient_dim' is out of range.");
    PointND p = PointND::Zero(ambient_dim);
    return p;
}

PointND project_point(const PointND p, const int low_ambient_dim) {
    if (p.size() < low_ambient_dim) throw invalid_argument("Cannot project a Point from "+to_string(p.size())+" to "+to_string(low_ambient_dim)+" dimensions. Try to extend it.");
    if (p.size() == low_ambient_dim) return p;
    if (p.size() == low_ambient_dim) return p;
    return p.head(low_ambient_dim);
}

PointND project_point(const PointND p, const int low_ambient_dim, const float cam_distance) {
    if (p.size() < low_ambient_dim) throw invalid_argument("Cannot project a Point from "+to_string(p.size())+" to "+to_string(low_ambient_dim)+" dimensions. Try to extend it.");
    if (p.size() == low_ambient_dim) return p;
   
    float last = p(p.size() - 1);
    float fact = 1.0f / (cam_distance + last);

    PointND proj(low_ambient_dim);
    for (int i = 0; i < low_ambient_dim; ++i) {
        proj(i) = p(i) * fact;
    }
    return proj;
}

PointND extend_point(const PointND p, const int high_ambient_dim) {
    if (high_ambient_dim > MAXDIM) throw out_of_range("'highAmbientDim' is out of range.");
    if (high_ambient_dim < p.size()) throw new invalid_argument("Cannot extend a Point from "+to_string(p.size())+" to "+to_string(high_ambient_dim)+" dimensions. Try to project it.");
    PointND q = PointND::Zero(high_ambient_dim);
    q.head(p.size()) = p;
    return q;
}

float distance(const PointND p, const PointND q) {
    if (p.size() != q.size()) throw invalid_argument("Points must be embedded in the same ambient dimension.\np: "+to_string(p.size())+"\nq: "+to_string(q.size()));
    return (p-q).norm();
}

bool is_uniform_set(const vector<PointND> points) {
    int nump = points.size();
    if(nump == 0) return true;

    PointND p0 = points[0];
    for(int i=0; i<nump-1; i++){
        if(points[i].size() != p0.size()) return false;
        for(int j=i+1; j<nump; j++){
            if(points[i] == points[j]) return false;
        }
    }
    return true;
}

void print_point(const PointND p, string label = "", const int digs = 2) {
    if (label.empty()) {
        label = "Point" + to_string(p.size()) + "D";
    }

    cout << fixed << setprecision(digs);
    cout << label << ": " << p.transpose() << endl;
}

PointND bar_from_points(const vector<PointND>& points){
    if( !is_uniform_set(points) ) throw invalid_argument("Points given are not a uniform set.");
    int dim = points[0].size();
    PointND g = origin(dim);
    for(auto& p : points) g += p;
    int nump = points.size();
    return g / static_cast<float>(nump);
}

bool found(const PointND p, const vector<PointND>& points){
    for(auto& q : points){
        if(distance(p, q) < EPS) return true;
    }
    return false;
}

int rotation_scope(const vector<string> planes){
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

MatrixXf create_rotation_matrix(int n, vector<string> planes, vector<float> angles){
    if(planes.size()!=angles.size()) throw invalid_argument("Number of planes and angles must be the same.");
    
    MatrixXf R = MatrixXf::Identity(n, n);
    
    for(int k=0; k<planes.size(); k++) {
        char c1 = planes[k][0], c2 = planes[k][1];

        if(planes[k].length() != 2 || c1 == c2)
            throw invalid_argument("Invalid plane entered: " + planes[k]);

        int i = (int)AXIS_IDS.find(c1);
        int j = (int)AXIS_IDS.find(c2);

        if(i >= n || j >= n){
            int idx = (i > k-1) ? 0 : 1;
            throw invalid_argument("Cannot operate with dimension '"+string(1, planes[k][idx])+"' in "+to_string(n)+" dimensions.");
        }

        MatrixXf partialR = MatrixXf::Identity(n,n);

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

        SegmentND() {
            start = PointND();
            end = PointND();
            n = 0;
        }

        float length() const {
            return distance(start, end);
        }

        PointND midpoint() {
            return (start + end) / 2.0f;
        }

        bool overlaps(const SegmentND& other) const {
            VectorXf dir1 = end - start;
            VectorXf dir2 = other.end - other.start;

            float len1 = dir1.norm();
            float len2 = dir2.norm();

            VectorXf u1 = dir1 / len1;
            VectorXf u2 = dir2 / len2;

            // 1) directions must be parallel: |u1 . u2| ≈ 1
            float dot = u1.dot(u2);
            if (std::abs(std::abs(dot) - 1.0f) > EPS) return false;

            // 2) same line: the vector which links starts
            //    must be parallel to u1 too (orthogonal component ≈ 0)
            VectorXf w = other.start - start;
            VectorXf wPerp = w - (w.dot(u1)) * u1;
            if (wPerp.norm() > EPS) return false;

            // 3) project the 4 extremes onto scalar param along u1
            float tStart      = 0.0f;
            float tEnd        = len1;
            float tOtherStart = w.dot(u1);
            float tOtherEnd   = (other.end - start).dot(u1);

            float aMin = std::min(tStart, tEnd);
            float aMax = std::max(tStart, tEnd);
            float bMin = std::min(tOtherStart, tOtherEnd);
            float bMax = std::max(tOtherStart, tOtherEnd);

            // 4) intersect between the 2 1D-intervals
            float overlapMin = std::max(aMin, bMin);
            float overlapMax = std::min(aMax, bMax);

            return (overlapMax - overlapMin) > EPS; // positive overlap length
        }

        /* Calculate intersection bewtweeen two non-overlapping distinct segments */
        unique_ptr<PointND> intersect(const SegmentND& other) const {
            if(this->n != other.n) throw invalid_argument("*this and *other are not embedded in the same N-dimensional space.");
            if( this->overlaps(other) ) throw invalid_argument("*this and *other can't be overlapped.");
            MatrixXf A(this->n, 2);
            A.col(0) = this->end - this->start;
            A.col(1) = other.start - other.end;
            VectorXf b = other.start - this->start;

            MatrixXf Ab(this->n, 3);
            Ab.col(0) = A.col(0);
            Ab.col(1) = A.col(1);
            Ab.col(2) = b;

            auto qrA = A.colPivHouseholderQr();
            auto qrAb = Ab.colPivHouseholderQr();

            qrA.setThreshold(EPS);
            qrAb.setThreshold(EPS);
            
            if( qrA.rank() != qrAb.rank() || qrA.rank() < 2 ) return nullptr;

            Vector2f x = qrA.solve(b);
            if(x(0) < -EPS || x(0) > 1+EPS || x(1) < -EPS || x(1) > 1+EPS) return nullptr;
            float t = std::max(0.0f, std::min( x(0), 1.0f) );
            return unique_ptr<PointND>(new PointND(this->start + t * (this->end - this->start)));
        }

        void extend_in(int n){
            this->start = extend_point(this->start, n);
            this->end = extend_point(this->end, n);
            this->n = n;
        }

        bool found(vector<SegmentND> arr){
            for(SegmentND s : arr){
                if(this->coincident(s)) return true;
            }
            return false;
        }

        void transform(const MatrixXf& mat) {
            if(mat.cols() != this->start.size())
                throw invalid_argument("SegmentND::transform(): invalid matrix product:"
                    "\nmat.cols() = " + to_string(mat.cols()) + "."
                    "\nstart.size() - end.size() = " + to_string(this->start.size()) + " - " + to_string(this->end.size()) + ".\n");
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
            start = project_point(start, n);
            end = project_point(end, n);
            this->n = n;
        }
        void project(int n, float cam_dist)
        {
            start = project_point(start, n, cam_dist);
            end = project_point(end, n, cam_dist);
            this->n = n;
        }
};

/* Calculate the edges of a polygon (a closed plane figure) given its vertices. The order of the vertices matters.*/
vector<SegmentND> poly_edges_from_verts(vector<PointND> verts){
    vector<SegmentND> edges;
    int numv = verts.size();

    for(int i=0; i<numv; i++){
        edges.push_back(SegmentND(verts[i], verts[ (i+1) % numv ]));
    }
    return edges;
}

/* A FaceND is a closed, non-self-intersecting plane figure embedded in an N-dimensional space. */
class FaceND {
    public:
        vector<PointND> verts;
        vector<SegmentND> edges;
        int n;
        
        FaceND(vector<PointND> _verts) {
            if( !is_uniform_set(_verts) ) throw invalid_argument("_verts is not a uniform set of points.");

            int _n = _verts[0].size();
            int numv = _verts.size();
            if(numv < 3) throw invalid_argument("Cannot create a closed plane figure using only " + to_string(numv) + " vertices.");

            VectorXf v0 = _verts[0];
            MatrixXf A(_n, numv);
            for(int i=0; i<numv; i++){
                A.col(i) = _verts[i] - v0;
            }

            FullPivLU<MatrixXf> lu_decomp_A(A);
            // if( lu_decomp_A.rank() < 2 ) throw invalid_argument("_verts consists of collinear vertices, or all the vertices coincide.");
            // if( lu_decomp_A.rank() > 2 ) throw invalid_argument("There is no plane that passes through all the vertices of _verts (the vertices form skew lines).");

            vector<SegmentND> _edges = poly_edges_from_verts(_verts);
            for(int i=0; i<numv-1; i++){
                for(int j=i+1; j<numv; j++){
                    SegmentND s1 = _edges[i], s2 = _edges[j];

                    //unique_ptr<PointND> p = s1.intersect(s2);
                    //if( p != nullptr && (*p - s1.start).norm() < EPS && (*p - s1.end).norm() < EPS && (*p - s2.start).norm() < EPS && (*p - s2.end).norm() < EPS )
                    //    throw invalid_argument("The plane figure is self-intersecting.");
                }
            }

            this->verts = _verts;
            this->edges = _edges;
            this->n = _n;
        }

        // Calcola il baricentro della faccia.
        PointND bar(){
            return bar_from_points(this->verts);
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

        void extend_in(int n){
            for(SegmentND& s : edges) s.extend_in(n);
            for(PointND& v : verts) v = extend_point(v, n);
            this->n = n;
        }

        void project(int n){
            for (SegmentND &s : edges) s.project(n);
            for (PointND &v : verts) v = project_point(v, n);
            this->n = n;
        }

        void project(int n, float cam_dist){
            for (PointND &v : verts) v = project_point(v, n, cam_dist);
            for (SegmentND &s : edges) s.project(n, cam_dist);
            this->n = n;
        }

        // Una faccia è uguale/congruente ad un'altra faccia 'f' se essa è sovrapponibile mediante isometrie, trasformazioni che conservano distanze e angoli.
        // CN: le facce devono avere = num di edges.
        /* bool operator==(FaceND f){
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
        } */
};

void combine(const vector<PointND>& array, size_t combo_size, size_t start, vector<PointND>& combo, vector<vector<PointND>>& result) {
    if(combo.size() == combo_size) {
        result.push_back(combo);
        return;
    }
    for(size_t i = start; i < array.size(); i++) {
        combo.push_back(array[i]);
        combine(array, combo_size, i + 1, combo, result);
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
            verts = verts_from_faces(_faces);
            edges = edges_from_faces(_faces);
            n = _n;
        }

        GeometryND(int _n, vector<PointND> _verts={}, vector<SegmentND> _edges={}, vector<FaceND> _faces={}){
            n = _n;
            verts = _verts;
            edges = _edges;
            faces = _faces;
        }

        PointND bar() {
            return bar_from_points(this->verts);
        }

        virtual GeometryND* clone(){
            return new GeometryND(*this);
        }

        virtual void transform(const MatrixXf& mat) {
            for(FaceND& f : this->faces) f.transform(mat);
            for(SegmentND& s : this->edges) s.transform(mat);
            for(PointND& p : this->verts) p = mat * p;
        }

        virtual void translate(const PointND& t){
            for(FaceND& f : this->faces) f.translate(t);
            for(SegmentND& s : this->edges) s.translate(t);
            for(PointND& p : this->verts) p += t;
        }

        virtual void scale(const PointND& s){
            for(FaceND& f : this->faces) f.scale(s);
            for(SegmentND& seg : this->edges) seg.scale(s);
            for(PointND& p : this->verts) p = p.cwiseProduct(s);
        }

        virtual void extend_in(const int n){
            for(FaceND& f : faces) f.extend_in(n);
            for(SegmentND& s : edges) s.extend_in(n);
            for(PointND& v : verts) v = extend_point(v, n);
            this->n = n;
        }

        virtual void project(int n){
            for(FaceND& f : this->faces) f.project(n);
            for(SegmentND& s : this->edges) s.project(n);
            for(PointND& v : this->verts) v = project_point(v, n);
            this->n = n;
        }

        virtual void project(int n, float cam_dist){
            for(FaceND& f : this->faces) f.project(n, cam_dist);
            for(SegmentND& s : this->edges) s.project(n, cam_dist);
            for(PointND& v : this->verts) v = project_point(v, n, cam_dist);
            this->n = n;
        }

        virtual float max_vertex_dist(){
            float max_dist = 0.00f;
            for(PointND& v : this->verts){
                if(v.norm() > max_dist) max_dist = v.norm();
            }
            return max_dist;
        }

        // E' sott'inteso che this e other siano generati mediante funzioni 'preconfezionate' e che sia garantito pertanto l'ordine.
        // Inoltre, è garantito che entrambe le geometrie siano costituite da almeno una faccia.
        virtual bool similar_to(const GeometryND& other) const {
            if( this->n != other.n || this->verts.size() != other.verts.size() || this->edges.size() != other.edges.size() || this->faces.size() != other.faces.size())
                return false;

            if( this->edges.empty() ) return true;
            const float ratio = this->edges[0].length() / other.edges[0].length();

            for(int i=1; i<this->edges.size(); i++){
                if( abs(this->edges[i].length() / other.edges[i].length() - ratio) >= EPS )
                    return false;
            }

            return true;
        }

        virtual GeometryND get_absolute_cross_section(vector<float> n, float d){
            if(n.size() != this->n) throw invalid_argument("Normal vector must have the same number of dimensions as the geometry.");
            Eigen::VectorXf n_eigen = Eigen::Map<Eigen::VectorXf>(n.data(), n.size());
            Eigen::Hyperplane<float, Eigen::Dynamic> h = Eigen::Hyperplane<float, Eigen::Dynamic>(n_eigen, d);
            vector<FaceND> sectionFaces = {};
            vector<SegmentND> sectionEdges = {};
            vector<PointND> sectionVerts = {};
            for(FaceND f : this->faces){
                try{
                    SegmentND s = intersect(f, h);
                    if(distance(s.start, s.end) > EPS && s.n == this->n && !s.found(sectionEdges) ) sectionEdges.push_back(s);
                    if(s.n == this->n && !found(s.start, sectionVerts)) sectionVerts.push_back(s.start);
                    if(s.n == this->n && !found(s.end, sectionVerts)) sectionVerts.push_back(s.end);
                }
                catch(invalid_argument& e){
                    // Se l'iperpiano interseca la faccia in un singolo punto, non è possibile creare un segmento.
                    // In tal caso, si ignora la faccia e si passa alla successiva.
                }
            }
            return GeometryND(this->n, sectionVerts, sectionEdges, sectionFaces);
        }

        GeometryND get_relative_cross_section(vector<float> n, float d){
            GeometryND section = this->get_absolute_cross_section(n, d);
            // Vettore di traslazione per riportare l'iperpiano centrato nell'origine.
            const VectorXf n_eigen = Eigen::Map<Eigen::VectorXf>(n.data(), n.size());
            VectorXf t = d * n_eigen / n_eigen.squaredNorm();
            section.translate(t);
            // Versore unitario diretto lungo l'asse positivo dell'ultima dimensione.
            VectorXf u = VectorXf::Zero(n.size());
            u(u.size() - 1) = 1.0f;

            // Dal prodotto scalare si ricava:
            const float theta = std::acos(n_eigen.dot(u) / (n_eigen.norm() * u.norm()));

            const string plane = string(1, AXIS_IDS[this->n - 2]) + string(1, AXIS_IDS[this->n - 1]);
            // Matrice di rotazione per allineare il vettore normale dell'iperpiano con il semiasse positivo dell'ultima dimensione.
            MatrixXf T = MatrixXf::Identity(this->n, this->n);
            VectorXf n_current = n_eigen;

            for(int i = 0; i < this->n - 1; i++){
                // Ruota nel piano (asse i, asse n-1) per azzerare la componente i
                float xi = n_current(i);
                float xlast = n_current(this->n - 1);
                float r = sqrt(xi*xi + xlast*xlast);
                if(r < EPS) continue; // già allineato su questo piano, salta

                string plane = string(1, AXIS_IDS[i]) + string(1, AXIS_IDS[this->n - 1]);

                MatrixXf partialR = create_rotation_matrix(this->n, {plane}, {atan2(xi, xlast)});

                n_current = partialR * n_current;
                T = partialR * T;
            }
            
            if(n_current.dot(u) < 1 - EPS) throw invalid_argument("n is not alligned with u after rotation. Something went wrong. Scalar: " + to_string(n_current.dot(u)));
            section.transform(T);
            return section;
        }

        vector<float> get_buffer_verts(){
            vector<float> result = {};
            for(int j=0; j<this->verts.size(); j++){
                for(int k=0; k<this->n; k++){
                    result.push_back(verts[j](k));
                }
            }
            return result;
        }

        virtual vector<int> get_buffer_edge_indices() {
            vector<int> indices;
            indices.reserve(this->edges.size() * 2);

            for(SegmentND& s : this->edges){
                int startIdx = index_of(s.start, this->verts);
                int endIdx = index_of(s.end, this->verts);
                indices.push_back(startIdx);
                indices.push_back(endIdx);
            }
            return indices;
        }

    private:
        vector<PointND> verts_from_faces(vector<FaceND> _faces){
            vector<PointND> res;
            for(FaceND f : _faces){
                for(SegmentND s : f.edges){
                    res.push_back(s.start);
                    res.push_back(s.end);
                }
            }
            return res;
        }

        vector<SegmentND> edges_from_faces(vector<FaceND> _faces){
            vector<SegmentND> res;
            for(FaceND f : _faces){
                for(SegmentND s : f.edges){
                    res.push_back(s);
                }
            }
            return res;
        }

        int index_of(const PointND& p, const vector<PointND>& points){
            for(int i = 0; i < points.size(); i++){
                if((p - points[i]).norm() < EPS) return i;
            }
            return -1; // non trovato: segnale di un bug a monte (punto non presente in verts)
        }

        PointND instersect(SegmentND seg, Eigen::Hyperplane<float, Eigen::Dynamic> h){
            if(h.normal().dot(seg.end - seg.start) == 0) return PointND(); // Condizione di parallelismo tra il segmento e l'iperpiano.
            float t = -(h.normal().dot(seg.start) + h.offset()) / h.normal().dot(seg.end - seg.start);
            if(t < 0 || t > 1) return PointND(); // Il punto giace sulla retta estesa ma non sul segmento.
            return seg.start + t * (seg.end - seg.start);
        }

        SegmentND intersect(FaceND f, Eigen::Hyperplane<float, Eigen::Dynamic> h){
            vector<PointND> points = {};
            for(SegmentND s : f.edges){
                PointND p = instersect(s, h);
                if(p.size() != 0 && !found(p, points)) points.push_back(p);
                if(points.size() == 2) return SegmentND(points[0], points[1]);
            }
            if(points.size() == 1) throw invalid_argument("The hyperplane intersects the face in a single point. It's geometrically impossible to create a segment from a single point.");
            return SegmentND();
        }
};

class AxesND : public GeometryND {
    public:
        AxesND(int n, float axis_len) : GeometryND(
            n,
            axes_verts(n, axis_len),
            axes_edges(axes_verts(n, axis_len)),
            {}
        ) {}

        AxesND* clone() override {
            return new AxesND(*this);
        }

        vector<int> get_buffer_edge_indices(){
            vector<int> indices;

            for(int i=0; i<this->verts.size(); i+=2){
                indices.push_back(i);
                indices.push_back(i+1);
            }
            return indices;
        }

    private:
        vector<PointND> axes_verts(int n, float axis_len){
            vector<PointND> verts;

            for(int i=0; i<n; i++){
                PointND origin = PointND::Zero(n);
                verts.push_back(origin);
                PointND axis_i = origin;
                axis_i(i) = axis_len;
                verts.push_back(axis_i);
            }
            return verts;
        }

        vector<SegmentND> axes_edges(const vector<PointND> &verts){
            vector<SegmentND> axes;

            for(int i=0; i<verts.size(); i+=2){
                axes.push_back(SegmentND(verts[i], verts[i+1]));
            }
            return axes;
        }

};

class Hypercube : public GeometryND {
    public:
        Hypercube(int n, float edge_len) : GeometryND(
            n,
            hypercube_verts(n, edge_len),
            hypercube_edges(n, hypercube_verts(n, edge_len)),
            hypercube_faces(n, hypercube_verts(n, edge_len))
        ) {}

        Hypercube* clone() override {
            return new Hypercube(*this);
        }

        vector<int> get_buffer_edge_indices() override {
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

        vector<PointND> hypercube_verts(int n, float edge_len){
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

        vector<SegmentND> hypercube_edges(int n, vector<PointND> verts){
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

        vector<FaceND> hypercube_faces(int n, vector<PointND> verts){
            vector<FaceND> faces;

            for(int i=0; i<n-1; i++){
                for(int j=i+1; j<n; j++){
                    for(int k=0; k<verts.size(); k++){
                        if( !(k & (1<<i)) && !(k & (1<<j)) ){
                            vector<PointND> quartet = {
                                verts[k],
                                verts[k + (1<<i)],
                                verts[k + (1<<i) + (1<<j)],
                                verts[k + (1<<j)]
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
            simplex_verts(n, edge_len),
            simplex_edges(n, simplex_verts(n, edge_len)),
            simplex_faces(simplex_verts(n, edge_len))
        ) {}

        Simplex* clone() override {
            return new Simplex(*this);
        }

        vector<int> get_buffer_edge_indices() override {
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
        vector<PointND> simplex_verts(int n, float edge_len) {
            PointND start = PointND::Zero(n);
            PointND end = PointND::Zero(n);
            start(0) = -.5 * edge_len;
            end(0) = .5 * edge_len;
            vector<PointND> simplex = {start, end};
            
            for(int i=2; i<=n; i++){
                PointND bar = bar_from_points(simplex);
                PointND next = PointND::Zero(n);

                for(int k=0; k<i-1; k++){
                    next(k) = bar(k);
                }
                
                float dist_v0_bar = distance(start, bar);
                next(i-1) = sqrt(edge_len * edge_len - dist_v0_bar * dist_v0_bar);
                simplex.push_back(next);
                bar = bar_from_points(simplex);
                
                for(PointND& v : simplex){
                    v -= bar;
                }
            }
            return simplex;
        }

        vector<SegmentND> simplex_edges(int dimensions, const vector<PointND> &vertices) {
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

        vector<FaceND> simplex_faces(const vector<PointND> &vertices) {
            vector<FaceND> faces;
            vector<vector<PointND>> tris = combinations(vertices, 3);

            for (auto &face_verts : tris) {
                vector<SegmentND> face_edges = simplex_edges(2, face_verts);
                faces.emplace_back(face_verts);
            }
            return faces;
        }
};

class Orthoplex : public GeometryND {
    public:
        Orthoplex(int n, float edge_len) : GeometryND(
            n,
            orthoplex_verts(n, edge_len),
            orthoplex_edges(n, orthoplex_verts(n, edge_len)),
            orthoplex_faces(n, orthoplex_verts(n, edge_len))
        ) {}

        Orthoplex* clone() override {
            return new Orthoplex(*this);
        }

        vector<int> get_buffer_edge_indices() override {
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
        vector<PointND> orthoplex_verts(int n, float edge_len){
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

        
    vector<SegmentND> orthoplex_edges(int n, const vector<PointND>& verts){
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

    vector<FaceND> orthoplex_faces(int n, const vector<PointND>& verts){
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

class Joint : public GeometryND {
    private:
        static int evaluateN(const GeometryND& g){
            return g.n;
        }

    public:
        GeometryND start;
        GeometryND end;

        Joint(const GeometryND& _start, const GeometryND& _end) : start(_start), end(_end), GeometryND(evaluateN(_start), {}, {}, {}) {
            if( !(_start.similar_to(_end)) ) throw invalid_argument("'start' and 'end' must be similar.");

            this->n = _start.n; // E' indifferente con _end.n
            int vsize = _start.verts.size(); // E' indifferente con _end.verts.size()

            for(int i=0; i<vsize; i++){
                this->verts.push_back(_start.verts[i]);
                this->verts.push_back(_end.verts[i]);
            }

            for(int i=0; i<2*vsize; i+=2){
                SegmentND s = SegmentND(this->verts[i], this->verts[i+1]);
                this->edges.push_back(s);
            }

            for(int i=0; i<vsize; i++){
                if (distance(_start.verts[i], _start.verts[(i + 1) % vsize]) < EPS) {
                    continue; 
                }

                vector<PointND> vface;
                vface.push_back(_start.verts[i]);
                vface.push_back(_start.verts[(i+1) % vsize]);
                vface.push_back(_end.verts[(i+1) % vsize]);
                vface.push_back(_end.verts[i]);

                FaceND f = FaceND(vface);
                this->faces.push_back(f);
            }
        }

        // Joint 'iperconico'
        Joint(const GeometryND& _start, PointND _end) : start(_start), end(GeometryND(_end.size(), {_end})), GeometryND(_end.size(), {}, {}, {}) {
            if(_start.n != _end.size()) throw invalid_argument("'start' and 'end' must have the same number of dimensions.");

            this->n = _start.n;
            int vsize = _start.verts.size();

            this->verts.insert(this->verts.end(), _start.verts.begin(), _start.verts.end());
            this->verts.push_back(_end);

            for(PointND v : _start.verts){
                SegmentND s = SegmentND(v, _end);
                this->edges.push_back(s);
            }

            for(int i=0; i<vsize; i++){
                vector<PointND> vface;
                vface.push_back(_start.verts[i]);
                vface.push_back(_start.verts[ (i+1) % vsize ]);
                vface.push_back(_end);

                FaceND f = FaceND(vface);
                this->faces.push_back(f);
            }
        }

        Joint* clone() override {
            return new Joint(*this);
        }
};

class Hypersphere : public GeometryND {
    public:
        vector<float> center;
        float radius;
        int subdivs;

        Hypersphere(int n, vector<float> center, float radius, int subdivs) : GeometryND(
            n,
            hypersphere(n, radius, subdivs).verts,
            hypersphere(n, radius, subdivs).edges,
            {} // Non servono le facce, la sezione ha una forma analitica chiusa!
        ) {
            this->center = vector<float>(n, 0.0f); 
            this->radius = radius;
            this->subdivs = subdivs;

            Eigen::Map<Eigen::VectorXf> target(center.data(), center.size());
            this->translate(PointND(target)); // sposta verts/edges E aggiorna this->center a 'center'
        }

        Hypersphere* clone() override {
            return new Hypersphere(*this);
        }

        // Be careful! Only orthogonal matrices (isometries and scales) transforms Hyperspheres into Hyperspheres.
        // A general transform matrix could transform an Hypersphere into a Hyperellipsoid. To avoid!
        void transform(const MatrixXf& mat) override {
            if (!mat.isUnitary(EPS))
                throw invalid_argument("Hypersphere::transform: The matrix must be orthogonal to ensure that the transformation maps a hypersphere onto a hypersphere.");

            GeometryND::transform(mat);

            // The center must be transformed consistently; otherwise, it remains “old”
            // relative to the newly rotated vertices
            Eigen::Map<Eigen::VectorXf> c(center.data(), center.size());
            Eigen::VectorXf c2 = mat * c;
            for (int i = 0; i < c2.size(); ++i) center[i] = c2(i);
        }

        void translate(const PointND& t) override {
            GeometryND::translate(t);
            for (int i = 0; i < center.size(); ++i) center[i] += t(i);
        }

        void scale(const PointND& s) override {
            for (int i = 1; i < s.size(); ++i)
                if (std::abs(s(i) - s(0)) > EPS)
                    throw invalid_argument("Hypersphere::scale: the scale vector must be uniform (isotropic) to keep the shape a hypersphere.");

            GeometryND::scale(s);
            Eigen::Map<Eigen::VectorXf> c(center.data(), center.size());
            c = c.cwiseProduct(s);
            for (int i = 0; i < c.size(); ++i) center[i] = c(i);

            this->radius *= s(0);
        }

        void extend_in(const int n) override {
            GeometryND::extend_in(n);
            Eigen::Map<Eigen::VectorXf> c(center.data(), center.size());
            PointND extended = extend_point(PointND(c), n);
            center.assign(extended.data(), extended.data() + extended.size());
        }

        void project(int n) override {
            Eigen::Map<Eigen::VectorXf> c(center.data(), center.size());
            PointND c_proj = project_point(PointND(c), n);
            center.assign(c_proj.data(), c_proj.data() + c_proj.size());

            GeometryND::project(n);
        }

        void project(int n, float cam_dist) override {
            Eigen::Map<Eigen::VectorXf> c(center.data(), center.size());
            PointND c_proj = project_point(PointND(c), n, cam_dist);
            center.assign(c_proj.data(), c_proj.data() + c_proj.size());

            GeometryND::project(n, cam_dist);
        }

        float max_vertex_dist() override {
            Eigen::Map<const Eigen::VectorXf> c(center.data(), center.size());
            return c.norm() + radius; // exact analytic value
        }

        bool similar_to(const GeometryND& other) const override {
            return true; // It's always true for hyperspheres.
        }

        // -----------------------------------------------------------------
        // Only getAbsoluteCrossSection needs to be overridden: it's the only
        // virtual cross-section hook in GeometryND. getRelativeCrossSection
        // stays inherited as-is (non-virtual in the base), and works
        // correctly for ANY GeometryND made of verts/edges — including this
        // one — because it operates generically on the mesh returned here.
        // -----------------------------------------------------------------
        GeometryND get_absolute_cross_section(vector<float> n_vec, float d) override {
            if ((int)n_vec.size() != this->n)
                throw invalid_argument("Normal vector must have the same number of dimensions as the geometry.");
            if (this->n < 2)
                throw invalid_argument("Cannot take a cross section of a 0- or 1-dimensional hypersphere.");

            Eigen::VectorXf n_eigen = Eigen::Map<Eigen::VectorXf>(n_vec.data(), n_vec.size());
            Eigen::Hyperplane<float, Eigen::Dynamic> h(n_eigen, d);

            Eigen::Map<Eigen::VectorXf> center_eigen(this->center.data(), this->center.size());
            PointND c = h.projection(center_eigen); // still n-dimensional, absolute (world) coordinates
            float dist = (center_eigen - c).norm();

            if (dist > this->radius + EPS) {
                // The cutting hyperplane misses the sphere entirely: empty section.
                return GeometryND(this->n);
            }

            float r = std::sqrt(std::max(0.0f, this->radius * this->radius - dist * dist));

            // Orthonormal basis of the hyperplane's direction space (n x (n-1)):
            // columns are all orthogonal to n_eigen, so any point c + B*y
            // automatically satisfies n_eigen . (c + B*y) = d.
            Eigen::MatrixXf B = orthonormal_complement(n_eigen);

            // Canonical (n-1)-dimensional sphere mesh, in LOCAL coordinates
            // (this is the same private generator the constructor already uses).
            GeometryND localSection = hypersphere(this->n - 1, r, this->subdivs);

            // Embed every local vertex into the ambient n-dimensional space,
            // positioned exactly on the cutting hyperplane.
            vector<PointND> sectionVerts;
            sectionVerts.reserve(localSection.verts.size());
            for (const PointND& y : localSection.verts) {
                sectionVerts.push_back(c + B * y);
            }

            vector<SegmentND> sectionEdges;
            sectionEdges.reserve(localSection.edges.size());
            for (const SegmentND& e : localSection.edges) {
                PointND p1 = c + B * e.start;
                PointND p2 = c + B * e.end;
                if( distance(p1, p2) > EPS ) sectionEdges.push_back(SegmentND(p1, p2));
            }

            // No faces here either: same convention as Hypersphere itself
            // (analytic closed shape, faces aren't needed).
            return GeometryND(this->n, sectionVerts, sectionEdges, {});
        }

    private:
        // -----------------------------------------------------------------
        // Orthonormal basis (n x (n-1)) of the orthogonal complement of v.
        // Needed to embed the canonical (n-1)-sphere mesh onto the actual
        // cutting hyperplane in ambient coordinates.
        // -----------------------------------------------------------------
        static Eigen::MatrixXf orthonormal_complement(const Eigen::VectorXf& v) {
            const int DIM = static_cast<int>(v.size());

            Eigen::MatrixXf A(1, DIM);
            A.row(0) = v.normalized().transpose();

            Eigen::FullPivLU<Eigen::MatrixXf> lu(A);
            Eigen::MatrixXf ker = lu.kernel(); // DIM x (DIM-1), not necessarily orthonormal

            Eigen::HouseholderQR<Eigen::MatrixXf> qr(ker);
            Eigen::MatrixXf Q = qr.householderQ() * Eigen::MatrixXf::Identity(DIM, DIM - 1);
            return Q;
        }

        static GeometryND hypersphere(int n, float radius, int subdivs, std::vector<float> pointstamp = {}) {
            const float MIN_PHI = -M_PI/2;
            const float MAX_PHI = M_PI/2;
            const float PHI_RANGE = MAX_PHI - MIN_PHI;
            float d_phi = PHI_RANGE / static_cast<float>(subdivs+1);

            if (radius == 0) {
                int dim = n + (int)pointstamp.size();
                GeometryND sec(dim);
                PointND v = PointND::Zero(dim);

                for (size_t i = 0; i < pointstamp.size(); ++i) {
                    v(n + i) = pointstamp[i];
                }

                sec.verts.push_back(v);
                return sec;
            }
            if(n==1) {
                Hypercube hc(1, radius);
                GeometryND sec(n, hc.verts);
                return sec;
            }
            else if(n==2 && radius!=0) {
                d_phi = 2*M_PI / static_cast<float>(subdivs);
                return circle(radius, d_phi, pointstamp);
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
                    auto connectors = connect_adjacent_hs_sections(&previousSection, section);
                    result.edges.insert(result.edges.end(), connectors.begin(), connectors.end());
                }

                previousSection = move(section);
                hasPrevious = true;
            }
            return result;
        }

        static GeometryND circle(float radius, float d_theta, const vector<float> &pointstamp) {
            GeometryND circle(2);
            circle.verts = circle_verts(radius, d_theta, pointstamp);
            circle.edges = circle_edges(circle.verts);
            return circle;
        }

        static vector<PointND> circle_verts(float radius, float d_theta, const vector<float> &pointstamp){
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

        static vector<SegmentND> circle_edges(const vector<PointND> &verts) {
            vector<SegmentND> edges;
            int circle_size = verts.size();
            for (int v = 0; v < circle_size; v++) {
                if (v == circle_size - 1) edges.push_back(SegmentND(verts[v], verts[0]));
                else edges.push_back(SegmentND(verts[v], verts[v + 1]));
            }
            return edges;
        }

        static vector<SegmentND> connect_adjacent_hs_sections(const GeometryND *previousHypersphereSection, const GeometryND &hypersphereSection) {
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

class HypersphericalGeometry : public GeometryND {
    private:
        static int evaluateN(const vector<Hypersphere>& hspheres){
            if(hspheres.empty()) throw invalid_argument("'hspheres' mustn't be empty.");
            return hspheres[0].n;
        }

    public:
        vector<Hypersphere> hspheres;
        vector<Joint> joints;

        HypersphericalGeometry(vector<Hypersphere> _hspheres, bool cyclic=false) : GeometryND(evaluateN(_hspheres), {}, {}, {}){
            this->n = _hspheres[0].n;
            this->hspheres = _hspheres;
            int hsize = _hspheres.size();

            if(!cyclic){
                for(int i=0; i<hsize-1; i++){
                    Joint j(_hspheres[i], _hspheres[i+1]);
                    this->joints.push_back(j);
                }
            }
            else
            {
                for(int i=0; i<hsize; i++){
                    Joint j(_hspheres[i], _hspheres[ (i+1) % hsize ]);
                    this->joints.push_back(j);
                }
            }

            for(Hypersphere& hs : _hspheres){
                this->verts.insert(this->verts.end(), hs.verts.begin(), hs.verts.end());
            }

            for(Joint& j : this->joints){
                this->edges.insert(this->edges.end(), j.edges.begin(), j.edges.end());
                this->faces.insert(this->faces.end(), j.faces.begin(), j.faces.end());
            }
        }

        HypersphericalGeometry* clone() override {
            return new HypersphericalGeometry(*this);
        }

        void transform(const MatrixXf& mat) override {
            GeometryND::transform(mat);
            for(Hypersphere& hs : this->hspheres) hs.transform(mat);
        }

        void translate(const PointND& t) override {
            GeometryND::translate(t);
            for(Hypersphere& hs : this->hspheres) hs.translate(t);
        }

        void scale(const PointND& s) override {
            GeometryND::scale(s);
            for(Hypersphere& hs : this->hspheres) hs.scale(s);
        }

        void project(int n) override {
            GeometryND::project(n);
            for(Hypersphere& hs : this->hspheres) hs.project(n);
        }

        void project(int n, float cam_dist) override {
            GeometryND::project(n, cam_dist);
            for(Hypersphere& hs : this->hspheres) hs.project(n, cam_dist);
        }

        GeometryND get_absolute_cross_section(vector<float> n, float d) override {
            if((int)n.size() != this->n)
                throw invalid_argument("Normal vector must have the same number of dimensions as the geometry.");

            // Sezione "generica": copre i joint, le cui facce (quad) sono già
            // in this->faces (popolate nel costruttore) - riusa la logica
            // già scritta in GeometryND, bypassando la dispatch virtuale.
            GeometryND jointsSection = GeometryND::get_absolute_cross_section(n, d);
            return jointsSection;

            /* vector<PointND> sectionVerts = jointsSection.verts;
            vector<SegmentND> sectionEdges = jointsSection.edges;

            // Sezione analitica di ciascuna hypersphere: non hanno facce
            // proprie (sono "chiuse" analiticamente), quindi va richiesta
            // esplicitamente al loro override.
            for(Hypersphere& hs : this->hspheres){
                GeometryND hsSection = hs.getAbsoluteCrossSection(n, d);

                for(SegmentND& s : hsSection.edges){
                    if(!s.found(sectionEdges) && distance(s.start, s.end) > EPS) sectionEdges.push_back(s);
                }
                for(PointND& v : hsSection.verts){
                    if(!found(v, sectionVerts)) sectionVerts.push_back(v);
                }
            }

            // Nessuna faccia nel risultato, stessa convenzione delle altre
            // getAbsoluteCrossSection della classe.
            return GeometryND(this->n, sectionVerts, sectionEdges, {}); */
        }
};

class LowHypersphere : public GeometryND {
    public:
        int subdivs;

        LowHypersphere(int n, float radius, int subdivs) : GeometryND(
            n,
            low_hypersphere_verts(n, radius, subdivs),
            low_hypersphere_edges(low_hypersphere_verts(n, radius, subdivs), subdivs)
        ) {
            this->subdivs = subdivs;
        }
    
        LowHypersphere* clone() override {
            return new LowHypersphere(*this);
        }

        vector<int> get_buffer_edge_indices() override {
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

        static vector<PointND> low_hypersphere_verts(int n, float radius, int subdivs) {
            vector<PointND> verts;
            for(int i=0; i<n-1; i++) {
                for(int j=i+1; j<n; j++) {
                    char x_i = AXIS_IDS[i];
                    char x_j = AXIS_IDS[j];
                    string plane = string(1,x_i) + string(1,x_j);
                    vector<PointND> c = circle_verts(n, radius, plane, subdivs);
                    verts.insert(verts.end(), c.begin(), c.end());
                }
            }
            return verts;
        }

        static vector<PointND> circle_verts(int n, float radius, string plane, int subdivs){
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

        static vector<SegmentND> low_hypersphere_edges(const vector<PointND> &lhs_verts, int subdivs) {
            vector<SegmentND> edges;
            int lhs_size = lhs_verts.size();

            for(int c_i=0; c_i + subdivs <= lhs_size; c_i+=subdivs) {
                vector<PointND> c = vector<PointND>(lhs_verts.begin() + c_i, lhs_verts.begin() + c_i + subdivs);
                vector<SegmentND> c_edges = circle_edges(c);
                edges.insert(edges.end(), c_edges.begin(), c_edges.end());
            }
            return edges;
        }

        static vector<SegmentND> circle_edges(const vector<PointND> &circle) {
            vector<SegmentND> edges;
            int c_size = circle.size();

            for (int v = 0; v < c_size; v++) {
                if (v == c_size - 1) edges.push_back(SegmentND(circle[v], circle[0]));
                else edges.push_back(SegmentND(circle[v], circle[v + 1]));
            }
            return edges;
        }
}; 

HypersphericalGeometry hypertorus(int n, float Radius, float radius, int subdivs, int subdivsPerSphere) {
    if (n < 2)
        throw invalid_argument("hypertorus: 'n' must be at least 2 to sweep a ring of hyperspheres.");
    if (subdivs < 3)
        throw invalid_argument("hypertorus: 'subdivs' must be at least 3 to close the ring.");

    vector<Hypersphere> hslices;
    hslices.reserve(subdivs);

    vector<float> center(n-1, 0.0f);
    Hypersphere slice(n-1, center, radius, subdivsPerSphere);
    slice.extend_in(n);

    if(n > 2) {
        const string plane0 = string(1, AXIS_IDS[1]) + string(1, AXIS_IDS[n-1]);
        const MatrixXf R0 = create_rotation_matrix(n, {plane0}, {M_PI_2});
        slice.transform(R0);
    }

    VectorXf t = VectorXf::Zero(n); t(0) = Radius;
    slice.translate(t);

    hslices.push_back(slice);

    float theta = (2.0f * M_PI / static_cast<float>(subdivs));
    const string dplane = "xy";
    const MatrixXf dR = create_rotation_matrix(n, {dplane}, {theta});
    
    for (int i=1; i<subdivs; i++) {
        slice.transform(dR);
        hslices.push_back(slice);
    }

    return HypersphericalGeometry(hslices, /*cyclic=*/true);
}

class LowHypertorus : public GeometryND {
    public:
        int subdivs_R;
        int subdivs_r;

        LowHypertorus(int n, float Radius, float r_tube, int subdivs_R, int subdivs_r) : GeometryND(
            n,
            low_hypertorus_verts(n, Radius, r_tube, subdivs_R, subdivs_r),
            low_hypertorus_edges(low_hypertorus_verts(n, Radius, r_tube, subdivs_R, subdivs_r), subdivs_R, subdivs_r)
        ) {
            this->subdivs_R = subdivs_R;
            this->subdivs_r = subdivs_r;
        }

        LowHypertorus *clone() override {
            printf("LowHypertorus::clone() called.");
            return new LowHypertorus(*this);
        }

        vector<int> get_buffer_edge_indices() override {
            vector<int> indices;
            int section_size = (this->n-1) * (this->n-2) / 2 * this->subdivs_r;
            int t = this->subdivs_R * section_size;
            
            for(int s=0; s<t && section_size!=0; s+=section_size) {
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
        vector<PointND> low_hypertorus_verts(int n, float Radius, float r_tube, int subdivs_R, int subdivs_r){
            vector<PointND> verts;
            LowHypersphere slice(n-1, r_tube, subdivs_r);
            slice.extend_in(n);
            string plane = string(1, 'y') + string(1, AXIS_IDS[n-1]);
            MatrixXf R1 = create_rotation_matrix(n, {plane}, {M_PI/2});
            slice.transform(R1);
            PointND t = PointND::Zero(n);
            t(0) = Radius;
            slice.translate(t);
            float d_theta = 2.0 * M_PI / static_cast<float>(subdivs_R);
            MatrixXf R2 = create_rotation_matrix(n, {"xy"}, {d_theta});

            if(n>2)
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
                    vector<PointND> c = LowHypersphere::circle_verts(n, Radius + r.dot(uR), "xy", subdivs_R);
                    if(r.dot(t) < EPS && r.dot(t) > -EPS)
                        for(PointND& v : c) v += r;
                    verts.insert(verts.end(), c.begin(), c.end());
                }
            }

            return verts;
        }

        static vector<SegmentND> low_hypertorus_edges(const vector<PointND> &verts, int subdivs_R, int subdivs_r) {
            vector<SegmentND> edges;
            int n = verts[0].size();
            int k = verts.size();
            int section_size = (n-1) * (n-2) / 2 * subdivs_r;

            for(int i=0; i+section_size <= subdivs_R * section_size && section_size!=0; i+=section_size) {
                vector<SegmentND> section_edges = LowHypersphere::low_hypersphere_edges(
                    vector<PointND>(verts.begin() + i, verts.begin() + i + section_size),
                    subdivs_r
                );
                edges.insert(edges.end(), section_edges.begin(), section_edges.end());
            }

            for(int i = subdivs_R * section_size; i+subdivs_R<k; i+=subdivs_R) {
                vector<PointND> c = vector<PointND>(verts.begin() + i, verts.begin() + i + subdivs_R);
                vector<SegmentND> c_edges = LowHypersphere::circle_edges(c);
                edges.insert(edges.end(), c_edges.begin(), c_edges.end());
            }
            return edges;
        }
};

HypersphericalGeometry hyperspherinder(int n, float radius, float height, int subdivs) {
    vector<Hypersphere> hslices;
    hslices.reserve(2);

    vector<float> center(n-1, 0.0f);
    Hypersphere slice(n-1, center, radius, subdivs);
    slice.extend_in(n);

    const string plane0 = string(1, AXIS_IDS[0]) + string(1, AXIS_IDS[n-1]);
    const MatrixXf R0 = create_rotation_matrix(n, {plane0}, {M_PI_2});
    slice.transform(R0);

    VectorXf t = VectorXf::Zero(n); t(0) = height / 2.0f;
    slice.translate(t);
    hslices.push_back(slice);
    slice.translate( -2.0f * t);
    hslices.push_back(slice);

    return HypersphericalGeometry(hslices, false);
}

Joint hypercone(int n, float radius, float height, int subdivs) {
    vector<float> center(n-1, 0.0f);
    Hypersphere slice(n-1, center, radius, subdivs);
    slice.extend_in(n);

    const string plane0 = string(1, AXIS_IDS[0]) + string(1, AXIS_IDS[n-1]);
    const MatrixXf R0 = create_rotation_matrix(n, {plane0}, {M_PI_2});
    slice.transform(R0);

    VectorXf t = VectorXf::Zero(n); t(0) = height / 3.0f;
    slice.translate(t);

    PointND v = PointND::Zero(n);
    v = -2.0f * t;

    return Joint(slice, v);
}

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

        vector<int> get_buffer_edge_indices() override {
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
            slice.extend_in(n);
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
            low_hypercone_verts(n, radius, height, subdivs_r, subdivs_h),
            low_hypercone_edges(low_hypercone_verts(n, radius, height, subdivs_r, subdivs_h), subdivs_r, subdivs_h)
        ) {
            this->subdivs_r = subdivs_r;
            this->subdivs_h = subdivs_h;
        }

        LowHypercone *clone() override {
            return new LowHypercone(*this);
        }

        vector<int> get_buffer_edge_indices() override {
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
        vector<PointND> low_hypercone_verts(int n, float radius, float height, int subdivs_r, int subdivs_h){
            vector<PointND> verts;
            LowHypersphere slice0(n-1, radius, subdivs_r);
            slice0.extend_in(n);
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

        vector<SegmentND> low_hypercone_edges(const vector<PointND> &verts, int subdivs_r, int subdivs_h){
            vector<SegmentND> edges;
            return edges;
        }
};