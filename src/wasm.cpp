#include<emscripten/bind.h>
#include "geolib.cpp"

emscripten::val vectorFToJs(vector<float> vec)
{
    emscripten::val result = emscripten::val::array();
    for (int i = 0; i < vec.size(); i++)
    {
        result.set(i, vec[i]);
    }
    return result;
}

emscripten::val vectorIToJs(vector<int> vec)
{
    emscripten::val result = emscripten::val::array();
    for (int i = 0; i < vec.size(); i++)
    {
        result.set(i, vec[i]);
    }
    return result;
}

vector<float> JsToVectorF(emscripten::val jsArray)
{
    vector<float> result;
    int length = jsArray["length"].as<int>();
    for (int i = 0; i < length; i++)
    {
        result.push_back(jsArray[i].as<float>());
    }
    return result;
}

vector<string> JsToVectorS(emscripten::val jsArray)
{
    vector<string> result;
    int length = jsArray["length"].as<int>();
    for (int i = 0; i < length; i++)
    {
        result.push_back(jsArray[i].as<string>());
    }
    return result;
}

/*
============
== EMBIND ==
============
*/

EMSCRIPTEN_BINDINGS(my_module){
    // Binding per PointND (VectorXf)
    emscripten::class_<VectorXf>("PointND")
        .constructor<int>()
        .function("size", &VectorXf::size)
        .function("get", emscripten::optional_override([](const VectorXf& self, int i) {
            return self(i);
        }))
        .function("set", emscripten::optional_override([](VectorXf& self, int i, float val) {
            self(i) = val;
        }))
        .function("toArray", emscripten::optional_override([](const VectorXf& self) {
            std::vector<float> arr;
            for(int i = 0; i < self.size(); i++) {
                arr.push_back(self(i));
            }
            return arr;
        }));

    // Binding per SegmentND
    emscripten::class_<SegmentND>("SegmentND")
        .constructor<PointND, PointND>()
        .property("start", &SegmentND::start)
        .property("end", &SegmentND::end)
        .property("n", &SegmentND::n)
        .function("length", &SegmentND::length)
        .function("midpoint", &SegmentND::midpoint)
        .function("extendIn", &SegmentND::extendIn)
        .function("transform", &SegmentND::transform)
        .function("coincident", &SegmentND::coincident)
        .function("project", emscripten::select_overload<void(int)>(&SegmentND::project))
        .function("projectWithCam", emscripten::select_overload<void(int, float)>(&SegmentND::project));

    // Binding per FaceND
    emscripten::class_<FaceND>("FaceND")
        .constructor<vector<SegmentND>>()
        .property("verts", &FaceND::verts)
        .property("edges", &FaceND::edges)
        .property("n", &FaceND::n)
        .function("bar", &FaceND::bar)
        .function("transform", &FaceND::transform)
        .function("scalars", &FaceND::scalars)
        .function("coincident", &FaceND::coincident)
        .function("extendIn", &FaceND::extendIn)
        .function("project", emscripten::select_overload<void(int)>(&FaceND::project))
        .function("projectWithCam", emscripten::select_overload<void(int, float)>(&FaceND::project));

    // Binding per MatrixXf
    emscripten::class_<MatrixXf>("MatrixXf")
        .constructor<int, int>();

    // Binding per GeometryND
    emscripten::class_<GeometryND>("GeometryND")
        .constructor<int, vector<PointND>, vector<SegmentND>, vector<FaceND>>()
        .property("verts", &GeometryND::verts)
        .property("edges", &GeometryND::edges)
        .property("faces", &GeometryND::faces)
        .property("n", &GeometryND::n)
        .function("bar", &GeometryND::bar)
        .function("transform", &GeometryND::transform)
        .function("extendIn", &GeometryND::extendIn)
        .function("project", emscripten::select_overload<void(int)>(&GeometryND::project))
        .function("projectWithCam", emscripten::select_overload<void(int, float)>(&GeometryND::project))
        .function("getBufferVerts", &GeometryND::getBufferVerts)
        .function("getBufferEdgeIndices", &GeometryND::getBufferEdgeIndices);

    // Binding per Hypercube
    emscripten::class_<Hypercube, emscripten::base<GeometryND>>("Hypercube")
        .constructor<int, float>()
        .function("clone", emscripten::optional_override([](Hypercube& self) -> Hypercube* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &Hypercube::getBufferEdgeIndices);

    // Binding per Simplex
    emscripten::class_<Simplex, emscripten::base<GeometryND>>("Simplex")
        .constructor<int, float>()
        .function("clone", emscripten::optional_override([](Simplex& self) -> Simplex* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &Simplex::getBufferEdgeIndices);

    // Binding per Orthoplex
    emscripten::class_<Orthoplex, emscripten::base<GeometryND>>("Orthoplex")
        .constructor<int, float>()
        .function("clone", emscripten::optional_override([](Orthoplex& self) -> Orthoplex* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &Orthoplex::getBufferEdgeIndices);

    // Binding per Hypersphere
    emscripten::class_<Hypersphere, emscripten::base<GeometryND>>("Hypersphere")
        .constructor<int, float, int>()
        .function("clone", emscripten::optional_override([](Hypersphere& self) -> Hypersphere* {
            return self.clone();
        }), emscripten::allow_raw_pointers());
    
    // Binding per LowHypersphere
    emscripten::class_<LowHypersphere, emscripten::base<GeometryND>>("LowHypersphere")
        .constructor<int, float, int>()
        .function("clone", emscripten::optional_override([](LowHypersphere& self) -> LowHypersphere* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHypersphere::getBufferEdgeIndices);

    // Binding per Hypertorus
    emscripten::class_<Hypertorus, emscripten::base<GeometryND>>("Hypertorus")
        .constructor<int, float, float, int>()
        .function("clone", emscripten::optional_override([](Hypertorus& self) -> Hypertorus* {
            return self.clone();
        }), emscripten::allow_raw_pointers());
    
    // Binding per LowHypertorus
    emscripten::class_<LowHypertorus, emscripten::base<GeometryND>>("LowHypertorus")
        .constructor<int, float, float, int, int>()
        .function("clone", emscripten::optional_override([](LowHypertorus& self) -> LowHypertorus* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHypertorus::getBufferEdgeIndices);

    // Binding per LowHyperspherinder
    emscripten::class_<LowHyperspherinder, emscripten::base<GeometryND>>("LowHyperspherinder")
        .constructor<int, float, float, int, int>()
        .function("clone", emscripten::optional_override([](LowHyperspherinder& self) -> LowHyperspherinder* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHyperspherinder::getBufferEdgeIndices);

    // Binding per LowHypercone
    emscripten::class_<LowHypercone, emscripten::base<GeometryND>>("LowHypercone")
        .constructor<int, float, float, int, int>()
        .function("clone", emscripten::optional_override([](LowHypercone& self) -> LowHypercone* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHypercone::getBufferEdgeIndices);

    // Binding per funzioni utility
    emscripten::function("origin", &origin);
    emscripten::function("projectPoint", emscripten::select_overload<PointND(const PointND, int)>(&projectPoint));
    emscripten::function("projectPointWithCam", emscripten::select_overload<PointND(const PointND, int, float)>(&projectPoint));
    emscripten::function("extendPoint", &extendPoint);
    
    // FIX: Specifica esplicitamente il tipo di ritorno per distance
    emscripten::function("distance", emscripten::optional_override([](PointND p, PointND q) -> float {
        return distance(p, q);
    }));
    
    emscripten::function("barFromPoints", &barFromPoints);
    emscripten::function("createRotationMatrix", &createRotationMatrix);
    emscripten::function("vectorFToJs", &vectorFToJs);
    emscripten::function("vectorIToJs", &vectorIToJs);
    emscripten::function("JsToVectorF", &JsToVectorF);
    emscripten::function("JsToVectorS", &JsToVectorS);

    // Binding per vector types
    emscripten::register_vector<float>("VectorFloat");
    emscripten::register_vector<int>("VectorInt");
    emscripten::register_vector<PointND>("VectorPointND");
    emscripten::register_vector<SegmentND>("VectorSegmentND");
    emscripten::register_vector<FaceND>("VectorFaceND");
    emscripten::register_vector<std::string>("VectorString");
}