INPUT_GITHUB_TOKEN=$(cat .secrets | grep GITHUB_TOKEN | cut -d= -f2) \
INPUT_WAKATIME_KEY=$(cat .secrets | grep WAKATIME_KEY | cut -d= -f2) \
INPUT_USERNAME=$(cat .secrets | grep GITHUB_USER | cut -d= -f2) \
INPUT_TEMPLATE=./example/TEMPLATE.md \
INPUT_README=./example/README.md \
INPUT_FEED=./example/FEEDS.json \
node dist/index.js
