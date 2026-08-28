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

    HyperCam::HyperCam(size_t ambdim_, const std::vector<float>& hyperspherical_pos_, size_t destdim_)
        : ambdim(ambdim_), destdim(destdim_)
    {
        const size_t num_stages = ambdim - destdim; // riduzioni fino a 3D: N->N-1->...->3

        if (hyperspherical_pos_.empty())
        {
            hyperspherical_pos = std::vector<float>(ambdim, 0.0f);
            hyperspherical_pos[0] = CAMDIST;
        }
        else
            hyperspherical_pos = hyperspherical_pos_;

        if (hyperspherical_pos.size() != ambdim)
            throw std::invalid_argument(
                "Expected " + std::to_string(num_stages) + " hyperspherical angles, got " +
                std::to_string(hyperspherical_pos.size()) + ".");

        stages.reserve(num_stages);

        for (size_t stage = 0; stage < num_stages; ++stage)
        {
            int n = static_cast<int>(ambdim) - static_cast<int>(stage); // dimensione corrente a questo stadio

            // ruota nel piano formato dagli ultimi due assi rimasti (n-2, n-1)
            std::string plane = std::string(1, AXIS_IDS[n - 2]) + std::string(1, AXIS_IDS[n - 1]);
            MatrixXf R = create_rotation_matrix(n, {plane}, {hyperspherical_pos[stage]});

            // fix di convenzione (Y-up di Three.js), applicato solo al primo
            // stadio, dove il piano xy/yz esiste ancora nella sua forma "piena"
            if (stage == 0 && n >= 3)
            {
                float theta = hyperspherical_pos.size() > 0 ? hyperspherical_pos[0] : 0.0f;
                float phi = hyperspherical_pos.size() > 1 ? hyperspherical_pos[1] : 0.0f;
                MatrixXf R_fix = create_rotation_matrix(n, {"yz", "xy"}, {-phi, -theta});
                R = R_fix * R;
            }

            stages.push_back(R);
        }
    }

    std::vector<MatrixXf> HyperCam::get_stages(size_t start, size_t end) const
    {
        if (start > end || end > stages.size())
            throw std::out_of_range("Invalid stage range requested.");

        return std::vector<MatrixXf>(stages.begin() + start, stages.begin() + end);
    }

    VectorXf HyperCam::project(const VectorXf& p, size_t to_ambient_dim) const
    {
        if (static_cast<size_t>(p.size()) != ambdim)
            throw std::invalid_argument("Point dimension does not match camera's ambient dimension.");
        if (to_ambient_dim > ambdim)
            throw std::invalid_argument("Cannot project to a higher dimension than the ambient one.");

        VectorXf current = p;

        for (const MatrixXf& R : stages)
        {
            if (static_cast<size_t>(current.size()) <= to_ambient_dim) break;

            int n = static_cast<int>(current.size());
            if (R.rows() != n)
                throw std::invalid_argument("Stage matrix dimension mismatch.");

            current = R * current;              // rotazione di questo stadio
            current(n - 1) -= hyperspherical_pos[0];           // traslazione lungo l'asse camera
            current = perspective_divide(current, n - 1); // riduzione di una dimensione
        }

        return current;
    }

    std::vector<HyperCam> get_cams_chain()
    {
        return {};
    }
}