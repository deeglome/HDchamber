#include<emscripten/bind.h>
#include "geolib.cpp"
#include "Hyper/HyperCam.h"

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
        .function("extendIn", &SegmentND::extend_in)
        .function("transform", &SegmentND::transform)
        .function("coincident", &SegmentND::coincident)
        .function("intersect", &SegmentND::intersect);
        //.function("project", emscripten::select_overload<void(int)>(&SegmentND::project))
        //.function("projectWithCam", emscripten::select_overload<void(int, float)>(&SegmentND::project));

    // Binding per FaceND
    emscripten::class_<FaceND>("FaceND")
        .constructor<vector<PointND>>()
        .property("verts", &FaceND::verts)
        .property("edges", &FaceND::edges)
        .property("n", &FaceND::n)
        .function("bar", &FaceND::bar)
        .function("transform", &FaceND::transform)
        .function("coincident", &FaceND::coincident)
        .function("extendIn", &FaceND::extend_in);
        //.function("project", emscripten::select_overload<void(int)>(&FaceND::project))
        //.function("projectWithCam", emscripten::select_overload<void(int, float)>(&FaceND::project));

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
        .function("extendIn", &GeometryND::extend_in)
        //.function("project", emscripten::select_overload<void(int)>(&GeometryND::project))
        //.function("projectWithCam", emscripten::select_overload<void(int, float)>(&GeometryND::project))
        .function("renderWithCamChain", emscripten::optional_override(
            [](GeometryND& self, const std::vector<Hyper::HyperCam>& cam_chain, size_t first_dirty, emscripten::val cachedProjVal) {
                std::optional<GeometryND> cached_proj = std::nullopt;

                if (!cachedProjVal.isUndefined() && !cachedProjVal.isNull()) {
                    cached_proj = cachedProjVal.as<GeometryND>();
                }

                self.render_with_cam_chain(cam_chain, first_dirty, cached_proj);
            }
        ))
        .function("maxVertexDist", &GeometryND::max_vertex_dist)
        .function("getAbsoluteCrossSection", &GeometryND::get_absolute_cross_section)
        .function("getRelativeCrossSection", &GeometryND::get_relative_cross_section)
        .function("getBufferVerts", &GeometryND::get_buffer_verts)
        .function("getBufferEdgeIndices", &GeometryND::get_buffer_edge_indices);

    // Binding per AxesND
    emscripten::class_<AxesND, emscripten::base<GeometryND>>("AxesND")
        .constructor<int, float>()
        .function("clone", emscripten::optional_override([](AxesND& self) -> AxesND* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &AxesND::get_buffer_edge_indices);

    // Binding per Hypercube
    emscripten::class_<Hypercube, emscripten::base<GeometryND>>("Hypercube")
        .constructor<int, float>()
        .function("clone", emscripten::optional_override([](Hypercube& self) -> Hypercube* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &Hypercube::get_buffer_edge_indices);

    // Binding per Simplex
    emscripten::class_<Simplex, emscripten::base<GeometryND>>("Simplex")
        .constructor<int, float>()
        .function("clone", emscripten::optional_override([](Simplex& self) -> Simplex* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &Simplex::get_buffer_edge_indices);

    // Binding per Orthoplex
    emscripten::class_<Orthoplex, emscripten::base<GeometryND>>("Orthoplex")
        .constructor<int, float>()
        .function("clone", emscripten::optional_override([](Orthoplex& self) -> Orthoplex* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &Orthoplex::get_buffer_edge_indices);

    // Binding per Hypersphere
    emscripten::class_<Hypersphere, emscripten::base<GeometryND>>("Hypersphere")
        .constructor<int, vector<float>, float, int>()
        .function("clone", emscripten::optional_override([](Hypersphere& self) -> Hypersphere* {
            return self.clone();
        }), emscripten::allow_raw_pointers());

    // Binding per Joint
    emscripten::class_<Joint, emscripten::base<GeometryND>>("Joint")
        .property("start", &Joint::start)
        .property("end", &Joint::end)
        .function("clone", emscripten::optional_override([](Joint& self) -> Joint* {
            return self.clone();
        }), emscripten::allow_raw_pointers());

    // Binding per HypersphericalGeometry
    emscripten::class_<HypersphericalGeometry, emscripten::base<GeometryND>>("HypersphericalGeometry")
        .constructor<vector<Hypersphere>, bool>()
        .property("hspheres", &HypersphericalGeometry::hspheres)
        .property("joints", &HypersphericalGeometry::joints)
        .function("clone", emscripten::optional_override([](HypersphericalGeometry& self) -> HypersphericalGeometry* {
            return self.clone();
        }), emscripten::allow_raw_pointers());
    
    // Binding per LowHypersphere
    emscripten::class_<LowHypersphere, emscripten::base<GeometryND>>("LowHypersphere")
        .constructor<int, float, int>()
        .function("clone", emscripten::optional_override([](LowHypersphere& self) -> LowHypersphere* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHypersphere::get_buffer_edge_indices);
    
    // Binding per LowHypertorus
    emscripten::class_<LowHypertorus, emscripten::base<GeometryND>>("LowHypertorus")
        .constructor<int, float, float, int, int>()
        .function("clone", emscripten::optional_override([](LowHypertorus& self) -> LowHypertorus* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHypertorus::get_buffer_edge_indices);

    // Binding per LowHyperspherinder
    emscripten::class_<LowHyperspherinder, emscripten::base<GeometryND>>("LowHyperspherinder")
        .constructor<int, float, float, int, int>()
        .function("clone", emscripten::optional_override([](LowHyperspherinder& self) -> LowHyperspherinder* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHyperspherinder::get_buffer_edge_indices);

    // Binding per LowHypercone
    emscripten::class_<LowHypercone, emscripten::base<GeometryND>>("LowHypercone")
        .constructor<int, float, float, int, int>()
        .function("clone", emscripten::optional_override([](LowHypercone& self) -> LowHypercone* {
            return self.clone();
        }), emscripten::allow_raw_pointers())
        .function("getBufferEdgeIndices", &LowHypercone::get_buffer_edge_indices);

    // Binding per funzioni utility
    emscripten::function("origin", &origin);
    //emscripten::function("projectPoint", emscripten::select_overload<PointND(const PointND, int)>(&project_point));
    emscripten::function("extendPoint", &extend_point);
    emscripten::function("hypercamPosMatrix", &hypercam_pos_matrix);
    
    // FIX: Specifica esplicitamente il tipo di ritorno per distance
    emscripten::function("distance", emscripten::optional_override([](PointND p, PointND q) -> float {
        return distance(p, q);
    }));

    emscripten::function("hypertorus", emscripten::optional_override(
        [](int n, float Radius, float radius, int subdivs, int subdivsPerSphere) -> HypersphericalGeometry {
            return hypertorus(n, Radius, radius, subdivs, subdivsPerSphere);
        }
    ));
    emscripten::function("hyperspherinder", emscripten::optional_override(
        [](int n, float radius, float height, int subdivs) -> HypersphericalGeometry {
            return hyperspherinder(n, radius, height, subdivs);
        }
    ));
        emscripten::function("hypercone", emscripten::optional_override(
        [](int n, float radius, float height, int subdivs) -> Joint {
            return hypercone(n, radius, height, subdivs);
        }
    ));
    
    emscripten::function("barFromPoints", &bar_from_points);
    emscripten::function("createRotationMatrix", &create_rotation_matrix);
    emscripten::function("vectorFToJs", &vectorFToJs);
    emscripten::function("vectorIToJs", &vectorIToJs);
    emscripten::function("JsToVectorF", &JsToVectorF);
    emscripten::function("JsToVectorS", &JsToVectorS);

    /*
    ==================
    == HYPERCAM ======
    ==================
    */

    // Binding per Hyper::HyperCam
    emscripten::class_<Hyper::HyperCam>("HyperCam")
        .constructor<size_t, std::vector<float>>()
        .function("getAmbientDim", &Hyper::HyperCam::get_ambient_dim)
        .function("getRenderDim", &Hyper::HyperCam::get_render_dim)
        .function("getCamDistance", &Hyper::HyperCam::get_cam_distance)
        .function("getHypersphericalPos", &Hyper::HyperCam::get_hyperspherical_pos)
        .function("getCamMatrix", &Hyper::HyperCam::get_cam_matrix)
        .function("setHypersphericalPos", &Hyper::HyperCam::set_hyperspherical_pos)
        .function("updateCamMatrix", &Hyper::HyperCam::update_cam_matrix)
        .function("render", &Hyper::HyperCam::render);

    // getCamChain: due overload esplicite, dato che embind non supporta default args
    emscripten::function("getCamChain", emscripten::optional_override(
        [](size_t from_ambient_dim, size_t to_render_dim) -> std::vector<Hyper::HyperCam> {
            return Hyper::get_cam_chain(from_ambient_dim, to_render_dim);
        }
    ));

    emscripten::function("getCamChain", emscripten::optional_override(
        [](size_t from_ambient_dim, size_t to_render_dim, std::vector<float> hyperspherical_pos) -> std::vector<Hyper::HyperCam> {
            return Hyper::get_cam_chain(from_ambient_dim, to_render_dim, hyperspherical_pos);
        }
    ));

    // updateCamChain: dirty_flags passato come array JS nativo (val), per evitare vector<bool>
    emscripten::function("updateCamChain", emscripten::optional_override(
        [](std::vector<Hyper::HyperCam>& cam_chain, emscripten::val jsDirtyFlags) -> emscripten::val {
            int length = jsDirtyFlags["length"].as<int>();
            std::vector<bool> dirty_flags(length);
            for (int i = 0; i < length; i++) {
                dirty_flags[i] = jsDirtyFlags[i].as<bool>();
            }

            std::vector<size_t> updatedIndices = Hyper::update_cam_chain(cam_chain, dirty_flags);

            emscripten::val result = emscripten::val::array();
            for (size_t i = 0; i < updatedIndices.size(); i++) {
                result.set(i, static_cast<unsigned>(updatedIndices[i]));
            }
            return result;
        }
    ));


    // Binding per vector types
    emscripten::register_vector<float>("VectorFloat");
    emscripten::register_vector<int>("VectorInt");
    emscripten::register_vector<PointND>("VectorPointND");
    emscripten::register_vector<SegmentND>("VectorSegmentND");
    emscripten::register_vector<FaceND>("VectorFaceND");
    emscripten::register_vector<std::string>("VectorString");
    emscripten::register_vector<Joint>("VectorJoint");
    emscripten::register_vector<Hyper::HyperCam>("VectorHyperCam");
}