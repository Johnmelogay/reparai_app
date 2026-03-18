const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = appJson.expo || config || {};
  const iosKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || '';
  const androidKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || '';

  return {
    ...base,
    ios: {
      ...base.ios,
      config: {
        ...(base.ios && base.ios.config ? base.ios.config : {}),
        googleMapsApiKey: iosKey,
      },
    },
    android: {
      ...base.android,
      config: {
        ...(base.android && base.android.config ? base.android.config : {}),
        googleMaps: {
          ...((base.android && base.android.config && base.android.config.googleMaps) || {}),
          apiKey: androidKey,
        },
      },
    },
  };
};
