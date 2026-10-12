// Manual Jest mock for react-native-tts — the real module calls
// NativeModules/TurboModuleRegistry at import time, which throws outside a
// native runtime. Mirrors the default-export shape index.d.ts declares.
const getInitStatus = jest.fn().mockResolvedValue('success');
const requestInstallEngine = jest.fn().mockResolvedValue('success');
const requestInstallData = jest.fn().mockResolvedValue('success');
const setDucking = jest.fn().mockResolvedValue('success');
const setDefaultEngine = jest.fn().mockResolvedValue(true);
const setDefaultVoice = jest.fn().mockResolvedValue('success');
const setDefaultRate = jest.fn().mockResolvedValue('success');
const setDefaultPitch = jest.fn().mockResolvedValue('success');
const setDefaultLanguage = jest.fn().mockResolvedValue('success');
const setIgnoreSilentSwitch = jest.fn().mockResolvedValue(true);
const voices = jest.fn().mockResolvedValue([]);
const engines = jest.fn().mockResolvedValue([]);
const speak = jest.fn().mockReturnValue('utterance-id');
const stop = jest.fn().mockResolvedValue(true);
const pause = jest.fn().mockResolvedValue(true);
const resume = jest.fn().mockResolvedValue(true);
const addEventListener = jest.fn();
const removeEventListener = jest.fn();

const Tts = {
  getInitStatus,
  requestInstallEngine,
  requestInstallData,
  setDucking,
  setDefaultEngine,
  setDefaultVoice,
  setDefaultRate,
  setDefaultPitch,
  setDefaultLanguage,
  setIgnoreSilentSwitch,
  voices,
  engines,
  speak,
  stop,
  pause,
  resume,
  addEventListener,
  removeEventListener,
};

module.exports = {
  __esModule: true,
  default: Tts,
};
