#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * chaybo — Lock Screen / Dynamic Island Live Activity.
 *
 * `expo-widgets` renders Live Activity layouts from JavaScript that the app
 * writes into an **App Group** container, and the widget extension reads it
 * back from that shared container. Apple IDs that are not part of the paid
 * Developer Program cannot provision App Groups, and every free signing tool
 * (iLoader, Sideloader, AltStore…) strips that entitlement — so the JS layout
 * never reaches the extension and the Lock Screen stays empty.
 *
 * This patch makes the extension draw the run itself, in Swift, straight from
 * the ActivityKit content state (`distance`, `duration`, `pace`, `status`).
 * That data travels with the activity, so no App Group is needed at all.
 *
 * The patch is idempotent and runs from `postinstall`.
 */
const fs = require('fs');
const path = require('path');

const TARGET = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-widgets',
  'ios',
  'Widgets',
  'WidgetLiveActivity.swift'
);

const MARKER = 'chayboRunActivityName';

const BANNER_REPLACEMENT = `ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      if context.state.name == chayboRunActivityName {
        ChayboRunLockScreenView(state: ChayboRunActivityState(json: context.state.props))
      } else {
        let nodes = getLiveActivityNodes(
          forName: context.state.name,
          props: context.state.props,
          environment: getLiveActivityEnvironment(for: env, in: context)
        )
        // Only apply widgetURL when the activity has one: a hierarchy with more than one
        // widgetURL modifier is undefined behavior, and layouts can set their own through
        // the widgetURL modifier from @expo/ui.
        let banner = LiveActivityBannerView(context: context, nodes: nodes)
        if let url = context.attributes.url.flatMap(URL.init(string:)) {
          banner.widgetURL(url)
        } else {
          banner
        }
      }
    } dynamicIsland: { context in`;

const NATIVE_SOURCE = `
// MARK: - chaybo run Live Activity (native, no App Group)

let chayboRunActivityName = "ChayboRun"

struct ChayboRunActivityState {
  var distance: String = "--"
  var distanceUnit: String = "km"
  var duration: String = "--:--"
  var pace: String = "--"
  var paceUnit: String = "/km"
  var status: String = "running"

  init(json: String?) {
    guard let raw = json, let data = raw.data(using: .utf8) else {
      return
    }
    guard let parsed = try? JSONSerialization.jsonObject(with: data),
          let object = parsed as? [String: Any] else {
      return
    }
    distance = object["distance"] as? String ?? distance
    distanceUnit = object["distanceUnit"] as? String ?? distanceUnit
    duration = object["duration"] as? String ?? duration
    pace = object["pace"] as? String ?? pace
    paceUnit = object["paceUnit"] as? String ?? paceUnit
    status = object["status"] as? String ?? status
  }

  var isPaused: Bool {
    status == "paused"
  }

  var paceText: String {
    pace == "--" ? "--" : pace + paceUnit
  }
}

enum ChayboRunStyle {
  static var background: Color {
    Color(red: 0.031, green: 0.035, blue: 0.039)
  }

  static var accent: Color {
    Color(red: 0.847, green: 1.0, blue: 0.243)
  }

  static var primary: Color {
    Color.white
  }

  static var secondary: Color {
    Color.white.opacity(0.55)
  }
}

struct ChayboRunMetric: View {
  let label: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.system(size: 9, weight: .semibold))
        .tracking(0.8)
        .foregroundStyle(ChayboRunStyle.secondary)
      Text(value)
        .font(.system(size: 17, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(ChayboRunStyle.primary)
    }
  }
}

struct ChayboRunLockScreenView: View {
  let state: ChayboRunActivityState

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 6) {
        Text("CHAYBO")
          .font(.system(size: 11, weight: .heavy))
          .tracking(1.6)
          .foregroundStyle(ChayboRunStyle.accent)
        Spacer(minLength: 8)
        Text(state.isPaused ? "TẠM DỪNG" : "ĐANG CHẠY")
          .font(.system(size: 10, weight: .bold))
          .tracking(0.6)
          .foregroundStyle(state.isPaused ? ChayboRunStyle.secondary : ChayboRunStyle.accent)
          .padding(.horizontal, 8)
          .padding(.vertical, 3)
          .background(Capsule().fill(Color.white.opacity(0.10)))
      }

      HStack(alignment: .firstTextBaseline, spacing: 5) {
        Text(state.distance)
          .font(.system(size: 40, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(ChayboRunStyle.primary)
        Text(state.distanceUnit)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(ChayboRunStyle.secondary)
      }

      HStack(spacing: 18) {
        ChayboRunMetric(label: "THỜI GIAN", value: state.duration)
        ChayboRunMetric(label: "PACE", value: state.paceText)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .activityBackgroundTint(ChayboRunStyle.background)
    .activitySystemActionForegroundColor(ChayboRunStyle.primary)
  }
}

struct ChayboRunIslandRegion: View {
  let state: ChayboRunActivityState
  let section: String

  var body: some View {
    switch section {
    case "compactLeading":
      Image(systemName: "figure.run")
        .font(.system(size: 13, weight: .bold))
        .foregroundStyle(ChayboRunStyle.accent)
    case "compactTrailing":
      Text(state.distance)
        .font(.system(size: 14, weight: .bold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(ChayboRunStyle.accent)
    case "minimal":
      Image(systemName: "figure.run")
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(ChayboRunStyle.accent)
    case "expandedLeading":
      ChayboRunMetric(label: "THỜI GIAN", value: state.duration)
    case "expandedTrailing":
      ChayboRunMetric(label: "PACE", value: state.paceText)
    case "expandedCenter":
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text(state.distance)
          .font(.system(size: 28, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(ChayboRunStyle.primary)
        Text(state.distanceUnit)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(ChayboRunStyle.secondary)
      }
    default:
      EmptyView()
    }
  }
}

@ViewBuilder
func chayboRunIslandRegion(
  context: ActivityViewContext<LiveActivityAttributes>,
  nodes: [String: Any],
  section: String
) -> some View {
  if context.state.name == chayboRunActivityName {
    ChayboRunIslandRegion(
      state: ChayboRunActivityState(json: context.state.props),
      section: section
    )
  } else {
    LiveActivitySectionView(context: context, nodes: nodes, sectionName: section)
  }
}
`;

function main() {
  if (!fs.existsSync(TARGET)) {
    console.warn('[chaybo] expo-widgets not installed — skipping Live Activity patch.');
    return;
  }

  let source = fs.readFileSync(TARGET, 'utf8');

  if (source.includes(MARKER)) {
    return;
  }

  if (!source.includes('import Foundation')) {
    source = source.replace('import SwiftUI', 'import Foundation\nimport SwiftUI');
  }

  const bannerPattern =
    /ActivityConfiguration\(for: LiveActivityAttributes\.self\) \{ context in[\s\S]*?\n    \} dynamicIsland: \{ context in/;

  if (!bannerPattern.test(source)) {
    throw new Error(
      '[chaybo] Could not find the Live Activity banner in WidgetLiveActivity.swift. ' +
        'The expo-widgets layout changed — update scripts/patch-expo-widgets-live-activity.js.'
    );
  }

  source = source.replace(bannerPattern, BANNER_REPLACEMENT);

  source = source.replace(
    /LiveActivitySectionView\(context: context, nodes: nodes, sectionName: ("[A-Za-z]+")\)/g,
    'chayboRunIslandRegion(context: context, nodes: nodes, section: $1)'
  );

  source = `${source.trimEnd()}\n${NATIVE_SOURCE}`;

  fs.writeFileSync(TARGET, source, 'utf8');
  console.log('[chaybo] Patched expo-widgets Live Activity to render natively (no App Group).');
}

main();
