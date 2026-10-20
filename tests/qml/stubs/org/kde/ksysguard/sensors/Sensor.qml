import QtQuick

// Test stub of the ksysguard Sensor (no daemon offscreen).
QtObject {
    property string sensorId: ""
    property int updateRateLimit: 0
    property bool enabled: true
    property var value: 0
}
