import SwiftUI
import WatchKit

struct ContentView: View {
  @EnvironmentObject private var model: WatchModel

  var body: some View {
    NavigationStack {
      List {
        if model.episodes.isEmpty {
          Text("手機把音檔傳到手表之後，單集會列在這裡。")
            .multilineTextAlignment(.center)
        } else {
          Section("在手表上") {
            ForEach(model.episodes) { episode in
              NavigationLink {
                EpisodeScreen(episodeId: episode.id)
              } label: {
                VStack(alignment: .leading, spacing: 2) {
                  Text(episode.title)
                    .font(.headline)
                  Text(episode.showTitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                  Text(rowStatus(episode))
                    .font(.caption2)
                }
              }
              .swipeActions {
                Button("刪除", role: .destructive) {
                  model.delete(episode)
                }
              }
            }
          }
        }
      }
      .navigationTitle("奧笛流")
      .onAppear {
        model.refreshLibrary()
      }
    }
  }

  private func rowStatus(_ episode: WatchEpisode) -> String {
    if model.playing, model.current?.id == episode.id {
      return "播放中"
    }
    return model.statusLine(episode)
  }
}

private struct EpisodeScreen: View {
  let episodeId: String
  @EnvironmentObject private var model: WatchModel

  private var episode: WatchEpisode? {
    model.episodes.first { $0.id == episodeId }
  }

  var body: some View {
    if let episode {
      let playingThis = model.playing && model.current?.id == episode.id
      VStack(alignment: .leading, spacing: 8) {
        Text(episode.title)
          .font(.headline)
        Text(episode.showTitle)
          .font(.caption2)
          .foregroundStyle(.secondary)
        if model.isDownloading(episode.id) {
          Text(model.downloadProgressText(episode.id))
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
        } else {
          Text("\(formatClock(episode.positionMillis)) / \(formatClock(episode.durationMillis))")
            .font(.caption.monospacedDigit())
        }
        Button(playingThis ? "暫停" : "播放") {
          model.play(episode)
        }
        .disabled(model.isDownloading(episode.id))
        HStack {
          Button("後退") { model.seek(episode, by: -15) }
          Button("前進") { model.seek(episode, by: 30) }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .background {
        CrownVolumeControl(isPlaying: true)
          .frame(width: 0, height: 0)
          .opacity(0)
          .accessibilityHidden(true)
      }
      .navigationTitle("奧笛流")
    } else {
      Text("這一集已經不在手表上")
        .navigationTitle("奧笛流")
    }
  }
}

private struct CrownVolumeControl: WKInterfaceObjectRepresentable {
  var isPlaying: Bool

  func makeWKInterfaceObject(context: Context) -> WKInterfaceVolumeControl {
    WKInterfaceVolumeControl(origin: .local)
  }

  func updateWKInterfaceObject(_ control: WKInterfaceVolumeControl, context: Context) {
    if isPlaying && !context.coordinator.wasPlaying {
      context.coordinator.wasPlaying = true
      DispatchQueue.main.async {
        control.focus()
      }
    } else if !isPlaying && context.coordinator.wasPlaying {
      context.coordinator.wasPlaying = false
      control.resignFocus()
    }
  }

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  final class Coordinator {
    var wasPlaying = false
  }
}

private func formatClock(_ millis: Double) -> String {
  let total = max(0, Int(millis / 1000))
  let minutes = (total % 3600) / 60
  let seconds = total % 60
  let hours = total / 3600
  if hours > 0 {
    return String(format: "%d:%02d:%02d", hours, minutes, seconds)
  }
  return String(format: "%d:%02d", minutes, seconds)
}
