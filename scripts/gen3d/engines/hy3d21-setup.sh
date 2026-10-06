#!/bin/bash
# Hunyuan3D-2.1's PBR texture model (hunyuan3d-paintpbr-v2-1), in an env of its own, to paint
# the multi-view mesh Hunyuan3D-2mv makes (engines/hunyuan.py). Run in WSL after hy3d-setup.sh.
set -x
source ~/miniforge3/bin/activate
conda create -y -n hy3d21 python=3.10 || true
conda activate hy3d21
conda install -y -c nvidia/label/cuda-12.8.1 cuda-toolkit cuda-nvcc cuda-cudart-dev
export CUDA_HOME=$CONDA_PREFIX TORCH_CUDA_ARCH_LIST=12.0 MAX_JOBS=14
pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
[ -d ~/Hunyuan3D-2.1 ] || git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1.git ~/Hunyuan3D-2.1
cd ~/Hunyuan3D-2.1
pip install -r requirements.txt
cd hy3dpaint/custom_rasterizer && pip install -e . --no-build-isolation && cd ../..
pip install pybind11
cd hy3dpaint/DifferentiableRenderer && CPLUS_INCLUDE_PATH=$(python -c "import pybind11;print(pybind11.get_include())") bash compile_mesh_painter.sh && cd ../..
pip install "huggingface_hub[hf_xet]"
hf download tencent/Hunyuan3D-2.1 --include "hunyuan3d-paintpbr-v2-1/*"
# the RealESRGAN upscaler the paint pipeline loads
mkdir -p hy3dpaint/ckpt && [ -f hy3dpaint/ckpt/RealESRGAN_x4plus.pth ] || wget -q -O hy3dpaint/ckpt/RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
python -c "import torch; print('HY3D21-OK', torch.cuda.is_available())"
echo HY3D21-SETUP-DONE
