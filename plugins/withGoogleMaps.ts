import { ConfigPlugin, withAppDelegate, withPodfile } from '@expo/config-plugins';

const IOS_API_KEY_ENV = 'EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY';

const addGoogleMapsPod = (podfile: string) => {
  if (podfile.includes("pod 'GoogleMaps'")) {
    return podfile;
  }

  return podfile.replace(
    /target ['"].*?['"] do/,
    (match) =>
      `${match}\n  pod 'GoogleMaps'\n  pod 'Google-Maps-iOS-Utils'`
  );
};

const withGoogleMapsPods: ConfigPlugin = (config) =>
  withPodfile(config, (config) => {
    config.modResults.contents = addGoogleMapsPod(config.modResults.contents);
    return config;
  });

const withGoogleMapsAppDelegate: ConfigPlugin = (config) =>
  withAppDelegate(config, (config) => {
    const apiKey = process.env[IOS_API_KEY_ENV];
    if (!apiKey) {
      return config;
    }

    const { modResults } = config;
    const { language } = modResults;

    if (language === 'objc') {
      if (!modResults.contents.includes('#import <GoogleMaps/GoogleMaps.h>')) {
        modResults.contents = modResults.contents.replace(
          '#import "AppDelegate.h"',
          '#import "AppDelegate.h"\n#import <GoogleMaps/GoogleMaps.h>'
        );
      }

      if (!modResults.contents.includes('[GMSServices provideAPIKey')) {
        modResults.contents = modResults.contents.replace(
          /didFinishLaunchingWithOptions[^}]*\{/,
          (match) =>
            `${match}\n  [GMSServices provideAPIKey:@"${apiKey}"];`
        );
      }
    } else if (language === 'swift') {
      if (!modResults.contents.includes('import GoogleMaps')) {
        modResults.contents = modResults.contents.replace(
          'import ExpoModulesCore',
          'import ExpoModulesCore\nimport GoogleMaps'
        );
      }

      if (!modResults.contents.includes('GMSServices.provideAPIKey')) {
        modResults.contents = modResults.contents.replace(
          /didFinishLaunchingWithOptions[^)]*\) -> Bool \{/,
          (match) =>
            `${match}\n    GMSServices.provideAPIKey("${apiKey}")`
        );
      }
    }

    return config;
  });

const withGoogleMaps: ConfigPlugin = (config) => {
  config = withGoogleMapsPods(config);
  config = withGoogleMapsAppDelegate(config);
  return config;
};

export default withGoogleMaps;
