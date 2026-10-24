const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const SCENE_DELEGATE = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
    appDelegate.window = window
    self.window = window

    for context in connectionOptions.urlContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        continue: activity,
        restorationHandler: { _ in }
      )
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
`;

function withIosSceneLifecycle(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const matches = [];
      for (const entry of fs.readdirSync(projectRoot)) {
        const candidate = path.join(projectRoot, entry, 'AppDelegate.swift');
        if (fs.existsSync(candidate)) matches.push(candidate);
      }
      if (matches.length !== 1) {
        throw new Error('Failed to find AppDelegate.swift for the UIScene lifecycle.');
      }

      let source = fs.readFileSync(matches[0], 'utf8');
      if (!source.includes('var launchOptions:')) {
        source = source.replace(
          'var reactNativeFactory: RCTReactNativeFactory?\n',
          'var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
        );
      }
      if (source.includes(WINDOW_BLOCK)) {
        source = source.replace(WINDOW_BLOCK, 'self.launchOptions = launchOptions');
      }
      if (!source.includes('class SceneDelegate')) {
        source = `${source.trimEnd()}\n${SCENE_DELEGATE}`;
      }
      fs.writeFileSync(matches[0], source);
      return config;
    },
  ]);
}

module.exports = withIosSceneLifecycle;
