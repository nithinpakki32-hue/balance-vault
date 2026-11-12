let appInstance;

module.exports = async (req, res) => {
  if (!appInstance) {
    let mod;
    try {
      mod = await import('../dist/app.js');
    } catch {
      mod = require('../dist/app.js');
    }
    const createApp = mod.createApp || mod.default?.createApp || mod.default;
    appInstance = createApp();
  }
  return appInstance(req, res);
};
