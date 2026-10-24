import SwiftUI

@main
struct WatchEntry: App {
  @StateObject private var model = WatchModel()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(model)
    }
  }
}
