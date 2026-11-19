const { createGame } = require('./src/game-app');
const { createPlatform } = require('./src/wechat-platform');

createGame(createPlatform());
