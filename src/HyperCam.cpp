#include "Hyper/HyperCam.h"
#include <string>
#include <stdexcept>
#include <cmath>

using namespace Eigen;

namespace Hyper
{
    namespace
    {
        constexpr float EPS = 1e-6f;
        constexpr size_t N = 6;
        constexpr float CAMDIST = 3.0f;
        const std::string AXIS_IDS = "xyzwvu";

        // Costruisce una matrice di rotazione NxN componendo più rotazioni
        // elementari (una per coppia piano/angolo), nell'ordine in cui sono
        // fornite. Identica, in spirito, a create_rotation_matrix in geolib.cpp.
        MatrixXf create_rotation_matrix(int n, const std::vector<std::string>& planes, const std::vector<float>& angles)
        {
            if (planes.size() != angles.size())
                throw std::invalid_argument("Number of planes and angles must be the same.");

            MatrixXf R = MatrixXf::Identity(n, n);

            for (size_t k = 0; k < planes.size(); ++k)
            {
                const std::string& plane = planes[k];
                if (plane.length() != 2 || plane[0] == plane[1])
                    throw std::invalid_argument("Invalid plane entered: " + plane);

                int i = static_cast<int>(AXIS_IDS.find(plane[0]));
                int j = static_cast<int>(AXIS_IDS.find(plane[1]));

                if (i >= n || j >= n)
                    throw std::invalid_argument("Cannot operate with plane '" + plane + "' in " + std::to_string(n) + " dimensions.");

                MatrixXf partialR = MatrixXf::Identity(n, n);

                float cos_a = std::abs(std::cos(angles[k])) < EPS ? 0.0f : std::cos(angles[k]);
                float sin_a = std::abs(std::sin(angles[k])) < EPS ? 0.0f : std::sin(angles[k]);

                partialR(i, i) = cos_a;
                partialR(i, j) = -sin_a;
                partialR(j, i) = sin_a;
                partialR(j, j) = cos_a;

                R = partialR * R;
            }
            return R;
        }

        // Perspective divide: proietta un punto già "trasformato" (ruotato +
        // traslato dallo stadio corrente) da n a n-1 dimensioni.
        VectorXf perspective_divide(const VectorXf& p, int low_dim)
        {
            if (p.size() == low_dim) return p;

            const float depth = -p(p.size() - 1);
            if (std::abs(depth) < EPS)
                throw std::runtime_error("Point too close to camera plane, division unstable.");

            const float fact = 1.0f / depth;

            VectorXf proj(low_dim);
            for (int i = 0; i < low_dim; ++i)
                proj(i) = p(i) * fact;

            return proj;
        }
    }

    HyperCam::HyperCam(size_t ambient_dim, const std::vector<float>& hyperspherical_pos)
    {
        if (ambient_dim > N)
            throw std::invalid_argument(
                 "Expected lower ambient_dim: " + std::to_string(ambient_dim) + ">" + std::to_string(N) + ".");
        this->ambient_dim = ambient_dim;
        
        if (hyperspherical_pos.empty())
        {
            this->hyperspherical_pos = std::vector<float>(this->ambient_dim, 0.0f);
            this->hyperspherical_pos[0] = CAMDIST;
        }
        else
            this->hyperspherical_pos = hyperspherical_pos;

        if (this->hyperspherical_pos.size() != this->ambient_dim)
            throw std::invalid_argument(
                "Expected " + std::to_string(this->ambient_dim) + " hyperspherical coords, got " +
                std::to_string(this->hyperspherical_pos.size()) + ".");
        
        update_cam_matrix();
    }

    void HyperCam::set_hyperspherical_pos(const std::vector<float>& pos)
    {
        if(this->hyperspherical_pos.size() != pos.size())
            throw std::invalid_argument(
                "Expected " + std::to_string(this->ambient_dim) + " hyperspherical coords, got " +
                std::to_string(pos.size()) + ".");
        
        this->hyperspherical_pos = pos;
    }

    void HyperCam::update_cam_matrix()
    {
        std::vector<std::string> planes;
        for (int n = 1; n < this->ambient_dim; ++n)
            planes.push_back(std::string(1, AXIS_IDS[n-1]) + std::string(1, AXIS_IDS[n]));

        std::vector<float> angles = std::vector<float>(this->hyperspherical_pos.begin() + 1, this->hyperspherical_pos.end());
        this->cam_matrix = create_rotation_matrix(this->ambient_dim, planes, angles);
    }

    Eigen::VectorXf HyperCam::render(const Eigen::VectorXf& p) const
    {
        if( p.size() != this->ambient_dim )
            throw std::invalid_argument(
                "Expected a " + std::to_string(this->ambient_dim) + "-dimensional point, got a " + std::to_string(p.size()) + "-dimensional one.");
        Eigen::VectorXf p_rend = p;
        // Bring back cam to origin.
        p_rend = cam_matrix.transpose() * p_rend;
        p_rend(p_rend.size() - 1) -= hyperspherical_pos[0];
        // Project in ambient_dim - 1.
        p_rend = perspective_divide(p_rend, this->ambient_dim-1);
        return p_rend;
    }

    std::vector<HyperCam> get_cam_chain(const size_t from_ambient_dim, const size_t to_render_dim, std::vector<float> hyperspherical_pos)
    {
        std::vector<HyperCam> chain;
        if(from_ambient_dim - to_render_dim <= 0)
            throw std::invalid_argument("from_ambient_dim must be greater than to_render_dim. Empty camera chain is not allowed.");
        for(size_t i=0; i < from_ambient_dim - to_render_dim; i++)
        {
            std::vector<float> hs_pos;
            if( !hyperspherical_pos.empty() )
                hs_pos = std::vector<float>(hyperspherical_pos.begin(), hyperspherical_pos.end() - i);
            size_t n = from_ambient_dim - i;
            chain.push_back( Hyper::HyperCam(n, hs_pos) );
        }
        return chain;
    }

    std::vector<size_t> update_cam_chain(std::vector<HyperCam>& cam_chain, std::vector<bool>& dirty_flags)
    {
        if (cam_chain.size() != dirty_flags.size())
            throw std::invalid_argument("cam_chain and dirty_flags must have the same size.");

        std::vector<size_t> updated;
        for (size_t i = 0; i < cam_chain.size(); ++i) {
            if (!dirty_flags[i]) continue;
            cam_chain[i].update_cam_matrix();
            dirty_flags[i] = false;
            updated.push_back(i);
        }
        return updated;
    }
}