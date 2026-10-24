import SwiftUI
import WidgetKit

struct NowPlayingEntry: TimelineEntry {
  let date: Date
  let title: String
  let showTitle: String
  let playing: Bool

  var headline: String {
    title.isEmpty ? "奧笛流" : title
  }
}

struct ComplicationProvider: TimelineProvider {
  func placeholder(in context: Context) -> NowPlayingEntry {
    NowPlayingEntry(date: Date(), title: "奧笛流", showTitle: "點一下打開", playing: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (NowPlayingEntry) -> Void) {
    completion(load())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NowPlayingEntry>) -> Void) {
    let entry = load()
    let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }

  private func load() -> NowPlayingEntry {
    NowPlayingEntry(date: Date(), title: "奧笛流", showTitle: "點一下打開", playing: false)
  }
}

struct ComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: NowPlayingEntry

  var body: some View {
    content
      .containerBackground(for: .widget) {
        AccessoryWidgetBackground()
      }
  }

  @ViewBuilder
  private var content: some View {
    switch family {
    case .accessoryInline:
      Label(entry.headline, systemImage: entry.playing ? "waveform" : "headphones")
    case .accessoryCircular:
      Image(systemName: entry.playing ? "waveform" : "headphones")
        .font(.title3)
    case .accessoryCorner:
      Image(systemName: entry.playing ? "waveform" : "headphones")
        .widgetLabel(entry.headline)
    default:
      VStack(alignment: .leading, spacing: 2) {
        Label("奧笛流", systemImage: entry.playing ? "waveform" : "headphones")
          .font(.headline)
        Text(entry.title.isEmpty ? "點一下打開" : entry.headline)
          .font(.caption2)
          .lineLimit(2)
        if !entry.showTitle.isEmpty {
          Text(entry.showTitle)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct ComplicationWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AudioFlowComplication", provider: ComplicationProvider()) { entry in
      ComplicationView(entry: entry)
    }
    .configurationDisplayName("奧笛流")
    .description("在錶面上打開奧笛流")
    .supportedFamilies([
      .accessoryCircular,
      .accessoryCorner,
      .accessoryInline,
      .accessoryRectangular,
    ])
  }
}

@main
struct ComplicationBundle: WidgetBundle {
  var body: some Widget {
    ComplicationWidget()
  }
}
