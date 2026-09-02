#pragma once
#include<cstddef>
#include<vector>
#include<Eigen/Dense>

namespace Hyper
{
    class HyperCam
    {
        public:
        HyperCam(size_t ambient_dim, const std::vector<float>& hyperspherical_pos = {});

        size_t get_ambient_dim() const { return ambient_dim; }
        size_t get_render_dim() const { return ambient_dim-1; }
        float get_cam_distance() const { return hyperspherical_pos[0]; }
        const std::vector<float>& get_hyperspherical_pos() const { return hyperspherical_pos; }
        Eigen::MatrixXf get_cam_matrix() const { return cam_matrix; };

        void set_hyperspherical_pos(const std::vector<float>& pos);

        void update_cam_matrix();
        Eigen::VectorXf render(const Eigen::VectorXf& p) const;

        private:
        size_t ambient_dim;
        std::vector<float> hyperspherical_pos;

        /**
         * A matrix that maps the camera from its canonical position (the one where `hyperspherical_pos = (ρ,0,0,...,0)`) to its current position described by `hyperspherical_pos`.
         * `cam_matrix ^ -1 == cam_matrix ^ T` (it's a rotation matrix. Therefore it's orthogonal).
         */
        Eigen::MatrixXf cam_matrix;
    };

    std::vector<HyperCam> get_cam_chain(const size_t from_ambient_dim, const size_t to_render_dim, std::vector<std::vector<float>> hyperspherical_pos_list = {});
    std::vector<size_t> update_cam_chain(std::vector<HyperCam>& cam_chain, std::vector<bool>& dirty_flags);
}