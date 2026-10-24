import ExpoModulesCore
import WatchConnectivity

final class PhoneWatchSession: NSObject, WCSessionDelegate {
  static let shared = PhoneWatchSession()

  var onProgress: (([String: Any]) -> Void)?
  private var started = false
  private let transferLock = NSLock()
  private var pendingTransfers: [PendingEpisodeTransfer] = []
  private var trackedTransfers: [ObjectIdentifier: TrackedFileTransfer] = [:]
  private var progressTimer: Timer?
  private var lastProgressEmitAt: [String: TimeInterval] = [:]
  private var lastProgressPercent: [String: Int] = [:]

  func start() {
    guard WCSession.isSupported(), !started else { return }
    started = true
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func latestProgress() -> [String: Any]? {
    start()
    guard WCSession.isSupported() else { return nil }
    return progressPayload(WCSession.default.receivedApplicationContext)
  }

  func sendEpisode(
    uri: String,
    episodeId: String,
    title: String,
    showTitle: String,
    positionMillis: Double,
    startPlayback: Bool,
    publishedAt: String?,
    episodeOrder: String
  ) throws {
    guard WCSession.isSupported() else {
      throw watchError("這支手機不能連 Apple Watch。")
    }
    let fileURL = localFileURL(uri)
    guard FileManager.default.fileExists(atPath: fileURL.path) else {
      throw watchError("手機上找不到這一集的音檔。")
    }
    guard fileByteCount(fileURL) > 0 else {
      throw watchError("手機上的音檔是空的，沒有傳到手表。")
    }
    var metadata: [String: Any] = [
      "episodeId": episodeId,
      "title": title,
      "showTitle": showTitle,
      "positionMillis": positionMillis,
      "startPlayback": startPlayback,
      "episodeOrder": episodeOrder == "oldest" ? "oldest" : "newest",
    ]
    if let publishedAt, !publishedAt.isEmpty {
      metadata["publishedAt"] = publishedAt
    }
    let transfer = PendingEpisodeTransfer(
      url: fileURL,
      metadata: metadata
    )
    start()
    let session = WCSession.default
    guard session.activationState == .activated else {
      transferLock.lock()
      pendingTransfers.append(transfer)
      transferLock.unlock()
      return
    }
    try deliver(transfer, session: session)
  }

  func deleteEpisodeOnWatch(episodeId: String) {
    guard WCSession.isSupported(), !episodeId.isEmpty else { return }
    start()
    let session = WCSession.default
    guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
    let payload = ["deleteEpisodeId": episodeId]
    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
        session.transferUserInfo(payload)
      })
    } else {
      session.transferUserInfo(payload)
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated else { return }
    transferLock.lock()
    let batch = pendingTransfers
    pendingTransfers = []
    transferLock.unlock()
    if session.isPaired, session.isWatchAppInstalled {
      for transfer in batch where FileManager.default.fileExists(atPath: transfer.url.path) {
        enqueueTransfer(transfer, session: session)
      }
    }
    emit(session.receivedApplicationContext)
  }

  private func deliver(_ transfer: PendingEpisodeTransfer, session: WCSession) throws {
    guard session.isPaired else {
      throw watchError("這支手機沒有配對 Apple Watch。")
    }
    guard session.isWatchAppInstalled else {
      throw watchError("手表上的續播還沒裝好。把手表解鎖，等「續播」出現後再傳。")
    }
    guard enqueueTransfer(transfer, session: session) else {
      throw watchError("手機上的音檔是空的，沒有傳到手表。")
    }
  }

  @discardableResult
  private func enqueueTransfer(_ transfer: PendingEpisodeTransfer, session: WCSession) -> Bool {
    let bytes = fileByteCount(transfer.url)
    guard bytes > 0 else { return false }
    var metadata = transfer.metadata
    metadata["bytes"] = NSNumber(value: bytes)
    let fileTransfer = session.transferFile(transfer.url, metadata: metadata)
    track(fileTransfer, expectedBytes: bytes)
    let episodeId = stringValue(metadata["episodeId"]) ?? ""
    emitTransferProgress(
      episodeId: episodeId,
      title: stringValue(metadata["title"]) ?? "",
      showTitle: stringValue(metadata["showTitle"]) ?? "",
      positionMillis: numberValue(metadata["positionMillis"]),
      startPlayback: boolValue(metadata["startPlayback"]),
      publishedAt: stringValue(metadata["publishedAt"]),
      episodeOrder: stringValue(metadata["episodeOrder"]) ?? "newest",
      written: 0,
      expected: bytes,
      force: true,
      notifyWatch: true
    )
    return true
  }

  private func track(_ fileTransfer: WCSessionFileTransfer, expectedBytes: Int64) {
    let tracked = TrackedFileTransfer(
      transfer: fileTransfer,
      episodeId: stringValue(fileTransfer.file.metadata?["episodeId"]) ?? "",
      title: stringValue(fileTransfer.file.metadata?["title"]) ?? "",
      showTitle: stringValue(fileTransfer.file.metadata?["showTitle"]) ?? "",
      positionMillis: numberValue(fileTransfer.file.metadata?["positionMillis"]),
      startPlayback: fileTransfer.file.metadata?["startPlayback"] == nil
        || boolValue(fileTransfer.file.metadata?["startPlayback"]),
      publishedAt: stringValue(fileTransfer.file.metadata?["publishedAt"]),
      episodeOrder: stringValue(fileTransfer.file.metadata?["episodeOrder"]) ?? "newest",
      expectedBytes: expectedBytes
    )
    transferLock.lock()
    trackedTransfers[ObjectIdentifier(fileTransfer)] = tracked
    transferLock.unlock()
    DispatchQueue.main.async {
      self.startProgressTimerIfNeeded()
    }
  }

  private func untrack(_ fileTransfer: WCSessionFileTransfer) {
    transferLock.lock()
    trackedTransfers.removeValue(forKey: ObjectIdentifier(fileTransfer))
    let remaining = trackedTransfers.count
    transferLock.unlock()
    if remaining == 0 {
      DispatchQueue.main.async {
        self.progressTimer?.invalidate()
        self.progressTimer = nil
      }
    }
  }

  private func startProgressTimerIfNeeded() {
    guard progressTimer == nil else { return }
    let timer = Timer(timeInterval: 0.35, repeats: true) { [weak self] _ in
      self?.pollTransferProgress()
    }
    RunLoop.main.add(timer, forMode: .common)
    progressTimer = timer
    pollTransferProgress()
  }

  private func pollTransferProgress() {
    // WCSessionFileTransfer.progress KVO is unreliable; poll outstanding transfers instead.
    var items: [TrackedFileTransfer] = []
    transferLock.lock()
    items = Array(trackedTransfers.values)
    transferLock.unlock()

    if WCSession.isSupported() {
      let session = WCSession.default
      for fileTransfer in session.outstandingFileTransfers {
        let key = ObjectIdentifier(fileTransfer)
        transferLock.lock()
        let known = trackedTransfers[key] != nil
        transferLock.unlock()
        if !known {
          let bytes = int64Value(fileTransfer.file.metadata?["bytes"])
          track(fileTransfer, expectedBytes: bytes > 0 ? bytes : 0)
        }
      }
      transferLock.lock()
      items = Array(trackedTransfers.values)
      transferLock.unlock()
    }

    if items.isEmpty {
      progressTimer?.invalidate()
      progressTimer = nil
      return
    }

    for item in items {
      guard item.transfer.isTransferring || item.transfer.progress.fractionCompleted < 1 else { continue }
      let written = readTransferredBytes(item.transfer.progress, expectedBytes: item.expectedBytes)
      let expected = item.expectedBytes > 0
        ? item.expectedBytes
        : max(item.transfer.progress.totalUnitCount, 0)
      emitTransferProgress(
        episodeId: item.episodeId,
        title: item.title,
        showTitle: item.showTitle,
        positionMillis: item.positionMillis,
        startPlayback: item.startPlayback,
        publishedAt: item.publishedAt,
        episodeOrder: item.episodeOrder,
        written: written,
        expected: expected,
        force: false,
        notifyWatch: true
      )
    }
  }

  private func readTransferredBytes(_ progress: Progress, expectedBytes: Int64) -> Int64 {
    if progress.completedUnitCount > 0 {
      return progress.completedUnitCount
    }
    let fraction = max(0, min(1, progress.fractionCompleted))
    if expectedBytes > 0, fraction > 0 {
      return Int64((Double(expectedBytes) * fraction).rounded(.down))
    }
    if progress.totalUnitCount > 0, fraction > 0 {
      return Int64((Double(progress.totalUnitCount) * fraction).rounded(.down))
    }
    return 0
  }

  private func emitTransferProgress(
    episodeId: String,
    title: String,
    showTitle: String,
    positionMillis: Double,
    startPlayback: Bool,
    publishedAt: String?,
    episodeOrder: String,
    written: Int64,
    expected: Int64,
    force: Bool,
    notifyWatch: Bool
  ) {
    guard !episodeId.isEmpty else { return }
    let percent = expected > 0 ? Int((Double(written) / Double(expected) * 100).rounded(.down)) : -1
    let now = Date().timeIntervalSince1970
    if !force {
      if let lastPercent = lastProgressPercent[episodeId], percent >= 0, lastPercent == percent,
         let lastAt = lastProgressEmitAt[episodeId], now - lastAt < 0.35
      {
        return
      }
      if percent < 0, let lastAt = lastProgressEmitAt[episodeId], now - lastAt < 0.35 {
        return
      }
    }
    lastProgressEmitAt[episodeId] = now
    if percent >= 0 {
      lastProgressPercent[episodeId] = percent
    }

    var payload: [String: Any] = [
      "watchTransferProgress": true,
      "episodeId": episodeId,
      "title": title,
      "showTitle": showTitle,
      "positionMillis": positionMillis,
      "startPlayback": startPlayback,
      "episodeOrder": episodeOrder == "oldest" ? "oldest" : "newest",
      "written": NSNumber(value: written),
      "bytes": NSNumber(value: expected),
    ]
    if let publishedAt, !publishedAt.isEmpty {
      payload["publishedAt"] = publishedAt
    }
    // Always update the phone UI.
    DispatchQueue.main.async {
      self.onProgress?(payload)
    }

    // Never queue progress via transferUserInfo — it competes with the file transfer.
    // Only poke the watch when reachable.
    guard notifyWatch, WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled, session.isReachable
    else { return }
    session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in })
  }

  func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
    untrack(fileTransfer)
    let episodeId = stringValue(fileTransfer.file.metadata?["episodeId"]) ?? ""
    if let error {
      var payload: [String: Any] = ["error": "watch-transfer"]
      if !episodeId.isEmpty {
        payload["episodeId"] = episodeId
      }
      _ = error
      DispatchQueue.main.async {
        self.onProgress?(payload)
      }
      return
    }
    if !episodeId.isEmpty {
      let bytes = int64Value(fileTransfer.file.metadata?["bytes"])
      let expected = bytes > 0 ? bytes : fileByteCount(fileTransfer.file.fileURL)
      emitTransferProgress(
        episodeId: episodeId,
        title: stringValue(fileTransfer.file.metadata?["title"]) ?? "",
        showTitle: stringValue(fileTransfer.file.metadata?["showTitle"]) ?? "",
        positionMillis: numberValue(fileTransfer.file.metadata?["positionMillis"]),
        startPlayback: fileTransfer.file.metadata?["startPlayback"] == nil
          || boolValue(fileTransfer.file.metadata?["startPlayback"]),
        publishedAt: stringValue(fileTransfer.file.metadata?["publishedAt"]),
        episodeOrder: stringValue(fileTransfer.file.metadata?["episodeOrder"]) ?? "newest",
        written: expected,
        expected: expected,
        force: true,
        notifyWatch: true
      )
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if deliverWatchNotice(message) { return }
    emit(message)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    emit(applicationContext)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    if deliverWatchNotice(userInfo) { return }
    emit(userInfo)
  }

  private func deliverWatchNotice(_ payload: [String: Any]) -> Bool {
    if let saved = payload["watchSaved"] as? String, !saved.isEmpty {
      DispatchQueue.main.async {
        self.onProgress?(["watchSaved": saved])
      }
      return true
    }
    guard
      let error = payload["error"] as? String,
      error == "watch-full" || error == "watch-size" || error == "watch-transfer" || error == "watch-network"
    else {
      return false
    }
    DispatchQueue.main.async {
      self.onProgress?(payload)
    }
    return true
  }

  private func emit(_ payload: [String: Any]) {
    guard let progress = progressPayload(payload) else { return }
    DispatchQueue.main.async {
      self.onProgress?(progress)
    }
  }
}

private struct PendingEpisodeTransfer {
  let url: URL
  let metadata: [String: Any]
}

private struct TrackedFileTransfer {
  let transfer: WCSessionFileTransfer
  let episodeId: String
  let title: String
  let showTitle: String
  let positionMillis: Double
  let startPlayback: Bool
  let publishedAt: String?
  let episodeOrder: String
  let expectedBytes: Int64
}

private struct SendEpisodeOptions: Record {
  @Field var uri: String = ""
  @Field var episodeId: String = ""
  @Field var title: String = ""
  @Field var showTitle: String = ""
  @Field var positionMillis: Double = 0
  @Field var startPlayback: Bool = false
  @Field var publishedAt: String?
  @Field var episodeOrder: String = "newest"
}

private func progressPayload(_ payload: [String: Any]) -> [String: Any]? {
  guard let episodeId = payload["episodeId"] as? String, !episodeId.isEmpty else { return nil }
  // Ignore transfer-progress dictionaries here; they are emitted separately.
  if boolValue(payload["watchTransferProgress"]) { return nil }
  let position = (payload["positionMillis"] as? NSNumber)?.doubleValue ?? 0
  let duration = (payload["durationMillis"] as? NSNumber)?.doubleValue ?? 0
  let completed = boolValue(payload["completed"])
  return [
    "episodeId": episodeId,
    "positionMillis": position,
    "durationMillis": duration,
    "completed": completed,
  ]
}

private func boolValue(_ value: Any?) -> Bool {
  if let number = value as? NSNumber {
    return number.boolValue
  }
  if let flag = value as? Bool {
    return flag
  }
  return false
}

private func stringValue(_ value: Any?) -> String? {
  if let text = value as? String, !text.isEmpty { return text }
  return nil
}

private func numberValue(_ value: Any?) -> Double {
  if let number = value as? NSNumber { return number.doubleValue }
  if let number = value as? Double { return number }
  if let number = value as? Int { return Double(number) }
  return 0
}

private func int64Value(_ value: Any?) -> Int64 {
  if let number = value as? NSNumber { return number.int64Value }
  if let number = value as? Int64 { return number }
  if let number = value as? Int { return Int64(number) }
  return 0
}

private func fileByteCount(_ url: URL) -> Int64 {
  if let handle = try? FileHandle(forReadingFrom: url) {
    defer { try? handle.close() }
    if let end = try? handle.seekToEnd() {
      return Int64(clamping: end)
    }
  }
  if let values = try? url.resourceValues(forKeys: [.fileSizeKey]), let size = values.fileSize {
    return Int64(size)
  }
  guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path) else { return 0 }
  switch attributes[.size] {
  case let number as NSNumber:
    return number.int64Value
  case let value as UInt64:
    return Int64(clamping: value)
  case let value as Int:
    return Int64(value)
  case let value as Int64:
    return value
  default:
    return 0
  }
}

private func localFileURL(_ uri: String) -> URL {
  if let url = URL(string: uri), url.isFileURL {
    return url
  }
  return URL(fileURLWithPath: uri)
}

private func watchError(_ message: String) -> NSError {
  NSError(domain: "WatchTransfer", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

public class WatchTransferModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchTransfer")
    Events("progress", "playback")
    onCreateDefinition()
    playLocalDefinition()
    loadLocalDefinition()
    pauseLocalDefinition()
    resumeLocalDefinition()
    seekLocalDefinition()
    stopLocalDefinition()
    localStatusDefinition()
    latestProgressDefinition()
    preparePlaybackDefinition()
    sendEpisodeDefinition()
    deleteEpisodeDefinition()
  }

  private func onCreateDefinition() -> AnyDefinition {
    OnCreate {
      PhoneWatchSession.shared.onProgress = { [weak self] payload in
        self?.sendEvent("progress", payload)
      }
      PhoneWatchSession.shared.start()
      LocalPlayer.shared.onUpdate = { [weak self] payload in
        self?.sendEvent("playback", payload)
      }
    }
  }

  private func playLocalDefinition() -> AnyDefinition {
    AsyncFunction("playLocal") { (uri: String, positionMillis: Double, title: String, showTitle: String) -> [String: Any] in
      try LocalPlayer.shared.play(uri: uri, positionMillis: positionMillis, title: title, showTitle: showTitle)
    }
  }

  private func loadLocalDefinition() -> AnyDefinition {
    AsyncFunction("loadLocal") { (uri: String, positionMillis: Double, title: String, showTitle: String) -> [String: Any] in
      try LocalPlayer.shared.load(uri: uri, positionMillis: positionMillis, title: title, showTitle: showTitle)
    }
  }

  private func pauseLocalDefinition() -> AnyDefinition {
    Function("pauseLocal") { () -> [String: Any] in
      LocalPlayer.shared.pause()
    }
  }

  private func resumeLocalDefinition() -> AnyDefinition {
    Function("resumeLocal") { () throws -> [String: Any] in
      try LocalPlayer.shared.resume()
    }
  }

  private func seekLocalDefinition() -> AnyDefinition {
    Function("seekLocal") { (positionMillis: Double) -> [String: Any] in
      LocalPlayer.shared.seek(to: positionMillis)
    }
  }

  private func stopLocalDefinition() -> AnyDefinition {
    Function("stopLocal") { () -> Void in
      LocalPlayer.shared.stop()
    }
  }

  private func localStatusDefinition() -> AnyDefinition {
    Function("localStatus") { () -> [String: Any] in
      LocalPlayer.shared.snapshot()
    }
  }

  private func latestProgressDefinition() -> AnyDefinition {
    Function("latestProgress") { () -> [String: Any]? in
      PhoneWatchSession.shared.latestProgress()
    }
  }

  private func preparePlaybackDefinition() -> AnyDefinition {
    AsyncFunction("preparePlayback") { (uri: String) -> Void in
      let fileURL = localFileURL(uri)
      guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
      try FileManager.default.setAttributes(
        [.protectionKey: FileProtectionType.none],
        ofItemAtPath: fileURL.path
      )
    }
  }

  private func sendEpisodeDefinition() -> AnyDefinition {
    AsyncFunction("sendEpisode") { (options: SendEpisodeOptions) -> Void in
      try PhoneWatchSession.shared.sendEpisode(
        uri: options.uri,
        episodeId: options.episodeId,
        title: options.title,
        showTitle: options.showTitle,
        positionMillis: options.positionMillis,
        startPlayback: options.startPlayback,
        publishedAt: options.publishedAt,
        episodeOrder: options.episodeOrder
      )
    }
  }

  private func deleteEpisodeDefinition() -> AnyDefinition {
    Function("deleteEpisodeOnWatch") { (episodeId: String) -> Void in
      PhoneWatchSession.shared.deleteEpisodeOnWatch(episodeId: episodeId)
    }
  }
}
