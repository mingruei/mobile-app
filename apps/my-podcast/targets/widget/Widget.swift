import SwiftUI
import WidgetKit

struct AudioFlowEntry: TimelineEntry {
  let date: Date
}

struct AudioFlowProvider: TimelineProvider {
  func placeholder(in context: Context) -> AudioFlowEntry {
    AudioFlowEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (AudioFlowEntry) -> Void) {
    completion(AudioFlowEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AudioFlowEntry>) -> Void) {
    let entry = AudioFlowEntry(date: Date())
    let refresh = Calendar.current.date(byAdding: .hour, value: 6, to: Date()) ?? Date().addingTimeInterval(6 * 60 * 60)
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }
}

struct AudioFlowWidgetView: View {
  @Environment(\.widgetFamily) private var family

  var body: some View {
    content
      .widgetURL(URL(string: "my-podcast://play"))
      .modifier(WidgetChrome())
  }

  @ViewBuilder
  private var content: some View {
    switch family {
    case .accessoryInline:
      Label("奧笛流", systemImage: "headphones")
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Label("奧笛流", systemImage: "headphones")
          .font(.headline)
        Text("點一下播放")
          .font(.caption2)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    case .systemMedium:
      HStack(spacing: 14) {
        Image(systemName: "headphones")
          .font(.system(size: 36, weight: .bold))
          .foregroundStyle(Color("$accent"))
        VStack(alignment: .leading, spacing: 6) {
          Text("奧笛流")
            .font(.title2.weight(.heavy))
            .foregroundStyle(Color("WidgetInk"))
          Text("點一下播放。有在聽就接著播，否則從列表第一集開始。")
            .font(.body)
            .foregroundStyle(Color("WidgetMuted"))
        }
        Spacer(minLength: 0)
      }
    default:
      VStack(alignment: .leading, spacing: 8) {
        Image(systemName: "headphones")
          .font(.system(size: 28, weight: .bold))
          .foregroundStyle(Color("$accent"))
        Spacer(minLength: 0)
        Text("奧笛流")
          .font(.headline.weight(.heavy))
          .foregroundStyle(Color("WidgetInk"))
        Text("點一下播放")
          .font(.caption)
          .foregroundStyle(Color("WidgetMuted"))
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
  }
}

private struct WidgetChrome: ViewModifier {
  @Environment(\.widgetFamily) private var family

  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) {
        background
      }
    } else {
      content.padding().background(background)
    }
  }

  @ViewBuilder
  private var background: some View {
    if family == .accessoryInline || family == .accessoryRectangular || family == .accessoryCircular {
      AccessoryWidgetBackground()
    } else {
      Color("$widgetBackground")
    }
  }
}

struct AudioFlowHomeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AudioFlowHomeWidget", provider: AudioFlowProvider()) { _ in
      AudioFlowWidgetView()
    }
    .configurationDisplayName("奧笛流")
    .description("點一下播放正在聽的單集，或播放列表的第一集")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryRectangular,
      .accessoryInline,
    ])
  }
}

@main
struct AudioFlowWidgetBundle: WidgetBundle {
  var body: some Widget {
    AudioFlowHomeWidget()
  }
}
