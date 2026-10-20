import QtQuick
import org.kde.taskmanager as TaskManager
import org.kde.kwindowsystem

import "code/coverage.js" as Coverage

// Occlusion detection for one screen. Loaded dynamically by main.qml (Qt.createComponent), so a
// missing org.kde.taskmanager / kwindowsystem module (or any error) just leaves the wallpaper
// running as before (fail-open).
//
// covered = on this screen, current virtual desktop and current activity, with the desktop not
// being "shown", there is a visible (not minimized, not hidden) window that
//   - is maximized or fullscreen, or
//   - together with the other visible windows hides at least `pauseCoverage` percent of the
//     screen (coverage.js: union of the window rectangles, sampled on a 48x27 grid).
Item {
    id: occ

    property rect screenRect: Qt.rect(0, 0, 0, 0)    // global logical coordinates
    property int pauseCoverage: 90                   // percent, 50..100
    property bool covered: false
    property real coverage: 0                        // 0..1 share of the screen behind windows (informational)
    property bool maximizedCover: false              // a maximized/fullscreen window is present

    TaskManager.VirtualDesktopInfo { id: vdInfo }
    TaskManager.ActivityInfo { id: actInfo }

    TaskManager.TasksModel {
        id: tasks
        filterByScreen: true
        filterByCurrentVirtualDesktop: true
        filterByActivity: true
        filterHidden: true
        filterMinimized: true
        groupMode: TaskManager.TasksModel.GroupDisabled
        screenGeometry: occ.screenRect
        activity: actInfo.currentActivity
    }

    function recompute() {
        var maxFs = false, cov = 0;
        if (screenRect.width > 0 && screenRect.height > 0 && !KWindowSystem.showingDesktop) {
            var rects = [];
            for (var i = 0; i < tasks.count; i++) {
                var idx = tasks.index(i, 0);
                if (tasks.data(idx, TaskManager.AbstractTasksModel.IsWindow) !== true) continue;
                if (tasks.data(idx, TaskManager.AbstractTasksModel.IsMaximized) === true
                    || tasks.data(idx, TaskManager.AbstractTasksModel.IsFullScreen) === true)
                    maxFs = true;
                var g = tasks.data(idx, TaskManager.AbstractTasksModel.Geometry);
                if (g && g.width > 0 && g.height > 0) rects.push({ x: g.x, y: g.y, width: g.width, height: g.height });
            }
            if (!maxFs) cov = Coverage.coverage(rects, { x: screenRect.x, y: screenRect.y, width: screenRect.width, height: screenRect.height });
        }
        var c = maxFs || Coverage.isCovered(cov, pauseCoverage);
        if (maximizedCover !== maxFs) maximizedCover = maxFs;
        if (Math.abs(coverage - cov) > 0.0005) coverage = cov;
        if (covered !== c) covered = c;
    }
    function schedule() { recomputeTimer.restart(); }

    // Coalesce bursts of model signals (including Geometry changes while a window is dragged)
    // into one recompute
    Timer { id: recomputeTimer; interval: 50; onTriggered: occ.recompute() }

    Connections { target: tasks; function onCountChanged() { occ.schedule(); } }
    Connections { target: tasks; function onDataChanged() { occ.schedule(); } }
    Connections { target: tasks; function onRowsInserted() { occ.schedule(); } }
    Connections { target: tasks; function onRowsRemoved() { occ.schedule(); } }
    Connections { target: tasks; function onModelReset() { occ.schedule(); } }
    Connections { target: tasks; function onLayoutChanged() { occ.schedule(); } }
    Connections { target: actInfo; function onCurrentActivityChanged() { occ.schedule(); } }
    Connections { target: vdInfo; function onCurrentDesktopChanged() { occ.schedule(); } }
    Connections { target: KWindowSystem; function onShowingDesktopChanged() { occ.schedule(); } }
    onScreenRectChanged: schedule()
    onPauseCoverageChanged: schedule()
    Component.onCompleted: recompute()
}
