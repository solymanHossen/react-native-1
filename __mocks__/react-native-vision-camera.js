// Manual Jest mock for react-native-vision-camera — the real module checks
// for its native TurboModule at import time, which throws outside a native
// runtime. Covers only what PrescriptionCameraView.tsx actually uses.
const React = require('react');
const { View } = require('react-native');

const Camera = React.forwardRef(function Camera(props, ref) {
  React.useImperativeHandle(ref, () => ({
    takePhoto: () => Promise.resolve({ path: '/mock/photo.jpg', width: 0, height: 0, isRawPhoto: false, orientation: 'portrait', isMirrored: false }),
    takeSnapshot: () => Promise.resolve({ path: '/mock/photo.jpg', width: 0, height: 0, isRawPhoto: false, orientation: 'portrait', isMirrored: false }),
  }));
  return React.createElement(View, { testID: 'mock-camera' });
});

function useCameraDevice() {
  return undefined;
}

function useCameraPermission() {
  return { hasPermission: false, requestPermission: () => Promise.resolve(false) };
}

function useMicrophonePermission() {
  return { hasPermission: false, requestPermission: () => Promise.resolve(false) };
}

module.exports = {
  __esModule: true,
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
};
