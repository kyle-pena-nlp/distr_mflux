from huggingface_hub import snapshot_download
from mflux.config.model_config import ModelConfig
from argparse import ArgumentParser

if __name__ == '__main__':

    parser = ArgumentParser()
    # The other choice - dev - requires special access token. So I am omitting it from the `choices` array
    parser.add_argument('--model_alias', type=str, default='schnell', choices=['schnell'])
    args = parser.parse_args()
    model_config = ModelConfig.from_alias(args.model_alias)

    snapshot_download(
        repo_id=model_config.model_name,
        allow_patterns=[
            "text_encoder/*.safetensors",
            "text_encoder_2/*.safetensors",
            "transformer/*.safetensors",
            "vae/*.safetensors",
        ],
    )