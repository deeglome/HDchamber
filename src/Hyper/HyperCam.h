#pragma once
#include<cstddef>
#include<vector>
#include<Eigen/Dense>

namespace Hyper
{
    class HyperCam
    {
        public:
        HyperCam(size_t ambdim, const std::vector<float>& hyperspherical_pos = {}, size_t destdim = 3);

        size_t get_ambient_dim() const { return ambdim; }
        size_t get_destination_dim() const { return destdim; }
        float get_cam_distance() const { return hyperspherical_pos[0]; }
        const std::vector<float>& get_hyperspherical_pos() const { return hyperspherical_pos; }
        const std::vector<Eigen::MatrixXf>& get_stages_all() const { return stages; }
        std::vector<Eigen::MatrixXf> get_stages(size_t start, size_t end) const;
        std::vector<HyperCam> get_cams_chain() const;

        Eigen::VectorXf project(const Eigen::VectorXf& p, size_t to_ambient_dim) const;

        private:
        size_t ambdim;
        size_t destdim;
        std::vector<float> hyperspherical_pos;
        std::vector<Eigen::MatrixXf> stages;
    };
}