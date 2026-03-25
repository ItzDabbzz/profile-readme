INPUT_GITHUB_TOKEN=$(cat .secrets | grep GITHUB_TOKEN | cut -d= -f2) \
INPUT_WAKATIME_KEY=$(cat .secrets | grep WAKATIME_KEY | cut -d= -f2) \
INPUT_USERNAME=$(cat .secrets | grep GITHUB_USER | cut -d= -f2) \
INPUT_TEMPLATE=./test/TEMPLATE.md \
INPUT_README=./test/README.md \
INPUT_FEED=./test/FEEDS.json \
node dist/index.js